import { buildCandidateProfile } from "./profileBuilder";
import { runAllAgentsIndependently } from "./agentPersonas";
import { detectConflicts, runPrimaryDebateThread, runSecondaryDebateTurn } from "./debate";
import { runFinalDecision } from "./finalDecision";

/**
 * Full pipeline for ONE candidate: profile -> 4 independent agents ->
 * conflict/discussion detection -> debate -> final decision.
 * Called once per candidate by the API route (sequential across candidates
 * to stay within free-tier rate limits).
 */
export async function analyzeCandidate({ candidateId, jobDescription, resume, transcript }) {
  const { profile } = await buildCandidateProfile({ jobDescription, resume, transcript });

  const independentOpinions = await runAllAgentsIndependently({ jobDescription, profile });
  const opinionsByAgentId = Object.fromEntries(independentOpinions.map((o) => [o.agentId, o]));

  const { conflicts, usingFallbackDiscussion } = await detectConflicts(independentOpinions);

  let debateTurns = [];
  if (conflicts.length > 0) {
    const [primary, ...rest] = conflicts;
    const primaryTurns = await runPrimaryDebateThread(primary, opinionsByAgentId);
    debateTurns.push(...primaryTurns);

    // Cap extra conflicts at 2 to keep total API calls reasonable.
    for (const c of rest.slice(0, 2)) {
      const t = await runSecondaryDebateTurn(c, opinionsByAgentId);
      if (t) debateTurns.push(t);
    }
  }

  // Final effective opinion per agent = latest opinionChanged turn, if any.
  const finalOpinions = independentOpinions.map((o) => {
    const changes = debateTurns.filter((t) => t.respondingAgent === o.agentId && t.opinionChanged);
    const lastChange = changes[changes.length - 1];
    if (lastChange) {
      return {
        agentId: o.agentId,
        version: 2,
        originalRecommendation: o.recommendation,
        originalConfidence: o.confidence,
        recommendation: lastChange.revisedRecommendation || o.recommendation,
        confidence: lastChange.revisedConfidence ?? o.confidence,
        changeReason: lastChange.argument,
        changedInTurn: lastChange.turnId,
      };
    }
    return { agentId: o.agentId, version: 1, recommendation: o.recommendation, confidence: o.confidence };
  });

  const finalDecision = await runFinalDecision({ jobDescription, profile, independentOpinions, debateTurns, conflicts });

  return {
    candidateId,
    profile,
    independentOpinions,
    conflicts,
    usingFallbackDiscussion,
    debateTurns,
    finalOpinions,
    finalDecision,
  };
}

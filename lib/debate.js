import { generateJSON } from "./gemini";

const CONFLICT_SYSTEM = `You are a neutral panel coordinator reviewing 4 independent hiring-panel
opinions. Identify genuine disagreements (different recommendations, or contradictory key
points/concerns about the same topic). Do NOT invent a conflict that isn't really there.

If the four agents substantially agree (same recommendation direction, no real contradictions),
leave "conflicts" empty and instead set "fallbackDiscussionTopic" to the single MOST IMPORTANT
unresolved concern raised by any one agent — something worth the panel discussing further even
without disagreement (e.g. a risk, an evidence gap, a borderline call). Pick a sensible
respondent for that agent to discuss it with (e.g. hiring_manager for overall risk, skeptic for
evidence gaps, technical for depth questions). Do not fabricate a disagreement to fill this.

Output ONLY valid JSON:
{
  "conflicts": [ { "conflictId": "string", "agentA": "string", "agentB": "string", "topic": "string", "pointFromA": "string", "pointFromB": "string", "severity": "high"|"medium"|"low" } ],
  "fallbackDiscussionTopic": null | { "raisedBy": "string", "respondent": "string", "topic": "string", "statement": "string" }
}
agent ids must be one of: technical, hr_culture, hiring_manager, skeptic.`;

export async function detectConflicts(opinions) {
  const trimmed = opinions.map((o) => ({
    agentId: o.agentId,
    recommendation: o.recommendation,
    confidence: o.confidence,
    keyPoints: o.keyPoints,
    concerns: o.concerns,
  }));
  const result = await generateJSON({
    systemInstruction: CONFLICT_SYSTEM,
    prompt: `OPINIONS:\n${JSON.stringify(trimmed, null, 2)}`,
  });

  let conflicts = result.conflicts || [];
  let usingFallbackDiscussion = false;

  if (conflicts.length === 0 && result.fallbackDiscussionTopic) {
    usingFallbackDiscussion = true;
    const f = result.fallbackDiscussionTopic;
    conflicts = [{
      conflictId: "discussion_1",
      agentA: f.raisedBy,
      agentB: f.respondent,
      topic: f.topic,
      pointFromA: f.statement,
      pointFromB: null,
      severity: "high",
      isDiscussionOnly: true,
    }];
  }

  return { conflicts, usingFallbackDiscussion };
}

const DEBATE_SYSTEM = `You are one agent on a hiring panel, responding to a specific point raised
by another agent (or, in a discussion-only case, elaborating your own view on an important
concern another agent flagged). Respond DIRECTLY to it: state whether you agree, disagree, or
partially agree, give your reasoning, and say whether this changes your recommendation or
confidence. Be honest — if the point is well-evidenced, it's fine to change your mind; if it
isn't, defend your original view. Output ONLY valid JSON:
{ "stance": "agree"|"disagree"|"partially_agree", "argument": "string", "evidenceIds": ["ev1"], "opinionChanged": boolean, "revisedRecommendation": "strong_yes"|"yes"|"leaning_no"|"no"|"insufficient_evidence"|null, "revisedConfidence": number|null }`;

async function runDebateTurn({ conflictId, respondingAgentId, respondingAgentOriginalOpinion, opposingAgentId, opposingPoint }) {
  const prompt = `You are agent "${respondingAgentId}". Your original opinion was:
${JSON.stringify({
    recommendation: respondingAgentOriginalOpinion.recommendation,
    confidence: respondingAgentOriginalOpinion.confidence,
    keyPoints: respondingAgentOriginalOpinion.keyPoints,
    concerns: respondingAgentOriginalOpinion.concerns,
  }, null, 2)}

Agent "${opposingAgentId}" raised this point:
"${opposingPoint}"

Respond directly to it now.`;
  const turn = await generateJSON({ systemInstruction: DEBATE_SYSTEM, prompt });
  return { turnId: `${conflictId}_r${Date.now()}_${respondingAgentId}`, conflictId, respondingAgent: respondingAgentId, opposingAgent: opposingAgentId, ...turn };
}

/**
 * The "important issue" gets a real back-and-forth: up to 3 alternating
 * turns (agent B responds to A, then A responds to B's reply, then B again),
 * stopping early the moment an agent says "agree" — a resolved debate
 * shouldn't be padded out just to hit a round count.
 */
export async function runPrimaryDebateThread(conflict, opinionsByAgentId, maxTurns = 3) {
  const turns = [];
  let respondingAgent = conflict.agentB;
  let opposingAgent = conflict.agentA;
  let opposingArgument = conflict.pointFromA;

  for (let round = 1; round <= maxTurns; round++) {
    if (!opinionsByAgentId[respondingAgent]) break;
    const turn = await runDebateTurn({
      conflictId: conflict.conflictId,
      respondingAgentId: respondingAgent,
      respondingAgentOriginalOpinion: opinionsByAgentId[respondingAgent],
      opposingAgentId: opposingAgent,
      opposingPoint: opposingArgument,
    });
    turns.push({ ...turn, round, isPrimaryThread: true, topic: conflict.topic });

    if (turn.stance === "agree") break; // resolved — don't manufacture more back-and-forth

    opposingArgument = turn.argument;
    [respondingAgent, opposingAgent] = [opposingAgent, respondingAgent];
  }
  return turns;
}

/**
 * Lower-priority conflicts get a single direct response (one call) instead
 * of a full thread, to keep total API usage reasonable.
 */
export async function runSecondaryDebateTurn(conflict, opinionsByAgentId) {
  if (!opinionsByAgentId[conflict.agentB]) return null;
  const turn = await runDebateTurn({
    conflictId: conflict.conflictId,
    respondingAgentId: conflict.agentB,
    respondingAgentOriginalOpinion: opinionsByAgentId[conflict.agentB],
    opposingAgentId: conflict.agentA,
    opposingPoint: conflict.pointFromA,
  });
  return { ...turn, round: 1, isPrimaryThread: false, topic: conflict.topic };
}

import { generateJSON } from "./gemini";

const FINAL_SYSTEM = `You are the Final Decision agent on a hiring panel. You are given the
job description, the candidate profile, the four agents' ORIGINAL independent opinions,
identified conflicts, and the debate turns (including any opinion changes). Weigh evidence
quality, agent confidence, and unresolved disagreements to reach ONE final hiring decision.
Do NOT simply average the four confidence scores — explicitly reason about which points
matter most and why. A single well-evidenced Skeptic concern can outweigh multiple agents'
unsupported optimism. If evidence is genuinely insufficient to decide, say so rather than
inventing a decision. Output ONLY valid JSON:
{ "recommendation": "hire"|"no_hire"|"hire_with_reservations"|"insufficient_evidence", "confidence": number(0-100), "reasoningSteps": ["string"], "strengths": ["string"], "concerns": ["string"], "unresolvedDisagreements": ["string"] }`;

export async function runFinalDecision({ jobDescription, profile, independentOpinions, debateTurns, conflicts }) {
  const prompt = `JOB DESCRIPTION:
${jobDescription}

CANDIDATE: ${profile.candidateName}

INDEPENDENT OPINIONS (v1, before debate):
${JSON.stringify(independentOpinions.map((o) => ({
    agentId: o.agentId,
    recommendation: o.recommendation,
    confidence: o.confidence,
    keyPoints: o.keyPoints,
    concerns: o.concerns,
    insufficientEvidenceAreas: o.insufficientEvidenceAreas,
  })), null, 2)}

CONFLICTS IDENTIFIED:
${JSON.stringify(conflicts, null, 2)}

DEBATE TURNS:
${JSON.stringify(debateTurns, null, 2)}

Reach the final decision now.`;
  return generateJSON({ systemInstruction: FINAL_SYSTEM, prompt });
}

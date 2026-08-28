import { generateJSON } from "./gemini";

const OUTPUT_SCHEMA_NOTE = `Output ONLY valid JSON with EXACTLY this shape:
{
  "summary": "string, 2-3 sentences",
  "recommendation": "strong_yes" | "yes" | "leaning_no" | "no" | "insufficient_evidence",
  "confidence": number (0-100),
  "keyPoints": [ { "pointId": "string", "statement": "string", "evidenceIds": ["ev1"], "reasoning": "string" } ],
  "concerns": [ { "statement": "string", "evidenceIds": ["ev1"] } ],
  "insufficientEvidenceAreas": ["string"]
}
Every keyPoint and concern MUST reference real evidenceIds from the profile you were given.
If you cannot find supporting evidence for a point, do not make the point — put it in
insufficientEvidenceAreas instead.`;

const PERSONAS = {
  technical: {
    label: "Technical Agent",
    instruction: `You are the Technical Agent on a hiring panel. Focus ONLY on technical skill, technical depth, correctness of technical claims, and relevance to the job's technical requirements. Ignore communication style and culture fit — other agents cover those. ${OUTPUT_SCHEMA_NOTE}`,
  },
  hr_culture: {
    label: "HR / Culture Agent",
    instruction: `You are the HR / Culture Agent on a hiring panel. Focus ONLY on communication quality, teamwork signals, honesty/consistency between resume and transcript, and behavioral evidence. Ignore raw technical depth — another agent covers that. ${OUTPUT_SCHEMA_NOTE}`,
  },
  hiring_manager: {
    label: "Hiring Manager Agent",
    instruction: `You are the Hiring Manager Agent on a hiring panel. Focus on whether this candidate is worth hiring for THIS specific role: role fit, practical value, overall hiring risk. Weigh the job description heavily. ${OUTPUT_SCHEMA_NOTE}`,
  },
  skeptic: {
    label: "Skeptic Agent",
    instruction: `You are the Skeptic Agent on a hiring panel. Actively look for contradictions between the resume and transcript, exaggeration, unsupported claims, and red flags. Be constructively critical, not needlessly harsh, and every concern must cite real evidence. ${OUTPUT_SCHEMA_NOTE}`,
  },
};

function buildPrompt(agentId, jobDescription, profile) {
  return `JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILE (evidence-backed, extracted separately by another agent):
${JSON.stringify(profile, null, 2)}

Give your independent opinion now, based only on the above. You have not seen
and cannot see any other agent's opinion.`;
}

export async function runAgent(agentId, { jobDescription, profile }) {
  const persona = PERSONAS[agentId];
  if (!persona) throw new Error(`Unknown agent id: ${agentId}`);
  const startedAt = Date.now();
  const opinion = await generateJSON({
    systemInstruction: persona.instruction,
    prompt: buildPrompt(agentId, jobDescription, profile),
  });
  const finishedAt = Date.now();
  return { ...opinion, agentId, agentLabel: persona.label, startedAt, finishedAt };
}

export async function runAllAgentsIndependently({ jobDescription, profile }) {
  const agentIds = Object.keys(PERSONAS);
  // Promise.all = all 4 fire in parallel. None can see another's output —
  // the timestamps on each opinion prove they ran concurrently.
  return Promise.all(agentIds.map((id) => runAgent(id, { jobDescription, profile })));
}

export { PERSONAS };

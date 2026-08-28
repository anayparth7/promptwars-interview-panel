import { generateJSON } from "./gemini";
import { verifyProfile } from "./evidence";

const SYSTEM_INSTRUCTION = `You are the Candidate Profile Builder for a hiring panel system.

Your ONLY job is to read a job description, a resume, and an interview transcript,
then extract a neutral, factual, structured profile of the candidate.

Rules:
- Do NOT judge, score, or recommend anything. That is not your job.
- Build a single "evidence" list first. Every item in it must be a VERBATIM
  quote copied exactly from the resume or transcript text you were given —
  same words, same order, same spelling. Do not paraphrase, summarize, or
  fix typos in a quote. If you cannot find an exact quote to support
  something, do not invent one.
- Every skill, experience item, project/achievement, and claim must reference
  the id(s) of the evidence item(s) that support it, instead of repeating
  quote text inline.
- Every fact, claim, ambiguity, or missing-information statement must be
  DIRECTLY supported by the supplied job description, resume, or transcript
  text. If something cannot be established from the source material, say so
  as insufficient — do not infer or guess.
- Do NOT use outside knowledge (e.g. today's real-world date, general
  assumptions about what's "normal") to judge whether something is unusual,
  contradictory, or a red flag. Only flag an ambiguity/contradiction if it is
  an actual inconsistency BETWEEN THE SUPPLIED DOCUMENTS THEMSELVES (e.g.
  resume says X, transcript says Y). Do not flag dates or timelines as
  suspicious just because they seem unusual to you.
- Output ONLY valid JSON matching the schema you are given. No extra commentary.`;

function buildPrompt(jobDescription, resume, transcript) {
  return `JOB DESCRIPTION:
${jobDescription}

RESUME:
${resume}

INTERVIEW TRANSCRIPT:
${transcript}

Extract a structured candidate profile as JSON with EXACTLY this shape:

{
  "candidateName": "string (best guess from the resume, or 'Unknown' if unclear)",
  "evidence": [
    {
      "id": "ev1",
      "source": "resume" | "transcript",
      "exactQuote": "verbatim text copied exactly from that source",
      "supports": "short note on what this quote is evidence of"
    }
  ],
  "skills": [
    { "skill": "string", "evidenceIds": ["ev1"] }
  ],
  "experience": [
    { "description": "string", "evidenceIds": ["ev1"] }
  ],
  "projectsOrAchievements": [
    { "description": "string", "evidenceIds": ["ev1"] }
  ],
  "claimsMade": [
    { "claim": "string (something the candidate asserted about themselves)", "evidenceIds": ["ev1"] }
  ],
  "ambiguitiesOrMissingInfo": [
    "string describing something unclear, contradictory, or missing — must point to an actual gap or conflict IN THE DOCUMENTS, not an outside assumption"
  ]
}

Give each evidence item a unique id (ev1, ev2, ev3, ...). Reuse the same id
if multiple facts point to the same quote — don't duplicate the quote.`;
}

export async function buildCandidateProfile({ jobDescription, resume, transcript }) {
  const rawProfile = await generateJSON({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: buildPrompt(jobDescription, resume, transcript),
  });

  const profile = verifyProfile(rawProfile, { resume, transcript });
  const unverifiedCount = (profile.evidence || []).filter((e) => !e.verified).length;

  return {
    profile,
    meta: {
      totalEvidenceItems: (profile.evidence || []).length,
      unverifiedEvidenceItems: unverifiedCount,
    },
  };
}

/**
 * Evidence verification.
 *
 * The LLM is asked to give exact quotes, but LLMs sometimes paraphrase
 * anyway. This module checks each claimed quote against the real source
 * text in code (not via another LLM call — cheap and deterministic) and
 * marks it verified / unverified accordingly, instead of trusting it blindly.
 */

function normalizeWhitespace(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Checks one evidence item against the real resume/transcript text.
 * @param {{ id: string, source: "resume"|"transcript", exactQuote: string, supports: string }} item
 * @param {{ resume: string, transcript: string }} sources
 */
function verifyEvidenceItem(item, sources) {
  const sourceText = sources[item.source];

  if (!sourceText) {
    return { ...item, verified: false, verificationNote: `Unknown source "${item.source}"` };
  }
  if (!item.exactQuote || !item.exactQuote.trim()) {
    return { ...item, verified: false, verificationNote: "Empty quote" };
  }

  const normSource = normalizeWhitespace(sourceText);
  const normQuote = normalizeWhitespace(item.exactQuote);

  if (normSource.includes(normQuote)) {
    return { ...item, verified: true, verificationNote: null };
  }

  // Fallback: case-insensitive match. Still flagged, since it means the
  // model didn't reproduce the quote exactly — useful to know, not to hide.
  if (normSource.toLowerCase().includes(normQuote.toLowerCase())) {
    return { ...item, verified: true, verificationNote: "Matched case-insensitively (not exact case)" };
  }

  return { ...item, verified: false, verificationNote: "Quote not found verbatim in source" };
}

/**
 * Verifies every evidence item in a profile against the real source texts.
 */
export function verifyEvidenceList(evidenceList, sources) {
  return (evidenceList || []).map((item) => verifyEvidenceItem(item, sources));
}

/**
 * Checks that every evidenceIds reference used elsewhere in the profile
 * actually points to a real evidence item. Drops dangling references
 * instead of letting a fact silently point at nothing.
 */
export function crossCheckEvidenceIds(profile) {
  const validIds = new Set((profile.evidence || []).map((e) => e.id));

  function cleanRefs(list, field = "evidenceIds") {
    return (list || []).map((item) => {
      const original = item[field] || [];
      const kept = original.filter((id) => validIds.has(id));
      const dropped = original.filter((id) => !validIds.has(id));
      return {
        ...item,
        [field]: kept,
        ...(dropped.length ? { danglingEvidenceIdsRemoved: dropped } : {}),
      };
    });
  }

  return {
    ...profile,
    skills: cleanRefs(profile.skills),
    experience: cleanRefs(profile.experience),
    projectsOrAchievements: cleanRefs(profile.projectsOrAchievements),
    claimsMade: cleanRefs(profile.claimsMade),
  };
}

/**
 * Full post-processing pass: verify quotes, then clean dangling references.
 * Call this on every profile right after the LLM call, before returning it.
 */
export function verifyProfile(profile, sources) {
  const verifiedEvidence = verifyEvidenceList(profile.evidence, sources);
  const withVerifiedEvidence = { ...profile, evidence: verifiedEvidence };
  return crossCheckEvidenceIds(withVerifiedEvidence);
}

import { NextResponse } from "next/server";
import { analyzeCandidate } from "../../../lib/analyzeCandidate";

export async function POST(req) {
  try {
    const { jobDescription, candidateA, candidateB } = await req.json();

    if (!jobDescription || !candidateA?.resume || !candidateA?.transcript || !candidateB?.resume || !candidateB?.transcript) {
      return NextResponse.json(
        { error: "jobDescription, and both candidateA/candidateB (each with resume + transcript), are required." },
        { status: 400 }
      );
    }

    // Sequential across candidates (each candidate's own 4 agents still run
    // in parallel internally) to stay within free-tier rate limits.
    const resultA = await analyzeCandidate({ candidateId: "A", jobDescription, resume: candidateA.resume, transcript: candidateA.transcript });
    const resultB = await analyzeCandidate({ candidateId: "B", jobDescription, resume: candidateB.resume, transcript: candidateB.transcript });

    return NextResponse.json({ candidateA: resultA, candidateB: resultB });
  } catch (err) {
    console.error("analyze error:", err);
    return NextResponse.json({ error: err.message || "Analysis failed." }, { status: 500 });
  }
}

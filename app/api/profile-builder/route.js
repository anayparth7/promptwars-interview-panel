import { NextResponse } from "next/server";
import { buildCandidateProfile } from "../../../lib/profileBuilder";

export async function POST(req) {
  try {
    const { jobDescription, resume, transcript } = await req.json();
    if (!jobDescription || !resume || !transcript) {
      return NextResponse.json(
        { error: "jobDescription, resume, and transcript are all required." },
        { status: 400 }
      );
    }
    const result = await buildCandidateProfile({ jobDescription, resume, transcript });
    return NextResponse.json(result);
  } catch (err) {
    console.error("profile-builder error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong building the profile." },
      { status: 500 }
    );
  }
}

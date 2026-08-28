"use client";

import { useState } from "react";

const boxStyle = { width: "100%", minHeight: "120px", padding: "10px", fontFamily: "monospace", fontSize: "13px", border: "1px solid #ddd", borderRadius: "8px", boxSizing: "border-box" };
const labelStyle = { fontWeight: "bold", marginBottom: "6px", display: "block" };
const sectionStyle = { background: "#f6f6f6", padding: "16px", borderRadius: "8px", marginTop: "12px" };

function Badge({ children, color }) {
  return <span style={{ display: "inline-block", fontSize: "11px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", color: "#fff", background: color }}>{children}</span>;
}

function CandidateInputs({ label, value, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <h3>{label}</h3>
      <label style={labelStyle}>Resume</label>
      <textarea style={boxStyle} value={value.resume} onChange={(e) => onChange({ ...value, resume: e.target.value })} />
      <label style={{ ...labelStyle, marginTop: "10px" }}>Transcript</label>
      <textarea style={boxStyle} value={value.transcript} onChange={(e) => onChange({ ...value, transcript: e.target.value })} />
    </div>
  );
}

function CandidateResult({ result }) {
  if (!result) return null;
  return (
    <div style={{ marginTop: "24px" }}>
      <h2>Candidate {result.candidateId} — {result.profile.candidateName}</h2>

      <div style={sectionStyle}>
        <strong>Final Decision:</strong> <Badge color="#1a73e8">{result.finalDecision.recommendation}</Badge> {result.finalDecision.confidence}% confident
        <ul>{result.finalDecision.reasoningSteps?.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <strong>Strengths:</strong>
        <ul>{result.finalDecision.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <strong>Concerns:</strong>
        <ul>{result.finalDecision.concerns?.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <strong>Unresolved disagreements:</strong>
        <ul>{result.finalDecision.unresolvedDisagreements?.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>

      <h4>4 Independent Opinions</h4>
      <div style={sectionStyle}>
        {result.independentOpinions.map((o) => (
          <div key={o.agentId} style={{ marginBottom: "10px" }}>
            <strong>{o.agentLabel}</strong> — <Badge color="#555">{o.recommendation}</Badge>{o.confidence}%
            <div style={{ fontSize: "13px" }}>{o.summary}</div>
          </div>
        ))}
      </div>

      <h4>Debate {result.usingFallbackDiscussion && <span style={{ fontSize: "12px", color: "#888" }}>(no direct conflict — discussing most important open concern)</span>}</h4>
      <div style={sectionStyle}>
        {result.debateTurns.length === 0 && <p>No debate needed.</p>}
        {result.debateTurns.map((t) => (
          <div key={t.turnId} style={{ marginBottom: "12px", borderLeft: t.opinionChanged ? "4px solid #e67e22" : "4px solid #ccc", paddingLeft: "10px" }}>
            <span style={{ fontSize: "11px", color: "#888" }}>{t.isPrimaryThread ? `Round ${t.round}` : "Direct response"} — {t.topic}</span>
            <div>
              <strong>{t.respondingAgent}</strong> → <Badge color={t.stance === "agree" ? "#1a8a3f" : t.stance === "disagree" ? "#c0392b" : "#e67e22"}>{t.stance}</Badge>
              {t.opinionChanged && <Badge color="#e67e22">OPINION CHANGED</Badge>}
            </div>
            <div style={{ fontSize: "13px" }}>{t.argument}</div>
          </div>
        ))}
      </div>

      <h4>Final Opinions (v1 vs v2)</h4>
      <div style={sectionStyle}>
        {result.finalOpinions.map((o) => (
          <div key={o.agentId} style={{ marginBottom: "6px" }}>
            <strong>{o.agentId}</strong>: {o.version === 2 ? <>{o.originalRecommendation}@{o.originalConfidence}% → <Badge color="#e67e22">{o.recommendation}@{o.confidence}%</Badge></> : <>{o.recommendation}@{o.confidence}% (unchanged)</>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [candA, setCandA] = useState({ resume: "", transcript: "" });
  const [candB, setCandB] = useState({ resume: "", transcript: "" });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ready = jobDescription && candA.resume && candA.transcript && candB.resume && candB.transcript;

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, candidateA: candA, candidateB: candB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px" }}>
      <h1>PromptWars</h1>
      <p style={{ color: "#555" }}>Multi-agent AI interview panel — both candidates, analyzed independently.</p>

      <label style={labelStyle}>Job Description (shared)</label>
      <textarea style={boxStyle} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />

      <div style={{ display: "flex", gap: "20px", marginTop: "16px" }}>
        <CandidateInputs label="Candidate A" value={candA} onChange={setCandA} />
        <CandidateInputs label="Candidate B" value={candB} onChange={setCandB} />
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || !ready}
        style={{ marginTop: "20px", padding: "10px 20px", fontSize: "15px", borderRadius: "8px", border: "none", background: loading ? "#aaa" : "#1a73e8", color: "#fff", cursor: loading ? "default" : "pointer" }}
      >
        {loading ? "Analyzing both candidates (~1-2 min)..." : "Analyze Both Candidates"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: "16px" }}>Error: {error}</p>}

      {results && (
        <>
          <CandidateResult result={results.candidateA} />
          <CandidateResult result={results.candidateB} />
        </>
      )}
    </main>
  );
}

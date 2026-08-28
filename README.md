# PromptWars — Stage 1: Profile Builder

This is the first working slice of the app: paste in a job description, resume,
and transcript, and get back a structured, evidence-backed candidate profile.
No agents/debate yet — that's Stage 2, built on top of this once this works.

## 1. Get a free Gemini API key
- Go to https://aistudio.google.com/app/apikey
- Sign in with a Google account, click "Create API key"
- Copy it (no credit card needed for the free tier)

## 2. Set up the project
```bash
npm install
cp .env.local.example .env.local
```
Open `.env.local` and paste your key in after `GEMINI_API_KEY=`

## 3. Run it
```bash
npm run dev
```
Open http://localhost:3000

## 4. Test it
Paste in real text from the job description / resume / transcript PDFs
(just copy-paste the text out of the PDFs for now — file upload comes later)
and click "Build Candidate Profile". You should get structured JSON back
with skills, experience, projects, claims, and evidence quotes.

## What's next (Stage 2)
Once this works reliably:
1. Four independent agent API routes (Technical, HR, Hiring Manager, Skeptic),
   each calling `generateJSON()` from `lib/gemini.js` with its own persona
   prompt and ONLY the shared profile — no agent sees another agent's output.
2. A debate orchestration route.
3. A final decision route.
4. Then the "nice" UI (cards, history, PDF export).

## Project structure
```
app/
  page.js                        <- test UI
  api/profile-builder/route.js   <- Stage 1 API route
lib/
  gemini.js                      <- shared helper every agent will reuse
```

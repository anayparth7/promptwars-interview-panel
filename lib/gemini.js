import { GoogleGenAI } from "@google/genai";

// One client, reused across calls. Reads the key from your .env.local file.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Calls Gemini and forces the response to be valid JSON.
 * This is the ONE function every agent (profile builder, technical agent,
 * HR agent, etc.) will call later — they'll just pass different prompts.
 *
 * @param {string} systemInstruction - Who this agent is / what its job is.
 * @param {string} prompt - The actual task + source material for this call.
 * @param {string} model - Which Gemini model to use.
 * @returns {Promise<object>} - Parsed JSON object from the model's response.
 */
// Default model comes from .env.local (GEMINI_MODEL) so it can be swapped
// per-provider/per-model later without editing code. Falls back to
// gemini-3.6-flash if the env var isn't set.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export async function generateJSON({ systemInstruction, prompt, model = DEFAULT_MODEL }) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const text = response.text;

  try {
    return JSON.parse(text);
  } catch (err) {
    // If the model ever returns malformed JSON, fail loudly instead of
    // silently passing garbage downstream to the next agent.
    throw new Error(
      "Gemini did not return valid JSON. Raw response: " + text.slice(0, 500)
    );
  }
}

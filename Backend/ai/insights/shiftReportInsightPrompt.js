// Builds the grounded prompt for the shift-report insight narrative. The
// model only ever restates pre-computed numbers here — it never sees raw
// per-shift rows and is explicitly told not to recompute anything, because
// qwen2.5:7b-instruct is known (Backend/ai/systemPrompt.js's chat assistant
// has the same caveat) to occasionally do wrong arithmetic when restating
// percentages in prose.
const SYSTEM_PROMPT = `You are summarizing a manufacturing production/OEE shift report for plant staff.
You will be given a JSON payload of ALREADY-COMPUTED numbers. Restate and interpret them — do not recompute, recalculate, or invent any number. If a field says "insufficientData": true, say plainly that there isn't enough data for that instead of commenting on a trend.

Reference these existing OEE thresholds when relevant: OEE >= 85% is good, 65-85% is fair, below 65% is poor.

Write plain text only — no markdown, no headers, no bold/asterisks, no code blocks.
Format your answer exactly as:
1. One short paragraph (2-4 sentences) summarizing performance for this range.
2. A blank line.
3. 2-3 recommendations, each on its own line starting with "- ".`;

export const buildInsightMessages = (payload) => [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: JSON.stringify(payload) },
];

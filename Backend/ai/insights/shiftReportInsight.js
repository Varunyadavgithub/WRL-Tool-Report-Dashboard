import { getProvider } from "../providers/index.js";
import { buildShiftInsightPayload } from "../../services/insights/shiftReportInsight.service.js";
import { buildInsightMessages } from "./shiftReportInsightPrompt.js";

// Generous CPU-inference budget — this project's existing notes put single
// tool-calling turns at 1-3+ min on the dev box; a one-shot narrative with no
// tool calls is lighter, but bound it so a stuck/offline Ollama can't hang
// the request indefinitely.
const NARRATIVE_TIMEOUT_MS = 90_000;

/**
 * @returns {payload, narrative: string|null, narrativeError: string|null}
 * A narrative failure (timeout, Ollama down) is caught here, not thrown —
 * the computed payload is still useful on its own, so callers should treat
 * this as a soft degradation, not an error response.
 */
export const generateShiftReportInsight = async (start, end, shiftName) => {
  const payload = await buildShiftInsightPayload(start, end, shiftName);
  if (!payload.hasData) return { payload, narrative: null, narrativeError: null };

  const provider = getProvider();
  const messages = buildInsightMessages(payload);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NARRATIVE_TIMEOUT_MS);
  try {
    const response = await provider.chatOnce({ messages, tools: [], signal: controller.signal });
    return { payload, narrative: response.content || null, narrativeError: null };
  } catch (err) {
    return { payload, narrative: null, narrativeError: err.message };
  } finally {
    clearTimeout(timer);
  }
};

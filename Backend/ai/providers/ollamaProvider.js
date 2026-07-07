import { LlmProvider } from "./llmProvider.js";
import { AI_MODEL_NAME, OLLAMA_BASE_URL, AI_NUM_CTX } from "../config.js";

// Ollama's /api/chat returns tool_calls with `arguments` already as an object
// (unlike OpenAI's string-encoded JSON) — normalize so callers always get an object.
const normalizeArgs = (args) => {
  if (args == null) return {};
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args;
};

class OllamaProvider extends LlmProvider {
  async chatOnce({ messages, tools }) {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL_NAME, messages, tools, stream: false, options: { num_ctx: AI_NUM_CTX } }),
    });
    if (!res.ok) {
      throw new Error(`Ollama request failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    const message = data.message || { role: "assistant", content: "" };
    return {
      role: "assistant",
      content: message.content ?? null,
      tool_calls: (message.tool_calls || []).map((tc, i) => ({
        id: tc.id || `call_${i}`,
        function: { name: tc.function.name, arguments: normalizeArgs(tc.function.arguments) },
      })),
    };
  }

  async *chatStream({ messages, tools }) {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL_NAME, messages, tools, stream: true, options: { num_ctx: AI_NUM_CTX } }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama stream request failed (${res.status}): ${await res.text()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep the trailing partial line for the next chunk

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        if (parsed.message?.tool_calls?.length) {
          yield {
            tool_calls: parsed.message.tool_calls.map((tc, i) => ({
              id: tc.id || `call_${i}`,
              function: { name: tc.function.name, arguments: normalizeArgs(tc.function.arguments) },
            })),
          };
        }
        if (parsed.message?.content) {
          yield { contentDelta: parsed.message.content };
        }
        if (parsed.done) {
          yield { done: true };
        }
      }
    }
  }
}

export default new OllamaProvider();

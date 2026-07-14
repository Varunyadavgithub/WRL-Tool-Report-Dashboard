import { LlmProvider } from "./llmProvider.js";
import { GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL_NAME } from "../config.js";

// Groq's /chat/completions is OpenAI-compatible — messages (including the
// "system" role and "tool" role with tool_call_id) pass through unchanged
// from what agent.js already builds. Tool schemas need one adjustment (see
// toGroqTools below) — otherwise no translation layer needed here, unlike
// Anthropic's Messages API.

// Groq strictly validates the model's generated tool call against the
// declared JSON schema server-side (Ollama doesn't). llama-3.3-70b-versatile
// consistently emits `null` for optional string params it isn't setting
// (e.g. shiftName) rather than omitting the key — confirmed via two identical
// repro attempts, not a one-off — which a plain `type: "string"` schema
// rejects. Widen every non-required property's type to also accept null so
// the model's actual (deterministic) output shape validates.
const widenOptionalToNullable = (schema) => {
  if (!schema?.properties) return schema;
  const required = new Set(schema.required || []);
  const properties = Object.fromEntries(
    Object.entries(schema.properties).map(([key, prop]) => {
      if (required.has(key) || !prop.type) return [key, prop];
      const types = Array.isArray(prop.type) ? prop.type : [prop.type];
      return [key, { ...prop, type: types.includes("null") ? types : [...types, "null"] }];
    }),
  );
  return { ...schema, properties };
};

const toGroqTools = (tools) =>
  tools?.map((t) => ({
    type: "function",
    function: { name: t.function.name, description: t.function.description, parameters: widenOptionalToNullable(t.function.parameters) },
  }));

// Groq (like OpenAI) returns tool_call.function.arguments as a JSON STRING,
// not a parsed object — normalize so callers always get an object.
const normalizeArgs = (args) => {
  if (args == null) return {};
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args;
};

// agent.js pushes the tool_calls WE returned (object-valued arguments, per
// the LlmProvider contract) straight back into message history for the next
// turn. Groq's wire format requires arguments to be a JSON string on replay —
// re-stringify only for the outgoing request, since the in-memory/object form
// is still what tool execution and the rest of the app expect.
const toGroqMessages = (messages) =>
  messages.map((m) => {
    if (m.role !== "assistant" || !m.tool_calls?.length) return m;
    return {
      ...m,
      tool_calls: m.tool_calls.map((tc) => ({
        ...tc,
        type: "function",
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments),
        },
      })),
    };
  });

class GroqProvider extends LlmProvider {
  async chatOnce({ messages, tools, signal }) {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL_NAME, messages: toGroqMessages(messages), tools: toGroqTools(tools), stream: false }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Groq request failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    const message = data.choices?.[0]?.message || { role: "assistant", content: "" };
    return {
      role: "assistant",
      content: message.content ?? null,
      tool_calls: (message.tool_calls || []).map((tc) => ({
        id: tc.id,
        function: { name: tc.function.name, arguments: normalizeArgs(tc.function.arguments) },
      })),
    };
  }

  async *chatStream({ messages, tools }) {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL_NAME, messages: toGroqMessages(messages), tools: toGroqTools(tools), stream: true }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Groq stream request failed (${res.status}): ${await res.text()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // OpenAI-compatible tool-call streaming fragments each call's id/name/
    // arguments across many deltas, keyed by index — accumulate, then emit
    // the assembled calls once the stream ends.
    const toolCallsByIndex = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) yield { contentDelta: delta.content };

        for (const tc of delta.tool_calls || []) {
          const existing = (toolCallsByIndex[tc.index] ??= { id: "", function: { name: "", arguments: "" } });
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.function.name += tc.function.name;
          if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
        }
      }
    }

    const toolCalls = Object.values(toolCallsByIndex).map((tc) => ({
      id: tc.id,
      function: { name: tc.function.name, arguments: normalizeArgs(tc.function.arguments) },
    }));
    if (toolCalls.length) yield { tool_calls: toolCalls };
    yield { done: true };
  }
}

export default new GroqProvider();

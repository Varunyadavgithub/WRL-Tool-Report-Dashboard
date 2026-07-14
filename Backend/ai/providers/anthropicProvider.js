import Anthropic from "@anthropic-ai/sdk";
import { LlmProvider } from "./llmProvider.js";
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL_NAME, ANTHROPIC_MAX_TOKENS } from "../config.js";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Converts this app's OpenAI-style message array (system role first, then
// user/assistant/tool) into Anthropic's Messages API shape: a top-level
// `system` string plus a `messages` array with no "tool" role at all — tool
// results go in a `user` message as `tool_result` content blocks instead.
// Only ever needs to handle "assistant" messages carrying `tool_calls` and
// "tool" messages carrying `tool_call_id` WITHIN the current turn's live loop
// (agent.js's toModelMessages() strips tool_calls from persisted history, so
// past turns only ever arrive here as plain user/assistant text).
const toAnthropicMessages = (messages) => {
  let system;
  const out = [];
  for (const m of messages) {
    if (m.role === "system") {
      system = m.content;
      continue;
    }
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const blocks = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls || []) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: tc.function.arguments });
      }
      out.push({ role: "assistant", content: blocks.length ? blocks : m.content || "" });
      continue;
    }
    if (m.role === "tool") {
      // Anthropic requires all tool_result blocks for one assistant turn to
      // land in a single user message — batch consecutive tool messages
      // instead of sending one user message per tool call.
      const block = { type: "tool_result", tool_use_id: m.tool_call_id, content: m.content };
      const last = out[out.length - 1];
      if (last?.role === "user" && Array.isArray(last.content) && last.content[0]?.type === "tool_result") {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }
  return { system, messages: out };
};

const toAnthropicTool = (t) => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters,
});

const fromAnthropicMessage = (message) => {
  if (message.stop_reason === "refusal") {
    return { role: "assistant", content: "I can't help with that request.", tool_calls: [] };
  }
  const textBlocks = message.content.filter((b) => b.type === "text");
  const toolUseBlocks = message.content.filter((b) => b.type === "tool_use");
  return {
    role: "assistant",
    content: textBlocks.map((b) => b.text).join("") || null,
    tool_calls: toolUseBlocks.map((b) => ({ id: b.id, function: { name: b.name, arguments: b.input } })),
  };
};

class AnthropicProvider extends LlmProvider {
  async chatOnce({ messages, tools, signal }) {
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const response = await client.messages.create(
      {
        model: ANTHROPIC_MODEL_NAME,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system,
        messages: anthropicMessages,
        tools: tools?.length ? tools.map(toAnthropicTool) : undefined,
      },
      { signal },
    );
    return fromAnthropicMessage(response);
  }

  async *chatStream({ messages, tools }) {
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const stream = client.messages.stream({
      model: ANTHROPIC_MODEL_NAME,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system,
      messages: anthropicMessages,
      tools: tools?.length ? tools.map(toAnthropicTool) : undefined,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { contentDelta: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    const toolUseBlocks = final.content.filter((b) => b.type === "tool_use");
    if (toolUseBlocks.length) {
      yield { tool_calls: toolUseBlocks.map((b) => ({ id: b.id, function: { name: b.name, arguments: b.input } })) };
    }
    yield { done: true };
  }
}

export default new AnthropicProvider();

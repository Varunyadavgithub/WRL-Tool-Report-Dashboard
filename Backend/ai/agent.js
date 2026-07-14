import { getProvider } from "./providers/index.js";
import { getToolDefinitions, getToolByName } from "./tools/registry.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { AI_MAX_TOOL_ITERATIONS, AI_MAX_HISTORY_MESSAGES } from "./config.js";
import { getMessages, appendMessage } from "./chatHistory.repo.js";

const toModelMessages = (dbMessages) =>
  dbMessages.map((m) => ({ role: m.Role, content: m.Content }));

const runToolCalls = async (toolCalls, onToolCall) => {
  const results = [];
  for (const call of toolCalls) {
    const tool = getToolByName(call.function.name);
    let content;
    if (!tool) {
      content = { error: `Unknown tool: ${call.function.name}` };
    } else {
      onToolCall?.(call.function.name, call.function.arguments);
      try {
        content = await tool.execute(call.function.arguments);
      } catch (err) {
        content = { error: err.message };
      }
    }
    results.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(content) });
  }
  return results;
};

/**
 * Runs one full user turn: persists the user message, loops the model against
 * the tool registry until it produces a final answer (bounded by
 * AI_MAX_TOOL_ITERATIONS), persists the assistant's reply, and returns it.
 *
 * onToken/onToolCall are optional callbacks used by the streaming route
 * (Phase 2) — omit them for a plain non-streaming call.
 */
export const runAgentTurn = async ({ sessionId, userMessage, onToken, onToolCall }) => {
  await appendMessage(sessionId, "user", userMessage);

  const history = await getMessages(sessionId, AI_MAX_HISTORY_MESSAGES);
  const messages = [{ role: "system", content: buildSystemPrompt() }, ...toModelMessages(history)];

  const provider = getProvider();
  const tools = getToolDefinitions();
  const toolTrace = [];

  // One generation per iteration, whether streaming or not — chatStream also
  // surfaces tool_calls, so there's no need for a separate non-streamed probe
  // call followed by a second, duplicate streamed generation of the same answer.
  const runIteration = async () => {
    if (!onToken) return provider.chatOnce({ messages, tools });

    let content = "";
    let toolCalls = [];
    for await (const chunk of provider.chatStream({ messages, tools })) {
      if (chunk.tool_calls?.length) toolCalls = chunk.tool_calls;
      if (chunk.contentDelta) {
        content += chunk.contentDelta;
        onToken(chunk.contentDelta);
      }
    }
    return { role: "assistant", content, tool_calls: toolCalls };
  };

  for (let iteration = 0; iteration < AI_MAX_TOOL_ITERATIONS; iteration++) {
    const response = await runIteration();

    if (!response.tool_calls || response.tool_calls.length === 0) {
      const finalContent = response.content || "";
      await appendMessage(sessionId, "assistant", finalContent, toolTrace.length ? toolTrace : null);
      return { content: finalContent, toolCalls: toolTrace };
    }

    messages.push({ role: "assistant", content: response.content || "", tool_calls: response.tool_calls });
    toolTrace.push(...response.tool_calls.map((tc) => ({ name: tc.function.name, arguments: tc.function.arguments })));

    const toolResults = await runToolCalls(response.tool_calls, onToolCall);
    messages.push(...toolResults);
  }

  const fallback = "I wasn't able to get a clear answer after checking the data a few times — could you rephrase the question?";
  await appendMessage(sessionId, "assistant", fallback, toolTrace);
  return { content: fallback, toolCalls: toolTrace };
};

/**
 * Contract every model provider must implement. This is the only surface the
 * rest of the app (agent.js) talks to — swapping the runtime/model later means
 * writing a new file that satisfies this shape and pointing AI_PROVIDER at it,
 * not touching agent.js/tools/controllers.
 *
 * chatOnce({ messages, tools, signal? }) => Promise<{ role: "assistant", content: string|null, tool_calls?: [{ id, function: { name, arguments } }] }>
 * chatStream({ messages, tools }) => AsyncGenerator yielding { contentDelta?: string, done?: boolean }
 */
export class LlmProvider {
  async chatOnce(_args) {
    throw new Error("chatOnce not implemented");
  }

  async *chatStream(_args) {
    throw new Error("chatStream not implemented");
  }
}

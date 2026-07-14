import { tryCatch } from "../utils/tryCatch.js";
import { AppError } from "../utils/AppError.js";
import { runAgentTurn } from "../ai/agent.js";
import * as chatHistory from "../ai/chatHistory.repo.js";

// Shared ownership check — every session-scoped route uses this so a user
// can only ever read/write their own conversations.
const getOwnedSession = async (sessionId, userId) => {
  const session = await chatHistory.getSessionById(sessionId);
  if (!session || session.UserId !== userId) {
    throw new AppError("Chat session not found", 404);
  }
  return session;
};

export const listSessions = tryCatch(async (req, res) => {
  const sessions = await chatHistory.listSessions(req.user.id);
  res.json({ success: true, data: sessions });
});

export const createSession = tryCatch(async (req, res) => {
  const session = await chatHistory.createSession(req.user.id, req.body?.title);
  res.status(201).json({ success: true, data: session });
});

export const getSessionMessages = tryCatch(async (req, res) => {
  await getOwnedSession(req.params.id, req.user.id);
  const messages = await chatHistory.getMessages(req.params.id);
  res.json({ success: true, data: messages });
});

export const postMessage = tryCatch(async (req, res) => {
  await getOwnedSession(req.params.id, req.user.id);
  const { message } = req.body;
  if (!message || !message.trim()) throw new AppError("message is required", 400);

  const result = await runAgentTurn({ sessionId: req.params.id, userMessage: message });
  res.json({ success: true, data: result });
});

export const streamMessage = tryCatch(async (req, res) => {
  await getOwnedSession(req.params.id, req.user.id);
  const { message } = req.body;
  if (!message || !message.trim()) throw new AppError("message is required", 400);

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    await runAgentTurn({
      sessionId: req.params.id,
      userMessage: message,
      onToken: (delta) => send({ type: "token", content: delta }),
      onToolCall: (name, args) => send({ type: "tool_call", name, args }),
    });
    send({ type: "done" });
  } catch (err) {
    send({ type: "error", message: err.message });
  } finally {
    res.end();
  }
});

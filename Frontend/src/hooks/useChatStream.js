import { useCallback, useEffect, useState } from "react";
import { baseURL } from "../assets/assets.js";
import { useCreateChatSessionMutation } from "../redux/api/aiApi.js";

const LAST_SESSION_KEY = "wrl_ai_last_session_id";

// DB role/content shape -> the { role, content } shape this hook works with.
const fromDbMessages = (rows) =>
  (rows || [])
    .filter((m) => m.Role === "user" || m.Role === "assistant")
    .map((m) => ({ role: m.Role, content: m.Content }));

// Owns the full session lifecycle for the chat widget — which session is
// active, lazily creating one (titled from the first message, like ChatGPT/
// Claude auto-naming a new chat) rather than eagerly on every panel open,
// switching to a past session, and starting a fresh one. No EventSource/RTK-
// Query precedent exists for streaming in this app (fetchBaseQuery has no SSE
// support, and EventSource is GET-only while chat needs a POST body), so
// sending a message talks to the stream endpoint directly via fetch + a
// ReadableStream reader.
export const useChatStream = () => {
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem(LAST_SESSION_KEY);
    return saved ? Number(saved) : null;
  });
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [createSession] = useCreateChatSessionMutation();

  useEffect(() => {
    if (sessionId) localStorage.setItem(LAST_SESSION_KEY, String(sessionId));
    else localStorage.removeItem(LAST_SESSION_KEY);
  }, [sessionId]);

  const startNewChat = useCallback(() => {
    setSessionId(null);
    setMessages([]);
  }, []);

  const openSession = useCallback((id, dbMessages) => {
    setSessionId(id);
    setMessages(fromDbMessages(dbMessages));
  }, []);

  const appendAssistantDelta = (delta) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      // Defensive: only mutate in place if the last message is really the
      // in-progress assistant bubble — otherwise (shouldn't happen once
      // assistantStarted is reset per-iteration below, but cheap to guard)
      // start a fresh bubble instead of corrupting whatever came before it.
      if (last?.role !== "assistant") return [...prev, { role: "assistant", content: delta }];
      const next = [...prev];
      next[next.length - 1] = { ...last, content: last.content + delta };
      return next;
    });
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const title = text.trim().slice(0, 60);
      const created = await createSession(title).unwrap();
      activeSessionId = created.Id;
      setSessionId(activeSessionId);
    }

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${baseURL}ai/sessions/${activeSessionId}/messages/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop(); // keep the trailing partial event for the next chunk

        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5));

          if (evt.type === "tool_call") {
            // A tool call means the model may keep narrating afterward (some
            // models interleave commentary with tool calls rather than
            // deciding silently) — reset so the next token starts a fresh
            // assistant bubble instead of appending onto this tool chip.
            assistantStarted = false;
            setMessages((prev) => [...prev, { role: "tool", content: `Checking ${evt.name}...` }]);
          } else if (evt.type === "token") {
            if (!assistantStarted) {
              assistantStarted = true;
              setMessages((prev) => [...prev, { role: "assistant", content: evt.content }]);
            } else {
              appendAssistantDelta(evt.content);
            }
          } else if (evt.type === "error") {
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${evt.message}` }]);
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId, isStreaming, createSession]);

  return { sessionId, messages, isStreaming, sendMessage, startNewChat, openSession };
};

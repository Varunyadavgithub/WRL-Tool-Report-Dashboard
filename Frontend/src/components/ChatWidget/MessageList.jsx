import { useEffect, useRef } from "react";
import { FiZap } from "react-icons/fi";

const ROLE_STYLE = {
  user: "self-end bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-sm",
  assistant: "self-start bg-violet-50 text-gray-800 rounded-bl-sm border border-violet-100",
};

// Minimal, non-scripted "thinking" indicator — the real progress info comes
// from the tool chip (real tool name) and the model's own narration between
// tool calls, both rendered as their own bubbles. This just covers the dead
// air before either of those exists yet, like ChatGPT/Claude's plain
// thinking/typing indicator rather than a fixed rotating phrase list.
const ThinkingBubble = () => (
  <div className="self-start flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
    {["bg-indigo-400", "bg-violet-400", "bg-fuchsia-400"].map((color, i) => (
      <span key={i} className={`w-1.5 h-1.5 rounded-full ${color} animate-bounce`} style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

const ToolChip = ({ content }) => (
  <div className="self-start flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
    <FiZap size={11} className="text-amber-500" />
    {content}
  </div>
);

const MessageList = ({ messages, isStreaming }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-center text-sm text-gray-400 px-6">
        Ask about today's production, downtime, or this month's audits — I'll pull the numbers for you.
      </div>
    );
  }

  // While streaming, show the thinking bubble any time the model hasn't
  // started producing an assistant answer yet — right after the user sends a
  // message, and again during the gap between a tool call finishing and the
  // next chunk of narration, both of which can take 10-30s+ on CPU inference.
  const last = messages[messages.length - 1];
  const showThinking = isStreaming && last && last.role !== "assistant";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
      {messages.map((m, i) =>
        m.role === "tool" ? (
          <ToolChip key={i} content={m.content} />
        ) : (
          <div
            key={i}
            className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${ROLE_STYLE[m.role] || ROLE_STYLE.assistant}`}
          >
            {m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}
          </div>
        ),
      )}
      {showThinking && <ThinkingBubble />}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;

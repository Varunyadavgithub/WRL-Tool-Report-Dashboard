import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { useLazyGetChatMessagesQuery } from "../../redux/api/aiApi.js";
import { useChatStream } from "../../hooks/useChatStream.js";
import MessageList from "./MessageList.jsx";
import ChatInput from "./ChatInput.jsx";
import SessionHistory from "./SessionHistory.jsx";
import WelcomeScreen from "./WelcomeScreen.jsx";

const ChatPanel = ({ onClose }) => {
  const { sessionId, messages, isStreaming, sendMessage, startNewChat, openSession } = useChatStream();
  const [fetchMessages] = useLazyGetChatMessagesQuery();
  const restoredRef = useRef(false);

  // On first mount, if a session was restored from localStorage, load its
  // history so reopening the widget resumes the last conversation instead of
  // showing a blank panel with an orphaned session id. If that session no
  // longer exists (deleted, or from a stale/previous localStorage value),
  // fall back to a clean new-chat state instead of leaving a dangling id that
  // would 404 the moment the user tries to send into it.
  useEffect(() => {
    if (restoredRef.current || !sessionId) return;
    restoredRef.current = true;
    (async () => {
      try {
        const rows = await fetchMessages(sessionId).unwrap();
        openSession(sessionId, rows);
      } catch {
        startNewChat();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl h-[85vh] max-h-[720px] flex bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Sidebar — always visible, like ChatGPT/Claude's chat history rail */}
        <aside className="w-64 shrink-0 flex flex-col bg-gradient-to-b from-indigo-50 via-violet-50/40 to-white">
          <div className="px-4 py-4 bg-gradient-to-r from-indigo-500 to-violet-600">
            <p className="text-sm font-semibold text-white">WRL Assistant</p>
            <p className="text-xs text-indigo-100">Production, quality &amp; audit data</p>
          </div>
          <SessionHistory
            activeSessionId={sessionId}
            onSelect={(id, rows) => !isStreaming && openSession(id, rows)}
            onNewChat={() => !isStreaming && startNewChat()}
          />
        </aside>

        {/* Main conversation area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-end px-4 py-4 bg-gradient-to-r from-violet-600 to-indigo-500">
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-indigo-100 hover:text-white hover:bg-white/15 transition-colors"
              aria-label="Close chat"
            >
              <FiX size={16} />
            </button>
          </div>

          {messages.length === 0 ? (
            <WelcomeScreen onPick={sendMessage} />
          ) : (
            <MessageList messages={messages} isStreaming={isStreaming} />
          )}
          <ChatInput onSend={sendMessage} disabled={isStreaming} />
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;

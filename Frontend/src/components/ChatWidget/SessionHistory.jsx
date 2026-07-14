import { FiPlus, FiMessageSquare } from "react-icons/fi";
import { useGetChatSessionsQuery, useLazyGetChatMessagesQuery } from "../../redux/api/aiApi.js";

const relativeTime = (isoString) => {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
};

const SessionHistory = ({ activeSessionId, onSelect, onNewChat }) => {
  const { data: sessions = [], isLoading } = useGetChatSessionsQuery();
  const [fetchMessages] = useLazyGetChatMessagesQuery();

  const handleSelect = async (session) => {
    const rows = await fetchMessages(session.Id).unwrap().catch(() => []);
    onSelect(session.Id, rows);
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <button
        onClick={onNewChat}
        className="flex items-center gap-2 mx-3 mt-3 mb-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-violet-500 shadow-sm shadow-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/30 transition-shadow"
      >
        <FiPlus size={15} /> New chat
      </button>

      {isLoading && <p className="text-xs text-gray-400 px-4 py-2">Loading history...</p>}

      {!isLoading && sessions.length === 0 && (
        <p className="text-xs text-gray-400 px-4 py-3">No past conversations yet — start one above.</p>
      )}

      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {sessions.map((s) => (
          <button
            key={s.Id}
            onClick={() => handleSelect(s)}
            className={`flex items-start gap-2 text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
              s.Id === activeSessionId
                ? "bg-white shadow-sm text-violet-700 ring-1 ring-violet-200"
                : "hover:bg-white/70 text-gray-600"
            }`}
          >
            <FiMessageSquare size={14} className={`mt-0.5 shrink-0 ${s.Id === activeSessionId ? "text-violet-500" : "opacity-50"}`} />
            <span className="flex-1 min-w-0">
              <span className="block truncate">{s.Title || "New chat"}</span>
              <span className="block text-xs text-gray-400">{relativeTime(s.UpdatedAt)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SessionHistory;

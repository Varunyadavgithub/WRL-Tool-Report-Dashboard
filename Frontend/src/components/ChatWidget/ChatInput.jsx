import { useState } from "react";
import { FiSend } from "react-icons/fi";

const ChatInput = ({ onSend, disabled }) => {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-gray-100 p-3 bg-white">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
        }}
        rows={1}
        placeholder="Ask about production, downtime, audits..."
        disabled={disabled}
        className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 text-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30 hover:shadow-md disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all"
        aria-label="Send message"
      >
        <FiSend size={16} />
      </button>
    </form>
  );
};

export default ChatInput;

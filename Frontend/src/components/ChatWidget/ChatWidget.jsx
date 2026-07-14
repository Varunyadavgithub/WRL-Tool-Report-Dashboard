import { useState } from "react";
import { FiMessageCircle } from "react-icons/fi";
import ChatPanel from "./ChatPanel.jsx";

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) return <ChatPanel onClose={() => setIsOpen(false)} />;

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 transition-all"
      aria-label="Open assistant"
    >
      <FiMessageCircle size={22} />
    </button>
  );
};

export default ChatWidget;

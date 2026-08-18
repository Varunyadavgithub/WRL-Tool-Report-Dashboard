import { FiXCircle } from "react-icons/fi";

// Blocking error dialog for scan rejections (QA Hold, Duplicate, Unloading Pending, etc.)
// OK button is auto-focused so a scanner's trailing Enter keystroke dismisses it.
const ScanErrorDialog = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <FiXCircle size={48} className="text-red-500 mx-auto mb-3" />
        <p className="text-xl font-black text-red-700 mb-6">{message}</p>
        <button
          autoFocus
          onClick={onClose}
          className="w-full px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold cursor-pointer"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default ScanErrorDialog;

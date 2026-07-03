// ──────────────────────────────────────────────────────────────────────────
// Modal shell — overlay + centering + click-outside-to-close + Escape-to-close.
// Intentionally content-agnostic (no hardcoded header/footer) since call sites
// have distinct custom headers/bodies — only the outer chrome is shared.
// ──────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

export const Modal = ({ onClose, maxWidth = "max-w-2xl", labelledBy, children }) => {
  // Close on Escape — standard modal behavior that the original implementation
  // was missing, and cheap to add for keyboard/screen-reader users.
  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// ── Confirm/destructive-action modal — colored header + body + footer ──────
const TONE_CLS = {
  danger: {
    header: "bg-gradient-to-r from-red-600 to-red-700",
    subtitle: "text-red-200",
    confirmBtn: "bg-red-600 hover:bg-red-700 shadow-red-200",
  },
  warning: {
    header: "bg-gradient-to-r from-amber-500 to-amber-600",
    subtitle: "text-amber-100",
    confirmBtn: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
  },
  info: {
    header: "bg-gradient-to-r from-indigo-600 to-indigo-700",
    subtitle: "text-indigo-200",
    confirmBtn: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200",
  },
};

export const ConfirmModal = ({
  onClose,
  onConfirm,
  confirming,
  icon: Icon,
  title,
  subtitle,
  confirmLabel = "Confirm",
  confirmingLabel = "Processing…",
  confirmDisabled = false,
  tone = "danger",
  maxWidth = "max-w-md",
  children,
}) => {
  const t = TONE_CLS[tone] || TONE_CLS.danger;
  return (
    <Modal onClose={onClose} maxWidth={maxWidth} labelledBy="confirm-modal-title">
      <div className={`px-5 py-4 text-white ${t.header}`}>
        <h3 id="confirm-modal-title" className="text-base font-bold flex items-center gap-2">
          {Icon && <Icon size={13} aria-hidden="true" />} {title}
        </h3>
        {subtitle && <p className={`text-xs mt-1 ${t.subtitle}`}>{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          disabled={confirming}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming || confirmDisabled}
          className={`px-5 py-2 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 ${t.confirmBtn}`}
        >
          {confirming ? confirmingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

// ── Generic modal close button — icon-only, now with an accessible label ───
export const ModalCloseBtn = ({ onClick, label = "Close" }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/60"
  >
    <FaTimes size={14} aria-hidden="true" />
  </button>
);

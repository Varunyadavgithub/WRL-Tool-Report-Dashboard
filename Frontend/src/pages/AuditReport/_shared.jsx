// ── Shared primitives reused across Audit Report pages (TemplateList, TemplateApproval) ──
// Mirrors the MasterConfig/_shared.jsx convention (one shared file per module), but the
// exact classNames here are taken from what these pages already render — not copied from
// MasterConfig's palette — so migrating to these components is a pure markup consolidation,
// not a visual change.

import { FaTimes } from "react-icons/fa";

// ── Modal shell — overlay + centering + click-outside-to-close. ──────────────
// Intentionally content-agnostic (no hardcoded header/footer) since this module's modals
// each have distinct custom headers/bodies (gradient headers, meta-badge rows, etc.) —
// only the outer chrome is actually duplicated across call sites.
export const Modal = ({ onClose, maxWidth = "max-w-2xl", children }) => (
  <div
    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

// ── Confirm/destructive-action modal — the colored-gradient-header + body + ──
// Cancel/Confirm-footer shape shared by TemplateList's delete modal and
// TemplateApproval's reject modal.
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
    <Modal onClose={onClose} maxWidth={maxWidth}>
      <div className={`px-5 py-4 text-white ${t.header}`}>
        <h3 className="text-base font-black flex items-center gap-2">
          {Icon && <Icon size={13} />} {title}
        </h3>
        {subtitle && <p className={`text-xs mt-1 ${t.subtitle}`}>{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          disabled={confirming}
          className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming || confirmDisabled}
          className={`px-5 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-all shadow-md ${t.confirmBtn}`}
        >
          {confirming ? confirmingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

// ── Status badge — each page keeps its own status→{label, cls} map (the two ──
// pages use different visual variants — light cards vs. dark gradient cards —
// so the map, not this component, owns the palette).
export const StatusBadge = ({ config, children }) => (
  <span className={config.cls}>{children ?? config.label}</span>
);

// ── Table header/data cells — consolidate the repeated padding/typography ────
// boilerplate. Row-level background (each table has its own header-row color)
// stays owned by the caller's <tr>, not by TH itself.
const HIDE_BELOW_CLS = { md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

export const TH = ({ children, center, hideBelow, cls = "" }) => (
  <th
    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${center ? "text-center" : "text-left"} ${hideBelow ? HIDE_BELOW_CLS[hideBelow] : ""} ${cls}`}
  >
    {children}
  </th>
);

export const TD = ({ children, center, mono, hideBelow, cls = "" }) => (
  <td
    className={`px-4 py-3 ${center ? "text-center" : ""} ${mono ? "font-mono" : ""} ${hideBelow ? HIDE_BELOW_CLS[hideBelow] : ""} ${cls}`}
  >
    {children}
  </td>
);

// ── Generic modal close button — matches the small icon-only close button ────
// used in the dark-gradient-header modals (e.g. TemplateList's PreviewModal).
export const ModalCloseBtn = ({ onClick }) => (
  <button onClick={onClick} className="p-1.5 hover:bg-white/10 rounded-lg transition flex-shrink-0">
    <FaTimes size={14} />
  </button>
);

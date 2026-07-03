// ──────────────────────────────────────────────────────────────────────────
// Single source of truth for "what does each status look like" across the
// Audit Report module. Previously every page (dashboard, list, approval)
// kept its own copy of this map with slightly different keys/classNames —
// consolidating it here means a color change happens in exactly one place,
// and new pages don't have to reinvent the palette.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Audit lifecycle status → visual tokens.
 * `dot` / `bg` / `text` / `border` are meant to be composed directly into
 * className strings, e.g. `${bg} ${text} ${border}`.
 */
export const AUDIT_STATUS = {
  approved: {
    label: "Approved",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  submitted: {
    label: "Submitted",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  rework: {
    label: "Rework",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  draft: {
    label: "Draft",
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

/** Fallback used whenever a status string doesn't match a known key. */
export const DEFAULT_STATUS = AUDIT_STATUS.draft;

/** Safe lookup — never returns undefined, so callers don't need `|| fallback` everywhere. */
export const getStatusConfig = (status) => AUDIT_STATUS[status] || DEFAULT_STATUS;

/**
 * Checkpoint-level result tokens (pass/fail/warning/na/pending) — distinct
 * from audit-level status above. Used by checkpoint breakdown bars/badges.
 */
export const CHECKPOINT_STATUS = {
  pass: { label: "Pass", bar: "bg-emerald-400", text: "text-emerald-600" },
  fail: { label: "Fail", bar: "bg-red-400", text: "text-red-600" },
  warning: { label: "Warning", bar: "bg-amber-400", text: "text-amber-600" },
  na: { label: "N/A", bar: "bg-blue-300", text: "text-blue-500" },
  pending: { label: "Pending", bar: "bg-slate-300", text: "text-slate-500" },
};

// ──────────────────────────────────────────────────────────────────────────
// Status badge — renders a colored pill + dot from a status-config object
// (see constants/statusConfig.js). Kept config-driven rather than owning its
// own palette, since different tables sometimes need different variants
// (e.g. audit status vs. checkpoint result) that share this same shape.
// ──────────────────────────────────────────────────────────────────────────

export const StatusBadge = ({ config, children, withDot = true }) => (
  <span
    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${config.bg} ${config.text} ${config.border}`}
  >
    {withDot && config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />}
    {children ?? config.label}
  </span>
);

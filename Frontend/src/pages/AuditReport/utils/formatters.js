// ──────────────────────────────────────────────────────────────────────────
// Pure formatting helpers used across the Audit Report module. Pulled out of
// Auditdashboard.jsx (and duplicated-in-spirit elsewhere) so every page
// renders dates/percentages the same way.
// ──────────────────────────────────────────────────────────────────────────

/** Safe percentage — never divides by zero, always returns a whole number. */
export const pct = (numerator, denominator) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

/** "01 Jan, 10:30 AM" — used for full timestamps in tables/cards. */
export const fmtDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/** "5m ago" / "3h ago" / "2d ago" — used alongside fmtDate for scannability. */
export const relativeTime = (date) => {
  if (!date) return "—";
  const minutes = Math.floor((Date.now() - new Date(date)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/** Clamp+round a number for progress-bar widths so tiny nonzero values stay visible. */
export const barWidth = (value, max, minVisible = 2) =>
  max > 0 ? Math.max(minVisible, Math.round((value / max) * 100)) : 0;

/** "01 Jan 2026, 10:30 AM" — full date incl. year, used for version/history timestamps
 *  where the record could be more than a year old (unlike fmtDate's dashboard context). */
export const fmtDateLong = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

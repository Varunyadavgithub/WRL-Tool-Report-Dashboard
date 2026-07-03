// ──────────────────────────────────────────────────────────────────────────
// Small secondary action button — outline style used for things like
// "Refresh", "Export", "Clear filters". Kept separate from primary CTA
// buttons (which stay bespoke per-page since their color varies by intent).
// ──────────────────────────────────────────────────────────────────────────

export const SecondaryButton = ({ icon: Icon, children, className = "", ...rest }) => (
  <button
    className={`flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-500 rounded-xl text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...rest}
  >
    {Icon && <Icon size={11} aria-hidden="true" />}
    {children}
  </button>
);

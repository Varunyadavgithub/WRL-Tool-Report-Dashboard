// ──────────────────────────────────────────────────────────────────────────
// Table primitives shared across every list/summary table in the module.
// Consolidates the repeated padding/typography boilerplate, and adds sticky
// headers + a consistent empty/loading-state row so individual pages don't
// each reinvent them.
// ──────────────────────────────────────────────────────────────────────────

const HIDE_BELOW_CLS = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

/** Wraps a <table> with horizontal scroll + sticky header support baked in. */
export const TableContainer = ({ children, className = "" }) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-sm border-collapse">{children}</table>
  </div>
);

export const TH = ({ children, center, hideBelow, sticky, cls = "" }) => (
  <th
    scope="col"
    className={[
      "px-4 py-3 text-xs font-semibold uppercase tracking-wider",
      center ? "text-center" : "text-left",
      hideBelow ? HIDE_BELOW_CLS[hideBelow] : "",
      sticky ? "sticky top-0 z-10" : "",
      cls,
    ].join(" ")}
  >
    {children}
  </th>
);

export const TD = ({ children, center, mono, hideBelow, cls = "" }) => (
  <td
    className={[
      "px-4 py-3",
      center ? "text-center" : "",
      mono ? "font-mono tabular-nums" : "",
      hideBelow ? HIDE_BELOW_CLS[hideBelow] : "",
      cls,
    ].join(" ")}
  >
    {children}
  </td>
);

/**
 * Full-width empty-state row — use inside a <tbody> so the table's own
 * column count / borders stay intact instead of swapping the whole table
 * out for a <div>.
 */
export const TableEmptyRow = ({ colSpan, icon: Icon, title, subtitle }) => (
  <tr>
    <td colSpan={colSpan} className="py-14">
      <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
        {Icon && <Icon className="text-3xl text-slate-200" aria-hidden="true" />}
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </td>
  </tr>
);

/** A row that behaves like a link — clickable + keyboard-activatable. */
export const ClickableRow = ({ onActivate, className = "", children, ...rest }) => (
  <tr
    role="button"
    tabIndex={0}
    onClick={onActivate}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate?.(e);
      }
    }}
    className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${className}`}
    {...rest}
  >
    {children}
  </tr>
);

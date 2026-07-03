// ──────────────────────────────────────────────────────────────────────────
// EmptyState — consistent "nothing to show" panel (used inside cards, not
// just tables — see TableEmptyRow in Table.jsx for the in-table variant).
// Skeleton — lightweight shimmer placeholders so first paint isn't just a
// spinner; keeps the page's layout stable while data loads.
// ──────────────────────────────────────────────────────────────────────────

export const EmptyState = ({ icon: Icon, title, subtitle, tone = "neutral", action }) => {
  const iconCls = tone === "success" ? "text-emerald-200" : "text-slate-200";
  const titleCls = tone === "success" ? "text-emerald-500" : "text-slate-500";
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      {Icon && <Icon className={`text-3xl mb-2 ${iconCls}`} aria-hidden="true" />}
      <p className={`text-sm font-semibold ${titleCls}`}>{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

/** A single rectangular shimmer block. Compose several for a card/table skeleton. */
export const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} aria-hidden="true" />
);

/** Skeleton for a row of KPI cards. */
export const KpiSkeletonRow = ({ count = 6 }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="border border-slate-100 rounded-2xl px-5 py-4">
        <SkeletonBlock className="h-3 w-16 mb-4" />
        <SkeletonBlock className="h-7 w-12" />
      </div>
    ))}
  </div>
);

/** Skeleton for a card containing a title + a handful of bar rows. */
export const CardSkeleton = ({ rows = 4 }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5" aria-hidden="true">
    <SkeletonBlock className="h-4 w-40 mb-5" />
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-5 w-full" />
      ))}
    </div>
  </div>
);

/** Skeleton for a table-shaped card (header bar + a few "rows"). */
export const TableSkeleton = ({ rows = 5 }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" aria-hidden="true">
    <div className="px-5 py-4 border-b border-slate-50">
      <SkeletonBlock className="h-4 w-48" />
    </div>
    <div className="p-5 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-8 w-full" />
      ))}
    </div>
  </div>
);

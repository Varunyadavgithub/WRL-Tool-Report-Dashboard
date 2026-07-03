// ──────────────────────────────────────────────────────────────────────────
// PageHeader — the sticky top bar (icon + title + optional subtitle/meta +
// right-aligned actions) used at the top of every top-level page in this
// module. Previously each page hand-rolled this bar with slightly different
// spacing; this is the one shape they should all use going forward.
// ──────────────────────────────────────────────────────────────────────────

export const PageHeader = ({ icon: Icon, title, meta, actions }) => (
  <div className="bg-white border-b border-slate-100 sticky top-0 z-20 shadow-sm">
    <div className="w-full px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="p-1.5 bg-indigo-600 rounded-lg flex-shrink-0">
            <Icon className="text-white text-base" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-slate-900 leading-none truncate">{title}</h1>
          {meta && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{meta}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  </div>
);

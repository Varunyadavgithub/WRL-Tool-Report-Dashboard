// ──────────────────────────────────────────────────────────────────────────
// ChangeRow — the one row primitive the whole diff tree is built from.
// Instead of a differently-colored full-width card per nesting level (the
// old design's main source of visual noise), every level uses this same
// row: a small type icon, a label, optional meta text, and — if it has
// children — their detail rendered directly beneath, always visible.
// Indentation communicates depth instead of nested colored boxes or a
// click-to-expand interaction.
// ──────────────────────────────────────────────────────────────────────────
import { CHANGE_TYPE } from "./changeType";

const LEVEL_PAD = { 0: "pl-0", 1: "pl-6", 2: "pl-12", 3: "pl-[4.5rem]" };

export const ChangeRow = ({ type, label, meta, level = 0, children }) => {
  const cfg = CHANGE_TYPE[type] || CHANGE_TYPE.modified;
  const Icon = cfg.icon;

  return (
    <div className={level > 0 ? "border-l border-slate-100" : ""}>
      <div className={`flex items-center gap-2 py-2 ${LEVEL_PAD[level] || "pl-0"}`}>
        <span className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${cfg.dot}`}>
          <Icon size={8} className="text-white" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-slate-800 truncate">{label}</span>
        {meta && <span className="text-xs text-slate-400 truncate">{meta}</span>}
      </div>
      {children && <div className="pb-1">{children}</div>}
    </div>
  );
};

/** A compact pill used in the overview strip — three buckets instead of nine. */
export const ChangeCountChip = ({ type, count, label }) => {
  const cfg = CHANGE_TYPE[type] || CHANGE_TYPE.modified;
  if (!count) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${cfg.chip}`}>
      <Icon size={9} aria-hidden="true" />
      {count} {label}
    </span>
  );
};

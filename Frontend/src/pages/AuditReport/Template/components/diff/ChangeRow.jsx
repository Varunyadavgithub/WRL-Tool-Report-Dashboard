// ──────────────────────────────────────────────────────────────────────────
// ChangeRow — the one row primitive the whole diff tree is built from.
// Instead of a differently-colored full-width card per nesting level (the
// old design's main source of visual noise), every level uses this same
// row: a small type icon, a label, optional meta text, and — if it has
// children — a chevron that expands in place. Indentation communicates
// depth instead of nested colored boxes.
// ──────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { FaChevronRight } from "react-icons/fa";
import { CHANGE_TYPE } from "./changeType";

const LEVEL_PAD = { 0: "pl-0", 1: "pl-6", 2: "pl-12", 3: "pl-[4.5rem]" };

export const ChangeRow = ({ type, label, meta, level = 0, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = CHANGE_TYPE[type] || CHANGE_TYPE.modified;
  const Icon = cfg.icon;
  const hasChildren = Boolean(children);

  return (
    <div className={level > 0 ? "border-l border-slate-100" : ""}>
      <div
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onClick={hasChildren ? () => setOpen((o) => !o) : undefined}
        onKeyDown={
          hasChildren
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen((o) => !o);
                }
              }
            : undefined
        }
        className={`flex items-center gap-2 py-2 ${LEVEL_PAD[level] || "pl-0"} ${
          hasChildren ? "cursor-pointer hover:bg-slate-50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300" : ""
        }`}
      >
        <span className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${cfg.dot}`}>
          <Icon size={8} className="text-white" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-slate-800 truncate">{label}</span>
        {meta && <span className="text-xs text-slate-400 truncate">{meta}</span>}
        {hasChildren && (
          <FaChevronRight
            size={10}
            className={`text-slate-400 ml-auto flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        )}
      </div>
      {hasChildren && open && <div className="pb-1">{children}</div>}
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

// ──────────────────────────────────────────────────────────────────────────
// Visual tokens for a single diff outcome — added / removed / modified /
// renamed. Used uniformly at every nesting level (section, stage,
// checkpoint, field) in the redesigned Compare page so the whole diff tree
// reads with one consistent visual language instead of a different colored
// box shape per level.
// ──────────────────────────────────────────────────────────────────────────
import { FaPlus, FaMinus, FaPen, FaExchangeAlt } from "react-icons/fa";

export const CHANGE_TYPE = {
  added: { label: "Added", icon: FaPlus, dot: "bg-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  removed: { label: "Removed", icon: FaMinus, dot: "bg-red-500", text: "text-red-700", chip: "bg-red-50 text-red-700 border-red-200" },
  modified: { label: "Modified", icon: FaPen, dot: "bg-blue-500", text: "text-blue-700", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  renamed: { label: "Renamed", icon: FaExchangeAlt, dot: "bg-amber-500", text: "text-amber-700", chip: "bg-amber-50 text-amber-700 border-amber-200" },
};

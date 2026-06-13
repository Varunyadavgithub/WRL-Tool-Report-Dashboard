// ── Shared primitives reused across all Master Config pages ──────────────────

export const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-slate-300 transition-all bg-white";

export const selectCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-all";

// Form field wrapper
export const Field = ({ label, required, half, children }) => (
  <div className={half ? "col-span-1" : "col-span-2 sm:col-span-1"}>
    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

// Status badge
export const StatusBadge = ({ active }) =>
  active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
    </span>
  );

// Generic modal wrapper
import { X } from "lucide-react";
export const Modal = ({ title, onClose, onSave, children, wide = false }) => (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[92vh] overflow-hidden flex flex-col`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-6">{children}</div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
          Cancel
        </button>
        <button onClick={onSave} className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 transition-colors">
          Save
        </button>
      </div>
    </div>
  </div>
);

// Table action buttons
import { Pencil, Trash2 } from "lucide-react";
export const TableActions = ({ onEdit, onDelete }) => (
  <div className="flex items-center gap-1">
    <button
      onClick={onEdit}
      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
      title="Edit"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={onDelete}
      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 transition-colors"
      title="Delete"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

// Page header
import { Plus, Search } from "lucide-react";
export const PageHeader = ({ title, subtitle, icon: Icon, onAdd, addLabel = "Add New", search, onSearch }) => (
  <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
    <div className="flex items-center gap-3 px-5 py-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-blue-50">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800 leading-none">{title}</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-48"
          />
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {addLabel}
          </button>
        )}
      </div>
    </div>
  </div>
);

// Empty state
export const EmptyState = ({ colSpan, message = "No records found." }) => (
  <tr>
    <td colSpan={colSpan} className="py-14 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-300">
        <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-xs text-slate-400">{message}</p>
      </div>
    </td>
  </tr>
);

// Table header cell
export const TH = ({ children, center }) => (
  <th className={`px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-200 whitespace-nowrap ${center ? "text-center" : "text-left"}`}>
    {children}
  </th>
);

// Table data cell
export const TD = ({ children, mono, center, cls = "" }) => (
  <td className={`px-3 py-2.5 border-b border-slate-100 text-xs ${mono ? "font-mono" : ""} ${center ? "text-center" : ""} ${cls}`}>
    {children}
  </td>
);

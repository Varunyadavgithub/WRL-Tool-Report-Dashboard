import { useState, useMemo } from "react";
import { Search, RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";
import Pagination from "../../../components/ui/Pagination";
import { usePagedSlice } from "./shared";

// BISCategory management — which models are BIS-controlled (BIS / Non-BIS
// classification).
const BISConfigTab = ({ categories, categorySearch, setCategorySearch, categoryLoading, onRefresh, onAddCategory, onEditCategory, onDeleteCategory }) => {
  const [limit, setLimit] = useState(25);

  const filteredCategories = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter(
      (c) => c.materialCode?.toLowerCase().includes(term) || c.materialName?.toLowerCase().includes(term) || c.modelName?.toLowerCase().includes(term),
    );
  }, [categories, categorySearch]);

  const { page, setPage, totalPages, slice: pagedCategories } = usePagedSlice(filteredCategories, limit);

  return (
    <div className="flex flex-col gap-4">
      {/* Category management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800">BIS / Non-BIS Model Classification</h2>
            <p className="text-[11px] text-slate-400">
              Manage which models are BIS-controlled. New Type-100 models are auto-added as Non-BIS; edit them here to reclassify.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search material code / model" className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-64" />
            </div>
            <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={onAddCategory} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all">
              <Plus className="w-3.5 h-3.5" /> Add Model
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[200px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr>
                {["Material Code", "Material Name", "Model Name", "Category", "Updated", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedCategories.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-16 text-center text-slate-400">{categoryLoading ? "Loading…" : "No models found."}</td></tr>
              ) : (
                pagedCategories.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
                    <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-600">{row.materialCode}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500">{row.materialName || "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800">{row.modelName}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.category === 1 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                        {row.category === 1 ? "BIS" : "Non-BIS"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onEditCategory(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeleteCategory(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <Pagination currentPage={page} totalPages={totalPages} totalRecords={filteredCategories.length} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
        </div>
      </div>
    </div>
  );
};

export default BISConfigTab;

import { useState, useMemo } from "react";
import { Search, LayoutGrid, Table2, PackageOpen, FileText, FileSearch, Pencil, Download, Trash2, FileDown, FileSpreadsheet } from "lucide-react";
import Pagination from "../../../components/ui/Pagination";
import { exportRowsToPDF, exportRowsToExcel } from "../../../utils/reportExport";
import { FreqBadge, FileCard, usePagedSlice } from "./shared";

const EXPORT_COLUMNS = [
  { label: "Sr No", align: "left", value: (r) => r.srNo },
  { label: "Model Name", align: "left", value: (r) => r.modelName },
  { label: "Year", align: "left", value: (r) => r.year },
  { label: "Month", align: "left", value: (r) => r.month },
  { label: "Frequency", align: "left", value: (r) => r.testFrequency },
  { label: "Declared (kWh)", align: "right", value: (r) => r.declaredAnnualEnergy ?? "" },
  { label: "Measured (kWh)", align: "right", value: (r) => r.measuredAnnualEnergy ?? "" },
  { label: "Deviation (%)", align: "right", value: (r) => r.energyDeviationPercent ?? "" },
  { label: "Result", align: "center", value: (r) => r.testResult ?? "" },
  { label: "File Name", align: "left", value: (r) => r.fileName },
  { label: "Uploaded", align: "left", value: (r) => (r.uploadAt ? new Date(r.uploadAt).toLocaleDateString("en-IN") : "") },
];

// Merged file list/management — this used to be two near-duplicate tables
// (UploadBISReport's "All Reports" tab and BISReports' "Uploaded Reports"
// tab), both rendering the same `bis-files` data. One table now, with the
// full set of actions (edit/download/delete/re-extract) plus pagination
// and export.
const BISReportsTab = ({ files, onEdit, onDownload, onDelete, onFetchData }) => {
  const [viewMode, setViewMode] = useState("card");
  const [searchParams, setSearchParams] = useState({ term: "", field: "all" });
  const [limit, setLimit] = useState(25);

  const filteredFiles = useMemo(() => {
    const { term = "", field = "all" } = searchParams;
    if (!term.trim()) return files;
    const lowerTerm = term.toLowerCase();
    const s = (v) => (v ? v.toString().toLowerCase() : "");
    return files.filter((f) => {
      if (field !== "all") return s(f[field]).includes(lowerTerm);
      return ["modelName", "year", "month", "testFrequency", "description", "fileName"].some((k) => s(f[k]).includes(lowerTerm));
    });
  }, [files, searchParams]);

  const { page, setPage, totalPages, slice: pagedFiles } = usePagedSlice(filteredFiles, limit);

  const exportTitle = "BIS Report Manager — All Reports";
  const exportSubtitle = `${filteredFiles.length} report(s)${searchParams.term ? ` · filtered by "${searchParams.term}"` : ""}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports…"
              value={searchParams.term}
              onChange={(e) => setSearchParams((p) => ({ ...p, term: e.target.value }))}
              className="w-full h-9 pl-8 pr-3 text-xs text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <select
            value={searchParams.field}
            onChange={(e) => setSearchParams((p) => ({ ...p, field: e.target.value }))}
            className="h-9 px-2 text-xs text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white transition-all"
          >
            <option value="all">All Fields</option>
            <option value="modelName">Model Name</option>
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="testFrequency">Frequency</option>
            <option value="description">Description</option>
            <option value="fileName">File Name</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{filteredFiles.length} of {files.length} records</span>
          <button
            onClick={() => exportRowsToPDF({ rows: filteredFiles, columns: EXPORT_COLUMNS, title: exportTitle, subtitle: exportSubtitle, filename: "bis-reports.pdf" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600 transition-all"
            title="Export PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportRowsToExcel({ rows: filteredFiles, columns: EXPORT_COLUMNS, title: exportTitle, subtitle: exportSubtitle, filename: "bis-reports.xls" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-all"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {[{ mode: "card", Icon: LayoutGrid }, { mode: "table", Icon: Table2 }].map(({ mode, Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 flex items-center ${viewMode === mode ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
          <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
          <p className="text-sm text-slate-500 font-medium">
            {searchParams.term ? `No files match "${searchParams.term}"` : "No BIS Reports uploaded yet"}
          </p>
          {!searchParams.term && <p className="text-xs text-slate-400">Use the Upload tab to add your first report</p>}
        </div>
      )}

      {viewMode === "card" && filteredFiles.length > 0 && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {pagedFiles.map((file) => (
            <FileCard key={file.srNo} file={file} onEdit={onEdit} onDownload={onDownload} onDelete={onDelete} onFetchData={onFetchData} />
          ))}
        </div>
      )}

      {viewMode === "table" && filteredFiles.length > 0 && (
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100">
                {["Sr No", "Model Name", "Year", "Month", "Frequency", "Description", "Energy (Declared → Measured)", "Result", "File", "Uploaded", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedFiles.map((file) => (
                <tr key={file.srNo} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
                  <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 font-mono">{file.srNo}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800 max-w-[160px] truncate">{file.modelName}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600 font-mono">{file.year}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600">{file.month}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100"><FreqBadge freq={file.testFrequency} /></td>
                  <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 max-w-[200px] truncate">{file.description}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                    {file.declaredAnnualEnergy != null && file.measuredAnnualEnergy != null ? (
                      <>
                        {file.declaredAnnualEnergy} → {file.measuredAnnualEnergy} kWh
                        {file.energyDeviationPercent != null && (
                          <span className={file.energyDeviationPercent <= 0 ? "text-emerald-600" : "text-amber-600"}>
                            {" "}({file.energyDeviationPercent > 0 ? "+" : ""}{file.energyDeviationPercent}%)
                          </span>
                        )}
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100">
                    {file.testResult ? (
                      <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${file.testResult === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {file.testResult}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3 text-red-500" />
                      <span className="truncate max-w-[120px]">{file.fileName}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 whitespace-nowrap">
                    {file.uploadAt ? new Date(file.uploadAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onFetchData(file)} title="Fetch data from PDF" className="p-1.5 rounded text-violet-500 hover:bg-violet-50">
                        <FileSearch className="w-3 h-3" />
                      </button>
                      <button onClick={() => onEdit(file)} className="p-1.5 rounded text-blue-500 hover:bg-blue-50">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDownload(file)} className="p-1.5 rounded text-emerald-500 hover:bg-emerald-50">
                        <Download className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDelete(file)} className="p-1.5 rounded text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalRecords={filteredFiles.length}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </div>
  );
};

export default BISReportsTab;

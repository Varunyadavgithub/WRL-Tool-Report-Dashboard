import { useEffect, useState, useRef } from "react";
import { X, ChevronDown, Tag, CheckCircle2, FileSearch, Sparkles, FileText, Pencil, Download, Trash2, Calendar, Plus, Copy, Lock, LockOpen } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: CURRENT_YEAR - 2021 + 2 }, (_, i) => 2021 + i);

export const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

// Categorical (identity) — Declared vs Measured are two distinct series, not
// a good/bad pair, so they take fixed categorical slots, not status colors.
export const ENERGY_SERIES_COLORS = { declared: "#10b981", measured: "#f97316" };

// Status (state) — reserved meaning, always paired with a label.
export const STATUS_COLORS = { good: "#10b981", warning: "#f59e0b", critical: "#ef4444" };

export const COMPLIANCE_STATUS_STYLES = {
  "Test Completed": { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500" },
  "Test Failed": { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", dot: "bg-red-500" },
  "Test Pending": { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", dot: "bg-amber-500" },
};

// The BIS pass rule: declared must not exceed measured by more than this —
// same number the backend PDF extractor uses for its PASS/FAIL derivation.
export const DEVIATION_THRESHOLD_PCT = 5;

// Deviation chart tiering: negative (measured under declared) is good, 0
// up to the threshold is a warning, at/above the threshold breaches the
// BIS limit.
export const deviationColor = (v, thresholdPct = DEVIATION_THRESHOLD_PCT) =>
  v < 0 ? STATUS_COLORS.good : v < thresholdPct ? STATUS_COLORS.warning : STATUS_COLORS.critical;

// Cosmetic-only step list shown while the upload request is in flight.
export const SCAN_STEPS = [
  "Uploading PDF…",
  "Scanning document pages…",
  "Locating Energy Consumption Test section…",
  "Reading declared annual energy…",
  "Reading measured annual energy…",
  "Calculating deviation…",
  "Determining pass/fail result…",
];

export const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";

export const tooltipStyle = { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 };

// ── Freq Badge ─────────────────────────────────────────────────────────────────
export const FreqBadge = ({ freq }) => {
  const styles = {
    Monthly: "bg-indigo-50 text-indigo-700 border-indigo-200",
    Quarterly: "bg-amber-50 text-amber-700 border-amber-200",
    Yearly: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[freq] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {freq || "—"}
    </span>
  );
};

// ── Energy Result ──────────────────────────────────────────────────────────────
export const EnergyResult = ({ file, compact }) => {
  const hasEnergy = file.declaredAnnualEnergy != null && file.measuredAnnualEnergy != null;
  const hasResult = !!file.testResult;
  if (!hasEnergy && !hasResult) return compact ? <span className="text-slate-300">—</span> : null;

  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-center justify-between gap-2 text-[10px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5"}>
      <span className="text-slate-500 font-mono">
        {hasEnergy ? `${file.declaredAnnualEnergy} → ${file.measuredAnnualEnergy} kWh` : "—"}
        {file.energyDeviationPercent != null && (
          <span className={file.energyDeviationPercent <= 0 ? "text-emerald-600" : "text-amber-600"}>
            {" "}({file.energyDeviationPercent > 0 ? "+" : ""}{file.energyDeviationPercent}%)
          </span>
        )}
      </span>
      {hasResult && (
        <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded-full text-[9px] ${file.testResult === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
          {file.testResult}
        </span>
      )}
    </div>
  );
};

// ── Multi-select Dropdown ──────────────────────────────────────────────────────
// Generic checklist dropdown with type-to-search — used for Model/Year filters.
export const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder = "All", labelFor = (v) => v }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
  const clearAll = () => onChange([]);
  const allSelected = selected.length === options.length && options.length > 0;
  const filteredOptions = query.trim()
    ? options.filter((opt) => String(opt).toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="relative min-w-[170px]" ref={ref}>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-white text-xs font-semibold text-slate-700 hover:border-blue-300 transition-all ${
          selected.length > 0 ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected.length > 0 && <Tag className="w-3 h-3 text-blue-500 shrink-0" />}
          <span className="truncate">
            {selected.length === 0 ? placeholder : selected.length === 1 ? labelFor(selected[0]) : `${selected.length} selected`}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-slate-100">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <button
              type="button"
              onClick={() => (allSelected ? clearAll() : onChange([...options]))}
              className="text-[10px] font-semibold text-blue-600 hover:underline"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            {selected.length > 0 && <span className="text-[10px] text-slate-400">{selected.length} selected</span>}
          </div>
          <div className="py-1 max-h-52 overflow-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 text-center">{options.length === 0 ? "No options" : "No matches"}</p>
            ) : (
              filteredOptions.map((opt) => {
                const active = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${active ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"}`}>
                      {active && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    {labelFor(opt)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Searchable single-select (type to filter, click to pick) ──────────────────
export const SearchableSelect = ({ options, value, onChange, placeholder = "Search…" }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={open ? query : selectedOption?.label || ""}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
      />
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="py-1 max-h-52 overflow-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 text-center">No matches</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setQuery(""); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${o.value === value ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Scanning Modal ─────────────────────────────────────────────────────────────
export const ScanningModal = ({ step }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex flex-col items-center text-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
          <FileSearch className="w-7 h-7 text-blue-600 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Reading your BIS report…</h3>
        <p className="text-[11px] text-slate-400 mt-1">Scanned PDFs can take a few extra seconds</p>
      </div>
      <div className="space-y-2.5">
        {SCAN_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={label} className={`flex items-center gap-2.5 text-xs transition-opacity ${i > step ? "opacity-35" : "opacity-100"}`}>
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : active ? (
                <span className="w-4 h-4 shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              ) : (
                <span className="w-4 h-4 shrink-0 rounded-full border-2 border-slate-200" />
              )}
              <span className={done ? "text-slate-400" : active ? "text-slate-800 font-semibold" : "text-slate-400"}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ── Field Label ────────────────────────────────────────────────────────────────
export const FieldLabel = ({ children }) => (
  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">{children}</label>
);

// ── Confirm Energy Modal ──────────────────────────────────────────────────────
export const ConfirmEnergyModal = ({ data, onChange, onConfirm, onCancel, saving }) => {
  const allBlank =
    data.declaredAnnualEnergy === "" &&
    data.measuredAnnualEnergy === "" &&
    data.energyDeviationPercent === "" &&
    !data.testResult;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center gap-2.5">
          <Sparkles className="w-4 h-4" />
          <div>
            <h3 className="text-sm font-black">Confirm Extracted Values</h3>
            <p className="text-[11px] text-blue-100 mt-0.5">Review what we read from the PDF — edit anything that's wrong.</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {allBlank && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Nothing could be read automatically from this PDF. You can fill the values in manually below, or leave them blank.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Declared Annual Energy (kWh)</FieldLabel>
              <input type="number" step="any" value={data.declaredAnnualEnergy}
                onChange={(e) => onChange({ ...data, declaredAnnualEnergy: e.target.value })}
                className={inputCls} placeholder="e.g. 1066" />
            </div>
            <div>
              <FieldLabel>Measured Annual Energy (kWh)</FieldLabel>
              <input type="number" step="any" value={data.measuredAnnualEnergy}
                onChange={(e) => onChange({ ...data, measuredAnnualEnergy: e.target.value })}
                className={inputCls} placeholder="e.g. 1061.519" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Deviation (%)</FieldLabel>
              <input type="number" step="any" value={data.energyDeviationPercent}
                onChange={(e) => onChange({ ...data, energyDeviationPercent: e.target.value })}
                className={inputCls} placeholder="e.g. -0.42" />
            </div>
            <div>
              <FieldLabel>Result</FieldLabel>
              <div className="flex gap-2">
                {["PASS", "FAIL"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onChange({ ...data, testResult: r })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      data.testResult === r
                        ? r === "PASS" ? "bg-emerald-600 text-white border-emerald-600" : "bg-red-600 text-white border-red-600"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 bg-slate-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-all">
            Skip
          </button>
          <button type="button" onClick={onConfirm} disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? "Saving…" : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── File Card ──────────────────────────────────────────────────────────────────
export const FileCard = ({ file, onEdit, onDownload, onDelete, onFetchData }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-red-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{file.modelName}</p>
          <p className="text-[10px] text-slate-400 font-mono">#{file.srNo}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onFetchData(file)} title="Fetch data from PDF" className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 transition-colors">
          <FileSearch className="w-3 h-3" />
        </button>
        <button onClick={() => onEdit(file)} title="Edit" className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={() => onDownload(file)} title="Download" className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors">
          <Download className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(file)} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
    <div className="px-4 py-3 space-y-2 flex-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 flex items-center gap-1 font-mono">
          <Calendar className="w-3 h-3 text-slate-300" /> {file.month} {file.year}
        </span>
        <FreqBadge freq={file.testFrequency} />
      </div>
      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{file.description || "No description provided"}</p>
      <EnergyResult file={file} />
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-slate-400 truncate max-w-[60%] font-mono">{file.fileName}</p>
        <p className="text-[10px] text-slate-400">{file.uploadAt ? new Date(file.uploadAt).toLocaleDateString("en-IN") : "—"}</p>
      </div>
    </div>
    <div className="px-4 py-2.5 bg-blue-50 rounded-b-xl border-t border-blue-100">
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs flex items-center justify-center gap-1.5 font-semibold">
        <FileText className="w-3 h-3 text-red-400" /> View PDF
      </a>
    </div>
  </div>
);

// ── Stat Card (BISReports-style accent card, used on Compliance tab) ──────────
export const StatCard = ({ icon: Icon, label, value, accent, sub }) => (
  <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm p-5 flex gap-4 items-start" style={{ borderColor: accent + "33" }}>
    <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg shadow" style={{ background: accent }}>
      <Icon />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-0.5">{label}</p>
      <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
    <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: accent }} />
  </div>
);

export const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm">
      {label && <p className="font-bold text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ── Sortable table hook (click-to-sort headers) ────────────────────────────────
export const useSortableTable = (data) => {
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });

  const sorted = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] ?? "";
    const bVal = b[sortConfig.key] ?? "";
    const cmp = typeof aVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal));
    return sortConfig.dir === "asc" ? cmp : -cmp;
  });

  const toggle = (key) =>
    setSortConfig((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return { sorted, sortConfig, toggle };
};

// ── Client-side pagination slice ───────────────────────────────────────────────
export const usePagedSlice = (rows, limit) => {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length, limit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  return { page: safePage, setPage, totalPages, slice: rows.slice(start, start + limit) };
};

// ── BIS Test Reports (Phase 2 — in-app report entry) ────────────────────────────
export const BIS_REPORT_TYPES = ["Introduction", "Sound", "Volume"];

// Display-only rename: the "Introduction" report is shown to users as
// "Performance" (matches how the lab refers to it) — the underlying
// reportType value/DB column/API payloads all stay "Introduction" since
// that's wired through the schema, migrations, and stored data already.
const REPORT_TYPE_LABELS = { Introduction: "Performance", Sound: "Sound", Volume: "Volume" };
export const reportTypeLabel = (type) => REPORT_TYPE_LABELS[type] || type;

// SQL rows come back PascalCase (TestDateTo, ModelName…) — form state is
// camelCase to match the create/update payload shape the backend expects.
export const toDateInputValue = (v) => (v ? String(v).slice(0, 10) : "");

export const mapRowToCamel = (row) => {
  if (!row) return {};
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
    out[camelKey] = value;
  }
  return out;
};

// Applies mapRowToCamel plus date-input formatting for known date fields.
export const mapHeaderToFormState = (row) => {
  const h = mapRowToCamel(row);
  for (const key of ["testDateFrom", "testDateTo", "sampleReceiptDate", "reportIssueDate"]) {
    if (h[key] !== undefined) h[key] = toDateInputValue(h[key]);
  }
  return h;
};

export const mapEquipmentToFormState = (rows) =>
  (rows || []).map((row) => {
    const e = mapRowToCamel(row);
    e.calibrationDueDate = toDateInputValue(e.calibrationDueDate);
    return e;
  });

// Rounds to N decimals, passing through null/NaN — used by the auto-calculate
// formulas ported from the original lab-report Excel templates.
export const round = (v, decimals = 3) => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || Number.isNaN(n)) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

export const SectionCard = ({ title, children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${className}`}>
    {title && <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">{title}</h3>}
    {children}
  </div>
);

// ── Result Toggle (PASS / FAIL / PENDING) ───────────────────────────────────────
// `readOnly` renders this as a computed-value badge (no click targets) — used
// wherever the result comes from a formula (e.g. Volume/Energy pass-fail),
// matching the source template where those cells aren't user-editable.
export const ResultToggle = ({ value, onChange, options = ["PASS", "FAIL", "PENDING"], readOnly = false }) => {
  if (readOnly) {
    return (
      <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold ${
        value === "PASS" ? "bg-emerald-100 text-emerald-700" : value === "FAIL" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
      }`}>
        {value || "—"} <span className="font-normal text-[10px] opacity-70">(computed)</span>
      </span>
    );
  }
  return (
    <div className="flex gap-1.5">
      {options.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
            value === r
              ? r === "PASS" ? "bg-emerald-600 text-white border-emerald-600"
                : r === "FAIL" ? "bg-red-600 text-white border-red-600"
                : "bg-amber-500 text-white border-amber-500"
              : "border-slate-200 text-slate-500 hover:border-slate-300 bg-slate-50"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
};

// Styled read-only display for formula-derived numeric/text fields — visually
// distinct from a live input so it's clear the value comes from Calculate,
// not direct typing (mirrors the source Excel template's non-highlighted,
// formula-bearing cells).
export const computedInputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 bg-slate-50 cursor-not-allowed";

// A computed section (formula-derived fields) is locked by default — this
// toggles it into a normal editable state for the rare case the formula
// doesn't cover (a manual override), and flags clearly when it's active so
// nobody mistakes an overridden value for a freshly-calculated one.
export const OverrideToggle = ({ active, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
      active ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
    }`}
    title={active ? "Editing manually — click to go back to calculated values" : "Unlock to override the calculated values"}
  >
    {active ? <LockOpen className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
    {active ? "Manual Override" : "Unlock to Edit"}
  </button>
);

// ── Report Header Fields (common to all 3 report types + Introduction-only
//    nameplate fields) ────────────────────────────────────────────────────────
export const ReportHeaderFields = ({ header, onChange, models, showIntroFields, resultReadOnly = false }) => {
  // onChange is a curried setter — (field) => (value) => ... — same
  // convention as makeSetter/setHeaderField in the 3 report forms.
  const set = (field) => (e) => onChange(field)(e.target.value);
  const selectedModel = models.find((m) => m.modelName === header.modelName);

  return (
    <SectionCard title="Report Header">
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <FieldLabel>Model</FieldLabel>
          <SearchableSelect
            placeholder="Search BIS model…"
            value={header.modelName || ""}
            onChange={(modelName) => {
              const m = models.find((x) => x.modelName === modelName);
              onChange("modelName")(modelName);
              onChange("materialCode")(m?.materialCode || "");
            }}
            options={models.map((m) => ({ value: m.modelName, label: m.modelName }))}
          />
          {selectedModel && <p className="text-[10px] text-slate-400 mt-1">Material Code: <span className="font-mono">{selectedModel.materialCode}</span></p>}
        </div>
        <div>
          <FieldLabel>Machine Serial Number</FieldLabel>
          <input type="text" value={header.machineSerialNumber || ""} onChange={set("machineSerialNumber")} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Test Report No.</FieldLabel>
          <input type="text" value={header.testReportNo || ""} onChange={set("testReportNo")} className={inputCls} placeholder="e.g. WRL/TAD/26/0001" />
        </div>
        <div>
          <FieldLabel>UID No.</FieldLabel>
          <input type="text" value={header.uidNo || ""} onChange={set("uidNo")} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Test Date From</FieldLabel>
          <input type="date" value={header.testDateFrom || ""} onChange={set("testDateFrom")} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Test Date To *</FieldLabel>
          <input type="date" value={header.testDateTo || ""} onChange={set("testDateTo")} className={inputCls} required />
        </div>
        <div>
          <FieldLabel>Tested By</FieldLabel>
          <input type="text" value={header.testedBy || ""} onChange={set("testedBy")} className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Test Standard</FieldLabel>
          <input type="text" value={header.testStandard || ""} onChange={set("testStandard")} className={inputCls} placeholder="e.g. IS 7872 : 2020 Deep Freezers - Specification" />
        </div>
        <div>
          <FieldLabel>Result{resultReadOnly && " (from location statuses below)"}</FieldLabel>
          <ResultToggle value={header.result} onChange={(v) => onChange("result")(v)} readOnly={resultReadOnly} />
        </div>

<<<<<<< HEAD
        {showIntroFields && (
          <>
            <div><FieldLabel>Appliance Type</FieldLabel><input type="text" value={header.applianceType || ""} onChange={set("applianceType")} className={inputCls} placeholder="e.g. Deep Freezer" /></div>
            <div><FieldLabel>Manufacturer</FieldLabel><input type="text" value={header.manufacturer || ""} onChange={set("manufacturer")} className={inputCls} /></div>
            <div><FieldLabel>Product Variant / Type</FieldLabel><input type="text" value={header.productVariant || ""} onChange={set("productVariant")} className={inputCls} placeholder="e.g. Glass Top Deep Freezer" /></div>
            <div><FieldLabel>Refrigerant Name</FieldLabel><input type="text" value={header.refrigerantName || ""} onChange={set("refrigerantName")} className={inputCls} placeholder="e.g. R-290 (77 gram)" /></div>
            <div><FieldLabel>Rated Voltage / Freq / Phase</FieldLabel><input type="text" value={header.ratedVoltageFreqPhase || ""} onChange={set("ratedVoltageFreqPhase")} className={inputCls} placeholder="e.g. 230V / 50Hz / 1 Ph" /></div>
            <div><FieldLabel>Unit Picked From</FieldLabel><input type="text" value={header.unitPickedFrom || ""} onChange={set("unitPickedFrom")} className={inputCls} /></div>
            <div><FieldLabel>Rated Gross Volume (L)</FieldLabel><input type="number" step="any" value={header.ratedGrossVolumeLitre || ""} onChange={set("ratedGrossVolumeLitre")} className={inputCls} /></div>
            <div><FieldLabel>Rated Storage Volume (L)</FieldLabel><input type="number" step="any" value={header.ratedStorageVolumeLitre || ""} onChange={set("ratedStorageVolumeLitre")} className={inputCls} /></div>
            <div><FieldLabel>Annual Electricity Consumption (kWh/yr)</FieldLabel><input type="number" step="any" value={header.annualElectricityConsumptionKwh || ""} onChange={set("annualElectricityConsumptionKwh")} className={inputCls} /></div>
            <div><FieldLabel>Report Issue Date</FieldLabel><input type="date" value={header.reportIssueDate || ""} onChange={set("reportIssueDate")} className={inputCls} /></div>
            <div><FieldLabel>Total Pages</FieldLabel><input type="number" value={header.totalPages || ""} onChange={set("totalPages")} className={inputCls} /></div>
            <div><FieldLabel>Sample Receipt Date</FieldLabel><input type="date" value={header.sampleReceiptDate || ""} onChange={set("sampleReceiptDate")} className={inputCls} /></div>
            <div><FieldLabel>Condition of Sample on Receipt</FieldLabel><input type="text" value={header.sampleCondition || ""} onChange={set("sampleCondition")} className={inputCls} placeholder="e.g. Satisfactory" /></div>
            <div><FieldLabel>Purpose of Testing</FieldLabel><input type="text" value={header.purposeOfTesting || ""} onChange={set("purposeOfTesting")} className={inputCls} placeholder="e.g. For BIS Requirement" /></div>
            <div><FieldLabel>Prepared By</FieldLabel><input type="text" value={header.preparedBy || ""} onChange={set("preparedBy")} className={inputCls} /></div>
            <div><FieldLabel>Reviewed By</FieldLabel><input type="text" value={header.reviewedBy || ""} onChange={set("reviewedBy")} className={inputCls} /></div>
            <div><FieldLabel>Authorized By</FieldLabel><input type="text" value={header.authorizedBy || ""} onChange={set("authorizedBy")} className={inputCls} /></div>
          </>
        )}
=======
        {/* Sample/report metadata — common to all 3 report types, since every
            BIS report's cover page (Test Report No., sample condition, purpose
            of testing, etc.) needs these regardless of test type. */}
        <div><FieldLabel>Appliance Type</FieldLabel><input type="text" value={header.applianceType || ""} onChange={set("applianceType")} className={inputCls} placeholder="e.g. Deep Freezer" /></div>
        <div><FieldLabel>Manufacturer</FieldLabel><input type="text" value={header.manufacturer || ""} onChange={set("manufacturer")} className={inputCls} /></div>
        <div><FieldLabel>Unit Picked From</FieldLabel><input type="text" value={header.unitPickedFrom || ""} onChange={set("unitPickedFrom")} className={inputCls} /></div>
        <div><FieldLabel>Report Issue Date</FieldLabel><input type="date" value={header.reportIssueDate || ""} onChange={set("reportIssueDate")} className={inputCls} /></div>
        <div><FieldLabel>Sample Receipt Date</FieldLabel><input type="date" value={header.sampleReceiptDate || ""} onChange={set("sampleReceiptDate")} className={inputCls} /></div>
        <div><FieldLabel>Condition of Sample on Receipt</FieldLabel><input type="text" value={header.sampleCondition || ""} onChange={set("sampleCondition")} className={inputCls} placeholder="e.g. Satisfactory" /></div>
        <div><FieldLabel>Purpose of Testing</FieldLabel><input type="text" value={header.purposeOfTesting || ""} onChange={set("purposeOfTesting")} className={inputCls} placeholder="e.g. For BIS Requirement" /></div>
        <div><FieldLabel>Total Pages</FieldLabel><input type="number" value={header.totalPages || ""} onChange={set("totalPages")} className={inputCls} /></div>

        {showIntroFields && (
          <>
            <div><FieldLabel>Product Variant / Type</FieldLabel><input type="text" value={header.productVariant || ""} onChange={set("productVariant")} className={inputCls} placeholder="e.g. Glass Top Deep Freezer" /></div>
            <div><FieldLabel>Refrigerant Name</FieldLabel><input type="text" value={header.refrigerantName || ""} onChange={set("refrigerantName")} className={inputCls} placeholder="e.g. R-290 (77 gram)" /></div>
            <div><FieldLabel>Rated Voltage / Freq / Phase</FieldLabel><input type="text" value={header.ratedVoltageFreqPhase || ""} onChange={set("ratedVoltageFreqPhase")} className={inputCls} placeholder="e.g. 230V / 50Hz / 1 Ph" /></div>
            <div><FieldLabel>Rated Gross Volume (L)</FieldLabel><input type="number" step="any" value={header.ratedGrossVolumeLitre || ""} onChange={set("ratedGrossVolumeLitre")} className={inputCls} /></div>
            <div><FieldLabel>Rated Storage Volume (L)</FieldLabel><input type="number" step="any" value={header.ratedStorageVolumeLitre || ""} onChange={set("ratedStorageVolumeLitre")} className={inputCls} /></div>
            <div><FieldLabel>Annual Electricity Consumption (kWh/yr)</FieldLabel><input type="number" step="any" value={header.annualElectricityConsumptionKwh || ""} onChange={set("annualElectricityConsumptionKwh")} className={inputCls} /></div>
          </>
        )}
        {/* Prepared/Reviewed/Authorized By are no longer typed here — they're
            stamped automatically (name + signature) as the report moves
            through the Preparer → Reviewer → Authorizer approval flow. */}
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61

        <div className="md:col-span-3">
          <FieldLabel>Remarks</FieldLabel>
          <textarea value={header.remarks || ""} onChange={set("remarks")} rows={2} className={`${inputCls} resize-none`} />
        </div>
      </div>
    </SectionCard>
  );
};

// ── Equipment Editor (Test Equipment Used — shared across all 3 report types) ──
export const EquipmentEditor = ({ equipment, onChange, onCopyFromLast, copying }) => {
  const addRow = () => onChange([...equipment, { instrumentName: "", make: "", model: "", serialOrEquipmentId: "", calibrationDueDate: "" }]);
  const removeRow = (idx) => onChange(equipment.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => onChange(equipment.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Test Equipment Used</h3>
        <div className="flex items-center gap-2">
          {onCopyFromLast && (
            <button type="button" onClick={onCopyFromLast} disabled={copying}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-50">
              <Copy className="w-3 h-3" /> {copying ? "Loading…" : "Copy from last report"}
            </button>
          )}
          <button type="button" onClick={addRow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all">
            <Plus className="w-3 h-3" /> Add Instrument
          </button>
        </div>
      </div>
      {equipment.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No equipment added yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {["Instrument", "Make", "Model", "Serial / Equipment ID", "Calibration Due Date", ""].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipment.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="text" value={row.instrumentName} onChange={(e) => updateRow(idx, "instrumentName", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="text" value={row.make} onChange={(e) => updateRow(idx, "make", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="text" value={row.model} onChange={(e) => updateRow(idx, "model", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="text" value={row.serialOrEquipmentId} onChange={(e) => updateRow(idx, "serialOrEquipmentId", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="date" value={row.calibrationDueDate || ""} onChange={(e) => updateRow(idx, "calibrationDueDate", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100">
                    <button type="button" onClick={() => removeRow(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
};

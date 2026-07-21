import { useState, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import * as XLSX from "xlsx";
import {
  CalendarRange, Upload, Download, Trash2,
  CheckCircle2, AlertTriangle, FileSpreadsheet, Info, Loader2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";
import { selectPlans } from "../../redux/slices/masterConfigSlice";
import {
  useAddPlanMutation, useUpdatePlanMutation, useDeletePlanMutation, useBulkAddPlansMutation,
} from "../../redux/api/masterConfigApi";

const PRIORITIES = ["High","Medium","Low"];
const SHIFTS = ["Shift A","Shift B","Shift C","All Shifts"];

const today = new Date();
const fmtDate = (d) => d.toISOString().split("T")[0];
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const TODAY_STR = fmtDate(today);
const YESTERDAY_STR = fmtDate(yesterday);

const INIT = { machineName:"", sapCode:"", partName:"", modelCode:"", targetQty:"", shift:"All Shifts", planDate: fmtDate(today), priority:"Medium", customer:"", plannedCycleTime:"" };

const PriorityBadge = ({ p }) => {
  const c = { High:"bg-rose-50 text-rose-700 border-rose-200", Medium:"bg-amber-50 text-amber-700 border-amber-200", Low:"bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c[p] || c.Medium}`}>{p}</span>;
};

/* ── Excel column auto-detection ─────────────────────────────────────────── */
const COLUMN_ALIASES = {
  machineName:      ["machine name","machine","machine no","equipment","machine code"],
  sapCode:          ["sap code","sap","sapcode","material code","mat code","part code","item code","part no","part number"],
  partName:         ["part name","partname","description","item description","item name","name"],
  modelCode:        ["model code","model","program","program name"],
  targetQty:        ["target qty","target quantity","plan qty","planned qty","target","qty"],
  shift:            ["shift","shift name"],
  planDate:         ["plan date","production date","date"],
  priority:         ["priority"],
  customer:         ["customer","client"],
  plannedCycleTime: ["planned cycle time","cycle time","ct (s)","ct(s)","cycle time (s)"],
};

const ALIAS_PAIRS = Object.entries(COLUMN_ALIASES)
  .flatMap(([field, aliases]) => aliases.map((alias) => ({ field, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

const normHeader = (h) => String(h ?? "").toLowerCase().trim().replace(/\s+/g, " ");

const detectColumn = (header) => {
  const h = normHeader(header);
  if (!h) return null;
  for (const { field, alias } of ALIAS_PAIRS) if (h === alias) return field;
  for (const { field, alias } of ALIAS_PAIRS) if (h.includes(alias)) return field;
  return null;
};

const autoMap = (headers) => {
  const map = {};
  headers.forEach((h, idx) => {
    const field = detectColumn(h);
    if (field && map[field] === undefined) map[field] = idx;
  });
  return map;
};

// Excel serial date (1900 epoch, accounting for the classic leap-year bug) → JS Date
const excelSerialToDate = (serial) => {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
};

// Best-effort normalisation to YYYY-MM-DD — handles raw text, Excel serials,
// and common D/M/Y or M/D/Y text formats. Anything unrecognised passes through
// unchanged so the issue is visible in the preview step rather than silently dropped.
const normalizeDate = (val) => {
  if (val === "" || val == null) return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 60000) {
    return fmtDate(excelSerialToDate(Number(s)));
  }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }
  return s;
};

const FIELD_LABELS = {
  machineName: "Machine Name *", sapCode: "SAP Code *", partName: "Part Name", modelCode: "Model Code",
  targetQty: "Target Qty *", shift: "Shift", planDate: "Plan Date *",
  priority: "Priority", customer: "Customer", plannedCycleTime: "Planned Cycle Time (s)",
};

const NUM_FIELDS = ["targetQty", "plannedCycleTime"];

/* ── Bulk Upload Modal ───────────────────────────────────────────────────── */
const BulkUploadModal = ({ onClose, onImport }) => {
  const fileRef = useRef();
  const [step, setStep] = useState("upload"); // upload | map | preview
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [colMap, setColMap] = useState({});
  const [importing, setImporting] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = ext === "csv"
          ? XLSX.read(ev.target.result, { type: "string" })
          : XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) { toast.error("The file has no readable sheet."); return; }
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
        const hdrs = (json[0] || []).map(String);
        if (!hdrs.length) { toast.error("No header row found in the file."); return; }
        const dataRows = json.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
        setHeaders(hdrs);
        setRows(dataRows);
        setColMap(autoMap(hdrs));
        setStep("map");
      } catch (err) {
        console.error(err);
        toast.error("Could not parse this file. Please check the format.");
      }
    };
    reader.onerror = () => toast.error("Failed to read the file.");
    if (ext === "csv") reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const mapped = useMemo(() => {
    if (!rows.length) return [];
    const built = rows.map((row, i) => {
      const obj = { _rowId: Date.now() + i };
      Object.entries(colMap).forEach(([field, idx]) => {
        if (idx !== "" && idx !== undefined && idx !== null) {
          obj[field] = String(row[idx] ?? "").trim();
        }
      });
      NUM_FIELDS.forEach((f) => { obj[f] = obj[f] ? (parseFloat(obj[f]) || 0) : 0; });
      obj.planDate = normalizeDate(obj.planDate);
      obj.shift = obj.shift || "All Shifts";
      obj.priority = PRIORITIES.includes(obj.priority) ? obj.priority : "Medium";
      return obj;
    }).filter((r) => r.machineName && r.sapCode && r.targetQty > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.planDate));

    // Natural key (sapCode + machineName + planDate + shift) must be unique — keep the last row.
    const byKey = new Map();
    built.forEach((r) => byKey.set(`${r.sapCode}|${r.machineName}|${r.planDate}|${r.shift}`, r));
    return Array.from(byKey.values());
  }, [rows, colMap]);

  const preview = mapped.slice(0, 8);
  const canPreview = colMap.machineName !== undefined && colMap.sapCode !== undefined
    && colMap.targetQty !== undefined && colMap.planDate !== undefined;

  const doImport = () => {
    if (!mapped.length) { toast.error("No valid rows to import (Machine Name + SAP Code + Target Qty + Plan Date required)."); return; }
    setImporting(true);
    onImport(mapped).finally(() => {
      setImporting(false);
      onClose();
    });
  };

  const stepOrder = ["upload", "map", "preview"];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50"><FileSpreadsheet className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Bulk Upload Production Plan</h2>
              <p className="text-[11px] text-slate-400">
                {step === "upload" && "Upload an Excel (.xlsx) or CSV file"}
                {step === "map"    && `${headers.length} columns detected — map to plan fields`}
                {step === "preview" && `Preview: ${mapped.length} valid rows ready to import`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="flex items-center gap-0 px-6 py-2 border-b border-slate-100 shrink-0">
          {[["upload","1","Upload File"],["map","2","Map Columns"],["preview","3","Preview & Import"]].map(([s, n, label], idx) => {
            const isActive = step === s;
            const isDone = stepOrder.indexOf(s) < stepOrder.indexOf(step);
            return (
              <div key={s} className="flex items-center gap-0">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${isActive ? "bg-blue-600 text-white" : isDone ? "text-emerald-600" : "text-slate-400"}`}>
                  <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold border-current">{n}</span>
                  {label}
                </div>
                {idx < 2 && <div className="w-6 h-0.5 bg-slate-200 mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === "upload" && (
            <div className="flex flex-col items-center gap-6">
              <div
                onClick={() => fileRef.current.click()}
                className="w-full max-w-lg border-2 border-dashed border-blue-300 rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all"
              >
                <div className="p-4 rounded-2xl bg-blue-50"><Upload className="w-8 h-8 text-blue-600" /></div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">Click to upload or drag & drop</p>
                  <p className="text-[11px] text-slate-400 mt-1">Supports .xlsx, .xls, .csv</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </div>

              <div className="w-full max-w-lg bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Expected Columns</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["Machine Name","SAP Code","Part Name","Model Code","Target Qty","Shift","Plan Date","Priority","Customer","Planned Cycle Time (s)"].map((c) => (
                    <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{c}</span>
                  ))}
                </div>
                <p className="text-[10px] text-amber-600 mt-2">Column names are auto-detected — exact match not required. <strong>Machine Name</strong>, <strong>SAP Code</strong>, <strong>Target Qty</strong> and <strong>Plan Date</strong> are mandatory.</p>
              </div>
            </div>
          )}

          {step === "map" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className={`p-3 rounded-xl border transition-all ${colMap[field] !== undefined ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                    <select
                      value={colMap[field] ?? ""}
                      onChange={(e) => setColMap((prev) => ({ ...prev, [field]: e.target.value === "" ? undefined : parseInt(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                    {colMap[field] !== undefined && (
                      <p className="text-[9px] text-emerald-600 mt-1 font-semibold">✓ Mapped from: "{headers[colMap[field]]}"</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-[11px] text-blue-700 font-medium">
                  <strong>{rows.length}</strong> data rows in file.
                  {canPreview
                    ? <span className="text-emerald-700"> Required fields mapped — ready to preview.</span>
                    : <span className="text-amber-700"> Map <strong>Machine Name</strong>, <strong>SAP Code</strong>, <strong>Target Qty</strong> and <strong>Plan Date</strong> to continue.</span>}
                </p>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">
                  Showing first {preview.length} of <span className="text-blue-600">{mapped.length}</span> valid rows
                </p>
                {rows.length - mapped.length > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {rows.length - mapped.length} rows skipped (missing required fields, invalid date, or duplicate key)
                  </span>
                )}
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {["#","Machine","SAP Code","Part Name","Target Qty","Shift","Plan Date","Priority"].map((h) => (
                        <th key={h} className="px-3 py-2 text-[10px] font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, idx) => (
                      <tr key={r._rowId} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/30 transition-colors`}>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 whitespace-nowrap">{r.machineName}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600 font-mono">{r.sapCode}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-600">{r.partName || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-slate-700">{r.targetQty}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500">{r.shift}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">{r.planDate}</td>
                        <td className="px-3 py-2 border-b border-slate-100"><PriorityBadge p={r.priority} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-blue-700">
                  Existing plans matching the same Machine + SAP Code + Plan Date + Shift will be <strong>updated</strong>. New combinations will be <strong>added</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
          <div className="flex gap-2">
            {step === "map" && (
              <button onClick={() => setStep("upload")} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">← Back</button>
            )}
            {step === "preview" && (
              <button onClick={() => setStep("map")} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">← Edit Mapping</button>
            )}
            {step === "map" && (
              <button
                disabled={!canPreview}
                onClick={() => setStep("preview")}
                className={`px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all ${canPreview ? "bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200" : "bg-slate-300 cursor-not-allowed"}`}
              >
                Preview →
              </button>
            )}
            {step === "preview" && (
              <button
                onClick={doImport}
                disabled={importing || !mapped.length}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all ${mapped.length && !importing ? "bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200" : "bg-slate-300 cursor-not-allowed"}`}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {importing ? "Importing…" : `Import ${mapped.length} Plans`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Export helpers ──────────────────────────────────────────────────────── */
const EXPORT_HEADERS = ["Machine Name","SAP Code","Part Name","Model Code","Target Qty","Shift","Plan Date","Priority","Customer","Planned Cycle Time (s)"];

const downloadTemplate = () => {
  const sample = [["Bending Machine 1","1127024","D-UNIT FRAME D150H","D150H","480","Shift A",fmtDate(today),"Medium","Whirlpool","45"]];
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plan");
  XLSX.writeFile(wb, "production_plan_template.xlsx");
};

const exportData = (data) => {
  const rows = data.map((r) => [
    r.machineName, r.sapCode, r.partName || "", r.modelCode || "", r.targetQty,
    r.shift, r.planDate, r.priority, r.customer || "", r.plannedCycleTime || "",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plan");
  XLSX.writeFile(wb, "production_plan.xlsx");
};

/* ── Main page ────────────────────────────────────────────────────────────── */
const PlanningConfig = () => {
  const data = useSelector(selectPlans);
  const [addPlan]      = useAddPlanMutation();
  const [updatePlan]   = useUpdatePlanMutation();
  const [deletePlan]   = useDeletePlanMutation();
  const [bulkAddPlans] = useBulkAddPlansMutation();

  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");
  // Defaults to today's plans, matching the Today/Yesterday quick-filter
  // pattern used on the Part Process report pages.
  const [dateFilter, setDateFilter] = useState(TODAY_STR);
  const [showBulk, setShowBulk] = useState(false);

  const filtered = useMemo(() =>
    data.filter((r) =>
      (!dateFilter || r.planDate === dateFilter) &&
      (r.machineName.toLowerCase().includes(search.toLowerCase()) ||
       r.sapCode.includes(search) ||
       (r.partName || "").toLowerCase().includes(search.toLowerCase()))
    ), [data, search, dateFilter]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = async () => {
    if (!form.machineName || !form.sapCode || !form.targetQty || !form.planDate) {
      toast.error("Machine, SAP Code, Target Qty and Plan Date are required.");
      return;
    }
    try {
      if (modal.mode === "add") {
        await addPlan(form).unwrap();
        toast.success("Plan added.");
      } else {
        await updatePlan({ ...form, id: modal.row.id }).unwrap();
        toast.success("Plan updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save plan.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePlan(id).unwrap();
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete.");
    }
  };

  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const totalTarget = filtered.reduce((s, r) => s + Number(r.targetQty || 0), 0);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Planning Configuration" subtitle="Upload and manage production plans / shift targets — feeds Plan Qty in the Production Report" icon={CalendarRange} onAdd={openAdd} addLabel="Add Plan" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4">
        {/* Action bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] font-semibold text-slate-500">Plan Date:</label>
            <button
              onClick={() => setDateFilter(TODAY_STR)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${dateFilter === TODAY_STR ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"}`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter(YESTERDAY_STR)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${dateFilter === YESTERDAY_STR ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"}`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDateFilter("")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${dateFilter === "" ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"}`}
            >
              All Dates
            </button>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Bulk Upload Excel / CSV
          </button>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
          <button onClick={() => exportData(filtered)} disabled={!filtered.length} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-slate-600">Total Target: <strong className="text-blue-600">{totalTarget.toLocaleString()}</strong></span>
            <span className="text-slate-400">{filtered.length} of {data.length} plans</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Machine</TH><TH>SAP Code</TH><TH>Part Name</TH>
                  <TH center>Date</TH><TH center>Shift</TH><TH center>Target Qty</TH>
                  <TH center>Priority</TH><TH>Customer</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD cls="font-medium text-slate-700 whitespace-nowrap">{r.machineName}</TD>
                    <TD mono cls="text-blue-600 font-bold">{r.sapCode}</TD>
                    <TD cls="text-slate-600 whitespace-nowrap">{r.partName || "—"}</TD>
                    <TD center mono cls="text-slate-500">{r.planDate}</TD>
                    <TD center><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{r.shift}</span></TD>
                    <TD center cls="font-bold text-slate-700">{Number(r.targetQty).toLocaleString()}</TD>
                    <TD center><PriorityBadge p={r.priority} /></TD>
                    <TD cls="text-slate-500 text-[11px]">{r.customer}</TD>
                    <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={10} message="No production plans yet. Add one or bulk-upload an Excel file." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Production Plan" : "Edit Production Plan"} onClose={closeModal} onSave={handleSave} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Machine Name" required><input value={form.machineName} onChange={sf("machineName")} placeholder="e.g. Bending Machine 1" className={inputCls} /></Field>
            <Field label="SAP Code" required><input value={form.sapCode} onChange={sf("sapCode")} placeholder="e.g. 1127024" className={inputCls} /></Field>
            <Field label="Part Name"><input value={form.partName} onChange={sf("partName")} placeholder="e.g. D-UNIT FRAME D150H" className={inputCls} /></Field>
            <Field label="Model Code"><input value={form.modelCode} onChange={sf("modelCode")} placeholder="e.g. D150H" className={inputCls} /></Field>
            <Field label="Target Quantity" required><input type="number" value={form.targetQty} onChange={sf("targetQty")} placeholder="e.g. 480" className={inputCls} min={1} /></Field>
            <Field label="Planned Cycle Time (s)"><input type="number" value={form.plannedCycleTime} onChange={sf("plannedCycleTime")} placeholder="e.g. 45" className={inputCls} min={1} /></Field>
            <Field label="Shift">
              <select value={form.shift} onChange={sf("shift")} className={selectCls}>{SHIFTS.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Plan Date" required><input type="date" value={form.planDate} onChange={sf("planDate")} className={inputCls} /></Field>
            <Field label="Priority">
              <select value={form.priority} onChange={sf("priority")} className={selectCls}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="Customer"><input value={form.customer} onChange={sf("customer")} placeholder="e.g. Whirlpool" className={inputCls} /></Field>
          </div>
        </Modal>
      )}

      {showBulk && (
        <BulkUploadModal
          onClose={() => setShowBulk(false)}
          onImport={async (rows) => {
            try {
              const res = await bulkAddPlans(rows).unwrap();
              toast.success(`${res.inserted} added, ${res.updated} updated${res.skipped ? `, ${res.skipped} skipped` : ""}.`);
            } catch (err) {
              toast.error(err?.data?.message || "Bulk import failed.");
            }
          }}
        />
      )}
    </div>
  );
};

export default PlanningConfig;

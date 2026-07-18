import { useState, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import * as XLSX from "xlsx";
import {
  Package2, Upload, Download, Eye, Trash2,
  CheckCircle2, AlertTriangle, FileSpreadsheet,
  Info, Loader2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  inputCls, selectCls, Field, Modal,
  TableActions, PageHeader, EmptyState, TH, TD,
} from "./_shared";
import { selectMaterials, updateMaterial as updateMaterialSlice } from "../../redux/slices/masterConfigSlice";
import {
  useAddMaterialMutation, useUpdateMaterialMutation, useDeleteMaterialMutation, useBulkAddMaterialsMutation,
  useUploadMaterialDrawingMutation, useDeleteMaterialDrawingMutation,
} from "../../redux/api/masterConfigApi";
import { fileBaseURL } from "../../assets/assets";

// ─── Static options ────────────────────────────────────────────────────────────
const CATEGORIES = ["ALUMINIUM","GP","GPSP","PC RED","PC WHITE","SS304 2B","SS304 HL","SS430 HL","SSS430 2B"];

const INIT = {
  sapCode:"", partName:"", category:"",
  sheetSapCode:"", sheetDescription:"",
  length:"", width:"", thickness:"", weight:"", componentWeight:"", scrapWeight:"",
  noOfSheet:"", actualComponentsPerSheet:"", pncLoadingUnloading:"",
  definedComponentCycleTime:"",
  drawingNumber:"", drawingRevision:"",
};

const round2 = (n) => Math.round(n * 100) / 100;

// No of Sheet is the ONLY auto-derived field. Default comes from sheet thickness
// (THK in mm) and the user can always override it. When nothing can be derived
// (and the user leaves it blank), it falls back to 1.
// THK ≤ 0.25 → 3 sheets · ≤ 0.50 → 2 sheets · > 0.50 → 1 sheet
const defaultNoOfSheet = (thickness) => {
  const t = parseFloat(thickness);
  if (!(t > 0)) return "";
  if (t <= 0.25) return 3;
  if (t <= 0.5)  return 2;
  return 1;
};

// ─── Column name auto-detection ────────────────────────────────────────────────
// Maps common header variations → our field names.
const COLUMN_ALIASES = {
  sapCode:        ["sap code","sap","sapcode","material code","mat code","matcode","material no","mat no","part code","item code","part no","part number"],
  partName:       ["part name","partname","description","item description","item name","name","material description","mat desc","part desc","component name"],
  sheetSapCode:   ["sheet sap code","sheet sapcode","sheet code","sheet material code","raw material code","raw material sap code"],
  sheetDescription: ["sheet description","sheet desc","sheet name","raw material description","raw material name"],
  drawingNumber:  ["drawing no","drawing number","drg no","drg","drawing","drg number","drawing no."],
  drawingRevision:["drawing revision","drg rev","revision","rev","drg rev.","rev no"],
  noOfSheet:      ["no of sheet","no. of sheet","no of sheets","sheet count","sheets","number of sheets","no_of_sheet"],
  length:          ["length","len","l (mm)","length (mm)"],
  width:           ["width","wid","w (mm)","width (mm)"],
  thickness:       ["thk","thickness","thk (mm)","thickness (mm)","gauge"],
  weight:          ["weight","sheet weight","wt","wt (kg)","weight (kg)"],
  componentWeight: ["component weight","comp weight","component wt","comp wt"],
  scrapWeight:     ["scrap weight","scrap wt","waste weight"],
  actualComponentsPerSheet: ["no. of component per sheet","no of component per sheet","no. of components per sheet","no of components per sheet","actual components per sheet","components per sheet","components/sheet","comp per sheet","comp/sheet"],
  pncLoadingUnloading:      ["loading/unloading time","loading unloading time","pnc loading/unloading","pnc loading unloading","loading/unloading","loading unloading","load/unload","load unload time"],
  definedComponentCycleTime:["defined component cycle time (secs)","defined component cycle time","component cycle time","cycle time (secs)","cycle time (sec)","cycle time (s)","cycle time","ct (s)","ct(s)"],
  category:       ["category","material category","type"],
};

// Pre-flatten to (field, alias) pairs sorted by alias length (longest first).
// Checking the longest alias first prevents short tokens like "ct" or "weight"
// from hijacking headers such as "Defined Component Cycle Time" or "Component Weight".
const ALIAS_PAIRS = Object.entries(COLUMN_ALIASES)
  .flatMap(([field, aliases]) => aliases.map((alias) => ({ field, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

const normHeader = (h) => String(h ?? "").toLowerCase().trim().replace(/\s+/g, " ");

const detectColumn = (header) => {
  const h = normHeader(header);
  if (!h) return null;
  // 1) exact match wins
  for (const { field, alias } of ALIAS_PAIRS) if (h === alias) return field;
  // 2) substring fallback, longest alias first
  for (const { field, alias } of ALIAS_PAIRS) if (h.includes(alias)) return field;
  return null;
};

const autoMap = (headers) => {
  const map = {};
  headers.forEach((h, idx) => {
    const field = detectColumn(h);
    if (field && map[field] === undefined) map[field] = idx; // use === undefined (0 is a valid index)
  });
  return map;
};


// ─── Bulk Upload Modal ─────────────────────────────────────────────────────────
const FIELD_LABELS = {
  sapCode: "SAP Code *", partName: "Description *", category: "Category",
  sheetSapCode: "Sheet SAP Code", sheetDescription: "Sheet Description",
  length: "Length", width: "Width", thickness: "THK",
  weight: "Weight", componentWeight: "Component Weight", scrapWeight: "Scrap Weight",
  noOfSheet: "No of Sheet",
  actualComponentsPerSheet: "No of Component per Sheet",
  pncLoadingUnloading: "Loading/Unloading Time",
  definedComponentCycleTime: "Defined Component Cycle Time (Secs)",
  drawingNumber: "Drawing No.", drawingRevision: "Rev.",
};

// Fields that should be stored as numbers.
const NUM_FIELDS = [
  "length","width","thickness",
  "weight","componentWeight","scrapWeight",
  "actualComponentsPerSheet","pncLoadingUnloading","noOfSheet",
  "definedComponentCycleTime",
];

const BulkUploadModal = ({ onClose, onImport }) => {
  const fileRef = useRef();
  const [step, setStep] = useState("upload"); // upload | map | preview
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [colMap, setColMap] = useState({});
  const [importing, setImporting] = useState(false);

  // Unified reader: XLSX parses both real spreadsheets and CSV, so quoted commas
  // inside descriptions no longer break the row (the old naive split did).
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
        const dataRows = json.slice(1).filter(r => r.some(c => c != null && String(c).trim() !== ""));
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
    e.target.value = ""; // allow re-selecting the same file
  };

  const mapped = useMemo(() => {
    if (!rows.length) return [];
    const built = rows.map((row, i) => {
      const obj = { id: Date.now() + i };
      Object.entries(colMap).forEach(([field, idx]) => {
        if (idx !== "" && idx !== undefined && idx !== null) {
          obj[field] = String(row[idx] ?? "").trim();
        }
      });
      // Coerce numeric fields (empty → 0, consistent with the single-add form)
      NUM_FIELDS.forEach((f) => { obj[f] = obj[f] ? (parseFloat(obj[f]) || 0) : 0; });
      // No of Sheet is the only auto-derived value: fill from THK only when the
      // file did not supply it. A supplied value always wins (manual override).
      // Anything still blank falls back to the default of 1.
      if (!obj.noOfSheet && obj.thickness > 0) obj.noOfSheet = defaultNoOfSheet(obj.thickness);
      if (!obj.noOfSheet) obj.noOfSheet = 1;
      return obj;
    }).filter(r => r.sapCode && r.partName);

    // SAP Code must be unique — keep the last row for each SAP Code.
    const bySap = new Map();
    built.forEach(r => bySap.set(r.sapCode, r));
    return Array.from(bySap.values());
  }, [rows, colMap]);

  const preview = mapped.slice(0, 8);
  const canPreview = colMap.sapCode !== undefined && colMap.partName !== undefined;

  const doImport = () => {
    if (!mapped.length) { toast.error("No valid rows to import (SAP Code + Description required)."); return; }
    setImporting(true);
    setTimeout(() => {
      onImport(mapped);
      setImporting(false);
      onClose();
      toast.success(`${mapped.length} materials imported successfully.`);
    }, 400);
  };

  const stepOrder = ["upload", "map", "preview"];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50"><FileSpreadsheet className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Bulk Upload Materials</h2>
              <p className="text-[11px] text-slate-400">
                {step === "upload" && "Upload an Excel (.xlsx) or CSV file"}
                {step === "map"    && `${headers.length} columns detected — map to material fields`}
                {step === "preview" && `Preview: ${mapped.length} valid rows ready to import`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        {/* Progress steps */}
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

          {/* ── STEP 1: Upload ── */}
          {step === "upload" && (
            <div className="flex flex-col items-center gap-6">
              <div
                onClick={() => fileRef.current.click()}
                className="w-full max-w-lg border-2 border-dashed border-blue-300 rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all"
              >
                <div className="p-4 rounded-2xl bg-blue-50">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">Click to upload or drag & drop</p>
                  <p className="text-[11px] text-slate-400 mt-1">Supports .xlsx, .xls, .csv</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </div>

              {/* Expected format hint */}
              <div className="w-full max-w-lg bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Expected Columns</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["SAP Code","Description","Category","Sheet SAP Code","Sheet Description","Length","Width","THK","Weight","Component Weight","Scrap Weight","No of Sheet","No of Component per Sheet","Loading/Unloading Time","Defined Component Cycle Time (Secs)","Drawing No.","Rev."].map(c => (
                    <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{c}</span>
                  ))}
                </div>
                <p className="text-[10px] text-amber-600 mt-2">Column names are auto-detected — exact match not required. <strong>SAP Code</strong> and <strong>Description</strong> are mandatory. No of Sheet auto-fills from THK when left blank, and defaults to 1 if nothing can be derived.</p>
              </div>
            </div>
          )}

          {/* ── STEP 2: Map columns ── */}
          {step === "map" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className={`p-3 rounded-xl border transition-all ${colMap[field] !== undefined ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                    <select
                      value={colMap[field] ?? ""}
                      onChange={e => setColMap(prev => ({ ...prev, [field]: e.target.value === "" ? undefined : parseInt(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                    {colMap[field] !== undefined && (
                      <p className="text-[9px] text-emerald-600 mt-1 font-semibold">
                        ✓ Mapped from: "{headers[colMap[field]]}"
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Row count */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-[11px] text-blue-700 font-medium">
                  <strong>{rows.length}</strong> data rows in file.
                  {canPreview
                    ? <span className="text-emerald-700"> SAP Code + Description mapped — ready to preview.</span>
                    : <span className="text-amber-700"> Map <strong>SAP Code</strong> and <strong>Description</strong> to continue.</span>}
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === "preview" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">
                  Showing first {preview.length} of <span className="text-blue-600">{mapped.length}</span> valid rows (SAP Code + Description present)
                </p>
                {rows.length - mapped.length > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {rows.length - mapped.length} rows skipped (missing SAP Code / Description, or duplicate SAP Code)
                  </span>
                )}
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {["#","SAP Code","Description","Sheet SAP Code","Sheet Description","No of Sheet","Comp/Sheet","Loading/Unloading","Defined Component Cycle Time (Secs)","Drawing No.","Rev."].map(h => (
                        <th key={h} className="px-3 py-2 text-[10px] font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, idx) => (
                      <tr key={r.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/30 transition-colors`}>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600 font-mono">{r.sapCode}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 whitespace-nowrap">{r.partName}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">{r.sheetSapCode || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">{r.sheetDescription || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-slate-700">{r.noOfSheet || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-slate-700">{r.actualComponentsPerSheet || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-amber-600">{r.pncLoadingUnloading || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-rose-600">{r.definedComponentCycleTime ? round2(+r.definedComponentCycleTime) : "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">{r.drawingNumber || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-amber-600">{r.drawingRevision || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-blue-700">
                  Existing materials with the same SAP Code will be <strong>updated</strong>. New SAP Codes will be <strong>added</strong>. No data will be deleted.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <div className="flex gap-2">
            {step === "map" && (
              <button onClick={() => setStep("upload")} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                ← Back
              </button>
            )}
            {step === "preview" && (
              <button onClick={() => setStep("map")} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                ← Edit Mapping
              </button>
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
                {importing ? "Importing…" : `Import ${mapped.length} Materials`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Confirm "Delete All" dialog ─────────────────────────────────────────────────
const ConfirmDeleteAll = ({ count, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="p-6 flex flex-col items-center text-center gap-3">
        <div className="p-3 rounded-2xl bg-rose-50">
          <AlertTriangle className="w-7 h-7 text-rose-600" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Delete all materials?</h2>
        <p className="text-sm text-slate-500">
          This will permanently remove <strong className="text-rose-600">{count}</strong> material{count === 1 ? "" : "s"}. This action cannot be undone.
        </p>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button onClick={onConfirm} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200">
          <Trash2 className="w-4 h-4" /> Delete All
        </button>
      </div>
    </div>
  </div>
);

// ─── Export helpers ──────────────────────────────────────────────────────────────
const EXPORT_HEADERS = [
  "SAP Code","Description","Category","Sheet SAP Code","Sheet Description",
  "Length","Width","THK","Weight","Component Weight","Scrap Weight",
  "No of Sheet","No of Component per Sheet","Loading/Unloading Time","Defined Component Cycle Time (Secs)",
  "Drawing No.","Rev.",
];

const downloadTemplate = () => {
  // No of Sheet left blank below to demonstrate the THK auto-fill / default-1 behaviour.
  const sample = [["1124700","PC OUTER REAR NWHD70H1-HC WHITE_0108171","PC WHITE","1108171","PC WHITE SHEET 536X460","536","460","0.40","0.78","0.826","0.061","","2","15","25.00","",""]];
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Materials");
  XLSX.writeFile(wb, "material_import_template.xlsx");
};

const exportData = (data) => {
  const rows = data.map(r => [
    r.sapCode, r.partName, r.category, r.sheetSapCode || "", r.sheetDescription || "",
    r.length || "", r.width || "", r.thickness || "",
    r.weight || "", r.componentWeight || "", r.scrapWeight || "",
    r.noOfSheet || "", r.actualComponentsPerSheet || "", r.pncLoadingUnloading || "",
    r.definedComponentCycleTime ? round2(+r.definedComponentCycleTime) : "",
    r.drawingNumber, r.drawingRevision,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Materials");
  XLSX.writeFile(wb, "material_master.xlsx");
};

// ─── Main page ─────────────────────────────────────────────────────────────────
const MaterialConfig = () => {
  const data      = useSelector(selectMaterials);
  const [addMaterial]      = useAddMaterialMutation();
  const [updateMaterial]   = useUpdateMaterialMutation();
  const [deleteMaterial]   = useDeleteMaterialMutation();
  const [bulkAddMaterials] = useBulkAddMaterialsMutation();

  const dispatch = useDispatch();
  const [uploadDrawing, { isLoading: drawingUploading }] = useUploadMaterialDrawingMutation();
  const [deleteDrawing]                       = useDeleteMaterialDrawingMutation();
  const [uploadingId, setUploadingId]         = useState(null);

  const [modal, setModal]                     = useState({ open: false, mode: "add", row: null });
  const [form, setForm]                       = useState(INIT);
  const [noOfSheetEdited, setNoOfSheetEdited] = useState(false);
  const [search, setSearch]                   = useState("");
  const [showBulk, setShowBulk]               = useState(false);
  const [confirmClear, setConfirmClear]       = useState(false);

  const handleDirectUpload = async (r, file) => {
    if (!file) return;
    setUploadingId(r.id);
    try {
      const res = await uploadDrawing({ id: r.id, file }).unwrap();
      dispatch(updateMaterialSlice({ ...r, drawingPath: res.data?.drawingPath }));
      toast.success("Drawing uploaded.");
    } catch (err) {
      toast.error(err?.data?.message || "Upload failed");
    }
    setUploadingId(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(r =>
      String(r.sapCode ?? "").toLowerCase().includes(q) ||
      String(r.partName ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const openAdd  = () => { setForm(INIT); setNoOfSheetEdited(false); setModal({ open: true, mode: "add", row: null }); };
  const openEdit = (row) => { setForm({ ...row }); setNoOfSheetEdited(true); setModal({ open: true, mode: "edit", row }); };
  const closeModal = () => setModal({ open: false, mode: "add", row: null });

  const handleSave = async () => {
    if (!form.sapCode || !form.partName) { toast.error("SAP Code and Description are required."); return; }

    // SAP Code must be unique (on both add and edit — exclude the row being edited).
    const dup = data.some(r => String(r.sapCode) === String(form.sapCode) && r.id !== modal.row?.id);
    if (dup) { toast.error("SAP Code already exists — it must be unique."); return; }

    const numeric = {
      length: +form.length || 0, width: +form.width || 0, thickness: +form.thickness || 0,
      weight: +form.weight || 0, componentWeight: +form.componentWeight || 0, scrapWeight: +form.scrapWeight || 0,
      noOfSheet: +form.noOfSheet || 1, // default 1 when not filled
      actualComponentsPerSheet: +form.actualComponentsPerSheet || 0,
      pncLoadingUnloading: +form.pncLoadingUnloading || 0,
      definedComponentCycleTime: +form.definedComponentCycleTime || 0,
    };
    try {
      if (modal.mode === "add") {
        await addMaterial({ ...form, ...numeric }).unwrap();
        toast.success("Material added.");
      } else {
        await updateMaterial({ ...form, ...numeric, id: modal.row.id }).unwrap();
        toast.success("Material updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save material.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMaterial(id).unwrap();
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete.");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await Promise.all(data.map(r => deleteMaterial(r.id).unwrap()));
      setConfirmClear(false);
      toast.success("All materials deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete all materials.");
    }
  };

  const sf = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  // THK drives the "No of Sheet" default until the user manually edits No of Sheet.
  const handleThicknessChange = (e) => {
    const thickness = e.target.value;
    setForm(f => ({
      ...f,
      thickness,
      noOfSheet: noOfSheetEdited ? f.noOfSheet : defaultNoOfSheet(thickness),
    }));
  };
  const handleNoOfSheetChange = (e) => {
    setNoOfSheetEdited(true);
    setForm(f => ({ ...f, noOfSheet: e.target.value }));
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Material Configuration" subtitle="Manage SAP codes, part masters, cycle times and drawing revisions" icon={Package2} onAdd={openAdd} addLabel="Add Material" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4">
        {/* Action bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Bulk Upload Excel / CSV
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
          <button
            onClick={() => exportData(filtered)}
            disabled={!filtered.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Export Data
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            disabled={!data.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete All
          </button>
          <span className="ml-auto text-[11px] text-slate-400">{filtered.length} of {data.length} materials</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>Sr. No.</TH>
                  <TH>SAP Code</TH>
                  <TH>Description</TH>
                  <TH>Category</TH>
                  <TH>Sheet SAP Code</TH>
                  <TH>Sheet Description</TH>
                  <TH center>Length</TH>
                  <TH center>Width</TH>
                  <TH center>THK</TH>
                  <TH center>Weight</TH>
                  <TH center>Component Weight</TH>
                  <TH center>Scrap Weight</TH>
                  <TH center>No of Sheet</TH>
                  <TH center>No of Component per Sheet</TH>
                  <TH center>Loading/Unloading Time</TH>
                  <TH center>Defined Component Cycle Time (Secs)</TH>
                  <TH>Drawing No.</TH>
                  <TH>Rev.</TH>
                  <TH center>Drawing File</TH>
                  <TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD mono cls="text-blue-600 font-bold">{r.sapCode}</TD>
                    <TD cls="font-medium text-slate-700 whitespace-nowrap">{r.partName}</TD>
                    <TD><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.category || "—"}</span></TD>
                    <TD mono cls="text-slate-500">{r.sheetSapCode || "—"}</TD>
                    <TD cls="text-slate-500 whitespace-nowrap">{r.sheetDescription || "—"}</TD>
                    <TD center cls="font-mono text-slate-600">{r.length || "—"}</TD>
                    <TD center cls="font-mono text-slate-600">{r.width || "—"}</TD>
                    <TD center cls="font-mono text-slate-600">{r.thickness || "—"}</TD>
                    <TD center cls="font-mono text-slate-600">{r.weight || "—"}</TD>
                    <TD center cls="font-mono text-slate-600">{r.componentWeight || "—"}</TD>
                    <TD center cls="font-mono text-slate-600">{r.scrapWeight || "—"}</TD>
                    <TD center cls="font-mono font-bold text-slate-700">{r.noOfSheet || "—"}</TD>
                    <TD center cls="font-mono font-bold text-slate-700">{r.actualComponentsPerSheet || "—"}</TD>
                    <TD center cls="font-mono text-amber-600">{r.pncLoadingUnloading || "—"}</TD>
                    <TD center cls="font-mono font-bold text-rose-600">{r.definedComponentCycleTime ? `${round2(+r.definedComponentCycleTime)}s` : "—"}</TD>
                    <TD mono cls="text-slate-500">{r.drawingNumber}</TD>
                    <TD>
                      {r.drawingRevision && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">{r.drawingRevision}</span>
                      )}
                    </TD>
                    {/* Drawing File column */}
                    <TD center>
                      <div className="flex items-center justify-center gap-1">
                        {uploadingId === r.id ? (
                          <span className="flex items-center gap-1 text-[10px] text-blue-500 font-semibold">
                            <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                          </span>
                        ) : r.drawingPath ? (
                          <>
                            <a
                              href={`${fileBaseURL}${r.drawingPath}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              title="Open Drawing in New Tab"
                            >
                              <Eye className="w-3 h-3" /> View
                            </a>
                            <label className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer" title="Replace Drawing">
                              <Upload className="w-3 h-3" /> Replace
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden onChange={(e) => { handleDirectUpload(r, e.target.files?.[0]); e.target.value = ""; }} />
                            </label>
                          </>
                        ) : (
                          <label className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer" title="Upload Drawing">
                            <Upload className="w-3 h-3" /> Upload
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden onChange={(e) => { handleDirectUpload(r, e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                        )}
                      </div>
                    </TD>
                    <TD center>
                      <TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} />
                    </TD>
                  </tr>
                )) : <EmptyState colSpan={20} message="No materials found. Add or upload your first material." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Single add/edit modal */}
      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add New Material" : "Edit Material"} onClose={closeModal} onSave={handleSave} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SAP Code" required><input value={form.sapCode} onChange={sf("sapCode")} placeholder="e.g. 1124700" className={inputCls} /></Field>
            <Field label="Description" required><input value={form.partName} onChange={sf("partName")} placeholder="e.g. PC OUTER REAR NWHD70H1-HC WHITE" className={inputCls} /></Field>
            <Field label="Category">
              <select value={form.category} onChange={sf("category")} className={selectCls}><option value="">Select</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            </Field>
            <div /> {/* spacer to keep the grid aligned */}
            <Field label="Sheet SAP Code"><input value={form.sheetSapCode} onChange={sf("sheetSapCode")} placeholder="e.g. 1108171" className={inputCls} /></Field>
            <Field label="Sheet Description"><input value={form.sheetDescription} onChange={sf("sheetDescription")} placeholder="e.g. PC WHITE SHEET 536X460" className={inputCls} /></Field>

            {/* Sheet dimensions & weights */}
            <div className="col-span-2 grid grid-cols-3 gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="col-span-3 -mb-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sheet Dimensions &amp; Weights</span>
              </div>
              <Field label="Length" half><input type="number" value={form.length} onChange={sf("length")} placeholder="mm" className={inputCls} min={0} /></Field>
              <Field label="Width" half><input type="number" value={form.width} onChange={sf("width")} placeholder="mm" className={inputCls} min={0} /></Field>
              <Field label="THK" half><input type="number" value={form.thickness} onChange={handleThicknessChange} placeholder="mm" className={inputCls} min={0} /></Field>
              <Field label="Weight" half><input type="number" value={form.weight} onChange={sf("weight")} placeholder="kg" className={inputCls} min={0} /></Field>
              <Field label="Component Weight" half><input type="number" value={form.componentWeight} onChange={sf("componentWeight")} placeholder="kg" className={inputCls} min={0} /></Field>
              <Field label="Scrap Weight" half><input type="number" value={form.scrapWeight} onChange={sf("scrapWeight")} placeholder="kg" className={inputCls} min={0} /></Field>
            </div>

            {/* Sheet-based production (punching: one sheet → multiple components) */}
            <div className="col-span-2 grid grid-cols-2 gap-4 p-3 rounded-lg bg-violet-50/50 border border-violet-100">
              <div className="col-span-2 flex items-center gap-1.5 -mb-1">
                <Info className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">Sheet-Based Production (Punching)</span>
              </div>
              <Field label="No of Sheet" half>
                <input type="number" value={form.noOfSheet} onChange={handleNoOfSheetChange} placeholder="e.g. 1" className={inputCls} min={0} />
                <p className="mt-1 text-[10px] text-slate-400 leading-snug">
                  Auto-filled from THK (≤0.25→3, ≤0.50→2, &gt;0.50→1). Defaults to <strong>1</strong> when left blank — edit to override.
                </p>
              </Field>
              <Field label="No of Component per Sheet" half>
                <input type="number" value={form.actualComponentsPerSheet} onChange={sf("actualComponentsPerSheet")} placeholder="e.g. 2" className={inputCls} min={0} />
              </Field>
              <Field label="Loading/Unloading Time (s)" half>
                <input type="number" value={form.pncLoadingUnloading} onChange={sf("pncLoadingUnloading")} placeholder="e.g. 15" className={inputCls} min={0} />
              </Field>
              <Field label="Defined Component Cycle Time (Secs)" half>
                <input type="number" value={form.definedComponentCycleTime} onChange={sf("definedComponentCycleTime")} placeholder="e.g. 25" className={inputCls} min={0} />
              </Field>
            </div>

            <Field label="Drawing Number"><input value={form.drawingNumber} onChange={sf("drawingNumber")} placeholder="e.g. DWG-001" className={inputCls} /></Field>
            <Field label="Drawing Revision"><input value={form.drawingRevision} onChange={sf("drawingRevision")} placeholder="e.g. Rev B" className={inputCls} /></Field>
          </div>
        </Modal>
      )}

      {/* Bulk upload modal */}
      {showBulk && (
        <BulkUploadModal
          onClose={() => setShowBulk(false)}
          onImport={async (rows) => {
            try {
              await bulkAddMaterials(rows).unwrap();
            } catch (err) {
              toast.error(err?.data?.message || "Bulk import failed.");
            }
          }}
        />
      )}

      {/* Delete-all confirmation */}
      {confirmClear && (
        <ConfirmDeleteAll
          count={data.length}
          onCancel={() => setConfirmClear(false)}
          onConfirm={handleDeleteAll}
        />
      )}
    </div>
  );
};

export default MaterialConfig;
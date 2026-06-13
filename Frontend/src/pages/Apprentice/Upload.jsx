import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import {
  FaCloudUploadAlt, FaFileExcel, FaTimes, FaCheckCircle,
  FaExclamationTriangle, FaEye, FaDatabase, FaArrowRight, FaEnvelope,
} from "react-icons/fa";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Header normaliser (strips spaces, dots, slashes, punctuation) ─────────────
const normalise = (k) =>
  String(k || "").toLowerCase().replace(/[\s_\-\/().,]+/g, "");

// Exact label -> field. Order matters only for the fallback `includes` pass.
// Patterns MUST be pre-normalised (lowercase, no spaces/dots/punctuation),
// because each sheet header is normalised before comparison.
const FIELD_PATTERNS = {
  srNo:           ["srno"],                        // SR NO.
  empCode:        ["empcode", "employeecode", "code"], // EMP. CODE
  labourId:       ["labourid"],                    // LABOUR ID
  email:          ["emailid", "email"],            // Email ID
  mobileNo:       ["mobileno", "mobile", "phoneno", "phone", "contactno", "mobilenumber"], // Mobile No
  category:       ["category"],                    // Category
  empName:        ["empname", "employeename", "name"], // EMP. NAME
  department:     ["dept", "department"],          // DEPT
  location:       ["location"],                    // LOCATION
  doj:            ["dateofjoining", "doj"],        // DATE OF JOINING
  presentDays:    ["pday", "presentday", "presentdays", "pdays"], // P DAY
  lop:            ["lop", "lossofpay"],            // LOP
  otherAllowance: ["otherallowance"],              // OTHER ALLOWANCE
  arrear:         ["arrear"],                      // ARREAR
  companyStipend: ["companystipend"],              // COMPANY STIPEND
  governmentDBT:  ["governmentdbt", "govtdbt", "govdbt", "dbt"], // GOVERNMENT.DBT
  totalStipend:   ["totalstipend"],                // TOTAL STIPEND
  incentive:      ["incentive"],                   // INCENTIVE
  grossAmount:    ["grossamount", "grosspay", "gross"], // GROSS AMOUNT
  canteen:        ["canteen"],                     // CANTEEN
  hostelRent:     ["hostelrent", "hostel"],        // HOSTEL RENT
  electricity:    ["electricity", "elect"],        // ELECTRICITY
  uniform:        ["uniformdeduction", "uniform"], // UNIFORM DEDUCTION
  shoes:          ["shoesdeduction", "shoes"],     // Shoes Deduction
  otherDed:       ["otherded", "otherdeduction"],  // Other Ded.
  netDeduction:   ["netdeduction", "totaldeduction"], // NET DEDUCTION
  netPayment:     ["netpayment", "netpay", "net"], // NET PAYMENT
};

const fmtDate = (v) => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
};

// ── Parser for the two-row merged header WRL apprentice format ─────────────────
const parseMasterSheet = (sheet) => {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  if (!aoa.length) return { rows: [], unmapped: [] };

  // Find the header row (the one carrying "EMP CODE")
  let hr = -1;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const norm = (aoa[i] || []).map(normalise);
    if (norm.some((c) => c === "empcode" || (c.includes("emp") && c.includes("code")))) { hr = i; break; }
  }
  if (hr === -1) hr = 0;

  const row1 = aoa[hr] || [];
  const row2 = aoa[hr + 1] || [];
  const width = Math.max(row1.length, row2.length);

  // Map a labels[] -> { field: colIndex } (exact pass, then loose includes pass)
  const buildMap = (labels) => {
    const cbf = {}; const used = new Set();
    for (const [field, pats] of Object.entries(FIELD_PATTERNS)) {
      const idx = labels.findIndex((l, i) => !used.has(i) && pats.includes(l));
      if (idx >= 0) { cbf[field] = idx; used.add(idx); }
    }
    for (const [field, pats] of Object.entries(FIELD_PATTERNS)) {
      if (cbf[field] != null) continue;
      const idx = labels.findIndex((l, i) => !used.has(i) && l && pats.some((p) => l.includes(p)));
      if (idx >= 0) { cbf[field] = idx; used.add(idx); }
    }
    return cbf;
  };

  const required = ["empCode", "empName", "grossAmount", "netPayment"];
  const hit = (cbf) => required.filter((f) => cbf[f] != null).length;

  // Attempt A: single-row header (labels = row1 only) -> data starts at hr+1
  const labelsSingle = row1.map(normalise);
  let colByField = buildMap(labelsSingle);
  let dataStart = hr + 1;

  // Attempt B: two-row merged header (sub-header wins, else top) -> data at hr+2
  if (hit(colByField) < required.length) {
    const labelsMerged = [];
    for (let c = 0; c < width; c++) {
      const sub = row2[c] != null && String(row2[c]).trim() !== "" ? row2[c] : null;
      const top = row1[c] != null && String(row1[c]).trim() !== "" ? row1[c] : null;
      labelsMerged[c] = normalise(sub || top || "");
    }
    const merged = buildMap(labelsMerged);
    if (hit(merged) > hit(colByField)) { colByField = merged; dataStart = hr + 2; }
  }

  const at  = (arr, f) => (colByField[f] != null ? arr[colByField[f]] : null);
  const num = (arr, f) => { const v = parseFloat(at(arr, f)); return isNaN(v) ? 0 : v; };
  const str = (arr, f) => String(at(arr, f) ?? "").trim();

  const rows = [];
  for (let r = dataStart; r < aoa.length; r++) {
    const arr = aoa[r] || [];
    const empCode = str(arr, "empCode");
    if (!empCode) continue;

    const companyStipend = num(arr, "companyStipend");
    const governmentDBT  = num(arr, "governmentDBT");
    const otherAllowance = num(arr, "otherAllowance");
    const arrear         = num(arr, "arrear");
    const incentive      = num(arr, "incentive");
    const totalStipend = num(arr, "totalStipend") || (companyStipend + governmentDBT);
    const grossAmount  = num(arr, "grossAmount") || (otherAllowance + arrear + totalStipend + incentive);

    const canteen     = num(arr, "canteen");
    const hostelRent  = num(arr, "hostelRent");
    const electricity = num(arr, "electricity");
    const uniform     = num(arr, "uniform");
    const shoes       = num(arr, "shoes");
    const otherDed    = num(arr, "otherDed");
    const netDeduction = num(arr, "netDeduction") ||
      (canteen + hostelRent + electricity + uniform + shoes + otherDed);

    const netPayment = num(arr, "netPayment") || (grossAmount - netDeduction);

    rows.push({
      srNo: num(arr, "srNo"),
      empCode: empCode.toUpperCase(),
      labourId: str(arr, "labourId"),
      email: str(arr, "email").toLowerCase(),
      mobileNo: str(arr, "mobileNo").replace(/\D/g, ""),
      category: str(arr, "category"),
      empName: str(arr, "empName"),
      department: str(arr, "department"),
      location: str(arr, "location"),
      doj: fmtDate(at(arr, "doj")),
      presentDays: num(arr, "presentDays"),
      lop: num(arr, "lop"),
      otherAllowance, arrear, companyStipend, governmentDBT,
      totalStipend, incentive, grossAmount,
      canteen, hostelRent, electricity, uniform, shoes, otherDed,
      netDeduction, netPayment,
    });
  }

  const unmapped = required.filter((f) => colByField[f] == null);
  return { rows, unmapped };
};

// ── Drop Zone ─────────────────────────────────────────────────────────────────
const DropZone = ({ label, file, onFile, accept = ".xlsx,.xls,.csv", icon: Icon }) => {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const handle = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { toast.error("Upload Excel or CSV file only"); return; }
    onFile(f);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => !file && ref.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
        ${drag ? "border-indigo-400 bg-indigo-50" : file ? "border-green-400 bg-green-50 cursor-default" : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
    >
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => handle(e.target.files[0])} />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <FaCheckCircle className="text-green-500 text-3xl flex-shrink-0" />
          <div className="text-left">
            <p className="font-bold text-green-700 text-sm">{file.name}</p>
            <p className="text-green-600 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      ) : (
        <div>
          <Icon className="text-5xl text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-600 text-sm">{label}</p>
          <p className="text-xs text-gray-400 mt-1">Drag &amp; drop or click to browse</p>
          <p className="text-[10px] text-gray-300 mt-1">.xlsx / .xls / .csv</p>
        </div>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const Upload = () => {
  const { user } = useSelector((s) => s.auth);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const [file,   setFile]   = useState(null);
  const [rows,   setRows]   = useState([]);
  const [step,   setStep]   = useState(1);          // 1=upload 2=preview 3=done
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const parseFile = useCallback((f) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const { rows: parsed, unmapped } = parseMasterSheet(sheet);
        if (unmapped.length) {
          toast.error(`Could not find columns: ${unmapped.join(", ")}`);
          return;
        }
        if (!parsed.length) { toast.error("No employee rows found in the sheet"); return; }
        setRows(parsed);
        toast.success(`Parsed ${parsed.length} apprentice records`);
      } catch (err) {
        toast.error("Failed to read Excel file");
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const handleFile = (f) => { setFile(f); parseFile(f); };
  const clearFile  = () => { setFile(null); setRows([]); };

  const handlePreview = () => {
    if (!rows.length) { toast.error("Upload the salary master file first"); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!rows.length) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${baseURL}apprentice/upload`, {
        month, year, slips: rows,
        uploadedBy: user?.name || user?.userCode || "HR",
      });
      setResult(res.data);
      setStep(3);
      toast.success(`Upload complete: ${res.data.ok} records saved`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { clearFile(); setStep(1); setResult(null); };

  const noEmail = rows.filter((r) => !r.email).length;
  const totalNet = rows.reduce((s, r) => s + (r.netPayment || 0), 0);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><FaCloudUploadAlt className="text-emerald-600 text-xl" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">Upload Apprentice Salary File</h1>
              <p className="text-xs text-gray-400 mt-0.5">Upload the monthly pay-slip Excel to generate & e-mail slips</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[["1","Upload File"],["2","Preview"],["3","Done"]].map(([n, label], i) => (
              <div key={n} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black
                  ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>{n}</div>
                <span className={`text-xs font-semibold hidden sm:block ${step === i + 1 ? "text-indigo-600" : "text-gray-400"}`}>{label}</span>
                {i < 2 && <FaArrowRight size={9} className="text-gray-300" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Salary Period</p>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Month</label>
                  <select value={month} onChange={(e) => setMonth(+e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white min-w-[160px]">
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Year</label>
                  <select value={year} onChange={(e) => setYear(+e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <FaFileExcel className="text-green-600 text-lg" />
                <div>
                  <p className="text-sm font-black text-gray-800">Pay-Slip Master (single file)</p>
                  <p className="text-xs text-gray-400">EmpCode, Email, P Day, LOP, Stipend, Incentive, Deductions, Net Payment…</p>
                </div>
              </div>
              <DropZone label="Drop Pay-Slip Master Excel here" file={file} onFile={handleFile} icon={FaFileExcel} />
              {rows.length > 0 && (
                <div className="mt-3 px-3 py-2 bg-green-50 rounded-xl border border-green-200 flex items-center gap-2">
                  <FaCheckCircle className="text-green-500" size={12} />
                  <span className="text-xs font-semibold text-green-700">{rows.length} apprentices parsed</span>
                  {noEmail > 0 && <span className="text-xs font-semibold text-amber-600 ml-2">• {noEmail} missing e-mail</span>}
                  <button onClick={clearFile} className="ml-auto text-gray-400 hover:text-red-500"><FaTimes size={11} /></button>
                </div>
              )}
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <p className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-2">Expected Columns (WRL Apprentice Pay-Slip Format)</p>
              <p className="text-[11px] text-indigo-600 leading-relaxed">
                SR NO. • EMP. CODE • LABOUR ID • Email ID • Category • EMP. NAME • DEPT • LOCATION • DATE OF JOINING • P DAY • LOP •
                <span className="font-bold"> Earnings:</span> Other Allowance, Arrear, Company Stipend, Government DBT, Total Stipend, Incentive, Gross Amount •
                <span className="font-bold"> Deductions:</span> Canteen, Hostel Rent, Electricity, Uniform, Shoes, Other Ded., Net Deduction • NET PAYMENT
              </p>
              <p className="text-[10px] text-indigo-400 mt-2">The two-row merged header is handled automatically.</p>
            </div>

            <div className="flex justify-end">
              <button onClick={handlePreview} disabled={!rows.length}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200 disabled:opacity-40">
                <FaEye size={13} /> Preview
              </button>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Apprentices", val: rows.length, color: "text-indigo-700", bg: "bg-indigo-50" },
                { label: "With E-mail", val: rows.length - noEmail, color: "text-green-700", bg: "bg-green-50" },
                { label: "Missing E-mail", val: noEmail, color: noEmail > 0 ? "text-amber-700" : "text-gray-500", bg: noEmail > 0 ? "bg-amber-50" : "bg-gray-50" },
                { label: "Total Net Payment", val: `₹${totalNet.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-emerald-700", bg: "bg-emerald-50" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} className={`${bg} rounded-2xl border border-gray-100 p-4 text-center`}>
                  <p className={`text-2xl font-black ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {noEmail > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-700">{noEmail} apprentices have no e-mail address</p>
                  <p className="text-xs text-amber-600 mt-0.5">Their slips will still be saved, but cannot be mailed until an address is added.</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <FaDatabase className="text-indigo-400 text-base" />
                <span className="text-sm font-black text-gray-800">Parsed Data Preview — {MONTHS[month-1]} {year}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {["Code","Name","Dept","Category","P Day","LOP","Stipend","Incentive","Gross","Net Ded.","Net Pay","E-mail","Mobile"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r, i) => (
                      <tr key={r.empCode + i} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} ${!r.email ? "bg-amber-50/50" : ""}`}>
                        <td className="px-3 py-2 font-mono text-gray-700 font-semibold">{r.empCode}</td>
                        <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.empName}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap max-w-[120px] truncate">{r.department}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.category}</td>
                        <td className="px-3 py-2 font-bold text-green-700 text-center">{r.presentDays}</td>
                        <td className="px-3 py-2 text-center text-red-600">{r.lop}</td>
                        <td className="px-3 py-2 text-right text-gray-700">₹{(r.totalStipend||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right text-gray-700">₹{(r.incentive||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">₹{(r.grossAmount||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right text-red-600">₹{(r.netDeduction||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right font-black text-emerald-700">₹{(r.netPayment||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-center">
                          {r.email
                            ? <FaCheckCircle className="text-green-500 mx-auto" size={11} />
                            : <FaExclamationTriangle className="text-amber-400 mx-auto" size={11} />}
                        </td>
                        <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">{r.mobileNo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button onClick={reset} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold transition">← Start Over</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-50">
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  : <><FaDatabase size={13} /> Save {rows.length} Salary Slips</>}
              </button>
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && result && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
            <FaCheckCircle className="text-emerald-500 text-6xl mx-auto mb-5" />
            <h2 className="text-2xl font-black text-gray-800 mb-2">Upload Complete!</h2>
            <p className="text-gray-500 mb-6">{MONTHS[month-1]} {year} salary data has been saved.</p>
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="text-3xl font-black text-green-700">{result.ok}</p>
                <p className="text-xs text-green-600 font-semibold">Saved</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="text-3xl font-black text-red-600">{result.failed}</p>
                <p className="text-xs text-red-500 font-semibold">Failed</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                <p className="text-3xl font-black text-indigo-700">#{result.batchId}</p>
                <p className="text-xs text-indigo-600 font-semibold">Batch ID</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={reset} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition">Upload Another</button>
              <a href="/apprentice/slips" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200">
                <FaEnvelope size={12} /> View &amp; E-mail Slips →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
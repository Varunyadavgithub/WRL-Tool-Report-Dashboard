import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import {
  FaCloudUploadAlt, FaFileExcel, FaTimes, FaCheckCircle,
  FaExclamationTriangle, FaEye, FaDatabase, FaArrowRight,
} from "react-icons/fa";
import { MdMergeType } from "react-icons/md";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Excel parsers ─────────────────────────────────────────────────────────────
const normalise = (k) => String(k || "").toLowerCase().replace(/[\s_\-\/\(\)]+/g, "");

const COL_SALARY = {
  empcode:      ["empcode","employeecode","empid","code"],
  empname:      ["empname","employeename","name"],
  department:   ["department","dept"],
  category:     ["category","designation","grade"],
  stipend:      ["stipend","basicpay","basic"],
  otamount:     ["otamount","overtime","ot"],
  bonus:        ["bonus"],
  incentive:    ["incentive"],
  grosspay:     ["grosspay","gross"],
  hostel:       ["hostel"],
  canteen:      ["canteen"],
  electricity:  ["electricity","elect"],
  uniform:      ["uniform"],
  shoes:        ["shoes"],
  otherdeductions:["other","otherdeduction"],
  totaldeductions:["totaldeduction","totalded","deduction"],
  netpay:       ["netpay","net"],
  bankaccount:  ["bankaccount","bank","accountno"],
  uan:          ["uan","pfno"],
};

const COL_ATTEND = {
  empcode:      ["empcode","employeecode","empid","code"],
  presentdays:  ["presentdays","present","pdays"],
  weeklyoff:    ["weeklyoff","wo","weekly"],
  halfdays:     ["halfdays","hd","half"],
  absentdays:   ["absentdays","absent","adays"],
  othours:      ["othours","ot","overtimehours"],
};

const matchCol = (header, mapEntry) => mapEntry.some((v) => normalise(header).includes(v));

const parseSalarySheet = (sheet) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);

  const colMap = {};
  for (const [field, patterns] of Object.entries(COL_SALARY)) {
    colMap[field] = headers.find((h) => matchCol(h, patterns)) || null;
  }

  return rows
    .filter((r) => r[colMap.empcode])
    .map((r) => {
      const get = (f) => colMap[f] ? r[colMap[f]] : "";
      const num = (f) => { const v = parseFloat(get(f)); return isNaN(v) ? 0 : v; };
      const gross = num("grosspay") || (num("stipend") + num("otamount") + num("bonus") + num("incentive"));
      const totalDed = num("totaldeductions") || (num("hostel") + num("canteen") + num("electricity") + num("uniform") + num("shoes") + num("otherdeductions"));
      const net = num("netpay") || (gross - totalDed);
      return {
        empCode:        String(get("empcode")).trim().toUpperCase(),
        empName:        String(get("empname")).trim(),
        department:     String(get("department")).trim(),
        category:       String(get("category")).trim(),
        stipend:        num("stipend"),
        otAmount:       num("otamount"),
        bonus:          num("bonus"),
        incentive:      num("incentive"),
        grossPay:       gross,
        hostel:         num("hostel"),
        canteen:        num("canteen"),
        electricity:    num("electricity"),
        uniform:        num("uniform"),
        shoes:          num("shoes"),
        otherDeductions:num("otherdeductions"),
        totalDeductions:totalDed,
        netPay:         net,
        bankAccount:    String(get("bankaccount")).trim(),
        uan:            String(get("uan")).trim(),
        _raw:           r,
      };
    });
};

const parseDayWise = (headers, row) => {
  const days = {};
  headers.forEach((h) => {
    const n = parseInt(h);
    if (n >= 1 && n <= 31) {
      const v = String(row[h] || "").trim().toUpperCase();
      if (v) days[n] = v;
    }
  });
  return Object.keys(days).length ? days : null;
};

const parseAttendSheet = (sheet) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);

  const colMap = {};
  for (const [field, patterns] of Object.entries(COL_ATTEND)) {
    colMap[field] = headers.find((h) => matchCol(h, patterns)) || null;
  }

  return rows
    .filter((r) => r[colMap.empcode])
    .map((r) => {
      const get = (f) => colMap[f] ? r[colMap[f]] : "";
      const num = (f) => { const v = parseFloat(get(f)); return isNaN(v) ? 0 : v; };

      // Auto-calculate from day-wise if summary cols missing
      const dayWise = parseDayWise(headers, r);
      let calcP = 0, calcWO = 0, calcHD = 0, calcA = 0;
      if (dayWise) {
        Object.values(dayWise).forEach((v) => {
          if (v === "P") calcP++;
          else if (v === "WO") calcWO++;
          else if (v === "HD") { calcHD++; calcP += 0.5; }
          else if (v === "A") calcA++;
        });
      }

      return {
        empCode:     String(get("empcode")).trim().toUpperCase(),
        presentDays: num("presentdays") || calcP,
        weeklyOff:   parseInt(get("weeklyoff")) || calcWO,
        halfDays:    num("halfdays") || calcHD,
        absentDays:  num("absentdays") || calcA,
        otHours:     num("othours"),
        dayWiseData: dayWise,
      };
    });
};

const mergeData = (salaryRows, attendRows) => {
  const attendMap = {};
  attendRows.forEach((r) => { attendMap[r.empCode] = r; });

  return salaryRows.map((s) => {
    const a = attendMap[s.empCode] || {};
    return {
      ...s,
      presentDays: a.presentDays ?? 0,
      weeklyOff:   a.weeklyOff  ?? 0,
      halfDays:    a.halfDays   ?? 0,
      absentDays:  a.absentDays ?? 0,
      otHours:     a.otHours    ?? 0,
      dayWiseData: a.dayWiseData ?? null,
      _hasAttend:  !!attendMap[s.empCode],
    };
  });
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
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
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
          <Icon className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-600 text-sm">{label}</p>
          <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse</p>
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

  const [salaryFile,  setSalaryFile]  = useState(null);
  const [attendFile,  setAttendFile]  = useState(null);
  const [salaryRows,  setSalaryRows]  = useState([]);
  const [attendRows,  setAttendRows]  = useState([]);
  const [merged,      setMerged]      = useState([]);
  const [step,        setStep]        = useState(1); // 1=upload 2=preview 3=done
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState(null);

  const parseFile = useCallback((file, type) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (type === "salary") {
        const rows = parseSalarySheet(sheet);
        setSalaryRows(rows);
        toast.success(`Parsed ${rows.length} salary rows`);
      } else {
        const rows = parseAttendSheet(sheet);
        setAttendRows(rows);
        toast.success(`Parsed ${rows.length} attendance rows`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleSalaryFile = (f) => { setSalaryFile(f); parseFile(f, "salary"); };
  const handleAttendFile = (f) => { setAttendFile(f); parseFile(f, "attend"); };

  const handlePreview = () => {
    if (!salaryRows.length) { toast.error("Upload salary master file first"); return; }
    const m = mergeData(salaryRows, attendRows);
    setMerged(m);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!merged.length) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${baseURL}apprentice/upload`, {
        month, year, slips: merged,
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

  const reset = () => {
    setSalaryFile(null); setAttendFile(null);
    setSalaryRows([]); setAttendRows([]); setMerged([]);
    setStep(1); setResult(null);
  };

  const noAttend = merged.filter((r) => !r._hasAttend).length;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><FaCloudUploadAlt className="text-emerald-600 text-xl" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">Upload Salary Files</h1>
              <p className="text-xs text-gray-400 mt-0.5">Upload Excel files to auto-generate salary slips</p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[["1","Upload Files"],["2","Preview & Merge"],["3","Done"]].map(([n, label], i) => (
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

        {/* STEP 1: Upload */}
        {step === 1 && (
          <>
            {/* Month / Year */}
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

            {/* File uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FaFileExcel className="text-green-600 text-lg" />
                  <div>
                    <p className="text-sm font-black text-gray-800">Salary Slip Master</p>
                    <p className="text-xs text-gray-400">EmpCode, Name, Stipend, Deductions, Net Pay…</p>
                  </div>
                </div>
                <DropZone label="Drop Salary Master Excel here" file={salaryFile} onFile={handleSalaryFile} icon={FaFileExcel} />
                {salaryRows.length > 0 && (
                  <div className="mt-3 px-3 py-2 bg-green-50 rounded-xl border border-green-200 flex items-center gap-2">
                    <FaCheckCircle className="text-green-500" size={12} />
                    <span className="text-xs font-semibold text-green-700">{salaryRows.length} employees parsed</span>
                    {salaryFile && <button onClick={() => { setSalaryFile(null); setSalaryRows([]); }} className="ml-auto text-gray-400 hover:text-red-500"><FaTimes size={11} /></button>}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FaFileExcel className="text-blue-600 text-lg" />
                  <div>
                    <p className="text-sm font-black text-gray-800">Attendance & OT Statement</p>
                    <p className="text-xs text-gray-400">Day-wise P/A/WO, OT Hours, Present Days…</p>
                  </div>
                </div>
                <DropZone label="Drop Attendance Excel here" file={attendFile} onFile={handleAttendFile} icon={FaFileExcel} />
                {attendRows.length > 0 && (
                  <div className="mt-3 px-3 py-2 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-2">
                    <FaCheckCircle className="text-blue-500" size={12} />
                    <span className="text-xs font-semibold text-blue-700">{attendRows.length} attendance rows parsed</span>
                    {attendFile && <button onClick={() => { setAttendFile(null); setAttendRows([]); }} className="ml-auto text-gray-400 hover:text-red-500"><FaTimes size={11} /></button>}
                  </div>
                )}
              </div>
            </div>

            {/* Column mapping hints */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <p className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-2">Expected Column Names</p>
              <div className="grid grid-cols-2 gap-4 text-[10px] text-indigo-600">
                <div>
                  <p className="font-bold mb-1">Salary Master:</p>
                  <p>EmpCode/EmployeeCode • EmpName • Department • Category • Stipend • OT Amount • Bonus • Gross Pay • Hostel • Canteen • Electricity • Uniform • Shoes • Other • Net Pay</p>
                </div>
                <div>
                  <p className="font-bold mb-1">Attendance:</p>
                  <p>EmpCode • 1-31 (P/A/WO/HD) • Present Days • Weekly Off • Half Days • Absent Days • OT Hours</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handlePreview} disabled={!salaryRows.length}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200 disabled:opacity-40">
                <FaEye size={13} /> Preview & Merge
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Preview */}
        {step === 2 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Employees", val: merged.length, color: "text-indigo-700", bg: "bg-indigo-50" },
                { label: "With Attendance", val: merged.filter((r) => r._hasAttend).length, color: "text-green-700", bg: "bg-green-50" },
                { label: "Missing Attendance", val: noAttend, color: noAttend > 0 ? "text-amber-700" : "text-gray-500", bg: noAttend > 0 ? "bg-amber-50" : "bg-gray-50" },
                { label: "Total Net Pay", val: `₹${merged.reduce((s, r) => s + (r.netPay || 0), 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-emerald-700", bg: "bg-emerald-50" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} className={`${bg} rounded-2xl border border-gray-100 p-4 text-center`}>
                  <p className={`text-2xl font-black ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {noAttend > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-700">{noAttend} employees have no attendance data</p>
                  <p className="text-xs text-amber-600 mt-0.5">Attendance values will default to 0. You can still proceed.</p>
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <MdMergeType className="text-indigo-400 text-lg" />
                <span className="text-sm font-black text-gray-800">Merged Data Preview — {MONTHS[month-1]} {year}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {["Code","Name","Dept","P","WO","HD","A","OT Hrs","Stipend","OT Amt","Gross","Deductions","Net Pay","Attend?"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {merged.map((r, i) => (
                      <tr key={r.empCode} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} ${!r._hasAttend ? "bg-amber-50/50" : ""}`}>
                        <td className="px-3 py-2 font-mono text-gray-700 font-semibold">{r.empCode}</td>
                        <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.empName}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap max-w-[100px] truncate">{r.department}</td>
                        <td className="px-3 py-2 font-bold text-green-700 text-center">{r.presentDays}</td>
                        <td className="px-3 py-2 text-center text-blue-600">{r.weeklyOff}</td>
                        <td className="px-3 py-2 text-center text-yellow-600">{r.halfDays}</td>
                        <td className="px-3 py-2 text-center text-red-600">{r.absentDays}</td>
                        <td className="px-3 py-2 text-center text-purple-600">{r.otHours}</td>
                        <td className="px-3 py-2 text-right text-gray-700">₹{(r.stipend||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right text-gray-700">₹{(r.otAmount||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">₹{(r.grossPay||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right text-red-600">₹{(r.totalDeductions||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right font-black text-emerald-700">₹{(r.netPay||0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-center">
                          {r._hasAttend
                            ? <FaCheckCircle className="text-green-500 mx-auto" size={11} />
                            : <FaExclamationTriangle className="text-amber-400 mx-auto" size={11} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button onClick={reset} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold transition">
                ← Start Over
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-50">
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  : <><FaDatabase size={13} /> Save {merged.length} Salary Slips</>}
              </button>
            </div>
          </>
        )}

        {/* STEP 3: Done */}
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
              <button onClick={reset} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition">
                Upload Another
              </button>
              <a href="/apprentice/slips" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200">
                View Salary Slips →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;

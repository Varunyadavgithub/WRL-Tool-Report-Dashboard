import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

// ─── Fixed shift options ───────────────────────────────────────────────────
const SHIFTS = [
  { id: "s1", label: "08:00 – 14:30", from: "08:00", to: "14:30" },
  { id: "s2", label: "08:00 – 18:00", from: "08:00", to: "18:00" },
  { id: "s3", label: "08:00 – 20:00", from: "08:00", to: "20:00" },
];

// ─── Default per-shift counts ──────────────────────────────────────────────
const defaultShiftCounts = () =>
  SHIFTS.reduce((acc, s) => ({
    ...acc,
    [s.id]: { approvedDET: 0, approvedITI: 0, approvedCASUAL: 0,
               actualDET:   0, actualITI:   0, actualCASUAL:   0 },
  }), {});

const ManpowerForm = () => {
  const [departments, setDepartments] = useState([]);
  const [shiftCounts, setShiftCounts] = useState(defaultShiftCounts());

  const [employees, setEmployees] = useState([
    { empCode: "", empName: "", category: "", location: "", contactNo: "", travellingBy: "" },
  ]);

  const [form, setForm] = useState({
    departmentId:    "",
    departmentName:  "",
    hodName:         "",
    hodEmail:        "",
    requiredDate:    "",
    requiredDay:     "",
    overtimeFrom:    "",
    overtimeTo:      "",
    overtimeTotal:   0,
    responsibleStaff: "",
    justification:   "",
    reverification:  "",
  });

  // ── Load Departments ───────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${baseURL}manpower/departments`)
      .then((res) => setDepartments(res.data.data))
      .catch(() => toast.error("Failed to load departments"));
  }, []);

  // ── Auto Day from Date ─────────────────────────────────────────────────
  useEffect(() => {
    if (form.requiredDate) {
      const day = new Date(form.requiredDate).toLocaleDateString("en-IN", { weekday: "long" });
      setForm((prev) => ({ ...prev, requiredDay: day }));
    }
  }, [form.requiredDate]);

  // ── Per-shift derived values ───────────────────────────────────────────
  const shiftDerived = SHIFTS.map((shift) => {
    const c = shiftCounts[shift.id];
    const addDET    = Math.max(0, +c.actualDET    - +c.approvedDET);
    const addITI    = Math.max(0, +c.actualITI    - +c.approvedITI);
    const addCASUAL = Math.max(0, +c.actualCASUAL - +c.approvedCASUAL);
    return {
      ...shift,
      ...c,
      additionalDET:    addDET,
      additionalITI:    addITI,
      additionalCASUAL: addCASUAL,
      approvedTotal:    +c.approvedDET  + +c.approvedITI  + +c.approvedCASUAL,
      actualTotal:      +c.actualDET    + +c.actualITI    + +c.actualCASUAL,
      additionalTotal:  addDET + addITI + addCASUAL,
    };
  });

  // ── Grand totals across all shifts ────────────────────────────────────
  const grand = {
    approvedDET:    shiftDerived.reduce((s, r) => s + +r.approvedDET,    0),
    approvedITI:    shiftDerived.reduce((s, r) => s + +r.approvedITI,    0),
    approvedCASUAL: shiftDerived.reduce((s, r) => s + +r.approvedCASUAL, 0),
    approvedTotal:  shiftDerived.reduce((s, r) => s + r.approvedTotal,   0),
    actualDET:      shiftDerived.reduce((s, r) => s + +r.actualDET,      0),
    actualITI:      shiftDerived.reduce((s, r) => s + +r.actualITI,      0),
    actualCASUAL:   shiftDerived.reduce((s, r) => s + +r.actualCASUAL,   0),
    actualTotal:    shiftDerived.reduce((s, r) => s + r.actualTotal,     0),
    additionalDET:    shiftDerived.reduce((s, r) => s + r.additionalDET,    0),
    additionalITI:    shiftDerived.reduce((s, r) => s + r.additionalITI,    0),
    additionalCASUAL: shiftDerived.reduce((s, r) => s + r.additionalCASUAL, 0),
    additionalTotal:  shiftDerived.reduce((s, r) => s + r.additionalTotal,  0),
  };
  const totalManpower = grand.actualTotal + grand.additionalTotal;

  // ── Overtime Calculation ───────────────────────────────────────────────
  useEffect(() => {
    if (form.overtimeFrom && form.overtimeTo) {
      const from = new Date(`2024-01-01T${form.overtimeFrom}`);
      const to   = new Date(`2024-01-01T${form.overtimeTo}`);
      let diff = (to - from) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;
      setForm((prev) => ({
        ...prev,
        overtimeTotal: Number((diff * totalManpower).toFixed(2)),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.overtimeFrom, form.overtimeTo, totalManpower]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleShiftCount = (shiftId, field, value) =>
    setShiftCounts((prev) => ({
      ...prev,
      [shiftId]: { ...prev[shiftId], [field]: value },
    }));

  const handleDepartmentChange = (id) => {
    const selected = departments.find((d) => d.id === Number(id));
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      departmentId:   selected.id,
      departmentName: selected.department_name,
      hodName:        selected.name,
      hodEmail:       selected.employee_email,
    }));
  };

  const addEmployeeRow = () =>
    setEmployees([...employees, { empCode: "", empName: "", category: "", location: "", contactNo: "", travellingBy: "" }]);

  const removeEmployeeRow = (index) => {
    if (employees.length === 1) return;
    setEmployees(employees.filter((_, i) => i !== index));
  };

  const handleEmployeeChange = (index, field, value) => {
    const updated = [...employees];
    updated[index][field] = value;
    setEmployees(updated);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.departmentId) { toast.error("Please select a department"); return; }
    if (!form.requiredDate)  { toast.error("Please select a required date"); return; }

    try {
      const res = await axios.post(
        `${baseURL}manpower/create`,
        {
          ...form,
          shiftCounts: shiftDerived,   // full per-shift breakdown
          grand,                        // grand totals
          totalManpower,
          employees,
        },
        { responseType: "blob" }
      );

      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", "Manpower_Request.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF Generated Successfully");
    } catch {
      toast.error("Submission Failed");
    }
  };

  // ── Cell helpers ───────────────────────────────────────────────────────
  const InputCell = ({ shiftId, field }) => (
    <input
      type="number"
      min="0"
      className="border rounded-lg p-2 text-center w-16 focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
      value={shiftCounts[shiftId][field]}
      onChange={(e) => handleShiftCount(shiftId, field, e.target.value)}
    />
  );

  const ReadCell = ({ value, highlight }) => (
    <div className={`inline-block min-w-[52px] border rounded-lg px-2 py-2 font-bold text-sm text-center
      ${highlight && value > 0
        ? "bg-rose-50 border-rose-200 text-rose-700"
        : "bg-gray-50 border-gray-200 text-gray-400"}`}>
      {value}
    </div>
  );

  const TotalCell = ({ value, bg }) => (
    <div className={`inline-block min-w-[52px] border rounded-lg px-2 py-2 font-bold text-sm text-center ${bg}`}>
      {value}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl p-10">

        {/* HEADER */}
        <div className="text-center border-b pb-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Western Refrigeration Pvt. Ltd.</h1>
          <p className="text-gray-600 mt-1">Manpower Approval Request Form</p>
        </div>

        {/* BASIC DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div>
            <label className="text-sm font-semibold text-gray-600">Department Name</label>
            <select
              className="w-full border rounded-lg p-3 mt-1 focus:ring-2 focus:ring-blue-500"
              value={form.departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.department_name} ({dept.deptCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">HOD Name</label>
            <input className="w-full border rounded-lg p-3 mt-1 bg-gray-100" value={form.hodName} readOnly />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">HOD Email</label>
            <input className="w-full border rounded-lg p-3 mt-1 bg-gray-100" value={form.hodEmail} readOnly />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">Required Date</label>
            <input
              type="date"
              required
              className="w-full border rounded-lg p-3 mt-1 focus:ring-2 focus:ring-blue-500"
              value={form.requiredDate}
              onChange={(e) => handleChange("requiredDate", e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">Day</label>
            <input className="w-full border rounded-lg p-3 mt-1 bg-gray-100" value={form.requiredDay} readOnly />
          </div>
        </div>

        {/* ── MANPOWER HEADCOUNT ── */}
        <div className="bg-blue-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold mb-5 text-blue-800">Manpower Head Count</h3>

          {/* 3 shift cards side by side */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {shiftDerived.map((s) => (
              <div key={s.id} className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">

                {/* Shift header */}
                <div className="bg-blue-600 text-white text-center py-2.5 px-3">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-70">Shift</p>
                  <p className="text-sm font-bold">{s.label}</p>
                </div>

                {/* Mini table inside each card */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide"></th>
                      <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-500">DET</th>
                      <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-500">ITI</th>
                      <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-500">CASUAL</th>
                      <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">

                    {/* Approved */}
                    <tr className="bg-emerald-50/40">
                      <td className="px-3 py-2.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">Approved</td>
                      {["approvedDET","approvedITI","approvedCASUAL"].map((field) => (
                        <td key={field} className="px-2 py-2 text-center">
                          <input
                            type="number" min="0"
                            className="border border-gray-200 rounded-lg p-1.5 text-center w-14 text-sm focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                            value={shiftCounts[s.id][field]}
                            onChange={(e) => handleShiftCount(s.id, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <span className="inline-block min-w-[40px] bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg px-2 py-1.5 text-sm font-bold">
                          {s.approvedTotal}
                        </span>
                      </td>
                    </tr>

                    {/* Actual */}
                    <tr className="bg-amber-50/40">
                      <td className="px-3 py-2.5 text-xs font-semibold text-amber-700 whitespace-nowrap">Actual</td>
                      {["actualDET","actualITI","actualCASUAL"].map((field) => (
                        <td key={field} className="px-2 py-2 text-center">
                          <input
                            type="number" min="0"
                            className="border border-gray-200 rounded-lg p-1.5 text-center w-14 text-sm focus:ring-2 focus:ring-amber-300 focus:outline-none"
                            value={shiftCounts[s.id][field]}
                            onChange={(e) => handleShiftCount(s.id, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <span className="inline-block min-w-[40px] bg-amber-100 text-amber-800 border border-amber-200 rounded-lg px-2 py-1.5 text-sm font-bold">
                          {s.actualTotal}
                        </span>
                      </td>
                    </tr>

                    {/* Additional (auto) */}
                    <tr className="bg-rose-50/40">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-rose-600">Additional</span>
                        <span className="ml-1 text-[9px] text-gray-400 italic">auto</span>
                      </td>
                      {[s.additionalDET, s.additionalITI, s.additionalCASUAL].map((val, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          <span className={`inline-block min-w-[40px] border rounded-lg px-2 py-1.5 text-sm font-bold
                            ${val > 0 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                            {val}
                          </span>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-block min-w-[40px] border rounded-lg px-2 py-1.5 text-sm font-bold
                          ${s.additionalTotal > 0 ? "bg-rose-100 border-rose-300 text-rose-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                          {s.additionalTotal}
                        </span>
                      </td>
                    </tr>

                  </tbody>
                </table>

                {/* Per-shift shortage tag */}
                {s.additionalTotal > 0 && (
                  <div className="px-3 py-2 bg-rose-50 border-t border-rose-100 text-xs text-rose-600 font-medium">
                    ⚠ +{s.additionalTotal} additional needed
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── GRAND TOTALS ROW ── */}
          <div className="bg-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between">
              <p className="text-sm font-bold">Grand Total — All Shifts</p>
              <p className="text-xs opacity-75">Sum of all 3 shifts</p>
            </div>

            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {[
                { label: "Approved",   det: grand.approvedDET,    iti: grand.approvedITI,    cas: grand.approvedCASUAL,    total: grand.approvedTotal,    totalBg: "bg-emerald-100 text-emerald-800 border-emerald-300" },
                { label: "Actual",     det: grand.actualDET,      iti: grand.actualITI,      cas: grand.actualCASUAL,      total: grand.actualTotal,      totalBg: "bg-amber-100 text-amber-800 border-amber-300" },
                { label: "Additional", det: grand.additionalDET,  iti: grand.additionalITI,  cas: grand.additionalCASUAL,  total: grand.additionalTotal,  totalBg: grand.additionalTotal > 0 ? "bg-rose-100 text-rose-700 border-rose-300" : "bg-gray-100 text-gray-400 border-gray-200" },
                { label: "Total MP",   det: null,                  iti: null,                 cas: null,                    total: totalManpower,          totalBg: "bg-indigo-100 text-indigo-800 border-indigo-300" },
              ].map((col) => (
                <div key={col.label} className="px-4 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2">{col.label}</p>
                  {col.det !== null ? (
                    <div className="space-y-1 mb-2">
                      {[["DET", col.det], ["ITI", col.iti], ["CAS", col.cas]].map(([lbl, val]) => (
                        <div key={lbl} className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-gray-400 font-medium">{lbl}</span>
                          <span className="text-sm font-bold text-gray-700">{val}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-16 flex items-center justify-center">
                      <span className="text-3xl font-black text-indigo-600">{totalManpower}</span>
                    </div>
                  )}
                  <div className={`border rounded-lg px-3 py-1.5 font-bold text-sm ${col.totalBg}`}>
                    {col.total}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shortage alert */}
          {grand.additionalTotal > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-rose-500 shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round"/>
              </svg>
              <p className="text-xs text-rose-700 font-medium">
                Actual exceeds approved — additional requirement of <strong>{grand.additionalTotal}</strong> manpower across all shifts.
              </p>
            </div>
          )}
        </div>

        {/* OVERTIME SECTION */}
        <div className="bg-purple-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold text-purple-800 mb-4">Overtime Details</h3>

          {/* Shift quick-fill buttons */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-600 block mb-2">Select Shift</label>
            <div className="flex flex-wrap gap-3">
              {SHIFTS.map((shift) => {
                const isSelected = form.overtimeFrom === shift.from && form.overtimeTo === shift.to;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, overtimeFrom: shift.from, overtimeTo: shift.to }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow"
                        : "bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600"
                    }`}
                  >
                    {shift.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, overtimeFrom: "", overtimeTo: "" }))}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  form.overtimeFrom && !SHIFTS.find(s => s.from === form.overtimeFrom && s.to === form.overtimeTo)
                    ? "bg-purple-600 text-white border-purple-600 shadow"
                    : "bg-white text-gray-500 border-dashed border-gray-300 hover:border-purple-400 hover:text-purple-600"
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 items-center">
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">From</label>
              <input
                type="time"
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-purple-400"
                value={form.overtimeFrom}
                onChange={(e) => handleChange("overtimeFrom", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">To</label>
              <input
                type="time"
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-purple-400"
                value={form.overtimeTo}
                onChange={(e) => handleChange("overtimeTo", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Total Overtime Hours</label>
              <div className="bg-indigo-200 rounded-lg p-3 text-center font-bold">
                {form.overtimeTotal} Hours
              </div>
            </div>
          </div>
        </div>

        {/* RESPONSIBLE STAFF */}
        <div className="bg-gray-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Responsible Staff Member</h3>
          <input
            type="text"
            placeholder="Enter responsible staff name"
            className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            value={form.responsibleStaff}
            onChange={(e) => handleChange("responsibleStaff", e.target.value)}
          />
        </div>

        {/* JUSTIFICATION */}
        <div className="bg-yellow-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold mb-4 text-yellow-800">Justification for Overtime</h3>
          <textarea
            rows="4"
            placeholder="Enter justification..."
            className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            value={form.justification}
            onChange={(e) => handleChange("justification", e.target.value)}
          />
        </div>

        {/* REVERIFICATION */}
        <div className="bg-green-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold mb-4 text-green-800">Reverification by HOD (Next Day)</h3>
          <textarea
            rows="3"
            placeholder="Enter reverification remarks..."
            className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            value={form.reverification}
            onChange={(e) => handleChange("reverification", e.target.value)}
          />
        </div>

        {/* EMPLOYEE TABLE */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Employee Details</h3>
          <div className="overflow-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Emp Code</th>
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Category</th>
                  <th className="p-2 border">Location</th>
                  <th className="p-2 border">Contact</th>
                  <th className="p-2 border">Travelling By</th>
                  <th className="p-2 border">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border text-center p-1">{index + 1}</td>
                    {Object.keys(emp).map((field) => (
                      <td key={field} className="border">
                        <input
                          className="w-full p-2 outline-none"
                          value={emp[field]}
                          onChange={(e) => handleEmployeeChange(index, field, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="border text-center p-1">
                      <button
                        onClick={() => removeEmployeeRow(index)}
                        disabled={employees.length === 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 font-bold px-2"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={addEmployeeRow}
            className="mt-4 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg"
          >
            + Add Employee
          </button>
        </div>

        {/* SUBMIT */}
        <div className="text-center mt-8">
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 transition-all duration-300 text-white px-10 py-3 rounded-xl shadow-lg text-lg font-semibold"
          >
            Submit & Generate PDF
          </button>
        </div>

      </div>
    </div>
  );
};

export default ManpowerForm;
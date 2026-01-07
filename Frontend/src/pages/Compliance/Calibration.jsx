import React, { useEffect, useState } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import { toast } from "react-hot-toast";
import HistoryTable from "./HistoryTable";
import Button from "../../components/common/Button";
import InputField from "../../components/common/InputField";
import * as XLSX from "xlsx";
import {
  FaTools,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
} from "react-icons/fa";
import { useSpring, animated } from "@react-spring/web";

/* ================= MODAL ================= */
// 🔹 OUTSIDE Calibration()
const Modal = ({ title, icon, children, onClose, primaryAction }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between px-6 py-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose}>✕</button>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
        {children}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
        <Button onClick={onClose}>Cancel</Button>
        {primaryAction}
      </div>
    </div>
  </div>
);

const AnimatedNumber = ({ value }) => {
  const props = useSpring({
    from: { number: 0 },
    number: value,
    delay: 100,
    config: { tension: 120, friction: 20 },
  });

  return <animated.span>{props.number.to((n) => Math.floor(n))}</animated.span>;
};

export default function Calibration() {
  const role = localStorage.getItem("role") || "admin";

  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState({
    id: null,
    equipment: "",
    identification: "",
    leastCount: "",
    range: "",
    location: "",
    lastDate: "",
    frequency: 12,

    performedByEmpId: "",
    performedByName: "",
    departmentId: "",
    employeeEmail: "",
    managerEmail: "",
    result: "Pass",

    agency: "",
    remarks: "",
  });

  /* ================= LOAD ================= */
  useEffect(() => {
    loadAssets();
    loadUsers();
  }, []);

  const loadAssets = async () => {
    try {
      const res = await axios.get(baseURL + "compliance/assets");
      setAssets(res.data);
    } catch {
      toast.error("Failed to load records");
    }
  };

  const loadUsers = async () => {
    try {
      const res = await axios.get(baseURL + "compliance/users/calibration");
      setUsers(res?.data?.data);
    } catch {
      toast.error("Failed to load users");
    }
  };

  const getEscalationLevelByDays = (daysLeft) => {
    if (daysLeft <= -5) return 3;
    if (daysLeft <= 5) return 2;
    if (daysLeft <= 10) return 1;
    if (daysLeft <= 15) return 0;
    return null; // Normal / No escalation
  };

  /* ================= ADD ================= */
  const addEquipment = async () => {
    if (!form.lastDate || !form.frequency)
      return toast.error("Date & Frequency required");

    if (!file || !form.performedByEmpId || !form.agency)
      return toast.error("Performed By, Agency & Report required");

    const fd = new FormData();

    // Equipment details
    fd.append("equipment", form.equipment);
    fd.append("identification", form.identification);
    fd.append("leastCount", form.leastCount);
    fd.append("range", form.range);
    fd.append("location", form.location);
    fd.append("lastDate", form.lastDate);
    fd.append("frequency", form.frequency);

    // Ownership / escalation binding
    fd.append("owner_employee_id", form.performedByEmpId);
    fd.append("department_id", form.departmentId);

    // History details
    fd.append("performedBy", form.performedByName);
    fd.append("employeeEmail", form.employeeEmail);
    fd.append("managerEmail", form.managerEmail);
    fd.append("agency", form.agency);

    fd.append("file", file);

    try {
      await axios.post(baseURL + "compliance/addAsset", fd);
      toast.success("Equipment Added Successfully ✅");
      setShowAdd(false);
      setFile(null);
      resetForm();
      loadAssets();
    } catch (err) {
      console.error(err);
      toast.error("Add failed ❌");
    }
  };

  /* ================= UPDATE EQUIPMENT ================= */
  const updateEquipment = async () => {
    if (!form.lastDate || !form.frequency)
      return toast.error("Date & Frequency required");

    const fd = new FormData();
    fd.append("id", form.id);
    fd.append("equipment", form.equipment);
    fd.append("identification", form.identification);
    fd.append("leastCount", form.leastCount);
    fd.append("range", form.range);
    fd.append("location", form.location);
    fd.append("lastDate", form.lastDate);
    fd.append("frequency", form.frequency);
    fd.append("remarks", form.remarks || "");

    try {
      await axios.post(baseURL + "compliance/addAsset", fd);
      toast.success("Equipment Updated ✅");
      setShowUpdate(false);
      resetForm();
      load();
    } catch {
      toast.error("Update failed ❌");
    }
  };

  /* ================= UPLOAD REPORT ================= */
  const uploadReport = async () => {
    if (!file || !form.performedByEmpId || !form.agency)
      return toast.error("All fields required");

    const fd = new FormData();
    fd.append("performedByEmpId", form.performedByEmpId);
    fd.append("agency", form.agency);
    fd.append("employeeEmail", form.employeeEmail);
    fd.append("managerEmail", form.managerEmail);
    fd.append("result", form.result);
    fd.append("file", file);

    try {
      await axios.post(`${baseURL}compliance/uploadReport/${form.id}`, fd);
      toast.success("Calibration Report Uploaded ✅");
      setShowUpload(false);
      setFile(null);
      resetForm();
      loadAssets();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed ❌");
    }
  };

  const resetForm = () => {
    setForm({
      id: null,
      equipment: "",
      identification: "",
      leastCount: "",
      range: "",
      location: "",
      lastDate: "",
      frequency: 12,

      performedByEmpId: "",
      performedByName: "",
      departmentId: "",
      employeeEmail: "",
      managerEmail: "",

      agency: "",
      remarks: "",
      result: "Pass",
    });
  };

  /* ================= EXPORT ================= */
  const exportExcel = () => {
    const data = assets.map((a) => ({
      Equipment: a.EquipmentName,
      Identification: a.IdentificationNo,
      Location: a.Location,
      LastCalibration: a.LastCalibrationDate?.slice(0, 10),
      NextCalibration: a.NextCalibrationDate?.slice(0, 10),
      Status: a.Status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calibration");
    XLSX.writeFile(wb, "Calibration_Register.xlsx");
  };

  /* ================= FILTER ================= */
  const filteredAssets = assets.filter((a) => {
    const days = (new Date(a.NextCalibrationDate) - new Date()) / 86400000;

    const status =
      days <= 0 ? "Expired" : days <= 30 ? "Due Soon" : "Calibrated";

    const searchText = [a.EquipmentName, a.IdentificationNo, a.Location]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      searchText.includes(search.toLowerCase()) &&
      (statusFilter === "All" || statusFilter === status)
    );
  });

  const summary = assets.reduce(
    (acc, a) => {
      const daysLeft =
        (new Date(a.NextCalibrationDate) - new Date()) / 86400000;

      const level = getEscalationLevelByDays(daysLeft);

      acc.total++;

      if (level === 3) acc.expired++;
      else if (level !== null) acc.dueSoon++;
      else acc.valid++;

      return acc;
    },
    { total: 0, valid: 0, dueSoon: 0, expired: 0 }
  );

  const DEPT_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-yellow-100 text-yellow-700",
    "bg-pink-100 text-pink-700",
    "bg-orange-100 text-orange-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
    "bg-red-100 text-red-700",
    "bg-teal-100 text-teal-700",
  ];

  const hashString = (str = "") => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const getDeptColor = (deptKey) => {
    if (!deptKey) return "bg-gray-100 text-gray-600";

    const index = hashString(String(deptKey)) % DEPT_COLORS.length;
    return DEPT_COLORS[index];
  };

  const ESCALATION_LABELS = {
    0: "L0 - Info",
    1: "L1 - Warning",
    2: "L2 - Critical",
    3: "L3 - Audit Risk",
  };

  const ESCALATION_COLORS = [
    "bg-blue-100 text-blue-700", // L0
    "bg-yellow-100 text-yellow-700", // L1
    "bg-orange-100 text-orange-700", // L2
    "bg-red-100 text-red-700", // L3
  ];

  const getEscalationColor = (level) => {
    if (level === null || level === undefined)
      return "bg-gray-100 text-gray-600";

    return ESCALATION_COLORS[level] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="p-8 bg-gradient-to-br from-gray-100 to-gray-200 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-700">
          Calibration Management
        </h1>
        <div className="flex gap-2">
          <Button onClick={exportExcel} className="bg-green-600 text-white">
            Export
          </Button>
          {role === "admin" && (
            <Button
              onClick={() => setShowAdd(true)}
              className="bg-blue-600 text-white"
            >
              Add Equipment
            </Button>
          )}
        </div>
      </div>

      {/* ================= STATUS SUMMARY ================= */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {/* TOTAL */}
        <div
          onClick={() => setStatusFilter("All")}
          className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition"
        >
          <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
            <FaTools size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Equipment</p>
            <p className="text-2xl font-bold text-gray-800">
              <AnimatedNumber value={summary.total} />
            </p>
          </div>
        </div>

        {/* VALID */}
        <div
          onClick={() => setStatusFilter("Calibrated")}
          className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition"
        >
          <div className="bg-green-100 text-green-600 p-3 rounded-xl">
            <FaCheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Valid</p>
            <p className="text-2xl font-bold text-green-600">
              <AnimatedNumber value={summary.valid} />
            </p>
          </div>
        </div>

        {/* DUE SOON */}
        <div
          onClick={() => setStatusFilter("Due Soon")}
          className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition"
        >
          <div className="bg-yellow-100 text-yellow-600 p-3 rounded-xl">
            <FaExclamationTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Due Soon (≤ 15 days)</p>
            <p className="text-2xl font-bold text-yellow-600">
              <AnimatedNumber value={summary.dueSoon} />
            </p>
          </div>
        </div>

        {/* EXPIRED */}
        <div
          onClick={() => setStatusFilter("Expired")}
          className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition"
        >
          <div className="bg-red-100 text-red-600 p-3 rounded-xl">
            <FaTimesCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Expired</p>
            <p className="text-2xl font-bold text-red-600">
              <AnimatedNumber value={summary.expired} />
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="flex gap-3 mb-4">
        <input
          placeholder="🔍 Search Equipment / ID / Location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-4 py-2 rounded-lg w-80"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border px-4 py-2 rounded-lg"
        >
          <option>All</option>
          <option>Calibrated</option>
          <option>Due Soon</option>
          <option>Expired</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-white text-xs uppercase">
            <tr>
              <th className="p-3 text-left">Equipment</th>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Location</th>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-center">Last Calibrated On</th>
              <th className="p-3 text-center">Next Calibration Due</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Escalation</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredAssets.map((a) => {
              const daysLeft = Math.ceil(
                (new Date(a.NextCalibrationDate) - new Date()) / 86400000
              );

              const escalationLevel = getEscalationLevelByDays(daysLeft);

              const status =
                escalationLevel === 3
                  ? "Expired"
                  : escalationLevel === 2 ||
                    escalationLevel === 1 ||
                    escalationLevel === 0
                  ? "Due Soon"
                  : "Valid";

              return (
                <React.Fragment key={a.ID}>
                  {/* MAIN ROW */}
                  <tr
                    onClick={() => setSelected(selected === a.ID ? null : a.ID)}
                    className={`
            border-b cursor-pointer transition
            hover:bg-gray-50
            ${status === "Expired" ? "bg-red-50" : ""}
          `}
                  >
                    {/* EQUIPMENT */}
                    <td className="p-4 font-semibold text-gray-800">
                      {a.EquipmentName}
                    </td>

                    {/* IDENTIFICATION */}
                    <td className="p-4 text-gray-600">{a.IdentificationNo}</td>

                    {/* LOCATION */}
                    <td className="p-4 text-gray-600">{a.Location}</td>

                    <td className="p-4 text-gray-800 font-medium">
                      <div className="flex flex-col">
                        <span>{a.EmployeeName || "—"}</span>
                        <span className="text-xs text-gray-500">
                          {a.owner_employee_id}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold
      ${getDeptColor(a.department_id)}`}
                      >
                        {a.DepartmentName}
                      </span>
                    </td>

                    {/* LAST DATE */}
                    <td className="p-4 text-center text-gray-600">
                      {a.LastCalibrationDate?.slice(0, 10)}
                    </td>

                    {/* NEXT DATE */}
                    <td className="p-4 text-center text-gray-600">
                      {a.NextCalibrationDate?.slice(0, 10)}
                    </td>

                    {/* STATUS */}
                    {/* STATUS */}
                    <td className="p-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold
                        ${
                          escalationLevel === 3
                            ? "bg-red-100 text-red-700"
                            : escalationLevel === 2
                            ? "bg-orange-100 text-orange-700"
                            : escalationLevel === 1
                            ? "bg-yellow-100 text-yellow-700"
                            : escalationLevel === 0
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }
                        `}
                      >
                        {status}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      {escalationLevel !== null ? (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold
        ${getEscalationColor(escalationLevel)}`}
                        >
                          {ESCALATION_LABELS[escalationLevel]}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700">
                          Normal
                        </span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button
                          className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({
                              id: a.ID,
                              equipment: a.EquipmentName,
                              identification: a.IdentificationNo,
                              leastCount: a.LeastCount,
                              range: a.RangeValue,
                              location: a.Location,
                              lastDate: a.LastCalibrationDate?.slice(0, 10),
                              frequency: a.FrequencyMonths,
                              remarks: a.Remarks || "",
                            });
                            setShowUpdate(true);
                          }}
                        >
                          Update
                        </button>

                        <button
                          className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({
                              id: a.ID,
                              performedBy: "",
                              agency: "",
                              result: "Pass",
                            });
                            setShowUpload(true);
                          }}
                        >
                          Upload
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* HISTORY EXPAND */}
                  {selected === a.ID && (
                    <tr>
                      <td colSpan={7} className="bg-gray-100 px-6 py-4">
                        <div className="rounded-xl border bg-white shadow-sm">
                          <HistoryTable id={a.ID} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal
          title="Add Calibration Equipment"
          onClose={() => setShowAdd(false)}
        >
          {/* EQUIPMENT INFO */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Equipment Details
            </p>

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Equipment Name"
                value={form.equipment}
                onChange={(e) =>
                  setForm({ ...form, equipment: e.target.value })
                }
              />
              <InputField
                label="Identification No"
                value={form.identification}
                onChange={(e) =>
                  setForm({ ...form, identification: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Least Count"
                value={form.leastCount}
                onChange={(e) =>
                  setForm({ ...form, leastCount: e.target.value })
                }
              />
              <InputField
                label="Range"
                value={form.range}
                onChange={(e) => setForm({ ...form, range: e.target.value })}
              />
            </div>

            <InputField
              label="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          {/* RESPONSIBILITY */}
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Responsibility
            </p>

            <label className="text-sm font-medium text-gray-700">
              Performed By
            </label>

            <select
              className="border rounded-lg px-3 py-2 w-full"
              value={form.performedByEmpId}
              onChange={(e) => {
                const u = users.find((x) => x.employee_id === e.target.value);
                setForm({
                  ...form,
                  performedByEmpId: u.employee_id,
                  performedByName: u.name,
                  departmentId: u.department_id,
                  departmentName: u.department_name,
                  employeeEmail: u.employee_email,
                  managerEmail: u.manager_email,
                });
              }}
            >
              <option value="">Select Employee</option>
              {users.map((u) => (
                <option key={u.employee_id} value={u.employee_id}>
                  {u.name} ({u.employee_id})
                </option>
              ))}
            </select>

            <InputField
              label="Department"
              value={form.departmentName}
              disabled
            />
          </div>

          {/* CALIBRATION */}
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Calibration Details
            </p>

            <div className="grid grid-cols-2 gap-4">
              <InputField
                type="date"
                label="Calibration Date"
                value={form.lastDate}
                onChange={(e) => setForm({ ...form, lastDate: e.target.value })}
              />

              <InputField
                type="number"
                label="Frequency (Months)"
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value })
                }
              />
            </div>

            <InputField
              label="Agency"
              value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}
            />

            <input
              type="file"
              accept="application/pdf"
              className="w-full border rounded-lg p-2"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          {/* ACTION */}
          <Button
            className="w-full bg-blue-600 text-white mt-6"
            onClick={addEquipment}
          >
            Add Equipment
          </Button>
        </Modal>
      )}

      {/* UPDATE MODAL */}
      {showUpdate && (
        <Modal title="Update Equipment" onClose={() => setShowUpdate(false)}>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Equipment"
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value })}
            />
            <InputField
              label="Identification"
              value={form.identification}
              onChange={(e) =>
                setForm({ ...form, identification: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-3">
            <InputField
              label="Least Count"
              value={form.leastCount}
              onChange={(e) => setForm({ ...form, leastCount: e.target.value })}
            />
            <InputField
              label="Range"
              value={form.range}
              onChange={(e) => setForm({ ...form, range: e.target.value })}
            />
          </div>

          <InputField
            label="Location"
            className="mt-3"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4 mt-3">
            <InputField
              type="date"
              label="Calibration Date"
              value={form.lastDate}
              onChange={(e) => setForm({ ...form, lastDate: e.target.value })}
            />

            <InputField
              type="number"
              label="Frequency (Months)"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            />
          </div>

          <Button
            className="w-full bg-blue-600 text-white mt-6"
            onClick={updateEquipment}
          >
            Update Equipment
          </Button>
        </Modal>
      )}

      {/* UPLOAD MODAL */}
      {showUpload && (
        <Modal
          title="Upload Calibration Report"
          onClose={() => setShowUpload(false)}
        >
          <label className="text-sm font-medium text-gray-700">
            Performed By
          </label>

          <select
            className="border rounded-lg px-3 py-2 w-full"
            value={form.performedByEmpId}
            onChange={(e) => {
              const u = users.find((x) => x.employee_id === e.target.value);
              setForm({
                ...form,
                performedByEmpId: u.employee_id,
                performedByName: u.name,
                departmentId: u.department_id,
                departmentName: u.department_name,
                employeeEmail: u.employee_email,
                managerEmail: u.manager_email,
              });
            }}
          >
            <option value="">Select Employee</option>
            {users.map((u) => (
              <option key={u.employee_id} value={u.employee_id}>
                {u.name} ({u.employee_id})
              </option>
            ))}
          </select>

          <InputField label="Department" value={form.departmentName} disabled />
          <InputField
            label="Agency"
            value={form.agency}
            onChange={(e) => setForm({ ...form, agency: e.target.value })}
          />

          <label className="text-sm font-medium text-gray-700">
            Calibration Result
          </label>

          <select
            className="border rounded-lg px-3 py-2 w-full"
            value={form.result}
            onChange={(e) => setForm({ ...form, result: e.target.value })}
          >
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="Conditional">Conditional</option>
          </select>

          <input
            type="file"
            accept="application/pdf"
            className="w-full border rounded-lg p-2"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <Button
            className="w-full bg-green-600 text-white mt-5"
            onClick={uploadReport}
          >
            Upload Report
          </Button>
        </Modal>
      )}
    </div>
  );
}

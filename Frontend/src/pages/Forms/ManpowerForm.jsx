import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const ManpowerForm = () => {
  const [departments, setDepartments] = useState([]);

  const [employees, setEmployees] = useState([
    {
      empCode: "",
      empName: "",
      category: "",
      location: "",
      contactNo: "",
      travellingBy: "",
    },
  ]);

  const [form, setForm] = useState({
    departmentId: "",
    departmentName: "",
    hodName: "",
    hodEmail: "",
    requiredDate: "",
    requiredDay: "",
    approvedDET: 0,
    approvedITI: 0,
    approvedCASUAL: 0,
    actualDET: 0,
    actualITI: 0,
    actualCASUAL: 0,
    additionalDET: 0,
    additionalITI: 0,
    additionalCASUAL: 0,
    overtimeFrom: "",
    overtimeTo: "",
    overtimeTotal: 0,
    responsibleStaff: "",
    justification: "",
    reverification: "",
  });

  // 🔹 Load Departments
  useEffect(() => {
    axios
      .get(`${baseURL}manpower/departments`)
      .then((res) => {
        setDepartments(res.data.data);
      })
      .catch(() => {
        toast.error("Failed to load departments");
      });
  }, []);

  // ✅ Derived Totals
  const approvedTotal =
    +form.approvedDET + +form.approvedITI + +form.approvedCASUAL;

  const actualTotal = +form.actualDET + +form.actualITI + +form.actualCASUAL;

  const additionalTotal =
    +form.additionalDET + +form.additionalITI + +form.additionalCASUAL;

  const totalManpower = actualTotal + additionalTotal;

  // ✅ Fixed Overtime Calculation — includes all dependencies to avoid stale closure
  useEffect(() => {
    if (form.overtimeFrom && form.overtimeTo) {
      const from = new Date(`2024-01-01T${form.overtimeFrom}`);
      const to = new Date(`2024-01-01T${form.overtimeTo}`);
      let diff = (to - from) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;

      const actual =
        +form.actualDET + +form.actualITI + +form.actualCASUAL;
      const additional =
        +form.additionalDET + +form.additionalITI + +form.additionalCASUAL;

      setForm((prev) => ({
        ...prev,
        overtimeTotal: Number(diff.toFixed(2)) * (actual + additional),
      }));
    }
  }, [
    form.overtimeFrom,
    form.overtimeTo,
    form.actualDET,
    form.actualITI,
    form.actualCASUAL,
    form.additionalDET,
    form.additionalITI,
    form.additionalCASUAL,
  ]);

  // ✅ Auto-calculate Day from Date
  useEffect(() => {
    if (form.requiredDate) {
      const day = new Date(form.requiredDate).toLocaleDateString("en-IN", {
        weekday: "long",
      });
      setForm((prev) => ({ ...prev, requiredDay: day }));
    }
  }, [form.requiredDate]);

  const handleDepartmentChange = (id) => {
    const selected = departments.find((d) => d.id === Number(id));
    if (!selected) return;

    setForm((prev) => ({
      ...prev,
      departmentId: selected.id,
      departmentName: selected.department_name,
      hodName: selected.name,
      hodEmail: selected.employee_email,
    }));
  };

  const addEmployeeRow = () => {
    setEmployees([
      ...employees,
      {
        empCode: "",
        empName: "",
        category: "",
        location: "",
        contactNo: "",
        travellingBy: "",
      },
    ]);
  };

  const removeEmployeeRow = (index) => {
    if (employees.length === 1) return;
    setEmployees(employees.filter((_, i) => i !== index));
  };

  const handleEmployeeChange = (index, field, value) => {
    const updated = [...employees];
    updated[index][field] = value;
    setEmployees(updated);
  };

  // ✅ Generic field change handler
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.departmentId) {
      toast.error("Please select a department");
      return;
    }
    if (!form.requiredDate) {
      toast.error("Please select a required date");
      return;
    }

    try {
      const res = await axios.post(
        `${baseURL}manpower/create`,
        {
          ...form,
          approvedTotal,
          actualTotal,
          additionalTotal,
          totalManpower,   // ✅ explicitly included
          employees,
        },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Manpower_Request.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("PDF Generated Successfully");
    } catch {
      toast.error("Submission Failed");
    }
  };

  const manpowerRows = [
    {
      label: "Approved",
      fields: ["approvedDET", "approvedITI", "approvedCASUAL"],
      total: approvedTotal,
      totalBg: "bg-green-200",
    },
    {
      label: "Actual Required",
      fields: ["actualDET", "actualITI", "actualCASUAL"],
      total: actualTotal,
      totalBg: "bg-yellow-200",
    },
    {
      label: "Additional Required",
      fields: ["additionalDET", "additionalITI", "additionalCASUAL"],
      total: additionalTotal,
      totalBg: "bg-red-200",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl p-10">

        {/* HEADER */}
        <div className="text-center border-b pb-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Western Refrigeration Pvt. Ltd.
          </h1>
          <p className="text-gray-600 mt-1">Manpower Approval Request Form</p>
        </div>

        {/* BASIC DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div>
            <label className="text-sm font-semibold text-gray-600">
              Department Name
            </label>
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
            <label className="text-sm font-semibold text-gray-600">
              HOD Name
            </label>
            <input
              className="w-full border rounded-lg p-3 mt-1 bg-gray-100 focus:ring-2 focus:ring-blue-500"
              value={form.hodName}
              readOnly
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">
              HOD Email
            </label>
            <input
              className="w-full border rounded-lg p-3 mt-1 bg-gray-100 focus:ring-2 focus:ring-blue-500"
              value={form.hodEmail}
              readOnly
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">
              Required Date
            </label>
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
            <input
              className="w-full border rounded-lg p-3 mt-1 bg-gray-100"
              value={form.requiredDay}
              readOnly
            />
          </div>
        </div>

        {/* MANPOWER SECTION */}
        <div className="bg-blue-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold mb-4 text-blue-800">
            Manpower Head Count
          </h3>

          <div className="grid grid-cols-5 gap-4 text-center">
            {/* Header Row */}
            <div></div>
            <div className="font-semibold">DET</div>
            <div className="font-semibold">ITI</div>
            <div className="font-semibold">CASUAL</div>
            <div className="font-semibold">Total</div>

            {/* Dynamic Rows */}
            {manpowerRows.map(({ label, fields, total, totalBg }) => (
              <>
                <div key={label} className="text-left font-medium flex items-center">
                  {label}
                </div>
                {fields.map((field) => (
                  <input
                    key={field}
                    type="number"
                    min="0"
                    className="border rounded p-2 text-center"
                    value={form[field]}                          // ✅ controlled
                    onChange={(e) => handleChange(field, e.target.value)}
                  />
                ))}
                <div className={`${totalBg} rounded p-2 font-bold flex items-center justify-center`}>
                  {total}
                </div>
              </>
            ))}
          </div>

          {/* Grand Total */}
          <div className="mt-4 text-right">
            <span className="text-sm font-semibold text-blue-800">
              Total Manpower (Actual + Additional):{" "}
              <span className="text-lg">{totalManpower}</span>
            </span>
          </div>
        </div>

        {/* OVERTIME SECTION */}
        <div className="bg-purple-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold text-purple-800 mb-4">
            Overtime Details
          </h3>

          <div className="grid grid-cols-3 gap-6 items-center">
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">
                From
              </label>
              <input
                type="time"
                className="w-full border rounded-lg p-3"
                value={form.overtimeFrom}                        // ✅ controlled
                onChange={(e) => handleChange("overtimeFrom", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">
                To
              </label>
              <input
                type="time"
                className="w-full border rounded-lg p-3"
                value={form.overtimeTo}                          // ✅ controlled
                onChange={(e) => handleChange("overtimeTo", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">
                Total Overtime Hours
              </label>
              <div className="bg-indigo-200 rounded-lg p-3 text-center font-bold">
                {form.overtimeTotal} Hours
              </div>
            </div>
          </div>
        </div>

        {/* RESPONSIBLE STAFF */}
        <div className="bg-gray-50 p-6 rounded-xl mb-10">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Responsible Staff Member
          </h3>
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
          <h3 className="text-lg font-semibold mb-4 text-yellow-800">
            Justification for Overtime
          </h3>
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
          <h3 className="text-lg font-semibold mb-4 text-green-800">
            Reverification by HOD (Next Day)
          </h3>
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
                          onChange={(e) =>
                            handleEmployeeChange(index, field, e.target.value)
                          }
                        />
                      </td>
                    ))}
                    <td className="border text-center p-1">
                      <button
                        onClick={() => removeEmployeeRow(index)}
                        disabled={employees.length === 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 font-bold px-2"
                        title="Remove row"
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

        {/* SUBMIT BUTTON */}
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
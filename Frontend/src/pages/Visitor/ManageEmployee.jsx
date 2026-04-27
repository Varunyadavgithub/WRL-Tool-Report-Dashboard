import { useEffect, useState, useRef } from "react";
import InputField from "../../components/ui/InputField";
import SelectField from "../../components/ui/SelectField";
import toast from "react-hot-toast";
import axios from "axios";
import {
  FaEdit,
  FaUsers,
  FaBuilding,
  FaSearch,
  FaTimes,
  FaPlus,
  FaUserPlus,
} from "react-icons/fa";
import { MdDeleteForever } from "react-icons/md";
import { baseURL } from "../../assets/assets";

/* ==================== Dashboard-Style Stat Card ==================== */
const StatCard = ({ icon: Icon, title, value, color }) => (
  <div className="bg-white shadow-md rounded-lg p-4 flex items-center">
    <div className={`mr-4 p-3 rounded-full ${color}`}>
      <Icon className="text-white text-2xl" />
    </div>
    <div>
      <p className="text-gray-500 text-sm">{title}</p>
      <h2 className="text-2xl font-bold text-gray-800">{value}</h2>
    </div>
  </div>
);

const ManageEmployee = () => {
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState({
    name: "",
    employeeId: "",
    departmentId: "",
    contactNo: "",
    employeeEmail: "",
    managerEmail: "",
  });
  const [departmentDetails, setDepartmentDetails] = useState({
    name: "",
    deptCode: "",
    headId: "",
  });
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [editingDeptCode, setEditingDeptCode] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [highlightedDeptCode, setHighlightedDeptCode] = useState(null);

  const deptRefs = useRef({});
  const deptScrollContainerRef = useRef(null);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${baseURL}visitor/users`);
      if (res?.data?.success) {
        setUsers(res?.data?.data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to fetch users.");
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${baseURL}visitor/departments`);
      const formatted = res?.data?.data.map((item) => ({
        label: item.department_name,
        value: item.deptCode.toString(),
      }));
      setDepartments(formatted);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to fetch departments.");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (highlightedDeptCode) {
      const timer = setTimeout(() => {
        setHighlightedDeptCode(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightedDeptCode]);

  const handleUserDetailsChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleDepartmentDetailsChange = (e) => {
    const { name, value } = e.target;
    setDepartmentDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleDeptClickFromUserTable = (deptId) => {
    const deptCode = deptId.toString();
    setSelectedDepartmentId(deptCode);
    setHighlightedDeptCode(deptCode);

    const targetRow = deptRefs.current[deptCode];
    if (targetRow && deptScrollContainerRef.current) {
      const container = deptScrollContainerRef.current;
      const rowTop = targetRow.offsetTop - container.offsetTop;
      container.scrollTo({
        top: rowTop - 50,
        behavior: "smooth",
      });
    }
  };

  const handleAddDepartment = async () => {
    const { name, headId, deptCode } = departmentDetails;
    if (!name || !headId || !deptCode) {
      toast.error("Please fill all department fields.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        departmentName: name,
        departmentHeadId: parseInt(headId),
        deptCode,
      };
      const res = await axios.post(`${baseURL}visitor/departments`, payload);
      if (res?.data?.success) {
        toast.success(res?.data?.message || "Department added successfully.");
        setDepartmentDetails({ name: "", headId: "", deptCode: "" });
      }
      fetchDepartments();
    } catch (error) {
      console.error("Add department failed:", error);
      toast.error("Failed to add department.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async (deptCode) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    setLoading(true);
    try {
      const res = await axios.delete(
        `${baseURL}visitor/departments/${deptCode}`,
      );
      if (res?.data?.success) {
        toast.success("Department deleted successfully.");
      }
      fetchDepartments();
    } catch (error) {
      console.error("Failed to delete department:", error);
      toast.error("Failed to delete department.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDepartment = async () => {
    if (!departmentDetails.name || !departmentDetails.headId) {
      toast.error("Please fill out all department fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.put(
        `${baseURL}visitor/departments/${editingDeptCode}`,
        {
          departmentName: departmentDetails.name,
          departmentHeadId: departmentDetails.headId,
        },
      );
      if (res?.data?.success) {
        toast.success("Department updated successfully.");
        setEditingDeptCode(null);
        setDepartmentDetails({ name: "", headId: "", deptCode: "" });
      }
      fetchDepartments();
    } catch (error) {
      console.error("Update failed:", error);
      toast.error("Failed to update department.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    const {
      name,
      employeeId,
      departmentId,
      contactNo,
      employeeEmail,
      managerEmail,
    } = userDetails;
    if (
      !name ||
      !employeeId ||
      !departmentId ||
      !contactNo ||
      !employeeEmail ||
      !managerEmail
    ) {
      toast.error("Please fill all user fields.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name,
        employeeId,
        departmentId: parseInt(departmentId),
        contactNumber: contactNo,
        employeeEmail,
        managerEmail,
      };
      let res;
      if (editingUserId) {
        res = await axios.put(
          `${baseURL}visitor/users/${editingUserId}`,
          payload,
        );
      } else {
        res = await axios.post(`${baseURL}visitor/users`, payload);
      }
      if (res?.data?.success) {
        toast.success(
          res?.data?.message ||
            (editingUserId ? "User updated." : "User added."),
        );
        setUserDetails({
          name: "",
          employeeId: "",
          departmentId: "",
          contactNo: "",
          employeeEmail: "",
          managerEmail: "",
        });
        setEditingUserId(null);
        fetchUsers();
      }
    } catch (error) {
      console.error("User operation failed:", error);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setLoading(true);
    try {
      const res = await axios.delete(`${baseURL}visitor/users/${userId}`);
      if (res?.data?.success) {
        toast.success("User deleted successfully.");
        fetchUsers();
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete user.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      user.name?.toLowerCase().includes(term) ||
      user.employee_id?.toLowerCase().includes(term) ||
      user.employee_email?.toLowerCase().includes(term) ||
      user.manager_email?.toLowerCase().includes(term) ||
      user.contact_number?.toLowerCase().includes(term);
    const matchesDepartment =
      !selectedDepartmentId ||
      user.department_id.toString() === selectedDepartmentId.toString();
    return matchesSearch && matchesDepartment;
  });

  const TABLE_HEIGHT = "h-[500px]";

  return (
    <div className="min-h-screen bg-gray-100 p-4 max-w-full">
      {/* Page Title */}
      <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
        Manage Employee
      </h1>

      {/* ==================== Stats Cards ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={FaUsers}
          title="Total Employees"
          value={users.length}
          color="bg-blue-500"
        />
        <StatCard
          icon={FaBuilding}
          title="Departments"
          value={departments.length}
          color="bg-purple-500"
        />
        <StatCard
          icon={FaSearch}
          title="Filtered Results"
          value={filteredUsers.length}
          color="bg-green-500"
        />
      </div>

      {/* ==================== Forms Section ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Add / Edit User Form */}
        <div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <FaUserPlus className="text-blue-500" />
            {editingUserId ? "Edit Employee" : "Add Employee"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField
              name="name"
              label="Full Name"
              type="text"
              placeholder="Enter full name"
              value={userDetails.name}
              onChange={handleUserDetailsChange}
              required
              className="w-full"
            />
            <InputField
              name="employeeId"
              label="Employee ID"
              type="text"
              placeholder="Enter employee ID"
              value={userDetails.employeeId}
              onChange={handleUserDetailsChange}
              required
              className="w-full"
            />
            <InputField
              name="employeeEmail"
              label="Employee Email"
              type="email"
              placeholder="Enter employee email"
              value={userDetails.employeeEmail}
              onChange={handleUserDetailsChange}
              required
              className="w-full"
            />
            <InputField
              name="contactNo"
              label="Contact Number"
              type="tel"
              placeholder="Enter contact number"
              value={userDetails.contactNo}
              onChange={handleUserDetailsChange}
              required
              className="w-full"
            />
            <InputField
              name="managerEmail"
              label="Manager Email"
              type="email"
              placeholder="Enter manager email"
              value={userDetails.managerEmail}
              onChange={handleUserDetailsChange}
              required
              className="w-full"
            />
            <SelectField
              name="departmentId"
              label="Department"
              options={[
                { value: "", label: "Select Department" },
                ...departments.map((dept) => ({
                  value: dept.value,
                  label: dept.label,
                })),
              ]}
              value={userDetails.departmentId}
              onChange={(e) => {
                setUserDetails((prev) => ({
                  ...prev,
                  departmentId: e.target.value,
                }));
              }}
              required
              className="w-full"
            />
          </div>

          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={handleAddUser}
              disabled={loading}
              className={`px-6 py-2 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center gap-2 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : editingUserId
                    ? "bg-green-500 hover:bg-green-600 cursor-pointer"
                    : "bg-blue-500 hover:bg-blue-600 cursor-pointer"
              }`}
            >
              {loading ? (
                editingUserId ? (
                  "Updating..."
                ) : (
                  "Adding..."
                )
              ) : editingUserId ? (
                <>
                  <FaEdit className="text-xs" /> Update Employee
                </>
              ) : (
                <>
                  <FaPlus className="text-xs" /> Add Employee
                </>
              )}
            </button>

            {editingUserId && (
              <button
                onClick={() => {
                  setEditingUserId(null);
                  setUserDetails({
                    name: "",
                    employeeId: "",
                    departmentId: "",
                    contactNo: "",
                    employeeEmail: "",
                    managerEmail: "",
                  });
                }}
                className="px-6 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 transition cursor-pointer flex items-center gap-2"
              >
                <FaTimes className="text-xs" /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Add / Edit Department Form */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <FaBuilding className="text-purple-500" />
            {editingDeptCode ? "Edit Department" : "Add Department"}
          </h3>

          <div className="space-y-4">
            <InputField
              name="name"
              label="Department Name"
              type="text"
              placeholder="Enter department name"
              value={departmentDetails.name}
              onChange={handleDepartmentDetailsChange}
              required
            />
            <InputField
              name="deptCode"
              label="Department Code"
              type="text"
              placeholder="Enter department code"
              value={departmentDetails.deptCode}
              onChange={handleDepartmentDetailsChange}
              required
              disabled={!!editingDeptCode}
            />
            <InputField
              name="headId"
              label="Department Head ID"
              type="text"
              placeholder="Enter department head ID"
              value={departmentDetails.headId}
              onChange={handleDepartmentDetailsChange}
              required
            />
          </div>

          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={() => {
                if (editingDeptCode) {
                  handleUpdateDepartment();
                } else {
                  handleAddDepartment();
                }
              }}
              disabled={loading}
              className={`px-6 py-2 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center gap-2 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : editingDeptCode
                    ? "bg-green-500 hover:bg-green-600 cursor-pointer"
                    : "bg-purple-500 hover:bg-purple-600 cursor-pointer"
              }`}
            >
              {loading ? (
                editingDeptCode ? (
                  "Updating..."
                ) : (
                  "Adding..."
                )
              ) : editingDeptCode ? (
                <>
                  <FaEdit className="text-xs" /> Update
                </>
              ) : (
                <>
                  <FaPlus className="text-xs" /> Add Department
                </>
              )}
            </button>

            {editingDeptCode && (
              <button
                onClick={() => {
                  setEditingDeptCode(null);
                  setDepartmentDetails({ name: "", deptCode: "", headId: "" });
                }}
                className="px-6 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 transition cursor-pointer flex items-center gap-2"
              >
                <FaTimes className="text-xs" /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================== Tables Section ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --------- Users Table --------- */}
        <div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6">
          {/* Table Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h3 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
              <FaUsers className="text-blue-500" /> Registered Employees
              {selectedDepartmentId && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium ml-2">
                  Dept: {selectedDepartmentId}
                </span>
              )}
            </h3>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-56
                    bg-white text-gray-800
                    placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Count Badge */}
              <span className="inline-flex items-center bg-blue-100 text-blue-700 font-bold text-xs px-2.5 py-1 rounded-full">
                {filteredUsers.length}
              </span>

              {/* Clear Filter */}
              {selectedDepartmentId && (
                <button
                  onClick={() => setSelectedDepartmentId(null)}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-red-600 transition cursor-pointer flex items-center gap-1"
                >
                  <FaTimes className="text-[10px]" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Table */}
          <div
            className={`${TABLE_HEIGHT} overflow-y-auto border border-gray-200 rounded-lg`}
          >
            {filteredUsers.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-center text-xs font-semibold text-gray-600">
                      Sr.
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">
                      Name
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">
                      Employee ID
                    </th>
                    <th className="p-3 text-center text-xs font-semibold text-gray-600">
                      Department
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">
                      Contact
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">
                      Employee Email
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">
                      Manager Email
                    </th>
                    <th className="p-3 text-center text-xs font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >
                      <td className="p-3 text-center text-gray-700">
                        {index + 1}
                      </td>
                      <td className="p-3 font-medium text-gray-800">
                        {user.name}
                      </td>
                      <td className="p-3 text-gray-700">{user.employee_id}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() =>
                            handleDeptClickFromUserTable(user.department_id)
                          }
                          className="inline-flex items-center bg-purple-100 text-purple-700 font-semibold text-xs px-2.5 py-1 rounded-full cursor-pointer hover:bg-purple-200 hover:ring-2 hover:ring-purple-400 transition-all"
                          title={`Click to highlight department ${user.department_id}`}
                        >
                          <FaBuilding className="mr-1 text-[10px]" />
                          {user.department_id}
                        </button>
                      </td>
                      <td className="p-3 text-gray-700">
                        {user.contact_number || "—"}
                      </td>
                      <td className="p-3 text-gray-700">
                        {user.employee_email}
                      </td>
                      <td className="p-3 text-gray-700">
                        {user.manager_email}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button
                            className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition cursor-pointer"
                            onClick={() => {
                              setUserDetails({
                                name: user.name,
                                employeeId: user.employee_id,
                                departmentId: user.department_id.toString(),
                                contactNo: user.contact_number,
                                employeeEmail: user.employee_email,
                                managerEmail: user.manager_email,
                              });
                              setEditingUserId(user.id);
                              window.scrollTo({
                                top: 0,
                                behavior: "smooth",
                              });
                            }}
                            title="Edit"
                          >
                            <FaEdit size={14} />
                          </button>
                          <button
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition cursor-pointer"
                            onClick={() => handleDeleteUser(user.id)}
                            title="Delete"
                          >
                            <MdDeleteForever size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <FaUsers className="text-6xl text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-500">
                  No employees found
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  {searchTerm
                    ? "Try adjusting your search criteria"
                    : "Add a new employee to get started"}
                </p>
              </div>
            )}
          </div>

          {/* Table Footer */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-500">
              Showing {filteredUsers.length} of {users.length} employees
            </p>
            {selectedDepartmentId && (
              <p className="text-xs text-blue-500 font-medium">
                Filtered by Department: {selectedDepartmentId}
              </p>
            )}
          </div>
        </div>

        {/* --------- Departments Table --------- */}
        <div className="bg-white shadow-md rounded-lg p-6">
          {/* Table Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
              <FaBuilding className="text-purple-500" /> Departments
            </h3>
            <span className="inline-flex items-center bg-purple-100 text-purple-700 font-bold text-xs px-2.5 py-1 rounded-full">
              {departments.length}
            </span>
          </div>

          {/* Scrollable Table */}
          <div
            ref={deptScrollContainerRef}
            className={`${TABLE_HEIGHT} overflow-y-auto border border-gray-200 rounded-lg`}
          >
            {departments.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-center text-xs font-semibold text-gray-600">
                      Sr.
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">
                      Department
                    </th>
                    <th className="p-3 text-center text-xs font-semibold text-gray-600">
                      Code
                    </th>
                    <th className="p-3 text-center text-xs font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept, index) => {
                    const isSelected = selectedDepartmentId === dept.value;
                    const isHighlighted = highlightedDeptCode === dept.value;

                    return (
                      <tr
                        key={dept.value}
                        ref={(el) => (deptRefs.current[dept.value] = el)}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDepartmentId(null);
                          } else {
                            setSelectedDepartmentId(dept.value);
                          }
                        }}
                        className={`border-b border-gray-100 cursor-pointer transition-all duration-300 ${
                          isHighlighted
                            ? "bg-yellow-100 border-l-4 border-l-yellow-500 ring-2 ring-yellow-300 scale-[1.01]"
                            : isSelected
                              ? "bg-blue-50 border-l-4 border-l-blue-500"
                              : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="p-3 text-center text-gray-700">
                          {index + 1}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">
                              {dept.label}
                            </span>
                            {isHighlighted && (
                              <span className="animate-pulse inline-flex items-center bg-yellow-200 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                ● Linked
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center font-medium text-xs px-2 py-0.5 rounded-full transition-all ${
                              isHighlighted
                                ? "bg-yellow-200 text-yellow-800 ring-2 ring-yellow-400"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {dept.value}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            <button
                              className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDepartmentDetails({
                                  name: dept.label,
                                  deptCode: dept.value,
                                  headId: "",
                                });
                                setEditingDeptCode(dept.value);
                                window.scrollTo({
                                  top: 0,
                                  behavior: "smooth",
                                });
                              }}
                              title="Edit"
                            >
                              <FaEdit size={14} />
                            </button>
                            <button
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDepartment(dept.value);
                              }}
                              title="Delete"
                            >
                              <MdDeleteForever size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <FaBuilding className="text-5xl text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No departments found</p>
                <p className="text-gray-400 text-xs mt-1">
                  Add a department to get started
                </p>
              </div>
            )}
          </div>

          {/* Hint */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-sm text-center text-gray-600">
              Click a{" "}
              <span className="text-red-500 font-medium">department tab</span>{" "}
              to filter employees.
            </p>
            <p className="text-sm text-center text-gray-600">
              Click a{" "}
              <span className="text-purple-500 font-medium">
                department code badge
              </span>{" "}
              in employee table to locate it here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageEmployee;

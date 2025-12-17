import { useEffect, useState } from "react";
import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import SelectField from "../../components/common/SelectField";
import Button from "../../components/common/Button";
import toast from "react-hot-toast";
import axios from "axios";
import { FaEdit } from "react-icons/fa";
import { MdDeleteForever } from "react-icons/md";
import { baseURL } from "../../assets/assets";

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
      const formatted = res?.data.map((item) => ({
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

  // Handle user details changes
  const handleUserDetailsChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle department details changes
  const handleDepartmentDetailsChange = (e) => {
    const { name, value } = e.target;
    setDepartmentDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
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
        `${baseURL}visitor/departments/${deptCode}`
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
        }
      );

      if (res?.data?.success) {
        toast.success("Department updated successfully.");
        setEditingDeptCode(null);
        setDepartmentDetails({ name: "", headId: "" });
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
        // Update user
        res = await axios.put(
          `${baseURL}visitor/users/${editingUserId}`,
          payload
        );
      } else {
        // Add user
        res = await axios.post(`${baseURL}visitor/users`, payload);
      }

      if (res?.data?.success) {
        toast.success(
          res?.data?.message ||
            (editingUserId ? "User updated." : "User added.")
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

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Manage Employee" align="center" />

      {/* Filters Section */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Users Section */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl w-full md:w-[calc(70%-1rem)]">
          <h2 className="text-xl font-semibold mb-4 text-center">Add User</h2>
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
          <div className="flex justify-center mt-6">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-white"}
              className={`font-semibold px-8 py-2 ${
                loading ? "cursor-not-allowed" : ""
              }`}
              onClick={handleAddUser}
              disabled={loading}
            >
              {loading
                ? editingUserId
                  ? "Updating..."
                  : "Adding..."
                : editingUserId
                ? "Update"
                : "Add User"}
            </Button>
          </div>
        </div>

        {/* Departments Section */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl w-full md:w-[calc(30%-1rem)]">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Add Department
          </h2>
          <div className="grid grid-cols-1 gap-4">
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
          <div className="flex justify-center mt-6">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-white"}
              className={`font-semibold px-8 py-2 ${
                loading ? "cursor-not-allowed" : ""
              }`}
              onClick={() => {
                if (editingDeptCode) {
                  handleUpdateDepartment();
                } else {
                  handleAddDepartment();
                }
              }}
              disabled={loading}
            >
              {loading
                ? editingDeptCode
                  ? "Updating..."
                  : "Adding..."
                : editingDeptCode
                ? "Update"
                : "Add"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1 text-center">
            <span className="text-2xl font-bold text-purple-800">
              User Management Overview
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-wrap gap-4">
            {/* Users Table Section */}
            <div className="w-full md:w-[calc(70%-1rem)] overflow-x-auto">
              <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                <h3 className="text-xl font-semibold text-purple-700">
                  Registered Users
                  {selectedDepartmentId && (
                    <span className="ml-2 text-sm text-gray-500">
                      (Dept: {selectedDepartmentId})
                    </span>
                  )}
                </h3>

                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Total Users: {filteredUsers.length}
                  </span>

                  {selectedDepartmentId && (
                    <button
                      onClick={() => setSelectedDepartmentId(null)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="min-w-full bg-white text-xs text-left table-auto">
                    <thead className="bg-purple-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-center border-b w-[50px]">
                          Sr.No.
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          Name
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[150px]">
                          Employee Id
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          Department
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          Contact No.
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Employee Email
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Manager Email
                        </th>
                        <th className="px-2 py-2 text-center border-b w-[120px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Conditional rendering for users */}
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user, index) => (
                          <tr
                            key={user.id}
                            className="hover:bg-gray-50 transition-colors duration-200"
                          >
                            <td className="px-2 py-2 text-center border-b">
                              {index + 1}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {user.name}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {user.employee_id}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {user.department_id}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {user.contact_number || "N/A"}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {user.employee_email}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {user.manager_email}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              <div className="flex justify-center space-x-2">
                                <button
                                  className="text-green-500 hover:text-green-700 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setUserDetails({
                                      name: user.name,
                                      employeeId: user.employee_id,
                                      departmentId:
                                        user.department_id.toString(),
                                      contactNo: user.contact_number,
                                      employeeEmail: user.employee_email,
                                      managerEmail: user.manager_email,
                                    });
                                    setEditingUserId(user.id);
                                  }}
                                  title="Edit"
                                >
                                  <FaEdit size={18} />
                                </button>
                                <button
                                  className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                  onClick={() => {
                                    handleDeleteUser(user.id);
                                  }}
                                  title="Delete"
                                >
                                  <MdDeleteForever size={20} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-4 text-gray-500"
                          >
                            {searchTerm
                              ? "No matching users found."
                              : "No users found. Add a new user to get started."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Departments Table Section */}
            <div className="w-full md:w-[calc(30%-1rem)] overflow-x-auto">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold text-purple-700">
                  Company Departments
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Total Departments: {departments.length || "0"}
                  </span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="min-w-full bg-white text-xs text-left table-auto">
                    <thead className="bg-purple-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-center border-b w-[50px]">
                          Sr.No.
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          Department Name
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Department Code
                        </th>
                        <th className="px-2 py-2 text-center border-b w-[100px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.length > 0 ? (
                        departments.map((dept, index) => (
                          <tr
                            key={dept.value}
                            onClick={() => setSelectedDepartmentId(dept.value)}
                            className={`cursor-pointer transition-colors duration-200 ${
                              selectedDepartmentId === dept.value
                                ? "bg-purple-200"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-2 py-2 text-center border-b">
                              {index + 1}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {dept.label}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {dept.value}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              <div className="flex justify-center space-x-2">
                                <button
                                  className="text-green-500 hover:text-green-700 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setDepartmentDetails({
                                      name: dept.label,
                                      deptCode: dept.value,
                                      headId: "", // Optionally fetch real head ID if needed
                                    });
                                    setEditingDeptCode(dept.value);
                                  }}
                                  title="Edit"
                                >
                                  <FaEdit size={18} />
                                </button>

                                <button
                                  className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                  onClick={() => {
                                    handleDeleteDepartment(dept.value);
                                  }}
                                  title="Delete"
                                >
                                  <MdDeleteForever size={20} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-center py-4 text-gray-500"
                          >
                            No departments found. Add a new department to get
                            started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageEmployee;

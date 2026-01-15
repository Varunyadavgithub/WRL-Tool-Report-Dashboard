import { useEffect, useState } from "react";
import Title from "../../components/ui/Title";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Badge from "../../components/ui/Badge";
import { useGetEmployeesWithDepartmentsQuery } from "../../redux/api/commonApi.js";
import { useCreateTaskMutation } from "../../redux/api/taskReminder.js";
import toast from "react-hot-toast";

/* ---------------- OPTIONS ---------------- */
const priorityOptions = ["Low", "Medium", "High"];

const reminderOptions = [
  { label: "No Reminder", value: "none" },
  { label: "Immediately + After 1 Day", value: "1_day" },
  { label: "Immediately + After 5 Days", value: "5_day" },
  { label: "Immediately + After 15 Days", value: "15_day" },
];

// Map the reminder value to a numeric count for backend
const reminderValueMap = {
  none: 0,
  "1_day": 1,
  "5_day": 5,
  "15_day": 15,
};

const ManageTasks = () => {
  const [task, setTask] = useState({
    title: "",
    description: "",
    assignedTo: "",
    department: "", // auto-filled
    priority: "Medium",
    dueDate: "",
    reminderCount: "none", // store as string for select
  });

  const [createTask, { isLoading }] = useCreateTaskMutation();

  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
  } = useGetEmployeesWithDepartmentsQuery();

  useEffect(() => {
    if (employeesError) {
      toast.error("Failed to fetch employees");
    }
  }, [employeesError]);

  const handleAssignmentChange = (e) => {
    const selectedValue = e?.target?.value || e?.value || "";
    const selectedEmp = employees.find((emp) => emp.value === selectedValue);

    setTask((prev) => ({
      ...prev,
      assignedTo: selectedValue,
      department: selectedEmp ? selectedEmp.departmentName : "",
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTask((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Convert reminderCount to numeric for backend
    const payload = {
      ...task,
      reminderCount: reminderValueMap[task.reminderCount] || 0,
    };

    try {
      await createTask(payload).unwrap();
      toast.success("Task created & email sent.");

      setTask({
        title: "",
        description: "",
        assignedTo: "",
        department: "",
        priority: "Medium",
        dueDate: "",
        reminderCount: "none",
      });
    } catch (error) {
      toast.error(error?.data?.message || "Failed to create task.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-8 py-6">
      <Title title="Create New Task" align="center" />

      <form
        onSubmit={handleSubmit}
        className="max-w-6xl mx-auto mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm"
      >
        {/* ================= HEADER ================= */}
        <div className="px-8 py-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">
            Task Information
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Fill in the details below to create and assign a task
          </p>
        </div>

        {/* ================= BODY ================= */}
        <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT – FORM */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Task Title
              </label>
              <input
                type="text"
                name="title"
                value={task.title}
                onChange={handleChange}
                placeholder="e.g. Prepare monthly report"
                required
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                name="description"
                value={task.description}
                onChange={handleChange}
                placeholder="Add more context about the task"
                rows={4}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="w-full">
                <SelectField
                  label="Assign To"
                  name="assignedTo"
                  options={employees}
                  value={task.assignedTo}
                  onChange={handleAssignmentChange}
                  required
                  disabled={employeesLoading}
                  className="w-full"
                />
              </div>

              <div className="w-full">
                <label className="block font-semibold mb-1 text-sm text-slate-700">
                  Department
                </label>
                <div className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 h-[42px] flex items-center">
                  {task.department || (
                    <span className="text-slate-400 italic text-sm">
                      Auto-filled...
                    </span>
                  )}
                </div>
              </div>

              <SelectField
                label="Priority"
                name="priority"
                options={priorityOptions}
                value={task.priority}
                onChange={handleChange}
              />

              <SelectField
                label="Email Reminder"
                name="reminderCount"
                options={reminderOptions}
                value={task.reminderCount}
                onChange={handleChange}
              />

              <DateTimePicker
                label="Due Date"
                name="dueDate"
                value={task.dueDate}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* RIGHT – SUMMARY */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4 h-fit">
            <h3 className="text-sm font-semibold text-slate-700 uppercase">
              Summary
            </h3>

            <SummaryItem label="Title" value={task.title} />
            <SummaryItem label="Assigned To" value={task.assignedTo} />
            {task.department && (
              <SummaryItem label="Department" value={task.department} />
            )}

            <div>
              <p className="text-xs text-slate-500 mb-1">Priority</p>
              <Badge
                label={task.priority}
                variant={
                  task.priority === "High"
                    ? "danger"
                    : task.priority === "Medium"
                    ? "warning"
                    : "neutral"
                }
              />
            </div>

            <SummaryItem label="Due Date" value={task.dueDate} />
            <SummaryItem
              label="Reminder Emails"
              value={
                task.reminderCount !== "none"
                  ? `${reminderValueMap[task.reminderCount]} time(s)`
                  : "No reminder"
              }
            />
          </div>
        </div>

        {/* ================= FOOTER ================= */}
        <div className="px-8 py-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            className="px-5 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg text-white font-medium
              ${
                isLoading
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-sky-600 hover:bg-sky-700"
              }
            `}
          >
            {isLoading ? "Creating..." : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ---------------- SMALL COMPONENT ---------------- */
const SummaryItem = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-sm font-medium text-slate-800">{value || "—"}</p>
  </div>
);

export default ManageTasks;

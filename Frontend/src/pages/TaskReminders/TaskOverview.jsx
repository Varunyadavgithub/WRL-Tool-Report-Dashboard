import { useState } from "react";
import { useSelector } from "react-redux";
import Title from "../../components/ui/Title";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import RadioButton from "../../components/ui/RadioButton";
import Badge from "../../components/ui/Badge";
import { useGetTasksQuery } from "../../redux/api/taskReminder.js";
import { baseURL } from "../../assets/assets";
import axios from "axios";

/* ---------------- BADGE VARIANTS ---------------- */
const getStatusVariant = (status) => {
  if (status === "Completed") return "success";
  if (status === "Pending") return "warning";
  if (status === "In Progress") return "info";
  return "neutral";
};

const getPriorityVariant = (priority) => {
  if (priority === "High") return "danger";
  if (priority === "Medium") return "warning";
  return "neutral";
};

const TaskOverview = () => {
  /* ---------------- CURRENT USER ---------------- */
  const { user } = useSelector((store) => store.auth);
  const currentUserId = user?.employee_id || user?.id || "";
  const currentUserName = user?.name || "";

  /* ---------------- FETCH TASKS ---------------- */
  const { data, isLoading, error } = useGetTasksQuery();

  /* ---------------- FILTER STATE ---------------- */
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    fromDate: "",
    toDate: "",
    view: "all",
  });

  /* ---------------- NORMALIZE BACKEND DATA ---------------- */
  const [localTasks, setLocalTasks] = useState(
    data?.data?.map((task) => ({
      TaskId: task.TaskId,
      Title: task.Title,
      assignedToId: task.employee_id,
      assignedToName: task.employee_name,
      CreatedBy: task.CreatedBy || "SYSTEM",
      Priority: task.Priority,
      Status: task.Status === "Open" ? "Pending" : task.Status,
      DueDate: new Date(task.DueDate).toISOString().split("T")[0],
      ReminderCount: task.ReminderCount || 0,
    })) || []
  );

  // Sync local tasks if data changes
  useState(() => {
    if (data?.data) {
      setLocalTasks(
        data.data.map((task) => ({
          TaskId: task.TaskId,
          Title: task.Title,
          assignedToId: task.employee_id,
          assignedToName: task.employee_name,
          CreatedBy: task.CreatedBy || "SYSTEM",
          Priority: task.Priority,
          Status: task.Status === "Open" ? "Pending" : task.Status,
          DueDate: new Date(task.DueDate).toISOString().split("T")[0],
          ReminderCount: task.ReminderCount || 0,
        }))
      );
    }
  }, [data]);

  /* ---------------- HANDLERS ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusClick = async (taskId, currentStatus) => {
    // Determine next status
    let nextStatus =
      currentStatus === "Pending"
        ? "In Progress"
        : currentStatus === "In Progress"
        ? "Completed"
        : "Completed";

    // Optimistic UI update
    setLocalTasks((prev) =>
      prev.map((task) =>
        task.TaskId === taskId ? { ...task, Status: nextStatus } : task
      )
    );

    try {
      // Axios PATCH request
      await axios.patch(`${baseURL}task-reminders/${taskId}/status`, {
        status: nextStatus,
      });
    } catch (err) {
      console.error("Failed to update status:", err);

      // Revert UI on failure
      setLocalTasks((prev) =>
        prev.map((task) =>
          task.TaskId === taskId ? { ...task, Status: currentStatus } : task
        )
      );
    }
  };

  /* ---------------- FILTER LOGIC ---------------- */
  const isRelatedToMe = (task) =>
    task.assignedToId === currentUserId || task.CreatedBy === currentUserId;

  const filteredTasks = localTasks.filter((task) => {
    const taskDate = new Date(task.DueDate);

    if (filters.view === "assigned" && task.assignedToId !== currentUserId)
      return false;

    if (filters.view === "created" && task.CreatedBy !== currentUserId)
      return false;

    return (
      (!filters.status || task.Status === filters.status) &&
      (!filters.priority || task.Priority === filters.priority) &&
      (!filters.fromDate || taskDate >= new Date(filters.fromDate)) &&
      (!filters.toDate || taskDate <= new Date(filters.toDate))
    );
  });

  /* ---------------- LOADING / ERROR ---------------- */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading tasks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Failed to load tasks
      </div>
    );
  }

  /* ---------------- UI (UNCHANGED) ---------------- */
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-5">
      <Title title="Task Overview" align="center" />

      {/* ---------------- FILTER PANEL ---------------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 my-6">
        <div className="flex gap-6 mb-6">
          <RadioButton
            name="view"
            value="all"
            label="All Tasks"
            checked={filters.view === "all"}
            onChange={handleChange}
          />
          <RadioButton
            name="view"
            value="assigned"
            label="Assigned To Me"
            checked={filters.view === "assigned"}
            onChange={handleChange}
          />
          <RadioButton
            name="view"
            value="created"
            label="Created By Me"
            checked={filters.view === "created"}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SelectField
            label="Status"
            name="status"
            options={["Pending", "In Progress", "Completed"]}
            value={filters.status}
            onChange={handleChange}
          />
          <SelectField
            label="Priority"
            name="priority"
            options={["Low", "Medium", "High"]}
            value={filters.priority}
            onChange={handleChange}
          />
          <DateTimePicker
            label="From Date"
            name="fromDate"
            value={filters.fromDate}
            onChange={handleChange}
          />
          <DateTimePicker
            label="To Date"
            name="toDate"
            value={filters.toDate}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* ---------------- FIXED TASK TABLE ---------------- */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-y-auto max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 sticky top-0">
            <tr>
              <th className="px-6 py-4 text-left text-slate-200">Task</th>
              <th className="px-6 py-4 text-left text-slate-200">
                Assigned To
              </th>
              <th className="px-6 py-4 text-center text-slate-200">Priority</th>
              <th className="px-6 py-4 text-center text-slate-200">Due Date</th>
              <th className="px-6 py-4 text-center text-slate-200">Reminder</th>
              <th className="px-6 py-4 text-center text-slate-200">Status</th>
            </tr>
          </thead>

          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-slate-400">
                  No tasks found
                </td>
              </tr>
            ) : (
              filteredTasks.map((task, idx) => (
                <tr
                  key={task.TaskId}
                  className={`border-t border-slate-200 ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                  } hover:bg-slate-100`}
                >
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {task.Title}
                  </td>

                  <td className="px-6 py-4 text-slate-700">
                    {task.assignedToName || task.assignedToId}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <Badge
                      label={task.Priority}
                      variant={getPriorityVariant(task.Priority)}
                    />
                  </td>

                  <td className="px-6 py-4 text-center text-slate-600">
                    {task.DueDate}
                  </td>

                  <td className="px-6 py-4 text-center text-slate-500">
                    {task.ReminderCount}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() =>
                        handleStatusClick(task.TaskId, task.Status)
                      }
                      className="inline-block"
                    >
                      <Badge
                        label={task.Status}
                        variant={getStatusVariant(task.Status)}
                      />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskOverview;

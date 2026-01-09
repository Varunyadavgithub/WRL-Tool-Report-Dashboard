import { useState } from "react";
import Title from "../../components/ui/Title";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import RadioButton from "../../components/ui/RadioButton";
import Badge from "../../components/ui/Badge";

/* ---------------- CURRENT USER ---------------- */
const currentUser = "Self";

/* ---------------- INITIAL TASK DATA ---------------- */
const initialTasks = [
  {
    id: 1,
    title: "Prepare Monthly Report",
    assignedTo: ["Self"],
    createdBy: "John",
    priority: "High",
    status: "Pending",
    dueDate: "2026-01-10",
    reminder: "2026-01-09 10:00",
  },
  {
    id: 2,
    title: "Client Follow-up",
    assignedTo: ["Jane"],
    createdBy: "Self",
    priority: "Medium",
    status: "In Progress",
    dueDate: "2026-01-12",
    reminder: "2026-01-11 09:00",
  },
  {
    id: 3,
    title: "Personal Learning Task",
    assignedTo: ["Self"],
    createdBy: "Self",
    priority: "Low",
    status: "Pending",
    dueDate: "2026-01-15",
    reminder: "2026-01-14 08:00",
  },
];

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
  const [tasks, setTasks] = useState(initialTasks);

  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    fromDate: "",
    toDate: "",
    view: "all",
  });

  /* ---------------- HANDLERS ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleMarkCompleted = (taskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: "Completed" } : task
      )
    );
  };

  /* ---------------- FILTER LOGIC ---------------- */
  const isRelatedToMe = (task) =>
    task.assignedTo.includes(currentUser) || task.createdBy === currentUser;

  const filteredTasks = tasks.filter((task) => {
    const taskDate = new Date(task.dueDate);

    if (!isRelatedToMe(task)) return false;
    if (filters.view === "assigned" && !task.assignedTo.includes(currentUser))
      return false;
    if (filters.view === "created" && task.createdBy !== currentUser)
      return false;

    return (
      (!filters.status || task.status === filters.status) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.fromDate || taskDate >= new Date(filters.fromDate)) &&
      (!filters.toDate || taskDate <= new Date(filters.toDate))
    );
  });

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

      {/* ---------------- TASK TABLE ---------------- */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-6 py-4 text-left text-slate-200">Task</th>
              <th className="px-6 py-4 text-left text-slate-200">Created By</th>
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
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  No tasks found
                </td>
              </tr>
            ) : (
              filteredTasks.map((task, idx) => {
                const canComplete =
                  task.assignedTo.includes(currentUser) &&
                  task.status !== "Completed";

                return (
                  <tr
                    key={task.id}
                    className={`border-t border-slate-200 ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                    } hover:bg-slate-100`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {task.title}
                    </td>

                    <td className="px-6 py-4 text-slate-700">
                      {task.createdBy}
                    </td>

                    <td className="px-6 py-4 text-slate-700">
                      {task.assignedTo.join(", ")}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <Badge
                        label={task.priority}
                        variant={getPriorityVariant(task.priority)}
                      />
                    </td>

                    <td className="px-6 py-4 text-center text-slate-600">
                      {task.dueDate}
                    </td>

                    <td className="px-6 py-4 text-center text-slate-500">
                      {task.reminder}
                    </td>

                    <td className="px-6 py-4 text-center">
                      {canComplete ? (
                        <button
                          onClick={() => handleMarkCompleted(task.id)}
                          className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition"
                        >
                          Mark as Completed
                        </button>
                      ) : (
                        <Badge
                          label={task.status}
                          variant={getStatusVariant(task.status)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskOverview;

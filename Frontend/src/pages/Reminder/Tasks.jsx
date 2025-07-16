import Title from "../../components/common/Title";
import { FaPlus } from "react-icons/fa6";
import { CiFilter } from "react-icons/ci";
import { useEffect, useMemo, useState } from "react";
import { CiSearch } from "react-icons/ci";
import { GoSortAsc } from "react-icons/go";
import { LuUser } from "react-icons/lu";
import { IoCalendarOutline } from "react-icons/io5";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import NewReminderModal from "../../components/common/NewReminderModal";
import axios from "axios";
import toast from "react-hot-toast";
import TaskModal from "../../components/common/TaskModal";
import { baseURL } from "../../assets/assets";

const statuses = [
  "all",
  "pending",
  "in_progress",
  "escalated",
  "completed",
  "overdue",
];

const priorities = ["all", "low", "medium", "high", "critical"];

const Tasks = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [sortBy, setSortBy] = useState("created");

  const [isNewReminderModalOpen, setIsNewReminderModalOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  const filteredAndSortedReminders = useMemo(() => {
    let filtered = reminders.filter((reminder) => {
      const matchesSearch =
        reminder.Title?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
        false ||
        reminder.Description?.toLowerCase()?.includes(
          searchTerm.toLowerCase()
        ) ||
        false;

      const matchesDepartment =
        selectedDepartment === "all" ||
        reminder.Department === selectedDepartment;

      const matchesStatus =
        selectedStatus === "all" || reminder.Status === selectedStatus;

      const matchesPriority =
        selectedPriority === "all" || reminder.Priority === selectedPriority;

      return (
        matchesSearch && matchesDepartment && matchesStatus && matchesPriority
      );
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "deadline":
          return (
            new Date(a.SchldDate).getTime() - new Date(b.SchldDate).getTime()
          );

        case "priority":
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

          return (
            priorityOrder[a.Priority.toLowerCase()] -
            priorityOrder[b.Priority.toLowerCase()]
          );

        case "created":

        default:
          return (
            new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
          );
      }
    });
    return filtered;
  }, [
    reminders,
    searchTerm,
    selectedDepartment,
    selectedStatus,
    selectedPriority,
    sortBy,
  ]);

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/departments`);
      if (Array.isArray(res.data)) {
        const formatted = res.data.map((item) => ({
          label: item.Name,
          value: item.DeptCode.toString(),
        }));
        setDepartments(formatted);
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to fetch departments.");
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await axios.get(`${baseURL}reminder/`);

      if (res?.data?.success) {
        setReminders(res.data.reminders || []);
      }
    } catch (error) {
      console.error("Failed to fetch reminders:", error);

      toast.error("Failed to fetch reminders.");
    }
  };

  const handleAddNewReminder = async (newReminder) => {
    try {
      const res = await axios.post(`${baseURL}reminder/`, newReminder);

      if (res.data.success) {
        fetchReminders();
        setIsNewReminderModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to create reminder:", error);
    }
  };

  const onSearchChange = (value) => setSearchTerm(value);
  const onDepartmentChange = (value) => setSelectedDepartment(value);
  const onStatusChange = (value) => setSelectedStatus(value);
  const onPriorityChange = (value) => setSelectedPriority(value);
  const onSortChange = (value) => setSortBy(value);

  useEffect(() => {
    fetchDepartments();
    fetchReminders();
  }, []);

  const onTaskComplete = async () => {
    try {
      const res = await axios.patch(
        `${baseURL}reminder/${selectedTask.Id}/complete`,
        {
          status: "Sent", // Or whatever status indicates completion
        }
      );

      if (res.data.success) {
        // Refresh reminders after completion
        fetchReminders();

        // Close the task modal
        setSelectedTask(null);

        toast.success("Reminder marked as completed");
      }
    } catch (error) {
      console.error("Failed to complete reminder:", error);
      toast.error("Failed to complete reminder");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Manage Tasks" align="center" />

      {/* Header Stats */}
      <div className="flex items-center justify-center mt-4 gap-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: "Total", value: reminders.length, color: "text-gray-900" },
            {
              label: "Pending",
              value: reminders.filter((r) => r.Status === "Pending").length,
              color: "text-yellow-600",
            },
            {
              label: "In Progress",
              value: reminders.filter((r) => r.Status === "In Progress").length,
              color: "text-blue-600",
            },
            {
              label: "Escalated",
              value: reminders.filter((r) => r.Status === "Escalated").length,
              color: "text-red-600",
            },
            {
              label: "Sent",
              value: reminders.filter((r) => r.Status === "Sent").length,
              color: "text-green-600",
            },
            {
              label: "Overdue",
              value: reminders.filter((r) => new Date(r.SchldDate) < new Date())
                .length,
              color: "text-red-600",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsNewReminderModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="h-4 w-4" />
            <span>New Reminder</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-4">
        <div className="flex items-center space-x-4 mb-4">
          <CiFilter className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">
            Filters & Search
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search Input */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <CiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search reminders..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Department Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {departments.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === "all"
                    ? "All Statuses"
                    : status.replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => onPriorityChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority === "all"
                    ? "All Priorities"
                    : priority.charAt(0).toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <div className="relative">
              <GoSortAsc className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="created">Created Date</option>
                <option value="deadline">Scheduled Date</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Reminder List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-4">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {filteredAndSortedReminders.length} Reminders
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {filteredAndSortedReminders.length === reminders.length
              ? "Showing all reminders"
              : `Filtered from ${reminders.length} total reminders`}
          </p>
        </div>
        <div className="p-6">
          {filteredAndSortedReminders.length > 0 ? (
            <div className="space-y-4">
              {filteredAndSortedReminders.map((reminder) => (
                <div
                  key={reminder.Id}
                  onClick={() => setSelectedTask(reminder)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {reminder.Title}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            reminder.Priority === "critical"
                              ? "bg-red-100 text-red-800"
                              : reminder.Priority === "high"
                              ? "bg-yellow-100 text-yellow-800"
                              : reminder.Priority === "medium"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {reminder.Priority}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {reminder.Description}
                      </p>
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <HiOutlineOfficeBuilding className="h-4 w-4" />
                          <span>{reminder.Department}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <IoCalendarOutline className="h-4 w-4" />
                          <span>
                            Scheduled{" "}
                            {new Date(reminder.SchldDate).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <LuUser className="h-4 w-4" />
                          <span>{reminder.RecptMail}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          reminder.Status === "Sent"
                            ? "bg-green-100 text-green-800"
                            : reminder.Status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {reminder.Status}
                      </span>
                      <p className="text-xs text-gray-500 mt-2">
                        Created{" "}
                        {new Date(reminder.CreatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-5xl mb-4">🔔</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No reminders found
              </h3>
              <p className="text-gray-500">
                {searchTerm ||
                selectedDepartment !== "all" ||
                selectedStatus !== "all" ||
                selectedPriority !== "all"
                  ? "Try adjusting your filters to see more reminders."
                  : "No reminders have been created yet."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Reminder Modal */}
      <NewReminderModal
        isOpen={isNewReminderModalOpen}
        onClose={() => setIsNewReminderModalOpen(false)}
        onSubmit={handleAddNewReminder}
        departments={departments}
        priorities={priorities}
      />

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          onMarkComplete={onTaskComplete}
        />
      )}
    </div>
  );
};

export default Tasks;

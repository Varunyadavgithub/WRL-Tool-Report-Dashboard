import {
  LuX,
  LuCalendarDays,
  LuClock,
  LuUser,
  LuArrowUp,
  LuMail,
  LuHistory,
} from "react-icons/lu";
import { FiCheckCircle, FiAlertTriangle } from "react-icons/fi";

const statusConfig = {
  pending: {
    icon: LuClock,
    color: "text-gray-600",
    bg: "bg-gray-100",
    label: "Pending",
  },
  in_progress: {
    icon: LuClock,
    color: "text-primary-600",
    bg: "bg-primary-100",
    label: "In Progress",
  },
  escalated: {
    icon: LuArrowUp,
    color: "text-warning-600",
    bg: "bg-warning-100",
    label: "Escalated",
  },
  completed: {
    icon: FiCheckCircle,
    color: "text-success-600",
    bg: "bg-success-100",
    label: "Completed",
  },
  overdue: {
    icon: FiAlertTriangle,
    color: "text-error-600",
    bg: "bg-error-100",
    label: "Overdue",
  },
};

const TaskModal = ({ task, isOpen, onClose, onMarkComplete, onEscalate }) => {
  if (!isOpen) return null;

  const config = statusConfig[task.Status] || statusConfig["pending"];
  const Icon = config.icon;
  const isOverdue = new Date() > task.deadline && task.Status !== "completed";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className={`${config.bg} rounded-lg p-3`}>
              <Icon className={`h-6 w-6 ${config.color}`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{task.Title}</h2>
              <p className="text-gray-500">
                {task.Department} • Assigned to {task.RecptMail}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LuX className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Priority */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}
              >
                {config.label}
              </span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  task.Priority === "critical"
                    ? "bg-red-100 text-red-800"
                    : task.Priority === "high"
                    ? "bg-yellow-100 text-yellow-800"
                    : task.Priority === "medium"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {task.Priority} priority
              </span>
            </div>
            {task.Status !== "completed" && (
              <div className="flex space-x-3">
                <button
                  onClick={() => onEscalate(task.Id)}
                  className="px-4 py-2 bg-warning-100 text-warning-700 rounded-lg hover:bg-warning-200 transition-colors"
                >
                  Manual Escalate
                </button>
                <button
                  onClick={() => onMarkComplete(task.Id)}
                  className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
                >
                  Mark Complete
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Description
            </h3>
            <p className="text-gray-700 leading-relaxed">{task.Description}</p>
          </div>

          {/* Task Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Task Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <LuCalendarDays className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Deadline</p>
                    <p
                      className={`font-medium ${
                        isOverdue ? "text-error-600" : "text-gray-900"
                      }`}
                    >
                      {/* {format(task.deadline, "MMMM dd, yyyy at HH:mm")} */}
                      Today
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <LuUser className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Created by</p>
                    <p className="font-medium text-gray-900">
                      {/* {task.createdBy.name} */} Varun
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <LuClock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium">
                      <span className="text-gray-900">
                        {task.CreatedAt.split("T")[0]}
                      </span>{" "}
                      <span className="text-blue-600">
                        {task.CreatedAt.split("T")[1]
                          ?.replace("Z", "")
                          .slice(0, 8)}{" "}
                      </span>
                    </p>
                  </div>
                </div>
                {task.currentAssignee && (
                  <div className="flex items-center space-x-3">
                    <LuUser className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Current Assignee</p>
                      <p className="font-medium text-gray-900">
                        {task.currentAssignee.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Escalation History */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Escalation History
              </h3>
              {/* {task.escalationHistory.length > 0 ? (
                <div className="space-y-3">
                  {task.escalationHistory.map((escalation) => (
                    <div
                      key={escalation.id}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <LuHistory className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Escalated from Level {escalation.fromLevel} to Level{" "}
                          {escalation.toLevel}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(
                            escalation.escalatedAt,
                            "MMM dd, yyyy at HH:mm"
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {escalation.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No escalations yet</p>
              )} */}
            </div>
          </div>

          {/* Email Reminders */}
          <div>
            {/* <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Email Reminders
            </h3> */}
            {/* {task.reminders.length > 0 ? (
              <div className="space-y-3">
                {task.reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-4 bg-primary-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <LuMail className="h-5 w-5 text-primary-600" />
                      <div>
                        <p className="font-medium text-gray-900">
                          Reminder sent to Level {reminder.level}
                        </p>
                        <p className="text-sm text-gray-600">
                          {reminder.recipient.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(reminder.sentAt, "MMM dd, yyyy at HH:mm")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        reminder.responded
                          ? "bg-success-100 text-success-800"
                          : "bg-warning-100 text-warning-800"
                      }`}
                    >
                      {reminder.responded ? "Responded" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No reminders sent yet</p>
            )} */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
import Title from "../../components/common/Title";
import { FaCheckSquare, FaClock, FaCalendar } from "react-icons/fa";
import { IoMdTrendingUp } from "react-icons/io";
import { FaArrowUp } from "react-icons/fa6";
import { FiCheckCircle, FiAlertTriangle } from "react-icons/fi";

const Dashboard = () => {
  const statusConfig = {
    pending: { icon: FaClock, color: "text-gray-800", bg: "bg-gray-100" },
    in_progress: {
      icon: FaClock,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    escalated: {
      icon: FaArrowUp,
      color: "text-yellow-600",
      bg: "bg-yellow-100",
    },
    completed: {
      icon: FiCheckCircle,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    overdue: {
      icon: FiAlertTriangle,
      color: "text-red-600",
      bg: "bg-red-100",
    },
  };

  const mockUsers = [
    {
      id: "u1",
      name: "Rajesh Sharma",
      email: "rajesh.sharma@western.com",
      department: "Manufacturing",
      level: 1,
      avatar:
        "https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=150",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "u2",
      name: "Priya Patel",
      email: "priya.patel@western.com",
      department: "Manufacturing",
      level: 2,
      avatar:
        "https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&cs=tinysrgb&w=150",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "u3",
      name: "Amit Kumar",
      email: "amit.kumar@western.com",
      department: "Manufacturing",
      level: 3,
      avatar:
        "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "u4",
      name: "Sunita Gupta",
      email: "sunita.gupta@western.com",
      department: "Production",
      level: 1,
      avatar:
        "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "u5",
      name: "Vikram Singh",
      email: "vikram.singh@western.com",
      department: "Production",
      level: 2,
      avatar:
        "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "u6",
      name: "Kavita Mehta",
      email: "kavita.mehta@western.com",
      department: "Quality",
      level: 1,
      avatar:
        "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=150",
      isActive: true,
      createdAt: new Date(),
    },
  ];

  const tasks = [
    {
      id: "t1",
      title: "Submit Daily Production Report",
      description:
        "Complete and submit the daily production metrics report for Manufacturing Line A",
      department: "Manufacturing",
      status: "escalated",
      priority: "high",
      assignedToLevel: 2,
      currentAssignee: mockUsers[1],
      createdBy: mockUsers[0],
      deadline: new Date(),
      createdAt: new Date(),
      reminders: [
        {
          id: "r1",
          level: 3,
          sentAt: new Date(),
          recipient: mockUsers[2],
          responded: false,
        },
      ],
      escalationHistory: [
        {
          id: "e1",
          fromLevel: 3,
          toLevel: 2,
          escalatedAt: new Date(),
          reason: "No response after 24 hours",
          escalatedBy: "system",
        },
      ],
    },
    {
      id: "t2",
      title: "Quality Inspection Checklist",
      description: "Perform quality inspection on Batch #QC-2024-001",
      department: "Quality",
      status: "pending",
      priority: "critical",
      assignedToLevel: 3,
      createdBy: mockUsers[5],
      deadline: new Date(),
      createdAt: new Date(),
      reminders: [],
      escalationHistory: [],
    },
    {
      id: "t3",
      title: "Equipment Maintenance Schedule",
      description: "Update preventive maintenance schedule for Q2 2025",
      department: "Production",
      status: "completed",
      priority: "medium",
      assignedToLevel: 2,
      currentAssignee: mockUsers[4],
      createdBy: mockUsers[3],
      deadline: new Date(),
      createdAt: new Date(),
      completedAt: new Date(),
      reminders: [
        {
          id: "r2",
          level: 2,
          sentAt: new Date(),
          recipient: mockUsers[4],
          responded: true,
          responseAt: new Date(),
        },
      ],
      escalationHistory: [],
    },
    {
      id: "t4",
      title: "Invoice Processing Verification",
      description: "Verify and process vendor invoices for December 2024",
      department: "Accounts",
      status: "overdue",
      priority: "high",
      assignedToLevel: 3,
      createdBy: mockUsers[0],
      deadline: new Date(),
      createdAt: new Date(),
      reminders: [
        {
          id: "r3",
          level: 3,
          sentAt: new Date(),
          recipient: mockUsers[2],
          responded: false,
        },
      ],
      escalationHistory: [],
    },
    {
      id: "t5",
      title: "Safety Protocol Review",
      description: "Review and update safety protocols for manufacturing floor",
      department: "Manufacturing",
      status: "in_progress",
      priority: "medium",
      assignedToLevel: 2,
      currentAssignee: mockUsers[1],
      createdBy: mockUsers[0],
      deadline: new Date(),
      createdAt: new Date(),
      reminders: [],
      escalationHistory: [],
    },
  ];

  const escalationData = [
    { level: "Level 3", count: 4 },
    { level: "Level 2", count: 2 },
    { level: "Level 1", count: 4 },
  ];

  const maxCount = Math.max(...escalationData.map((d) => d.count));
  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Reminder Dashboard" align="center" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
        {/* Total Tasks Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Tasks
              </p>

              <p className="text-3xl font-bold text-gray-900">10</p>

              <p className="text-sm mt-2 text-green-600">
                +12% from last month
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <FaCheckSquare className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Pending Tasks Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                Pending Tasks
              </p>

              <p className="text-3xl font-bold text-gray-900">6</p>

              <p className="text-sm mt-2 text-gray-500">+3 since yesterday</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <FaClock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Escalated Tasks Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                Escalated
              </p>

              <p className="text-3xl font-bold text-gray-900">3</p>

              <p className="text-sm mt-2 text-green-600">-2 from yesterday</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <IoMdTrendingUp className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        {/* Average Resolution Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                Avg Resolution
              </p>

              <p className="text-3xl font-bold text-gray-900">3.5 days</p>

              <p className="text-sm mt-2 text-green-600">
                -0.5 days improvement
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <FaCalendar className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        {/* Recent Tasks - Takes 2/3 of the space */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Recent Tasks
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Latest task activities and updates
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {tasks.slice(0, 5).map((task) => {
                const config = statusConfig[task.status];
                const Icon = config.icon;

                return (
                  <div
                    key={task.id}
                    className="p-6 hover:bg-gray-50 transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`${config.bg} rounded-lg p-2`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {task.title}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            {task.department} • Level {task.assignedToLevel}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            task.priority === "critical"
                              ? "bg-red-100 text-red-800"
                              : task.priority === "high"
                              ? "bg-yellow-100 text-yellow-800"
                              : task.priority === "medium"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {task.priority}
                        </span>
                        {/* <p className="text-xs text-gray-500 mt-1">
                          {task.createdAt}
                        </p> */}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>{" "}
        </div>

        {/* Escalation Chart - Takes 1/3 of the space */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Escalation Overview
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Current task distribution by hierarchy level
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <IoMdTrendingUp className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {escalationData.map((item, index) => (
                  <div key={item.level} className="flex items-center space-x-4">
                    <div className="w-16 text-sm font-medium text-gray-600">
                      {item.level}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-900">
                          {item.count} tasks
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round((item.count / maxCount) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`
                    h-2 rounded-full transition-all duration-300 
                    ${
                      item.level === "Level 3"
                        ? "bg-blue-500"
                        : item.level === "Level 2"
                        ? "bg-yellow-500"
                        : item.level === "Level 1"
                        ? "bg-red-500"
                        : "bg-gray-500"
                    }
                  `}
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Auto-Escalation Active
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      24-hour intervals
                    </p>
                  </div>
                  <div className="animate-pulse">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
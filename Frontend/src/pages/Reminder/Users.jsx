import { useState } from "react";
import Title from "../../components/common/Title";
import { FaRegCircleUser } from "react-icons/fa6";

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

const Users = () => {
  const [users] = useState(mockUsers);

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Manage Users" align="center" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-4">
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    User
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Department
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Level
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full flex items-center justify-center">
                            <FaRegCircleUser className="text-black text-4xl rounded-full" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.name}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700">
                      {user.department}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.level === 1
                            ? "bg-red-100 text-red-800"
                            : user.level === 2
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        Level {user.level}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;

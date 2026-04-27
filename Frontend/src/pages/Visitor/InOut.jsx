import { useEffect, useState, useRef } from "react";
import {
  FaSignInAlt,
  FaSignOutAlt,
  FaUser,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import {
  MdPhone,
  MdEmail,
  MdBusiness,
  MdLocationOn,
  MdAccessTime,
} from "react-icons/md";
import { CgProfile } from "react-icons/cg";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import { useNavigate } from "react-router-dom";
import {formatISODateString}  from "../../utils/dateUtils.js";

/* ==================== Counter Card (Dashboard-style) ==================== */
const CounterCard = ({ icon: Icon, title, value, color }) => (
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

const InOut = () => {
  const [loading, setLoading] = useState(false);
  const [visitorLogs, setVisitorLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const navigate = useNavigate();

  // Refs for Scan Inputs
  const scanInRef = useRef(null);
  const scanOutRef = useRef(null);

  // Ask notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Success Sound
  const playSuccessSound = () => {
    const audio = new Audio("/sounds/success.mp3");
    audio.play().catch(() => {});
  };

  // Show browser notification
  const showNotification = (title, message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: "/logo192.png",
      });
    }
  };

  // Fetch visitor logs
  const fetchVisitorLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}visitor/logs`);
      if (res?.data?.success) {
        setVisitorLogs(res.data.data);
      } else {
        toast.error(res?.data?.message || "Failed to fetch visitor logs");
      }
    } catch (error) {
      toast.error("Failed to fetch visitor logs");
    } finally {
      setLoading(false);
    }
  };

  // Periodic check for inside visitors
  useEffect(() => {
    const checkVisitorsInside = async () => {
      try {
        const res = await axios.get(`${baseURL}visitor/logs`);
        if (res?.data?.success) {
          const inside = res.data.data.filter(
            (v) => v.check_in_time && !v.check_out_time,
          );
          if (inside.length > 0) {
            const message = inside
              .map((v) => `${v.visitor_name} (${v.pass_id})`)
              .join(", ");

            showNotification(
              "Visitors still inside",
              `The following visitors have not checked out: ${message}`,
            );

            await axios.post(`${baseURL}visitor/notify-inside-visitors`);
          }
        }
      } catch {}
    };

    const interval = setInterval(checkVisitorsInside, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle IN/OUT event
  const handleVisitorActionForCard = async (type, passId) => {
    if (!passId.trim()) {
      toast.error("Pass ID is missing.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${baseURL}visitor/${type}`, { passId });

      if (res?.data?.success) {
        playSuccessSound();

        toast.success(
          `Visitor ${
            type === "in" ? "checked in" : "checked out"
          } successfully!`,
        );

        showNotification(
          type === "in" ? "Visitor Checked In" : "Visitor Checked Out",
          `Pass ID: ${passId}`,
        );

        await fetchVisitorLogs();
      } else {
        toast.error(res?.data?.message || "Failed to update visitor status.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitorLogs();
    setTimeout(() => scanInRef.current?.focus(), 500);
  }, []);

  // Search filter
  const filteredVisitors = visitorLogs.filter((visitor) => {
    const query = searchTerm.toLowerCase();
    return (
      visitor.visitor_name?.toLowerCase().includes(query) ||
      visitor.pass_id?.toLowerCase().includes(query) ||
      visitor.department_name?.toLowerCase().includes(query) ||
      visitor.department_to_visit?.toLowerCase().includes(query)
    );
  });

  // Visitor counts
  const totalVisitors = filteredVisitors.length;
  const currentlyIn = filteredVisitors.filter(
    (v) => v.check_in_time && !v.check_out_time,
  ).length;
  const currentlyOut = filteredVisitors.filter((v) => v.check_out_time).length;

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full relative">
      {/* Page Title */}
      <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
        Manage Visitor
      </h1>

      {/* Search Bar */}
      <div className="max-w-md mx-auto mb-6">
        <input
          type="text"
          placeholder="Search by name, pass ID, department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm shadow-sm 
            bg-white text-gray-800
            placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Dashboard-Style Counter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <CounterCard
          icon={FaUsers}
          title="Total Visitors"
          value={totalVisitors}
          color="bg-blue-500"
        />
        <CounterCard
          icon={FaSignInAlt}
          title="Currently In"
          value={currentlyIn}
          color="bg-green-500"
        />
        <CounterCard
          icon={FaSignOutAlt}
          title="Checked Out"
          value={currentlyOut}
          color="bg-red-500"
        />
      </div>

      {/* Scan In / Out */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Scan IN Card */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
            <FaSignInAlt className="text-green-500" /> Scan IN
          </h3>
          <div className="flex gap-2">
            <input
              ref={scanInRef}
              type="text"
              placeholder="Scan Pass ID for IN"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVisitorActionForCard("in", e.target.value);
                  e.target.value = "";
                }
              }}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm 
                bg-white text-gray-800
                placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              onClick={(e) => {
                const input = e.target
                  .closest("[data-scan-card]")
                  .querySelector("input");
                handleVisitorActionForCard("in", input.value);
                input.value = "";
              }}
              className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-green-600 transition cursor-pointer"
            >
              IN
            </button>
          </div>
        </div>

        {/* Scan OUT Card */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
            <FaSignOutAlt className="text-red-500" /> Scan OUT
          </h3>
          <div className="flex gap-2">
            <input
              ref={scanOutRef}
              type="text"
              placeholder="Scan Pass ID for OUT"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVisitorActionForCard("out", e.target.value);
                  e.target.value = "";
                }
              }}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm 
                bg-white text-gray-800
                placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              onClick={(e) => {
                const input = e.target
                  .closest("[data-scan-card]")
                  .querySelector("input");
                handleVisitorActionForCard("out", input.value);
                input.value = "";
              }}
              className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-red-600 transition cursor-pointer"
            >
              OUT
            </button>
          </div>
        </div>
      </div>

      {/* Visitor List Container */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">
          Visitor Log
        </h3>

        {/* Visitor List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-10 w-10 border-b-2 border-blue-500 rounded-full mx-auto"></div>
            <p className="text-gray-500 text-sm mt-4">Loading visitors...</p>
          </div>
        ) : filteredVisitors.length > 0 ? (
          <div className="grid gap-4">
            {filteredVisitors.map((visitor, index) => {
              const isCurrentlyIn =
                visitor.check_in_time && !visitor.check_out_time;
              const atSecurityGate =
                visitor.created_at &&
                !visitor.check_out_time &&
                !visitor.check_in_time;

              return (
                <div
                  key={visitor.pass_id || index}
                  className={`transition-all duration-200 rounded-lg p-5 border ${
                    isCurrentlyIn
                      ? "bg-green-50 border-green-300"
                      : atSecurityGate
                        ? "bg-blue-50 border-blue-300"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-center lg:items-start gap-5">
                    {/* Photo */}
                    <div
                      className="shrink-0 relative cursor-pointer"
                      onClick={() =>
                        visitor.visitor_photo &&
                        setSelectedImage(visitor.visitor_photo)
                      }
                    >
                      {visitor.visitor_photo ? (
                        <img
                          src={visitor.visitor_photo}
                          alt={`${visitor.visitor_name || "Visitor"}'s photo`}
                          className="w-20 h-20 object-cover rounded-full border-4 border-blue-300 shadow-md hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-full border-4 border-gray-300 text-gray-400 shadow-md">
                          <CgProfile className="text-4xl" />
                        </div>
                      )}

                      {isCurrentlyIn && (
                        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          In
                        </span>
                      )}
                      {atSecurityGate && (
                        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          Gate
                        </span>
                      )}
                    </div>

                    {/* Visitor Info */}
                    <div className="flex-1 text-center lg:text-left">
                      <h3 className="text-lg font-bold text-gray-800 mb-0.5">
                        {visitor.visitor_name}
                      </h3>

                      <p className="text-xs text-gray-500 mb-3">
                        <span className="font-medium">Pass ID:</span>{" "}
                        {visitor.pass_id}
                      </p>

                      {/* Times */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <MdAccessTime className="text-green-500 text-lg" />
                          <span className="font-medium text-gray-700">
                            Check In:
                          </span>
                          <span className="text-gray-600">
                            {formatISODateString(visitor.check_in_time) ||
                              "N/A"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <MdAccessTime className="text-red-500 text-lg" />
                          <span className="font-medium text-gray-700">
                            Check Out:
                          </span>
                          <span className="text-gray-600">
                            {visitor.check_out_time ? (
                              formatISODateString(visitor.check_out_time)
                            ) : isCurrentlyIn ? (
                              <span className="text-green-600 font-bold">
                                Currently In
                              </span>
                            ) : (
                              "N/A"
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdBusiness className="text-purple-500" />
                            <span>{visitor.employee_name || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdPhone className="text-blue-500" />
                            <span>{visitor.visitor_contact_no || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdBusiness className="text-purple-500" />
                            <span>{visitor.purpose_of_visit || "N/A"}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdBusiness className="text-purple-500" />
                            <span>{visitor.department_name || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdEmail className="text-green-500" />
                            <span>{visitor.company || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdLocationOn className="text-red-500" />
                            <span>{visitor.vehicle_details || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-3">
                        {atSecurityGate && (
                          <button
                            onClick={() =>
                              handleVisitorActionForCard("in", visitor.pass_id)
                            }
                            className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-blue-600 transition cursor-pointer flex items-center gap-2"
                          >
                            <FaSignInAlt /> In
                          </button>
                        )}

                        {isCurrentlyIn && (
                          <>
                            <button
                              onClick={() =>
                                handleVisitorActionForCard(
                                  "out",
                                  visitor.pass_id,
                                )
                              }
                              className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-red-600 transition cursor-pointer flex items-center gap-2"
                            >
                              <FaSignOutAlt /> Out
                            </button>

                            <button
                              onClick={() =>
                                navigate(
                                  `/visitor-pass-display/${visitor.pass_id}`,
                                )
                              }
                              className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-purple-600 transition cursor-pointer flex items-center gap-2"
                            >
                              Reprint Pass
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <FaUser className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-500">
              No visitors found
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              Try adjusting your search criteria
            </p>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/50 flex justify-center items-center z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt="Visitor"
              className="max-h-[80vh] rounded-lg shadow-2xl border-4 border-white"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600 transition cursor-pointer"
            >
              <FaTimes className="text-lg" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InOut;

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import { CgProfile } from "react-icons/cg";
import { FaEye } from "react-icons/fa";
import { baseURL } from "../../assets/assets";
import Loader from "../../components/common/Loader";

const AllVisitors = () => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [visitLogs, setVisitLogs] = useState([]);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  // FETCH VISITORS
  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const params = {
        search: search || undefined,
        startDate: from ? from + " 00:00:00" : undefined,
        endDate: to ? to + " 23:59:59" : undefined,
        limit,
        offset,
      };

      const res = await axios.get(`${baseURL}visitor/history`, { params });

      if (res.data?.success) {
        setVisitors(res.data.data || []);
      } else {
        toast.error(res.data?.message || "Failed to fetch visitors");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch visitors");
    } finally {
      setLoading(false);
    }
  };

  // APPLY FILTERS
  const applyFilters = () => {
    setOffset(0);
    fetchVisitors();
  };

  // AUTO FETCH WHEN FILTERS OR PAGINATION CHANGE
  useEffect(() => {
    fetchVisitors();
  }, [limit, offset]);

  // OPEN DETAILS MODAL
  const openDetails = async (visitor) => {
    setSelectedVisitor(visitor);
    try {
      const res = await axios.get(`${baseURL}visitor/details/${visitor.id}`);
      if (res.data?.success) {
        setVisitLogs(res.data.visit_logs || []);
      } else {
        toast.error(res.data?.message || "Failed to fetch visitor details");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch visitor details");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-2 md:px-4 w-full">
      <Title title="All Visitors" align="center" />

      {/* Filters */}
      <div className="max-w-6xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name, mobile, company, pass"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="col-span-2 p-3 border rounded"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="p-3 border rounded"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="p-3 border rounded"
        />
        <div className="flex gap-2">
          <Button
            onClick={applyFilters}
            bgColor="bg-blue-600"
            textColor="text-white"
          >
            Apply
          </Button>
          <Button
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
              setOffset(0);
              fetchVisitors();
            }}
            bgColor="bg-gray-400"
            textColor="text-white"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Visitors List */}
      <div className="w-full mx-auto mt-8 px-2">
        {loading ? (
          <div className="text-center py-12">
            <Loader />
          </div>
        ) : visitors.length === 0 ? (
          <div className="text-center py-12 text-gray-600">No visitors found</div>
        ) : (
          <div className="grid gap-4">
            {visitors.map((v) => (
              <div
                key={v.id}
                className="bg-white p-6 rounded-2xl shadow-lg flex items-center gap-6 w-full"
              >
                <div className="shrink-0">
                  {v.photo_url ? (
                    <img
                      src={v.photo_url}
                      alt={v.visitor_name}
                      className="w-28 h-28 rounded-full object-cover border-2"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                      <CgProfile className="text-3xl text-gray-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{v.visitor_name}</h3>
                    <div className="text-sm text-gray-600">
                      Visits: <strong>{v.total_passes ?? 0}</strong>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600">
                    <strong>Company:</strong> {v.company || "N/A"}
                  </p>

                  <p className="text-sm text-gray-600">
                    <strong>Last Visit:</strong>{" "}
                    {v.check_in_time
                      ? new Date(v.check_in_time).toLocaleString()
                      : "N/A"}
                  </p>

                  <p className="text-sm text-gray-600">
                    <strong>Last Visited Employee:</strong>{" "}
                    {v.employee_name || "N/A"}{" "}
                    <span className="text-gray-400">
                      ({v.department_name || "N/A"})
                    </span>
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => openDetails(v)}
                    bgColor="bg-blue-600"
                    textColor="text-white"
                    className="px-4 py-3 text-lg flex items-center gap-2"
                  >
                    <FaEye /> View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <label className="text-sm mr-2">Per page:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="p-1 border rounded"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                const newOffset = Math.max(0, offset - limit);
                setOffset(newOffset);
              }}
              bgColor="bg-gray-300"
              textColor="text-black"
            >
              Prev
            </Button>
            <Button
              onClick={() => {
                const newOffset = offset + limit;
                setOffset(newOffset);
              }}
              bgColor="bg-gray-300"
              textColor="text-black"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedVisitor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-[90%] p-8 relative shadow-2xl">
            <button
              className="absolute top-3 right-3 text-gray-600"
              onClick={() => {
                setSelectedVisitor(null);
                setVisitLogs([]);
              }}
            >
              ✖
            </button>

            <div className="flex gap-4 items-center mb-4">
              {selectedVisitor.photo_url ? (
                <img
                  src={selectedVisitor.photo_url}
                  alt="photo"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <CgProfile className="text-3xl text-gray-500" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold">{selectedVisitor.visitor_name}</h2>
                <p className="text-sm text-gray-600">{selectedVisitor.contact_no}</p>
                <p className="text-sm text-gray-600">{selectedVisitor.company}</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">Recent Visits</h3>
            {visitLogs.length === 0 ? (
              <div className="text-sm text-gray-600">No visit logs found.</div>
            ) : (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                {visitLogs.map((log) => (
                  <div
                    key={log.pass_id + log.check_in_time}
                    className="border rounded p-3"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm text-gray-700 font-medium">
                          {new Date(log.check_in_time).toLocaleDateString()}{" "}
                          {new Date(log.check_in_time).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          Visited: {log.employee_name || "N/A"}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        Out:{" "}
                        {log.check_out_time
                          ? new Date(log.check_out_time).toLocaleString()
                          : "-"}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                      <div>
                        <strong>Department:</strong>{" "}
                        {log.department_name || "N/A"}
                      </div>
                      <div>
                        <strong>Purpose:</strong>{" "}
                        {log.purpose_of_visit || "N/A"}
                      </div>
                      {log.other_notes && (
                        <div>
                          <strong>Notes:</strong> {log.other_notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllVisitors;

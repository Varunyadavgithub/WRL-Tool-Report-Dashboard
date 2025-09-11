import { useEffect, useState } from "react";
import { FaSearch, FaEdit, FaIdBadge, FaUser, FaTimes } from "react-icons/fa";
import { MdPhone, MdEmail, MdBusiness, MdLocationOn } from "react-icons/md";
import { CgProfile } from "react-icons/cg";
import toast from "react-hot-toast";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import InputField from "../../components/common/InputField";
import Button from "../../components/common/Button";
import SelectField from "../../components/common/SelectField";

const ManageVisitor = () => {
  const [loading, setLoading] = useState(false);
  const [visitorsData, setVisitorsData] = useState([]);
  const [filteredVisitors, setFilteredVisitors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch visitors data
  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}visitor/visitors`);
      if (res?.data?.success) {
        const data = res?.data?.data;
        const formatted = Array.isArray(data) ? data : [data];
        setVisitorsData(formatted);
        setFilteredVisitors(formatted);
      } else {
        toast.error(res?.data?.message || "Failed to fetch visitors data");
      }
    } catch (error) {
      console.error("Error fetching visitors:", error);
      toast.error("Failed to fetch visitors data");
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredVisitors(visitorsData);
      return;
    }

    const filtered = visitorsData.filter(
      (visitor) =>
        visitor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visitor.contact_no?.includes(searchTerm) ||
        visitor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visitor.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredVisitors(filtered);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    setFilteredVisitors(visitorsData);
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchTerm, visitorsData]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Visitor Management
          </h1>
          <p className="text-gray-600">Search and manage visitor information</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="flex items-center gap-4 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, phone, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            {searchTerm && (
              <Button
                onClick={clearSearch}
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Search Results Count */}
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              {searchTerm
                ? `Found ${filteredVisitors.length} visitor(s)`
                : `Total ${visitorsData.length} visitors`}
            </p>
          </div>
        </div>

        {/* Visitors List */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Visitors Directory
            </h2>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-4">Loading visitors...</p>
              </div>
            ) : filteredVisitors.length > 0 ? (
              <div className="grid gap-6">
                {filteredVisitors.map((visitor, index) => (
                  <div
                    key={visitor._id || index}
                    className="bg-gray-50 hover:bg-gray-100 transition-all duration-200 rounded-xl p-6 border border-gray-200 hover:shadow-md"
                  >
                    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
                      {/* Profile Photo */}
                      <div className="flex-shrink-0">
                        {visitor.photo_url ? (
                          <img
                            src={visitor.photo_url}
                            alt={`${visitor.name}'s photo`}
                            className="w-24 h-24 object-cover rounded-full border-4 border-blue-300 shadow-md"
                          />
                        ) : (
                          <div className="w-24 h-24 flex items-center justify-center bg-gray-100 rounded-full border-4 border-gray-300 text-gray-400 shadow-md">
                            <CgProfile className="text-5xl" />
                          </div>
                        )}
                      </div>

                      {/* Visitor Info */}
                      <div className="flex-1 min-w-0 text-center lg:text-left">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">
                          {visitor.name}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="space-y-2">
                            <div className="flex items-center justify-center lg:justify-start gap-2">
                              <MdPhone className="text-blue-500" />
                              <span>{visitor.contact_no || "N/A"}</span>
                            </div>

                            <div className="flex items-center justify-center lg:justify-start gap-2">
                              <MdEmail className="text-green-500" />
                              <span className="truncate">
                                {visitor.email || "N/A"}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-center lg:justify-start gap-2">
                              <MdBusiness className="text-purple-500" />
                              <span>{visitor.company || "N/A"}</span>
                            </div>

                            <div className="flex items-center justify-center lg:justify-start gap-2">
                              <MdLocationOn className="text-red-500" />
                              <span>{visitor.state || "N/A"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Last Visit Info */}
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Last Visit:</span>{" "}
                            {visitor.last_visit
                              ? new Date(visitor.last_visit).toLocaleDateString(
                                  "en-US",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )
                              : "Never"}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {/* <div className="flex flex-col gap-3 min-w-max">
                        <button
                          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all font-medium hover:shadow-lg"
                          onClick={() => handleEditClick(visitor)}
                        >
                          <FaEdit />
                          Edit Profile
                        </button>

                        <button
                          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-all font-medium hover:shadow-lg"
                          onClick={() => handleGeneratePass(visitor)}
                        >
                          <FaIdBadge />
                          Generate Pass
                        </button>
                      </div> */}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FaUser className="text-6xl text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-600 mb-2">
                  No visitors found
                </h3>
                <p className="text-gray-500">
                  {searchTerm
                    ? "Try adjusting your search terms"
                    : "No visitor data available"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageVisitor;

import { useEffect, useState } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import DateTimePicker from "../../components/ui/DateTimePicker";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/ui/Loader";
import FinalFreezer from "../../components/lineHourly/FinalLine/FinalFreezer";
import FinalChoc from "../../components/lineHourly/FinalLine/FinalChoc";
import FinalSUS from "../../components/lineHourly/FinalLine/FinalSUS";
import FinalCategoryCount from "../../components/lineHourly/FinalLine/FinalCategoryCount";
import PostFoamingFreezerA from "../../components/lineHourly/PostFoaming/PostFoamingFreezer.jsx";
import PostFoamingSUS from "../../components/lineHourly/PostFoaming/PostFoamingSUS";
import PostFoamingCategoryCount from "../../components/lineHourly/PostFoaming/PostFoamingCategoryCount";
import FoamingA from "../../components/lineHourly/Foaming/FoamingA";
import FoamingB from "../../components/lineHourly/Foaming/FoamingB";
import FoamingCategoryCount from "../../components/lineHourly/Foaming/FoamingCategoryCount";
import { CATEGORY_MAPPINGS } from "../../utils/mapCategories.js";
import ManualPostFoaming from "../../components/lineHourly/PostFoaming/ManualPostFoaming.jsx";
import { baseURL } from "../../assets/assets.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
// Map Categories
const mapCategory = async (data, mappings = CATEGORY_MAPPINGS) => {
  if (!data) return [];

  const normalize = (str) => str.replace(/\s+/g, " ").trim().toUpperCase();

  const dataArray = Array.isArray(data) ? data : [data];

  const grouped = {};

  dataArray.forEach((item) => {
    const mappedItem = { ...item };
    if (mappedItem?.category) {
      const normalizedCategory = normalize(mappedItem.category);
      const finalCategory =
        mappings[normalizedCategory] || mappedItem.category.trim();

      if (grouped[finalCategory]) {
        // If category exists, add to TotalCount
        grouped[finalCategory].TotalCount += mappedItem.TotalCount || 0;
      } else {
        // Otherwise, create new
        grouped[finalCategory] = {
          category: finalCategory,
          TotalCount: mappedItem.TotalCount || 0,
        };
      }
    }
  });

  // Convert grouped object back to array
  return Object.values(grouped);
};

const LineHourlyReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineType, setLineType] = useState("final_line");

  // State for diffrent table data
  const [finalFreezerLoadingData, setFinalFreezerLoadingData] = useState([]);
  const [finalChocLoadingData, setFinalChocLoadingData] = useState([]);
  const [finalSUSLoadingData, setFinalSUSLoadingData] = useState([]);
  const [finalCategoryLoadingCountData, setFinalCategoryLoadingCountData] =
    useState([]);

  const [finalFreezerData, setFinalFreezerData] = useState([]);
  const [finalChocData, setFinalChocData] = useState([]);
  const [finalSUSData, setFinalSUSData] = useState([]);
  const [finalCategoryCountData, setFinalCategoryCountData] = useState([]);

  const [postFoamingFreezerData, setPostFoamingFreezerData] = useState([]);
  const [manualPostFoamingData, setManualPostFoamingData] = useState([]);
  const [postFoamingSUSData, setPostFoamingSUSData] = useState([]);
  const [postCategoryCountData, setPostCategoryCountData] = useState([]);

  const [FoamingFOMAData, setFoamingFOMAData] = useState([]);
  const [FoamingFOMBData, setFoamingFOMBData] = useState([]);
  const [FoamingCategoryData, setFoamingCategoryData] = useState([]);

  // API Base URL
  const API_BASE_URL = `${baseURL}prod`;

  // Fetch data for different line types
  const fetchHourlyReport = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }

    setLoading(true);

    // Reset previous data before setting new data
    setFinalFreezerData([]);
    setFinalChocData([]);
    setFinalSUSData([]);
    setPostFoamingFreezerData([]);
    setManualPostFoamingData([]);
    setPostFoamingSUSData([]);
    setFoamingFOMAData([]);
    setFoamingFOMBData([]);
    setFoamingCategoryData([]);
    setPostCategoryCountData([]);
    setFinalCategoryCountData([]);
    setFinalFreezerLoadingData([]);
    setFinalChocLoadingData([]);
    setFinalSUSLoadingData([]);
    setFinalCategoryLoadingCountData([]);

    // Common request parameters
    const params = {
      StartTime: startTime,
      EndTime: endTime,
    };

    try {
      // Handle Final Line data
      // Handle Final Line Loading data
      if (lineType === "final_loading") {
        try {
          // Final Freezer Loading
          const res1 = await axios.get(`${API_BASE_URL}/final-loading-hp-frz`, {
            params,
          });
          setFinalFreezerLoadingData(res1?.data?.data || []);

          // Final Choc
          const res2 = await axios.get(
            `${API_BASE_URL}/final-loading-hp-choc`,
            {
              params,
            }
          );
          setFinalChocLoadingData(res2?.data?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-loading-hp-sus`, {
            params,
          });
          setFinalSUSLoadingData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-loading-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setFinalCategoryLoadingCountData(data || []);
        } catch (error) {
          console.error("Error fetch Yesterday Final Line data:", error);
          toast.error("Failed to fetch Yesterday Final Line data");
        }
      } else if (lineType === "final_line") {
        try {
          // Final Freezer
          const res1 = await axios.get(`${API_BASE_URL}/final-hp-frz`, {
            params,
          });
          setFinalFreezerData(res1?.data?.data || []);

          // Final Choc
          const res2 = await axios.get(`${API_BASE_URL}/final-hp-choc`, {
            params,
          });
          setFinalChocData(res2?.data?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-hp-sus`, {
            params,
          });
          setFinalSUSData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setFinalCategoryCountData(data || []);
        } catch (error) {
          console.error("Error fetch Final Line data:", error);
          toast.error("Failed to fetch Final Line data");
        }
      }
      // Handle Post Foaming data
      else if (lineType === "post_Foaming") {
        try {
          // Post Foaming Freezer
          const res1 = await axios.get(`${API_BASE_URL}/post-hp-frz`, {
            params,
          });
          setPostFoamingFreezerData(res1?.data?.data || []);

          // Manual Post Foaming
          const res2 = await axios.get(`${API_BASE_URL}/manual-post-hp`, {
            params,
          });
          setManualPostFoamingData(res2?.data?.data || []);

          // Post Foaming SUS
          const res3 = await axios.get(`${API_BASE_URL}/post-hp-sus`, {
            params,
          });
          setPostFoamingSUSData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/post-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setPostCategoryCountData(data || []);
        } catch (error) {
          console.error("Error fetch Post Foaming data:", error);
          toast.error("Failed to fetch Post Foaming data");
        }
      }
      // Handle Foaming data
      else if (lineType === "Foaming") {
        try {
          // Foaming FOM A
          const res1 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-a`, {
            params,
          });
          setFoamingFOMAData(res1?.data?.data || []);

          // Foaming FOM B
          const res2 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-b`, {
            params,
          });
          setFoamingFOMBData(res2?.data?.data || []);

          // Foaming Category
          const res3 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-cat`, {
            params,
          });
          const data = await mapCategory(res3?.data?.data);
          setFoamingCategoryData(data || []);
        } catch (error) {
          console.error("Error fetch Foaming data:", error);
          toast.error("Failed to fetch Foaming data");
        }
      }
    } catch (error) {
      console.error("Error in Fetch Hourly Report:", error);
      toast.error("Error in Fetch Hourly Report.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Filters
  const fetchYesterdayHourlyReport = async () => {
    setYdayLoading(true);

    // Reset previous data before setting new data
    setFinalFreezerData([]);
    setFinalChocData([]);
    setFinalSUSData([]);
    setPostFoamingFreezerData([]);
    setManualPostFoamingData([]);
    setPostFoamingSUSData([]);
    setFoamingFOMAData([]);
    setFoamingFOMBData([]);
    setFoamingCategoryData([]);
    setPostCategoryCountData([]);
    setFinalCategoryCountData([]);
    setFinalFreezerLoadingData([]);
    setFinalChocLoadingData([]);
    setFinalSUSLoadingData([]);
    setFinalCategoryLoadingCountData([]);

    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);

    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1); // Go to yesterday 8 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(yesterday8AM);
    const formattedEnd = formatDate(today8AM);

    // Common request parameters
    const params = {
      StartTime: formattedStart,
      EndTime: formattedEnd,
    };

    try {
      // Handle Final Line Loading data
      if (lineType === "final_loading") {
        try {
          // Final Freezer Loading
          const res1 = await axios.get(`${API_BASE_URL}/final-loading-hp-frz`, {
            params,
          });
          setFinalFreezerLoadingData(res1?.data?.data || []);

          // Final Choc
          const res2 = await axios.get(
            `${API_BASE_URL}/final-loading-hp-choc`,
            {
              params,
            }
          );
          setFinalChocLoadingData(res2?.data?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-loading-hp-sus`, {
            params,
          });
          setFinalSUSLoadingData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-loading-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setFinalCategoryLoadingCountData(data || []);
        } catch (error) {
          console.error("Error fetch Yesterday Final Line data:", error);
          toast.error("Failed to fetch Yesterday Final Line data");
        }
      } else if (lineType === "final_line") {
        try {
          // Final Freezer
          const res1 = await axios.get(`${API_BASE_URL}/final-hp-frz`, {
            params,
          });
          setFinalFreezerData(res1?.data?.data || []);

          // Final Choc
          const res2 = await axios.get(`${API_BASE_URL}/final-hp-choc`, {
            params,
          });
          setFinalChocData(res2?.data?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-hp-sus`, {
            params,
          });
          setFinalSUSData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setFinalCategoryCountData(data || []);
        } catch (error) {
          console.error("Error fetch Yesterday Final Line data:", error);
          toast.error("Failed to fetch Yesterday Final Line data");
        }
      }
      // Handle Post Foaming data
      else if (lineType === "post_Foaming") {
        try {
          // Post Foaming Freezer
          const res1 = await axios.get(`${API_BASE_URL}/post-hp-frz`, {
            params,
          });
          setPostFoamingFreezerData(res1?.data?.data || []);

          // Manual Post Foaming
          const res2 = await axios.get(`${API_BASE_URL}/manual-post-hp`, {
            params,
          });
          setManualPostFoamingData(res2?.data?.data || []);

          // Post Foaming SUS
          const res3 = await axios.get(`${API_BASE_URL}/post-hp-sus`, {
            params,
          });
          setPostFoamingSUSData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/post-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setPostCategoryCountData(data || []);
        } catch (error) {
          console.error("Error fetch Yesterday Post Foaming data:", error);
          toast.error("Failed to fetch Yesterday Post Foaming data");
        }
      }
      // Handle Foaming data
      else if (lineType === "Foaming") {
        try {
          // Foaming FOM A
          const res1 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-a`, {
            params,
          });
          setFoamingFOMAData(res1?.data?.data || []);

          // Foaming FOM B
          const res2 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-b`, {
            params,
          });
          setFoamingFOMBData(res2?.data?.data || []);

          // Foaming Category
          const res3 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-cat`, {
            params,
          });
          const data = await mapCategory(res3?.data?.data);
          setFoamingCategoryData(data || []);
        } catch (error) {
          console.error("Error fetch Yesterday Foaming data:", error);
          toast.error("Failed to fetch Yesterday Foaming data");
        }
      }
    } catch (error) {
      console.error("Error in Fetch Yesterday Hourly Report:", error);
      toast.error("Error in Fetch Yesterday Hourly Report.");
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodayHourlyReport = async () => {
    setTodayLoading(true);

    // Reset previous data before setting new data
    setFinalFreezerData([]);
    setFinalChocData([]);
    setFinalSUSData([]);
    setPostFoamingFreezerData([]);
    setManualPostFoamingData([]);
    setPostFoamingSUSData([]);
    setFoamingFOMAData([]);
    setFoamingFOMBData([]);
    setFoamingCategoryData([]);
    setPostCategoryCountData([]);
    setFinalCategoryCountData([]);
    setFinalFreezerLoadingData([]);
    setFinalChocLoadingData([]);
    setFinalSUSLoadingData([]);
    setFinalCategoryLoadingCountData([]);

    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0); // Set to today 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(today8AM);
    const formattedEnd = formatDate(now); // Now = current time

    // Common request parameters
    const params = {
      StartTime: formattedStart,
      EndTime: formattedEnd,
    };

    try {
      // Handle Final Line data
      if (lineType === "final_loading") {
        try {
          // Final Freezer Loading
          const res1 = await axios.get(`${API_BASE_URL}/final-loading-hp-frz`, {
            params,
          });
          setFinalFreezerLoadingData(res1?.data?.data || []);

          // Final Choc
          const res2 = await axios.get(
            `${API_BASE_URL}/final-loading-hp-choc`,
            {
              params,
            }
          );
          setFinalChocLoadingData(res2?.data?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-loading-hp-sus`, {
            params,
          });
          setFinalSUSLoadingData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-loading-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setFinalCategoryLoadingCountData(data || []);
        } catch (error) {
          console.error("Error fetch Yesterday Final Line data:", error);
          toast.error("Failed to fetch Yesterday Final Line data");
        }
      } else if (lineType === "final_line") {
        try {
          // Final Freezer
          const res1 = await axios.get(`${API_BASE_URL}/final-hp-frz`, {
            params,
          });
          setFinalFreezerData(res1?.data?.data || []);

          // Final Choc
          const res2 = await axios.get(`${API_BASE_URL}/final-hp-choc`, {
            params,
          });
          setFinalChocData(res2?.data?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-hp-sus`, {
            params,
          });
          setFinalSUSData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setFinalCategoryCountData(data || []);
        } catch (error) {
          console.error("Error fetch Today Final Line data:", error);
          toast.error("Failed to fetch Today Final Line data");
        }
      }
      // Handle Post Foaming data
      else if (lineType === "post_Foaming") {
        try {
          // Post Foaming Freezer
          const res1 = await axios.get(`${API_BASE_URL}/post-hp-frz`, {
            params,
          });
          setPostFoamingFreezerData(res1?.data?.data || []);

          // Manual Post Foaming
          const res2 = await axios.get(`${API_BASE_URL}/manual-post-hp`, {
            params,
          });
          setManualPostFoamingData(res2?.data?.data || []);

          // Post Foaming SUS
          const res3 = await axios.get(`${API_BASE_URL}/post-hp-sus`, {
            params,
          });
          setPostFoamingSUSData(res3?.data?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/post-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data?.data);
          setPostCategoryCountData(data || []);
        } catch (error) {
          console.error("Error fetch Today Post Foaming data:", error);
          toast.error("Failed to fetch Today Post Foaming data");
        }
      }
      // Handle Foaming data
      else if (lineType === "Foaming") {
        try {
          // Foaming FOM A
          const res1 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-a`, {
            params,
          });
          setFoamingFOMAData(res1?.data?.data || []);

          // Foaming FOM B
          const res2 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-b`, {
            params,
          });
          setFoamingFOMBData(res2?.data?.data || []);

          // Foaming Category
          const res3 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-cat`, {
            params,
          });
          const data = await mapCategory(res3?.data?.data);
          setFoamingCategoryData(data || []);
        } catch (error) {
          console.error("Error fetch Today Foaming data:", error);
          toast.error("Failed to fetch Today Foaming data");
        }
      }
    } catch (error) {
      console.error("Error in Fetch Today Hourly Report:", error);
      toast.error("Error in Fetch Today Hourly Report.");
    } finally {
      setTodayLoading(false);
    }
  };

  // Auto Refresh Logic
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchHourlyReport, 300000); // auto-refresh every 5 min
      return () => clearInterval(interval);
    }
  }, [autoRefresh, lineType, startTime, endTime]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Line Hourly Report" align="center" />

      {/* Filters Section */}
      <div className="flex gap-4">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl items-center">
          <DateTimePicker
            label="Start Time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <DateTimePicker
            label="End Time"
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh(!autoRefresh)}
                />
                Auto Refresh
              </label>
              <div className="flex flex-col gap-1">
                <label>
                  <input
                    type="radio"
                    name="lineType"
                    value="final_line"
                    checked={lineType === "final_line"}
                    onChange={(e) => setLineType(e.target.value)}
                  />
                  Final Line
                </label>
                <label>
                  <input
                    type="radio"
                    name="lineType"
                    value="final_loading"
                    checked={lineType === "final_loading"}
                    onChange={(e) => setLineType(e.target.value)}
                  />
                  Final Loading
                </label>
                <label>
                  <input
                    type="radio"
                    name="lineType"
                    value="post_Foaming"
                    checked={lineType === "post_Foaming"}
                    onChange={(e) => setLineType(e.target.value)}
                  />
                  Post Foaming
                </label>
                <label>
                  <input
                    type="radio"
                    name="lineType"
                    value="Foaming"
                    checked={lineType === "Foaming"}
                    onChange={(e) => setLineType(e.target.value)}
                  />
                  Foaming
                </label>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={fetchHourlyReport}
                  disabled={loading}
                >
                  Query
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Quick Filters
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
              textColor={ydayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                ydayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => fetchYesterdayHourlyReport()}
              disabled={ydayLoading}
            >
              YDAY
            </Button>
            {ydayLoading && <Loader />}
            <Button
              bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
              textColor={todayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                todayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => fetchTodayHourlyReport()}
              disabled={todayLoading}
            >
              TDAY
            </Button>
            {todayLoading && <Loader />}
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex flex-col bg-white border border-gray-300 rounded-md p-2">
          {/* Tables Component */}
          {loading ? (
            <Loader />
          ) : (
            <>
              {lineType === "final_loading" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FinalFreezer
                      title={"Final Freezer Loading"}
                      data={finalFreezerLoadingData}
                    />
                    <FinalChoc
                      title={"Final Choc"}
                      data={finalChocLoadingData}
                    />
                    <FinalSUS title={"Final SUS"} data={finalSUSLoadingData} />
                    <FinalCategoryCount
                      title={"Category Count"}
                      data={finalCategoryLoadingCountData}
                    />
                  </div>
                </>
              )}

              {lineType === "final_line" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FinalFreezer
                      title={"Final Freezer"}
                      data={finalFreezerData}
                    />
                    <FinalChoc title={"Final Choc"} data={finalChocData} />
                    <FinalSUS title={"Final SUS"} data={finalSUSData} />
                    <FinalCategoryCount
                      title={"Category Count"}
                      data={finalCategoryCountData}
                    />
                  </div>
                </>
              )}

              {lineType === "post_Foaming" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <PostFoamingFreezerA
                      title={"Post Foam Frz"}
                      data={postFoamingFreezerData}
                    />
                    <ManualPostFoaming
                      title={"Manual Post Foam"}
                      data={manualPostFoamingData}
                    />
                    <PostFoamingSUS
                      title={"Post Foam SUS"}
                      data={postFoamingSUSData}
                    />
                    <PostFoamingCategoryCount
                      title={"Category Count"}
                      data={postCategoryCountData}
                    />
                  </div>
                </>
              )}

              {lineType === "Foaming" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FoamingA title={"Foaming A"} data={FoamingFOMAData} />
                    <FoamingB title={"Foaming B"} data={FoamingFOMBData} />
                    <FoamingCategoryCount
                      title={"Category Count"}
                      data={FoamingCategoryData}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LineHourlyReport;

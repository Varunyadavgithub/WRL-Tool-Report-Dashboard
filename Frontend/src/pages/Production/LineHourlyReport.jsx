import { useEffect, useState } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import DateTimePicker from "../../components/common/DateTimePicker";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/common/Loader";
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
import { mapCategory } from "../../utils/mapCategories.js";

const baseURL = import.meta.env.VITE_API_BASE_URL;

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const LineHourlyReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineType, setLineType] = useState("final_line");

  // State for diffrent table data
  const [finalFreezerData, setFinalFreezerData] = useState([]);
  const [finalChocData, setFinalChocData] = useState([]);
  const [finalSUSData, setFinalSUSData] = useState([]);
  const [finalCategoryCountData, setFinalCategoryCountData] = useState([]);

  const [postFoamingFreezerData, setPostFoamingFreezerData] = useState([]);
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
    setPostFoamingSUSData([]);
    setFoamingFOMAData([]);
    setFoamingFOMBData([]);
    setFoamingCategoryData([]);
    setPostCategoryCountData([]);
    setFinalCategoryCountData([]);

    // Common request parameters
    const params = {
      StartTime: startTime,
      EndTime: endTime,
    };

    try {
      // Handle Final Line data
      if (lineType === "final_line") {
        try {
          // Final Freezer
          const res1 = await axios.get(`${API_BASE_URL}/final-hp-frz`, {
            params,
          });
          setFinalFreezerData(res1?.data || []);

          // Final Choc
          const res2 = await axios.get(`${API_BASE_URL}/final-hp-choc`, {
            params,
          });
          setFinalChocData(res2?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-hp-sus`, {
            params,
          });
          setFinalSUSData(res3?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data);
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
          setPostFoamingFreezerData(res1?.data || []);

          // Post Foaming SUS
          const res3 = await axios.get(`${API_BASE_URL}/post-hp-sus`, {
            params,
          });
          setPostFoamingSUSData(res3?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/post-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data);
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
          setFoamingFOMAData(res1?.data || []);

          // Foaming FOM B
          const res2 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-b`, {
            params,
          });
          setFoamingFOMBData(res2?.data || []);

          // Foaming Category
          const res3 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-cat`, {
            params,
          });
          const data = await mapCategory(res3?.data);
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
    setPostFoamingSUSData([]);
    setFoamingFOMAData([]);
    setFoamingFOMBData([]);
    setFoamingCategoryData([]);
    setPostCategoryCountData([]);
    setFinalCategoryCountData([]);

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
      // Handle Final Line data
      if (lineType === "final_line") {
        try {
          // Final Freezer
          const res1 = await axios.get(`${API_BASE_URL}/final-hp-frz`, {
            params,
          });
          setFinalFreezerData(res1?.data || []);

          // Final Choc
          const res2 = await axios.get(`${API_BASE_URL}/final-hp-choc`, {
            params,
          });
          setFinalChocData(res2?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-hp-sus`, {
            params,
          });
          setFinalSUSData(res3?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data);
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
          console.log(res1.data)
          setPostFoamingFreezerData(res1?.data || []);

          // Post Foaming SUS
          const res3 = await axios.get(`${API_BASE_URL}/post-hp-sus`, {
            params,
          });
          setPostFoamingSUSData(res3?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/post-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data);
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
          setFoamingFOMAData(res1?.data || []);

          // Foaming FOM B
          const res2 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-b`, {
            params,
          });
          setFoamingFOMBData(res2?.data || []);

          // Foaming Category
          const res3 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-cat`, {
            params,
          });
          const data = await mapCategory(res3?.data);
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
    setPostFoamingSUSData([]);
    setFoamingFOMAData([]);
    setFoamingFOMBData([]);
    setFoamingCategoryData([]);
    setPostCategoryCountData([]);
    setFinalCategoryCountData([]);

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
      if (lineType === "final_line") {
        try {
          // Final Freezer
          const res1 = await axios.get(`${API_BASE_URL}/final-hp-frz`, {
            params,
          });
          setFinalFreezerData(res1?.data || []);

          // Final Choc
          const res2 = await axios.get(`${API_BASE_URL}/final-hp-choc`, {
            params,
          });
          setFinalChocData(res2?.data || []);

          // Final SUS
          const res3 = await axios.get(`${API_BASE_URL}/final-hp-sus`, {
            params,
          });
          setFinalSUSData(res3?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/final-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data);
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
          setPostFoamingFreezerData(res1?.data || []);

          // Post Foaming SUS
          const res3 = await axios.get(`${API_BASE_URL}/post-hp-sus`, {
            params,
          });
          setPostFoamingSUSData(res3?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/post-hp-cat`, {
            params,
          });
          const data = await mapCategory(res4?.data);
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
          setFoamingFOMAData(res1?.data || []);

          // Foaming FOM B
          const res2 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-b`, {
            params,
          });
          setFoamingFOMBData(res2?.data || []);

          // Foaming Category
          const res3 = await axios.get(`${API_BASE_URL}/Foaming-hp-fom-cat`, {
            params,
          });
          const data = await mapCategory(res3?.data);
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

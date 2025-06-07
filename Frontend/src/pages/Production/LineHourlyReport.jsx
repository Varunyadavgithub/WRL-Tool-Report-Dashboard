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
import PostFoamingFreezerA from "../../components/lineHourly/PostFoaming/PostFoamingFreezerA";
import PostFoamingFreezerB from "../../components/lineHourly/PostFoaming/PostFoamingFreezerB";
import PostFoamingSUS from "../../components/lineHourly/PostFoaming/PostFoamingSUS";
import PostFoamingCategoryCount from "../../components/lineHourly/PostFoaming/PostFoamingCategoryCount";
import FoamingA from "../../components/lineHourly/Foaming/FoamingA";
import FoamingB from "../../components/lineHourly/Foaming/FoamingB";
import FoamingCategoryCount from "../../components/lineHourly/Foaming/FoamingCategoryCount";

const baseURL = import.meta.env.VITE_API_BASE_URL;

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const LineHourlyReport = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineType, setLineType] = useState("final_line");

  // State for diffrent table data
  const [finalFreezerData, setFinalFreezerData] = useState([]);
  const [finalChocData, setFinalChocData] = useState([]);
  const [finalSUSData, setFinalSUSData] = useState([]);
  const [finalCategoryCountData, setFinalCategoryCountData] = useState([]);

  const [postFoamingFreezerAData, setPostFoamingFreezerAData] = useState([]);
  const [postFoamingFreezerBData, setPostFoamingFreezerBData] = useState([]);
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
    setPostFoamingFreezerAData([]);
    setPostFoamingFreezerBData([]);
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
          setFinalCategoryCountData(res4?.data || []);
        } catch (error) {
          console.error("Error fetching Final Line data:", error);
          toast.error("Failed to fetch Final Line data");
        }
      }
      // Handle Post Foaming data
      else if (lineType === "post_Foaming") {
        try {
          // Post Foaming Freezer A
          const res1 = await axios.get(`${API_BASE_URL}/post-hp-frz-a`, {
            params,
          });
          setPostFoamingFreezerAData(res1?.data || []);

          // Post Foaming Freezer B
          const res2 = await axios.get(`${API_BASE_URL}/post-hp-frz-b`, {
            params,
          });
          setPostFoamingFreezerBData(res2?.data || []);

          // Post Foaming SUS
          const res3 = await axios.get(`${API_BASE_URL}/post-hp-sus`, {
            params,
          });
          setPostFoamingSUSData(res3?.data || []);

          // Category Count
          const res4 = await axios.get(`${API_BASE_URL}/post-hp-cat`, {
            params,
          });
          setPostCategoryCountData(res4?.data || []);
        } catch (error) {
          console.error("Error fetching Post Foaming data:", error);
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
          setFoamingCategoryData(res3?.data || []);
        } catch (error) {
          console.error("Error fetching Foaming data:", error);
          toast.error("Failed to fetch Foaming data");
        }
      }
    } catch (error) {
      console.error("Error in Fetch Hourly Report:", error);
    } finally {
      setLoading(false);
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
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 max-w-4xl items-center">
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
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md mt-6">
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
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
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
                      title={"Foam Frz A"}
                      data={postFoamingFreezerAData}
                    />
                    <PostFoamingFreezerB
                      title={"Post Foam Frz B"}
                      data={postFoamingFreezerBData}
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

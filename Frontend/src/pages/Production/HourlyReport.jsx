import { useEffect, useState } from "react";
import Title from "../../components/common/Title";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import Button from "../../components/common/Button";
import SelectField from "../../components/common/SelectField";
import DateTimePicker from "../../components/common/DateTimePicker";
import axios from "axios";
import Loader from "../../components/common/Loader";
import toast from "react-hot-toast";
import { CATEGORY_MAPPINGS } from "../../utils/mapCategories.js";
import { baseURL } from "../../assets/assets.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
// Map Categories with TIMEHOUR grouping
const mapCategory = async (data, mappings = CATEGORY_MAPPINGS) => {
  if (!data) return [];

  const normalize = (str) => str.replace(/\s+/g, " ").trim().toUpperCase();

  const dataArray = Array.isArray(data) ? data : [data];

  const grouped = {};

  dataArray.forEach((item) => {
    const mappedItem = { ...item };
    if (mappedItem?.category || mappedItem?.TIMEHOUR !== undefined) {
      const normalizedCategory = normalize(mappedItem.category || "");
      const finalCategory =
        mappings[normalizedCategory] ||
        mappedItem.category?.trim() ||
        "UNKNOWN";
      const timeHour = mappedItem.TIMEHOUR || 0;

      // Use a combination key of category and TIMEHOUR
      const groupKey = `${finalCategory}_${timeHour}`;

      if (grouped[groupKey]) {
        grouped[groupKey].COUNT += mappedItem.COUNT || 0;
      } else {
        grouped[groupKey] = {
          category: finalCategory,
          TIMEHOUR: timeHour,
          COUNT: mappedItem.COUNT || 0,
        };
      }
    }
  });

  return Object.values(grouped);
};

const HourlyReport = () => {
  const [model, setModel] = useState([]);
  const [stage, setStages] = useState([]);
  const [stationCode, setStationCode] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [hourData, setHourData] = useState([]);
  const [hourlyModelCount, setHourlyModelCount] = useState([]);
  const [hourlyCategoryCount, setHourlyCategoryCount] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [lineType, setLineType] = useState("1");

  const fetchModel = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/model-variants`);
      const formatted = res?.data.map((item) => ({
        label: item.MaterialName,
        value: item.MatCode.toString(),
      }));
      setModel(formatted);
    } catch (error) {
      console.error("Failed to fetch model variants:", error);
      toast.error("Failed to fetch model variants.");
    }
  };

  const fetchStages = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/stage-names`);
      const formatted = res?.data.map((item) => ({
        label: item.Name,
        value: item.StationCode,
      }));

      setStages(formatted);
    } catch (error) {
      console.error("Failed to fetch stage name:", error);
      toast.error("Failed to fetch stage name.");
    }
  };

  const fetchHourlyProduction = async () => {
    if (!stationCode || !startTime || !endTime) {
      return;
    }
    try {
      setLoading(true);

      const params = {
        stationCode,
        startDate: startTime,
        endDate: endTime,
      };

      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-summary`, {
        params,
      });
      setHourData(res.data);
    } catch (error) {
      console.error("Error fetching hourly production data:", error);
      toast.error("Error fetching hourly production data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchHourlyModelCount = async () => {
    if (!stationCode || !startTime || !endTime) {
      return;
    }
    try {
      setLoading(true);

      const params = {
        stationCode,
        startDate: startTime,
        endDate: endTime,
      };
      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-model-count`, {
        params,
      });
      setHourlyModelCount(res?.data);
    } catch (error) {
      console.error("Error fetching hourly model count data:", error);
      toast.error("Error fetching hourly model count data.");
    } finally {
      setLoading(false);
    }
  };

  const getHourlyCategoryCount = async () => {
    if (!stationCode || !startTime || !endTime) {
      toast.error("Please select Station Code and Time Range.");
      return;
    }
    try {
      setLoading(true);

      const params = {
        stationCode,
        startDate: startTime,
        endDate: endTime,
      };
      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-category-count`, {
        params,
      });
      const data = await mapCategory(res?.data);
      setHourlyCategoryCount(data);
    } catch (error) {
      console.error("Error fetching hourly Category count data:", error);
      toast.error("Error fetching hourly Category count data.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Filters
  const fetchYesterdayHourlyProduction = async () => {
    if (!stationCode) {
      return;
    }

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
    try {
      setYdayLoading(true);
      setHourData([]);

      const params = {
        stationCode,
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-summary`, {
        params,
      });
      setHourData(res.data);
    } catch (error) {
      console.error("Error fetching Yesterday hourly production data:", error);
      toast.error("Error fetching Yesterday hourly production data.");
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchYesterdayHourlyModelCount = async () => {
    if (!stationCode) {
      return;
    }

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

    try {
      setYdayLoading(true);

      setHourlyModelCount([]);

      const params = {
        stationCode,
        startDate: formattedStart,
        endDate: formattedEnd,
      };
      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-model-count`, {
        params,
      });
      setHourlyModelCount(res?.data);
    } catch (error) {
      console.error("Error fetching Yesterday hourly model count data:", error);
      toast.error("Error fetching Yesterday hourly model count data.");
    } finally {
      setYdayLoading(false);
    }
  };

  const getYesterdayHourlyCategoryCount = async () => {
    if (!stationCode) {
      toast.error("Please select Station Code.");
      return;
    }

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

    try {
      setYdayLoading(true);

      setHourlyCategoryCount([]);

      const params = {
        stationCode,
        startDate: formattedStart,
        endDate: formattedEnd,
      };
      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-category-count`, {
        params,
      });
      const data = await mapCategory(res?.data);
      setHourlyCategoryCount(data);
    } catch (error) {
      console.error(
        "Error fetching Yesterday hourly Category count data:",
        error
      );
      toast.error("Error fetching Yesterday hourly Category count data.");
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodayHourlyProduction = async () => {
    if (!stationCode) {
      return;
    }

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

    try {
      setTodayLoading(true);

      setHourData([]);

      const params = {
        stationCode,
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-summary`, {
        params,
      });
      setHourData(res.data);
    } catch (error) {
      console.error("Error fetching Today hourly production data:", error);
      toast.error("Error fetching Today hourly production data.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchTodayHourlyModelCount = async () => {
    if (!stationCode) {
      return;
    }

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

    try {
      setTodayLoading(true);

      setHourlyModelCount([]);

      const params = {
        stationCode,
        startDate: formattedStart,
        endDate: formattedEnd,
      };
      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-model-count`, {
        params,
      });
      setHourlyModelCount(res?.data);
    } catch (error) {
      console.error("Error fetching Today hourly model count data:", error);
      toast.error("Error fetching Today hourly model count data.");
    } finally {
      setTodayLoading(false);
    }
  };

  const getTodayHourlyCategoryCount = async () => {
    if (!stationCode) {
      toast.error("Please select Station Code.");
      return;
    }

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

    try {
      setTodayLoading(true);

      setHourlyCategoryCount([]);

      const params = {
        stationCode,
        startDate: formattedStart,
        endDate: formattedEnd,
      };
      if (selectedModel?.value && selectedModel.value !== "0") {
        params.model = selectedModel.value;
      }
      if (lineType) {
        params.line = lineType;
      }

      const res = await axios.get(`${baseURL}prod/hourly-category-count`, {
        params,
      });
      const data = await mapCategory(res?.data);
      setHourlyCategoryCount(data);
    } catch (error) {
      console.error("Error fetching Today hourly Category count data:", error);
      toast.error("Error fetching Today hourly Category count data.");
    } finally {
      setTodayLoading(false);
    }
  };

  const handleYesterday = async () => {
    await fetchYesterdayHourlyProduction();
    await fetchYesterdayHourlyModelCount();
    await getYesterdayHourlyCategoryCount();
  };

  const handleToday = async () => {
    await fetchTodayHourlyProduction();
    await fetchTodayHourlyModelCount();
    await getTodayHourlyCategoryCount();
  };

  useEffect(() => {
    fetchModel();
    fetchStages();
  }, []);

  // Auto Refresh Logic
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchHourlyProduction, 300000); // auto-refresh every 5 min
      return () => clearInterval(interval);
    }
  }, [autoRefresh, stationCode, startTime, endTime]);

  // Chart Data
  const prepareChartData = () => {
    if (!hourData || hourData.length === 0) {
      return { chartData: null, chartOptions: null };
    }

    const chartData = {
      labels: hourData.map((item) => `${item.TIMEHOUR}:00`),
      datasets: [
        {
          label: "Production Count",
          data: hourData.map((item) => item.COUNT || 0),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderRadius: 5,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        onComplete: (animationContext) => {
          const chart = animationContext.chart;
          const ctx = chart.ctx;
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#000";
          ctx.textAlign = "center";

          chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar, index) => {
              const value = dataset.data[index];
              if (value !== null && value !== undefined) {
                ctx.fillText(value, bar.x, bar.y - 6); // Display above bar
              }
            });
          });
        },
      },
      plugins: {
        legend: {
          display: true,
        },
        tooltip: {
          enabled: true,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Hour",
            font: {
              size: 16,
              weight: "bold",
              family: "font-playfair",
            },
            color: "#333",
          },
          ticks: {
            font: {
              size: 12,
              family: "font-playfair",
            },
            color: "#666",
          },
        },
        y: {
          beginAtZero: true,
          max: Math.max(...hourData.map((item) => item.COUNT || 0), 10) + 10,
          title: {
            display: true,
            text: "Count",
            font: {
              size: 16,
              weight: "bold",
              family: "font-playfair",
            },
            color: "#333",
          },
          ticks: {
            font: {
              size: 12,
              family: "font-playfair",
            },
            color: "#666",
          },
        },
      },
    };
    return { chartData, chartOptions };
  };
  const { chartData, chartOptions } = prepareChartData();

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Hourly Report" align="center" />

      {/* Filters */}
      <div className="flex gap-4">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <SelectField
            label="Model"
            value={selectedModel?.value}
            onChange={(e) => {
              const selected = model.find(
                (opt) => opt.value === e.target.value
              );
              setSelectedModel(selected);
            }}
            options={model}
          />
          <SelectField
            label="Stage Name"
            name="stationCode"
            value={stationCode}
            onChange={(e) => setStationCode(e.target.value)}
            options={stage}
          />

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
          <div className="flex flex-col flex-wrap items-center gap-4">
            <div className="flex gap-4">
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
                      value="1"
                      checked={lineType === "1"}
                      onChange={(e) => setLineType(e.target.value)}
                    />
                    Freezer Line
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="lineType"
                      value="2"
                      checked={lineType === "2"}
                      onChange={(e) => setLineType(e.target.value)}
                    />
                    Chocolate Line
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={async () => {
                    await fetchHourlyProduction();
                    await fetchHourlyModelCount();
                    await getHourlyCategoryCount();
                  }}
                  disabled={loading}
                >
                  Query
                </Button>
              </div>
            </div>
            {/* Count */}
            <div className="mt-4 text-left font-bold text-lg">
              COUNT:{" "}
              <span className="text-blue-700">
                {hourData?.reduce((sum, item) => sum + item.COUNT, 0)}
              </span>
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
              onClick={() => handleYesterday()}
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
              onClick={() => handleToday()}
              disabled={todayLoading}
            >
              TDAY
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-h-[80vh] overflow-auto">
        {loading ? (
          <Loader />
        ) : (
          <div className="flex flex-col md:flex-row gap-4 h-full">
            {/* Left Column */}
            <div className="w-full md:w-1/2 flex flex-col gap-4 max-h-[76vh]">
              {/* Table 1 */}
              <div className="bg-white rounded-lg overflow-auto flex-1">
                <table className="min-w-full border text-xs text-left table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Hour Number
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Time Hour
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourData?.length > 0 ? (
                      hourData.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">
                            {item.HOUR_NUMBER}
                          </td>
                          <td className="px-1 py-1 border">{item.TIMEHOUR}</td>
                          <td className="px-1 py-1 border">{item.COUNT}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-4">
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bar Graph */}
              <div className="bg-white p-4 rounded-lg shadow overflow-auto flex-1">
                {chartData && <Bar data={chartData} options={chartOptions} />}
              </div>
            </div>

            {/* Right Column */}
            <div className="w-full md:w-1/2 flex flex-col gap-4 max-h-[76vh]">
              {/* Table 2 - Model Count */}
              <div className="bg-white rounded-lg overflow-auto flex-1">
                <table className="min-w-full border text-xs text-left table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border">Time Hour</th>
                      <th className="px-1 py-1 border">Name</th>
                      <th className="px-1 py-1 border">Model Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyModelCount.length > 0 ? (
                      hourlyModelCount.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{item.TIMEHOUR}</td>
                          <td className="px-1 py-1 border">
                            {item.Material_Name}
                          </td>
                          <td className="px-1 py-1 border">{item.COUNT}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-4">
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table 3 - Category Count */}
              <div className="bg-white rounded-lg overflow-auto flex-1">
                <table className="min-w-full border text-xs text-left table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border">Time Hour</th>
                      <th className="px-1 py-1 border">Category</th>
                      <th className="px-1 py-1 border">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyCategoryCount.length > 0 ? (
                      hourlyCategoryCount.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{item.TIMEHOUR}</td>
                          <td className="px-1 py-1 border">{item.category}</td>
                          <td className="px-1 py-1 border">{item.COUNT}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-4">
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HourlyReport;
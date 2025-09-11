import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import SelectField from "../../components/common/SelectField";
import DateTimePicker from "../../components/common/DateTimePicker";
import ExportButton from "../../components/common/ExportButton";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/common/Loader";
import { FaCaretUp, FaCaretDown } from "react-icons/fa";
import { baseURL } from "../../assets/assets";

const TotalProduction = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [totalProductionData, setTotalProductionData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);

  const departmentOption = [
    { label: "Post Foaming", value: "post-foaming" },
    { label: "Final Loading", value: "final-loading" },
    { label: "Final", value: "final" },
  ];
  const [selecedDep, setSelectedDep] = useState(departmentOption[0]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const fetchModelVariants = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/model-variants`);
      const formatted = res?.data.map((item) => ({
        label: item.MaterialName,
        value: item.MatCode.toString(),
      }));
      setVariants(formatted);
    } catch (error) {
      console.error("Failed to fetch model variants:", error);
      toast.error("Failed to fetch model variants.");
    }
  };

  useEffect(() => {
    fetchModelVariants();
  }, []);

  const fetchTotalProductionData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }

    try {
      setLoading(true);
      const params = {
        startDate: startTime,
        endDate: endTime,
        page: pageNumber,
        limit,
        department: selecedDep.value,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };

      const res = await axios.get(`${baseURL}prod/barcode-details`, { params });
      console.log(res);
      if (res?.data?.success) {
        setTotalProductionData((prev) => {
          const existing = new Set(prev.map((d) => d.FG_SR));
          const uniqueNew = res.data.data.filter(
            (item) => !existing.has(item.FG_SR)
          );
          return [...prev, ...uniqueNew];
        });

        if (pageNumber === 1) {
          setTotalCount(res?.data?.totalCount);
        }

        setHasMore(res?.data?.data.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch total production data:", error);
      toast.error("Failed to fetch total production data.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Filters
  const fetchYesterdayTotalProductionData = async () => {
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

      setTotalProductionData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
        department: selecedDep.value,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };

      const res = await axios.get(`${baseURL}prod/yday-total-production`, {
        params,
      });

      if (res?.data?.success) {
        setTotalProductionData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday total production data:", error);
      toast.error("Failed to fetch Yesterday total production data.");
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodayTotalProductionData = async () => {
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

      setTotalProductionData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
        department: selecedDep.value,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };

      const res = await axios.get(`${baseURL}prod/today-total-production`, {
        params,
      });
      console.log(res);
      if (res?.data?.success) {
        setTotalProductionData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Today total production data:", error);
      toast.error("Failed to fetch Today total production data.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchMTDTotalProductionData = async () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0
    ); // 1st day at 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(startOfMonth);
    const formattedEnd = formatDate(now);

    try {
      setMonthLoading(true);

      setTotalProductionData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
        department: selecedDep.value,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };

      const res = await axios.get(`${baseURL}prod/month-total-production`, {
        params,
      });

      if (res?.data?.success) {
        setTotalProductionData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch this Month total production data:", error);
      toast.error("Failed to fetch this Month total production data.");
    } finally {
      setMonthLoading(false);
    }
  };

  useEffect(() => {
    if (page === 1) return;
    fetchTotalProductionData(page);
  }, [page]);

  const handleQuery = () => {
    setPage(1);
    setTotalProductionData([]);
    setHasMore(false);
    fetchTotalProductionData(1);
  };

  const fetchExportData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      const params = {
        startDate: startTime,
        endDate: endTime,
        department: selecedDep.value,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };
      const res = await axios.get(`${baseURL}prod/export-total-production`, {
        params,
      });
      return res?.data?.success ? res?.data?.data : [];
    } catch (error) {
      console.error("Failed to fetch export total production data:", error);
      toast.error("Failed to fetch export total production data.");
      return [];
    }
  };

  const getCategoryCounts = (data) => {
    const counts = {};
    data.forEach((item) => {
      const category = item.category || "Unknown";
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  };

  const getModelNameCount = (data) => {
    const counts = {};
    data.forEach((item) => {
      const modelName = item.Model_Name || "Unknown";
      counts[modelName] = (counts[modelName] || 0) + 1;
    });
    return counts;
  };

  const filteredTotalProductionData = selectedModelName
    ? totalProductionData.filter(
        (item) => item.Model_Name === selectedModelName
      )
    : totalProductionData;

  const handleModelRowClick = (modelName) => {
    setSelectedModelName((prevSelectedModel) =>
      prevSelectedModel === modelName ? null : modelName
    );
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredTotalProductionData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredTotalProductionData, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Total Production" align="center" />

      {/* Filters Section */}
      <div className="flex gap-4">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
          <div className="flex flex-wrap gap-4">
            <SelectField
              label="Model Variant"
              options={variants}
              value={selectedVariant?.value || ""}
              onChange={(e) =>
                setSelectedVariant(
                  variants.find((opt) => opt.value === e.target.value) || null
                )
              }
              className="max-w-64"
            />
            <SelectField
              label="Department"
              options={departmentOption}
              value={selecedDep?.value || ""}
              onChange={(e) =>
                setSelectedDep(
                  departmentOption.find(
                    (opt) => opt.value === e.target.value
                  ) || null
                )
              }
              className="max-w-64"
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <DateTimePicker
              label="Start Time"
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="max-w-64"
            />
            <DateTimePicker
              label="End Time"
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="max-w-64"
            />
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={handleQuery}
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                Query
              </Button>
              {totalProductionData.length > 0 && (
                <ExportButton
                  fetchData={fetchExportData}
                  filename="Total_Production_Report"
                />
              )}
            </div>
            <div className="mt-4 text-left font-bold text-lg">
              COUNT: <span className="text-blue-700">{totalCount}</span>
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
              onClick={() => fetchYesterdayTotalProductionData()}
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
              onClick={() => fetchTodayTotalProductionData()}
              disabled={todayLoading}
            >
              TDAY
            </Button>
            <Button
              bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
              textColor={monthLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                monthLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => fetchMTDTotalProductionData()}
              disabled={monthLoading}
            >
              MTD
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="max-h-[600px] overflow-x-auto w-full">
              <table className="w-full border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("Model_Name")}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Model_Name</span>
                        <div className="flex flex-col ml-1">
                          {sortConfig.key === "Model_Name" ? (
                            sortConfig.direction === "asc" ? (
                              <FaCaretUp className="text-xs" />
                            ) : (
                              <FaCaretDown className="text-xs" />
                            )
                          ) : (
                            // Show up arrow by default before any sort is applied
                            <FaCaretUp className="text-xs" />
                          )}
                        </div>
                      </div>
                    </th>

                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("Model_Name")}
                    >
                      FG Serial_No.
                    </th>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("Model_Name")}
                    >
                      Asset tag
                    </th>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("Model_Name")}
                    >
                      Customer QR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item, index) => {
                    const isLast = index === sortedData.length - 1;
                    return (
                      <tr
                        key={index}
                        ref={isLast ? lastRowRef : null}
                        className="hover:bg-gray-100 text-center"
                      >
                        <td className="px-1 py-1 border">{item.Model_Name}</td>
                        <td className="px-1 py-1 border">{item.FG_SR}</td>
                        <td className="px-1 py-1 border">{item.Asset_tag}</td>
                        <td className="px-1 py-1 border">{item.CustomerQR}</td>
                      </tr>
                    );
                  })}
                  {!loading && sortedData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {loading && (
                <div className="text-center my-4 text-sm text-gray-500">
                  <Loader />
                </div>
              )}
            </div>

            {/* Model Table */}
            <div className="max-h-[500px] overflow-x-auto w-full">
              <table className="w-full border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[80px]">
                      Model_Name
                    </th>
                    <th className="px-1 py-1 border min-w-[80px]">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(getModelNameCount(totalProductionData)).map(
                    ([modelName, count], index) => (
                      <tr
                        key={index}
                        className={`hover:bg-gray-100 text-center cursor-pointer ${
                          selectedModelName === modelName
                            ? "bg-blue-100"
                            : "bg-white"
                        }`}
                        onClick={() => {
                          handleModelRowClick(modelName);
                        }}
                      >
                        <td className="px-1 py-1 border">{modelName}</td>
                        <td className="px-1 py-1 border">{count}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Category Table */}
            <div className="max-h-[500px] overflow-x-auto w-full">
              <table className="w-full border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[80px]">Category</th>
                    <th className="px-1 py-1 border min-w-[80px]">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(getCategoryCounts(totalProductionData)).map(
                    ([category, count], index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{category}</td>
                        <td className="px-1 py-1 border">{count}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalProduction;

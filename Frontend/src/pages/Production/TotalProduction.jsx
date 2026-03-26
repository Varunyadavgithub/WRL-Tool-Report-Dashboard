import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import ExportButton from "../../components/ui/ExportButton";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/ui/Loader";
import { FaCaretUp, FaCaretDown, FaDownload } from "react-icons/fa";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import * as XLSX from "xlsx";

const TotalProduction = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [totalProductionData, setTotalProductionData] = useState([]);

  // ─── NEW: full dataset used ONLY for summary count tables ───────────────────
  const [summaryData, setSummaryData] = useState([]);
  // ────────────────────────────────────────────────────────────────────────────

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
    [loading, hasMore],
  );

  /* ===================== RTK QUERY ===================== */
  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  /* ===================== PAGINATED FETCH (main table) ===================== */
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
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
      };

      const res = await axios.get(`${baseURL}prod/barcode-details`, { params });
      if (res?.data?.success) {
        setTotalProductionData((prev) => {
          const existing = new Set(prev.map((d) => d.FG_SR));
          const uniqueNew = res.data.data.filter(
            (item) => !existing.has(item.FG_SR),
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

  /* ===================== EXPORT / FULL FETCH (used for summary data) ===================== */
  const fetchExportData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return [];
    }
    try {
      const params = {
        startDate: startTime,
        endDate: endTime,
        department: selecedDep.value,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
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

  /* ===================== QUICK FILTERS ===================== */
  const fetchYesterdayTotalProductionData = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);

    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1);

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(yesterday8AM);
    const formattedEnd = formatDate(today8AM);

    try {
      setYdayLoading(true);
      setTotalProductionData([]);
      setSummaryData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
        department: selecedDep.value,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
      };

      const res = await axios.get(`${baseURL}prod/yday-total-production`, {
        params,
      });

      if (res?.data?.success) {
        setTotalProductionData(res?.data?.data);
        // quick filter returns full data — reuse it for summaries
        setSummaryData(res?.data?.data);
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
    today8AM.setHours(8, 0, 0, 0);

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(today8AM);
    const formattedEnd = formatDate(now);

    try {
      setTodayLoading(true);
      setTotalProductionData([]);
      setSummaryData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
        department: selecedDep.value,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
      };

      const res = await axios.get(`${baseURL}prod/today-total-production`, {
        params,
      });
      if (res?.data?.success) {
        setTotalProductionData(res?.data?.data);
        setSummaryData(res?.data?.data);
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(startOfMonth);
    const formattedEnd = formatDate(now);

    try {
      setMonthLoading(true);
      setTotalProductionData([]);
      setSummaryData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
        department: selecedDep.value,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
      };

      const res = await axios.get(`${baseURL}prod/month-total-production`, {
        params,
      });

      if (res?.data?.success) {
        setTotalProductionData(res?.data?.data);
        setSummaryData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch this Month total production data:", error);
      toast.error("Failed to fetch this Month total production data.");
    } finally {
      setMonthLoading(false);
    }
  };

  /* ===================== INFINITE SCROLL PAGE CHANGE ===================== */
  useEffect(() => {
    if (page === 1) return;
    fetchTotalProductionData(page);
  }, [page]);

  /* ===================== QUERY BUTTON ===================== */
  const handleQuery = async () => {
    setPage(1);
    setTotalProductionData([]);
    setSummaryData([]);
    setHasMore(false);

    // Fire both in parallel — paginated table + full data for summaries
    fetchTotalProductionData(1);

    try {
      const fullData = await fetchExportData();
      setSummaryData(fullData);
    } catch {
      setSummaryData([]);
    }
  };

  /* ===================== HELPERS ===================== */
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

  /* ===================== EXPORT HELPERS ===================== */
  const exportToExcel = (rows, sheetName, fileName) => {
    if (!rows || rows.length === 0) {
      toast.error("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const handleExportModelSummary = () => {
    const rows = Object.entries(getModelNameCount(summaryData)).map(
      ([modelName, count]) => ({ Model_Name: modelName, Count: count }),
    );
    exportToExcel(rows, "Model Summary", "Model_Summary_Report");
  };

  const handleExportCategorySummary = () => {
    const rows = Object.entries(getCategoryCounts(summaryData)).map(
      ([category, count]) => ({ Category: category, Count: count }),
    );
    exportToExcel(rows, "Category Summary", "Category_Summary_Report");
  };

  /* ===================== FILTER / SORT ===================== */
  const filteredTotalProductionData = selectedModelName
    ? totalProductionData.filter((item) => item.Model_Name === selectedModelName)
    : totalProductionData;

  const handleModelRowClick = (modelName) => {
    setSelectedModelName((prev) => (prev === modelName ? null : modelName));
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

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <FaCaretUp className="text-xs opacity-30" />;
    return sortConfig.direction === "asc" ? (
      <FaCaretUp className="text-xs" />
    ) : (
      <FaCaretDown className="text-xs" />
    );
  };

  if (variantsLoading) return <Loader />;

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Total Production" align="center" />

      {/* ─── Filters Section ─────────────────────────────────────────── */}
      <div className="flex gap-4 flex-wrap">

        {/* Date / Model / Dept filters */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
          <div className="flex flex-wrap gap-4">
            <SelectField
              label="Model Variant"
              options={variants}
              value={selectedModelVariant?.value || ""}
              onChange={(e) =>
                setSelectedModelVariant(
                  variants.find((opt) => opt.value === e.target.value) || null,
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
                  departmentOption.find((opt) => opt.value === e.target.value) || null,
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

        {/* Query / Export / Count */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={handleQuery}
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
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

        {/* Quick Filters */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Quick Filters
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
              textColor={ydayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${ydayLoading ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={fetchYesterdayTotalProductionData}
              disabled={ydayLoading}
            >
              YDAY
            </Button>
            {ydayLoading && <Loader />}

            <Button
              bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
              textColor={todayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${todayLoading ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={fetchTodayTotalProductionData}
              disabled={todayLoading}
            >
              TDAY
            </Button>
            {todayLoading && <Loader />}

            <Button
              bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
              textColor={monthLoading ? "text-white" : "text-black"}
              className={`font-semibold ${monthLoading ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={fetchMTDTotalProductionData}
              disabled={monthLoading}
            >
              MTD
            </Button>
            {monthLoading && <Loader />}
          </div>
        </div>
      </div>

      {/* ─── Summary Section ─────────────────────────────────────────── */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

            {/* ── Main Table ── */}
            <div className="md:col-span-3 max-h-[600px] overflow-auto w-full">
              <table className="w-full table-fixed border bg-white text-xs text-left rounded-lg">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("Model_Name")}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Model_Name</span>
                        <SortIcon colKey="Model_Name" />
                      </div>
                    </th>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("FG_SR")}
                    >
                      <div className="flex justify-between items-center">
                        <span>FG Serial_No.</span>
                        <SortIcon colKey="FG_SR" />
                      </div>
                    </th>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("Asset_tag")}
                    >
                      <div className="flex justify-between items-center">
                        <span>Asset tag</span>
                        <SortIcon colKey="Asset_tag" />
                      </div>
                    </th>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("CustomerQR")}
                    >
                      <div className="flex justify-between items-center">
                        <span>Customer QR</span>
                        <SortIcon colKey="CustomerQR" />
                      </div>
                    </th>
                    <th
                      className="px-1 py-1 border min-w-[120px] cursor-pointer"
                      onClick={() => requestSort("NFC_UID")}
                    >
                      <div className="flex justify-between items-center">
                        <span>NFC UID</span>
                        <SortIcon colKey="NFC_UID" />
                      </div>
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
                        <td className="px-1 py-1 border">{item.NFC_UID}</td>
                      </tr>
                    );
                  })}
                  {!loading && sortedData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
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

            {/* ── Model Summary Table ── */}
            <div className="md:col-span-1 max-h-[500px] overflow-auto">
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-xs font-semibold text-gray-600">
                  Model Summary
                </span>
                {summaryData.length > 0 && (
                  <button
                    onClick={handleExportModelSummary}
                    title="Export Model Summary"
                    className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium border border-green-400 rounded px-1.5 py-0.5 hover:bg-green-50 transition"
                  >
                    <FaDownload className="text-[10px]" />
                    Export
                  </button>
                )}
              </div>
              <table className="w-full table-fixed border bg-white text-xs text-left rounded-lg">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[80px]">Model_Name</th>
                    <th className="px-1 py-1 border min-w-[80px]">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── Uses summaryData (full dataset) for accurate counts ── */}
                  {Object.entries(getModelNameCount(summaryData)).map(
                    ([modelName, count], index) => (
                      <tr
                        key={index}
                        className={`hover:bg-gray-100 text-center cursor-pointer ${
                          selectedModelName === modelName
                            ? "bg-blue-100"
                            : "bg-white"
                        }`}
                        onClick={() => handleModelRowClick(modelName)}
                      >
                        <td className="px-1 py-1 border">{modelName}</td>
                        <td className="px-1 py-1 border">{count}</td>
                      </tr>
                    ),
                  )}
                  {summaryData.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-center py-3 text-gray-400">
                        —
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Category Summary Table ── */}
            <div className="md:col-span-1 max-h-[500px] overflow-auto">
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-xs font-semibold text-gray-600">
                  Category Summary
                </span>
                {summaryData.length > 0 && (
                  <button
                    onClick={handleExportCategorySummary}
                    title="Export Category Summary"
                    className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium border border-green-400 rounded px-1.5 py-0.5 hover:bg-green-50 transition"
                  >
                    <FaDownload className="text-[10px]" />
                    Export
                  </button>
                )}
              </div>
              <table className="w-full table-fixed border bg-white text-xs text-left rounded-lg">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[80px]">Category</th>
                    <th className="px-1 py-1 border min-w-[80px]">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── Uses summaryData (full dataset) for accurate counts ── */}
                  {Object.entries(getCategoryCounts(summaryData)).map(
                    ([category, count], index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{category}</td>
                        <td className="px-1 py-1 border">{count}</td>
                      </tr>
                    ),
                  )}
                  {summaryData.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-center py-3 text-gray-400">
                        —
                      </td>
                    </tr>
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
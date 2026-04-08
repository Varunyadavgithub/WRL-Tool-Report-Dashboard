import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import ExportButton from "../../components/ui/ExportButton";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/ui/Loader";
import { FaCaretUp, FaCaretDown, FaDownload, FaFilter, FaTable, FaBolt } from "react-icons/fa";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import * as XLSX from "xlsx";

/* ─────────────────────────────────────────────────────────────
   Small stat card shown above the table
───────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, accent }) => (
  <div
    className="flex flex-col gap-1 rounded-xl border px-5 py-3 bg-white shadow-sm"
    style={{ borderLeft: `4px solid ${accent}` }}
  >
    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      {label}
    </span>
    <span className="text-2xl font-bold text-gray-800">{value}</span>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Sortable column header
───────────────────────────────────────────────────────────── */
const SortTh = ({ label, colKey, sortConfig, onSort, className = "" }) => {
  const active = sortConfig.key === colKey;
  return (
    <th
      className={`px-3 py-2 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition ${className}`}
      onClick={() => onSort(colKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          sortConfig.direction === "asc" ? (
            <FaCaretUp className="text-blue-500 text-[10px]" />
          ) : (
            <FaCaretDown className="text-blue-500 text-[10px]" />
          )
        ) : (
          <FaCaretUp className="text-gray-300 text-[10px]" />
        )}
      </div>
    </th>
  );
};

const TotalProduction = () => {
  /* ── loading states ───────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  /* ── filter state ─────────────────────────────────────────── */
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);

  const departmentOptions = [
    { label: "Post Foaming", value: "post-foaming" },
    { label: "Final Loading", value: "final-loading" },
    { label: "Final", value: "final" },
  ];
  const [selectedDep, setSelectedDep] = useState(departmentOptions[0]);

  /* ── data state ───────────────────────────────────────────── */
  const [totalProductionData, setTotalProductionData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);

  /* ── pagination ───────────────────────────────────────────── */
  const [page, setPage] = useState(1);
  const LIMIT = 1000;
  const [hasMore, setHasMore] = useState(false);

  /* ── sort ─────────────────────────────────────────────────── */
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  /* ── infinite scroll ──────────────────────────────────────── */
  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      // ✅ FIX: when a model filter is active, we're slicing already-loaded
      // data client-side — never trigger a new page fetch.
      if (loading || selectedModelName) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prev) => prev + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, selectedModelName],
  );

  /* ── RTK Query ────────────────────────────────────────────── */
  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  /* ── reset table when filters change ─────────────────────── */
  useEffect(() => {
    setTotalProductionData([]);
    setSummaryData([]);
    setTotalCount(0);
    setPage(1);
    setHasMore(false);
    setSelectedModelName(null);
  }, [selectedDep, selectedModelVariant]);

  /* ── paginated fetch (main table) ─────────────────────────── */
  const fetchTotalProductionData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return;
    }
    try {
      setLoading(true);
      const params = {
        startDate: startTime,
        endDate: endTime,
        page: pageNumber,
        limit: LIMIT,
        department: selectedDep.value,
        model: selectedModelVariant ? parseInt(selectedModelVariant.value, 10) : 0,
      };
      const res = await axios.get(`${baseURL}prod/barcode-details`, { params });
      if (res?.data?.success) {
        const incoming = res.data.data ?? [];
        setTotalProductionData((prev) => {
          const existing = new Set(prev.map((d) => d.FG_SR));
          const unique = incoming.filter((item) => !existing.has(item.FG_SR));
          return pageNumber === 1 ? incoming : [...prev, ...unique];
        });
        if (pageNumber === 1) setTotalCount(res.data.totalCount ?? 0);
        // ✅ BUG FIX: use >= LIMIT not > 0 to avoid spurious extra fetch
        setHasMore(incoming.length >= LIMIT);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch production data.");
    } finally {
      setLoading(false);
    }
  };

  /* ── full export fetch (also used for summary counts) ─────── */
  const fetchExportData = useCallback(async () => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return [];
    }
    try {
      const params = {
        startDate: startTime,
        endDate: endTime,
        department: selectedDep.value,
        model: selectedModelVariant ? parseInt(selectedModelVariant.value, 10) : 0,
      };
      const res = await axios.get(`${baseURL}prod/export-total-production`, { params });
      return res?.data?.success ? res.data.data : [];
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch export data.");
      return [];
    }
  }, [startTime, endTime, selectedDep, selectedModelVariant]);

  /* ── infinite scroll page trigger ────────────────────────── */
  useEffect(() => {
    if (page === 1) return;
    fetchTotalProductionData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* ── quick filter helpers ─────────────────────────────────── */
  const fmt = (date) => {
    const p = (n) => (n < 10 ? "0" + n : n);
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
  };

  const applyQuickFilter = async (endpoint, startDate, endDate, setLoadingFn) => {
    try {
      setLoadingFn(true);
      // ✅ BUG FIX: clear selectedModelName on every quick filter
      setTotalProductionData([]);
      setSummaryData([]);
      setTotalCount(0);
      setSelectedModelName(null);

      const params = {
        startDate,
        endDate,
        department: selectedDep.value,
        model: selectedModelVariant ? parseInt(selectedModelVariant.value, 10) : 0,
      };
      const res = await axios.get(`${baseURL}prod/${endpoint}`, { params });
      if (res?.data?.success) {
        setTotalProductionData(res.data.data);
        setSummaryData(res.data.data);
        setTotalCount(res.data.totalCount ?? res.data.data.length);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to fetch data.`);
    } finally {
      setLoadingFn(false);
    }
  };

  const fetchYesterday = () => {
    const now = new Date();
    const today8 = new Date(now); today8.setHours(8, 0, 0, 0);
    const yday8 = new Date(today8); yday8.setDate(today8.getDate() - 1);
    applyQuickFilter("yday-total-production", fmt(yday8), fmt(today8), setYdayLoading);
  };

  const fetchToday = () => {
    const now = new Date();
    const today8 = new Date(now); today8.setHours(8, 0, 0, 0);
    applyQuickFilter("today-total-production", fmt(today8), fmt(now), setTodayLoading);
  };

  const fetchMTD = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    applyQuickFilter("month-total-production", fmt(startOfMonth), fmt(now), setMonthLoading);
  };

  /* ── query button ─────────────────────────────────────────── */
  const handleQuery = async () => {
    setPage(1);
    setTotalProductionData([]);
    setSummaryData([]);
    setHasMore(false);
    setSelectedModelName(null);

    // ✅ BUG FIX: fire both fetches, reuse fetchExportData for summaries
    // avoids double-calling the export endpoint later
    fetchTotalProductionData(1);
    const fullData = await fetchExportData();
    setSummaryData(fullData);
  };

  /* ── summary helpers ──────────────────────────────────────── */
  const getCategoryCounts = (data) => {
    const counts = {};
    data.forEach((item) => {
      const key = item.category || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  const getModelNameCount = (data) => {
    const counts = {};
    data.forEach((item) => {
      const key = item.Model_Name || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  /* ── export helpers ───────────────────────────────────────── */
  const exportToExcel = (rows, sheetName, fileName) => {
    if (!rows?.length) { toast.error("No data to export."); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const handleExportModelSummary = () => {
    const rows = Object.entries(getModelNameCount(summaryData)).map(
      ([Model_Name, Count]) => ({ Model_Name, Count }),
    );
    exportToExcel(rows, "Model Summary", "Model_Summary_Report");
  };

  const handleExportCategorySummary = () => {
    const rows = Object.entries(getCategoryCounts(summaryData)).map(
      ([Category, Count]) => ({ Category, Count }),
    );
    exportToExcel(rows, "Category Summary", "Category_Summary_Report");
  };

  /* ── filter / sort ────────────────────────────────────────── */
  // ✅ FIX: when a model is selected, filter from summaryData (full dataset)
  // not totalProductionData (paginated — may not have loaded all pages yet).
  // When no model is selected, use totalProductionData for infinite scroll.
  const filteredData = selectedModelName
    ? summaryData.filter((item) => item.Model_Name === selectedModelName)
    : totalProductionData;

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return [...filteredData];
    return [...filteredData].sort((a, b) => {
      const av = a[sortConfig.key] ?? "";
      const bv = b[sortConfig.key] ?? "";
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const requestSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const handleModelRowClick = (modelName) =>
    setSelectedModelName((prev) => (prev === modelName ? null : modelName));

  if (variantsLoading) return <Loader />;

  const anyLoading = ydayLoading || todayLoading || monthLoading;

  /* ── derived stats ────────────────────────────────────────── */
  const modelCount = Object.keys(getModelNameCount(summaryData)).length;
  const categoryCount = Object.keys(getCategoryCounts(summaryData)).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="mb-6">
        <Title title="Total Production" align="center" />
        <p className="text-center text-sm text-gray-400 mt-1 tracking-wide">
          Barcode-level production details by department
        </p>
      </div>

      {/* ── Control Bar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Filters Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <FaFilter className="text-blue-400" />
            Filters
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <SelectField
              label="Model Variant"
              options={variants}
              value={selectedModelVariant?.value || ""}
              onChange={(e) =>
                setSelectedModelVariant(
                  variants.find((o) => o.value === e.target.value) || null,
                )
              }
            />
            <SelectField
              label="Department"
              options={departmentOptions}
              value={selectedDep?.value || ""}
              onChange={(e) =>
                setSelectedDep(
                  departmentOptions.find((o) => o.value === e.target.value) || null,
                )
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
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
          <div className="flex items-center gap-3">
            <Button
              onClick={handleQuery}
              bgColor={loading ? "bg-gray-300" : "bg-blue-600"}
              textColor="text-white"
              className={`px-6 rounded-lg font-semibold shadow-sm ${loading ? "cursor-not-allowed" : "hover:bg-blue-700"}`}
              disabled={loading}
            >
              {loading ? "Loading…" : "Query"}
            </Button>
            {totalProductionData.length > 0 && (
              // ✅ BUG FIX: ExportButton reuses fetchExportData (same reference),
              // no extra endpoint call when export is triggered manually
              <ExportButton
                fetchData={fetchExportData}
                filename="Total_Production_Report"
              />
            )}
            {totalCount > 0 && (
              <span className="ml-auto text-sm font-medium text-gray-500">
                Total:{" "}
                <span className="text-blue-600 font-bold text-base">
                  {totalCount.toLocaleString()}
                </span>
                {selectedModelName && (
                  <span className="ml-2 text-xs text-amber-600 font-semibold">
                    (filtered: {sortedData.length.toLocaleString()})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Quick Filters Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <FaBolt className="text-yellow-400" />
            Quick Filters
          </div>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            {[
              {
                label: "Yesterday",
                shortLabel: "YDAY",
                handler: fetchYesterday,
                isLoading: ydayLoading,
                bg: "bg-amber-500 hover:bg-amber-600",
              },
              {
                label: "Today",
                shortLabel: "TODAY",
                handler: fetchToday,
                isLoading: todayLoading,
                bg: "bg-blue-500 hover:bg-blue-600",
              },
              {
                label: "Month to Date",
                shortLabel: "MTD",
                handler: fetchMTD,
                isLoading: monthLoading,
                bg: "bg-emerald-500 hover:bg-emerald-600",
              },
            ].map(({ label, shortLabel, handler, isLoading, bg }) => (
              <button
                key={shortLabel}
                onClick={handler}
                disabled={isLoading || anyLoading}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${bg}`}
              >
                <span>{label}</span>
                {isLoading ? (
                  <span className="text-xs opacity-75 animate-pulse">Loading…</span>
                ) : (
                  <span className="text-xs font-bold opacity-60">{shortLabel}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────── */}
      {summaryData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Units" value={totalCount.toLocaleString()} accent="#3b82f6" />
          <StatCard label="Model Variants" value={modelCount} accent="#8b5cf6" />
          <StatCard label="Categories" value={categoryCount} accent="#10b981" />
          <StatCard
            label="Filtered / Showing"
            value={sortedData.length.toLocaleString()}
            accent="#f59e0b"
          />
        </div>
      )}

      {/* ── Main Data Section ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          <FaTable className="text-gray-400" />
          Production Records
          {selectedModelName && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              {selectedModelName}
              <button
                onClick={() => setSelectedModelName(null)}
                className="hover:text-red-500 transition font-bold ml-0.5"
                title="Clear filter"
              >
                ✕
              </button>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-gray-100">

          {/* ── Main Table ─────────────────────────────────────── */}
          <div className="xl:col-span-3 overflow-auto max-h-[520px]">
            <table className="w-full text-sm text-left min-w-[600px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  {[
                    { label: "Model Name", key: "Model_Name" },
                    { label: "FG Serial No.", key: "FG_SR" },
                    { label: "Asset Tag", key: "Asset_tag" },
                    { label: "Customer QR", key: "CustomerQR" },
                    { label: "NFC UID", key: "NFC_UID" },
                  ].map(({ label, key }) => (
                    <SortTh
                      key={key}
                      label={label}
                      colKey={key}
                      sortConfig={sortConfig}
                      onSort={requestSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedData.map((item, index) => {
                  const isLast = index === sortedData.length - 1;
                  return (
                    <tr
                      key={index}
                      ref={isLast && !selectedModelName ? lastRowRef : null}
                      className="hover:bg-slate-50 transition text-gray-700"
                    >
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                        {item.Model_Name}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">
                        {item.FG_SR}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">
                        {item.Asset_tag || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 break-all">
                        {item.CustomerQR || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">
                        {item.NFC_UID || <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {!loading && sortedData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                      No records found. Apply filters and click Query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {loading && (
              <div className="flex justify-center py-4">
                <Loader />
              </div>
            )}
          </div>

          {/* ── Model Summary ────────────────────────────────── */}
          <div className="xl:col-span-1 overflow-auto max-h-[520px] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                By Model
              </span>
              {summaryData.length > 0 && (
                <button
                  onClick={handleExportModelSummary}
                  title="Export Model Summary"
                  className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold border border-emerald-300 rounded-md px-2 py-0.5 hover:bg-emerald-50 transition"
                >
                  <FaDownload className="text-[9px]" /> Export
                </button>
              )}
            </div>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="pb-1 font-semibold">Model</th>
                  <th className="pb-1 font-semibold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(getModelNameCount(summaryData)).map(
                  ([modelName, count]) => (
                    <tr
                      key={modelName}
                      onClick={() => handleModelRowClick(modelName)}
                      className={`cursor-pointer transition ${
                        selectedModelName === modelName
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "hover:bg-slate-50 text-gray-700"
                      }`}
                    >
                      <td className="py-1.5 pr-2 truncate max-w-[100px]" title={modelName}>
                        {modelName}
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold">
                        {count}
                      </td>
                    </tr>
                  ),
                )}
                {summaryData.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-gray-300">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Category Summary ─────────────────────────────── */}
          <div className="xl:col-span-1 overflow-auto max-h-[520px] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                By Category
              </span>
              {summaryData.length > 0 && (
                <button
                  onClick={handleExportCategorySummary}
                  title="Export Category Summary"
                  className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold border border-emerald-300 rounded-md px-2 py-0.5 hover:bg-emerald-50 transition"
                >
                  <FaDownload className="text-[9px]" /> Export
                </button>
              )}
            </div>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="pb-1 font-semibold">Category</th>
                  <th className="pb-1 font-semibold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(getCategoryCounts(summaryData)).map(
                  ([category, count]) => (
                    <tr
                      key={category}
                      className="hover:bg-slate-50 text-gray-700 transition"
                    >
                      <td className="py-1.5 pr-2 truncate max-w-[100px]" title={category}>
                        {category}
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold">
                        {count}
                      </td>
                    </tr>
                  ),
                )}
                {summaryData.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-gray-300">
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
  );
};

export default TotalProduction;
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import ExportButton from "../../components/ui/ExportButton";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  Search,
  ChevronUp,
  ChevronDown,
  Loader2,
  PackageOpen,
  X,
} from "lucide-react";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── QuickBtn ───────────────────────────────────────────────────────────────────
const QuickBtn = ({ label, sublabel, loading, onClick, colorClass }) => (
  <button
    disabled={loading}
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center gap-0.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
      loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : colorClass
    }`}
  >
    {loading ? (
      <span className="flex items-center gap-2">
        <Spinner /> Loading…
      </span>
    ) : (
      <>
        <span className="text-[15px] font-bold tracking-widest">{label}</span>
        <span className="text-[10px] opacity-75 font-normal">{sublabel}</span>
      </>
    )}
  </button>
);

// ── SortIcon ───────────────────────────────────────────────────────────────────
const SortIcon = ({ active, dir }) => (
  <span className="inline-flex flex-col ml-1">
    <ChevronUp
      className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === "asc" ? "text-blue-500" : "text-slate-400"}`}
    />
    <ChevronDown
      className={`w-2.5 h-2.5          ${active && dir === "desc" ? "text-blue-500" : "text-slate-400"}`}
    />
  </span>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const NFCReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [nfcReportData, setNfcReportData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  // ── Date helpers ───────────────────────────────────────────────────────────
  const pad = (n) => (n < 10 ? "0" + n : n);
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNFCReportData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}prod/nfc-details`, {
        params: {
          startDate: startTime,
          endDate: endTime,
          page: pageNumber,
          limit,
        },
      });
      if (res?.data?.success) {
        setNfcReportData((prev) => {
          const existing = new Set(prev.map((d) => d.FG_SR));
          const uniqueNew = res.data.data.filter(
            (item) => !existing.has(item.FG_SR),
          );
          return pageNumber === 1 ? res.data.data : [...prev, ...uniqueNew];
        });
        if (pageNumber === 1) setTotalCount(res.data.totalCount);
        setHasMore(res.data.data.length > 0);
      }
    } catch {
      toast.error("Failed to fetch NFC Report data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchExportData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return [];
    }
    try {
      const res = await axios.get(`${baseURL}prod/export-nfc-report`, {
        params: { startDate: startTime, endDate: endTime },
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Failed to fetch export NFC Report data.");
      return [];
    }
  };

  // ── Quick filters ──────────────────────────────────────────────────────────
  const quickFetch = async (url, start, end, setLoader) => {
    try {
      setLoader(true);
      setNfcReportData([]);
      setTotalCount(0);
      const res = await axios.get(`${baseURL}${url}`, {
        params: { startDate: start, endDate: end },
      });
      if (res?.data?.success) {
        setNfcReportData(res.data.data);
        setTotalCount(res.data.totalCount);
      }
    } catch {
      toast.error("Failed to fetch data.");
    } finally {
      setLoader(false);
    }
  };

  const fetchYesterdaynfcReportData = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const yest8AM = new Date(today8AM);
    yest8AM.setDate(today8AM.getDate() - 1);
    quickFetch(
      "prod/yday-nfc-report",
      fmt(yest8AM),
      fmt(today8AM),
      setYdayLoading,
    );
  };
  const fetchTodaynfcReportData = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    quickFetch(
      "prod/today-nfc-report",
      fmt(today8AM),
      fmt(now),
      setTodayLoading,
    );
  };
  const fetchMTDnfcReportData = () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    );
    quickFetch(
      "prod/month-nfc-report",
      fmt(startOfMonth),
      fmt(now),
      setMonthLoading,
    );
  };

  useEffect(() => {
    if (page > 1) fetchNFCReportData(page);
  }, [page]);

  const handleQuery = () => {
    setPage(1);
    setNfcReportData([]);
    setHasMore(false);
    setSelectedModelName(null);
    fetchNFCReportData(1);
  };

  // ── Model count ────────────────────────────────────────────────────────────
  const modelNameCount = useMemo(() => {
    const counts = {};
    nfcReportData.forEach((item) => {
      const m = item.Model_Name || "Unknown";
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }, [nfcReportData]);

  const filteredData = selectedModelName
    ? nfcReportData.filter((item) => item.Model_Name === selectedModelName)
    : nfcReportData;

  // ── Sort ───────────────────────────────────────────────────────────────────
  const requestSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = a[sortConfig.key] || "",
        bv = b[sortConfig.key] || "";
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const COLUMNS = [
    { label: "Model Name", key: "Model_Name" },
    { label: "FG Serial No.", key: "FG_SR" },
    { label: "Asset Tag", key: "Asset_tag" },
    { label: "Customer QR", key: "CustomerQR" },
    { label: "NFC UID", key: "NFC_UID" },
    { label: "Created On", key: "CreatedOn" },
  ];

  const anyLoading = ydayLoading || todayLoading || monthLoading;

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            NFC Report
          </h1>
          <p className="text-[11px] text-slate-400">
            NFC tag tracking across finished goods
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalCount ?? 0}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total Records
            </span>
          </div>
          {Object.keys(modelNameCount).length > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {Object.keys(modelNameCount).length}
              </span>
              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Model Types
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3 min-h-0">
        {/* ── FILTERS + QUICK FILTERS ROW ── */}
        <div className="flex gap-3 shrink-0">
          {/* Filters card */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Filters
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[185px] flex-1">
                <DateTimePicker
                  label="Start Time"
                  name="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="min-w-[185px] flex-1">
                <DateTimePicker
                  label="End Time"
                  name="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5 shrink-0">
                <button
                  onClick={handleQuery}
                  disabled={loading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? <Spinner /> : <Search className="w-4 h-4" />}
                  {loading ? "Fetching…" : "Query"}
                </button>
                {nfcReportData.length > 0 && (
                  <ExportButton
                    fetchData={fetchExportData}
                    filename="NFC_Report"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quick filters card */}
          <div className="w-60 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
              Quick Filters
            </p>
            <p className="text-[10px] text-slate-400 mb-3">
              Select a preset time range.
            </p>
            <div className="flex flex-col gap-2">
              <QuickBtn
                label="YESTERDAY"
                sublabel="Prev day 08:00 → today 08:00"
                loading={ydayLoading}
                onClick={fetchYesterdaynfcReportData}
                colorClass="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              />
              <QuickBtn
                label="TODAY"
                sublabel="08:00 → now"
                loading={todayLoading}
                onClick={fetchTodaynfcReportData}
                colorClass="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              />
              <QuickBtn
                label="MTD"
                sublabel="Month to date"
                loading={monthLoading}
                onClick={fetchMTDnfcReportData}
                colorClass="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* ── SUMMARY PANEL ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Summary
              </span>
              {selectedModelName && (
                <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  Filtered: {selectedModelName}
                  <button
                    onClick={() => setSelectedModelName(null)}
                    className="ml-1 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {selectedModelName
                ? `${sortedData.length} of ${nfcReportData.length} records`
                : nfcReportData.length > 0
                  ? `${nfcReportData.length} records`
                  : ""}
            </span>
          </div>

          {/* Two-panel body */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* ── Main NFC table ── */}
            <div className="flex-1 overflow-auto min-w-0">
              {anyLoading && nfcReportData.length === 0 ? (
                <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                  <Spinner cls="w-5 h-5" />{" "}
                  <span className="text-sm">Loading…</span>
                </div>
              ) : (
                <table className="min-w-[900px] w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                        Sr. No.
                      </th>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => requestSort(col.key)}
                          className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors"
                        >
                          <span className="flex items-center">
                            {col.label}
                            <SortIcon
                              active={sortConfig.key === col.key}
                              dir={sortConfig.direction}
                            />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.length > 0 ? (
                      sortedData.map((item, idx) => {
                        const isLast = idx === sortedData.length - 1;
                        return (
                          <tr
                            key={idx}
                            ref={isLast ? lastRowRef : null}
                            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                          >
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                              {item.Model_Name}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                              {item.FG_SR}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                              {item.Asset_tag}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                              {item.CustomerQR}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-blue-600 whitespace-nowrap">
                              {item.NFC_UID}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                              {item.CreatedOn?.replace("T", " ").replace(
                                "Z",
                                "",
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <PackageOpen
                              className="w-12 h-12 opacity-20"
                              strokeWidth={1.2}
                            />
                            <p className="text-sm">
                              No data found. Apply filters and click Query.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {loading && nfcReportData.length > 0 && (
                <div className="flex items-center justify-center py-4 gap-2 text-blue-600 text-xs border-t border-slate-100">
                  <Spinner /> Loading more records…
                </div>
              )}
            </div>

            {/* ── By Model panel ── */}
            <div className="w-64 xl:w-72 shrink-0 border-l border-slate-200 flex flex-col bg-slate-50/50">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  By Model
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                {Object.keys(modelNameCount).length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-10">
                    No summary yet.
                  </p>
                ) : (
                  <table className="w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-left">
                          Model
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modelNameCount).map(
                        ([modelName, count]) => (
                          <tr
                            key={modelName}
                            onClick={() =>
                              setSelectedModelName((p) =>
                                p === modelName ? null : modelName,
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              selectedModelName === modelName
                                ? "bg-blue-100"
                                : "hover:bg-white even:bg-white/60"
                            }`}
                          >
                            <td
                              className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 break-all"
                              title={modelName}
                            >
                              {modelName}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-right">
                              <span
                                className={`inline-block font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                  selectedModelName === modelName
                                    ? "bg-blue-200 text-blue-800"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {count}
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {Object.keys(modelNameCount).length > 0 && (
                <p className="text-[10px] text-slate-400 text-center px-3 py-2 border-t border-slate-200">
                  Tap a row to filter · tap again to clear
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFCReport;

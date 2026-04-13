import { useCallback, useEffect, useRef, useState } from "react";
import SelectField from "../../components/ui/SelectField";
import axios from "axios";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  useGetModelVariantsQuery,
  useGetStagesQuery,
} from "../../redux/api/commonApi.js";
import { Search, X, Loader2, PackageOpen, Zap } from "lucide-react";

/* ── Spinner using Lucide ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ── Quick filter button ── */
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

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const Overview = () => {
  /* ── Loading states ── */
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  /* ── Filter state ── */
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  /* ── Data state ── */
  const [productionData, setProductionData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);
  const [isQuickMode, setIsQuickMode] = useState(false);

  /* ── RTK Query ── */
  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();
  const {
    data: stages = [],
    isLoading: stagesLoading,
    error: stagesError,
  } = useGetStagesQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
    if (stagesError) toast.error("Failed to load stages");
  }, [variantsError, stagesError]);

  /* ── Infinite scroll observer ── */
  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading || isQuickMode) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, isQuickMode],
  );

  /* ── Date helpers ── */
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  /* ── Paginated fetch ── */
  const fetchProductionData = async (pageNum = 1) => {
    if (!startTime || !endTime || (!selectedModelVariant && !selectedStage)) {
      toast.error("Please select a Stage and a Time Range.");
      return;
    }
    try {
      setLoading(true);
      const params = {
        startTime,
        endTime,
        page: pageNum,
        limit,
        stationCode: selectedStage?.value || null,
        model: selectedModelVariant ? Number(selectedModelVariant.value) : 0,
      };
      const res = await axios.get(`${baseURL}prod/fgdata`, { params });
      if (res?.data?.success) {
        setProductionData((prev) =>
          pageNum === 1 ? res.data.data : [...prev, ...res.data.data],
        );
        if (pageNum === 1) setTotalCount(res.data.totalCount);
        setHasMore(res.data.data.length >= limit);
      }
    } catch {
      toast.error("Failed to fetch production data.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Quick fetch ── */
  const fetchQuickData = async (url, start, end, setLoader) => {
    if (!selectedStage) {
      toast.error("Please select a Stage before using quick filters.");
      return;
    }
    try {
      setLoader(true);
      setProductionData([]);
      setTotalCount(0);
      setSelectedModelName(null);
      setIsQuickMode(true);

      const params = {
        startTime: start,
        endTime: end,
        stationCode: selectedStage?.value || null,
        model: selectedModelVariant ? Number(selectedModelVariant.value) : 0,
      };
      const res = await axios.get(`${baseURL}${url}`, { params });
      if (res?.data?.success) {
        setProductionData(res.data.data);
        setTotalCount(res.data.totalCount);
      }
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoader(false);
    }
  };

  /* ── Quick filter shortcuts ── */
  const fetchYesterdayProductionData = () => {
    const now = new Date();
    const today8AM = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      0,
      0,
    );
    const yest8AM = new Date(today8AM);
    yest8AM.setDate(today8AM.getDate() - 1);
    fetchQuickData(
      "prod/yday-fgdata",
      fmt(yest8AM),
      fmt(today8AM),
      setYdayLoading,
    );
  };
  const fetchTodayProductionData = () => {
    const now = new Date();
    const today8AM = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      0,
      0,
    );
    fetchQuickData(
      "prod/today-fgdata",
      fmt(today8AM),
      fmt(now),
      setTodayLoading,
    );
  };
  const fetchMTDProductionData = () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    );
    fetchQuickData(
      "prod/month-fgdata",
      fmt(startOfMonth),
      fmt(now),
      setMonthLoading,
    );
  };

  /* ── Aggregation ── */
  const aggregateProductionData = () => {
    const map = {};
    productionData.forEach((item) => {
      const model = item.Model_Name;
      const serial = item.FG_SR || item.Assembly_Sr_No;
      if (!serial) return;
      if (!map[model]) {
        map[model] = { start: serial, end: serial, count: 1 };
      } else {
        map[model].count += 1;
        if (String(serial) < String(map[model].start))
          map[model].start = serial;
        if (String(serial) > String(map[model].end)) map[model].end = serial;
      }
    });
    return Object.entries(map).map(([k, v]) => ({
      Model_Name: k,
      StartSerial: v.start,
      EndSerial: v.end,
      TotalCount: v.count,
    }));
  };

  /* ── Pagination side-effect ── */
  useEffect(() => {
    if (page > 1) fetchProductionData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* ── Export ── */
  const fetchExportData = async () => {
    if (!startTime || !endTime || (!selectedModelVariant && !selectedStage)) {
      toast.error("Please select Stage and Time Range.");
      return [];
    }
    try {
      const res = await axios.get(`${baseURL}prod/export-production-report`, {
        params: {
          startTime,
          endTime,
          stationCode: selectedStage?.value || null,
          model: selectedModelVariant
            ? parseInt(selectedModelVariant.value, 10)
            : 0,
        },
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Failed to fetch export data.");
      return [];
    }
  };

  /* ── Handlers ── */
  const handleFgData = () => {
    setProductionData([]);
    setPage(1);
    setSelectedModelName(null);
    setIsQuickMode(false);
    fetchProductionData(1);
  };

  const handleModelRowClick = (modelName) => {
    setSelectedModelName((prev) => (prev === modelName ? null : modelName));
    setIsQuickMode(true);
  };

  const filteredProductionData = selectedModelName
    ? productionData.filter((item) => item.Model_Name === selectedModelName)
    : productionData;

  const aggregated = aggregateProductionData();
  const anyLoading = ydayLoading || todayLoading || monthLoading;

  if (variantsLoading || stagesLoading) return <Loader />;

  /* ════════════════════════════════════════════
     RENDER
     — Overview lives inside Layout's <Outlet />.
     — The outlet wrapper has: overflow-auto (scrolls the page).
     — So Overview uses h-full + flex-col, with sticky for its own sub-header.
     — NO fixed/h-screen — those would escape the layout.
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page sub-header — sticky within the outlet's scroll container ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Production Report
          </h1>
          <p className="text-[11px] text-slate-400">
            FG assembly monitoring · Real-time data
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
          {aggregated.length > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {aggregated.length}
              </span>
              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Model Types
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3 min-h-0">
        {/* ── Filters + Quick filters row ── */}
        <div className="flex gap-3 shrink-0">
          {/* Filters card */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Filters
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[190px] flex-1">
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
              </div>
              <div className="min-w-[190px] flex-1">
                <SelectField
                  label="Stage Name"
                  options={stages}
                  value={selectedStage?.value || ""}
                  onChange={(e) =>
                    setSelectedStage(
                      stages.find((o) => o.value === e.target.value) || null,
                    )
                  }
                />
              </div>
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
                  onClick={handleFgData}
                  disabled={loading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? "Fetching…" : "Query"}
                </button>
                {productionData.length > 0 && !isQuickMode && (
                  <ExportButton
                    fetchData={fetchExportData}
                    filename="Production_Report"
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
              Select a stage first.
            </p>
            <div className="flex flex-col gap-2">
              <QuickBtn
                label="YESTERDAY"
                sublabel="Prev day 08:00 → today 08:00"
                loading={ydayLoading}
                onClick={fetchYesterdayProductionData}
                colorClass="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              />
              <QuickBtn
                label="TODAY"
                sublabel="08:00 → now"
                loading={todayLoading}
                onClick={fetchTodayProductionData}
                colorClass="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              />
              <QuickBtn
                label="MTD"
                sublabel="Month to date"
                loading={monthLoading}
                onClick={fetchMTDProductionData}
                colorClass="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* ── Summary — fills remaining height ── */}
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
                    onClick={() => {
                      setSelectedModelName(null);
                      setIsQuickMode(false);
                    }}
                    className="ml-1 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isQuickMode && (
                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium text-[11px]">
                  <Zap className="w-3 h-3" />
                  Quick filter mode
                </span>
              )}
              <span className="text-[11px] text-slate-400">
                {selectedModelName
                  ? `${filteredProductionData.length} of ${productionData.length} records`
                  : productionData.length > 0
                    ? `${productionData.length} records`
                    : ""}
              </span>
            </div>
          </div>

          {/* Two-panel body */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* ── Detail table ── */}
            <div className="flex-1 overflow-auto min-w-0">
              {anyLoading && productionData.length === 0 ? (
                <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                  <Spinner cls="w-5 h-5" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : (
                <table className="min-w-[1200px] w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "Sr. No.",
                        "Model Name",
                        "Model No.",
                        "Station",
                        "Assembly Sr.",
                        "Asset Tag",
                        "Customer QR",
                        "User",
                        "FG Serial",
                        "Created On",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProductionData.length > 0 ? (
                      filteredProductionData.map((item, idx) => {
                        const isLast =
                          !isQuickMode &&
                          idx === filteredProductionData.length - 1;
                        return (
                          <tr
                            key={idx}
                            ref={isLast ? lastRowRef : null}
                            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                          >
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                              {item.SrNo || idx + 1}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                              {item.Model_Name}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                              {item.ModelName}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                              {item.StationCode}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                              {item.Assembly_Sr_No}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                              {item.Asset_tag}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                              {item.Customer_QR}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                              {item.UserName}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                              {item.FG_SR}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
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
                        <td colSpan={10} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <PackageOpen
                              className="w-12 h-12 opacity-20"
                              strokeWidth={1.2}
                            />
                            <p className="text-sm">
                              {productionData.length > 0 && selectedModelName
                                ? `No records match model "${selectedModelName}"`
                                : "No data found. Apply filters and click Query."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {loading && productionData.length > 0 && (
                <div className="flex items-center justify-center py-4 gap-2 text-blue-600 text-xs border-t border-slate-100">
                  <Spinner cls="w-4 h-4" /> Loading more records…
                </div>
              )}
            </div>

            {/* ── By Model panel ── */}
            <div className="w-80 xl:w-96 shrink-0 border-l border-slate-200 flex flex-col bg-slate-50/50">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 bg-slate-100 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  By Model
                </span>
                {productionData.length > 0 && (
                  <ExportButton
                    fetchData={aggregateProductionData}
                    filename="Production_Summary"
                  />
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {anyLoading && productionData.length === 0 ? (
                  <div className="flex items-center justify-center h-20 gap-2 text-slate-400 text-xs">
                    <Spinner cls="w-4 h-4" /> Loading…
                  </div>
                ) : aggregated.length === 0 ? (
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
                          Start
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          End
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregated.map((item, idx) => (
                        <tr
                          key={idx}
                          onClick={() => handleModelRowClick(item.Model_Name)}
                          className={`cursor-pointer transition-colors ${
                            selectedModelName === item.Model_Name
                              ? "bg-blue-100"
                              : "hover:bg-white even:bg-white/60"
                          }`}
                        >
                          <td
                            className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 break-all"
                            title={item.Model_Name}
                          >
                            {item.Model_Name}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 text-right break-all">
                            {item.StartSerial}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 text-right break-all">
                            {item.EndSerial}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-right">
                            <span
                              className={`inline-block font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                selectedModelName === item.Model_Name
                                  ? "bg-blue-200 text-blue-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {item.TotalCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {aggregated.length > 0 && (
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

export default Overview;

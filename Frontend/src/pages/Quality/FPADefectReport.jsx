import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import ExportButton from "../../components/ui/ExportButton";
import FpaBarGraph from "../../components/graphs/FpaReportsBarGraph";
import Loader from "../../components/ui/Loader";
import { baseURL } from "../../assets/assets";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  Title as ChartTitle,
} from "chart.js";

import {
  Search,
  Filter,
  Zap,
  ChevronRight,
  BarChart3,
  Table2,
  PackageOpen,
  Loader2,
  AlertTriangle,
  FileText,
  CalendarDays,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  ChartTitle,
);

// ─── Constants ─────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { label: "Daily", value: "Daily" },
  { label: "Monthly", value: "Monthly" },
  { label: "Yearly", value: "Yearly" },
];

const TOP_OPTIONS = [5, 10, 15, 20, 30].map((n) => ({
  label: `Top ${n}`,
  value: n,
}));

// ─── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── EmptyState ────────────────────────────────────────────────────────────────
const EmptyState = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="py-10 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">
          No data available. Run a query to see results.
        </p>
      </div>
    </td>
  </tr>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const FpaDefectReport = () => {
  const [reportType, setReportType] = useState("Daily");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [model, setModel] = useState("");
  const [defect, setDefect] = useState("");
  const [top, setTop] = useState(5);
  const [variants, setVariants] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get(`${baseURL}shared/model-variants`)
      .then((res) =>
        setVariants(
          res.data.map((x) => ({
            label: x.MaterialName,
            value: x.MaterialName,
          })),
        ),
      )
      .catch(() => toast.error("Failed to load model variants"));
  }, []);

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select Start & End Date");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/fpa-defect-report`, {
        params: {
          ReportType: reportType,
          StartDate: startDate,
          EndDate: endDate,
          Model: model,
          DefectName: defect,
          TopCount: top,
        },
      });
      setData(res.data.results || []);
      if ((res.data.results || []).length === 0) {
        toast("No records found.", { icon: "📭" });
      } else {
        toast.success(`Loaded ${res.data.results.length} records`);
      }
    } catch {
      toast.error("Failed to fetch report");
    }
    setLoading(false);
  };

  const chart = useMemo(() => {
    if (!data.length) return null;
    return {
      labels: data.map((x) => x.AddDefect || x.MonthName || x.Year),
      datasets: [
        {
          label: `Top ${top} Defects`,
          data: data.map((x) => x.TotalCount),
          backgroundColor: "rgba(59, 130, 246, 0.18)",
          borderColor: "rgba(37, 99, 235, 1)",
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [data, top]);

  const hasData = data.length > 0;
  const columns = hasData ? Object.keys(data[0]) : [];

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            FPA Defect Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Top defect analysis by period — Daily · Monthly · Yearly
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Report type badge */}
          <span className="flex items-center gap-1.5 text-[11px] text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full font-medium">
            <CalendarDays className="w-3 h-3" />
            {reportType}
          </span>

          {/* Records count */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {data.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>

          {/* Top N badge */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-emerald-700">
              {top}
            </span>
            <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
              Top Count
            </span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters & Parameters
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
            {/* Left: controls */}
            <div className="space-y-3">
              {/* Row 1: Report type + dates */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[140px] flex-1">
                  <SelectField
                    label="Report Type"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    options={REPORT_TYPES}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="Start Date"
                    name="startDate"
                    value={startDate}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="End Date"
                    name="endDate"
                    value={endDate}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Model + Defect + Top + Actions */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[170px] flex-1">
                  <SelectField
                    label="Model (Optional)"
                    value={model}
                    options={[{ label: "All Models", value: "" }, ...variants]}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>

                <div className="min-w-[170px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Defect Name (LIKE)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search defect…"
                      value={defect}
                      onChange={(e) => setDefect(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>

                <div className="min-w-[120px]">
                  <SelectField
                    label="Top Defects"
                    value={top}
                    onChange={(e) => setTop(e.target.value)}
                    options={TOP_OPTIONS}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pb-0.5 shrink-0">
                  <button
                    onClick={fetchReport}
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
                    {loading ? "Loading…" : "Query"}
                  </button>

                  {hasData && (
                    <ExportButton data={data} filename="FPA_Defect_Report" />
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick info */}
            <div className="border-l border-slate-100 pl-5 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Report Info
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  {
                    label: "Daily",
                    desc: "Date-wise defect breakdown",
                    active: reportType === "Daily",
                  },
                  {
                    label: "Monthly",
                    desc: "Month aggregation + trend",
                    active: reportType === "Monthly",
                  },
                  {
                    label: "Yearly",
                    desc: "Year-over-year comparison",
                    active: reportType === "Yearly",
                  },
                ].map(({ label, desc, active }) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                    }`}
                  >
                    <div>
                      <div>{label}</div>
                      <div
                        className={`text-[9px] font-normal mt-0.5 ${
                          active ? "text-blue-100" : "text-slate-400"
                        }`}
                      >
                        {desc}
                      </div>
                    </div>
                    {active && <ChevronRight className="w-3 h-3" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching defect data…</p>
          </div>
        )}

        {/* ── DATA CONTENT ── */}
        {!loading && hasData && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {/* ── CHART (Monthly/Yearly only) ── */}
            {chart && reportType !== "Daily" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Defect Trend
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:block">
                    · Top {top} defects by count
                  </span>
                </div>
                <div className="p-4 h-[35vh] min-h-[250px]">
                  <FpaBarGraph
                    title="Defect Trend"
                    labels={chart.labels}
                    datasets={chart.datasets}
                  />
                </div>
              </div>
            )}

            {/* ── DATA TABLE ── */}
            <div
              className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${
                reportType === "Daily" ? "xl:col-span-2" : ""
              }`}
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <Table2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  {reportType} Defect Data
                </span>
                <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                  {data.length} rows
                </span>
              </div>
              <div className="overflow-auto max-h-[50vh]">
                <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
                      >
                        {Object.entries(row).map(([key, v], j) => {
                          let value = v;
                          if (
                            typeof v === "string" &&
                            v.includes("T") &&
                            v.includes("Z")
                          ) {
                            value = v
                              .replace("T", " ")
                              .replace("Z", "")
                              .slice(0, 10);
                          }
                          return (
                            <td
                              key={j}
                              className="px-3 py-2 border-b border-slate-100 text-slate-700 whitespace-nowrap"
                            >
                              {value ?? "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty: no data after query ── */}
        {!loading && !hasData && startDate && endDate && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle
              className="w-10 h-10 text-slate-300"
              strokeWidth={1.2}
            />
            <h3 className="text-sm font-semibold text-slate-600">
              No Records Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              No defect records matched the selected filters. Try adjusting the
              date range, model, or defect name.
            </p>
          </div>
        )}

        {/* ── Empty: no filters ── */}
        {!loading && !hasData && (!startDate || !endDate) && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">
              Select a Date Range
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Configure the filters above and click Query to load FPA defect
              report data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FpaDefectReport;

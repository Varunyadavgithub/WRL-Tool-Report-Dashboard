import { useState, useMemo, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets";
import DateTimePicker from "../../../components/ui/DateTimePicker";
import ExportButton from "../../../components/ui/ExportButton";
import {
  Search,
  X,
  Loader2,
  Package,
  Factory,
  TrendingUp,
  CalendarDays,
  Filter,
  ChevronUp,
  ChevronDown,
  PackageOpen,
  BarChart3,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

const formatDate = (date) => {
  if (!date) return "—";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return date;

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

const SortIcon = ({ active, dir }) => (
  <span className="inline-flex flex-col ml-1">
    <ChevronUp
      className={`w-2.5 h-2.5 -mb-0.5 ${
        active && dir === "asc" ? "text-blue-500" : "text-slate-400"
      }`}
    />

    <ChevronDown
      className={`w-2.5 h-2.5 ${
        active && dir === "desc" ? "text-blue-500" : "text-slate-400"
      }`}
    />
  </span>
);

/* ─────────────────────────────────────────────────────────────
   KPI CARD
───────────────────────────────────────────────────────────── */

const KpiCard = ({ icon: Icon, label, value, sub, colorCls }) => (
  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5 hover:shadow-sm transition-shadow">
    <div className={`${colorCls} p-2 rounded-lg shrink-0`}>
      <Icon className="w-4 h-4" />
    </div>

    <div className="min-w-0">
      <p className="text-base font-black text-slate-900 leading-tight">
        {value}
      </p>

      <p className="text-[10px] text-slate-500 font-medium truncate">{label}</p>

      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   STATUS PILL
───────────────────────────────────────────────────────────── */

const StatusPill = ({ children, color = "slate" }) => {
  const map = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${map[color]}`}
    >
      {children}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */

const Barcodes = () => {
  /* Filters */
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  /* Data */
  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState(null);

  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);

  /* UI */
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [filtersChanged, setFiltersChanged] = useState(false);

  /* ─────────────────────────────────────────────
     Query Parameters
  ───────────────────────────────────────────── */

  const buildParams = useCallback(
    () => ({ startDate, endDate }),
    [startDate, endDate],
  );

  /* ─────────────────────────────────────────────
     Fetch Data — table rows + KPI summary
  ───────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);

    const params = buildParams();

    const [summaryRes, kpiRes] = await Promise.allSettled([
      axios.get(`${baseURL}prod/foaming-barcode-summary`, { params }),
      axios.get(`${baseURL}prod/foaming-barcode-summary-summary`, { params }),
    ]);

    // Main table
    if (summaryRes.status === "fulfilled" && summaryRes.value?.data?.success) {
      setRows(summaryRes.value.data.data || []);
    } else {
      setRows([]);
      toast.error(
        summaryRes.reason?.response?.data?.message ||
          "Failed to fetch production data.",
      );
    }

    // KPI strip
    if (kpiRes.status === "fulfilled" && kpiRes.value?.data?.success) {
      setKpis(kpiRes.value.data.data);
    } else {
      setKpis(null);
      toast.error(
        kpiRes.reason?.response?.data?.message ||
          "Failed to fetch KPI summary.",
      );
    }

    setLoading(false);
  }, [buildParams]);

  /* ─────────────────────────────────────────────
     Query
  ───────────────────────────────────────────── */

  const handleQuery = () => {
    if (!startDate || !endDate) {
      toast.error("Please select both Start Date and End Date.");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End Date must be after Start Date.");
      return;
    }

    setQueried(true);
    setFiltersChanged(false);
    setSearch("");
    setSort({ key: null, dir: "asc" });

    fetchData();
  };

  /* ─────────────────────────────────────────────
     Filter Change
  ───────────────────────────────────────────── */

  const handleFilterChange = (setter) => (value) => {
    setter(value);

    if (queried) {
      setFiltersChanged(true);
    }
  };

  /* ─────────────────────────────────────────────
     Export
  ───────────────────────────────────────────── */

  const fetchExportData = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select a date range.");
      return [];
    }

    try {
      const res = await axios.get(
        `${baseURL}prod/export-foaming-barcode-summary`,
        {
          params: buildParams(),
        },
      );

      return res?.data?.success ? res.data.data : [];
    } catch (error) {
      toast.error("Failed to fetch export data.");
      return [];
    }
  };

  /* ─────────────────────────────────────────────
     Search
  ───────────────────────────────────────────── */

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;

    const q = search.toLowerCase();

    return rows.filter((row) =>
      String(row.Name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  /* ─────────────────────────────────────────────
     Sort
  ───────────────────────────────────────────── */

  const displayRows = useMemo(() => {
    if (!sort.key) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      let av = a[sort.key];
      let bv = b[sort.key];

      if (sort.key === "TotalQty") {
        av = Number(av || 0);
        bv = Number(bv || 0);
        return sort.dir === "asc" ? av - bv : bv - av;
      }

      if (sort.key === "OrderDate") {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
        return sort.dir === "asc" ? av - bv : bv - av;
      }

      av = String(av || "");
      bv = String(bv || "");

      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sort]);

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-y-auto">
      {/* Header — sticky within the page's own scroll container */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Barcode Print Summary
          </h1>
          <p className="text-[11px] text-slate-400">
            Summary of{" "}
            <span className="text-blue-600 font-semibold">
              Foaming Barcodes
            </span>{" "}
            printed by date
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[110px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {formatNumber(kpis?.totalQty || 0)}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total Qty
            </span>
          </div>

          {kpis && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[100px]">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {kpis.materialCount}
              </span>
              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Models
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[210px] flex-1">
              <DateTimePicker
                label="Start Date"
                name="startDate"
                value={startDate}
                onChange={(e) =>
                  handleFilterChange(setStartDate)(e.target.value)
                }
              />
            </div>

            <div className="min-w-[210px] flex-1">
              <DateTimePicker
                label="End Date"
                name="endDate"
                value={endDate}
                onChange={(e) => handleFilterChange(setEndDate)(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <button
                onClick={handleQuery}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {loading ? (
                  <>
                    <Spinner />
                    Loading…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Query
                  </>
                )}
              </button>

              {rows.length > 0 && (
                <ExportButton
                  fetchData={fetchExportData}
                  filename="Foaming_Barcode_Summary"
                />
              )}

              {filtersChanged && (
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold">
                  Filters changed — re-run
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <KpiCard
              icon={Package}
              label="Total Production"
              value={formatNumber(kpis.totalQty)}
              colorCls="bg-blue-50 text-blue-500"
            />

            <KpiCard
              icon={Factory}
              label="Models"
              value={kpis.materialCount}
              colorCls="bg-violet-50 text-violet-500"
            />

            <KpiCard
              icon={CalendarDays}
              label="Production Days"
              value={kpis.productionDays}
              colorCls="bg-emerald-50 text-emerald-500"
            />

            <KpiCard
              icon={TrendingUp}
              label="Average / Day"
              value={formatNumber(Math.round(kpis.averagePerDay))}
              colorCls="bg-amber-50 text-amber-500"
            />
          </div>
        )}

        {/* Main Panel */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Model Results
              </span>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search model…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 w-56"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {rows.length > 0 && (
                <>
                  <StatusPill color="blue">{rows.length} rows</StatusPill>
                  {search && (
                    <StatusPill color="amber">
                      {filteredRows.length} matched
                    </StatusPill>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                <Spinner cls="w-5 h-5" />
                <span className="text-sm">Loading production data…</span>
              </div>
            ) : (
              <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                      Sr. No.
                    </th>

                    <th
                      onClick={() => toggleSort("Name")}
                      className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200"
                    >
                      <span className="flex items-center">
                        Models
                        <SortIcon active={sort.key === "Name"} dir={sort.dir} />
                      </span>
                    </th>

                    <th
                      onClick={() => toggleSort("OrderDate")}
                      className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200"
                    >
                      <span className="flex items-center">
                        Production Date
                        <SortIcon
                          active={sort.key === "OrderDate"}
                          dir={sort.dir}
                        />
                      </span>
                    </th>

                    <th
                      onClick={() => toggleSort("TotalQty")}
                      className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-right cursor-pointer hover:bg-slate-200"
                    >
                      <span className="flex items-center justify-center">
                        Total Qty
                        <SortIcon
                          active={sort.key === "TotalQty"}
                          dir={sort.dir}
                        />
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {displayRows.map((item, idx) => (
                    <tr
                      key={`${item.Name}-${item.OrderDate}-${idx}`}
                      className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors"
                    >
                      <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                        {item.Name || "Unknown"}
                      </td>

                      <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(item.OrderDate)}
                        </span>
                      </td>

                      <td className="px-3 py-2 border-b border-slate-100 text-center font-mono font-bold text-blue-600 whitespace-nowrap">
                        {formatNumber(item.TotalQty)}
                      </td>
                    </tr>
                  ))}

                  {!loading && queried && displayRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <PackageOpen
                            className="w-12 h-12 opacity-20"
                            strokeWidth={1.2}
                          />
                          <p className="text-sm">
                            {search
                              ? `No models match "${search}"`
                              : "No production data found for the selected date range."}
                          </p>
                          {search && (
                            <button
                              onClick={() => setSearch("")}
                              className="text-blue-500 text-xs font-semibold hover:underline"
                            >
                              Clear search
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!queried && (
                    <tr>
                      <td colSpan={4} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <BarChart3
                            className="w-12 h-12 opacity-20"
                            strokeWidth={1.2}
                          />
                          <p className="text-sm">
                            Select a date range and click{" "}
                            <span className="text-blue-600 font-semibold">
                              Query
                            </span>
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Barcodes;

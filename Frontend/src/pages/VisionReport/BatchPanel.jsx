import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiFilter,
  FiSearch,
  FiDownload,
  FiArchive,
  FiClipboard,
  FiCheckCircle,
  FiXCircle,
  FiShield,
  FiEdit2,
  FiRotateCcw,
  FiClock,
  FiChevronDown,
  FiExternalLink,
  FiPackage,
  FiX,
  FiFileText,
  FiCalendar,
} from "react-icons/fi";
import SelectField from "../../components/ui/SelectField";
import InputField from "../../components/ui/InputField";
import { exportToXls } from "../../utils/exportToXls.js";
import {
  VISION_API,
  STATUS_META,
  StatusPill,
  StatTile,
  Spinner,
  Skeleton,
  CopyButton,
} from "./visionShared.jsx";

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom Range" },
];

const todayStr = () => new Date().toISOString().split("T")[0];
const fmtDateTime = (iso) => (iso ? iso.replace("T", " ").replace("Z", "").slice(0, 19) : "—");
const fmtDateOnly = (iso) => (iso ? iso.slice(0, 10) : "");

const PAGE_SIZE = 200;
const PAGE_DELAY_MS = 1000; // API guidance: avoid hammering the batch export endpoint

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Persists filters + last query result across a full page navigation away
// from the module (and back) or a refresh — this panel itself stays mounted
// across in-app tab switches, so this is purely a durability net. Per-tab.
const STORAGE_KEY = "wrl_vision_batch_state";

const loadPersisted = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const STATUS_CHIPS = [{ value: "All", label: "All" }, ...Object.keys(STATUS_META).map((k) => ({ value: k, label: STATUS_META[k].label }))];

const BatchPanel = ({ onOpenSerial }) => {
  const persisted = loadPersisted();

  const [period, setPeriod] = useState(persisted?.period ?? "daily");
  const [anchorDate, setAnchorDate] = useState(persisted?.anchorDate ?? todayStr());
  const [fromDate, setFromDate] = useState(persisted?.fromDate ?? todayStr());
  const [toDate, setToDate] = useState(persisted?.toDate ?? todayStr());
  const [status, setStatus] = useState(persisted?.status ?? "All");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [rows, setRows] = useState(persisted?.rows ?? []);
  const [meta, setMeta] = useState(persisted?.meta ?? null);
  const [page, setPage] = useState(persisted?.page ?? 1);
  const [hasNext, setHasNext] = useState(persisted?.hasNext ?? false);
  const [queried, setQueried] = useState(persisted?.queried ?? false);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ period, anchorDate, fromDate, toDate, status, rows, meta, page, hasNext, queried }),
      );
    } catch {
      // sessionStorage full/unavailable — filters just won't survive a full page navigation
    }
  }, [period, anchorDate, fromDate, toDate, status, rows, meta, page, hasNext, queried]);

  const buildBody = (pageNum = 1, statusOverride) => {
    const effectiveStatus = statusOverride ?? status;
    const body = {
      period,
      status: effectiveStatus === "All" ? undefined : effectiveStatus,
      page: pageNum,
      page_size: PAGE_SIZE,
    };
    if (period === "custom") {
      body.from_date = fromDate;
      body.to_date = toDate;
    } else {
      body.date = anchorDate;
    }
    return body;
  };

  const runQuery = async (statusOverride) => {
    if (period === "custom" && (!fromDate || !toDate)) {
      toast.error("Select both a start and end date.");
      return;
    }
    setLoading(true);
    setQueried(true);
    try {
      const res = await axios.post(`${VISION_API}/export`, buildBody(1, statusOverride));
      const data = res.data || {};
      setRows(data.reports || []);
      setMeta(data);
      setPage(data.page || 1);
      setHasNext(!!data.has_next);
      if ((data.reports || []).length === 0) toast.success("No records found.");
      else toast.success(`Loaded ${data.reports.length} of ${data.total} records`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to fetch reports.");
    } finally {
      setLoading(false);
    }
  };

  // Status chips re-query immediately once a search has already run — period
  // and dates still need the explicit Query button since a bad custom range
  // shouldn't fire on every keystroke.
  const handleStatusChip = (value) => {
    setStatus(value);
    if (queried) runQuery(value);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await axios.post(`${VISION_API}/export`, buildBody(nextPage));
      const data = res.data || {};
      setRows((prev) => [...prev, ...(data.reports || [])]);
      setPage(data.page || nextPage);
      setHasNext(!!data.has_next);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load more records.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toExportRow = (r) => ({
    "FG Serial": r.fg_serial,
    "Scanned Serial": r.scanned_serial,
    Master: r.master,
    Operator: r.operator,
    Date: fmtDateTime(r.date),
    Status: r.status,
    Deviation: r.deviation ? "Yes" : "No",
    "Parts Total": r.parts_total,
    "Parts Pass": r.parts_pass,
    "Parts Fail": r.parts_fail,
  });

  // Fetches every remaining page (server-side) before exporting, so the
  // Excel file always reflects the full filtered window, not just what's
  // currently loaded on screen.
  const handleExportAll = async () => {
    if (!queried) {
      toast.error("Run a query first.");
      return;
    }
    setExportingAll(true);
    try {
      let all = rows;
      let curPage = page;
      let more = hasNext;
      while (more) {
        await sleep(PAGE_DELAY_MS);
        curPage += 1;
        const res = await axios.post(`${VISION_API}/export`, buildBody(curPage));
        const data = res.data || {};
        all = [...all, ...(data.reports || [])];
        more = !!data.has_next;
      }
      if (all.length === 0) {
        toast.error("No data available for export.");
        return;
      }
      exportToXls(all.map(toExportRow), `Vision_Reports_${period}_${todayStr()}.xlsx`);
      setRows(all);
      setHasNext(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Export failed.");
    } finally {
      setExportingAll(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!queried) {
      toast.error("Run a query first.");
      return;
    }
    setExportingZip(true);
    try {
      const res = await axios.post(
        `${VISION_API}/export/zip`,
        { ...buildBody(1), page_size: 1000 },
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vision_Reports_${period}_${todayStr()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF archive downloaded.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "ZIP download failed. Try narrowing the filter.");
    } finally {
      setExportingZip(false);
    }
  };

  const visibleRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.fg_serial?.toLowerCase().includes(q) ||
        r.scanned_serial?.toLowerCase().includes(q) ||
        r.operator?.toLowerCase().includes(q) ||
        r.master?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <FiFilter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Filters</p>
          </div>
          <div className="flex flex-wrap gap-3 items-end mb-3">
            <div className="min-w-[160px]">
              <SelectField
                label="Period"
                options={PERIODS}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>

            {period === "custom" ? (
              <>
                <InputField
                  label="From Date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  widthClass="min-w-[160px]"
                />
                <InputField
                  label="To Date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  widthClass="min-w-[160px]"
                />
              </>
            ) : (
              <InputField
                label="Anchor Date"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                widthClass="min-w-[160px]"
              />
            )}

            <button
              onClick={() => runQuery()}
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                loading
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
              }`}
            >
              {loading ? <Spinner /> : <FiSearch className="w-4 h-4" />}
              {loading ? "Loading…" : "Query"}
            </button>

            {rows.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportAll}
                  disabled={exportingAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                >
                  {exportingAll ? <Spinner cls="w-3.5 h-3.5" /> : <FiDownload className="w-3.5 h-3.5" />}
                  {exportingAll ? "Exporting…" : "Export to Excel"}
                </button>
                <button
                  onClick={handleDownloadZip}
                  disabled={exportingZip}
                  title="Downloads PDFs for the current filter (up to 1000)"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors disabled:opacity-50"
                >
                  {exportingZip ? <Spinner cls="w-3.5 h-3.5" /> : <FiArchive className="w-3.5 h-3.5" />}
                  {exportingZip ? "Zipping…" : "Download PDFs (ZIP)"}
                </button>
              </div>
            )}
          </div>

          {/* Status quick-filter chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Status:</span>
            {STATUS_CHIPS.map(({ value, label }) => {
              const active = status === value;
              const count = value === "All" ? meta?.total : meta?.[value.toLowerCase()];
              return (
                <button
                  key={value}
                  onClick={() => handleStatusChip(value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                  {meta && count != null ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* KPI row */}
        {meta && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2.5">
              <StatTile icon={FiClipboard} label="Total" value={meta.total} color="#6366f1" />
              <StatTile icon={FiCheckCircle} label="Pass" value={meta.pass} color="#10b981" />
              <StatTile icon={FiXCircle} label="Fail" value={meta.fail} color="#ef4444" />
              <StatTile icon={FiShield} label="Manual Pass" value={meta.manual_pass} color="#3b82f6" />
              <StatTile icon={FiEdit2} label="Overridden" value={meta.overridden} color="#f59e0b" />
              <StatTile icon={FiRotateCcw} label="Rework" value={meta.rework} color="#f97316" />
              <StatTile icon={FiClock} label="Under Review" value={meta.under_review} color="#8b5cf6" />
            </div>
            {(meta.from || meta.to) && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <FiCalendar className="w-3 h-3" />
                Showing {fmtDateOnly(meta.from)} → {fmtDateOnly(meta.to)}
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && queried && rows.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <FiPackage className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">No Data Found</h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">Adjust your filters and click Query.</p>
          </div>
        )}

        {/* Idle state before first query */}
        {!loading && !queried && rows.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <FiClipboard className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">Pick a period and run a query</h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Browse inspection reports for a day, week, month, or custom range — then export to Excel or download PDFs.
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && rows.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
              <FiClipboard className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Reports</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                {visibleRows.length} of {rows.length} loaded{meta?.total != null ? ` · ${meta.total} total` : ""}
              </span>
              <div className="relative ml-auto w-full sm:w-56">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter loaded rows…"
                  className="w-full pl-7 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <FiX className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-auto max-h-[55vh]">
              <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {["FG Serial", "Scanned Serial", "Master", "Operator", "Date", "Status", "Parts", "PDF", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center first:text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.id} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center">
                      <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800 text-left whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {r.fg_serial}
                          <CopyButton value={r.fg_serial} label="FG Serial" />
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">{r.scanned_serial || "—"}</td>
                      <td className="px-3 py-2 border-b border-slate-100 text-slate-600">{r.master || "—"}</td>
                      <td className="px-3 py-2 border-b border-slate-100 text-slate-600">{r.operator || "—"}</td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                        {fmtDateTime(r.date)}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100"><StatusPill status={r.status} /></td>
                      <td className="px-3 py-2 border-b border-slate-100 font-semibold">
                        <span className="text-emerald-600">{r.parts_pass}</span>
                        <span className="text-slate-300"> / </span>
                        <span className="text-slate-500">{r.parts_total}</span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        {r.pdf_url ? (
                          <a
                            href={`${VISION_API}/asset?path=${encodeURIComponent(r.pdf_url)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open PDF"
                            className="inline-flex text-slate-400 hover:text-blue-600"
                          >
                            <FiFileText className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <button
                          onClick={() => onOpenSerial(r.fg_serial)}
                          className="text-slate-400 hover:text-blue-600"
                          title="Open in Serial Lookup"
                        >
                          <FiExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasNext && (
              <div className="p-3 border-t border-slate-100 flex justify-center shrink-0">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? <Spinner cls="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchPanel;

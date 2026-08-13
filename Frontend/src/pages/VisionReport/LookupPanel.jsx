import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch,
  FiCrosshair,
  FiDownload,
  FiClock,
  FiX,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiLayers,
  FiUser,
  FiCalendar,
  FiTag,
  FiImage,
  FiPackage,
  FiArrowLeft,
  FiMaximize2,
  FiGrid,
  FiList,
} from "react-icons/fi";
import {
  VISION_API,
  visionAssetUrl,
  visionPdfUrl,
  StatusPill,
  MlStatusBadge,
  Spinner,
  Skeleton,
  CopyButton,
  ImageGalleryModal,
  Meter,
  InfoCell,
  rateTone,
} from "./visionShared.jsx";

const fmtDate = (iso) => (iso ? iso.replace("T", " ").replace("Z", "").slice(0, 16) : "—");
const fmtDateTime = (iso) => (iso ? iso.replace("T", " ").replace("Z", "").slice(0, 19) : "—");

// ─── Part Card ─────────────────────────────────────────────────────────────

const PartCard = ({ part, onZoom }) => {
  const capturedImages =
    part.captured_images?.length > 0
      ? part.captured_images
      : part.captured_image
        ? [part.captured_image]
        : [];
  const annotatedUrls =
    part.annotated_urls?.length > 0
      ? part.annotated_urls
      : part.annotated_url
        ? [part.annotated_url]
        : [];

  const hasAnnotated = annotatedUrls.length > 0;
  const hasRaw = capturedImages.length > 0;
  const [showRaw, setShowRaw] = useState(!hasAnnotated && hasRaw);

  const activeUrl = showRaw ? capturedImages[0] : annotatedUrls[0] || capturedImages[0];
  const hasImage = Boolean(activeUrl);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-800 text-xs truncate">{part.part_name}</span>
        <MlStatusBadge ml_status={part.ml_status} />
      </div>

      <button
        type="button"
        disabled={!hasImage}
        onClick={() => hasImage && onZoom(visionAssetUrl(activeUrl))}
        className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden disabled:cursor-not-allowed"
      >
        {hasImage ? (
          <img
            src={visionAssetUrl(activeUrl)}
            alt={part.part_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <FiImage className="w-5 h-5 text-slate-300" />
        )}
        {hasImage && (
          <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 group-hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <FiMaximize2 className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      <div className="px-3 py-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
        {hasAnnotated && hasRaw ? (
          <div className="inline-flex items-center bg-slate-100 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => setShowRaw(false)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                !showRaw ? "bg-white text-blue-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              AI
            </button>
            <button
              onClick={() => setShowRaw(true)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                showRaw ? "bg-white text-blue-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Raw
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">{part.job_type}</span>
        )}
        {capturedImages.length > 1 && (
          <span className="text-[10px] text-slate-400">{capturedImages.length} captures</span>
        )}
      </div>

      {(part.is_overridden || part.skipped_by) && (
        <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-amber-600 font-medium space-y-0.5">
          {part.is_overridden && <div>Overridden by {part.overridden_by || "—"}</div>}
          {part.skipped_by && (
            <div>
              Skipped by {part.skipped_by}
              {part.skip_remark ? `: ${part.skip_remark}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── List row (compact view) ────────────────────────────────────────────────

const PartRow = ({ part, onZoom }) => {
  const thumb = part.annotated_url || part.captured_image;
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors">
      <button
        type="button"
        disabled={!thumb}
        onClick={() => thumb && onZoom(visionAssetUrl(thumb))}
        className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center disabled:cursor-not-allowed"
      >
        {thumb ? (
          <img src={visionAssetUrl(thumb)} alt={part.part_name} className="w-full h-full object-cover" />
        ) : (
          <FiImage className="w-4 h-4 text-slate-300" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-slate-800 truncate">{part.part_name}</div>
        <div className="text-[10px] text-slate-400 uppercase tracking-wide">{part.job_type}</div>
      </div>
      <MlStatusBadge ml_status={part.ml_status} />
    </div>
  );
};

// ─── History Table ─────────────────────────────────────────────────────────

const HistoryTable = ({ reports, currentId, onClose }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <FiClock className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Inspection History ({reports.length})
        </span>
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
        <FiX className="w-3.5 h-3.5" />
      </button>
    </div>
    <div className="overflow-auto">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-100">
            {["Date", "Operator", "Scanned Serial", "Status", "Parts", "PDF"].map((h) => (
              <th key={h} className="px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center first:text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr
              key={r.id}
              className={`text-center transition-colors ${r.id === currentId ? "bg-blue-50/60" : "hover:bg-indigo-50/50"}`}
            >
              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 text-left whitespace-nowrap">
                {fmtDateTime(r.date)}
                {r.id === currentId && (
                  <span className="ml-1.5 text-[9px] font-bold text-blue-600 uppercase">current</span>
                )}
              </td>
              <td className="px-3 py-2 border-b border-slate-100 text-slate-600">{r.operator || "—"}</td>
              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">{r.scanned_serial || "—"}</td>
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
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    View
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ─── Report skeleton (shown while a search is in flight) ──────────────────

const ReportSkeleton = () => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
    <div className="flex flex-col lg:flex-row gap-5">
      <Skeleton className="h-16 w-56" />
      <Skeleton className="h-16 flex-1" />
      <Skeleton className="h-16 w-40" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-5 pt-4 border-t border-slate-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  </div>
);

const PART_FILTERS = [
  { key: "all", label: "All" },
  { key: "success", label: "Passed" },
  { key: "fail", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

// ─── Main Panel ─────────────────────────────────────────────────────────────

const LookupPanel = ({ request, cameFromBatch, onBackToBatch }) => {
  const [fgSerial, setFgSerial] = useState(request?.serial || "");
  const [searchedSerial, setSearchedSerial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [gallery, setGallery] = useState(null); // { index } | null
  const [partFilter, setPartFilter] = useState("all");
  const [partSearch, setPartSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid | list

  const runSearch = async (serial) => {
    const trimmed = serial.trim();
    if (!trimmed) {
      toast.error("Enter an FG serial number.");
      return;
    }
    setLoading(true);
    setReport(null);
    setNotFound(false);
    setHistory(null);
    setPartFilter("all");
    setPartSearch("");
    try {
      const res = await axios.get(`${VISION_API}/report/${encodeURIComponent(trimmed)}`);
      setReport(res.data);
      setSearchedSerial(trimmed);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
        setSearchedSerial(trimmed);
      } else {
        toast.error(err?.response?.data?.message || "Failed to fetch report.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Fires whenever the parent hands us a new lookup request (e.g. "View" was
  // clicked on a Batch Reports row) — including the very first mount if this
  // panel was opened with a serial already in mind.
  useEffect(() => {
    if (request?.serial) {
      setFgSerial(request.serial);
      runSearch(request.serial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  const loadHistory = async () => {
    if (!searchedSerial) return;
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${VISION_API}/report/${encodeURIComponent(searchedSerial)}/all`);
      setHistory(res.data?.reports || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to fetch history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch(fgSerial);
  };

  const passRate = report && report.parts_total > 0 ? (report.parts_pass / report.parts_total) * 100 : 0;
  const resultTone = rateTone(passRate);

  // Flat list of every image across every part, in display order — powers
  // prev/next navigation inside the gallery modal regardless of which
  // thumbnail was clicked first. Each item carries the owning part's real
  // fields so the modal can show detection/override details without
  // fabricating data (no resolution/location/notes — the API has none).
  const galleryItems = useMemo(() => {
    if (!report?.parts) return [];
    const items = [];
    report.parts.forEach((part) => {
      const annotated = part.annotated_urls?.length ? part.annotated_urls : part.annotated_url ? [part.annotated_url] : [];
      const captured = part.captured_images?.length ? part.captured_images : part.captured_image ? [part.captured_image] : [];
      const base = {
        title: part.part_name,
        ml_status: part.ml_status,
        ml_message: part.ml_message,
        job_type: part.job_type,
        is_overridden: part.is_overridden,
        overridden_by: part.overridden_by,
        overridden_at: part.overridden_at,
        skipped_by: part.skipped_by,
        skip_remark: part.skip_remark,
      };
      annotated.forEach((url, i) =>
        items.push({ ...base, url: visionAssetUrl(url), kind: "Annotated", kindIndex: i + 1, kindTotal: annotated.length }),
      );
      captured.forEach((url, i) =>
        items.push({ ...base, url: visionAssetUrl(url), kind: "Raw", kindIndex: i + 1, kindTotal: captured.length }),
      );
    });
    return items;
  }, [report]);

  const openGalleryAt = (url) => {
    const index = galleryItems.findIndex((it) => it.url === url);
    setGallery({ index: index >= 0 ? index : 0 });
  };

  const partCounts = useMemo(() => {
    const counts = { all: 0, success: 0, fail: 0, skipped: 0 };
    (report?.parts || []).forEach((p) => {
      counts.all += 1;
      if (p.ml_status === "success") counts.success += 1;
      else if (p.ml_status === "skipped") counts.skipped += 1;
      else counts.fail += 1;
    });
    return counts;
  }, [report]);

  const visibleParts = useMemo(() => {
    if (!report?.parts) return [];
    let parts = report.parts;
    if (partFilter === "fail") {
      parts = parts.filter((p) => p.ml_status !== "success" && p.ml_status !== "skipped");
    } else if (partFilter !== "all") {
      parts = parts.filter((p) => p.ml_status === partFilter);
    }
    if (partSearch.trim()) {
      const q = partSearch.trim().toLowerCase();
      parts = parts.filter((p) => p.part_name?.toLowerCase().includes(q));
    }
    return parts;
  }, [report, partFilter, partSearch]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {cameFromBatch && (
          <button
            onClick={onBackToBatch}
            className="self-start flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"
          >
            <FiArrowLeft className="w-3.5 h-3.5" />
            Back to Batch Reports
          </button>
        )}

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <FiCrosshair className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Look up by ID / Serial
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={fgSerial}
                onChange={(e) => setFgSerial(e.target.value)}
                placeholder="e.g. WR45000123"
                className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                loading
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
              }`}
            >
              {loading ? <Spinner /> : <FiSearch className="w-4 h-4" />}
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </form>

        {/* Loading skeleton */}
        {loading && <ReportSkeleton />}

        {/* Not found */}
        {!loading && notFound && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center">
              <FiPackage className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">No report found for “{searchedSerial}”</h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Check the FG serial and try again, or confirm the unit has been inspected on the vision camera.
            </p>
          </div>
        )}

        {/* Idle empty state */}
        {!loading && !notFound && !report && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <FiCrosshair className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">Search an FG serial to view its report</h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Shows the most recent inspection, per-part AI detection images, and the signed PDF.
            </p>
          </div>
        )}

        {/* Report */}
        {!loading && report && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-8">
                {/* Identity */}
                <div className="lg:w-60 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-extrabold text-slate-900 tracking-tight break-all">
                      {report.fg_serial}
                    </span>
                    <CopyButton value={report.fg_serial} label="FG Serial" />
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Master: {report.master || "—"}</div>
                  <div className="mt-2">
                    <StatusPill status={report.status} size="lg" />
                  </div>
                </div>

                {/* Progress */}
                <div className="flex-1 min-w-[220px]">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Inspection Progress
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Meter value={passRate} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0 w-12 text-right">
                      {passRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      Overall Result
                    </div>
                    <div className={`text-2xl font-extrabold tracking-tight ${resultTone.text}`}>
                      {passRate.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex lg:flex-col items-stretch gap-2 shrink-0">
                  <a
                    href={visionPdfUrl(report.fg_serial)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors whitespace-nowrap"
                  >
                    <FiDownload className="w-3.5 h-3.5" /> Download PDF
                  </a>
                  <button
                    onClick={loadHistory}
                    disabled={historyLoading}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {historyLoading ? <Spinner cls="w-3.5 h-3.5" /> : <FiClock className="w-3.5 h-3.5" />}
                    History
                  </button>
                </div>
              </div>

              {report.deviation && (
                <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800">
                  <FiAlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Deviation release</span>
                    {report.deviation_by && <> — authorized by {report.deviation_by}</>}
                    {report.deviation_note && <div className="text-blue-700 mt-0.5">{report.deviation_note}</div>}
                  </div>
                </div>
              )}

              {/* Metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-5 pt-4 border-t border-slate-100">
                <InfoCell icon={FiTag} label="Scanned Serial" value={report.scanned_serial || "—"} copyLabel="Scanned Serial" />
                <InfoCell icon={FiUser} label="Operator" value={report.operator || "—"} />
                <InfoCell icon={FiCalendar} label="Date" value={fmtDate(report.date)} />
                <InfoCell icon={FiLayers} label="Total Parts" value={report.parts_total} />
                <InfoCell icon={FiCheckCircle} label="Parts Pass" value={report.parts_pass} tone="pass" />
                <InfoCell
                  icon={FiXCircle}
                  label="Parts Fail"
                  value={report.parts_fail}
                  tone={report.parts_fail > 0 ? "fail" : undefined}
                />
              </div>
            </div>

            {/* History */}
            {history && <HistoryTable reports={history} currentId={report.id} onClose={() => setHistory(null)} />}

            {/* Parts grid */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <FiLayers className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Part Inspection
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-semibold rounded-full border border-indigo-100">
                    {report.parts?.length || 0}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {PART_FILTERS.map(({ key, label }) => {
                    const count = partCounts[key];
                    const active = partFilter === key;
                    if (key !== "all" && count === 0) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setPartFilter(key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                          active
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {label} ({count})
                      </button>
                    );
                  })}

                  <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                    <button
                      onClick={() => setViewMode("grid")}
                      title="Grid view"
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        viewMode === "grid" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <FiGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      title="List view"
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        viewMode === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <FiList className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="relative w-full sm:w-44">
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input
                      type="text"
                      value={partSearch}
                      onChange={(e) => setPartSearch(e.target.value)}
                      placeholder="Search in parts…"
                      className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>

              {visibleParts.length > 0 ? (
                viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {visibleParts.map((part, i) => (
                      <PartCard key={i} part={part} onZoom={openGalleryAt} />
                    ))}
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                    {visibleParts.map((part, i) => (
                      <PartRow key={i} part={part} onZoom={openGalleryAt} />
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400 py-10">
                  <FiImage className="w-8 h-8 opacity-20" strokeWidth={1.2} />
                  <p className="text-xs">No parts match the current filter.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {gallery && (
        <ImageGalleryModal
          items={galleryItems}
          initialIndex={gallery.index}
          onClose={() => setGallery(null)}
        />
      )}
    </div>
  );
};

export default LookupPanel;

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiCheckCircle,
  FiXCircle,
  FiShield,
  FiEdit2,
  FiRotateCcw,
  FiClock,
  FiHelpCircle,
  FiWifi,
  FiWifiOff,
  FiLoader,
  FiCopy,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiAlertTriangle,
  FiDownload,
} from "react-icons/fi";
import { baseURL } from "../../assets/assets";

// ─── API base helpers ──────────────────────────────────────────────────────

export const VISION_API = `${baseURL}vision-report`;

export const visionAssetUrl = (path) =>
  path ? `${VISION_API}/asset?path=${encodeURIComponent(path)}` : null;

export const visionPdfUrl = (fgSerial) =>
  `${VISION_API}/report/${encodeURIComponent(fgSerial)}/pdf`;

// ─── Status metadata (the 6 verdict values shared across the vision app) ───

export const STATUS_META = {
  PASS: {
    label: "Pass",
    icon: FiCheckCircle,
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "#10b981",
    hint: "All required parts detected by AI",
  },
  FAIL: {
    label: "Fail",
    icon: FiXCircle,
    text: "text-rose-800",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "#ef4444",
    hint: "One or more parts not detected",
  },
  MANUAL_PASS: {
    label: "Manual Pass",
    icon: FiShield,
    text: "text-blue-800",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "#3b82f6",
    hint: "A human passed the unit (deviation or untracked flow)",
  },
  OVERRIDDEN: {
    label: "Overridden",
    icon: FiEdit2,
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "#f59e0b",
    hint: "AI result was edited/skipped after the report was generated",
  },
  REWORK: {
    label: "Rework",
    icon: FiRotateCcw,
    text: "text-orange-800",
    bg: "bg-orange-50",
    border: "border-orange-200",
    dot: "#f97316",
    hint: "Unit was diverted to rework",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    icon: FiClock,
    text: "text-violet-800",
    bg: "bg-violet-50",
    border: "border-violet-200",
    dot: "#8b5cf6",
    hint: "Flagged for rework, awaiting supervisor confirmation",
  },
};

const FALLBACK_STATUS = {
  label: "Unknown",
  icon: FiHelpCircle,
  text: "text-slate-700",
  bg: "bg-slate-50",
  border: "border-slate-200",
  dot: "#64748b",
  hint: "Unrecognized status value",
};

export const getStatusMeta = (status) => STATUS_META[status] || FALLBACK_STATUS;

export const STATUS_OPTIONS = [
  { value: "All", label: "All Statuses" },
  ...Object.keys(STATUS_META).map((key) => ({
    value: key,
    label: STATUS_META[key].label,
  })),
];

// Severity tone for a 0-100 rate — used by the Meter and "Overall Result" figure.
export const rateTone = (pct) =>
  pct >= 95
    ? { fill: "bg-emerald-500", text: "text-emerald-600", track: "bg-emerald-50" }
    : pct >= 80
      ? { fill: "bg-amber-500", text: "text-amber-600", track: "bg-amber-50" }
      : { fill: "bg-rose-500", text: "text-rose-600", track: "bg-rose-50" };

// ─── Shared UI atoms ───────────────────────────────────────────────────────

export const Spinner = ({ cls = "w-4 h-4" }) => (
  <FiLoader className={`animate-spin ${cls}`} />
);

export const StatusPill = ({ status, size = "sm" }) => {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  const sizeCls =
    size === "lg"
      ? "px-3 py-1 text-xs gap-1.5"
      : "px-2.5 py-0.5 text-[11px] gap-1";
  return (
    <span
      title={meta.hint}
      className={`inline-flex items-center ${sizeCls} rounded-full font-bold border ${meta.bg} ${meta.text} ${meta.border}`}
    >
      {Icon && <Icon className={size === "lg" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} />}
      {meta.label}
    </span>
  );
};

// Per-part AI verdict badge (success/skipped/anything-else) — distinct from
// StatusPill, which covers the report-level 6-value status instead.
export const MlStatusBadge = ({ ml_status, size = "sm" }) => {
  const isSuccess = ml_status === "success";
  const isSkipped = ml_status === "skipped";
  const cls = isSuccess
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : isSkipped
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-rose-50 text-rose-800 border-rose-200";
  const Icon = isSuccess ? FiCheckCircle : isSkipped ? FiAlertTriangle : FiXCircle;
  const label = isSuccess ? "Passed" : isSkipped ? "Skipped" : "Failed";
  const sizeCls = size === "lg" ? "px-2.5 py-1 text-xs gap-1.5" : "px-2 py-0.5 text-[10px] gap-1";
  return (
    <span className={`inline-flex items-center ${sizeCls} rounded-full font-bold border shrink-0 ${cls}`}>
      <Icon className={size === "lg" ? "w-3 h-3" : "w-2.5 h-2.5"} />
      {label}
    </span>
  );
};

// A single ratio-against-a-limit figure (pass rate) — track is a lighter step
// of the same ramp as the fill, colored by severity, per the dataviz Meter spec.
export const Meter = ({ value, height = "h-3" }) => {
  const pct = Math.max(0, Math.min(100, value));
  const tone = rateTone(pct);
  return (
    <div className={`w-full ${height} rounded-full ${tone.track} overflow-hidden`}>
      <div
        className={`h-full ${tone.fill} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// Icon + label/value pair for a metadata grid — deliberately lighter-weight
// than a KPI tile since these are identity fields, not metrics to compare.
export const InfoCell = ({ icon: Icon, label, value, copyLabel, tone }) => {
  const toneCls =
    tone === "pass" ? "text-emerald-500" : tone === "fail" ? "text-rose-500" : "text-slate-400";
  return (
    <div className="flex items-start gap-2 min-w-0">
      {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${toneCls}`} />}
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
        <div className="text-sm font-bold text-slate-800 truncate flex items-center gap-1">
          <span className="truncate">{value}</span>
          {copyLabel && value !== "—" && <CopyButton value={String(value)} label={copyLabel} />}
        </div>
      </div>
    </div>
  );
};

// Aggregate stat tile — used where counts across a date range are genuinely
// comparable KPIs (Batch Reports), unlike InfoCell's per-report metadata.
export const StatTile = ({ icon: Icon, label, value, color = "#6366f1" }) => (
  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-1 min-w-[130px]">
    {Icon && (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon className="w-4.5 h-4.5" />
      </div>
    )}
    <div className="min-w-0">
      <div className="text-lg font-extrabold text-slate-900 leading-tight tracking-tight">{value}</div>
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  </div>
);

// ─── Health badge ──────────────────────────────────────────────────────────

export const VisionHealthBadge = () => {
  const [state, setState] = useState("checking"); // checking | ok | down

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const res = await axios.get(`${VISION_API}/health`, { timeout: 6000 });
        if (!cancelled) setState(res?.data?.status === "ok" ? "ok" : "down");
      } catch {
        if (!cancelled) setState("down");
      }
    };
    ping();
    const t = setInterval(ping, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const cfg = {
    checking: { icon: FiLoader, text: "Checking…", cls: "text-slate-500 bg-slate-50 border-slate-200", spin: true },
    ok: { icon: FiWifi, text: "Camera Server Online", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    down: { icon: FiWifiOff, text: "Camera Server Unreachable", cls: "text-rose-700 bg-rose-50 border-rose-200" },
  }[state];

  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}
    >
      {Icon && <Icon className={`w-3 h-3 ${cfg.spin ? "animate-spin" : ""}`} />}
      {cfg.text}
    </span>
  );
};

// ─── Copy-to-clipboard ─────────────────────────────────────────────────────

export const CopyButton = ({ value, label = "Value", className = "" }) => {
  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label}`}
      className={`text-slate-300 hover:text-blue-600 transition-colors shrink-0 ${className}`}
    >
      <FiCopy className="w-3 h-3" />
    </button>
  );
};

// ─── Skeleton loader ───────────────────────────────────────────────────────

export const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-200/70 rounded ${className}`} />
);

// ─── Segmented tab switcher ────────────────────────────────────────────────

export const SegmentedTabs = ({ tabs, active, onChange }) => (
  <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 gap-1">
    {tabs.map((t) => {
      const Icon = t.icon;
      const isActive = active === t.value;
      return (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isActive ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {t.label}
          {t.badge != null && t.badge !== "" && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                isActive ? "bg-blue-50 text-blue-700" : "bg-slate-200 text-slate-500"
              }`}
            >
              {t.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ─── Image gallery modal ───────────────────────────────────────────────────
// Each item carries the owning part's real fields (nothing fabricated — no
// resolution/location/notes the API doesn't actually provide):
//   { url, title, kind: "Annotated"|"Raw", kindIndex, kindTotal,
//     ml_status, ml_message, job_type,
//     is_overridden, overridden_by, overridden_at, skipped_by, skip_remark }

const fmtTimestamp = (iso) => (iso ? iso.replace("T", " ").replace("Z", "").slice(0, 19) : null);

export const ImageGalleryModal = ({ items, initialIndex = 0, onClose }) => {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    setIdx(initialIndex);
  }, [initialIndex, items]);

  useEffect(() => {
    if (!items || items.length === 0) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, items.length - 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, onClose]);

  if (!items || items.length === 0) return null;
  const current = items[idx];
  const hasOverride = current.is_overridden || current.skipped_by;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-800 truncate">
                {current.title}
                {current.kind && (
                  <span className="text-slate-400 font-medium">
                    {" "}
                    · {current.kind}
                    {current.kindTotal > 1 ? ` ${current.kindIndex}/${current.kindTotal}` : ""}
                  </span>
                )}
              </h3>
              {current.ml_status && <MlStatusBadge ml_status={current.ml_status} />}
            </div>
            {(current.job_type || current.ml_message) && (
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                {current.job_type && <span className="capitalize">{current.job_type}</span>}
                {current.job_type && current.ml_message && " · "}
                {current.ml_message}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={current.url}
              download
              target="_blank"
              rel="noreferrer"
              title="Download image"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <FiDownload className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative bg-slate-900 flex items-center justify-center min-h-0 shrink-0" style={{ height: "48vh" }}>
          <button
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            className="absolute left-3 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <img src={current.url} alt={current.title} className="max-w-full max-h-full object-contain" />
          <button
            onClick={() => setIdx((i) => Math.min(i + 1, items.length - 1))}
            disabled={idx === items.length - 1}
            className="absolute right-3 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 text-[11px] font-semibold text-slate-400 shrink-0">
          {idx + 1} / {items.length}
        </div>

        {/* Filmstrip — grouped by AI (annotated) vs Raw, with a divider and a
            tiny corner tag on each thumb so the two are never ambiguous. */}
        {items.length > 1 && (
          <div className="px-5 pb-3 pt-2 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto">
              {items.map((it, i) => {
                const startsNewGroup = i > 0 && it.kind !== items[i - 1].kind;
                const isAnnotated = it.kind === "Annotated";
                return (
                  <div key={i} className="flex items-center gap-2 shrink-0">
                    {startsNewGroup && <div className="w-px h-10 bg-slate-200 shrink-0" />}
                    <button
                      onClick={() => setIdx(i)}
                      className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === idx ? "border-blue-500" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={it.url} alt="" className="w-full h-full object-cover" />
                      <span
                        className={`absolute top-0.5 left-0.5 px-1 rounded text-[8px] font-bold leading-tight text-white ${
                          isAnnotated ? "bg-blue-600" : "bg-slate-600"
                        }`}
                      >
                        {isAnnotated ? "AI" : "RAW"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detail panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5 pt-3 border-t border-slate-100 overflow-y-auto">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Detection Details
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <div className="text-slate-400">Job Type</div>
                <div className="font-semibold text-slate-700 capitalize">{current.job_type || "—"}</div>
              </div>
              <div>
                <div className="text-slate-400">AI Result</div>
                <div className="font-semibold text-slate-700 capitalize">{current.ml_status || "—"}</div>
              </div>
              {current.ml_message && (
                <div className="col-span-2">
                  <div className="text-slate-400">Message</div>
                  <div className="font-semibold text-slate-700">{current.ml_message}</div>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Overrides
            </div>
            {hasOverride ? (
              <div className="text-xs text-amber-700 space-y-1">
                {current.is_overridden && (
                  <div>
                    Overridden by <span className="font-semibold">{current.overridden_by || "—"}</span>
                    {fmtTimestamp(current.overridden_at) ? ` on ${fmtTimestamp(current.overridden_at)}` : ""}
                  </div>
                )}
                {current.skipped_by && (
                  <div>
                    Skipped by <span className="font-semibold">{current.skipped_by}</span>
                    {current.skip_remark ? `: ${current.skip_remark}` : ""}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">No manual overrides on this part.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

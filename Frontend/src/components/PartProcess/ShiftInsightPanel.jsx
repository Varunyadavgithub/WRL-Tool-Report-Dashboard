import { useEffect, useState } from "react";
import { FiZap, FiAlertTriangle, FiTrendingUp, FiTrendingDown, FiMinus } from "react-icons/fi";
import { useLazyGetShiftReportInsightQuery } from "../../redux/api/insightsApi";

// Mirrors ChatWidget/MessageList.jsx's ThinkingBubble — same bouncing-dot
// loading language used elsewhere in the AI features of this app.
const ThinkingBubble = () => (
  <div className="flex items-center gap-1.5">
    {["bg-indigo-400", "bg-violet-400", "bg-fuchsia-400"].map((color, i) => (
      <span key={i} className={`w-1.5 h-1.5 rounded-full ${color} animate-bounce`} style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

const KpiTile = ({ label, value, tone = "slate" }) => {
  const TONE = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-600",
    rose: "bg-rose-50 border-rose-200 text-rose-500",
    amber: "bg-amber-50 border-amber-200 text-amber-600",
  };
  return (
    <div className={`flex flex-col rounded-lg border px-3 py-2 ${TONE[tone]}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-base font-mono font-bold">{value}</span>
    </div>
  );
};

const TrendBadge = ({ label, trend }) => {
  if (!trend) return null;
  if (trend.insufficientData) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-1">
        {label}: not enough data ({trend.n}/{trend.minRequired} days)
      </span>
    );
  }
  const Icon = trend.direction === "up" ? FiTrendingUp : trend.direction === "down" ? FiTrendingDown : FiMinus;
  const tone = trend.direction === "up" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : trend.direction === "down" ? "text-rose-500 bg-rose-50 border-rose-200"
    : "text-slate-500 bg-slate-50 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-1 border ${tone}`}>
      <Icon className="w-3 h-3" />
      {label}: {trend.direction}{trend.pctChangeOverRange != null ? ` (${trend.pctChangeOverRange > 0 ? "+" : ""}${trend.pctChangeOverRange}%)` : ""}
    </span>
  );
};

const oeeTone = (v) => (v >= 85 ? "emerald" : v >= 65 ? "amber" : "rose");

const ShiftInsightPanel = ({ start, end, shiftName }) => {
  const [trigger, { data, isFetching, isError }] = useLazyGetShiftReportInsightQuery();
  const [hasRequested, setHasRequested] = useState(false);

  // Params changed since the last generated insight — stale results would
  // otherwise keep showing for a range/shift the user has since moved away from.
  useEffect(() => {
    setHasRequested(false);
  }, [start, end, shiftName]);

  const handleGenerate = () => {
    setHasRequested(true);
    trigger({ start, end, shiftName });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <FiZap className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">AI Insight</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isFetching}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isFetching ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-violet-600 hover:bg-violet-700 text-white"
          }`}
        >
          {isFetching ? "Analyzing…" : hasRequested ? "Regenerate" : "Generate AI Insight"}
        </button>
      </div>

      {!hasRequested && !isFetching && (
        <p className="text-xs text-slate-400">
          Get an AI-generated summary, trend, and recommendations for the current filter range.
        </p>
      )}

      {isFetching && (
        <div className="flex items-center gap-2 py-3">
          <ThinkingBubble />
          <span className="text-xs text-slate-400">Analyzing shift data… this can take up to a minute on this hardware.</span>
        </div>
      )}

      {isError && !isFetching && (
        <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Couldn't generate the insight. <button onClick={handleGenerate} className="underline font-semibold">Retry</button>
        </div>
      )}

      {!isFetching && !isError && data && !data.hasData && (
        <p className="text-xs text-slate-400 py-2">No production data in this range to summarize.</p>
      )}

      {!isFetching && !isError && data?.hasData && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <KpiTile label="Avg OEE" value={`${data.kpis.avgOee}%`} tone={oeeTone(data.kpis.avgOee)} />
            <KpiTile label="Components" value={data.kpis.componentQty.toLocaleString()} />
            <KpiTile label="Rejected" value={data.kpis.rejected.toLocaleString()} tone={data.kpis.rejected > 0 ? "rose" : "slate"} />
            <KpiTile label="Reject Rate" value={`${data.kpis.rejectRatePct}%`} tone={data.kpis.rejectRatePct > 0 ? "rose" : "slate"} />
            <KpiTile label="Loss Mins" value={data.kpis.lossMins.toLocaleString()} tone={data.kpis.lossMins > 0 ? "amber" : "slate"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <TrendBadge label="OEE trend" trend={data.oeeTrend} />
            <TrendBadge label="Output trend" trend={data.outputTrend} />
          </div>

          {data.topDowntimeReasons?.length > 0 && (
            <div className="text-[11px] text-slate-500">
              Top downtime: {data.topDowntimeReasons.map((r) => `${r.reason} (${r.mins}m)`).join(", ")}
            </div>
          )}

          {data.narrative && (
            <div className="text-sm text-slate-700 bg-violet-50 border border-violet-100 rounded-lg px-3.5 py-3 whitespace-pre-wrap">
              {data.narrative}
            </div>
          )}

          {!data.narrative && data.narrativeError && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
              AI summary unavailable right now (model may be slow or offline) — the numbers above are unaffected.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShiftInsightPanel;

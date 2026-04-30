import { useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
import { PageHeader, TimerBar, StatCard } from "../Monitoring";

const ACCENT = "#b45309";

/* ════════════════════════════════════════════════════════════
   Pure SVG Doughnut — Consumed vs Remaining time
═══════════════════════════════════════════════════════════ */
const SvgTimeDoughnut = ({ consumedPct = 0 }) => {
  const [hover, setHover] = useState(null); // "consumed" | "remaining" | null

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 95;
  const strokeW = 46;
  const circumference = 2 * Math.PI * r;

  const consumed = Math.min(Math.max(consumedPct, 0), 100);
  const remaining = Number((100 - consumed).toFixed(1));

  const segments = [
    {
      key: "consumed",
      value: consumed,
      color: "#f59e0b",
      hoverColor: "rgba(245,158,11,0.5)",
      label: "Consumed",
    },
    {
      key: "remaining",
      value: remaining,
      color: "#e2e8f0",
      hoverColor: "rgba(148,163,184,0.4)",
      label: "Remaining",
    },
  ].filter((s) => s.value > 0);

  const visibleCount = segments.length;
  const gap = visibleCount > 1 ? 4 : 0;

  const polarToXY = (angleDeg, radius) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  let cumulativeAngle = 0;
  const segmentData = segments.map((seg) => {
    const frac = seg.value / 100;
    const arcLen = frac * circumference;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + frac * 360;
    const midAngle = (startAngle + endAngle) / 2;
    const labelPos = polarToXY(midAngle, r);
    cumulativeAngle = endAngle;
    return {
      ...seg,
      frac,
      arcLen,
      startOffset: -((startAngle / 360) * circumference),
      labelPos,
      pct: seg.value.toFixed(1),
    };
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeW}
        />

        {/* Segments */}
        {segmentData.map((seg) => (
          <circle
            key={seg.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={hover === seg.key ? strokeW + 4 : strokeW}
            strokeDasharray={`${Math.max(seg.arcLen - gap, 0)} ${circumference}`}
            strokeDashoffset={seg.startOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{
              transition: "stroke-width 0.2s, stroke-dasharray 1s ease",
              cursor: "pointer",
              filter:
                hover === seg.key
                  ? `drop-shadow(0 4px 12px ${seg.hoverColor})`
                  : "none",
            }}
            onMouseEnter={() => setHover(seg.key)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* Segment labels — only if segment >= 12% */}
        {segmentData
          .filter((seg) => seg.frac >= 0.12)
          .map((seg) => {
            const isLight = seg.key === "remaining"; // dark text on light track
            const textColor = isLight ? "#475569" : "#ffffff";
            const shadow = isLight
              ? "drop-shadow(0 1px 2px rgba(255,255,255,0.8))"
              : "drop-shadow(0 1px 2px rgba(0,0,0,0.4))";
            return (
              <g key={`lbl-${seg.key}`} pointerEvents="none">
                <text
                  x={seg.labelPos.x}
                  y={seg.labelPos.y - 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={textColor}
                  fontSize="15"
                  fontWeight="800"
                  fontFamily="'JetBrains Mono', monospace"
                  style={{ filter: shadow }}
                >
                  {seg.pct}%
                </text>
                <text
                  x={seg.labelPos.x}
                  y={seg.labelPos.y + 13}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={textColor}
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="'JetBrains Mono', monospace"
                  opacity="0.85"
                  letterSpacing="1"
                  style={{ filter: shadow }}
                >
                  {seg.label.toUpperCase()}
                </text>
              </g>
            );
          })}
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-4xl font-black text-slate-900 leading-none drop-shadow-sm font-mono">
          {consumed.toFixed(0)}%
        </span>
        <span className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">
          Elapsed
        </span>
      </div>

      {/* Hover tooltip */}
      {hover &&
        (() => {
          const seg = segmentData.find((s) => s.key === hover);
          if (!seg) return null;
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: "50%",
                top: -12,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div
                className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl whitespace-nowrap"
                style={{ border: `2px solid ${seg.color}` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: seg.color }}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {seg.label} Time
                  </span>
                </div>
                <div className="text-2xl font-black font-mono mt-1 text-center">
                  {seg.pct}%
                </div>
              </div>
              <div
                className="w-3 h-3 bg-slate-900 rotate-45 mx-auto -mt-1.5"
                style={{
                  borderRight: `2px solid ${seg.color}`,
                  borderBottom: `2px solid ${seg.color}`,
                }}
              />
            </div>
          );
        })()}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const Loss = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;

  const consumedPct = Number(ls.ConsumedTimePct || 0);

  const sorted = useMemo(
    () =>
      [...stations].sort(
        (a, b) => (b.TotalStopCount ?? 0) - (a.TotalStopCount ?? 0),
      ),
    [stations],
  );

  const totalStopCount = useMemo(
    () => stations.reduce((sum, s) => sum + (s.TotalStopCount ?? 0), 0),
    [stations],
  );

  const statusColor =
    consumedPct >= 90 ? "#dc2626" : consumedPct >= 70 ? "#f59e0b" : "#16a34a";
  const statusLabel =
    consumedPct >= 90 ? "Critical" : consumedPct >= 70 ? "Warning" : "On Track";

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Loss Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />
        <div className="grid grid-cols-4 gap-2.5 px-4 py-2.5 bg-slate-50">
          <StatCard label="Plan" value={ls.Plan} accentHex="#7c3aed" />
          <StatCard label="Achieved" value={ls.Achieved} accentHex="#15803d" />
          <StatCard label="Balance" value={ls.Remaining} accentHex="#ef4444" />
          <StatCard
            label="Time Consumed"
            value={
              ls.ConsumedTimePct != null
                ? `${Number(ls.ConsumedTimePct).toFixed(0)}%`
                : null
            }
            accentHex="#f59e0b"
            sub="of shift elapsed"
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 px-4 py-2 gap-4">
        {/* LEFT — Donut */}
        <div
          className="w-[55%] shrink-0 rounded-2xl border-2 shadow-md overflow-hidden flex flex-col items-center justify-center relative px-4 py-4"
          style={{
            borderColor: `${ACCENT}20`,
            background: `linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.04] rounded-2xl"
            style={{
              background: `radial-gradient(circle at 50% 60%, ${ACCENT}, transparent 70%)`,
            }}
          />
          <div className="text-center mb-3 z-10">
            <p
              className="text-lg font-extrabold uppercase tracking-[0.2em] font-mono"
              style={{ color: ACCENT }}
            >
              Consumed Time
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Shift Time Utilization
            </p>
          </div>

          <div className="z-10">
            <SvgTimeDoughnut consumedPct={consumedPct} />
          </div>

          <div className="z-10 flex flex-col items-center mt-4">
            <div
              className="px-10 py-3 rounded-2xl text-white font-black text-4xl font-mono tracking-[0.15em] shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}dd)`,
                boxShadow: `0 8px 30px ${ACCENT}40`,
              }}
            >
              {totalStopCount.toLocaleString()}
              <span className="text-white/60 text-lg ml-1">stops</span>
            </div>
            <div
              className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full border-[1.5px]"
              style={{
                borderColor: `${statusColor}44`,
                background: `${statusColor}10`,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: statusColor }}
              />
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: statusColor }}
              >
                {statusLabel}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {consumedPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {stations.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mt-4 z-10">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
                <span className="w-3.5 h-3.5 bg-amber-600 rounded-md shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">
                    Stops
                  </span>
                  <span className="text-base font-black text-amber-700 font-mono leading-tight">
                    {totalStopCount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-200">
                <span className="w-3.5 h-3.5 bg-blue-600 rounded-md shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">
                    Stations
                  </span>
                  <span className="text-base font-black text-blue-700 font-mono leading-tight">
                    {stations.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Table (Sr / Station Name / Stop Count) */}
        <div className="w-[45%] flex flex-col min-w-0">
          <div
            className="text-white font-bold text-sm text-center py-2.5 rounded-t-xl tracking-wider uppercase flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-white/50" /> Station-wise
            Loss Breakdown
          </div>
          <div className="flex-1 overflow-auto bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["Sr.", "Station Name", "Stop Count"].map((h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2.5 text-white font-bold border border-white/20 text-sm uppercase tracking-wider ${
                        i === 1 ? "text-left" : "text-center"
                      }`}
                      style={{ background: ACCENT }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const isHigh = s.TotalStopCount > 10;
                  const rowBg = isHigh
                    ? "#fef3c7"
                    : i % 2 === 0
                      ? "#fff"
                      : "#f8fafc";
                  return (
                    <tr key={i} style={{ background: rowBg }}>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-center w-14">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black font-mono text-xs ${
                            isHigh
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-700 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          {isHigh && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                          )}
                          <span className="truncate">{s.StationName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-center w-24">
                        <span
                          className={`inline-block font-black text-lg px-3 py-0.5 rounded-lg border ${
                            isHigh
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-amber-50 text-amber-600 border-amber-200"
                          }`}
                        >
                          {s.TotalStopCount}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {stations.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-16 text-center text-slate-400 border border-slate-100"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <PackageOpen
                          className="w-14 h-14 opacity-20"
                          strokeWidth={1.2}
                        />
                        <p className="text-lg">
                          No loss data recorded this shift
                        </p>
                      </div>
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

export default Loss;

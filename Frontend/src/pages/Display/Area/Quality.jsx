import { useMemo, useState } from "react";
import { PageHeader, TimerBar, StatCard } from "../Monitoring";

const ACCENT = "#15803d";

/* ════════════════════════════════════════════════════════════
   Pure SVG Doughnut — 3 segments: OK / Defect / Rework
═══════════════════════════════════════════════════════════ */
const SvgDoughnut = ({ ok = 0, defect = 0, rework = 0, total = 0 }) => {
  const [hover, setHover] = useState(null);

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 95;
  const strokeW = 46;
  const circumference = 2 * Math.PI * r;

  const sum = ok + defect + rework;

  // Build segments dynamically (skip 0-value ones)
  const segments = [
    {
      key: "ok",
      value: ok,
      color: "#15803d",
      hoverColor: "rgba(21,128,61,0.5)",
      label: "OK Units",
    },
    {
      key: "defect",
      value: defect,
      color: "#dc2626",
      hoverColor: "rgba(220,38,38,0.5)",
      label: "Defect Units",
    },
    {
      key: "rework",
      value: rework,
      color: "#f59e0b",
      hoverColor: "rgba(245,158,11,0.5)",
      label: "Rework Done",
    },
  ].filter((s) => s.value > 0);

  // Visual gap between segments
  const visibleCount = segments.length;
  const gap = visibleCount > 1 ? 4 : 0;

  const polarToXY = (angleDeg, radius) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  // Compute angles + arc lengths progressively
  let cumulativeAngle = 0;
  const segmentData = segments.map((seg) => {
    const frac = seg.value / sum;
    const arcLen = frac * circumference;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + frac * 360;
    const midAngle = (startAngle + endAngle) / 2;
    const labelPos = polarToXY(midAngle, r);
    const pct = ((seg.value / sum) * 100).toFixed(1);
    cumulativeAngle = endAngle;
    return {
      ...seg,
      frac,
      arcLen,
      startOffset: -((startAngle / 360) * circumference),
      labelPos,
      pct,
    };
  });

  // Empty state
  if (sum === 0) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeW}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-black text-slate-300 leading-none">
            0
          </span>
          <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
            No Data
          </span>
        </div>
      </div>
    );
  }

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

        {/* Segment labels — only if segment >= 10% */}
        {segmentData
          .filter((seg) => seg.frac >= 0.1)
          .map((seg) => (
            <g key={`lbl-${seg.key}`} pointerEvents="none">
              <text
                x={seg.labelPos.x}
                y={seg.labelPos.y - 7}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize="16"
                fontWeight="800"
                fontFamily="'JetBrains Mono', monospace"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
              >
                {seg.value.toLocaleString()}
              </text>
              <text
                x={seg.labelPos.x}
                y={seg.labelPos.y + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="700"
                fontFamily="'JetBrains Mono', monospace"
                opacity="0.95"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
              >
                {seg.pct}%
              </text>
            </g>
          ))}
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-4xl font-black text-slate-900 leading-none drop-shadow-sm font-mono">
          {total.toLocaleString()}
        </span>
        <span className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">
          Total Units
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
                    {seg.label}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono mt-1 text-center">
                  {seg.value.toLocaleString()}
                  <span className="text-sm font-bold ml-2 opacity-70">
                    {seg.pct}%
                  </span>
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
const Quality = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { summary: qs = {}, defects = [] } = apiData;

  const ok = Number(qs.OkUnit) || 0;
  const defect = Number(qs.DefectUnit) || 0;
  const rework = Number(qs.ReworkDone) || 0;
  const total = Number(qs.TotalAchieved) || ok + defect + rework;

  // Compute consistent percentages — denominator = TotalAchieved (matches cards)
  const okPct = qs.OkPct ?? (total > 0 ? ((ok / total) * 100).toFixed(1) : 0);
  const defPct =
    qs.DefectPct ?? (total > 0 ? ((defect / total) * 100).toFixed(1) : 0);
  const reworkPct = total > 0 ? ((rework / total) * 100).toFixed(1) : 0;

  const statusColor =
    okPct >= 90 ? "#16a34a" : okPct >= 70 ? "#f59e0b" : "#dc2626";
  const statusLabel =
    okPct >= 90 ? "On Track" : okPct >= 70 ? "Warning" : "Critical";

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Quality Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />
        <div className="grid grid-cols-7 gap-2.5 px-4 py-2.5 bg-slate-50">
          <StatCard label="Plan" value={qs.Plan} accentHex="#7c3aed" />
          <StatCard
            label="Achieved"
            value={qs.TotalAchieved}
            accentHex="#15803d"
          />
          <StatCard label="OK Units" value={qs.OkUnit} accentHex="#059669" />
          <StatCard label="Defects" value={qs.DefectUnit} accentHex="#ef4444" />
          <StatCard
            label="Rework Done"
            value={qs.ReworkDone}
            accentHex="#f59e0b"
          />
          <StatCard
            label="OK %"
            value={qs.OkPct != null ? `${qs.OkPct}%` : null}
            accentHex="#0f766e"
            sub="First pass yield"
          />
          <StatCard
            label="Defect %"
            value={qs.DefectPct != null ? `${qs.DefectPct}%` : null}
            accentHex="#dc2626"
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 px-4 py-2 gap-4">
        {/* LEFT — Doughnut */}
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
              Quality Overview
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              OK · Defect · Rework Distribution
            </p>
          </div>

          <div className="z-10">
            <SvgDoughnut
              ok={ok}
              defect={defect}
              rework={rework}
              total={total}
            />
          </div>

          <div className="z-10 flex flex-col items-center mt-4">
            <div
              className="px-10 py-3 rounded-2xl text-white font-black text-4xl font-mono tracking-[0.15em] shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}dd)`,
                boxShadow: `0 8px 30px ${ACCENT}40`,
              }}
            >
              {String(ok).padStart(3, "0")}
              <span className="text-white/60 text-lg ml-1">OK</span>
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
                {okPct}% OK
              </span>
            </div>
          </div>

          {/* 3-chip legend — matches doughnut */}
          <div className="flex flex-wrap justify-center gap-2 mt-4 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-xl border border-green-200">
              <span className="w-3.5 h-3.5 bg-green-700 rounded-md shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider">
                  OK
                </span>
                <span className="text-sm font-black text-green-800 font-mono leading-tight">
                  {ok.toLocaleString()}
                </span>
              </div>
              <span className="ml-1 text-[10px] font-bold text-green-500 bg-green-100 px-2 py-0.5 rounded-full">
                {okPct}%
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-xl border border-red-200">
              <span className="w-3.5 h-3.5 bg-red-600 rounded-md shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">
                  Defects
                </span>
                <span className="text-sm font-black text-red-700 font-mono leading-tight">
                  {defect.toLocaleString()}
                </span>
              </div>
              <span className="ml-1 text-[10px] font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                {defPct}%
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200">
              <span className="w-3.5 h-3.5 bg-amber-500 rounded-md shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider">
                  Rework
                </span>
                <span className="text-sm font-black text-amber-700 font-mono leading-tight">
                  {rework.toLocaleString()}
                </span>
              </div>
              <span className="ml-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                {reworkPct}%
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — Defects table */}
        <div className="w-[45%] flex flex-col min-w-0">
          <div
            className="text-white font-bold text-sm text-center py-2.5 rounded-t-xl tracking-wider uppercase flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-white/50" /> Top Defects
            Today
          </div>
          <div className="flex-1 overflow-auto bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h, i) => (
                    <th
                      key={h}
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
                {defects.length > 0 ? (
                  defects.map((df, i) => {
                    const isTop = i < 3;
                    const srNo = df.SrNo ?? i + 1;
                    return (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                      >
                        <td className="px-3 py-2.5 border-b border-slate-100 text-center w-14">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black font-mono text-xs ${
                              isTop
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {srNo}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-700 font-semibold text-sm">
                          <div className="flex items-center gap-2">
                            {isTop && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            )}
                            {df.DefectName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-center w-24">
                          <span
                            className={`inline-block font-black text-lg px-3 py-0.5 rounded-lg border ${
                              isTop
                                ? "bg-red-50 text-red-600 border-red-200"
                                : "bg-amber-50 text-amber-600 border-amber-200"
                            }`}
                          >
                            {df.DefectCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-16 text-center text-slate-400 text-lg"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-4xl">✓</span>
                        <p>No defects recorded this shift</p>
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

export default Quality;

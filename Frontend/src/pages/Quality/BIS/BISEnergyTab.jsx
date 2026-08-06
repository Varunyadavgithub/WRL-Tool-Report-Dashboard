import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import {
  Zap, AlertTriangle, CheckCircle, BarChart2, Layers, Calendar, Filter,
  FileSearch, FileDown, FileSpreadsheet,
} from "lucide-react";
import { exportSectionsToExcel, exportMultiSectionPDF } from "../../../utils/reportExport";
import {
  MONTHS, PIE_COLORS, ENERGY_SERIES_COLORS, deviationColor, DEVIATION_THRESHOLD_PCT,
  MultiSelectDropdown, FreqBadge, tooltipStyle,
} from "./shared";

// Merged UploadBISReport's "Energy Analysis" + "Analytics" tabs — both were
// deriving stats from the same `bis-files` data with independent chart sets,
// now one coherent tab.
const BISEnergyTab = ({ files }) => {
  const [modelFilter, setModelFilter] = useState([]);
  const [yearFilter, setYearFilter] = useState([]);

  const modelOptions = useMemo(() => [...new Set(files.map((f) => f.modelName).filter(Boolean))].sort(), [files]);
  const yearOptions = useMemo(() => [...new Set(files.map((f) => String(f.year)).filter(Boolean))].sort(), [files]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchModel = modelFilter.length === 0 || modelFilter.includes(f.modelName);
      const matchYear = yearFilter.length === 0 || yearFilter.includes(String(f.year));
      return matchModel && matchYear;
    });
  }, [files, modelFilter, yearFilter]);

  const analysis = useMemo(() => {
    const withEnergy = filteredFiles.filter((f) => f.declaredAnnualEnergy != null && f.measuredAnnualEnergy != null);
    const withDeviation = filteredFiles.filter((f) => f.energyDeviationPercent != null);
    const withResult = filteredFiles.filter((f) => f.testResult);

    // Declared/measured kWh with each row's deviation % folded in (as a
    // label + tooltip line, not a second bar) — one chart instead of two,
    // since kWh and % don't share a scale (no dual-axis chart).
    const modelYearData = [...withEnergy]
      .sort((a, b) => (b.declaredAnnualEnergy || 0) - (a.declaredAnnualEnergy || 0))
      .map((f) => ({
        label: `${f.modelName} (${f.year})`,
        declared: f.declaredAnnualEnergy,
        measured: f.measuredAnnualEnergy,
        deviation: f.energyDeviationPercent ?? null,
      }));

    const passCount = withResult.filter((f) => f.testResult === "PASS").length;
    const failCount = withResult.length - passCount;
    const avgDeviation = withDeviation.length
      ? withDeviation.reduce((sum, f) => sum + f.energyDeviationPercent, 0) / withDeviation.length
      : null;

    // Reports-by-time breakdowns (from the old "Analytics" tab)
    const yearCounts = filteredFiles.reduce((acc, f) => { acc[f.year] = (acc[f.year] || 0) + 1; return acc; }, {});
    const freqCounts = filteredFiles.reduce((acc, f) => { acc[f.testFrequency] = (acc[f.testFrequency] || 0) + 1; return acc; }, {});
    const byYear = Object.entries(yearCounts).map(([year, count]) => ({ year, count })).sort((a, b) => a.year.localeCompare(b.year));
    const byFreq = Object.entries(freqCounts).map(([name, value]) => ({ name, value }));
    const byMonth = MONTHS.map((m) => ({ month: m.slice(0, 3), count: filteredFiles.filter((f) => f.month === m).length }));

    const modelSummary = Object.entries(
      filteredFiles.reduce((acc, f) => {
        if (!acc[f.modelName]) acc[f.modelName] = { count: 0, years: new Set(), freqs: new Set(), latest: null };
        acc[f.modelName].count++;
        acc[f.modelName].years.add(f.year);
        acc[f.modelName].freqs.add(f.testFrequency);
        const d = f.uploadAt ? new Date(f.uploadAt) : null;
        if (d && (!acc[f.modelName].latest || d > acc[f.modelName].latest)) acc[f.modelName].latest = d;
        return acc;
      }, {}),
    ).map(([model, data]) => ({ model, ...data }));

    return {
      totalFiltered: filteredFiles.length,
      withEnergyCount: withEnergy.length,
      missingCount: filteredFiles.length - withEnergy.length,
      passCount, failCount,
      passRate: withResult.length ? Math.round((passCount / withResult.length) * 100) : null,
      avgDeviation,
      modelYearData,
      byYear, byFreq, byMonth, modelSummary,
    };
  }, [filteredFiles]);

  const exportTitle = "BIS Energy Analysis";
  const exportSubtitle = `${analysis.totalFiltered} report(s)${modelFilter.length ? ` · ${modelFilter.length} model(s)` : ""}${yearFilter.length ? ` · ${yearFilter.length} year(s)` : ""}`;
  const buildExportBlocks = () => [
    {
      type: "table", heading: "Declared vs Measured Annual Energy",
      columns: [
        { label: "Model (Year)", align: "left", value: (r) => r.label },
        { label: "Declared (kWh)", align: "right", value: (r) => r.declared },
        { label: "Measured (kWh)", align: "right", value: (r) => r.measured },
        { label: "Deviation (%)", align: "right", value: (r) => r.deviation ?? "" },
      ],
      rows: analysis.modelYearData,
    },
    {
      type: "table", heading: "Model-wise Summary",
      columns: [
        { label: "Model Name", align: "left", value: (r) => r.model },
        { label: "Total Reports", align: "right", value: (r) => r.count },
        { label: "Years Covered", align: "left", value: (r) => [...r.years].sort().join(", ") },
        { label: "Latest Upload", align: "left", value: (r) => (r.latest ? r.latest.toLocaleDateString("en-IN") : "—") },
      ],
      rows: analysis.modelSummary,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <MultiSelectDropdown label="Model" options={modelOptions} selected={modelFilter} onChange={setModelFilter} placeholder="All models" />
        <MultiSelectDropdown label="Year" options={yearOptions} selected={yearFilter} onChange={setYearFilter} placeholder="All years" />
        {(modelFilter.length > 0 || yearFilter.length > 0) && (
          <button onClick={() => { setModelFilter([]); setYearFilter([]); }} className="h-9 text-xs text-blue-600 hover:underline font-semibold">
            Clear filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportMultiSectionPDF({ title: exportTitle, subtitle: exportSubtitle, blocks: buildExportBlocks(), filename: "bis-energy-analysis.pdf" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600 transition-all"
            title="Export PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportSectionsToExcel({ title: exportTitle, subtitle: exportSubtitle, blocks: buildExportBlocks(), filename: "bis-energy-analysis.xlsx" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-all"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>
          <span className="h-9 flex items-center text-[11px] text-slate-400">
            {analysis.totalFiltered} record{analysis.totalFiltered !== 1 ? "s" : ""} matched
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: "With Energy Data", value: analysis.withEnergyCount, cls: "bg-indigo-50 border-indigo-100", txt: "text-indigo-700", sub: "text-indigo-500" },
          { icon: AlertTriangle, label: "Missing Data", value: analysis.missingCount, cls: "bg-amber-50 border-amber-100", txt: "text-amber-700", sub: "text-amber-500" },
          { icon: CheckCircle, label: "Pass Rate", value: analysis.passRate != null ? `${analysis.passRate}%` : "—", cls: "bg-emerald-50 border-emerald-100", txt: "text-emerald-700", sub: "text-emerald-500" },
          { icon: BarChart2, label: "Avg. Deviation", value: analysis.avgDeviation != null ? `${analysis.avgDeviation > 0 ? "+" : ""}${analysis.avgDeviation.toFixed(2)}%` : "—", cls: "bg-violet-50 border-violet-100", txt: "text-violet-700", sub: "text-violet-500" },
        ].map(({ icon: Icon, label, value, cls, txt, sub }) => (
          <div key={label} className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${cls}`}>
            <Icon className={`w-4 h-4 mb-1 ${txt}`} />
            <span className={`text-2xl font-bold font-mono ${txt}`}>{value}</span>
            <span className={`text-[10px] font-medium uppercase tracking-wide ${sub}`}>{label}</span>
          </div>
        ))}
      </div>

      {analysis.withEnergyCount === 0 && analysis.passCount + analysis.failCount === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <FileSearch className="w-10 h-10 opacity-20" />
          <p className="text-sm text-slate-500">No records with extracted energy data match these filters.</p>
          <p className="text-xs text-slate-400">Use "Fetch Data" on a report in All Reports to extract it.</p>
        </div>
      ) : (
        <>
          {/* Declared/Measured energy, with each bar's deviation % folded in
              as a color-coded label + tooltip line instead of a second chart. */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Declared vs Measured Annual Energy</span>
              <span className="text-[10px] text-slate-400 ml-1">
                (colored % above each bar = declared/measured deviation vs the {DEVIATION_THRESHOLD_PCT}% limit)
              </span>
            </div>
            {analysis.modelYearData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-16">No matching records</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={analysis.modelYearData} margin={{ top: 24, right: 8, left: 0, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={0} height={70} />
                  <YAxis tick={{ fontSize: 10 }} unit=" kWh" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const devColor = d.deviation != null ? deviationColor(d.deviation, DEVIATION_THRESHOLD_PCT) : "#94a3b8";
                      return (
                        <div style={{ ...tooltipStyle, background: "#fff", padding: "8px 10px" }}>
                          <p style={{ fontWeight: 600, fontSize: 11, marginBottom: 4, color: "#1e293b" }}>{d.label}</p>
                          <p style={{ fontSize: 11, color: ENERGY_SERIES_COLORS.declared }}>Declared: {d.declared} kWh</p>
                          <p style={{ fontSize: 11, color: ENERGY_SERIES_COLORS.measured }}>Measured: {d.measured} kWh</p>
                          {d.deviation != null && (
                            <p style={{ fontSize: 11, fontWeight: 700, color: devColor }}>
                              Deviation: {d.deviation > 0 ? "+" : ""}{d.deviation}%
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs font-semibold text-slate-600">{v === "declared" ? "Declared" : "Measured"}</span>} />
                  <Bar dataKey="declared" fill={ENERGY_SERIES_COLORS.declared} radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="deviation"
                      position="top"
                      content={({ x, y, width, value }) => {
                        if (value == null) return null;
                        const color = deviationColor(value, DEVIATION_THRESHOLD_PCT);
                        return (
                          <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
                            {value > 0 ? "+" : ""}{value}%
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  <Bar dataKey="measured" fill={ENERGY_SERIES_COLORS.measured} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Reports-by-time breakdowns (from the old "Analytics" tab) */}
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Reports by Year</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analysis.byYear} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Reports"]} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Test Frequency</span>
              </div>
              {analysis.byFreq.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={analysis.byFreq} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {analysis.byFreq.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-slate-400 text-center pt-16">No frequency data</p>}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Reports by Month</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analysis.byMonth} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Reports"]} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Summary Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Model-wise Summary</span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {["Model Name", "Total Reports", "Years Covered", "Frequencies", "Latest Upload"].map((h) => (
                      <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.modelSummary.map(({ model, count, years, freqs, latest }) => (
                    <tr key={model} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
                      <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800">{model}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600 text-center">{count}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 font-mono">{[...years].sort().join(", ")}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <div className="flex flex-wrap gap-1">{[...freqs].map((f) => <FreqBadge key={f} freq={f} />)}</div>
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400">{latest ? latest.toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BISEnergyTab;

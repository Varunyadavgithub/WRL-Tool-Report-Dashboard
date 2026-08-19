import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import DateTimePicker from "../../components/ui/DateTimePicker";
import { exportSectionsToExcel } from "../../utils/reportExport.js";
import { baseURL } from "../../assets/assets";
import {
  Filter,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Zap,
  Clock,
  ArrowUp,
  ArrowDown,
  Table2,
  BarChart3,
  CheckCircle2,
  XCircle,
  PackageOpen,
  Loader2,
  Target,
  ClipboardList,
  Shield,
  Gauge,
  Trophy,
  Activity,
  Download,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ChartTitle,
  ChartTooltip,
  ChartLegend,
  ChartDataLabels,
);

// ─── Utilities ─────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatTimestamp = (ts) =>
  ts ? String(ts).replace("T", " ").replace("Z", "").slice(0, 19) : "";

const EXPORT_COLUMNS = [
  { label: "ID", value: (r) => r.id },
  { label: "Model Code", value: (r) => r.model_code },
  { label: "Model Name", value: (r) => r.model_name },
  { label: "Serial No", value: (r) => r.scan_data },
  { label: "Flow (l/h)", value: (r) => r.leak_text },
  { label: "Flow Value", value: (r) => r.leak_value },
  { label: "Status", value: (r) => r.status },
  { label: "ATEQ PRG", value: (r) => r.ateq_prg },
  { label: "Timestamp", value: (r) => formatTimestamp(r.timestamp) },
  { label: "Created At", value: (r) => formatTimestamp(r.created_at) },
];

// ─── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── Status Pill ───────────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const isOk = String(status).toUpperCase() === "OK";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
        isOk
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-rose-50 text-rose-800 border-rose-200"
      }`}
    >
      {isOk ? (
        <CheckCircle2 className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5" />
      )}
      {String(status).toUpperCase()}
    </span>
  );
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, borderColor, sub }) => (
  <div
    className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]"
    style={{ borderTopWidth: 3, borderTopColor: borderColor }}
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${borderColor}18`, color: borderColor }}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ─── Model Performance Panel ──────────────────────────────────────────────────

const ModelPerformancePanel = ({ data }) => {
  if (!data || data.length === 0) return null;

  const models = {};
  data.forEach((r) => {
    if (!r.model_code) return;
    if (!models[r.model_code])
      models[r.model_code] = {
        ok: 0,
        nok: 0,
        total: 0,
        model_name: r.model_name || "",
      };
    models[r.model_code].total++;
    if (String(r.status).toUpperCase() === "OK") models[r.model_code].ok++;
    else models[r.model_code].nok++;
  });

  const rows = Object.entries(models)
    .map(([model_code, d]) => ({
      model_code,
      model_name: d.model_name,
      ok: d.ok,
      nok: d.nok,
      total: d.total,
      passRate: d.total > 0 ? ((d.ok / d.total) * 100).toFixed(1) : "0",
    }))
    .sort((a, b) => parseFloat(b.passRate) - parseFloat(a.passRate));

  if (rows.length < 1) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Model Performance
        </span>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              {[
                "Model Code",
                "Model Name",
                "Total",
                "OK",
                "NOK",
                "Pass Rate",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
              >
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.model_code}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
                  {row.model_name || "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-blue-600">
                  {row.total}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-emerald-600">
                  {row.ok}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 ${row.nok > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}
                >
                  {row.nok}
                </td>
                <td className="px-3 py-2 border-b border-slate-100">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      parseFloat(row.passRate) >= 95
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : parseFloat(row.passRate) >= 80
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {row.passRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ATEq Program Panel ────────────────────────────────────────────────────────

const AteqProgramPanel = ({ data }) => {
  if (!data || data.length === 0) return null;

  const programs = {};
  data.forEach((r) => {
    if (!r.ateq_prg) return;
    if (!programs[r.ateq_prg])
      programs[r.ateq_prg] = {
        ok: 0,
        nok: 0,
        total: 0,
        model_names: new Set(),
      };
    programs[r.ateq_prg].total++;
    if (r.model_name) programs[r.ateq_prg].model_names.add(r.model_name);
    if (String(r.status).toUpperCase() === "OK") programs[r.ateq_prg].ok++;
    else programs[r.ateq_prg].nok++;
  });

  const rows = Object.entries(programs).map(([prg, d]) => ({
    prg,
    ok: d.ok,
    nok: d.nok,
    total: d.total,
    model_names: [...d.model_names].join(", "),
    passRate: d.total > 0 ? ((d.ok / d.total) * 100).toFixed(1) : "0",
  }));

  if (rows.length < 1) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          ATEQ Program Analysis
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {rows.map((row, i) => {
          const rate = parseFloat(row.passRate);
          return (
            <div
              key={i}
              className={`flex-1 min-w-[160px] rounded-xl px-4 py-3 border ${
                rate >= 95
                  ? "bg-emerald-50 border-emerald-200"
                  : rate >= 80
                    ? "bg-amber-50 border-amber-200"
                    : "bg-rose-50 border-rose-200"
              }`}
            >
              <div className="font-bold text-slate-900 text-sm mb-0.5">
                PRG: {row.prg}
              </div>
              {row.model_names && (
                <div className="text-[10px] text-slate-500 font-medium mb-1">
                  {row.model_names}
                </div>
              )}
              <div className="text-[11px] text-slate-500 mb-1.5">
                {row.total} tested
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  rate >= 95
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : rate >= 80
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {row.passRate}% OK
              </span>
              <div className="flex gap-2 mt-1.5 text-[10px] text-slate-500">
                <span className="text-emerald-500">OK:{row.ok}</span>
                <span className="text-rose-500">NOK:{row.nok}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Model Name Multi-Select ───────────────────────────────────────────────────

const ModelMultiSelect = ({ options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (val) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
  };

  const label =
    selected.length === 0
      ? "All Models"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} models selected`;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        Model Name
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 max-h-64 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 sticky top-0 bg-white">
            <button
              onClick={() => onChange(options)}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              Select all
            </button>
            <button
              onClick={() => onChange([])}
              className="text-[11px] text-slate-400 font-semibold hover:underline"
            >
              Clear
            </button>
          </div>
          {options.length > 0 ? (
            options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 accent-blue-600 shrink-0"
                />
                <span className="truncate">{opt}</span>
              </label>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-slate-400">
              No models in current results
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Flow Value Distribution Histogram ─────────────────────────────────────────

const FlowValueHistogram = forwardRef(({ data }, ref) => {
  const [binSize, setBinSize] = useState(10);
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedBinIndex, setSelectedBinIndex] = useState(null);
  const chartRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getChartImage: () => chartRef.current?.toBase64Image?.() ?? null,
  }));

  const modelNameOptions = useMemo(
    () => [...new Set(data.map((r) => r.model_name).filter(Boolean))].sort(),
    [data],
  );

  // Reset the selection if the underlying data changes (e.g. a fresh Query)
  // and it no longer contains any of the previously-selected models.
  useEffect(() => {
    setSelectedModels((prev) =>
      prev.filter((m) => modelNameOptions.includes(m)),
    );
  }, [modelNameOptions]);

  const scopedData = useMemo(
    () =>
      selectedModels.length > 0
        ? data.filter((r) => selectedModels.includes(r.model_name))
        : data,
    [data, selectedModels],
  );

  // Rows with a valid numeric leak_value, paired with their parsed number —
  // this is what actually gets binned (and drilled into on bar click).
  const scopedRows = useMemo(
    () =>
      scopedData
        .map((r) => ({ row: r, v: Number(r.leak_value) }))
        .filter((r) => Number.isFinite(r.v)),
    [scopedData],
  );

  const values = useMemo(() => scopedRows.map((r) => r.v), [scopedRows]);

  const { labels, counts, binRows } = useMemo(() => {
    if (!values.length || !binSize || binSize <= 0) {
      return { labels: [], counts: [], binRows: [] };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const start = Math.floor(min / binSize) * binSize;
    const numBins = Math.max(1, Math.ceil((max - start) / binSize) || 1);
    const bins = new Array(numBins).fill(0);
    const rowsByBin = Array.from({ length: numBins }, () => []);
    scopedRows.forEach(({ row, v }) => {
      let idx = Math.floor((v - start) / binSize);
      if (idx >= numBins) idx = numBins - 1;
      if (idx < 0) idx = 0;
      bins[idx]++;
      rowsByBin[idx].push(row);
    });
    const fmt = (n) =>
      Number.isInteger(binSize) ? n.toFixed(0) : n.toFixed(1);
    const lbls = bins.map(
      (_, i) => `${fmt(start + i * binSize)}-${fmt(start + (i + 1) * binSize)}`,
    );
    return { labels: lbls, counts: bins, binRows: rowsByBin };
  }, [values, scopedRows, binSize]);

  // Bin layout just changed (new data, new bin size) — any previously
  // selected bin index may now point at a different range, so drop it.
  useEffect(() => {
    setSelectedBinIndex(null);
  }, [labels]);

  const [exportingChart, setExportingChart] = useState(false);

  const THIN_BORDER = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
  const HEADER_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0E7490" },
  };
  const STRIPE_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFECFEFF" },
  };

  const styleHeaderRow = (row) => {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = THIN_BORDER;
    });
  };

  const styleDataRow = (row, striped) => {
    row.eachCell((cell) => {
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (striped) cell.fill = STRIPE_FILL;
    });
  };

  const handleHistogramExport = async () => {
    if (!labels.length) {
      toast.error("No distribution data to export.");
      return;
    }
    setExportingChart(true);
    try {
      const workbook = new ExcelJS.Workbook();

      const modelFilterLabel =
        selectedModels.length > 0 ? selectedModels.join(", ") : "All Models";

      const hasSelectedBin =
        selectedBinIndex != null && binRows[selectedBinIndex];
      const selectedRangeLabel = hasSelectedBin
        ? `${labels[selectedBinIndex]} (${counts[selectedBinIndex]} readings)`
        : "All Ranges";

      // When a bin is selected, scope both sheets down to just that bin —
      // matches exactly what the on-screen drill-down panel shows.
      const exportLabels = hasSelectedBin ? [labels[selectedBinIndex]] : labels;
      const exportCounts = hasSelectedBin ? [counts[selectedBinIndex]] : counts;
      const exportRows = hasSelectedBin ? binRows[selectedBinIndex] : scopedData;

      // Writes the currently-applied filter values (model filter, bin size,
      // selected range, reading count) at the top of a sheet and returns the
      // next free row.
      const writeFilterInfo = (sheet, startRow) => {
        const infoRows = [
          ["Model Filter", modelFilterLabel],
          ["Bin Size", binSize],
          ["Selected Range", selectedRangeLabel],
          ["Total Readings", exportRows.length],
        ];
        infoRows.forEach(([label, value], i) => {
          const cell = sheet.getCell(startRow + i, 1);
          cell.value = `${label}: ${value}`;
          cell.font = { bold: true, color: { argb: "FF0E7490" }, size: 11 };
        });
        return startRow + infoRows.length + 1; // + 1 blank spacer row
      };

      // ── Sheet 1: filter info + chart image + binned distribution, gridlines off ──
      const distSheet = workbook.addWorksheet("Distribution", {
        views: [{ showGridLines: false }],
      });
      distSheet.getColumn(1).width = 20;
      distSheet.getColumn(2).width = 14;

      const nextRow = writeFilterInfo(distSheet, 1);

      const chartImage = chartRef.current?.toBase64Image?.();
      let headerRowIdx = nextRow;
      if (chartImage) {
        const imgId = workbook.addImage({
          base64: chartImage,
          extension: "png",
        });
        distSheet.addImage(imgId, {
          tl: { col: 0, row: nextRow - 1 },
          ext: { width: 640, height: 260 },
        });
        headerRowIdx = nextRow + 14;
      }

      const distHeader = distSheet.getRow(headerRowIdx);
      distHeader.values = ["Flow Range", "Count"];
      styleHeaderRow(distHeader);

      exportLabels.forEach((label, i) => {
        const row = distSheet.addRow([label, exportCounts[i]]);
        row.getCell(2).numFmt = "0";
        styleDataRow(row, i % 2 === 1);
      });

      // ── Sheet 2: filter info + the filtered readings behind the chart, gridlines off ──
      const readingsSheet = workbook.addWorksheet("Readings", {
        views: [{ showGridLines: false }],
      });
      readingsSheet.getColumn(1).width = 22;
      readingsSheet.getColumn(2).width = 24;
      readingsSheet.getColumn(3).width = 14;
      readingsSheet.getColumn(4).width = 12;

      const readingsHeaderRow = writeFilterInfo(readingsSheet, 1);
      const readingsHeader = readingsSheet.getRow(readingsHeaderRow);
      readingsHeader.values = [
        "Serial No",
        "Model Name",
        "Flow Value",
        "Status",
      ];
      styleHeaderRow(readingsHeader);

      exportRows.forEach((r, i) => {
        const row = readingsSheet.addRow([
          r.scan_data,
          r.model_name,
          r.leak_value,
          r.status,
        ]);
        row.getCell(3).numFmt = "0.00";
        styleDataRow(row, i % 2 === 1);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = hasSelectedBin
        ? `Flow_Value_Distribution_${labels[selectedBinIndex]}.xlsx`
        : "Flow_Value_Distribution.xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success("Distribution exported successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export distribution.");
    } finally {
      setExportingChart(false);
    }
  };

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Count",
          data: counts,
          backgroundColor: counts.map((_, i) =>
            i === selectedBinIndex
              ? "rgba(8,145,178,1)"
              : "rgba(8,145,178,0.75)",
          ),
          borderColor: counts.map((_, i) =>
            i === selectedBinIndex ? "#155e75" : "#0e7490",
          ),
          borderWidth: counts.map((_, i) => (i === selectedBinIndex ? 2.5 : 1.5)),
          borderRadius: 6,
          barPercentage: 0.85,
          categoryPercentage: 0.9,
        },
      ],
    }),
    [labels, counts, selectedBinIndex],
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        setSelectedBinIndex((prev) => (prev === idx ? null : idx));
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length
          ? "pointer"
          : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            title: (items) => `Flow ${items[0].label}`,
            label: (item) => `Count: ${item.formattedValue}`,
          },
        },
        datalabels: {
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
          anchor: "end",
          align: "top",
          offset: 2,
          color: "#0e2f38",
          font: { size: 11, weight: "bold" },
          formatter: (value) => value,
          clip: false,
          clamp: true,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#94a3b8" },
          ticks: {
            color: "#1e293b",
            font: { size: 11, weight: "bold" },
            maxRotation: 45,
            minRotation: 0,
          },
          title: {
            display: true,
            text: "Flow Value",
            color: "#1e293b",
            font: { size: 12, weight: "bold" },
          },
        },
        y: {
          beginAtZero: true,
          grace: "10%",
          border: { display: false },
          ticks: {
            color: "#1e293b",
            font: { size: 11, weight: "bold" },
            precision: 0,
          },
          grid: { color: "#e2e8f0" },
          title: {
            display: true,
            text: "Count",
            color: "#1e293b",
            font: { size: 12, weight: "bold" },
          },
        },
      },
    }),
    [],
  );

  if (!data.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-cyan-600" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            Flow Value Distribution
          </span>
          <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-[11px] font-semibold rounded-full border border-cyan-100">
            {values.length} readings
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-56">
            <ModelMultiSelect
              options={modelNameOptions}
              selected={selectedModels}
              onChange={setSelectedModels}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500">
              Bin Size
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={binSize}
              onChange={(e) => setBinSize(Number(e.target.value) || 1)}
              className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <div className="flex items-center gap-1">
              {[5, 10, 20, 50].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setBinSize(preset)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    binSize === preset
                      ? "bg-cyan-600 text-white border-cyan-600"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleHistogramExport}
            disabled={exportingChart || !values.length}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              exportingChart || !values.length
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm shadow-cyan-200"
            }`}
          >
            {exportingChart ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {exportingChart ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
      {values.length > 0 ? (
        <div className="h-64 relative">
          <Bar ref={chartRef} data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-xs text-slate-400">
          No numeric flow values for the selected model(s).
        </div>
      )}

      {selectedBinIndex != null && binRows[selectedBinIndex] && (
        <div className="mt-3 border border-cyan-200 bg-cyan-50/40 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-cyan-50 border-b border-cyan-100">
            <span className="text-xs font-bold text-cyan-800">
              Flow {labels[selectedBinIndex]} · {binRows[selectedBinIndex].length}{" "}
              reading{binRows[selectedBinIndex].length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => setSelectedBinIndex(null)}
              className="text-cyan-500 hover:text-cyan-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-xs text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-white">
                  {[
                    "Serial No",
                    "Model",
                    "Flow Value",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-1.5 font-semibold text-slate-500 border-b border-cyan-100 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {binRows[selectedBinIndex].map((row, i) => (
                  <tr key={i} className="even:bg-white/60">
                    <td className="px-3 py-1.5 border-b border-cyan-100 font-mono text-slate-700 whitespace-nowrap">
                      {row.scan_data ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-cyan-100 text-slate-700 whitespace-nowrap">
                      {row.model_name ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-cyan-100 font-semibold text-slate-800 whitespace-nowrap">
                      {row.leak_value}
                    </td>
                    <td className="px-3 py-1.5 border-b border-cyan-100 whitespace-nowrap">
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});
FlowValueHistogram.displayName = "FlowValueHistogram";

// ─── Empty State ───────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
      <Search className="w-6 h-6 text-blue-400" />
    </div>
    <h3 className="text-sm font-semibold text-slate-600">No Data Found</h3>
    <p className="text-xs text-slate-400 max-w-sm text-center">
      Adjust your filters and click Query to load Mass Flow report data.
    </p>
  </div>
);

// ─── Data Table ────────────────────────────────────────────────────────────────

const MassFlowTable = ({ data }) => {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    if (statusFilter === "All") return data;
    return data.filter((r) => String(r.status).toUpperCase() === statusFilter);
  }, [data, statusFilter]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key],
        bv = b[sort.key];
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sort]);

  const toggleSort = (key) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));

  if (!data || data.length === 0)
    return (
      <tr>
        <td colSpan={8} className="py-10 text-center">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
            <p className="text-xs">No data available.</p>
          </div>
        </td>
      </tr>
    );

  const STATUS_FILTERS = [
    { key: "All", color: "blue" },
    { key: "OK", color: "emerald" },
    { key: "NOK", color: "rose" },
  ];

  const COLS = [
    { label: "ID", key: "id" },
    { label: "Model Code", key: "model_code" },
    { label: "Model Name", key: "model_name" },
    { label: "Serial No", key: "scan_data" },
    { label: "Flow (l/h)", key: "leak_text" },
    { label: "Flow Value", key: "leak_value" },
    { label: "Status", key: "status" },
    { label: "ATEQ PRG", key: "ateq_prg" },
    { label: "Created At", key: "created_at" },
  ];

  return (
    <>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500">
          Filter:
        </span>
        {STATUS_FILTERS.map(({ key, color }) => {
          const active = statusFilter === key;
          const count =
            key === "All"
              ? data.length
              : data.filter((r) => String(r.status).toUpperCase() === key)
                  .length;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                active
                  ? `bg-${color}-600 text-white border-${color}-600 shadow-sm`
                  : `bg-${color}-50 text-${color}-700 border-${color}-200 hover:bg-${color}-100`
              }`}
            >
              {key} ({count})
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-400">
          Showing {sorted.length} of {data.length}
        </span>
      </div>

      <div className="overflow-auto max-h-[50vh]">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              {COLS.map(({ label, key }) => (
                <th
                  key={label}
                  onClick={() => toggleSort(key)}
                  className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center cursor-pointer hover:text-blue-600"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sort.key === key &&
                      (sort.dir === "asc" ? (
                        <ArrowUp className="w-2.5 h-2.5" />
                      ) : (
                        <ArrowDown className="w-2.5 h-2.5" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
              >
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600">
                  {row.id}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.model_code ?? "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.model_name ?? "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-700">
                  {row.scan_data ?? "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800">
                  {row.leak_value != null ? `${row.leak_value}` : "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800">
                  {row.leak_text != null ? `${row.leak_text}` : "—"}
                </td>

                <td className="px-3 py-2 border-b border-slate-100">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.ateq_prg ?? "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                  {row.created_at
                    ? String(row.created_at)
                        .replace("T", " ")
                        .replace("Z", "")
                        .slice(0, 19)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const MassFlowReport = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [reportData, setReportData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState("");
  const [lastFetched, setLastFetched] = useState(null);
  const [exporting, setExporting] = useState(false);
  const histogramRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDetails(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchReport = useCallback(async (params) => {
    const res = await axios.get(`${baseURL}quality/mass-flow-report`, {
      params,
    });
    if (res?.data?.success) return res.data.data || [];
    return [];
  }, []);

  const runQuery = useCallback(
    async (params) => {
      setLoading(true);
      setReportData([]);
      try {
        const data = await fetchReport(params);
        setReportData(data);
        setLastFetched(new Date());
        if (data.length === 0) toast.success("No records found.");
        else toast.success(`Loaded ${data.length} records`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch Mass Flow Report.");
      } finally {
        setLoading(false);
      }
    },
    [fetchReport],
  );

  const buildParams = useCallback(() => {
    const params = { startDate: startTime, endDate: endTime };
    if (modelCode.trim()) params.model_code = modelCode.trim();
    return params;
  }, [startTime, endTime, modelCode]);

  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select a time range.");
      return;
    }
    runQuery(buildParams());
  };

  const handleYesterdayQuery = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1);
    runQuery({
      startDate: formatDate(yesterday8AM),
      endDate: formatDate(today8AM),
      ...(modelCode.trim() ? { model_code: modelCode.trim() } : {}),
    });
  };

  const handleTodayQuery = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    runQuery({
      startDate: formatDate(today8AM),
      endDate: formatDate(now),
      ...(modelCode.trim() ? { model_code: modelCode.trim() } : {}),
    });
  };

  const handleMTDQuery = () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    );
    runQuery({
      startDate: formatDate(startOfMonth),
      endDate: formatDate(now),
      ...(modelCode.trim() ? { model_code: modelCode.trim() } : {}),
    });
  };

  const handleExport = async () => {
    if (!reportData.length) {
      toast.error("No data available for export.");
      return;
    }
    setExporting(true);
    try {
      const chartImage = histogramRef.current?.getChartImage?.() ?? null;
      const blocks = [];
      if (chartImage) {
        blocks.push({
          type: "image",
          heading: "Flow Value Distribution",
          dataUrl: chartImage,
          width: 640,
          height: 260,
        });
      }
      blocks.push({
        type: "table",
        heading: "Mass Flow Data",
        columns: EXPORT_COLUMNS,
        rows: reportData,
      });

      await exportSectionsToExcel({
        title: "Mass Flow Report",
        subtitle:
          startTime && endTime ? `${startTime} to ${endTime}` : undefined,
        blocks,
        filename: "Mass_Flow_Report.xlsx",
      });
      toast.success("Report exported successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export report.");
    } finally {
      setExporting(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!Array.isArray(reportData)) return reportData;
    if (!details) return reportData;
    const q = details.toLowerCase();
    return reportData.filter(
      (item) =>
        item.scan_data?.toLowerCase().includes(q) ||
        item.model_code?.toLowerCase().includes(q) ||
        item.model_name?.toLowerCase().includes(q) ||
        item.leak_text?.toLowerCase().includes(q) ||
        (item.ateq_prg != null &&
          String(item.ateq_prg).toLowerCase().includes(q)) ||
        String(item.status).toLowerCase().includes(q),
    );
  }, [reportData, details]);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Mass Flow Report
          </h1>
          <p className="text-[11px] text-slate-400">
            ATEQ Leak Test Captures · Quality Intelligence Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
              <Clock className="w-3 h-3" />
              {lastFetched.toLocaleTimeString()}
            </span>
          )}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {filteredData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-100">
            <Target className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-bold text-violet-700">
              {(() => {
                const names = [
                  ...new Set(
                    reportData.map((r) => r.model_name).filter(Boolean),
                  ),
                ];
                return names.length === 1
                  ? names[0]
                  : `Models: ${names.length}`;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="Start Time"
                    name="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="End Time"
                    name="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                <div className="min-w-[150px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Model Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1951"
                    value={modelCode}
                    onChange={(e) => setModelCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Serial, Model, Leak Text..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pb-0.5 shrink-0">
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
                      <Spinner cls="w-4 h-4" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {loading ? "Loading..." : "Query"}
                  </button>
                  {reportData.length > 0 && (
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        exporting
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
                      }`}
                    >
                      {exporting ? (
                        <Spinner cls="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {exporting ? "Exporting..." : "Export"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="border-l border-slate-100 pl-5 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Quick Select
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleYesterdayQuery}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  Yesterday <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={handleTodayQuery}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  Today <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={handleMTDQuery}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  Month to Date <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching report data...</p>
          </div>
        )}

        {/* ── DATA PANELS ── */}
        {!loading && reportData.length > 0 && (
          <>
            <FlowValueHistogram ref={histogramRef} data={filteredData} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <ModelPerformancePanel data={filteredData} />
              <AteqProgramPanel data={filteredData} />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <Table2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Data Table
                </span>
                <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                  {filteredData.length} rows
                </span>
              </div>
              <div className="p-4">
                <MassFlowTable data={filteredData} />
              </div>
            </div>
          </>
        )}

        {/* ── Empty State ── */}
        {!loading && reportData.length === 0 && <EmptyState />}
      </div>
    </div>
  );
};

export default MassFlowReport;

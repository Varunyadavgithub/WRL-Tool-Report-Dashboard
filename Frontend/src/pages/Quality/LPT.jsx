import { useEffect, useState } from "react";
import InputField from "../../components/ui/InputField";
import Loader from "../../components/ui/Loader";
import SelectField from "../../components/ui/SelectField";
import toast from "react-hot-toast";
import axios from "axios";
import { getFormattedISTDate } from "../../utils/dateUtils.js";
import { baseURL } from "../../assets/assets.js";
import { getCurrentShift } from "../../utils/shiftUtils.js";

import {
  Thermometer,
  Zap,
  Power,
  Search,
  Filter,
  Table2,
  PackageOpen,
  Loader2,
  CheckCircle2,
  XCircle,
  Barcode,
  ClipboardList,
  PlusCircle,
  BarChart3,
  Factory,
  Clock,
  FileText,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";

// ─── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── EmptyRow ──────────────────────────────────────────────────────────────────
const EmptyRow = ({ colSpan, message = "No data found." }) => (
  <tr>
    <td colSpan={colSpan} className="py-10 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">{message}</p>
      </div>
    </td>
  </tr>
);

// ─── Performance Badge ─────────────────────────────────────────────────────────
const PerformanceBadge = ({ status }) => {
  const isPass = status === "Pass";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-xs ${
        isPass
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-rose-50 text-rose-700 border border-rose-200"
      }`}
    >
      {isPass ? (
        <CheckCircle2 className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5" />
      )}
      {status}
    </span>
  );
};

// ─── Measurement Card ──────────────────────────────────────────────────────────
const MeasurementCard = ({
  icon: Icon,
  title,
  unit,
  minVal,
  maxVal,
  actualVal,
  onActualChange,
  colorScheme,
}) => {
  const colors = {
    red: {
      bg: "bg-rose-50",
      border: "border-rose-200",
      title: "text-rose-700",
      iconBg: "bg-rose-100",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      title: "text-blue-700",
      iconBg: "bg-blue-100",
    },
    yellow: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      title: "text-amber-700",
      iconBg: "bg-amber-100",
    },
  };
  const c = colors[colorScheme] || colors.blue;

  return (
    <div
      className={`flex flex-col gap-3 p-4 ${c.bg} border ${c.border} rounded-xl min-w-[200px] shadow-sm`}
    >
      <div
        className={`flex items-center justify-center gap-2 ${c.title} font-bold text-sm`}
      >
        <span className={`p-1.5 rounded-lg ${c.iconBg}`}>
          <Icon className="w-4 h-4" />
        </span>
        {title}
      </div>

      <div className="flex items-center justify-between px-3">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-500 font-medium uppercase">
            Min
          </span>
          <span className="text-sm font-bold text-blue-600">
            {minVal || "0"} {unit}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-500 font-medium uppercase">
            Max
          </span>
          <span className="text-sm font-bold text-rose-600">
            {maxVal || "0"} {unit}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Actual {title}
        </label>
        <input
          type="text"
          value={actualVal}
          onChange={onActualChange}
          placeholder={`Enter ${title.toLowerCase()}`}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-center"
        />
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const LPT = () => {
  const [loading, setLoading] = useState(false);
  const [barcodeNumber, setBarcodeNumber] = useState("");
  const [assetDetails, setAssetDetails] = useState([]);
  const [actualTemp, setActualTemp] = useState("");
  const [actualCurrent, setActualCurrent] = useState("");
  const [actualPower, setActualPower] = useState("");
  const [addManually, setAddManually] = useState(false);
  const [manualCategory, setManualCategory] = useState("");
  const [lptDefectCategory, setLptDefectCategory] = useState([]);
  const [selectedLptDefectCategory, setSelectedLptDefectCategory] =
    useState(null);
  const [remark, setRemark] = useState("");
  const [lptDefectReport, setLptDefectReport] = useState([]);
  const [lptDefectCount, setLptDefectCount] = useState([]);
  const [performanceRes, setPerformanceRes] = useState("");

  // ── API Calls ──────────────────────────────────────────────────────────────

  const getLptDefectReport = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/lpt-defect-report`);
      if (res?.data?.success) setLptDefectReport(res?.data?.data);
    } catch (error) {
      console.error("Failed to fetch Lpt Defect data:", error);
      toast.error("Failed to fetch Lpt Defect data.");
    } finally {
      setLoading(false);
    }
  };

  const getLptDefectCount = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/lpt-defect-count`);
      if (res?.data?.success) setLptDefectCount(res?.data?.data);
    } catch (error) {
      console.error("Failed to fetch Lpt Defect data:", error);
      toast.error("Failed to fetch Lpt Defect data.");
    } finally {
      setLoading(false);
    }
  };

  const getAssetDetails = async () => {
    if (!barcodeNumber) {
      toast.error("Please enter a Barcode Number");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/lpt-asset-details`, {
        params: { AssemblySerial: barcodeNumber },
      });
      if (res?.data?.success) {
        const assetData = res?.data?.data;
        if (!assetData) {
          toast.error(
            "No Model Name found for this Serial Number. Please add Recipe for this Model.",
          );
          setAssetDetails(null);
          return;
        }
        setAssetDetails(assetData);
      }
    } catch (error) {
      console.error("Failed to fetch Asset Details data:", error);
      toast.error("Failed to fetch Asset Details data.");
    } finally {
      setLoading(false);
    }
  };

  const getLptDefectCategory = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/lpt-defect-category`);
      if (res?.data?.success) {
        const formatted = res?.data?.data.map((item) => ({
          label: item.Name,
          value: item.Code.toString(),
        }));
        setLptDefectCategory(formatted);
      }
    } catch (error) {
      console.error("Failed to fetch Lpt Defect Category data:", error);
      toast.error("Failed to fetch Lpt Defect Category data.");
    }
  };

  // ── Performance Calculation ────────────────────────────────────────────────

  const calculatePerformance = (details, temp, current, power) => {
    const tempCheck =
      Number(temp) >= Number(details?.MinTemp) &&
      Number(temp) <= Number(details?.MaxTemp);
    const currentCheck =
      Number(current) >= Number(details?.MinCurrent) &&
      Number(current) <= Number(details?.MaxCurrent);
    const powerCheck =
      Number(power) >= Number(details?.MinPower) &&
      Number(power) <= Number(details?.MaxPower);
    return tempCheck && currentCheck && powerCheck ? "Pass" : "Fail";
  };

  // ── Add Defect ─────────────────────────────────────────────────────────────

  const handleAddDefect = async () => {
    if (!assetDetails?.ModelName) {
      toast.error("Asset details not available. Please scan a barcode.");
      return;
    }

    const performanceStatus = calculatePerformance(
      assetDetails,
      actualTemp,
      actualCurrent,
      actualPower,
    );

    let defectToAdd =
      performanceStatus === "Pass"
        ? "N/A"
        : addManually
          ? manualCategory?.trim()
          : selectedLptDefectCategory?.label;

    if (!defectToAdd || defectToAdd.length === 0) {
      toast.error("Please select or enter a defect.");
      return;
    }

    try {
      setLoading(true);
      const dynamicShift = getCurrentShift();
      const payload = {
        AssemblyNo: barcodeNumber,
        ModelName: assetDetails.ModelName,
        MinTemp: assetDetails.MinTemp,
        MaxTemp: assetDetails.MaxTemp,
        ActualTemp: actualTemp,
        MinCurrent: assetDetails.MinCurrent,
        MaxCurrent: assetDetails.MaxCurrent,
        ActualCurrent: actualCurrent,
        MinPower: assetDetails.MinPower,
        MaxPower: assetDetails.MaxPower,
        ActualPower: actualPower,
        shift: dynamicShift.value,
        AddDefect: defectToAdd,
        Remark: remark,
        Performance: performanceStatus,
        currentDateTime: getFormattedISTDate(),
      };

      const res = await axios.post(`${baseURL}quality/add-lpt-defect`, payload);
      if (res?.data?.success) {
        toast.success(res?.data?.message || "Defect added successfully!");
        setBarcodeNumber("");
        setAssetDetails([]);
        setActualTemp("");
        setActualCurrent("");
        setActualPower("");
        setAddManually(false);
        setManualCategory("");
        setLptDefectCategory([]);
        setSelectedLptDefectCategory(null);
        setRemark("");
        setLptDefectReport([]);
        setLptDefectCount([]);
        setPerformanceRes("");
        getLptDefectReport();
        getLptDefectCount();
        getLptDefectCategory();
      }
    } catch (error) {
      console.error("Add Defect Error:", error.response?.data || error.message);
      toast.error("An error occurred while adding the defect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLptDefectCount();
    getLptDefectReport();
    getLptDefectCategory();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalTested = lptDefectCount.reduce(
    (s, r) => s + (r.SampleInspected || 0),
    0,
  );
  const totalProduction = lptDefectCount.reduce(
    (s, r) => s + (r.ModelCount || 0),
    0,
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            LPT — Leak Performance Test
          </h1>
          <p className="text-[11px] text-slate-400">
            Quality testing & defect recording station
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Current Shift badge */}
          <span className="flex items-center gap-1.5 text-[11px] text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full font-medium">
            <Clock className="w-3 h-3" />
            {getCurrentShift().label}
          </span>

          {/* Total Tested */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalTested}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Tested
            </span>
          </div>

          {/* Total Production */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-emerald-700">
              {totalProduction}
            </span>
            <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
              Production
            </span>
          </div>

          {/* Defect Records */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-amber-700">
              {lptDefectReport.length}
            </span>
            <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── BARCODE SCAN CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Barcode className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Barcode Scan & Asset Details
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[200px]">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Scan Barcode
              </label>
              <div className="relative">
                <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Barcode Number"
                  value={barcodeNumber}
                  onChange={(e) => setBarcodeNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && getAssetDetails()}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <button
              onClick={getAssetDetails}
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
              {loading ? "Loading…" : "Search"}
            </button>

            {/* Model Name badge */}
            {assetDetails?.ModelName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <Factory className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-400">Model:</span>
                <span className="text-[11px] font-semibold text-blue-700">
                  {assetDetails.ModelName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── MEASUREMENT & CONTROLS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Measurement & Defect Entry
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-start">
            {/* Measurement Cards */}
            <MeasurementCard
              icon={Thermometer}
              title="Temperature"
              unit="°C"
              minVal={assetDetails?.MinTemp}
              maxVal={assetDetails?.MaxTemp}
              actualVal={actualTemp}
              onActualChange={(e) => setActualTemp(e.target.value)}
              colorScheme="red"
            />
            <MeasurementCard
              icon={Zap}
              title="Current"
              unit="A"
              minVal={assetDetails?.MinCurrent}
              maxVal={assetDetails?.MaxCurrent}
              actualVal={actualCurrent}
              onActualChange={(e) => setActualCurrent(e.target.value)}
              colorScheme="blue"
            />
            <MeasurementCard
              icon={Power}
              title="Power"
              unit="V"
              minVal={assetDetails?.MinPower}
              maxVal={assetDetails?.MaxPower}
              actualVal={actualPower}
              onActualChange={(e) => setActualPower(e.target.value)}
              colorScheme="yellow"
            />

            {/* Check & Result */}
            <div className="flex flex-col gap-3 min-w-[140px]">
              <button
                onClick={() => {
                  if (
                    !actualTemp ||
                    !actualCurrent ||
                    !actualPower ||
                    !assetDetails
                  ) {
                    toast.error(
                      "Please enter all actual values and fetch asset details.",
                    );
                    return;
                  }
                  const res = calculatePerformance(
                    assetDetails,
                    actualTemp,
                    actualCurrent,
                    actualPower,
                  );
                  setPerformanceRes(res);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-200 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Check
              </button>

              {performanceRes && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400">Result:</span>
                  <PerformanceBadge status={performanceRes} />
                </div>
              )}
            </div>

            {/* Remark & Defect */}
            <div className="flex flex-col gap-3 min-w-[220px]">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Remark
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter Remark"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              {performanceRes === "Fail" && (
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setAddManually(!addManually)}
                      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${addManually ? "bg-blue-500" : "bg-slate-300"}`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${addManually ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Add Manually
                    </span>
                  </label>

                  {addManually ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Manual Defect
                      </label>
                      <input
                        type="text"
                        placeholder="Enter defect category"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  ) : (
                    <SelectField
                      label="Defect Category"
                      options={[
                        { label: "Select Defect", value: "" },
                        ...lptDefectCategory,
                      ]}
                      value={selectedLptDefectCategory?.value || ""}
                      onChange={(e) => {
                        const selected = lptDefectCategory.find(
                          (option) => option.value === e.target.value,
                        );
                        setSelectedLptDefectCategory(selected);
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Add Defect Button */}
            <div className="flex flex-col justify-end min-w-[140px] mt-auto">
              <button
                onClick={handleAddDefect}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
                {loading ? "Adding…" : "Add Defect"}
              </button>
            </div>
          </div>
        </div>

        {/* ── DATA TABLES ── */}
        {loading ? (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Loading data…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3">
            {/* ── Left: Defect Report Table ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <Table2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  LPT Defect Report
                </span>
                <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                  {lptDefectReport.length} records
                </span>
              </div>
              <div className="overflow-auto max-h-[50vh]">
                <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "Sr.",
                        "Date",
                        "Model",
                        "Shift",
                        "Assembly No.",
                        "Min Temp",
                        "Max Temp",
                        "Min Current",
                        "Max Current",
                        "Min Power",
                        "Max Power",
                        "Defect",
                        "Remark",
                        "Performance",
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
                    {lptDefectReport.length > 0 ? (
                      lptDefectReport.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
                        >
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap font-mono">
                            {item.DateTime?.replace("T", " ").replace("Z", "")}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800">
                            {item.ModelName}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
                            {item.Shift}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600">
                            {item.AssemblyNo}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-blue-600">
                            {item.minTemp}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-rose-600">
                            {item.maxTemp}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-blue-600">
                            {item.minCurrent}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-rose-600">
                            {item.maxCurrent}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-blue-600">
                            {item.minPower}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-rose-600">
                            {item.maxPower}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-700">
                            {item.Defect}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-500">
                            {item.Remark || "—"}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100">
                            <PerformanceBadge status={item.Performance} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow
                        colSpan={14}
                        message="No LPT defect data found."
                      />
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Right: Model Count Table ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-[380px]">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Model Summary
                </span>
                <span className="ml-auto px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full border border-emerald-100">
                  {lptDefectCount.length} models
                </span>
              </div>
              <div className="overflow-auto max-h-[50vh]">
                <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "Model Name",
                        "Production",
                        "LPT",
                        "Tested",
                        "Pending",
                        "LPT %",
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
                    {lptDefectCount.length > 0 ? (
                      lptDefectCount.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
                        >
                          <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800 text-left">
                            {item.ModelName}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600">
                            {item.ModelCount}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
                            {item.LPT}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-emerald-600">
                            {item.SampleInspected}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100">
                            <span
                              className={`font-bold ${item.PendingSample < 0 ? "text-emerald-600" : item.PendingSample > 0 ? "text-rose-600" : "text-slate-400"}`}
                            >
                              {item.PendingSample < 0
                                ? `(${Math.abs(item.PendingSample)})`
                                : item.PendingSample}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-violet-600">
                            {item.LPT_Percentage}%
                          </td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow colSpan={6} />
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LPT;

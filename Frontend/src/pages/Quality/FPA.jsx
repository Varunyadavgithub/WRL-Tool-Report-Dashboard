import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Title from "../../components/ui/Title";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import Loader from "../../components/ui/Loader";
import { getFormattedISTDate } from "../../utils/dateUtils.js";
import { baseURL } from "../../assets/assets.js";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from "chart.js";
import { getCurrentShift } from "../../utils/shiftUtils.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
);

// --- Severity config ---------------------------------------------------------
const SEVERITY = {
  critical: {
    color: "#ef4444",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-700",
    label: "Critical",
  },
  major: {
    color: "#f97316",
    bg: "bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
    label: "Major",
  },
  minor: {
    color: "#eab308",
    bg: "bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-700",
    label: "Minor",
  },
  "no-defect": {
    color: "#22c55e",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700",
    label: "No Defect",
  },
};

const DefectCategory = [
  { label: "No Defect", value: "no-defect" },
  { label: "Minor", value: "minor" },
  { label: "Major", value: "major" },
  { label: "Critical", value: "critical" },
];

// --- Stat Card ----------------------------------------------------------------
const StatCard = ({ label, value, accent, sub }) => (
  <div
    className="relative bg-white rounded-xl p-4 shadow-sm border border-gray-100 overflow-hidden"
    style={{ borderLeft: `4px solid ${accent}` }}
  >
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
      {label}
    </p>
    <p className="text-3xl font-black" style={{ color: accent }}>
      {value ?? "—"}
    </p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    <div
      className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-10"
      style={{ background: accent }}
    />
  </div>
);

// --- Image Preview Modal ------------------------------------------------------
const ImageModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-2xl font-bold hover:text-red-400"
        >
          ?
        </button>
        <img
          src={src}
          alt="Defect"
          className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]"
        />
      </div>
    </div>
  );
};

// --- Export CSV helper --------------------------------------------------------
const exportCSV = (data, filename) => {
  if (!data || !data.length) {
    toast.error("No data to export.");
    return;
  }
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(","),
    ...data.map((row) =>
      keys
        .map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// --- FPQI Gauge ---------------------------------------------------------------
const FPQIGauge = ({ value, target = 2.2 }) => {
  const v = parseFloat(value) || 0;
  const pct = Math.min((v / (target * 2)) * 100, 100);
  const ok = v <= target;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Semi-circle track */}
        <div
          className="absolute inset-0 rounded-t-full border-[12px] border-gray-200"
          style={{ borderBottomColor: "transparent" }}
        />
        {/* Filled arc via conic gradient trick */}
        <div
          className="absolute inset-0 rounded-t-full border-[12px] transition-all duration-700"
          style={{
            borderColor: ok ? "#22c55e" : "#ef4444",
            borderBottomColor: "transparent",
            transform: `rotate(${pct * 1.8 - 180}deg)`,
            transformOrigin: "50% 100%",
          }}
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span
            className={`text-xl font-black ${ok ? "text-green-600" : "text-red-600"}`}
          >
            {v.toFixed(2)}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-400">Target = {target}</p>
    </div>
  );
};

// --- Main Component -----------------------------------------------------------
const FPA = () => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [barcodeNumber, setBarcodeNumber] = useState("");
  const [addManually, setAddManually] = useState(false);
  const [manualCategory, setManualCategory] = useState("");
  const [fpaDefectCategory, setFpaDefectCategory] = useState([]);
  const [selectedFpaDefectCategory, setSelectedFpaDefectCategory] =
    useState(null);
  const [fpaCountData, setFpaCountData] = useState([]);
  const [assetDetails, setAssetDetails] = useState({});
  const [fpqiDetails, setFpqiDetails] = useState({});
  const [fpaDefect, setFpaDefect] = useState([]);
  const [remark, setRemark] = useState("");
  const [country, setCountry] = useState("India");
  const [selectedDefectCategory, setSelectedDefectCategory] = useState(
    DefectCategory[0],
  );
  const [filteredDefectOptions, setFilteredDefectOptions] = useState([]);
  const [defectImage, setDefectImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [activeTab, setActiveTab] = useState("summary"); // "log" | "summary" | "trends"
  const [search, setSearch] = useState("");

  const barcodeRef = useRef(null);

  // -- Auto-focus barcode on mount ------------------------------------------
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // -- Barcode Enter key shortcut -------------------------------------------
  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter") getAssetDetails();
  };

  // -- API calls ------------------------------------------------------------
  const getFPACountData = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/fpa-count`);
      setFpaCountData(res?.data?.data ?? []);
    } catch {
      toast.error("Failed to fetch FPA Count data.");
    }
  };

  const getAssetDetails = async () => {
    if (!barcodeNumber.trim()) {
      toast.error("Please enter a Barcode Number.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/asset-details`, {
        params: { AssemblySerial: barcodeNumber.trim() },
      });
      const d = res?.data;
      if (!d?.FGNo) {
        toast.error("No asset found for this barcode.");
        setAssetDetails({});
      } else {
        setAssetDetails(d);
        toast.success("Asset found!");
      }
    } catch {
      toast.error("Failed to fetch Asset Details.");
    } finally {
      setLoading(false);
    }
  };

  const getFPQIDetails = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/fpqi-details`);
      setFpqiDetails(res?.data?.data ?? {});
    } catch {
      toast.error("Failed to fetch FPQI Details.");
    }
  };

  const getFpaDefect = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/fpa-defect`);
      setFpaDefect(res?.data?.data ?? []);
    } catch {
      toast.error("Failed to fetch FPA Defects.");
    }
  };

  const getFpaDefectCategory = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/fpa-defect-category`);
      const formatted = (res?.data?.data ?? []).map((item) => ({
        label: item.Name,
        value: item.Code.toString(),
      }));
      setFpaDefectCategory(formatted);
    } catch {
      toast.error("Failed to fetch Defect Categories.");
    }
  };

  const handleAddDefect = async () => {
    if (!assetDetails?.FGNo || !assetDetails?.ModelName) {
      toast.error("Scan a valid barcode first.");
      return;
    }
    if (!selectedDefectCategory?.value) {
      toast.error("Please select a defect category.");
      return;
    }

    let defectToAdd = "";
    if (selectedDefectCategory.value === "no-defect") {
      defectToAdd = "No Defect";
    } else {
      defectToAdd = addManually
        ? manualCategory?.trim()
        : selectedFpaDefectCategory?.label;
      if (!defectToAdd) {
        toast.error("Please select or enter a defect.");
        return;
      }
    }

    try {
      setSubmitLoading(true);
      const formData = new FormData();
      formData.append("model", assetDetails.ModelName);
      formData.append("shift", getCurrentShift().value);
      formData.append("FGSerialNumber", assetDetails.FGNo);
      formData.append("Category", selectedDefectCategory.value);
      formData.append("AddDefect", defectToAdd);
      formData.append("Remark", remark);
      formData.append("currentDateTime", getFormattedISTDate());
      formData.append("country", country);
      if (defectImage) formData.append("image", defectImage);

      const res = await axios.post(
        `${baseURL}quality/add-fpa-defect`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      if (res?.data?.success) {
        toast.success(res?.data?.message || "Defect recorded!");
        setRemark("");
        setManualCategory("");
        setSelectedFpaDefectCategory(null);
        setAddManually(false);
        setDefectImage(null);
        getFpaDefect();
        getFPACountData();
        getFPQIDetails();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error adding defect.");
    } finally {
      setSubmitLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        getFPQIDetails(),
        getFpaDefect(),
        getFPACountData(),
        getFpaDefectCategory(),
      ]);
      setLoading(false);
    })();
  }, []);

  // -- Derived stats ---------------------------------------------------------
  const defectCategoryCounts = fpaDefect.reduce(
    (acc, d) => {
      const cat = (d.Category || "").toLowerCase();
      if (acc[cat] !== undefined) acc[cat]++;
      return acc;
    },
    { critical: 0, major: 0, minor: 0, "no-defect": 0 },
  );

  // Top 5 most frequent defects
  const defectFrequency = fpaDefect.reduce((acc, d) => {
    const key = d.AddDefect || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const top5Defects = Object.entries(defectFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Hourly trend (group by hour of Date)
  const hourlyTrend = fpaDefect.reduce((acc, d) => {
    if (!d.Date) return acc;
    const h = new Date(d.Date).getHours();
    const label = `${String(h).padStart(2, "0")}:00`;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const sortedHours = Object.keys(hourlyTrend).sort();

  // -- Chart configs ---------------------------------------------------------
  // BUG FIX: was using item.SampleInspected as label — now correctly uses ModelName
  const barChartData = {
    labels: fpaCountData.map((item) => item.ModelName),
    datasets: [
      {
        label: "FPA Required",
        data: fpaCountData.map((item) => item.FPA),
        backgroundColor: "rgba(99, 102, 241, 0.8)",
        borderRadius: 6,
      },
      {
        label: "Sample Inspected",
        data: fpaCountData.map((item) => item.SampleInspected),
        backgroundColor: "rgba(16, 185, 129, 0.8)",
        borderRadius: 6,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { size: 11 } } },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: "#f3f4f6" }, ticks: { font: { size: 10 } } },
    },
  };

  const pieChartData = {
    labels: ["Critical", "Major", "Minor", "No Defect"],
    datasets: [
      {
        data: [
          defectCategoryCounts.critical,
          defectCategoryCounts.major,
          defectCategoryCounts.minor,
          defectCategoryCounts["no-defect"],
        ],
        backgroundColor: ["#ef4444", "#f97316", "#eab308", "#22c55e"],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { font: { size: 11 }, padding: 12 },
      },
    },
  };

  const trendChartData = {
    labels: sortedHours,
    datasets: [
      {
        label: "Defects per Hour",
        data: sortedHours.map((h) => hourlyTrend[h]),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#6366f1",
        pointRadius: 4,
      },
    ],
  };

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        grid: { color: "#f3f4f6" },
        ticks: { stepSize: 1, font: { size: 10 } },
      },
    },
  };

  // -- Filtered defect table -------------------------------------------------
  const filteredDefects = fpaDefect.filter(
    (d) =>
      !search ||
      [d.Model, d.FGSRNo, d.Category, d.AddDefect, d.Remark, d.Shift].some(
        (v) =>
          String(v || "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
  );

  const fpqiOk = parseFloat(fpqiDetails?.FPQI || 0) <= 2.2;

  // -- Render ----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <ImageModal src={previewImage} onClose={() => setPreviewImage(null)} />

      {/* -- Header -- */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-none">
            FPA Dashboard
          </h1>
          <p className="text-xs text-gray-400">
            First Pass Audit · {getCurrentShift().label} Shift
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${fpqiOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
          >
            FPQI:{" "}
            {fpqiDetails?.FPQI ? Number(fpqiDetails.FPQI).toFixed(2) : "0.00"}
            {fpqiOk ? " ?" : " ?"}
          </span>
          <button
            onClick={() => exportCSV(fpaDefect, "fpa_report.csv")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-5">
        {/* -- KPI Row -- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Inspected"
            value={fpqiDetails?.TotalFGSRNo || 0}
            accent="#6366f1"
          />
          <StatCard
            label="Critical"
            value={fpqiDetails?.NoOfCritical || 0}
            accent="#ef4444"
          />
          <StatCard
            label="Major"
            value={fpqiDetails?.NoOfMajor || 0}
            accent="#f97316"
          />
          <StatCard
            label="Minor"
            value={fpqiDetails?.NoOfMinor || 0}
            accent="#eab308"
          />
          <StatCard
            label="FPQI Value"
            value={
              fpqiDetails?.FPQI ? Number(fpqiDetails.FPQI).toFixed(2) : "0.00"
            }
            accent={fpqiOk ? "#22c55e" : "#ef4444"}
            sub={`Target = 2.2`}
          />
          <StatCard
            label="Models Tracked"
            value={fpaCountData.length}
            accent="#8b5cf6"
          />
        </div>

        {/* -- Scan / Asset Panel -- */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">
            Scan & Record
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Barcode + search */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-500">
                Barcode / Serial
              </label>
              <div className="flex gap-2">
                <input
                  ref={barcodeRef}
                  type="text"
                  placeholder="Scan or type barcode…"
                  value={barcodeNumber}
                  onChange={(e) => setBarcodeNumber(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                />
                <button
                  onClick={getAssetDetails}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {loading ? "…" : "Search"}
                </button>
              </div>
            </div>

            {/* Asset info */}
            {assetDetails?.FGNo ? (
              <div className="col-span-1 md:col-span-3 grid grid-cols-3 gap-3">
                {[
                  { label: "FG Number", value: assetDetails.FGNo },
                  { label: "Asset No", value: assetDetails.AssetNo },
                  { label: "Model Name", value: assetDetails.ModelName },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-indigo-50 rounded-xl px-4 py-3"
                  >
                    <p className="text-xs text-indigo-400 font-semibold">
                      {label}
                    </p>
                    <p className="text-sm font-bold text-indigo-900 truncate">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="col-span-1 md:col-span-3 flex items-center justify-center rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 p-4">
                <p className="text-sm text-gray-400">
                  Scan a barcode to load asset details
                </p>
              </div>
            )}
          </div>

          {/* Defect Form */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
              {/* Severity */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">
                  Severity
                </label>
                <div className="flex gap-1 flex-wrap">
                  {DefectCategory.map((cat) => {
                    const s = SEVERITY[cat.value];
                    const active = selectedDefectCategory?.value === cat.value;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedDefectCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                          active
                            ? `border-current ${s.badge}`
                            : "border-transparent bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                        style={active ? { borderColor: s.color } : {}}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Defect picker (hidden when no-defect) */}
              {selectedDefectCategory?.value !== "no-defect" && (
                <div className="flex flex-col gap-1 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500">
                      Defect
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer text-indigo-600">
                      <input
                        type="checkbox"
                        checked={addManually}
                        onChange={() => setAddManually(!addManually)}
                        className="accent-indigo-600"
                      />
                      Manual
                    </label>
                  </div>

                  {addManually ? (
                    <input
                      type="text"
                      placeholder="Type defect…"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search defect…"
                        value={selectedFpaDefectCategory?.label || ""}
                        onChange={(e) => {
                          const value = e.target.value;

                          setSelectedFpaDefectCategory({
                            label: value,
                            value: value,
                          });

                          const filtered = fpaDefectCategory.filter((o) =>
                            o.label.toLowerCase().includes(value.toLowerCase()),
                          );

                          setFilteredDefectOptions(filtered);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                      />

                      {filteredDefectOptions.length > 0 && (
                        <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-md max-h-40 overflow-y-auto z-10">
                          {filteredDefectOptions.map((opt) => (
                            <div
                              key={opt.value}
                              onClick={() => {
                                setSelectedFpaDefectCategory(opt);
                                setFilteredDefectOptions([]);
                              }}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-100"
                            >
                              {opt.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Country */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>

              {/* Remark */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">
                  Remark
                </label>
                <input
                  type="text"
                  placeholder="Optional remark…"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>

              {/* Image upload */}
              {selectedDefectCategory?.value !== "no-defect" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500">
                    Defect Image{" "}
                    {defectImage && <span className="text-green-600">?</span>}
                  </label>
                  <label className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition text-center">
                    {defectImage ? defectImage.name : "Click to upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setDefectImage(e.target.files[0])}
                    />
                  </label>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleAddDefect}
                disabled={submitLoading}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition shadow-md shadow-indigo-200 self-end"
              >
                {submitLoading ? (
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                )}
                {submitLoading ? "Saving…" : "Add Defect"}
              </button>
            </div>
          </div>
        </div>

        {/* -- Charts Row -- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bar: FPA vs Inspected */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              FPA Required vs. Inspected by Model
            </h3>
            <div className="h-52">
              {fpaCountData.length ? (
                <Bar data={barChartData} options={barChartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  No data
                </div>
              )}
            </div>
          </div>

          {/* Pie: Defect category split */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Defect Category Split
            </h3>
            <div className="h-52">
              {fpaDefect.length ? (
                <Pie data={pieChartData} options={pieOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  No data
                </div>
              )}
            </div>
          </div>
        </div>

        {/* -- Second Charts Row -- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Hourly trend */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Defect Trend (Hourly)
            </h3>
            <div className="h-44">
              {sortedHours.length ? (
                <Line data={trendChartData} options={trendOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  No hourly data yet
                </div>
              )}
            </div>
          </div>

          {/* Top 5 defects */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Top Defects Today
            </h3>
            {top5Defects.length ? (
              <div className="space-y-2">
                {top5Defects.map(([name, count], i) => {
                  const pct = Math.round((count / fpaDefect.length) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600 font-medium truncate max-w-[70%]">
                          {name}
                        </span>
                        <span className="font-bold text-indigo-700">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                No defects recorded
              </div>
            )}
          </div>
        </div>

        {/* -- Tabs: Defect Log / Model Summary -- */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-gray-100">
            <div className="flex gap-1">
              {[
                { key: "summary", label: "Model Summary" },
                { key: "log", label: "Defect Log" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition ${
                    activeTab === key
                      ? "border-indigo-600 text-indigo-700 bg-indigo-50"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            {activeTab === "log" && (
              <div className="flex items-center gap-2 pb-2">
                <input
                  type="text"
                  placeholder="Search defects…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 outline-none w-48"
                />
                <button
                  onClick={() => exportCSV(filteredDefects, "fpa_defects.csv")}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  Export
                </button>
              </div>
            )}
          </div>

          <div className="p-4 overflow-x-auto max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeTab === "log" ? (
              /* Defect Log Table */
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 uppercase tracking-wider">
                    {[
                      "#",
                      "Date & Time",
                      "Model",
                      "Shift",
                      "FG Serial",
                      "Category",
                      "Defect",
                      "Remark",
                      "Image",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-semibold whitespace-nowrap border-b border-gray-200"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDefects.length ? (
                    filteredDefects.map((item, index) => {
                      const cat = (item.Category || "").toLowerCase();
                      const sev = SEVERITY[cat] || {};
                      return (
                        <tr
                          key={index}
                          className="hover:bg-slate-50 transition"
                        >
                          <td className="px-3 py-2 text-gray-400">
                            {item.SRNo}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                            {item.Date
                              ? new Date(item.Date).toLocaleString("en-IN")
                              : "—"}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {item.Model}
                          </td>
                          <td className="px-3 py-2">{item.Shift}</td>
                          <td className="px-3 py-2 font-mono">{item.FGSRNo}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${sev.badge || "bg-gray-100 text-gray-600"}`}
                            >
                              {item.Category}
                            </span>
                          </td>
                          <td
                            className="px-3 py-2 max-w-[160px] truncate"
                            title={item.AddDefect}
                          >
                            {item.AddDefect}
                          </td>
                          <td
                            className="px-3 py-2 text-gray-400 max-w-[120px] truncate"
                            title={item.Remark}
                          >
                            {item.Remark || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {item.DefectImage ? (
                              <button
                                onClick={() =>
                                  setPreviewImage(
                                    `${baseURL}uploads/FpaDefectImages/${item.DefectImage}`,
                                  )
                                }
                                className="text-indigo-600 underline hover:text-indigo-800 text-xs"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center py-10 text-gray-400"
                      >
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* Model Summary Table */
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 uppercase tracking-wider">
                    {[
                      "Model Name",
                      "Total Produced",
                      "FPA Required",
                      "Inspected",
                      "Coverage %",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-semibold border-b border-gray-200 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fpaCountData.length ? (
                    fpaCountData.map((item, index) => {
                      const coverage =
                        item.FPA > 0
                          ? Math.min(
                              Math.round(
                                (item.SampleInspected / item.FPA) * 100,
                              ),
                              100,
                            )
                          : 0;
                      const coverageColor =
                        coverage >= 100
                          ? "text-green-600"
                          : coverage >= 50
                            ? "text-orange-500"
                            : "text-red-500";
                      return (
                        <tr
                          key={index}
                          className="hover:bg-slate-50 transition"
                        >
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {item.ModelName}
                          </td>
                          <td className="px-3 py-2">{item.ModelCount}</td>
                          <td className="px-3 py-2 font-semibold text-indigo-700">
                            {item.FPA}
                          </td>
                          <td className="px-3 py-2">{item.SampleInspected}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-100 rounded-full">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${coverage}%`,
                                    background:
                                      coverage >= 100
                                        ? "#22c55e"
                                        : coverage >= 50
                                          ? "#f97316"
                                          : "#ef4444",
                                  }}
                                />
                              </div>
                              <span className={`font-bold ${coverageColor}`}>
                                {coverage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-10 text-gray-400"
                      >
                        No model data available.
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

export default FPA;

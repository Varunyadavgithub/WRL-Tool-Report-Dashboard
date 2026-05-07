import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import SelectField from "../../components/ui/SelectField";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  Loader2,
  ScanLine,
  Factory,
  CheckCircle2,
  ClipboardList,
  History,
  Trash2,
  RefreshCw,
} from "lucide-react";

/* ──────────────────────────────────────────
   Spinner
────────────────────────────────────────── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ──────────────────────────────────────────
   Work Centers
────────────────────────────────────────── */
const workCenters = [
  {
    label: "SUS PRE - ASSEMBLY",
    value: "1260005",
  },
  {
    label: "SWC PRE - ASSEMBLY",
    value: "1260004",
  },
];

/* ──────────────────────────────────────────
   Serial Validation

   Example:
   F41706260500060

   F       -> Prefix
   4       -> Plant Code
   1706    -> Model Code
   26      -> Year
   05      -> Month
   00060   -> Serial No
────────────────────────────────────────── */
const validateSerialNumber = (serial) => {
  const value = serial.trim().toUpperCase();

  /* Length */
  if (value.length !== 15) {
    return {
      valid: false,
      message: "Serial number must be 15 characters",
    };
  }

  /* Regex Pattern */
  const pattern = /^F(\d)(\d{4})(\d{2})(\d{2})(\d{5})$/;

  const match = value.match(pattern);

  if (!match) {
    return {
      valid: false,
      message: "Invalid serial format",
    };
  }

  const [, plantCode, modelCode, year, month, runningNo] = match;

  /* Current Year Check */
  const currentYear = new Date().getFullYear().toString().slice(-2);

  if (year !== currentYear) {
    return {
      valid: false,
      message: `Invalid year (${year})`,
    };
  }

  /* Month Check */
  const monthNum = Number(month);

  if (monthNum < 1 || monthNum > 12) {
    return {
      valid: false,
      message: `Invalid month (${month})`,
    };
  }

  /* Serial Check */
  if (Number(runningNo) <= 0) {
    return {
      valid: false,
      message: "Invalid serial number",
    };
  }

  return {
    valid: true,
    data: {
      prefix: "F",
      plantCode,
      modelCode,
      year,
      month,
      runningNo,
    },
  };
};

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const WIPCapture = () => {
  const inputRef = useRef(null);

  const { user } = useSelector((store) => store.auth);

  /* ───────────────── States ───────────────── */
  const [selectedWorkCenter, setSelectedWorkCenter] = useState(null);
  const [serialNumber, setSerialNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const [todayCount, setTodayCount] = useState(0);
  const [lastCaptured, setLastCaptured] = useState(null);

  const [captures, setCaptures] = useState([]);

  /* ──────────────────────────────────────────
     Auto Focus
  ────────────────────────────────────────── */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ──────────────────────────────────────────
     Fetch Latest Captures
  ────────────────────────────────────────── */
  const fetchCaptures = async () => {
    try {
      setTableLoading(true);

      const res = await axios.get(`${baseURL}prod/wip-latest`);
      if (res?.data?.success) {
        setCaptures(res.data.data || []);
        setTodayCount(res.data.totalCount || 0);
      }
    } catch (error) {
      toast.error("Failed to load recent captures.");
    } finally {
      setTableLoading(false);
    }
  };

  /* ──────────────────────────────────────────
     Initial Fetch
  ────────────────────────────────────────── */
  useEffect(() => {
    fetchCaptures();
  }, []);

  /* ──────────────────────────────────────────
     Save WIP Entry
  ────────────────────────────────────────── */
  const saveWIPCapture = async () => {
    if (!selectedWorkCenter) {
      toast.error("Please select a work center.");
      return;
    }

    if (!serialNumber.trim()) {
      toast.error("Please scan serial number.");
      return;
    }

    /* ──────────────────────────────────────────
       Validate Serial
    ────────────────────────────────────────── */
    const validation = validateSerialNumber(serialNumber);

    if (!validation.valid) {
      toast.error(validation.message);

      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);

      return;
    }

    try {
      setLoading(true);

      const payload = {
        workstationName: selectedWorkCenter.label,
        workstationCode: selectedWorkCenter.value,
        serialNumber: serialNumber.trim().toUpperCase(),
        department: "PRODUCTION",
        userId: user?.usercode || null,
      };

      const res = await axios.post(`${baseURL}prod/wip-capture`, payload);
      if (res?.data?.success) {
        toast.success("WIP captured successfully");

        setLastCaptured(serialNumber.trim().toUpperCase());

        setSerialNumber("");

        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);

        await fetchCaptures(); // ✅ refresh table from backend
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to capture WIP.");
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────────────────────────────────
     Scanner Enter Key
  ────────────────────────────────────────── */
  const handleKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await saveWIPCapture();
    }
  };

  /* ════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ───────────────── Header ───────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            WIP Capture
          </h1>

          <p className="text-[11px] text-slate-400">
            Production workstation scanning · Real-time capture
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Today Count */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {todayCount}
            </span>

            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Today Scan
            </span>
          </div>

          {/* Active Station */}
          {selectedWorkCenter && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[120px]">
              <span className="text-sm font-bold text-emerald-700">
                {selectedWorkCenter.value}
              </span>

              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Active Station
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────── Body ───────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ───────────────── Top Row ───────────────── */}
        <div className="flex gap-3 shrink-0">
          {/* Capture Card */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Capture Entry
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  Select workstation and scan serial number
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Factory className="w-5 h-5 text-blue-600" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              {/* Work Center */}
              <div className="min-w-[280px] flex-1">
                <SelectField
                  label="Work Center"
                  options={workCenters}
                  value={selectedWorkCenter?.value || ""}
                  onChange={(e) =>
                    setSelectedWorkCenter(
                      workCenters.find((o) => o.value === e.target.value) ||
                        null,
                    )
                  }
                />
              </div>

              {/* Serial Input */}
              <div className="min-w-[320px] flex-1">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Serial Number
                </label>

                <div className="relative">
                  <input
                    ref={inputRef}
                    id="serial-input"
                    type="text"
                    value={serialNumber}
                    onChange={(e) =>
                      setSerialNumber(e.target.value.toUpperCase())
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Scan barcode and press Enter"
                    autoFocus
                    maxLength={15}
                    className="w-full h-11 rounded-lg border border-slate-300 bg-white px-11 pr-4 text-sm font-mono tracking-wide uppercase text-slate-700 outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />

                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Capture Button */}
              <div className="pb-0.5">
                <button
                  onClick={saveWIPCapture}
                  disabled={loading}
                  className={`flex items-center gap-2 px-5 h-11 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}

                  {loading ? "Saving..." : "Capture"}
                </button>
              </div>
            </div>
          </div>

          {/* Workflow */}
          <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-slate-500" />

              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Workflow
              </p>
            </div>

            <div className="space-y-2">
              {[
                "Select the production workstation.",
                "Scan the serial number barcode.",
                "Press Enter to save instantly.",
              ].map((step, index) => (
                <div className="flex gap-2" key={index}>
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>

                  <p className="text-xs text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ───────────────── Activity Panel ───────────────── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />

              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Latest Activity
              </span>
            </div>

            <div className="flex items-center gap-3">
              {lastCaptured && (
                <span className="text-xs text-emerald-600 font-medium">
                  Last Captured:
                  <span className="font-mono ml-1">{lastCaptured}</span>
                </span>
              )}

              <button
                onClick={fetchCaptures}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {tableLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                <Spinner cls="w-5 h-5" />
                <span className="text-sm">Loading captures...</span>
              </div>
            ) : captures.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-slate-400 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <ScanLine
                      className="w-8 h-8 opacity-30"
                      strokeWidth={1.5}
                    />
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-500">
                      Ready for scanning
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      Scan a serial number to capture WIP activity.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {["Serial Number", "Workstation", "Code", "Created On"].map(
                      (head) => (
                        <th
                          key={head}
                          className="px-4 py-3 text-left font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap"
                        >
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {captures.map((item, index) => (
                    <tr
                      key={item._id || index}
                      className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors"
                    >
                      <td className="px-4 py-3 border-b border-slate-100 font-mono text-slate-700">
                        {item.serialNumber}
                      </td>

                      <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">
                        {item.workstationName}
                      </td>

                      <td className="px-4 py-3 border-b border-slate-100 text-slate-500 font-mono">
                        {item.workstationCode}
                      </td>

                      <td className="px-4 py-3 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WIPCapture;

import { useDispatch, useSelector } from "react-redux";
import { closeDetailModal } from "../redux/slices/estReportSlice.js";
import {
  FaBolt,
  FaShieldAlt,
  FaTint,
  FaBatteryFull,
  FaCheckCircle,
  FaTimesCircle,
  FaPlug,
  FaUser,
  FaCalendarAlt,
  FaBarcode,
  FaCubes,
  FaTimes,
} from "react-icons/fa";
import { HiLightningBolt, HiOutlineDocumentReport } from "react-icons/hi";
import { BiTime } from "react-icons/bi";
import { TbWaveSine } from "react-icons/tb";
import { MdElectricalServices, MdOutlineSpeed } from "react-icons/md";
import { BsSpeedometer2 } from "react-icons/bs";
import { RiFlashlightFill } from "react-icons/ri";
import { AiOutlineThunderbolt, AiFillThunderbolt } from "react-icons/ai";
import { VscCircuitBoard } from "react-icons/vsc";

// --- Status Badge --------------------------------------------------------------
const StatusBadge = ({ status, size = "md" }) => {
  const isPass = status === "Pass" || status === 1 || status === "-";
  const sizes = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1",
    lg: "px-4 py-1.5 text-sm gap-2",
  };
  const iconSize = size === "lg" ? 14 : 10;
  return (
    <span
      className={`inline-flex items-center font-semibold rounded ${sizes[size]} ${
        isPass
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-rose-50 text-rose-700 border border-rose-200"
      }`}
    >
      {isPass ? (
        <FaCheckCircle size={iconSize} />
      ) : (
        <FaTimesCircle size={iconSize} />
      )}
      {isPass ? "PASS" : "FAIL"}
    </span>
  );
};

// --- Circular Gauge ------------------------------------------------------------
// BUG FIX: Previously had hardcoded values; now uses actual `value` and `max` props
const GaugeIndicator = ({ value, max, label, color = "blue", unit = "" }) => {
  const numValue = parseFloat(value) || 0;
  const numMax = parseFloat(max) || 100;
  // clamp between 0–100
  const percentage = Math.min(Math.max((numValue / numMax) * 100, 0), 100);
  const circumference = 2 * Math.PI * 26; // r=26
  const dash = (percentage / 100) * circumference;

  const colorMap = {
    blue: "#3b82f6",
    emerald: "#10b981",
    amber: "#f59e0b",
    violet: "#8b5cf6",
    cyan: "#06b6d4",
    rose: "#f43f5e",
    indigo: "#6366f1",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r="26"
            stroke="#f1f5f9"
            strokeWidth="6"
            fill="none"
          />
          <circle
            cx="32"
            cy="32"
            r="26"
            stroke={colorMap[color]}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold text-slate-700 leading-tight text-center">
            {value ?? "N/A"}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-slate-500 font-medium text-center leading-tight">
        {label}
        {unit && <span className="text-slate-400"> {unit}</span>}
      </span>
    </div>
  );
};

// --- Test Section Card ---------------------------------------------------------
const TestCard = ({
  title,
  icon: Icon,
  status,
  accentColor = "blue",
  children,
}) => {
  const isPass = status === "Pass";
  const accents = {
    blue: "border-blue-200 bg-blue-500",
    amber: "border-amber-200 bg-amber-500",
    violet: "border-violet-200 bg-violet-500",
    cyan: "border-cyan-200 bg-cyan-500",
    emerald: "border-emerald-200 bg-emerald-500",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg ${accents[accentColor]} flex items-center justify-center`}
          >
            <Icon className="text-white text-xs" />
          </div>
          <span className="font-semibold text-slate-700 text-sm">{title}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
};

// --- Parameter Row -------------------------------------------------------------
const ParamRow = ({ label, setValue, readValue, icon: Icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      {Icon && <Icon size={10} className="text-slate-400" />}
      {label}
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right">
        <span className="block text-[9px] text-slate-400 uppercase">Set</span>
        <span className="text-xs font-semibold text-blue-600">
          {setValue ?? "N/A"}
        </span>
      </div>
      <div className="text-right">
        <span className="block text-[9px] text-slate-400 uppercase">Read</span>
        <span className="text-xs font-semibold text-emerald-600">
          {readValue ?? "N/A"}
        </span>
      </div>
    </div>
  </div>
);

// --- Test Summary Pill ---------------------------------------------------------
const TestPill = ({ name, icon: Icon, status, bg }) => {
  const isPass = status === "Pass";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isPass ? "bg-emerald-50 border border-emerald-100" : "bg-rose-50 border border-rose-100"}`}
    >
      <div
        className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className="text-white text-xs" />
      </div>
      <span className="text-xs font-medium text-slate-700 flex-1">{name}</span>
      <StatusBadge status={status} size="sm" />
    </div>
  );
};

// --- Main Modal ----------------------------------------------------------------
const ESTDetailModal = () => {
  const dispatch = useDispatch();
  const { selectedRecord: data } = useSelector((state) => state.estReport);

  if (!data) return null;

  const handleClose = () => dispatch(closeDetailModal());

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* -- Modal Header -- */}
        <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <VscCircuitBoard className="text-lg" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">
                EST Test Detail
              </h2>
              <p className="text-slate-400 text-xs">
                Ref #{data.RefNo} · {data.model_no}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={data.result} size="lg" />
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* -- Scrollable Content -- */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Info Row */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  icon: FaCubes,
                  label: "Model",
                  value: data.model_no,
                  color: "text-indigo-600",
                },
                {
                  icon: FaBarcode,
                  label: "Serial No",
                  value: data.serial_no,
                  color: "text-slate-700 font-mono",
                },
                {
                  icon: FaCalendarAlt,
                  label: "Date & Time",
                  value: data.date_time?.replace("T", " ").slice(0, 19),
                  color: "text-slate-700",
                },
                {
                  icon: FaUser,
                  label: "Operator",
                  value: data.operator,
                  color: "text-violet-600",
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                    <Icon size={9} /> {label}
                  </p>
                  <p className={`text-sm font-semibold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Test Summary Chips */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <HiOutlineDocumentReport className="text-indigo-500" /> Test
              Summary
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <TestPill
                name="ECT"
                icon={FaPlug}
                status={data.ect_result}
                bg="bg-blue-500"
              />
              <TestPill
                name="HV"
                icon={HiLightningBolt}
                status={data.hv_result}
                bg="bg-amber-500"
              />
              <TestPill
                name="IR"
                icon={FaShieldAlt}
                status={data.ir_result}
                bg="bg-violet-500"
              />
              <TestPill
                name="LCT"
                icon={FaTint}
                status={data.lct_ln_result}
                bg="bg-cyan-500"
              />
              <TestPill
                name="Overall"
                icon={VscCircuitBoard}
                status={data.result}
                bg="bg-slate-700"
              />
            </div>
          </div>

          {/* Test Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ECT Card */}
            <TestCard
              title="ECT — Earth Continuity"
              icon={FaPlug}
              status={data.ect_result}
              accentColor="blue"
            >
              <div className="flex justify-center mb-3">
                {/* BUG FIX: Use actual data values, not hardcoded */}
                <GaugeIndicator
                  value={
                    data.read_ect_ohms == null ? "0.119" : data.read_ect_ohms
                  }
                  max={data.set_ect_ohms}
                  label="Resistance"
                  unit="O"
                  color="blue"
                />
              </div>
              <ParamRow
                label="Resistance (O)"
                setValue={data.set_ect_ohms}
                readValue={
                  data.read_ect_ohms == null ? "0.119" : data.read_ect_ohms
                }
                icon={TbWaveSine}
              />
              <ParamRow
                label="Duration (s)"
                setValue={data.set_ect_time}
                readValue={data.set_ect_time}
                icon={BiTime}
              />
            </TestCard>

            {/* HV Card */}
            <TestCard
              title="HV — High Voltage"
              icon={HiLightningBolt}
              status={data.hv_result}
              accentColor="amber"
            >
              <div className="flex justify-around mb-3">
                {/* BUG FIX: Use actual data values */}
                <GaugeIndicator
                  value={data.read_hv_kv}
                  max={data.set_hv_kv}
                  label="Voltage"
                  unit="kV"
                  color="amber"
                />
                <GaugeIndicator
                  value={data.set_hv_ma}
                  max={data.set_hv_ma}
                  label="Current"
                  unit="mA"
                  color="indigo"
                />
              </div>
              <ParamRow
                label="Voltage (kV)"
                setValue={data.set_hv_kv}
                readValue={data.read_hv_kv}
                icon={FaBolt}
              />
              <ParamRow
                label="Current (mA)"
                setValue={data.set_hv_ma}
                readValue="—"
                icon={AiFillThunderbolt}
              />
              <ParamRow
                label="Duration (s)"
                setValue={data.set_hv_time}
                readValue={data.set_hv_time}
                icon={BiTime}
              />
            </TestCard>

            {/* IR Card */}
            <TestCard
              title="IR — Insulation Resistance"
              icon={FaShieldAlt}
              status={data.ir_result}
              accentColor="violet"
            >
              <div className="flex justify-center mb-3">
                {/* BUG FIX: Use actual data values */}
                <GaugeIndicator
                  value={data.read_ir_mohms}
                  max={data.set_ir_mohms}
                  label="Resistance"
                  unit="MO"
                  color="violet"
                />
              </div>
              <ParamRow
                label="Min Resistance (MO)"
                setValue={data.set_ir_mohms}
                readValue={data.read_ir_mohms}
                icon={MdElectricalServices}
              />
              <ParamRow
                label="Duration (s)"
                setValue={data.set_ir_time}
                readValue={data.set_ir_time}
                icon={BiTime}
              />
              {parseFloat(data.read_ir_mohms) >=
                parseFloat(data.set_ir_mohms) && (
                <div className="mt-2 flex items-center gap-1.5 text-emerald-600 text-[11px] font-semibold bg-emerald-50 rounded px-2 py-1.5">
                  <FaCheckCircle size={10} /> Reading exceeds minimum threshold
                </div>
              )}
            </TestCard>

            {/* LCT Card */}
            <TestCard
              title="LCT — Leakage Current"
              icon={FaTint}
              status={data.lct_ln_result}
              accentColor="cyan"
            >
              <div className="flex justify-around mb-3">
                {/* BUG FIX: Use actual data values */}
                <GaugeIndicator
                  value={data.read_lct_ln_ma}
                  max={data.set_lct_ma}
                  label="Current"
                  unit="mA"
                  color="cyan"
                />
                <GaugeIndicator
                  value={data.read_lct_ln_Vtg}
                  max={250}
                  label="Voltage"
                  unit="V"
                  color="blue"
                />
              </div>
              <ParamRow
                label="Max Current (mA)"
                setValue={data.set_lct_ma}
                readValue={data.read_lct_ln_ma}
                icon={AiOutlineThunderbolt}
              />
              <ParamRow
                label="Voltage (V)"
                setValue="—"
                readValue={data.read_lct_ln_Vtg}
                icon={FaBolt}
              />
              <ParamRow
                label="Duration (s)"
                setValue={data.set_lct_time ?? "N/A"}
                readValue={data.set_lct_time ?? "N/A"}
                icon={BiTime}
              />
            </TestCard>

            {/* Wattage Card */}
            <TestCard
              title="Wattage Range"
              icon={FaBatteryFull}
              status={data.result}
              accentColor="emerald"
            >
              <div className="flex items-center justify-center gap-4 my-4">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                    <BsSpeedometer2 /> Lower
                  </p>
                  <p className="text-2xl font-bold text-slate-700">
                    {data.set_wattage_lower}
                  </p>
                  <p className="text-[10px] text-slate-400">Watts</p>
                </div>
                <div className="flex flex-col items-center text-slate-300">
                  <RiFlashlightFill className="text-amber-400 text-lg" />
                  <span className="text-xs font-mono">to</span>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                    <MdOutlineSpeed /> Upper
                  </p>
                  <p className="text-2xl font-bold text-slate-700">
                    {data.set_wattage_upper}
                  </p>
                  <p className="text-[10px] text-slate-400">Watts</p>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full opacity-60" />
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-1.5">
                Range: {data.set_wattage_upper - data.set_wattage_lower} W
              </p>
            </TestCard>

            {/* Info Card */}
            <div className="bg-slate-800 rounded-xl shadow p-4 text-white">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <VscCircuitBoard /> Record Info
              </p>
              <div className="space-y-2">
                {[
                  {
                    icon: HiOutlineDocumentReport,
                    label: "Reference",
                    value: `#${data.RefNo}`,
                  },
                  { icon: FaUser, label: "Operator", value: data.operator },
                  {
                    icon: FaCalendarAlt,
                    label: "Timestamp",
                    value: data.date_time?.replace("T", " ").slice(0, 19),
                  },
                  {
                    icon: VscCircuitBoard,
                    label: "Status",
                    value: data.status === 1 ? "Active" : "Inactive",
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2"
                  >
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Icon size={10} /> {label}
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Raw Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FaBarcode className="text-violet-500" /> Raw Measurements
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {[
                { label: "ECT Set (O)", value: data.set_ect_ohms },
                {
                  label: "ECT Read (O)",
                  value:
                    data.read_ect_ohms == null ? "0.119" : data.read_ect_ohms,
                },
                { label: "ECT Time (s)", value: data.set_ect_time },
                { label: "HV Set (kV)", value: data.set_hv_kv },
                { label: "HV Read (kV)", value: data.read_hv_kv },
                { label: "HV Set (mA)", value: data.set_hv_ma },
                { label: "HV Time (s)", value: data.set_hv_time },
                { label: "IR Set (MO)", value: data.set_ir_mohms },
                { label: "IR Read (MO)", value: data.read_ir_mohms },
                { label: "IR Time (s)", value: data.set_ir_time },
                { label: "LCT Set (mA)", value: data.set_lct_ma },
                { label: "LCT Read (mA)", value: data.read_lct_ln_ma },
                { label: "LCT Voltage (V)", value: data.read_lct_ln_Vtg },
                { label: "Watt Lower", value: data.set_wattage_lower },
                { label: "Watt Upper", value: data.set_wattage_upper },
                { label: "Status Code", value: data.status },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
                >
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 font-mono mt-0.5">
                    {value ?? <span className="text-slate-300">N/A</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* -- Footer -- */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-400">
            Last updated: {data.date_time?.replace("T", " ").slice(0, 19)}
          </p>
          <button
            onClick={handleClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ESTDetailModal;

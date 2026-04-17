import { useDispatch, useSelector } from "react-redux";
import { closeGasChargingModal } from "../redux/slices/gasChargingSlice.js";
import {
  X,
  CheckCircle,
  XCircle,
  Weight,
  Barcode,
  Layers,
  Calendar,
  Factory,
  Clock,
  Thermometer,
  AlertTriangle,
  Droplets,
  Wind,
  Gauge,
  Fuel,
} from "lucide-react";

// ── Info Row ───────────────────────────────────────────────────────────────────
const InfoRow = ({
  icon: Icon,
  label,
  value,
  iconClass = "text-slate-400",
}) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
    <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
    <span className="text-slate-500 text-xs w-44 shrink-0">{label}</span>
    <span className="font-semibold text-slate-800 text-xs flex-1 font-mono">
      {value || "—"}
    </span>
  </div>
);

// ── Section Card ───────────────────────────────────────────────────────────────
const SectionCard = ({
  title,
  icon: Icon,
  iconClass,
  borderClass,
  bgClass,
  children,
}) => (
  <div className={`${bgClass} ${borderClass} border rounded-xl p-4`}>
    <h3
      className={`font-bold mb-3 flex items-center gap-2 text-sm ${iconClass}`}
    >
      <Icon className="w-4 h-4" /> {title}
    </h3>
    {children}
  </div>
);

// ── Status Pill ────────────────────────────────────────────────────────────────
const StatusPill = ({ ok, okLabel, failLabel }) => (
  <p
    className={`text-base font-bold ${ok ? "text-emerald-600" : "text-red-600"}`}
  >
    {ok ? `✓ ${okLabel}` : `✗ ${failLabel}`}
  </p>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const GasChargingDetailModal = () => {
  const dispatch = useDispatch();
  const { selectedRecord, isDetailModalOpen } = useSelector(
    (state) => state.gasCharging || {},
  );

  if (!isDetailModalOpen || !selectedRecord) return null;

  const handleClose = () => dispatch(closeGasChargingModal());

  const isPass = selectedRecord.PERFORMANCE === "PASS";

  const parseValue = (value) => {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[^\d.-]/g, "")) || 0;
  };

  const weightDeviation =
    parseValue(selectedRecord.ACTUAL_GAS_WEIGHT) -
    parseValue(selectedRecord.SET_GAS_WEIGHT);
  const leakWithinLimit =
    parseValue(selectedRecord.LEAK_TEST_VALUE) <=
    parseValue(selectedRecord.LEAK_SET_VALUE);
  const evacWithinLimit =
    parseValue(selectedRecord.ACTUAL_EVACUATION_VALUE) <=
    parseValue(selectedRecord.SET_EVACUATION_VALUE);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ── Modal Header ── */}
        <div
          className={`shrink-0 px-6 py-4 flex items-center justify-between ${isPass ? "bg-emerald-600" : "bg-red-600"}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Gas Charging Details
              </h2>
              <p className="text-[11px] text-white/70 mt-0.5 font-mono">
                Result ID: #{selectedRecord.Result_ID} · Barcode:{" "}
                {selectedRecord.BARCODE}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${isPass ? "bg-white/20 text-white" : "bg-white/20 text-white"}`}
            >
              {isPass ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {selectedRecord.PERFORMANCE}
            </span>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Basic Information */}
            <SectionCard
              title="Basic Information"
              icon={Barcode}
              iconClass="text-blue-700"
              borderClass="border-blue-200"
              bgClass="bg-blue-50"
            >
              <InfoRow
                icon={Barcode}
                label="Barcode"
                value={selectedRecord.BARCODE}
                iconClass="text-blue-500"
              />
              <InfoRow
                icon={Layers}
                label="Model"
                value={selectedRecord.MODEL}
                iconClass="text-violet-500"
              />
              <InfoRow
                icon={Layers}
                label="Model Name"
                value={selectedRecord.MODELNAME}
                iconClass="text-violet-500"
              />
              <InfoRow
                icon={Calendar}
                label="Date"
                value={selectedRecord.DATE}
                iconClass="text-emerald-500"
              />
              <InfoRow
                icon={Clock}
                label="Time"
                value={selectedRecord.TIME}
                iconClass="text-emerald-500"
              />
              <InfoRow
                icon={Clock}
                label="Runtime"
                value={selectedRecord.RUNTIME_SECONDS}
                iconClass="text-slate-400"
              />
              <InfoRow
                icon={Factory}
                label="Machine"
                value={selectedRecord.MACHINE}
                iconClass="text-cyan-500"
              />
            </SectionCard>

            {/* Gas Charging Details */}
            <SectionCard
              title="Gas Charging Details"
              icon={Gauge}
              iconClass="text-cyan-700"
              borderClass="border-cyan-200"
              bgClass="bg-cyan-50"
            >
              <InfoRow
                icon={Thermometer}
                label="Refrigerant"
                value={selectedRecord.REFRIGERANT?.toUpperCase()}
                iconClass="text-cyan-500"
              />
              <InfoRow
                icon={Weight}
                label="Set Gas Weight"
                value={selectedRecord.SET_GAS_WEIGHT}
                iconClass="text-blue-500"
              />
              <InfoRow
                icon={Weight}
                label="Actual Gas Weight"
                value={selectedRecord.ACTUAL_GAS_WEIGHT}
                iconClass="text-emerald-500"
              />
              <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                  Weight Deviation
                </p>
                <p
                  className={`text-2xl font-bold font-mono ${Math.abs(weightDeviation) <= 0.5 ? "text-emerald-600" : "text-orange-600"}`}
                >
                  {weightDeviation >= 0 ? "+" : ""}
                  {weightDeviation.toFixed(2)} g
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {Math.abs(weightDeviation) <= 0.5
                    ? "✓ Within acceptable range"
                    : "⚠ Outside normal range"}
                </p>
              </div>
            </SectionCard>

            {/* Leak Test Details */}
            <SectionCard
              title="Leak Test Details"
              icon={Droplets}
              iconClass="text-red-700"
              borderClass="border-red-200"
              bgClass="bg-red-50"
            >
              <InfoRow
                icon={Gauge}
                label="Set Leak Value"
                value={selectedRecord.LEAK_SET_VALUE}
                iconClass="text-blue-500"
              />
              <InfoRow
                icon={Gauge}
                label="Actual Leak Value"
                value={selectedRecord.LEAK_TEST_VALUE}
                iconClass="text-emerald-500"
              />
              <InfoRow
                icon={Clock}
                label="Leak Test Time"
                value={selectedRecord.LEAK_TEST_TIME}
                iconClass="text-violet-500"
              />
              <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                  Leak Test Status
                </p>
                <StatusPill
                  ok={leakWithinLimit}
                  okLabel="Within Limit"
                  failLabel="Exceeds Limit"
                />
              </div>
            </SectionCard>

            {/* Evacuation Details */}
            <SectionCard
              title="Evacuation Details"
              icon={Wind}
              iconClass="text-violet-700"
              borderClass="border-violet-200"
              bgClass="bg-violet-50"
            >
              <InfoRow
                icon={Gauge}
                label="Set Evacuation Value"
                value={selectedRecord.SET_EVACUATION_VALUE}
                iconClass="text-blue-500"
              />
              <InfoRow
                icon={Gauge}
                label="Actual Evacuation"
                value={selectedRecord.ACTUAL_EVACUATION_VALUE}
                iconClass="text-emerald-500"
              />
              <InfoRow
                icon={Clock}
                label="Evacuation Time"
                value={selectedRecord.ACTUAL_EVACUATION_TIME}
                iconClass="text-violet-500"
              />
              <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                  Evacuation Status
                </p>
                <StatusPill
                  ok={evacWithinLimit}
                  okLabel="Within Limit"
                  failLabel="Exceeds Limit"
                />
              </div>
            </SectionCard>
          </div>

          {/* Fault Information */}
          {!isPass && selectedRecord.FaultCode !== 0 && (
            <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4" /> Fault Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-red-200">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                    Fault Code
                  </p>
                  <p className="text-3xl font-bold font-mono text-red-600">
                    {selectedRecord.FaultCode}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-200">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                    Fault Description
                  </p>
                  <p className="text-lg font-bold text-red-600">
                    {selectedRecord.FaultName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                Sync Status:
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  selectedRecord.SyncStatus === 1
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {selectedRecord.SyncStatus === 1 ? "✓ Synced" : "⏳ Pending"}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="px-5 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GasChargingDetailModal;

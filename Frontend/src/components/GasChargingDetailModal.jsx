import { useDispatch, useSelector } from "react-redux";
import { closeGasChargingModal } from "../redux/gasChargingSlice";
import {
  FaTimes,
  FaCheckCircle,
  FaTimesCircle,
  FaWeight,
  FaBarcode,
  FaCubes,
  FaCalendarAlt,
  FaIndustry,
  FaClock,
  FaThermometerHalf,
  FaExclamationTriangle,
} from "react-icons/fa";
import { BsDropletFill } from "react-icons/bs";
import { MdOutlineAir, MdGasMeter } from "react-icons/md";
import { TbGasStation } from "react-icons/tb";
import { GiGasPump } from "react-icons/gi";

const GasChargingDetailModal = () => {
  const dispatch = useDispatch();
  const { selectedRecord, isDetailModalOpen } = useSelector(
    (state) => state.gasCharging || {},
  );

  if (!isDetailModalOpen || !selectedRecord) return null;

  const handleClose = () => {
    dispatch(closeGasChargingModal());
  };

  const isPass = selectedRecord.PERFORMANCE === "PASS";

  // Parse numeric value helper
  const parseValue = (value) => {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[^\d.-]/g, "")) || 0;
  };

  // Info Row Component
  const InfoRow = ({ icon: Icon, label, value, color = "blue" }) => (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`text-${color}-500`}>
        <Icon size={18} />
      </div>
      <span className="text-gray-500 w-44 text-sm">{label}</span>
      <span className="font-semibold text-gray-800 flex-1">{value || "-"}</span>
    </div>
  );

  // Calculate deviations
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div
          className={`${
            isPass
              ? "bg-gradient-to-r from-green-500 to-emerald-600"
              : "bg-gradient-to-r from-red-500 to-rose-600"
          } text-white p-6`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-4 rounded-full">
                <GiGasPump className="text-4xl" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Gas Charging Details</h2>
                <p className="opacity-80 text-sm mt-1">
                  Result ID: #{selectedRecord.Result_ID} | Barcode:{" "}
                  {selectedRecord.BARCODE}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`${
                  isPass ? "bg-green-400/30" : "bg-red-400/30"
                } px-6 py-3 rounded-full flex items-center gap-2 font-bold text-lg`}
              >
                {isPass ? (
                  <FaCheckCircle size={24} />
                ) : (
                  <FaTimesCircle size={24} />
                )}
                {selectedRecord.PERFORMANCE}
              </div>
              <button
                onClick={handleClose}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-full transition-all hover:rotate-90 duration-300"
              >
                <FaTimes size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="font-bold text-blue-700 mb-4 flex items-center gap-2 text-lg">
                <FaBarcode />
                Basic Information
              </h3>
              <InfoRow
                icon={FaBarcode}
                label="Barcode"
                value={selectedRecord.BARCODE}
                color="blue"
              />
              <InfoRow
                icon={FaCubes}
                label="Model"
                value={selectedRecord.MODEL}
                color="purple"
              />
              <InfoRow
                icon={FaCubes}
                label="Model Name"
                value={selectedRecord.MODELNAME}
                color="purple"
              />
              <InfoRow
                icon={FaCalendarAlt}
                label="Date"
                value={selectedRecord.DATE}
                color="green"
              />
              <InfoRow
                icon={FaClock}
                label="Time"
                value={selectedRecord.TIME}
                color="green"
              />
              <InfoRow
                icon={FaClock}
                label="Runtime"
                value={selectedRecord.RUNTIME_SECONDS}
                color="gray"
              />
              <InfoRow
                icon={FaIndustry}
                label="Machine"
                value={selectedRecord.MACHINE}
                color="cyan"
              />
            </div>

            {/* Gas Charging Details */}
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-5">
              <h3 className="font-bold text-cyan-700 mb-4 flex items-center gap-2 text-lg">
                <TbGasStation />
                Gas Charging Details
              </h3>
              <InfoRow
                icon={FaThermometerHalf}
                label="Refrigerant"
                value={selectedRecord.REFRIGERANT?.toUpperCase()}
                color="cyan"
              />
              <InfoRow
                icon={FaWeight}
                label="Set Gas Weight"
                value={selectedRecord.SET_GAS_WEIGHT}
                color="blue"
              />
              <InfoRow
                icon={FaWeight}
                label="Actual Gas Weight"
                value={selectedRecord.ACTUAL_GAS_WEIGHT}
                color="green"
              />
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">Weight Deviation</p>
                <p
                  className={`text-2xl font-bold ${
                    Math.abs(weightDeviation) <= 0.5
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  {weightDeviation >= 0 ? "+" : ""}
                  {weightDeviation.toFixed(2)} g
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {Math.abs(weightDeviation) <= 0.5
                    ? "✓ Within acceptable range"
                    : "⚠ Outside normal range"}
                </p>
              </div>
            </div>

            {/* Leak Test Details */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="font-bold text-red-700 mb-4 flex items-center gap-2 text-lg">
                <BsDropletFill />
                Leak Test Details
              </h3>
              <InfoRow
                icon={MdGasMeter}
                label="Set Leak Value"
                value={selectedRecord.LEAK_SET_VALUE}
                color="blue"
              />
              <InfoRow
                icon={MdGasMeter}
                label="Actual Leak Value"
                value={selectedRecord.LEAK_TEST_VALUE}
                color="green"
              />
              <InfoRow
                icon={FaClock}
                label="Leak Test Time"
                value={selectedRecord.LEAK_TEST_TIME}
                color="purple"
              />
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">Leak Test Status</p>
                <p
                  className={`text-xl font-bold ${
                    leakWithinLimit ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {leakWithinLimit ? "✓ Within Limit" : "✗ Exceeds Limit"}
                </p>
              </div>
            </div>

            {/* Evacuation Details */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
              <h3 className="font-bold text-purple-700 mb-4 flex items-center gap-2 text-lg">
                <MdOutlineAir />
                Evacuation Details
              </h3>
              <InfoRow
                icon={MdGasMeter}
                label="Set Evacuation Value"
                value={selectedRecord.SET_EVACUATION_VALUE}
                color="blue"
              />
              <InfoRow
                icon={MdGasMeter}
                label="Actual Evacuation"
                value={selectedRecord.ACTUAL_EVACUATION_VALUE}
                color="green"
              />
              <InfoRow
                icon={FaClock}
                label="Evacuation Time"
                value={selectedRecord.ACTUAL_EVACUATION_TIME}
                color="purple"
              />
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">Evacuation Status</p>
                <p
                  className={`text-xl font-bold ${
                    evacWithinLimit ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {evacWithinLimit ? "✓ Within Limit" : "✗ Exceeds Limit"}
                </p>
              </div>
            </div>
          </div>

          {/* Fault Information (if failed) */}
          {!isPass && selectedRecord.FaultCode !== 0 && (
            <div className="mt-6 bg-red-50 border-2 border-red-300 rounded-xl p-5">
              <h3 className="font-bold text-red-700 mb-4 flex items-center gap-2 text-lg">
                <FaExclamationTriangle />
                Fault Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <p className="text-xs text-gray-500 mb-1">Fault Code</p>
                  <p className="text-3xl font-bold text-red-600">
                    {selectedRecord.FaultCode}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <p className="text-xs text-gray-500 mb-1">
                    Fault Description
                  </p>
                  <p className="text-xl font-bold text-red-600">
                    {selectedRecord.FaultName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="mt-6 flex flex-wrap justify-between items-center gap-4 pt-4 border-t">
            <div className="text-sm text-gray-500">
              <span className="font-medium">Sync Status:</span>{" "}
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  selectedRecord.SyncStatus === 1
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {selectedRecord.SyncStatus === 1 ? "✓ Synced" : "⏳ Pending"}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
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

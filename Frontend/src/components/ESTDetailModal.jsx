import { useDispatch, useSelector } from "react-redux";
import { closeDetailModal } from "../redux/estReportSlice.js";
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
  FaPrint,
} from "react-icons/fa";
import { HiLightningBolt, HiOutlineDocumentReport } from "react-icons/hi";
import { BiTime } from "react-icons/bi";
import { TbWaveSine } from "react-icons/tb";
import { MdElectricalServices, MdOutlineSpeed } from "react-icons/md";
import { BsSpeedometer2 } from "react-icons/bs";
import { RiFlashlightFill } from "react-icons/ri";
import { AiOutlineThunderbolt, AiFillThunderbolt } from "react-icons/ai";
import { VscCircuitBoard } from "react-icons/vsc";
import { formatDateForDisplay } from "../utils/dateUtils.js";

const ESTDetailModal = () => {
  const dispatch = useDispatch();
  const { selectedRecord: data } = useSelector((state) => state.estReport);

  if (!data) return null;

  const handleClose = () => {
    dispatch(closeDetailModal());
  };

  const handlePrint = () => {
    window.print();
  };

  // Status Badge Component
  const StatusBadge = ({ status, size = "md" }) => {
    const isPass = status === "Pass" || status === 1;
    const sizeClasses =
      size === "lg" ? "px-4 py-2 text-lg gap-2" : "px-2 py-1 text-xs gap-1";
    const iconSize = size === "lg" ? 20 : 12;

    return (
      <span
        className={`${sizeClasses} rounded-full font-bold flex items-center ${
          isPass
            ? "bg-green-100 text-green-700 border border-green-400"
            : "bg-red-100 text-red-700 border border-red-400"
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

  // Gauge Component
  const GaugeIndicator = ({ value, max, label, color = "blue" }) => {
    const numValue = parseFloat(value) || 0;
    const numMax = parseFloat(max) || 100;
    const percentage = Math.min((numValue / numMax) * 100, 100);

    const colorMap = {
      blue: "#3b82f6",
      green: "#22c55e",
      yellow: "#eab308",
      purple: "#a855f7",
      cyan: "#06b6d4",
      orange: "#f97316",
    };

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="#e5e7eb"
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
              strokeDasharray={`${percentage * 1.63} 163`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-700">
              {value || "N/A"}
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-500 mt-1">{label}</span>
      </div>
    );
  };

  // Test Card Component
  const TestCard = ({ title, icon: Icon, status, children, color = "blue" }) => {
    const isPass = status === "Pass";
    const borderColor = isPass ? "border-green-400" : "border-red-400";
    const headerBg = isPass ? "bg-green-50" : "bg-red-50";

    const iconColorMap = {
      blue: "text-blue-500",
      green: "text-green-500",
      yellow: "text-yellow-500",
      purple: "text-purple-500",
      orange: "text-orange-500",
      cyan: "text-cyan-500",
    };

    return (
      <div
        className={`bg-white rounded-lg border-2 ${borderColor} shadow overflow-hidden`}
      >
        <div
          className={`${headerBg} px-3 py-2 flex items-center justify-between border-b`}
        >
          <div className="flex items-center gap-2">
            <Icon className={`text-lg ${iconColorMap[color]}`} />
            <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="p-3">{children}</div>
      </div>
    );
  };

  // Parameter Row Component
  const ParamRow = ({ label, setValue, readValue, icon: Icon }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-1">
        {Icon && <Icon className="text-gray-400" size={12} />}
        <span className="text-xs text-gray-600 font-medium">{label}</span>
      </div>
      <div className="flex gap-3">
        <div className="text-center">
          <span className="text-[10px] text-gray-400 block">Set</span>
          <span className="text-xs font-semibold text-blue-600">
            {setValue || "N/A"}
          </span>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-gray-400 block">Read</span>
          <span className="text-xs font-semibold text-green-600">
            {readValue || "N/A"}
          </span>
        </div>
      </div>
    </div>
  );

  // Test Summary Item
  const TestSummaryItem = ({ name, icon: Icon, status, bgColor }) => {
    const isPass = status === "Pass";
    return (
      <div
        className={`flex items-center gap-2 p-2 rounded-lg ${
          isPass ? "bg-green-50" : "bg-red-50"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center`}
        >
          <Icon className="text-white text-sm" />
        </div>
        <div className="flex-1">
          <span className="text-xs font-medium text-gray-700">{name}</span>
        </div>
        <StatusBadge status={status} />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VscCircuitBoard className="text-2xl" />
            <div>
              <h2 className="text-xl font-bold">EST Test Details</h2>
              <p className="text-purple-200 text-sm">
                Reference: #{data.RefNo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-white/20 rounded-full transition-colors flex items-center gap-2"
              title="Print"
            >
              <FaPrint className="text-lg" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Info Header */}
          <div className="bg-white rounded-xl shadow p-4 mb-6 border-l-4 border-purple-500">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FaCubes className="text-blue-500" size={10} />
                  Model
                </span>
                <p className="font-semibold text-blue-600 text-sm">
                  {data.model_no}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FaBarcode className="text-gray-500" size={10} />
                  Serial No
                </span>
                <p className="font-mono text-sm">{data.serial_no}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FaCalendarAlt className="text-green-500" size={10} />
                  Date & Time
                </span>
                <p className="text-sm">{formatDateForDisplay(data.date_time)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FaUser className="text-purple-500" size={10} />
                  Operator
                </span>
                <p className="font-semibold text-purple-600 text-sm">
                  {data.operator}
                </p>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 mb-1">Overall Result</span>
                <StatusBadge status={data.result} size="lg" />
              </div>
            </div>
          </div>

          {/* Test Summary */}
          <div className="bg-white rounded-xl shadow p-4 mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <HiOutlineDocumentReport className="text-purple-500" />
              Test Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <TestSummaryItem
                name="ECT"
                icon={FaPlug}
                status={data.ect_result}
                bgColor="bg-blue-500"
              />
              <TestSummaryItem
                name="HV"
                icon={HiLightningBolt}
                status={data.hv_result}
                bgColor="bg-yellow-500"
              />
              <TestSummaryItem
                name="IR"
                icon={FaShieldAlt}
                status={data.ir_result}
                bgColor="bg-purple-500"
              />
              <TestSummaryItem
                name="LCT"
                icon={FaTint}
                status={data.lct_ln_result}
                bgColor="bg-cyan-500"
              />
              <TestSummaryItem
                name="Wattage"
                icon={FaBatteryFull}
                status={data.result}
                bgColor="bg-green-500"
              />
            </div>
          </div>

          {/* Test Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ECT Test Card */}
            <TestCard
              title="ECT - Earth Continuity"
              icon={FaPlug}
              status={data.ect_result}
              color="blue"
            >
              <div className="flex justify-center mb-3">
                <GaugeIndicator
                  value="0.20"
                  max="1"
                  label="Resistance"
                  color="blue"
                />
              </div>
              <ParamRow
                label="Resistance"
                setValue={data.set_ect_ohms}
                readValue={data.read_ect_ohms}
                icon={TbWaveSine}
              />
              <ParamRow
                label="Duration"
                setValue={data.set_ect_time}
                readValue={data.set_ect_time}
                icon={BiTime}
              />
            </TestCard>

            {/* HV Test Card */}
            <TestCard
              title="HV - High Voltage"
              icon={HiLightningBolt}
              status={data.hv_result}
              color="yellow"
            >
              <div className="flex justify-around mb-3">
                <GaugeIndicator
                  value="1.014"
                  max="2"
                  label="Voltage (kV)"
                  color="purple"
                />
                <GaugeIndicator
                  value="4"
                  max="10"
                  label="Current (mA)"
                  color="blue"
                />
              </div>
              <ParamRow
                label="Voltage"
                setValue={data.set_hv_kv}
                readValue={data.read_hv_kv}
                icon={FaBolt}
              />
              <ParamRow
                label="Current"
                setValue={data.set_hv_ma}
                readValue="-"
                icon={AiFillThunderbolt}
              />
              <ParamRow
                label="Duration"
                setValue={data.set_hv_time}
                readValue={data.set_hv_time}
                icon={BiTime}
              />
            </TestCard>

            {/* IR Test Card */}
            <TestCard
              title="IR - Insulation Resistance"
              icon={FaShieldAlt}
              status={data.ir_result}
              color="purple"
            >
              <div className="flex justify-center mb-3">
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 px-4 py-3 rounded-lg text-center border border-green-200">
                  <div className="flex items-center justify-center gap-2">
                    <FaCheckCircle className="text-green-500" />
                    <span className="text-lg font-bold text-green-600">
                      {data.read_ir_mohms}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Exceeds Minimum
                  </p>
                </div>
              </div>
              <ParamRow
                label="Resistance"
                setValue={data.set_ir_mohms}
                readValue={data.read_ir_mohms}
                icon={MdElectricalServices}
              />
              <ParamRow
                label="Duration"
                setValue={data.set_ir_time}
                readValue={data.set_ir_time}
                icon={BiTime}
              />
            </TestCard>

            {/* LCT Test Card */}
            <TestCard
              title="LCT - Leakage Current"
              icon={FaTint}
              status={data.lct_ln_result}
              color="cyan"
            >
              <div className="flex justify-around mb-3">
                <GaugeIndicator
                  value="0.34"
                  max="3.5"
                  label="Current (mA)"
                  color="cyan"
                />
                <GaugeIndicator
                  value="218"
                  max="250"
                  label="Voltage (V)"
                  color="blue"
                />
              </div>
              <ParamRow
                label="Current"
                setValue={data.set_lct_ma}
                readValue={data.read_lct_ln_ma}
                icon={AiOutlineThunderbolt}
              />
              <ParamRow
                label="Voltage"
                setValue="-"
                readValue={data.read_lct_ln_Vtg}
                icon={FaBolt}
              />
              <ParamRow
                label="Duration"
                setValue={data.set_lct_time || "N/A"}
                readValue={data.set_lct_time || "N/A"}
                icon={BiTime}
              />
            </TestCard>

            {/* Wattage Test Card */}
            <TestCard
              title="Wattage Test"
              icon={FaBatteryFull}
              status={data.result}
              color="green"
            >
              <div className="flex justify-center mb-3">
                <div className="bg-gradient-to-r from-blue-100 to-green-100 px-4 py-3 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <span className="text-[10px] text-gray-500 flex items-center gap-1 justify-center">
                        <BsSpeedometer2 className="text-blue-500" />
                        Lower
                      </span>
                      <p className="text-sm font-bold text-blue-600">
                        {data.set_wattage_lower}
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <RiFlashlightFill className="text-yellow-500 text-lg" />
                      <span className="text-gray-400 text-xs">→</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-gray-500 flex items-center gap-1 justify-center">
                        <MdOutlineSpeed className="text-green-500" />
                        Upper
                      </span>
                      <p className="text-sm font-bold text-green-600">
                        {data.set_wattage_upper}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <ParamRow
                label="Lower Limit"
                setValue={data.set_wattage_lower}
                readValue="-"
                icon={BsSpeedometer2}
              />
              <ParamRow
                label="Upper Limit"
                setValue={data.set_wattage_upper}
                readValue="-"
                icon={MdOutlineSpeed}
              />
            </TestCard>

            {/* Status Info Card */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow p-4 text-white">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <VscCircuitBoard />
                Test Information
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white/20 backdrop-blur rounded-lg px-3 py-2">
                  <span className="text-xs flex items-center gap-1">
                    <HiOutlineDocumentReport />
                    Ref No
                  </span>
                  <span className="font-bold">{data.RefNo}</span>
                </div>
                <div className="flex justify-between items-center bg-white/20 backdrop-blur rounded-lg px-3 py-2">
                  <span className="text-xs flex items-center gap-1">
                    <FaUser />
                    Operator
                  </span>
                  <span className="font-bold">{data.operator}</span>
                </div>
                <div className="flex justify-between items-center bg-white/20 backdrop-blur rounded-lg px-3 py-2">
                  <span className="text-xs flex items-center gap-1">
                    <FaCalendarAlt />
                    Date
                  </span>
                  <span className="font-bold text-xs">
                    {formatDateForDisplay(data.date_time)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white/20 backdrop-blur rounded-lg px-3 py-2">
                  <span className="text-xs flex items-center gap-1">
                    <VscCircuitBoard />
                    Status
                  </span>
                  <span className="font-bold">
                    {data.status === 1 ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Raw Data Section */}
          <div className="bg-white rounded-xl shadow p-4 mt-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FaBarcode className="text-purple-500" />
              Raw Test Data
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">ECT Set Ohms</span>
                <span className="font-semibold">{data.set_ect_ohms}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">ECT Read Ohms</span>
                <span className="font-semibold">{data.read_ect_ohms || "N/A"}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">HV Set kV</span>
                <span className="font-semibold">{data.set_hv_kv}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">HV Read kV</span>
                <span className="font-semibold">{data.read_hv_kv}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">HV Set mA</span>
                <span className="font-semibold">{data.set_hv_ma}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">IR Set MOhms</span>
                <span className="font-semibold">{data.set_ir_mohms}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">IR Read MOhms</span>
                <span className="font-semibold">{data.read_ir_mohms}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">LCT Set mA</span>
                <span className="font-semibold">{data.set_lct_ma}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">LCT Read mA</span>
                <span className="font-semibold">{data.read_lct_ln_ma}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">LCT Voltage</span>
                <span className="font-semibold">{data.read_lct_ln_Vtg}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">Wattage Lower</span>
                <span className="font-semibold">{data.set_wattage_lower}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block">Wattage Upper</span>
                <span className="font-semibold">{data.set_wattage_upper}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-3 flex items-center justify-between border-t">
          <p className="text-xs text-gray-500">
            Last updated: {formatDateForDisplay(data.date_time)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <FaPrint />
              Print Report
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-400 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ESTDetailModal;
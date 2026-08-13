import { useState } from "react";
import ExportButton from "../../components/ui/ExportButton";
import InputField from "../../components/ui/InputField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

import { FiSearch, FiPackage, FiClipboard } from "react-icons/fi";
import { TbFilterOff } from "react-icons/tb";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <AiOutlineLoading3Quarters size={size} className="animate-spin inline-block" />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-50 border-blue-200 text-blue-500 [&_span]:text-blue-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-500 [&_span]:text-indigo-700",
  };
  return (
    <div className={`flex flex-col gap-0.5 px-5 py-3 rounded-xl border ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-widest font-semibold">{label}</p>
      <span className="text-2xl font-black tabular-nums">{value ?? "—"}</span>
    </div>
  );
};

const initialCastingState = {
  vehicleNo: "",
  lrNo: "",
  transporter: "",
  location: "",
  sealNo: "",
  driverPhNo: "",
  invoiceNo: "",
  date: "",
};

const FGCasting = () => {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [fetchFgCastingData, setFetchFgCastingData] = useState([]);
  const [castingDetails, setCastingDetails] = useState(initialCastingState);

  const fetchFgCastingDataBySession = async () => {
    if (!serialNumber) {
      toast.error("Please select Serial Number.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}dispatch/fg-casting`, {
        params: { sessionId: serialNumber },
      });
      const data = res?.data?.data;
      setFetchFgCastingData(data);
    } catch (error) {
      console.error("Failed to fetch Fg Casting data:", error);
      toast.error("Failed to fetch Fg Casting data");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSerialNumber("");
    setFetchFgCastingData([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCastingDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCastingData = () => {
    toast.success("Casting data logged to console");
    setCastingDetails(initialCastingState);
  };

  const handleQuery = () => {
    fetchFgCastingDataBySession();
    handleCastingData();
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600">
          <FiPackage size={20} />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">
            FG Casting
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Serial lookup and casting/shipment details</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {fetchFgCastingData.length > 0 && (
            <StatCard label="Records" value={fetchFgCastingData.length} color="indigo" />
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 py-5 flex flex-col gap-4">
        {/* ── Filter Bar ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <InputField
                label="Serial Number"
                type="text"
                placeholder="Enter Serial Number"
                name="serialNumber"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>

            <button
              onClick={handleQuery}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? <Spinner size={14} /> : <FiSearch size={14} />}
              Query
            </button>

            <button
              onClick={handleClearFilters}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TbFilterOff size={14} /> Clear Filter
            </button>

            {fetchFgCastingData.length > 0 && (
              <ExportButton
                data={fetchFgCastingData.map((item) => ({
                  ModelName: item.ModelName,
                  FGSerialNo: item.FG_Serial,
                  AssetCode: item.VSerial,
                  CustomerQR: item.CustomerQR,
                  NFCID: item.NFCID,
                  CreatedOn: item.CreatedOn?.replace("T", " ").replace("Z", "") || "",
                }))}
                filename="FG_Casting_Data"
              />
            )}
          </div>
        </div>

        {/* ── Casting Details ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <FiClipboard size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Casting Details
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <InputField
              label="Vehicle No."
              type="text"
              placeholder="Enter details"
              name="vehicleNo"
              value={castingDetails.vehicleNo}
              onChange={handleChange}
            />
            <InputField
              label="Lr No."
              type="text"
              placeholder="Enter details"
              name="lrNo"
              value={castingDetails.lrNo}
              onChange={handleChange}
            />
            <InputField
              label="Transporter"
              type="text"
              placeholder="Enter details"
              name="transporter"
              value={castingDetails.transporter}
              onChange={handleChange}
            />
            <InputField
              label="Location"
              type="text"
              placeholder="Enter details"
              name="location"
              value={castingDetails.location}
              onChange={handleChange}
            />
            <InputField
              label="Seal No."
              type="text"
              placeholder="Enter details"
              name="sealNo"
              value={castingDetails.sealNo}
              onChange={handleChange}
            />
            <InputField
              label="Driver Ph. No."
              type="text"
              placeholder="Enter details"
              name="driverPhNo"
              value={castingDetails.driverPhNo}
              onChange={handleChange}
            />
            <InputField
              label="Invoice No."
              type="text"
              placeholder="Enter details"
              name="invoiceNo"
              value={castingDetails.invoiceNo}
              onChange={handleChange}
            />
            <DateTimePicker label="Date" name="date" value={castingDetails.date} onChange={handleChange} />
          </div>
        </div>

        {/* ── Results Table ── */}
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
            <FiPackage size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Casting Records
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                <tr>
                  {["Model", "Serial", "Asset Code", "Customer QR", "NFC UID", "Created On"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fetchFgCastingData.map((item, index) => (
                  <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{item.ModelName}</td>
                    <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{item.FG_Serial}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">{item.VSerial}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{item.CustomerQR}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">{item.NFCID}</td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono">
                      {item.CreatedOn?.replace("T", " ").replace("Z", "")}
                    </td>
                  </tr>
                ))}
                {!loading && fetchFgCastingData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <FiPackage size={36} className="mx-auto mb-3 text-slate-200" />
                      <p className="text-sm font-semibold text-slate-300">No records found</p>
                      <p className="text-xs text-slate-300 mt-1">Enter a serial number and click Query</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {loading && (
              <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
                <Spinner /> Loading records…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FGCasting;

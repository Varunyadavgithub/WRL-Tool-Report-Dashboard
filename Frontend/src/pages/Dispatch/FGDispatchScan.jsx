import { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

import { FiCheckCircle, FiTruck, FiHash, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { MdQrCodeScanner, MdOutlineLocalShipping } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import ScanErrorDialog from "./ScanErrorDialog";

const Spinner = ({ size = 16 }) => (
  <AiOutlineLoading3Quarters size={size} className="animate-spin inline-block" />
);

const StatCard = ({ label, value, tone = "amber" }) => {
  const tones = {
    amber: "bg-amber-50 border-amber-200 text-amber-500 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-500 text-emerald-700",
    red: "bg-red-50 border-red-200 text-red-500 text-red-700",
    slate: "bg-slate-50 border-slate-200 text-slate-400 text-slate-700",
  };
  const [bg, border, label_, value_] = tones[tone].split(" ");
  return (
    <div className={`flex flex-col gap-0.5 px-4 py-2.5 rounded-xl ${bg} border ${border}`}>
      <span className={`text-[10px] uppercase tracking-widest font-semibold ${label_}`}>{label}</span>
      <span className={`text-xl font-black tabular-nums ${value_}`}>{value ?? "—"}</span>
    </div>
  );
};

const FGDispatchScan = () => {
  // ── Session setup phase ──────────────────────────────────────────────────
  const [vehicleNo, setVehicleNo] = useState("");
  const [dockNo, setDockNo] = useState("");
  const [openSessions, setOpenSessions] = useState([]);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Active session ────────────────────────────────────────────────────────
  const [session, setSession] = useState(null); // { documentId, sessionId, vehicleNo, dockNo, count }
  const [items, setItems] = useState([]);
  const [rawBarcode, setRawBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [banner, setBanner] = useState(null); // success detail card: { title, detail }
  const [errorDialog, setErrorDialog] = useState(null); // blocking error message
  const [validCount, setValidCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [removingSerial, setRemovingSerial] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // FGSerialNo pending removal confirmation

  const inputRef = useRef(null);

  const fetchOpenSessions = async () => {
    setLoadingOpen(true);
    try {
      const res = await axios.get(`${baseURL}dispatch/session/open`);
      setOpenSessions(res.data.data || []);
    } catch {
      toast.error("Failed to load open sessions.");
    } finally {
      setLoadingOpen(false);
    }
  };

  useEffect(() => {
    if (!session) fetchOpenSessions();
  }, [session]);

  useEffect(() => {
    if (session) requestAnimationFrame(() => inputRef.current?.focus());
  }, [session]);

  const openSession = async (documentId) => {
    try {
      const res = await axios.get(`${baseURL}dispatch/session/${documentId}`);
      const { session: s, items: its } = res.data.data;
      setSession({
        documentId: s.Document_ID,
        sessionId: s.Session_ID,
        vehicleNo: s.Vehicle_No,
        dockNo: s.DockNo,
        count: s.Count,
      });
      setItems(its);
      setValidCount(its.length);
      setRejectedCount(0);
    } catch {
      toast.error("Failed to open session.");
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!vehicleNo.trim() || !dockNo.trim()) {
      toast.error("Enter both Vehicle No. and Dock No.");
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${baseURL}dispatch/session/create`, {
        vehicleNo: vehicleNo.trim(),
        dockNo: dockNo.trim(),
      });
      const data = res.data.data;
      setSession(data);
      if (res.data.resumed) {
        toast.success(`Resuming open session for ${data.vehicleNo}`);
        await openSession(data.documentId);
      } else {
        setItems([]);
        setValidCount(0);
        setRejectedCount(0);
        toast.success("Dispatch session created");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create session.");
    } finally {
      setCreating(false);
    }
  };

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  const handleScan = async (e) => {
    e.preventDefault();
    const value = rawBarcode.trim();
    if (!value || scanning || !session) return;

    setScanning(true);
    try {
      const res = await axios.post(`${baseURL}dispatch/scan`, {
        documentId: session.documentId,
        rawBarcode: value,
      });
      const data = res.data.data;
      setBanner({ title: "FG Added to Dispatch", detail: data });
      setValidCount((c) => c + 1);
      setSession((s) => ({ ...s, count: (s.count || 0) + 1 }));
      setItems((prev) => [
        { ModelName: data.modelName, FGSerialNo: data.fgSerialNo, AssetCode: data.assetCode, AddedOn: new Date().toISOString() },
        ...prev,
      ]);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to scan FG.";
      setErrorDialog(message);
      setRejectedCount((c) => c + 1);
    } finally {
      setRawBarcode("");
      setScanning(false);
      focusInput();
    }
  };

  const confirmRemoveItem = async () => {
    const fgSerialNo = confirmRemove;
    setRemovingSerial(fgSerialNo);
    try {
      await axios.post(`${baseURL}dispatch/scan/remove`, {
        documentId: session.documentId,
        fgSerialNo,
      });
      setItems((prev) => prev.filter((i) => i.FGSerialNo !== fgSerialNo));
      setSession((s) => ({ ...s, count: Math.max((s.count || 1) - 1, 0) }));
      setValidCount((c) => Math.max(c - 1, 0));
      toast.success(`Removed ${fgSerialNo}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove FG.");
    } finally {
      setRemovingSerial(null);
      setConfirmRemove(null);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await axios.post(`${baseURL}dispatch/complete`, { documentId: session.documentId });
      toast.success(`Dispatch Completed — ${res.data.data.completedCount} FG dispatched`);
      setSession(null);
      setItems([]);
      setBanner(null);
      setVehicleNo("");
      setDockNo("");
      setValidCount(0);
      setRejectedCount(0);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to complete dispatch.");
    } finally {
      setCompleting(false);
      setConfirmComplete(false);
    }
  };

  // ── Phase 1: Vehicle / Dock entry ───────────────────────────────────────
  if (!session) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
            <MdOutlineLocalShipping size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">FG Dispatch</h1>
            <p className="text-xs text-slate-400 mt-0.5">Start or resume a vehicle loading session</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-8 flex flex-col items-center gap-6">
          <form onSubmit={handleCreateSession} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Vehicle No.</label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. GJ15YY4687"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base font-mono text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dock No.</label>
              <input
                type="text"
                value={dockNo}
                onChange={(e) => setDockNo(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-bold transition-all shadow-sm cursor-pointer"
            >
              {creating ? <Spinner size={16} /> : <FiTruck size={16} />}
              Start / Resume Dispatch
            </button>
          </form>

          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Open Sessions</span>
              <button onClick={fetchOpenSessions} className="ml-auto text-slate-400 hover:text-slate-600">
                <FiRefreshCw size={13} className={loadingOpen ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-50">
              {openSessions.length === 0 && (
                <p className="text-center text-xs text-slate-300 py-8">No open sessions</p>
              )}
              {openSessions.map((s) => (
                <button
                  key={s.Document_ID}
                  onClick={() => openSession(s.Document_ID)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 font-mono">{s.Vehicle_No}</p>
                    <p className="text-[10px] text-slate-400">Dock {s.DockNo} · {s.Session_ID}</p>
                  </div>
                  <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg tabular-nums">
                    {s.Count ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase 2: Active scanning session ────────────────────────────────────
  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center gap-3 shadow-sm shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
          <MdOutlineLocalShipping size={22} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none font-mono">{session.vehicleNo}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dock {session.dockNo} · Session {session.sessionId} · Doc #{session.documentId}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatCard label="Scanned" value={session.count} tone="amber" />
          <StatCard label="Valid" value={validCount} tone="emerald" />
          <StatCard label="Rejected" value={rejectedCount} tone="red" />
          <button
            onClick={() => setConfirmComplete(true)}
            disabled={items.length === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <FiCheckCircle size={16} /> Complete Dispatch
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 py-5 flex flex-col gap-4">
        <form onSubmit={handleScan} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm shrink-0">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Scan FG Label</label>
          <div className="relative">
            <MdQrCodeScanner className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400" size={20} />
            <input
              ref={inputRef}
              type="text"
              value={rawBarcode}
              onChange={(e) => setRawBarcode(e.target.value)}
              onBlur={focusInput}
              disabled={scanning}
              autoComplete="off"
              placeholder="Scan or focus here…"
              className="w-full pl-11 pr-4 py-3.5 border-2 border-amber-200 rounded-xl text-base font-mono text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:opacity-50"
            />
            {scanning && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500">
                <Spinner size={18} />
              </div>
            )}
          </div>
        </form>

        {banner && (
          <div className="shrink-0 rounded-2xl border-2 p-4 flex items-center gap-4 bg-emerald-50 border-emerald-300">
            <FiCheckCircle size={32} className="text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-lg font-black text-emerald-700">✓ {banner.title}</p>
              {banner.detail && (
                <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                  <span><span className="text-slate-400">Model:</span> <b>{banner.detail.modelName}</b></span>
                  <span><span className="text-slate-400">FG Serial:</span> <b className="font-mono">{banner.detail.fgSerialNo}</b></span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50 shrink-0">
            <FiHash size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Loaded FG ({items.length})</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                <tr>
                  {["Sr. No.", "Model", "FG Serial", "Asset Code", "Time", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-slate-300 tabular-nums select-none">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{item.ModelName}</td>
                    <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{item.FGSerialNo}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">{item.AssetCode}</td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono">
                      {item.AddedOn?.toString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => setConfirmRemove(item.FGSerialNo)}
                        disabled={removingSerial === item.FGSerialNo}
                        title="Remove from this dispatch"
                        className="flex items-center gap-1 text-red-400 hover:text-red-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {removingSerial === item.FGSerialNo ? <Spinner size={13} /> : <FiTrash2 size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-sm font-semibold text-slate-300">
                      No FG scanned yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmComplete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <p className="text-lg font-black text-slate-800 mb-2">Complete Dispatch?</p>
            <p className="text-sm text-slate-500 mb-5">
              {items.length} FG will be moved to Dispatch Master for vehicle <b className="font-mono">{session.vehicleNo}</b>. This cannot be undone from this screen.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmComplete(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold cursor-pointer"
              >
                {completing ? <Spinner size={14} /> : <FiCheckCircle size={14} />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <p className="text-lg font-black text-slate-800 mb-2">Remove FG?</p>
            <p className="text-sm text-slate-500 mb-5">
              FG Serial <b className="font-mono">{confirmRemove}</b> will be removed from this dispatch session.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveItem}
                disabled={removingSerial === confirmRemove}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-bold cursor-pointer"
              >
                {removingSerial === confirmRemove ? <Spinner size={14} /> : <FiTrash2 size={14} />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <ScanErrorDialog
        message={errorDialog}
        onClose={() => {
          setErrorDialog(null);
          focusInput();
        }}
      />
    </div>
  );
};

export default FGDispatchScan;

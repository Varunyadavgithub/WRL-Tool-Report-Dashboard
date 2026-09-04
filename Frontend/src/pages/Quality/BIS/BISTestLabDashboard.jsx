import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, Play, Square, Loader2, Gauge, Layers, Timer, Info, Plus,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL, fileBaseURL } from "../../../assets/assets";
import { SearchableSelect, FieldLabel, reportTypeLabel } from "./shared";

const REFRESH_INTERVAL_MS = 15000;

const formatMinutes = (mins) => {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const elapsedMinutes = (from, now) => (from ? Math.max(0, (now - new Date(from).getTime()) / 60000) : 0);

// Only models with a computed test actually due — Overdue or Due Soon —
// belong in the "Put Model on Stall" picker. "No Baseline" means there's no
// last-test date to compute a due date from at all, which isn't the same as
// a test being due, so it's excluded rather than treated as pending.
const PENDING_STATUSES = ["Overdue", "Due Soon"];

// ── Start New Test inline form (shown on an idle stall) ────────────────────
// `models` is one entry per pending (model, report type) combo — a model can
// have more than one report type due at once, so the picker needs to show
// and select the specific test, not just the model.
const StartTestForm = ({ stallId, models, onStarted }) => {
  const [pendingKey, setPendingKey] = useState("");
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState(false);

  const keyOf = (m) => `${m.materialCode}__${m.reportType}`;
  const modelOptions = models.map((m) => ({ value: keyOf(m), label: `${m.modelName} (${m.materialCode}) — ${reportTypeLabel(m.reportType)}` }));
  const selected = models.find((m) => keyOf(m) === pendingKey);

  const handleStart = async () => {
    if (!pendingKey || !selected) return toast.error("Select a model first");
    setStarting(true);
    try {
      await axios.post(`${baseURL}quality/bis-test-run`, {
        stallId, materialCode: selected.materialCode, modelName: selected.modelName, reportType: selected.reportType,
      });
      toast.success("Test started");
      setPendingKey("");
      setOpen(false);
      onStarted();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start test");
    } finally {
      setStarting(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-xs font-semibold border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all">
        <Plus className="w-3.5 h-3.5" /> Put Model on Stall
      </button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
      <FieldLabel>Model — Test</FieldLabel>
      <SearchableSelect placeholder="Search model…" value={pendingKey} onChange={setPendingKey} options={modelOptions} />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => setOpen(false)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-all">
          Cancel
        </button>
        <button onClick={handleStart} disabled={starting} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all">
          <Play className="w-3 h-3" /> {starting ? "Starting…" : "Start"}
        </button>
      </div>
    </div>
  );
};

// ── One stall card ───────────────────────────────────────────────────────
const StallCard = ({ stall, models, now, onChanged }) => {
  const run = stall.activeRun;
  const [endingRun, setEndingRun] = useState(false);

  const doEndRun = async () => {
    setEndingRun(true);
    try {
      await axios.post(`${baseURL}quality/bis-test-run/${run.id}/end`);
      toast.success("Test ended");
      onChanged();
    } catch {
      toast.error("Failed to end test");
    } finally {
      setEndingRun(false);
    }
  };

  if (!run) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">{stall.stallName}</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">IDLE</span>
        </div>
        <div className="flex-1 flex items-center justify-center py-6 text-slate-300 text-xs">No test in progress</div>
        <StartTestForm stallId={stall.id} models={models} onStarted={onChanged} />
      </div>
    );
  }

  const elapsed = elapsedMinutes(run.startedAt, now);

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 flex flex-col gap-3 ring-1 ring-blue-50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{stall.stallName}</h3>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> IN PROGRESS
        </span>
      </div>

      <div className="flex items-center gap-3">
        {run.photoPath ? (
          <img src={fileBaseURL + run.photoPath} alt={run.modelName} className="h-14 w-14 object-cover rounded-lg border border-slate-200 bg-white shrink-0" />
        ) : (
          <div className="h-14 w-14 flex items-center justify-center border border-dashed border-slate-200 rounded-lg bg-slate-50 text-slate-300 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{run.modelName}</p>
          <p className="text-[10px] text-slate-400 font-mono">{run.materialCode}</p>
          {run.reportType && (
            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
              {reportTypeLabel(run.reportType)} Test
            </span>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
            <Timer className="w-3 h-3" /> Elapsed {formatMinutes(elapsed)}
          </p>
        </div>
      </div>

      {run.specs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><Gauge className="w-3 h-3" /> Specs</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {run.specs.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-0.5">
                <span className="text-slate-400 truncate">{s.specKey}</span>
                <span className="text-slate-700 font-semibold truncate ml-1">{s.specValue || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={doEndRun} disabled={endingRun}
        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all">
        <Square className="w-3.5 h-3.5" /> {endingRun ? "Ending…" : "End Test"}
      </button>
    </div>
  );
};

const BISTestLabDashboard = () => {
  const [stalls, setStalls] = useState([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-test-lab-dashboard`);
      setStalls(res.data.stalls || []);
      setCompletedToday(res.data.completedToday || 0);
      setLastUpdated(new Date());
    } catch {
      toast.error("Failed to load Test Lab Dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-test-schedule`);
      const pending = (res.data.schedule || []).filter((s) => PENDING_STATUSES.includes(s.status));
      setModels(
        pending
          .map((s) => ({ materialCode: s.materialCode, modelName: s.modelName, reportType: s.reportType }))
          .sort((a, b) => a.modelName.localeCompare(b.modelName) || a.reportType.localeCompare(b.reportType)),
      );
    } catch {
      // Non-fatal — "Put Model on Stall" simply has no options.
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchModels();
  }, [fetchDashboard, fetchModels]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchDashboard, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchDashboard]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unitsUnderTest = stalls.filter((s) => s.activeRun).length;
  const overallStatus = unitsUnderTest === 0 ? "All Idle" : unitsUnderTest === stalls.length ? "Fully Loaded" : "Running";

  const currentDateTime = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });

  return (
    <div className="p-4 md:p-6 space-y-5 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-800">Deep Freezer Test Lab Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">{currentDateTime}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoRefresh ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-500 border-slate-200"}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} style={autoRefresh ? { animationDuration: "3s" } : {}} />
            Auto-refresh {autoRefresh ? "On" : "Off"}
          </button>
          <button onClick={fetchDashboard} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Stalls", value: stalls.length },
          { label: "Units Under Test", value: unitsUnderTest },
          { label: "Completed Today", value: completedToday },
          { label: "Overall Status", value: overallStatus },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-lg font-black text-slate-800 mt-0.5">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        {/* Stall cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {loading ? (
            <p className="text-xs text-slate-400 col-span-2 text-center py-10">Loading…</p>
          ) : stalls.length === 0 ? (
            <p className="text-xs text-slate-400 col-span-2 text-center py-10">No stalls configured.</p>
          ) : (
            stalls.map((stall) => (
              <StallCard key={stall.id} stall={stall} models={models} now={now} onChanged={fetchDashboard} />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Lab Capacity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Lab Capacity</h3>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span>{unitsUnderTest} / {stalls.length} stalls in use</span>
              <span>{stalls.length > 0 ? Math.round((unitsUnderTest / stalls.length) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${stalls.length > 0 ? (unitsUnderTest / stalls.length) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Dashboard Status */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" /> Dashboard Status
            </h3>
            <div className="space-y-1 text-[11px] text-slate-500">
              <div className="flex items-center justify-between"><span>Auto-refresh</span><span className={autoRefresh ? "text-emerald-600 font-semibold" : "text-slate-400"}>{autoRefresh ? `Every ${REFRESH_INTERVAL_MS / 1000}s` : "Off"}</span></div>
              <div className="flex items-center justify-between"><span>Last updated</span><span>{lastUpdated ? lastUpdated.toLocaleTimeString("en-IN") : "—"}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BISTestLabDashboard;

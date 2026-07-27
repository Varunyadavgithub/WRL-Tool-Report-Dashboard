import { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import { Clock } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import { inputCls, selectCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";
import {
  selectShifts, selectShiftHistory, selectMachines,
  selectMachineShiftAllocations, selectMachineShiftAllocationHistory,
  shiftDurationMins,
} from "../../redux/slices/masterConfigSlice";
import {
  useAddShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation,
  useSetMachineShiftAllocationsMutation,
} from "../../redux/api/masterConfigApi";
import { resolveShiftAsOf, resolveMachineShiftsAsOf, enrichRecords, parseDurSecs } from "../../utils/productionLogic.js";
import { mapDbRecord } from "../../utils/mapDbRecord.js";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const INIT = { shiftName:"", shiftCode:"", startTime:"08:00", endTime:"16:00", breakStart:"12:00", breakEnd:"12:30", teaBreaks:"2", overtimeShift:false, weeklyOff:["Sunday"], color:"#3b82f6", status:true };
const TABS = [["shifts","Shifts"],["allocation","Machine Allocation"],["history","History"]];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtHrsMins = (mins) => {
  const m = Math.round(mins || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

// Machine <-> production-record identity has no FK — matched by
// case-insensitive name against AssetName/LineName, same as the identical
// lookup already used in Dashboard.jsx and Overview.jsx.
const norm = (s) => (s || "").trim().toLowerCase();
const machineForRecord = (machines, r) => {
  const byAsset = norm(r.assetName);
  const byLine = norm(r.lineName);
  return machines.find((m) => byAsset && norm(m.machineName) === byAsset)
      || machines.find((m) => byLine && norm(m.lineName) === byLine)
      || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Machine Allocation tab — assign machines to existing shifts
// ─────────────────────────────────────────────────────────────────────────────
const MachineAllocationTab = ({ search }) => {
  const machines = useSelector(selectMachines).filter((m) => m.status);
  const shifts = useSelector(selectShifts).filter((s) => s.status);
  const allocations = useSelector(selectMachineShiftAllocations);
  const [setAllocations, { isLoading }] = useSetMachineShiftAllocationsMutation();
  // Only holds rows currently being edited — unedited rows always reflect
  // the live `allocations` from the server.
  const [draft, setDraft] = useState({});

  const currentShiftIdsFor = (machineId) =>
    allocations.filter((a) => a.machineId === machineId).map((a) => a.shiftId);

  const effectiveFor = (machineId) => draft[machineId] ?? currentShiftIdsFor(machineId);

  const toggle = (machineId, shiftId) => {
    setDraft((d) => {
      const cur = d[machineId] ?? currentShiftIdsFor(machineId);
      const next = cur.includes(shiftId) ? cur.filter((id) => id !== shiftId) : [...cur, shiftId];
      return { ...d, [machineId]: next };
    });
  };

  const handleSaveRow = async (machineId) => {
    try {
      await setAllocations({ machineId, shiftIds: effectiveFor(machineId) }).unwrap();
      setDraft((d) => {
        const next = { ...d };
        delete next[machineId];
        return next;
      });
      toast.success("Allocation saved.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save allocation.");
    }
  };

  const filtered = machines.filter((m) => (m.machineName || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50">
              <TH>Machine</TH>
              {shifts.map((s) => <TH key={s.id} center>{s.shiftName}</TH>)}
              <TH center>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((m) => {
              const checked = effectiveFor(m.id);
              const dirty = draft[m.id] !== undefined;
              return (
                <tr key={m.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                  <TD cls="font-bold text-slate-800">{m.machineName}</TD>
                  {shifts.map((s) => (
                    <TD key={s.id} center>
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={checked.includes(s.id)}
                        onChange={() => toggle(m.id, s.id)}
                      />
                    </TD>
                  ))}
                  <TD center>
                    <button
                      onClick={() => handleSaveRow(m.id)}
                      disabled={!dirty || isLoading}
                      className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                  </TD>
                </tr>
              );
            }) : <EmptyState colSpan={shifts.length + 2} message="No active machines configured." />}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// History tab — configured allocation vs. actual observed run time, per day
// ─────────────────────────────────────────────────────────────────────────────
const MachineHistoryTab = () => {
  const machines = useSelector(selectMachines).filter((m) => m.status);
  const shifts = useSelector(selectShifts);
  const shiftHistory = useSelector(selectShiftHistory);
  const allocationHistory = useSelector(selectMachineShiftAllocationHistory);

  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get(`${PART_PROCESS_API}/records-range`, { params: { startDate: date, endDate: date } })
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data?.data ?? []).map((r, i) => mapDbRecord(r, i));
        setRecords(rows);
      })
      .catch(() => { if (!cancelled) setRecords([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const rows = useMemo(() => {
    const enriched = enrichRecords(records);
    const byMachine = new Map();
    machines.forEach((m) => byMachine.set(m.id, { machine: m, runSecs: 0, downSecs: 0, idleSecs: 0 }));
    enriched.forEach((r) => {
      const m = machineForRecord(machines, r);
      if (!m || !byMachine.has(m.id)) return;
      const bucket = byMachine.get(m.id);
      const secs = parseDurSecs(r.duration);
      if (r.effectiveState === "Production") bucket.runSecs += secs;
      else if (r.effectiveState === "Downtime") bucket.downSecs += secs;
      else if (r.effectiveState === "Idle") bucket.idleSecs += secs;
    });

    return [...byMachine.values()].map(({ machine, runSecs, downSecs, idleSecs }) => {
      const shiftIds = resolveMachineShiftsAsOf(allocationHistory, machine.id, date);
      const configuredMins = shiftIds.reduce((sum, shiftId) => {
        const resolved = resolveShiftAsOf(shiftHistory, shiftId, date, shifts.find((s) => s.id === shiftId));
        return sum + (resolved ? shiftDurationMins(resolved) : 0);
      }, 0);
      const configuredNames = shiftIds.map((id) => shifts.find((s) => s.id === id)?.shiftName).filter(Boolean);
      return {
        machine,
        configuredNames,
        configuredMins,
        runMins: Math.round(runSecs / 60),
        downMins: Math.round(downSecs / 60),
        idleMins: Math.round(idleSecs / 60),
      };
    });
  }, [records, machines, allocationHistory, shiftHistory, shifts, date]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} className={`${inputCls} w-auto`} />
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <TH>Machine</TH>
                <TH>Configured Shifts</TH>
                <TH>Configured Hours</TH>
                <TH>Actual Running</TH>
                <TH>Actual Downtime</TH>
                <TH>Actual Idle</TH>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map(({ machine, configuredNames, configuredMins, runMins, downMins, idleMins }) => (
                <tr key={machine.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                  <TD cls="font-bold text-slate-800">{machine.machineName}</TD>
                  <TD cls="text-slate-500">{configuredNames.length ? configuredNames.join(", ") : "—"}</TD>
                  <TD cls="font-semibold text-slate-600">{configuredMins > 0 ? fmtHrsMins(configuredMins) : "—"}</TD>
                  <TD cls="font-semibold text-emerald-600">{fmtHrsMins(runMins)}</TD>
                  <TD cls="font-semibold text-rose-500">{fmtHrsMins(downMins)}</TD>
                  <TD cls="font-semibold text-amber-600">{fmtHrsMins(idleMins)}</TD>
                </tr>
              )) : <EmptyState colSpan={6} message={loading ? "Loading…" : "No active machines configured."} />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ShiftConfig = () => {
  const [tab, setTab] = useState("shifts");
  const data     = useSelector(selectShifts);
  const [addShift]    = useAddShiftMutation();
  const [updateShift] = useUpdateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();
  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => data.filter((r) => r.shiftName.toLowerCase().includes(search.toLowerCase()) || r.shiftCode.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = async () => {
    if (!form.shiftName || !form.shiftCode) { toast.error("Shift Name and Code required."); return; }
    try {
      if (modal.mode === "add") {
        await addShift(form).unwrap();
        toast.success("Shift added.");
      } else {
        await updateShift({ ...form, id: modal.row.id }).unwrap();
        toast.success("Shift updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save shift.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteShift(id).unwrap();
      toast.success("Shift deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete shift.");
    }
  };
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const toggleDay = (day) =>
    setForm((f) => ({ ...f, weeklyOff: f.weeklyOff.includes(day) ? f.weeklyOff.filter((d) => d !== day) : [...f.weeklyOff, day] }));

  const duration = (start, end) => {
    if (!start || !end) return "—";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 1440;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Shift Configuration" subtitle="Define shifts, break timings, weekly offs and holiday calendar" icon={Clock} onAdd={tab === "shifts" ? openAdd : undefined} addLabel="Add Shift" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1 w-fit mb-3">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === k ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "shifts" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50">
                    <TH>#</TH><TH>Shift Name</TH><TH>Code</TH><TH>Start</TH><TH>End</TH>
                    <TH>Duration</TH><TH>Break</TH><TH center>Tea Breaks</TH>
                    <TH>Weekly Off</TH><TH center>OT Shift</TH><TH center>Status</TH><TH center>Actions</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length > 0 ? filtered.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                      <TD cls="text-slate-400">{idx + 1}</TD>
                      <TD cls="font-bold text-slate-800">{r.shiftName}</TD>
                      <TD><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{r.shiftCode}</span></TD>
                      <TD mono cls="text-emerald-600 font-semibold">{r.startTime}</TD>
                      <TD mono cls="text-rose-500 font-semibold">{r.endTime}</TD>
                      <TD cls="font-semibold text-slate-600">{duration(r.startTime, r.endTime)}</TD>
                      <TD mono cls="text-slate-500">{r.breakStart && r.breakEnd ? `${r.breakStart} – ${r.breakEnd}` : "—"}</TD>
                      <TD center cls="text-slate-600">{r.teaBreaks}</TD>
                      <TD cls="text-slate-500">{r.weeklyOff?.join(", ") || "—"}</TD>
                      <TD center>{r.overtimeShift ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">OT</span> : <span className="text-slate-300">—</span>}</TD>
                      <TD center><StatusBadge active={r.status} /></TD>
                      <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                    </tr>
                  )) : <EmptyState colSpan={12} message="No shifts configured yet." />}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "allocation" && <MachineAllocationTab search={search} />}
        {tab === "history" && <MachineHistoryTab />}
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Shift" : "Edit Shift"} onClose={closeModal} onSave={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Shift Name" required><input value={form.shiftName} onChange={sf("shiftName")} placeholder="e.g. Shift A" className={inputCls} /></Field>
            <Field label="Shift Code" required><input value={form.shiftCode} onChange={sf("shiftCode")} placeholder="e.g. SA" className={inputCls} /></Field>
            <Field label="Start Time" required><input type="time" value={form.startTime} onChange={sf("startTime")} className={inputCls} /></Field>
            <Field label="End Time" required><input type="time" value={form.endTime} onChange={sf("endTime")} className={inputCls} /></Field>
            <Field label="Break Start Time"><input type="time" value={form.breakStart} onChange={sf("breakStart")} className={inputCls} /></Field>
            <Field label="Break End Time"><input type="time" value={form.breakEnd} onChange={sf("breakEnd")} className={inputCls} /></Field>
            <Field label="Number of Tea Breaks">
              <select value={form.teaBreaks} onChange={sf("teaBreaks")} className={selectCls}>
                {["0","1","2","3"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Weekly Off Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${form.weeklyOff?.includes(day) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.overtimeShift} onChange={sf("overtimeShift")} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-slate-700 font-medium">Overtime Shift</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.status} onChange={sf("status")} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-slate-700 font-medium">Active</span>
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ShiftConfig;

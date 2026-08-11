import { useMemo, useState } from "react";
import {
  AlertTriangle, Clock, CalendarCheck, HelpCircle, ChevronLeft, ChevronRight,
  CalendarDays, List as ListIcon, RefreshCw, Save, Pencil, X, PackageX,
} from "lucide-react";
import { StatCard, MultiSelectDropdown, reportTypeLabel } from "./shared";

const REPORT_TYPES = ["Introduction", "Sound", "Volume"];

const STATUS_STYLE = {
  Overdue: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", accent: "#ef4444" },
  "Due Soon": { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", accent: "#f59e0b" },
  Scheduled: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", accent: "#10b981" },
  "No Baseline": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400", accent: "#94a3b8" },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// Days-until-due is precise but not very readable at a glance for anything
// past a few weeks out — Months is shown as its own column alongside it.
const fmtMonths = (days) => (days === null || days === undefined ? "—" : (days / 30).toFixed(1));

const dateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE["No Baseline"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {status}
    </span>
  );
};

// Lets an already-set "last test date" be corrected in place. Only Baseline
// rows (the one-time setup) can be edited directly here — a date that came
// from a submitted Final report is part of that report's record, so it's
// edited from the Test Reports tab instead.
const LastTestDateCell = ({ item, onEditDate }) => {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  if (item.sourceStatus === "Final") {
    return (
      <span className="text-slate-500 font-mono" title="Set by a submitted report — edit it from the Test Reports tab">
        {fmtDate(item.lastTestDate)}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDate(item.lastTestDate ? new Date(item.lastTestDate).toISOString().slice(0, 10) : ""); setEditing(true); }}
        className="flex items-center gap-1.5 font-mono text-slate-500 hover:text-blue-600 transition-colors group"
        title="Edit last test date"
      >
        {fmtDate(item.lastTestDate)}
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await onEditDate(item, date);
      setEditing(false);
    } catch {
      // Toast already reported it — stay in edit mode so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)}
        className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
      <button type="button" onClick={handleSave} disabled={saving || !date} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-all" title="Save">
        <Save className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => setEditing(false)} disabled={saving} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 transition-all" title="Cancel">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// One row per model — every report type still missing a baseline gets its
// own date field, but they're saved together with a single Save action
// instead of a separate row (and a separate click) per report type.
const BaselineMergedRow = ({ modelName, materialCode, missingTypes, onSave }) => {
  const [dates, setDates] = useState({});
  const [saving, setSaving] = useState(false);

  const setDate = (type, value) => setDates((p) => ({ ...p, [type]: value }));
  const filledCount = missingTypes.filter((t) => dates[t]).length;

  const handleSave = async () => {
    const entries = missingTypes
      .filter((type) => dates[type])
      .map((type) => ({ modelName, materialCode, reportType: type, lastTestDate: dates[type] }));
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await onSave(entries);
    } catch {
      // Toast already reported it — keep the entered dates so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
      <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800">{modelName}</td>
      {REPORT_TYPES.map((type) => (
        <td key={type} className="px-3 py-2 border-b border-slate-100">
          {missingTypes.includes(type) ? (
            <input
              type="date"
              value={dates[type] || ""}
              onChange={(e) => setDate(type, e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          ) : (
            <span className="text-emerald-500 text-[10px] font-medium">✓ Set</span>
          )}
        </td>
      ))}
      <td className="px-3 py-2 border-b border-slate-100">
        <button
          onClick={handleSave}
          disabled={saving || filledCount === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-all"
        >
          <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
};

const MonthCalendar = ({ items, cursor, onCursorChange, selectedDay, onSelectDay }) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const itemsByDay = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (!item.nextDueDate) continue;
      const key = dateKey(item.nextDueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return map;
  }, [items]);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button onClick={() => onCursorChange(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-bold text-slate-800">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
        <button onClick={() => onCursorChange(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = d ? `${year}-${month}-${d}` : `blank-${i}`;
          const dayItems = d ? itemsByDay.get(`${year}-${month}-${d}`) || [] : [];
          const selected = d && selectedDay === `${year}-${month}-${d}`;
          return (
            <button
              key={key}
              type="button"
              disabled={!d}
              onClick={() => d && onSelectDay(`${year}-${month}-${d}`)}
              className={`min-h-[76px] border-b border-r border-slate-100 p-1.5 text-left align-top flex flex-col gap-1 transition-colors ${
                !d ? "bg-slate-50/50" : selected ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              {d && (
                <span className={`text-[11px] font-semibold ${isToday(d) ? "w-5 h-5 flex items-center justify-center rounded-full bg-blue-600 text-white" : "text-slate-500"}`}>
                  {d}
                </span>
              )}
              <div className="flex flex-col gap-0.5">
                {dayItems.slice(0, 3).map((it, idx) => {
                  const s = STATUS_STYLE[it.status] || STATUS_STYLE["No Baseline"];
                  return (
                    <span key={idx} className={`truncate text-[9px] font-semibold px-1 py-0.5 rounded ${s.bg} ${s.text}`} title={`${it.modelName} — ${reportTypeLabel(it.reportType)}`}>
                      {reportTypeLabel(it.reportType)[0]} · {it.modelName}
                    </span>
                  );
                })}
                {dayItems.length > 3 && <span className="text-[9px] text-slate-400">+{dayItems.length - 3} more</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const BISTestScheduleTab = ({ schedule, summary, loading, onRefresh, onSaveBaseline, onEditBaselineDate }) => {
  const [view, setView] = useState("calendar");
  const [typeFilter, setTypeFilter] = useState([]);
  const [modelSearch, setModelSearch] = useState("");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const filtered = useMemo(() => {
    const term = modelSearch.trim().toLowerCase();
    return schedule.filter((item) => {
      if (typeFilter.length > 0 && !typeFilter.includes(item.reportType)) return false;
      if (term && !item.modelName?.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [schedule, typeFilter, modelSearch]);

  const grouped = useMemo(() => {
    const order = ["Overdue", "Due Soon", "Scheduled", "No Baseline"];
    const buckets = { Overdue: [], "Due Soon": [], Scheduled: [], "No Baseline": [] };
    for (const item of filtered) buckets[item.status]?.push(item);
    for (const key of order) {
      buckets[key].sort((a, b) => (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity));
    }
    return order.map((key) => [key, buckets[key]]).filter(([, items]) => items.length > 0);
  }, [filtered]);

  // No-Baseline items merged one-row-per-model (each report type still
  // missing a baseline becomes a field in that row, not a separate row).
  const noBaselineByModel = useMemo(() => {
    const byModel = new Map();
    for (const item of filtered) {
      if (item.status !== "No Baseline") continue;
      if (!byModel.has(item.modelName)) {
        byModel.set(item.modelName, { modelName: item.modelName, materialCode: item.materialCode, missingTypes: [] });
      }
      byModel.get(item.modelName).missingTypes.push(item.reportType);
    }
    return [...byModel.values()].sort((a, b) => a.modelName.localeCompare(b.modelName));
  }, [filtered]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [];
    return filtered.filter((it) => it.nextDueDate && dateKey(it.nextDueDate) === selectedDay);
  }, [filtered, selectedDay]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={AlertTriangle} label="Overdue" value={summary.overdue} accent="#ef4444" sub="Past due date" />
        <StatCard icon={Clock} label="Due Soon" value={summary.dueSoon} accent="#f59e0b" sub="Within 30 days" />
        <StatCard icon={CalendarCheck} label="Scheduled" value={summary.scheduled} accent="#10b981" sub="On track" />
        <StatCard icon={HelpCircle} label="No Baseline" value={summary.noBaseline} accent="#94a3b8" sub="Setup required" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
        <MultiSelectDropdown label="Report Type" options={REPORT_TYPES} selected={typeFilter} onChange={setTypeFilter} labelFor={reportTypeLabel} />
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Model</label>
          <input type="text" value={modelSearch} onChange={(e) => setModelSearch(e.target.value)}
            placeholder="Search model…" className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-52" />
        </div>
        <div className="flex-1" />
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view === "calendar" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
            <ListIcon className="w-3.5 h-3.5" /> List
          </button>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center py-16 text-slate-400 text-sm">Loading schedule…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <CalendarDays className="w-12 h-12 opacity-20" strokeWidth={1.2} />
          <p className="text-sm text-slate-500">No BIS-classified models match these filters.</p>
        </div>
      ) : view === "calendar" ? (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <MonthCalendar items={filtered} cursor={cursor} onCursorChange={setCursor} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
              {selectedDay ? new Date(...selectedDay.split("-").map(Number)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Select a day"}
            </h3>
            {!selectedDay ? (
              <p className="text-xs text-slate-400">Click a date on the calendar to see what's due that day.</p>
            ) : selectedDayItems.length === 0 ? (
              <p className="text-xs text-slate-400">Nothing due on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayItems.map((it, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-800 truncate">{it.modelName}</span>
                      <StatusBadge status={it.status} />
                    </div>
                    <p className="text-[10px] text-slate-400">{reportTypeLabel(it.reportType)} Report · Last: {fmtDate(it.lastTestDate)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([status, items]) => (
            <div key={status} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-[11px] text-slate-400">
                  {status === "No Baseline"
                    ? `${noBaselineByModel.length} model${noBaselineByModel.length === 1 ? "" : "s"}`
                    : `${items.length} item${items.length === 1 ? "" : "s"}`}
                </span>
              </div>
              {status === "No Baseline" ? (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Model", reportTypeLabel("Introduction"), "Sound", "Volume", ""].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {noBaselineByModel.map((m) => (
                      <BaselineMergedRow key={m.modelName} modelName={m.modelName} materialCode={m.materialCode} missingTypes={m.missingTypes} onSave={onSaveBaseline} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Model", "Report Type", "Last Test Date", "Next Due Date", "Test Window", "Days", "Months"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
                        <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800">{it.modelName}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500">{reportTypeLabel(it.reportType)}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono"><LastTestDateCell item={it} onEditDate={onEditBaselineDate} /></td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 font-mono">
                          <span className="flex items-center gap-1.5">
                            {fmtDate(it.nextDueDate)}
                            {it.shiftedForNoProduction && (
                              <PackageX
                                className="w-3.5 h-3.5 text-amber-500 shrink-0"
                                title={`Shifted from ${fmtDate(it.originalNextDueDate)} — no production that month`}
                              />
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono">
                          {it.nextDueDate ? `${fmtDate(it.nextDueDate)} → ${fmtDate(it.windowEnd)}` : "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 font-mono">{it.daysUntilDue ?? "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono">{fmtMonths(it.daysUntilDue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BISTestScheduleTab;

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  Save,
  Calendar,
  Settings,
  Layers,
  Zap,
  Cpu,
  BarChart2,
  Shield,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { baseURL } from "../../assets/assets";

const API = `${baseURL}dashboard/configs`;

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

const EMPTY_FORM = {
  id: null,
  dashboardName: "",
  lineName: "",
  lineCode: "",
  workingTimeMin: "",
  stationCode1: "",
  stationName1: "",
  lineTaktTime1: "",
  lineMonthlyProduction1: "",
  lineTarget1: "",
  stationCode2: "",
  stationName2: "",
  lineTaktTime2: "",
  lineMonthlyProduction2: "",
  qualityProcessCode: "",
  qualityLineName: "",
  sectionName: "",
};

const COLUMNS = [
  { key: "dashboardName", label: "Dashboard", group: "General" },
  { key: "lineName", label: "Line Name", group: "General" },
  { key: "lineCode", label: "Line Code", group: "General" },
  { key: "workingTimeMin", label: "Working Min", group: "General" },
  { key: "stationCode1", label: "Station", group: "Display 1" },
  { key: "stationName1", label: "Name", group: "Display 1" },
  { key: "lineTaktTime1", label: "Takt (s)", group: "Display 1" },
  { key: "lineMonthlyProduction1", label: "Monthly", group: "Display 1" },
  { key: "lineTarget1", label: "UPH", group: "Display 1" },
  { key: "stationCode2", label: "Station", group: "Display 2" },
  { key: "stationName2", label: "Name", group: "Display 2" },
  { key: "lineTaktTime2", label: "Takt (s)", group: "Display 2" },
  { key: "lineMonthlyProduction2", label: "Monthly", group: "Display 2" },
  { key: "qualityProcessCode", label: "Process Code", group: "Quality" },
  { key: "qualityLineName", label: "Line Name", group: "Quality" },
  { key: "sectionName", label: "Section", group: "Loss" },
];

const GROUP_CONFIG = {
  General: {
    hex: "#6366f1",
    light: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-600",
    Icon: Cpu,
    label: "General Info",
  },
  "Display 1": {
    hex: "#0ea5e9",
    light: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-600",
    Icon: Layers,
    label: "Main Display 1",
  },
  "Display 2": {
    hex: "#f59e0b",
    light: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-600",
    Icon: Zap,
    label: "Main Display 2",
  },
  Quality: {
    hex: "#8b5cf6",
    light: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-600",
    Icon: Shield,
    label: "Quality",
  },
  Loss: {
    hex: "#ef4444",
    light: "bg-red-50",
    border: "border-red-200",
    text: "text-red-600",
    Icon: BarChart2,
    label: "Loss Analysis",
  },
};

const FORM_SECTIONS = [
  {
    group: "General",
    fields: [
      {
        key: "dashboardName",
        label: "Dashboard Name",
        placeholder: "e.g. FREEZER FG PACKING",
        full: true,
      },
      { key: "lineName", label: "Line Name", placeholder: "e.g. FREEZER" },
      { key: "lineCode", label: "Line Code", placeholder: "e.g. 12501" },
      {
        key: "workingTimeMin",
        label: "Working Time (min)",
        placeholder: "e.g. 720",
      },
    ],
  },
  {
    group: "Display 1",
    fields: [
      {
        key: "stationCode1",
        label: "Station Code",
        placeholder: "e.g. 1220010",
      },
      {
        key: "stationName1",
        label: "Station Name",
        placeholder: "e.g. FG PACKING",
      },
      { key: "lineTaktTime1", label: "Takt Time (s)", placeholder: "e.g. 40" },
      {
        key: "lineMonthlyProduction1",
        label: "Monthly Production",
        placeholder: "e.g. 27000",
      },
      { key: "lineTarget1", label: "Target UPH", placeholder: "e.g. 85" },
    ],
  },
  {
    group: "Display 2",
    fields: [
      {
        key: "stationCode2",
        label: "Station Code",
        placeholder: "e.g. 1220005",
      },
      {
        key: "stationName2",
        label: "Station Name",
        placeholder: "e.g. FG LOADING",
      },
      { key: "lineTaktTime2", label: "Takt Time (s)", placeholder: "e.g. 40" },
      {
        key: "lineMonthlyProduction2",
        label: "Monthly Production",
        placeholder: "e.g. 27000",
      },
    ],
  },
  {
    group: "Quality",
    fields: [
      {
        key: "qualityProcessCode",
        label: "Quality Process Code (comma-separated)",
        placeholder: "e.g. 12210, 12206",
        full: true,
      },
      {
        key: "qualityLineName",
        label: "Line Name",
        placeholder: "e.g. Freezer",
      },
    ],
  },
  {
    group: "Loss",
    fields: [
      {
        key: "sectionName",
        label: "Section Name (EMGMaster.Location)",
        placeholder: "e.g. FINAL ASSEMBLY",
        full: true,
      },
    ],
  },
];

const GROUP_SPANS = (() => {
  const spans = [];
  let i = 0;
  while (i < COLUMNS.length) {
    const g = COLUMNS[i].group;
    let count = 0;
    while (i + count < COLUMNS.length && COLUMNS[i + count].group === g)
      count++;
    spans.push({ group: g, count });
    i += count;
  }
  return spans;
})();

const NUM_KEYS = new Set([
  "lineTaktTime1",
  "lineMonthlyProduction1",
  "lineTarget1",
  "lineTaktTime2",
  "lineMonthlyProduction2",
  "workingTimeMin",
]);

const dbToForm = (row) => ({
  id: row.Id,
  dashboardName: row.DashboardName ?? "",
  lineName: row.LineName ?? "",
  lineCode: row.LineCode ?? "",
  workingTimeMin: String(row.WorkingTimeMin ?? ""),
  stationCode1: row.StationCode1 ?? "",
  stationName1: row.StationName1 ?? "",
  lineTaktTime1: String(row.LineTaktTime1 ?? ""),
  lineMonthlyProduction1: String(row.LineMonthlyProduction1 ?? ""),
  lineTarget1: String(row.LineTarget1 ?? ""),
  stationCode2: row.StationCode2 ?? "",
  stationName2: row.StationName2 ?? "",
  lineTaktTime2: String(row.LineTaktTime2 ?? ""),
  lineMonthlyProduction2: String(row.LineMonthlyProduction2 ?? ""),
  qualityProcessCode: row.QualityProcessCode ?? "",
  qualityLineName: row.QualityLineName ?? "",
  sectionName: row.SectionName ?? "",
});

const pad2 = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/* ── Config Form Modal ── */
const ConfigModal = ({ config, saving, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({ ...config }));
  const [activeSection, setActiveSection] = useState(0);
  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  const isEdit = !!config.id;
  const sec = FORM_SECTIONS[activeSection];
  const gcfg = GROUP_CONFIG[sec.group];
  const GIcon = gcfg.Icon;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-[780px] max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-[17px] text-slate-900">
                {isEdit ? "Edit Configuration" : "New Dashboard"}
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Configure production line dashboard settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex px-7 py-3 gap-2 bg-slate-50 border-b border-slate-100 shrink-0 overflow-x-auto">
          {FORM_SECTIONS.map((s, i) => {
            const cfg = GROUP_CONFIG[s.group];
            const SIcon = cfg.Icon;
            const active = activeSection === i;
            return (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-[1.5px] text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? `${cfg.light} ${cfg.border} ${cfg.text}`
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <SIcon className="w-3.5 h-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto px-7 py-6 flex-1">
          <div
            className={`flex items-center gap-2.5 mb-5 px-4 py-3.5 rounded-lg ${gcfg.light} border`}
            style={{ borderColor: `${gcfg.hex}33` }}
          >
            <GIcon className="w-4 h-4" style={{ color: gcfg.hex }} />
            <span className="font-bold text-[13px]" style={{ color: gcfg.hex }}>
              {gcfg.label}
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              {sec.fields.length} fields
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {sec.fields.map((f) => (
              <div key={f.key} className={f.full ? "col-span-2" : ""}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide">
                  {f.label}
                </label>
                <input
                  value={form[f.key] || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border-[1.5px] border-slate-200 text-slate-900 text-[13px] font-mono outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 ${saving ? "opacity-60" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center px-7 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex gap-1.5">
            {FORM_SECTIONS.map((_, i) => (
              <div
                key={i}
                onClick={() => setActiveSection(i)}
                className={`h-2 rounded-full cursor-pointer transition-all ${i === activeSection ? "w-6 bg-indigo-500" : "w-2 bg-slate-200 hover:bg-slate-300"}`}
              />
            ))}
          </div>
          <div className="flex gap-2.5">
            {activeSection > 0 && (
              <button
                onClick={() => setActiveSection((s) => s - 1)}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-[13px] hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {activeSection < FORM_SECTIONS.length - 1 ? (
              <button
                onClick={() => setActiveSection((s) => s + 1)}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:opacity-50"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onSave(form)}
                disabled={saving}
                className={`flex items-center gap-2 px-7 py-2.5 rounded-lg font-bold text-[13px] transition-all ${saving ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-200 hover:shadow-md"}`}
              >
                {saving ? (
                  <>
                    <Spinner cls="w-3.5 h-3.5" /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    {isEdit ? "Update Config" : "Save Config"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Launch Modal ── */
const LaunchModal = ({ config, onClose, onLaunch }) => {
  const [shiftDate, setShiftDate] = useState(todayISO);
  const [shift, setShift] = useState("A");

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-[480px] overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-5 flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-lg bg-white/20 flex items-center justify-center">
            <Play className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-extrabold text-base">
              Launch Dashboard
            </h2>
            <p className="text-white/75 text-xs mt-0.5">
              {config.dashboardName}
            </p>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="mb-4">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              <Calendar className="w-3 h-3" /> Shift Date
            </label>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border-[1.5px] border-slate-200 text-slate-900 text-[13px] outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Shift
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  s: "A",
                  lbl: "08:00 – 20:00",
                  active: "bg-emerald-50 text-emerald-700 border-emerald-400",
                },
                {
                  s: "B",
                  lbl: "20:00 – 08:00",
                  active: "bg-amber-50 text-amber-700 border-amber-400",
                },
              ].map(({ s, lbl, active }) => (
                <button
                  key={s}
                  onClick={() => setShift(s)}
                  className={`py-3.5 rounded-lg border-2 font-bold transition-all ${shift === s ? active : "border-slate-200 bg-slate-50 text-slate-400"}`}
                >
                  <div className="text-lg">Shift {s}</div>
                  <div className="text-[11px] font-normal mt-1 opacity-75">
                    {lbl}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg px-3.5 py-3 mb-5 border border-slate-200">
            {[
              ["Line", `${config.lineName || "—"} · ${config.lineCode || "—"}`],
              [
                "Station 1",
                `${config.stationCode1 || "—"} — ${config.stationName1 || "—"}`,
              ],
              [
                "Station 2",
                config.stationCode2
                  ? `${config.stationCode2} — ${config.stationName2}`
                  : "Not configured",
              ],
              ["Quality", config.qualityProcessCode || "Not configured"],
              ["Section", config.sectionName || "Not configured"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2.5 py-1 text-xs">
                <span className="text-slate-400 min-w-[68px]">{k}</span>
                <span className="text-slate-700 font-mono">{v}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={onClose}
              className="py-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 font-semibold text-[13px] hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onLaunch(config, shiftDate, shift)}
              className="col-span-2 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 hover:shadow-md transition-all"
            >
              <Play className="w-3.5 h-3.5" /> Open Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Delete Modal ── */
const DeleteModal = ({ name, saving, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
    <div className="bg-white rounded-2xl w-[400px] p-8 shadow-2xl text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <Trash2 className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="font-extrabold text-lg text-slate-900 mb-2">
        Delete Configuration?
      </h2>
      <p className="text-slate-500 text-sm mb-6 leading-relaxed">
        <strong className="text-red-500">{name}</strong> will be permanently
        removed.
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onClose}
          disabled={saving}
          className={`py-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 font-semibold transition-colors ${saving ? "opacity-50" : "hover:bg-slate-200"}`}
        >
          Keep It
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          className={`py-3 rounded-lg font-bold text-white flex items-center justify-center gap-1.5 transition-all ${saving ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"}`}
        >
          {saving ? (
            <>
              <Spinner cls="w-3.5 h-3.5" /> Deleting…
            </>
          ) : (
            <>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

/* ── MAIN COMPONENT ── */
const Management = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(API);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setConfigs(raw.map(dbToForm));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load configurations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleSave = useCallback(async (form) => {
    if (!form.dashboardName?.trim()) {
      toast.error("Dashboard name is required.");
      return;
    }
    if (!form.stationCode1?.trim()) {
      toast.error("Station Code 1 is required.");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        const res = await axios.put(`${API}/${form.id}`, form);
        const updated = dbToForm(res.data.data);
        setConfigs((c) => c.map((x) => (x.id === form.id ? updated : x)));
        toast.success("Configuration updated successfully.");
      } else {
        const res = await axios.post(API, form);
        const created = dbToForm(res.data.data);
        setConfigs((c) => [created, ...c]);
        toast.success("New configuration saved.");
      }
      setModal(null);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save configuration.",
      );
    } finally {
      setSaving(false);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    setSaving(true);
    try {
      await axios.delete(`${API}/${id}`);
      setConfigs((c) => c.filter((x) => x.id !== id));
      toast.success("Configuration deleted.");
      setModal(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete.");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleLaunch = useCallback(
    (cfg, shiftDate, shift) => {
      setModal(null);
      const slug = (cfg.dashboardName || "dashboard")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      navigate(`/display/${slug}`, {
        state: { config: cfg, shiftDate, shift, autoLoad: true },
      });
    },
    [navigate],
  );

  const filtered = configs.filter((c) =>
    [
      c.dashboardName,
      c.lineName,
      c.sectionName,
      c.stationName1,
      c.stationName2,
    ].some((v) => (v || "").toLowerCase().includes(search.toLowerCase())),
  );

  const stats = [
    {
      label: "Total Configs",
      value: configs.length,
      Icon: Settings,
      cls: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Active Lines",
      value: new Set(configs.map((c) => c.lineName).filter(Boolean)).size,
      Icon: Layers,
      cls: "text-sky-600 bg-sky-50",
    },
    {
      label: "Sections",
      value: new Set(configs.map((c) => c.sectionName).filter(Boolean)).size,
      Icon: BarChart2,
      cls: "text-amber-600 bg-amber-50",
    },
    {
      label: "Dual Displays",
      value: configs.filter((c) => c.stationCode2?.trim()).length,
      Icon: Zap,
      cls: "text-emerald-600 bg-emerald-50",
    },
  ];

  const closeModal = useCallback(() => {
    if (!saving) setModal(null);
  }, [saving]);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Display Manager
          </h1>
          <p className="text-[11px] text-slate-400">
            Manage production line configurations · Launch shift dashboards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search configurations…"
              className="bg-transparent border-none outline-none text-slate-900 text-[13px] w-[200px] placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={fetchConfigs}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[13px] transition-all ${loading ? "opacity-60 cursor-not-allowed" : "bg-white hover:bg-slate-50"}`}
          >
            {loading ? (
              <Spinner cls="w-3.5 h-3.5" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}{" "}
            Refresh
          </button>
          <button
            onClick={() => setModal({ type: "add", config: { ...EMPTY_FORM } })}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}
          >
            <Plus className="w-4 h-4" /> New Config
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {error && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-[13px] shrink-0">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </span>
            <button
              onClick={fetchConfigs}
              className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 shrink-0">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${s.cls}`}
              >
                <s.Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[28px] font-extrabold leading-none text-slate-900">
                  {s.value}
                </div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto">
            <table className="min-w-[1400px] w-full text-xs text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <th className="px-4 py-2.5 font-bold text-slate-400 text-[11px] border-b border-slate-200 whitespace-nowrap">
                    Actions
                  </th>
                  {GROUP_SPANS.map(({ group, count }) => {
                    const cfg = GROUP_CONFIG[group];
                    const GIcon = cfg.Icon;
                    return (
                      <th
                        key={group}
                        colSpan={count}
                        className={`px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-wider text-center border-b-2 border-l border-slate-100 ${cfg.light} ${cfg.text}`}
                        style={{ borderBottomColor: `${cfg.hex}44` }}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <GIcon className="w-3 h-3" /> {group}
                        </span>
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2 border-b border-slate-200" />
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-2.5 py-2 border-b border-slate-200 border-l text-slate-500 font-bold text-[10px] text-center whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length + 1}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Spinner cls="w-7 h-7 text-indigo-500" />
                        <p className="text-sm">Loading configurations…</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length + 1}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <PackageOpen
                          className="w-12 h-12 opacity-20"
                          strokeWidth={1.2}
                        />
                        <p className="text-sm font-bold text-slate-500">
                          {search
                            ? "No results found"
                            : "No configurations yet"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {search
                            ? `No configs match "${search}"`
                            : "Click 'New Config' to add your first configuration"}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((cfg) => (
                    <tr
                      key={cfg.id}
                      className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                    >
                      <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                        <div className="flex gap-1 items-center">
                          <button
                            onClick={() =>
                              setModal({ type: "launch", config: cfg })
                            }
                            title="Launch Dashboard"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                          >
                            <Play className="w-3 h-3" /> Launch
                          </button>
                          <button
                            onClick={() =>
                              setModal({ type: "edit", config: { ...cfg } })
                            }
                            title="Edit"
                            className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              setModal({ type: "delete", config: cfg })
                            }
                            title="Delete"
                            className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      {COLUMNS.map((col) => {
                        const v = cfg[col.key];
                        const isDash = col.key === "dashboardName";
                        const isNum = NUM_KEYS.has(col.key);
                        return (
                          <td
                            key={col.key}
                            className={`px-2.5 py-2 border-b border-slate-100 border-l whitespace-nowrap ${isDash ? "font-bold text-slate-800 text-xs" : "text-slate-600 text-[11px]"} ${isNum ? "text-center" : "text-left"}`}
                          >
                            {v ? (
                              isDash ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                                  {v}
                                </span>
                              ) : (
                                v
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(modal?.type === "add" || modal?.type === "edit") && (
        <ConfigModal
          config={modal.config}
          saving={saving}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
      {modal?.type === "launch" && (
        <LaunchModal
          config={modal.config}
          onClose={closeModal}
          onLaunch={handleLaunch}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          name={modal.config.dashboardName}
          saving={saving}
          onClose={closeModal}
          onConfirm={() => handleDelete(modal.config.id)}
        />
      )}
    </div>
  );
};

export default Management;

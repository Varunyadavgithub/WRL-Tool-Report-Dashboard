import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import InputField from "../../components/ui/InputField";
import { baseURL } from "../../assets/assets";
import {
  Star,
  Save,
  Settings,
  PackageOpen,
  Search,
  Trash2,
  Plus,
  ArrowUp,
  X,
  Loader2,
  Zap,
  Thermometer,
  GlassWater,
  Box,
  ChevronDown,
} from "lucide-react";

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ═══════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════ */
const STAR_COLORS = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-yellow-500",
  4: "bg-emerald-600",
  5: "bg-blue-700",
};

const STAR_BADGE_COLORS = {
  1: "bg-red-50 text-red-700 border-red-200",
  2: "bg-orange-50 text-orange-700 border-orange-200",
  3: "bg-yellow-50 text-yellow-700 border-yellow-200",
  4: "bg-emerald-50 text-emerald-700 border-emerald-200",
  5: "bg-blue-50 text-blue-700 border-blue-200",
};

/* ═══════════════════════════════════════════
   HELPER FUNCTIONS
═══════════════════════════════════════════ */
const getAchievedStar = (table) =>
  table.find((r) => r.status === "TRUE")?.star || "Not Qualified";

const getStarClass = (star) => STAR_COLORS[star] || "bg-slate-500";

const calcHard = (V, E) => {
  const A = E * 365;
  const ranges = [
    { star: 1, min: 3.52 * V + 105.54, max: 4.23 * V + 126.65 },
    { star: 2, min: 2.82 * V + 84.43, max: 3.52 * V + 105.54 },
    { star: 3, min: 2.25 * V + 67.55, max: 2.82 * V + 84.43 },
    { star: 4, min: 1.8 * V + 54.04, max: 2.25 * V + 67.55 },
    { star: 5, min: 0, max: 1.8 * V + 54.04 },
  ];
  return ranges.map((r) => ({
    star: r.star,
    min: r.min,
    Et: A,
    max: r.max,
    status:
      r.star === 5
        ? A < r.max
          ? "TRUE"
          : "FALSE"
        : A >= r.min && A < r.max
          ? "TRUE"
          : "FALSE",
  }));
};

const calcGlass = (V, E) => {
  const A = E * 365;
  const ranges = [
    { star: 1, min: 5.12 * V + 340.78, max: 6.4 * V + 425.97 },
    { star: 2, min: 4.09 * V + 272.62, max: 5.12 * V + 340.78 },
    { star: 3, min: 3.27 * V + 218.09, max: 4.09 * V + 272.62 },
    { star: 4, min: 2.61 * V + 174.47, max: 3.27 * V + 218.09 },
    { star: 5, min: 0, max: 2.61 * V + 174.47 },
  ];
  return ranges.map((r) => ({
    star: r.star,
    min: r.min,
    AEC: A,
    max: r.max,
    status:
      r.star === 5
        ? A < r.max
          ? "TRUE"
          : "FALSE"
        : A >= r.min && A < r.max
          ? "TRUE"
          : "FALSE",
  }));
};

const getNextStarImprovement = (table, currentKWh) => {
  if (!table || table.length === 0) return null;
  const row = table.find((r) => r.status === "TRUE");

  if (!row) {
    const next = table[table.length - 1];
    const requiredKWh = (next.max / 365).toFixed(2);
    const improve = (currentKWh - requiredKWh).toFixed(2);
    return (
      <span className="flex items-center justify-center gap-1.5 text-xs">
        <ArrowUp className="w-3 h-3" />
        Reduce {improve} kWh/day to reach
        <Star className="w-3 h-3" /> {next.star}
      </span>
    );
  }

  if (row.star === 5) {
    return (
      <span className="flex items-center justify-center gap-1.5 text-xs">
        <Star className="w-3 h-3" /> Already 5 Star — Best Efficiency Achieved
      </span>
    );
  }

  const currentIndex = table.findIndex((r) => r.star === row.star);
  const next = table[currentIndex - 1];
  if (!next) return null;

  const requiredKWh = (next.max / 365).toFixed(2);
  const improve = (currentKWh - requiredKWh).toFixed(2);
  return (
    <span className="flex items-center justify-center gap-1.5 text-xs">
      <ArrowUp className="w-3 h-3" />
      Reduce {improve} kWh/day to reach
      <Star className="w-3 h-3" /> {next.star}
    </span>
  );
};

/* ═══════════════════════════════════════════
   CALCULATOR PANEL (reusable for Hard/Glass)
═══════════════════════════════════════════ */
const CalcPanel = ({
  type,
  icon: Icon,
  accentColor,
  state,
  setState,
  otherState,
  setOtherState,
  table,
  setTable,
  calcFn,
  models,
  showList,
  setShowList,
  energyLabel,
}) => {
  const filteredModels = models.filter(
    (m) =>
      m.type === type &&
      m.model.toLowerCase().includes(state.model.toLowerCase()),
  );

  const achievedStar = getAchievedStar(table);
  const isQualified = typeof achievedStar === "number";

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
      {/* Panel header */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accentColor}`} />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            {type}
          </span>
        </div>
        {table.length > 0 && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
              isQualified
                ? STAR_BADGE_COLORS[achievedStar] ||
                  "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-red-50 text-red-600 border-red-200"
            }`}
          >
            <Star className="w-3 h-3" />
            {isQualified ? `${achievedStar} Star` : "Not Qualified"}
          </span>
        )}
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-auto p-4">
        {/* Model input with dropdown */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <InputField
            label="Model"
            value={state.model}
            disabled={!!otherState.model}
            onFocus={() => setShowList(true)}
            onChange={(e) => {
              setState({ ...state, model: e.target.value });
              setShowList(true);
              if (e.target.value)
                setOtherState({
                  ...otherState,
                  model: "",
                  energy: "",
                  volume: "",
                });
            }}
          />
          {showList && state.model && (
            <ul className="absolute w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 mt-1">
              {filteredModels.length > 0 ? (
                filteredModels.map((m, i) => (
                  <li
                    key={i}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 transition-colors"
                    onClick={() => {
                      setState({
                        model: m.model,
                        volume: m.volume,
                        energy: "",
                      });
                      setTable([]);
                      setShowList(false);
                    }}
                  >
                    <span className="font-medium">{m.model}</span>
                    <span className="text-slate-400 ml-2">— {m.volume}L</span>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-slate-400">
                  No models found
                </li>
              )}
            </ul>
          )}
        </div>

        <InputField label="Volume (L)" value={state.volume} disabled />

        <InputField
          label="Energy kWh/day"
          type="number"
          value={state.energy}
          onChange={(e) => {
            setState({ ...state, energy: e.target.value });
            setTable(calcFn(state.volume, e.target.value));
          }}
        />

        {/* Improvement hint */}
        {table.length > 0 && (
          <div className={`mt-3 text-center ${accentColor} font-semibold`}>
            {getNextStarImprovement(table, state.energy)}
          </div>
        )}

        {/* Results table */}
        {table.length > 0 && (
          <div className="mt-4">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100">
                  <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center">
                    Star
                  </th>
                  <th
                    colSpan={3}
                    className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center"
                  >
                    {energyLabel}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center">
                    Status
                  </th>
                </tr>
                <tr className="bg-slate-50">
                  <th className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-200"></th>
                  <th className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-200 text-center">
                    Min
                  </th>
                  <th className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-200 text-center">
                    Actual
                  </th>
                  <th className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-200 text-center">
                    Max
                  </th>
                  <th className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-200"></th>
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr
                    key={i}
                    className={`transition-colors ${
                      r.status === "TRUE"
                        ? "bg-emerald-50 font-bold"
                        : "hover:bg-blue-50/60 even:bg-slate-50/40"
                    }`}
                  >
                    <td className="px-3 py-2 border-b border-slate-100 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md text-white ${getStarClass(r.star)}`}
                      >
                        <Star className="w-2.5 h-2.5" /> {r.star}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-center font-mono text-slate-600">
                      {r.min.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-center font-mono text-slate-800 font-semibold">
                      {(r.Et ?? r.AEC)?.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-center font-mono text-slate-600">
                      {r.max.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-center">
                      <span
                        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          r.status === "TRUE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-50 text-red-500"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function BEECalculation() {
  const [models, setModels] = useState([]);
  const [hard, setHard] = useState({ model: "", volume: "", energy: "" });
  const [glass, setGlass] = useState({ model: "", volume: "", energy: "" });
  const [hardTable, setHardTable] = useState([]);
  const [glassTable, setGlassTable] = useState([]);

  const [showHardList, setShowHardList] = useState(false);
  const [showGlassList, setShowGlassList] = useState(false);
  const [showModelPopup, setShowModelPopup] = useState(false);
  const [newModel, setNewModel] = useState({
    model: "",
    volume: "",
    type: "",
  });
  const [searchModel, setSearchModel] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Fetch models ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${baseURL}quality/bee/models`);
        if (res.data?.success) setModels(res.data.models);
      } catch {
        toast.error("Failed to load models");
      }
    })();
  }, []);

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    const close = () => {
      setShowHardList(false);
      setShowGlassList(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  /* ── Save rating ── */
  const saveRating = async () => {
    if (!hard.model && !glass.model) {
      toast.error("Please enter either Hard Top or Glass Top.");
      return;
    }
    const payload = hard.model
      ? {
          hardModel: hard.model,
          hardRating: getAchievedStar(hardTable),
          glassModel: null,
          glassRating: null,
        }
      : {
          hardModel: null,
          hardRating: null,
          glassModel: glass.model,
          glassRating: getAchievedStar(glassTable),
        };
    setSaving(true);
    try {
      await axios.post(`${baseURL}quality/bee/save-rating`, payload);
      toast.success("BEE Rating saved successfully.");
      setHard({ model: "", volume: "", energy: "" });
      setGlass({ model: "", volume: "", energy: "" });
      setHardTable([]);
      setGlassTable([]);
    } catch {
      toast.error("Failed to save BEE Rating.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Save models ── */
  const saveModels = async () => {
    setSaving(true);
    try {
      await axios.post(`${baseURL}quality/bee/models`, models);
      toast.success("Models updated successfully.");
      setShowModelPopup(false);
    } catch {
      toast.error("Failed to save models.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Model CRUD ── */
  const addModel = () => {
    if (!newModel.model || !newModel.volume || !newModel.type)
      return toast.error("Please enter Model name, Volume and Type.");
    setModels((prev) => [...prev, newModel]);
    setNewModel({ model: "", volume: "", type: "" });
  };

  const deleteModel = async (name) => {
    try {
      await axios.delete(`${baseURL}quality/bee/models/${name}`);
      setModels((prev) => prev.filter((m) => m.model !== name));
      toast.success(`Model ${name} deleted.`);
    } catch {
      toast.error(`Failed to delete model ${name}.`);
    }
  };

  /* ── Computed ── */
  const hardStar = hardTable.length > 0 ? getAchievedStar(hardTable) : null;
  const glassStar = glassTable.length > 0 ? getAchievedStar(glassTable) : null;

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page sub-header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            BEE Star Rating Calculator
          </h1>
          <p className="text-[11px] text-slate-400">
            Bureau of Energy Efficiency · Hard Top & Glass Top rating
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hardStar && (
            <div
              className={`flex flex-col items-center px-4 py-1.5 rounded-lg border min-w-[90px] ${
                typeof hardStar === "number"
                  ? STAR_BADGE_COLORS[hardStar]
                  : "bg-red-50 border-red-200"
              }`}
            >
              <span className="text-xl font-bold font-mono flex items-center gap-1">
                <Star className="w-4 h-4" />
                {typeof hardStar === "number" ? hardStar : "—"}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide">
                Hard Top
              </span>
            </div>
          )}
          {glassStar && (
            <div
              className={`flex flex-col items-center px-4 py-1.5 rounded-lg border min-w-[90px] ${
                typeof glassStar === "number"
                  ? STAR_BADGE_COLORS[glassStar]
                  : "bg-red-50 border-red-200"
              }`}
            >
              <span className="text-xl font-bold font-mono flex items-center gap-1">
                <Star className="w-4 h-4" />
                {typeof glassStar === "number" ? glassStar : "—"}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide">
                Glass Top
              </span>
            </div>
          )}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-slate-700">
              {models.length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
              Models
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Actions bar ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Actions
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModelPopup(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-all"
              >
                <Settings className="w-4 h-4" /> Manage Models
              </button>
              <button
                onClick={saveRating}
                disabled={saving || (!hard.model && !glass.model)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  saving || (!hard.model && !glass.model)
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {saving ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save BEE Rating"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Two-panel calculators ── */}
        <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
          <CalcPanel
            type="Hard Top"
            icon={Thermometer}
            accentColor="text-blue-600"
            state={hard}
            setState={setHard}
            otherState={glass}
            setOtherState={setGlass}
            table={hardTable}
            setTable={setHardTable}
            calcFn={calcHard}
            models={models}
            showList={showHardList}
            setShowList={setShowHardList}
            energyLabel="Annual Energy (Et) kWh/year at 38°C"
          />
          <CalcPanel
            type="Glass Top"
            icon={GlassWater}
            accentColor="text-emerald-600"
            state={glass}
            setState={setGlass}
            otherState={hard}
            setOtherState={setHard}
            table={glassTable}
            setTable={setGlassTable}
            calcFn={calcGlass}
            models={models}
            showList={showGlassList}
            setShowList={setShowGlassList}
            energyLabel="Annual Energy (AEC) kWh/year at 38°C"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
         MODEL MASTER POPUP
      ═══════════════════════════════════════════ */}
      {showModelPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Popup header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-slate-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Model Master Management
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Add, edit or remove BEE models
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModelPopup(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  placeholder="Search model..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
                  value={searchModel}
                  onChange={(e) => setSearchModel(e.target.value.toLowerCase())}
                />
              </div>
            </div>

            {/* Model table */}
            <div className="flex-1 overflow-auto px-5 min-h-0">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left">
                      Model
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left">
                      Volume (L)
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left">
                      Type
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center w-16">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models
                    .filter((m) => m.model.toLowerCase().includes(searchModel))
                    .map((m, i) => (
                      <tr
                        key={i}
                        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                      >
                        <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800">
                          {m.model}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <input
                            type="number"
                            value={m.volume}
                            className="border border-slate-300 rounded-md px-2 py-1 w-20 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                            onChange={(e) => {
                              const arr = [...models];
                              arr[i].volume = e.target.value;
                              setModels(arr);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <div className="relative">
                            <select
                              value={m.type || "Not Defined"}
                              className="appearance-none border border-slate-300 rounded-md px-2 py-1 pr-7 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 w-full"
                              onChange={(e) => {
                                const arr = [...models];
                                arr[i].type = e.target.value;
                                setModels(arr);
                              }}
                            >
                              <option value="Not Defined">Not Defined</option>
                              <option value="Hard Top">Hard Top</option>
                              <option value="Glass Top">Glass Top</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-center">
                          <button
                            onClick={() => deleteModel(m.model)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {models.filter((m) =>
                    m.model.toLowerCase().includes(searchModel),
                  ).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <PackageOpen
                            className="w-10 h-10 opacity-20"
                            strokeWidth={1.2}
                          />
                          <p className="text-sm">No models found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add new model */}
            <div className="px-5 py-3 border-t border-slate-200 shrink-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Add New Model
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  placeholder="Model name"
                  value={newModel.model}
                  onChange={(e) =>
                    setNewModel({ ...newModel, model: e.target.value })
                  }
                  className="flex-1 min-w-[140px] border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
                <input
                  placeholder="Volume"
                  type="number"
                  value={newModel.volume}
                  onChange={(e) =>
                    setNewModel({ ...newModel, volume: e.target.value })
                  }
                  className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
                <div className="relative">
                  <select
                    value={newModel.type || "Not Defined"}
                    onChange={(e) =>
                      setNewModel({ ...newModel, type: e.target.value })
                    }
                    className="appearance-none border border-slate-300 rounded-lg px-3 py-2 pr-8 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 w-36"
                  >
                    <option value="Not Defined">Not Defined</option>
                    <option value="Hard Top">Hard Top</option>
                    <option value="Glass Top">Glass Top</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={addModel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {/* Popup footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setShowModelPopup(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-all"
              >
                Close
              </button>
              <button
                onClick={saveModels}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  saving
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {saving ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save Models"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

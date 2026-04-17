import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import SelectField from "../../components/ui/SelectField";
import Loader from "../../components/ui/Loader";
import PopupModal from "../../components/ui/PopupModal";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import {
  Thermometer,
  Zap,
  Battery,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  PackageOpen,
  Table2,
  ClipboardList,
  Factory,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Shield,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PARAM_CONFIG = [
  {
    key: "temp",
    label: "Temperature",
    unit: "\u00B0C",
    icon: Thermometer,
    color: "#ef4444",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    textClass: "text-rose-700",
    ringClass: "focus:ring-rose-200 focus:border-rose-400",
    minField: "minTemp",
    maxField: "maxTemp",
    dbMinKey: "MinTemp",
    dbMaxKey: "MaxTemp",
  },
  {
    key: "current",
    label: "Current",
    unit: "A",
    icon: Zap,
    color: "#f59e0b",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-700",
    ringClass: "focus:ring-amber-200 focus:border-amber-400",
    minField: "minCurr",
    maxField: "maxCurr",
    dbMinKey: "MinCurrent",
    dbMaxKey: "MaxCurrent",
  },
  {
    key: "power",
    label: "Power",
    unit: "W",
    icon: Battery,
    color: "#6366f1",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
    textClass: "text-indigo-700",
    ringClass: "focus:ring-indigo-200 focus:border-indigo-400",
    minField: "minPow",
    maxField: "maxPow",
    dbMinKey: "MinPower",
    dbMaxKey: "MaxPower",
  },
];

const INITIAL_FORM = {
  minTemp: "",
  maxTemp: "",
  minCurr: "",
  maxCurr: "",
  minPow: "",
  maxPow: "",
};

// ─── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, borderColor, sub }) => (
  <div
    className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]"
    style={{ borderTopWidth: 3, borderTopColor: borderColor }}
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${borderColor}18`, color: borderColor }}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ─── Param Input Card ──────────────────────────────────────────────────────────

const ParamInputCard = ({
  config,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}) => {
  const Icon = config.icon;
  return (
    <div
      className={`flex flex-col gap-3 p-4 ${config.bgClass} border ${config.borderClass} rounded-xl min-w-[200px]`}
    >
      <div
        className={`flex items-center justify-center gap-2 ${config.textClass}`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm font-bold">{config.label}</span>
        <span className="text-[10px] font-medium opacity-60">
          ({config.unit})
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Min
          </label>
          <input
            type="text"
            value={minValue}
            onChange={(e) => onMinChange(e.target.value)}
            placeholder="Min"
            className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 text-center outline-none ${config.ringClass} focus:ring-2 transition-all`}
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Max
          </label>
          <input
            type="text"
            value={maxValue}
            onChange={(e) => onMaxChange(e.target.value)}
            placeholder="Max"
            className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 text-center outline-none ${config.ringClass} focus:ring-2 transition-all`}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Table Empty ───────────────────────────────────────────────────────────────

const TableEmpty = () => (
  <tr>
    <td colSpan={20} className="py-10 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">No recipes available.</p>
      </div>
    </td>
  </tr>
);

// ─── Recipe Table ──────────────────────────────────────────────────────────────

const RecipeTable = ({ data, onUpdate, onDelete }) => {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = searchTerm
    ? data.filter((r) =>
        r.ModelName?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : data;

  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        const av = a[sort.key],
          bv = b[sort.key];
        if (av < bv) return sort.dir === "asc" ? -1 : 1;
        if (av > bv) return sort.dir === "asc" ? 1 : -1;
        return 0;
      })
    : filtered;

  const toggleSort = (key) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));

  if (!data || data.length === 0) return <TableEmpty />;

  return (
    <>
      {/* Search */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
        <span className="ml-auto text-[11px] text-slate-400">
          Showing {sorted.length} of {data.length}
        </span>
      </div>

      {/* Table — uses flex-1 + overflow to fill remaining space */}
      <div className="overflow-auto flex-1">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              <th
                className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
                rowSpan={2}
              >
                Sr No
              </th>
              <th
                onClick={() => toggleSort("ModelName")}
                className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap cursor-pointer hover:text-blue-600"
                rowSpan={2}
              >
                <span className="inline-flex items-center gap-1">
                  Model Name
                  {sort.key === "ModelName" &&
                    (sort.dir === "asc" ? (
                      <ArrowUp className="w-2.5 h-2.5" />
                    ) : (
                      <ArrowDown className="w-2.5 h-2.5" />
                    ))}
                </span>
              </th>
              {PARAM_CONFIG.map((p) => (
                <th
                  key={p.key}
                  colSpan={2}
                  className="px-3 py-2 font-semibold border-b border-slate-200 text-center whitespace-nowrap"
                  style={{ color: p.color }}
                >
                  <span className="inline-flex items-center gap-1">
                    <p.icon className="w-3 h-3" />
                    {p.label} ({p.unit})
                  </span>
                </th>
              ))}
              <th
                className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
                rowSpan={2}
              >
                Actions
              </th>
            </tr>
            <tr className="bg-slate-50">
              {PARAM_CONFIG.map((p) =>
                ["Min", "Max"].map((sub) => (
                  <th
                    key={`${p.key}-${sub}`}
                    className="px-3 py-2 font-medium text-slate-500 border-b border-slate-200 text-center whitespace-nowrap text-[10px] uppercase tracking-wide"
                  >
                    {sub}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
              >
                <td className="px-3 py-2.5 border-b border-slate-100 font-bold text-blue-600">
                  {i + 1}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 font-bold text-slate-800">
                  {item.ModelName}
                </td>
                {PARAM_CONFIG.map((p) => (
                  <>
                    <td
                      key={`${p.key}-min-${i}`}
                      className="px-3 py-2.5 border-b border-slate-100 text-slate-600 font-medium"
                    >
                      {item[p.dbMinKey] ?? "\u2014"}
                    </td>
                    <td
                      key={`${p.key}-max-${i}`}
                      className="px-3 py-2.5 border-b border-slate-100 text-slate-600 font-medium"
                    >
                      {item[p.dbMaxKey] ?? "\u2014"}
                    </td>
                  </>
                ))}
                <td className="px-3 py-2.5 border-b border-slate-100">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onUpdate(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-semibold hover:bg-blue-100 transition-colors"
                      title="Update"
                    >
                      <Pencil className="w-2.5 h-2.5" /> Edit
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold hover:bg-rose-100 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-2.5 h-2.5" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─── Update Modal Content ──────────────────────────────────────────────────────

const UpdateModalContent = ({ fields, setFields }) => (
  <div className="mt-4 text-left space-y-4">
    {/* Model Name Header */}
    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Model Name
          </label>
          <span className="text-sm font-bold text-slate-800">
            {fields.modelName}
          </span>
        </div>
        <span className="text-[10px] px-2.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-semibold border border-blue-200">
          Read Only
        </span>
      </div>
    </div>

    {/* Parameter Rows */}
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-3 bg-slate-100">
        {["Parameter", "Min Value", "Max Value"].map((h) => (
          <div key={h} className="px-3 py-2.5 text-center">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
              {h}
            </span>
          </div>
        ))}
      </div>

      {PARAM_CONFIG.map((p) => {
        const Icon = p.icon;
        return (
          <div
            key={p.key}
            className="grid grid-cols-3 border-t border-slate-200"
          >
            <div
              className={`${p.bgClass} px-3 py-3 flex items-center justify-center gap-2`}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
              <span className={`text-xs font-semibold ${p.textClass}`}>
                {p.label}
              </span>
            </div>
            <div className="bg-white px-3 py-2.5 flex items-center">
              <input
                type="text"
                value={fields[p.minField]}
                onChange={(e) =>
                  setFields({ ...fields, [p.minField]: e.target.value })
                }
                placeholder="Min"
                className={`w-full px-3 py-2 text-xs text-center text-slate-700 border border-slate-200 rounded-lg outline-none ${p.ringClass} focus:ring-2 transition-all`}
              />
            </div>
            <div className="bg-white px-3 py-2.5 flex items-center">
              <input
                type="text"
                value={fields[p.maxField]}
                onChange={(e) =>
                  setFields({ ...fields, [p.maxField]: e.target.value })
                }
                placeholder="Max"
                className={`w-full px-3 py-2 text-xs text-center text-slate-700 border border-slate-200 rounded-lg outline-none ${p.ringClass} focus:ring-2 transition-all`}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const LPTRecipe = () => {
  const [loading, setLoading] = useState(false);
  const [formFields, setFormFields] = useState({ ...INITIAL_FORM });
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFields, setUpdateFields] = useState({
    modelName: "",
    ...INITIAL_FORM,
  });
  const [recipes, setRecipes] = useState([]);

  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  const fetchRecipes = useCallback(async () => {
    try {
      const res = await axios.get(`${baseURL}quality/lpt-recipe`);
      if (res?.data?.success) setRecipes(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch recipes:", err);
      toast.error("Failed to fetch recipes.");
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleAddRecipe = async () => {
    if (
      !selectedModelVariant ||
      !formFields.minTemp ||
      !formFields.maxTemp ||
      !formFields.minCurr ||
      !formFields.maxCurr ||
      !formFields.minPow ||
      !formFields.maxPow
    ) {
      return toast.error("All fields are required.");
    }

    try {
      setLoading(true);
      await axios.post(`${baseURL}quality/lpt-recipe`, {
        matCode: selectedModelVariant.value,
        modelName: selectedModelVariant.label,
        ...formFields,
      });
      toast.success("Recipe added successfully.");
      fetchRecipes();
      setSelectedModelVariant(null);
      setFormFields({ ...INITIAL_FORM });
    } catch (err) {
      console.error(err);
      toast.error("Failed to add recipe.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (item) => {
    setUpdateFields({
      modelName: item.ModelName || "",
      minTemp: item.MinTemp || "",
      maxTemp: item.MaxTemp || "",
      minCurr: item.MinCurrent || "",
      maxCurr: item.MaxCurrent || "",
      minPow: item.MinPower || "",
      maxPow: item.MaxPower || "",
    });
    setShowUpdateModal(true);
  };

  const confirmUpdate = async () => {
    if (
      !updateFields.modelName ||
      !updateFields.minTemp ||
      !updateFields.maxTemp ||
      !updateFields.minCurr ||
      !updateFields.maxCurr ||
      !updateFields.minPow ||
      !updateFields.maxPow
    ) {
      toast.error("All fields are required.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.put(
        `${baseURL}quality/lpt-recipe/${updateFields.modelName}`,
        {
          minTemp: updateFields.minTemp,
          maxTemp: updateFields.maxTemp,
          minCurr: updateFields.minCurr,
          maxCurr: updateFields.maxCurr,
          minPow: updateFields.minPow,
          maxPow: updateFields.maxPow,
        },
      );
      if (res?.data?.success) {
        toast.success("Recipe updated successfully.");
        fetchRecipes();
        setShowUpdateModal(false);
      } else {
        toast.error(res.data.error || "Failed to update recipe.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error ||
          "Failed to update recipe. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(
        `${baseURL}quality/lpt-recipe/${itemToDelete.ModelName}`,
      );
      toast.success("Recipe deleted successfully.");
      fetchRecipes();
      setShowDeleteModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete recipe.");
    } finally {
      setLoading(false);
    }
  };

  const uniqueModels = new Set(recipes.map((r) => r.ModelName)).size;

  if (variantsLoading) return <Loader />;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            LPT Recipe
          </h1>
          <p className="text-[11px] text-slate-400">
            Life Performance Test · Recipe Configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {recipes.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Recipes
            </span>
          </div>
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-violet-700">
              {uniqueModels}
            </span>
            <span className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">
              Models
            </span>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── ADD RECIPE CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Plus className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Add New Recipe
            </p>
          </div>

          <div className="space-y-4">
            {/* Model Select */}
            <div className="max-w-xs">
              <SelectField
                label="Model Variant"
                options={[{ value: "", label: "Select Model" }, ...variants]}
                value={selectedModelVariant?.value || ""}
                onChange={(e) =>
                  setSelectedModelVariant(
                    variants.find((o) => o.value === e.target.value) || null,
                  )
                }
              />
            </div>

            {/* Parameter Cards */}
            <div className="flex flex-wrap gap-3">
              {PARAM_CONFIG.map((cfg) => (
                <ParamInputCard
                  key={cfg.key}
                  config={cfg}
                  minValue={formFields[cfg.minField]}
                  maxValue={formFields[cfg.maxField]}
                  onMinChange={(v) =>
                    setFormFields((f) => ({ ...f, [cfg.minField]: v }))
                  }
                  onMaxChange={(v) =>
                    setFormFields((f) => ({ ...f, [cfg.maxField]: v }))
                  }
                />
              ))}
            </div>

            {/* Add Button */}
            <div>
              <button
                onClick={handleAddRecipe}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {loading ? "Adding..." : "Add Recipe"}
              </button>
            </div>
          </div>
        </div>

        {/* ── SUMMARY KPIs ── */}
        {recipes.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Summary
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <KpiCard
                icon={ClipboardList}
                label="Total Recipes"
                value={recipes.length}
                borderColor="#6366f1"
              />
              <KpiCard
                icon={Factory}
                label="Unique Models"
                value={uniqueModels}
                borderColor="#8b5cf6"
              />
              <KpiCard
                icon={Thermometer}
                label="Temp Configs"
                value={recipes.filter((r) => r.MinTemp && r.MaxTemp).length}
                borderColor="#ef4444"
              />
              <KpiCard
                icon={Zap}
                label="Current Configs"
                value={
                  recipes.filter((r) => r.MinCurrent && r.MaxCurrent).length
                }
                borderColor="#f59e0b"
              />
              <KpiCard
                icon={Battery}
                label="Power Configs"
                value={recipes.filter((r) => r.MinPower && r.MaxPower).length}
                borderColor="#6366f1"
              />
            </div>
          </div>
        )}

        {/* ── RECIPE TABLE — flex-1 fills remaining height ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
            <Table2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Recipe List
            </span>
            <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
              {recipes.length} recipes
            </span>
          </div>
          <div className="p-4 flex flex-col flex-1 overflow-hidden">
            <RecipeTable
              data={recipes}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </div>
        </div>

        {/* ── Empty State ── */}
        {recipes.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">
              No Recipes Yet
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Add your first LPT recipe using the form above.
            </p>
          </div>
        )}
      </div>

      {/* ── UPDATE MODAL ── */}
      {showUpdateModal && (
        <PopupModal
          title="Update Recipe"
          description=""
          confirmText="Update"
          cancelText="Cancel"
          modalId="update-modal"
          onConfirm={confirmUpdate}
          onCancel={() => setShowUpdateModal(false)}
          icon={
            <Pencil className="text-blue-500 w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
          }
          confirmButtonColor="bg-blue-600 hover:bg-blue-700"
          modalClassName="w-[95%] max-w-md sm:max-w-xl md:max-w-3xl"
        >
          <UpdateModalContent
            fields={updateFields}
            setFields={setUpdateFields}
          />
        </PopupModal>
      )}

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <PopupModal
          title="Delete Confirmation"
          description={`Are you sure you want to delete the recipe for "${itemToDelete?.ModelName}"?`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          modalId="delete-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={
            <Trash2 className="text-rose-500 w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
          }
        />
      )}
    </div>
  );
};

export default LPTRecipe;

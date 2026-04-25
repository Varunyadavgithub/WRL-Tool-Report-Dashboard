import { useState, useEffect } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import SelectField from "../../components/ui/SelectField";
import InputField from "../../components/ui/InputField";
import Loader from "../../components/ui/Loader";
import { baseURL } from "../../assets/assets";
import {
  Search,
  Loader2,
  PackageOpen,
  ClipboardList,
  Plus,
  RefreshCw,
  CircleDot,
  CalendarRange,
  Layers,
  FileText,
  MessageSquare,
  Hash,
} from "lucide-react";

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const ProductionPlanning = () => {
  const { user } = useSelector((store) => store.auth);

  /* ── Loading ── */
  const [loading, setLoading] = useState(false);

  /* ── Dropdown options ── */
  const [planMonthOptions, setPlanMonthOptions] = useState([]);
  const [modelNameOptions, setModelNameOptions] = useState([]);

  /* ── Filter state ── */
  const [selectedPlanMonth, setSelectedPlanMonth] = useState(null);
  const [selectedModelName, setSelectedModelName] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("assembly");
  const [planQuantity, setPlanQuantity] = useState(0);
  const [remark, setRemark] = useState("");

  /* ── Data state ── */
  const [productionPlanningData, setProductionPlanningData] = useState([]);

  /* ── Fetch model names ── */
  const fetchModelName = async () => {
    try {
      const res = await axios.get(`${baseURL}planing/model-name`, {
        params: { plan: selectedPlan },
      });
      const data = res.data?.data || [];
      setModelNameOptions(
        data.map((item) => ({
          label: item?.Alias?.toString() || "N/A",
          value: item?.matCode?.toString() || "N/A",
        })),
      );
    } catch {
      toast.error("Failed to fetch model name.");
    }
  };

  /* ── Fetch plan month/year ── */
  const fetchPlanMonthYear = async () => {
    try {
      const res = await axios.get(`${baseURL}planing/plan-month-year`);
      const data = res.data?.data || [];
      setPlanMonthOptions(
        data.map((item) => ({
          label: item.PlanMonthYear.toString(),
          value: item.PlanMonthYear.toString(),
        })),
      );
    } catch {
      toast.error("Failed to fetch plan month year.");
    }
  };

  /* ── Fetch production planning data ── */
  const fetchProductionPlanningData = async () => {
    if (!selectedPlan || !selectedPlanMonth) {
      toast.error("Please select Plan Type and Plan Month Year.");
      return;
    }
    try {
      setLoading(true);
      const params = {
        planType: selectedPlan,
        planMonthYear: selectedPlanMonth.value,
      };
      if (selectedModelName) params.matcode = selectedModelName.value;

      const res = await axios.get(`${baseURL}planing/production-planing`, {
        params,
      });
      if (res?.data?.success) {
        setProductionPlanningData(res?.data?.data || []);
        toast.success("Production planning data fetched successfully.");
        setSelectedModelName(null);
        setSelectedPlanMonth(null);
      }
    } catch {
      toast.error("Failed to fetch production planning data.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Update production planning ── */
  const updateProductionPlanningData = async () => {
    if (
      !selectedModelName ||
      !selectedPlanMonth ||
      !planQuantity ||
      !remark ||
      !selectedPlan
    ) {
      toast.error("Please fill all required fields.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        planQty: planQuantity,
        userCode: user?.usercode,
        remark,
        matcode: selectedModelName.value,
        planMonthYear: selectedPlanMonth.value,
        planType: selectedPlan,
      };
      const res = await axios.put(
        `${baseURL}planing/update-production-plan`,
        payload,
      );
      if (res?.data?.success) {
        toast.success(res?.data?.message);
        resetForm();
      }
    } catch {
      toast.error("Failed to update production planning data.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Add plan ── */
  const handleAddPlan = async () => {
    if (
      !selectedModelName ||
      !selectedPlanMonth ||
      !planQuantity ||
      !remark ||
      !selectedPlan
    ) {
      toast.error("Please fill all required fields.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        planQty: planQuantity,
        userCode: user?.usercode,
        remark,
        matcode: selectedModelName.value,
        planMonthYear: selectedPlanMonth.value,
        planType: selectedPlan,
      };
      const res = await axios.put(
        `${baseURL}planing/add-production-plan`,
        payload,
      );
      if (res?.data?.success) {
        toast.success(res?.data?.message || "Plan added successfully");
        await fetchProductionPlanningData();
        resetForm();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to add production plan",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Handle update flow ── */
  const handleUpdate = async () => {
    try {
      await updateProductionPlanningData();
      await fetchProductionPlanningData();
      resetForm();
    } catch {
      toast.error("Update or fetch failed.");
    }
  };

  /* ── Reset form ── */
  const resetForm = () => {
    setSelectedModelName(null);
    setSelectedPlanMonth(null);
    setPlanQuantity(0);
    setRemark("");
  };

  /* ── Effects ── */
  useEffect(() => {
    fetchPlanMonthYear();
  }, []);

  useEffect(() => {
    fetchModelName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  /* ── Computed ── */
  const totalPlanQty = productionPlanningData.reduce(
    (acc, item) => acc + (Number(item.PlanQty) || 0),
    0,
  );
  const totalPrintLbl = productionPlanningData.reduce(
    (acc, item) => acc + (Number(item.PrintLbl) || 0),
    0,
  );

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page sub-header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Production Planning
          </h1>
          <p className="text-[11px] text-slate-400">
            Plan management · Model allocation · Monthly targets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {productionPlanningData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>
          {totalPlanQty > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {totalPlanQty.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Total Plan Qty
              </span>
            </div>
          )}
          {totalPrintLbl > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-amber-700">
                {totalPrintLbl.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">
                Total Print Lbl
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Filters + Form row ── */}
        <div className="flex gap-3 shrink-0">
          {/* Filters & Inputs card */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Plan Details
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[190px] flex-1">
                <SelectField
                  label="Model Name"
                  options={modelNameOptions}
                  value={selectedModelName?.value || ""}
                  onChange={(e) =>
                    setSelectedModelName(
                      modelNameOptions.find(
                        (opt) => opt.value === e.target.value,
                      ) || null,
                    )
                  }
                />
              </div>
              <div className="min-w-[190px] flex-1">
                <SelectField
                  label="Plan Month Year"
                  options={planMonthOptions}
                  value={selectedPlanMonth?.value || ""}
                  onChange={(e) =>
                    setSelectedPlanMonth(
                      planMonthOptions.find(
                        (opt) => opt.value === e.target.value,
                      ) || null,
                    )
                  }
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <InputField
                  label="Plan Quantity"
                  type="number"
                  placeholder="Enter Quantity"
                  name="planQuantity"
                  value={planQuantity}
                  onChange={(e) => setPlanQuantity(e.target.value)}
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <InputField
                  label="Remark"
                  type="text"
                  placeholder="Enter Remark"
                  name="remark"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Plan Type + Actions card */}
          <div className="w-64 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
              Plan Type
            </p>
            <p className="text-[10px] text-slate-400 mb-3">
              Select label type below.
            </p>

            {/* Radio buttons */}
            <div className="flex flex-col gap-2 mb-4">
              {(user.role === "admin" || user.role === "planning team") && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="plan"
                      value="assembly"
                      checked={selectedPlan === "assembly"}
                      onChange={() => setSelectedPlan("assembly")}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span
                      className={`text-sm font-medium transition-colors ${
                        selectedPlan === "assembly"
                          ? "text-slate-800"
                          : "text-slate-500 group-hover:text-slate-700"
                      }`}
                    >
                      Assembly Label
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="plan"
                      value="fg"
                      checked={selectedPlan === "fg"}
                      onChange={() => setSelectedPlan("fg")}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span
                      className={`text-sm font-medium transition-colors ${
                        selectedPlan === "fg"
                          ? "text-slate-800"
                          : "text-slate-500 group-hover:text-slate-700"
                      }`}
                    >
                      FG Label
                    </span>
                  </label>
                </>
              )}
              {user.role === "production manager" && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="plan"
                    value="assembly"
                    checked={selectedPlan === "assembly"}
                    onChange={() => setSelectedPlan("assembly")}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span
                    className={`text-sm font-medium transition-colors ${
                      selectedPlan === "assembly"
                        ? "text-slate-800"
                        : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    Assembly Label
                  </span>
                </label>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-auto">
              <button
                onClick={fetchProductionPlanningData}
                disabled={loading}
                className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Fetching..." : "Search"}
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200"
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Update
              </button>
              <button
                onClick={handleAddPlan}
                disabled={loading}
                className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
                }`}
              >
                <Plus className="w-4 h-4" />
                Add Plan
              </button>
            </div>
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Planning Data
              </span>
              {selectedPlan && (
                <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  <Layers className="w-3 h-3" />
                  {selectedPlan === "assembly" ? "Assembly Label" : "FG Label"}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {productionPlanningData.length > 0
                ? `${productionPlanningData.length} records`
                : ""}
            </span>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-auto min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                <Spinner cls="w-5 h-5" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (
              <table className="min-w-[1200px] w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {[
                      "Plan No.",
                      "Plan Month Year",
                      "Name",
                      "Plan Qty",
                      "Print Lbl",
                      "Plan Type",
                      "Remark",
                      "User Name",
                      "Created On",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productionPlanningData.length > 0 ? (
                    productionPlanningData.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                      >
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                          {item.PlanNo}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                          {item.PlanMonthYear}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                          {item.Alias}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                          {item.PlanQty}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                          {item.PrintLbl}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              item.PlanType === "assembly"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {item.PlanType}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                          {item.Remark}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                          {item.username}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                          {item.CreatedOn?.replace("T", " ").replace("Z", "")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <PackageOpen
                            className="w-12 h-12 opacity-20"
                            strokeWidth={1.2}
                          />
                          <p className="text-sm">
                            No data found. Apply filters and click Search.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionPlanning;

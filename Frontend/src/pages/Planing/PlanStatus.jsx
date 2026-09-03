import { useState, useEffect } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import SelectField from "../../components/ui/SelectField";
import InputField from "../../components/ui/InputField";
import { baseURL } from "../../assets/assets";
import {
  Search,
  Loader2,
  PackageOpen,
  Layers,
  CheckCircle2,
  XCircle,
  Plus,
  Pencil,
  X,
} from "lucide-react";

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const PlanStatus = () => {
  const { user } = useSelector((store) => store.auth);

  /* ── Loading ── */
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState(false);

  /* ── Add/Edit plan modal state ── */
  const [actionModal, setActionModal] = useState(null);
  const [actionPlanQty, setActionPlanQty] = useState("");
  const [actionRemark, setActionRemark] = useState("");

  /* ── Dropdown options ── */
  const [planMonthOptions, setPlanMonthOptions] = useState([]);

  /* ── Filter state ── */
  const [selectedPlanMonth, setSelectedPlanMonth] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("ASSEMBLY");

  /* ── Data state ── */
  const [planStatusData, setPlanStatusData] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  /* ── Table filter/search state ── */
  const [statusFilter, setStatusFilter] = useState("all");
  const [tableSearch, setTableSearch] = useState("");

  /* ── Plan type options (read-only page, available to every role) ── */
  const planTypeOptions = [
    { label: "Assembly Label", value: "ASSEMBLY" },
    { label: "FG Label", value: "FG" },
  ];

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

  /* ── Fetch plan status data ── */
  const fetchPlanStatusData = async () => {
    if (!selectedPlan || !selectedPlanMonth) {
      toast.error("Please select Plan Type and Plan Month Year.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}planing/plan-status`, {
        params: {
          planType: selectedPlan,
          planMonthYear: selectedPlanMonth.value,
        },
      });
      if (res?.data?.success) {
        setPlanStatusData(res?.data?.data || []);
        setHasSearched(true);
        setStatusFilter("all");
        setTableSearch("");
        toast.success("Plan status data fetched successfully.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch plan status data.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Open Add/Edit plan modal ── */
  const openActionModal = (item) => {
    setActionModal(item);
    setActionPlanQty(item.PlanNo ? item.PlanQty : 0);
    setActionRemark(item.PlanNo ? item.Remark || "" : "");
  };

  const closeActionModal = () => {
    setActionModal(null);
    setActionPlanQty("");
    setActionRemark("");
  };

  /* ── Save (add or update) plan from modal ── */
  const handleSaveAction = async () => {
    if (!actionPlanQty) {
      toast.error("Please enter Plan Quantity.");
      return;
    }
    const isPlanned = Boolean(actionModal.PlanNo);
    if (isPlanned && !actionRemark.trim()) {
      toast.error("Remark is required to update an existing plan.");
      return;
    }
    try {
      setSavingAction(true);
      const payload = {
        planQty: actionPlanQty,
        userCode: user?.usercode,
        remark: actionRemark,
        matcode: actionModal.MatCode,
        planMonthYear: selectedPlanMonth.value,
        planType: selectedPlan,
      };
      const res = await axios[isPlanned ? "put" : "post"](
        `${baseURL}planing/${isPlanned ? "update-production-plan" : "add-production-plan"}`,
        payload,
      );
      if (res?.data?.success) {
        toast.success(
          res?.data?.message ||
            (isPlanned
              ? "Plan updated successfully."
              : "Plan added successfully."),
        );
        closeActionModal();
        await fetchPlanStatusData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save plan.");
    } finally {
      setSavingAction(false);
    }
  };

  /* ── Effects ── */
  useEffect(() => {
    fetchPlanMonthYear();
  }, []);

  /* ── Computed ── */
  const plannedCount = planStatusData.filter((item) => item.PlanNo).length;
  const notPlannedCount = planStatusData.length - plannedCount;

  const filteredPlanStatusData = planStatusData
    .filter((item) => {
      if (statusFilter === "planned") return Boolean(item.PlanNo);
      if (statusFilter === "notplanned") return !item.PlanNo;
      return true;
    })
    .filter((item) => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.trim().toLowerCase();
      return [item.MatCode, item.Alias, item.Remark].some((field) =>
        field?.toString().toLowerCase().includes(q),
      );
    });

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page sub-header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Plan Status
          </h1>
          <p className="text-[11px] text-slate-400">
            Model-wise plan coverage · FG &amp; Assembly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {planStatusData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total Models
            </span>
          </div>
          {hasSearched && (
            <>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {plannedCount}
                </span>
                <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                  Planned
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-rose-50 border border-rose-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-rose-700">
                  {notPlannedCount}
                </span>
                <span className="text-[10px] text-rose-500 font-medium uppercase tracking-wide">
                  Not Planned
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Filters row ── */}
        {/* ── Filters (single card, Search inline) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Filters
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[190px] flex-1">
              <SelectField
                label="Plan Type"
                options={planTypeOptions}
                value={selectedPlan || ""}
                onChange={(e) => setSelectedPlan(e.target.value)}
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

            <div className="flex items-center gap-2 pb-0.5">
              <button
                onClick={fetchPlanStatusData}
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
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Fetching…" : "Search"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Plan Coverage
              </span>
              {selectedPlan && (
                <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  <Layers className="w-3 h-3" />
                  {selectedPlan === "ASSEMBLY" ? "Assembly Label" : "FG Label"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Status filter */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-semibold">
                {[
                  { key: "all", label: "All" },
                  { key: "planned", label: "Planned" },
                  { key: "notplanned", label: "Not Planned" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStatusFilter(opt.key)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      statusFilter === opt.key
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search Mat Code, Name, Remark..."
                  className="w-56 pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {filteredPlanStatusData.length > 0
                  ? `${filteredPlanStatusData.length} of ${planStatusData.length} records`
                  : ""}
              </span>
            </div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-auto min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                <Spinner cls="w-5 h-5" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (
              <table className="min-w-[1220px] w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {[
                      "Mat Code",
                      "Name",
                      "Status",
                      "Initial Plan",
                      "Plan Qty",
                      "Print Lbl",
                      "Remark",
                      "Created On",
                      "Action",
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
                  {filteredPlanStatusData.length > 0 ? (
                    filteredPlanStatusData.map((item, index) => {
                      const isPlanned = Boolean(item.PlanNo);
                      return (
                        <tr
                          key={index}
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        >
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                            {item.MatCode}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                            {item.Alias}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                            {isPlanned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />
                                Planned
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700">
                                <XCircle className="w-3 h-3" />
                                Not Planned
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                            {item.InitialPlanQty ?? "-"}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                            {item.PlanQty ?? "-"}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                            {item.PrintLbl ?? "-"}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.Remark || "-"}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                            {item.CreatedOn
                              ? item.CreatedOn.replace("T", " ").replace(
                                  "Z",
                                  "",
                                )
                              : "-"}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                            <button
                              onClick={() => openActionModal(item)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                isPlanned
                                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              }`}
                            >
                              {isPlanned ? (
                                <Pencil className="w-3 h-3" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              {isPlanned ? "Edit" : "Add"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <PackageOpen
                            className="w-12 h-12 opacity-20"
                            strokeWidth={1.2}
                          />
                          <p className="text-sm">
                            {planStatusData.length > 0
                              ? "No records match your filters."
                              : "No data found. Apply filters and click Search."}
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

      {/* ── Add/Edit Plan Modal ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {actionModal.PlanNo ? "Edit Plan" : "Add Plan"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {actionModal.MatCode} · {actionModal.Alias}
                </p>
              </div>
              <button
                onClick={closeActionModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <InputField
                label="Plan Quantity"
                type="number"
                placeholder="Enter Quantity"
                name="actionPlanQty"
                value={actionPlanQty}
                onChange={(e) => setActionPlanQty(e.target.value)}
              />
              <InputField
                label="Remark"
                type="text"
                placeholder="Enter Remark"
                name="actionRemark"
                value={actionRemark}
                onChange={(e) => setActionRemark(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={closeActionModal}
                disabled={savingAction}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAction}
                disabled={savingAction}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  savingAction
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
                }`}
              >
                {savingAction && <Spinner cls="w-4 h-4" />}
                {savingAction
                  ? "Saving..."
                  : actionModal.PlanNo
                    ? "Update"
                    : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanStatus;

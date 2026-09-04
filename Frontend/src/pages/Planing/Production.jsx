import { useState, useEffect } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
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
  Upload,
  CloudUpload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const Production = () => {
  const { user } = useSelector((store) => store.auth);

  /* ── Loading ── */
  const [loading, setLoading] = useState(false);

  /* ── Dropdown options ── */
  const [planMonthOptions, setPlanMonthOptions] = useState([]);
  const [modelNameOptions, setModelNameOptions] = useState([]);

  /* ── Filter state ── */
  const [selectedPlanMonth, setSelectedPlanMonth] = useState(null);
  const [selectedModelName, setSelectedModelName] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("ASSEMBLY");
  const [planQuantity, setPlanQuantity] = useState(0);
  const [remark, setRemark] = useState("");

  /* ── Data state ── */
  const [productionPlanningData, setProductionPlanningData] = useState([]);
  const [tableSearch, setTableSearch] = useState("");

  /* ── Bulk Excel upload state ── */
  const [bulkPlanFile, setBulkPlanFile] = useState("");
  const [bulkPlanData, setBulkPlanData] = useState([]);
  const [bulkUploadResults, setBulkUploadResults] = useState([]);

  /* ── Plan type options (role-gated: only planning/production roles can add/update plans;
     FG is restricted to super admin / planning team (PPC) for now) ── */
  const planTypeOptions = (() => {
    const assemblyRoles = [
      "super admin",
      "admin",
      "planning team",
      "production manager",
    ];
    const fgRoles = ["super admin", "planning team"];

    const options = [];
    if (assemblyRoles.includes(user.roleName)) {
      options.push({ label: "Assembly Label", value: "ASSEMBLY" });
    }
    if (fgRoles.includes(user.roleName)) {
      options.push({ label: "FG Label", value: "FG" });
    }
    return options;
  })();

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
        setTableSearch("");
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
      const res = await axios.post(
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

  /* ── Download bulk plan Excel template ── */
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Plan Template");

    sheet.columns = [
      { header: "PlanMonthYear", key: "planMonthYear", width: 16 },
      { header: "Material", key: "material", width: 28 },
      { header: "PlanQty", key: "planQty", width: 12 },
      { header: "PlanType", key: "planType", width: 12 },
      { header: "Remark", key: "remark", width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A8A" },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    });
    sheet.addRow({
      planMonthYear: 82026,
      material: "SRC460HC1-XVBIKEBKBU",
      planQty: 1000,
      planType: "FG",
      remark: "",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "production-plan-template.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /* ── Parse bulk plan Excel file ── */
  const handleBulkFileParse = async () => {
    if (!bulkPlanFile) {
      toast.error("Please select a valid Excel file.");
      return;
    }
    setLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const reader = new FileReader();

      reader.onload = async (e) => {
        const buffer = e.target.result;
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        const rows = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const planMonthYear = row.getCell(1).value?.toString().trim();
          const material = row.getCell(2).value?.toString().trim();
          const planQty = row.getCell(3).value?.toString().trim();
          const planType = row.getCell(4).value?.toString().trim();
          const rowRemark = row.getCell(5).value?.toString().trim() || "";

          if (planMonthYear && material && planQty && planType) {
            rows.push({
              planMonthYear: parseInt(planMonthYear),
              material,
              planQty: parseInt(planQty),
              planType: planType.toUpperCase(),
              remark: rowRemark,
            });
          }
        });

        if (rows.length === 0) {
          toast.error("No valid data found in the file.");
          setLoading(false);
          return;
        }
        setBulkPlanData(rows);
        setBulkUploadResults([]);
        toast.success("Excel file parsed successfully.");
        setLoading(false);
      };

      reader.readAsArrayBuffer(bulkPlanFile);
    } catch {
      toast.error("Failed to process the Excel file.");
      setLoading(false);
    }
  };

  /* ── Upload parsed bulk plan data ── */
  const handleBulkAddPlan = async () => {
    if (bulkPlanData.length === 0) {
      toast.error("No parsed plan data to upload.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        userCode: user?.usercode,
        plans: bulkPlanData,
      };
      const res = await axios.post(
        `${baseURL}planing/bulk-add-production-plan`,
        payload,
      );
      if (res?.data?.success) {
        toast.success(
          `${res.data.successCount} plan(s) added/updated${
            res.data.failedCount ? `, ${res.data.failedCount} failed` : ""
          }.`,
        );
        setBulkUploadResults([
          ...(res.data.successfulUploads || []),
          ...(res.data.failedUploads || []),
        ]);
        if (selectedPlan && selectedPlanMonth) {
          await fetchProductionPlanningData();
        }
        setBulkPlanData([]);
        setBulkPlanFile("");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to upload plans from Excel.",
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

  /* ── Fill Plan Details form from a clicked row ── */
  const handleSelectPlanRow = (item) => {
    setSelectedPlan(item.PlanType);
    setSelectedPlanMonth({
      label: String(item.PlanMonthYear),
      value: String(item.PlanMonthYear),
    });
    setSelectedModelName({
      label: item.Alias,
      value: String(item.MatCode),
    });
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

  const filteredPlanningData = tableSearch.trim()
    ? productionPlanningData.filter((item) => {
        const q = tableSearch.trim().toLowerCase();
        return [item.PlanNo, item.Alias, item.Remark, item.username].some(
          (field) => field?.toString().toLowerCase().includes(q),
        );
      })
    : productionPlanningData;

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
        {/* ── Filters + Actions (single card, Barcode-style) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Layers className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filter Plan
            </p>
          </div>

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

            {/* Action buttons — inline, Barcode-style */}
            <div className="flex items-center gap-2 pb-0.5">
              <button
                onClick={fetchProductionPlanningData}
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

              <button
                onClick={handleUpdate}
                disabled={loading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Update
              </button>

              <button
                onClick={handleAddPlan}
                disabled={loading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                }`}
              >
                <Plus className="w-4 h-4" />
                Add Plan
              </button>
            </div>
          </div>
        </div>

        {/* ── Bulk Add via Excel ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Bulk Add via Excel
              </p>
            </div>
            <span className="text-[10px] text-slate-400">
              Columns: PlanMonthYear, Material (Alias), PlanQty, PlanType
              (FG/ASSEMBLY), Remark (optional)
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[220px]">
              <InputField
                label="Plan Excel File"
                type="file"
                name="bulkPlanFile"
                onChange={(e) => setBulkPlanFile(e.target.files[0])}
                accept=".xlsx, .xls"
              />
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>

              {bulkPlanFile && (
                <button
                  onClick={handleBulkFileParse}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {loading ? "Processing…" : "Preview File"}
                </button>
              )}

              {bulkPlanData.length > 0 && (
                <button
                  onClick={handleBulkAddPlan}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  }`}
                >
                  {loading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <CloudUpload className="w-4 h-4" />
                  )}
                  {loading
                    ? "Uploading…"
                    : `Upload ${bulkPlanData.length} Plan(s)`}
                </button>
              )}
            </div>
          </div>

          {bulkPlanData.length > 0 && (
            <div className="mt-3 max-h-40 overflow-auto border border-slate-100 rounded-lg">
              <table className="min-w-[700px] w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {[
                      "Plan Month Year",
                      "Material",
                      "Plan Qty",
                      "Plan Type",
                      "Remark",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 text-slate-400" />
                          {h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkPlanData.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                    >
                      <td className="px-3 py-1.5 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                        {item.planMonthYear}
                      </td>
                      <td className="px-3 py-1.5 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                        {item.material}
                      </td>
                      <td className="px-3 py-1.5 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                        {item.planQty}
                      </td>
                      <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-700">
                          {item.planType}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                        {item.remark || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bulkUploadResults.length > 0 && (
            <div className="mt-3 max-h-52 overflow-auto border border-slate-100 rounded-lg">
              <table className="min-w-[700px] w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {["Status", "Material", "Plan No.", "Detail"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkUploadResults.map((item, index) => {
                    const isSuccess = item.status === "success";
                    return (
                      <tr
                        key={index}
                        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                      >
                        <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {item.action === "updated" ? "Updated" : "Added"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                          {item.material || item.row?.material || "-"}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                          {item.planNo ?? "-"}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                          {item.reason || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Data Table ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Plan Details
              </span>
              {selectedPlan && (
                <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  <Layers className="w-3 h-3" />
                  {selectedPlan === "ASSEMBLY" ? "Assembly Label" : "FG Label"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search Plan No, Name, Remark, User..."
                  className="w-64 pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {filteredPlanningData.length > 0
                  ? `${filteredPlanningData.length} of ${productionPlanningData.length} records`
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
              <table className="min-w-[1320px] w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {[
                      "Plan No.",
                      "Plan Month Year",
                      "Name",
                      "Initial Plan",
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
                  {filteredPlanningData.length > 0 ? (
                    filteredPlanningData.map((item, index) => (
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
                        <td
                          onClick={() => handleSelectPlanRow(item)}
                          title="Click to load this plan into Plan Details above"
                          className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap cursor-pointer hover:text-blue-600 hover:underline"
                        >
                          {item.Alias}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                          {item.InitialPlanQty ?? "-"}
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
                              item.PlanType === "ASSEMBLY"
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
                      <td colSpan={10} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <PackageOpen
                            className="w-12 h-12 opacity-20"
                            strokeWidth={1.2}
                          />
                          <p className="text-sm">
                            {productionPlanningData.length > 0
                              ? "No records match your search."
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
    </div>
  );
};

export default Production;

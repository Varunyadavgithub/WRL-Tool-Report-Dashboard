import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import InputField from "../../components/ui/InputField";
import Loader from "../../components/ui/Loader";
import { baseURL } from "../../assets/assets";
import {
  Loader2,
  Upload,
  CloudUpload,
  PackageOpen,
  CalendarDays,
  FileSpreadsheet,
  ClipboardList,
  Database,
  Layers,
} from "lucide-react";

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const DailyPlan = () => {
  /* ── State ── */
  const [loading, setLoading] = useState(false);
  const [dailyPlanFile, setDailyPlanFile] = useState("");
  const [dailyPlanData, setDailyPlan] = useState([]);
  const [existingPlans, setExistingPlans] = useState([]);

  /* ── Fetch existing plans on mount ── */
  useEffect(() => {
    fetchDailyPlans();
  }, []);

  /* ── Upload & parse Excel ── */
  const handleUpload = async () => {
    if (!dailyPlanFile) {
      toast.error("Please upload a valid Excel file.");
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
        const planData = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const srNo = row.getCell(1).value?.toString().trim();
          const shiftName = row.getCell(2).value?.toString().trim();
          const planQty = row.getCell(3).value?.toString().trim();
          const departmentName = row.getCell(4).value?.toString().trim();
          const workCenterAlias = row.getCell(5).value?.toString().trim();

          if (srNo && shiftName && planQty && departmentName && workCenterAlias) {
            planData.push({
              srNo,
              shiftName,
              planQty: parseInt(planQty),
              departmentName,
              workCenterAlias,
            });
          }
        });

        if (planData.length === 0) {
          toast.error("No valid data found in the file.");
          setLoading(false);
          return;
        }
        setDailyPlan(planData);
        toast.success("Daily plan file uploaded successfully.");
        setLoading(false);
      };

      reader.readAsArrayBuffer(dailyPlanFile);
    } catch {
      toast.error("Failed to process the Excel file.");
      setLoading(false);
    }
  };

  /* ── Fetch existing daily plans ── */
  const fetchDailyPlans = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}planing/daily-plans`);
      if (res?.data?.success) {
        setExistingPlans(res?.data?.data || []);
      }
    } catch {
      toast.error("Failed to fetch daily plans");
    } finally {
      setLoading(false);
    }
  };

  /* ── Upload plan to server ── */
  const handleAddPlan = async () => {
    if (dailyPlanData.length === 0) {
      toast.error("No daily plan data to upload.");
      return;
    }
    setLoading(true);
    try {
      const payload = dailyPlanData.map((plan) => ({
        shift: plan.shiftName,
        planQty: plan.planQty,
        department: plan.departmentName,
        station: plan.workCenterAlias,
      }));

      const res = await axios.post(
        `${baseURL}planing/upload-daily-plan`,
        payload
      );
      if (res?.data?.success) {
        toast.success("Plan Uploaded Successfully.");
        await fetchDailyPlans();
        setDailyPlan([]);
        setDailyPlanFile("");
      }
    } catch {
      toast.error("Failed to upload daily plans");
    } finally {
      setLoading(false);
    }
  };

  /* ── Computed ── */
  const totalUploadedQty = dailyPlanData.reduce(
    (acc, item) => acc + (Number(item.planQty) || 0),
    0
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
            Daily Plan
          </h1>
          <p className="text-[11px] text-slate-400">
            Upload shift plans · Track existing daily schedules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {dailyPlanData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Uploaded Rows
            </span>
          </div>
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-emerald-700">
              {existingPlans.length}
            </span>
            <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
              Existing Plans
            </span>
          </div>
          {totalUploadedQty > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-amber-700">
                {totalUploadedQty.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">
                Upload Qty
              </span>
            </div>
          )}

        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Upload card ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Upload Plan
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[220px]">
              <InputField
                label="Daily Plan File"
                type="file"
                name="dailyPlanFile"
                onChange={(e) => setDailyPlanFile(e.target.files[0])}
                accept=".xlsx, .xls"
              />
            </div>

            {dailyPlanFile && (
              <button
                onClick={handleUpload}
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
                  <Upload className="w-4 h-4" />
                )}
                {loading ? "Processing..." : "Upload File"}
              </button>
            )}

            {dailyPlanData.length > 0 && (
              <button
                onClick={handleAddPlan}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                {loading ? "Uploading..." : "Upload Plan"}
              </button>
            )}
          </div>
        </div>

        {/* ── Two-panel data area ── */}
        <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
          {/* ── Left: Uploaded Plan Data ── */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Uploaded Plan Data
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {dailyPlanData.length > 0
                  ? `${dailyPlanData.length} records`
                  : ""}
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto min-w-0">
              {loading && dailyPlanData.length === 0 ? (
                <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                  <Spinner cls="w-5 h-5" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <table className="min-w-[600px] w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "Sr No.",
                        "Shift Name",
                        "Plan Qty",
                        "Department Name",
                        "Work Center Alias",
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
                    {dailyPlanData.length > 0 ? (
                      dailyPlanData.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        >
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                            {item.srNo}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                            {item.shiftName}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                            {item.planQty}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.departmentName}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.workCenterAlias}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <PackageOpen
                              className="w-12 h-12 opacity-20"
                              strokeWidth={1.2}
                            />
                            <p className="text-sm">
                              No uploaded data. Select an Excel file and click
                              Upload File.
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

          {/* ── Right: Existing Daily Plans ── */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Existing Daily Plans
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {existingPlans.length > 0
                  ? `${existingPlans.length} records`
                  : ""}
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto min-w-0">
              {loading && existingPlans.length === 0 ? (
                <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                  <Spinner cls="w-5 h-5" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <table className="min-w-[900px] w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "Sr No.",
                        "Ref No.",
                        "Ref Date",
                        "Plan Date",
                        "Shift",
                        "Plan Qty",
                        "Department",
                        "Alias",
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
                    {existingPlans.length > 0 ? (
                      existingPlans.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        >
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                            {item.RefNo}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                            {item.RefDate?.replace("T", " ").replace("Z", "")}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.PlanDate?.split("T")[0]}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-700">
                              {item.Shift}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                            {item.PlanQty}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.Department}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.Alias}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <PackageOpen
                              className="w-12 h-12 opacity-20"
                              strokeWidth={1.2}
                            />
                            <p className="text-sm">
                              No existing plans found.
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
    </div>
  );
};

export default DailyPlan;
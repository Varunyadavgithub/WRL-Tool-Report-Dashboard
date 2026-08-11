import { useEffect, useState } from "react";
import { Save, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  FieldLabel, inputCls, SectionCard, EquipmentEditor, ReportHeaderFields, OverrideToggle,
  mapHeaderToFormState, mapRowToCamel, mapEquipmentToFormState,
} from "./shared";

const LOCATIONS = ["Front", "Right", "Left"];
const emptyMeasurements = () => LOCATIONS.map((location) => ({ location, specificationLimit: "<65 dBA", backgroundNoiseDba: "", measuredNoiseDba: "", status: "PASS" }));

// Reads the leading number out of a spec string like "<65 dBA" — the sheet's
// per-location Status column is just Measured vs this threshold.
const parseThreshold = (specText) => {
  const match = String(specText || "").match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

const BISSoundReportForm = ({ initialData, prefillHeader, models, onSave, onCancel, saving, onCopyEquipment, copyingEquipment }) => {
  const [header, setHeader] = useState({ result: "PASS", testStandard: "IS 7872 : 2020 Deep Freezers - Specification (Clause 7)", ...prefillHeader });
  const [measurements, setMeasurements] = useState(emptyMeasurements());
  const [equipment, setEquipment] = useState([]);
  const [statusOverride, setStatusOverride] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setHeader(mapHeaderToFormState(initialData.header));
    const rows = (initialData.testData?.measurements || []).map(mapRowToCamel);
    setMeasurements(LOCATIONS.map((location) => rows.find((r) => r.location === location) || { location, specificationLimit: "<65 dBA", backgroundNoiseDba: "", measuredNoiseDba: "", status: "PASS" }));
    setEquipment(mapEquipmentToFormState(initialData.equipment));
  }, [initialData]);

  const setHeaderField = (field) => (value) => setHeader((p) => ({ ...p, [field]: value }));

  const setMeasurement = (idx, field, value) => {
    setMeasurements((prev) => prev.map((m, i) => {
      if (i !== idx) return m;
      const updated = { ...m, [field]: value };
      if (!statusOverride && (field === "measuredNoiseDba" || field === "specificationLimit")) {
        const threshold = parseThreshold(updated.specificationLimit);
        const measured = Number(updated.measuredNoiseDba);
        if (threshold !== null && updated.measuredNoiseDba !== "" && !Number.isNaN(measured)) {
          updated.status = measured < threshold ? "PASS" : "FAIL";
        }
      }
      return updated;
    }));
  };

  // Overall Result mirrors the per-location statuses — any FAIL location
  // fails the whole report, same as the sheet. Skipped while manually
  // overridden so the user's own call sticks.
  useEffect(() => {
    if (statusOverride) return;
    if (!measurements.some((m) => m.measuredNoiseDba !== "" && m.measuredNoiseDba !== undefined)) return;
    setHeader((p) => ({ ...p, result: measurements.some((m) => m.status === "FAIL") ? "FAIL" : "PASS" }));
  }, [measurements, statusOverride]);

  const handleCopyFromLast = async () => {
    const eq = await onCopyEquipment();
    if (eq) setEquipment(eq);
  };

  const handleSubmit = (status) => {
    if (!header.modelName) return toast.error("Select a model");
    if (!header.testDateTo) return toast.error("Test Date To is required");
    onSave({ reportType: "Sound", header, testData: { measurements }, equipment }, status);
  };

  return (
    <div className="flex flex-col gap-4">
      <ReportHeaderFields header={header} onChange={setHeaderField} models={models} showIntroFields={false} resultReadOnly={!statusOverride} />

      <SectionCard title="Sound Level Test">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-slate-400">Noise level measured at 1.1 m from each side (except back) and 1.2 m above the floor. Status is calculated from Measured vs Specification.</p>
          <OverrideToggle active={statusOverride} onToggle={() => setStatusOverride((v) => !v)} />
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {["Location", "Specification", "Background Noise (dBA)", "Measured Noise (dBA)", "Status"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {measurements.map((m, idx) => (
                <tr key={m.location}>
                  <td className="px-2 py-1.5 border-b border-slate-100 font-semibold text-slate-700">{m.location}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="text" value={m.specificationLimit || ""} onChange={(e) => setMeasurement(idx, "specificationLimit", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="number" step="any" value={m.backgroundNoiseDba ?? ""} onChange={(e) => setMeasurement(idx, "backgroundNoiseDba", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><input type="number" step="any" value={m.measuredNoiseDba ?? ""} onChange={(e) => setMeasurement(idx, "measuredNoiseDba", e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1.5 border-b border-slate-100">
                    {statusOverride ? (
                      <select value={m.status || "PASS"} onChange={(e) => setMeasurement(idx, "status", e.target.value)} className={inputCls}>
                        <option value="PASS">PASS</option>
                        <option value="FAIL">FAIL</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${m.status === "FAIL" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {m.status || "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <EquipmentEditor equipment={equipment} onChange={setEquipment} onCopyFromLast={handleCopyFromLast} copying={copyingEquipment} />

      <div className="flex items-center justify-end gap-3 pb-4">
        <button type="button" onClick={onCancel} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button type="button" onClick={() => handleSubmit("Draft")} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> Save Draft
        </button>
        <button type="button" onClick={() => handleSubmit("Final")} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50">
          <Send className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Submit Final"}
        </button>
      </div>
    </div>
  );
};

export default BISSoundReportForm;

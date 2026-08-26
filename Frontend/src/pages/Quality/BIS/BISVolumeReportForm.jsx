import { useEffect, useMemo, useState } from "react";
import { Save, Send, X, Plus, Trash2, Calculator } from "lucide-react";
import toast from "react-hot-toast";
import {
  FieldLabel, inputCls, computedInputCls, SectionCard, ResultToggle, EquipmentEditor, ReportHeaderFields,
  OverrideToggle, mapHeaderToFormState, mapRowToCamel, mapEquipmentToFormState, round,
} from "./shared";

const CATEGORY_GROUPS = [
  { category: "GrossMeasured", title: "Gross Volume — Measured" },
  { category: "GrossDeductible", title: "Gross Volume — Deductible" },
  { category: "StorageMeasured", title: "Storage Volume — Measured" },
  { category: "StorageDeductible", title: "Storage Volume — Deductible" },
];

const emptyItem = (category) => ({ category, partName: "", widthMm: "", depthMm: "", heightMm: "", quantity: 1, volumeLitre: "" });

// A formula-derived field — read-only unless the section's override is
// unlocked, in which case it behaves like any other number input.
const CalcField = ({ label, value, onChange, override }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    {override ? (
      <input type="number" step="any" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    ) : (
      <input type="text" readOnly value={value ?? ""} className={computedInputCls} placeholder="Calculated" />
    )}
  </div>
);

const VolumeItemsTable = ({ title, category, items, onChange, override }) => {
  const rows = items.filter((i) => i.category === category);
  const setRows = (newRows) => onChange([...items.filter((i) => i.category !== category), ...newRows]);

  const addRow = () => setRows([...rows, emptyItem(category)]);
  const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx));
  // Volume (L) = Width × Depth × Height (mm) × Qty / 1,000,000 — the exact
  // formula in the "Freezer Volume" sheet's Volume column. Re-derives live
  // whenever a dimension/qty changes, unless the section is unlocked for
  // manual override (then a dimension edit won't clobber the typed value).
  const updateRow = (idx, field, value) => setRows(rows.map((r, i) => {
    if (i !== idx) return r;
    const updated = { ...r, [field]: value };
    if (!override && ["widthMm", "depthMm", "heightMm", "quantity"].includes(field)) {
      const w = Number(updated.widthMm), d = Number(updated.depthMm), h = Number(updated.heightMm), q = Number(updated.quantity);
      if (w && d && h && q) updated.volumeLitre = round((w * d * h * q) / 1_000_000, 5);
    }
    return updated;
  }));

  const sumLitre = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.volumeLitre) || 0), 0), [rows]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Sum: {sumLitre.toFixed(3)} L</span>
          <button type="button" onClick={addRow} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all">
            <Plus className="w-3 h-3" /> Add Row
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No rows added.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr>
              {["Part / Compartment", "Width (mm)", "Depth (mm)", "Height (mm)", "Qty", "Volume (L)", ""].map((h) => (
                <th key={h} className="px-2 py-1 text-left font-semibold text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1 border-b border-slate-100"><input type="text" value={row.partName} onChange={(e) => updateRow(idx, "partName", e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-1 border-b border-slate-100"><input type="number" step="any" value={row.widthMm} onChange={(e) => updateRow(idx, "widthMm", e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-1 border-b border-slate-100"><input type="number" step="any" value={row.depthMm} onChange={(e) => updateRow(idx, "depthMm", e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-1 border-b border-slate-100"><input type="number" step="any" value={row.heightMm} onChange={(e) => updateRow(idx, "heightMm", e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-1 border-b border-slate-100"><input type="number" value={row.quantity} onChange={(e) => updateRow(idx, "quantity", e.target.value)} className={`${inputCls} w-16`} /></td>
                <td className="px-2 py-1 border-b border-slate-100">
                  {override ? (
                    <input type="number" step="any" value={row.volumeLitre} onChange={(e) => updateRow(idx, "volumeLitre", e.target.value)} className={inputCls} />
                  ) : (
                    <input type="text" readOnly value={row.volumeLitre} className={computedInputCls} placeholder="Calculated" />
                  )}
                </td>
                <td className="px-2 py-1 border-b border-slate-100">
                  <button type="button" onClick={() => removeRow(idx)} className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const BISVolumeReportForm = ({ initialData, prefillHeader, models, onSave, onCancel, saving, onCopyEquipment, copyingEquipment }) => {
  const [header, setHeader] = useState({ testStandard: "IS 7872 : 2020 Deep Freezers - Specification (Clause 8)", ...prefillHeader });
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ grossResult: "PASS", storageResult: "PASS" });
  const [equipment, setEquipment] = useState([]);
  const [itemsOverride, setItemsOverride] = useState(false);
  const [summaryOverride, setSummaryOverride] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setHeader(mapHeaderToFormState(initialData.header));
    setItems((initialData.testData?.items || []).map(mapRowToCamel));
    setSummary(mapRowToCamel(initialData.testData?.summary) || { grossResult: "PASS", storageResult: "PASS" });
    setEquipment(mapEquipmentToFormState(initialData.equipment));
  }, [initialData]);

  const setHeaderField = (field) => (value) => setHeader((p) => ({ ...p, [field]: value }));
  const setSummaryField = (field) => (e) => setSummary((p) => ({ ...p, [field]: e.target?.value ?? e }));

  const handleCopyFromLast = async () => {
    const eq = await onCopyEquipment();
    if (eq) setEquipment(eq);
  };

  // Mirrors the sheet's Gross/Storage totals: Measured = SUM(Measured items)
  // − SUM(Deductible items); Observation % = (Measured − Declared) / Declared;
  // PASS when the shortfall isn't worse than the sheet's 3% tolerance.
  const handleRecalculateSummary = () => {
    const sumBy = (category) => items.filter((i) => i.category === category).reduce((s, i) => s + (Number(i.volumeLitre) || 0), 0);
    const grossTotalMeasuredLitre = round(sumBy("GrossMeasured"), 3);
    const grossTotalDeductibleLitre = round(sumBy("GrossDeductible"), 3);
    const grossMeasuredLitre = round(grossTotalMeasuredLitre - grossTotalDeductibleLitre, 3);
    const storageTotalMeasuredLitre = round(sumBy("StorageMeasured"), 3);
    const storageTotalDeductibleLitre = round(sumBy("StorageDeductible"), 3);
    const storageMeasuredLitre = round(storageTotalMeasuredLitre - storageTotalDeductibleLitre, 3);

    const grossDeclared = Number(summary.grossDeclaredLitre);
    const storageDeclared = Number(summary.storageDeclaredLitre);
    const grossObservationPercent = grossDeclared ? round(((grossMeasuredLitre - grossDeclared) / grossDeclared) * 100, 3) : null;
    const storageObservationPercent = storageDeclared ? round(((storageMeasuredLitre - storageDeclared) / storageDeclared) * 100, 3) : null;

    setSummary((p) => ({
      ...p,
      grossTotalMeasuredLitre, grossTotalDeductibleLitre, grossMeasuredLitre,
      storageTotalMeasuredLitre, storageTotalDeductibleLitre, storageMeasuredLitre,
      ...(grossObservationPercent !== null && { grossObservationPercent, grossResult: grossObservationPercent >= -3 ? "PASS" : "FAIL" }),
      ...(storageObservationPercent !== null && { storageObservationPercent, storageResult: storageObservationPercent >= -3 ? "PASS" : "FAIL" }),
    }));
    setSummaryOverride(false);
    toast.success("Volume totals recalculated");
  };

  const handleSubmit = (status) => {
    if (!header.modelName) return toast.error("Select a model");
    if (!header.testDateTo) return toast.error("Test Date To is required");
    onSave({ reportType: "Volume", header, testData: { items, summary }, equipment }, status);
  };

  return (
    <div className="flex flex-col gap-4">
      <ReportHeaderFields header={header} onChange={setHeaderField} models={models} showIntroFields={false} />

      <SectionCard title="Freezer Volume Measurement">
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div><FieldLabel>Test Ambient — Spec</FieldLabel><input type="text" value={summary.testAmbientSpec || ""} onChange={setSummaryField("testAmbientSpec")} className={inputCls} placeholder="e.g. 25 ±5°C" /></div>
          <div><FieldLabel>Test Ambient — Measured</FieldLabel><input type="text" value={summary.testAmbientMeasured || ""} onChange={setSummaryField("testAmbientMeasured")} className={inputCls} /></div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-slate-400">Volume (L) per row is calculated from Width × Depth × Height × Qty.</p>
          <OverrideToggle active={itemsOverride} onToggle={() => setItemsOverride((v) => !v)} />
        </div>
        {CATEGORY_GROUPS.map((g) => (
          <VolumeItemsTable key={g.category} title={g.title} category={g.category} items={items} onChange={setItems} override={itemsOverride} />
        ))}

        <div className="border-t border-slate-100 pt-3 mt-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400">Enter Declared values, then recalculate Measured/Observation/Result from the item tables above.</p>
            <div className="flex items-center gap-2 shrink-0">
              <OverrideToggle active={summaryOverride} onToggle={() => setSummaryOverride((v) => !v)} />
              <button type="button" onClick={handleRecalculateSummary}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-all">
                <Calculator className="w-3.5 h-3.5" /> Recalculate
              </button>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-700 mb-2">Gross Volume Result</p>
          <div className="grid md:grid-cols-4 gap-3 mb-3">
            <div><FieldLabel>Declared (L)</FieldLabel><input type="number" step="any" value={summary.grossDeclaredLitre ?? ""} onChange={setSummaryField("grossDeclaredLitre")} className={inputCls} /></div>
            <CalcField label="Measured (A−B) (L)" value={summary.grossMeasuredLitre} onChange={(v) => setSummary((p) => ({ ...p, grossMeasuredLitre: v }))} override={summaryOverride} />
            <CalcField label="Observation (%)" value={summary.grossObservationPercent} onChange={(v) => setSummary((p) => ({ ...p, grossObservationPercent: v }))} override={summaryOverride} />
            <div><FieldLabel>Result</FieldLabel><ResultToggle value={summary.grossResult} onChange={(v) => setSummary((p) => ({ ...p, grossResult: v }))} options={["PASS", "FAIL"]} readOnly={!summaryOverride} /></div>
          </div>
          <p className="text-xs font-bold text-slate-700 mb-2">Storage Volume Result</p>
          <div className="grid md:grid-cols-4 gap-3">
            <div><FieldLabel>Declared (L)</FieldLabel><input type="number" step="any" value={summary.storageDeclaredLitre ?? ""} onChange={setSummaryField("storageDeclaredLitre")} className={inputCls} /></div>
            <CalcField label="Measured (C−D) (L)" value={summary.storageMeasuredLitre} onChange={(v) => setSummary((p) => ({ ...p, storageMeasuredLitre: v }))} override={summaryOverride} />
            <CalcField label="Observation (%)" value={summary.storageObservationPercent} onChange={(v) => setSummary((p) => ({ ...p, storageObservationPercent: v }))} override={summaryOverride} />
            <div><FieldLabel>Result</FieldLabel><ResultToggle value={summary.storageResult} onChange={(v) => setSummary((p) => ({ ...p, storageResult: v }))} options={["PASS", "FAIL"]} readOnly={!summaryOverride} /></div>
          </div>
        </div>

        <div className="pt-3"><FieldLabel>Remarks</FieldLabel><textarea value={summary.remarks || ""} onChange={setSummaryField("remarks")} rows={2} className={`${inputCls} resize-none`} /></div>
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
<<<<<<< HEAD
          <Send className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Submit Final"}
=======
          <Send className="w-3.5 h-3.5" /> {saving ? "Submitting…" : "Submit for Review"}
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
        </button>
      </div>
    </div>
  );
};

export default BISVolumeReportForm;

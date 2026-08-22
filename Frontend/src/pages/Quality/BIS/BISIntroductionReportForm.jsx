import { useEffect, useState } from "react";
import { Save, Send, X, Calculator } from "lucide-react";
import toast from "react-hot-toast";
import {
  FieldLabel, inputCls, computedInputCls, SectionCard, ResultToggle, EquipmentEditor, ReportHeaderFields,
  OverrideToggle, mapHeaderToFormState, mapRowToCamel, mapEquipmentToFormState, round,
} from "./shared";

const makeSetter = (setState) => (field) => (value) => setState((p) => ({ ...p, [field]: value }));

// Two-point interpolation formula from the "Energy Test" sheet: measured
// energy rate at each set point is (meter reading Wh / minutes) scaled to a
// full day, then the rate at the declared target temperature is linearly
// interpolated between the warm and cold set points. Verified against the
// real lab template (WRL/TAD/26/0005): E1=2.6257, E2=2.9623, Ex=2.8150 kWh/day
// for t1=-16.2, t2=-19.4, tx=-18 — this reproduces those exactly.
const calculateEnergyFields = (en) => {
  const emWarm = Number(en.energyMeterReadingWarmWh);
  const tWarm = Number(en.timeElapsedWarmMinutes);
  const emCold = Number(en.energyMeterReadingColdWh);
  const tCold = Number(en.timeElapsedColdMinutes);
  if (!emWarm || !tWarm || !emCold || !tCold) return null;

  const e1 = (emWarm / tWarm) * 1440 / 1000; // kWh/day at warm point
  const e2 = (emCold / tCold) * 1440 / 1000; // kWh/day at cold point

  const t1 = Number(en.measuredTempT1);
  const t2 = Number(en.measuredTempT2);
  const tx = Number(en.targetTempTx);
  const canInterpolate = [t1, t2, tx].every((v) => !Number.isNaN(v)) && t2 !== t1;
  const ex = canInterpolate ? e1 + (e2 - e1) * ((tx - t1) / (t2 - t1)) : e1;

  const energyPerDayWh = ex * 1000;
  const annualEnergyMeasuredKwh = (energyPerDayWh * 365) / 1000;
  const declared = Number(en.annualEnergyDeclaredKwh);
  // BIS rule: Declared shall be ≤ 1.1 × Measured, i.e. Measured can't fall
  // more than ~10% short of Declared.
  const deviationPercent = declared && annualEnergyMeasuredKwh
    ? ((annualEnergyMeasuredKwh - declared) / annualEnergyMeasuredKwh) * 100
    : null;

  const fields = {
    energyRateE1: round(e1, 4),
    energyRateE2: round(e2, 4),
    calculatedEnergyRateExKwhDay: round(ex, 4),
    energyPerDayWh: round(energyPerDayWh, 2),
    annualEnergyMeasuredKwh: round(annualEnergyMeasuredKwh, 3),
  };
  if (deviationPercent !== null) {
    fields.deviationPercent = round(deviationPercent, 3);
    fields.result = deviationPercent >= -10 ? "PASS" : "FAIL";
  }
  return fields;
};

// Label | Spec | Measured — one row per test parameter, used across all 4
// Introduction sub-test sections to keep the (otherwise huge) field list compact.
const SpecMeasuredRow = ({ label, specValue, onSpecChange, measuredValue, onMeasuredChange, measuredType = "text" }) => (
  <div className="grid grid-cols-3 gap-2 items-end py-1">
    <p className="text-xs text-slate-600">{label}</p>
    <div>
      <FieldLabel>Spec</FieldLabel>
      <input type="text" value={specValue || ""} onChange={(e) => onSpecChange(e.target.value)} className={inputCls} />
    </div>
    <div>
      <FieldLabel>Measured</FieldLabel>
      <input type={measuredType} step={measuredType === "number" ? "any" : undefined} value={measuredValue ?? ""}
        onChange={(e) => onMeasuredChange(e.target.value)} className={inputCls} />
    </div>
  </div>
);

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

const BISIntroductionReportForm = ({ initialData, prefillHeader, models, onSave, onCancel, saving, onCopyEquipment, copyingEquipment }) => {
  const [header, setHeader] = useState({ result: "PASS", ...prefillHeader });
  const [pullDownTest, setPullDownTest] = useState({ result: "PASS" });
  const [energyTest, setEnergyTest] = useState({ result: "PASS" });
  const [thermalInsulationTest, setThermalInsulationTest] = useState({ result: "PASS" });
  const [temperatureRiseTest, setTemperatureRiseTest] = useState({ result: "PASS" });
  const [equipment, setEquipment] = useState([]);
  const [energyOverride, setEnergyOverride] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setHeader(mapHeaderToFormState(initialData.header));
    setPullDownTest(mapRowToCamel(initialData.testData?.pullDownTest) || { result: "PASS" });
    setEnergyTest(mapRowToCamel(initialData.testData?.energyTest) || { result: "PASS" });
    setThermalInsulationTest(mapRowToCamel(initialData.testData?.thermalInsulationTest) || { result: "PASS" });
    setTemperatureRiseTest(mapRowToCamel(initialData.testData?.temperatureRiseTest) || { result: "PASS" });
    setEquipment(mapEquipmentToFormState(initialData.equipment));
  }, [initialData]);

  const setPD = makeSetter(setPullDownTest);
  const setEN = makeSetter(setEnergyTest);
  const setTI = makeSetter(setThermalInsulationTest);
  const setTR = makeSetter(setTemperatureRiseTest);

  const handleCopyFromLast = async () => {
    const eq = await onCopyEquipment();
    if (eq) setEquipment(eq);
  };

  const handleCalculateEnergy = () => {
    const computed = calculateEnergyFields(energyTest);
    if (!computed) {
      toast.error("Enter energy meter readings and time elapsed for both the warm and cold points first");
      return;
    }
    setEnergyTest((p) => ({ ...p, ...computed }));
    setEnergyOverride(false);
    toast.success("Energy fields calculated");
  };

  const buildPayload = () => ({
    reportType: "Introduction",
    header,
    testData: { pullDownTest, energyTest, thermalInsulationTest, temperatureRiseTest },
    equipment,
  });

  const handleSubmit = (status) => {
    if (!header.modelName) return toast.error("Select a model");
    if (!header.testDateTo) return toast.error("Test Date To is required");
    onSave(buildPayload(), status);
  };

  return (
    <div className="flex flex-col gap-4">
      <ReportHeaderFields header={header} onChange={makeSetter(setHeader)} models={models} showIntroFields />

      <SectionCard title="Pull Down Test (No Load)">
        <SpecMeasuredRow label="Ambient Conditions" specValue={pullDownTest.ambientConditionsSpec} onSpecChange={setPD("ambientConditionsSpec")} measuredValue={pullDownTest.ambientConditionsMeasured} onMeasuredChange={setPD("ambientConditionsMeasured")} />
        <SpecMeasuredRow label="Test Voltage" specValue={pullDownTest.testVoltageSpec} onSpecChange={setPD("testVoltageSpec")} measuredValue={pullDownTest.testVoltageMeasured} onMeasuredChange={setPD("testVoltageMeasured")} measuredType="number" />
        <SpecMeasuredRow label="Test Frequency" specValue={pullDownTest.testFrequencySpec} onSpecChange={setPD("testFrequencySpec")} measuredValue={pullDownTest.testFrequencyMeasured} onMeasuredChange={setPD("testFrequencyMeasured")} measuredType="number" />
        <SpecMeasuredRow label="Freezer Compartment Temp (F1)" specValue={pullDownTest.f1TempSpec} onSpecChange={setPD("f1TempSpec")} measuredValue={pullDownTest.f1TempMeasured} onMeasuredChange={setPD("f1TempMeasured")} />
        <SpecMeasuredRow label="Freezer Compartment Temp (F2)" specValue={pullDownTest.f2TempSpec} onSpecChange={setPD("f2TempSpec")} measuredValue={pullDownTest.f2TempMeasured} onMeasuredChange={setPD("f2TempMeasured")} />
        <SpecMeasuredRow label="Maximum Warmest Temperature" specValue={pullDownTest.maxWarmestTempSpec} onSpecChange={setPD("maxWarmestTempSpec")} measuredValue={pullDownTest.maxWarmestTempMeasured} onMeasuredChange={setPD("maxWarmestTempMeasured")} />
        <SpecMeasuredRow label="Pull Down Time" specValue={pullDownTest.pullDownTimeSpec} onSpecChange={setPD("pullDownTimeSpec")} measuredValue={pullDownTest.pullDownTimeMeasuredMinutes} onMeasuredChange={setPD("pullDownTimeMeasuredMinutes")} measuredType="number" />
        <div className="grid grid-cols-3 gap-2 items-end py-1">
          <div><FieldLabel>Thermostat Setting</FieldLabel><input type="text" value={pullDownTest.thermostatSetting || ""} onChange={(e) => setPD("thermostatSetting")(e.target.value)} className={inputCls} /></div>
          <div className="col-span-2"><FieldLabel>Result</FieldLabel><ResultToggle value={pullDownTest.result} onChange={setPD("result")} /></div>
        </div>
        <div className="pt-1"><FieldLabel>Remarks</FieldLabel><textarea value={pullDownTest.remarks || ""} onChange={(e) => setPD("remarks")(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>
      </SectionCard>

      <SectionCard title="Energy Consumption Test">
        <SpecMeasuredRow label="Ambient (Warm point)" specValue={energyTest.ambientConditionsSpec} onSpecChange={setEN("ambientConditionsSpec")} measuredValue={energyTest.ambientConditionsWarm} onMeasuredChange={setEN("ambientConditionsWarm")} />
        <SpecMeasuredRow label="Ambient (Cold point)" specValue={energyTest.ambientConditionsSpec} onSpecChange={setEN("ambientConditionsSpec")} measuredValue={energyTest.ambientConditionsCold} onMeasuredChange={setEN("ambientConditionsCold")} />
        <SpecMeasuredRow label="Test Voltage (Warm)" specValue={energyTest.testVoltageSpec} onSpecChange={setEN("testVoltageSpec")} measuredValue={energyTest.testVoltageWarm} onMeasuredChange={setEN("testVoltageWarm")} measuredType="number" />
        <SpecMeasuredRow label="Test Voltage (Cold)" specValue={energyTest.testVoltageSpec} onSpecChange={setEN("testVoltageSpec")} measuredValue={energyTest.testVoltageCold} onMeasuredChange={setEN("testVoltageCold")} measuredType="number" />
        <SpecMeasuredRow label="Test Frequency (Warm)" specValue={energyTest.testFrequencySpec} onSpecChange={setEN("testFrequencySpec")} measuredValue={energyTest.testFrequencyWarm} onMeasuredChange={setEN("testFrequencyWarm")} measuredType="number" />
        <SpecMeasuredRow label="Test Frequency (Cold)" specValue={energyTest.testFrequencySpec} onSpecChange={setEN("testFrequencySpec")} measuredValue={energyTest.testFrequencyCold} onMeasuredChange={setEN("testFrequencyCold")} measuredType="number" />
        <SpecMeasuredRow label="Avg Compartment Temp (Warm)" specValue={energyTest.avgCompartmentTempSpec} onSpecChange={setEN("avgCompartmentTempSpec")} measuredValue={energyTest.avgCompartmentTempWarm} onMeasuredChange={setEN("avgCompartmentTempWarm")} measuredType="number" />
        <SpecMeasuredRow label="Avg Compartment Temp (Cold)" specValue={energyTest.avgCompartmentTempSpec} onSpecChange={setEN("avgCompartmentTempSpec")} measuredValue={energyTest.avgCompartmentTempCold} onMeasuredChange={setEN("avgCompartmentTempCold")} measuredType="number" />
        <div className="grid grid-cols-2 gap-3 py-2 border-t border-slate-100 mt-2">
          <div><FieldLabel>Energy Meter Reading — Warm (Wh)</FieldLabel><input type="number" step="any" value={energyTest.energyMeterReadingWarmWh ?? ""} onChange={(e) => setEN("energyMeterReadingWarmWh")(e.target.value)} className={inputCls} /></div>
          <div><FieldLabel>Energy Meter Reading — Cold (Wh)</FieldLabel><input type="number" step="any" value={energyTest.energyMeterReadingColdWh ?? ""} onChange={(e) => setEN("energyMeterReadingColdWh")(e.target.value)} className={inputCls} /></div>
          <div><FieldLabel>Time Elapsed — Warm (min)</FieldLabel><input type="number" step="any" value={energyTest.timeElapsedWarmMinutes ?? ""} onChange={(e) => setEN("timeElapsedWarmMinutes")(e.target.value)} className={inputCls} /></div>
          <div><FieldLabel>Time Elapsed — Cold (min)</FieldLabel><input type="number" step="any" value={energyTest.timeElapsedColdMinutes ?? ""} onChange={(e) => setEN("timeElapsedColdMinutes")(e.target.value)} className={inputCls} /></div>
          <div><FieldLabel>% Running Time — Warm</FieldLabel><input type="number" step="any" value={energyTest.percentRunningTimeWarm ?? ""} onChange={(e) => setEN("percentRunningTimeWarm")(e.target.value)} className={inputCls} /></div>
          <div><FieldLabel>% Running Time — Cold</FieldLabel><input type="number" step="any" value={energyTest.percentRunningTimeCold ?? ""} onChange={(e) => setEN("percentRunningTimeCold")(e.target.value)} className={inputCls} /></div>
          <div><FieldLabel>Target Temperature (tx)</FieldLabel><input type="number" step="any" value={energyTest.targetTempTx ?? ""} onChange={(e) => setEN("targetTempTx")(e.target.value)} className={inputCls} /></div>
          <div />
          <div className="col-span-2 flex items-center justify-between gap-3 py-1.5 border-y border-dashed border-indigo-100 my-1">
            <p className="text-[10px] text-slate-400">Fill in the readings above, then calculate E1, E2, Ex, Energy/Day, Annual Energy, Deviation &amp; Result.</p>
            <div className="flex items-center gap-2 shrink-0">
              <OverrideToggle active={energyOverride} onToggle={() => setEnergyOverride((v) => !v)} />
              <button type="button" onClick={handleCalculateEnergy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-all">
                <Calculator className="w-3.5 h-3.5" /> Calculate
              </button>
            </div>
          </div>
          <div><FieldLabel>Measured Temp — Point 1 (t1)</FieldLabel><input type="number" step="any" value={energyTest.measuredTempT1 ?? ""} onChange={(e) => setEN("measuredTempT1")(e.target.value)} className={inputCls} /></div>
          <CalcField label="Energy Rate — Point 1 (E1)" value={energyTest.energyRateE1} onChange={setEN("energyRateE1")} override={energyOverride} />
          <div><FieldLabel>Measured Temp — Point 2 (t2)</FieldLabel><input type="number" step="any" value={energyTest.measuredTempT2 ?? ""} onChange={(e) => setEN("measuredTempT2")(e.target.value)} className={inputCls} /></div>
          <CalcField label="Energy Rate — Point 2 (E2)" value={energyTest.energyRateE2} onChange={setEN("energyRateE2")} override={energyOverride} />
          <CalcField label="Calculated Energy Rate (Ex, kWh/Day)" value={energyTest.calculatedEnergyRateExKwhDay} onChange={setEN("calculatedEnergyRateExKwhDay")} override={energyOverride} />
          <CalcField label="Energy Per Day (Wh/Day)" value={energyTest.energyPerDayWh} onChange={setEN("energyPerDayWh")} override={energyOverride} />
          <div><FieldLabel>Annual Energy — Declared (kWh/yr)</FieldLabel><input type="number" step="any" value={energyTest.annualEnergyDeclaredKwh ?? ""} onChange={(e) => setEN("annualEnergyDeclaredKwh")(e.target.value)} className={inputCls} /></div>
          <CalcField label="Annual Energy — Measured (kWh/yr)" value={energyTest.annualEnergyMeasuredKwh} onChange={setEN("annualEnergyMeasuredKwh")} override={energyOverride} />
          <div><FieldLabel>Deviation Spec</FieldLabel><input type="text" value={energyTest.deviationSpec || ""} onChange={(e) => setEN("deviationSpec")(e.target.value)} className={inputCls} placeholder="e.g. ≤ 10%" /></div>
          <CalcField label="Deviation (%)" value={energyTest.deviationPercent} onChange={setEN("deviationPercent")} override={energyOverride} />
        </div>
        <div className="pt-1"><FieldLabel>Result</FieldLabel><ResultToggle value={energyTest.result} onChange={setEN("result")} readOnly={!energyOverride} /></div>
        <div className="pt-2"><FieldLabel>Remarks</FieldLabel><textarea value={energyTest.remarks || ""} onChange={(e) => setEN("remarks")(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>
      </SectionCard>

      <SectionCard title="Thermal Insulation Test (External Condensation)">
        <SpecMeasuredRow label="Ambient Conditions" specValue={thermalInsulationTest.ambientConditionsSpec} onSpecChange={setTI("ambientConditionsSpec")} measuredValue={thermalInsulationTest.ambientConditionsMeasured} onMeasuredChange={setTI("ambientConditionsMeasured")} />
        <SpecMeasuredRow label="Test Voltage" specValue={thermalInsulationTest.testVoltageSpec} onSpecChange={setTI("testVoltageSpec")} measuredValue={thermalInsulationTest.testVoltageMeasured} onMeasuredChange={setTI("testVoltageMeasured")} measuredType="number" />
        <SpecMeasuredRow label="Test Frequency" specValue={thermalInsulationTest.testFrequencySpec} onSpecChange={setTI("testFrequencySpec")} measuredValue={thermalInsulationTest.testFrequencyMeasured} onMeasuredChange={setTI("testFrequencyMeasured")} measuredType="number" />
        <SpecMeasuredRow label="Avg Compartment Temperature" specValue={thermalInsulationTest.avgCompartmentTempSpec} onSpecChange={setTI("avgCompartmentTempSpec")} measuredValue={thermalInsulationTest.avgCompartmentTempMeasured} onMeasuredChange={setTI("avgCompartmentTempMeasured")} />
        <SpecMeasuredRow label="External Condensation" specValue={thermalInsulationTest.condensationSpec} onSpecChange={setTI("condensationSpec")} measuredValue={thermalInsulationTest.condensationObservation} onMeasuredChange={setTI("condensationObservation")} />
        <div className="pt-1"><FieldLabel>Result</FieldLabel><ResultToggle value={thermalInsulationTest.result} onChange={setTI("result")} /></div>
        <div className="pt-2"><FieldLabel>Remarks</FieldLabel><textarea value={thermalInsulationTest.remarks || ""} onChange={(e) => setTI("remarks")(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>
      </SectionCard>

      <SectionCard title="Temperature Rise Test">
        <SpecMeasuredRow label="Ambient Conditions" specValue={temperatureRiseTest.ambientConditionsSpec} onSpecChange={setTR("ambientConditionsSpec")} measuredValue={temperatureRiseTest.ambientConditionsMeasured} onMeasuredChange={setTR("ambientConditionsMeasured")} />
        <SpecMeasuredRow label="Test Voltage" specValue={temperatureRiseTest.testVoltageSpec} onSpecChange={setTR("testVoltageSpec")} measuredValue={temperatureRiseTest.testVoltageMeasured} onMeasuredChange={setTR("testVoltageMeasured")} measuredType="number" />
        <SpecMeasuredRow label="Test Frequency" specValue={temperatureRiseTest.testFrequencySpec} onSpecChange={setTR("testFrequencySpec")} measuredValue={temperatureRiseTest.testFrequencyMeasured} onMeasuredChange={setTR("testFrequencyMeasured")} measuredType="number" />
        <SpecMeasuredRow label="Warmest M-Package Temperature" specValue={temperatureRiseTest.warmestPackageTempSpec} onSpecChange={setTR("warmestPackageTempSpec")} measuredValue={temperatureRiseTest.warmestPackageTempMeasured} onMeasuredChange={setTR("warmestPackageTempMeasured")} />
        <SpecMeasuredRow label="Time to Reach Threshold" specValue={temperatureRiseTest.timeToThresholdSpec} onSpecChange={setTR("timeToThresholdSpec")} measuredValue={temperatureRiseTest.timeToThresholdMeasured} onMeasuredChange={setTR("timeToThresholdMeasured")} />
        <div className="pt-1"><FieldLabel>Result</FieldLabel><ResultToggle value={temperatureRiseTest.result} onChange={setTR("result")} /></div>
        <div className="pt-2"><FieldLabel>Remarks</FieldLabel><textarea value={temperatureRiseTest.remarks || ""} onChange={(e) => setTR("remarks")(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>
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

export default BISIntroductionReportForm;

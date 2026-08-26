<<<<<<< HEAD
import { Printer, X } from "lucide-react";
import { mapHeaderToFormState, mapRowToCamel, mapEquipmentToFormState, reportTypeLabel } from "./shared";
=======
import { Printer, X, FileDown, FileSpreadsheet } from "lucide-react";
import { mapHeaderToFormState, mapRowToCamel, mapEquipmentToFormState, reportTypeLabel } from "./shared";
import { exportBisReportPDF, exportBisReportExcel } from "./bisReportExport";
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61

const fmt = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-3 py-1 border-b border-slate-100 text-xs">
    <span className="text-slate-400">{label}</span>
    <span className="text-slate-700 font-medium text-right">{fmt(value)}</span>
  </div>
);

const SpecMeasuredRow = ({ label, spec, measured }) => (
  <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100 text-xs">
    <span className="text-slate-500">{label}</span>
    <span className="text-slate-400">{fmt(spec)}</span>
    <span className="text-slate-800 font-semibold">{fmt(measured)}</span>
  </div>
);

const ResultPill = ({ value }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${value === "PASS" ? "bg-emerald-100 text-emerald-700" : value === "FAIL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
    {fmt(value)}
  </span>
);

const EquipmentTable = ({ equipment }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Test Equipment Used</h3>
    {equipment.length === 0 ? (
      <p className="text-xs text-slate-400">No equipment recorded.</p>
    ) : (
      <table className="w-full text-xs">
        <thead>
          <tr>
            {["#", "Instrument", "Make", "Model", "Serial / Equipment ID", "Calibration Due"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {equipment.map((e, idx) => (
            <tr key={idx}>
              <td className="px-2 py-1.5 border-b border-slate-100 text-slate-400">{e.srNo ?? idx + 1}</td>
              <td className="px-2 py-1.5 border-b border-slate-100 text-slate-700">{fmt(e.instrumentName)}</td>
              <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmt(e.make)}</td>
              <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmt(e.model)}</td>
              <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500 font-mono">{fmt(e.serialOrEquipmentId)}</td>
              <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmtDate(e.calibrationDueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const BISReportDetailView = ({ data, onClose }) => {
  const header = mapHeaderToFormState(data.header);
  const equipment = mapEquipmentToFormState(data.equipment);
  const reportType = header.reportType;

<<<<<<< HEAD
=======
  const handleExportPDF = () => exportBisReportPDF({ header, equipment, reportType, data });
  const handleExportExcel = () => exportBisReportExcel({ header, equipment, reportType, data });

>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-800">{header.modelName} — {reportTypeLabel(reportType)} Report</h2>
          <p className="text-[11px] text-slate-400">Version {header.version} · {header.status}</p>
        </div>
        <div className="flex items-center gap-2">
<<<<<<< HEAD
=======
          <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600 transition-all" title="Export PDF">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-all" title="Export Excel">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all">
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Report Header</h3>
          <ResultPill value={header.result} />
        </div>
        <div className="grid md:grid-cols-3 gap-x-6">
          <Row label="Model" value={header.modelName} />
          <Row label="Material Code" value={header.materialCode} />
          <Row label="Machine Serial No." value={header.machineSerialNumber} />
          <Row label="Test Report No." value={header.testReportNo} />
          <Row label="UID No." value={header.uidNo} />
          <Row label="Test Date" value={header.testDateFrom ? `${fmtDate(header.testDateFrom)} to ${fmtDate(header.testDateTo)}` : fmtDate(header.testDateTo)} />
          <Row label="Tested By" value={header.testedBy} />
          <Row label="Test Standard" value={header.testStandard} />
<<<<<<< HEAD
          {reportType === "Introduction" && (
            <>
              <Row label="Appliance Type" value={header.applianceType} />
              <Row label="Manufacturer" value={header.manufacturer} />
=======
          <Row label="Appliance Type" value={header.applianceType} />
          <Row label="Manufacturer" value={header.manufacturer} />
          <Row label="Unit Picked From" value={header.unitPickedFrom} />
          <Row label="Report Issue Date" value={fmtDate(header.reportIssueDate)} />
          <Row label="Sample Receipt Date" value={fmtDate(header.sampleReceiptDate)} />
          <Row label="Sample Condition" value={header.sampleCondition} />
          <Row label="Purpose of Testing" value={header.purposeOfTesting} />
          {reportType === "Introduction" && (
            <>
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
              <Row label="Product Variant" value={header.productVariant} />
              <Row label="Refrigerant" value={header.refrigerantName} />
              <Row label="Rated Voltage/Freq/Phase" value={header.ratedVoltageFreqPhase} />
              <Row label="Rated Gross Volume (L)" value={header.ratedGrossVolumeLitre} />
              <Row label="Rated Storage Volume (L)" value={header.ratedStorageVolumeLitre} />
              <Row label="Annual Electricity (kWh/yr)" value={header.annualElectricityConsumptionKwh} />
<<<<<<< HEAD
              <Row label="Report Issue Date" value={fmtDate(header.reportIssueDate)} />
              <Row label="Sample Receipt Date" value={fmtDate(header.sampleReceiptDate)} />
              <Row label="Sample Condition" value={header.sampleCondition} />
              <Row label="Purpose of Testing" value={header.purposeOfTesting} />
              <Row label="Prepared By" value={header.preparedBy} />
              <Row label="Reviewed By" value={header.reviewedBy} />
              <Row label="Authorized By" value={header.authorizedBy} />
            </>
          )}
=======
            </>
          )}
          <Row label="Prepared By" value={header.preparedBy} />
          <Row label="Reviewed By" value={header.reviewedBy} />
          <Row label="Authorized By" value={header.authorizedBy} />
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
        </div>
        {header.remarks && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Remarks</p>
            <p className="text-xs text-slate-600">{header.remarks}</p>
          </div>
        )}
      </div>

      {reportType === "Introduction" && data.testData && (
        <>
          {data.testData.pullDownTest && (() => {
            const t = mapRowToCamel(data.testData.pullDownTest);
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Pull Down Test</h3><ResultPill value={t.result} /></div>
                <SpecMeasuredRow label="Ambient Conditions" spec={t.ambientConditionsSpec} measured={t.ambientConditionsMeasured} />
                <SpecMeasuredRow label="Test Voltage" spec={t.testVoltageSpec} measured={t.testVoltageMeasured} />
                <SpecMeasuredRow label="Test Frequency" spec={t.testFrequencySpec} measured={t.testFrequencyMeasured} />
                <SpecMeasuredRow label="F1 Temp" spec={t.f1TempSpec} measured={t.f1TempMeasured} />
                <SpecMeasuredRow label="F2 Temp" spec={t.f2TempSpec} measured={t.f2TempMeasured} />
                <SpecMeasuredRow label="Max Warmest Temp" spec={t.maxWarmestTempSpec} measured={t.maxWarmestTempMeasured} />
                <SpecMeasuredRow label="Pull Down Time" spec={t.pullDownTimeSpec} measured={t.pullDownTimeMeasuredMinutes} />
                <Row label="Thermostat Setting" value={t.thermostatSetting} />
                {t.remarks && <p className="text-xs text-slate-500 mt-2">{t.remarks}</p>}
              </div>
            );
          })()}

          {data.testData.energyTest && (() => {
            const t = mapRowToCamel(data.testData.energyTest);
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Energy Consumption Test</h3><ResultPill value={t.result} /></div>
                <div className="grid md:grid-cols-2 gap-x-6">
                  <Row label="Annual Energy — Declared (kWh/yr)" value={t.annualEnergyDeclaredKwh} />
                  <Row label="Annual Energy — Measured (kWh/yr)" value={t.annualEnergyMeasuredKwh} />
                  <Row label="Deviation (%)" value={t.deviationPercent} />
                  <Row label="Energy Per Day (Wh/Day)" value={t.energyPerDayWh} />
                </div>
                {t.remarks && <p className="text-xs text-slate-500 mt-2">{t.remarks}</p>}
              </div>
            );
          })()}

          {data.testData.thermalInsulationTest && (() => {
            const t = mapRowToCamel(data.testData.thermalInsulationTest);
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Thermal Insulation Test</h3><ResultPill value={t.result} /></div>
                <SpecMeasuredRow label="Ambient Conditions" spec={t.ambientConditionsSpec} measured={t.ambientConditionsMeasured} />
                <SpecMeasuredRow label="Avg Compartment Temp" spec={t.avgCompartmentTempSpec} measured={t.avgCompartmentTempMeasured} />
                <SpecMeasuredRow label="External Condensation" spec={t.condensationSpec} measured={t.condensationObservation} />
                {t.remarks && <p className="text-xs text-slate-500 mt-2">{t.remarks}</p>}
              </div>
            );
          })()}

          {data.testData.temperatureRiseTest && (() => {
            const t = mapRowToCamel(data.testData.temperatureRiseTest);
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Temperature Rise Test</h3><ResultPill value={t.result} /></div>
                <SpecMeasuredRow label="Ambient Conditions" spec={t.ambientConditionsSpec} measured={t.ambientConditionsMeasured} />
                <SpecMeasuredRow label="Warmest M-Package Temp" spec={t.warmestPackageTempSpec} measured={t.warmestPackageTempMeasured} />
                <SpecMeasuredRow label="Time to Reach Threshold" spec={t.timeToThresholdSpec} measured={t.timeToThresholdMeasured} />
                {t.remarks && <p className="text-xs text-slate-500 mt-2">{t.remarks}</p>}
              </div>
            );
          })()}
        </>
      )}

      {reportType === "Sound" && data.testData?.measurements && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Sound Level Test</h3>
          <table className="w-full text-xs">
            <thead>
              <tr>
                {["Location", "Specification", "Background Noise (dBA)", "Measured Noise (dBA)", "Status"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.testData.measurements.map(mapRowToCamel).map((m, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1.5 border-b border-slate-100 font-semibold text-slate-700">{fmt(m.location)}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100 text-slate-400">{fmt(m.specificationLimit)}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmt(m.backgroundNoiseDba)}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100 text-slate-800 font-semibold">{fmt(m.measuredNoiseDba)}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100"><ResultPill value={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === "Volume" && data.testData && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Freezer Volume Measurement</h3>
          {(data.testData.items || []).map(mapRowToCamel).length > 0 && (
            <table className="w-full text-xs mb-4">
              <thead>
                <tr>
                  {["Category", "Part", "W (mm)", "D (mm)", "H (mm)", "Qty", "Volume (L)"].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.testData.items.map(mapRowToCamel).map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-400">{fmt(it.category)}</td>
                    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-700">{fmt(it.partName)}</td>
                    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmt(it.widthMm)}</td>
                    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmt(it.depthMm)}</td>
                    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmt(it.heightMm)}</td>
                    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500">{fmt(it.quantity)}</td>
                    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-800 font-semibold">{fmt(it.volumeLitre)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.testData.summary && (() => {
            const s = mapRowToCamel(data.testData.summary);
            return (
              <div className="grid md:grid-cols-2 gap-x-6 border-t border-slate-100 pt-3">
                <div>
                  <div className="flex items-center justify-between mb-1"><p className="text-xs font-bold text-slate-700">Gross Volume</p><ResultPill value={s.grossResult} /></div>
                  <Row label="Declared (L)" value={s.grossDeclaredLitre} />
                  <Row label="Measured (L)" value={s.grossMeasuredLitre} />
                  <Row label="Observation (%)" value={s.grossObservationPercent} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1"><p className="text-xs font-bold text-slate-700">Storage Volume</p><ResultPill value={s.storageResult} /></div>
                  <Row label="Declared (L)" value={s.storageDeclaredLitre} />
                  <Row label="Measured (L)" value={s.storageMeasuredLitre} />
                  <Row label="Observation (%)" value={s.storageObservationPercent} />
                </div>
                {s.remarks && <p className="text-xs text-slate-500 mt-2 md:col-span-2">{s.remarks}</p>}
              </div>
            );
          })()}
        </div>
      )}

      <EquipmentTable equipment={equipment} />
    </div>
  );
};

export default BISReportDetailView;

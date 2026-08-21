import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { getWrlLogoBase64 } from "../../../utils/reportLogo.js";
import { fileBaseURL } from "../../../assets/assets.js";
import { mapRowToCamel, reportTypeLabel } from "./shared";

// Replicates the lab's original Excel test-report letterhead (logo + lab
// name, title bar, a single label/value grid, standard disclaimer remarks,
// and a 3-column sign-off footer) so the PDF and Excel downloads look like
// the paper template the lab used before this screen existed, instead of a
// generic data dump. Each sign-off's signature image is whichever image the
// Preparer/Reviewer/Authorizer had on file in the BIS approval flow at the
// moment they actually signed this report (see BisApprovalFlow.controller.js) —
// blank until that stage of the workflow has happened.

const LAB_NAME = "Quality Assurance Testing Lab, Western Refrigeration Private Limited";
const LAB_ADDRESS = "Survey no 633,634,635,636,638,726/7,732,736,741,740,752 Village Tadgam, Taluka Umbergaon District Valsad, Gujarat – 396135";

const SIGNOFFS = [
  { label: "Test Report Prepared by:", designation: "Engineer", nameField: "preparedBy", signatureField: "preparerSignaturePath" },
  { label: "Test Report Reviewed by:", designation: "QA-Senior Engineer", nameField: "reviewedBy", signatureField: "reviewerSignaturePath" },
  { label: "Test Report Authorized by:", designation: "QA-Assistant General Manager", nameField: "authorizedBy", signatureField: "authorizerSignaturePath" },
];

const STANDARD_REMARKS = [
  "The results contained in this report correspond only to the particular test sample(s) as received/tested.",
  "This Test Report shall not be reproduced except in full without written approval of the QA Assistant General Manager.",
];

// Signature images live at arbitrary uploaded paths (not the one fixed WRL
// logo asset), so this loads+caches them by path rather than reusing
// getWrlLogoBase64's single-asset cache.
const signatureImageCache = new Map();
const loadSignatureImage = (relativePath) => {
  if (!relativePath) return Promise.resolve(null);
  if (signatureImageCache.has(relativePath)) return signatureImageCache.get(relativePath);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), aspect: img.naturalWidth / img.naturalHeight || 2 });
    };
    img.onerror = () => resolve(null);
    img.src = `${fileBaseURL}${relativePath}`;
  });
  signatureImageCache.set(relativePath, promise);
  return promise;
};

const loadSignoffImages = (header) => Promise.all(SIGNOFFS.map((s) => loadSignatureImage(header[s.signatureField])));

const fmtDateDMY = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

// { label, value } — the single grid that forms the report's cover page.
// Fields the current report type never captures (e.g. rated volumes on a
// Sound report) are skipped rather than shown blank.
const buildCoverRows = (header) => {
  const rows = [];
  const push = (label, value) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label, value });
  };

  push("Testing Lab Name:", LAB_NAME);
  push("Testing Lab Address & Location:", LAB_ADDRESS);
  push("Unit Picked Up From:", header.unitPickedFrom);
  push("Appliance:", header.applianceType);
  push("Manufacturer:", header.manufacturer);
  push("Type:", header.productVariant);
  push("Model name :", header.modelName);
  push("Machine Serial number:", header.machineSerialNumber);
  push("Refrigerant Name:", header.refrigerantName);
  push("Rated voltage / frequency / number of phase:", header.ratedVoltageFreqPhase);
  push("Rated Gross Volume (Litre):", header.ratedGrossVolumeLitre);
  push("Rated Storage Volume (Litre):", header.ratedStorageVolumeLitre);
  push("Electricity Consumption per year (kWh/year):", header.annualElectricityConsumptionKwh);
  push("Test Report No.:", header.testReportNo);
  push("Report Issue Date:", fmtDateDMY(header.reportIssueDate));
  push("Date of Sample Receipt:", fmtDateDMY(header.sampleReceiptDate));
  push("Condition of Sample on Receipt:", header.sampleCondition);
  push("Sample UID No.:", header.uidNo);
  push("Purpose of testing:", header.purposeOfTesting);
  push("Test Standard / Procedure:", header.testStandard);
  push("Date(s) of testing:", header.testDateFrom ? `${fmtDateDMY(header.testDateFrom)} TO ${fmtDateDMY(header.testDateTo)}` : fmtDateDMY(header.testDateTo));
  push("Test Result:", header.result);
  push("Total Number of Pages:", header.totalPages);
  push("Remarks:", header.remarks);

  return rows;
};

const reportTitle = (header, reportType) => {
  const appliance = header.applianceType || header.modelName || "";
  return `Test Report for ${appliance} ${reportTypeLabel(reportType)}`.trim();
};

const kvColumns = [
  { label: "Field", align: "left", value: (r) => r.label },
  { label: "Value", align: "left", value: (r) => (r.value ?? "") },
];

const specMeasuredColumns = [
  { label: "Parameter", align: "left", value: (r) => r.label },
  { label: "Specification", align: "left", value: (r) => (r.spec ?? "") },
  { label: "Measured", align: "left", value: (r) => (r.measured ?? "") },
];

// Detailed test-data blocks (per sub-test, per measurement, equipment) that
// follow the cover page — the raw entered data the cover page summarizes.
const buildDetailBlocks = ({ equipment, reportType, data }) => {
  const blocks = [];

  if (reportType === "Introduction" && data.testData) {
    if (data.testData.pullDownTest) {
      const t = mapRowToCamel(data.testData.pullDownTest);
      blocks.push({
        heading: `Pull Down Test (No Load) — Result: ${t.result || ""}`, columns: specMeasuredColumns,
        rows: [
          { label: "Ambient Conditions", spec: t.ambientConditionsSpec, measured: t.ambientConditionsMeasured },
          { label: "Test Voltage", spec: t.testVoltageSpec, measured: t.testVoltageMeasured },
          { label: "Test Frequency", spec: t.testFrequencySpec, measured: t.testFrequencyMeasured },
          { label: "Freezer Compartment Temp (F1)", spec: t.f1TempSpec, measured: t.f1TempMeasured },
          { label: "Freezer Compartment Temp (F2)", spec: t.f2TempSpec, measured: t.f2TempMeasured },
          { label: "Maximum Warmest Temperature", spec: t.maxWarmestTempSpec, measured: t.maxWarmestTempMeasured },
          { label: "Pull Down Time", spec: t.pullDownTimeSpec, measured: t.pullDownTimeMeasuredMinutes },
          { label: "Thermostat Setting", spec: "", measured: t.thermostatSetting },
          ...(t.remarks ? [{ label: "Remarks", spec: "", measured: t.remarks }] : []),
        ],
      });
    }
    if (data.testData.energyTest) {
      const t = mapRowToCamel(data.testData.energyTest);
      blocks.push({
        heading: `Energy Consumption Test — Result: ${t.result || ""}`, columns: kvColumns,
        rows: [
          { label: "Annual Energy — Declared (kWh/yr)", value: t.annualEnergyDeclaredKwh },
          { label: "Annual Energy — Measured (kWh/yr)", value: t.annualEnergyMeasuredKwh },
          { label: "Deviation (%)", value: t.deviationPercent },
          { label: "Energy Per Day (Wh/Day)", value: t.energyPerDayWh },
          ...(t.remarks ? [{ label: "Remarks", value: t.remarks }] : []),
        ],
      });
    }
    if (data.testData.thermalInsulationTest) {
      const t = mapRowToCamel(data.testData.thermalInsulationTest);
      blocks.push({
        heading: `Thermal Insulation Test (External Condensation) — Result: ${t.result || ""}`, columns: specMeasuredColumns,
        rows: [
          { label: "Ambient Conditions", spec: t.ambientConditionsSpec, measured: t.ambientConditionsMeasured },
          { label: "Avg Compartment Temp", spec: t.avgCompartmentTempSpec, measured: t.avgCompartmentTempMeasured },
          { label: "External Condensation", spec: t.condensationSpec, measured: t.condensationObservation },
          ...(t.remarks ? [{ label: "Remarks", spec: "", measured: t.remarks }] : []),
        ],
      });
    }
    if (data.testData.temperatureRiseTest) {
      const t = mapRowToCamel(data.testData.temperatureRiseTest);
      blocks.push({
        heading: `Temperature Rise Test — Result: ${t.result || ""}`, columns: specMeasuredColumns,
        rows: [
          { label: "Ambient Conditions", spec: t.ambientConditionsSpec, measured: t.ambientConditionsMeasured },
          { label: "Warmest M-Package Temp", spec: t.warmestPackageTempSpec, measured: t.warmestPackageTempMeasured },
          { label: "Time to Reach Threshold", spec: t.timeToThresholdSpec, measured: t.timeToThresholdMeasured },
          ...(t.remarks ? [{ label: "Remarks", spec: "", measured: t.remarks }] : []),
        ],
      });
    }
  }

  if (reportType === "Sound" && data.testData?.measurements) {
    blocks.push({
      heading: "Sound Level Test",
      columns: [
        { label: "Location", align: "left", value: (r) => r.location },
        { label: "Specification", align: "left", value: (r) => (r.specificationLimit ?? "") },
        { label: "Background Noise (dBA)", align: "right", value: (r) => (r.backgroundNoiseDba ?? "") },
        { label: "Measured Noise (dBA)", align: "right", value: (r) => (r.measuredNoiseDba ?? "") },
        { label: "Status", align: "center", value: (r) => (r.status ?? "") },
      ],
      rows: data.testData.measurements.map(mapRowToCamel),
    });
  }

  if (reportType === "Volume" && data.testData) {
    const items = (data.testData.items || []).map(mapRowToCamel);
    if (items.length > 0) {
      blocks.push({
        heading: "Freezer Volume Measurement",
        columns: [
          { label: "Category", align: "left", value: (r) => r.category },
          { label: "Part", align: "left", value: (r) => r.partName },
          { label: "W (mm)", align: "right", value: (r) => (r.widthMm ?? "") },
          { label: "D (mm)", align: "right", value: (r) => (r.depthMm ?? "") },
          { label: "H (mm)", align: "right", value: (r) => (r.heightMm ?? "") },
          { label: "Qty", align: "right", value: (r) => (r.quantity ?? "") },
          { label: "Volume (L)", align: "right", value: (r) => (r.volumeLitre ?? "") },
        ],
        rows: items,
      });
    }
    if (data.testData.summary) {
      const s = mapRowToCamel(data.testData.summary);
      blocks.push({
        heading: "Volume Summary", columns: kvColumns,
        rows: [
          { label: "Gross Volume — Result", value: s.grossResult },
          { label: "Gross Volume — Declared (L)", value: s.grossDeclaredLitre },
          { label: "Gross Volume — Measured (L)", value: s.grossMeasuredLitre },
          { label: "Gross Volume — Observation (%)", value: s.grossObservationPercent },
          { label: "Storage Volume — Result", value: s.storageResult },
          { label: "Storage Volume — Declared (L)", value: s.storageDeclaredLitre },
          { label: "Storage Volume — Measured (L)", value: s.storageMeasuredLitre },
          { label: "Storage Volume — Observation (%)", value: s.storageObservationPercent },
          ...(s.remarks ? [{ label: "Remarks", value: s.remarks }] : []),
        ],
      });
    }
  }

  blocks.push({
    heading: "Test Equipment Used",
    columns: [
      { label: "#", align: "left", value: (r) => r.srNo },
      { label: "Instrument", align: "left", value: (r) => r.instrumentName },
      { label: "Make", align: "left", value: (r) => r.make },
      { label: "Model", align: "left", value: (r) => r.model },
      { label: "Serial / Equipment ID", align: "left", value: (r) => r.serialOrEquipmentId },
      { label: "Calibration Due", align: "left", value: (r) => fmtDateDMY(r.calibrationDueDate) },
    ],
    rows: equipment.map((e, idx) => ({ ...e, srNo: e.srNo ?? idx + 1 })),
  });

  return blocks;
};

/* ─────────────────────────────────────────────────────────────────────────
   PDF — jsPDF + autoTable. Cover page mirrors the paper letterhead exactly;
   detail blocks follow on their own page(s) below it.
───────────────────────────────────────────────────────────────────────── */
export const exportBisReportPDF = async ({ header, equipment, reportType, data }) => {
  const [logo, signoffImages] = await Promise.all([getWrlLogoBase64(), loadSignoffImages(header)]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - marginX * 2;
  const title = reportTitle(header, reportType);

  // Same letterhead (logo + lab name + report title bar) repeats at the top
  // of every page — via didDrawPage on each autoTable call for pagination
  // autoTable does on its own, and manually before content this function
  // starts itself — so a multi-page report reads as one consistent document
  // instead of a styled cover glued onto a plain data dump.
  const headBoxH = 54;
  const titleH = 24;
  const contentTop = 40 + headBoxH + titleH + 10;
  const drawLetterhead = () => {
    let ly = 40;
    doc.setDrawColor(30, 41, 59);
    doc.rect(marginX, ly, contentW, headBoxH);
    if (logo) doc.addImage(logo, "PNG", marginX + 8, ly + 9, 70, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("QUALITY ASSURANCE TESTING LAB,", pageW / 2, ly + 24, { align: "center" });
    doc.text("WESTERN REFRIGERATION PVT. LTD.", pageW / 2, ly + 40, { align: "center" });
    ly += headBoxH;
    doc.rect(marginX, ly, contentW, titleH);
    doc.setFontSize(11);
    doc.text(title, pageW / 2, ly + 16, { align: "center" });
  };
  // Same plain, bold-header-on-white grid style used everywhere — the cover
  // grid, the sign-off footer, and every detail table — so nothing looks
  // like a different document bolted onto the letterhead.
  const gridStyles = { fontSize: 8.5, cellPadding: 5, overflow: "linebreak", lineColor: [100, 116, 139], lineWidth: 0.5, textColor: [30, 41, 59] };

  drawLetterhead();
  let y = contentTop;

  // Cover grid
  const coverRows = buildCoverRows(header);
  autoTable(doc, {
    body: coverRows.map((r) => [r.label, String(r.value)]),
    startY: y,
    margin: { top: contentTop, left: marginX, right: marginX },
    theme: "grid",
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 190, fontStyle: "bold" }, 1: { cellWidth: contentW - 190 } },
    didParseCell: (d) => {
      if (d.column.index === 1 && coverRows[d.row.index]?.label === "Test Result:") {
        d.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: drawLetterhead,
  });
  y = doc.lastAutoTable.finalY + 16;

  // Standard disclaimer remarks
  if (y + 60 > pageH - 40) { doc.addPage(); drawLetterhead(); y = contentTop; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("Remarks:", marginX, y);
  y += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  STANDARD_REMARKS.forEach((r, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${r}`, contentW);
    doc.text(lines, marginX, y);
    y += lines.length * 10 + 3;
  });
  y += 10;

  // Sign-off footer — a signature image (snapshotted at approval time) draws
  // into the last row's cell when that stage of the workflow has happened;
  // otherwise it falls back to a blank "Signature:" line.
  if (y + 100 > pageH - 40) { doc.addPage(); drawLetterhead(); y = contentTop; }
  autoTable(doc, {
    startY: y,
    margin: { top: contentTop, left: marginX, right: marginX },
    theme: "grid",
    body: [
      SIGNOFFS.map((s) => s.label),
      SIGNOFFS.map((s) => s.designation),
      SIGNOFFS.map((s) => `Name: ${header[s.nameField] || ""}`),
      SIGNOFFS.map((s, i) => (signoffImages[i] ? "" : "Signature:")),
    ],
    styles: { ...gridStyles, cellPadding: 8, minCellHeight: 22 },
    didParseCell: (d) => {
      if (d.row.index === 0) d.cell.styles.fontStyle = "bold";
      if (d.row.index === 3) d.cell.styles.minCellHeight = 44;
    },
    didDrawCell: (d) => {
      if (d.row.index !== 3) return;
      const img = signoffImages[d.column.index];
      if (!img) return;
      const maxW = d.cell.width - 8;
      const maxH = d.cell.height - 8;
      let w = maxW;
      let h = w / img.aspect;
      if (h > maxH) { h = maxH; w = h * img.aspect; }
      doc.addImage(img.dataUrl, "PNG", d.cell.x + (d.cell.width - w) / 2, d.cell.y + (d.cell.height - h) / 2, w, h);
    },
    didDrawPage: drawLetterhead,
  });

  // Detailed test data — its own page(s), same letterhead + grid style
  const blocks = buildDetailBlocks({ header, equipment, reportType, data });
  if (blocks.length) {
    doc.addPage();
    drawLetterhead();
    y = contentTop;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Detailed Test Data", marginX, y);
    y += 18;

    blocks.forEach((block) => {
      if (y + 40 > pageH - 40) { doc.addPage(); drawLetterhead(); y = contentTop; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(block.heading, marginX, y);

      const head = [block.columns.map((c) => ({ content: c.label, styles: { halign: c.align === "center" ? "center" : "left" } }))];
      const body = block.rows.map((r) => block.columns.map((c) => { const v = c.value(r); return v == null ? "" : String(v); }));
      const columnStyles = {};
      block.columns.forEach((c, i) => { columnStyles[i] = { halign: c.align === "center" ? "center" : "left" }; });

      autoTable(doc, {
        head, body,
        startY: y + 8,
        margin: { top: contentTop, left: marginX, right: marginX },
        theme: "grid",
        styles: { ...gridStyles, fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold", lineColor: [100, 116, 139] },
        columnStyles,
        didDrawPage: drawLetterhead,
      });
      y = doc.lastAutoTable.finalY + 20;
    });
  }

  // Page numbers, added last so the final page count is known
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
  }

  const fileBase = `bis-${(reportType || "report").toLowerCase()}-report-${(header.modelName || "report").replace(/[^a-z0-9]+/gi, "-")}`;
  doc.save(`${fileBase}.pdf`);
};

/* ─────────────────────────────────────────────────────────────────────────
   Excel — ExcelJS. Same cover grid (with fill highlights) + sign-off block,
   followed by the detail tables, all on one sheet.
───────────────────────────────────────────────────────────────────────── */
const DETAIL_COLS = 7; // widest detail table (Volume items: Category…Volume)

export const exportBisReportExcel = async ({ header, equipment, reportType, data }) => {
  const [logo, signoffImages] = await Promise.all([getWrlLogoBase64(), loadSignoffImages(header)]);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.getColumn(1).width = 32;
  for (let i = 2; i <= DETAIL_COLS; i++) sheet.getColumn(i).width = 16;

  const thin = { style: "thin", color: { argb: "FF64748B" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  let row = 1;

  if (logo) {
    const imgId = workbook.addImage({ base64: logo, extension: "png" });
    sheet.addImage(imgId, { tl: { col: 0, row: row - 1 }, ext: { width: 90, height: 45 } });
  }
  sheet.mergeCells(row, 1, row, DETAIL_COLS);
  sheet.getCell(row, 1).value = "QUALITY ASSURANCE TESTING LAB, WESTERN REFRIGERATION PVT. LTD.";
  sheet.getCell(row, 1).font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
  sheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(row).height = 46;
  row += 2;

  sheet.mergeCells(row, 1, row, DETAIL_COLS);
  const titleCell = sheet.getCell(row, 1);
  titleCell.value = reportTitle(header, reportType);
  titleCell.font = { bold: true, size: 11 };
  titleCell.alignment = { horizontal: "center" };
  titleCell.border = border;
  row++;

  const coverRows = buildCoverRows(header);
  coverRows.forEach((r) => {
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = r.label;
    labelCell.font = { bold: true };
    labelCell.border = border;

    sheet.mergeCells(row, 2, row, DETAIL_COLS);
    const valueCell = sheet.getCell(row, 2);
    valueCell.value = r.value;
    valueCell.border = border;
    if (r.label === "Test Result:") valueCell.font = { bold: true };
    row++;
  });
  row++;

  sheet.getCell(row, 1).value = "Remarks:";
  sheet.getCell(row, 1).font = { bold: true };
  row++;
  STANDARD_REMARKS.forEach((r, i) => {
    sheet.mergeCells(row, 1, row, DETAIL_COLS);
    sheet.getCell(row, 1).value = `${i + 1}. ${r}`;
    sheet.getCell(row, 1).font = { size: 9 };
    row++;
  });
  row++;

  // Sign-off footer — 3 equal column groups spanning the same width as the
  // grid. Row 4 (signature) gets the actual signature image when that stage
  // of the workflow has happened; otherwise it keeps the blank "Signature:" line.
  const groupWidth = Math.max(1, Math.floor(DETAIL_COLS / 3));
  const groupStart = (i) => 1 + i * groupWidth;
  const groupEnd = (i) => (i === 2 ? DETAIL_COLS : groupStart(i) + groupWidth - 1);
  const footerLines = [
    SIGNOFFS.map((s) => s.label),
    SIGNOFFS.map((s) => s.designation),
    SIGNOFFS.map((s) => `Name: ${header[s.nameField] || ""}`),
    SIGNOFFS.map((s, i) => (signoffImages[i] ? "" : "Signature:")),
  ];
  const signatureRow = row + 3;
  footerLines.forEach((cols, lineIdx) => {
    cols.forEach((text, i) => {
      sheet.mergeCells(row, groupStart(i), row, groupEnd(i));
      const cell = sheet.getCell(row, groupStart(i));
      cell.value = text;
      cell.border = border;
      if (lineIdx === 0) cell.font = { bold: true };
    });
    if (lineIdx === 3) sheet.getRow(row).height = 48;
    row++;
  });
  SIGNOFFS.forEach((s, i) => {
    const img = signoffImages[i];
    if (!img) return;
    const imgId = workbook.addImage({ base64: img.dataUrl, extension: "png" });
    const height = 42;
    sheet.addImage(imgId, { tl: { col: groupStart(i) - 1, row: signatureRow - 1 }, ext: { width: height * img.aspect, height } });
  });
  row += 2;

  // Detailed test data
  const blocks = buildDetailBlocks({ header, equipment, reportType, data });
  if (blocks.length) {
    sheet.mergeCells(row, 1, row, DETAIL_COLS);
    sheet.getCell(row, 1).value = "Detailed Test Data";
    sheet.getCell(row, 1).font = { bold: true, size: 12, color: { argb: "FF1E293B" } };
    row += 2;

    blocks.forEach((block) => {
      sheet.mergeCells(row, 1, row, DETAIL_COLS);
      sheet.getCell(row, 1).value = block.heading;
      sheet.getCell(row, 1).font = { bold: true, size: 10.5, color: { argb: "FF1E293B" } };
      row++;

      // Same plain header-row-in-bold-on-white style as the cover grid above
      // — no navy fill, no row striping — so the detail tables read as the
      // same document rather than a different, more "dashboard" style table.
      const headerRow = sheet.getRow(row);
      block.columns.forEach((c, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = c.label;
        cell.font = { bold: true, color: { argb: "FF1E293B" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        cell.alignment = { horizontal: c.align === "center" ? "center" : "left" };
        cell.border = border;
      });
      row++;

      block.rows.forEach((r) => {
        const dataRow = sheet.getRow(row);
        block.columns.forEach((c, i) => {
          const cell = dataRow.getCell(i + 1);
          cell.value = c.value(r) ?? "";
          cell.alignment = { horizontal: c.align === "center" ? "center" : "left" };
          cell.border = border;
        });
        row++;
      });
      row++;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const fileBase = `bis-${(reportType || "report").toLowerCase()}-report-${(header.modelName || "report").replace(/[^a-z0-9]+/gi, "-")}`;
  a.download = `${fileBase}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

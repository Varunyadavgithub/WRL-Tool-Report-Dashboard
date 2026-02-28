import PDFDocument from "pdfkit";

export const generateManpowerPDF = (res, data) => {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 40,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=Manpower_Request.pdf"
  );

  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;

  // ================= HELPER: draw a row and return new Y =================
  const drawRow = (y, values, colWidths, rowHeight, isHeader = false) => {
    let x = margin;
    values.forEach((val, i) => {
      doc.rect(x, y, colWidths[i], rowHeight).stroke();
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(String(val ?? ""), x + 4, y + (rowHeight - 12) / 2, {
          width: colWidths[i] - 8,
          align: i === 0 ? "left" : "center",
          lineBreak: false,
        });
      x += colWidths[i];
    });
    return y + rowHeight;
  };

  // ================= HEADER =================
  doc.rect(margin, margin, usableWidth, 55).fillAndStroke("#003366", "#003366");

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("white")
    .text("Western Refrigeration Pvt. Ltd.", margin, margin + 10, {
      align: "center",
      width: usableWidth,
    });

  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor("white")
    .text("Manpower Approval Request Form", margin, margin + 32, {
      align: "center",
      width: usableWidth,
    });

  let y = margin + 55 + 15;

  // ================= BASIC DETAILS =================
  const detailRowH = 24;

  // Row 1
  doc.rect(margin, y, usableWidth / 3, detailRowH).stroke();
  doc.rect(margin + usableWidth / 3, y, usableWidth / 3, detailRowH).stroke();
  doc.rect(margin + (usableWidth / 3) * 2, y, usableWidth / 3, detailRowH).stroke();

  doc.font("Helvetica-Bold").fontSize(10).fillColor("black")
    .text("Department:", margin + 5, y + 7, { continued: true })
    .font("Helvetica").text(` ${data.departmentName || "-"}`);

  doc.font("Helvetica-Bold").fontSize(10)
    .text("HOD Name:", margin + usableWidth / 3 + 5, y + 7, { continued: true })
    .font("Helvetica").text(` ${data.hodName || "-"}`);

  doc.font("Helvetica-Bold").fontSize(10)
    .text("Required Date:", margin + (usableWidth / 3) * 2 + 5, y + 7, { continued: true })
    .font("Helvetica").text(` ${data.requiredDate ? new Date(data.requiredDate).toLocaleDateString("en-IN") : "-"}`);

  y += detailRowH;

  // Row 2
  doc.rect(margin, y, usableWidth / 3, detailRowH).stroke();
  doc.rect(margin + usableWidth / 3, y, usableWidth / 3, detailRowH).stroke();
  doc.rect(margin + (usableWidth / 3) * 2, y, usableWidth / 3, detailRowH).stroke();

  doc.font("Helvetica-Bold").fontSize(10)
    .text("Required Day:", margin + 5, y + 7, { continued: true })
    .font("Helvetica").text(` ${data.requiredDay || "-"}`);

  doc.font("Helvetica-Bold").fontSize(10)
    .text("Responsible Staff:", margin + usableWidth / 3 + 5, y + 7, { continued: true })
    .font("Helvetica").text(` ${data.responsibleStaff || "-"}`);

  doc.font("Helvetica-Bold").fontSize(10)
    .text("Total Manpower:", margin + (usableWidth / 3) * 2 + 5, y + 7, { continued: true })
    .font("Helvetica").text(` ${data.totalManpower ?? 0}`);

  y += detailRowH + 15;

  // ================= MANPOWER TABLE =================
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#003366")
    .text("Manpower Headcount", margin, y);
  y += 16;

  const headColWidths = [
    usableWidth * 0.30,
    usableWidth * 0.175,
    usableWidth * 0.175,
    usableWidth * 0.175,
    usableWidth * 0.175,
  ];
  const headRowH = 26;

  // Header
  let hx = margin;
  ["", "DET", "ITI", "CASUAL", "Total"].forEach((label, i) => {
    doc.rect(hx, y, headColWidths[i], headRowH).fillAndStroke("#d0e4f7", "#000");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("black")
      .text(label, hx + 4, y + 8, { width: headColWidths[i] - 8, align: "center" });
    hx += headColWidths[i];
  });
  y += headRowH;

  const approvedTotal = (+data.approvedDET || 0) + (+data.approvedITI || 0) + (+data.approvedCASUAL || 0);
  const actualTotal   = (+data.actualDET || 0)   + (+data.actualITI || 0)   + (+data.actualCASUAL || 0);
  const additionalTotal = (+data.additionalDET || 0) + (+data.additionalITI || 0) + (+data.additionalCASUAL || 0);

  const manpowerRows = [
    ["Approved",           data.approvedDET ?? 0,   data.approvedITI ?? 0,   data.approvedCASUAL ?? 0,   approvedTotal],
    ["Actual Required",    data.actualDET ?? 0,     data.actualITI ?? 0,     data.actualCASUAL ?? 0,     actualTotal],
    ["Additional Required",data.additionalDET ?? 0, data.additionalITI ?? 0, data.additionalCASUAL ?? 0, additionalTotal],
  ];

  manpowerRows.forEach((row) => {
    y = drawRow(y, row, headColWidths, headRowH, false);
  });

  y += 15;

  // ================= OVERTIME =================
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#003366")
    .text("Overtime Details", margin, y);
  y += 16;

  const otColWidths = [usableWidth / 3, usableWidth / 3, usableWidth / 3];
  const otRowH = 26;

  // Header
  let ox = margin;
  ["From", "To", "Total Hours"].forEach((label, i) => {
    doc.rect(ox, y, otColWidths[i], otRowH).fillAndStroke("#d0e4f7", "#000");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("black")
      .text(label, ox + 4, y + 8, { width: otColWidths[i] - 8, align: "center" });
    ox += otColWidths[i];
  });
  y += otRowH;

  y = drawRow(y, [
    data.overtimeFrom || "-",
    data.overtimeTo || "-",
    data.overtimeTotal ?? 0,
  ], otColWidths, otRowH);

  y += 15;

  // ================= JUSTIFICATION =================
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#003366")
    .text("Justification for Overtime", margin, y);
  y += 16;

  const justText = data.justification || "-";
  const justHeight = Math.max(36, doc.heightOfString(justText, { width: usableWidth - 16 }) + 16);
  doc.rect(margin, y, usableWidth, justHeight).stroke();
  doc.font("Helvetica").fontSize(10).fillColor("black")
    .text(justText, margin + 8, y + 8, { width: usableWidth - 16 });

  y += justHeight + 15;

  // ================= EMPLOYEE TABLE =================
  // Add new page if not enough space
  if (y + 200 > pageHeight - 100) {
    doc.addPage();
    y = margin;
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#003366")
    .text("Employee List", margin, y);
  y += 16;

  const empColWidths = [
    usableWidth * 0.05,
    usableWidth * 0.13,
    usableWidth * 0.22,
    usableWidth * 0.13,
    usableWidth * 0.17,
    usableWidth * 0.16,
    usableWidth * 0.14,
  ];
  const empRowH = 22;

  // Header
  let ex = margin;
  ["#", "Emp Code", "Name", "Category", "Location", "Contact", "Travel By"].forEach((label, i) => {
    doc.rect(ex, y, empColWidths[i], empRowH).fillAndStroke("#d0e4f7", "#000");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("black")
      .text(label, ex + 2, y + 7, { width: empColWidths[i] - 4, align: "center" });
    ex += empColWidths[i];
  });
  y += empRowH;

  if (data.employees && data.employees.length > 0) {
    data.employees.forEach((emp, index) => {
      if (y + empRowH > pageHeight - 80) {
        doc.addPage();
        y = margin;
      }
      y = drawRow(y, [
        index + 1,
        emp.empCode || "-",
        emp.empName || "-",
        emp.category || "-",
        emp.location || "-",
        emp.contactNo || "-",
        emp.travellingBy || "-",
      ], empColWidths, empRowH);
    });
  } else {
    y = drawRow(y, ["-", "-", "-", "-", "-", "-", "-"], empColWidths, empRowH);
  }

  y += 30;

  // ================= SIGNATURE =================
  if (y + 60 > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  const sigLabels = ["HOD Approval", "HR Approval", "Plant Head Approval"];
  const sigWidth = usableWidth / 3;

  sigLabels.forEach((label, i) => {
    const sx = margin + i * sigWidth;
    const lineStartX = sx + 20;
    const lineEndX = sx + sigWidth - 20;
    const lineY = y + 20;

    doc.moveTo(lineStartX, lineY).lineTo(lineEndX, lineY).stroke();

    doc.font("Helvetica").fontSize(9).fillColor("black")
      .text(label, sx, lineY + 6, { width: sigWidth, align: "center" });
  });

  y += 50;

  // ================= FOOTER =================
  doc.moveTo(margin, pageHeight - 40)
    .lineTo(pageWidth - margin, pageHeight - 40)
    .strokeColor("#003366")
    .stroke();

  doc.fontSize(8).fillColor("gray")
    .text(
      "This is a system generated document from MES — Western Refrigeration Pvt. Ltd.",
      margin,
      pageHeight - 30,
      { align: "center", width: usableWidth }
    );

  doc.end();
};
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

  // ================= HEADER =================
  doc.rect(margin, margin, usableWidth, 60).stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Western Refrigeration Pvt. Ltd.", margin, margin + 15, {
      align: "center",
      width: usableWidth,
    });

  doc
    .font("Helvetica")
    .fontSize(14)
    .text("Manpower Approval Request Form", {
      align: "center",
    });

  doc.moveDown(4);

  // ================= BASIC DETAILS =================
  let y = doc.y;
  const detailHeight = 40;

  doc.rect(margin, y, usableWidth, detailHeight).stroke();

  doc.fontSize(11);
  doc.text(`Department: ${data.departmentName || "-"}`, margin + 10, y + 8);
  doc.text(`Required Date: ${data.requiredDate || "-"}`, margin + usableWidth / 2, y + 8);
  doc.text(`Required Day: ${data.requiredDay || "-"}`, margin + 10, y + 22);

  doc.y = y + detailHeight + 20;

  // ================= MANPOWER TABLE =================

  doc.font("Helvetica-Bold").fontSize(13).text("Manpower Headcount");
  doc.moveDown(0.5);

  const headColWidths = [
    usableWidth * 0.35,
    usableWidth * 0.21,
    usableWidth * 0.21,
    usableWidth * 0.23,
  ];

  const rowHeight = 28;
  y = doc.y;

  const drawHeadRow = (values, isHeader = false) => {
    let x = margin;

    values.forEach((val, i) => {
      doc.rect(x, y, headColWidths[i], rowHeight).stroke();

      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(11)
        .text(val, x, y + 8, {
          width: headColWidths[i],
          align: i === 0 ? "left" : "center",
        });

      x += headColWidths[i];
    });

    y += rowHeight;
  };

  drawHeadRow(["", "DET", "ITI", "CASUAL"], true);

  drawHeadRow(["Approved", data.approvedDET ?? 0, data.approvedITI ?? 0, data.approvedCASUAL ?? 0]);
  drawHeadRow(["Actual Required", data.actualDET ?? 0, data.actualITI ?? 0, data.actualCASUAL ?? 0]);
  drawHeadRow(["Additional Required", data.additionalDET ?? 0, data.additionalITI ?? 0, data.additionalCASUAL ?? 0]);

  doc.y = y + 25;

  // ================= OVERTIME =================
  doc.font("Helvetica-Bold").text("Overtime Details");
  doc.moveDown(0.5);

  y = doc.y;
  doc.rect(margin, y, usableWidth, 35).stroke();

  doc.font("Helvetica").fontSize(11);
  doc.text(`From: ${data.overtimeFrom || "-"}`, margin + 15, y + 10);
  doc.text(`To: ${data.overtimeTo || "-"}`, margin + usableWidth / 3, y + 10);
  doc.text(`Total Hours: ${data.overtimeTotal ?? 0}`, margin + (usableWidth / 3) * 2, y + 10);

  doc.y = y + 55;

  // ================= RESPONSIBLE =================
  doc.font("Helvetica-Bold").text("Responsible Staff");
  doc.moveDown(0.5);

  y = doc.y;
  doc.rect(margin, y, usableWidth, 28).stroke();
  doc.font("Helvetica").text(data.responsibleStaff || "-", margin + 10, y + 8);

  doc.y = y + 45;

  // ================= JUSTIFICATION =================
  doc.font("Helvetica-Bold").text("Justification");
  doc.moveDown(0.5);

  y = doc.y;
  doc.rect(margin, y, usableWidth, 40).stroke();
  doc.font("Helvetica").text(data.justification || "-", margin + 10, y + 8);

  doc.y = y + 60;

  // ================= EMPLOYEE TABLE =================
  doc.font("Helvetica-Bold").fontSize(13).text("Employee List");
  doc.moveDown(0.5);

  const empColWidths = [
    usableWidth * 0.05,
    usableWidth * 0.15,
    usableWidth * 0.25,
    usableWidth * 0.15,
    usableWidth * 0.15,
    usableWidth * 0.15,
    usableWidth * 0.10,
  ];

  const empRowHeight = 24;
  y = doc.y;

  const drawEmpRow = (values, isHeader = false) => {
    let x = margin;

    values.forEach((val, i) => {
      doc.rect(x, y, empColWidths[i], empRowHeight).stroke();

      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .text(val, x, y + 6, {
          width: empColWidths[i],
          align: "center",
        });

      x += empColWidths[i];
    });

    y += empRowHeight;
  };

  drawEmpRow(["#", "Emp Code", "Name", "Category", "Location", "Contact", "Travel"], true);

  if (data.employees && data.employees.length > 0) {
    data.employees.forEach((emp, index) => {

      if (y + empRowHeight > pageHeight - 100) {
        doc.addPage();
        y = margin;
      }

      drawEmpRow([
        index + 1,
        emp.empCode || "",
        emp.empName || "",
        emp.category || "",
        emp.location || "",
        emp.contactNo || "",
        emp.travellingBy || "",
      ]);
    });
  } else {
    drawEmpRow(["-", "-", "-", "-", "-", "-", "-"]);
  }

  doc.y = y + 40;

  // ================= SIGNATURE =================
  const signY = doc.y;

  const sigWidth = usableWidth / 3;

  for (let i = 0; i < 3; i++) {
    doc.moveTo(margin + i * sigWidth + 40, signY)
       .lineTo(margin + i * sigWidth + sigWidth - 40, signY)
       .stroke();
  }

  doc.moveDown(1);

  doc.text("HOD Approval", margin + sigWidth / 2 - 30);
  doc.text("HR Approval", margin + sigWidth + sigWidth / 2 - 30);
  doc.text("Plant Head Approval", margin + sigWidth * 2 + sigWidth / 2 - 50);

  // ================= FOOTER =================
  doc.moveTo(margin, pageHeight - 50)
     .lineTo(pageWidth - margin, pageHeight - 50)
     .stroke();

  doc.fontSize(8).fillColor("gray").text(
    "This is a system generated document from MES.",
    margin,
    pageHeight - 40,
    { align: "center", width: usableWidth }
  );

  doc.end();
};
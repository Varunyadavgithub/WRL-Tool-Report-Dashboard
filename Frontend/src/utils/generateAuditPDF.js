import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  primary:     [63,  81,  181],   // indigo-600
  primaryDark: [40,  53,  147],   // indigo-800
  success:     [34,  197, 94],    // green-500
  warning:     [234, 179, 8],     // yellow-500
  danger:      [239, 68,  68],    // red-500
  info:        [59,  130, 246],   // blue-500
  gray:        [107, 114, 128],   // gray-500
  lightGray:   [243, 244, 246],   // gray-100
  white:       [255, 255, 255],
  black:       [17,  24,  39],    // gray-900
  border:      [209, 213, 219],   // gray-300
};

const fmt = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return "—";
    return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
  } catch { return "—"; }
};

const statusColor = (s) => {
  if (s === "approved")  return C.success;
  if (s === "rejected")  return C.danger;
  if (s === "submitted") return C.info;
  return C.gray;
};

const cpStatusColor = (s) => {
  if (s === "pass")    return C.success;
  if (s === "fail")    return C.danger;
  if (s === "warning") return C.warning;
  if (s === "na")      return C.info;
  return C.gray;
};

// ── Main export ───────────────────────────────────────────────────────────────

export const generateAuditPDF = (audit) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
  const margin = 12;
  let y = margin;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const addPage = () => {
    doc.addPage();
    y = margin;
    drawPageFooter();
  };

  const checkY = (needed = 10) => {
    if (y + needed > H - 18) addPage();
  };

  const setFont = (size, style = "normal", color = C.black) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  };

  const fillRect = (x, ry, w, h, color) => {
    doc.setFillColor(...color);
    doc.rect(x, ry, w, h, "F");
  };

  const drawLine = (x1, y1, x2, y2, color = C.border, lw = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, y1, x2, y2);
  };

  const text = (str, x, ty, opts = {}) => {
    doc.text(String(str ?? ""), x, ty, opts);
  };

  // ── Page footer (runs on addPage) ────────────────────────────────────────────

  const drawPageFooter = () => {
    const pg = doc.internal.getCurrentPageInfo().pageNumber;
    const total = doc.internal.getNumberOfPages();
    fillRect(0, H - 10, W, 10, C.primaryDark);
    setFont(7, "normal", C.white);
    text(`${audit.reportName || "Audit Report"}  |  ${audit.auditCode || ""}`, margin, H - 4);
    text(`Page ${pg} of ${total}  |  Generated: ${new Date().toLocaleString("en-IN")}`, W - margin, H - 4, { align: "right" });
  };

  // ── 1. HEADER BAND ──────────────────────────────────────────────────────────

  fillRect(0, 0, W, 28, C.primaryDark);

  // Left: logo placeholder + title
  setFont(16, "bold", C.white);
  text("QUALITY AUDIT REPORT", margin, 12);
  setFont(8, "normal", [180, 190, 250]);
  text("Warlam Refrigeration Ltd — Internal Quality Document", margin, 18);

  // Right: audit code + status badge
  const statusLabel = (audit.status || "unknown").toUpperCase();
  const sc = statusColor(audit.status);
  doc.setFillColor(...sc);
  doc.roundedRect(W - margin - 38, 4, 38, 10, 2, 2, "F");
  setFont(7, "bold", C.white);
  text(statusLabel, W - margin - 19, 10.5, { align: "center" });

  setFont(9, "bold", [220, 220, 255]);
  text(audit.auditCode || "", W - margin, 20, { align: "right" });

  y = 33;

  // ── 2. META INFO ROW ────────────────────────────────────────────────────────

  fillRect(0, y, W, 20, C.lightGray);
  drawLine(0, y, W, y, C.border);
  drawLine(0, y + 20, W, y + 20, C.border);

  const metaFields = [
    { label: "Report Name",   value: audit.reportName   || "—" },
    { label: "Template",      value: audit.templateName || "—" },
    { label: "Format No",     value: audit.formatNo     || "—" },
    { label: "Rev. No",       value: audit.revNo        || "—" },
    { label: "Rev. Date",     value: fmt(audit.revDate) },
    { label: "Audit Date",    value: fmt(audit.createdAt) },
    { label: "Created By",    value: audit.createdBy    || "—" },
    { label: "Approved By",   value: audit.approvedBy   || "—" },
  ];

  const colW = (W - margin * 2) / metaFields.length;
  metaFields.forEach((f, i) => {
    const mx = margin + i * colW;
    if (i > 0) drawLine(mx, y + 1, mx, y + 19, C.border, 0.2);
    setFont(6.5, "bold", C.gray);
    text(f.label.toUpperCase(), mx + 2, y + 6);
    setFont(7.5, "bold", C.black);
    // wrap long values
    const lines = doc.splitTextToSize(f.value, colW - 4);
    text(lines[0], mx + 2, y + 13);
  });

  y += 24;

  // ── 3. INFO FIELDS TABLE (serialNo, modelName, shift, date, etc.) ──────────

  const infoData = audit.infoData || {};
  const infoFields = (audit.infoFields || []).filter((f) => f.visible);

  if (infoFields.length > 0) {
    checkY(20);
    setFont(8, "bold", C.primaryDark);
    text("AUDIT INFORMATION", margin, y);
    drawLine(margin, y + 1.5, margin + 60, y + 1.5, C.primary, 0.6);
    y += 6;

    const infoRows = infoFields.map((f) => {
      const value = infoData[f.id] ?? infoData[f.name] ?? "—";
      return [f.name, String(value)];
    });

    // Arrange in 2 columns side by side
    const half = Math.ceil(infoRows.length / 2);
    const leftRows  = infoRows.slice(0, half);
    const rightRows = infoRows.slice(half);
    const halfW = (W - margin * 2 - 8) / 2;

    const drawInfoTable = (rows, startX) => {
      autoTable(doc, {
        startY: y,
        startX,
        tableWidth: halfW,
        head: [],
        body: rows,
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { fontStyle: "bold", textColor: C.gray,  cellWidth: halfW * 0.38, fillColor: C.lightGray },
          1: { textColor: C.black, cellWidth: halfW * 0.62 },
        },
        theme: "plain",
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        margin: { left: startX },
      });
    };

    drawInfoTable(leftRows,  margin);
    drawInfoTable(rightRows, margin + halfW + 8);
    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  // ── 4. CHECKPOINT SECTIONS ──────────────────────────────────────────────────

  const sections = audit.sections || [];
  const columns  = (audit.columns || []).filter(
    (c) => c.visible && c.id !== "section" && c.id !== "stage",
  );

  const colHeaders = columns.map((c) => ({
    content: c.name.toUpperCase(),
    styles: {
      halign: ["status", "image"].includes(c.type) ? "center" : "left",
      cellWidth: c.type === "status" ? 18 : c.id === "checkPoint" ? 38 : "auto",
    },
  }));

  sections.forEach((section) => {
    if (!section) return;
    const stages = section.stages || [];
    const allCPs = stages.flatMap((st) => (st.checkPoints || []).map((cp) => ({ ...cp, stageName: st.stageName })));
    if (allCPs.length === 0) return;

    checkY(18);

    // Section header
    fillRect(margin, y, W - margin * 2, 7, C.primary);
    setFont(8.5, "bold", C.white);
    text((section.sectionName || "Section").toUpperCase(), margin + 3, y + 5);
    y += 9;

    // Build rows for this section
    const bodyRows = [];
    let prevStage = null;

    allCPs.forEach((cp) => {
      const row = columns.map((col) => {
        if (col.id === "stage") return cp.stageName !== prevStage ? cp.stageName : "";
        const val = cp[col.id] ?? "—";
        if (col.id === "status") return { content: (String(val)).toUpperCase(), styles: { halign: "center", textColor: cpStatusColor(cp.status), fontStyle: "bold" } };
        return String(val === undefined || val === null || val === "" ? "—" : val);
      });
      prevStage = cp.stageName;
      bodyRows.push(row);
    });

    checkY(12);

    autoTable(doc, {
      startY: y,
      head: [colHeaders],
      body: bodyRows,
      styles: {
        fontSize: 7,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        overflow: "linebreak",
        lineColor: C.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [232, 234, 252],
        textColor: C.primaryDark,
        fontStyle: "bold",
        fontSize: 6.5,
        lineWidth: 0.2,
        lineColor: C.border,
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: columns[0]?.id === "stage" ? { cellWidth: 22, fontStyle: "bold", textColor: C.gray } : {},
      },
      tableLineColor: C.border,
      tableLineWidth: 0.2,
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body") {
          const colDef = columns[data.column.index];
          if (colDef?.id === "status") {
            const status = allCPs[data.row.index]?.status;
            data.cell.styles.textColor = cpStatusColor(status);
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    y = (doc.lastAutoTable?.finalY || y) + 6;
  });

  // ── 5. SUMMARY ──────────────────────────────────────────────────────────────

  checkY(32);

  const sum = audit.summary || {};
  const total = sum.total || 0;
  const passRate = total > 0 ? Math.round((sum.pass / total) * 100) : 0;

  fillRect(margin, y, W - margin * 2, 6, C.primaryDark);
  setFont(8, "bold", C.white);
  text("AUDIT SUMMARY", margin + 3, y + 4.5);
  y += 8;

  const summaryItems = [
    { label: "Total Checkpoints", value: total,           color: C.black   },
    { label: "Passed",            value: sum.pass || 0,   color: C.success },
    { label: "Failed",            value: sum.fail || 0,   color: C.danger  },
    { label: "Warning",           value: sum.warning || 0,color: C.warning },
    { label: "N/A",               value: sum.na || 0,     color: C.info    },
    { label: "Pending",           value: sum.pending || 0,color: C.gray    },
    { label: "Pass Rate",         value: `${passRate}%`,  color: passRate >= 80 ? C.success : passRate >= 60 ? C.warning : C.danger },
  ];

  const boxW = (W - margin * 2) / summaryItems.length;

  summaryItems.forEach((item, i) => {
    const bx = margin + i * boxW;
    fillRect(bx, y, boxW, 18, i % 2 === 0 ? C.white : C.lightGray);
    drawLine(bx, y, bx, y + 18, C.border, 0.2);

    setFont(6.5, "bold", C.gray);
    text(item.label.toUpperCase(), bx + boxW / 2, y + 6, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...item.color);
    text(String(item.value), bx + boxW / 2, y + 15, { align: "center" });
  });
  drawLine(margin, y + 18, W - margin, y + 18, C.border);
  y += 22;

  // ── Stacked pass rate bar ─────────────────────────────────────────────────
  if (total > 0) {
    checkY(10);
    const barW = W - margin * 2;
    const barH = 5;
    const segments = [
      { val: sum.pass,    color: C.success },
      { val: sum.warning, color: C.warning },
      { val: sum.fail,    color: C.danger  },
      { val: sum.na,      color: C.info    },
    ];
    let bx = margin;
    fillRect(margin, y, barW, barH, C.lightGray);
    segments.forEach(({ val, color }) => {
      if (!val) return;
      const segW = (val / total) * barW;
      fillRect(bx, y, segW, barH, color);
      bx += segW;
    });
    drawLine(margin, y, W - margin, y, C.border, 0.2);
    drawLine(margin, y + barH, W - margin, y + barH, C.border, 0.2);
    y += barH + 6;
  }

  // ── 6. REJECTION REMARKS (if any) ─────────────────────────────────────────

  if (audit.approvalComments) {
    checkY(16);
    fillRect(margin, y, W - margin * 2, 6, [254, 226, 226]);
    setFont(8, "bold", C.danger);
    text("REJECTION REMARKS", margin + 3, y + 4.5);
    y += 8;
    setFont(7.5, "normal", C.black);
    const lines = doc.splitTextToSize(audit.approvalComments, W - margin * 2 - 6);
    lines.forEach((line) => {
      checkY(6);
      text(line, margin + 3, y);
      y += 5;
    });
    y += 4;
  }

  // ── 7. SIGNATURES ────────────────────────────────────────────────────────────

  checkY(28);

  const sigs = audit.signatures || {};
  const halfS = (W - margin * 2 - 8) / 2;

  [[sigs.auditor, "AUDITOR / QUALITY OPERATOR"], [sigs.approver, "APPROVED BY / LINE QUALITY ENGINEER"]].forEach(([sig, label], i) => {
    const sx = margin + i * (halfS + 8);
    fillRect(sx, y, halfS, 22, C.lightGray);
    drawLine(sx, y, sx + halfS, y, C.border, 0.3);
    drawLine(sx, y + 22, sx + halfS, y + 22, C.border, 0.3);
    drawLine(sx, y, sx, y + 22, C.border, 0.3);
    drawLine(sx + halfS, y, sx + halfS, y + 22, C.border, 0.3);

    setFont(6.5, "bold", C.primary);
    text(label, sx + halfS / 2, y + 5, { align: "center" });

    if (sig?.name) {
      setFont(9, "bold", C.black);
      text(sig.name, sx + halfS / 2, y + 14, { align: "center" });
      setFont(7, "normal", C.gray);
      text(fmt(sig.date), sx + halfS / 2, y + 20, { align: "center" });
    } else {
      setFont(7.5, "normal", [180, 180, 180]);
      text("Not yet signed", sx + halfS / 2, y + 14, { align: "center" });
    }
  });

  y += 26;

  // ── Add footer to all pages ─────────────────────────────────────────────────

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter();
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const filename = `${audit.auditCode || "audit"}_${audit.reportName?.replace(/\s+/g, "_") || "report"}.pdf`;
  doc.save(filename);
};

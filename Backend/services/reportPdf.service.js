/**
 * Generic multi-section PDF builder — server-side port of the frontend's
 * exportMultiSectionPDF (Frontend/src/utils/reportExport.js), using pdfkit
 * instead of jsPDF since this runs in Node, not a browser. Used to build the
 * PDF attachments sent with subscriber emails so they mirror what the
 * Production/Quality/Downtime/Hourly report pages export.
 *
 *   block = { type: "table", heading, columns: [{ label, align, width, value(row) }], rows }
 *         | { type: "image", heading, buffer, width, height }
 */
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");

const ROW_H = 16;

export const buildSectionsPDF = ({ title, subtitle, blocks }) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30, bufferPages: true });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 30;
      const usableWidth = pageWidth - margin * 2;

      let headerOffset = 0;
      try {
        doc.image(LOGO_PATH, margin, margin, { width: 64, height: 32 });
        headerOffset = 74;
      } catch {
        headerOffset = 0;
      }

      doc.font("Helvetica-Bold").fontSize(14).fillColor("#1e293b")
        .text(title, margin + headerOffset, margin + 2, { width: usableWidth - headerOffset });
      if (subtitle) {
        doc.font("Helvetica").fontSize(9).fillColor("#64748b")
          .text(subtitle, margin + headerOffset, margin + 20, { width: usableWidth - headerOffset });
      }

      let y = margin + 48;

      const ensureSpace = (h) => {
        if (y + h > pageHeight - margin - 20) {
          doc.addPage();
          y = margin;
        }
      };

      blocks.forEach((block) => {
        if (block.type === "image") {
          if (!block.buffer) return;
          const w = Math.min(block.width || 460, usableWidth);
          const h = block.height || 220;
          // Keep the heading glued to its chart — check space for both together
          // so a heading never gets orphaned at the bottom of a page.
          ensureSpace(16 + h + 10);
          doc.font("Helvetica-Bold").fontSize(11).fillColor("#1e293b").text(block.heading, margin, y);
          y += 16;
          doc.image(block.buffer, margin, y, { width: w, height: h });
          y += h + 16;
          return;
        }

        ensureSpace(16 + ROW_H);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#1e293b").text(block.heading, margin, y);
        y += 16;

        const cols = block.columns;
        const weights = cols.map((c) => c.width || 1);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const colWidths = weights.map((w) => (w / totalWeight) * usableWidth);

        let x = margin;
        cols.forEach((c, i) => {
          doc.rect(x, y, colWidths[i], ROW_H).fillAndStroke("#1e3a8a", "#1e293b");
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
            .text(c.label, x + 3, y + 4, { width: colWidths[i] - 6, align: c.align === "center" ? "center" : "left", lineBreak: false });
          x += colWidths[i];
        });
        y += ROW_H;

        block.rows.forEach((r, idx) => {
          ensureSpace(ROW_H);
          let rx = margin;
          cols.forEach((c, i) => {
            if (idx % 2 === 1) doc.rect(rx, y, colWidths[i], ROW_H).fillAndStroke("#f8fafc", "#cbd5e1");
            else doc.rect(rx, y, colWidths[i], ROW_H).stroke("#cbd5e1");
            const v = c.value(r);
            doc.font("Helvetica").fontSize(8).fillColor("#1e293b")
              .text(v == null ? "" : String(v), rx + 3, y + 4, { width: colWidths[i] - 6, align: c.align === "center" ? "center" : "left", lineBreak: false });
            rx += colWidths[i];
          });
          y += ROW_H;
        });
        y += 14;
      });

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(8).fillColor("#94a3b8")
          .text(`Page ${i - range.start + 1} of ${range.count}`, pageWidth - margin - 100, pageHeight - 20, { width: 100, align: "right" });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

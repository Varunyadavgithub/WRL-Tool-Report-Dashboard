import fs from "fs";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

/**
 * Pulls the Energy Consumption Test results out of a WRL BIS lab report PDF:
 *   - Annual energy consumption (kWh/year): declared (spec) vs measured
 *   - The declared-vs-measured deviation percentage
 *   - That check's PASS/FAIL result
 *
 * Best-effort only — labs occasionally tweak report layout, so a failed
 * match (or any throw along the way) must never block the upload. Callers
 * get back all-null fields on any failure.
 *
 * Two extraction paths, tried in order:
 *   1. Native text layer (fast) — works for digitally-generated PDFs.
 *   2. OCR fallback (slow) — in practice most of these reports are signed
 *      and scanned/photocopied, carrying no text layer at all. Each page is
 *      rendered to a PNG (high scale + a page-segmentation mode tuned for
 *      dense tables — both were necessary in testing: at default settings
 *      Tesseract silently misread digits, e.g. "1066" as "1086") and OCR'd,
 *      stopping at the first page that yields every field.
 *
 * The PASS/FAIL "Result" table cell itself turned out to be the least
 * reliable thing to OCR — it's a single short row that both the page-1
 * summary and the page-3 table lost entirely in testing, even once the
 * numeric cells around it were reading correctly. Rather than depend on
 * OCR-ing that one word, it's computed from the declared/measured values
 * using the exact rule the report states ("Declared Annual Energy
 * Consumption shall be <= 1.1 * Measured Annual Energy Consumption") —
 * falling back to that only if the literal PASS/FAIL text isn't found.
 */
const NUM = "-?\\d+(?:\\.\\d+)?";

// Below this, treat the PDF's native text layer as effectively empty (a
// handful of stray characters from page furniture, not real content) and
// go straight to OCR instead of wasting a regex pass on it.
const MIN_NATIVE_TEXT_LENGTH = 200;

const emptyFields = () => ({
  declaredAnnualEnergy: null,
  measuredAnnualEnergy: null,
  energyDeviationPercent: null,
  testResult: null,
});

const isComplete = (r) =>
  r.declaredAnnualEnergy != null &&
  r.measuredAnnualEnergy != null &&
  r.energyDeviationPercent != null &&
  r.testResult != null;

// Fills any still-null field in `base` from `extra` — combines partial
// matches across OCR'd pages when no single page has every field.
const mergeFields = (base, extra) => ({
  declaredAnnualEnergy:   base.declaredAnnualEnergy   ?? extra.declaredAnnualEnergy,
  measuredAnnualEnergy:   base.measuredAnnualEnergy   ?? extra.measuredAnnualEnergy,
  energyDeviationPercent: base.energyDeviationPercent ?? extra.energyDeviationPercent,
  testResult:             base.testResult             ?? extra.testResult,
});

const parseEnergyFields = (rawText) => {
  const result = emptyFields();
  const text = rawText.replace(/\s+/g, " ").trim();

  // "Annual energy consumption (kWh/year)  <declared>  ...garbage...  <measured>"
  // OCR frequently drops a blank/garbled cell between the two numbers (e.g.
  // "1066 ER ana 1061.519"), so allow a short run of non-digit noise rather
  // than requiring the numbers to be strictly adjacent.
  const annualMatch = text.match(
    new RegExp(
      `Annual\\s+energy\\s+consumption\\s*\\(\\s*kWh\\s*/\\s*year\\s*\\)\\s*(${NUM})\\D{0,40}?(${NUM})`,
      "i",
    ),
  );
  if (annualMatch) {
    result.declaredAnnualEnergy = parseFloat(annualMatch[1]);
    result.measuredAnnualEnergy = parseFloat(annualMatch[2]);
  }

  // "...shall be less than or equal to 1.1 * Measured Annual Energy
  // Consumption) <=10% -0.42% Result PASS" — anchor on "Measured Annual
  // Energy" alone (not the trailing "Consumption)"), since OCR line-wrap
  // sometimes reorders "Consumption)" to *after* the percentages.
  const clauseIdx = text.search(/Measured\s+Annual\s+Energy/i);
  if (clauseIdx !== -1) {
    const window = text.slice(clauseIdx, clauseIdx + 300);

    // The spec column shows a plain "10%" before the actual signed result,
    // so take the LAST percentage in the window, not the first.
    const pctMatches = [...window.matchAll(new RegExp(`(${NUM})\\s*%`, "g"))];
    if (pctMatches.length > 0) {
      result.energyDeviationPercent = parseFloat(pctMatches[pctMatches.length - 1][1]);
    }

    const resultMatch = window.match(/Result\s*[:\-]?\s*(PASS|FAIL)/i);
    if (resultMatch) {
      result.testResult = resultMatch[1].toUpperCase();
    }
  }

  // The PASS/FAIL cell is the least OCR-reliable part of this report (it's
  // a single short row that gets dropped even when everything around it
  // reads fine) — derive it from the numbers instead of the literal text
  // whenever we have both and didn't already find the word itself.
  if (!result.testResult && result.declaredAnnualEnergy != null && result.measuredAnnualEnergy != null) {
    result.testResult = result.declaredAnnualEnergy <= 1.1 * result.measuredAnnualEnergy ? "PASS" : "FAIL";
  }

  return result;
};

const extractViaOCR = async (parser) => {
  const { total } = await parser.getInfo();
  const worker = await createWorker("eng");
  // Default page-segmentation mode misread digits in dense tables (e.g.
  // "1066" -> "1086"). Mode 6 ("uniform block of text") was reliable in
  // testing against real scanned reports.
  await worker.setParameters({ tessedit_pageseg_mode: "6" });
  let best = emptyFields();

  try {
    for (let page = 1; page <= total; page++) {
      // scale 2 was enough to read prose but corrupted table digits; scale 4
      // fixed it in testing at the cost of ~2x OCR time per page.
      const screenshot = await parser.getScreenshot({ partial: [page], scale: 4 });
      const imageData = screenshot.pages[0]?.data;
      if (!imageData) continue;

      const {
        data: { text: ocrText },
      } = await worker.recognize(Buffer.from(imageData));

      best = mergeFields(best, parseEnergyFields(ocrText));
      if (isComplete(best)) break;
    }
  } finally {
    await worker.terminate();
  }

  return best;
};

export const extractBisEnergyData = async (filePath) => {
  let parser;
  try {
    const buffer = fs.readFileSync(filePath);
    parser = new PDFParse({ data: buffer });

    const { text: nativeText } = await parser.getText();
    if (nativeText.replace(/\s+/g, " ").trim().length >= MIN_NATIVE_TEXT_LENGTH) {
      return parseEnergyFields(nativeText);
    }

    // No usable text layer — this report is scanned/photocopied. Fall back
    // to OCR, page by page, stopping once a page yields every field.
    return await extractViaOCR(parser);
  } catch (err) {
    console.error("BIS PDF energy-data extraction failed:", err.message);
    return emptyFields();
  } finally {
    if (parser) await parser.destroy().catch(() => {});
  }
};

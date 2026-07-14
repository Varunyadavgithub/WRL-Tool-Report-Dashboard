import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateShiftReportInsight } from "../../ai/insights/shiftReportInsight.js";

export const getShiftReportInsight = tryCatch(async (req, res) => {
  const { start, end, shiftName } = req.query;
  if (!start || !end) throw new AppError("start and end query params are required (YYYY-MM-DD).", 400);

  // Only buildShiftInsightPayload's own validation (e.g. the shared
  // MAX_RANGE_DAYS range-cap check) throws here — narrative failures are
  // already caught inside generateShiftReportInsight and returned as
  // narrativeError, not thrown. Same "surface the plain-language message"
  // convention as the AI tools that share this range-check code path.
  let result;
  try {
    result = await generateShiftReportInsight(start, end, shiftName || undefined);
  } catch (err) {
    throw new AppError(err.message, 400);
  }
  res.json({ success: true, data: { ...result.payload, narrative: result.narrative, narrativeError: result.narrativeError } });
});

import * as getProductionSummary from "./getProductionSummary.tool.js";
import * as compareProductionRanges from "./compareProductionRanges.tool.js";
import * as getDowntimeAnalysis from "./getDowntimeAnalysis.tool.js";
import * as getAuditSummary from "./getAuditSummary.tool.js";
import * as getTotalProduction from "./getTotalProduction.tool.js";
import * as getLineProduction from "./getLineProduction.tool.js";
import * as getFpaSummary from "./getFpaSummary.tool.js";
import * as getLptSummary from "./getLptSummary.tool.js";
import * as getEstSummary from "./getEstSummary.tool.js";
import * as getGasChargingSummary from "./getGasChargingSummary.tool.js";
import * as getReworkSummary from "./getReworkSummary.tool.js";
import * as getDispatchSummary from "./getDispatchSummary.tool.js";
import * as getCalibrationStatus from "./getCalibrationStatus.tool.js";
import * as getVisitorStats from "./getVisitorStats.tool.js";

// Hand-picked, fixed list — every tool wraps an existing data service rather
// than exposing raw SQL. Add new tools here as they're built (see the plan's
// build order); don't auto-generate this from every controller.
const TOOLS = [
  getProductionSummary, compareProductionRanges, getDowntimeAnalysis, getAuditSummary,
  getTotalProduction, getLineProduction, getFpaSummary, getLptSummary, getEstSummary,
  getGasChargingSummary, getReworkSummary, getDispatchSummary, getCalibrationStatus, getVisitorStats,
];

export const getToolDefinitions = () => TOOLS.map((t) => t.definition);

export const getToolByName = (name) => TOOLS.find((t) => t.definition.function.name === name);

import { buildShiftReport } from "../../services/shiftReport.service.js";

export const getShiftsForDate = async (shiftName) => {
  const request = global.pool3.request();
  let query = `SELECT Id AS id, ShiftName AS shiftName, StartTime AS startTime, EndTime AS endTime
               FROM ShiftConfigs WHERE Status = 1`;
  if (shiftName) {
    request.input("shiftName", shiftName);
    query += ` AND ShiftName = @shiftName`;
  }
  const result = await request.query(query);
  return result.recordset;
};

const dateRange = (start, end) => {
  const dates = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

// Each shift-report fetch is 4 parallel SQL round-trips; global.pool3 caps at
// 10 connections (Backend/config/db.config.js). Firing one Promise.all across
// every (day x shift) in a wide range — e.g. a 2-month comparison, ~180+
// shift-reports — floods the pool and each request queues behind the last
// instead of failing, so the assistant just goes quiet for a very long time.
// Bound both the range size and the in-flight concurrency.
const MAX_RANGE_DAYS = 45;
const CONCURRENCY = 4;

const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

/**
 * Fetches every shift report in [start, end] (inclusive), optionally scoped to
 * one shift name. Used by tools that need to aggregate across a date range
 * rather than a single day (compareProductionRanges, getDowntimeAnalysis).
 * Throws for ranges wider than MAX_RANGE_DAYS — callers should surface this as
 * a tool error rather than let the DB pool queue silently for minutes.
 */
export const getShiftReportsInRange = async (start, end, shiftName) => {
  const dates = dateRange(start, end);
  if (dates.length > MAX_RANGE_DAYS) {
    throw new Error(
      `Date range too wide (${dates.length} days). Please ask for ${MAX_RANGE_DAYS} days or fewer at a time.`,
    );
  }

  const shifts = await getShiftsForDate(shiftName);
  const tasks = dates.flatMap((dateStr) => shifts.map((shift) => ({ dateStr, shift })));

  const results = await mapWithConcurrency(tasks, CONCURRENCY, async ({ dateStr, shift }) => ({
    date: dateStr,
    shiftName: shift.shiftName,
    report: await buildShiftReport(global.pool3, shift, dateStr),
  }));

  return results.filter((r) => r.report);
};

export const sumTotals = (reports) =>
  reports.reduce(
    (acc, { report }) => {
      acc.planQty += report.totals.planQty;
      acc.actualQty += report.totals.actualQty;
      acc.componentQty += report.totals.componentQty;
      acc.accepted += report.totals.accepted;
      acc.rejected += report.totals.rejected;
      acc.lossMins += report.totals.lossMins;
      acc.oeeSum += report.totals.oee;
      acc.count += 1;
      return acc;
    },
    { planQty: 0, actualQty: 0, componentQty: 0, accepted: 0, rejected: 0, lossMins: 0, oeeSum: 0, count: 0 },
  );

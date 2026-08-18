/**
 * Auto-adds FG production plans (PlanQty=10000) for every FG material
 * (Material.Type=100) that doesn't yet have a PlanOrderPrint row for the
 * current month. Runs twice daily (9:00 AM and 9:00 PM IST) so newly added
 * materials or a fresh month get picked up quickly. Safe to re-run: materials
 * that already have a plan (added here or manually) are skipped.
 */
import cron from "node-cron";
import sql, { connectToDB, dbConfig1 } from "../config/db.config.js";
import { generatePlanNo } from "../controllers/planing/productionPlaning.controller.js";

const DEFAULT_QTY = 10000;
const PLAN_TYPE = "FG";
const DEFAULT_CREATED_BY = 1000; // system/automation user code

const currentPlanMonthYear = () => {
  const now = new Date();
  return Number(`${now.getMonth() + 1}${now.getFullYear()}`);
};

// Core logic, reused by both the daily cron and the manual CLI script
// (scripts/autoAddNotPlannedFg.js). Pass dryRun to reserve+rollback instead
// of committing, so nothing is written but PlanNo generation is still exercised.
export const runAutoAddNotPlannedFg = async ({
  planMonthYear = currentPlanMonthYear(),
  createdBy = DEFAULT_CREATED_BY,
  dryRun = false,
} = {}) => {
  const yearYY = String(planMonthYear % 100).padStart(2, "0");
  const currentDateTime = new Date(new Date().getTime() + 330 * 60000);

  const pool = await connectToDB(dbConfig1);

  const notPlannedRes = await pool
    .request()
    .input("planMonthYear", sql.Int, planMonthYear)
    .input("planType", sql.NVarChar, PLAN_TYPE)
    .query(`
      SELECT m.MatCode, m.Alias
      FROM Material m
      WHERE m.Type = 100
        AND m.Alias NOT LIKE '%dont use%'
        AND NOT EXISTS (
          SELECT 1 FROM PlanOrderPrint pop
          WHERE pop.PlanMaterial = m.MatCode
            AND pop.PlanType = @planType
            AND pop.PlanMonthYear = @planMonthYear
        )
      ORDER BY m.MatCode
    `);

  const notPlanned = notPlannedRes.recordset;
  const results = [];

  for (const mat of notPlanned) {
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const planNo = await generatePlanNo(transaction, yearYY);

      await new sql.Request(transaction)
        .input("planNo", sql.Int, planNo)
        .input("planMonthYear", sql.Int, planMonthYear)
        .input("planMaterial", sql.Int, mat.MatCode)
        .input("planQty", sql.Int, DEFAULT_QTY)
        .input("planType", sql.NVarChar, PLAN_TYPE)
        .input("remark", sql.NVarChar, "Auto-added")
        .input("createdBy", sql.Int, createdBy)
        .input("createdOn", sql.DateTime, currentDateTime)
        .query(`
          INSERT INTO PlanOrderPrint
            (PlanNo, PlanMonthYear, PlanMaterial, PlanQty, PrintLbl, PlanType, Remark, CreatedBy, CreatedOn, Status)
          VALUES
            (@planNo, @planMonthYear, @planMaterial, @planQty, 0, @planType, @remark, @createdBy, @createdOn, 0)
        `);

      if (dryRun) {
        await transaction.rollback();
      } else {
        await transaction.commit();
      }
      results.push({ status: "success", matcode: mat.MatCode, alias: mat.Alias, planNo });
    } catch (err) {
      await transaction.rollback();
      results.push({
        status: "failed",
        matcode: mat.MatCode,
        alias: mat.Alias,
        reason: err.message,
      });
    }
  }

  return { planMonthYear, dryRun, total: notPlanned.length, results };
};

export const startAutoAddNotPlannedFgCron = () => {
  cron.schedule(
    "0 9,21 * * *",
    async () => {
      console.log("[AutoAddNotPlannedFg] Run starting...");
      try {
        const { planMonthYear, total, results } = await runAutoAddNotPlannedFg();
        const inserted = results.filter((r) => r.status === "success").length;
        const failed = results.filter((r) => r.status === "failed").length;
        console.log(
          `[AutoAddNotPlannedFg] PlanMonthYear=${planMonthYear}. Found: ${total}, Inserted: ${inserted}, Failed: ${failed}.`
        );
        results
          .filter((r) => r.status === "failed")
          .forEach((r) => console.error(`[AutoAddNotPlannedFg]   ! ${r.matcode} ${r.alias}: ${r.reason}`));
      } catch (err) {
        console.error("[AutoAddNotPlannedFg] Cron run failed:", err.message);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
  console.log("[AutoAddNotPlannedFg] Cron started — running daily at 9:00 AM and 9:00 PM IST.");
};

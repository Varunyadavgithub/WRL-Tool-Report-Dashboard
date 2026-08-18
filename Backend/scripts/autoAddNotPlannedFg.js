// Manual CLI entry point for the daily auto-add-not-planned-FG cron
// (see Backend/cron/autoAddNotPlannedFg.cron.js for the shared logic and
// the actual daily schedule).
// Usage: node scripts/autoAddNotPlannedFg.js [planMonthYear] [createdByUserCode] [--dry-run]
//   planMonthYear     defaults to the current month, e.g. August 2026 -> 82026
//   createdByUserCode defaults to 1000 (system/automation user code)
//   --dry-run         runs the full flow (incl. PlanNo generation) but rolls back
//                      every transaction instead of committing, so nothing is written
import { runAutoAddNotPlannedFg } from "../cron/autoAddNotPlannedFg.cron.js";

const isDryRun = process.argv.includes("--dry-run");
const positionalArgs = process.argv.slice(2).filter((a) => a !== "--dry-run");

const planMonthYearArg = positionalArgs[0] ? Number(positionalArgs[0]) : undefined;
const createdByArg = positionalArgs[1] ? Number(positionalArgs[1]) : undefined;

if (positionalArgs[0] && Number.isNaN(planMonthYearArg)) {
  console.error(
    "Usage: node scripts/autoAddNotPlannedFg.js [planMonthYear] [createdByUserCode] [--dry-run]"
  );
  process.exit(1);
}

if (isDryRun) {
  console.log("[DRY RUN] No data will be written — every transaction will be rolled back.");
}

const { planMonthYear, total, results } = await runAutoAddNotPlannedFg({
  ...(planMonthYearArg ? { planMonthYear: planMonthYearArg } : {}),
  ...(createdByArg ? { createdBy: createdByArg } : {}),
  dryRun: isDryRun,
});

console.log(`Found ${total} not-planned FG material(s) for PlanMonthYear=${planMonthYear}.`);

let inserted = 0;
let failed = 0;

for (const r of results) {
  if (r.status === "success") {
    inserted++;
    console.log(
      `  ${isDryRun ? "[DRY RUN] would insert" : "+"} ${r.matcode} ${r.alias} -> PlanNo ${r.planNo}`
    );
  } else {
    failed++;
    console.error(`  ! Failed for ${r.matcode} ${r.alias}: ${r.reason}`);
  }
}

console.log(
  `Done${isDryRun ? " (dry run, nothing written)" : ""}. Inserted: ${inserted}, Failed: ${failed}.`
);
process.exit(0);

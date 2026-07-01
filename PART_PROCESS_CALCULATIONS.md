# Part Process — Calculations Reference

What gets calculated, the exact formula, and which database table/field it reads from. Covers the Dashboard/Overview, the four report pages (Production, Quality, Downtime, Hourly), Planning Config targets, and the emailed PDF reports (which mirror the report-page math server-side).

---

## 1. Data sources

| Table | What it holds | Populated by |
|---|---|---|
| `PartProcessEvents` | Raw machine cycle events — one row per production cycle or downtime/idle gap. Fields: `EventId, EventDate, ShiftName, EventType (Production/Downtime), Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality` | External machine-monitoring feed (not written by this Node backend — no `INSERT` into this table exists in this repo, so it's synced in from the floor-side system) |
| `MaterialConfigs` | Master Config → Material Config. Per-part conversion factors: `SapCode, PartName, NoOfSheet, ActualComponentsPerSheet, PncLoadingUnloading, DefinedComponentCycleTime` | Manually maintained in Master Config UI |
| `PartProcessQualityLog` | Manually logged quality inspections (Dashboard's "Log Quality" form): `PartName, SapCode, InspectedQty, RejectedQty, DefectCode, DefectName, Severity, Disposition` | Operator, via Dashboard quality modal |
| `PartProcessDowntimeLog` | Manually logged downtime reasons / changeovers: `EventId, ReasonName, Category, Duration, IsChangeover, FromModel, Remarks` | Operator, via Dashboard downtime modal |
| `ShiftConfigs` | Shift definitions: `ShiftName, StartTime, EndTime, Status` | Master Config → Shift Config |
| `ProductionPlans` | Master Config → Planning Config: `SapCode, MachineName, TargetQty, PlanDate, Shift, Status` | Manual entry or Excel bulk-upload |
| `Machines` | Machine identity/image for the Dashboard header | Master Config → Machine Config |

`PartProcessEvents.EventDate` is the **production day the shift started on** — an overnight shift (20:00 → 08:00 next day) files all its rows under the start date, not the date the machine stopped. Every date-bucketing calc below accounts for this.

---

## 2. Shared building blocks

These are defined once (`Frontend/src/utils/productionLogic.js`, ported 1:1 to `Backend/utils/productionLogic.js` for the email PDFs) and reused everywhere else.

### 2.1 Downtime vs Idle classification

```
effectiveState = duration < 10 min ? "Downtime" (brief stop) : "Idle" (standing idle)
```
`IDLE_THRESHOLD_MINS = 10`. A `PartProcessEvents` row with `EventType = "Downtime"` and `Duration = "00:14:30"` (14.5 min) → classified **Idle**. `Duration = "00:03:00"` → classified **Downtime**.

### 2.2 Changeover detection

Whenever consecutive Production records change `model`, the gap between the last cycle of the old model and the first cycle of the new model is a changeover.

```
gapMins    = startOfNewModel − endOfLastModel
overrunMins = max(0, gapMins − 5)         // STD_CHANGEOVER_MINS = 5
isOverrun   = gapMins > 5
```
Gaps under 1 minute are discarded (`MIN_REAL_CO_MINS = 1`) — two interleaved machines stroking in the same second otherwise produce hundreds of fake "0.0 min changeovers."

**Example:** Last cycle of Part A ends 10:14:00, first cycle of Part B starts 10:21:30 → `gapMins = 7.5` → `overrunMins = 2.5`, `isOverrun = true`.

### 2.3 Sheet → Component conversion ("punching" parts)

A part is "punching" when `MaterialConfigs.NoOfSheet > 0` and `ActualComponentsPerSheet > 0` (one machine stroke punches multiple stacked sheets, each yielding multiple components).

```
isPunchingPart = NoOfSheet > 0 AND ActualComponentsPerSheet > 0

componentQty = isPunchingPart
  ? NoOfSheet × ActualComponentsPerSheet × machineQty
  : machineQty                              // non-punching: 1 sheet = 1 component

sheetCT = isPunchingPart ? machineCycleSecs ÷ NoOfSheet : machineCycleSecs
compCT  = isPunchingPart ? (sheetCT + PncLoadingUnloading) ÷ ActualComponentsPerSheet : null
```
**Example:** Material `NoOfSheet=2`, `ActualComponentsPerSheet=4`, `PncLoadingUnloading=3s`. Machine punches 10 strokes (`machineQty=10`) at an average cycle of 14s:
- `componentQty = 2 × 4 × 10 = 80` components
- `sheetCT = 14 ÷ 2 = 7s` per sheet
- `compCT = (7 + 3) ÷ 4 = 2.5s` per component

### 2.4 SAP code / material lookup

`getMaterialByModel` extracts every numeric run from the machine's program/barcode string (e.g. `"O0001(1130596-C-OUTER-BTM)"` → candidates `["0001", "1130596"]`), tries longest-first against `MaterialConfigs.SapCode` (exact match → leading-zero-stripped match → substring-in-`PartName` match). This is how a raw machine barcode resolves to a real part and its conversion factors.

---

## 3. Dashboard & Overview — live OEE (`usePartProcessOEE.js → computeOEE`)

This is the **real-time floor view** — classic textbook OEE, scoped to whichever shift/date range is selected. Different methodology from the Production Report (§4) — see the note at the end of this section for why.

```
qty       = Σ PartsQty over Production records
downMins  = Σ duration over Downtime records, in minutes
runTimeMins = Σ duration over Production records, in minutes
planned   = max(plannedMins, runTimeMins, 1)   // plannedMins = configured shift duration

A (Availability) = min(100, max(0, round(((planned − downMins) / planned) × 100)))

P (Performance)  = idealCycleSecs known?
    ? min(100, round(((qty × idealCycleSecs) / max(1, planned×60 − downSecs)) × 100))
    : 100   // unknown ideal cycle time → don't penalise, just flag "unverified"

Q (Quality)      = hasQualityData?
    ? min(100, round((goodQty / qty) × 100))
    : 100   // no quality sensor data → assume all good, flag "unverified"

OEE = round((A/100) × (P/100) × (Q/100) × 100)
```
`idealCycleSecs` is the **dominant model's** `DefinedComponentCycleTime` (the model with the highest qty in the window).

**Example:** Shift 1 (08:00–20:00, 720 min planned). 650 components produced, 45 min downtime, dominant part's defined cycle = 9s, quality sensor reports 620 good of 650:
- `A = round(((720−45)/720)×100) = 94%`
- `netSecs = 720×60 − 45×60 = 40500s` → `P = round((650×9/40500)×100) = 14%` *(this example intentionally shows P collapsing when defined CT is much smaller than actual — a real shift's defined CT and actual output are usually much closer)*
- `Q = round((620/650)×100) = 95%`
- `OEE = round(0.94 × 0.14 × 0.95 × 100) = 13%`

> **Why two different OEE formulas exist in this app:** the Dashboard/Overview compute Availability from *shift planned time vs. downtime* and Performance from *ideal cycle time vs. net run time* — a real-time "is the floor running well right now" view. The Production Report (§4) instead computes Availability and Performance from *Plan Qty vs. Defined CT* and *Actual Qty vs. Plan Qty* — a "did we hit the target" historical view, in component units, driven by Planning Config. They will not produce identical OEE% for the same shift; that's by design, not a bug.

---

## 4. Production Report — per-part OEE (`ProductionReport.jsx → aggregateRecords`)

One row per SAP code, aggregated across the queried date range. **All quantities are in component units** (see §2.3) — not raw machine/sheet counts.

```
avgCycleSecs = mean(duration) over that part's Production records
sheetCT      = avgCycleSecs ÷ NoOfSheet                    (punching only)
compCT       = (sheetCT + PncLoadingUnloading) ÷ ActualComponentsPerSheet
compQty      = NoOfSheet × ActualComponentsPerSheet × actualQty (sheet count)

planQty = sum of ProductionPlans.TargetQty for this SapCode
          across the queried date span, if any plan exists;
          else  ceil(compQty × 1.05)              // +5% estimate fallback

availableTimeSecs = planQty × DefinedComponentCycleTime
actualTimeSecs    = compQty × compCT

A% = min(1, actualTimeSecs / availableTimeSecs)
P% = min(1, compQty / planQty)
Q% = min(1, accepted / compQty)        // accepted = compQty − rejects (quality-log rejects take priority over the GOOD/BAD flag ratio)

OEE% = A × P × Q
```
**Example:** SAP `1130596`, `DefinedComponentCycleTime=10s`, Planning Config target for the day = `144`. Shift produced `compQty=144` at `compCT=9.5s`, quality log shows 5 rejected:
- `availableTimeSecs = 144×10 = 1440s`
- `actualTimeSecs = 144×9.5 = 1368s`
- `A = min(1, 1368/1440) = 95%`
- `P = min(1, 144/144) = 100%`
- `Q = min(1, 139/144) = 96.5%`
- `OEE = 0.95 × 1.00 × 0.965 = 91.7%`

**Loss (min)** = `downtimeMins + idleMins + changeoverOverrunMins`.
**Energy (Wh)** = `qty × cycleSecs × 5kW ÷ 3600` (fixed `MACHINE_POWER_KW = 5` assumption), computed separately for ideal (`planQty × DefinedCT`) and actual (`actualQty × avgCycleSecs`).

---

## 5. Quality Report (`QualityReport.jsx`)

Two parallel pass-rate calculations, the quality-log one taking priority when it has data:

```
// Machine-flag based (always available, less precise — relies on PartsQuality sensor flag)
passRate = goodQty / totalSheetQty × 100        // goodQty = Σ qty where PartsQuality="GOOD"

// Quality-log based (precise — operator-confirmed inspected/rejected counts)
accepted  = totalComponentQty − Σ RejectedQty (from PartProcessQualityLog, grouped by part)
passRate  = accepted / totalComponentQty × 100
```
**Example:** Model produced 144 components, quality log shows `InspectedQty=50` (a sample batch), `RejectedQty=5`:
- `accepted = 144 − 5 = 139`
- `passRate = 139/144 × 100 = 96.5%`

---

## 6. Downtime Report (`DowntimeReport.jsx`)

Built from §2.1 (Downtime/Idle split) and §2.2 (changeovers) directly, plus two more rollups:

```
Loss Breakdown (donut)   = [briefDowntimeMins, idleMins, changeoverOverrunMins]
Loss by Reason (bar)     = Σ duration grouped by PartProcessDowntimeLog.ReasonName (top 8)
Loss by Department (bar) = Σ duration grouped by PartProcessDowntimeLog.Category
```
A logged downtime entry's `ReasonName`/`Category` is matched back to its machine event by `EventId` when available, else falls back to "Unassigned."

---

## 7. Hourly Report (`HourlyReport.jsx`)

Buckets every Production/Downtime record by **the hour-of-day its `StartTime` falls in**, compounded with its resolved shift (so a 19:55 cycle and a 20:05 cycle — straddling a shift change — land in different buckets even though they're the same clock hour):

```
key = `${shiftName}__${hour}`
bucket.qty          += PartsQty                       (Production rows)
bucket.componentQty  += componentQty (§2.3)
bucket.downtimeCount += 1; bucket.downtimeSecs += duration   (Downtime rows)
```
**Example:** Records at 08:12, 08:47, 09:03 in Shift 1 → two buckets: `Shift 1__8` (sums the 08:12 + 08:47 qty) and `Shift 1__9` (the 09:03 qty alone).

"Part Total Count" sums each part's qty across the **whole** queried range (not per-hour), then nets off `RejectedQty` from the quality log the same way as §5.

---

## 8. Planning Config target vs. actual (Dashboard "Model Breakdown")

```
plannedQty(model, date) = Σ ProductionPlans.TargetQty
                           where SapCode matches the model's material
                             AND PlanDate = date
                             AND Status ≠ false/0
```
The Dashboard's Model Breakdown table shows the **union** of "produced today" and "planned for today" — a freshly uploaded plan shows its Target immediately with `Produced = 0`, it doesn't wait for production to start. Matching key is the part's resolved SAP code (§2.4), not the raw model string, so a plan uploaded against SAP code `1140239` shows up against whichever machine produces a part that resolves to that same code.

**Example:** Planning Config has `SapCode=1140239, TargetQty=200, PlanDate=2026-04-22`. Dashboard viewed on 2026-04-22 shows a "PC/EMB INNER BTM…" row with `Target=200` even if `Produced=0` because that machine hasn't run yet that day.

---

## 9. Emailed PDF reports (`Backend/services/reportData.service.js`)

The shift-end email cron and "Send Test Mail" attach PDFs built from the **same formulas as §4–§7**, computed server-side for one specific shift+date occurrence (not a free date range) — so the numbers match what you'd see on the report pages for that exact shift:

- **Production Report PDF** → §4's `aggregateRecords` (backend port), via `buildShiftReport`.
- **Quality Report PDF** → §5's model-wise accepted/rejected, plus a donut + bar chart rendered headlessly (no browser) with `chart.js` + `@napi-rs/canvas`.
- **Downtime Report PDF** → §6's downtime events, changeovers, and the three loss-breakdown charts.
- **Hourly Report PDF** → §7's hour buckets, model breakdown, and part totals.

One difference from the live report pages: the backend's `aggregateRecords` (Production Report PDF) still uses Plan Qty's older fallback (`actualQty × 1.05`, not the component-qty-aware version) and a slightly older `sheetCT`/Performance formula — it predates the most recent frontend fixes (component-unit Plan Qty, corrected Sheet CT divide-down). Numbers will be close but not byte-for-byte identical to the live Production Report page until that backend copy is updated to match.

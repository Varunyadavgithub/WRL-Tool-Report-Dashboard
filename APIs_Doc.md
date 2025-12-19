# 📘 API Documentation

## 🧱 Architecture Overview

- **Frontend**: React.js
- **Backend**: Node.js + Express.js
- **Database**: Microsoft SQL Server (MSSQL)
- **DB Management Tool**: SQL Server Management Studio (SSMS 21)
- **Authentication**: JWT / Session-based Authentication
- **File Handling**: Multer (Excel, PDF, Image uploads)
- **Reporting**: Excel & PDF exports


---

# 🔐 Auth Module

### POST `/login`

**Description**: Authenticates a user and starts a session.

**Request Body**

```json
{
  "empcod": "string",
  "password": "string"
}
```

**Response**

```json
{
  "success": true,
  "message": "Login successful"
}
```

---

### POST `/logout`

**Description**: Logs out the currently authenticated user.

**Response**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

# Common Module

## Common Routes

### GET `/model-variants`

**Description**: Fetche all models names.

### GET `/stage-names`

**Description**: Fetche all stage names.

### GET `/departments`

**Description**: Fetche all departments.

---

# 🚚 Dispatch Module

## Performance Reports

### GET `/vehicle-uph`

**Description**: Returns vehicle UPH (Units Per Hour) data.

### GET `/vehicle-summary`

**Description**: Fetches dispatch vehicle summary report.

### GET `/model-count`

**Description**: Returns model-wise dispatch count.

### GET `/model-summary`

**Description**: Provides detailed model-level dispatch summary.

### GET `/category-model-count`

**Description**: Returns category-wise model counts.

### GET `/category-summary`

**Description**: Fetches dispatch category summary.

---

## Dispatch Reports

### GET `/fg-unloading`

**Description**: FG unloading report.

### GET `/fg-dispatch`

**Description**: FG dispatch report.

### GET `/quick-fg-unloading`

**Description**: Quick filters for FG unloading.

### GET `/quick-fg-dispatch`

**Description**: Quick filters for FG dispatch.

---

## FG Casting

### GET `/fg-casting`

**Description**: Fetch FG casting data by session.

---

## Gate Entry

### POST `/material-gate-entry`

**Description**: Sends material gate entry email notification.

---

## Error Logs

### GET `/error-log`

**Description**: Returns dispatch-related error logs.

---

# 🗓️ Planning Module

## Production Planning

### GET `/plan-month-year`

**Description**: Fetch available planning months and years.

### GET `/production-planing`

**Description**: Returns production planning data.

### PUT `/update-production-plan`

**Description**: Updates existing production plan.

### POST `/add-production-plan`

**Description**: Adds new production planning entry.

### GET `/model-name`

**Description**: Fetches available model names.

---

## 5-Day Planning (Excel Upload)

### POST `/upload-excel`

**Description**: Uploads 5-day planning Excel file.

**Form Data**

* `file`: Excel file

---

### GET `/files`

**Description**: Lists uploaded planning Excel files.

### GET `/download/:filename`

**Description**: Downloads a planning Excel file.

### DELETE `/delete/:filename`

**Description**: Deletes a planning Excel file.

---

## Daily Plan

### POST `/upload-daily-plan`

**Description**: Uploads daily production plan.

### GET `/daily-plans`

**Description**: Fetches daily production plans.

---

# 🏭 Production Module

## Component & Traceability

### GET `/component-details`

**Description**: Fetch component master details.

### GET `/component-traceability`

**Description**: Generates component traceability report.

### GET `/export-component-traceability`

**Description**: Exports traceability report.

---

## Hourly Reports

### GET `/hourly-summary`

### GET `/hourly-model-count`

### GET `/hourly-category-count`

**Description**: Hourly production performance reports.

---

## HP Reports (Final / Post / Foaming)

**Description**: Line-wise hourly production data.

Examples:

* `/final-hp-frz`
* `/post-hp-frz`
* `/Foaming-hp-fom-a`

---

## NFC Reports

### GET `/nfc-details`

### GET `/export-nfc-report`

### GET `/yday-nfc-report`

### GET `/today-nfc-report`

### GET `/month-nfc-report`

---

## Production Reports

### GET `/fgdata`

### GET `/export-production-report`

### GET `/yday-fgdata`

### GET `/today-fgdata`

### GET `/month-fgdata`

---

## Stage History

### GET `/stage-history`

### GET `/logistic-status`

---

## Total Production

### GET `/barcode-details`

### GET `/export-total-production`

### GET `/yday-total-production`

### GET `/today-total-production`

### GET `/month-total-production`

---

# 🧪 Quality Module

## CPT

### GET `/cpt-report`

---

## FPA

### GET `/fpa-count`

### GET `/asset-details`

### GET `/fpqi-details`

### GET `/fpa-defect`

### GET `/fpa-defect-category`

### POST `/add-fpa-defect`

**Form Data**

* `image`: defect image

### GET `/download-fpa-defect-image/:fgSrNo`

---

## Rework

### GET `/rework-entry/details`

### POST `/rework-in`

### POST `/rework-out`

### GET `/rework-report`

---

## LPT

### GET `/lpt-report`

### GET `/lpt-defect-report`

### GET `/lpt-defect-count`

### POST `/lpt-recipe`

### PUT `/lpt-recipe/:modelName`

### DELETE `/lpt-recipe/:modelName`

---

## BIS

### POST `/upload-bis-pdf`

### GET `/bis-files`

### GET `/download-bis-file/:srNo`

### DELETE `/delete-bis-file/:srNo`

### PUT `/update-bis-file/:srNo`

### GET `/bis-status`

---

# 👥 Visitor Management Module

## Departments

### GET `/departments`

### POST `/departments`

### PUT `/departments/:deptCode`

### DELETE `/departments/:deptCode`

---

## Users

### GET `/users`

### POST `/users`

### PUT `/users/:id`

### DELETE `/users/:id`

---

## Visitor Pass

### POST `/generate-pass`

### GET `/pass-details/:passId`

### GET `/fetch-previous-pass`

---

## Visitor In/Out

### POST `/in`

### POST `/out`

### GET `/logs`

### GET `/reprint/:passId`

---

## Visitor Reports & Dashboard

### GET `/dashboard-stats`

### GET `/history`

### GET `/details/:visitorId`
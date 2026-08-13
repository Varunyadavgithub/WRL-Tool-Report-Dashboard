# Western Refrigeration — Traceability API

**Base URL**: `http://<server-ip>:8000`
*(e.g. `http://192.168.1.50:8000` — get the exact IP from the QIS server admin)*

All timestamps are **UTC ISO-8601**. All endpoints are **read-only** GET/POST — no authentication required on the traceability routes.

---

## Quick Connectivity Test

Paste this in a browser or curl it to confirm the server is reachable:

```
GET http://<server-ip>:8000/api/health
→ {"status": "ok"}
```

---

## 1. Get Report by FG Serial

```
GET /api/traceability/report/by-fg/{fg_serial}
```

Returns the **most recent** inspection report for a unit. If the unit was re-inspected, only the latest record is returned. Use endpoint 3 for full history.

### Example
```
GET http://192.168.1.50:8000/api/traceability/report/by-fg/WR45000123
```

### Response
```json
{
  "id": 123,
  "fg_serial": "WR45000123",
  "scanned_serial": "QR-20260601-001",
  "master": "WR-450-3D",
  "operator": "rahul",
  "date": "2026-06-01T08:30:00Z",
  "status": "PASS",
  "deviation": false,
  "parts_total": 12,
  "parts_pass": 12,
  "parts_fail": 0,
  "pdf_url": "/api/reports/123/pdf",
  "deviation_note": null,
  "deviation_by": null,
  "parts": [ ... ]
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `id` | number | Internal report ID |
| `fg_serial` | string | FG serial number |
| `scanned_serial` | string | QR code scanned at inspection start |
| `master` | string | Master file / model used for this inspection |
| `operator` | string | Operator who ran the inspection |
| `date` | datetime | When the report was saved (UTC) |
| `status` | string | Overall verdict — see **Status Values** below |
| `deviation` | bool | `true` if the unit passed under a special deviation approval (a `MANUAL_PASS` sub-case — see below) |
| `parts_total` | number | Total number of parts checked |
| `parts_pass` | number | Parts that passed AI detection (`ml_status: "success"`) |
| `parts_fail` | number | Parts that didn't pass (anything other than `success`/`skipped`) |
| `pdf_url` | string | Path to download the PDF — prepend the base URL |
| `deviation_note` | string\|null | Reason written for the deviation (detail only) |
| `deviation_by` | string\|null | Who authorized the deviation (detail only) |
| `parts` | array | Full per-part results — see **Part Object** below |

### Status Values

The verdict engine is shared across the whole app (Reports page, traceability API, PDFs) — these six are the only values `status` can take:

| Value | Meaning |
|---|---|
| `PASS` | All required parts detected by AI |
| `FAIL` | One or more parts not detected (and not deviation-released) |
| `MANUAL_PASS` | A human, not vision, passed the unit — either a single-comment deviation release during the live test (`deviation: true`) or the untracked/no-master manual flow (`deviation: false`) |
| `OVERRIDDEN` | The AI result was edited/skipped after the report was generated |
| `REWORK` | Unit was diverted to rework (tracked or untracked) |
| `UNDER_REVIEW` | Flagged for rework but awaiting admin/supervisor confirmation — resolves to `REWORK` or falls back to the parts-driven verdict |

**404** is returned if no report exists for that FG serial.

---

## 2. Download PDF by FG Serial

```
GET /api/traceability/report/by-fg/{fg_serial}/pdf
```

Returns the inspection PDF directly as a file download. The PDF is pre-generated at inspection time, so the response is instant.

### Example
```
GET http://192.168.1.50:8000/api/traceability/report/by-fg/WR45000123/pdf
```

The response is `Content-Type: application/pdf` with `Content-Disposition: inline`. Save or display it as needed.

---

## 3. All Reports for an FG Serial

```
GET /api/traceability/reports/by-fg/{fg_serial}/all
```

Returns **every** inspection record for a unit, newest first. Useful when a unit was re-inspected after a failure.

### Response
```json
{
  "fg_serial": "WR45000123",
  "total": 2,
  "reports": [
    {
      "id": 130,
      "fg_serial": "WR45000123",
      "scanned_serial": "QR-20260602-005",
      "master": "WR-450-3D",
      "operator": "rahul",
      "date": "2026-06-02T09:15:00Z",
      "status": "PASS",
      "deviation": false,
      "parts_total": 12,
      "parts_pass": 12,
      "parts_fail": 0,
      "pdf_url": "/api/reports/130/pdf"
    },
    {
      "id": 118,
      "fg_serial": "WR45000123",
      "scanned_serial": "QR-20260601-001",
      "master": "WR-450-3D",
      "operator": "suresh",
      "date": "2026-06-01T08:30:00Z",
      "status": "FAIL",
      "deviation": false,
      "parts_total": 12,
      "parts_pass": 10,
      "parts_fail": 2,
      "pdf_url": "/api/reports/118/pdf"
    }
  ]
}
```

Each item in `reports` is a summary row — no `parts` array, no `deviation_note`/`deviation_by`. Call endpoint 1 with the specific FG serial for the full record.

---

## 4. Batch Export — JSON

```
POST /api/traceability/reports/export
Content-Type: application/json
```

Pull a list of reports for a time window. Supports daily, weekly, monthly, or custom ranges with optional status filter.

### Request Body

```json
{
  "period": "daily",
  "date": "2026-06-01",
  "status": null,
  "page": 1,
  "page_size": 200
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `period` | string | Yes | `daily`, `weekly`, `monthly`, or `custom` |
| `date` | string | No | Anchor date for daily/weekly/monthly. Format: `YYYY-MM-DD`. Omit for today. |
| `from_date` | string | If `custom` | Start of range (inclusive). Format: `YYYY-MM-DD` |
| `to_date` | string | If `custom` | End of range (inclusive). Format: `YYYY-MM-DD` |
| `status` | string | No | Filter by verdict. Omit to return all. Values: `PASS`, `FAIL`, `MANUAL_PASS`, `OVERRIDDEN`, `REWORK`, `UNDER_REVIEW` |
| `page` | number | No | Page number, starting at **1**. Default: `1` |
| `page_size` | number | No | Records per page. Default: `200`. Maximum: `1000` |

### What page and page_size mean

The server may have hundreds or thousands of reports in a given period. Rather than sending everything at once, results are split into pages.

- `page_size: 200` → each response contains at most 200 records
- `page: 1` → first 200 records, `page: 2` → next 200, and so on
- Keep incrementing `page` and calling the endpoint until `has_next` is `false`
- `total` reflects the count **after** the `status` filter is applied (across all pages of that filtered result, not just the current page)

### Period Examples

| Goal | Request Body |
|---|---|
| Today's reports | `{"period": "daily"}` |
| Specific date | `{"period": "daily", "date": "2026-06-01"}` |
| Week of June 1 (Mon–Sun) | `{"period": "weekly", "date": "2026-06-01"}` |
| June 2026 | `{"period": "monthly", "date": "2026-06-01"}` |
| May 1–31 custom range | `{"period": "custom", "from_date": "2026-05-01", "to_date": "2026-05-31"}` |
| Today, failures only | `{"period": "daily", "status": "FAIL"}` |
| Second page of results | `{"period": "monthly", "date": "2026-06-01", "page": 2, "page_size": 200}` |

### Response

```json
{
  "period": "daily",
  "from": "2026-06-01T00:00:00Z",
  "to": "2026-06-02T00:00:00Z",
  "total": 42,
  "pass": 35,
  "fail": 3,
  "manual_pass": 2,
  "overridden": 1,
  "rework": 1,
  "under_review": 0,
  "page": 1,
  "page_size": 200,
  "has_next": false,
  "reports": [
    {
      "id": 201,
      "fg_serial": "WR45000201",
      "scanned_serial": "QR-20260601-201",
      "master": "WR-450-3D",
      "operator": "rahul",
      "date": "2026-06-01T14:22:00Z",
      "status": "PASS",
      "deviation": false,
      "parts_total": 12,
      "parts_pass": 12,
      "parts_fail": 0,
      "pdf_url": "/api/reports/201/pdf"
    }
  ]
}
```

### Response Fields

| Field | Description |
|---|---|
| `from` / `to` | The exact UTC window used for the query |
| `total` | Records matching the `status` filter (across **all** pages) — same count as `pass`+`fail`+`manual_pass`+`overridden`+`rework`+`under_review` only when no `status` filter is set |
| `pass` / `fail` / `manual_pass` / `overridden` / `rework` / `under_review` | Counts for the **entire window**, regardless of the `status` filter — use these for a dashboard breakdown even when you only paged through one status |
| `page` / `page_size` | Current page info |
| `has_next` | `true` if there are more pages — call again with `page + 1` |
| `reports` | Array of summary rows for this page |

---

## 5. Batch Export — ZIP of PDFs

```
POST /api/traceability/reports/export/zip
Content-Type: application/json
```

Same request body as endpoint 4 (including the `status` filter values above). Returns a `.zip` file download containing one PDF per report.

### ZIP Contents

```
WR45000201.pdf
WR45000202.pdf
WR45000203.pdf
manifest.json
```

PDFs are named by FG serial. `manifest.json` at the archive root is a flat list:

```json
[
  {
    "file": "WR45000201.pdf",
    "fg_serial": "WR45000201",
    "status": "PASS",
    "date": "2026-06-01T14:22:00Z"
  },
  {
    "file": "WR45000202.pdf",
    "fg_serial": "WR45000202",
    "status": "FAIL",
    "date": "2026-06-01T15:10:00Z"
  }
]
```

Parse `manifest.json` first to validate completeness without opening every PDF.

---

## Part Object

Each element inside the `parts` array (endpoint 1 only):

```json
{
  "part_name": "Dew Collector",
  "job_type": "presence",
  "ml_status": "success",
  "ml_message": "Detected in capture",
  "captured_image": "/captures/WR45000123/img.jpg",
  "annotated_url": "/captures/WR45000123/img__annotated.jpg",
  "captured_images": ["/captures/WR45000123/img.jpg"],
  "annotated_urls": ["/captures/WR45000123/img__annotated.jpg"],
  "reference_image": "/uploads/base_images/dew_collector.png",
  "is_overridden": false,
  "overridden_by": null,
  "overridden_at": null,
  "skipped_by": null,
  "skip_remark": null
}
```

| Field | Description |
|---|---|
| `part_name` | Name of the part |
| `job_type` | `presence` — the only job type currently supported (part must be visible in the capture) |
| `ml_status` | `success` (detected), `skipped` (manually bypassed), or anything else (treated as not-passed, e.g. `fail`) |
| `ml_message` | Human-readable result message |
| `captured_image` | URL of the primary raw capture. Prepend base URL to fetch the image. |
| `annotated_url` | URL of the primary AI-annotated image with detection bounding boxes |
| `captured_images` | URLs of **every** capture for this part (multi-image parts like "Side"/"Hinge"); `captured_image` is always the first entry |
| `annotated_urls` | Annotated counterpart to `captured_images`, same index order |
| `reference_image` | URL of the reference/example image for this part (what it's supposed to look like) |
| `is_overridden` | `true` if an admin manually changed the AI verdict after the report was generated |
| `overridden_by` | Username of the person who overrode (if applicable) |
| `overridden_at` | ISO timestamp of the override |
| `skipped_by` | Username of the person who manually skipped this part, if `ml_status` is `skipped` |
| `skip_remark` | Reason written when a part was manually skipped |

---

## Network Setup Notes

- **Server address**: Ask the QIS admin for the server machine's local IP (`ipconfig` on the server PC, look for IPv4 address)
- **Port**: `8000` (TCP inbound is open in Windows Firewall)
- **Protocol**: HTTP (no TLS on the local network)
- **Auth**: None required for traceability endpoints
- **Rate limiting**: None — but avoid hammering the batch export endpoint in tight loops; add at least a 1-second delay between paginated calls

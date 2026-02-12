# 📡 WRL Tool Report Dashboard — API Documentation

## Base URL

```

http://localhost:3000/api/v1

```

## Common Headers

| Header         | Value              | Required       | Description           |
| -------------- | ------------------ | -------------- | --------------------- |
| `Content-Type` | `application/json` | ✅ (POST/PUT)  | Request body format   |
| `Cookie`       | `token=<JWT>`      | ✅ (Protected) | Authentication cookie |

## Authentication Mechanism

- Authentication is handled via **HTTP-only cookies**
- On successful login, the server sets a `token` cookie containing a JWT
- All protected endpoints require this cookie to be sent automatically by the browser
- Token expires in **24 hours**

## Standard Response Format

### Success Response

```json
{
  "success": true,
  "message": "Descriptive success message",
  "data": {}
}
```

### Error Response

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

---

---

# 🔐 Authentication Module

**Base Path:** `/api/v1/auth`

Authentication endpoints for user login and logout. Uses JWT tokens stored in HTTP-only cookies.

---

## 1. Login

Authenticates a user by verifying their employee code and password against the database. On success, issues a JWT token as an HTTP-only cookie and returns user profile information.

- **URL:** `/api/v1/auth/login`
- **Method:** `POST`
- **Auth Required:** ❌ No

### Request Body

| Field      | Type     | Required | Description             |
| ---------- | -------- | -------- | ----------------------- |
| `empcod`   | `string` | ✅       | Employee code (User ID) |
| `password` | `string` | ✅       | User password           |

### Request Example

```json
{
  "empcod": "EMP001",
  "password": "securePassword123"
}
```

### Success Response

- **Status Code:** `200 OK`
- **Cookie Set:** `token` (HTTP-only, Secure in production, SameSite=Strict, Max-Age=24h)

```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "EMP001",
    "name": "John Doe",
    "usercode": "UC101",
    "role": "admin"
  }
}
```

### Error Responses

| Status Code | Condition                               | Response Body                                                                 |
| ----------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| `400`       | Missing employee code or password       | `{ "success": false, "message": "Employee code and password are required." }` |
| `401`       | Invalid credentials (wrong ID/password) | `{ "success": false, "message": "Invalid credentials" }`                      |
| `500`       | Database connection or query failure    | `{ "success": false, "message": "Internal server error" }`                    |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "empcod": "EMP001",
    "password": "securePassword123"
  }' \
  -c cookies.txt
```

### Notes

- The JWT token payload contains: `id`, `name`, `usercode`, `role`
- Token expiration: **1 day** (24 hours)
- Cookie settings:
  - `httpOnly: true` — Not accessible via JavaScript
  - `secure: true` — Only in production (HTTPS)
  - `sameSite: strict` — CSRF protection
  - `maxAge: 86400000` — 24 hours in milliseconds
- The `role` field in the response is converted to **lowercase** from the `RoleName` in the database

### Database Tables Used

| Table       | Purpose                                |
| ----------- | -------------------------------------- |
| `Users`     | Stores user credentials and role codes |
| `UserRoles` | Maps role codes to role names          |

### SQL Query Reference

```sql
SELECT
  U.UserCode,
  U.UserName,
  U.UserID,
  U.Password,
  U.UserRole,
  R.RoleName
FROM Users U
JOIN UserRoles R ON U.UserRole = R.RoleCode
WHERE U.UserID = @empcod AND U.Password = @password
```

---

## 2. Logout

Logs out the current user by clearing the JWT authentication cookie.

- **URL:** `/api/v1/auth/logout`
- **Method:** `POST`
- **Auth Required:** ❌ No (clears cookie regardless)

### Request Body

_None required._

### Success Response

- **Status Code:** `200 OK`
- **Cookie Cleared:** `token`

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Error Responses

| Status Code | Condition    | Response Body                                              |
| ----------- | ------------ | ---------------------------------------------------------- |
| `500`       | Server error | `{ "success": false, "message": "Internal server error" }` |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

### Notes

- This endpoint clears the `token` cookie with the same settings it was set with
- No request body or authentication is required
- After logout, the user must log in again to access protected endpoints

---

---

# 🔗 Common Module

**Base Path:** `/api/v1/shared`

Shared utility endpoints that provide lookup data (dropdowns, master data) used across multiple modules in the application. These endpoints serve as data sources for form dropdowns, filters, and reference lookups.

---

## 1. Get Model Variants

Fetches a list of all active model variants from the Material master table. Used to populate model selection dropdowns throughout the application.

- **URL:** `/api/v1/shared/model-variants`
- **Method:** `GET`
- **Auth Required:** ✅ Yes

### Query Parameters

_None._

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Model variants fetched successfully",
  "data": [
    {
      "MaterialName": "SUS 215L DC",
      "MatCode": "MAT001"
    },
    {
      "MaterialName": "FRZ 300L FC",
      "MatCode": "MAT002"
    },
    {
      "MaterialName": "CHC 190L SC",
      "MatCode": "MAT003"
    }
  ]
}
```

### Response Fields

| Field          | Type     | Description                        |
| -------------- | -------- | ---------------------------------- |
| `MaterialName` | `string` | Display name of the material/model |
| `MatCode`      | `string` | Unique material code identifier    |

### Error Responses

| Status Code | Condition              | Response Body                                                       |
| ----------- | ---------------------- | ------------------------------------------------------------------- |
| `401`       | Missing/invalid token  | `{ "success": false, "message": "Unauthorized" }`                   |
| `500`       | Database query failure | `{ "success": false, "message": "Failed to fetch model variants" }` |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/shared/model-variants \
  -b cookies.txt
```

### Database Details

- **Database:** dbConfig1 (MSSQL)
- **Table:** `Material`
- **Filter Conditions:**
  - `Category <> 0` — Excludes uncategorized materials
  - `model <> 0` — Excludes non-model entries
  - `type = 100` — Specific material type
  - `Status = 1` — Only active materials

### SQL Query Reference

```sql
SELECT Name AS MaterialName, MatCode
FROM Material
WHERE Category <> 0 AND model <> 0 AND type = 100 AND Status = 1;
```

---

## 2. Get Model Variants by Assembly Serial

Fetches model variant names associated with a specific assembly barcode serial number. Used for component-level model identification.

- **URL:** `/api/v1/shared/model-variants/:serial`
- **Method:** `GET`
- **Auth Required:** ✅ Yes

### URL Parameters

| Param    | Type     | Required | Description                    |
| -------- | -------- | -------- | ------------------------------ |
| `serial` | `string` | ✅       | Assembly barcode serial number |

### Success Response (Data Found)

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "According to the Assembly Barcode model variants fetched successfully",
  "data": [
    {
      "Name": "SUS 215L DC"
    },
    {
      "Name": "SUS 215L FC"
    }
  ]
}
```

### Success Response (No Data)

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "No model variants found for this assembly",
  "data": []
}
```

### Response Fields

| Field  | Type     | Description                 |
| ------ | -------- | --------------------------- |
| `Name` | `string` | Material/model variant name |

### Error Responses

| Status Code | Condition                | Response Body                                                    |
| ----------- | ------------------------ | ---------------------------------------------------------------- |
| `400`       | Missing serial parameter | `{ "success": false, "message": "Assembly serial is required" }` |
| `401`       | Missing/invalid token    | `{ "success": false, "message": "Unauthorized" }`                |
| `500`       | Database query failure   | `{ "success": false, "message": "Internal server error" }`       |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/shared/model-variants/S41706260200050 \
  -b cookies.txt
```

### Database Details

- **Database:** dbConfig1 (MSSQL)
- **Tables:** `MaterialBarcode` (joined with `Material`)
- **Join:** `Material.MatCode = MaterialBarcode.Material`
- **Returns:** `DISTINCT` material names to avoid duplicates

### SQL Query Reference

```sql
SELECT DISTINCT m.Name
FROM MaterialBarcode AS mb
INNER JOIN Material AS m ON m.MatCode = mb.Material
WHERE mb.Serial = @serial
```

---

## 3. Get Component Types

Fetches a list of all component types from the MaterialCategory master table. Used for component type selection dropdowns in production and quality modules.

- **URL:** `/api/v1/shared/Comp-type`
- **Method:** `GET`
- **Auth Required:** ✅ Yes

### Query Parameters

_None._

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Component types fetched successfully",
  "data": [
    {
      "CategoryCode": "CAT001",
      "Name": "Compressor"
    },
    {
      "CategoryCode": "CAT002",
      "Name": "Thermostat"
    },
    {
      "CategoryCode": "CAT003",
      "Name": "Fan Motor"
    }
  ]
}
```

### Response Fields

| Field          | Type     | Description                            |
| -------------- | -------- | -------------------------------------- |
| `CategoryCode` | `string` | Unique code for the component category |
| `Name`         | `string` | Display name of the component type     |

### Error Responses

| Status Code | Condition              | Response Body                                                        |
| ----------- | ---------------------- | -------------------------------------------------------------------- |
| `401`       | Missing/invalid token  | `{ "success": false, "message": "Unauthorized" }`                    |
| `500`       | Database query failure | `{ "success": false, "message": "Failed to fetch component types" }` |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/shared/Comp-type \
  -b cookies.txt
```

### Database Details

- **Database:** dbConfig1 (MSSQL)
- **Table:** `MaterialCategory`
- **Filter:** `CategoryType = 200` — Filters for component-type categories only

### SQL Query Reference

```sql
SELECT CategoryCode, Name
FROM MaterialCategory
WHERE CategoryType = 200;
```

---

## 4. Get Stage Names

Fetches a list of all work stages/stations from the WorkCenter master table. Used for stage selection in production tracking, traceability reports, and stage history.

- **URL:** `/api/v1/shared/stage-names`
- **Method:** `GET`
- **Auth Required:** ✅ Yes

### Query Parameters

_None._

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Stage names fetched successfully",
  "data": [
    {
      "Name": "Foaming",
      "StationCode": "STN001"
    },
    {
      "Name": "Post Foaming",
      "StationCode": "STN002"
    },
    {
      "Name": "Final Line",
      "StationCode": "STN003"
    },
    {
      "Name": "Gas Charging",
      "StationCode": "STN004"
    },
    {
      "Name": "Final Loading",
      "StationCode": "STN005"
    }
  ]
}
```

### Response Fields

| Field         | Type     | Description                      |
| ------------- | -------- | -------------------------------- |
| `Name`        | `string` | Display name of the work stage   |
| `StationCode` | `string` | Unique code for the work station |

### Error Responses

| Status Code | Condition              | Response Body                                                    |
| ----------- | ---------------------- | ---------------------------------------------------------------- |
| `401`       | Missing/invalid token  | `{ "success": false, "message": "Unauthorized" }`                |
| `500`       | Database query failure | `{ "success": false, "message": "Failed to fetch stage names" }` |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/shared/stage-names \
  -b cookies.txt
```

### Database Details

- **Database:** dbConfig1 (MSSQL)
- **Table:** `WorkCenter`
- **Filter:** None — Returns all work centers

### SQL Query Reference

```sql
SELECT Name, StationCode
FROM WorkCenter;
```

---

## 5. Get Departments

Fetches a list of all departments from the Department master table. Used for department selection dropdowns in compliance, audit, and visitor management modules.

- **URL:** `/api/v1/shared/departments`
- **Method:** `GET`
- **Auth Required:** ✅ Yes

### Query Parameters

_None._

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Departments fetched successfully",
  "data": [
    {
      "DeptCode": "DPT001",
      "Name": "Production"
    },
    {
      "DeptCode": "DPT002",
      "Name": "Quality"
    },
    {
      "DeptCode": "DPT003",
      "Name": "Dispatch"
    },
    {
      "DeptCode": "DPT004",
      "Name": "Maintenance"
    },
    {
      "DeptCode": "DPT005",
      "Name": "Planning"
    }
  ]
}
```

### Response Fields

| Field      | Type     | Description                    |
| ---------- | -------- | ------------------------------ |
| `DeptCode` | `string` | Unique department code         |
| `Name`     | `string` | Display name of the department |

### Error Responses

| Status Code | Condition              | Response Body                                                    |
| ----------- | ---------------------- | ---------------------------------------------------------------- |
| `401`       | Missing/invalid token  | `{ "success": false, "message": "Unauthorized" }`                |
| `500`       | Database query failure | `{ "success": false, "message": "Failed to fetch departments" }` |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/shared/departments \
  -b cookies.txt
```

### Database Details

- **Database:** dbConfig1 (MSSQL)
- **Table:** `Department`
- **Filter:** None — Returns all departments

### SQL Query Reference

```sql
SELECT DeptCode, Name
FROM Department;
```

---

## 6. Get Employees with Departments

Fetches a list of all employees along with their associated department information. Used for assignee selection in task reminders, audit reports, and calibration management.

- **URL:** `/api/v1/shared/employees-with-departments`
- **Method:** `GET`
- **Auth Required:** ✅ Yes

### Query Parameters

_None._

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Employees with departments fetched successfully",
  "data": [
    {
      "name": "John Doe",
      "employee_id": "EMP001",
      "department_name": "Production",
      "deptCode": "DPT001"
    },
    {
      "name": "Jane Smith",
      "employee_id": "EMP002",
      "department_name": "Quality",
      "deptCode": "DPT002"
    },
    {
      "name": "Mike Johnson",
      "employee_id": "EMP003",
      "department_name": "Dispatch",
      "deptCode": "DPT003"
    }
  ]
}
```

### Response Fields

| Field             | Type     | Description                       |
| ----------------- | -------- | --------------------------------- |
| `name`            | `string` | Employee full name                |
| `employee_id`     | `string` | Unique employee identifier        |
| `department_name` | `string` | Name of the employee's department |
| `deptCode`        | `string` | Department code                   |

### Error Responses

| Status Code | Condition              | Response Body                                                                   |
| ----------- | ---------------------- | ------------------------------------------------------------------------------- |
| `401`       | Missing/invalid token  | `{ "success": false, "message": "Unauthorized" }`                               |
| `500`       | Database query failure | `{ "success": false, "message": "Failed to fetch employees with departments" }` |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/shared/employees-with-departments \
  -b cookies.txt
```

### Database Details

- **Database:** dbConfig3 (MSSQL — separate database)
- **Tables:** `users` (joined with `departments`)
- **Join:** `users.department_id = departments.deptCode`

> ⚠️ **Note:** This endpoint uses **dbConfig3** (a different database connection) unlike other common endpoints that use dbConfig1.

### SQL Query Reference

```sql
SELECT
  u.name,
  u.employee_id,
  dpt.department_name,
  dpt.deptCode
FROM users AS u
INNER JOIN departments AS dpt
  ON u.department_id = dpt.deptCode;
```

# 📑 Audit Report Module

**Base Path:** `/api/v1/audit-report`

The Audit Report module provides a complete audit management system with dynamic templates, audit entries, approval workflows, and reporting. It consists of two sub-modules: **Templates** (defining audit structures) and **Audits** (actual audit entries and lifecycle management).

---

## 📋 Audit Lifecycle / Status Flow

```

┌─────────┐ ┌───────────┐ ┌──────────┐
│ DRAFT │─────►│ SUBMITTED │─────►│ APPROVED │
│ │ │ │──┐ │ │
└─────────┘ └───────────┘ │ └──────────┘
▲ │
│ ▼
│ ┌──────────┐
└───────────────────│ REJECTED │
(edit & resubmit) └──────────┘

```

| Status      | Description                                    | Can Edit | Can Delete | Can Submit | Can Approve/Reject |
| ----------- | ---------------------------------------------- | -------- | ---------- | ---------- | ------------------ |
| `draft`     | Initial state, audit is being filled out       | ✅       | ✅         | ✅         | ❌                 |
| `submitted` | Sent for approval review                       | ❌       | ❌         | ❌         | ✅                 |
| `approved`  | Approved by reviewer — locked                  | ❌       | ❌         | ❌         | ❌                 |
| `rejected`  | Rejected with comments — returns to draft-like | ❌       | ❌         | ❌         | ❌                 |

---

## 📂 Database Tables

| Table            | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `AuditTemplates` | Stores template metadata (config stored as JSON files) |
| `Audits`         | Stores audit entries with JSON data fields             |
| `AuditHistory`   | Audit trail / changelog for each audit                 |

---

---

# 🔧 Template Endpoints

Templates define the structure of audit forms — what sections, checkpoints, columns, and header fields an audit should have. Template configurations are stored as **JSON files** on disk with metadata in the database.

---

## 1. Get All Templates

Retrieves a paginated list of all audit templates with optional filtering by category, active status, and search text. Loads JSON configuration from files for each template.

- **URL:** `/api/v1/audit-report/templates`
- **Method:** `GET`
- **Auth Required:** ❌ (auth middleware commented out)

### Query Parameters

| Param      | Type      | Required | Default | Description                                     |
| ---------- | --------- | -------- | ------- | ----------------------------------------------- |
| `category` | `string`  | ❌       | —       | Filter by template category                     |
| `isActive` | `string`  | ❌       | —       | Filter by active status (`"true"` or `"false"`) |
| `search`   | `string`  | ❌       | —       | Search in Name and Description fields           |
| `page`     | `integer` | ❌       | `1`     | Page number for pagination                      |
| `limit`    | `integer` | ❌       | `50`    | Number of records per page                      |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Templates retrieved successfully.",
  "data": [
    {
      "Id": 1,
      "TemplateCode": "TMPL-0001",
      "TemplateFileName": "Process_Audit_v01_TMPL-0001.json",
      "Name": "Process Audit",
      "Description": "Standard process audit template for production lines",
      "Category": "Process",
      "Version": "01",
      "IsActive": true,
      "CreatedBy": "UC101",
      "CreatedAt": "2025-01-15T10:30:00.000Z",
      "UpdatedBy": "UC101",
      "UpdatedAt": "2025-01-15T10:30:00.000Z",
      "TotalCount": 12,
      "RowNum": 1,
      "HeaderConfig": {
        "title": "Process Audit Report",
        "subtitle": "Manufacturing Quality Audit",
        "logo": true
      },
      "InfoFields": [
        { "key": "modelName", "label": "Model Name", "type": "select" },
        { "key": "date", "label": "Date", "type": "date" },
        { "key": "shift", "label": "Shift", "type": "select" },
        { "key": "eid", "label": "Auditor EID", "type": "text" }
      ],
      "Columns": [
        { "key": "checkpoint", "label": "Check Point", "width": "40%" },
        { "key": "status", "label": "Status", "width": "20%" },
        { "key": "remarks", "label": "Remarks", "width": "40%" }
      ],
      "DefaultSections": [
        {
          "sectionName": "Pre-Production Checks",
          "stages": [
            {
              "stageName": "Material Inspection",
              "checkPoints": [
                {
                  "checkpoint": "Raw material quality verified",
                  "status": "",
                  "remarks": ""
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "totalCount": 12,
  "page": 1,
  "limit": 50
}
```

### Response Fields (per template)

| Field              | Type       | Description                                         |
| ------------------ | ---------- | --------------------------------------------------- |
| `Id`               | `integer`  | Unique template ID                                  |
| `TemplateCode`     | `string`   | Auto-generated unique template code                 |
| `TemplateFileName` | `string`   | JSON config file name on disk                       |
| `Name`             | `string`   | Template display name                               |
| `Description`      | `string`   | Template description                                |
| `Category`         | `string`   | Template category (e.g., "Process", "Safety")       |
| `Version`          | `string`   | Template version number                             |
| `IsActive`         | `boolean`  | Whether template is available for new audits        |
| `CreatedBy`        | `string`   | User code of creator                                |
| `CreatedAt`        | `datetime` | Creation timestamp                                  |
| `UpdatedBy`        | `string`   | User code of last updater                           |
| `UpdatedAt`        | `datetime` | Last update timestamp                               |
| `HeaderConfig`     | `object`   | Header display configuration (from JSON file)       |
| `InfoFields`       | `array`    | Info/metadata field definitions (from JSON file)    |
| `Columns`          | `array`    | Column definitions for checkpoint table (from file) |
| `DefaultSections`  | `array`    | Default sections/stages/checkpoints (from file)     |

### Error Responses

| Status Code | Condition           | Response Body                                              |
| ----------- | ------------------- | ---------------------------------------------------------- |
| `500`       | Database/file error | `{ "success": false, "message": "Internal server error" }` |

### Example cURL

```bash
curl -X GET "http://localhost:3000/api/v1/audit-report/templates?category=Process&isActive=true&page=1&limit=10" \
  -b cookies.txt
```

---

## 2. Get Template Categories

Retrieves a distinct list of all template categories with their counts. Useful for populating category filter dropdowns.

- **URL:** `/api/v1/audit-report/templates/categories`
- **Method:** `GET`
- **Auth Required:** ❌

### Query Parameters

_None._

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Template categories retrieved successfully",
  "data": [
    { "Category": "Process", "Count": 5 },
    { "Category": "Safety", "Count": 3 },
    { "Category": "Quality", "Count": 4 }
  ]
}
```

### Response Fields

| Field      | Type      | Description                          |
| ---------- | --------- | ------------------------------------ |
| `Category` | `string`  | Category name                        |
| `Count`    | `integer` | Number of templates in this category |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/audit-report/templates/categories \
  -b cookies.txt
```

---

## 3. Get Template by ID

Retrieves a single template by its database ID, including the full JSON configuration loaded from disk.

- **URL:** `/api/v1/audit-report/templates/:id`
- **Method:** `GET`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description          |
| ----- | --------- | -------- | -------------------- |
| `id`  | `integer` | ✅       | Template database ID |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Template retrieved successfully",
  "data": {
    "Id": 1,
    "TemplateCode": "TMPL-0001",
    "TemplateFileName": "Process_Audit_v01_TMPL-0001.json",
    "Name": "Process Audit",
    "Description": "Standard process audit template",
    "Category": "Process",
    "Version": "01",
    "IsActive": true,
    "CreatedBy": "UC101",
    "CreatedAt": "2025-01-15T10:30:00.000Z",
    "UpdatedBy": "UC101",
    "UpdatedAt": "2025-01-15T10:30:00.000Z",
    "HeaderConfig": { "title": "Process Audit Report" },
    "InfoFields": [ ... ],
    "Columns": [ ... ],
    "DefaultSections": [ ... ]
  }
}
```

### Error Responses

| Status Code | Condition          | Response Body                                                |
| ----------- | ------------------ | ------------------------------------------------------------ |
| `400`       | Missing ID         | `{ "success": false, "message": "Template ID is required" }` |
| `404`       | Template not found | `{ "success": false, "message": "Template not found" }`      |
| `500`       | Server error       | `{ "success": false, "message": "Internal server error" }`   |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/audit-report/templates/1 \
  -b cookies.txt
```

---

## 4. Create Template

Creates a new audit template. Saves the JSON configuration to a file on disk and stores metadata in the database. Auto-generates a unique template code.

- **URL:** `/api/v1/audit-report/templates`
- **Method:** `POST`
- **Auth Required:** ❌

### Request Body

| Field             | Type      | Required | Default | Description                                           |
| ----------------- | --------- | -------- | ------- | ----------------------------------------------------- |
| `name`            | `string`  | ✅       | —       | Template name                                         |
| `description`     | `string`  | ❌       | `null`  | Template description                                  |
| `category`        | `string`  | ❌       | `null`  | Category (e.g., "Process", "Safety", "Quality")       |
| `version`         | `string`  | ❌       | `"01"`  | Version number                                        |
| `isActive`        | `boolean` | ❌       | `true`  | Whether template is active                            |
| `headerConfig`    | `object`  | ❌       | `{}`    | Header display settings (title, subtitle, logo, etc.) |
| `infoFields`      | `array`   | ❌       | `[]`    | Metadata field definitions for audit entry form       |
| `columns`         | `array`   | ❌       | `[]`    | Column definitions for checkpoint tables              |
| `defaultSections` | `array`   | ❌       | `[]`    | Default sections with stages and checkpoints          |

### Request Example

```json
{
  "name": "Process Audit",
  "description": "Standard process audit for production lines",
  "category": "Process",
  "version": "01",
  "isActive": true,
  "headerConfig": {
    "title": "Process Audit Report",
    "subtitle": "Manufacturing Quality Division",
    "logo": true
  },
  "infoFields": [
    { "key": "modelName", "label": "Model Name", "type": "select" },
    { "key": "date", "label": "Date", "type": "date" },
    {
      "key": "shift",
      "label": "Shift",
      "type": "select",
      "options": ["A", "B", "C"]
    },
    { "key": "eid", "label": "Auditor EID", "type": "text" }
  ],
  "columns": [
    { "key": "checkpoint", "label": "Check Point", "width": "40%" },
    { "key": "status", "label": "Status", "width": "20%" },
    { "key": "remarks", "label": "Remarks", "width": "40%" }
  ],
  "defaultSections": [
    {
      "sectionName": "Pre-Production Checks",
      "stages": [
        {
          "stageName": "Material Inspection",
          "checkPoints": [
            {
              "checkpoint": "Raw material quality verified",
              "status": "",
              "remarks": ""
            },
            {
              "checkpoint": "Supplier certificate available",
              "status": "",
              "remarks": ""
            }
          ]
        }
      ]
    }
  ]
}
```

### Success Response

- **Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "Id": 1,
    "TemplateCode": "TMPL-0001",
    "TemplateFileName": "Process_Audit_v01_TMPL-0001.json",
    "Name": "Process Audit",
    "Description": "Standard process audit for production lines",
    "Category": "Process",
    "Version": "01",
    "IsActive": true,
    "CreatedBy": "UC101",
    "CreatedAt": "2025-01-15T10:30:00.000Z",
    "UpdatedBy": "UC101",
    "UpdatedAt": "2025-01-15T10:30:00.000Z",
    "HeaderConfig": { ... },
    "InfoFields": [ ... ],
    "Columns": [ ... ],
    "DefaultSections": [ ... ]
  }
}
```

### Error Responses

| Status Code | Condition           | Response Body                                                  |
| ----------- | ------------------- | -------------------------------------------------------------- |
| `400`       | Missing name        | `{ "success": false, "message": "Template name is required" }` |
| `500`       | File/database error | `{ "success": false, "message": "Internal server error" }`     |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/audit-report/templates \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Process Audit",
    "description": "Standard process audit",
    "category": "Process",
    "headerConfig": { "title": "Process Audit Report" },
    "infoFields": [{ "key": "date", "label": "Date", "type": "date" }],
    "columns": [{ "key": "checkpoint", "label": "Check Point" }],
    "defaultSections": []
  }'
```

### Notes

- Template configuration is saved as a JSON file in `uploads/AuditTemplates/`
- File naming convention: `{name}_v{version}_{templateCode}.json`
- The `templateCode` is auto-generated using `generateTemplateCode()`
- The `createdBy` field is extracted from `req.user.userCode` (JWT payload)

---

## 5. Update Template

Updates an existing template's metadata and JSON configuration. Automatically backs up the existing template file before overwriting.

- **URL:** `/api/v1/audit-report/templates/:id`
- **Method:** `PUT`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description          |
| ----- | --------- | -------- | -------------------- |
| `id`  | `integer` | ✅       | Template database ID |

### Request Body

| Field             | Type      | Required | Description                       |
| ----------------- | --------- | -------- | --------------------------------- |
| `name`            | `string`  | ❌       | Updated template name             |
| `description`     | `string`  | ❌       | Updated description               |
| `category`        | `string`  | ❌       | Updated category                  |
| `version`         | `string`  | ❌       | Updated version (default: `"01"`) |
| `isActive`        | `boolean` | ❌       | Updated active status             |
| `headerConfig`    | `object`  | ❌       | Updated header configuration      |
| `infoFields`      | `array`   | ❌       | Updated info field definitions    |
| `columns`         | `array`   | ❌       | Updated column definitions        |
| `defaultSections` | `array`   | ❌       | Updated default sections          |

### Request Example

```json
{
  "name": "Process Audit V2",
  "version": "02",
  "headerConfig": { "title": "Process Audit Report V2" },
  "infoFields": [ ... ],
  "columns": [ ... ],
  "defaultSections": [ ... ]
}
```

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "Id": 1,
    "TemplateCode": "TMPL-0001",
    "TemplateFileName": "Process_Audit_V2_v02_TMPL-0001.json",
    "Name": "Process Audit V2",
    "Version": "02",
    ...
  }
}
```

### Error Responses

| Status Code | Condition           | Response Body                                                |
| ----------- | ------------------- | ------------------------------------------------------------ |
| `400`       | Missing ID          | `{ "success": false, "message": "Template ID is required" }` |
| `404`       | Template not found  | `{ "success": false, "message": "Template not found" }`      |
| `500`       | File/database error | `{ "success": false, "message": "Internal server error" }`   |

### Example cURL

```bash
curl -X PUT http://localhost:3000/api/v1/audit-report/templates/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Process Audit V2",
    "version": "02",
    "description": "Updated process audit template"
  }'
```

### Notes

- **Backup:** Before updating, the existing JSON file is backed up to `uploads/AuditTemplates/backups/`
- If the template name changes, the JSON file is renamed accordingly
- The `updatedBy` field is extracted from `req.user.userCode`

---

## 6. Delete Template (Soft Delete)

Soft deletes a template by setting `IsDeleted = 1` in the database. Also backs up and removes the JSON config file. Templates that are used in existing audits cannot be deleted.

- **URL:** `/api/v1/audit-report/templates/:id`
- **Method:** `DELETE`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description          |
| ----- | --------- | -------- | -------------------- |
| `id`  | `integer` | ✅       | Template database ID |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

### Error Responses

| Status Code | Condition               | Response Body                                                                               |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `400`       | Missing ID              | `{ "success": false, "message": "Template ID is required" }`                                |
| `400`       | Template used in audits | `{ "success": false, "message": "Cannot delete template. It is used in existing audits." }` |
| `404`       | Template not found      | `{ "success": false, "message": "Template not found" }`                                     |
| `500`       | Server error            | `{ "success": false, "message": "Internal server error" }`                                  |

### Example cURL

```bash
curl -X DELETE http://localhost:3000/api/v1/audit-report/templates/1 \
  -b cookies.txt
```

### Notes

- This is a **soft delete** — the record remains in the database with `IsDeleted = 1`
- The JSON config file is backed up before deletion
- **Dependency check:** Cannot delete if any non-deleted audits reference this template

---

## 7. Duplicate Template

Creates a copy of an existing template with a new template code, new file, and "(Copy)" appended to the name. Version is reset to "01".

- **URL:** `/api/v1/audit-report/templates/:id/duplicate`
- **Method:** `POST`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description                     |
| ----- | --------- | -------- | ------------------------------- |
| `id`  | `integer` | ✅       | ID of the template to duplicate |

### Request Body

_None required._

### Success Response

- **Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Template duplicated successfully",
  "data": {
    "Id": 13,
    "TemplateCode": "TMPL-0013",
    "TemplateFileName": "Process_Audit_(Copy)_v01_TMPL-0013.json",
    "Name": "Process Audit (Copy)",
    "Description": "Standard process audit for production lines",
    "Category": "Process",
    "Version": "01",
    "IsActive": true,
    "CreatedBy": "UC101",
    "CreatedAt": "2025-06-15T14:20:00.000Z",
    "HeaderConfig": { ... },
    "InfoFields": [ ... ],
    "Columns": [ ... ],
    "DefaultSections": [ ... ]
  }
}
```

### Error Responses

| Status Code | Condition          | Response Body                                                |
| ----------- | ------------------ | ------------------------------------------------------------ |
| `400`       | Missing ID         | `{ "success": false, "message": "Template ID is required" }` |
| `404`       | Original not found | `{ "success": false, "message": "Template not found" }`      |
| `500`       | Server error       | `{ "success": false, "message": "Internal server error" }`   |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/audit-report/templates/1/duplicate \
  -b cookies.txt
```

### Notes

- The duplicated template gets a new `TemplateCode` and a new JSON file
- Name format: `{original name} (Copy)`
- Version is reset to `"01"`
- `IsActive` is set to `true`
- All config (headerConfig, infoFields, columns, defaultSections) is copied from the original

---

---

# 📝 Audit Endpoints

Audits are actual audit entries created from templates. They go through a lifecycle: `draft` → `submitted` → `approved`/`rejected`. Each audit stores its data as JSON fields and maintains a full audit history trail.

---

## 8. Get All Audits

Retrieves a paginated list of all audits with optional filtering by template, status, search text, and date range.

- **URL:** `/api/v1/audit-report/audits`
- **Method:** `GET`
- **Auth Required:** ❌

### Query Parameters

| Param        | Type      | Required | Default | Description                                                     |
| ------------ | --------- | -------- | ------- | --------------------------------------------------------------- |
| `templateId` | `integer` | ❌       | —       | Filter by template ID                                           |
| `status`     | `string`  | ❌       | —       | Filter by status (`draft`, `submitted`, `approved`, `rejected`) |
| `search`     | `string`  | ❌       | —       | Search in ReportName, TemplateName, AuditCode                   |
| `startDate`  | `string`  | ❌       | —       | Filter audits created on or after (ISO date string)             |
| `endDate`    | `string`  | ❌       | —       | Filter audits created on or before (ISO date string)            |
| `page`       | `integer` | ❌       | `1`     | Page number                                                     |
| `limit`      | `integer` | ❌       | `50`    | Records per page                                                |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audits retrieved successfully",
  "data": [
    {
      "Id": 1,
      "AuditCode": "AUD-0001",
      "TemplateId": 1,
      "TemplateName": "Process Audit",
      "ReportName": "Process Audit - Line A - Jan 2025",
      "FormatNo": "FMT-001",
      "RevNo": "00",
      "RevDate": "2025-01-15",
      "Notes": "Monthly audit for Line A",
      "Status": "approved",
      "InfoData": {
        "modelName": "SUS 215L DC",
        "date": "2025-01-15",
        "shift": "A",
        "eid": "EMP001"
      },
      "Sections": [
        {
          "sectionName": "Pre-Production Checks",
          "stages": [
            {
              "stageName": "Material Inspection",
              "checkPoints": [
                {
                  "checkpoint": "Raw material quality verified",
                  "status": "pass",
                  "remarks": "All OK"
                }
              ]
            }
          ]
        }
      ],
      "Summary": {
        "pass": 18,
        "fail": 2,
        "warning": 1,
        "pending": 0,
        "total": 21
      },
      "Signatures": {
        "auditor": { "name": "John Doe", "date": "2025-01-15" },
        "reviewer": { "name": "Jane Smith", "date": "2025-01-16" }
      },
      "Columns": [ ... ],
      "InfoFields": [ ... ],
      "HeaderConfig": { ... },
      "CreatedBy": "UC101",
      "CreatedAt": "2025-01-15T08:00:00.000Z",
      "UpdatedBy": "UC102",
      "UpdatedAt": "2025-01-16T10:30:00.000Z",
      "SubmittedBy": "UC101",
      "SubmittedAt": "2025-01-15T17:00:00.000Z",
      "ApprovedBy": "Jane Smith",
      "ApprovedAt": "2025-01-16T10:30:00.000Z",
      "ApprovalComments": "Looks good. Approved.",
      "TotalCount": 45,
      "RowNum": 1
    }
  ],
  "totalCount": 45,
  "page": 1,
  "limit": 50
}
```

### Error Responses

| Status Code | Condition      | Response Body                                              |
| ----------- | -------------- | ---------------------------------------------------------- |
| `500`       | Database error | `{ "success": false, "message": "Internal server error" }` |

### Example cURL

```bash
curl -X GET "http://localhost:3000/api/v1/audit-report/audits?status=draft&startDate=2025-01-01&endDate=2025-01-31&page=1&limit=20" \
  -b cookies.txt
```

---

## 9. Get Audit Statistics

Retrieves aggregated audit statistics — total counts by status and template-wise breakdown. Useful for dashboards and reporting.

- **URL:** `/api/v1/audit-report/audits/stats`
- **Method:** `GET`
- **Auth Required:** ❌

### Query Parameters

| Param        | Type      | Required | Description                        |
| ------------ | --------- | -------- | ---------------------------------- |
| `startDate`  | `string`  | ❌       | Filter from date (ISO date string) |
| `endDate`    | `string`  | ❌       | Filter to date (ISO date string)   |
| `templateId` | `integer` | ❌       | Filter by specific template        |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit statistics retrieved successfully",
  "data": {
    "summary": {
      "TotalAudits": 45,
      "DraftCount": 5,
      "SubmittedCount": 8,
      "ApprovedCount": 30,
      "RejectedCount": 2
    },
    "templateStats": [
      {
        "TemplateName": "Process Audit",
        "TemplateId": 1,
        "AuditCount": 20,
        "ApprovedCount": 15
      },
      {
        "TemplateName": "Safety Audit",
        "TemplateId": 2,
        "AuditCount": 15,
        "ApprovedCount": 10
      }
    ]
  }
}
```

### Example cURL

```bash
curl -X GET "http://localhost:3000/api/v1/audit-report/audits/stats?startDate=2025-01-01&endDate=2025-06-30" \
  -b cookies.txt
```

---

## 10. Export Audit Data

Retrieves flattened audit data optimized for Excel/CSV export. JSON fields (InfoData, Summary) are flattened into individual columns. Includes calculated pass rate percentage.

- **URL:** `/api/v1/audit-report/audits/export`
- **Method:** `GET`
- **Auth Required:** ❌

### Query Parameters

| Param        | Type      | Required | Description                        |
| ------------ | --------- | -------- | ---------------------------------- |
| `startDate`  | `string`  | ❌       | Filter from date (ISO date string) |
| `endDate`    | `string`  | ❌       | Filter to date (ISO date string)   |
| `templateId` | `integer` | ❌       | Filter by specific template        |
| `status`     | `string`  | ❌       | Filter by audit status             |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit data exported successfully",
  "data": [
    {
      "AuditCode": "AUD-0001",
      "TemplateName": "Process Audit",
      "ReportName": "Process Audit - Line A",
      "FormatNo": "FMT-001",
      "RevNo": "00",
      "RevDate": "2025-01-15",
      "Status": "approved",
      "ModelName": "SUS 215L DC",
      "Date": "2025-01-15",
      "Shift": "A",
      "EID": "EMP001",
      "TotalChecks": 21,
      "PassCount": 18,
      "FailCount": 2,
      "WarningCount": 1,
      "PendingCount": 0,
      "PassRate": 86,
      "CreatedBy": "UC101",
      "CreatedAt": "2025-01-15T08:00:00.000Z",
      "SubmittedBy": "UC101",
      "SubmittedAt": "2025-01-15T17:00:00.000Z",
      "ApprovedBy": "Jane Smith",
      "ApprovedAt": "2025-01-16T10:30:00.000Z",
      "ApprovalComments": "Approved"
    }
  ],
  "totalCount": 45
}
```

### Export-Specific Response Fields

| Field          | Type      | Description                                                    |
| -------------- | --------- | -------------------------------------------------------------- |
| `ModelName`    | `string`  | Extracted from `InfoData.modelName`                            |
| `Date`         | `string`  | Extracted from `InfoData.date`                                 |
| `Shift`        | `string`  | Extracted from `InfoData.shift`                                |
| `EID`          | `string`  | Extracted from `InfoData.eid`                                  |
| `TotalChecks`  | `integer` | Total checkpoints from Summary                                 |
| `PassCount`    | `integer` | Number of passed checkpoints                                   |
| `FailCount`    | `integer` | Number of failed checkpoints                                   |
| `WarningCount` | `integer` | Number of warning checkpoints                                  |
| `PendingCount` | `integer` | Number of pending/unchecked checkpoints                        |
| `PassRate`     | `integer` | Percentage: `Math.round((pass / total) * 100)`, 0 if no checks |

### Example cURL

```bash
curl -X GET "http://localhost:3000/api/v1/audit-report/audits/export?status=approved&startDate=2025-01-01" \
  -b cookies.txt
```

---

## 11. Get Audit by ID

Retrieves a single audit by its ID with all JSON fields parsed.

- **URL:** `/api/v1/audit-report/audits/:id`
- **Method:** `GET`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description       |
| ----- | --------- | -------- | ----------------- |
| `id`  | `integer` | ✅       | Audit database ID |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit retrieved successfully",
  "data": {
    "Id": 1,
    "AuditCode": "AUD-0001",
    "TemplateId": 1,
    "TemplateName": "Process Audit",
    "ReportName": "Process Audit - Line A - Jan 2025",
    "FormatNo": "FMT-001",
    "RevNo": "00",
    "RevDate": "2025-01-15",
    "Notes": "Monthly audit for Line A",
    "Status": "approved",
    "InfoData": { ... },
    "Sections": [ ... ],
    "Columns": [ ... ],
    "InfoFields": [ ... ],
    "HeaderConfig": { ... },
    "Signatures": { ... },
    "Summary": { "pass": 18, "fail": 2, "warning": 1, "pending": 0, "total": 21 },
    "CreatedBy": "UC101",
    "CreatedAt": "2025-01-15T08:00:00.000Z",
    "UpdatedBy": "UC102",
    "UpdatedAt": "2025-01-16T10:30:00.000Z",
    "SubmittedBy": "UC101",
    "SubmittedAt": "2025-01-15T17:00:00.000Z",
    "ApprovedBy": "Jane Smith",
    "ApprovedAt": "2025-01-16T10:30:00.000Z",
    "ApprovalComments": "Looks good."
  }
}
```

### Error Responses

| Status Code | Condition       | Response Body                                              |
| ----------- | --------------- | ---------------------------------------------------------- |
| `400`       | Missing ID      | `{ "success": false, "message": "Audit ID is required" }`  |
| `404`       | Audit not found | `{ "success": false, "message": "Audit not found" }`       |
| `500`       | Server error    | `{ "success": false, "message": "Internal server error" }` |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/audit-report/audits/1 \
  -b cookies.txt
```

---

## 12. Get Audit History

Retrieves the complete change history/audit trail for a specific audit.

- **URL:** `/api/v1/audit-report/audits/:id/history`
- **Method:** `GET`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description       |
| ----- | --------- | -------- | ----------------- |
| `id`  | `integer` | ✅       | Audit database ID |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit history retrieved successfully",
  "data": [
    {
      "Id": 5,
      "AuditId": 1,
      "Action": "approved",
      "ActionBy": "Jane Smith",
      "ActionAt": "2025-01-16T10:30:00.000Z",
      "Comments": "Looks good. Approved."
    },
    {
      "Id": 4,
      "AuditId": 1,
      "Action": "submitted",
      "ActionBy": "UC101",
      "ActionAt": "2025-01-15T17:00:00.000Z",
      "Comments": null
    },
    {
      "Id": 3,
      "AuditId": 1,
      "Action": "updated",
      "ActionBy": "UC101",
      "ActionAt": "2025-01-15T15:00:00.000Z",
      "Comments": null
    },
    {
      "Id": 1,
      "AuditId": 1,
      "Action": "created",
      "ActionBy": "UC101",
      "ActionAt": "2025-01-15T08:00:00.000Z",
      "Comments": null
    }
  ]
}
```

### Response Fields

| Field      | Type       | Description                                                                       |
| ---------- | ---------- | --------------------------------------------------------------------------------- |
| `Id`       | `integer`  | History record ID                                                                 |
| `AuditId`  | `integer`  | Parent audit ID                                                                   |
| `Action`   | `string`   | Action type: `created`, `updated`, `submitted`, `approved`, `rejected`, `deleted` |
| `ActionBy` | `string`   | User code or name who performed the action                                        |
| `ActionAt` | `datetime` | Timestamp of the action                                                           |
| `Comments` | `string`   | Optional comments (used in approve/reject)                                        |

### Error Responses

| Status Code | Condition    | Response Body                                              |
| ----------- | ------------ | ---------------------------------------------------------- |
| `400`       | Missing ID   | `{ "success": false, "message": "Audit ID is required" }`  |
| `500`       | Server error | `{ "success": false, "message": "Internal server error" }` |

### Example cURL

```bash
curl -X GET http://localhost:3000/api/v1/audit-report/audits/1/history \
  -b cookies.txt
```

---

## 13. Create Audit

Creates a new audit entry from a template. Auto-generates an audit code, calculates checkpoint summary (pass/fail/warning/pending), and logs creation to audit history. If template-specific fields (columns, infoFields, headerConfig) are not provided, they are fetched from the template.

- **URL:** `/api/v1/audit-report/audits`
- **Method:** `POST`
- **Auth Required:** ❌

### Request Body

| Field          | Type      | Required | Default   | Description                                               |
| -------------- | --------- | -------- | --------- | --------------------------------------------------------- |
| `templateId`   | `integer` | ✅       | —         | ID of the template to use                                 |
| `reportName`   | `string`  | ✅       | —         | Name for this audit report                                |
| `templateName` | `string`  | ❌       | —         | Template name (auto-fetched if not provided)              |
| `formatNo`     | `string`  | ❌       | `null`    | Format number                                             |
| `revNo`        | `string`  | ❌       | `null`    | Revision number                                           |
| `revDate`      | `string`  | ❌       | `null`    | Revision date (ISO date string)                           |
| `notes`        | `string`  | ❌       | `null`    | Additional notes                                          |
| `status`       | `string`  | ❌       | `"draft"` | Initial status                                            |
| `infoData`     | `object`  | ❌       | `{}`      | Metadata values (model, date, shift, eid, etc.)           |
| `sections`     | `array`   | ❌       | `[]`      | Sections with stages and checkpoints (with status filled) |
| `columns`      | `array`   | ❌       | `[]`      | Column definitions (auto-fetched from template if empty)  |
| `infoFields`   | `array`   | ❌       | `[]`      | Info field definitions (auto-fetched if empty)            |
| `headerConfig` | `object`  | ❌       | `{}`      | Header config (auto-fetched if empty)                     |
| `signatures`   | `object`  | ❌       | `{}`      | Signature data                                            |

### Request Example

```json
{
  "templateId": 1,
  "reportName": "Process Audit - Line A - Jan 2025",
  "formatNo": "FMT-001",
  "revNo": "00",
  "revDate": "2025-01-15",
  "notes": "Monthly process audit for production Line A",
  "infoData": {
    "modelName": "SUS 215L DC",
    "date": "2025-01-15",
    "shift": "A",
    "eid": "EMP001"
  },
  "sections": [
    {
      "sectionName": "Pre-Production Checks",
      "stages": [
        {
          "stageName": "Material Inspection",
          "checkPoints": [
            {
              "checkpoint": "Raw material quality verified",
              "status": "pass",
              "remarks": "OK"
            },
            {
              "checkpoint": "Supplier certificate available",
              "status": "fail",
              "remarks": "Missing"
            }
          ]
        }
      ]
    }
  ],
  "signatures": {
    "auditor": { "name": "John Doe", "date": "2025-01-15" }
  }
}
```

### Success Response

- **Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Audit created successfully",
  "data": {
    "Id": 1,
    "AuditCode": "AUD-0001",
    "TemplateId": 1,
    "TemplateName": "Process Audit",
    "ReportName": "Process Audit - Line A - Jan 2025",
    "Status": "draft",
    "InfoData": { ... },
    "Sections": [ ... ],
    "Summary": { "pass": 1, "fail": 1, "warning": 0, "pending": 0, "total": 2 },
    "Signatures": { ... },
    "Columns": [ ... ],
    "InfoFields": [ ... ],
    "HeaderConfig": { ... },
    "CreatedBy": "UC101",
    "CreatedAt": "2025-01-15T08:00:00.000Z",
    ...
  }
}
```

### Error Responses

| Status Code | Condition                        | Response Body                                                                 |
| ----------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `400`       | Missing templateId or reportName | `{ "success": false, "message": "Template ID and Report Name are required" }` |
| `500`       | Database error                   | `{ "success": false, "message": "Internal server error" }`                    |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/audit-report/audits \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "templateId": 1,
    "reportName": "Process Audit - Line A",
    "infoData": { "date": "2025-01-15", "shift": "A" },
    "sections": []
  }'
```

### Notes

- **Summary auto-calculation:** The summary (pass/fail/warning/pending counts) is automatically calculated from the sections data
- **Supports two section structures:**
  - **New:** `sections[].stages[].checkPoints[]` (nested with stages)
  - **Old:** `sections[].checkPoints[]` (flat, no stages)
- **Template fallback:** If `columns`, `infoFields`, or `headerConfig` are not provided, they are fetched from the `AuditTemplates` table
- **History logging:** A "created" entry is automatically added to `AuditHistory`
- **Audit code:** Auto-generated with prefix "AUD"

---

## 14. Update Audit

Updates an existing audit's data. Cannot edit approved audits. Recalculates summary if sections are provided. Logs update to audit history with before/after data.

- **URL:** `/api/v1/audit-report/audits/:id`
- **Method:** `PUT`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description       |
| ----- | --------- | -------- | ----------------- |
| `id`  | `integer` | ✅       | Audit database ID |

### Request Body

| Field        | Type     | Required | Description                                |
| ------------ | -------- | -------- | ------------------------------------------ |
| `reportName` | `string` | ❌       | Updated report name                        |
| `formatNo`   | `string` | ❌       | Updated format number                      |
| `revNo`      | `string` | ❌       | Updated revision number                    |
| `revDate`    | `string` | ❌       | Updated revision date                      |
| `notes`      | `string` | ❌       | Updated notes                              |
| `status`     | `string` | ❌       | Updated status                             |
| `infoData`   | `object` | ❌       | Updated metadata                           |
| `sections`   | `array`  | ❌       | Updated sections (triggers summary recalc) |
| `signatures` | `object` | ❌       | Updated signatures                         |

### Request Example

```json
{
  "sections": [
    {
      "sectionName": "Pre-Production Checks",
      "stages": [
        {
          "stageName": "Material Inspection",
          "checkPoints": [
            {
              "checkpoint": "Raw material quality verified",
              "status": "pass",
              "remarks": "Verified"
            },
            {
              "checkpoint": "Supplier certificate available",
              "status": "pass",
              "remarks": "Available"
            }
          ]
        }
      ]
    }
  ],
  "notes": "Updated after re-inspection"
}
```

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit updated successfully",
  "data": {
    "Id": 1,
    "Status": "draft",
    "Summary": { "pass": 2, "fail": 0, "warning": 0, "pending": 0, "total": 2 },
    ...
  }
}
```

### Error Responses

| Status Code | Condition         | Response Body                                                      |
| ----------- | ----------------- | ------------------------------------------------------------------ |
| `400`       | Missing ID        | `{ "success": false, "message": "Audit ID is required" }`          |
| `400`       | Audit is approved | `{ "success": false, "message": "Cannot edit an approved audit" }` |
| `404`       | Audit not found   | `{ "success": false, "message": "Audit not found" }`               |
| `500`       | Server error      | `{ "success": false, "message": "Internal server error" }`         |

### Example cURL

```bash
curl -X PUT http://localhost:3000/api/v1/audit-report/audits/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "notes": "Updated notes",
    "sections": [ ... ]
  }'
```

### Notes

- **Cannot edit approved audits** — returns 400 error
- **Partial update** — Only provided fields are updated; omitted fields retain current values
- **Summary recalculation** — If `sections` is provided, summary is recalculated; otherwise, existing summary is kept
- **History logging** — Both previous and new data are stored in `AuditHistory`

---

## 15. Delete Audit (Soft Delete)

Soft deletes an audit by setting `IsDeleted = 1`. Cannot delete approved audits. Logs deletion to audit history.

- **URL:** `/api/v1/audit-report/audits/:id`
- **Method:** `DELETE`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description       |
| ----- | --------- | -------- | ----------------- |
| `id`  | `integer` | ✅       | Audit database ID |

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit deleted successfully"
}
```

### Error Responses

| Status Code | Condition         | Response Body                                                        |
| ----------- | ----------------- | -------------------------------------------------------------------- |
| `400`       | Missing ID        | `{ "success": false, "message": "Audit ID is required" }`            |
| `400`       | Audit is approved | `{ "success": false, "message": "Cannot delete an approved audit" }` |
| `404`       | Audit not found   | `{ "success": false, "message": "Audit not found" }`                 |
| `500`       | Server error      | `{ "success": false, "message": "Internal server error" }`           |

### Example cURL

```bash
curl -X DELETE http://localhost:3000/api/v1/audit-report/audits/1 \
  -b cookies.txt
```

---

## 16. Submit Audit for Approval

Transitions an audit from `draft` to `submitted` status. Recalculates the checkpoint summary before submission. Only audits in `draft` status can be submitted.

- **URL:** `/api/v1/audit-report/audits/:id/submit`
- **Method:** `POST`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description       |
| ----- | --------- | -------- | ----------------- |
| `id`  | `integer` | ✅       | Audit database ID |

### Request Body

_None required._

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit submitted successfully",
  "data": {
    "Id": 1,
    "Status": "submitted",
    "SubmittedBy": "UC101",
    "SubmittedAt": "2025-01-15T17:00:00.000Z",
    "Summary": { "pass": 18, "fail": 2, "warning": 1, "pending": 0, "total": 21 },
    ...
  }
}
```

### Error Responses

| Status Code | Condition                 | Response Body                                                                   |
| ----------- | ------------------------- | ------------------------------------------------------------------------------- |
| `400`       | Missing ID                | `{ "success": false, "message": "Audit ID is required" }`                       |
| `400`       | Audit not in draft status | `{ "success": false, "message": "Cannot submit audit with status: submitted" }` |
| `404`       | Audit not found           | `{ "success": false, "message": "Audit not found" }`                            |
| `500`       | Server error              | `{ "success": false, "message": "Internal server error" }`                      |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/audit-report/audits/1/submit \
  -b cookies.txt
```

### Notes

- **Status requirement:** Only `draft` status audits can be submitted
- **Summary recalculation:** Summary is recalculated from stored sections before submission
- Sets `SubmittedBy` and `SubmittedAt` fields
- Logs "submitted" action to `AuditHistory`

---

## 17. Approve Audit

Transitions an audit from `submitted` to `approved` status. Requires an approver name. Only audits in `submitted` status can be approved.

- **URL:** `/api/v1/audit-report/audits/:id/approve`
- **Method:** `POST`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description       |
| ----- | --------- | -------- | ----------------- |
| `id`  | `integer` | ✅       | Audit database ID |

### Request Body

| Field          | Type     | Required | Description                  |
| -------------- | -------- | -------- | ---------------------------- |
| `approverName` | `string` | ✅       | Name of the person approving |
| `comments`     | `string` | ❌       | Approval comments            |

### Request Example

```json
{
  "approverName": "Jane Smith",
  "comments": "All checkpoints reviewed. Approved."
}
```

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit approved successfully",
  "data": {
    "Id": 1,
    "Status": "approved",
    "ApprovedBy": "Jane Smith",
    "ApprovedAt": "2025-01-16T10:30:00.000Z",
    "ApprovalComments": "All checkpoints reviewed. Approved.",
    ...
  }
}
```

### Error Responses

| Status Code | Condition                     | Response Body                                                                |
| ----------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `400`       | Missing ID                    | `{ "success": false, "message": "Audit ID is required" }`                    |
| `400`       | Missing approver name         | `{ "success": false, "message": "Approver name is required" }`               |
| `400`       | Audit not in submitted status | `{ "success": false, "message": "Cannot approve audit with status: draft" }` |
| `404`       | Audit not found               | `{ "success": false, "message": "Audit not found" }`                         |
| `500`       | Server error                  | `{ "success": false, "message": "Internal server error" }`                   |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/audit-report/audits/1/approve \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "approverName": "Jane Smith",
    "comments": "Approved after review"
  }'
```

### Notes

- **Status requirement:** Only `submitted` status audits can be approved
- Once approved, the audit becomes **immutable** — cannot be edited or deleted
- `ApprovedBy` stores the `approverName` from the request body (not the JWT user code)
- Logs "approved" action with comments to `AuditHistory`

---

## 18. Reject Audit

Transitions an audit from `submitted` to `rejected` status. Requires both an approver name and rejection comments. Only audits in `submitted` status can be rejected.

- **URL:** `/api/v1/audit-report/audits/:id/reject`
- **Method:** `POST`
- **Auth Required:** ❌

### URL Parameters

| Param | Type      | Required | Description       |
| ----- | --------- | -------- | ----------------- |
| `id`  | `integer` | ✅       | Audit database ID |

### Request Body

| Field          | Type     | Required | Description                  |
| -------------- | -------- | -------- | ---------------------------- |
| `approverName` | `string` | ✅       | Name of the person rejecting |
| `comments`     | `string` | ✅       | Reason for rejection         |

### Request Example

```json
{
  "approverName": "Jane Smith",
  "comments": "Section 2 has incomplete checkpoints. Please fill all entries and resubmit."
}
```

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Audit rejected successfully",
  "data": {
    "Id": 1,
    "Status": "rejected",
    "ApprovedBy": "Jane Smith",
    "ApprovedAt": "2025-01-16T11:00:00.000Z",
    "ApprovalComments": "Section 2 has incomplete checkpoints. Please fill all entries and resubmit.",
    ...
  }
}
```

### Error Responses

| Status Code | Condition                     | Response Body                                                               |
| ----------- | ----------------------------- | --------------------------------------------------------------------------- |
| `400`       | Missing ID                    | `{ "success": false, "message": "Audit ID is required" }`                   |
| `400`       | Missing approver name         | `{ "success": false, "message": "Approver name is required" }`              |
| `400`       | Missing rejection comments    | `{ "success": false, "message": "Rejection reason is required" }`           |
| `400`       | Audit not in submitted status | `{ "success": false, "message": "Cannot reject audit with status: draft" }` |
| `404`       | Audit not found               | `{ "success": false, "message": "Audit not found" }`                        |
| `500`       | Server error                  | `{ "success": false, "message": "Internal server error" }`                  |

### Example cURL

```bash
curl -X POST http://localhost:3000/api/v1/audit-report/audits/1/reject \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "approverName": "Jane Smith",
    "comments": "Incomplete data in Section 2"
  }'
```

### Notes

- **Status requirement:** Only `submitted` status audits can be rejected
- **Comments mandatory:** Unlike approval, rejection requires a reason
- `ApprovedBy` and `ApprovalComments` fields are reused for rejection data
- Logs "rejected" action with comments to `AuditHistory`

---

# 📋 API Quick Reference Table

# Auth Module (`/api/v1/auth`)

| #   | Method | Endpoint              | Auth | Description                            |
| --- | ------ | --------------------- | ---- | -------------------------------------- |
| 1   | POST   | `/api/v1/auth/login`  | ❌   | Login with employee code & password    |
| 2   | POST   | `/api/v1/auth/logout` | ❌   | Logout and clear authentication cookie |

# Common Module (`/api/v1/shared`)

| #   | Method | Endpoint                                    | Auth | Description                                  |
| --- | ------ | ------------------------------------------- | ---- | -------------------------------------------- |
| 1   | GET    | `/api/v1/shared/model-variants`             | ✅   | Get all active model variants                |
| 2   | GET    | `/api/v1/shared/model-variants/:serial`     | ✅   | Get model variants by assembly serial number |
| 3   | GET    | `/api/v1/shared/Comp-type`                  | ✅   | Get all component types                      |
| 4   | GET    | `/api/v1/shared/stage-names`                | ✅   | Get all work stage/station names             |
| 5   | GET    | `/api/v1/shared/departments`                | ✅   | Get all departments                          |
| 6   | GET    | `/api/v1/shared/employees-with-departments` | ✅   | Get all employees with their department info |

# Audit Report Module (`/api/v1/audit-report`)

## Template Endpoints (`/api/v1/audit-report/templates`)

| #   | Method | Endpoint                                       | Auth | Description                             |
| --- | ------ | ---------------------------------------------- | ---- | --------------------------------------- |
| 1   | GET    | `/api/v1/audit-report/templates`               | ❌   | Get all templates (paginated, filtered) |
| 2   | GET    | `/api/v1/audit-report/templates/categories`    | ❌   | Get distinct template categories        |
| 3   | GET    | `/api/v1/audit-report/templates/:id`           | ❌   | Get template by ID                      |
| 4   | POST   | `/api/v1/audit-report/templates`               | ❌   | Create new template                     |
| 5   | PUT    | `/api/v1/audit-report/templates/:id`           | ❌   | Update template                         |
| 6   | DELETE | `/api/v1/audit-report/templates/:id`           | ❌   | Soft delete template                    |
| 7   | POST   | `/api/v1/audit-report/templates/:id/duplicate` | ❌   | Duplicate template                      |

## Audit Endpoints (`/api/v1/audit-report/audits`)

| #   | Method | Endpoint                                  | Auth | Description                          |
| --- | ------ | ----------------------------------------- | ---- | ------------------------------------ |
| 8   | GET    | `/api/v1/audit-report/audits`             | ❌   | Get all audits (paginated, filtered) |
| 9   | GET    | `/api/v1/audit-report/audits/stats`       | ❌   | Get audit statistics                 |
| 10  | GET    | `/api/v1/audit-report/audits/export`      | ❌   | Get flattened audit data for export  |
| 11  | GET    | `/api/v1/audit-report/audits/:id`         | ❌   | Get audit by ID                      |
| 12  | GET    | `/api/v1/audit-report/audits/:id/history` | ❌   | Get audit change history             |
| 13  | POST   | `/api/v1/audit-report/audits`             | ❌   | Create new audit                     |
| 14  | PUT    | `/api/v1/audit-report/audits/:id`         | ❌   | Update audit                         |
| 15  | DELETE | `/api/v1/audit-report/audits/:id`         | ❌   | Soft delete audit                    |
| 16  | POST   | `/api/v1/audit-report/audits/:id/submit`  | ❌   | Submit audit for approval            |
| 17  | POST   | `/api/v1/audit-report/audits/:id/approve` | ❌   | Approve submitted audit              |
| 18  | POST   | `/api/v1/audit-report/audits/:id/reject`  | ❌   | Reject submitted audit               |

---

# 🗄 Database Connection Reference

| Config      | Type  | Used By                                         |
| ----------- | ----- | ----------------------------------------------- |
| `dbConfig1` | MSSQL | Auth, Model Variants, Comp Types, Stages, Depts |
| `dbConfig2` | MSSQL |                                                 |
| `dbConfig3` | MSSQL | Employees with Departments                      |

---

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

---

# 📋 API Quick Reference Table

## Auth Module (`/api/v1/auth`)

| #   | Method | Endpoint           | Auth | Description                            |
| --- | ------ | ------------------ | ---- | -------------------------------------- |
| 1   | POST   | `/api/v1/auth/login`  | ❌   | Login with employee code & password    |
| 2   | POST   | `/api/v1/auth/logout` | ❌   | Logout and clear authentication cookie |

## Common Module (`/api/v1/shared`)

| #   | Method | Endpoint                                 | Auth | Description                                  |
| --- | ------ | ---------------------------------------- | ---- | -------------------------------------------- |
| 1   | GET    | `/api/v1/shared/model-variants`             | ✅   | Get all active model variants                |
| 2   | GET    | `/api/v1/shared/model-variants/:serial`     | ✅   | Get model variants by assembly serial number |
| 3   | GET    | `/api/v1/shared/Comp-type`                  | ✅   | Get all component types                      |
| 4   | GET    | `/api/v1/shared/stage-names`                | ✅   | Get all work stage/station names             |
| 5   | GET    | `/api/v1/shared/departments`                | ✅   | Get all departments                          |
| 6   | GET    | `/api/v1/shared/employees-with-departments` | ✅   | Get all employees with their department info |

---

# 🗄 Database Connection Reference

| Config      | Type  | Used By                                         |
| ----------- | ----- | ----------------------------------------------- |
| `dbConfig1` | MSSQL | Auth, Model Variants, Comp Types, Stages, Depts |
| `dbConfig3` | MSSQL | Employees with Departments                      |

---

# 🏭 WRL Tool Report Dashboard for Western Refrigeration Pvt. Ltd.

A comprehensive, full-stack **Manufacturing Reporting & Management Dashboard** built for industrial operations. This platform centralizes production tracking, quality assurance, dispatch logistics, compliance monitoring, visitor management, audit reporting, and task reminders into a single, unified tool.

---

## 🖼️ Screenshots

| ![Screenshot 1](https://github.com/user-attachments/assets/1f084f4d-cb74-41ee-8d02-3116addd459f) | ![Screenshot 2](https://github.com/user-attachments/assets/767895a2-cedf-4ce5-92f9-d6fb03e394c9) |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| ![Screenshot 4](https://github.com/user-attachments/assets/ab1b8d03-ceda-40f3-9f4e-8d676a502e76) | ![Screenshot 3](https://github.com/user-attachments/assets/09f1e360-fd1d-4199-87de-9bf827a913fd) |

---

## 📌 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
  - [Running with Docker](#running-with-docker)
- [Module Breakdown](#module-breakdown)
- [API Documentation](#api-documentation)
- [Team](#team)
- [License](#license)

---

## 🔍 Overview

**WRL Tool Report Dashboard** is an enterprise-grade internal tool designed for manufacturing plant (Western Refrigeration Pvt. Ltd.) to digitize and streamline their daily operations. It replaces fragmented spreadsheets, paper-based logs, and manual reporting with a centralized web application that provides real-time visibility into:

- Production output & hourly tracking
- Quality inspection results (FPA, LPT, EST, CPT, BIS, BEE)
- Dispatch & logistics performance
- Compliance & calibration schedules
- Visitor management with digital pass generation
- Audit trail management with dynamic templates
- Task reminders with email escalation

The system uses **role-based access control (RBAC)** to ensure that each department only sees and interacts with the modules relevant to them.

---

## ✨ Key Features

### 🏭 Production Module

- Real-time **hourly production reports** (line-wise and aggregate)
- **Stage history tracking** for individual components
- **NFC-based** component traceability reports
- **Component details** lookup and **model name management**
- **Total production** dashboards with shift-wise breakdowns
- **Line hourly reports** with category-specific views (Foaming, Post-Foaming, Final Line, Final Loading)

### ✅ Quality Module

- **FPA (First Piece Approval)** entry, defect logging with image uploads, and reporting
- **LPT (Leak Proof Test)** management, recipe configuration, and reporting
- **EST (Electrical Safety Test)** detailed reports with modal views
- **CPT (Component Performance Test)** report generation
- **Gas Charging** reports with detailed drill-downs
- **BIS (Bureau of Indian Standards)** report uploads and status tracking
- **BEE (Bureau of Energy Efficiency)** calculation tools
- **Rework** entry and reporting
- **Scrap & Brazing** reports
- **Dispatch hold** management and **hold cabinet details**
- **Tag update** utilities for quality labels

### 🚚 Dispatch Module

- **Dispatch reports** with date-range filtering
- **Gate entry** tracking with automated email alerts
- **FG Casting** reports
- **Error log** management
- **Performance reports** with KPI tracking
- **Logistics display** screens for shop-floor monitors

### 📋 Planning Module

- **Daily production plans** with target vs actual comparison
- **Production planning** with model-wise scheduling

### 📑 Audit Report Module

- **Dynamic template builder** — create custom audit templates without code
- **Audit entry** forms generated from templates
- **Audit list** and **audit view** for historical tracking
- Template versioning with **backup management**

### 📅 Compliance Module

- **Calibration tracking** with instrument-level schedules
- **Escalation workflows** — automated email reminders at multiple levels
- **History tables** for calibration records

### 🏢 Visitor Management Module

- **Digital visitor pass** generation with QR codes
- **Check-in/Check-out** tracking
- **Employee management** for host assignment
- **Dashboard** with real-time visitor statistics
- **History & Reports** with email export capabilities

### ⏰ Task Reminder Module

- **Task creation** with due dates and assignees
- **Email notifications** on task creation and completion
- **Cron-based reminders** for overdue tasks

### 🔐 Authentication & Authorization

- **JWT-based authentication** with HTTP-only cookies
- **Role-based access control** — different modules visible per user role
- **Protected routes** on both frontend and backend

### 📧 Email System

- **Templated emails** for each module (calibration alerts, visitor passes, task reminders, gate entry alerts)
- **Nodemailer** integration with configurable SMTP

### 📊 Data Export

- **Excel export** using ExcelJS for detailed reports
- **PDF generation** using jsPDF for visitor passes
- **Chart visualizations** using Chart.js with data labels

---

## 🛠 Tech Stack

| Layer             | Technology                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Frontend**      | React 19, Vite 6, Redux Toolkit, React Router 7, React Hot Toast, React Icons, Tailwind CSS 4 |
| **Backend**       | Node.js, Express 5, ES Modules                                                                |
| **Databases**     | Microsoft SQL Server (MSSQL)                                                                  |
| **Auth**          | JSON Web Tokens (JWT), Cookie-based sessions                                                  |
| **Email**         | Nodemailer with HTML templates                                                                |
| **Scheduling**    | node-cron for periodic tasks                                                                  |
| **File Handling** | Multer for file uploads                                                                       |
| **Charts**        | Chart.js + react-chartjs-2 + chartjs-plugin-datalabels                                        |
| **PDF/Excel**     | jsPDF, ExcelJS, file-saver, xlsx                                                              |
| **QR Code**       | qrcode (for visitor passes)                                                                   |
| **DevOps**        | Docker, Docker Compose                                                                        |

---

## 🏗 Architecture Overview

```
                ┌─────────────────┐        ┌─────────────────┐
                │                 │  HTTP  │                 │
                │    React SPA    │◄──────►│   Express API   │
                │   (Vite + TW)   │  REST  │     Server      │
                │                 │        │                 │
                └────────┬────────┘        └────────┬────────┘
                         │                          │
                         │                          │
                         │                ┌─────────┴─────────┐
                         │                │                   │
                         │          ┌─────▼─────┐       ┌─────▼─────┐
                         │          │   MSSQL   │       │   MSSQL   │
                         │          │     DB    │       │     DB    │
                         │          └───────────┘       └───────────┘
                         │
                ┌────────▼─────────┐
                │    Redux Store   │
                │    (Persisted)   │
                └──────────────────┘
```

The application follows a **modular monolith** architecture:

- **Frontend** communicates with the Backend via RESTful APIs using Axios
- **Backend** connects to both MSSQL and MySQL databases for different data domains
- **Cron jobs** run server-side for escalation emails and task reminders
- **State management** uses Redux Toolkit with persistence for session continuity

---

## 📂 Project Structure

```bash
WRL-Tool-Report-Dashboard/
├── Backend/
│   ├── config/
│   │   ├── db.config.js
│   │   ├── email.config.js
│   ├── controllers/
│   │   ├── auditReport/
│   │   │   ├── audit.controller.js
│   │   │   ├── template.controller.js
│   │   └── compliance/
│   │   │   ├── calibiration.controller.js
│   │   │   ├── calibirationUsers.controller.js
│   │   └── dispatch/
│   │   │   ├── dispatchReport.controller.js
│   │   │   ├── errorLog.controller.js
│   │   │   ├── fgCasting.controller.js
│   │   │   ├── gateEntry.controller.js
│   │   │   ├── performanceReport.controller.js
│   │   └── planing/
│   │   │   ├── dailyPlan.controller.js
│   │   │   ├── productionPlaning.controller.js
│   │   └── production/
│   │   │   ├── componentDetails.controller.js
│   │   │   ├── componentTraceabilityReport.controller.js
│   │   │   ├── hourlyReport.controller.js
│   │   │   ├── lineHourlyReport.controller.js
│   │   │   ├── modelNameUpdate.controller.js
│   │   │   ├── nfcReport.controller.js
│   │   │   ├── productionReport.controller.js
│   │   │   ├── stageHistoryReport.controller.js
│   │   │   ├── totalProduction.controller.js
│   │   └── quality/
│   │   │   ├── beeCalculation.controller.js
│   │   │   ├── cptReport.controller.js
│   │   │   ├── dispatchHold.controller.js
│   │   │   ├── estReport.controller.js
│   │   │   ├── fpa.controller.js
│   │   │   ├── fpaDefectReport.controller.js
│   │   │   ├── fpaReport.controller.js
│   │   │   ├── gasCharging.controller.js
│   │   │   ├── holdCabinetDetails.controller.js
│   │   │   ├── lpt.controller.js
│   │   │   ├── lptRecipe.controller.js
│   │   │   ├── lptReport.controller.js
│   │   │   ├── rework.controller.js
│   │   │   ├── tagUpdate.controller.js
│   │   │   ├── uploadBISReport.controller.js
│   │   └── taskReminder/
│   │   │   ├── tasks.controller.js
│   │   └── visitor/
│   │   │   ├── dashboard.controller.js
│   │   │   ├── generatePass.controller.js
│   │   │   ├── history.controller.js
│   │   │   ├── inOut.controller.js
│   │   │   ├── manageEmployee.controller.js
│   │   │   ├── reports.controller.js
│   │   └── auth.controller.js
│   │   └── common.controller.js
│   ├── cron/
│   │   ├── calibrationEscalation.js
│   │   ├── taskReminder.js
│   ├── emailTemplates/
│   │   ├── Calibration_System
│   │   │   ├── calibrationAlert.template.js
│   │   │   ├── calibrationMail.template.js
│   │   ├── Dispatch_System
│   │   │   ├── gateEntryAlert.template.js
│   │   ├── Task_Reminder_System
│   │   │   ├── createTaskReminder.template.js
│   │   │   ├── taskCompleted.template.js
│   │   ├── Visitor_Management_System
│   │   │   ├── visitorPass.template.js
│   │   │   ├── visitorReport.template.js
│   ├── middlewares
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── uploadMiddleware.js
│   ├── node_modules/
│   ├── routes/
│   │   ├── auditReport.route.js
│   │   ├── auth.route.js
│   │   ├── common.route.js
│   │   ├── compliance.route.js
│   │   ├── dispatch.route.js
│   │   ├── estReport.route.js
│   │   ├── gasChargingReport.route.js
│   │   ├── index.js
│   │   ├── planing.route.js
│   │   ├── production.route.js
│   │   ├── quality.route.js
│   │   ├── taskReminder.route.js
│   │   ├── visitor.route.js
│   ├── services/
│   │   └── escalation.service.js
│   ├── uploads/
│   │   └── AuditTemplates
│   │   │   ├── backups/
│   │   └── BISReport
│   │   └── Calibration
│   │   └── FpaDefectImages
│   ├── utils/
│   │   └── AppError.js
│   │   └── convertToIST.js
│   │   └── escalation.js
│   │   └── generateCode.js
│   │   └── templateStorage.js
│   │   └── tryCatch.js
│   └── .dockerignore
│   └── .env
│   └── .gitignore
│   └── Dockerfile
│   └── package-lock.json
│   └── package.json
│   └── server.js
│
├── Frontend/
│   ├── node_modules/
│   ├── public/
│   │   ├── favicon.ico
│   ├── src/
│   │   ├── assets/
│   │   │   ├── assets.js
│   │   │   ├── industrialBg1.JPG
│   │   │   ├── industrialBg2.avif
│   │   │   ├── industrialBg3.avif
│   │   │   ├── logo.png
│   │   ├── components/
│   │   │   ├── graphs/
│   │   │   │   └── FpaReportsBarGraph.jsx
│   │   │   ├── lineHourly/
│   │   │   │   └── FinalLine
│   │   │   │   │   └── FinalCategoryCount.jsx
│   │   │   │   │   └── FinalChoc.jsx
│   │   │   │   │   └── FinalFreezer.jsx
│   │   │   │   │   └── FinalSUS.jsx
│   │   │   │   └── FinalLoading
│   │   │   │   │   └── FinalCategoryLoadingCount.jsx
│   │   │   │   │   └── FinalLoadingChoc.jsx
│   │   │   │   │   └── FinalLoadingFreezer.jsx
│   │   │   │   │   └── FinalLoadingSUS.jsx
│   │   │   │   └── Foaming
│   │   │   │   │   └── FoamingA.jsx
│   │   │   │   │   └── FoamingB.jsx
│   │   │   │   │   └── FoamingCategoryCount.jsx
│   │   │   │   └── PostFoaming
│   │   │   │   │   └── ManualPostFoaming.jsx
│   │   │   │   │   └── PostFoamingCategoryCount.jsx
│   │   │   │   │   └── PostFoamingFreezer.jsx
│   │   │   │   │   └── PostFoamingSUS.jsx
│   │   │   ├── ui/
│   │   │   │   └── Badge.jsx
│   │   │   │   └── Button.jsx
│   │   │   │   └── DateTimePicker.jsx
│   │   │   │   └── ExportButton.jsx
│   │   │   │   └── InputField.jsx
│   │   │   │   └── Loader.jsx
│   │   │   │   └── Pagination.jsx
│   │   │   │   └── PopupModal.jsx
│   │   │   │   └── RadioButton.jsx
│   │   │   │   └── ScrollToTop.jsx
│   │   │   │   └── SelectField.jsx
│   │   │   │   └── Title.jsx
│   │   │   └── ESTDetailModal.jsx
│   │   │   └── GasChargingDetailModal.jsx
│   │   │   └── Layout.jsx
│   │   │   └── Navbar.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── config/
│   │   │   └── routes.config.js
│   │   ├── hooks/
│   │   │   └── useAuditData.js
│   │   │   └── useEstReport.js
│   │   │   └── useRoleAccess.js
│   │   ├── pages/
│   │   │   ├── AuditReport/
│   │   │   ├── Audit/
│   │   │   │   └── AuditEntry.jsx
│   │   │   │   └── AuditList.jsx
│   │   │   │   └── AuditView.jsx
│   │   │   ├── Template/
│   │   │   │   └── TemplateBuilder.jsx
│   │   │   │   └── TemplateList.jsx
│   │   │   ├── Auth/
│   │   │   │   └── Login.jsx
│   │   │   ├── Compliance/
│   │   │   │   └── Calibration.jsx
│   │   │   │   └── HistoryTable.jsx
│   │   │   ├── Dispatch/
│   │   │   │   └── DispatchPerformanceReport.jsx
│   │   │   │   └── DispatchReport.jsx
│   │   │   │   └── DispatchUnloading.jsx
│   │   │   │   └── ErrorLog.jsx
│   │   │   │   └── FGCasting.jsx
│   │   │   │   └── GateEntry.jsx
│   │   │   ├── PerformanceDisplays/
│   │   │   │   └── LogisticsDisplay.jsx
│   │   │   ├── Planing/
│   │   │   │   └── DailyPlan.jsx
│   │   │   │   └── ProductionPlaning.jsx
│   │   │   ├── Production/
│   │   │   │   └── ComponentDetails.jsx
│   │   │   │   └── ComponentTraceabilityReport.jsx
│   │   │   │   └── HourlyReport.jsx
│   │   │   │   └── LineHourlyReport.jsx
│   │   │   │   └── ModelNameUpload.jsx
│   │   │   │   └── NFCReport.jsx
│   │   │   │   └── Overview.jsx
│   │   │   │   └── StageHistoryReport.jsx
│   │   │   │   └── TotalProduction.jsx
│   │   │   ├── Quality/
│   │   │   │   └── BEECalculation.jsx
│   │   │   │   └── BISReports.jsx
│   │   │   │   └── BISStatus.jsx
│   │   │   │   └── BrazingReport.jsx
│   │   │   │   └── CPTReport.jsx
│   │   │   │   └── DispatchHold.jsx
│   │   │   │   └── ESTReport.jsx
│   │   │   │   └── FPA.jsx
│   │   │   │   └── FPADefectReport.jsx
│   │   │   │   └── FPAReports.jsx
│   │   │   │   └── GasChargingReport.jsx
│   │   │   │   └── HoldCabinetDetails.jsx
│   │   │   │   └── LPT.jsx
│   │   │   │   └── LPTRecipe.jsx
│   │   │   │   └── LPTReport.jsx
│   │   │   │   └── ProcessHistoryCard.jsx
│   │   │   │   └── ReworkEntry.jsx
│   │   │   │   └── ReworkReport.jsx
│   │   │   │   └── ScrapReport.jsx
│   │   │   │   └── TagUpdate.jsx
│   │   │   │   └── UploadBISReport.jsx
│   │   │   ├── TaskReminders/
│   │   │   │   └── ManageTasks.jsx
│   │   │   │   └── TaskOverview.jsx
│   │   │   ├── Visitor/
│   │   │   │   └── Dashboard.jsx
│   │   │   │   └── GeneratePass.jsx
│   │   │   │   └── History.jsx
│   │   │   │   └── InOut.jsx
│   │   │   │   └── ManageEmployee.jsx
│   │   │   │   └── Reports.jsx
│   │   │   │   └── VisitorPassDisplay.jsx
│   │   │   ├── Home.jsx
│   │   │   └── NotFound.jsx
│   │   ├── redux/
│   │   │   ├── api/
│   │   │   │   └── commonApi.js
│   │   │   │   └── estReportApi.js
│   │   │   │   └── gasChargingApi.js
│   │   │   │   └── taskReminder.js
│   │   │   ├── authSlice.js
│   │   │   ├── estReportSlice.js
│   │   │   ├── gasChargingSlice.js
│   │   │   ├── store.js
│   │   ├── utils/
│   │   │   └── dateUtils.js
│   │   │   └── exportToXls.js
│   │   │   └── mapCategories.js
│   │   │   └── shiftUtils.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   ├── .dockerignore
│   ├── .env
│   ├── .gitignore
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── vite.config.js
├── APIs_Doc.md
└── docker-compose.yml
├── README.md
```

📖 See [Backend README](./Backend/README.md) and [Frontend README](./Frontend/README.md) for detailed documentation of each.

---

## 🚀 Getting Started

## 📌 Prerequisites

Ensure the following are installed on your machine:

| Tool              | Version | Purpose                  |
| ----------------- | ------- | ------------------------ |
| Node.js           | ≥ 18.x  | JavaScript runtime       |
| npm               | ≥ 9.x   | Package manager          |
| MSSQL Server      | ≥ 2019  | Primary database         |
| Docker (optional) | ≥ 24.x  | Containerized deployment |
| Git               | ≥ 2.x   | Version control          |

---

## 🔐 Environment Variables

Both **Frontend** and **Backend** require `.env` files.  
See the respective READMEs for full details.

---

### 🖥 Backend (`Backend/.env`)

```env
PORT=3000
JWT_SECRET=jwt_secret
CORS_ORIGIN=http://localhost:5173

# Database 1
DB_USER1=database_username
DB_PASSWORD1=database_password
DB_SERVER1=server_IP
DB_NAME1=database_name

# Database 2
DB_USER2=database_username
DB_PASSWORD2=database_password
DB_SERVER2=server_IP
DB_NAME2=database_name

# Database 3
DB_USER3=database_username
DB_PASSWORD3=database_password
DB_SERVER3=server_IP
DB_NAME3=database_name

# Email config
SMTP_HOST=SMTP_host
SMTP_PORT=587
SMTP_USER=SMTP_username
SMTP_PASS=SMTP_password

# App Configuration
FRONTEND_URL=frontend_url
TASK_OVERVIEW_PATH=/reminder/overview
```

---

### 🌐 Frontend (`Frontend/.env`)

```env
VITE_API_BASE_URL='http://localhost:3000/api/v1/'
```

---

## ▶️ Running Locally

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Varunyadavgithub/WRL-Tool-Report-Dashboard
cd WRL-Tool-Report-Dashboard
```

---

### 2️⃣ Start the Backend

```bash
cd Backend
npm install
npm run dev
```

The API server will start at:

```
http://localhost:3000
```

---

### 3️⃣ Start the Frontend

```bash
cd Frontend
npm install
npm run dev
```

The development server will start at:

```
http://localhost:5173
```

---

## 🐳 Running with Docker

From the root directory:

```bash
docker-compose up --build
```

This will spin up both frontend and backend containers as defined in `docker-compose.yml`.

### Stop containers

```bash
docker-compose down
```

### Rebuild after changes

```bash
docker-compose up --build -d
```

---

# 📦 Module Breakdown

| Module        | Backend Controllers | Frontend Pages | Key Capabilities                                |
| ------------- | ------------------- | -------------- | ----------------------------------------------- |
| Production    | 9                   | 9              | Hourly reports, traceability, NFC, line-wise    |
| Quality       | 15                  | 19             | FPA, LPT, EST, CPT, BIS, BEE, rework, gas       |
| Dispatch      | 5                   | 6              | Gate entry, FG casting, error logs, performance |
| Planning      | 2                   | 2              | Daily plans, production scheduling              |
| Audit Report  | 2                   | 5              | Dynamic templates, audit entry & tracking       |
| Compliance    | 2                   | 2              | Calibration tracking, escalation workflows      |
| Visitor       | 6                   | 7              | Pass generation, check-in/out, reports          |
| Task Reminder | 1                   | 2              | Task management with email reminders            |
| Auth          | 1                   | 1              | Login, JWT tokens, role management              |

---

# 📡 API Documentation

📘 Detailed API endpoint documentation: [APIs Documentation](APIs_Doc.md)

---

## 🌍 General API Structure

**Base URL:**

```
http://localhost:3000/api/v1
```

### Available Routes

```
/api/v1/auth/_            → Authentication endpoints
/api/v1/shared/_          → Shared/common endpoints
/api/v1/prod/_            → Production module endpoints
/api/v1/quality/_         → Quality module endpoints
/api/v1/est-report/_      → EST report endpoints
/api/v1/gas-charging/_    → Gas charging report endpoints
/api/v1/dispatch/_        → Dispatch module endpoints
/api/v1/planing/_         → Planning module endpoints
/api/v1/visitor/_         → Visitor management endpoints
/api/v1/compliance/_      → Compliance module endpoints
/api/v1/task-reminder/_   → Task reminder endpoints
/api/v1/audit-report/_    → Audit report endpoints
```

---

## 👥 Team

This project is built and actively maintained by the **WRL MES Developer Team** to support internal manufacturing operations, reporting automation, compliance tracking, and production monitoring at **Western Refrigeration Pvt. Ltd.**

The team focuses on delivering scalable, secure, and production-ready MES solutions aligned with real-time plant requirements.

<br/>

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/Varunyadavgithub.png" width="120px;" style="border-radius:50%; border:3px solid #e1e4e8;" alt="Varun Yadav"/><br />
      <b>Varun Yadav</b><br />
      <sub>MES Developer Trainee</sub><br />
      <sub>Western Refrigeration Pvt. Ltd.</sub><br />
      <a href="https://www.linkedin.com/in/thecyberdevvarun">LinkedIn</a>
    </td>
    <td align="center">
      <img src="https://github.com/buildwithvikash.png" width="120px;" style="border-radius:50%; border:3px solid #e1e4e8;" alt="Vikash Kumar"/><br />
      <b>Vikash Kumar</b><br />
      <sub>MES Developer</sub><br />
      <sub>Western Refrigeration Pvt. Ltd.</sub><br />
      <a href="https://www.linkedin.com/in/vikash-kumar-54b464336/">LinkedIn</a>
    </td>

  </tr>
</table>

---

### 💡 Setup Tip

If you encounter issues during first-time setup:

- Ensure your database credentials are correctly configured in `Backend/.env`
- Verify that **MSSQL** services are running
- Confirm that databases are accessible from your development machine
- Check that required ports (1433 for MSSQL) are open

---

## 📃 License

This project is proprietary and developed exclusively for internal use at
**Western Refrigeration Pvt. Ltd.**

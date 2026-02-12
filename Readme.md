# ⚙️ WRL Tool Report

**Western Refrigeration Pvt. Ltd.**

> **A full-stack enterprise-grade Manufacturing Execution System (MES)**
> Built with **MERN Stack**, **Tailwind CSS**, and integrated with **multiple SQL Server Databases**

---

## 📌 Overview

This project is a scalable, internal web-based **MES + Visitor Management Dashboard** developed for
**Western Refrigeration Pvt. Ltd.**, Asia’s largest commercial refrigeration manufacturer.

It automates and centralizes department-wise production reporting and visitor tracking across multiple factories.

> ✅ Designed for 20+ roles across multiple departments
> 🧩 Connects to **3 Microsoft SQL Server databases**
> 🧑‍✈️ Manages visitor entries and generates dynamic QR-based passes

---

## 🖼️ Screenshots

| ![Screenshot 1](https://github.com/user-attachments/assets/1f084f4d-cb74-41ee-8d02-3116addd459f) | ![Screenshot 2](https://github.com/user-attachments/assets/767895a2-cedf-4ce5-92f9-d6fb03e394c9) |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| ![Screenshot 4](https://github.com/user-attachments/assets/ab1b8d03-ceda-40f3-9f4e-8d676a502e76) | ![Screenshot 3](https://github.com/user-attachments/assets/09f1e360-fd1d-4199-87de-9bf827a913fd) |

---

## 🧑‍💼 Key Highlights

### 🏭 MES Dashboard

* 🔍 Real-time production data across:

  * Production
  * Quality
  * Dispatch
  * Planning

* 🔐 **Role-Based Access Control (20+ roles):**
  Each user role sees only relevant reports, filters, and actions.

* 🗂 **Multi-SQL Server Connectivity:**
  Backend smartly connects to **three SQL Server databases**.

* 📅 **Advanced Reporting Options:**
  Filter by daily, monthly, or yearly periods. Download reports as Excel files.

---

### 🧑‍✈️ Visitor Management System (New)

> A fully integrated module to manage factory visitors securely and efficiently.

* 📇 **QR-based Visitor Passes**
  On check-in, a dynamic QR code is generated for each visitor.

* 📲 **Gate Entry/Exit Scanning**
  QR scanned at entry/exit points by guards or gate operators.

* 📊 **Live Visitor Dashboard**
  Displays currently inside visitors, visit durations, and departmental destinations.

* 📄 **Reports & Exports**
  Search by date, host, department, or visitor name. Exportable.

* 👮 **Security Role Access**
  Only security/admin users can create or scan visitor passes.

---

## 🧑‍💻 Tech Stack

### Backend

* **Node.js**, **Express.js**
* **Microsoft SQL Server (MSSQL)**
* **JWT Auth**
* **Multer**, **QR Code**, **Cookie-parser**

### Frontend

* **React.js (Vite)**
* **Redux Toolkit + Redux Persist**
* **Tailwind CSS (Responsive UI)**
* **Chart.js**, **React ChartJS 2**
* **React QR Code**, **ExcelJS**, **FileSaver**
* **React Hot Toast**, **React Datepicker**

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
│   │   │   │   └── AuditEntry.jsx
│   │   │   │   └── AuditList.jsx
│   │   │   │   └── AuditView.jsx
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

---

## 🔐 Authentication & Authorization

* Secured with **JWT**
* Role decoded and managed with **Redux Toolkit**
* Routes and UI components are protected based on role
* Admins can:

  * Create users
  * Upload Excel files
  * Manage visitor records

---

## 🔗 `.env` Example

```env
PORT=3000
JWT_SECRET=your_secret

# Database Configurations
DB_USER1=user1
DB_PASSWORD1=pass1
DB_SERVER1=192.168.1.1
DB_NAME1=production_db

DB_USER2=user2
DB_PASSWORD2=pass2
DB_SERVER2=192.168.1.2
DB_NAME2=quality_db

DB_USER3=user3
DB_PASSWORD3=pass3
DB_SERVER3=192.168.1.3
DB_NAME3=dispatch_db
```

---

## 🚀 Getting Started

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit: [http://localhost:5173](http://localhost:5173)

---

## 📈 Feature Overview

| Feature                  | Description                               |
| ------------------------ | ----------------------------------------- |
| 🔒 Role-Based Access     | 20+ roles with scoped views               |
| 🧩 Multi-DB Connection   | Access 3 SQL Server databases dynamically |
| 📊 Department Dashboards | Production, Quality, Dispatch, Planning   |
| 📇 Visitor Management    | QR-based passes, check-in/out, tracking   |
| 📤 Excel Upload/Export   | Daily reports and summaries               |
| 📉 Chart Visualizations  | Line, Bar, Pie charts with Chart.js       |
| 🧾 Exportable Reports    | Based on dates, users, departments        |
| 🔔 Toast Notifications   | Feedback with react-hot-toast             |
| 🌐 Fully Responsive      | Tailwind CSS design for all screen sizes  |

---

## 👨‍💻 Developer

**Varun Yadav**
<br/>
Software Developer – MES Team
<br/>
Western Refrigeration Pvt. Ltd.
<br/>
📍 India
🔗 [LinkedIn Profile](https://www.linkedin.com/in/thecyberdevvarun)

---
## 👨‍💻 Developer

**Vikash Kumar**
<br/>
Software Developer – MES Team
<br/>
Western Refrigeration Pvt. Ltd.
<br/>
📍 India
🔗 [LinkedIn Profile](https://www.linkedin.com/in/vikash-kumar-54b464336/)

---

## 📃 License

This project is proprietary and developed exclusively for internal use at
**Western Refrigeration Pvt. Ltd.**

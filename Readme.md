# ⚙️ Tool Report Dashboard – MES System

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
Tool-Report-Dashboard/
├── backend/
│   ├── routes/
│   │   ├── reportRoutes.js
│   │   └── visitorRoutes.js        # 🆕 Visitor routes
│   ├── controllers/
│   │   ├── reportController.js
│   │   └── visitorController.js    # 🆕 Visitor logic
│   ├── config/
│   │   └── db.js
│   ├── utils/
│   │   └── generateQR.js           # 🆕 QR generation
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Production.jsx
│   │   │   └── VisitorDashboard.jsx   # 🆕 Visitor UI
│   │   ├── components/
│   │   │   └── VisitorForm.jsx        # 🆕 Visitor Form
│   │   ├── redux/
│   │   └── App.jsx
│   └── public/
├── .env
├── README.md
└── package.json
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

## 📃 License

This project is proprietary and developed exclusively for internal use at
**Western Refrigeration Pvt. Ltd.**

# ⚙️ Tool Report Dashboard – MES System for Western Refrigeration Pvt. Ltd.

> **A full-stack enterprise-grade Manufacturing Execution System (MES)**  
> Developed to automate and manage production reports across multiple departments  
> Built using **MERN Stack**, **Tailwind CSS**, and **Multiple SQL Server Databases**

---

## 📌 Overview



This project is a powerful and scalable **internal web-based MES dashboard** developed for  
**Western Refrigeration Pvt. Ltd.**, Asia’s largest commercial refrigeration company.

It provides real-time, department-wise, and timeline-based reporting, used daily by multiple teams to track production, quality checks, planning, and dispatch activities.

> ✅ Designed for 20+ different user roles across multiple factory departments  
> 🧩 Connected to **three different Microsoft SQL Server databases**  
> 🖥️ Replaces legacy desktop reporting tools with a modern React-based dashboard

---

## 🖼️ Screenshots

Here are screenshots from the Tool Report Dashboard:

| ![Screenshot 1](https://github.com/user-attachments/assets/1f084f4d-cb74-41ee-8d02-3116addd459f) | ![Screenshot 2](https://github.com/user-attachments/assets/767895a2-cedf-4ce5-92f9-d6fb03e394c9) |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ![Screenshot 4](https://github.com/user-attachments/assets/ab1b8d03-ceda-40f3-9f4e-8d676a502e76) | ![Screenshot 3](https://github.com/user-attachments/assets/09f1e360-fd1d-4199-87de-9bf827a913fd) |

---

## 🧑‍💼 Key Highlights

- 🎯 **Used by multiple departments:**  
  - Production  
  - Quality  
  - Dispatch  
  - Planning  

- 🔐 **Role-Based Access Control (20+ roles):**  
  Every role sees only relevant reports, features, and filters.

- 🗂 **Connected to multiple SQL Server databases:**  
  Backend dynamically manages connections to 3 different departmental databases.

- 📅 **Advanced Time-Based Reporting:**  
  View and export reports by **day**, **month**, or **year**.

- 📈 **Visual Reporting Dashboard:**  
  KPI cards, interactive charts, and filterable tables.

- 📤 **Excel Import/Export:**  
  Upload daily reports and download clean summaries.

---

## 🧑‍💻 Tech Stack

### 🔧 Backend
- **Node.js** + **Express.js**
- **MSSQL** (Microsoft SQL Server – multi-database)
- **JWT Authentication**
- **Multer** for file uploads
- **CORS**, **cookie-parser**, **dotenv**

### 🌐 Frontend
- **React.js** (Vite-powered)
- **Redux Toolkit** + **Redux Persist**
- **Tailwind CSS** (fully responsive)
- **React Router DOM**, **React Icons**
- **Chart.js**, **react-chartjs-2**
- **ExcelJS** + **FileSaver** for Excel operations
- **react-datepicker**, **react-hot-toast**

---

## 📂 Project Structure

```

Tool-Report-Dashboard/
├── backend/             # Node.js + Express backend
│   ├── routes/          # API routes
│   ├── controllers/     # Logic & database handling
│   ├── config/          # SQL server configurations
│   └── server.js
│
├── frontend/            # React.js dashboard
│   ├── src/
│   │   ├── pages/       # Department-wise pages
│   │   ├── components/  # Charts, Forms, Tables
│   │   ├── redux/       # Role & Auth state
│   │   └── App.jsx
│   └── public/
│
├── .env
├── README.md
└── package.json

````

---

## 🔐 Authentication & Roles

- Login secured via **JWT**
- Role data is decoded and persisted via Redux
- UI and routes are restricted based on role
- Admins have elevated privileges for user management and data upload

---

## 🔗 `.env` Sample (Backend)

```env
PORT=3000
JWT_SECRET=your_secret_key

# Server 1 – Production
DB_USER1=your_user
DB_PASSWORD1=your_pass
DB_SERVER1=your_server
DB_NAME1=production_db

# Server 2 – Quality
DB_USER2=your_user
DB_PASSWORD2=your_pass
DB_SERVER2=your_server
DB_NAME2=quality_db

# Server 3 – Dispatch/Planning
DB_USER3=your_user
DB_PASSWORD3=your_pass
DB_SERVER3=your_server
DB_NAME3=dispatch_db
````

> The backend intelligently switches connections based on route or request parameters.

---

## 🚀 Getting Started

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs at: [http://localhost:5173](http://localhost:5173)

---

## 📈 Features at a Glance

| Feature                     | Description                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| 🔒 Role-Based Access        | 20+ roles with custom UI & permissions                              |
| 🧩 Multi-SQL Server Support | Fetch data across multiple connected databases                      |
| 📊 Department Dashboards    | View department-specific KPIs & reports (Production, Quality, etc.) |
| 📅 Date Filters             | Daily, Monthly, Yearly filters with export features                 |
| 📤 Excel Upload / Export    | Upload daily reports via Excel; export summaries anytime            |
| 📉 Chart Visualizations     | Pie, Line, Bar charts with Chart.js                                 |
| 🔔 Toast Notifications      | Real-time success/error feedback with react-hot-toast               |
| 🌐 Responsive Design        | Tailwind CSS ensures mobile + desktop support                       |

---

## 👨‍💻 Developer

**Varun Yadav**
Software Developer – MES Team
Western Refrigeration Pvt. Ltd.
📍 India
🔗 [LinkedIn Profile](https://www.linkedin.com/in/thecyberdevvarun)

---

## 📃 License

This project is proprietary and built for internal use at Western Refrigeration Pvt. Ltd.

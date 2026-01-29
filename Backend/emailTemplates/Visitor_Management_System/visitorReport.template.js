import ExcelJS from "exceljs";
import transporter from "../../config/email.config.js";

// -------------------- Visitor Report Email --------------------
export const sendVisitorReportMail = async (visitors) => {
  try {
    if (!Array.isArray(visitors) || visitors.length === 0) {
      console.warn("No visitor data to email.");
      return false;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Visitor Report");

    worksheet.columns = [
      { header: "Sr.", key: "sr", width: 6 },
      { header: "Name", key: "visitor_name", width: 25 },
      { header: "Contact", key: "contact_no", width: 15 },
      { header: "Email", key: "email", width: 25 },
      { header: "Company", key: "company", width: 20 },
      { header: "City", key: "city", width: 15 },
      { header: "State", key: "state", width: 15 },
      { header: "Department", key: "department_name", width: 15 },
      { header: "Employee", key: "employee_name", width: 20 },
      { header: "Purpose", key: "purpose_of_visit", width: 25 },
      { header: "Check In", key: "check_in_time", width: 22 },
      { header: "Check Out", key: "check_out_time", width: 22 },
    ];

    visitors.forEach((v, i) => {
      worksheet.addRow({
        sr: i + 1,
        visitor_name: v.visitor_name,
        contact_no: v.contact_no,
        email: v.email,
        company: v.company,
        city: v.city,
        state: v.state,
        department_name: v.department_name,
        employee_name: v.employee_name,
        purpose_of_visit: v.purpose_of_visit,
        check_in_time: v.check_in_time
          ? new Date(v.check_in_time).toLocaleString()
          : "-",
        check_out_time: v.check_out_time
          ? new Date(v.check_out_time).toLocaleString()
          : "Currently In",
      });
    });

    // Style header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    // ? Write file to buffer (no temp file needed)
    const buffer = await workbook.xlsx.writeBuffer();

    const mailOptions = {
      from: {
        name: "WRL Visitor Reports",
        address: "security.tadgam@westernequipments.com",
      },
      to: "vikash.kumar@westernequipments.com",
      subject: "Visitor Report - Excel Summary",
      text: "Please find attached the latest visitor report (Excel format) for your reference.\n\nRegards,\nWRL Security Department",
      attachments: [
        {
          filename: `visitor-report-${
            new Date().toISOString().split("T")[0]
          }.xlsx`,
          content: buffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Visitor report email with Excel sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending visitor report email:", error);
    return false;
  }
};

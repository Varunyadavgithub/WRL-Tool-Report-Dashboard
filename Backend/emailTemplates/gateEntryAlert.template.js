import transporter from "../config/email.config.js";

// -------------------- Gate Entry Alert Email --------------------
export const sendGateEntryAlertMail = async (gateEntries) => {
  try {
    if (!Array.isArray(gateEntries) || gateEntries.length === 0) {
      console.warn("No Gate Entry data to email.");
      return false;
    }

    const headers = [
      "GATE ENTRY NUMBER",
      "GATE ENTRY DATE",
      "PO NUMBER",
      "LINE ITEM",
      "PO DATE",
      "INVOICE VALUE",
      "BASIC RATE",
      "HSN CODE AS PER INVOICE",
      "GRN:103",
      "GRN:101 /105",
      "SUPPLIER CODE",
      "SUPPLIER NAME",
      "INVOICE NO.",
      "INVOICE DATE",
      "ITEM CODE",
      "DESCRIPTION OF THE GOODS",
      "UOM",
      "INVOICE QTY.",
      "RECEIVED QTY.",
      "DISCREPANCY",
      "MATERIAL GROUP",
      "VEHICLE NO.",
      "DELIVERY TYPE",
      "VEHICLE NAME",
      "VEHICLE TYPE",
      "FUEL TYPE",
      "TOTAL CARRYING CAPACITY OF THE VEHICLE",
      "REMARKS",
    ];

    const tableRows = gateEntries
      .map(
        (entry) => `
      <tr>${headers.map((h, i) => `<td>${entry[i] || ""}</td>`).join("")}</tr>
    `,
      )
      .join("");

    const html = `
      <html>
      <head>
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 5px; }
          th { background-color: #2575fc; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h2>Gate Entry Report</h2>
        <table>
          <thead><tr>${headers
            .map((h) => `<th>${h}</th>`)
            .join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p>Regards,<br/>WRL Security Team</p>
      </body>
      </html>
    `;

    const mailOptions = {
      from: { name: "WRL Inward Alert", address: process.env.SMTP_USER },
      to: "vikash.kumar@westernequipments.com", //sujith.s@westernequipments.com
      cc: [
        "rahul.bagul@westernequipments.com",
        "shubhanshu.dixit@westernequipments.com",
        "shubham.singh@westernequipments.com",
        "ashutosh.jena@westernequipments.com",
        "jenish.gandhi@westernequipments.com",
        "mayank.garg@westernequipments.com",
        "devesh.gaur@westernequipments.com",
        "vinay.yadav@westernequipments.com",
        "rushikesh.naik@westernequipments.com",
        "harshal.prajapati@westernequipments.com",
        "vaikunth.surve@westernequipments.com",
      ],
      subject: "Gate Entry Report",
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Gate Entry report email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending Gate Entry email:", error);
    return false;
  }
};

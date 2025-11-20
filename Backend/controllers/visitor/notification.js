import nodemailer from "nodemailer";

export const sendCurrentlyInsideVisitorsEmail = async (visitors) => {
  try {
    const visitorDetails = visitors
      .map(
        (v) =>
          `• ${v.visitor_name} (${v.company}) — ${v.department_name} — In at ${new Date(
            v.check_in_time
          ).toLocaleString()}`
      )
      .join("\n");

    const transporter = nodemailer.createTransport({
      host: "202.162.229.102",
      port: 587,
      secure: false,
      auth: {
        user: "security.tadgam@westernequipments.com",
        pass: "Western12@",
      },
    });

    await transporter.sendMail({
      from: '"Western Visitor System" <noreply@westernref.in>',
      to: "vikash.kumar@westernequipments.com",
      subject: "Visitors Currently Inside",
      text: `Dear Team,\n\nThe following visitors are still inside the premises:\n\n${visitorDetails}\n\nRegards,\nVisitor Management System`,
    });

    return true;
  } catch (err) {
    console.error("Email notification error:", err);
    return false;
  }
};

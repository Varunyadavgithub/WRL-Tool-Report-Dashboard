import sql from "mssql";
import { dbConfig3 } from "../config/db.js";
import { sendCalibrationMail } from "./mailer.js";
import { ESCALATION_RECIPIENTS } from "../config/escalationConfig.js";

export const runCalibrationEscalation = async () => {
  const pool = await sql.connect(dbConfig3);

  const result = await pool.request().query(`
    SELECT
      A.ID,
      A.EquipmentName,
      A.IdentificationNo,
      A.Location,
      A.NextCalibrationDate,
      A.EscalationLevel,
      A.LastEscalationSentOn,
      DATEDIFF(day, GETDATE(), A.NextCalibrationDate) AS DaysLeft,
      U.employee_email,
      U.manager_email
    FROM CalibrationAssets A
    LEFT JOIN users U
      ON U.employee_id = A.owner_employee_id
    ORDER BY A.NextCalibrationDate ASC;
  `);

  for (const a of result.recordset) {
    let level = null;

    /* ===== ESCALATION RULES ===== */
    if (a.DaysLeft <= -5) level = 3;
    else if (a.DaysLeft <= 5) level = 2;
    else if (a.DaysLeft <= 10) level = 1;
    else if (a.DaysLeft <= 15) level = 0;
    else continue;

    const previousLevel =
      a.EscalationLevel !== null ? Number(a.EscalationLevel) : null;

    /* ===== SKIP IF SAME LEVEL ===== */
    if (previousLevel === level) {
      // throttle L3 mails (48 hours)
      if (
        level === 3 &&
        a.LastEscalationSentOn &&
        new Date() - new Date(a.LastEscalationSentOn) < 48 * 60 * 60 * 1000
      ) {
        continue;
      }
      if (level !== 3) continue;
    }

    /* ===== RECIPIENTS ===== */
    const recipients = ESCALATION_RECIPIENTS(level, a);

    /* ===== SEND MAIL ===== */
    await sendCalibrationMail({
      level,
      asset: {
        EquipmentName: a.EquipmentName,
        IdentificationNo: a.IdentificationNo,
        Location: a.Location,
        NextCalibrationDate: a.NextCalibrationDate,
        DaysLeft: a.DaysLeft,
      },
      to: recipients.to,
      cc: recipients.cc,
    });

    /* ===== UPDATE ASSET STATE ===== */
    await pool
      .request()
      .input("ID", sql.Int, a.ID)
      .input("Level", sql.Int, level)
      .query(`
        UPDATE CalibrationAssets
        SET EscalationLevel = @Level,
            LastEscalationSentOn = GETDATE()
        WHERE ID = @ID
      `);

    /* ===== INSERT ESCALATION LOG (NEW TABLE) ===== */
    await pool
      .request()
      .input("AssetID", sql.Int, a.ID)
      .input("EscalationLevel", sql.Int, level)
      .input("DaysLeft", sql.Int, a.DaysLeft)
      .input("MailTo", recipients.to.join(","))
      .input("MailCC", recipients.cc.join(","))
      .query(`
        INSERT INTO CalibrationEscalationLog
        (AssetID, EscalationLevel, DaysLeft, MailTo, MailCC)
        VALUES
        (@AssetID, @EscalationLevel, @DaysLeft, @MailTo, @MailCC)
      `);
  }

  console.log("✅ Calibration escalation completed");
};

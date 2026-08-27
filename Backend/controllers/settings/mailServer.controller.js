import sql from "mssql";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import transporter, {
  SMTP_SETTING_KEYS,
  getEffectiveSmtpConfig,
  rebuildSmtpTransporter,
} from "../../config/email.config.js";

// Upsert one AppSettings row (SettingKey is the PK — no seeded row exists
// for the smtp.* keys until the first save, unlike e.g. BISApprovalFlow).
const upsertSetting = async (pool3, key, value, updatedBy) => {
  await pool3.request()
    .input("Key", sql.NVarChar(100), key)
    .input("Value", sql.NVarChar(sql.MAX), value)
    .input("UpdatedBy", sql.NVarChar(100), updatedBy)
    .query(`
      IF EXISTS (SELECT 1 FROM AppSettings WHERE SettingKey = @Key)
        UPDATE AppSettings SET Value = @Value, UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE() WHERE SettingKey = @Key
      ELSE
        INSERT INTO AppSettings (SettingKey, Value, UpdatedBy, UpdatedAt) VALUES (@Key, @Value, @UpdatedBy, GETDATE())
    `);
};

const deleteSetting = async (pool3, key) => {
  await pool3.request()
    .input("Key", sql.NVarChar(100), key)
    .query(`DELETE FROM AppSettings WHERE SettingKey = @Key`);
};

/* ═══════════════════════════════════════════════════════════════════════
   GET — effective SMTP config (DB override merged over .env), password
   never included — only whether one is set.
═══════════════════════════════════════════════════════════════════════ */
export const getMailServerConfig = tryCatch(async (req, res) => {
  const cfg = await getEffectiveSmtpConfig(global.pool3);
  res.status(200).json({
    success: true,
    config: {
      host: cfg.host || "",
      port: cfg.port || "",
      user: cfg.user || "",
      passwordSet: !!cfg.pass,
      overriddenInDb: cfg.overriddenInDb,
      updatedBy: cfg.updatedBy,
      updatedAt: cfg.updatedAt,
    },
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   PUT — save host/port/user always; password only if a non-blank value was
   submitted (blank means "leave the currently-configured password alone").
   Reloads the live transporter immediately so the change takes effect
   without a server restart.
═══════════════════════════════════════════════════════════════════════ */
export const updateMailServerConfig = tryCatch(async (req, res) => {
  const { host, port, user, pass } = req.body;
  const portNum = parseInt(port);

  if (!host?.trim() || !Number.isFinite(portNum) || !user?.trim()) {
    throw new AppError("Host, a numeric port, and username are all required.", 400);
  }

  const updatedBy = req.user?.name || req.user?.usercode || "system";
  const pool3 = global.pool3;

  await upsertSetting(pool3, SMTP_SETTING_KEYS.host, host.trim(), updatedBy);
  await upsertSetting(pool3, SMTP_SETTING_KEYS.port, String(portNum), updatedBy);
  await upsertSetting(pool3, SMTP_SETTING_KEYS.user, user.trim(), updatedBy);
  if (pass && pass.trim()) {
    await upsertSetting(pool3, SMTP_SETTING_KEYS.pass, pass.trim(), updatedBy);
  }

  const cfg = await rebuildSmtpTransporter(pool3);

  res.status(200).json({
    success: true,
    message: "Mail server settings saved and reloaded.",
    config: {
      host: cfg.host || "",
      port: cfg.port || "",
      user: cfg.user || "",
      passwordSet: !!cfg.pass,
      overriddenInDb: cfg.overriddenInDb,
    },
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   DELETE — clear the DB override, reverting to whatever's in .env.
═══════════════════════════════════════════════════════════════════════ */
export const resetMailServerConfig = tryCatch(async (req, res) => {
  const pool3 = global.pool3;
  for (const key of Object.values(SMTP_SETTING_KEYS)) {
    await deleteSetting(pool3, key);
  }
  const cfg = await rebuildSmtpTransporter(pool3);
  res.status(200).json({
    success: true,
    message: "Reverted to .env defaults.",
    config: {
      host: cfg.host || "",
      port: cfg.port || "",
      user: cfg.user || "",
      passwordSet: !!cfg.pass,
      overriddenInDb: cfg.overriddenInDb,
    },
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   POST — send a test email through the current live transporter.
═══════════════════════════════════════════════════════════════════════ */
export const testMailServerConfig = tryCatch(async (req, res) => {
  const { to } = req.body;
  if (!to?.trim()) throw new AppError("Recipient email address is required.", 400);

  const cfg = await getEffectiveSmtpConfig(global.pool3);
  try {
    await transporter.sendMail({
      from: cfg.user,
      to: to.trim(),
      subject: "WRL Dashboard — Test Email",
      html: `<p>This is a test email from the WRL Dashboard Mail Server settings page.</p><p>Sent ${new Date().toLocaleString("en-IN")} via <b>${cfg.host}:${cfg.port}</b>.</p>`,
    });
  } catch (err) {
    throw new AppError(`Failed to send test email: ${err.message}`, 502);
  }

  res.status(200).json({ success: true, message: `Test email sent to ${to.trim()}.` });
});

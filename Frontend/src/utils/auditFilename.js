// Shared filename convention for the audit PDF/Excel exports — leads with
// the serial number and model (what someone searching a downloads folder
// actually looks for), falling back to the audit code/report name for any
// audit missing that info (e.g. exported mid-draft, before a serial was entered).
const sanitize = (value) =>
  String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_");

export const buildAuditFilename = (audit, ext) => {
  const serial = sanitize(audit?.infoData?.serialNo || audit?.infoData?.serial);
  const model = sanitize(audit?.infoData?.modelName);
  const prefix = [serial, model].filter(Boolean).join("_");
  const suffix = sanitize(audit?.auditCode) || sanitize(audit?.reportName) || "audit";
  return `${prefix ? `${prefix}_` : ""}${suffix}.${ext}`;
};

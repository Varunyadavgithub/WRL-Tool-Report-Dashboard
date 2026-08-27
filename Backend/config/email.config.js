import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "dns";
dotenv.config();

// nodemailer does NOT resolve SMTP_HOST via dns.lookup() — its internal
// shared.resolveHostname() (node_modules/nodemailer/lib/shared/index.js)
// calls `new dns.Resolver().resolve4()` directly (raw c-ares queries,
// independent DNS client, ignores the OS resolver/hosts file entirely) and
// only falls back to dns.lookup if that returns zero addresses WITHOUT an
// error. A timeout is an error, so on networks where c-ares's default
// resolver can't reach its DNS servers (even though the OS resolver — what
// `dns.lookup`, plain sockets, and this app's Python precursor all use — is
// fine), nodemailer aborts immediately with `code: 'EDNS', command: 'CONN'`
// (hardcoded in smtp-connection/index.js) before ever trying dns.lookup.
//
// Fix: resolve the hostname ourselves via the OS resolver (racing a public
// DNS resolver as a safety net for the opposite failure mode — some networks
// have a broken/filtering OS resolver instead) and hand nodemailer a raw IP.
// resolveHostname() special-cases `net.isIP(host)` and skips its own
// resolution entirely when host is already an IP, so this sidesteps the
// broken code path completely rather than fighting it.
const LOOKUP_TIMEOUT_MS = 8000;

const publicResolver = new dns.Resolver();
publicResolver.setServers(["8.8.8.8", "1.1.1.1"]);

const withTimeout = (fn, label) => (hostname) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} lookup timed out for ${hostname}`)), LOOKUP_TIMEOUT_MS);
  fn(hostname, (err, addresses) => {
    clearTimeout(timer);
    if (err || !addresses?.length) return reject(err || new Error(`${label} returned no addresses`));
    resolve(addresses[0]);
  });
});

const lookupViaOs = withTimeout(
  (hostname, cb) => dns.lookup(hostname, { all: true }, (err, addresses) => cb(err, addresses?.map((a) => a.address))),
  "OS resolver",
);
const lookupViaPublicDns = withTimeout((hostname, cb) => publicResolver.resolve4(hostname, cb), "Public DNS");

const resolveReliableIp = async (hostname) => {
  try {
    return await Promise.any([lookupViaOs(hostname), lookupViaPublicDns(hostname)]);
  } catch {
    return null; // both failed — caller falls back to the raw hostname
  }
};

// ── SMTP settings: .env defaults, optionally overridden per-field from the
// AppSettings DB table (Settings > Mail Server page) ─────────────────────────
export const SMTP_SETTING_KEYS = {
  host: "smtp.host",
  port: "smtp.port",
  user: "smtp.user",
  pass: "smtp.pass",
};

const ENV_DEFAULTS = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || undefined,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
};

// Reads whichever fields have been saved to AppSettings and merges them over
// the .env defaults — a partial DB row (e.g. only a new password saved)
// still inherits host/port/user from .env. `pool3` may be undefined very
// early at process startup, before server.js has connected it; callers must
// tolerate that and fall back to .env-only in that window.
export const getEffectiveSmtpConfig = async (pool3) => {
  if (!pool3) return { ...ENV_DEFAULTS, overriddenInDb: false };
  try {
    const keys = Object.values(SMTP_SETTING_KEYS);
    const result = await pool3.request().query(
      `SELECT SettingKey, Value, UpdatedBy, UpdatedAt FROM AppSettings WHERE SettingKey IN (${keys.map((k) => `'${k}'`).join(",")})`,
    );
    const dbRow = {};
    result.recordset.forEach((r) => { dbRow[r.SettingKey] = r; });

    const host = dbRow[SMTP_SETTING_KEYS.host]?.Value || ENV_DEFAULTS.host;
    const port = dbRow[SMTP_SETTING_KEYS.port]?.Value ? parseInt(dbRow[SMTP_SETTING_KEYS.port].Value) : ENV_DEFAULTS.port;
    const user = dbRow[SMTP_SETTING_KEYS.user]?.Value || ENV_DEFAULTS.user;
    const pass = dbRow[SMTP_SETTING_KEYS.pass]?.Value || ENV_DEFAULTS.pass;
    const overriddenInDb = keys.some((k) => dbRow[k]?.Value);
    const latest = result.recordset.reduce((a, r) => (!a || r.UpdatedAt > a.UpdatedAt ? r : a), null);

    return {
      host, port, user, pass, overriddenInDb,
      updatedBy: latest?.UpdatedBy ?? null,
      updatedAt: latest?.UpdatedAt ?? null,
    };
  } catch (err) {
    console.error("[Mail] Failed to read SMTP settings from DB, falling back to .env:", err.message);
    return { ...ENV_DEFAULTS, overriddenInDb: false };
  }
};

// Builds a real nodemailer transporter from an explicit config object,
// resolving the host through the workaround above first.
const buildTransporter = async ({ host, port, user, pass }) => {
  const resolvedIp = await resolveReliableIp(host);
  console.log(
    resolvedIp
      ? `[Mail] Resolved ${host} -> ${resolvedIp}`
      : `[Mail] Could not resolve ${host} via OS or public DNS — falling back to hostname (nodemailer will attempt its own resolution).`,
  );

  const t = nodemailer.createTransport({
    host: resolvedIp || host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      // Required when connecting by IP: TLS SNI/cert hostname verification
      // still needs the real hostname, not the IP we're dialing.
      servername: host,
      rejectUnauthorized: false,
    },
  });

  t.verify((error) => {
    if (error) console.error("SMTP Connection Error:", error);
    else console.log("SMTP Server is ready to send emails");
  });

  return t;
};

// ── Live-reloadable singleton ─────────────────────────────────────────────
// `transporter` (the default export) is a stable object — every existing
// `import transporter from "./email.config.js"; transporter.sendMail(...)`
// call site (a dozen+ files under emailTemplates/) keeps working unchanged.
// Underneath, `realTransporter` can be swapped out live by
// rebuildSmtpTransporter() (called after a Settings > Mail Server save, and
// once more at server startup once the DB is up) without touching any of them.
let realTransporter = null;
let building = buildTransporter(ENV_DEFAULTS).then((t) => { realTransporter = t; });

export const rebuildSmtpTransporter = async (pool3) => {
  const cfg = await getEffectiveSmtpConfig(pool3);
  building = buildTransporter(cfg).then((t) => { realTransporter = t; });
  await building;
  return cfg;
};

const transporter = {
  sendMail: (...args) =>
    (realTransporter ? Promise.resolve() : building).then(() => realTransporter.sendMail(...args)),
};

export default transporter;

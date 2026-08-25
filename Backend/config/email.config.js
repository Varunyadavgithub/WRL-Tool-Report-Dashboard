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
const SMTP_HOST = process.env.SMTP_HOST;
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

const resolvedIp = await resolveReliableIp(SMTP_HOST);
console.log(
  resolvedIp
    ? `[Mail] Resolved ${SMTP_HOST} -> ${resolvedIp}`
    : `[Mail] Could not resolve ${SMTP_HOST} via OS or public DNS — falling back to hostname (nodemailer will attempt its own resolution).`,
);

// Create transporter
const transporter = nodemailer.createTransport({
  host: resolvedIp || SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Required when connecting by IP: TLS SNI/cert hostname verification
    // still needs the real hostname, not the IP we're dialing.
    servername: SMTP_HOST,
    rejectUnauthorized: false,
  },
});

// -------------------- Verify SMTP --------------------
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});

export default transporter;

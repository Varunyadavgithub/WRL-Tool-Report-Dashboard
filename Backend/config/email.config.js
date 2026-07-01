import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "dns";
dotenv.config();

// On some machines/networks the OS-level resolver that `net.connect`/
// `tls.connect` use internally (dns.lookup, i.e. getaddrinfo) ends up pointed
// at a local stub/filter (e.g. 127.0.0.1) that hangs or silently drops
// specific hostnames — even though `ping`/`nslookup` and Node's separate
// dns.Resolver (c-ares, used by dns.resolve*) succeed fine via real DNS
// servers. That mismatch is exactly what causes `queryA ETIMEOUT` on every
// SMTP connection attempt despite the host being reachable.
// `dns.setServers()` alone does NOT fix this — it only affects dns.resolve*,
// not the dns.lookup() path that net/tls actually use. So we override
// dns.lookup itself to resolve via a Resolver pointed at public DNS,
// falling back to the original lookup if that fails for any reason.
const publicResolver = new dns.Resolver();
publicResolver.setServers(["8.8.8.8", "1.1.1.1"]);
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === "function") { callback = options; options = {}; }
  const wantAll = options && options.all;
  publicResolver.resolve4(hostname, (err, addresses) => {
    if (err || !addresses?.length) return originalLookup(hostname, options, callback);
    if (wantAll) return callback(null, addresses.map((address) => ({ address, family: 4 })));
    callback(null, addresses[0], 4);
  });
};

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
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

/**
 * Vision Camera Traceability — Proxy Controller
 *
 * The vision camera app (Western Refrigeration Vision QIS) exposes a
 * read-only, unauthenticated API on the factory LAN (see traceability_api.md
 * at the repo root). This controller proxies it server-side so:
 *   1. The browser never needs a direct route to the camera server's IP.
 *   2. Every WRL Dashboard user goes through the same authenticated backend.
 *
 * Set VISION_API_BASE in Backend/.env to the camera server's base URL,
 * e.g. http://192.168.1.50:8000
 */
import { Readable } from "node:stream";
import { tryCatch } from "../utils/tryCatch.js";
import { AppError } from "../utils/AppError.js";

const VISION_BASE = (process.env.VISION_API_BASE || "").replace(/\/+$/, "");

const ensureConfigured = () => {
  if (!VISION_BASE || VISION_BASE.includes("<server-ip>")) {
    throw new AppError(
      "Vision API is not configured. Set VISION_API_BASE in the backend .env file.",
      503,
    );
  }
};

const visionFetch = (path, options) => {
  ensureConfigured();
  return fetch(`${VISION_BASE}${path}`, options);
};

// ── JSON passthrough ───────────────────────────────────────────────────────
const forwardJson = async (res, path, options) => {
  const upstream = await visionFetch(path, options);
  const body = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return res
      .status(upstream.status)
      .json(body ?? { message: `Vision API error (${upstream.status})` });
  }
  return res.status(upstream.status).json(body);
};

// ── Binary passthrough (PDF, ZIP, images) ──────────────────────────────────
const forwardStream = async (
  res,
  path,
  options,
  { fallbackFilename = "download", disposition = "inline" } = {},
) => {
  const upstream = await visionFetch(path, options);
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return res
      .status(upstream.status || 502)
      .json({ message: text || `Vision API error (${upstream.status})` });
  }
  const contentType = upstream.headers.get("content-type");
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentType) res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    contentDisposition || `${disposition}; filename="${fallbackFilename}"`,
  );
  Readable.fromWeb(upstream.body).pipe(res);
};

const encodeSerial = (serial) => encodeURIComponent(serial);

// ── Handlers ────────────────────────────────────────────────────────────────

/** GET /vision-report/health */
export const getHealth = tryCatch(async (req, res) => {
  await forwardJson(res, "/api/health");
});

/** GET /vision-report/report/:fgSerial — latest report for an FG serial */
export const getReportByFg = tryCatch(async (req, res) => {
  const { fgSerial } = req.params;
  if (!fgSerial) throw new AppError("FG serial is required", 400);
  await forwardJson(
    res,
    `/api/traceability/report/by-fg/${encodeSerial(fgSerial)}`,
  );
});

/** GET /vision-report/report/:fgSerial/pdf — inline PDF download */
export const getReportPdfByFg = tryCatch(async (req, res) => {
  const { fgSerial } = req.params;
  if (!fgSerial) throw new AppError("FG serial is required", 400);
  await forwardStream(
    res,
    `/api/traceability/report/by-fg/${encodeSerial(fgSerial)}/pdf`,
    undefined,
    { fallbackFilename: `${fgSerial}.pdf` },
  );
});

/** GET /vision-report/report/:fgSerial/all — full inspection history */
export const getAllReportsByFg = tryCatch(async (req, res) => {
  const { fgSerial } = req.params;
  if (!fgSerial) throw new AppError("FG serial is required", 400);
  await forwardJson(
    res,
    `/api/traceability/reports/by-fg/${encodeSerial(fgSerial)}/all`,
  );
});

/** POST /vision-report/export — batch export (JSON, paginated) */
export const exportReports = tryCatch(async (req, res) => {
  await forwardJson(res, "/api/traceability/reports/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body || {}),
  });
});

/** POST /vision-report/export/zip — batch export (ZIP of PDFs) */
export const exportReportsZip = tryCatch(async (req, res) => {
  const date = new Date().toISOString().split("T")[0];
  await forwardStream(
    res,
    "/api/traceability/reports/export/zip",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    },
    { fallbackFilename: `vision_reports_${date}.zip`, disposition: "attachment" },
  );
});

// ── Generic asset proxy ─────────────────────────────────────────────────────
// Part images (captured/annotated/reference) and per-report PDFs are returned
// as relative paths inside JSON responses (e.g. "/captures/WR.../img.jpg").
// This streams whichever asset path the client was told about, so <img> tags
// and PDF links never need to know the camera server's real address.
const ALLOWED_ASSET_PREFIXES = ["/captures/", "/uploads/", "/api/reports/"];

/** GET /vision-report/asset?path=/captures/WR.../img.jpg */
export const proxyAsset = tryCatch(async (req, res) => {
  const { path: assetPath } = req.query;
  if (
    !assetPath ||
    typeof assetPath !== "string" ||
    !assetPath.startsWith("/") ||
    assetPath.includes("..")
  ) {
    throw new AppError("A valid 'path' query parameter is required", 400);
  }
  if (!ALLOWED_ASSET_PREFIXES.some((prefix) => assetPath.startsWith(prefix))) {
    throw new AppError("Path not allowed", 400);
  }
  await forwardStream(res, assetPath, undefined, { fallbackFilename: "asset" });
});

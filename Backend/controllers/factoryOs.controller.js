/**
 * FactoryOS Proxy Controller
 *
 * Solves the browser CORS restriction by forwarding all FactoryOS API calls
 * server-side.  The backend holds the JWT token in memory — the browser
 * never needs to talk to factoryos.smartudyog.in directly.
 *
 * Token lifecycle:
 *   1. First request → POST /auth/jwt/create/  (full auth)
 *   2. On expiry    → POST /auth/jwt/refresh/  (silent refresh)
 *   3. Refresh fail → fall back to full auth again
 */

const FOS_BASE = "https://factoryos.smartudyog.in/api";

const CREDS = {
  username: process.env.FOS_USER || "western_user",
  password: process.env.FOS_PASS || "test",
};

// ── In-process token cache (lives for the lifetime of the Node process) ───────
let tokenCache = { access: null, refresh: null, expiresAt: 0 };

const fosAuthenticate = async () => {
  const res = await fetch(`${FOS_BASE}/auth/jwt/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDS),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FactoryOS auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  tokenCache = {
    access:    data.access,
    refresh:   data.refresh,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000, // 23-hour safety margin
  };
  console.log("[FactoryOS] Authenticated successfully.");
  return tokenCache.access;
};

const fosRefresh = async () => {
  if (!tokenCache.refresh) return null;
  try {
    const res = await fetch(`${FOS_BASE}/auth/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokenCache.refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    tokenCache.access    = data.access;
    tokenCache.expiresAt = Date.now() + 23 * 60 * 60 * 1000;
    console.log("[FactoryOS] Token refreshed silently.");
    return tokenCache.access;
  } catch {
    return null;
  }
};

const ensureToken = async () => {
  if (tokenCache.access && Date.now() < tokenCache.expiresAt) {
    return tokenCache.access;
  }
  const refreshed = await fosRefresh();
  if (refreshed) return refreshed;
  return fosAuthenticate();
};

// ── Generic authenticated GET to FactoryOS ────────────────────────────────────
const fosFetch = async (path, retried = false) => {
  const token = await ensureToken();
  const res = await fetch(`${FOS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && !retried) {
    // Token was rejected mid-request — force full re-auth once
    tokenCache = { access: null, refresh: null, expiresAt: 0 };
    console.warn("[FactoryOS] 401 received — re-authenticating…");
    return fosFetch(path, true);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FactoryOS ${res.status}: ${body}`);
  }
  return res.json();
};

// ── Route handlers ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/factory-os/daily-summary
 * Query params: machineId, date (YYYY-MM-DD), page (default 1), page_size
 */
export const getDailySummary = async (req, res) => {
  try {
    const { machineId, date, page = 1, page_size } = req.query;

    if (!machineId || !date) {
      return res.status(400).json({ error: "machineId and date are required" });
    }

    let path = `/monitoring/daily-summary/${machineId}/?date=${date}&page=${page}`;
    if (page_size) path += `&page_size=${page_size}`;

    const data = await fosFetch(path);
    res.json(data);
  } catch (err) {
    console.error("[FactoryOS] getDailySummary error:", err.message);
    res.status(502).json({ error: "FactoryOS proxy error", message: err.message });
  }
};

/**
 * GET /api/v1/factory-os/status
 * Returns current auth cache status (no credentials exposed).
 */
export const getStatus = (_req, res) => {
  res.json({
    authenticated: !!(tokenCache.access && Date.now() < tokenCache.expiresAt),
    expiresIn:     tokenCache.expiresAt ? Math.max(0, Math.round((tokenCache.expiresAt - Date.now()) / 1000)) : 0,
    base:          FOS_BASE,
  });
};

/**
 * POST /api/v1/factory-os/auth
 * Force re-authentication (e.g. after credential change).
 */
export const forceAuth = async (_req, res) => {
  try {
    tokenCache = { access: null, refresh: null, expiresAt: 0 };
    await fosAuthenticate();
    res.json({ success: true, message: "FactoryOS re-authenticated." });
  } catch (err) {
    res.status(502).json({ error: "Authentication failed", message: err.message });
  }
};

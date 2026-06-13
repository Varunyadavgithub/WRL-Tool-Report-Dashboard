/**
 * FactoryOS frontend client.
 * All requests are proxied through the WRL backend (/api/v1/factory-os/...)
 * to avoid browser CORS restrictions.  The backend holds the JWT server-side.
 */
import axios from "axios";

export const FACTORY_OS_BASE    = "https://factoryos.smartudyog.in/api";
export const FACTORY_MACHINE_ID = "b3b8627a-3b55-4af3-96ee-c3fc7f712ecd";
export const PART_PROCESS_API   = "/api/v1/part-process";

const PROXY_BASE = "/api/v1/factory-os";

// Rewrites "https://factoryos.smartudyog.in/api/monitoring/daily-summary/…"
// to "/api/v1/factory-os/daily-summary?machineId=…&date=…&page=…"
const toProxyUrl = (externalUrl) => {
  try {
    const u         = new URL(externalUrl);
    const match     = u.pathname.match(/daily-summary\/([^/?]+)/);
    const machineId = match?.[1] || FACTORY_MACHINE_ID;
    const date      = u.searchParams.get("date")      || "";
    const page      = u.searchParams.get("page")      || "1";
    const pageSize  = u.searchParams.get("page_size") || "";
    let proxy = `${PROXY_BASE}/daily-summary?machineId=${machineId}&date=${date}&page=${page}`;
    if (pageSize) proxy += `&page_size=${pageSize}`;
    return proxy;
  } catch {
    return externalUrl;
  }
};

const fosClient = axios.create({ withCredentials: true });

// Intercept: rewrite FactoryOS external URLs → backend proxy before the call
fosClient.interceptors.request.use((config) => {
  if (config.url?.includes("factoryos.smartudyog.in")) {
    config.url     = toProxyUrl(config.url);
    config.baseURL = "";
  }
  return config;
});

export const fosGetToken     = () => "server-managed";
export const fosAuthenticate = async () => true;
export const fosEnsureAuth   = async () => true;
export const fosClearTokens  = () => {};

export default fosClient;

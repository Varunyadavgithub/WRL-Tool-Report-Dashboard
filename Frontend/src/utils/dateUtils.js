/**
 * Get the current date and time in IST (Indian Standard Time)
 * Converts UTC to IST by adding 5 hours 30 minutes offset
 * @returns {string} Formatted IST date string — "YYYY-MM-DD HH:MM:SS"
 * @example getFormattedISTDate() → "2026-02-19 14:30:45"
 */
export const getFormattedISTDate = () => {
  const currentUTC = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(currentUTC.getTime() + istOffset);

  return istDate.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
};

/**
 * Convert a Date object to ISO string format for sending to backend API
 * Backend will handle IST conversion using convertToIST()
 * @param {Date} date - JavaScript Date object
 * @returns {string} ISO UTC string — "2026-02-19T02:30:00.000Z"
 * @example toISOForApi(new Date(2026, 1, 19, 8, 0)) → "2026-02-19T02:30:00.000Z"
 */
export const toISOForApi = (date) => {
  return date.toISOString();
};

/**
 * Convert a Date object to "YYYY-MM-DDTHH:mm" format
 * Required by HTML <input type="datetime-local" /> for value binding
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted string — "2026-02-19T08:00"
 * @example toDateTimeLocal(new Date()) → "2026-02-19T14:30"
 */
export const toDateTimeLocal = (date) => {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Format any date value for API request
 * Converts to ISO 8601 UTC string format
 * @param {string|Date} date - Date string or Date object
 * @returns {string} ISO format — "2026-02-19T08:00:00.000Z" or empty string
 * @example formatDateForApi("2026-02-19") → "2026-02-19T00:00:00.000Z"
 */
export const formatDateForApi = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString();
};

/**
 * Get today's shift date range (most recent 8:00 AM → now)
 * The production day boundary is 8 AM (Shift 1 start), so between midnight
 * and 8 AM "today" still means the production day that started at 8 AM
 * *yesterday* — that's when the overnight Shift 2 (20:00→08:00) is still
 * running. Anchoring to the current calendar date's 8 AM regardless of the
 * time of day would put the anchor in the future before 8 AM, producing an
 * inverted (start > end) range that silently returns no data — which is
 * exactly when Shift 2's post-midnight portion needs to show up.
 * Returns ISO UTC strings for API and local strings for input binding
 * Backend converts ISO to IST using convertToIST()
 * @returns {{ startDate: string, endDate: string, startLocal: string, endLocal: string }}
 * - startDate/endDate → ISO UTC strings (for API)
 * - startLocal/endLocal → "YYYY-MM-DDTHH:mm" (for datetime-local input)
 * @example getTodayRange() → { startDate: "2026-02-19T02:30:00.000Z", startLocal: "2026-02-19T08:00", ... }
 */
export const getTodayRange = () => {
  const now = new Date();
  const anchor8AM = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
  );
  if (now < anchor8AM) anchor8AM.setDate(anchor8AM.getDate() - 1);

  return {
    startDate: anchor8AM.toISOString(),
    endDate: now.toISOString(),
    startLocal: toDateTimeLocal(anchor8AM),
    endLocal: toDateTimeLocal(now),
  };
};

/**
 * Get yesterday's shift date range (yesterday 8:00 AM → today 8:00 AM)
 * Full 24hr shift cycle
 * Backend converts ISO to IST using convertToIST()
 * @returns {{ startDate: string, endDate: string, startLocal: string, endLocal: string }}
 * @example getYesterdayRange() → { startDate: "2026-02-18T02:30:00.000Z", ... }
 */
export const getYesterdayRange = () => {
  const now = new Date();
  const today8AM = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
  );
  const yesterday8AM = new Date(today8AM);
  yesterday8AM.setDate(today8AM.getDate() - 1);

  return {
    startDate: yesterday8AM.toISOString(),
    endDate: today8AM.toISOString(),
    startLocal: toDateTimeLocal(yesterday8AM),
    endLocal: toDateTimeLocal(today8AM),
  };
};

/**
 * Get Month-To-Date (MTD) shift date range
 * 1st of current month 8:00 AM → current time
 * Backend converts ISO to IST using convertToIST()
 * @returns {{ startDate: string, endDate: string, startLocal: string, endLocal: string }}
 * @example getMTDRange() → { startDate: "2026-02-01T02:30:00.000Z", ... }
 */
export const getMTDRange = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);

  return {
    startDate: startOfMonth.toISOString(),
    endDate: now.toISOString(),
    startLocal: toDateTimeLocal(startOfMonth),
    endLocal: toDateTimeLocal(now),
  };
};

/**
 * Get a rolling N-day range ending now (local midnight N-1 days ago → now)
 * Used for analytics dashboards ("Last 7 days" / "Last 30 days")
 * @param {number} n - number of days to include (inclusive of today)
 * @returns {{ startDate: string, endDate: string, startLocal: string, endLocal: string }}
 * @example getLastNDaysRange(7) → { startDate: "2026-06-09T18:30:00.000Z", endDate: "2026-06-15T...Z", ... }
 */
export const getLastNDaysRange = (n) => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (n - 1));
  start.setHours(0, 0, 0, 0);

  return {
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    startLocal: toDateTimeLocal(start),
    endLocal: toDateTimeLocal(now),
  };
};

/**
 * Convert an IST wall-clock date/time to a UTC epoch timestamp (ms).
 * Centralises the 5:30 IST offset math so callers building an absolute
 * timestamp from "selectedDate HH:MM IST" (e.g. a shift window) don't each
 * duplicate `Date.UTC(...) - 5.5 * 3600_000` inline.
 * @param {number} year
 * @param {number} month - 1-indexed (1 = January), matching a "YYYY-MM-DD".split("-") result
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @returns {number} epoch ms
 * @example istToUtcMs(2026, 7, 18, 8, 0) → epoch ms for 2026-07-18 08:00 IST
 */
export const istToUtcMs = (year, month, day, hour, minute) => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return Date.UTC(year, month - 1, day, hour, minute) - istOffsetMs;
};

/**
 * Format a date string/object for datetime-local input value binding
 * Handles timezone offset to show correct local time
 * @param {string|Date} date - Date string or Date object
 * @returns {string} "YYYY-MM-DDTHH:mm" or empty string
 * @example formatDateTimeLocal("2026-02-19T08:00:00.000Z") → "2026-02-19T13:30"
 */
export const formatDateTimeLocal = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

// Format date for display (DD/MM/YYYY)
export const formatDateForDisplay = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
};

// Format datetime for display
export const formatDateTimeForDisplay = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "-";
  }
};


/**
 * Formats an ISO date string by:
 * - Replacing "T" with a space
 * - Removing trailing "Z"
 *
 * @param {string} dateString
 * @returns {string} formatted date string
 */
export const formatISODateString = (dateString) => {
  if (!dateString) return "";

  return dateString.replace("T", " ").replace("Z", "");
};

/**
 * Format the elapsed time between two dates as "Xh Ym" (or "Ym" alone under
 * an hour) — used to show total audit duration (start → completion).
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @returns {string} e.g. "1h 24m", "38m", or "-" if either date is missing/invalid
 */
export const formatDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return "-";
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return "-";
  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

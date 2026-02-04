export const getFormattedISTDate = () => {
  const currentUTC = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in ms
  const istDate = new Date(currentUTC.getTime() + istOffset);

  return istDate.toISOString().replace("T", " ").replace("Z", "").split(".")[0]; // "YYYY-MM-DD HH:MM:SS"
};

// Format date for API
export const formatDateForApi = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString();
};

// Format date for display
export const formatDateForDisplay = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Get today's date range
export const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
};

// Get yesterday's date range
export const getYesterdayRange = () => {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
};

// Get MTD (Month to Date) range
export const getMTDRange = () => {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
};

// Format datetime input value
export const formatDateTimeLocal = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};
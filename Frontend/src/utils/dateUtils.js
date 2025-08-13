export const getFormattedISTDate = () => {
  const currentUTC = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in ms
  const istDate = new Date(currentUTC.getTime() + istOffset);

  return istDate.toISOString().replace("T", " ").replace("Z", "").split(".")[0]; // "YYYY-MM-DD HH:MM:SS"
};
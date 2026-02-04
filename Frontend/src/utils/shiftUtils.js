export const getCurrentShift = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Convert current time to minutes since midnight
  const totalMinutes = hours * 60 + minutes;

  // Shift 1: 08:00 to 20:00
  if (totalMinutes >= 480 && totalMinutes < 1200) {
    return { label: "Shift 1", value: "shift 1" };
  }

  // Shift 2: 20:01 to 07:59
  return { label: "Shift 2", value: "shift 2" };
};

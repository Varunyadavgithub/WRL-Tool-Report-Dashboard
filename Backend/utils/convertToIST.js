/* Helper function to converts a given date to Indian Standard Time (IST)
 * by manually adding the UTC offset of +5 hours 30 minutes (330 minutes).
 */
export const convertToIST = (date) => {
  return new Date(new Date(date).getTime() + 330 * 60000);
};

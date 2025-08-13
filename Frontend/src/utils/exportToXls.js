import * as XLSX from "xlsx";
import toast from "react-hot-toast";

export const exportToXls = (data, filename = "export.xlsx") => {
  // Check if there is any data to export
  if (!data || !data.length) {
    toast.error("No data to export!");
    return;
  }

  try {
    // Create a worksheet from the data
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Create a new workbook and append the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Write the workbook and trigger a download
    XLSX.writeFile(workbook, filename);
    toast.success("File downloaded successfully!");
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Export failed!");
  }
};
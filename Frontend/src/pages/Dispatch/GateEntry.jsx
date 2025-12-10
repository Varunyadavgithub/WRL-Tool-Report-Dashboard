import { useState } from "react";
import Title from "../../components/common/Title";
import axios from "axios";
import Loader from "../../components/common/Loader";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const GateEntry = () => {
  const fixedHeaders = [
    "GATE ENTRY NUMBER",
    "GATE ENTRY DATE",
    "PO NUMBER",
    "LINE ITEM",
    "PO DATE",
    "INVOICE VALUE",
    "BASIC RATE",
    "HSN CODE AS PER INVOICE",
    "GRN:103",
    "GRN:101 /105",
    "SUPPLIER CODE",
    "SUPPLIER NAME",
    "INVOICE NO.",
    "INVOICE DATE",
    "ITEM CODE",
    "DESCRIPTION OF THE GOODS",
    "UOM",
    "INVOICE QTY.",
    "RECEIVED QTY.",
    "DISCREPANCY",
    "MATERIAL GROUP",
    "VEHICLE NO.",
    "DELIVERY TYPE",
    "VEHICLE NAME",
    "VEHICLE TYPE",
    "FUEL TYPE",
    "TOTAL CARRYING CAPACITY OF THE VEHICLE",
    "REMARKS",
  ];

  const [pasteData, setPasteData] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Handle parsing pasted data and sending to backend
  const handleParseData = async () => {
    if (!pasteData) {
      toast.error("Please paste Gate Entry data first.");
      return;
    }

    setLoading(true);

    try {
      // Parse pasted data into rows
      const lines = pasteData
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");

      const parsedRows = lines.map((line) => line.split("\t"));
      setRows(parsedRows);

      // Send data to backend API
      const res = await axios.post(`${baseURL}dispatch/material-gate-entry`, {
        data: parsedRows,
      });

      if (res?.data?.success) {
        toast.success(
          res.data.message || "Gate Entry report sent successfully!"
        );
      } else {
        toast.error(res?.data?.message || "Failed to send Gate Entry report.");
      }
    } catch (error) {
      console.error("Error sending Gate Entry report:", error);
      toast.error("Failed to send Gate Entry report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPasteData("");
    setRows([]);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Gate Entry" align="center" />

      <textarea
        className="w-full p-2 border rounded mb-4"
        rows={8}
        placeholder="Paste your Excel data rows here (without headers)"
        value={pasteData}
        onChange={(e) => setPasteData(e.target.value)}
        disabled={loading}
      />

      <div className="flex gap-2 mb-4">
        <button
          className={`bg-blue-600 text-white px-4 py-2 rounded ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleParseData}
          disabled={loading}
        >
          {loading ? "Sending Email..." : "Send Email"}
        </button>
        <button
          className="bg-gray-400 text-black px-4 py-2 rounded"
          onClick={handleClear}
          disabled={loading}
        >
          Clear
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto w-full border border-gray-300 rounded">
          <table className="table-auto border-collapse w-full text-sm">
            <thead className="bg-gray-200 sticky top-0 z-10">
              <tr>
                {fixedHeaders.map((header, idx) => (
                  <th
                    key={idx}
                    className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap bg-gray-200"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {fixedHeaders.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className="border border-gray-300 px-2 py-1 whitespace-pre-wrap"
                    >
                      {row[cIdx] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-600">
          Paste your Excel data above and click <strong>"Send Email"</strong> to
          display it in a table and automatically send it to your team.
        </p>
      )}
    </div>
  );
};

export default GateEntry;

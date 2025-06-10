import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import Button from "../../components/common/Button";
import { useState } from "react";
import ExcelJS from "exceljs";
import toast from "react-hot-toast";
import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const ModelNameUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [assemblySerial, setAssemblySerial] = useState("");
  const [assemblySerialFile, setAssemblySerialFile] = useState("");
  const [fgData, setFgData] = useState([]);

  const handleAddFg = async () => {
    if (!assemblySerial.trim()) {
      toast.error("Please enter FG Serial Number");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setFgData((prev) => [
        ...prev,
        {
          assemblySerial,
        },
      ]);

      setAssemblySerial("");
    }, 500);

    setLoading(false);
  };

  const handleUpload = async () => {
    if (!assemblySerialFile) {
      toast.error("Please upload a valid Excel file.");
      return;
    }

    setLoading(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const reader = new FileReader();

      reader.onload = async (e) => {
        const buffer = e.target.result;
        await workbook.xlsx.load(buffer);

        const worksheet = workbook.worksheets[0]; // Assuming data is in the first sheet

        const newFgData = [];

        worksheet.eachRow((row, rowNumber) => {
          const assemblySerial = row.getCell(1).value?.toString().trim(); // Column A

          if (assemblySerial) {
            newFgData.push({ assemblySerial });
          }
        });

        if (newFgData.length === 0) {
          toast.error("No valid data found in the file.");
          setLoading(false);
          return;
        }

        setFgData((prev) => [...prev, ...newFgData]);
        toast.success("FG Serial Numbers uploaded successfully.");
      };

      reader.readAsArrayBuffer(assemblySerialFile);
    } catch (err) {
      console.error("Error processing Excel file:", err);
      toast.error("Failed to process the Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateModelName = async () => {
    if (fgData.length === 0) {
      toast.error("Please upload or enter FG Serial Numbers.");
      return;
    }

    setLoading(true);

    const updatedFgData = [...fgData]; // Copy for safe mutation
    let unupdatedCount = 0;

    for (let i = updatedFgData.length - 1; i >= 0; i--) {
      const fgNo = updatedFgData[i].assemblySerial;
      const modelCode = fgNo.slice(1, 5); // Similar to Substring(1,4)

      try {
        const params = {
          modelCode,
        };
        // 1. Get modelName from backend
        const res1 = await axios.get(`${baseURL}prod/get-model-name`, {
          params,
        });

        const modelName = res1.data;

        if (!modelName || modelName === "~") {
          toast.error(
            `Model fetch failed or already dispatched for FGNo: ${fgNo}`
          );
          unupdatedCount++;
          continue;
        }

        const payload = {
          fgSerial: fgNo,
          modelName: modelName,
        };
        // 2. Update DB with FG and Model Name
        const res2 = await axios.put(
          `${baseURL}prod/update-model-name`,
          payload
        );

        if (res2.data?.success && res2?.data?.data != 0) {
          // Remove updated item from array
          updatedFgData.splice(i, 1);
        } else {
          toast.error(`Failed to update FGNo: ${fgNo}, Model: ${modelName}`);
          unupdatedCount++;
        }
      } catch (err) {
        console.error(err);
        toast.error(`Error updating FGNo: ${fgNo}`);
        unupdatedCount++;
      }
    }

    setFgData(updatedFgData);

    if (unupdatedCount === 0) {
      toast.success("All records updated successfully.");
    } else {
      toast.success(`Updated with ${unupdatedCount} failed record(s).`);
    }

    setLoading(false);
  };

  const handleClearFilters = () => {
    setAssemblySerial("");
    setAssemblySerialFile("");
    setFgData([]);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Model Name Update" align="center" />
      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          <div className="flex flex-col gap-2">
            <InputField
              label="FG Serial No."
              type="text"
              placeholder="Enter FG Serial No."
              className="max-w-2xl"
              name="assemblySerial"
              value={assemblySerial}
              onChange={(e) => setAssemblySerial(e.target.value)}
            />
            <div className="flex items-center gap-4 mt-4">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-green-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={() => handleAddFg()}
                disabled={loading}
              >
                Add FG
              </Button>
              <Button
                bgColor="bg-yellow-300"
                textColor="text-black"
                className="font-semibold hover:bg-yellow-400"
                onClick={() => handleUpdateModelName()}
              >
                Update
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          <div className="flex flex-wrap gap-2">
            <InputField
              label="FG Serial No. File"
              type="file"
              className="w-52"
              name="assemblySerialFile"
              onChange={(e) => setAssemblySerialFile(e.target.files[0])}
            />

            <div className="flex items-center justify-center">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-green-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={() => handleUpload()}
                disabled={loading}
              >
                Upload FG
              </Button>
            </div>
          </div>
          <div className="mt-4 text-left font-bold text-lg">
            COUNT: <span className="text-blue-700">{fgData?.length || 0}</span>
          </div>
          <div>
            <Button
              bgColor="bg-white"
              textColor="text-black"
              className="border border-gray-400 hover:bg-gray-100 px-3 py-1"
              onClick={handleClearFilters}
            >
              Clear Filter
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex flex-col items-center mb-4">
          <span className="text-xl font-semibold">Summary</span>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Table 1 */}
            <div className="overflow-x-auto">
              <table className="min-w-full border text-left bg-white rounded-lg">
                <thead className="text-center">
                  <tr className="bg-gray-200">
                    <th className="px-1 py-1 border">Sr No.</th>
                    <th className="px-1 py-1 border">FG Serial No.</th>
                  </tr>
                </thead>
                <tbody>
                  {fgData && fgData.length > 0 ? (
                    fgData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{index + 1}</td>
                        <td className="px-1 py-1 border">
                          {item.assemblySerial}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="text-center py-4">
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelNameUpdate;

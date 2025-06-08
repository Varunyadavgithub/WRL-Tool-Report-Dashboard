import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import DateTimePicker from "../../components/common/DateTimePicker";
import { useEffect, useState } from "react";
import SelectField from "../../components/common/SelectField";
import InputField from "../../components/common/InputField";
import axios from "axios";
import toast from "react-hot-toast";
import { useMemo } from "react";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const FPAReports = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [reportType, setReportType] = useState("fpaReport");
  const [reportData, setReportData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState("");

  const fetchModelVariants = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/model-variants`);
      const formatted = res?.data.map((item) => ({
        label: item.MaterialName,
        value: item.MatCode.toString(),
      }));
      setVariants(formatted);
    } catch (error) {
      console.error("Failed to fetch model variants:", error);
      toast.error("Failed to fetch model variants.");
    }
  };

  const handleQuery = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    setLoading(true);
    try {
      let params = {
        startDate: startTime,
        endDate: endTime,
      };

      if (reportType === "fpaReport") {
        if (selectedVariant && selectedVariant.value) {
          params = {
            ...params,
            model: selectedVariant.label,
          };
        }

        const res = await axios.get(`${baseURL}quality/fpa-report`, { params });
        setReportData(res.data);
        setSelectedVariant(null);
      } else if (reportType === "dailyFpaReport") {
        const res = await axios.get(`${baseURL}quality/fpa-daily-report`, {
          params,
        });
        setReportData(res.data);
      } else if (reportType === "monthlyFpaReport") {
        const res = await axios.get(`${baseURL}quality/fpa-monthly-report`, {
          params,
        });
        setReportData(res.data);
      } else if (reportType === "yearlyFpaReport") {
        const res = await axios.get(`${baseURL}quality/fpa-yearly-report`, {
          params,
        });
        setReportData(res.data);
      } else {
        alert("Please select the Report Type.");
        return;
      }
    } catch (error) {
      console.error("Failed to fetch FPA Report:", error);
      toast.error("Failed to fetch FPA Report.");
    } finally {
      setLoading(false);
    }
  };

  const uniqueFGSRNoCount = useMemo(() => {
    return new Set(reportData.map((item) => item.FGSRNo)).size;
  }, [reportData]);

  useEffect(() => {
    fetchModelVariants();
  }, []);

  useEffect(() => {
    setReportData([]);
  }, [reportType]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setDetails(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="FPA Reports" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 max-w-4xl items-center">
          <DateTimePicker
            label="Start Time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <DateTimePicker
            label="End Time"
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          {reportType === "fpaReport" && (
            <>
              <SelectField
                label="Model Variant"
                options={variants}
                value={selectedVariant?.value || ""}
                onChange={(e) =>
                  setSelectedVariant(
                    variants.find((opt) => opt.value === e.target.value) || 0
                  )
                }
              />
              <InputField
                label="Search"
                type="text"
                placeholder="Enter details"
                className="w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md mt-6">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="flex flex-col gap-1">
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="fpaReport"
                    checked={reportType === "fpaReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  Fpa Report
                </label>
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="dailyFpaReport"
                    checked={reportType === "dailyFpaReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  Daily FPA Report
                </label>
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="monthlyFpaReport"
                    checked={reportType === "monthlyFpaReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  Monthly Fpa Report
                </label>
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="yearlyFpaReport"
                    checked={reportType === "yearlyFpaReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  Yearly FPA Report
                </label>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={handleQuery}
                  disabled={loading}
                >
                  Query
                </Button>
              </div>
              <div className="text-left font-bold text-lg">
                COUNT:{" "}
                <span className="text-blue-700">
                  {uniqueFGSRNoCount || "0"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="mt-6">
          {reportType === "fpaReport" && (
            <FpaReportTable
              data={reportData.filter((item) =>
                details
                  ? item.Model?.toLowerCase().includes(details.toLowerCase()) ||
                    item.FGSRNo?.toLowerCase().includes(
                      details.toLocaleLowerCase()
                    ) ||
                    item.AddDefect?.toLowerCase().includes(
                      details.toLowerCase()
                    )
                  : true
              )}
            />
          )}
          {reportType === "dailyFpaReport" && (
            <DailyFpaReportTable data={reportData} />
          )}
          {reportType === "monthlyFpaReport" && (
            <MonthlyFpaReportTable data={reportData} />
          )}
          {reportType === "yearlyFpaReport" && (
            <YearlyFpaReportTable data={reportData} />
          )}
        </div>
      </div>
    </div>
  );
};

const FpaReportTable = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">SRNO</th>
            <th className="px-1 py-1 border min-w-[120px]">Date</th>
            <th className="px-1 py-1 border min-w-[120px]">Model</th>
            <th className="px-1 py-1 border min-w-[120px]">Shift</th>
            <th className="px-1 py-1 border min-w-[120px]">FGSRNO</th>
            <th className="px-1 py-1 border min-w-[120px]">Country</th>
            <th className="px-1 py-1 border min-w-[120px]">Category</th>
            <th className="px-1 py-1 border min-w-[120px]">Add Defect</th>
            <th className="px-1 py-1 border min-w-[120px]">Remark</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.SRNo}</td>
                <td className="px-1 py-1 border">
                  {row.Date && row.Date.replace("T", " ").replace("Z", "")}
                </td>
                <td className="px-1 py-1 border">{row.Model}</td>
                <td className="px-1 py-1 border">{row.Shift}</td>
                <td className="px-1 py-1 border">{row.FGSRNo}</td>
                <td className="px-1 py-1 border">{row.Country}</td>
                <td className="px-1 py-1 border">{row.Category}</td>
                <td className="px-1 py-1 border">{row.AddDefect}</td>
                <td className="px-1 py-1 border">{row.Remark}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const DailyFpaReportTable = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">Date</th>
            <th className="px-1 py-1 border min-w-[120px]">Month</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Critical</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Major</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Minor</th>
            <th className="px-1 py-1 border min-w-[120px]">Sample Inspected</th>
            <th className="px-1 py-1 border min-w-[120px]">FPQI</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.Date.slice(0, 10)}</td>
                <td className="px-1 py-1 border">{row.Month}</td>
                <td className="px-1 py-1 border">{row.NoOfCritical}</td>
                <td className="px-1 py-1 border">{row.NoOfMajor}</td>
                <td className="px-1 py-1 border">{row.NoOfMinor}</td>
                <td className="px-1 py-1 border">{row.SampleInspected}</td>
                <td className="px-1 py-1 border">{row.FPQI}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const MonthlyFpaReportTable = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">Month</th>
            <th className="px-1 py-1 border min-w-[120px]">Year</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Critical</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Major</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Minor</th>
            <th className="px-1 py-1 border min-w-[120px]">Sample Inspected</th>
            <th className="px-1 py-1 border min-w-[120px]">FPQI</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.Month}</td>
                <td className="px-1 py-1 border">{row.Year}</td>
                <td className="px-1 py-1 border">{row.NoOfCritical}</td>
                <td className="px-1 py-1 border">{row.NoOfMajor}</td>
                <td className="px-1 py-1 border">{row.NoOfMinor}</td>
                <td className="px-1 py-1 border">{row.SampleInspected}</td>
                <td className="px-1 py-1 border">{row.FPQI}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const YearlyFpaReportTable = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">Year</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Critical</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Major</th>
            <th className="px-1 py-1 border min-w-[120px]">No Of Minor</th>
            <th className="px-1 py-1 border min-w-[120px]">Sample Inspected</th>
            <th className="px-1 py-1 border min-w-[120px]">FPQI</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.Year}</td>
                <td className="px-1 py-1 border">{row.NoOfCritical}</td>
                <td className="px-1 py-1 border">{row.NoOfMajor}</td>
                <td className="px-1 py-1 border">{row.NoOfMinor}</td>
                <td className="px-1 py-1 border">{row.SampleInspected}</td>
                <td className="px-1 py-1 border">{row.FPQI}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FPAReports;

import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import DateTimePicker from "../../components/common/DateTimePicker";
import { useEffect, useState } from "react";
import SelectField from "../../components/common/SelectField";
import InputField from "../../components/common/InputField";
import axios from "axios";
import toast from "react-hot-toast";
import { useMemo } from "react";
import ExportButton from "../../components/common/ExportButton";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const FPAReports = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
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

  // Quick Filters
  const handleYesterdayQuery = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);

    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1); // Go to yesterday 8 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(yesterday8AM);
    const formattedEnd = formatDate(today8AM);

    try {
      setYdayLoading(true);

      setReportData([]);
      setSelectedVariant(null);

      let params = {
        startDate: formattedStart,
        endDate: formattedEnd,
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
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday FPA Report:", error);
      toast.error("Failed to fetch Yesterday FPA Report.");
    } finally {
      setYdayLoading(false);
    }
  };

  const handleTodayQuery = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0); // Set to today 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(today8AM);
    const formattedEnd = formatDate(now); // Now = current time

    try {
      setTodayLoading(true);

      setReportData([]);
      setSelectedVariant(null);

      let params = {
        startDate: formattedStart,
        endDate: formattedEnd,
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
      } else {
        alert("Please select only FPA Report Type.");
        return;
      }
    } catch (error) {
      console.error("Failed to fetch Today FPA Report:", error);
      toast.error("Failed to fetch Today FPA Report.");
    } finally {
      setTodayLoading(false);
    }
  };

  const handleMTDQuery = async () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0
    ); // 1st day at 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(startOfMonth);
    const formattedEnd = formatDate(now);

    try {
      setMonthLoading(true);

      setReportData([]);
      setSelectedVariant(null);

      let params = {
        startDate: formattedStart,
        endDate: formattedEnd,
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
        if (selectedVariant && selectedVariant.value) {
          params = {
            ...params,
            model: selectedVariant.label,
          };
        }

        const res = await axios.get(`${baseURL}quality/fpa-daily-report`, {
          params,
        });
        setReportData(res.data);
        setSelectedVariant(null);
      } else {
        alert("Please select only FPA and Daily Report Type.");
        return;
      }
    } catch (error) {
      console.error("Failed to fetch Month FPA Report:", error);
      toast.error("Failed to fetch Month FPA Report.");
    } finally {
      setMonthLoading(false);
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
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl items-center">
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

        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
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
                  FPA Report
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
                  Monthly FPA Report
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
              <div className="flex flex-wrap gap-2">
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
                {reportData && reportData.length > 0 && (
                  <ExportButton data={reportData} filename="FPA_Report" />
                )}
              </div>
              {reportType === "fpaReport" && (
                <div className="text-left font-bold text-lg">
                  COUNT:{" "}
                  <span className="text-blue-700">
                    {uniqueFGSRNoCount || "0"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {reportType === "fpaReport" && (
          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              Quick Filters
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
                textColor={ydayLoading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  ydayLoading ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                onClick={() => handleYesterdayQuery()}
                disabled={ydayLoading}
              >
                YDAY
              </Button>
              <Button
                bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
                textColor={todayLoading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  todayLoading ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                onClick={() => handleTodayQuery()}
                disabled={todayLoading}
              >
                TDAY
              </Button>
              <Button
                bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
                textColor={monthLoading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  monthLoading ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                onClick={() => handleMTDQuery()}
                disabled={monthLoading}
              >
                MTD
              </Button>
            </div>
          </div>
        )}
        {reportType === "dailyFpaReport" && (
          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              Quick Filters
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
                textColor={monthLoading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  monthLoading ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                onClick={() => handleMTDQuery()}
                disabled={monthLoading}
              >
                MTD
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
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
                <td className="px-1 py-1 border">
                  {row.ShiftDate.slice(0, 10)}
                </td>
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
                <td className="px-1 py-1 border">{row.MonthKey}</td>
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

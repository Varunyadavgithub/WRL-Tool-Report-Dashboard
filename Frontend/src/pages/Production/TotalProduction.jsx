import { useState, useEffect, useRef, useCallback } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import SelectField from "../../components/common/SelectField";
import DateTimePicker from "../../components/common/DateTimePicker";
import ExportButton from "../../components/common/ExportButton";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/common/Loader";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const TotalProduction = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [totalProductionData, setTotalProductionData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const departmentOption = [
    { label: "Final", value: "final" },
    { label: "Post Foaming", value: "postFoaming" },
  ];
  const [selecedDep, setSelectedDep] = useState(departmentOption[0]);

  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const fetchModelVariants = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/model-variants`);
      const formatted = res?.data.map((item) => ({
        label: item.MaterialName,
        value: item.MatCode.toString(),
      }));
      setVariants(formatted);
    } catch (error) {
      console.error("Failed to fetch variants:", error);
    }
  };

  useEffect(() => {
    fetchModelVariants();
  }, []);

  const fetchTotalProductionData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }

    try {
      setLoading(true);
      const params = {
        startDate: startTime,
        endDate: endTime,
        page: pageNumber,
        limit,
        department: selecedDep.value,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };

      const res = await axios.get(`${baseURL}prod/barcode-details`, { params });

      if (res?.data?.success) {
        setTotalProductionData((prev) => {
          const existing = new Set(prev.map((d) => d.FG_SR));
          const uniqueNew = res.data.data.filter(
            (item) => !existing.has(item.FG_SR)
          );
          return [...prev, ...uniqueNew];
        });

        if (pageNumber === 1) {
          setTotalCount(res?.data?.totalCount);
        }

        setHasMore(res?.data?.data.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch total production data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (page === 1) return;
    fetchTotalProductionData(page);
  }, [page]);

  const handleQuery = () => {
    setPage(1);
    setTotalProductionData([]);
    setHasMore(false);
    fetchTotalProductionData(1);
  };

  const fetchExportData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      const params = {
        startDate: startTime,
        endDate: endTime,
        department: selecedDep.value,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };
      const res = await axios.get(`${baseURL}prod/export-total-production`, {
        params,
      });
      return res?.data?.success ? res?.data?.data : [];
    } catch (error) {
      console.error("Failed to fetch export total production data:", error);
      return [];
    }
  };

  const getCategoryCounts = (data) => {
    const counts = {};
    data.forEach((item) => {
      const category = item.category || "Unknown";
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  };

  const getModelNameCount = (data) => {
    const counts = {};
    data.forEach((item) => {
      const modelName = item.Model_Name || "Unknown";
      counts[modelName] = (counts[modelName] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Total Production" align="center" />

      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="flex flex-wrap gap-4">
          <SelectField
            label="Model Variant"
            options={variants}
            value={selectedVariant?.value || ""}
            onChange={(e) =>
              setSelectedVariant(
                variants.find((opt) => opt.value === e.target.value) || null
              )
            }
            className="max-w-64"
          />
          <SelectField
            label="Department"
            options={departmentOption}
            value={selecedDep?.value || ""}
            onChange={(e) =>
              setSelectedDep(
                departmentOption.find((opt) => opt.value === e.target.value) ||
                  null
              )
            }
            className="max-w-64"
          />
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <DateTimePicker
            label="Start Time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="max-w-64"
          />
          <DateTimePicker
            label="End Time"
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="max-w-64"
          />
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button
            onClick={handleQuery}
            bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
            textColor={loading ? "text-white" : "text-black"}
            className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
            disabled={loading}
          >
            Query
          </Button>
          {totalProductionData.length > 0 && (
            <ExportButton
              fetchData={fetchExportData}
              filename="Total_Production_Report"
            />
          )}
          <div className="ml-4 font-bold text-lg">
            COUNT: <span className="text-blue-700">{totalCount}</span>
          </div>
        </div>
      </div>

      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="max-h-[600px] overflow-x-auto w-full">
              <table className="w-full border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Model_Name
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      FG Serial_No.
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Asset tag
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {totalProductionData.map((item, index) => {
                    const isLast = index === totalProductionData.length - 1;
                    return (
                      <tr
                        key={index}
                        ref={isLast ? lastRowRef : null}
                        className="hover:bg-gray-100 text-center"
                      >
                        <td className="px-1 py-1 border">{item.Model_Name}</td>
                        <td className="px-1 py-1 border">{item.FG_SR}</td>
                        <td className="px-1 py-1 border">{item.Asset_tag}</td>
                      </tr>
                    );
                  })}
                  {!loading && totalProductionData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-4">
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {loading && (
                <div className="text-center my-4 text-sm text-gray-500">
                  <Loader />
                </div>
              )}
            </div>

            <div className="max-h-[500px] overflow-x-auto w-full">
              <table className="w-full border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[80px]">
                      Model_Name
                    </th>
                    <th className="px-1 py-1 border min-w-[80px]">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(getModelNameCount(totalProductionData)).map(
                    ([modelName, count], index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{modelName}</td>
                        <td className="px-1 py-1 border">{count}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="max-h-[500px] overflow-x-auto w-full">
              <table className="w-full border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[80px]">Category</th>
                    <th className="px-1 py-1 border min-w-[80px]">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(getCategoryCounts(totalProductionData)).map(
                    ([category, count], index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{category}</td>
                        <td className="px-1 py-1 border">{count}</td>
                      </tr>
                    )
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

export default TotalProduction;

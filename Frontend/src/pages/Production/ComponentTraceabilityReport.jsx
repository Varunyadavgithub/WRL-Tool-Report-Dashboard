import { useState, useEffect, useRef, useCallback } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import SelectField from "../../components/common/SelectField";
import DateTimePicker from "../../components/common/DateTimePicker";
import axios from "axios";
import Loader from "../../components/common/Loader";
import ExportButton from "../../components/common/ExportButton";
import toast from "react-hot-toast";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const ComponentTraceabilityReport = () => {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [traceabilityData, setTraceabilityData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

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
      console.error("Failed to fetch model variants:", error);
      toast.error("Failed to fetch model variants.");
    }
  };

  const fetchTraceabilityData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      setLoading(true);

      const params = {
        startTime,
        endTime,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
        page: pageNumber,
        limit,
      };

      const res = await axios.get(`${baseURL}prod/component-traceability`, {
        params,
      });

      if (res?.data?.success) {
        setTraceabilityData((prev) => [...prev, ...res?.data?.data]);
        // Set total count only when it's the first page
        if (pageNumber === 1) {
          setTotalCount(res?.data?.totalCount);
        }
        setHasMore(res?.data?.data.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch component traceability data:", error);
      toast.error("Failed to fetch component traceability data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchExportData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      const params = {
        startTime,
        endTime,
        model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
      };

      const res = await axios.get(
        `${baseURL}prod/export-component-traceability`,
        {
          params,
        }
      );
      if (res?.data?.success) {
        return res?.data?.result;
      }
      return [];
    } catch (error) {
      console.error(
        "Failed to fetch export component traceability data:",
        error
      );
      toast.error("Failed to fetch export component traceability data.");
      return [];
    }
  };

  useEffect(() => {
    fetchModelVariants();
  }, []);

  useEffect(() => {
    if (page === 1) return;
    fetchTraceabilityData(page);
  }, [page]);

  const handleTraceabilityData = () => {
    setTraceabilityData([]);
    setPage(1);
    fetchTraceabilityData(1);
  };
  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Component Traceability Report" align="center" />

      {/* Filters Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        {/* First Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>

        {/* Second Row */}
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

        {/* Third Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex flex-wrap items-end gap-2 mt-4 w-full">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={handleTraceabilityData}
              disabled={loading}
            >
              Query
            </Button>

            {traceabilityData && traceabilityData.length > 0 && (
              <ExportButton
                fetchData={fetchExportData}
                filename="Component_Traceability_Report"
              />
            )}

            {/* Count */}
            <div className="mt-4 text-left font-bold text-lg">
              COUNT: <span className="text-blue-700">{totalCount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="w-full bg-white border border-gray-300 rounded-md p-4">
          <div className="w-full max-h-[600px] overflow-x-auto">
            <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
              <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                <tr>
                  <th className="px-1 py-1 border min-w-[120px]">PS_No.</th>
                  <th className="px-1 py-1 border min-w-[120px]">Model_Name</th>
                  <th className="px-1 py-1 border min-w-[120px]">
                    Reference Barcode
                  </th>
                  <th className="px-1 py-1 border min-w-[120px]">
                    Component Serial No.
                  </th>
                  <th className="px-1 py-1 border min-w-[120px]">
                    Component Name
                  </th>
                  <th className="px-1 py-1 border min-w-[120px]">
                    Component Type
                  </th>
                  <th className="px-1 py-1 border min-w-[120px]">
                    Supplier_Name
                  </th>
                  <th className="px-1 py-1 border min-w-[120px]">Scanned On</th>
                  <th className="px-1 py-1 border min-w-[120px]">Fg Sr. No.</th>
                  <th className="px-1 py-1 border min-w-[120px]">Asset tag</th>
                  <th className="px-1 py-1 border min-w-[120px]">
                    SAP Item Code
                  </th>
                </tr>
              </thead>
              <tbody>
                {traceabilityData.map((item, index) => {
                  const isLast = index === traceabilityData.length - 1;
                  return (
                    <tr
                      key={index}
                      ref={isLast ? lastRowRef : null}
                      className="hover:bg-gray-100 text-center"
                    >
                      <td className="px-1 py-1 border">{item.PSNo}</td>
                      <td className="px-1 py-1 border">{item.Model_Name}</td>
                      <td className="px-1 py-1 border">
                        {item.Reference_Barcode}
                      </td>
                      <td className="px-1 py-1 border">
                        {item.Component_Serial_Number}
                      </td>
                      <td className="px-1 py-1 border">
                        {item.Component_Name}
                      </td>
                      <td className="px-1 py-1 border">
                        {item.Component_Type}
                      </td>
                      <td className="px-1 py-1 border">{item.Supplier_Name}</td>
                      <td className="px-1 py-1 border">
                        {item.ScannedOn &&
                          item.ScannedOn.replace("T", " ").replace("Z", "")}
                      </td>
                      <td className="px-1 py-1 border">{item.Fg_Sr_No}</td>
                      <td className="px-1 py-1 border">{item.Asset_tag}</td>
                      <td className="px-1 py-1 border">{item.SAP_Item_Code}</td>
                    </tr>
                  );
                })}
                {!loading && traceabilityData.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center py-4">
                      No data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {loading && <Loader />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComponentTraceabilityReport;

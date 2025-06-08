import { useCallback, useEffect, useRef, useState } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import SelectField from "../../components/common/SelectField";
import axios from "axios";
import DateTimePicker from "../../components/common/DateTimePicker";
import Loader from "../../components/common/Loader";
import ExportButton from "../../components/common/ExportButton";
import toast from "react-hot-toast";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const Overview = () => {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [productionData, setProductionData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
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

  const fetchStages = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/stage-names`);
      const formatted = res?.data.map((item) => ({
        label: item.Name,
        value: item.StationCode.toString(),
      }));
      setStages(formatted);
    } catch (error) {
      console.error("Failed to fetch stages name:", error);
      toast.error("Failed to fetch stages name.");
    }
  };

  const fetchProductionData = async (pageNumber = 1) => {
    if (startTime && endTime && (selectedVariant || selectedStage)) {
      try {
        setLoading(true);

        const params = {
          startTime,
          endTime,
          stationCode: selectedStage?.value || null,
          page: pageNumber,
          limit,
          model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
        };

        const res = await axios.get(`${baseURL}prod/fgdata`, { params });

        if (res?.data?.success) {
          setProductionData((prev) => [...prev, ...res?.data?.data]);
          // Set total count only when it's the first page
          if (pageNumber === 1) {
            setTotalCount(res?.data?.totalCount);
          }
          setHasMore(res?.data?.data.length > 0);
        }
      } catch (error) {
        console.error("Failed to fetch production data:", error);
        toast.error("Failed to fetch production data.");
      } finally {
        setLoading(false);
      }
    } else {
      toast.error("Please select Stage and Time Range.");
    }
  };

  const fetchExportData = async () => {
    if (startTime && endTime && (selectedVariant || selectedStage)) {
      try {
        const params = {
          startTime,
          endTime,
          stationCode: selectedStage?.value || null,
          model: selectedVariant ? parseInt(selectedVariant.value, 10) : 0,
        };

        const res = await axios.get(`${baseURL}prod/export-production-report`, {
          params,
        });

        if (res?.data?.success) {
          return res?.data?.data;
        }
        return [];
      } catch (error) {
        console.error("Failed to fetch export production data:", error);
        toast.error("Failed to fetch export production data.");
        return [];
      }
    } else {
      toast.error("Please select Stage and Time Range.");
    }
  };

  useEffect(() => {
    fetchModelVariants();
    fetchStages();
  }, []);

  useEffect(() => {
    if (page === 1) return;
    fetchProductionData(page);
  }, [page]);

  const handleFgData = () => {
    setProductionData([]);
    setPage(1);
    fetchProductionData(1);
  };

  const handleClearFilters = () => {
    setSelectedVariant(null);
    setSelectedStage(null);
    setStartTime("");
    setEndTime("");
    setProductionData([]);
    setPage(1);
    setTotalCount(0);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Production Overview" align="center" />

      {/* Filters Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="flex flex-wrap gap-2">
          <SelectField
            label="Model Variant"
            options={variants}
            value={selectedVariant?.value || ""}
            onChange={(e) =>
              setSelectedVariant(
                variants.find((opt) => opt.value === e.target.value) || 0
              )
            }
            className="max-w-64"
          />

          <SelectField
            label="Stage Name"
            options={stages}
            value={selectedStage?.value || ""}
            onChange={(e) =>
              setSelectedStage(
                stages.find((opt) => opt.value === e.target.value) || 0
              )
            }
            className="max-w-64"
          />
        </div>

        <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
            textColor={loading ? "text-white" : "text-black"}
            className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
            onClick={handleFgData}
            disabled={loading}
          >
            Query
          </Button>
          {productionData && productionData.length > 0 && (
            <ExportButton
              fetchData={fetchExportData}
              filename="Production_Report"
            />
          )}
        </div>

        <div className="mt-4 text-left font-bold text-lg">
          COUNT: <span className="text-blue-700">{totalCount || 0}</span>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="flex flex-col items-center mb-4">
          <span className="text-xl font-semibold">Summary</span>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-wrap gap-1">
            {/* Right Side - Detailed Table */}
            <div className="w-full md:flex-1">
              <div className="w-full max-h-[600px] overflow-x-auto">
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border max-w-[100px]">Sr.No.</th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Model_Name
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Model_No.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Station_Code
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Assembly Sr.No
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Asset tag
                      </th>
                      <th className="px-1 py-1 border max-w-[100px]">
                        Customer_QR
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        UserName
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        FG Serial_No.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        CreatedOn
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionData.map((item, index) => {
                      const isLast = index === productionData.length - 1;
                      return (
                        <tr
                          key={index}
                          ref={isLast ? lastRowRef : null}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{item.SrNo}</td>
                          <td className="px-1 py-1 border">
                            {item.Model_Name}
                          </td>
                          <td className="px-1 py-1 border">{item.ModelName}</td>
                          <td className="px-1 py-1 border">
                            {item.StationCode}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.Assembly_Sr_No}
                          </td>
                          <td className="px-1 py-1 border">{item.Asset_tag}</td>
                          <td className="px-1 py-1 border">
                            {item.Customer_QR}
                          </td>
                          <td className="px-1 py-1 border">{item.UserName}</td>
                          <td className="px-1 py-1 border">{item.FG_SR}</td>
                          <td className="px-1 py-1 border">
                            {item.CreatedOn?.replace("T", " ").replace("Z", "")}
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && productionData.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-4">
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {loading && <Loader />}
              </div>
            </div>

            {/* Left Side - Controls and Summary */}
            <div className="w-full md:w-[30%] flex flex-col gap-2 overflow-x-hidden">
              <div className="flex flex-wrap gap-2 items-center justify-center my-4">
                <Button
                  bgColor="bg-white"
                  textColor="text-black"
                  className="border border-gray-400 hover:bg-gray-100 px-3 py-1"
                  onClick={handleClearFilters}
                >
                  Clear Filter
                </Button>
                <ExportButton />
              </div>

              <div className="w-full max-h-[500px] overflow-x-auto">
                {loading ? (
                  <Loader />
                ) : (
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                      <tr>
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          Model_Name
                        </th>
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          StartSerial
                        </th>
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          EndSerial
                        </th>
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionData.length > 0 ? (
                        productionData.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-100 text-center"
                          >
                            <td className="px-1 py-1 border">
                              {item.Model_Name}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.StartSerial}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.EndSerial}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.TotalCount}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-4">
                            No data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;

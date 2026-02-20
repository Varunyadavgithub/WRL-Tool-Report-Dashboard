import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useLazyGetFpaByModelQuery } from "../redux/api/fpaReportApi";
import { closeModelModal, openDefectModal } from "../redux/fpaReportSlice";
import Loader from "./ui/Loader";
import { HiOutlineClipboardList } from "react-icons/hi";
import { IoCloseOutline } from "react-icons/io5";
import { FaArrowRight } from "react-icons/fa";

const FpaModelDetailModal = ({ modelName, startDate, endDate }) => {
  const dispatch = useDispatch();

  const [triggerFetch, { data: modelData, isLoading, isFetching }] =
    useLazyGetFpaByModelQuery();

  useEffect(() => {
    if (modelName && startDate && endDate) {
      triggerFetch({ model: modelName, startDate, endDate });
    }
  }, [modelName, startDate, endDate, triggerFetch]);

  const handleClose = () => dispatch(closeModelModal());
  const handleFGSRClick = (fgsrNo) => dispatch(openDefectModal(fgsrNo));

  const records = modelData?.data || [];
  const loading = isLoading || isFetching;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Model Details</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-[400px]">
              {modelName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-1 transition-colors cursor-pointer"
          >
            <IoCloseOutline size={22} />
          </button>
        </div>

        {/* Summary */}
        {!loading && records.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">FG Inspected: </span>
              <span className="font-semibold text-gray-800">
                {records.length}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Critical: </span>
              <span className="font-semibold text-red-600">
                {records.reduce((s, r) => s + (r.Critical || 0), 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Major: </span>
              <span className="font-semibold text-orange-600">
                {records.reduce((s, r) => s + (r.Major || 0), 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Minor: </span>
              <span className="font-semibold text-yellow-600">
                {records.reduce((s, r) => s + (r.Minor || 0), 0)}
              </span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="p-8">
              <Loader />
            </div>
          )}

          {!loading && records.length === 0 && (
            <div className="p-12 text-center">
              <HiOutlineClipboardList className="text-gray-300 text-5xl mx-auto mb-3" />
              <p className="text-gray-500">
                No inspection records found for this model.
              </p>
            </div>
          )}

          {!loading && records.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">SR</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Shift</th>
                  <th className="px-4 py-3 text-left">FGSRNo</th>
                  <th className="px-4 py-3 text-left">Country</th>
                  <th className="px-4 py-3 text-center">Critical</th>
                  <th className="px-4 py-3 text-center">Major</th>
                  <th className="px-4 py-3 text-center">Minor</th>
                  <th className="px-4 py-3 text-center">FPQI</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((item, index) => {
                  const fpqi =
                    item.FPQI !== null ? parseFloat(item.FPQI) : null;

                  return (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500">{item.SRNO}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(item.Date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{item.Shift}</td>
                      <td className="px-4 py-3 font-mono text-blue-600 font-medium">
                        {item.FGSRNo}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {item.Country}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            item.Critical > 0 ? "text-red-600" : "text-gray-400"
                          }`}
                        >
                          {item.Critical}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            item.Major > 0 ? "text-orange-600" : "text-gray-400"
                          }`}
                        >
                          {item.Major}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            item.Minor > 0 ? "text-yellow-600" : "text-gray-400"
                          }`}
                        >
                          {item.Minor}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fpqi !== null ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              fpqi > 5
                                ? "bg-red-50 text-red-700"
                                : fpqi > 2
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-green-50 text-green-700"
                            }`}
                          >
                            {fpqi.toFixed(3)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleFGSRClick(item.FGSRNo)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Details <FaArrowRight size={10} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default FpaModelDetailModal;

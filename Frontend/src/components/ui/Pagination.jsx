import {
  FaChevronLeft,
  FaChevronRight,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
} from "react-icons/fa";

const Pagination = ({
  currentPage,
  totalPages,
  totalRecords,
  limit,
  onPageChange,
  onLimitChange,
  isLoading = false,
}) => {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      }

      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endRecord = Math.min(currentPage * limit, totalRecords);

  const limitOptions = [10, 25, 50, 100, 200, 500, 1000];

  if (totalRecords === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
      {/* Records Info & Limit Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-gray-600">
          Showing{" "}
          <span className="font-bold text-purple-700">{startRecord}</span> to{" "}
          <span className="font-bold text-purple-700">{endRecord}</span> of{" "}
          <span className="font-bold text-purple-700">{totalRecords}</span>{" "}
          records
        </span>

        {/* Limit Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Show:</label>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="px-3 py-1.5 border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
            disabled={isLoading}
          >
            {limitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-600">per page</span>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* First Page Button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || isLoading}
          className={`p-2 rounded-lg transition-all ${
            currentPage === 1 || isLoading
              ? "text-gray-400 cursor-not-allowed bg-gray-100"
              : "text-purple-600 hover:bg-purple-100 hover:text-purple-700 bg-white border border-purple-200"
          }`}
          title="First Page"
        >
          <FaAngleDoubleLeft size={16} />
        </button>

        {/* Previous Page Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className={`p-2 rounded-lg transition-all ${
            currentPage === 1 || isLoading
              ? "text-gray-400 cursor-not-allowed bg-gray-100"
              : "text-purple-600 hover:bg-purple-100 hover:text-purple-700 bg-white border border-purple-200"
          }`}
          title="Previous Page"
        >
          <FaChevronLeft size={14} />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map((page, index) =>
            page === "..." ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-gray-400 font-bold"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                disabled={isLoading}
                className={`min-w-[40px] h-10 px-3 rounded-lg font-semibold transition-all ${
                  currentPage === page
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                    : "text-purple-600 hover:bg-purple-100 bg-white border border-purple-200"
                } ${isLoading ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {page}
              </button>
            ),
          )}
        </div>

        {/* Next Page Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className={`p-2 rounded-lg transition-all ${
            currentPage === totalPages || isLoading
              ? "text-gray-400 cursor-not-allowed bg-gray-100"
              : "text-purple-600 hover:bg-purple-100 hover:text-purple-700 bg-white border border-purple-200"
          }`}
          title="Next Page"
        >
          <FaChevronRight size={14} />
        </button>

        {/* Last Page Button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || isLoading}
          className={`p-2 rounded-lg transition-all ${
            currentPage === totalPages || isLoading
              ? "text-gray-400 cursor-not-allowed bg-gray-100"
              : "text-purple-600 hover:bg-purple-100 hover:text-purple-700 bg-white border border-purple-200"
          }`}
          title="Last Page"
        >
          <FaAngleDoubleRight size={16} />
        </button>
      </div>

      {/* Go to Page Input */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Go to:</label>
        <input
          type="number"
          min={1}
          max={totalPages}
          placeholder={String(currentPage)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const page = Number(e.target.value);
              if (page >= 1 && page <= totalPages) {
                onPageChange(page);
                e.target.value = "";
              }
            }
          }}
          className="w-16 px-2 py-1.5 border border-purple-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          disabled={isLoading}
        />
        <span className="text-sm text-gray-600">of {totalPages}</span>
      </div>
    </div>
  );
};

export default Pagination;

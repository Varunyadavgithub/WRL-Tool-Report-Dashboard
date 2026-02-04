import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";
import {
  setFilters,
  resetFilters,
  setSelectedRecord,
  closeDetailModal,
  setActiveQuickFilter,
  setDateRange,
  setPagination,
} from "../redux/estReportSlice";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
} from "../utils/dateUtils";

export const useEstReport = () => {
  const dispatch = useDispatch();
  const estReportState = useSelector((state) => state.estReport);

  const updateFilters = useCallback(
    (newFilters) => {
      dispatch(setFilters(newFilters));
    },
    [dispatch],
  );

  const clearFilters = useCallback(() => {
    dispatch(resetFilters());
  }, [dispatch]);

  const selectRecord = useCallback(
    (record) => {
      dispatch(setSelectedRecord(record));
    },
    [dispatch],
  );

  const closeModal = useCallback(() => {
    dispatch(closeDetailModal());
  }, [dispatch]);

  const applyQuickFilter = useCallback(
    (filterType) => {
      let dateRange;
      switch (filterType) {
        case "today":
          dateRange = getTodayRange();
          break;
        case "yesterday":
          dateRange = getYesterdayRange();
          break;
        case "mtd":
          dateRange = getMTDRange();
          break;
        default:
          return;
      }
      dispatch(setDateRange(dateRange));
      dispatch(setActiveQuickFilter(filterType));
    },
    [dispatch],
  );

  const updateDateRange = useCallback(
    (startDate, endDate) => {
      dispatch(setDateRange({ startDate, endDate }));
      dispatch(setActiveQuickFilter(null));
    },
    [dispatch],
  );

  const updatePagination = useCallback(
    (page, limit) => {
      dispatch(setPagination({ page, limit }));
    },
    [dispatch],
  );

  return {
    ...estReportState,
    updateFilters,
    clearFilters,
    selectRecord,
    closeModal,
    applyQuickFilter,
    updateDateRange,
    updatePagination,
  };
};

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Filter states
  filters: {
    startDate: "",
    endDate: "",
    model: "",
    operator: "",
    result: "",
    testType: "all",
  },
  // Selected record for detail view
  selectedRecord: null,
  // UI states
  isDetailModalOpen: false,
  activeTab: "overview",
  // Pagination - ADD THIS
  pagination: {
    page: 1,
    limit: 100,
    totalPages: 1,
    totalRecords: 0,
  },
  // Quick filter active state
  activeQuickFilter: null,
};

const estReportSlice = createSlice({
  name: "estReport",
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.activeQuickFilter = null;
      // Reset to first page when filters change
      state.pagination.page = 1;
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
      state.activeQuickFilter = null;
      state.pagination.page = 1;
    },
    setSelectedRecord: (state, action) => {
      state.selectedRecord = action.payload;
      state.isDetailModalOpen = !!action.payload;
    },
    closeDetailModal: (state) => {
      state.isDetailModalOpen = false;
      state.selectedRecord = null;
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    // ADD THESE NEW ACTIONS
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
    },
    setLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1; // Reset to first page when limit changes
    },
    setActiveQuickFilter: (state, action) => {
      state.activeQuickFilter = action.payload;
    },
    setDateRange: (state, action) => {
      state.filters.startDate = action.payload.startDate;
      state.filters.endDate = action.payload.endDate;
      // Reset to first page when date range changes
      state.pagination.page = 1;
    },
  },
});

export const {
  setFilters,
  resetFilters,
  setSelectedRecord,
  closeDetailModal,
  setActiveTab,
  setPagination,
  setPage,
  setLimit,
  setActiveQuickFilter,
  setDateRange,
} = estReportSlice.actions;

export default estReportSlice.reducer;

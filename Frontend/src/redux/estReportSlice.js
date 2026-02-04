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
  activeTab: "overview", // overview, details, trends, failures
  // Pagination
  pagination: {
    page: 1,
    limit: 100,
  },
  // Quick filter active state
  activeQuickFilter: null, // 'today', 'yesterday', 'mtd', or null
};

const estReportSlice = createSlice({
  name: "estReport",
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.activeQuickFilter = null; // Reset quick filter when custom filters are set
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
      state.activeQuickFilter = null;
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
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setActiveQuickFilter: (state, action) => {
      state.activeQuickFilter = action.payload;
    },
    setDateRange: (state, action) => {
      state.filters.startDate = action.payload.startDate;
      state.filters.endDate = action.payload.endDate;
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
  setActiveQuickFilter,
  setDateRange,
} = estReportSlice.actions;

export default estReportSlice.reducer;

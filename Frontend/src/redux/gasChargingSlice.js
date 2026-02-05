import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  filters: {
    startDate: "",
    endDate: "",
    model: "",
    performance: "",
    refrigerant: "",
    machine: "",
  },
  pagination: {
    page: 1,
    limit: 50,
    totalPages: 1,
    totalRecords: 0,
  },
  selectedRecord: null,
  isDetailModalOpen: false,
  activeQuickFilter: null,
};

const gasChargingSlice = createSlice({
  name: "gasCharging",
  initialState,
  reducers: {
    setGasChargingFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1;
    },
    resetGasChargingFilters: (state) => {
      state.filters = initialState.filters;
      state.pagination = initialState.pagination;
      state.activeQuickFilter = null;
    },
    setGasChargingDateRange: (state, action) => {
      state.filters.startDate = action.payload.startDate;
      state.filters.endDate = action.payload.endDate;
      state.pagination.page = 1;
    },
    setGasChargingPage: (state, action) => {
      state.pagination.page = action.payload;
    },
    setGasChargingLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
    },
    setGasChargingPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setGasChargingSelectedRecord: (state, action) => {
      state.selectedRecord = action.payload;
      state.isDetailModalOpen = !!action.payload;
    },
    closeGasChargingModal: (state) => {
      state.selectedRecord = null;
      state.isDetailModalOpen = false;
    },
    setGasChargingQuickFilter: (state, action) => {
      state.activeQuickFilter = action.payload;
    },
  },
});

export const {
  setGasChargingFilters,
  resetGasChargingFilters,
  setGasChargingDateRange,
  setGasChargingPage,
  setGasChargingLimit,
  setGasChargingPagination,
  setGasChargingSelectedRecord,
  closeGasChargingModal,
  setGasChargingQuickFilter,
} = gasChargingSlice.actions;

export default gasChargingSlice.reducer;

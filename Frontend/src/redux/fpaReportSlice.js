import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  filters: {
    startDate: "",
    endDate: "",
  },
  activeQuickFilter: null,

  // Model Detail Modal (Query 2)
  isModelModalOpen: false,
  selectedModel: null,

  // Defect Detail Modal (Query 3)
  isDefectModalOpen: false,
  selectedFGSRNo: null,

  // Serial Search Modal
  isSerialModalOpen: false,
  serialData: null, // { modelName, data: [...] }
};

const fpaReportSlice = createSlice({
  name: "fpaReport",
  initialState,
  reducers: {
    setFpaDateRange: (state, action) => {
      state.filters.startDate = action.payload.startDate;
      state.filters.endDate = action.payload.endDate;
    },
    setFpaQuickFilter: (state, action) => {
      state.activeQuickFilter = action.payload;
    },
    resetFpaFilters: (state) => {
      state.filters = { startDate: "", endDate: "" };
      state.activeQuickFilter = null;
      state.isSerialModalOpen = false;
      state.serialData = null;
    },

    // Model Modal
    openModelModal: (state, action) => {
      state.isModelModalOpen = true;
      state.selectedModel = action.payload;
    },
    closeModelModal: (state) => {
      state.isModelModalOpen = false;
      state.selectedModel = null;
    },

    // Defect Modal
    openDefectModal: (state, action) => {
      state.isDefectModalOpen = true;
      state.selectedFGSRNo = action.payload;
    },
    closeDefectModal: (state) => {
      state.isDefectModalOpen = false;
      state.selectedFGSRNo = null;
    },

    // Serial Search Modal
    openSerialModal: (state, action) => {
      state.isSerialModalOpen = true;
      state.serialData = action.payload; // { modelName, data: [...] }
    },
    closeSerialModal: (state) => {
      state.isSerialModalOpen = false;
      state.serialData = null;
    },
  },
});

export const {
  setFpaDateRange,
  setFpaQuickFilter,
  resetFpaFilters,
  openModelModal,
  closeModelModal,
  openDefectModal,
  closeDefectModal,
  openSerialModal,
  closeSerialModal,
} = fpaReportSlice.actions;

export default fpaReportSlice.reducer;
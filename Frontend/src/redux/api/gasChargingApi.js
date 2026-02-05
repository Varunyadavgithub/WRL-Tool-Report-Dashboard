import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const gasChargingApi = createApi({
  reducerPath: "gasChargingApi",
  baseQuery: fetchBaseQuery({
    baseUrl: baseURL,
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth?.token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["GasCharging"],
  endpoints: (builder) => ({
    // Get Gas Charging Report
    getGasChargingReport: builder.query({
      query: (params) => ({
        url: "/gas-charging/report",
        params,
      }),
      providesTags: ["GasCharging"],
    }),

    // Get Summary
    getGasChargingSummary: builder.query({
      query: (params) => ({
        url: "/gas-charging/summary",
        params,
      }),
    }),

    // Get Faults
    getGasChargingFaults: builder.query({
      query: (params) => ({
        url: "/gas-charging/faults",
        params,
      }),
    }),

    // Get Models
    getGasChargingModels: builder.query({
      query: () => "/gas-charging/models",
    }),

    // Get Machines
    getGasChargingMachines: builder.query({
      query: () => "/gas-charging/machines",
    }),

    // Get Refrigerants
    getGasChargingRefrigerants: builder.query({
      query: () => "/gas-charging/refrigerants",
    }),

    // Export Data
    getGasChargingExport: builder.query({
      query: (params) => ({
        url: "/gas-charging/export",
        params,
      }),
    }),
  }),
});

export const {
  useGetGasChargingReportQuery,
  useGetGasChargingSummaryQuery,
  useGetGasChargingFaultsQuery,
  useGetGasChargingModelsQuery,
  useGetGasChargingMachinesQuery,
  useGetGasChargingRefrigerantsQuery,
  useLazyGetGasChargingExportQuery,
} = gasChargingApi;

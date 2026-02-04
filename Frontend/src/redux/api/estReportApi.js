import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const estReportApi = createApi({
  reducerPath: "estReportApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${baseURL}est-report`,
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["EstReport", "Summary", "Models", "Operators"],
  endpoints: (builder) => ({
    // Get EST Report with filters
    getEstReport: builder.query({
      query: ({
        startDate,
        endDate,
        model,
        operator,
        result,
        testType,
        page,
        limit,
      }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (model) params.append("model", model);
        if (operator) params.append("operator", operator);
        if (result) params.append("result", result);
        if (testType) params.append("testType", testType);
        if (page) params.append("page", page);
        if (limit) params.append("limit", limit);
        return `?${params.toString()}`;
      },
      providesTags: ["EstReport"],
    }),

    // Get EST Report by RefNo
    getEstReportByRefNo: builder.query({
      query: (refNo) => `/${refNo}`,
      providesTags: (result, error, refNo) => [
        { type: "EstReport", id: refNo },
      ],
    }),

    // Get Summary Statistics
    getEstReportSummary: builder.query({
      query: ({ startDate, endDate, model }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (model) params.append("model", model);
        return `/summary?${params.toString()}`;
      },
      providesTags: ["Summary"],
    }),

    // Quick Filter (today, yesterday, mtd)
    getEstReportQuickFilter: builder.query({
      query: ({ filter, model, operator, result }) => {
        const params = new URLSearchParams();
        if (model) params.append("model", model);
        if (operator) params.append("operator", operator);
        if (result) params.append("result", result);
        return `/quick/${filter}?${params.toString()}`;
      },
      providesTags: ["EstReport"],
    }),

    // Get Distinct Models
    getDistinctModels: builder.query({
      query: () => "/models",
      providesTags: ["Models"],
    }),

    // Get Distinct Operators
    getDistinctOperators: builder.query({
      query: () => "/operators",
      providesTags: ["Operators"],
    }),

    // Get Model-wise Statistics
    getModelWiseStats: builder.query({
      query: ({ startDate, endDate }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        return `/model-stats?${params.toString()}`;
      },
    }),

    // Get Operator-wise Statistics
    getOperatorWiseStats: builder.query({
      query: ({ startDate, endDate }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        return `/operator-stats?${params.toString()}`;
      },
    }),

    // Get Hourly Trend
    getHourlyTrend: builder.query({
      query: ({ startDate, endDate, model }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (model) params.append("model", model);
        return `/hourly-trend?${params.toString()}`;
      },
    }),

    // Get Daily Trend
    getDailyTrend: builder.query({
      query: ({ startDate, endDate, model }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (model) params.append("model", model);
        return `/daily-trend?${params.toString()}`;
      },
    }),

    // Get Failed Tests
    getFailedTests: builder.query({
      query: ({ startDate, endDate, testType, model }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (testType) params.append("testType", testType);
        if (model) params.append("model", model);
        return `/failures?${params.toString()}`;
      },
    }),

    // Get Failure Analysis
    getFailureAnalysis: builder.query({
      query: ({ startDate, endDate, model }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (model) params.append("model", model);
        return `/failure-analysis?${params.toString()}`;
      },
    }),

    // Export Data
    getExportData: builder.query({
      query: ({ startDate, endDate, model, operator, result }) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (model) params.append("model", model);
        if (operator) params.append("operator", operator);
        if (result) params.append("result", result);
        return `/export?${params.toString()}`;
      },
    }),
  }),
});

export const {
  useGetEstReportQuery,
  useGetEstReportByRefNoQuery,
  useGetEstReportSummaryQuery,
  useGetEstReportQuickFilterQuery,
  useGetDistinctModelsQuery,
  useGetDistinctOperatorsQuery,
  useGetModelWiseStatsQuery,
  useGetOperatorWiseStatsQuery,
  useGetHourlyTrendQuery,
  useGetDailyTrendQuery,
  useGetFailedTestsQuery,
  useGetFailureAnalysisQuery,
  useLazyGetEstReportQuery,
  useLazyGetEstReportQuickFilterQuery,
  useLazyGetExportDataQuery,
} = estReportApi;

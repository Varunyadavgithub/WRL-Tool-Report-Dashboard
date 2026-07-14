import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

// This call is expensive (10-60s+ on the on-prem CPU model) — the panel uses
// the lazy hook so it only fires when the user explicitly asks for it, never
// on filter change.
export const insightsApi = createApi({
  reducerPath: "insightsApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${baseURL}insights`, credentials: "include" }),
  endpoints: (builder) => ({
    getShiftReportInsight: builder.query({
      query: ({ start, end, shiftName }) => ({ url: "shift-report", params: { start, end, shiftName } }),
      transformResponse: (res) => res.data,
    }),
  }),
});

export const { useLazyGetShiftReportInsightQuery } = insightsApi;

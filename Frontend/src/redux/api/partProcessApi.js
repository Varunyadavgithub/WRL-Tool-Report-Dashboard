import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const partProcessApi = createApi({
  reducerPath: "partProcessApi",
  baseQuery: fetchBaseQuery({ baseUrl: baseURL, credentials: "include" }),
  endpoints: (builder) => ({
    getPartProcessRecords: builder.query({
      query: (params) => ({ url: "part-process/records", params }),
      transformResponse: (res) => res.data ?? [],
    }),
    getPartProcessHourly: builder.query({
      query: (params) => ({ url: "part-process/hourly", params }),
      transformResponse: (res) => res.data ?? [],
    }),
  }),
});

export const {
  useGetPartProcessRecordsQuery,
  useLazyGetPartProcessRecordsQuery,
  useGetPartProcessHourlyQuery,
  useLazyGetPartProcessHourlyQuery,
} = partProcessApi;

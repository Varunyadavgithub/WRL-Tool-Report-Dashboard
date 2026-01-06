import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../../assets/assets";

export const commonApi = createApi({
  reducerPath: "commonApi",
  baseQuery: fetchBaseQuery({
    baseUrl: baseURL,
  }),
  tagTypes: ["Common"],
  endpoints: (builder) => ({
    getModelVariants: builder.query({
      query: () => "shared/model-variants",
      transformResponse: (response) =>
        response.data.map((item) => ({
          label: item.MaterialName,
          value: item.MatCode.toString(),
        })),
      providesTags: ["Common"],
    }),

    getStages: builder.query({
      query: () => "shared/stage-names",
      transformResponse: (response) =>
        response.data.map((item) => ({
          label: item.Name,
          value: item.StationCode.toString(),
        })),
      providesTags: ["Common"],
    }),

    getComponentTypes: builder.query({
      query: () => "shared/comp-type",
      transformResponse: (response) =>
        response.data.map((item) => ({
          label: item.Name,
          value: item.CategoryCode.toString(),
        })),
      providesTags: ["Common"],
    }),
  }),
});

export const {
  useGetModelVariantsQuery,
  useGetStagesQuery,
  useGetComponentTypesQuery,
} = commonApi;

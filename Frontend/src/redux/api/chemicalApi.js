import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const chemicalApi = createApi({
  reducerPath: "chemicalApi",
  baseQuery: fetchBaseQuery({ baseUrl: baseURL, credentials: "include" }),
  tagTypes: ["ChemBulkStorageRecipient"],
  endpoints: (builder) => ({
    // ── Chemical Bulk Storage Mail Recipients ───────────────────────────────
    getChemBulkStorageRecipients: builder.query({
      query: () => "chemical/recipients",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["ChemBulkStorageRecipient"],
    }),
    addChemBulkStorageRecipient: builder.mutation({
      query: (body) => ({ url: "chemical/recipients", method: "POST", body }),
      invalidatesTags: ["ChemBulkStorageRecipient"],
    }),
    updateChemBulkStorageRecipient: builder.mutation({
      query: ({ id, ...body }) => ({ url: `chemical/recipients/${id}`, method: "PUT", body }),
      invalidatesTags: ["ChemBulkStorageRecipient"],
    }),
    deleteChemBulkStorageRecipient: builder.mutation({
      query: (id) => ({ url: `chemical/recipients/${id}`, method: "DELETE" }),
      invalidatesTags: ["ChemBulkStorageRecipient"],
    }),
    testChemBulkStorageRecipient: builder.mutation({
      query: (id) => ({ url: `chemical/recipients/${id}/test`, method: "POST" }),
    }),
    sendChemBulkStorageReportNow: builder.mutation({
      query: () => ({ url: "chemical/send-now", method: "POST" }),
    }),
  }),
});

export const {
  useGetChemBulkStorageRecipientsQuery,
  useAddChemBulkStorageRecipientMutation,
  useUpdateChemBulkStorageRecipientMutation,
  useDeleteChemBulkStorageRecipientMutation,
  useTestChemBulkStorageRecipientMutation,
  useSendChemBulkStorageReportNowMutation,
} = chemicalApi;

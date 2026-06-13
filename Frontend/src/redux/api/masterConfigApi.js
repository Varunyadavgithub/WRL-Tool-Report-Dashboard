import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const masterConfigApi = createApi({
  reducerPath: "masterConfigApi",
  baseQuery: fetchBaseQuery({ baseUrl: baseURL, credentials: "include" }),
  tagTypes: ["Material", "Shift", "DowntimeReason", "Department", "QualityDefect"],
  endpoints: (builder) => ({
    // ── Materials ────────────────────────────────────────────────────────────
    getMaterials: builder.query({
      query: () => "master-config/materials",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["Material"],
    }),
    addMaterial: builder.mutation({
      query: (body) => ({ url: "master-config/materials", method: "POST", body }),
      invalidatesTags: ["Material"],
    }),
    updateMaterial: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/materials/${id}`, method: "PUT", body }),
      invalidatesTags: ["Material"],
    }),
    deleteMaterial: builder.mutation({
      query: (id) => ({ url: `master-config/materials/${id}`, method: "DELETE" }),
      invalidatesTags: ["Material"],
    }),
    bulkAddMaterials: builder.mutation({
      query: (materials) => ({ url: "master-config/materials/bulk", method: "POST", body: { materials } }),
      invalidatesTags: ["Material"],
    }),

    // ── Shifts ───────────────────────────────────────────────────────────────
    getShifts: builder.query({
      query: () => "master-config/shifts",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["Shift"],
    }),
    addShift: builder.mutation({
      query: (body) => ({ url: "master-config/shifts", method: "POST", body }),
      invalidatesTags: ["Shift"],
    }),
    updateShift: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/shifts/${id}`, method: "PUT", body }),
      invalidatesTags: ["Shift"],
    }),
    deleteShift: builder.mutation({
      query: (id) => ({ url: `master-config/shifts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Shift"],
    }),

    // ── Downtime Reasons ─────────────────────────────────────────────────────
    getDowntimeReasons: builder.query({
      query: () => "master-config/downtime-reasons",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["DowntimeReason"],
    }),
    addDowntimeReason: builder.mutation({
      query: (body) => ({ url: "master-config/downtime-reasons", method: "POST", body }),
      invalidatesTags: ["DowntimeReason"],
    }),
    updateDowntimeReason: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/downtime-reasons/${id}`, method: "PUT", body }),
      invalidatesTags: ["DowntimeReason"],
    }),
    deleteDowntimeReason: builder.mutation({
      query: (id) => ({ url: `master-config/downtime-reasons/${id}`, method: "DELETE" }),
      invalidatesTags: ["DowntimeReason"],
    }),

    // ── Departments ──────────────────────────────────────────────────────────
    getDepartments: builder.query({
      query: () => "master-config/departments",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["Department"],
    }),
    addDepartment: builder.mutation({
      query: (body) => ({ url: "master-config/departments", method: "POST", body }),
      invalidatesTags: ["Department"],
    }),
    updateDepartment: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/departments/${id}`, method: "PUT", body }),
      invalidatesTags: ["Department"],
    }),
    deleteDepartment: builder.mutation({
      query: (id) => ({ url: `master-config/departments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Department"],
    }),

    // ── Quality Defects ──────────────────────────────────────────────────────
    getQualityDefects: builder.query({
      query: () => "master-config/quality-defects",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["QualityDefect"],
    }),
    addQualityDefect: builder.mutation({
      query: (body) => ({ url: "master-config/quality-defects", method: "POST", body }),
      invalidatesTags: ["QualityDefect"],
    }),
    updateQualityDefect: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/quality-defects/${id}`, method: "PUT", body }),
      invalidatesTags: ["QualityDefect"],
    }),
    deleteQualityDefect: builder.mutation({
      query: (id) => ({ url: `master-config/quality-defects/${id}`, method: "DELETE" }),
      invalidatesTags: ["QualityDefect"],
    }),
  }),
});

export const {
  useGetMaterialsQuery, useAddMaterialMutation, useUpdateMaterialMutation, useDeleteMaterialMutation, useBulkAddMaterialsMutation,
  useGetShiftsQuery, useAddShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation,
  useGetDowntimeReasonsQuery, useAddDowntimeReasonMutation, useUpdateDowntimeReasonMutation, useDeleteDowntimeReasonMutation,
  useGetDepartmentsQuery, useAddDepartmentMutation, useUpdateDepartmentMutation, useDeleteDepartmentMutation,
  useGetQualityDefectsQuery, useAddQualityDefectMutation, useUpdateQualityDefectMutation, useDeleteQualityDefectMutation,
} = masterConfigApi;

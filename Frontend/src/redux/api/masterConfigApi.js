import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const masterConfigApi = createApi({
  reducerPath: "masterConfigApi",
  baseQuery: fetchBaseQuery({ baseUrl: baseURL, credentials: "include" }),
  tagTypes: ["Material", "Shift", "DowntimeReason", "Department", "QualityDefect", "MailSubscriber", "Machine", "Plan", "CheckpointLibrary"],
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

    // ── Mail Subscribers ─────────────────────────────────────────────────────
    getMailSubscribers: builder.query({
      query: () => "master-config/mail-subscribers",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["MailSubscriber"],
    }),
    addMailSubscriber: builder.mutation({
      query: (body) => ({ url: "master-config/mail-subscribers", method: "POST", body }),
      invalidatesTags: ["MailSubscriber"],
    }),
    updateMailSubscriber: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/mail-subscribers/${id}`, method: "PUT", body }),
      invalidatesTags: ["MailSubscriber"],
    }),
    deleteMailSubscriber: builder.mutation({
      query: (id) => ({ url: `master-config/mail-subscribers/${id}`, method: "DELETE" }),
      invalidatesTags: ["MailSubscriber"],
    }),
    testMailSubscriber: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/mail-subscribers/${id}/test`, method: "POST", body }),
    }),

    // ── Machines ──────────────────────────────────────────────────────────────
    getMachines: builder.query({
      query: () => "master-config/machines",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["Machine"],
    }),
    addMachine: builder.mutation({
      query: (body) => ({ url: "master-config/machines", method: "POST", body }),
      invalidatesTags: ["Machine"],
    }),
    updateMachine: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/machines/${id}`, method: "PUT", body }),
      invalidatesTags: ["Machine"],
    }),
    deleteMachine: builder.mutation({
      query: (id) => ({ url: `master-config/machines/${id}`, method: "DELETE" }),
      invalidatesTags: ["Machine"],
    }),
    uploadMachineImage: builder.mutation({
      query: ({ id, file }) => {
        const formData = new FormData();
        formData.append("image", file);
        return { url: `master-config/machines/${id}/image`, method: "POST", body: formData };
      },
      invalidatesTags: ["Machine"],
    }),

    // ── Production Plans ─────────────────────────────────────────────────────
    getPlans: builder.query({
      query: () => "master-config/plans",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["Plan"],
    }),
    addPlan: builder.mutation({
      query: (body) => ({ url: "master-config/plans", method: "POST", body }),
      invalidatesTags: ["Plan"],
    }),
    updatePlan: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/plans/${id}`, method: "PUT", body }),
      invalidatesTags: ["Plan"],
    }),
    deletePlan: builder.mutation({
      query: (id) => ({ url: `master-config/plans/${id}`, method: "DELETE" }),
      invalidatesTags: ["Plan"],
    }),
    bulkAddPlans: builder.mutation({
      query: (plans) => ({ url: "master-config/plans/bulk", method: "POST", body: { plans } }),
      invalidatesTags: ["Plan"],
    }),

    // ── Checkpoint Library ───────────────────────────────────────────────────
    getCheckpointLibrary: builder.query({
      query: () => "master-config/checkpoint-library",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["CheckpointLibrary"],
    }),
    addCheckpointLibraryEntry: builder.mutation({
      query: (body) => ({ url: "master-config/checkpoint-library", method: "POST", body }),
      invalidatesTags: ["CheckpointLibrary"],
    }),
    updateCheckpointLibraryEntry: builder.mutation({
      query: ({ id, ...body }) => ({ url: `master-config/checkpoint-library/${id}`, method: "PUT", body }),
      invalidatesTags: ["CheckpointLibrary"],
    }),
    deleteCheckpointLibraryEntry: builder.mutation({
      query: (id) => ({ url: `master-config/checkpoint-library/${id}`, method: "DELETE" }),
      invalidatesTags: ["CheckpointLibrary"],
    }),
    incrementCheckpointUsage: builder.mutation({
      // No tag invalidation -- UsageCount is informational only, not worth a
      // full refetch of the list every time a checkpoint is inserted into a
      // template.
      query: (id) => ({ url: `master-config/checkpoint-library/${id}/increment-usage`, method: "POST" }),
    }),
  }),
});

export const {
  useGetMaterialsQuery, useAddMaterialMutation, useUpdateMaterialMutation, useDeleteMaterialMutation, useBulkAddMaterialsMutation,
  useGetShiftsQuery, useAddShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation,
  useGetDowntimeReasonsQuery, useAddDowntimeReasonMutation, useUpdateDowntimeReasonMutation, useDeleteDowntimeReasonMutation,
  useGetDepartmentsQuery, useAddDepartmentMutation, useUpdateDepartmentMutation, useDeleteDepartmentMutation,
  useGetQualityDefectsQuery, useAddQualityDefectMutation, useUpdateQualityDefectMutation, useDeleteQualityDefectMutation,
  useGetMailSubscribersQuery, useAddMailSubscriberMutation, useUpdateMailSubscriberMutation, useDeleteMailSubscriberMutation,
  useTestMailSubscriberMutation,
  useGetMachinesQuery, useAddMachineMutation, useUpdateMachineMutation, useDeleteMachineMutation, useUploadMachineImageMutation,
  useGetPlansQuery, useAddPlanMutation, useUpdatePlanMutation, useDeletePlanMutation, useBulkAddPlansMutation,
  useGetCheckpointLibraryQuery, useAddCheckpointLibraryEntryMutation, useUpdateCheckpointLibraryEntryMutation,
  useDeleteCheckpointLibraryEntryMutation, useIncrementCheckpointUsageMutation,
} = masterConfigApi;

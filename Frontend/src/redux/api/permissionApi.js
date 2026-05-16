import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const permissionApi = createApi({
  reducerPath: "permissionApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1",
    credentials: "include",
  }),
  tagTypes: ["Permissions"],
  endpoints: (builder) => ({

    getMyPermissions: builder.query({
      query: () => "/permission/me",
      providesTags: ["Permissions"],
    }),

    updateRolePermissions: builder.mutation({
      query: (body) => ({
        url: "/permission/admin/update",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Permissions"],
    }),

  }),
});

export const {
  useGetMyPermissionsQuery,
  useUpdateRolePermissionsMutation,
} = permissionApi;
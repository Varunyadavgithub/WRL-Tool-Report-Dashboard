import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const settingsApi = createApi({
  reducerPath: "settingsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1/settings",
    credentials: "include",
  }),
  tagTypes: ["MailServerConfig"],
  endpoints: (builder) => ({

    getMailServerConfig: builder.query({
      query: () => "/mail-server",
      transformResponse: (res) => res.config,
      providesTags: ["MailServerConfig"],
    }),

    updateMailServerConfig: builder.mutation({
      query: (body) => ({
        url: "/mail-server",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["MailServerConfig"],
    }),

    resetMailServerConfig: builder.mutation({
      query: () => ({
        url: "/mail-server",
        method: "DELETE",
      }),
      invalidatesTags: ["MailServerConfig"],
    }),

    testMailServerConfig: builder.mutation({
      query: (body) => ({
        url: "/mail-server/test",
        method: "POST",
        body,
      }),
    }),

  }),
});

export const {
  useGetMailServerConfigQuery,
  useUpdateMailServerConfigMutation,
  useResetMailServerConfigMutation,
  useTestMailServerConfigMutation,
} = settingsApi;

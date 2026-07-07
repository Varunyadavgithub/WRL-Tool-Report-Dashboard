import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

// Covers the non-streaming session endpoints only — sending a message streams
// via useChatStream.js (a bespoke fetch/ReadableStream client), since RTK
// Query's fetchBaseQuery has no first-class SSE support.
export const aiApi = createApi({
  reducerPath: "aiApi",
  baseQuery: fetchBaseQuery({ baseUrl: baseURL, credentials: "include" }),
  tagTypes: ["ChatSession"],
  endpoints: (builder) => ({
    getChatSessions: builder.query({
      query: () => "ai/sessions",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["ChatSession"],
    }),
    createChatSession: builder.mutation({
      query: (title) => ({ url: "ai/sessions", method: "POST", body: { title } }),
      transformResponse: (res) => res.data,
      invalidatesTags: ["ChatSession"],
    }),
    getChatMessages: builder.query({
      query: (sessionId) => `ai/sessions/${sessionId}/messages`,
      transformResponse: (res) => res.data ?? [],
    }),
  }),
});

export const {
  useGetChatSessionsQuery,
  useCreateChatSessionMutation,
  useGetChatMessagesQuery,
  useLazyGetChatMessagesQuery,
} = aiApi;

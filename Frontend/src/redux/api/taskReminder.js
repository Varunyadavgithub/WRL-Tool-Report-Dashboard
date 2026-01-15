import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const taskReminderApi = createApi({
  reducerPath: "taskReminderApi",
  baseQuery: fetchBaseQuery({
    baseUrl: baseURL,
  }),
  tagTypes: ["TaskReminder"],
  endpoints: (builder) => ({
    // CREATE TASK
    createTask: builder.mutation({
      query: (taskData) => ({
        url: "task-reminders/",
        method: "POST",
        body: taskData,
      }),
      invalidatesTags: ["TaskReminder"],
    }),

    // GET ALL TASKS
    getTasks: builder.query({
      query: () => ({
        url: "task-reminders/",
        method: "GET",
      }),
      providesTags: ["TaskReminder"],
    }),
  }),
});

export const { useCreateTaskMutation, useGetTasksQuery } = taskReminderApi;

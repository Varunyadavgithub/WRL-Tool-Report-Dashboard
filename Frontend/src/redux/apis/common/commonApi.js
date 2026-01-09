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

    getEmployeesWithDepartments: builder.query({
      query: () => "shared/employees-with-departments",
      transformResponse: (response) =>
        response.map((emp) => ({
          label: emp.name,
          value: emp.employee_id.toString(),
          departmentName: emp.department_name,
          departmentCode: emp.deptCode,
        })),
      providesTags: ["Common"],
    }),
  }),
});

export const {
  useGetModelVariantsQuery,
  useGetStagesQuery,
  useGetComponentTypesQuery,
  useGetEmployeesWithDepartmentsQuery,
} = commonApi;

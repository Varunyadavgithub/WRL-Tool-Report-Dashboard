import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

/**
 * Fetch permissions for a role
 */
export const fetchRolePermissions = createAsyncThunk(
  "permissions/fetchRolePermissions",
  async (role) => {
    const res = await axios.get(`/api/v1/permission/${role}`);
    return res.data.data;
  }
);

/**
 * Update permissions for a role
 */
export const updateRolePermissions = createAsyncThunk(
  "permissions/updateRolePermissions",
  async ({ role, permissions }) => {
    const res = await axios.put(`/api/v1/permission/${role}`, permissions);
    return res.data;
  }
);

const permissionSlice = createSlice({
  name: "permissions",
  initialState: {
    rolePermissions: {},
    loading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRolePermissions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRolePermissions.fulfilled, (state, action) => {
        state.rolePermissions = action.payload;
        state.loading = false;
      })
      .addCase(fetchRolePermissions.rejected, (state) => {
        state.loading = false;
      })
      .addCase(updateRolePermissions.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateRolePermissions.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateRolePermissions.rejected, (state) => {
        state.loading = false;
      });
  },
});

export default permissionSlice.reducer;
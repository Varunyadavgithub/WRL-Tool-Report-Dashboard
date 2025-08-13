import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
  },
  reducers: {
    // Login / Set user
    setAuthUser: (state, action) => {
      state.user = action.payload;
    },

    // Logout / Clear user
    logoutUser: (state) => {
      state.user = null;
    },
  },
});

export const { setAuthUser, logoutUser } = authSlice.actions;
export default authSlice.reducer;
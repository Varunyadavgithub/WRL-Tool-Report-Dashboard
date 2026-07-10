import toast from "react-hot-toast";
import { logoutUser } from "../redux/slices/authSlice.js";

// Shared by both fetch paths in this app — the RTK Query middleware (store.js)
// for API-slice calls, and the axios interceptor (main.jsx) for the many
// pages that still call the backend directly. A stale Redux-persisted login
// (cookie expired/cleared but redux-persist still has a cached user) used to
// fail silently per-request; this makes it log the user out and bounce them
// to /login (via ProtectedRoute's existing redirect-on-no-user check) the
// moment ANY request comes back 401, instead of leaving broken pages/consoles
// full of errors.
let toastShownAt = 0;
const TOAST_COOLDOWN_MS = 5000; // several requests can 401 in the same burst — one toast, not five

export const handleSessionExpired = (dispatch) => {
  dispatch(logoutUser());

  const now = Date.now();
  if (now - toastShownAt > TOAST_COOLDOWN_MS) {
    toastShownAt = now;
    toast.error("Your session has expired. Please log in again.");
  }
};

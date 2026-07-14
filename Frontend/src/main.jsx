import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter as Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Provider } from "react-redux";
import store from "./redux/store.js";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";
import { handleSessionExpired } from "./utils/authExpiry.js";

axios.defaults.withCredentials = true;

// Covers the many pages that call the backend via raw axios rather than RTK
// Query — see the equivalent RTK Query middleware in redux/store.js for the
// other fetch path. Both funnel into the same handleSessionExpired so there's
// one place that decides what "expired session" means.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleSessionExpired(store.dispatch);
    }
    return Promise.reject(error);
  },
);

let persistor = persistStore(store);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Routes>
          <App />
          <Toaster position="top-center" reverseOrder={false} />
        </Routes>
      </PersistGate>
    </Provider>
  </StrictMode>
);
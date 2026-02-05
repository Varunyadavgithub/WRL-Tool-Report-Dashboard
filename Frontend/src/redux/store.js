import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authSlice from "./authSlice";
import estReportSlice from "./estReportSlice";
import gasChargingSlice from "./gasChargingSlice"; // ADD THIS
import { commonApi } from "./api/commonApi.js";
import { taskReminderApi } from "./api/taskReminder.js";
import { estReportApi } from "./api/estReportApi.js";
import { gasChargingApi } from "./api/gasChargingApi.js"; // ADD THIS
import {
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

const persistConfig = {
  key: "root",
  version: 1,
  storage,
  blacklist: [
    estReportApi.reducerPath,
    gasChargingApi.reducerPath, // ADD THIS
  ],
};

const rootReducer = combineReducers({
  auth: authSlice,
  estReport: estReportSlice,
  gasCharging: gasChargingSlice, // ADD THIS
  [commonApi.reducerPath]: commonApi.reducer,
  [taskReminderApi.reducerPath]: taskReminderApi.reducer,
  [estReportApi.reducerPath]: estReportApi.reducer,
  [gasChargingApi.reducerPath]: gasChargingApi.reducer, // ADD THIS
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      commonApi.middleware,
      taskReminderApi.middleware,
      estReportApi.middleware,
      gasChargingApi.middleware, // ADD THIS
    ),
});

export default store;

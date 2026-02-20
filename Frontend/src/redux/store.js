import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authSlice from "./authSlice";
import estReportSlice from "./estReportSlice";
import gasChargingSlice from "./gasChargingSlice";
import fpaReportReducer from "./fpaReportSlice";

import { commonApi } from "./api/commonApi.js";
import { taskReminderApi } from "./api/taskReminder.js";
import { estReportApi } from "./api/estReportApi.js";
import { gasChargingApi } from "./api/gasChargingApi.js";
import { fpaReportApi } from "./api/fpaReportApi.js";

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
    gasChargingApi.reducerPath,
    fpaReportApi.reducerPath,
  ],
};

const rootReducer = combineReducers({
  auth: authSlice,
  estReport: estReportSlice,
  gasCharging: gasChargingSlice,
  fpaReport: fpaReportReducer,

  [commonApi.reducerPath]: commonApi.reducer,
  [taskReminderApi.reducerPath]: taskReminderApi.reducer,
  [estReportApi.reducerPath]: estReportApi.reducer,
  [gasChargingApi.reducerPath]: gasChargingApi.reducer,
  [fpaReportApi.reducerPath]: fpaReportApi.reducer,
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
      gasChargingApi.middleware,
      fpaReportApi.middleware,
    ),
});

export default store;

import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authSlice from "./authSlice";
import estReportSlice from "./estReportSlice";
import { commonApi } from "./api/commonApi.js";
import { taskReminderApi } from "./api/taskReminder.js";
import { estReportApi } from "./api/estReportApi.js";
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
  blacklist: [estReportApi.reducerPath], // Don't persist API cache
};

const rootReducer = combineReducers({
  auth: authSlice,
  estReport: estReportSlice,
  [commonApi.reducerPath]: commonApi.reducer,
  [taskReminderApi.reducerPath]: taskReminderApi.reducer,
  [estReportApi.reducerPath]: estReportApi.reducer,
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
    ),
});

export default store;

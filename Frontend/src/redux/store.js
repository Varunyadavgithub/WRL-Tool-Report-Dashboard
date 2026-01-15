import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authSlice from "./authSlice";
import { commonApi } from "./api/commonApi.js";
import { taskReminderApi } from "./api/taskReminder.js";
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
};

const rootReducer = combineReducers({
  auth: authSlice,
  [commonApi.reducerPath]: commonApi.reducer,
  [taskReminderApi.reducerPath]: taskReminderApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(commonApi.middleware, taskReminderApi.middleware),
});

export default store;

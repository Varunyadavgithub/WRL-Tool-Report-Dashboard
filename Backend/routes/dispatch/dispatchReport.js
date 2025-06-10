import express from "express";
import {
  getFgDispatch,
  getFgUnloading,
  getQuickFgDispatch,
  getQuickFgUnloading,
} from "../../controllers/dispatch/dispatchReport.js";

const router = express.Router();

router.get("/fg-unloading", getFgUnloading);
router.get("/fg-dispatch", getFgDispatch);
router.get("/quick-fg-unloading", getQuickFgUnloading);
router.get("/quick-fg-dispatch", getQuickFgDispatch);

export default router;

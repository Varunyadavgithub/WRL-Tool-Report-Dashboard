import express from "express";
import {
  getFGPackingData,
  getFGLoadingData,
  getHourlyProductionData,
  getQualityData,
  getLossData,
} from "../controllers/dashboard/finalAreaProduction.controller.js";

const router = express.Router();



router.get("/fg-packing", getFGPackingData);
router.get("/fg-loading", getFGLoadingData);
router.get("/hourly",     getHourlyProductionData);
router.get("/quality",    getQualityData);
router.get("/loss",       getLossData);

export default router;
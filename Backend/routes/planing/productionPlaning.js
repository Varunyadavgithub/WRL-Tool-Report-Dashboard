import express from "express";
import {
  addProductionPlaningData,
  getModelName,
  getPlanMonth,
  productionPlaningData,
  updateProductionPlaningData,
} from "../../controllers/planing/productionPlaning.js";

const router = express.Router();

router.get("/plan-month-year", getPlanMonth);
router.get("/model-name", getModelName);
router.get("/production-planing", productionPlaningData);
router.put("/update-production-plan", updateProductionPlaningData);
router.post("/add-production-plan", addProductionPlaningData);

export default router;

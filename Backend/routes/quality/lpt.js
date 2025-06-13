import express from "express";
import {
  getLptAssetDetails,
  getLptDefectCategory,
  addLptDefect,
  getLptDefectReport,
  getLptDefectCount,
} from "../../controllers/quality/lpt.js";

const router = express.Router();

router.get("/lpt-asset-details", getLptAssetDetails);
router.get("/lpt-defect-category", getLptDefectCategory);
router.post("/add-lpt-defect", addLptDefect);
router.get("/lpt-defect-report", getLptDefectReport);
router.get("/lpt-defect-count", getLptDefectCount);

export default router;

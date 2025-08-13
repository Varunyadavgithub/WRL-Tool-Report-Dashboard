import express from "express";
import {
  getDepartments,
  getModelVariants,
  getStageNames,
} from "../controllers/sharedController.js";

const router = express.Router();

router.get("/model-variants", getModelVariants);
router.get("/stage-names", getStageNames);
router.get("/departments", getDepartments);

export default router;
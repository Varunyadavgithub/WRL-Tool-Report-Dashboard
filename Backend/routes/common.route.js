import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getDepartments,
  getModelVariants,
  getStageNames,
  getCompType,
  getEmployeesWithDepartments,
  getModelVariantsByAssembly,
  getProductionLine,
} from "../controllers/common.controller.js";

const router = express.Router();

router.get("/model-variants", authenticate, getModelVariants);
router.get("/model-variants/:serial", authenticate, getModelVariantsByAssembly);
router.get("/stage-names", authenticate, getStageNames);
router.get("/departments", authenticate, getDepartments);
router.get("/Comp-type", authenticate, getCompType);
router.get("/employees-with-departments", authenticate, getEmployeesWithDepartments);
router.get("/production-line", authenticate, getProductionLine);

export default router;

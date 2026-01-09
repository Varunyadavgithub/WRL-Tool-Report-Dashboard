import express from "express";
import {
  getDepartments,
  getModelVariants,
  getStageNames,
  getCompType,
  getEmployeesWithDepartments,
} from "../controllers/common.controller.js";

const router = express.Router();

router.get("/model-variants", getModelVariants);
router.get("/stage-names", getStageNames);
router.get("/departments", getDepartments);
router.get("/Comp-type", getCompType);
router.get("/employees-with-departments", getEmployeesWithDepartments);

export default router;

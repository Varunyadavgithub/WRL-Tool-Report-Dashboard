import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getMaterials, createMaterial, updateMaterial, deleteMaterial, bulkUpsertMaterials,
  getShifts, createShift, updateShift, deleteShift,
  getDowntimeReasons, createDowntimeReason, updateDowntimeReason, deleteDowntimeReason,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getQualityDefects, createQualityDefect, updateQualityDefect, deleteQualityDefect,
} from "../controllers/masterConfig.controller.js";

const router = Router();

// Materials
router.get("/materials",       authenticate, getMaterials);
router.post("/materials",      authenticate, createMaterial);
router.post("/materials/bulk", authenticate, bulkUpsertMaterials);
router.put("/materials/:id",   authenticate, updateMaterial);
router.delete("/materials/:id",authenticate, deleteMaterial);

// Shifts
router.get("/shifts",        authenticate, getShifts);
router.post("/shifts",       authenticate, createShift);
router.put("/shifts/:id",    authenticate, updateShift);
router.delete("/shifts/:id", authenticate, deleteShift);

// Downtime Reasons
router.get("/downtime-reasons",        authenticate, getDowntimeReasons);
router.post("/downtime-reasons",       authenticate, createDowntimeReason);
router.put("/downtime-reasons/:id",    authenticate, updateDowntimeReason);
router.delete("/downtime-reasons/:id", authenticate, deleteDowntimeReason);

// Departments
router.get("/departments",        authenticate, getDepartments);
router.post("/departments",       authenticate, createDepartment);
router.put("/departments/:id",    authenticate, updateDepartment);
router.delete("/departments/:id", authenticate, deleteDepartment);

// Quality Defects
router.get("/quality-defects",        authenticate, getQualityDefects);
router.post("/quality-defects",       authenticate, createQualityDefect);
router.put("/quality-defects/:id",    authenticate, updateQualityDefect);
router.delete("/quality-defects/:id", authenticate, deleteQualityDefect);

export default router;

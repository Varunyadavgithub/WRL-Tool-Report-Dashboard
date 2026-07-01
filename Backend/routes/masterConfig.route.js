import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { uploadMachineImage, handleMulterError } from "../middlewares/uploadMiddleware.js";
import {
  getMaterials, createMaterial, updateMaterial, deleteMaterial, bulkUpsertMaterials,
  getShifts, createShift, updateShift, deleteShift,
  getDowntimeReasons, createDowntimeReason, updateDowntimeReason, deleteDowntimeReason,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getQualityDefects, createQualityDefect, updateQualityDefect, deleteQualityDefect,
  getMailSubscribers, createMailSubscriber, updateMailSubscriber, deleteMailSubscriber, testMailSubscriber,
  getMachines, createMachine, updateMachine, deleteMachine, uploadMachineImage as uploadMachineImageHandler,
  getPlans, createPlan, updatePlan, deletePlan, bulkUpsertPlans,
  getCheckpointLibrary, createCheckpointLibraryEntry, updateCheckpointLibraryEntry,
  deleteCheckpointLibraryEntry, incrementCheckpointUsage,
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

// Mail Subscribers
router.get("/mail-subscribers",        authenticate, getMailSubscribers);
router.post("/mail-subscribers",       authenticate, createMailSubscriber);
router.put("/mail-subscribers/:id",    authenticate, updateMailSubscriber);
router.delete("/mail-subscribers/:id", authenticate, deleteMailSubscriber);
router.post("/mail-subscribers/:id/test", authenticate, testMailSubscriber);

// Machines
router.get("/machines",        authenticate, getMachines);
router.post("/machines",       authenticate, createMachine);
router.put("/machines/:id",    authenticate, updateMachine);
router.delete("/machines/:id", authenticate, deleteMachine);
router.post("/machines/:id/image", authenticate, uploadMachineImage.single("image"), handleMulterError, uploadMachineImageHandler);

// Production Plans
router.get("/plans",        authenticate, getPlans);
router.post("/plans",       authenticate, createPlan);
router.post("/plans/bulk",  authenticate, bulkUpsertPlans);
router.put("/plans/:id",    authenticate, updatePlan);
router.delete("/plans/:id", authenticate, deletePlan);

// Checkpoint Library
router.get("/checkpoint-library",        authenticate, getCheckpointLibrary);
router.post("/checkpoint-library",       authenticate, createCheckpointLibraryEntry);
router.put("/checkpoint-library/:id",    authenticate, updateCheckpointLibraryEntry);
router.delete("/checkpoint-library/:id", authenticate, deleteCheckpointLibraryEntry);
router.post("/checkpoint-library/:id/increment-usage", authenticate, incrementCheckpointUsage);

export default router;

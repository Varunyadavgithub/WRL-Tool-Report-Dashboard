import express from "express";
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateCategories,
} from "../controllers/auditReport/template.controller.js";
import {
  getAllAudits,
  getAuditById,
  createAudit,
  updateAudit,
  deleteAudit,
  submitAudit,
  approveAudit,
  rejectAudit,
  getAuditHistory,
  getAuditStats,
  exportAuditData,
} from "../controllers/auditReport/audit.controller.js";
// import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(authenticate);

// ==================== Template Routes ====================
router.get("/templates", getAllTemplates);
router.get("/templates/categories", getTemplateCategories);
router.get("/templates/:id", getTemplateById);
router.post("/templates", createTemplate);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);
router.post("/templates/:id/duplicate", duplicateTemplate);

// ==================== Audit Routes ====================
router.get("/audits", getAllAudits);
router.get("/audits/stats", getAuditStats);
router.get("/audits/export", exportAuditData);
router.get("/audits/:id", getAuditById);
router.get("/audits/:id/history", getAuditHistory);
router.post("/audits", createAudit);
router.put("/audits/:id", updateAudit);
router.delete("/audits/:id", deleteAudit);
router.post("/audits/:id/submit", submitAudit);
router.post("/audits/:id/approve", approveAudit);
router.post("/audits/:id/reject", rejectAudit);

export default router;

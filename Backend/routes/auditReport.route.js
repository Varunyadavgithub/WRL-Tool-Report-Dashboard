import express from "express";
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  createTemplateVersion,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  checkTemplateName,
  getTemplateHistory,
  getTemplateVersions,
  getTemplateVersionFile,
  compareTemplateVersions,
} from "../controllers/auditReport/template.controller.js";
import {
  getAllAudits,
  getAuditById,
  createAudit,
  updateAudit,
  deleteAudit,
  approveAudit,
  rejectAudit,
  getAuditHistory,
  getAuditStats,
  getAuditModelSummary,
} from "../controllers/auditReport/audit.controller.js";
import {
  downloadImage,
  getImageMetadata,
  serveImage,
} from "../controllers/auditReport/image.controller.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ==================== Image Routes ====================
router.get("/images/:filename/download", downloadImage);
router.get("/images/:filename/info", getImageMetadata);
router.get("/images/:filename", serveImage);

// ==================== Template Routes ====================
// check-name must be registered before the /:id routes — otherwise Express
// would match "check-name" as an :id param.
router.get("/templates/check-name", checkTemplateName);
router.get("/templates", getAllTemplates);
router.get("/templates/:id", getTemplateById);
router.post("/templates", createTemplate);
router.post("/templates/:id/version", createTemplateVersion);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);
router.post("/templates/:id/duplicate", duplicateTemplate);
router.get("/templates/:id/history", getTemplateHistory);
router.get("/templates/:id/versions", getTemplateVersions);
router.get("/templates/:id/compare", compareTemplateVersions);
router.get("/templates/:id/versions/:version", getTemplateVersionFile);

// ==================== Audit Routes ====================
router.get("/audits/stats", getAuditStats);
router.get("/audits/model-summary", getAuditModelSummary);
router.get("/audits", getAllAudits);
router.get("/audits/:id/history", getAuditHistory);
router.get("/audits/:id", getAuditById);
router.post("/audits", createAudit);
router.put("/audits/:id", updateAudit);
router.delete("/audits/:id", deleteAudit);
router.post("/audits/:id/approve", approveAudit);
router.post("/audits/:id/reject", rejectAudit);

export default router;

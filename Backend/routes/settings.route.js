import express from "express";
import {
  getMailServerConfig,
  updateMailServerConfig,
  resetMailServerConfig,
  testMailServerConfig,
} from "../controllers/settings/mailServer.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { requireSuperAdmin } from "../middlewares/roleGuard.js";

const router = express.Router();

// SMTP / outgoing-mail-server settings — Super Admin only, backed by the
// AppSettings table (falls back to .env when unset).
router.get("/mail-server", authenticate, requireSuperAdmin, getMailServerConfig);
router.put("/mail-server", authenticate, requireSuperAdmin, updateMailServerConfig);
router.delete("/mail-server", authenticate, requireSuperAdmin, resetMailServerConfig);
router.post("/mail-server/test", authenticate, requireSuperAdmin, testMailServerConfig);

export default router;

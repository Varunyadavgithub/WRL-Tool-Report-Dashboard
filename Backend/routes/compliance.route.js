import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getAllAssets,
  addAsset,
  addCalibrationRecord,
  getAssetWithHistory,
  getCertificates,
  uploadCertificate,
  uploadCalibrationReport,
} from "../controllers/compliance/calibiration.controller.js";
import { getCalibrationUsers } from "../controllers/compliance/calibrationUsers.controller.js";

import {
  uploadCalibrationFile,
  handleMulterError,
} from "../middlewares/uploadMiddleware.js";

const router = express.Router();

/* ===================== ROUTES ===================== */

// ADD or UPDATE ASSET + FILE
router.post(
  "/addAsset",
  authenticate,
  uploadCalibrationFile.single("file"),
  handleMulterError,
  addAsset,
);

// GET ALL ASSETS
router.get("/assets", authenticate, getAllAssets);

// ADD NEW CALIBRATION CYCLE (NO FILE)
router.post("/addCycle", authenticate, addCalibrationRecord);

// GET ASSET + HISTORY
router.get("/asset/:id", authenticate, getAssetWithHistory);

// GET CALIBRATION HISTORY
router.get("/certs/:id", authenticate, getCertificates);

// UPLOAD CERTIFICATE ONLY
router.post(
  "/uploadCert/:id",
  authenticate,
  uploadCalibrationFile.single("file"),
  handleMulterError,
  uploadCertificate,
);

// UPLOAD CALIBRATION REPORT
router.post(
  "/uploadReport/:id",
  authenticate,
  uploadCalibrationFile.single("file"),
  handleMulterError,
  uploadCalibrationReport,
);

// GET CALIBRATION USERS
router.get("/users/calibration", authenticate, getCalibrationUsers);

export default router;

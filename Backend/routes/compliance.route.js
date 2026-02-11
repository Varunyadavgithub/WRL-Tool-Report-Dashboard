import express from "express";
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
  uploadCalibrationReport as uploadCalibration,
  handleMulterError,
} from "../middlewares/uploadMiddleware.js";

const router = express.Router();

/* ===================== ROUTES ===================== */

// ADD or UPDATE ASSET + FILE
router.post(
  "/addAsset",
  uploadCalibration.single("file"),
  handleMulterError,
  addAsset
);

// GET ALL ASSETS
router.get("/assets", getAllAssets);

// ADD NEW CALIBRATION CYCLE (NO FILE)
router.post("/addCycle", addCalibrationRecord);

// GET ASSET + HISTORY
router.get("/asset/:id", getAssetWithHistory);

// GET CALIBRATION HISTORY
router.get("/certs/:id", getCertificates);

// UPLOAD CERTIFICATE ONLY
router.post(
  "/uploadCert/:id",
  uploadCalibration.single("file"),
  handleMulterError,
  uploadCertificate
);

// UPLOAD CALIBRATION REPORT
router.post(
  "/uploadReport/:id",
  uploadCalibration.single("file"),
  handleMulterError,
  uploadCalibrationReport
);

// GET CALIBRATION USERS
router.get("/users/calibration", getCalibrationUsers);

export default router;

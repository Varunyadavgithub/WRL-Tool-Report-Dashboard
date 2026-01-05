import express from "express";
import multer from "multer";

import {
  getAllAssets,
  addAsset,
  addCalibrationRecord,
  getAssetWithHistory,
  getCertificates,
  uploadCertificate,
  uploadCalibrationReport,
} from "../controllers/compliance/calibiration.js";

import { getCalibrationUsers } from "../controllers/compliance/users.controller.js";

const router = express.Router();

/* ---------- MULTER CONFIG ---------- */
const storage = multer.diskStorage({
  destination: "uploads/calibration/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

/* ---------- ROUTES ---------- */

// ✅ ADD or UPDATE ASSET + PDF
router.post(
  "/addAsset",
  upload.single("file"), // ✅ only ONE multer usage
  addAsset
);

// ✅ GET ALL ASSETS
router.get("/assets", getAllAssets);

// ✅ ADD NEW CALIBRATION CYCLE
router.post("/addCycle", addCalibrationRecord);

// ✅ GET ASSET + HISTORY
router.get("/asset/:id", getAssetWithHistory);

// ✅ GET CALIBRATION HISTORY
router.get("/certs/:id", getCertificates);

// ✅ UPLOAD CERTIFICATE ONLY
router.post("/uploadCert/:id", upload.single("file"), uploadCertificate);

router.post(
  "/uploadReport/:id",
  upload.single("file"),
  uploadCalibrationReport
);

router.get("/users/calibration", getCalibrationUsers);

export default router;

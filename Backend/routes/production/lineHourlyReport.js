import express from "express";
import {
  getFinalHPCAT,
  getFinalHPChoc,
  getFinalHPFrz,
  getFinalHPSUS,
  getFoamingHpFomA,
  getFoamingHpFomB,
  getFoamingHpFomCat,
  getManualPostHP,
  getPostHPCAT,
  getPostHPFrz,
  getPostHPSUS,
} from "../../controllers/production/lineHourlyReport.js";

const router = express.Router();

// FinalHP Routes
router.get("/final-hp-frz", getFinalHPFrz);
router.get("/final-hp-choc", getFinalHPChoc);
router.get("/final-hp-sus", getFinalHPSUS);
router.get("/final-hp-cat", getFinalHPCAT);

// PostHP Routes
router.get("/post-hp-frz", getPostHPFrz);
router.get("/manual-post-hp", getManualPostHP);
router.get("/post-hp-sus", getPostHPSUS);
router.get("/post-hp-cat", getPostHPCAT);

// FoamingHP Routes
router.get("/Foaming-hp-fom-a", getFoamingHpFomA);
router.get("/Foaming-hp-fom-b", getFoamingHpFomB);
router.get("/Foaming-hp-fom-cat", getFoamingHpFomCat);

export default router;

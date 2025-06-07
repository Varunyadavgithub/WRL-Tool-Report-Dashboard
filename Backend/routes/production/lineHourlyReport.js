import express from "express";
import {
  // getCategoryWiseCount,
  getFinalHPCAT,
  getFinalHPChoc,
  getFinalHPFrz,
  getFinalHPSUS,
  getFoamingHpFomA,
  getFoamingHpFomB,
  getFoamingHpFomCat,
  // getHourlyLoadingQuery,
  getPostHPCAT,
  getPostHPFrzA,
  getPostHPFrzB,
  getPostHPSUS,
} from "../../controllers/production/lineHourlyReport.js";

const router = express.Router();
// Route: Hourly Loading Count
// router.get("/hourly-loading", getHourlyLoadingQuery);
// Route: Category-wise Count per Station Group
// router.get("/category-wise-count", getCategoryWiseCount);

// FinalHP Routes
router.get("/final-hp-frz", getFinalHPFrz);
router.get("/final-hp-choc", getFinalHPChoc);
router.get("/final-hp-sus", getFinalHPSUS);
router.get("/final-hp-cat", getFinalHPCAT);

// PostHP Routes
router.get("/post-hp-frz-a", getPostHPFrzA);
router.get("/post-hp-frz-b", getPostHPFrzB);
router.get("/post-hp-sus", getPostHPSUS);
router.get("/post-hp-cat", getPostHPCAT);

// FoamingHP Routes
router.get("/Foaming-hp-fom-a", getFoamingHpFomA);
router.get("/Foaming-hp-fom-b", getFoamingHpFomB);
router.get("/Foaming-hp-fom-cat", getFoamingHpFomCat);

export default router;

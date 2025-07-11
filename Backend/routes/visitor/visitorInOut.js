import express from "express";
import {
  visitorIn,
  visitorOut,
  getVisitorLogs,
} from "../../controllers/visitor/visitorInOut.js";

const router = express.Router();

router.post("/in", visitorIn);
router.post("/out", visitorOut);
router.get("/logs", getVisitorLogs);

export default router;

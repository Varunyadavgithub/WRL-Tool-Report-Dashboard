import express from "express";
import {
  getEmployee,
  generateVisitorPass,
} from "../../controllers/visitor/visitorPass.js";

const router = express.Router();

router.get("/employees", getEmployee);
router.post("/generate-pass", generateVisitorPass);

export default router;

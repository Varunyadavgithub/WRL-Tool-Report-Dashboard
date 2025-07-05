import express from "express";
import { generateVisitorPass } from "../../controllers/visitor/visitorPass.js";

const router = express.Router();

router.post("/generate-pass", generateVisitorPass);

export default router;

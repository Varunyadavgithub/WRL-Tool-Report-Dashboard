import express from "express";
import { getComponentDetails } from "../../controllers/production/componentDetails.js";

const router = express.Router();

router.get("/component-details", getComponentDetails);

export default router;

import express from "express";
import {
  getModelName,
  modelNameUpdate,
} from "../../controllers/production/modelNameUpdate.js";

const router = express.Router();

router.get("/get-model-name", getModelName);
router.put("/update-model-name", modelNameUpdate);

export default router;
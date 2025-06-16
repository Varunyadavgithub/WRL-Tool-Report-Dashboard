import express from "express";
import {
  deleteLptRecipe,
  getLptRecipe,
  insertLptRecipe,
  updateLptRecipe,
} from "../../controllers/quality/LPTRecipe.js";

const router = express.Router();

router.get("/lpt-recipe", getLptRecipe);
router.delete("/lpt-recipe/:modelName", deleteLptRecipe);
router.post("/lpt-recipe", insertLptRecipe);
router.put("/lpt-recipe/:modelName", updateLptRecipe);

export default router;

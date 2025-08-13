import express from "express";
import {
  cancelReminder,
  createReminder,
  deleteReminder,
  getAllReminders,
} from "../controllers/reminder/task.js";

const router = express.Router();

router.post("/addReminder", createReminder);
router.get("/", getAllReminders);
router.delete("/:id", deleteReminder);
router.put("/cancel/:id", cancelReminder);

export default router;
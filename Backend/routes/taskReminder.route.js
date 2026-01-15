import express from "express";
import {
  createTask,
  getTasks,
  updateTaskStatus,
} from "../controllers/taskReminder/tasks.controller.js";

const router = express.Router();

router.post("/", createTask);
router.get("/", getTasks);
router.patch("/:taskId/status", updateTaskStatus);

export default router;

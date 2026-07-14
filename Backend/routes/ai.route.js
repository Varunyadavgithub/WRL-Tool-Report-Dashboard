import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  listSessions, createSession, getSessionMessages, postMessage, streamMessage,
} from "../controllers/ai.controller.js";

const router = Router();

router.get("/sessions",                      authenticate, listSessions);
router.post("/sessions",                     authenticate, createSession);
router.get("/sessions/:id/messages",         authenticate, getSessionMessages);
router.post("/sessions/:id/messages",        authenticate, postMessage);
router.post("/sessions/:id/messages/stream", authenticate, streamMessage);

export default router;

import { Router } from "express";
import { getMe } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/me", authMiddleware, getMe);

export default router;

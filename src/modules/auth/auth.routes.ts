import { Router } from "express";
import { register, login, refresh, logout } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

// Protected routes
router.post("/logout", authMiddleware, logout);

export default router;

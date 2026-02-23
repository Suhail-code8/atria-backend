import { Router } from "express";
import { register, login, refresh, logout, googleLogin } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

                
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/refresh", refresh);

                   
router.post("/logout", authMiddleware, logout);

export default router;

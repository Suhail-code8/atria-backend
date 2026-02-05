import { Router } from "express";
import * as controller from "./event.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

// Public routes
router.get("/", controller.listEvents);
router.get("/:eventId", controller.getEvent);

// Protected routes - Organizer only
router.post("/", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.createEvent);
router.put("/:eventId", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.updateEvent);
router.delete("/:eventId", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.deleteEvent);

export default router;

import { Router } from "express";
import * as controller from "./event.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";
import { transitionEvent } from "./event.controller";

const router = Router();

// Public routes
router.get("/", optionalAuthMiddleware, controller.listEvents);
router.get("/:eventId", controller.getEvent);

// Protected routes - Organizer only
router.post("/", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.createEvent);
router.put("/:eventId", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.updateEvent);
router.delete("/:eventId", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.deleteEvent);
router.post("/:eventId/transition", authMiddleware, roleMiddleware(UserRole.ORGANIZER), transitionEvent);
router.get("/:eventId/analytics", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.getEventAnalytics);


export default router;

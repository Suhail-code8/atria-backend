import { Router } from "express";
import * as controller from "./event.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";
import { transitionEvent } from "./event.controller";

const router = Router();

router.get("/", optionalAuthMiddleware, controller.listEvents);
router.get("/:eventId", optionalAuthMiddleware, controller.getEvent);

router.post("/", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.createEvent);
router.put("/:eventId", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.updateEvent);
router.delete("/:eventId", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.deleteEvent);
router.post("/:eventId/transition", authMiddleware, roleMiddleware(UserRole.ORGANIZER), transitionEvent);
router.get("/:eventId/analytics", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.getEventAnalytics);
router.post("/:eventId/poster/generate", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.generateEventPoster);
router.get("/:eventId/access-code", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.getAccessCode);
router.post("/:eventId/regenerate-access-code", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.regenerateAccessCode);

export default router;

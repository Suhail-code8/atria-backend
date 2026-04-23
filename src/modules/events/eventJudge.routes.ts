import { Router } from "express";
import * as controller from "./eventJudge.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

// Organizer assigns a judge
router.post(
  "/",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.assignJudge
);

// Organizer gets all judges for an event
router.get(
  "/event/:eventId",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.getEventJudges
);

// Judge gets all their event assignments
router.get(
  "/me/all",
  authMiddleware,
  controller.getMyAllAssignments
);

// Judge gets their own assignment for an event
router.get(
  "/event/:eventId/me",
  authMiddleware,
  controller.getMyJudgeAssignment
);

// Organizer updates a judge's assigned items
router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.updateJudgeItems
);

// Organizer removes a judge
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.removeJudge
);

export default router;

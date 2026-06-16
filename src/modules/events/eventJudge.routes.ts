import { Router } from "express";
import * as controller from "./eventJudge.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.assignJudge
);

router.get(
  "/event/:eventId",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.getEventJudges
);

router.get(
  "/me/all",
  authMiddleware,
  controller.getMyAllAssignments
);

router.get(
  "/event/:eventId/me",
  authMiddleware,
  controller.getMyJudgeAssignment
);

router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.updateJudgeItems
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.removeJudge
);

export default router;

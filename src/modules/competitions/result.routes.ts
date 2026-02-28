import { Router } from "express";
import * as controller from "./result.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.addResult
);

router.get(
  "/event/:eventId/leaderboards/teams",
  controller.getTeamLeaderboard
);

router.get(
  "/event/:eventId/leaderboards/individuals",
  controller.getIndividualLeaderboard
);

export default router;

import { Router } from "express";
import * as controller from "./team.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

router.post("/", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.createTeam);
router.post("/:id/members", authMiddleware, controller.addTeamMember);
router.get("/event/:eventId", controller.getEventTeams);
router.get("/:id", controller.getTeamById);

export default router;

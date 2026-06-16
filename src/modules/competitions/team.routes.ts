import { Router } from "express";
import * as controller from "./team.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

router.post("/", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.createTeam);

router.post("/participant", authMiddleware, controller.createParticipantTeam);

router.post("/join", authMiddleware, controller.joinTeamViaCode);

router.post("/:id/join", authMiddleware, controller.joinTeam);

router.post("/:id/assign", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.addTeamMemberByOrganizer);

router.post("/:id/members", authMiddleware, controller.addTeamMember);

router.patch("/:id/leader", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.setTeamLeader);

router.post("/:id/competition-items", authMiddleware, controller.enrollInCompetitionItems);
router.put("/:id/competition-items/:itemId/members", authMiddleware, controller.updateItemMembers);
router.get("/:id/competition-items", authMiddleware, controller.getTeamEnrollments);

router.get("/event/:eventId", controller.getEventTeams);
router.get("/:id", controller.getTeamById);

export default router;

import { Router } from "express";
import * as controller from "./team.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

// Organizer creates a team (with manager email)
router.post("/", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.createTeam);

// Participant creates their own team
router.post("/participant", authMiddleware, controller.createParticipantTeam);

// Join via invite code
router.post("/join", authMiddleware, controller.joinTeamViaCode);

// Join a specific team (self-enrollment)
router.post("/:id/join", authMiddleware, controller.joinTeam);

// Organizer assigns a participant to a specific team (with auto-advance)
router.post("/:id/assign", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.addTeamMemberByOrganizer);

// Self-managed member add (team manager)
router.post("/:id/members", authMiddleware, controller.addTeamMember);

// Set team leader (organizer)
router.patch("/:id/leader", authMiddleware, roleMiddleware(UserRole.ORGANIZER), controller.setTeamLeader);

// Enroll team in competition items (participant team leader)
router.post("/:id/competition-items", authMiddleware, controller.enrollInCompetitionItems);
router.put("/:id/competition-items/:itemId/members", authMiddleware, controller.updateItemMembers);
router.get("/:id/competition-items", authMiddleware, controller.getTeamEnrollments);

// Read
router.get("/event/:eventId", controller.getEventTeams);
router.get("/:id", controller.getTeamById);

export default router;

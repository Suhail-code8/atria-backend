import { Router } from "express";
import * as controller from "./participation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

/**
 * Protected routes (authenticated users)
 */

// POST /api/participation/:eventId/register - Register for an event
router.post(
  "/:eventId/register",
  authMiddleware,
  controller.registerForEvent
);

// GET /api/participation/:eventId/me - Get my participation status
router.get(
  "/:eventId/me",
  authMiddleware,
  controller.getMyParticipation
);

// GET /api/participation/me - Get my registered events
router.get(
  "/me",
  authMiddleware,
  controller.getMyRegistrations
);

// POST /api/participation/:eventId/withdraw - Withdraw from an event
router.post(
  "/:eventId/withdraw",
  authMiddleware,
  controller.withdrawFromEvent
);

/**
 * Organizer-only routes
 */

// GET /api/participation/:eventId/list - List all participants
router.get(
  "/:eventId/list",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.listParticipants
);

// PATCH /api/participation/:participationId/status - Update participation status
router.patch(
  "/:participationId/status",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.updateStatus
);

export default router;

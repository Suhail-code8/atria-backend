import { Router } from "express";
import * as controller from "./participation.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();
                                         
router.post(
  "/verify-payment",
  authMiddleware, 
  controller.verifyPayment
);

router.get(
  "/:eventId/payment-status",
  authMiddleware,
  controller.getPaymentStatus
);

router.post(
  "/:eventId/retry-payment",
  authMiddleware,
  controller.retryPayment
);
   
router.get(
  "/me",
  authMiddleware,
  controller.getMyRegistrations
);


router.post(
  "/:eventId/register",
  authMiddleware,
  controller.registerForEvent
);

                                                                   
router.get(
  "/:eventId/me",
  authMiddleware,
  controller.getMyParticipation
);

router.get(
  "/event/:eventId/leaderboard",
  optionalAuthMiddleware,
  controller.getEventLeaderboard
);

                                                                     
router.post(
  "/:eventId/withdraw",
  authMiddleware,
  controller.withdrawFromEvent
);
router.patch(
  "/:participationId",
  authMiddleware,
  controller.updateMyParticipation
);
               

                                                                
router.get(
  "/:eventId/list",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.listParticipants
);

                                                                                 
router.patch(
  "/:participationId/status",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.updateStatus
);

// ─── Workflow Engine ──────────────────────────────────────────────────────────
router.post(
  "/:participationId/advance",
  authMiddleware,
  controller.advanceWorkflow
);
router.post(
  "/:participationId/regress",
  authMiddleware,
  controller.regressWorkflow
);

export default router;


import { Router } from "express";
import * as controller from "./participation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

   
                                         
   

                                                                    
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
  "/me",
  authMiddleware,
  controller.getMyRegistrations
);

router.get(
  "/event/:eventId/leaderboard",
  controller.getEventLeaderboard
);

                                                                     
router.post(
  "/:eventId/withdraw",
  authMiddleware,
  controller.withdrawFromEvent
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

export default router;

import { Router } from "express";
import * as controller from "./announcement.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

router.post(
  "/:eventId",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.createAnnouncement
);

router.get("/:eventId", controller.getEventAnnouncements);

router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.updateAnnouncement
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.deleteAnnouncement
);

export default router;

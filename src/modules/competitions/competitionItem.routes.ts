import { Router } from "express";
import * as controller from "./competitionItem.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.createItem
);

router.get("/event/:eventId", controller.getEventItems);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.updateItem
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.deleteItem
);

export default router;

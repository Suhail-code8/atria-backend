import { Router } from "express";
import * as controller from "./category.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { UserRole } from "../users/user.model";

const router = Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.createCategory
);

router.get("/event/:eventId", controller.getEventCategories);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(UserRole.ORGANIZER),
  controller.deleteCategory
);

export default router;

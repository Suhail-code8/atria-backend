import { Router } from "express";
import * as notificationController from "./notification.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

router.get("/", notificationController.getNotifications);
router.post("/test", notificationController.triggerTestNotification);
router.patch("/:notificationId/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);

export default router;

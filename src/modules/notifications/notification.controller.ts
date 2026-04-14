import { Request, Response, NextFunction } from "express";
import * as notificationService from "./notification.service";

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const notifications = await notificationService.getNotificationsForUser(userId);
        res.status(200).json({ success: true, data: notifications });
    } catch (error) {
        next(error);
    }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { notificationId } = req.params;
        const notification = await notificationService.markAsRead(notificationId as string);
        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        await notificationService.markAllAsRead(userId);
        res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        next(error);
    }
};

export const triggerTestNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const notification = await notificationService.sendNotification({
            recipient: userId,
            type: "SYSTEM",
            title: "Test Alert! 🚀",
            message: "Hello from the Atria real-time notification engine!"
        });
        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
};

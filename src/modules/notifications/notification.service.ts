import mongoose from "mongoose";
import { Notification, INotification } from "./notification.model";
import { getIO } from "../../utils/socket";

interface CreateNotificationData {
    recipient: string | mongoose.Types.ObjectId;
    type: "PAYMENT" | "WAITLIST" | "SYSTEM" | "ANNOUNCEMENT" | "RESULT" | "SUBMISSION" | "REMINDER";
    title: string;
    message: string;
    actionUrl?: string;
    referenceId?: string;
}

export const sendNotification = async (
    data: CreateNotificationData
): Promise<INotification> => {
    try {
        // 1. Save to database
        const newNotification = await Notification.create(data);

        // 2. Broadcast via socket immediately if user is connected
        try {
            const io = getIO();
            // Emitting specifically to the room defined by user ID
            io.to(data.recipient.toString()).emit("new_notification", newNotification);
        } catch (socketError) {
            console.error("Socket error during sendNotification broadcast:", socketError);
            // We don't throw here to avoid failing the main API flow if sockets are down
        }

        return newNotification;
    } catch (error) {
        console.error("Database error creating notification:", error);
        throw error;
    }
};

export const getNotificationsForUser = async (userId: string) => {
    return await Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .limit(50);
};

export const markAsRead = async (notificationId: string) => {
    return await Notification.findByIdAndUpdate(
        notificationId,
        { read: true },
        { new: true }
    );
};

export const markAllAsRead = async (userId: string) => {
    return await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true }
    );
};

export const sendBulkNotifications = async (
    recipients: (string | mongoose.Types.ObjectId)[],
    data: Omit<CreateNotificationData, "recipient">
) => {
    try {
        const notifications = recipients.map((recipient) => ({
            ...data,
            recipient,
        }));

        // 1. Bulk insert to database
        const createdNotifications = await Notification.insertMany(notifications);

        // 2. Broadcast via socket to each recipient
        try {
            const io = getIO();
            createdNotifications.forEach((notification) => {
                io.to(notification.recipient.toString()).emit("new_notification", notification);
            });
        } catch (socketError) {
            console.error("Socket error during sendBulkNotifications broadcast:", socketError);
        }

        return createdNotifications;
    } catch (error) {
        console.error("Database error in sendBulkNotifications:", error);
        throw error;
    }
};

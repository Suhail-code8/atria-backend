import mongoose from "mongoose";
import { Notification, INotification } from "./notification.model";
import { getIO } from "../../utils/socket";

interface CreateNotificationData {
    recipient: string | mongoose.Types.ObjectId;
    type: "PAYMENT" | "WAITLIST" | "SYSTEM";
    title: string;
    message: string;
    actionUrl?: string;
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

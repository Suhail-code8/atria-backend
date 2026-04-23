import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
    recipient: mongoose.Types.ObjectId;
    type: "PAYMENT" | "WAITLIST" | "SYSTEM" | "ANNOUNCEMENT" | "RESULT" | "SUBMISSION" | "REMINDER" | "ALERT";
    title: string;
    message: string;
    read: boolean;
    actionUrl?: string;
    referenceId?: string; // ID of the related entity (e.g., eventId, submissionId)
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        recipient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["PAYMENT", "WAITLIST", "SYSTEM", "ANNOUNCEMENT", "RESULT", "SUBMISSION", "REMINDER", "ALERT"],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        read: {
            type: Boolean,
            default: false,
        },
        actionUrl: {
            type: String,
        },
        referenceId: {
            type: String,
        },
    },
    { timestamps: true }
);

export const Notification = mongoose.model<INotification>(
    "Notification",
    notificationSchema
);

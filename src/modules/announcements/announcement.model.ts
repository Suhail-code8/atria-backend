import mongoose, { Schema, Document } from "mongoose";
import { IEvent } from "../events/event.model";
import { IUser } from "../users/user.model";

export enum AnnouncementPriority {
  INFO = "INFO",       // Standard updates
  WARNING = "WARNING", // Important rule changes, deadlines
  URGENT = "URGENT"    // Venue changes, cancellations
}

export interface IAnnouncement extends Document {
  event: mongoose.Types.ObjectId | string | IEvent;
  createdBy: mongoose.Types.ObjectId | string | IUser;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPublished: boolean; // Draft mode vs Live
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true // Indexed because we will fetch all announcements FOR an event frequently
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    priority: {
      type: String,
      enum: Object.values(AnnouncementPriority),
      default: AnnouncementPriority.INFO
    },
    isPublished: {
      type: Boolean,
      default: true // Defaulting to true makes it easier for quick updates, but can be set to false for drafts
    },
    publishedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Sort by newest first by default when querying
announcementSchema.index({ event: 1, publishedAt: -1 });

export const Announcement = mongoose.model<IAnnouncement>("Announcement", announcementSchema);
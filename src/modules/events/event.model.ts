import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "../users/user.model";

export enum EventType {
  CONFERENCE = "CONFERENCE",
  FEST = "FEST",
  PROGRAM = "PROGRAM",
  CUSTOM = "CUSTOM"
}

export enum EventStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED"
}

export interface IEvent extends Document {
  title: string;
  description: string;
  eventType: EventType;
  startDate: Date;
  endDate: Date;
  createdBy: mongoose.Types.ObjectId | string | IUser;
  isPublic: boolean;
  status: EventStatus;
  hasTeams?: boolean;
  hasCategories?: boolean;
  hasJudging?: boolean;
  hasScoring?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    eventType: {
      type: String,
      enum: Object.values(EventType),
      required: true
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isPublic: { type: Boolean, default: true },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.DRAFT
    },
    hasTeams: { type: Boolean, default: false },
    hasCategories: { type: Boolean, default: false },
    hasJudging: { type: Boolean, default: false },
    hasScoring: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Event = mongoose.model<IEvent>("Event", eventSchema);

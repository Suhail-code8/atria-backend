import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "../users/user.model";
import { IEvent } from "../events/event.model";

/**
 * Participation Role Enum
 */
export enum ParticipationRole {
  PARTICIPANT = "PARTICIPANT",
  JUDGE = "JUDGE",
  MENTOR = "MENTOR"
}

/**
 * Participation Status Enum
 */
export enum ParticipationStatus {
  REGISTERED = "REGISTERED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN"
}

/**
 * Participation Document Interface
 */
export interface IParticipation extends Document {
  event: mongoose.Types.ObjectId | string | IEvent;
  user: mongoose.Types.ObjectId | string | IUser;
  status: ParticipationStatus;
  role: ParticipationRole;
  metadata?: Record<string, any>;
  registeredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Participation Schema
 */
const participationSchema = new Schema<IParticipation>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: Object.values(ParticipationStatus),
      default: ParticipationStatus.REGISTERED
    },

    role: {
      type: String,
      enum: Object.values(ParticipationRole),
      default: ParticipationRole.PARTICIPANT
    },

    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    },

    registeredAt: {
      type: Date,
      default: () => new Date()
    }
  },
  {
    timestamps: true
  }
);

/**
 * Compound Unique Index: Prevent duplicate registrations per event
 */
participationSchema.index({ event: 1, user: 1 }, { unique: true });

export const Participation = mongoose.model<IParticipation>(
  "Participation",
  participationSchema
);

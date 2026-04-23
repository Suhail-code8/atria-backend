import mongoose, { Document, Schema } from "mongoose";
import { IEvent } from "../events/event.model";
import { IUser } from "../users/user.model";
import { ICompetitionItem } from "../competitions/competitionItem.model";

export interface IEventJudge extends Document {
  event: mongoose.Types.ObjectId | string | IEvent;
  user: mongoose.Types.ObjectId | string | IUser;
  assignedItems: (mongoose.Types.ObjectId | string | ICompetitionItem)[];
  createdAt?: Date;
  updatedAt?: Date;
}

const eventJudgeSchema = new Schema<IEventJudge>(
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
    assignedItems: [
      {
        type: Schema.Types.ObjectId,
        ref: "CompetitionItem"
      }
    ]
  },
  {
    timestamps: true
  }
);

// A user can only be a judge once per event
eventJudgeSchema.index({ event: 1, user: 1 }, { unique: true });
eventJudgeSchema.index({ event: 1 });

export const EventJudge = mongoose.model<IEventJudge>("EventJudge", eventJudgeSchema);

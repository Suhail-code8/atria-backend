import mongoose, { Document, Schema } from "mongoose";
import { IEvent } from "../events/event.model";
import { ICompetitionItem } from "./competitionItem.model";
import { ITeam } from "./team.model";
import { IUser } from "../users/user.model";
import { recalculateIndividualPoints } from "./point.service";

export enum CompetitionEntryStatus {
  REGISTERED = "REGISTERED",
  CHECKED_IN = "CHECKED_IN",
  DISQUALIFIED = "DISQUALIFIED"
}

export interface ICompetitionEntry extends Document {
  event: mongoose.Types.ObjectId | string | IEvent;
  item: mongoose.Types.ObjectId | string | ICompetitionItem;
  team: mongoose.Types.ObjectId | string | ITeam;
  participants: Array<mongoose.Types.ObjectId | string | IUser>;
  status: CompetitionEntryStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const competitionEntrySchema = new Schema<ICompetitionEntry>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "CompetitionItem",
      required: true
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      default: []
    },
    status: {
      type: String,
      enum: Object.values(CompetitionEntryStatus),
      default: CompetitionEntryStatus.REGISTERED
    }
  },
  {
    timestamps: true
  }
);

competitionEntrySchema.index({ event: 1, item: 1, team: 1 });

competitionEntrySchema.pre("save", async function () {
  if (this.isModified("participants")) {
    try {
      const oldDoc = await (this.constructor as any).findById(this._id);
      if (oldDoc) {
        (this as any)._oldParticipantIds = oldDoc.participants.map((p: any) => p.toString());
      }
    } catch (err) {
      console.error("Error in CompetitionEntry pre-save hook:", err);
    }
  }
});

competitionEntrySchema.post("save", async function (doc) {
  if (this.isModified("participants")) {
    const currentParticipantIds = doc.participants.map((p) => p.toString());
    const oldParticipantIds = (this as any)._oldParticipantIds || [];
    const allAffectedIds = Array.from(new Set([...currentParticipantIds, ...oldParticipantIds]));

    if (allAffectedIds.length > 0) {
      await recalculateIndividualPoints(
        doc.event as string,
        allAffectedIds
      );
    }
  }
});

export const CompetitionEntry = mongoose.model<ICompetitionEntry>(
  "CompetitionEntry",
  competitionEntrySchema
);

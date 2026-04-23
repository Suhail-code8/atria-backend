import mongoose, { Document, Schema } from "mongoose";
import { IEvent } from "../events/event.model";
import { IUser } from "../users/user.model";
import { ICategory } from "./category.model";
import { recalculateIndividualPoints } from "./point.service";

export enum TeamRole {
  MANAGER = "MANAGER",
  ASST_MANAGER = "ASST_MANAGER",
  CAPTAIN = "CAPTAIN",
  MEMBER = "MEMBER"
}

export interface ITeamMember {
  user: mongoose.Types.ObjectId | string | IUser;
  role: TeamRole;
  category?: mongoose.Types.ObjectId | string | ICategory;
}

export interface ITeam extends Document {
  name: string;
  event: mongoose.Types.ObjectId | string | IEvent;
  members: ITeamMember[];
  totalPoints: number;
  inviteCode?: string;
  leaderId?: mongoose.Types.ObjectId | string;
  createdAt?: Date;
  updatedAt?: Date;
}

const teamMemberSchema = new Schema<ITeamMember>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: Object.values(TeamRole),
      required: true
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category"
    }
  },
  {
    _id: false
  }
);

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },
    members: {
      type: [teamMemberSchema],
      default: []
    },
    totalPoints: {
      type: Number,
      default: 0
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    leaderId: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

teamSchema.index({ event: 1 });

teamSchema.pre("save", async function () {
  if (this.isModified("members")) {
    try {
      const oldDoc = await (this.constructor as any).findById(this._id);
      if (oldDoc) {
        (this as any)._oldMemberIds = oldDoc.members.map((m: any) => m.user.toString());
      }
    } catch (err) {
      console.error("Error in Team pre-save hook:", err);
    }
  }
});

teamSchema.post("save", async function (doc) {
  if (this.isModified("members")) {
    const currentMemberIds = doc.members.map((m) => m.user.toString());
    const oldMemberIds = (this as any)._oldMemberIds || [];
    const allAffectedUserIds = Array.from(new Set([...currentMemberIds, ...oldMemberIds]));

    if (allAffectedUserIds.length > 0) {
      await recalculateIndividualPoints(
        doc.event as string,
        allAffectedUserIds
      );
    }
  }
});

export const Team = mongoose.model<ITeam>("Team", teamSchema);

import mongoose, { Document, Schema } from "mongoose";
import { IEvent } from "../events/event.model";
import { IUser } from "../users/user.model";
import { ICategory } from "./category.model";

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
    }
  },
  {
    timestamps: true
  }
);

teamSchema.index({ event: 1 });

export const Team = mongoose.model<ITeam>("Team", teamSchema);

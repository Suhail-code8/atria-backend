import mongoose, { Document, Schema } from "mongoose";
import { IEvent } from "../events/event.model";

export enum ItemType {
  INDIVIDUAL = "INDIVIDUAL",
  GROUP = "GROUP"
}

export interface IPlacePoints {
  first: number;
  second: number;
  third: number;
}

export interface IGradePoints {
  a: number;
  b: number;
  c: number;
}

export interface ICompetitionItem extends Document {
  name: string;
  event: mongoose.Types.ObjectId | string | IEvent;
  type: ItemType;
  allowedCategories: mongoose.Types.ObjectId[];
  minParticipantsPerTeam: number;
  maxParticipantsPerTeam: number;
  maxTotalParticipants?: number;
  placePoints: IPlacePoints;
  gradePoints: IGradePoints;
  createdAt?: Date;
  updatedAt?: Date;
}

const competitionItemSchema = new Schema<ICompetitionItem>(
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
    type: {
      type: String,
      enum: Object.values(ItemType),
      required: true
    },
    allowedCategories: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Category"
        }
      ],
      default: []
    },
    minParticipantsPerTeam: {
      type: Number,
      default: 1
    },
    maxParticipantsPerTeam: {
      type: Number,
      default: 1
    },
    maxTotalParticipants: {
      type: Number
    },
    placePoints: {
      first: {
        type: Number,
        default: 10
      },
      second: {
        type: Number,
        default: 6
      },
      third: {
        type: Number,
        default: 2
      }
    },
    gradePoints: {
      a: {
        type: Number,
        default: 5
      },
      b: {
        type: Number,
        default: 3
      },
      c: {
        type: Number,
        default: 1
      }
    }
  },
  {
    timestamps: true
  }
);

export const CompetitionItem = mongoose.model<ICompetitionItem>(
  "CompetitionItem",
  competitionItemSchema
);

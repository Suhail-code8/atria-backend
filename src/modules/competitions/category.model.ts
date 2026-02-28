import mongoose, { Document, Schema } from "mongoose";
import { IEvent } from "../events/event.model";

export interface ICategory extends Document {
  name: string;
  event: mongoose.Types.ObjectId | string | IEvent;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const categorySchema = new Schema<ICategory>(
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
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

categorySchema.index({ event: 1 });

export const Category = mongoose.model<ICategory>("Category", categorySchema);

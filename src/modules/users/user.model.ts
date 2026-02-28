import mongoose, { Schema, Document } from "mongoose";

export enum UserRole {
  ORGANIZER = "ORGANIZER",
  PARTICIPANT = "PARTICIPANT",
  JUDGE = "JUDGE"
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  refreshToken: string | null;
  isGoogleAuth?: boolean;
  isPlaceholder?: boolean;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true
    },
    refreshToken: {
      type: String,
      default: null
    },
    isPlaceholder: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);

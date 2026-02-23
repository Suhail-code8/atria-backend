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
  REGISTRATION_OPEN = "REGISTRATION_OPEN",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  ARCHIVED = "ARCHIVED"
}

   
                                     
   
export interface EventCapabilities {
  registration: boolean;
  submissions: boolean;
  review: boolean;
  teams: boolean;
  scoring: boolean;
  sessions: boolean;
  realtime: boolean;
}

   
                                    
   
export interface IRegistrationFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'select' | 'checkbox' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

   
                           
   
export interface IEvent extends Document {
  title: string;
  description: string;
  eventType: EventType;

  startDate: Date;
  endDate: Date;

  registrationStartDate?: Date;
  registrationEndDate?: Date;

  createdBy: mongoose.Types.ObjectId | string | IUser;
  isPublic: boolean;

  status: EventStatus;

  capabilities: EventCapabilities;

  registrationForm?: IRegistrationFormField[];

  createdAt?: Date;
  updatedAt?: Date;
}

   
               
   
const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    eventType: {
      type: String,
      enum: Object.values(EventType),
      required: true
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    registrationStartDate: {
      type: Date
    },

    registrationEndDate: {
      type: Date
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    isPublic: {
      type: Boolean,
      default: true
    },

    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.DRAFT
    },

    capabilities: {
      registration: { type: Boolean, default: false },
      submissions: { type: Boolean, default: false },
      review: { type: Boolean, default: false },
      teams: { type: Boolean, default: false },
      scoring: { type: Boolean, default: false },
      sessions: { type: Boolean, default: false },
      realtime: { type: Boolean, default: false }
    },

    registrationForm: [{
      id: { type: String, required: true },
      label: { type: String, required: true },
      type: { 
        type: String, 
        enum: ['text', 'number', 'email', 'select', 'checkbox', 'textarea'],
        required: true 
      },
      required: { type: Boolean, default: false },
      options: [{ type: String }],
      placeholder: { type: String }
    }]
  },
  {
    timestamps: true
  }
);

export const Event = mongoose.model<IEvent>("Event", eventSchema);

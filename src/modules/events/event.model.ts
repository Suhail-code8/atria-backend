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

export interface IScoringRules {
  places: Map<string, number>;
  grades: Map<string, number>;
}

export interface IEventLimits {
  maxIndividualItemsPerParticipant?: number;
  maxGroupItemsPerParticipant?: number;
}

   
                           
   
export interface IEvent extends Document {
  title: string;
  description: string;
  location: string;
  posterUrl?: string;
  eventType: EventType;

  startDate: Date;
  endDate: Date;

  registrationStartDate?: Date;
  registrationEndDate?: Date;

  createdBy: mongoose.Types.ObjectId | string | IUser;
  isPublic: boolean;
  
  isPaid: boolean;
  price: number;
  totalSeats?: number;
  availableSeats?: number;

  status: EventStatus;

  capabilities: EventCapabilities;

  isCompetition: boolean;
  isLeaderboardPublished: boolean;
  scoringRules: IScoringRules;
  limits: IEventLimits;

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

    location: {
      type: String,
      trim: true,
      default: ""
    },

    posterUrl: {
      type: String,
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

    isPaid: {
      type: Boolean,
      default: false
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative']
    },
    totalSeats: {
      type: Number,
      min: [1, 'Total seats must be at least 1 if specified']
    },
    availableSeats: {
      type: Number,
      min: [0, 'Event is sold out!']  
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

    isCompetition: {
      type: Boolean,
      default: false
    },

    isLeaderboardPublished: {
      type: Boolean,
      default: false
    },

    scoringRules: {
      places: {
        type: Map,
        of: Number,
        default: {}
      },
      grades: {
        type: Map,
        of: Number,
        default: {}
      }
    },

    limits: {
      maxIndividualItemsPerParticipant: {
        type: Number
      },
      maxGroupItemsPerParticipant: {
        type: Number
      }
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


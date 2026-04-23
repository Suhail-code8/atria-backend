import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "../users/user.model";

// ─── Workflow Engine Types ────────────────────────────────────────────────────

export enum WorkflowNodeType {
  REGISTRATION       = "REGISTRATION",
  PAYMENT            = "PAYMENT",
  TEAM_FORMATION     = "TEAM_FORMATION",
  COMPETITION_OPT_IN = "COMPETITION_OPT_IN",
  JUDGING_ROUND      = "JUDGING_ROUND",
  LEADERBOARD        = "LEADERBOARD",
  SUBMISSION         = "SUBMISSION",
  ONBOARDING_COMPLETE = "ONBOARDING_COMPLETE"
}

export interface IWorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label?: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface IWorkflowEdge {
  source: string;
  target: string;
  condition?: Record<string, any>;
}

export interface IFeatureModuleConfig {
  enabled: boolean;
  config?: Record<string, any>;
}

export interface IFeatureModules {
  leaderboard?: IFeatureModuleConfig;
  judgingFeedback?: IFeatureModuleConfig;
  teamHub?: IFeatureModuleConfig;
  announcements?: IFeatureModuleConfig;
}

export interface IWorkflow {
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  featureModules?: IFeatureModules;
}

   
              
   
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
  requiresApproval: boolean;

  status: EventStatus;

  capabilities: EventCapabilities;

  isCompetition: boolean;
  isLeaderboardPublished: boolean;
  scoringRules: IScoringRules;
  limits: IEventLimits;

  registrationForm?: IRegistrationFormField[];

  accessCode?: string;

  generatedPosters: {
    style: string;
    url: string;
    prompt: string;
    createdAt: Date;
  }[];

  // ─── Workflow Engine ──────────────────────────────────────────────────────
  workflow: IWorkflow;
  // ─────────────────────────────────────────────────────────────────────────

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
      type: Date
    },

    endDate: {
      type: Date
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
    requiresApproval: {
      type: Boolean,
      default: false
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

    accessCode: {
      type: String,
      index: true,
      sparse: true
    },
    
    generatedPosters: [{
      style: { type: String, required: true },
      url: { type: String, required: true },
      prompt: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],

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
    }],

    // ─── Workflow Engine ────────────────────────────────────────────────────
    workflow: {
      nodes: [
        {
          id:       { type: String, required: true },
          type:     { type: String, enum: Object.values(WorkflowNodeType), required: true },
          label:    { type: String },
          config:   { type: Schema.Types.Mixed, default: {} },
          position: { x: { type: Number }, y: { type: Number } }
        }
      ],
      edges: [
        {
          source:    { type: String, required: true },
          target:    { type: String, required: true },
          condition: { type: Schema.Types.Mixed }
        }
      ],
      featureModules: {
        leaderboard:    { enabled: { type: Boolean, default: false }, config: { type: Schema.Types.Mixed, default: {} } },
        judgingFeedback:{ enabled: { type: Boolean, default: false }, config: { type: Schema.Types.Mixed, default: {} } },
        teamHub:        { enabled: { type: Boolean, default: false }, config: { type: Schema.Types.Mixed, default: {} } },
        announcements:  { enabled: { type: Boolean, default: false }, config: { type: Schema.Types.Mixed, default: {} } }
      }
    }
  },
  {
    timestamps: true
  }
);

export const Event = mongoose.model<IEvent>("Event", eventSchema);


import mongoose, { Schema, Document } from "mongoose";
import { IEvent } from "../events/event.model";
import { IParticipation } from "../participation/participation.model";

   
                    
   
export enum ContentType {
  ABSTRACT = "ABSTRACT",
  PAPER = "PAPER",
  FILE = "FILE",
  LINK = "LINK",
  CUSTOM = "CUSTOM"
}

   
                         
   
export enum SubmissionStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED"
}

   
                        
   
export interface ISubmissionFile {
  publicId: string;
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
}

   
                   
   
export interface IReview {
  score: number;         
  comment: string;
  feedbackFile?: {
    publicId: string;
    url: string;
  };
  reviewedBy: mongoose.Types.ObjectId | string;
  reviewedAt: Date;
}

   
                                
   
export interface ISubmission extends Document {
  event: mongoose.Types.ObjectId | string | IEvent;
  participant: mongoose.Types.ObjectId | string | IParticipation;
  title: string;
  description?: string;
  type: ContentType;
  content?: string;
  file?: ISubmissionFile;
  status: SubmissionStatus;
  review?: IReview;
  metadata?: Map<string, any>;
  submittedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

   
                    
   
const submissionSchema = new Schema<ISubmission>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },

    participant: {
      type: Schema.Types.ObjectId,
      ref: "Participation",
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true
    },

    type: {
      type: String,
      enum: Object.values(ContentType),
      required: true
    },

    content: {
      type: String
    },

    file: {
      publicId: { type: String },
      url: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number }
    },

    status: {
      type: String,
      enum: Object.values(SubmissionStatus),
      default: SubmissionStatus.DRAFT
    },
review: {
      score: {
        type: Number,
        min: 0,
        max: 100
      },
      comment: {
        type: String
      },
      feedbackFile: {
        publicId: { type: String },
        url: { type: String }
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
      },
      reviewedAt: {
        type: Date
      }
    },

    
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    },

    submittedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

                          
submissionSchema.index({ event: 1 });
submissionSchema.index({ participant: 1 });

                                                              
submissionSchema.index({ event: 1, participant: 1 }, { unique: true });

export const Submission = mongoose.model<ISubmission>("Submission", submissionSchema);

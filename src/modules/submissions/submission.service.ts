import { Submission, ISubmission, SubmissionStatus, ContentType, ISubmissionFile } from "./submission.model";
import { Event } from "../events/event.model";
import { Participation, ParticipationRole, ParticipationStatus } from "../participation/participation.model";
import cloudinary from "../../config/cloudinary";
import mongoose from "mongoose";

   
                      
   
          
                     
                                                   
                                                       
                                       
   
export const createSubmission = async (
  eventId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    type: ContentType;
    content?: string;
    metadata?: Record<string, any>;
    file?: ISubmissionFile;
  }
): Promise<ISubmission> => {
                     
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error: any = new Error("Invalid event ID");
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error: any = new Error("Invalid user ID");
    error.statusCode = 400;
    throw error;
  }

                         
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

                                     
  if (!event.capabilities.submissions) {
    const error: any = new Error("Event does not allow submissions");
    error.statusCode = 400;
    throw error;
  }

                                              
  const participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId),
    role: ParticipationRole.PARTICIPANT
  });

  if (!participation) {
    const error: any = new Error("You must be a registered participant to create a submission");
    error.statusCode = 403;
    throw error;
  }

                                                               
  if (participation.status !== ParticipationStatus.REGISTERED && 
      participation.status !== ParticipationStatus.APPROVED) {
    const error: any = new Error(`Cannot create submission. Participation status: ${participation.status}`);
    error.statusCode = 400;
    throw error;
  }

  // 5️⃣ Create submission in DRAFT status
  try {
    const submission = await Submission.create({
      event: eventId,
      participant: participation._id,
      title: data.title,
      description: data.description,
      type: data.type,
      file: data.file,
      content: data.content,
      metadata: data.metadata,
      status: SubmissionStatus.DRAFT
    });

    return submission.populate([
      "event",
      {
        path: "participant",
        populate: { path: "user", select: "name email" }
      }
    ]);
  } catch (err: any) {
    // Handle unique constraint violation (duplicate submission)
    if (err.code === 11000) {
      const error: any = new Error("You already have a submission for this event");
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

/**
 * Update a submission
 * 
 * Guards:
 * - Submission must exist
 * - User must own the submission (via participation)
 * - Submission must be in DRAFT status (locked after SUBMITTED)
 */
export const updateSubmission = async (
  submissionId: string,
  userId: string,
  data: {
    title?: string;
    description?: string;
    type?: ContentType;
    content?: string;
    metadata?: Record<string, any>;
    file?: ISubmissionFile;
  }
): Promise<ISubmission> => {
  // 1️⃣ Validate ID
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const error: any = new Error("Invalid submission ID");
    error.statusCode = 400;
    throw error;
  }

  // 2️⃣ Submission must exist
  const submission = await Submission.findById(submissionId).populate("participant");
  if (!submission) {
    const error: any = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  // 3️⃣ User must own the submission
  const participation = submission.participant as any;
  if (participation.user.toString() !== userId) {
    const error: any = new Error("Forbidden: You can only update your own submissions");
    error.statusCode = 403;
    throw error;
  }

  // 4️⃣ Submission must be DRAFT (crucial: read-only after submitted)
  if (submission.status !== SubmissionStatus.DRAFT) {
    const error: any = new Error(
      `Cannot update submission. Current status: ${submission.status}. Only DRAFT submissions can be edited.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 5️⃣ Handle file replacement
  if (data.file !== undefined) {
    // Delete old file from Cloudinary if exists
    if (submission.file && submission.file.publicId) {
      try {
        await cloudinary.uploader.destroy(submission.file.publicId);
      } catch (err) {
        console.error('Error deleting old file from Cloudinary:', err);
        // Continue anyway - don't block the update
      }
    }
    // Set new file
    submission.file = data.file;
  }

  // 6️⃣ Update other fields
  if (data.title !== undefined) submission.title = data.title;
  if (data.description !== undefined) submission.description = data.description;
  if (data.type !== undefined) submission.type = data.type;
  if (data.content !== undefined) submission.content = data.content;
  if (data.metadata !== undefined) {
    submission.metadata = new Map(Object.entries(data.metadata));
  }

  await submission.save();
  return submission.populate([
    "event",
    {
      path: "participant",
      populate: { path: "user", select: "name email" }
    }
  ]);
};

/**
 * Submit a submission (transition from DRAFT to SUBMITTED)
 * 
 * Guards:
 * - Submission must exist
 * - User must own the submission
 * - Submission must be in DRAFT status
 * - Records submittedAt timestamp
 */
export const submitSubmission = async (
  submissionId: string,
  userId: string
): Promise<ISubmission> => {
  // 1️⃣ Validate ID
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const error: any = new Error("Invalid submission ID");
    error.statusCode = 400;
    throw error;
  }

  // 2️⃣ Submission must exist
  const submission = await Submission.findById(submissionId).populate("participant");
  if (!submission) {
    const error: any = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  // 3️⃣ User must own the submission
  const participation = submission.participant as any;
  if (participation.user.toString() !== userId) {
    const error: any = new Error("Forbidden: You can only submit your own submissions");
    error.statusCode = 403;
    throw error;
  }

  // 4️⃣ Submission must be DRAFT
  if (submission.status !== SubmissionStatus.DRAFT) {
    const error: any = new Error(
      `Cannot submit. Current status: ${submission.status}. Only DRAFT submissions can be submitted.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 5️⃣ Transition to SUBMITTED state
  submission.status = SubmissionStatus.SUBMITTED;
  submission.submittedAt = new Date();

  await submission.save();
  return submission.populate([
    "event",
    {
      path: "participant",
      populate: { path: "user", select: "name email" }
    }
  ]);
};

/**
 * Get a single submission
 * 
 * Guards:
 * - Submission must exist
 * - User must be the owner OR have ORGANIZER/JUDGE role for that event
 */
export const getSubmission = async (
  submissionId: string,
  userId: string
): Promise<ISubmission> => {
  // 1️⃣ Validate ID
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const error: any = new Error("Invalid submission ID");
    error.statusCode = 400;
    throw error;
  }

  // 2️⃣ Submission must exist
  const submission = await Submission.findById(submissionId)
    .populate({
      path: "participant",
      populate: {
        path: "user",
        select: "name email"
      }
    })
    .populate("event");

  if (!submission) {
    const error: any = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  // 3️⃣ Check access: Owner OR Organizer/Judge
  const participation = submission.participant as any;
  const isOwner = participation.user.toString() === userId;

  if (!isOwner) {
    // Check if user has ORGANIZER or JUDGE role for this event
    const eventId = (submission.event as any)._id || submission.event;
    const userParticipation = await Participation.findOne({
      event: eventId,
      user: new mongoose.Types.ObjectId(userId),
      role: { $in: [ParticipationRole.JUDGE] }
    });

    // Check if user is the event creator (organizer)
    const event = submission.event as any;
    const isEventCreator = event.createdBy.toString() === userId;

    if (!userParticipation && !isEventCreator) {
      const error: any = new Error("Forbidden: You do not have access to this submission");
      error.statusCode = 403;
      throw error;
    }
  }

  return submission;
};

/**
 * List the current user's submissions for an event
 */
export const listMySubmissions = async (
  eventId: string,
  userId: string
): Promise<ISubmission[]> => {
  // 1️⃣ Validate event ID
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error: any = new Error("Invalid event ID");
    error.statusCode = 400;
    throw error;
  }

  // 2️⃣ Find user's participation
  const participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId)
  });

  if (!participation) {
    // Return empty array if not a participant
    return [];
  }

  // 3️⃣ Find submissions for this participation
  const submissions = await Submission.find({
    event: new mongoose.Types.ObjectId(eventId),
    participant: participation._id
  })
    .populate("event")
    .populate("participant")
    .sort({ createdAt: -1 });

  return submissions;
};

/**
 * List all submissions for an event (Organizer/Judge only)
 */
export const listEventSubmissions = async (
  eventId: string,
  userId: string
): Promise<ISubmission[]> => {
  // 1️⃣ Validate event ID
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error: any = new Error("Invalid event ID");
    error.statusCode = 400;
    throw error;
  }

  // 2️⃣ Event must exist
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  // 3️⃣ User must be event creator (organizer) OR judge
  const isEventCreator = event.createdBy.toString() === userId;
  
  const userParticipation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId),
    role: { $in: [ParticipationRole.JUDGE] }
  });

  if (!isEventCreator && !userParticipation) {
    const error: any = new Error("Forbidden: Only organizers and judges can list all submissions");
    error.statusCode = 403;
    throw error;
  }

  // 4️⃣ Return all submissions for this event
  const submissions = await Submission.find({
    event: new mongoose.Types.ObjectId(eventId)
  })
    .populate({
      path: "participant",
      populate: {
        path: "user",
        select: "name email"
      }
    })
    .populate("event")
    .sort({ submittedAt: -1, createdAt: -1 });

  return submissions;
};

/**
 * Update submission status (Organizer/Judge only)
 * Used for review workflow: UNDER_REVIEW, ACCEPTED, REJECTED
 */
export const updateSubmissionStatus = async (
  submissionId: string,
  userId: string,
  newStatus: SubmissionStatus
): Promise<ISubmission> => {
  // 1️⃣ Validate ID
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const error: any = new Error("Invalid submission ID");
    error.statusCode = 400;
    throw error;
  }

  // 2️⃣ Validate status transition
  const allowedStatuses = [
    SubmissionStatus.UNDER_REVIEW,
    SubmissionStatus.ACCEPTED,
    SubmissionStatus.REJECTED
  ];

  if (!allowedStatuses.includes(newStatus)) {
    const error: any = new Error(
      `Invalid status. Allowed: ${allowedStatuses.join(", ")}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 3️⃣ Submission must exist
  const submission = await Submission.findById(submissionId).populate("event");
  if (!submission) {
    const error: any = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  // 4️⃣ User must be event creator (organizer) OR judge
  const event = submission.event as any;
  const isEventCreator = event.createdBy.toString() === userId;

  const userParticipation = await Participation.findOne({
    event: event._id,
    user: new mongoose.Types.ObjectId(userId),
    role: { $in: [ParticipationRole.JUDGE] }
  });

  if (!isEventCreator && !userParticipation) {
    const error: any = new Error("Forbidden: Only organizers and judges can update submission status");
    error.statusCode = 403;
    throw error;
  }

  // 5️⃣ Update status
  submission.status = newStatus;
  await submission.save();

  return submission.populate([
    {
      path: "event",
      select: "title"
    },
    {
      path: "participant",
      populate: {
        path: "user",
        select: "name email"
      }
    }
  ]);
};

/**
 * Review/Grade a submission
 * 
 * Guards:
 * - User must be ORGANIZER (event creator) or JUDGE
 * - Submission cannot be DRAFT (must be SUBMITTED or UNDER_REVIEW)
 * - Sets review fields (score, comment, reviewedBy, reviewedAt)
 * - Updates status to ACCEPTED or REJECTED
 */
export const reviewSubmission = async (
  submissionId: string,
  userId: string,
  data: {
    score: number;
    comment?: string;
    status: SubmissionStatus;
  }
): Promise<ISubmission> => {
  // 1️⃣ Validate ID
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const error: any = new Error("Invalid submission ID");
    error.statusCode = 400;
    throw error;
  }

  // 2️⃣ Validate score
  if (data.score < 0 || data.score > 100) {
    const error: any = new Error("Score must be between 0 and 100");
    error.statusCode = 400;
    throw error;
  }

  // 3️⃣ Validate status (must be ACCEPTED or REJECTED)
  if (data.status !== SubmissionStatus.ACCEPTED && data.status !== SubmissionStatus.REJECTED) {
    const error: any = new Error("Status must be ACCEPTED or REJECTED when reviewing");
    error.statusCode = 400;
    throw error;
  }

  // 4️⃣ Submission must exist
  const submission = await Submission.findById(submissionId).populate("event");
  if (!submission) {
    const error: any = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  // 5️⃣ Submission cannot be DRAFT
  if (submission.status === SubmissionStatus.DRAFT) {
    const error: any = new Error("Cannot review a DRAFT submission. Submission must be SUBMITTED first.");
    error.statusCode = 400;
    throw error;
  }

  // 6️⃣ User must be event creator (organizer) OR judge
  const event = submission.event as any;
  const isEventCreator = event.createdBy.toString() === userId;

  const userParticipation = await Participation.findOne({
    event: event._id,
    user: new mongoose.Types.ObjectId(userId),
    role: { $in: [ParticipationRole.JUDGE] }
  });

  if (!isEventCreator && !userParticipation) {
    const error: any = new Error("Forbidden: Only organizers and judges can review submissions");
    error.statusCode = 403;
    throw error;
  }

  // 7️⃣ Update review and status
  submission.review = {
    score: data.score,
    comment: data.comment ?? "",
    reviewedBy: new mongoose.Types.ObjectId(userId),
    reviewedAt: new Date()
  };
  submission.status = data.status;
  
  await submission.save();

  return submission.populate([
    "event",
    {
      path: "participant",
      populate: {
        path: "user",
        select: "name email"
      }
    },
    "review.reviewedBy"
  ]);
};

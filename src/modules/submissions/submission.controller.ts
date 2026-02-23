import { Request, Response, NextFunction } from "express";
import * as submissionService from "./submission.service";
import { ContentType, SubmissionStatus } from "./submission.model";
import { sendEmail } from "../../utils/email.service";

   
                                        
                                  
   
export const createSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    const { title, description, type, content, metadata } = req.body;

                               
    if (!title || !type) {
      const error: any = new Error("Title and type are required");
      error.statusCode = 400;
      throw error;
    }

                         
    if (!Object.values(ContentType).includes(type)) {
      const error: any = new Error(
        `Invalid type. Allowed values: ${Object.values(ContentType).join(", ")}`
      );
      error.statusCode = 400;
      throw error;
    }

    // Handle file upload if present
    let fileData = undefined;
    if (req.file) {
      const cloudinaryFile = req.file as any;
      fileData = {
        publicId: cloudinaryFile.filename, // Cloudinary public_id
        url: cloudinaryFile.path, // Cloudinary secure URL
        originalName: cloudinaryFile.originalname,
        mimetype: cloudinaryFile.mimetype,
        size: cloudinaryFile.size
      };
    }

    const submission = await submissionService.createSubmission(
      eventId,
      userId,
      { title, description, type, content, metadata, file: fileData }
    );

    res.status(201).json({
      success: true,
      message: "Submission created successfully",
      data: submission
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:eventId/submissions/me
 * Get current user's submissions for an event
 */
export const getMySubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    const submissions = await submissionService.listMySubmissions(eventId, userId);

    res.status(200).json({
      success: true,
      data: submissions
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/events/:eventId/submissions/:submissionId
 * Update a submission (only if DRAFT)
 */
export const updateSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const submissionId = req.params.submissionId as string;
    const userId = req.user!.userId;

    const { title, description, type, content, metadata } = req.body;

    // Validate type enum if provided
    if (type && !Object.values(ContentType).includes(type)) {
      const error: any = new Error(
        `Invalid type. Allowed values: ${Object.values(ContentType).join(", ")}`
      );
      error.statusCode = 400;
      throw error;
    }

    // Handle file upload if present
    let fileData = undefined;
    if (req.file) {
      const cloudinaryFile = req.file as any;
      fileData = {
        publicId: cloudinaryFile.filename, // Cloudinary public_id
        url: cloudinaryFile.path, // Cloudinary secure URL
        originalName: cloudinaryFile.originalname,
        mimetype: cloudinaryFile.mimetype,
        size: cloudinaryFile.size
      };
    }

    const submission = await submissionService.updateSubmission(
      submissionId,
      userId,
      { title, description, type, content, metadata, file: fileData }
    );

    res.status(200).json({
      success: true,
      message: "Submission updated successfully",
      data: submission
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/events/:eventId/submissions/:submissionId/submit
 * Finalize/lock submission (DRAFT -> SUBMITTED)
 */
export const submitSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const submissionId = req.params.submissionId as string;
    const userId = req.user!.userId;

    const submission = await submissionService.submitSubmission(
      submissionId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Submission submitted successfully",
      data: submission
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:eventId/submissions/:submissionId
 * Get a single submission
 */
export const getSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const submissionId = req.params.submissionId as string;
    const userId = req.user!.userId;

    const submission = await submissionService.getSubmission(
      submissionId,
      userId
    );

    res.status(200).json({
      success: true,
      data: submission
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:eventId/submissions
 * List all submissions for an event (Organizer/Judge only)
 */
export const listEventSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    const submissions = await submissionService.listEventSubmissions(
      eventId,
      userId
    );

    res.status(200).json({
      success: true,
      data: submissions
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/events/:eventId/submissions/:submissionId/status
 * Update submission status (Organizer/Judge only)
 */
export const updateSubmissionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const submissionId = req.params.submissionId as string;
    const userId = req.user!.userId;
    const { status } = req.body;

    if (!status) {
      const error: any = new Error("Status is required");
      error.statusCode = 400;
      throw error;
    }

    // Validate status enum
    if (!Object.values(SubmissionStatus).includes(status)) {
      const error: any = new Error(
        `Invalid status. Allowed values: ${Object.values(SubmissionStatus).join(", ")}`
      );
      error.statusCode = 400;
      throw error;
    }

    const submission = await submissionService.updateSubmissionStatus(
      submissionId,
      userId,
      status
    );

    if (status === SubmissionStatus.ACCEPTED || status === SubmissionStatus.REJECTED) {
      const participant = (submission as any).participant;
      const participantUser = participant?.user;
      const participantEmail = participantUser?.email as string | undefined;
      const participantName = (participantUser?.name as string | undefined) || "Participant";
      const eventTitle = ((submission as any).event?.title as string | undefined) || "your event";

      if (participantEmail) {
        const decision = status === SubmissionStatus.ACCEPTED ? "accepted" : "rejected";

        await sendEmail(
          participantEmail,
          `Submission ${status}: ${eventTitle}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb; margin-bottom: 16px;">Submission Update</h1>
              <p style="font-size: 16px; color: #374151;">Hi ${participantName},</p>
              <p style="font-size: 16px; color: #374151;">Your submission for <strong>${eventTitle}</strong> was <strong style="text-transform: capitalize;">${decision}</strong>.</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Team Atria</p>
            </div>
          `
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Submission status updated successfully",
      data: submission
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/events/:eventId/submissions/:submissionId/review
 * Review/Grade a submission (Organizer/Judge only)
 */
export const reviewSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const submissionId = req.params.submissionId as string;
    const userId = req.user!.userId;
    const { score, comment, status } = req.body;
    const normalizedComment = typeof comment === "string" ? comment.trim() : "";

    // Validate required fields
    if (score === undefined || score === null) {
      const error: any = new Error("Score is required");
      error.statusCode = 400;
      throw error;
    }

    if (!status) {
      const error: any = new Error("Status is required (ACCEPTED or REJECTED)");
      error.statusCode = 400;
      throw error;
    }

    // Validate status enum
    if (!Object.values(SubmissionStatus).includes(status)) {
      const error: any = new Error(
        `Invalid status. Allowed values: ${Object.values(SubmissionStatus).join(", ")}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (status === SubmissionStatus.REJECTED && !normalizedComment) {
      const error: any = new Error("Comment is required for rejected submissions");
      error.statusCode = 400;
      throw error;
    }

    const submission = await submissionService.reviewSubmission(
      submissionId,
      userId,
      { score, comment: normalizedComment, status }
    );

    res.status(200).json({
      success: true,
      message: "Submission reviewed successfully",
      data: submission
    });
  } catch (err) {
    next(err);
  }
};

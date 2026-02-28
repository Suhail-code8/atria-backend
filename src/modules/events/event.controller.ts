import { Request, Response, NextFunction } from "express";
import { transitionEventState } from "./event.lifecycle";
import { EventStatus } from "./event.model";
import * as eventService from "./event.service";
import { Participation, ParticipationRole } from "../participation/participation.model";
import { Submission, SubmissionStatus } from "../submissions/submission.model";
import mongoose from "mongoose";
import cloudinary from "../../config/cloudinary";
import { Event } from "./event.model";
import { Readable } from "stream";


export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId as string;


    const {
      title,
      description,
      location,
      eventType,
      startDate,
      endDate,
      isPublic,
      registrationStartDate,
      registrationEndDate,
      capabilities,
      registrationForm,
      isCompetition,
      scoringRules,
      limits
    } = req.body;

    const event = await eventService.createEvent({
      title,
      description,
      location,
      eventType,
      startDate,
      endDate,
      isPublic,
      registrationStartDate,
      registrationEndDate,
      capabilities,
      registrationForm,
      isCompetition,
      scoringRules,
      limits
    }, userId);

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};


export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId as string;
    const eventId = req.params.eventId as string;
    const {
      title,
      description,
      location,
      eventType,
      startDate,
      endDate,
      isPublic,
      registrationStartDate,
      registrationEndDate,
      registrationForm,
      isCompetition,
      isLeaderboardPublished,
      scoringRules,
      limits,
      capabilities
    } = req.body;

    const event = await eventService.updateEvent(
      eventId,
      {
        title,
        description,
        location,
        eventType,
        startDate,
        endDate,
        isPublic,
        registrationStartDate,
        registrationEndDate,
        registrationForm,
        isCompetition,
        isLeaderboardPublished,
        scoringRules,
        limits,
        capabilities
      },
      userId
    );
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};


export const deleteEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId as string;
    const eventId = req.params.eventId as string;
    const event = await eventService.deleteEvent(eventId, userId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};


export const getEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventId = req.params.eventId as string;
    const requesterUserId = req.user?.userId as string | undefined;
    const event = await eventService.getEventById(eventId, requesterUserId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};


export const listEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requester = req.user
      ? { userId: req.user.userId, role: req.user.role }
      : null;
    const events = await eventService.listEvents(requester);

    if (req.query.organizerId === "ME") {
      if (!req.user) {
        const error: any = new Error("Unauthorized: Login required");
        error.statusCode = 401;
        throw error;
      }

      const myEvents = events.filter((event) => event.createdBy === req.user!.userId);
      res.status(200).json({ success: true, data: myEvents });
      return;
    }

    const visibleStatuses = new Set<string>([
      EventStatus.PUBLISHED,
      EventStatus.REGISTRATION_OPEN,
      "REGISTRATION_CLOSED",
      EventStatus.ONGOING,
      EventStatus.COMPLETED
    ]);

    const filteredEvents = events.filter((event) => {
      const isOwner = !!req.user && req.user.userId === event.createdBy.toString();
      if (isOwner) {
        return true;
      }
      return visibleStatuses.has(String(event.status));
    });

    res.status(200).json({ success: true, data: filteredEvents });
  } catch (err) {
    next(err);
  }
};


export const transitionEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventId = req.params.eventId as string;
    const { targetState } = req.body;

    if (!targetState || !Object.values(EventStatus).includes(targetState)) {
      const error: any = new Error("Invalid target state");
      error.statusCode = 400;
      throw error;
    }

    const updatedEvent = await transitionEventState(
      eventId,
      targetState,
      req.user!.userId,
    );

    res.status(200).json({
      success: true,
      message: `Event transitioned to ${targetState}`,
      data: updatedEvent,
    });
  } catch (error) {
    next(error);
  }
};

// 7. Analytics
export const getEventAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const error: any = new Error("Invalid event ID");
      error.statusCode = 400;
      throw error;
    }

    const event = await eventService.getEventById(eventId, userId);
    if (!event) {
      const error: any = new Error("Event not found");
      error.statusCode = 404;
      throw error;
    }

    if (event.createdBy.toString() !== userId) {
      const error: any = new Error("Only event organizers can view analytics");
      error.statusCode = 403;
      throw error;
    }

    // Analytics Logic...
    const totalRegistrations = await Participation.countDocuments({
      event: new mongoose.Types.ObjectId(eventId),
      role: ParticipationRole.PARTICIPANT
    });

    const registrationsByDate = await Participation.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          role: ParticipationRole.PARTICIPANT
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, _id: 0 } }
    ]);

    const submissionStats = await Submission.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(eventId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { status: "$_id", count: 1, _id: 0 } }
    ]);

    const submissionsByStatus = submissionStats.reduce((acc: any, stat: any) => {
      acc[stat.status] = stat.count;
      return acc;
    }, {
      [SubmissionStatus.DRAFT]: 0,
      [SubmissionStatus.SUBMITTED]: 0,
      [SubmissionStatus.UNDER_REVIEW]: 0,
      [SubmissionStatus.ACCEPTED]: 0,
      [SubmissionStatus.REJECTED]: 0
    });

    const totalSubmissions = submissionStats.reduce((sum, stat) => sum + stat.count, 0);

    const scoreAgg = await Submission.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          "review.score": { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          averageScore: { $avg: "$review.score" },
          reviewedCount: { $sum: 1 }
        }
      }
    ]);

    const averageScore = scoreAgg.length > 0 ? Math.round(scoreAgg[0].averageScore * 10) / 10 : null;
    const reviewedCount = scoreAgg.length > 0 ? scoreAgg[0].reviewedCount : 0;

    const conversionRate = totalRegistrations > 0
      ? Math.round((totalSubmissions / totalRegistrations) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalRegistrations,
        totalSubmissions,
        conversionRate,
        registrationsByDate,
        submissionsByStatus,
        averageScore,
        reviewedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

export const generateEventPoster = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const error: any = new Error("Invalid event ID");
      error.statusCode = 400;
      throw error;
    }

    const event = await Event.findById(eventId);
    if (!event) {
      const error: any = new Error("Event not found");
      error.statusCode = 404;
      throw error;
    }

    const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!huggingFaceApiKey) {
      const error: any = new Error("HUGGINGFACE_API_KEY is not configured");
      error.statusCode = 500;
      throw error;
    }

const aiPrompt = "Ultra-minimalist professional dark gradient background, smooth silk mesh texture, deep obsidian and midnight blue color grading, subtle elegant lighting, completely abstract, clean empty negative space, corporate tech aesthetic, no shapes, no lines, no objects, no text";
    const hfResponse = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${huggingFaceApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: aiPrompt })
      }
    );

    if (!hfResponse.ok) {
      const errorBody = await hfResponse.text();
      const error: any = new Error(`Hugging Face generation failed: ${errorBody}`);
      error.statusCode = 502;
      throw error;
    }

    const arrayBuffer = await hfResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const cloudinaryUpload = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "atria/posters"
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(new Error("Cloudinary did not return an upload result"));
            return;
          }

          resolve(result);
        }
      );

      Readable.from(imageBuffer).pipe(uploadStream);
    });

    event.posterUrl = cloudinaryUpload.secure_url;
    await event.save();

    res.status(200).json({
      success: true,
      message: "Event poster generated successfully",
      data: {
        posterUrl: event.posterUrl
      }
    });
  } catch (err) {
    next(err);
  }
};
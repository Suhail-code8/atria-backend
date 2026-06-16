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
import { env } from "../../config/env";


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
      isPaid,
      price,
      totalSeats,
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
      isPaid,
      price,
      totalSeats,
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
      isPaid,
      price,
      totalSeats,
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
        isPaid,
        price,
        totalSeats,
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
    const accessCode = req.query.code as string | undefined;
    const event = await eventService.getEventById(eventId, requesterUserId, accessCode);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

export const getAccessCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId as string;
    const eventId = req.params.eventId as string;
    const result = await eventService.getEventAccessCode(eventId, userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const regenerateAccessCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId as string;
    const eventId = req.params.eventId as string;
    const result = await eventService.regenerateAccessCode(eventId, userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};


export const listEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requester = req.user ? { userId: req.user.userId, role: req.user.role } : null;
    let filters: any = {};

    if (req.query.organizerId === "ME") {
      if (!req.user) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
      filters.createdBy = new mongoose.Types.ObjectId(req.user.userId);

      const myEvents = await eventService.listEvents(requester, filters);
      return res.status(200).json({ success: true, data: myEvents });
    }

    filters.status = {
      $in: [EventStatus.PUBLISHED, EventStatus.REGISTRATION_OPEN, "REGISTRATION_CLOSED", EventStatus.ONGOING, EventStatus.COMPLETED]
    };

    const filteredEvents = await eventService.listEvents(requester, filters);
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
    // OPTIMIZATION: Use Promise.all to run all 4 database queries concurrently (no waterfall)
    const [
      totalRegistrations,
      registrationsByDate,
      submissionStats,
      scoreAgg
    ] = await Promise.all([
      Participation.countDocuments({
        event: new mongoose.Types.ObjectId(eventId),
        role: ParticipationRole.PARTICIPANT
      }),
      Participation.aggregate([
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
      ]),
      Submission.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      Submission.aggregate([
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
      ])
    ]);

    // Synchronous calculations happen instantly after the concurrent DB calls finish
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
    const userId = req.user?.userId as string;

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

    if (event.createdBy.toString() !== userId) {
      const error: any = new Error("Forbidden: Only event creator can generate posters");
      error.statusCode = 403;
      throw error;
    }

    const huggingFaceApiKey = env.huggingFaceApiKey;
    if (!huggingFaceApiKey) {
      const error: any = new Error("HUGGINGFACE_API_KEY is not configured in the backend environment");
      error.statusCode = 500;
      throw error;
    }

    const { style = "vanguard", customPrompt } = req.body || {};

    // 1. Caching Check (Skip if customPrompt is provided for fresh generation)
    if (!customPrompt) {
      const cached = (event as any).generatedPosters?.find((p: any) => p.style === style);
      if (cached) {
        return res.status(200).json({
          success: true,
          message: "Returning cached poster",
          data: {
            posterUrl: cached.url,
            backgroundUrl: cached.url,
            eventTitle: event.title,
            eventDescription: event.description,
            eventType: event.eventType,
            startDate: event.startDate,
            endDate: event.endDate,
            location: event.location,
            isPaid: event.isPaid,
            price: event.price
          }
        });
      }
    }

    const formattedDate = new Date(event.startDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).toUpperCase();

    // --- Curated styles for full poster generation ---
    const styleConfigs: Record<string, string> = {
      vanguard: `A professional high-contrast Swiss-style event poster for "${event.title}". The main title "${event.title}" is prominently displayed in bold, black, oversized grotesque typography. Secondary text includes "${formattedDate}" and "${event.location}" in minimal clean font. Dramatic red accents, asymmetrical grid, high-quality graphic design.`,
      aurora: `A fine-art minimalist promotional poster for "${event.title}". The title "${event.title}" is rendered in elegant italic serif typography. Ethereal pastel gradients. Include "${formattedDate}" and "${event.location}" in small, well-spaced clean text. Dreamy, airy, professional editorial design.`,
      cyber: `A futuristic sci-fi event poster for "${event.title}". The title "${event.title}" is shown in glowing neon cyan glitch typography. Dark data-grid background with holographic elements. Display "${formattedDate}" and "${event.location}" in monospaced HUD-style text. 8k resolution.`,
      luxe: `A premium luxury event poster for "${event.title}". The title "${event.title}" is in gold-leaf serif typography on a white marble background. High-end fashion magazine layout. Include "${formattedDate}" and "${event.location}" in sophisticated minimal charcoal text.`,
      night: `A cinematic moody event poster for "${event.title}". The title "${event.title}" is illuminated by moonlight in tall condensed typography. Dark forest silhouette background with atmospheric fog. Date "${formattedDate}" and location "${event.location}" integrated into the misty environment.`
    };

    const aiPrompt = customPrompt || styleConfigs[style] || styleConfigs.vanguard;

    // 2. Retry Logic (Max 2 Attempts)
    let imageUrl = "";
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts && !imageUrl) {
      try {
        attempts++;
        const hfResponse = await fetch(
          "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
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
          if (attempts === maxAttempts) break;
          continue;
        }

        const arrayBuffer = await hfResponse.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        const cloudinaryUpload = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "atria/posters" },
            (error, result) => {
              if (error || !result) reject(error || new Error("Upload failed"));
              else resolve(result);
            }
          );
          const { Readable } = require('stream');
          Readable.from(imageBuffer).pipe(uploadStream);
        });

        imageUrl = cloudinaryUpload.secure_url;
      } catch (err) {
        if (attempts === maxAttempts) break;
      }
    }

    // 3. Fallback to Gradient if AI Fails
    if (!imageUrl) {
      imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(event.title)}&background=random&size=1080&color=fff&bold=true`;  
    }

    // 4. Update Caches & Save (Only cache if it's a real AI generation)
    if (imageUrl && imageUrl.includes('cloudinary')) {
      event.generatedPosters.push({ 
        style, 
        url: imageUrl, 
        prompt: customPrompt || "default", 
        createdAt: new Date() 
      });
      event.posterUrl = imageUrl;
    }
    
    await event.save();

    res.status(200).json({
      success: true,
      message: imageUrl.includes('ui-avatars') ? "Generated fallback poster" : "Event poster generated successfully",
      data: {
        posterUrl: imageUrl,
        backgroundUrl: imageUrl,
        eventTitle: event.title,
        eventDescription: event.description,
        eventType: event.eventType,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        isPaid: event.isPaid,
        price: event.price
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Workflow Engine ──────────────────────────────────────────────────────────

/**
 * PATCH /api/events/:eventId/workflow
 * Update (replace) the workflow graph for an event.
 * Organizer-only. Full validation is handled in the service layer.
 */
export const updateWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;
    const { nodes, edges, featureModules } = req.body;

    if (!nodes || !edges) {
      const error: any = new Error("Request body must include 'nodes' and 'edges' arrays");
      error.statusCode = 400;
      throw error;
    }

    const event = await eventService.updateEventWorkflow(
      eventId,
      { nodes, edges, featureModules },
      userId
    );

    res.status(200).json({
      success: true,
      message: "Event workflow updated successfully",
      data: event
    });
  } catch (err) {
    next(err);
  }
};

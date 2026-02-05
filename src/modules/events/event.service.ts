import { Event, IEvent, EventStatus } from "./event.model";
import mongoose from "mongoose";

interface CreateEventInput {
  title: string;
  description: string;
  eventType: string;
  startDate: Date | string;
  endDate: Date | string;
  isPublic?: boolean;
  status?: string;
  hasTeams?: boolean;
  hasCategories?: boolean;
  hasJudging?: boolean;
  hasScoring?: boolean;
}

export const sanitizeEvent = (event: IEvent) => {
  return {
    _id: event._id.toString(),
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    startDate: event.startDate,
    endDate: event.endDate,
    createdBy: event.createdBy?.toString(),
    isPublic: event.isPublic,
    status: event.status,
    hasTeams: event.hasTeams,
    hasCategories: event.hasCategories,
    hasJudging: event.hasJudging,
    hasScoring: event.hasScoring,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
};

export const createEvent = async (data: CreateEventInput, userId: string) => {
  // Basic validation
  if (!data.title || !data.description || !data.eventType || !data.startDate || !data.endDate) {
    const error: any = new Error("Missing required event fields");
    error.statusCode = 400;
    throw error;
  }

  const event = await Event.create({
    title: data.title,
    description: data.description,
    eventType: data.eventType,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    createdBy: new mongoose.Types.ObjectId(userId),
    isPublic: data.isPublic ?? true,
    status: data.status ?? EventStatus.DRAFT,
    hasTeams: data.hasTeams ?? false,
    hasCategories: data.hasCategories ?? false,
    hasJudging: data.hasJudging ?? false,
    hasScoring: data.hasScoring ?? false
  });

  return sanitizeEvent(event);
};

export const updateEvent = async (eventId: string, data: Partial<CreateEventInput>, userId: string) => {
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.createdBy.toString() !== userId) {
    const error: any = new Error("Forbidden: Only creator can update the event");
    error.statusCode = 403;
    throw error;
  }

  const allowed = [
    "title",
    "description",
    "eventType",
    "startDate",
    "endDate",
    "isPublic",
    "status",
    "hasTeams",
    "hasCategories",
    "hasJudging",
    "hasScoring"
  ];

  allowed.forEach((key) => {
    if ((data as any)[key] !== undefined) {
      (event as any)[key] = (data as any)[key];
    }
  });

  // Ensure dates are Date objects
  if (data.startDate) event.startDate = new Date(data.startDate as any);
  if (data.endDate) event.endDate = new Date(data.endDate as any);

  await event.save();

  return sanitizeEvent(event);
};

export const deleteEvent = async (eventId: string, userId: string) => {
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.createdBy.toString() !== userId) {
    const error: any = new Error("Forbidden: Only creator can delete the event");
    error.statusCode = 403;
    throw error;
  }

  // Soft delete: mark as draft and make private
  event.status = EventStatus.DRAFT;
  event.isPublic = false;
  await event.save();

  return sanitizeEvent(event);
};

export const getEventById = async (eventId: string, requesterUserId?: string) => {
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (!event.isPublic && !requesterUserId) {
    const error: any = new Error("Unauthorized: Event is private");
    error.statusCode = 401;
    throw error;
  }

  return sanitizeEvent(event);
};

export const listEvents = async (requester?: { userId: string; role: string } | null) => {
  if (!requester) {
    // Public listing
    const events = await Event.find({ isPublic: true }).sort({ startDate: -1 });
    return events.map(sanitizeEvent);
  }

  // Authenticated requests
  if (requester.role === "ORGANIZER") {
    const mongooseId = new mongoose.Types.ObjectId(requester.userId);
    const events = await Event.find({ $or: [{ isPublic: true }, { createdBy: mongooseId }] }).sort({ startDate: -1 });
    return events.map(sanitizeEvent);
  }

  // Other authenticated users see public events only
  const events = await Event.find({ isPublic: true }).sort({ startDate: -1 });
  return events.map(sanitizeEvent);
};

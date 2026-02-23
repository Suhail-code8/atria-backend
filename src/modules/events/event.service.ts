import { Event, IEvent, EventStatus } from "./event.model";
import mongoose from "mongoose";

interface CreateEventInput {
  title: string;
  description: string;
  eventType: string;
  startDate: Date | string;
  endDate: Date | string;
  registrationStartDate?: Date | string;
  registrationEndDate?: Date | string;
  registrationForm?: any[];
  isPublic?: boolean;
  capabilities?: {
    registration?: boolean;
    submissions?: boolean;
    teams?: boolean;
    certificates?: boolean;
    review?: boolean;
    scoring?: boolean;
    sessions?: boolean;
    realtime?: boolean;
  };
}

export const sanitizeEvent = (event: IEvent) => {
  return {
    _id: event._id.toString(),
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationStartDate: event.registrationStartDate,
    registrationEndDate: event.registrationEndDate,
    createdBy: event.createdBy?.toString(),
    isPublic: event.isPublic,
    status: event.status,
    registrationForm: event.registrationForm || [],
    capabilities: event.capabilities,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
};

export const createEvent = async (data: CreateEventInput, userId: string) => {
                     
  if (!data.title || !data.description || !data.eventType || !data.startDate || !data.endDate) {
    const error: any = new Error("Missing required event fields");
    error.statusCode = 400;
    throw error;
  }

                   
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  
  if (endDate <= startDate) {
    const error: any = new Error("Event end date must be after start date");
    error.statusCode = 400;
    throw error;
  }

  const rawRegistrationStartDate = data.registrationStartDate;
  const rawRegistrationEndDate = data.registrationEndDate;

  const hasRegistrationStartDate =
    rawRegistrationStartDate !== undefined &&
    rawRegistrationStartDate !== null &&
    rawRegistrationStartDate !== "";

  const hasRegistrationEndDate =
    rawRegistrationEndDate !== undefined &&
    rawRegistrationEndDate !== null &&
    rawRegistrationEndDate !== "";

  if (hasRegistrationStartDate !== hasRegistrationEndDate) {
    const error: any = new Error("Both registration start and end dates must be provided together");
    error.statusCode = 400;
    throw error;
  }

  let registrationStartDate: Date | undefined;
  let registrationEndDate: Date | undefined;

  if (hasRegistrationStartDate && hasRegistrationEndDate) {
    registrationStartDate = new Date(rawRegistrationStartDate as Date | string);
    registrationEndDate = new Date(rawRegistrationEndDate as Date | string);

    if (Number.isNaN(registrationStartDate.getTime()) || Number.isNaN(registrationEndDate.getTime())) {
      const error: any = new Error("Invalid registration window dates");
      error.statusCode = 400;
      throw error;
    }

    if (registrationEndDate <= registrationStartDate) {
      const error: any = new Error("Registration end date must be after start date");
      error.statusCode = 400;
      throw error;
    }

                                                                                
                                                                                               
                                
                     
        
  }

                                          
  const capabilities = {
    registration: false,
    submissions: false,
    review: false,
    teams: false,
    scoring: false,
    sessions: false,
    realtime: false,
    ...data.capabilities
  };

  const event = await Event.create({
    title: data.title,
    description: data.description,
    eventType: data.eventType,
    startDate,
    endDate,
    registrationStartDate,
    registrationEndDate,
    registrationForm: data.registrationForm,
    createdBy: new mongoose.Types.ObjectId(userId),
    isPublic: data.isPublic ?? true,
    status: EventStatus.DRAFT,
    capabilities
  });

  return sanitizeEvent(event);
};

export const updateEvent = async (eventId: string, data: Partial<CreateEventInput>, userId: string) => {
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
    "registrationStartDate",
    "registrationEndDate",
    "registrationForm"
  ];

                          
  allowed.forEach((key) => {
    if ((data as any)[key] !== undefined) {
      (event as any)[key] = (data as any)[key];
    }
  });

                                          
  if (data.startDate || data.endDate) {
    const startDate = data.startDate ? new Date(data.startDate as any) : event.startDate;
    const endDate = data.endDate ? new Date(data.endDate as any) : event.endDate;
    
    if (endDate <= startDate) {
      const error: any = new Error("Event end date must be after start date");
      error.statusCode = 400;
      throw error;
    }
    
    if (data.startDate) event.startDate = startDate;
    if (data.endDate) event.endDate = endDate;
  }

                                           
  if (data.capabilities) {
    event.capabilities = {
      ...event.capabilities,
      ...data.capabilities
    };
  }

  await event.save();

  return sanitizeEvent(event);
};

export const deleteEvent = async (eventId: string, userId: string) => {
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
    const error: any = new Error("Forbidden: Only creator can delete the event");
    error.statusCode = 403;
    throw error;
  }

                                                
  event.status = EventStatus.DRAFT;
  event.isPublic = false;
  await event.save();

  return sanitizeEvent(event);
};

export const getEventById = async (eventId: string, requesterUserId?: string) => {
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

                               
  if (!event.isPublic) {
    if (!requesterUserId) {
      const error: any = new Error("Unauthorized: Event is private");
      error.statusCode = 401;
      throw error;
    }
    if (event.createdBy.toString() !== requesterUserId) {
      const error: any = new Error("Forbidden: Access denied to private event");
      error.statusCode = 403;
      throw error;
    }
  }

  return sanitizeEvent(event);
};

export const listEvents = async (requester?: { userId: string; role: string } | null) => {
  if (!requester) {
                     
    const events = await Event.find({ isPublic: true }).sort({ startDate: -1 });
    return events.map(sanitizeEvent);
  }

                           
  if (requester.role === "ORGANIZER") {
    const mongooseId = new mongoose.Types.ObjectId(requester.userId);
    const events = await Event.find({ $or: [{ isPublic: true }, { createdBy: mongooseId }] }).sort({ startDate: -1 });
    return events.map(sanitizeEvent);
  }

                                                     
  const events = await Event.find({ isPublic: true }).sort({ startDate: -1 });
  return events.map(sanitizeEvent);
};

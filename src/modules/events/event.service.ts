import { Event, IEvent, EventStatus } from "./event.model";
import mongoose from "mongoose";

interface CreateEventInput {
  title: string;
  description: string;
  location?: string;
  eventType: string;
  startDate: Date | string;
  endDate: Date | string;
  isCompetition?: boolean;
  isLeaderboardPublished?: boolean;
  scoringRules?: {
    places?: Map<string, number> | Record<string, number>;
    grades?: Map<string, number> | Record<string, number>;
  };
  limits?: {
    maxIndividualItemsPerParticipant?: number;
    maxGroupItemsPerParticipant?: number;
  };
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
    location: event.location,
    posterUrl: event.posterUrl,
    eventType: event.eventType,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationStartDate: event.registrationStartDate,
    registrationEndDate: event.registrationEndDate,
    createdBy: event.createdBy?.toString(),
    isPublic: event.isPublic,
    isCompetition: event.isCompetition,
    isLeaderboardPublished: event.isLeaderboardPublished,
    scoringRules: event.scoringRules,
    limits: event.limits,
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
    location: data.location ?? "",
    eventType: data.eventType,
    startDate,
    endDate,
    registrationStartDate,
    registrationEndDate,
    registrationForm: data.registrationForm,
    isCompetition: data.isCompetition,
    scoringRules: data.scoringRules,
    limits: data.limits,
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

  // 1. Define allowed keys as a strict constant array
  const allowedKeys = [
    "title",
    "description",
    "location",
    "eventType",
    "isPublic",
    "registrationForm",
    "isCompetition",
    "isLeaderboardPublished",
  ] as const;

  // 2. The ES6 Way: Transform, filter, and reconstruct the object
  const filteredUpdates = Object.fromEntries(
    Object.entries(data).filter(([key, value]) => 
      allowedKeys.includes(key as any) && value !== undefined
    )
  );

  // 3. Apply the flat updates to the Mongoose document in one go
  Object.assign(event, filteredUpdates);

// 4. Safely merge nested objects and handle Mongoose Maps
  if (data.scoringRules) {
    // Initialize if it doesn't exist on the document yet
    if (!event.scoringRules) {
      // @ts-ignore - Bypass strict init check if Mongoose handles it gracefully
      event.scoringRules = { places: new Map(), grades: new Map() };
    }
    
    // Convert plain JS objects (Records) from the frontend into proper Maps
    if (data.scoringRules.places) {
      event.scoringRules.places = new Map(
        data.scoringRules.places instanceof Map 
          ? data.scoringRules.places 
          : Object.entries(data.scoringRules.places)
      );
    }
    
    if (data.scoringRules.grades) {
      event.scoringRules.grades = new Map(
        data.scoringRules.grades instanceof Map 
          ? data.scoringRules.grades 
          : Object.entries(data.scoringRules.grades)
      );
    }
  }

  // Keep limits and capabilities exactly as they were:
  if (data.limits) {
    event.limits = { ...event.limits, ...data.limits };
  }
  if (data.capabilities) {
    event.capabilities = { ...event.capabilities, ...data.capabilities };
  }

  // 5. Handle Event Dates safely
  if (data.startDate || data.endDate) {
    const startDate = data.startDate ? new Date(data.startDate as any) : event.startDate;
    const endDate = data.endDate ? new Date(data.endDate as any) : event.endDate;
    
    if (endDate <= startDate) {
      const error: any = new Error("Event end date must be after start date");
      error.statusCode = 400;
      throw error;
    }
    
    event.startDate = startDate;
    event.endDate = endDate;
  }

  // 6. Handle Registration Dates safely
  if (data.registrationStartDate || data.registrationEndDate) {
    const currentRegStart = event.registrationStartDate ? new Date(event.registrationStartDate) : undefined;
    const currentRegEnd = event.registrationEndDate ? new Date(event.registrationEndDate) : undefined;

    const regStart = data.registrationStartDate ? new Date(data.registrationStartDate as any) : currentRegStart;
    const regEnd = data.registrationEndDate ? new Date(data.registrationEndDate as any) : currentRegEnd;

    if (regStart && regEnd && regEnd <= regStart) {
      const error: any = new Error("Registration end date must be after registration start date");
      error.statusCode = 400;
      throw error;
    }

    if (regStart) event.registrationStartDate = regStart;
    if (regEnd) event.registrationEndDate = regEnd;
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


export const listEvents = async (
  requester?: { userId: string; role: string } | null,
  filters: any = {}
) => {
  let query: any = { ...filters };

  if (!requester) {
    query.isPublic = true;
  } else if (requester.role === "ORGANIZER") {
    const mongooseId = new mongoose.Types.ObjectId(requester.userId);
    query.$or = [{ isPublic: true }, { createdBy: mongooseId }];
  } else {
    query.isPublic = true;
  }

  // .lean() to return pure JSON instead of heavy Mongoose documents
  const events = await Event.find(query).sort({ startDate: -1 }).lean();
  
  return (events as unknown as IEvent[]).map(sanitizeEvent); 
};

import { Event, IEvent, EventStatus, EventType, IWorkflow, WorkflowNodeType } from "./event.model";
import mongoose from "mongoose";
import crypto from "crypto";

const generateAccessCode = () => crypto.randomBytes(16).toString("hex");

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
  isPaid?: boolean;
  price?: number;
  totalSeats?: number;
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

export const sanitizeEvent = (event: IEvent, isOwner = false) => {
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
    isPaid: event.isPaid,
    price: event.price,
    totalSeats: event.totalSeats,
    availableSeats: event.availableSeats,
    isCompetition: event.isCompetition,
    isLeaderboardPublished: event.isLeaderboardPublished,
    scoringRules: event.scoringRules,
    limits: event.limits,
    status: event.status,
    registrationForm: event.registrationForm || [],
    capabilities: event.capabilities,
    // ─── Workflow Engine ───────────────────────────────────────────────────
    workflow: event.workflow ?? { nodes: [], edges: [] },
    // ───────────────────────────────────────────────────────────────────────
    ...(isOwner && !event.isPublic ? { accessCode: event.accessCode } : {}),
    generatedPosters: event.generatedPosters || [],
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
};

export const createEvent = async (data: CreateEventInput, userId: string) => {
                     
  if (!data.title || !data.eventType) {
    const error: any = new Error("Missing required event fields: Title and Event Type are mandatory.");
    error.statusCode = 400;
    throw error;
  }

  // Enforce minimum price for paid events (Razorpay requirement)
  if (data.isPaid && (!data.price || data.price < 1)) {
    const error: any = new Error("Paid events must have a minimum price of 1.00");
    error.statusCode = 400;
    throw error;
  }

                   
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (data.startDate && data.endDate) {
    startDate = new Date(data.startDate);
    endDate = new Date(data.endDate);
    
    if (endDate <= startDate) {
      const error: any = new Error("Event end date must be after start date");
      error.statusCode = 400;
      throw error;
    }
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
    eventType: data.eventType as EventType,
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
    isPaid: data.isPaid ?? false,
    price: data.isPaid ? (data.price ?? 0) : 0,
    totalSeats: data.totalSeats,
    availableSeats: data.totalSeats,
    accessCode: (data.isPublic === false) ? generateAccessCode() : undefined,
    status: EventStatus.DRAFT,
    capabilities
  });

  const isOwner = true;
  return sanitizeEvent(event, isOwner);
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
    "isPaid",
    "price",
    "totalSeats",
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

  // Sync availableSeats when totalSeats changes
  if (data.totalSeats !== undefined) {
    const registered = (event.totalSeats ?? 0) - (event.availableSeats ?? 0);
    event.availableSeats = Math.max(0, data.totalSeats - registered);
  }
  // Clear price when switching to free
  if (data.isPaid === false) {
    event.price = 0;
  }
  // Generate access code when switching to private (if one doesn't exist)
  if (data.isPublic === false && !event.accessCode) {
    event.accessCode = generateAccessCode();
  }
  // Clear access code when switching back to public
  if (data.isPublic === true) {
    event.accessCode = undefined;
  }

  // Enforce minimum price for paid events (Razorpay requirement)
  const finalIsPaid = data.isPaid !== undefined ? data.isPaid : event.isPaid;
  const finalPrice = data.price !== undefined ? data.price : event.price;
  
  if (finalIsPaid && finalPrice < 1) {
    const error: any = new Error("Paid events must have a minimum price of 1.00");
    error.statusCode = 400;
    throw error;
  }

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

  const isOwner = true;
  return sanitizeEvent(event, isOwner);
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

export const getEventById = async (eventId: string, requesterUserId?: string, accessCode?: string) => {
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

  const isOwner = !!requesterUserId && event.createdBy.toString() === requesterUserId;

  if (!event.isPublic) {
    if (isOwner) {
      // creator always has access
    } else if (accessCode && event.accessCode && accessCode === event.accessCode) {
      // valid invite code — allow read-only access
    } else if (!requesterUserId) {
      const error: any = new Error("Unauthorized: Event is private");
      error.statusCode = 401;
      throw error;
    } else {
      const error: any = new Error("Forbidden: Access denied to private event");
      error.statusCode = 403;
      throw error;
    }
  }

  return sanitizeEvent(event, isOwner);
};

export const getEventAccessCode = async (eventId: string, userId: string) => {
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
    const error: any = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }
  return { accessCode: event.accessCode ?? null };
};

export const regenerateAccessCode = async (eventId: string, userId: string) => {
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
    const error: any = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }
  event.accessCode = generateAccessCode();
  await event.save();
  return { accessCode: event.accessCode };
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
  
  return (events as unknown as IEvent[]).map((e) => sanitizeEvent(e)); 
};

// ─── Workflow Engine ───────────────────────────────────────────────────────────────────────────────────────────────

const VALID_NODE_TYPES = new Set<string>(Object.values(WorkflowNodeType));

/**
 * PATCH /api/events/:eventId/workflow
 * Validates and persists a workflow graph (nodes + edges) on an event.
 * Only the event creator (organizer) may update the workflow.
 */
export const updateEventWorkflow = async (
  eventId: string,
  workflow: IWorkflow,
  userId: string
) => {
  // 1. Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error: any = new Error("Invalid event ID");
    error.statusCode = 400;
    throw error;
  }

  // 2. Fetch event
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  // 3. Ownership check
  if (event.createdBy.toString() !== userId) {
    const error: any = new Error("Forbidden: Only event creator can update the workflow");
    error.statusCode = 403;
    throw error;
  }

  // 4. Validate payload shape
  if (!workflow || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) {
    const error: any = new Error("Invalid workflow: must include 'nodes' and 'edges' arrays");
    error.statusCode = 400;
    throw error;
  }

  // 5. Validate each node
  const nodeIds = new Set<string>();
  for (const node of workflow.nodes) {
    if (!node.id || typeof node.id !== "string") {
      const error: any = new Error(`Workflow node missing required 'id' field`);
      error.statusCode = 400;
      throw error;
    }
    if (!node.type || !VALID_NODE_TYPES.has(node.type)) {
      const error: any = new Error(
        `Invalid node type '${node.type}'. Must be one of: ${[...VALID_NODE_TYPES].join(", ")}`
      );
      error.statusCode = 400;
      throw error;
    }
    if (nodeIds.has(node.id)) {
      const error: any = new Error(`Duplicate node id '${node.id}'`);
      error.statusCode = 400;
      throw error;
    }
    nodeIds.add(node.id);
  }

  // 6. Validate each edge references known node ids
  for (const edge of workflow.edges) {
    if (!edge.source || !edge.target) {
      const error: any = new Error("Each edge must have 'source' and 'target' fields");
      error.statusCode = 400;
      throw error;
    }
    if (!nodeIds.has(edge.source)) {
      const error: any = new Error(`Edge source '${edge.source}' does not match any node id`);
      error.statusCode = 400;
      throw error;
    }
    if (!nodeIds.has(edge.target)) {
      const error: any = new Error(`Edge target '${edge.target}' does not match any node id`);
      error.statusCode = 400;
      throw error;
    }
  }

  // 7. Sync Event Capabilities and Data with Workflow Modules
  const types = new Set(workflow.nodes.map(n => n.type));
  const fms = workflow.featureModules || {};
  
  event.capabilities.registration = types.has(WorkflowNodeType.REGISTRATION);
  event.capabilities.submissions = types.has(WorkflowNodeType.SUBMISSION);
  event.capabilities.teams = types.has(WorkflowNodeType.TEAM_FORMATION) || !!fms.teamHub?.enabled;
  event.capabilities.scoring = types.has(WorkflowNodeType.JUDGING_ROUND) || types.has(WorkflowNodeType.LEADERBOARD) || !!fms.leaderboard?.enabled || !!fms.judgingFeedback?.enabled;
  
  // Sync Payment capability and pricing
  const payNode = workflow.nodes.find(n => n.type === WorkflowNodeType.PAYMENT);
  if (payNode && payNode.config) {
    event.isPaid = true;
    if (payNode.config.price !== undefined) {
      event.price = Number(payNode.config.price);
    }
  } else {
    event.isPaid = false;
    event.price = 0;
  }

  // Sync Event-level data from specific modules (e.g., Registration window, Capacity, Form)
  const regNode = workflow.nodes.find(n => n.type === WorkflowNodeType.REGISTRATION);
  if (regNode && regNode.config) {
    if (regNode.config.startDate) event.registrationStartDate = new Date(regNode.config.startDate);
    if (regNode.config.endDate) event.registrationEndDate = new Date(regNode.config.endDate);
    
    // Sync Capacity & Recalculate seats
    if (regNode.config.capacity !== undefined) {
      const newTotalSeats = Number(regNode.config.capacity);
      const registered = (event.totalSeats ?? 0) - (event.availableSeats ?? 0);
      event.totalSeats = newTotalSeats;
      event.availableSeats = Math.max(0, newTotalSeats - registered);
    }

    // Sync Custom Fields to core registrationForm
    if (regNode.config.customFields && Array.isArray(regNode.config.customFields)) {
      event.registrationForm = regNode.config.customFields.map((f: any) => ({
        id: f.id || Math.random().toString(36).substr(2, 9),
        label: f.label,
        type: f.type,
        required: f.required || false,
        options: f.options ? (typeof f.options === 'string' ? f.options.split(',').map((o: string) => o.trim()) : f.options) : [],
        placeholder: f.placeholder || `Enter ${f.label.toLowerCase()}`
      }));
    }
  }

  // 8. Persist
  event.workflow = workflow;
  await event.save();

  return sanitizeEvent(event, true);
};

import { Event, IEvent, EventStatus } from "./event.model";
import mongoose from "mongoose";

   
                         
   
const allowedTransitions: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [
    EventStatus.PUBLISHED,
    EventStatus.CANCELLED
  ],

  [EventStatus.PUBLISHED]: [
    EventStatus.REGISTRATION_OPEN,
    EventStatus.CANCELLED,
    EventStatus.ARCHIVED,
    EventStatus.DRAFT
  ],

  [EventStatus.REGISTRATION_OPEN]: [
    EventStatus.ONGOING,
    EventStatus.CANCELLED
  ],

  [EventStatus.ONGOING]: [
    EventStatus.COMPLETED,
    EventStatus.CANCELLED
  ],

  [EventStatus.COMPLETED]: [
    EventStatus.ARCHIVED
  ],

  [EventStatus.CANCELLED]: [
    EventStatus.ARCHIVED
  ],

  [EventStatus.ARCHIVED]: []
};

   
                           
   
const validateTransition = (
  currentState: EventStatus,
  targetState: EventStatus
) => {
  const allowed = allowedTransitions[currentState];

  if (!allowed.includes(targetState)) {
    const error: any = new Error(
      `Invalid transition from ${currentState} to ${targetState}`
    );
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Validate lifecycle preconditions
 */
const validatePreconditions = (event: IEvent, targetState: EventStatus) => {
  const now = new Date();

  switch (targetState) {
    case EventStatus.PUBLISHED:
      if (!event.title || !event.description) {
        throwError("Event must have title and description before publishing");
      }

      if (!event.startDate || !event.endDate) {
        throwError("Event must have valid start and end dates");
      }

      if (event.endDate <= event.startDate) {
        throwError("Event end date must be after start date");
      }

      break;

    case EventStatus.REGISTRATION_OPEN:
      if (!event.capabilities.registration) {
        throwError("Registration capability not enabled");
      }

      if (!event.registrationStartDate || !event.registrationEndDate) {
        throwError("Registration window must be defined");
      }

      if (event.registrationEndDate <= event.registrationStartDate) {
        throwError("Registration end date must be after start date");
      }

      break;

    case EventStatus.ONGOING:
      if (now < event.startDate) {
        throwError("Event cannot start before start date");
      }
      break;

    case EventStatus.COMPLETED:
      if (now < event.endDate) {
        throwError("Event cannot complete before end date");
      }
      break;

    default:
      break;
  }
};

const throwError = (message: string) => {
  const error: any = new Error(message);
  error.statusCode = 400;
  throw error;
};

/**
 * Transition Service
 */
export const transitionEventState = async (
  eventId: string,
  targetState: EventStatus,
  actorId: string
): Promise<IEvent> => {
  // 1️⃣ Validate eventId format
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throwError("Invalid event ID");
  }

  const event = await Event.findById(eventId);

  if (!event) {
    throwError("Event not found");
  }

  // 2️⃣ Ownership enforcement
  if (event.createdBy.toString() !== actorId) {
    throwError("Forbidden: Only event creator can transition state");
  }

  const currentState = event.status;

  // 3️⃣ Prevent redundant transitions
  if (currentState === targetState) {
    throwError(`Event is already in ${targetState} state`);
  }

  // 4️⃣ Validate transition rule
  validateTransition(currentState, targetState);

  // 5️⃣ Validate preconditions
  validatePreconditions(event, targetState);

  // 6️⃣ Apply state change
  event.status = targetState;

  await event.save();

  return event;
};


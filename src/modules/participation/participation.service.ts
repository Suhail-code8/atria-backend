import { Participation, IParticipation, ParticipationStatus, ParticipationRole } from "./participation.model";
import { Event, EventStatus } from "../events/event.model";
import { User, UserRole } from "../users/user.model";
import mongoose from "mongoose";

   
                          
   
          
                     
                                           
                                                  
                                                    
                                                            
                                                           
   
export const registerParticipant = async (
  eventId: string,
  userId: string,
  answers?: Record<string, any>
): Promise<IParticipation> => {
                     
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

  const user = await User.findById(userId);
  if (!user) {
    const error: any = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.role === UserRole.ORGANIZER) {
    const error: any = new Error("Organizers cannot register for events.");
    error.statusCode = 403;
    throw error;
  }

                         
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

                                               
  if (event.status !== EventStatus.REGISTRATION_OPEN) {
    const error: any = new Error(
      `Event registration is not open. Current status: ${event.status}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4️⃣ Event capability registration must be enabled
  if (!event.capabilities.registration) {
    const error: any = new Error("Event does not have registration enabled");
    error.statusCode = 400;
    throw error;
  }

  // 5️⃣ Current date must be within registration window
  const now = new Date();
  if (!event.registrationStartDate || !event.registrationEndDate) {
    const error: any = new Error("Event registration window not properly configured");
    error.statusCode = 400;
    throw error;
  }

  if (now < event.registrationStartDate) {
    const error: any = new Error(
      `Registration has not started yet. Opens on ${event.registrationStartDate}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (now > event.registrationEndDate) {
    const error: any = new Error(
      `Registration has ended. Closed on ${event.registrationEndDate}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 6️⃣ Validate registration form answers
  if (event.registrationForm && event.registrationForm.length > 0) {
    const providedAnswers = answers || {};
    const missingFields: string[] = [];

    for (const field of event.registrationForm) {
      if (field.required && !providedAnswers[field.id]) {
        missingFields.push(field.label);
      }
    }

    if (missingFields.length > 0) {
      const error: any = new Error(
        `Missing required registration fields: ${missingFields.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 7️⃣ Check for duplicate registration (Mongoose unique index will throw 11000)
  try {
    const participation = await Participation.create({
      event: new mongoose.Types.ObjectId(eventId),
      user: new mongoose.Types.ObjectId(userId),
      status: ParticipationStatus.REGISTERED,
      role: ParticipationRole.PARTICIPANT,
      registeredAt: new Date(),
      answers: answers || {}
    });

    return participation.populate(["event", "user"]);
  } catch (err: any) {
    if (err.code === 11000) {
      const error: any = new Error("User is already registered for this event");
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
};

/**
 * Get participation status of a user for an event
 */
export const getParticipation = async (
  eventId: string,
  userId: string
): Promise<IParticipation | null> => {
  const participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId)
  }).populate(["event", "user"]);

  return participation;
};

/**
 * List all participants for an event (Organizer only)
 */
export const listParticipants = async (eventId: string): Promise<IParticipation[]> => {
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

  const participants = await Participation.find({
    event: new mongoose.Types.ObjectId(eventId)
  })
    .populate("user", "name email role")
    .sort({ registeredAt: -1 });

  return participants;
};

/**
 * Withdraw from an event
 */
export const withdrawParticipant = async (
  eventId: string,
  userId: string
): Promise<IParticipation> => {
  const participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId)
  });

  if (!participation) {
    const error: any = new Error("Participation record not found");
    error.statusCode = 404;
    throw error;
  }

  if (participation.status === ParticipationStatus.WITHDRAWN) {
    const error: any = new Error("Already withdrawn from this event");
    error.statusCode = 400;
    throw error;
  }

  participation.status = ParticipationStatus.WITHDRAWN;
  await participation.save();

  return participation.populate(["event", "user"]);
};

/**
 * Update participation status (Admin/Organizer only)
 */
export const updateParticipationStatus = async (
  participationId: string,
  newStatus: ParticipationStatus,
  actorId: string
): Promise<IParticipation> => {
  if (!mongoose.Types.ObjectId.isValid(participationId)) {
    const error: any = new Error("Invalid participation ID");
    error.statusCode = 400;
    throw error;
  }

  const participation = await Participation.findById(participationId).populate("event");

  if (!participation) {
    const error: any = new Error("Participation record not found");
    error.statusCode = 404;
    throw error;
  }

  const event = participation.event as any;
  if (event.createdBy.toString() !== actorId) {
    const error: any = new Error("Forbidden: Only event creator can update participation status");
    error.statusCode = 403;
    throw error;
  }

  participation.status = newStatus;
  await participation.save();

  return participation.populate(["event", "user"]);
};

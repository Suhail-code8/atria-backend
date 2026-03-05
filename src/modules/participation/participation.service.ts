import {
  Participation,
  IParticipation,
  ParticipationStatus,
  ParticipationRole,
} from "./participation.model";
import { Event, EventStatus } from "../events/event.model";
import { User, UserRole } from "../users/user.model";
import { Team } from "../competitions/team.model";
import mongoose from "mongoose";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

interface EventLeaderboardRow {
  userId: string;
  name: string;
  email: string;
  team: string;
  individualPoints: number;
}

export const registerParticipant = async (
  eventId: string,
  userId: string,
  answers?: Record<string, any>,
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
      `Event registration is not open. Current status: ${event.status}`,
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
    const error: any = new Error(
      "Event registration window not properly configured",
    );
    error.statusCode = 400;
    throw error;
  }

  if (now < event.registrationStartDate) {
    const error: any = new Error(
      `Registration has not started yet. Opens on ${event.registrationStartDate}`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (now > event.registrationEndDate) {
    const error: any = new Error(
      `Registration has ended. Closed on ${event.registrationEndDate}`,
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
        `Missing required registration fields: ${missingFields.join(", ")}`,
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 7️⃣ Check for duplicate registration (Mongoose unique index will throw 11000)
  // 7️⃣ Check for duplicate registration and handle Seat Locks & Payments
  try {
    const hasSeatLimit = typeof event.totalSeats === "number";
    let participationStatus = ParticipationStatus.REGISTERED;
    let lockedUntil: Date | null = null;
    let razorpayOrderId: string | undefined = undefined; // Track the order ID

    if (hasSeatLimit) {
      const activeSeatCount = await getActiveSeatCount(eventId);

      if (activeSeatCount >= event.totalSeats) {
        // Event is Full -> Join Waitlist (No Payment required yet)
        participationStatus = ParticipationStatus.WAITLISTED;
        lockedUntil = null;
      } else if (event.isPaid) {
        // Seats available + Event is Paid -> Lock Seat & Generate Payment
        participationStatus = ParticipationStatus.PENDING_PAYMENT;
        lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min lock
        
        // --- 🚀 NEW: RAZORPAY ORDER GENERATION ---
        const order = await razorpay.orders.create({
          amount: Math.round(event.price * 100), // Razorpay expects paise (multiply by 100)
          currency: "INR",
          receipt: `rcpt_${userId}_${eventId}`.substring(0, 40),
          notes: {
            eventId: eventId,
            userId: userId
          }
        });
        razorpayOrderId = order.id;
        // ------------------------------------------
      }
    } else if (event.isPaid) {
      // No seat limit, but Event is Paid -> Generate Payment
      participationStatus = ParticipationStatus.PENDING_PAYMENT;
      lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Still give 10 min to pay
      
      // --- 🚀 NEW: RAZORPAY ORDER GENERATION ---
      const order = await razorpay.orders.create({
        amount: Math.round(event.price * 100),
        currency: "INR",
        receipt: `rcpt_${userId}_${eventId}`.substring(0, 40),
      });
      razorpayOrderId = order.id;
      // ------------------------------------------
    }

    const participation = await Participation.create({
      event: new mongoose.Types.ObjectId(eventId),
      user: new mongoose.Types.ObjectId(userId),
      status: participationStatus,
      role: ParticipationRole.PARTICIPANT,
      registeredAt: new Date(),
      answers: answers || {},
      lockedUntil,
      razorpayOrderId, // Save the generated Order ID to the database!
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
  userId: string,
): Promise<IParticipation | null> => {
  const participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId),
  }).populate(["event", "user"]);

  return participation;
};

/**
 * List all participants for an event (Organizer only)
 */
export const listParticipants = async (
  eventId: string,
): Promise<IParticipation[]> => {
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
    event: new mongoose.Types.ObjectId(eventId),
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
  userId: string,
): Promise<IParticipation> => {
  const participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId),
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
  actorId: string,
): Promise<IParticipation> => {
  if (!mongoose.Types.ObjectId.isValid(participationId)) {
    const error: any = new Error("Invalid participation ID");
    error.statusCode = 400;
    throw error;
  }

  const participation =
    await Participation.findById(participationId).populate("event");

  if (!participation) {
    const error: any = new Error("Participation record not found");
    error.statusCode = 404;
    throw error;
  }

  const event = participation.event as any;
  if (event.createdBy.toString() !== actorId) {
    const error: any = new Error(
      "Forbidden: Only event creator can update participation status",
    );
    error.statusCode = 403;
    throw error;
  }

  participation.status = newStatus;
  await participation.save();

  return participation.populate(["event", "user"]);
};

export const getEventLeaderboard = async (
  eventId: string,
): Promise<EventLeaderboardRow[]> => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error: any = new Error("Invalid event ID");
    error.statusCode = 400;
    throw error;
  }

  const eventObjectId = new mongoose.Types.ObjectId(eventId);

  const leaderboard = await Participation.aggregate<EventLeaderboardRow>([
    {
      $match: {
        event: eventObjectId,
        role: ParticipationRole.PARTICIPANT,
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: "user",
        foreignField: "_id",
        as: "userDoc",
      },
    },
    {
      $unwind: "$userDoc",
    },
    {
      $lookup: {
        from: Team.collection.name,
        let: { participantId: "$user" },
        pipeline: [
          {
            $match: {
              event: eventObjectId,
            },
          },
          {
            $match: {
              $expr: {
                $in: ["$$participantId", "$members.user"],
              },
            },
          },
          {
            $project: {
              _id: 0,
              name: 1,
            },
          },
        ],
        as: "teamDoc",
      },
    },
    {
      $project: {
        _id: 0,
        userId: { $toString: "$user" },
        name: "$userDoc.name",
        email: "$userDoc.email",
        team: {
          $ifNull: [{ $arrayElemAt: ["$teamDoc.name", 0] }, "Unassigned"],
        },
        individualPoints: { $ifNull: ["$individualPoints", 0] },
      },
    },
    {
      $sort: {
        individualPoints: -1,
        name: 1,
      },
    },
  ]);

  return leaderboard;
};


/**
 * Smart Seat Calculator: Counts confirmed tickets + active locked carts
 */
export const getActiveSeatCount = async (eventId: string): Promise<number> => {
  const activeCount = await Participation.countDocuments({
    event: new mongoose.Types.ObjectId(eventId),
    $or: [
      // 1. Fully confirmed tickets
      { status: { $in: [ParticipationStatus.REGISTERED, ParticipationStatus.APPROVED] } },
      // 2. Pending tickets, BUT ONLY IF the lock timer hasn't expired yet
      {
        status: ParticipationStatus.PENDING_PAYMENT,
        lockedUntil: { $gt: new Date() } 
      }
    ]
  });
  
  return activeCount;
};


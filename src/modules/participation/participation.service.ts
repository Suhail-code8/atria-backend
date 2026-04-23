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
import { getIO } from "../../utils/socket";
import * as notificationService from "../notifications/notification.service";
import { sendEmail } from "../../utils/email.service";
import { env } from "../../config/env";


const razorpay = new Razorpay({
  key_id: env.razorpayKeyId || "",
  key_secret: env.razorpayKeySecret || "",
});

interface EventLeaderboardRow {
  userId: string;
  name: string;
  email?: string;
  team: string;
  individualPoints: number;
}

const createRazorpayOrder = async (eventId: string, userId: string, price: number) => {
  const amountPaise = Math.round(price * 100);
  
  if (amountPaise < 100) {
    const error: any = new Error("Paid registration requires a minimum amount of ₹1.00");
    error.statusCode = 400;
    throw error;
  }

  return razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `rcpt_${userId}_${eventId}_${Date.now()}`.substring(0, 40),
    notes: {
      eventId,
      userId,
    },
  });
};

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

  // 6️⃣ Legacy form validation removed. Registration forms are now completed
  // as the first step of the Workflow Engine via the RegistrationModule.

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
      } else if (event.requiresApproval) {
        // Seats available BUT Requires Approval
        participationStatus = ParticipationStatus.PENDING_APPROVAL;
        lockedUntil = null;
      } else if (event.isPaid) {
        // Seats available + Event is Paid -> Lock Seat & Generate Payment
        participationStatus = ParticipationStatus.PENDING_PAYMENT;
        lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min lock
        
        // --- 🚀 NEW: RAZORPAY ORDER GENERATION ---
        const order = await createRazorpayOrder(eventId, userId, event.price || 0);
        razorpayOrderId = order.id;
        // ------------------------------------------
      }
    } else {
      // No seat limit
      if (event.requiresApproval) {
        participationStatus = ParticipationStatus.PENDING_APPROVAL;
      } else if (event.isPaid) {
        // Event is Paid -> Generate Payment
        participationStatus = ParticipationStatus.PENDING_PAYMENT;
        lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Still give 10 min to pay
        
        // --- 🚀 NEW: RAZORPAY ORDER GENERATION ---
        const order = await createRazorpayOrder(eventId, userId, event.price || 0);
        razorpayOrderId = order.id;
        // ------------------------------------------
      }
    }

    const participation = new Participation({
      event: new mongoose.Types.ObjectId(eventId),
      user: new mongoose.Types.ObjectId(userId),
      status: participationStatus,
      role: ParticipationRole.PARTICIPANT,
      registeredAt: new Date(),
      answers: answers || {},
      lockedUntil,
      razorpayOrderId,
    });

    // Centralized Initialization
    await initializeWorkflow(participation, event);

    // 8️⃣ Atomic Seat Claiming Logic
    if (participationStatus !== ParticipationStatus.WAITLISTED && hasSeatLimit) {
      const updatedEvent = await Event.findOneAndUpdate(
        { _id: eventId, availableSeats: { $gt: 0 } },
        { $inc: { availableSeats: -1 } },
        { new: true }
      );

      if (!updatedEvent) {
        // Race condition: Seat was taken between our check and our save
        // Fallback to waitlist!
        participation.status = ParticipationStatus.WAITLISTED;
        participation.lockedUntil = null;
        participation.razorpayOrderId = undefined;
      }
    }

    await participation.save();

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
  // Cleanup locks for this event first
  await cleanupExpiredLocks(eventId);

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

  // Cleanup locks for this event
  await cleanupExpiredLocks(eventId);

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

  const oldStatus = participation.status;
  participation.status = ParticipationStatus.WITHDRAWN;
  await participation.save();

  // If a seat was freed, increment availableSeats and promote the next person!
  // Only increment if they were taking up a seat
  const wasTakingSeat = [
    ParticipationStatus.REGISTERED, 
    ParticipationStatus.APPROVED, 
    ParticipationStatus.PENDING_APPROVAL,
    ParticipationStatus.PENDING_PAYMENT
  ].includes(oldStatus);

  if (wasTakingSeat) {
    await Event.updateOne(
      { _id: eventId, availableSeats: { $lt: await Event.findById(eventId).then(e => e?.totalSeats || Infinity) } },
      { $inc: { availableSeats: 1 } }
    );
  }

  await promoteFromWaitlist(eventId);

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

  const oldStatus = participation.status;
  participation.status = newStatus;

  // Initialize workflow if approved and not yet started
  await initializeWorkflow(participation, event);

  await participation.save();

  // --- Atomic Seat Sync Logic ---
  const seatTakingStatuses = [
    ParticipationStatus.REGISTERED, 
    ParticipationStatus.APPROVED, 
    ParticipationStatus.PENDING_APPROVAL,
    ParticipationStatus.PENDING_PAYMENT
  ];

  const wasTakingSeat = seatTakingStatuses.includes(oldStatus);
  const isTakingSeat = seatTakingStatuses.includes(newStatus);

  if (typeof event.availableSeats === 'number') {
    if (wasTakingSeat && !isTakingSeat) {
      // Freed a seat
      await Event.updateOne({ _id: event._id }, { $inc: { availableSeats: 1 } });
      await promoteFromWaitlist(event._id.toString());
    } else if (!wasTakingSeat && isTakingSeat) {
      // Took a seat
      await Event.updateOne({ _id: event._id, availableSeats: { $gt: 0 } }, { $inc: { availableSeats: -1 } });
    }
  }

  await participation.populate(["event", "user"]);

  // --- Notifications ---
  const participantUser = (participation as any).user;
  const isApproved = newStatus === ParticipationStatus.APPROVED;
  const statusLabel = isApproved ? "Approved! 🎊" : "Update ℹ️";
  const message = isApproved 
    ? `Your registration for ${event.title} has been approved. You can now start your journey!` 
    : `There has been an update to your registration for ${event.title}. Status: ${newStatus}`;

  // 1. Socket Notification
  try {
    await notificationService.sendNotification({
      recipient: participantUser._id,
      type: isApproved ? "SYSTEM" : "ANNOUNCEMENT",
      title: `Registration ${statusLabel}`,
      message,
      actionUrl: `/events/${event._id}`
    });
  } catch (err) {
    console.error("Failed to send socket notification:", err);
  }

  // 2. Email Notification
  if (participantUser.email) {
    try {
      await sendEmail(
        participantUser.email,
        `Registration ${isApproved ? 'Approved' : 'Status Update'}: ${event.title}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb; margin-bottom: 16px;">${isApproved ? 'You are Approved!' : 'Registration Update'}</h1>
            <p style="font-size: 16px; color: #374151;">${message}</p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Team Atria</p>
          </div>
        `
      );
    } catch (err) {
      console.error("Failed to send status email:", err);
    }
  }

  return participation;
};

/**
 * Update participation data (User/Owner only)
 */
export const updateParticipationData = async (
  participationId: string,
  userId: string,
  data: Partial<IParticipation>,
  advance: boolean = false
): Promise<IParticipation> => {
  if (!mongoose.Types.ObjectId.isValid(participationId)) {
    const error: any = new Error("Invalid participation ID");
    error.statusCode = 400;
    throw error;
  }

  const participation = await Participation.findById(participationId);
  if (!participation) {
    const error: any = new Error("Participation record not found");
    error.statusCode = 404;
    throw error;
  }

  if (participation.user.toString() !== userId) {
    const error: any = new Error("Forbidden: You can only update your own participation record");
    error.statusCode = 403;
    throw error;
  }

  // Allow updating answers and workflowData/workflowState
  if (data.answers) participation.answers = { ...participation.answers, ...data.answers };
  if (data.workflowData) {
    // Deep merge workflow data to prevent overwriting other module progress
    participation.workflowData = { 
      ...(participation.workflowData || {}), 
      ...data.workflowData 
    };
  }
  if (data.workflowState) participation.workflowState = data.workflowState;

  await participation.save();

  if (advance) {
    try {
      await advanceWorkflowNode(participationId, userId);
      // Reload to get the post-advance state
      return (await Participation.findById(participationId))!.populate(["event", "user"]);
    } catch (err) {
      console.error("Auto-advance failed after update:", err);
      // Requirement: Re-throw error to inform the frontend of the failure
      throw err;
    }
  }

  return participation.populate(["event", "user"]);
};


export const getEventLeaderboard = async (
  eventId: string,
  requesterUserId?: string,
): Promise<EventLeaderboardRow[]> => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error: any = new Error("Invalid event ID");
    error.statusCode = 400;
    throw error;
  }

  const event = await Event.findById(eventId).select("createdBy");
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const canViewParticipantEmail =
    Boolean(requesterUserId) && event.createdBy.toString() === requesterUserId;

  const eventObjectId = new mongoose.Types.ObjectId(eventId);

  const leaderboard = await Participation.aggregate<EventLeaderboardRow>([
    {
      $match: {
        event: eventObjectId,
        role: ParticipationRole.PARTICIPANT,
        status: { 
          $in: [ParticipationStatus.REGISTERED, ParticipationStatus.APPROVED] 
        }
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

  if (!canViewParticipantEmail) {
    const publicLeaderboard = leaderboard.map(({ email, ...row }) => row);

    // ─── Real-time emit (fire-and-forget) ─────────────────────────────────
    try {
      getIO().to(`event:${eventId}:leaderboard`).emit("leaderboard:update", publicLeaderboard);
    } catch { /* socket not yet initialized or room empty – safe to ignore */ }
    // ─────────────────────────────────────────────────────────────────────

    return publicLeaderboard;
  }

  // ─── Real-time emit for organizer view ───────────────────────────────────
  try {
    getIO().to(`event:${eventId}:leaderboard`).emit("leaderboard:update", leaderboard);
  } catch { /* socket not available – safe to ignore */ }
  // ─────────────────────────────────────────────────────────────────────────

  return leaderboard;
};


export const getPaymentStatus = async (
  eventId: string,
  userId: string,
): Promise<IParticipation> => {
  // Cleanup locks first
  await cleanupExpiredLocks(eventId);

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

  const participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId),
  });

  if (!participation) {
    const error: any = new Error("Participation record not found");
    error.statusCode = 404;
    throw error;
  }

  return participation.populate(["event", "user"]);
};

export const retryPaymentForParticipation = async (
  eventId: string,
  userId: string,
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

  const [event, participation] = await Promise.all([
    Event.findById(eventId),
    Participation.findOne({
      event: new mongoose.Types.ObjectId(eventId),
      user: new mongoose.Types.ObjectId(userId),
    }),
  ]);

  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (!event.isPaid) {
    const error: any = new Error("This is a free event and does not require payment");
    error.statusCode = 400;
    throw error;
  }

  if (!participation) {
    const error: any = new Error("Participation record not found");
    error.statusCode = 404;
    throw error;
  }

  if (participation.status === ParticipationStatus.REGISTERED) {
    return participation.populate(["event", "user"]);
  }

  const hasSeatLimit = typeof event.totalSeats === "number";
  if (hasSeatLimit) {
    const activeSeatCount = await getActiveSeatCount(eventId);
    const ownsActiveLock =
      participation.status === ParticipationStatus.PENDING_PAYMENT &&
      !!participation.lockedUntil &&
      participation.lockedUntil > new Date();

    if (!ownsActiveLock && activeSeatCount >= (event.totalSeats as number)) {
      participation.status = ParticipationStatus.WAITLISTED;
      participation.lockedUntil = null;
      participation.razorpayOrderId = undefined;
      await participation.save();
      return participation.populate(["event", "user"]);
    }
  }

  const order = await createRazorpayOrder(eventId, userId, event.price || 0);
  participation.status = ParticipationStatus.PENDING_PAYMENT;
  participation.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
  participation.razorpayOrderId = order.id;

  await participation.save();
  return participation.populate(["event", "user"]);
};

/**
 * Verify a Razorpay payment and finalize registration
 */
export const verifyRazorpayPayment = async (
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  userId: string
): Promise<IParticipation> => {
  // 1️⃣ Find the locked ticket
  const participation = await Participation.findOne({
    razorpayOrderId: razorpay_order_id
  });

  if (!participation) {
    const error: any = new Error("Ticket record not found for this order");
    error.statusCode = 404;
    throw error;
  }

  // 2️⃣ Ensure the requesting user owns this participation
  if (participation.user.toString() !== userId) {
    const error: any = new Error("Forbidden: This order does not belong to your account");
    error.statusCode = 403;
    throw error;
  }

  // Idempotency guard
  if (participation.status === ParticipationStatus.REGISTERED) {
    return participation.populate(["event", "user"]);
  }

  // 3️⃣ Finalize
  participation.status = ParticipationStatus.REGISTERED;
  participation.lockedUntil = null;
  participation.razorpayPaymentId = razorpay_payment_id;

  const event = await Event.findById(participation.event);
  
  // Workflow Engine Initialization
  await initializeWorkflow(participation, event!);
  await participation.save();

  // Auto-advance
  try {
    await advanceWorkflowNode(participation._id.toString(), userId);
  } catch (err) {
    console.warn("Auto-advance after payment failed (non-blocking):", err);
  }

  // 4️⃣ Notifications
  try {
    await notificationService.sendNotification({
      recipient: userId,
      type: "PAYMENT",
      title: "Payment Successful! 🎉",
      message: "Your payment was verified and your seat is officially confirmed.",
      actionUrl: `/events/${participation.event}`
    });
  } catch (error) {
    console.error("Failed to send payment socket notification (ignoring):", error);
  }

  await participation.populate(["event", "user"]);
  const participantUser = (participation as any).user;
  const participantEvent = (participation as any).event;

  if (participantUser?.email) {
    try {
      await sendEmail(
        participantUser.email,
        `Registration Confirmed: ${participantEvent?.title || "your event"}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb; margin-bottom: 16px;">You are in!</h1>
            <p style="font-size: 16px; color: #374151;">Thanks for registering for <strong>${participantEvent?.title || "your event"}</strong>.</p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Team Atria</p>
          </div>
        `
      );
    } catch (err) {
       console.error("Failed to send payment confirmation email (ignoring):", err);
    }
  }

  return participation;
};




/**
 * Explicitly find and expire stale locks.
 * Returns true if any locks were cleaned up.
 */
export const cleanupExpiredLocks = async (eventId: string): Promise<boolean> => {
  const expiredParticipations = await Participation.find({
    event: new mongoose.Types.ObjectId(eventId),
    status: ParticipationStatus.PENDING_PAYMENT,
    lockedUntil: { $lte: new Date() }
  }).populate("user");

  if (expiredParticipations.length === 0) return false;

  const event = await Event.findById(eventId);
  
    for (const part of expiredParticipations) {
      const user = part.user as any;
      part.status = ParticipationStatus.WAITLISTED;
      part.lockedUntil = null;
      part.razorpayOrderId = undefined;
      await part.save();
      
      // Return seat to pool atomically
      await Event.updateOne({ _id: eventId }, { $inc: { availableSeats: 1 } });

      // Notify user about expiry
      try {
        await notificationService.sendNotification({
          recipient: user._id.toString(),
          type: "WAITLIST",
          title: "Seat Lock Expired ⏳",
          message: `Your payment lock for ${event?.title || "the event"} has expired. You have been moved to the waitlist.`,
          actionUrl: `/events/${eventId}`
        });

        if (user.email) {
          await sendEmail(
            user.email,
            "Payment Lock Expired",
            `<p>Your 10-minute payment lock for <strong>${event?.title || "the event"}</strong> has expired. Your spot has been released and you are now on the waitlist.</p>`
          );
        }
      } catch (err) {
        console.warn("Failed to notify user about lock expiry:", err);
      }
    }
    
    // Since seats were freed, promote next people
    await promoteFromWaitlist(eventId);
  
  return true;
};

/**
 * Smart Seat Calculator: Counts confirmed tickets + active locked carts
 * Also cleans up expired locks on the fly to keep availableSeats accurate.
 */
export const getActiveSeatCount = async (eventId: string): Promise<number> => {
  // ─── 🚀 ON-THE-FLY CLEANUP ────────────────────────────────────────────────
  await cleanupExpiredLocks(eventId);

  const activeCount = await Participation.countDocuments({
    event: new mongoose.Types.ObjectId(eventId),
    $or: [
      // 1. Fully confirmed tickets or awaiting approval
      { status: { $in: [ParticipationStatus.REGISTERED, ParticipationStatus.APPROVED, ParticipationStatus.PENDING_APPROVAL] } },
      // 2. Pending tickets, BUT ONLY IF the lock timer hasn't expired yet
      {
        status: ParticipationStatus.PENDING_PAYMENT,
        lockedUntil: { $gt: new Date() } 
      }
    ]
  });
  
  return activeCount;
};

/**
 * Automagically promote the next person from waitlist when a seat opens up
 */
export const promoteFromWaitlist = async (eventId: string): Promise<void> => {
  const event = await Event.findById(eventId);
  if (!event || typeof event.totalSeats !== "number") return;

  const activeSeats = await getActiveSeatCount(eventId);
  if (activeSeats >= event.totalSeats) return; // Still full

  // Find the oldest waitlisted person
  const nextInLine = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    status: ParticipationStatus.WAITLISTED
  }).sort({ registeredAt: 1 }).populate("user");

  if (!nextInLine) return;

  const user = nextInLine.user as any;

  if (event.isPaid) {
    // Promote to PENDING_PAYMENT
    nextInLine.status = ParticipationStatus.PENDING_PAYMENT;
    nextInLine.lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min to pay
    
    // Create Razorpay Order
    try {
      const order = await createRazorpayOrder(eventId, user._id.toString(), event.price || 0);
      nextInLine.razorpayOrderId = order.id;
    } catch (err) {
      console.error("Failed to create order for waitlist promotion:", err);
      // Fallback: stay waitlisted or handle error? For now, we'll just log.
      return;
    }
  } else if (event.requiresApproval) {
    // Promote to PENDING_APPROVAL
    nextInLine.status = ParticipationStatus.PENDING_APPROVAL;
  } else {
    // Promote to REGISTERED
    nextInLine.status = ParticipationStatus.REGISTERED;
  }

  await nextInLine.save();

  // 4️⃣ Atomic Seat Claiming Logic
  if (typeof event.availableSeats === 'number') {
    const updated = await Event.findOneAndUpdate(
      { _id: eventId, availableSeats: { $gt: 0 } },
      { $inc: { availableSeats: -1 } }
    );
    
    if (!updated) {
      // Race condition: Seat was taken. Revert!
      nextInLine.status = ParticipationStatus.WAITLISTED;
      nextInLine.lockedUntil = null;
      nextInLine.razorpayOrderId = undefined;
      await nextInLine.save();
      return;
    }
  }

  // Notify User
  try {
    await notificationService.sendNotification({
      recipient: user._id.toString(),
      type: "WAITLIST",
      title: "Good news! A spot opened up 🎉",
      message: event.isPaid 
        ? `You have been promoted from the waitlist for ${event.title}. Please complete your payment within 10 minutes to secure your seat.`
        : `You have been promoted from the waitlist for ${event.title}. Your registration is now confirmed!`,
      actionUrl: `/events/${eventId}`
    });

    if (user.email) {
      await sendEmail(
        user.email,
        `Spot available for ${event.title}`,
        `<p>A spot has opened up for <strong>${event.title}</strong>. ${
          event.isPaid 
            ? "Please log in and complete your payment within 10 minutes." 
            : "Your registration is now confirmed!"
        }</p>`
      );
    }
  } catch (err) {
    console.warn("Failed to notify promoted participant:", err);
  }
};

// ─── Workflow Engine ─────────────────────────────────────────────────────────

/**
 * Utility to get nested property from an object using a dot-notated string (e.g. "registration.role")
 */
const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Simple condition evaluator for workflow edges.
 * Condition shape: { field: string; operator: "eq"|"ne"|"gt"|"lt"; value: any }
 * An empty/missing condition always passes (auto-advance).
 */
const evaluateCondition = (
  condition: Record<string, any> | undefined,
  workflowData: Record<string, any>
): boolean => {
  if (!condition || Object.keys(condition).length === 0) return true;

  const { field, operator, value } = condition;
  const actual = getNestedValue(workflowData, field);

  switch (operator) {
    case "eq":  return actual === value;
    case "ne":  return actual !== value;
    case "gt":  return actual >  value;
    case "lt":  return actual <  value;
    case "gte": return actual >= value;
    case "lte": return actual <= value;
    default:    return true; // unknown operator → pass
  }
};

/**
 * POST /api/participation/:participationId/advance
 *
 * Advances a participant to the next node in the event's workflow graph.
 * - If currentWorkflowNodeId is unset, moves to the first node.
 * - Evaluates edge conditions using workflowData stored on the participation.
 * - Pushes history entries with enteredAt / leftAt timestamps.
 */
export const advanceWorkflowNode = async (
  participationId: string,
  userId: string
): Promise<{ participation: IParticipation; nextNode: any }> => {
  // 1. Validate ID
  if (!mongoose.Types.ObjectId.isValid(participationId)) {
    const error: any = new Error("Invalid participation ID");
    error.statusCode = 400;
    throw error;
  }

  // 2. Load participation
  const participation = await Participation.findById(participationId);
  if (!participation) {
    const error: any = new Error("Participation record not found");
    error.statusCode = 404;
    throw error;
  }

  // 3. Ownership check – only the participant themselves can advance
  if (participation.user.toString() !== userId) {
    const error: any = new Error("Forbidden: You can only advance your own workflow");
    error.statusCode = 403;
    throw error;
  }

  // 4. Fetch the event to get the workflow graph
  const event = await Event.findById(participation.event);
  if (!event) {
    const error: any = new Error("Associated event not found");
    error.statusCode = 404;
    throw error;
  }

  const workflow = event.workflow ?? { nodes: [], edges: [] };

  if (!workflow.nodes || workflow.nodes.length === 0) {
    const error: any = new Error("This event does not have a workflow configured");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();

  // 5. Determine current node
  let currentNode = workflow.nodes.find(
    (n) => n.id === participation.currentWorkflowNodeId
  );

  // 5a. First call – move to the very first node
  if (!currentNode && !participation.currentWorkflowNodeId) {
    const firstNode = workflow.nodes[0];
    participation.currentWorkflowNodeId = firstNode.id;
    participation.workflowState = firstNode.type;
    participation.history = participation.history ?? [];
    participation.history.push({ nodeId: firstNode.id, enteredAt: now });
    await participation.save();

    return {
      participation: await participation.populate(["event", "user"]),
      nextNode: firstNode,
    };
  }

  console.log(`[Workflow] Advancing participation ${participationId} from node ${participation.currentWorkflowNodeId} (${participation.workflowState})`);

  if (!currentNode) {
    const error: any = new Error("Current workflow node not found in event workflow");
    error.statusCode = 400;
    throw error;
  }

  // 6. Find outgoing edges from current node
  const outgoingEdges = (workflow.edges ?? []).filter(
    (e) => e.source === currentNode!.id
  );

  if (outgoingEdges.length === 0) {
    console.log(`[Workflow] No outgoing edges found for node ${currentNode!.id}. Marking onboarding as complete.`);
    // No outgoing edges — participant has finished all sequential steps.
    // Mark as onboarding complete to trigger the persistent dashboard.
    participation.workflowState = 'ONBOARDING_COMPLETE';
    participation.currentWorkflowNodeId = undefined;
    await participation.save();
    return {
      participation: await participation.populate(["event", "user"]),
      nextNode: null,
    };
  }

  // 7. Evaluate conditions to pick next node
  const workflowData = (participation.workflowData as Record<string, any>) ?? {};
  let nextEdge = outgoingEdges.find((e) =>
    evaluateCondition(e.condition as Record<string, any> | undefined, workflowData)
  );

  if (!nextEdge) {
    const error: any = new Error("No valid edge condition matched – cannot advance workflow");
    error.statusCode = 400;
    throw error;
  }

  const nextNode = workflow.nodes.find((n) => n.id === nextEdge!.target);
  if (!nextNode) {
    const error: any = new Error(`Target node '${nextEdge.target}' not found in workflow`);
    error.statusCode = 400;
    throw error;
  }

  // 8. Update history pointer logic
  participation.history = participation.history ?? [];
  
  // Find current position in history
  const currentIndex = [...participation.history].reverse().findIndex(h => h.nodeId === currentNode!.id && !h.leftAt);
  const actualIndex = currentIndex !== -1 ? (participation.history.length - 1 - currentIndex) : (participation.history.length - 1);
  const currentEntry = participation.history[actualIndex];

  // Stamp current node as left
  if (currentEntry) currentEntry.leftAt = now;

  // Check if we are re-advancing through an existing history trail
  const nextTargetIndex = actualIndex + 1;
  const existingNextEntry = participation.history[nextTargetIndex];

  if (existingNextEntry && existingNextEntry.nodeId === nextNode.id) {
    // We are re-entering a previously visited path
    existingNextEntry.leftAt = undefined; // Clear leftAt as it's now active again
  } else {
    // Diversion or New Path: Truncate any stale "forward" history and push new
    if (nextTargetIndex < participation.history.length) {
      participation.history = participation.history.slice(0, nextTargetIndex);
    }
    participation.history.push({ nodeId: nextNode.id, enteredAt: now });
  }

  // 9. Advance Pointer
  // If the next node is the terminal ONBOARDING_COMPLETE node,
  // mark as complete and clear the workflow pointer.
  if (nextNode.type === 'ONBOARDING_COMPLETE') {
    console.log(`[Workflow] Terminal node reached: ${nextNode.id}. Clearing pointer and marking complete.`);
    participation.currentWorkflowNodeId = undefined;
    participation.workflowState = 'ONBOARDING_COMPLETE';
    // Still record history entry for the terminal node
    participation.history = participation.history ?? [];
    participation.history.push({ nodeId: nextNode.id, enteredAt: now });
    await participation.save();
    return {
      participation: await participation.populate(["event", "user"]),
      nextNode
    };
  }

  console.log(`[Workflow] Moving to next node: ${nextNode.id} (${nextNode.type})`);
  participation.currentWorkflowNodeId = nextNode.id;
  participation.workflowState = nextNode.type;
  await participation.save();

  return {
    participation: await participation.populate(["event", "user"]),
    nextNode
  };
};

/**
 * Regresses a participant to the previous node in their history.
 */
export const regressWorkflowNode = async (
  participationId: string,
  userId: string
): Promise<{ participation: IParticipation; prevNode: any }> => {
  if (!mongoose.Types.ObjectId.isValid(participationId)) {
    const error: any = new Error("Invalid participation ID");
    error.statusCode = 400;
    throw error;
  }

  const participation = await Participation.findById(participationId);
  if (!participation || participation.user.toString() !== userId) {
    const error: any = new Error("Participation not found or unauthorized");
    error.statusCode = 404;
    throw error;
  }

  if (!participation.history || participation.history.length <= 1) {
    const error: any = new Error("Cannot regress further - you are at the beginning");
    error.statusCode = 400;
    throw error;
  }

  // Find where we are currently in the history
  const currentIndex = [...participation.history].reverse().findIndex(h => h.nodeId === participation.currentWorkflowNodeId);
  const actualIndex = currentIndex !== -1 ? (participation.history.length - 1 - currentIndex) : -1;

  if (actualIndex <= 0) {
    const error: any = new Error("Already at the start of your journey history");
    error.statusCode = 400;
    throw error;
  }

  // Pointer moves back
  const prevEntry = participation.history[actualIndex - 1];
  
  // Stamp current as left so it shows as "completed/visited" in UI
  const currentEntry = participation.history[actualIndex];
  if (currentEntry && !currentEntry.leftAt) {
    currentEntry.leftAt = new Date();
  }

  // Load event to get node details
  const event = await Event.findById(participation.event);
  const prevNode = event?.workflow?.nodes.find(n => n.id === prevEntry.nodeId);

  if (!prevNode) {
     const error: any = new Error("Previous node no longer exists in event workflow");
     error.statusCode = 400;
     throw error;
  }

  participation.currentWorkflowNodeId = prevNode.id;
  participation.workflowState = prevNode.type;
  
  await participation.save();
  
  return {
    participation: await (participation as any).populate(["event", "user"]),
    prevNode
  };
};

/**
 * Robustly initializes workflow for a participation.
 * Used during registration, payment verification, and manual approval.
 */
export const initializeWorkflow = async (
  participation: IParticipation,
  eventData?: any
) => {
  // Only initialize if REGISTERED/APPROVED and not already started
  const isEligible = 
    participation.status === ParticipationStatus.REGISTERED || 
    participation.status === ParticipationStatus.APPROVED;
    
  if (!isEligible || participation.currentWorkflowNodeId) return;

  const event = eventData || await Event.findById(participation.event);
  if (!event || !event.workflow?.nodes?.length) return;

  const firstNode = event.workflow.nodes[0];
  participation.currentWorkflowNodeId = firstNode.id;
  participation.workflowState = firstNode.type;
  participation.history = [{
    nodeId: firstNode.id,
    enteredAt: new Date(),
  }];
};

/**
 * System-level workflow advance that bypasses the userId ownership check.
 * Used by organizer actions (e.g. assigning a participant to a team) that
 * should automatically advance the participant to the next workflow node.
 */
export const advanceWorkflowNodeAsSystem = async (
  participationId: string,
  participantUserId: string
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(participationId)) return;

  const participation = await Participation.findById(participationId);
  if (!participation) return;

  const event = await Event.findById(participation.event);
  if (!event) return;

  const workflow = event.workflow ?? { nodes: [], edges: [] };
  if (!workflow.nodes || workflow.nodes.length === 0) return;

  const now = new Date();

  const currentNode = workflow.nodes.find(
    (n) => n.id === participation.currentWorkflowNodeId
  );

  if (!currentNode) return;

  const outgoingEdges = (workflow.edges ?? []).filter(
    (e) => e.source === currentNode.id
  );

  if (outgoingEdges.length === 0) return;

  const workflowData = (participation.workflowData as Record<string, any>) ?? {};
  const nextEdge = outgoingEdges.find((e) => {
    const cond = e.condition as Record<string, any> | undefined;
    if (!cond || Object.keys(cond).length === 0) return true;
    const { field, operator, value } = cond;
    const actual = field.split('.').reduce((acc: any, part: string) => acc && acc[part], workflowData);
    switch (operator) {
      case "eq":  return actual === value;
      case "ne":  return actual !== value;
      case "gt":  return actual > value;
      case "lt":  return actual < value;
      case "gte": return actual >= value;
      case "lte": return actual <= value;
      default:    return true;
    }
  });

  if (!nextEdge) return;

  const nextNode = workflow.nodes.find((n) => n.id === nextEdge.target);
  if (!nextNode) return;

  // Update history
  participation.history = participation.history ?? [];
  const currentIndex = [...participation.history].reverse().findIndex(
    (h) => h.nodeId === currentNode.id && !h.leftAt
  );
  const actualIndex = currentIndex !== -1
    ? participation.history.length - 1 - currentIndex
    : participation.history.length - 1;
  const currentEntry = participation.history[actualIndex];
  if (currentEntry) currentEntry.leftAt = now;

  participation.history.push({ nodeId: nextNode.id, enteredAt: now });
  participation.currentWorkflowNodeId = nextNode.id;
  participation.workflowState = nextNode.type;

  await participation.save();
};


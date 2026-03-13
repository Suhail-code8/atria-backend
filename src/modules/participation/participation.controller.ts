import { Request, Response, NextFunction } from "express";
import * as participationService from "./participation.service";
import { Participation } from "./participation.model";
import { ParticipationStatus } from "./participation.model";
import { sendEmail } from "../../utils/email.service";
import crypto from "crypto";
   
                                        
                                     
   
export const registerForEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;
    const { answers } = req.body;

    const participation = await participationService.registerParticipant(
      eventId,
      userId,
      answers
    );

    // Only send confirmation email for free events that are immediately REGISTERED.
    // For paid events (PENDING_PAYMENT), the email fires inside verifyPayment after payment confirmation.
    if (participation.status === ParticipationStatus.REGISTERED) {
      const participantUser = (participation as any).user;
      const participantEvent = (participation as any).event;
      const recipientEmail = participantUser?.email as string | undefined;
      const eventTitle = (participantEvent?.title as string | undefined) || "your event";

      if (recipientEmail) {
        try {
          await sendEmail(
            recipientEmail,
            `Registration Confirmed: ${eventTitle}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb; margin-bottom: 16px;">You are in!</h1>
                <p style="font-size: 16px; color: #374151;">Thanks for registering for <strong>${eventTitle}</strong>.</p>
                <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Team Atria</p>
              </div>
            `
          );
        } catch {
          // Email failure must not break the registration response
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Successfully registered for event",
      data: participation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /participation/:eventId/me
 * Get current user's participation status
 */
export const getMyParticipation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    const participation = await participationService.getParticipation(
      eventId,
      userId
    );

    if (!participation) {
      const error: any = new Error("Not registered for this event");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: participation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /participation/me
 * List current user's registered events
 */
export const getMyRegistrations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;

    const participations = await Participation.find({ user: userId })
      .populate("event")
      .sort({ createdAt: -1 });

    const events = participations
      .map((participation) => participation.event)
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: events
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /participation/:eventId/list
 * List all participants for an event (Organizer only)
 */
export const listParticipants = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;

    const participants = await participationService.listParticipants(eventId);

    res.status(200).json({
      success: true,
      data: participants
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /participation/:eventId/withdraw
 * Withdraw from an event
 */
export const withdrawFromEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    const participation = await participationService.withdrawParticipant(
      eventId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Successfully withdrawn from event",
      data: participation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /participation/:participationId/status
 * Update participation status (Admin/Organizer only)
 */
export const updateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const participationId = req.params.participationId as string;
    const { status } = req.body;
    const actorId = req.user!.userId;

    if (!status || !Object.values(ParticipationStatus).includes(status)) {
      const error: any = new Error("Invalid participation status");
      error.statusCode = 400;
      throw error;
    }

    const participation = await participationService.updateParticipationStatus(
      participationId,
      status,
      actorId
    );

    res.status(200).json({
      success: true,
      message: `Participation status updated to ${status}`,
      data: participation
    });
  } catch (err) {
    next(err);
  }
};

export const getEventLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const requesterUserId = req.user?.userId as string | undefined;
    const leaderboard = await participationService.getEventLeaderboard(eventId, requesterUserId);

    res.status(200).json({
      success: true,
      data: leaderboard
    });
  } catch (err) {
    next(err);
  }
};

export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      const error: any = new Error("Missing payment verification details");
      error.statusCode = 400;
      throw error;
    }

    // 1️⃣ Create the expected signature using your Secret Key
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // 2️⃣ Compare signatures using constant-time comparison to prevent timing attacks
    const generatedBuf = Buffer.from(generatedSignature, 'hex');
    const receivedBuf = Buffer.from(razorpay_signature, 'hex');
    const signaturesMatch =
      generatedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(generatedBuf, receivedBuf);

    if (!signaturesMatch) {
      const error: any = new Error("Invalid payment signature. Payment rejected.");
      error.statusCode = 400;
      throw error;
    }

    // 3️⃣ Signature is valid! Find the locked ticket
    const participation = await Participation.findOne({ 
      razorpayOrderId: razorpay_order_id 
    });

    if (!participation) {
      const error: any = new Error("Ticket record not found for this order");
      error.statusCode = 404;
      throw error;
    }

    // 4️⃣ Ensure the requesting user owns this participation (prevents cross-user replay)
    if (participation.user.toString() !== req.user!.userId) {
      const error: any = new Error("Forbidden: This order does not belong to your account");
      error.statusCode = 403;
      throw error;
    }

    // Idempotency guard: if already verified, return the existing confirmed record
    if (participation.status === ParticipationStatus.REGISTERED) {
      await participation.populate(["event", "user"]);
      return res.status(200).json({
        success: true,
        message: "Payment already verified.",
        data: participation
      });
    }

    // 5️⃣ THE MAGIC: Make the seat permanent!
    participation.status = ParticipationStatus.REGISTERED;
    participation.lockedUntil = null; // Clear the 10-minute timer!
    participation.razorpayPaymentId = razorpay_payment_id;

    await participation.save();

    // 6️⃣ Populate before sending response AND before reading email fields
    await participation.populate(["event", "user"]);

    // 7️⃣ Send the confirmation email NOW that payment is actually confirmed
    const participantUser = (participation as any).user;
    const participantEvent = (participation as any).event;
    const recipientEmail = participantUser?.email as string | undefined;
    const eventTitle = (participantEvent?.title as string | undefined) || "your event";

    if (recipientEmail) {
      try {
        await sendEmail(
          recipientEmail,
          `Registration Confirmed: ${eventTitle}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb; margin-bottom: 16px;">You are in!</h1>
              <p style="font-size: 16px; color: #374151;">Thanks for registering for <strong>${eventTitle}</strong>.</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Team Atria</p>
            </div>
          `
        );
      } catch {
        // Email failure must not block the payment confirmation response
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully! Seat is confirmed.",
      data: participation
    });
  } catch (err) {
    next(err);
  }
};

export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    const participation = await participationService.getPaymentStatus(eventId, userId);

    res.status(200).json({
      success: true,
      data: participation,
    });
  } catch (err) {
    next(err);
  }
};

export const retryPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const userId = req.user!.userId;

    const participation = await participationService.retryPaymentForParticipation(eventId, userId);

    res.status(200).json({
      success: true,
      message: "Payment session prepared",
      data: participation,
    });
  } catch (err) {
    next(err);
  }
};

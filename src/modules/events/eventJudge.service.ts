import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Event } from "./event.model";
import { EventJudge, IEventJudge } from "./eventJudge.model";
import { User, UserRole } from "../users/user.model";
import { CompetitionItem } from "../competitions/competitionItem.model";

const ensureValidObjectId = (id: string, label: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error: any = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

const ensureEventCreator = async (eventId: string, actorUserId: string): Promise<void> => {
  const event = await Event.findById(eventId).select("createdBy");
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }
  if (event.createdBy.toString() !== actorUserId) {
    const error: any = new Error("Forbidden: Only event creator can manage judges");
    error.statusCode = 403;
    throw error;
  }
};

const getNameFromEmail = (email: string): string => {
  const prefix = email.split("@")[0] || "Judge";
  return prefix
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ") || "Judge";
};

/**
 * Assign a judge to an event. Creates a JUDGE user account if one doesn't exist.
 */
export const assignJudge = async (
  eventId: string,
  email: string,
  assignedItemIds: string[],
  actorUserId: string
): Promise<IEventJudge> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(actorUserId, "actor user ID");

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error: any = new Error("Invalid email format");
    error.statusCode = 400;
    throw error;
  }

  await ensureEventCreator(eventId, actorUserId);

  // Validate item IDs
  const itemObjectIds: mongoose.Types.ObjectId[] = [];
  for (const itemId of assignedItemIds) {
    ensureValidObjectId(itemId, "competition item ID");
    const item = await CompetitionItem.findById(itemId);
    if (!item || item.event.toString() !== eventId) {
      const error: any = new Error(`Competition item ${itemId} not found for this event`);
      error.statusCode = 400;
      throw error;
    }
    itemObjectIds.push(new mongoose.Types.ObjectId(itemId));
  }

  // Find or create the judge user
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const placeholder = randomBytes(24).toString("hex");
    const hashed = await bcrypt.hash(placeholder, 10);
    user = await User.create({
      name: getNameFromEmail(normalizedEmail),
      email: normalizedEmail,
      password: hashed,
      role: UserRole.JUDGE,
      refreshToken: null,
      isPlaceholder: true
    });
  } else if (user.role !== UserRole.JUDGE) {
    // Upgrade existing user to JUDGE role if not already
    user.role = UserRole.JUDGE;
    await user.save();
  }

  // Upsert EventJudge record
  const existing = await EventJudge.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: user._id
  });

  if (existing) {
    existing.assignedItems = itemObjectIds;
    await existing.save();
    return existing.populate([
      { path: "user", select: "name email role" },
      { path: "assignedItems", select: "name type" }
    ]);
  }

  const judge = await EventJudge.create({
    event: new mongoose.Types.ObjectId(eventId),
    user: user._id,
    assignedItems: itemObjectIds
  });

  return judge.populate([
    { path: "user", select: "name email role" },
    { path: "assignedItems", select: "name type" }
  ]);
};

/**
 * Get all judges for an event.
 */
export const getEventJudges = async (eventId: string): Promise<IEventJudge[]> => {
  ensureValidObjectId(eventId, "event ID");

  const judges = await EventJudge.find({
    event: new mongoose.Types.ObjectId(eventId)
  })
    .populate("user", "name email role")
    .populate("assignedItems", "name type")
    .sort({ createdAt: -1 });

  return judges;
};

/**
 * Get all event assignments for a specific judge user.
 */
export const getMyAllAssignments = async (userId: string): Promise<IEventJudge[]> => {
  ensureValidObjectId(userId, "user ID");

  return EventJudge.find({
    user: new mongoose.Types.ObjectId(userId)
  })
  .populate("event", "title registrationStartDate registrationEndDate posterImageUrl")
  .populate("assignedItems", "name type placePoints gradePoints gradeRanges")
  .sort({ createdAt: -1 });
};

/**
 * Get item IDs assigned to a specific judge user for an event.
 */
export const getJudgeAssignedItems = async (
  eventId: string,
  userId: string
): Promise<IEventJudge | null> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(userId, "user ID");

  return EventJudge.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(userId)
  }).populate("assignedItems", "name type placePoints gradePoints gradeRanges");
};

/**
 * Update a judge's assigned items.
 */
export const updateJudgeItems = async (
  judgeId: string,
  assignedItemIds: string[],
  actorUserId: string
): Promise<IEventJudge> => {
  ensureValidObjectId(judgeId, "judge ID");

  const judge = await EventJudge.findById(judgeId);
  if (!judge) {
    const error: any = new Error("Judge assignment not found");
    error.statusCode = 404;
    throw error;
  }

  await ensureEventCreator(judge.event.toString(), actorUserId);

  const itemObjectIds: mongoose.Types.ObjectId[] = [];
  for (const itemId of assignedItemIds) {
    ensureValidObjectId(itemId, "competition item ID");
    itemObjectIds.push(new mongoose.Types.ObjectId(itemId));
  }

  judge.assignedItems = itemObjectIds;
  await judge.save();

  return judge.populate([
    { path: "user", select: "name email role" },
    { path: "assignedItems", select: "name type" }
  ]);
};

/**
 * Remove a judge from an event.
 */
export const removeJudge = async (
  judgeId: string,
  actorUserId: string
): Promise<{ deleted: true }> => {
  ensureValidObjectId(judgeId, "judge ID");

  const judge = await EventJudge.findById(judgeId);
  if (!judge) {
    const error: any = new Error("Judge assignment not found");
    error.statusCode = 404;
    throw error;
  }

  await ensureEventCreator(judge.event.toString(), actorUserId);
  await judge.deleteOne();
  return { deleted: true };
};

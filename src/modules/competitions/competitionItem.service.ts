import mongoose from "mongoose";
import { Event } from "../events/event.model";
import {
  CompetitionItem,
  IGradeRange,
  ICompetitionItem,
  IPlacePoints,
  ItemType
} from "./competitionItem.model";
import { Category } from "./category.model";

interface ItemPlacePointsInput {
  first?: number;
  second?: number;
  third?: number;
}

export interface ItemGradeRangeInput {
  grade: string;
  minPoints: number;
  maxPoints: number;
}

export interface CreateCompetitionItemInput {
  name: string;
  type: ItemType;
  allowedCategories?: string | string[];
  minParticipantsPerTeam?: number;
  maxParticipantsPerTeam?: number;
  maxTotalParticipants?: number;
  placePoints?: ItemPlacePointsInput;
  gradeRanges?: ItemGradeRangeInput[];
  countsTowardOverallTotal?: boolean;
}

export interface UpdateCompetitionItemInput {
  name?: string;
  type?: ItemType;
  allowedCategories?: string | string[];
  minParticipantsPerTeam?: number;
  maxParticipantsPerTeam?: number;
  maxTotalParticipants?: number;
  placePoints?: ItemPlacePointsInput;
  gradeRanges?: ItemGradeRangeInput[];
  countsTowardOverallTotal?: boolean;
}

const normalizePlacePoints = (input?: ItemPlacePointsInput): IPlacePoints | undefined => {
  if (!input) return undefined;
  return {
    first: input.first ?? 10,
    second: input.second ?? 6,
    third: input.third ?? 2
  };
};

const normalizeGradeRanges = (input?: ItemGradeRangeInput[]): IGradeRange[] => {
  if (!input || !Array.isArray(input)) return [];
  
  return input.map((range) => {
    return {
      grade: range.grade.trim(),
      minPoints: Number(range.minPoints ?? 0),
      maxPoints: Number(range.maxPoints ?? 0)
    };
  });
};

const resolveAllowedCategories = async (
  eventId: string,
  allowedCategories?: string | string[]
): Promise<mongoose.Types.ObjectId[]> => {
  const allowedCategoryObjectIds: mongoose.Types.ObjectId[] = [];
  const categoryIds = Array.isArray(allowedCategories)
    ? allowedCategories
    : allowedCategories
    ? [allowedCategories]
    : [];

  if (categoryIds.length) {
    for (const categoryId of categoryIds) {
      ensureValidObjectId(categoryId, "category ID");
      allowedCategoryObjectIds.push(new mongoose.Types.ObjectId(categoryId));
    }

    const matchedCount = await Category.countDocuments({
      _id: { $in: allowedCategoryObjectIds },
      event: new mongoose.Types.ObjectId(eventId)
    });

    if (matchedCount !== allowedCategoryObjectIds.length) {
      const error: any = new Error("One or more categories are invalid for this event");
      error.statusCode = 400;
      throw error;
    }
  }

  return allowedCategoryObjectIds;
};

const ensureValidObjectId = (id: string, label: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error: any = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

const ensureEventCreator = async (eventId: string, actorUserId: string): Promise<void> => {
  ensureValidObjectId(actorUserId, "user ID");

  const event = await Event.findById(eventId).select("createdBy");
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.createdBy.toString() !== actorUserId) {
    const error: any = new Error("Forbidden: Only event creator can manage competition items");
    error.statusCode = 403;
    throw error;
  }
};

export const createItem = async (
  eventId: string,
  data: CreateCompetitionItemInput,
  actorUserId: string
): Promise<ICompetitionItem> => {
  ensureValidObjectId(eventId, "event ID");

  if (!data.name?.trim()) {
    const error: any = new Error("Item name is required");
    error.statusCode = 400;
    throw error;
  }

  if (!data.type || !Object.values(ItemType).includes(data.type)) {
    const error: any = new Error("Valid item type is required");
    error.statusCode = 400;
    throw error;
  }

  await ensureEventCreator(eventId, actorUserId);

  const allowedCategoryObjectIds = await resolveAllowedCategories(eventId, data.allowedCategories);

  const maxParticipantsPerTeam =
    data.type === ItemType.INDIVIDUAL ? 1 : data.maxParticipantsPerTeam ?? 1;

  const placePoints = normalizePlacePoints(data.placePoints);
  const gradeRanges = normalizeGradeRanges(data.gradeRanges);

  const item = await CompetitionItem.create({
    event: new mongoose.Types.ObjectId(eventId),
    name: data.name.trim(),
    type: data.type,
    allowedCategories: allowedCategoryObjectIds,
    minParticipantsPerTeam: data.minParticipantsPerTeam ?? 1,
    maxParticipantsPerTeam,
    maxTotalParticipants: data.maxTotalParticipants,
    placePoints,
    gradeRanges,
    countsTowardOverallTotal: data.countsTowardOverallTotal ?? true
  });

  return item;
};

export const getEventItems = async (eventId: string): Promise<ICompetitionItem[]> => {
  ensureValidObjectId(eventId, "event ID");

  const items = await CompetitionItem.find({
    event: new mongoose.Types.ObjectId(eventId)
  })
    .populate("allowedCategories", "name")
    .sort({ createdAt: -1 });

  return items;
};

export const deleteItem = async (itemId: string, actorUserId: string): Promise<{ deleted: true }> => {
  ensureValidObjectId(itemId, "item ID");

  const item = await CompetitionItem.findById(itemId);

  if (!item) {
    const error: any = new Error("Competition item not found");
    error.statusCode = 404;
    throw error;
  }

  const eventId =
    typeof item.event === "string"
      ? item.event
      : (item.event as mongoose.Types.ObjectId).toString();

  await ensureEventCreator(eventId, actorUserId);

  await item.deleteOne();

  return { deleted: true };
};

export const updateItem = async (
  itemId: string,
  data: UpdateCompetitionItemInput,
  actorUserId: string
): Promise<ICompetitionItem> => {
  ensureValidObjectId(itemId, "item ID");

  const item = await CompetitionItem.findById(itemId);

  if (!item) {
    const error: any = new Error("Competition item not found");
    error.statusCode = 404;
    throw error;
  }

  const itemEventId =
    typeof item.event === "string"
      ? item.event
      : item.event instanceof mongoose.Types.ObjectId
      ? item.event.toString()
      : item.event?._id?.toString();

  if (!itemEventId) {
    const error: any = new Error("Item event context not found");
    error.statusCode = 400;
    throw error;
  }

  await ensureEventCreator(itemEventId, actorUserId);

  if (data.name !== undefined) {
    if (!data.name.trim()) {
      const error: any = new Error("Item name is required");
      error.statusCode = 400;
      throw error;
    }
    item.name = data.name.trim();
  }

  if (data.type !== undefined) {
    if (!Object.values(ItemType).includes(data.type)) {
      const error: any = new Error("Valid item type is required");
      error.statusCode = 400;
      throw error;
    }
    item.type = data.type;
  }

  if (data.allowedCategories !== undefined) {
    item.allowedCategories = await resolveAllowedCategories(itemEventId, data.allowedCategories);
  }

  if (data.minParticipantsPerTeam !== undefined) {
    item.minParticipantsPerTeam = data.minParticipantsPerTeam;
  }

  if (data.maxParticipantsPerTeam !== undefined) {
    item.maxParticipantsPerTeam = data.maxParticipantsPerTeam;
  }

  if (data.maxTotalParticipants !== undefined) {
    item.maxTotalParticipants = data.maxTotalParticipants;
  }

  if (data.placePoints !== undefined) {
    item.placePoints = {
      ...item.placePoints,
      ...data.placePoints
    };
  }

  if (data.gradeRanges !== undefined) {
    item.gradeRanges = normalizeGradeRanges(data.gradeRanges);
  }

  if (data.countsTowardOverallTotal !== undefined) {
    item.countsTowardOverallTotal = data.countsTowardOverallTotal;
  }

  if (item.type === ItemType.INDIVIDUAL) {
    item.maxParticipantsPerTeam = 1;
  }

  await item.save();
  return item;
};

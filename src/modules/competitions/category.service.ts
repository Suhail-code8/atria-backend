import mongoose from "mongoose";
import { Event } from "../events/event.model";
import { Category, ICategory } from "./category.model";

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

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
    const error: any = new Error("Forbidden: Only event creator can manage categories");
    error.statusCode = 403;
    throw error;
  }
};

export const createCategory = async (
  eventId: string,
  data: CreateCategoryInput,
  actorUserId: string
): Promise<ICategory> => {
  ensureValidObjectId(eventId, "event ID");

  if (!data.name?.trim()) {
    const error: any = new Error("Category name is required");
    error.statusCode = 400;
    throw error;
  }

  await ensureEventCreator(eventId, actorUserId);

  const category = await Category.create({
    event: new mongoose.Types.ObjectId(eventId),
    name: data.name.trim(),
    description: data.description?.trim() || undefined
  });

  return category;
};

export const getEventCategories = async (eventId: string): Promise<ICategory[]> => {
  ensureValidObjectId(eventId, "event ID");

  const categories = await Category.find({
    event: new mongoose.Types.ObjectId(eventId)
  }).sort({ createdAt: -1 });

  return categories;
};

export const deleteCategory = async (
  categoryId: string,
  actorUserId: string
): Promise<{ deleted: true }> => {
  ensureValidObjectId(categoryId, "category ID");

  const category = await Category.findById(categoryId);

  if (!category) {
    const error: any = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }

  const eventId =
    typeof category.event === "string"
      ? category.event
      : (category.event as mongoose.Types.ObjectId).toString();

  await ensureEventCreator(eventId, actorUserId);

  await category.deleteOne();

  return { deleted: true };
};

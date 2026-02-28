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

export const createCategory = async (
  eventId: string,
  data: CreateCategoryInput
): Promise<ICategory> => {
  ensureValidObjectId(eventId, "event ID");

  if (!data.name?.trim()) {
    const error: any = new Error("Category name is required");
    error.statusCode = 400;
    throw error;
  }

  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

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
  categoryId: string
): Promise<{ deleted: true }> => {
  ensureValidObjectId(categoryId, "category ID");

  const category = await Category.findById(categoryId);

  if (!category) {
    const error: any = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }

  await category.deleteOne();

  return { deleted: true };
};

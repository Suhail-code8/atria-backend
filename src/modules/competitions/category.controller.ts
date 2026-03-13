import { NextFunction, Request, Response } from "express";
import * as categoryService from "./category.service";

const getEventIdFromRequest = (req: Request): string => {
  const eventId = (req.params.eventId as string | undefined) || (req.body?.eventId as string | undefined);

  if (!eventId) {
    const error: any = new Error("eventId is required");
    error.statusCode = 400;
    throw error;
  }

  return eventId;
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = getEventIdFromRequest(req);
    const actorUserId = req.user?.userId as string;

    const category = await categoryService.createCategory(eventId, req.body, actorUserId);

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

export const getEventCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = getEventIdFromRequest(req);

    const categories = await categoryService.getEventCategories(eventId);

    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.id as string;
    const actorUserId = req.user?.userId as string;

    const result = await categoryService.deleteCategory(categoryId, actorUserId);

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

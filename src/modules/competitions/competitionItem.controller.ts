import { NextFunction, Request, Response } from "express";
import * as competitionItemService from "./competitionItem.service";

const getEventIdFromRequest = (req: Request): string => {
  const eventId = (req.params.eventId as string | undefined) || (req.body?.eventId as string | undefined);

  if (!eventId) {
    const error: any = new Error("eventId is required");
    error.statusCode = 400;
    throw error;
  }

  return eventId;
};

export const createItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = getEventIdFromRequest(req);
    const actorUserId = req.user?.userId as string;

    const {
      name,
      type,
      allowedCategories,
      minParticipantsPerTeam,
      maxParticipantsPerTeam,
      maxTotalParticipants,
      placePoints,
      gradePoints
    } = req.body;

    const item = await competitionItemService.createItem(eventId, {
      name,
      type,
      allowedCategories,
      minParticipantsPerTeam,
      maxParticipantsPerTeam,
      maxTotalParticipants,
      placePoints,
      gradePoints
    }, actorUserId);

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

export const updateItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const itemId = req.params.id as string;
    const actorUserId = req.user?.userId as string;

    const {
      name,
      type,
      allowedCategories,
      minParticipantsPerTeam,
      maxParticipantsPerTeam,
      maxTotalParticipants,
      placePoints,
      gradePoints
    } = req.body;

    const item = await competitionItemService.updateItem(itemId, {
      name,
      type,
      allowedCategories,
      minParticipantsPerTeam,
      maxParticipantsPerTeam,
      maxTotalParticipants,
      placePoints,
      gradePoints
    }, actorUserId);

    res.status(200).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

export const getEventItems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = getEventIdFromRequest(req);

    const items = await competitionItemService.getEventItems(eventId);

    res.status(200).json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
};

export const deleteItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const itemId = req.params.id as string;
    const actorUserId = req.user?.userId as string;

    const result = await competitionItemService.deleteItem(itemId, actorUserId);

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

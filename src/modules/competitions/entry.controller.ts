import { NextFunction, Request, Response } from "express";
import * as entryService from "./entry.service";

export const createEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const entry = await entryService.createEntry(req.body);

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

export const syncEntries = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const entry = await entryService.syncTeamEntries(req.body);

    res.status(200).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

export const getEntries = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const itemId = req.query.item as string | undefined;
    const eventId = req.query.event as string | undefined;

    if (itemId) {
      const entries = await entryService.getEntriesByItem(itemId);
      res.status(200).json({ success: true, data: entries });
      return;
    }

    if (eventId) {
      const entries = await entryService.getEntriesByEvent(eventId);
      res.status(200).json({ success: true, data: entries });
      return;
    }

    const error: any = new Error("Query parameter 'item' or 'event' is required");
    error.statusCode = 400;
    throw error;
  } catch (err) {
    next(err);
  }
};

export const getEntriesByItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const itemId = req.params.itemId as string;

    const entries = await entryService.getEntriesByItem(itemId);

    res.status(200).json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};

export const getEntriesByEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;

    const entries = await entryService.getEntriesByEvent(eventId);

    res.status(200).json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};

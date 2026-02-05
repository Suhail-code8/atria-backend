import { Request, Response, NextFunction } from "express";
import * as eventService from "./event.service";

export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    const event = await eventService.createEvent(req.body, userId);
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    const eventId = req.params.eventId as string;
    const event = await eventService.updateEvent(eventId, req.body, userId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    const eventId = req.params.eventId as string;
    const event = await eventService.deleteEvent(eventId, userId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

export const getEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId as string;
    const requesterUserId = req.user?.userId as string | undefined;
    const event = await eventService.getEventById(eventId, requesterUserId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

export const listEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requester = req.user ? { userId: req.user.userId, role: req.user.role } : null;
    const events = await eventService.listEvents(requester);
    res.status(200).json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
};

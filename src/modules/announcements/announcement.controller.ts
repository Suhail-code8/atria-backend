import { Request, Response, NextFunction } from "express";
import * as announcementService from "./announcement.service";

const getOrganizerId = (req: Request): string => {
  const organizerId = req.user?.userId || (req.user as any)?.id;

  if (!organizerId) {
    const error: any = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  return organizerId;
};

export const createAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const organizerId = getOrganizerId(req);

    const announcement = await announcementService.createAnnouncement(
      eventId,
      organizerId,
      req.body
    );

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
};

export const getEventAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;

    const announcements = await announcementService.getEventAnnouncements(eventId);

    res.status(200).json({ success: true, data: announcements });
  } catch (err) {
    next(err);
  }
};

export const updateAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const announcementId = req.params.id as string;
    const organizerId = getOrganizerId(req);

    const announcement = await announcementService.updateAnnouncement(
      announcementId,
      organizerId,
      req.body
    );

    res.status(200).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
};

export const deleteAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const announcementId = req.params.id as string;
    const organizerId = getOrganizerId(req);

    const result = await announcementService.deleteAnnouncement(
      announcementId,
      organizerId
    );

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

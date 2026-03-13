import { NextFunction, Request, Response } from "express";
import * as resultService from "./result.service";

export const addResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorUserId = req.user?.userId as string;
    const {
      eventId,
      itemId,
      teamId,
      entryId,
      participantId,
      place,
      grade
    } = req.body as {
      eventId?: string;
      itemId?: string;
      teamId?: string;
      entryId?: string;
      participantId?: string | null;
      place?: number;
      grade?: string;
    };

    if (!eventId || !itemId || (!teamId && !entryId)) {
      const error: any = new Error("eventId, itemId and either teamId or entryId are required");
      error.statusCode = 400;
      throw error;
    }

    const result = await resultService.addResult({
      eventId,
      actorUserId,
      itemId,
      teamId,
      entryId,
      participantId,
      place,
      grade
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getTeamLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const leaderboard = await resultService.getTeamLeaderboard(eventId);

    res.status(200).json({ success: true, data: leaderboard });
  } catch (err) {
    next(err);
  }
};

export const getIndividualLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.params.eventId as string;
    const leaderboard = await resultService.getIndividualLeaderboard(eventId);

    res.status(200).json({ success: true, data: leaderboard });
  } catch (err) {
    next(err);
  }
};

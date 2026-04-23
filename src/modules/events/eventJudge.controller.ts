import { Request, Response, NextFunction } from "express";
import * as judgeService from "./eventJudge.service";

export const assignJudge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorUserId = req.user!.userId;
    const { eventId, email, assignedItems = [] } = req.body as {
      eventId?: string;
      email?: string;
      assignedItems?: string[];
    };

    if (!eventId || !email) {
      const error: any = new Error("eventId and email are required");
      error.statusCode = 400;
      throw error;
    }

    const judge = await judgeService.assignJudge(eventId, email, assignedItems, actorUserId);
    res.status(201).json({ success: true, data: judge });
  } catch (err) {
    next(err);
  }
};

export const getEventJudges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId as string;
    const judges = await judgeService.getEventJudges(eventId);
    res.status(200).json({ success: true, data: judges });
  } catch (err) {
    next(err);
  }
};

export const getMyAllAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const assignments = await judgeService.getMyAllAssignments(userId);
    res.status(200).json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

export const getMyJudgeAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const eventId = req.params.eventId as string;
    const assignment = await judgeService.getJudgeAssignedItems(eventId, userId);
    res.status(200).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

export const updateJudgeItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorUserId = req.user!.userId;
    const id = req.params.id as string;
    const { assignedItems = [] } = req.body as { assignedItems?: string[] };
    const judge = await judgeService.updateJudgeItems(id, assignedItems, actorUserId);
    res.status(200).json({ success: true, data: judge });
  } catch (err) {
    next(err);
  }
};

export const removeJudge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorUserId = req.user?.userId as string;
    const id = req.params.id as string;
    const result = await judgeService.removeJudge(id, actorUserId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

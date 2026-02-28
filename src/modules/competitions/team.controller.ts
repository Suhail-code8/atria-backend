import { NextFunction, Request, Response } from "express";
import { TeamRole } from "./team.model";
import * as teamService from "./team.service";

const getManagerUserId = (req: Request): string => {
  const managerUserId = req.user?.userId || (req.user as any)?.id;

  if (!managerUserId) {
    const error: any = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  return managerUserId;
};

const getEventIdFromRequest = (req: Request): string => {
  const eventId = (req.params.eventId as string | undefined) || (req.body?.eventId as string | undefined);

  if (!eventId) {
    const error: any = new Error("eventId is required");
    error.statusCode = 400;
    throw error;
  }

  return eventId;
};

export const createTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = getEventIdFromRequest(req);
    const { name, managerEmail } = req.body as { name?: string; managerEmail?: string };

    if (!managerEmail) {
      const error: any = new Error("managerEmail is required");
      error.statusCode = 400;
      throw error;
    }

    const team = await teamService.createTeam(eventId, name || "", managerEmail);

    res.status(201).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

export const addTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.params.id as string;
    const managerUserId = getManagerUserId(req);
    const {
      email,
      role,
      categoryId
    } = req.body as {
      email?: string;
      role?: TeamRole;
      categoryId?: string;
    };

    if (!email || !role) {
      const error: any = new Error("email and role are required");
      error.statusCode = 400;
      throw error;
    }

    const team = await teamService.addTeamMember(
      teamId,
      managerUserId,
      email,
      role,
      categoryId
    );

    res.status(200).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

export const getEventTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = getEventIdFromRequest(req);
    const teams = await teamService.getEventTeams(eventId);

    res.status(200).json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
};

export const getTeamById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.params.id as string;
    const team = await teamService.getTeamById(teamId);

    res.status(200).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

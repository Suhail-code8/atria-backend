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
    const actorUserId = req.user?.userId as string;
    const { name, managerEmail } = req.body as { name?: string; managerEmail?: string };

    if (!managerEmail) {
      const error: any = new Error("managerEmail is required");
      error.statusCode = 400;
      throw error;
    }

    const team = await teamService.createTeam(eventId, name || "", managerEmail, actorUserId);

    res.status(201).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

export const createParticipantTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = getEventIdFromRequest(req);
    const actorUserId = req.user?.userId as string;
    const { name } = req.body as { name?: string };

    const team = await teamService.createParticipantTeam(eventId, name || "", actorUserId);

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

export const joinTeamViaCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorUserId = req.user?.userId as string;
    const { inviteCode } = req.body as { inviteCode?: string };

    if (!inviteCode) {
      const error: any = new Error("inviteCode is required");
      error.statusCode = 400;
      throw error;
    }

    const team = await teamService.joinTeamViaCode(inviteCode, actorUserId);

    res.status(200).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

export const joinTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorUserId = req.user?.userId as string;
    const teamId = req.params.id as string;

    const team = await teamService.joinTeam(teamId, actorUserId);

    res.status(200).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

export const setTeamLeader = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.params.id as string;
    const actorUserId = req.user?.userId as string;
    const { leaderId } = req.body as { leaderId?: string };

    if (!leaderId) {
      const error: any = new Error("leaderId is required");
      error.statusCode = 400;
      throw error;
    }

    const team = await teamService.setTeamLeader(teamId, leaderId, actorUserId);
    res.status(200).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

export const addTeamMemberByOrganizer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.params.id as string;
    const actorUserId = req.user?.userId as string;
    const { email, eventId } = req.body as { email?: string; eventId?: string };

    if (!email || !eventId) {
      const error: any = new Error("email and eventId are required");
      error.statusCode = 400;
      throw error;
    }

    const team = await teamService.addTeamMemberByOrganizer(
      eventId,
      teamId,
      email,
      actorUserId
    );
    res.status(200).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
};

export const enrollInCompetitionItems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorUserId = req.user?.userId as string;
    const teamId = req.params.id as string;
    const { enrollments = [] } = req.body as { enrollments?: { itemId: string, participantIds: string[] }[] };

    const entries = await teamService.enrollInCompetitionItems(teamId, enrollments, actorUserId);
    res.status(200).json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};

export const updateItemMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorUserId = req.user?.userId as string;
    const teamId = req.params.id as string;
    const itemId = req.params.itemId as string;
    const { participantIds = [] } = req.body as { participantIds?: string[] };

    const result = await teamService.updateItemMembers(teamId, itemId, participantIds, actorUserId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getTeamEnrollments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.params.id as string;
    const enrollments = await teamService.getTeamEnrollments(teamId);
    res.status(200).json({ success: true, data: enrollments });
  } catch (err) {
    next(err);
  }
};

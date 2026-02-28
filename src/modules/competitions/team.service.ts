import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Event } from "../events/event.model";
import { Category } from "./category.model";
import { ITeam, Team, TeamRole } from "./team.model";
import {
  Participation,
  ParticipationRole,
  ParticipationStatus
} from "../participation/participation.model";
import { User } from "../users/user.model";

const ensureValidObjectId = (id: string, label: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error: any = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

const ensureManagerPrivileges = (team: ITeam, managerUserId: string): void => {
  const managerMember = team.members.find((member) => {
    const memberUserId =
      typeof member.user === "string"
        ? member.user
        : (member.user as mongoose.Types.ObjectId).toString();

    return (
      memberUserId === managerUserId &&
      (member.role === TeamRole.MANAGER || member.role === TeamRole.ASST_MANAGER)
    );
  });

  if (!managerMember) {
    const error: any = new Error("Forbidden: Only managers can add members");
    error.statusCode = 403;
    throw error;
  }
};

const ensureValidEmail = (email: string): string => {
  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    const error: any = new Error("Invalid email format");
    error.statusCode = 400;
    throw error;
  }

  return normalizedEmail;
};

const getNameFromEmail = (email: string): string => {
  const prefix = email.split("@")[0] || "Pending Member";
  const cleaned = prefix
    .replace(/[._-]+/g, " ")
    .trim();

  return cleaned
    ? cleaned
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Pending Member";
};

export const createTeam = async (
  eventId: string,
  name: string,
  managerEmail: string
): Promise<ITeam> => {
  ensureValidObjectId(eventId, "event ID");

  if (!name?.trim()) {
    const error: any = new Error("Team name is required");
    error.statusCode = 400;
    throw error;
  }

  if (!managerEmail?.trim()) {
    const error: any = new Error("managerEmail is required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = ensureValidEmail(managerEmail);

  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const placeholderPasswordRaw = randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(placeholderPasswordRaw, 10);

    user = await User.create({
      name: getNameFromEmail(normalizedEmail),
      email: normalizedEmail,
      password: hashedPassword,
      role: "PARTICIPANT",
      refreshToken: null,
      isPlaceholder: true
    });
  }

  let participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: user._id
  });

  if (!participation) {
    participation = await Participation.create({
      event: new mongoose.Types.ObjectId(eventId),
      user: user._id,
      role: ParticipationRole.PARTICIPANT,
      status: ParticipationStatus.REGISTERED
    });
  }

  const team = await Team.create({
    event: new mongoose.Types.ObjectId(eventId),
    name: name.trim(),
    members: [
      {
        user: new mongoose.Types.ObjectId(user._id.toString()),
        role: TeamRole.MANAGER
      }
    ]
  });

  return team;
};

export const addTeamMember = async (
  teamId: string,
  managerUserId: string,
  email: string,
  role: TeamRole,
  categoryId?: string
): Promise<ITeam> => {
  ensureValidObjectId(teamId, "team ID");
  ensureValidObjectId(managerUserId, "manager user ID");

  if (!email?.trim()) {
    const error: any = new Error("Email is required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = ensureValidEmail(email);

  if (!Object.values(TeamRole).includes(role)) {
    const error: any = new Error("Invalid team role");
    error.statusCode = 400;
    throw error;
  }

  const team = await Team.findById(teamId);

  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  ensureManagerPrivileges(team, managerUserId);

  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const placeholderPasswordRaw = randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(placeholderPasswordRaw, 10);

    user = await User.create({
      name: getNameFromEmail(normalizedEmail),
      email: normalizedEmail,
      password: hashedPassword,
      role: "PARTICIPANT",
      refreshToken: null,
      isPlaceholder: true
    });
  }

  if (categoryId) {
    ensureValidObjectId(categoryId, "category ID");

    const category = await Category.findById(categoryId);
    if (!category || category.event.toString() !== team.event.toString()) {
      const error: any = new Error("Invalid category for this team event");
      error.statusCode = 400;
      throw error;
    }
  }

  let participation = await Participation.findOne({
    event: team.event,
    user: user._id
  });

  if (!participation) {
    participation = await Participation.create({
      event: team.event,
      user: user._id,
      role: ParticipationRole.PARTICIPANT,
      status: ParticipationStatus.REGISTERED
    });
  }

  const existingMember = team.members.find((member) => {
    const existingMemberId =
      typeof member.user === "string"
        ? member.user
        : (member.user as mongoose.Types.ObjectId).toString();
    return existingMemberId === user._id.toString();
  });

  if (existingMember) {
    const error: any = new Error("User is already a member of this team");
    error.statusCode = 409;
    throw error;
  }

  team.members.push({
    user: new mongoose.Types.ObjectId(user._id.toString()),
    role,
    category: categoryId ? new mongoose.Types.ObjectId(categoryId) : undefined
  });

  await team.save();

  const updatedTeam = await Team.findById(teamId)
    .populate("members.user", "name email")
    .populate("members.category", "name");

  if (!updatedTeam) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  return updatedTeam;
};

export const getEventTeams = async (eventId: string): Promise<ITeam[]> => {
  ensureValidObjectId(eventId, "event ID");

  const teams = await Team.find({ event: new mongoose.Types.ObjectId(eventId) })
    .populate("members.user", "name email")
    .populate("members.category", "name")
    .sort({ createdAt: -1 });

  return teams;
};

export const getTeamById = async (teamId: string): Promise<ITeam> => {
  ensureValidObjectId(teamId, "team ID");

  const team = await Team.findById(teamId)
    .populate("members.user", "name email")
    .populate("members.category", "name");

  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  return team;
};

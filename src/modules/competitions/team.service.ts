import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Event } from "../events/event.model";
import { Category } from "./category.model";
import { ITeam, Team, TeamRole } from "./team.model";
import { CompetitionItem, ItemType } from "./competitionItem.model";
import { CompetitionEntry, CompetitionEntryStatus } from "./competitionEntry.model";
import {
  Participation,
  ParticipationRole,
  ParticipationStatus
} from "../participation/participation.model";
import { User, UserRole } from "../users/user.model";
import { advanceWorkflowNodeAsSystem } from "../participation/participation.service";
import { syncTeamEntries } from "./entry.service";

const ensureValidObjectId = (id: string, label: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error: any = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

const ensureManagerPrivileges = (team: ITeam, managerUserId: string): void => {
  // 1. Check if user has explicit Manager/Asst Manager role
  const hasManagerRole = team.members.some((member) => {
    const memberUserId =
      typeof member.user === "string"
        ? member.user
        : (member.user as mongoose.Types.ObjectId).toString();

    return (
      memberUserId === managerUserId &&
      (member.role === TeamRole.MANAGER || member.role === TeamRole.ASST_MANAGER)
    );
  });

  // 2. Check if user is the assigned Team Leader
  const isTeamLeader = team.leaderId && (
    typeof team.leaderId === "string" 
      ? team.leaderId === managerUserId 
      : (team.leaderId as mongoose.Types.ObjectId).toString() === managerUserId
  );

  if (!hasManagerRole && !isTeamLeader) {
    const error: any = new Error("Forbidden: Only team managers or the team leader can manage enrollment");
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
  managerEmail: string,
  actorUserId: string
): Promise<ITeam> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(actorUserId, "user ID");

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

  if (event.createdBy.toString() !== actorUserId) {
    const error: any = new Error("Forbidden: Only event creator can create teams");
    error.statusCode = 403;
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
      role: UserRole.PARTICIPANT,
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

export const createParticipantTeam = async (
  eventId: string,
  name: string,
  actorUserId: string
): Promise<ITeam> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(actorUserId, "user ID");

  if (!name?.trim()) {
    const error: any = new Error("Team name is required");
    error.statusCode = 400;
    throw error;
  }

  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  let participation = await Participation.findOne({
    event: new mongoose.Types.ObjectId(eventId),
    user: new mongoose.Types.ObjectId(actorUserId)
  });

  if (!participation) {
    participation = await Participation.create({
      event: new mongoose.Types.ObjectId(eventId),
      user: new mongoose.Types.ObjectId(actorUserId),
      role: ParticipationRole.PARTICIPANT,
      status: ParticipationStatus.REGISTERED
    });
  }

  const inviteCode = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();

  const team = await Team.create({
    event: new mongoose.Types.ObjectId(eventId),
    name: name.trim(),
    inviteCode,
    members: [
      {
        user: new mongoose.Types.ObjectId(actorUserId),
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
      role: UserRole.PARTICIPANT,
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

export const joinTeamViaCode = async (
  inviteCode: string,
  actorUserId: string
): Promise<ITeam> => {
  ensureValidObjectId(actorUserId, "user ID");

  if (!inviteCode?.trim()) {
    const error: any = new Error("Invite code is required");
    error.statusCode = 400;
    throw error;
  }

  const team = await Team.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
  
  if (!team) {
    const error: any = new Error("Invalid or expired invite code");
    error.statusCode = 404;
    throw error;
  }

  const existingMember = team.members.find((member) => {
    const existingMemberId =
      typeof member.user === "string"
        ? member.user
        : (member.user as mongoose.Types.ObjectId).toString();
    return existingMemberId === actorUserId;
  });

  if (existingMember) {
    const error: any = new Error("You are already a member of this team");
    error.statusCode = 409;
    throw error;
  }

  let participation = await Participation.findOne({
    event: team.event,
    user: new mongoose.Types.ObjectId(actorUserId)
  });

  if (!participation) {
    participation = await Participation.create({
      event: team.event,
      user: new mongoose.Types.ObjectId(actorUserId),
      role: ParticipationRole.PARTICIPANT,
      status: ParticipationStatus.REGISTERED
    });
  }

  team.members.push({
    user: new mongoose.Types.ObjectId(actorUserId),
    role: TeamRole.MEMBER
  });

  await team.save();

  const updatedTeam = await Team.findById(team._id)
    .populate("members.user", "name email")
    .populate("members.category", "name");

  if (!updatedTeam) {
    const error: any = new Error("Failed to retrieve updated team");
    error.statusCode = 500;
    throw error;
  }

  return updatedTeam;
};

export const joinTeam = async (
  teamId: string,
  actorUserId: string
): Promise<ITeam> => {
  ensureValidObjectId(teamId, "team ID");
  ensureValidObjectId(actorUserId, "user ID");

  const team = await Team.findById(teamId);
  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  const event = await Event.findById(team.event);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const teamFormationNode = event.workflow?.nodes.find(n => n.type === 'TEAM_FORMATION');
  const config = teamFormationNode?.config || {};

  if (config.teamCreationMode !== 'organizer_creates' || !config.allowSelfEnrollment) {
    const error: any = new Error("Self-enrollment is not allowed for this event's team formation");
    error.statusCode = 403;
    throw error;
  }

  // Check team size
  const maxTeamSize = config.teamSize || 1;
  if (team.members.length >= maxTeamSize) {
    const error: any = new Error(`Team is full (max ${maxTeamSize} members)`);
    error.statusCode = 400;
    throw error;
  }

  const existingMember = team.members.find((member) => {
    const existingMemberId =
      typeof member.user === "string"
        ? member.user
        : (member.user as mongoose.Types.ObjectId).toString();
    return existingMemberId === actorUserId;
  });

  if (existingMember) {
    const error: any = new Error("You are already a member of this team");
    error.statusCode = 409;
    throw error;
  }

  // Check if user is already in another team for this event
  const otherTeam = await Team.findOne({
    event: team.event,
    "members.user": new mongoose.Types.ObjectId(actorUserId)
  });
  if (otherTeam) {
    const error: any = new Error("You are already a member of another team for this event");
    error.statusCode = 409;
    throw error;
  }

  let participation = await Participation.findOne({
    event: team.event,
    user: new mongoose.Types.ObjectId(actorUserId)
  });

  if (!participation) {
    participation = await Participation.create({
      event: team.event,
      user: new mongoose.Types.ObjectId(actorUserId),
      role: ParticipationRole.PARTICIPANT,
      status: ParticipationStatus.REGISTERED
    });
  }

  team.members.push({
    user: new mongoose.Types.ObjectId(actorUserId),
    role: TeamRole.MEMBER
  });

  await team.save();

  // Auto-advance if participant is stuck at TEAM_FORMATION
  try {
    if (
      participation.workflowState === "TEAM_FORMATION" &&
      participation.status === ParticipationStatus.REGISTERED
    ) {
      await advanceWorkflowNodeAsSystem(
        participation._id.toString(),
        actorUserId
      );
    }
  } catch (err) {
    console.warn("Auto-advance after self-enrollment join failed:", err);
  }

  const updatedTeam = await Team.findById(team._id)
    .populate("members.user", "name email")
    .populate("members.category", "name");

  if (!updatedTeam) {
    const error: any = new Error("Failed to retrieve updated team");
    error.statusCode = 500;
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
    .populate("members.category", "name")
    .populate("leaderId", "name email");

  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  return team;
};

/**
 * Set or update the leader of a team (organizer action)
 */
export const setTeamLeader = async (
  teamId: string,
  leaderId: string,
  actorUserId: string
): Promise<ITeam> => {
  ensureValidObjectId(teamId, "team ID");
  ensureValidObjectId(leaderId, "leader user ID");
  ensureValidObjectId(actorUserId, "actor user ID");

  const team = await Team.findById(teamId);
  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  // Verify actorUserId is the event creator
  const event = await Event.findById(team.event);
  if (!event || event.createdBy.toString() !== actorUserId) {
    const error: any = new Error("Forbidden: Only event creator can set team leader");
    error.statusCode = 403;
    throw error;
  }

  // Verify the chosen leader is a team member
  const isMember = team.members.some((m) => {
    const memberId = typeof m.user === "string" ? m.user : (m.user as mongoose.Types.ObjectId).toString();
    return memberId === leaderId;
  });

  if (!isMember) {
    const error: any = new Error("The selected user is not a member of this team");
    error.statusCode = 400;
    throw error;
  }

  team.leaderId = new mongoose.Types.ObjectId(leaderId);
  await team.save();

  const updated = await Team.findById(teamId)
    .populate("members.user", "name email")
    .populate("members.category", "name")
    .populate("leaderId", "name email");

  return updated!;
};

/**
 * Organizer adds a participant to a team by email.
 * After adding, if the participant is currently at a TEAM_FORMATION workflow node,
 * they are automatically advanced to the next node.
 */
export const addTeamMemberByOrganizer = async (
  eventId: string,
  teamId: string,
  email: string,
  actorUserId: string
): Promise<ITeam> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(teamId, "team ID");
  ensureValidObjectId(actorUserId, "actor user ID");

  const normalizedEmail = ensureValidEmail(email);

  // Verify actor is event creator
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }
  if (event.createdBy.toString() !== actorUserId) {
    const error: any = new Error("Forbidden: Only event creator can assign participants to teams");
    error.statusCode = 403;
    throw error;
  }

  const team = await Team.findById(teamId);
  if (!team || team.event.toString() !== eventId) {
    const error: any = new Error("Team not found for this event");
    error.statusCode = 404;
    throw error;
  }

  // Find or create the user
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const placeholderPasswordRaw = randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(placeholderPasswordRaw, 10);
    user = await User.create({
      name: getNameFromEmail(normalizedEmail),
      email: normalizedEmail,
      password: hashedPassword,
      role: UserRole.PARTICIPANT,
      refreshToken: null,
      isPlaceholder: true
    });
  }

  // Ensure participation record exists
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

  // Check for duplicate
  const existingMember = team.members.find((m) => {
    const memberId = typeof m.user === "string" ? m.user : (m.user as mongoose.Types.ObjectId).toString();
    return memberId === user._id.toString();
  });
  if (existingMember) {
    const error: any = new Error("User is already a member of this team");
    error.statusCode = 409;
    throw error;
  }

  team.members.push({
    user: new mongoose.Types.ObjectId(user._id.toString()),
    role: TeamRole.MEMBER
  });
  await team.save();

  // ── Auto-advance if participant is stuck at TEAM_FORMATION ──────────────
  try {
    if (
      participation.workflowState === "TEAM_FORMATION" &&
      participation.status === ParticipationStatus.REGISTERED
    ) {
      await advanceWorkflowNodeAsSystem(
        participation._id.toString(),
        user._id.toString()
      );
    }
  } catch (err) {
    // Non-blocking — log but don't fail the member assignment
    console.warn("Auto-advance after organizer team assignment failed:", err);
  }
  // ────────────────────────────────────────────────────────────────────────

  const updatedTeam = await Team.findById(teamId)
    .populate("members.user", "name email")
    .populate("members.category", "name")
    .populate("leaderId", "name email");

  return updatedTeam!;
};

export const enrollInCompetitionItems = async (
  teamId: string,
  enrollments: { itemId: string; participantIds: string[] }[],
  actorUserId: string
): Promise<any[]> => {
  ensureValidObjectId(teamId, "team ID");
  const normalizedTeamId = new mongoose.Types.ObjectId(teamId);

  const team = await Team.findById(normalizedTeamId).populate("members.category");
  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  ensureManagerPrivileges(team, actorUserId);

  const itemIds = enrollments.map((e) => e.itemId);
  const items = await CompetitionItem.find({ _id: { $in: itemIds }, event: team.event });
  if (items.length !== itemIds.length) {
    const error: any = new Error("One or more competition items are invalid or not part of this event");
    error.statusCode = 400;
    throw error;
  }

  const teamMemberUserIds = team.members.map((m) => m.user.toString());
  
  // Validation loop
  for (const enrollment of enrollments) {
    const item = items.find((i) => i._id.toString() === enrollment.itemId);
    if (!item) continue;

    // 1. Ensure all participantIds belong to the team
    const invalidParticipants = enrollment.participantIds.filter(pid => !teamMemberUserIds.includes(pid));
    if (invalidParticipants.length > 0) {
      const error: any = new Error(`One or more participants are not members of this team for item: ${item.name}`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate participant counts (use enrollment count, not team size)
    const pCount = enrollment.participantIds.length;
    if (item.maxParticipantsPerTeam && pCount > item.maxParticipantsPerTeam) {
      const error: any = new Error(`Item ${item.name} exceeds max participants (${item.maxParticipantsPerTeam}). Selected: ${pCount}`);
      error.statusCode = 400;
      throw error;
    }
    if (item.minParticipantsPerTeam && pCount < item.minParticipantsPerTeam) {
      const error: any = new Error(`Item ${item.name} lacks min participants (${item.minParticipantsPerTeam}). Selected: ${pCount}`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Validate categories for selected participants
    if (item.allowedCategories && item.allowedCategories.length > 0) {
      const allowedStrs = item.allowedCategories.map((c) => c.toString());
      const selectedMembers = team.members.filter(m => enrollment.participantIds.includes(m.user.toString()));
      
      for (const m of selectedMembers) {
        const catId = (m.category && typeof m.category === 'object' && '_id' in m.category) 
          ? m.category._id.toString() 
          : m.category?.toString();
          
        if (catId && !allowedStrs.includes(catId)) {
          const error: any = new Error(`Member ${m.user} is in a category not allowed for item: ${item.name}`);
          error.statusCode = 400;
          throw error;
        }
      }
    }
  }

  const existingEntries = await CompetitionEntry.find({ team: normalizedTeamId });
  const existingItemIds = existingEntries.map((e) => e.item.toString());

  const requestedItemIds = enrollments.map(e => e.itemId);
  const itemsToRemove = existingItemIds.filter((id) => !requestedItemIds.includes(id));

  // Handle Updates and Additions
  for (const enrollment of enrollments) {
    const existingEntry = existingEntries.find(e => e.item.toString() === enrollment.itemId);
    const participantObjectIds = enrollment.participantIds.map(id => new mongoose.Types.ObjectId(id));

    if (existingEntry) {
      // Update participants
      existingEntry.participants = participantObjectIds as any;
      await existingEntry.save();
    } else {
      // Create new
      await CompetitionEntry.create({
        event: team.event,
        item: new mongoose.Types.ObjectId(enrollment.itemId),
        team: normalizedTeamId,
        participants: participantObjectIds,
        status: CompetitionEntryStatus.REGISTERED
      });
    }
  }

  // Handle Removals
  if (itemsToRemove.length > 0) {
    await CompetitionEntry.deleteMany({
      team: normalizedTeamId,
      item: { $in: itemsToRemove.map((id) => new mongoose.Types.ObjectId(id)) }
    });
  }

  return await CompetitionEntry.find({ team: normalizedTeamId }).populate("item");
};

/**
 * Update members for a specific competition item for a team
 */
export const updateItemMembers = async (
  teamId: string,
  itemId: string,
  participantIds: string[],
  actorUserId: string
): Promise<any> => {
  ensureValidObjectId(teamId, "team ID");
  ensureValidObjectId(itemId, "item ID");
  ensureValidObjectId(actorUserId, "actor user ID");

  const team = await Team.findById(teamId);
  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  // Check privileges: team leader or event organizer
  const event = await Event.findById(team.event);
  const isOrganizer = event?.createdBy.toString() === actorUserId;
  const isLeader = team.leaderId?.toString() === actorUserId;

  if (!isOrganizer && !isLeader) {
    const error: any = new Error("Forbidden: Only team leader or organizer can manage item members");
    error.statusCode = 403;
    throw error;
  }

  // Sync entries for this specific item
  return await syncTeamEntries({
    event: team.event.toString(),
    team: teamId,
    item: itemId,
    participants: participantIds
  });
};

/**
 * Get all competition enrollments for a team
 */
export const getTeamEnrollments = async (teamId: string): Promise<any[]> => {
  ensureValidObjectId(teamId, "team ID");
  
  return await CompetitionEntry.find({ team: new mongoose.Types.ObjectId(teamId) })
    .populate("item")
    .populate("participants", "name email");
};


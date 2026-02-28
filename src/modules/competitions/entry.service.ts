import mongoose from "mongoose";
import {
  CompetitionEntry,
  CompetitionEntryStatus,
  ICompetitionEntry
} from "./competitionEntry.model";
import { Team } from "./team.model";
import { CompetitionItem, ItemType } from "./competitionItem.model";
import { Event } from "../events/event.model";

interface CreateEntryInput {
  event: string;
  item: string;
  team: string;
  participants: string[];
  status?: CompetitionEntryStatus;
}

interface SyncEntryInput {
  event: string;
  item: string;
  team: string;
  participants: string[];
}

const ensureValidObjectId = (id: string, label: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error: any = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

export const createEntry = async (
  payload: CreateEntryInput
): Promise<ICompetitionEntry | ICompetitionEntry[]> => {
  ensureValidObjectId(payload.event, "event ID");
  ensureValidObjectId(payload.item, "item ID");
  ensureValidObjectId(payload.team, "team ID");

  if (!Array.isArray(payload.participants) || payload.participants.length === 0) {
    const error: any = new Error("At least one participant is required");
    error.statusCode = 400;
    throw error;
  }

  payload.participants.forEach((participantId) =>
    ensureValidObjectId(participantId, "participant ID")
  );

  const [event, item, team] = await Promise.all([
    Event.findById(payload.event),
    CompetitionItem.findById(payload.item),
    Team.findById(payload.team)
  ]);

  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (!item) {
    const error: any = new Error("Competition item not found");
    error.statusCode = 404;
    throw error;
  }

  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  if (team.event.toString() !== payload.event) {
    const error: any = new Error("Team is not part of this event");
    error.statusCode = 400;
    throw error;
  }

  if (item.event.toString() !== payload.event) {
    const error: any = new Error("Item is not part of this event");
    error.statusCode = 400;
    throw error;
  }

  const teamMemberIds = new Set(
    team.members.map((member) =>
      typeof member.user === "string"
        ? member.user
        : (member.user as mongoose.Types.ObjectId).toString()
    )
  );

  const uniqueParticipantIds = Array.from(new Set(payload.participants.map((id) => id.toString())));

  const invalidParticipants = uniqueParticipantIds.filter(
    (participantId) => !teamMemberIds.has(participantId)
  );

  if (invalidParticipants.length > 0) {
    const error: any = new Error("All participants must be members of the selected team");
    error.statusCode = 400;
    throw error;
  }

  const existingEntriesForItem = await CompetitionEntry.find({
    item: new mongoose.Types.ObjectId(payload.item)
  }).select("participants team");

  if (item.type === ItemType.GROUP) {
    const groupAlreadyExists = existingEntriesForItem.some(
      (entry) => entry.team.toString() === payload.team
    );

    if (groupAlreadyExists) {
      const error: any = new Error("This team has already enrolled in this group item.");
      error.statusCode = 400;
      throw error;
    }
  }

  const alreadyEnrolledParticipantIds = new Set(
    existingEntriesForItem.flatMap((entry) =>
      entry.participants.map((participantId) => participantId.toString())
    )
  );

  const hasDuplicateParticipant = uniqueParticipantIds.some((participantId) =>
    alreadyEnrolledParticipantIds.has(participantId)
  );

  if (hasDuplicateParticipant) {
    const error: any = new Error(
      "One or more selected participants are already enrolled in this item."
    );
    error.statusCode = 400;
    throw error;
  }

  const baseEntry = {
    event: new mongoose.Types.ObjectId(payload.event),
    item: new mongoose.Types.ObjectId(payload.item),
    team: new mongoose.Types.ObjectId(payload.team),
    status: payload.status ?? CompetitionEntryStatus.REGISTERED
  };

  if (item.type === ItemType.INDIVIDUAL) {
    const individualEntries = await CompetitionEntry.insertMany(
      uniqueParticipantIds.map((participantId) => ({
        ...baseEntry,
        participants: [new mongoose.Types.ObjectId(participantId)]
      }))
    );

    return individualEntries;
  }

  const entry = await CompetitionEntry.create({
    ...baseEntry,
    participants: uniqueParticipantIds.map((id) => new mongoose.Types.ObjectId(id)),
  });

  return entry;
};

export const getEntriesByItem = async (
  itemId: string
): Promise<ICompetitionEntry[]> => {
  ensureValidObjectId(itemId, "item ID");

  const entries = await CompetitionEntry.find({
    item: new mongoose.Types.ObjectId(itemId)
  })
    .populate("team", "name totalPoints")
    .populate("participants", "name email")
    .sort({ createdAt: -1 });

  return entries;
};

export const getEntriesByEvent = async (
  eventId: string
): Promise<ICompetitionEntry[]> => {
  ensureValidObjectId(eventId, "event ID");

  const entries = await CompetitionEntry.find({
    event: new mongoose.Types.ObjectId(eventId)
  })
    .populate("item", "name type")
    .populate("team", "name totalPoints")
    .populate("participants", "name email")
    .sort({ createdAt: -1 });

  return entries;
};

export const syncTeamEntries = async (
  payload: SyncEntryInput
): Promise<ICompetitionEntry | ICompetitionEntry[]> => {
  ensureValidObjectId(payload.event, "event ID");
  ensureValidObjectId(payload.item, "item ID");
  ensureValidObjectId(payload.team, "team ID");

  if (!Array.isArray(payload.participants)) {
    const error: any = new Error("participants must be an array");
    error.statusCode = 400;
    throw error;
  }

  payload.participants.forEach((participantId) =>
    ensureValidObjectId(participantId, "participant ID")
  );

  const [event, item, team] = await Promise.all([
    Event.findById(payload.event),
    CompetitionItem.findById(payload.item),
    Team.findById(payload.team)
  ]);

  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (!item) {
    const error: any = new Error("Competition item not found");
    error.statusCode = 404;
    throw error;
  }

  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  if (team.event.toString() !== payload.event) {
    const error: any = new Error("Team is not part of this event");
    error.statusCode = 400;
    throw error;
  }

  if (item.event.toString() !== payload.event) {
    const error: any = new Error("Item is not part of this event");
    error.statusCode = 400;
    throw error;
  }

  const uniqueParticipantIds = Array.from(new Set(payload.participants.map((id) => id.toString())));

  if (uniqueParticipantIds.length > item.maxParticipantsPerTeam) {
    const error: any = new Error(
      `Maximum ${item.maxParticipantsPerTeam} participants allowed for this item`
    );
    error.statusCode = 400;
    throw error;
  }

  const teamMemberIds = new Set(
    team.members.map((member) =>
      typeof member.user === "string"
        ? member.user
        : (member.user as mongoose.Types.ObjectId).toString()
    )
  );

  const invalidParticipants = uniqueParticipantIds.filter(
    (participantId) => !teamMemberIds.has(participantId)
  );

  if (invalidParticipants.length > 0) {
    const error: any = new Error("All participants must be members of the selected team");
    error.statusCode = 400;
    throw error;
  }

  const existingEntriesForItem = await CompetitionEntry.find({
    item: new mongoose.Types.ObjectId(payload.item)
  }).select("participants team");

  const conflictingParticipantIds = new Set(
    existingEntriesForItem
      .filter((entry) => entry.team.toString() !== payload.team)
      .flatMap((entry) => entry.participants.map((participantId) => participantId.toString()))
  );

  if (uniqueParticipantIds.some((participantId) => conflictingParticipantIds.has(participantId))) {
    const error: any = new Error(
      "One or more selected participants are already enrolled in this item."
    );
    error.statusCode = 400;
    throw error;
  }

  if (item.type === ItemType.GROUP) {
    const existingGroupEntry = await CompetitionEntry.findOne({
      event: new mongoose.Types.ObjectId(payload.event),
      item: new mongoose.Types.ObjectId(payload.item),
      team: new mongoose.Types.ObjectId(payload.team)
    });

    if (existingGroupEntry) {
      existingGroupEntry.participants = uniqueParticipantIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      existingGroupEntry.status = CompetitionEntryStatus.REGISTERED;
      await existingGroupEntry.save();
      return existingGroupEntry;
    }

    return CompetitionEntry.create({
      event: new mongoose.Types.ObjectId(payload.event),
      item: new mongoose.Types.ObjectId(payload.item),
      team: new mongoose.Types.ObjectId(payload.team),
      participants: uniqueParticipantIds.map((id) => new mongoose.Types.ObjectId(id)),
      status: CompetitionEntryStatus.REGISTERED
    });
  }

  const existingIndividualEntries = await CompetitionEntry.find({
    event: new mongoose.Types.ObjectId(payload.event),
    item: new mongoose.Types.ObjectId(payload.item),
    team: new mongoose.Types.ObjectId(payload.team)
  }).select("participants");

  const existingParticipantToEntryId = new Map<string, mongoose.Types.ObjectId>();

  existingIndividualEntries.forEach((entry) => {
    const participantId = entry.participants[0]?.toString();
    if (participantId) {
      existingParticipantToEntryId.set(participantId, entry._id as mongoose.Types.ObjectId);
    }
  });

  const incomingParticipantSet = new Set(uniqueParticipantIds);

  const entryIdsToDelete = Array.from(existingParticipantToEntryId.entries())
    .filter(([participantId]) => !incomingParticipantSet.has(participantId))
    .map(([, entryId]) => entryId);

  if (entryIdsToDelete.length > 0) {
    await CompetitionEntry.deleteMany({ _id: { $in: entryIdsToDelete } });
  }

  const participantIdsToCreate = uniqueParticipantIds.filter(
    (participantId) => !existingParticipantToEntryId.has(participantId)
  );

  if (participantIdsToCreate.length > 0) {
    await CompetitionEntry.insertMany(
      participantIdsToCreate.map((participantId) => ({
        event: new mongoose.Types.ObjectId(payload.event),
        item: new mongoose.Types.ObjectId(payload.item),
        team: new mongoose.Types.ObjectId(payload.team),
        participants: [new mongoose.Types.ObjectId(participantId)],
        status: CompetitionEntryStatus.REGISTERED
      }))
    );
  }

  const syncedEntries = await CompetitionEntry.find({
    event: new mongoose.Types.ObjectId(payload.event),
    item: new mongoose.Types.ObjectId(payload.item),
    team: new mongoose.Types.ObjectId(payload.team)
  });

  return syncedEntries;
};

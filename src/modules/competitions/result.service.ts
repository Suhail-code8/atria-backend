import mongoose from "mongoose";
import { Event } from "../events/event.model";
import { CompetitionItem, ItemType } from "./competitionItem.model";
import { CompetitionEntry } from "./competitionEntry.model";
import { Result, IResult } from "./result.model";
import { Team, ITeam } from "./team.model";
import { User } from "../users/user.model";

interface AddResultInput {
  eventId: string;
  itemId: string;
  teamId?: string;
  entryId?: string;
  participantId?: string | null;
  place?: number;
  grade?: string;
}

interface IndividualLeaderboardEntry {
  participantId: string;
  name: string;
  totalPoints: number;
}

const ensureValidObjectId = (id: string, label: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error: any = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

const getPointsForPlace = (
  placePoints:
    | {
        first?: number;
        second?: number;
        third?: number;
      }
    | undefined,
  place?: number
): number => {
  if (!placePoints || place === undefined || place === null) {
    return 0;
  }

  if (place === 1) return Number(placePoints.first ?? 0);
  if (place === 2) return Number(placePoints.second ?? 0);
  if (place === 3) return Number(placePoints.third ?? 0);
  return 0;
};

const getPointsForGrade = (
  gradePoints:
    | {
        a?: number;
        b?: number;
        c?: number;
      }
    | undefined,
  grade?: string
): number => {
  if (!gradePoints || !grade?.trim()) {
    return 0;
  }

  const normalizedGrade = grade.trim().toUpperCase();
  if (normalizedGrade === "A") return Number(gradePoints.a ?? 0);
  if (normalizedGrade === "B") return Number(gradePoints.b ?? 0);
  if (normalizedGrade === "C") return Number(gradePoints.c ?? 0);
  return 0;
};

export const addResult = async ({
  eventId,
  itemId,
  teamId,
  entryId,
  participantId,
  place,
  grade
}: AddResultInput): Promise<IResult> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(itemId, "item ID");
  if (teamId) {
    ensureValidObjectId(teamId, "team ID");
  }
  if (entryId) {
    ensureValidObjectId(entryId, "entry ID");
  }

  if (!place && !grade) {
    const error: any = new Error(
      "You must provide either a place or a grade to submit a result."
    );
    error.statusCode = 400;
    throw error;
  }

  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const item = await CompetitionItem.findById(itemId);
  if (!item) {
    const error: any = new Error("Competition item not found");
    error.statusCode = 404;
    throw error;
  }

  let entry = null;

  if (entryId) {
    entry = await CompetitionEntry.findById(entryId);

    if (
      entry &&
      (entry.event.toString() !== eventId || entry.item.toString() !== itemId)
    ) {
      const error: any = new Error("Selected entry does not belong to this event item");
      error.statusCode = 400;
      throw error;
    }

    if (entry && teamId && entry.team.toString() !== teamId) {
      const error: any = new Error("Selected entry does not belong to the selected team");
      error.statusCode = 400;
      throw error;
    }
  }

  if (!entry && teamId) {
    entry = await CompetitionEntry.findOne({
      event: new mongoose.Types.ObjectId(eventId),
      item: new mongoose.Types.ObjectId(itemId),
      team: new mongoose.Types.ObjectId(teamId)
    });
  }

  if (!entry) {
    const error: any = new Error("This team is not enrolled in this item.");
    error.statusCode = 400;
    throw error;
  }

  const resolvedTeamId = entry.team.toString();

  const team = await Team.findById(resolvedTeamId);
  if (!team) {
    const error: any = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  if (item.event.toString() !== eventId || team.event.toString() !== eventId) {
    const error: any = new Error("Item and team must belong to the provided event");
    error.statusCode = 400;
    throw error;
  }

  if (!participantId) {
    const error: any = new Error("participantId is required");
    error.statusCode = 400;
    throw error;
  }

  ensureValidObjectId(participantId, "participant ID");

  const entryParticipantIds = new Set(
    entry.participants.map((participant) => participant.toString())
  );

  if (!entryParticipantIds.has(participantId)) {
    const error: any = new Error("Selected participant is not enrolled in this item");
    error.statusCode = 400;
    throw error;
  }

  const participantObjectId = new mongoose.Types.ObjectId(participantId);

  const eventObjectId = new mongoose.Types.ObjectId(eventId);
  const itemObjectId = new mongoose.Types.ObjectId(itemId);

  const placePoints = getPointsForPlace(item.placePoints, place);
  const gradePoints = getPointsForGrade(item.gradePoints, grade);
  const earnedPoints = placePoints + gradePoints;

  const existingResult = await Result.findOne({
    event: eventObjectId,
    item: itemObjectId,
    entry: entry._id
  });

  if (existingResult) {
    existingResult.place = place;
    existingResult.grade = grade?.trim() || undefined;
    existingResult.earnedPoints = earnedPoints;
    await existingResult.save();
    return existingResult;
  }

  const result = await Result.create({
    event: eventObjectId,
    item: itemObjectId,
    entry: entry._id,
    team: new mongoose.Types.ObjectId(resolvedTeamId),
    participant: participantObjectId,
    place,
    grade: grade?.trim() || undefined,
    earnedPoints
  });

  return result;
};

export const getTeamLeaderboard = async (eventId: string): Promise<ITeam[]> => {
  ensureValidObjectId(eventId, "event ID");

  const teams = await Team.find({ event: new mongoose.Types.ObjectId(eventId) })
    .populate("members.user", "name email")
    .sort({ totalPoints: -1, updatedAt: 1 });

  return teams;
};

export const getIndividualLeaderboard = async (
  eventId: string
): Promise<IndividualLeaderboardEntry[]> => {
  ensureValidObjectId(eventId, "event ID");

  const eventObjectId = new mongoose.Types.ObjectId(eventId);
  const itemCollectionName = CompetitionItem.collection.name;
  const userCollectionName = User.collection.name;

  const leaderboard = await Result.aggregate<IndividualLeaderboardEntry>([
    {
      $match: {
        event: eventObjectId
      }
    },
    {
      $lookup: {
        from: itemCollectionName,
        localField: "item",
        foreignField: "_id",
        as: "itemDoc"
      }
    },
    {
      $unwind: "$itemDoc"
    },
    {
      $match: {
        "itemDoc.type": ItemType.INDIVIDUAL
      }
    },
    {
      $group: {
        _id: "$participant",
        totalPoints: { $sum: "$earnedPoints" }
      }
    },
    {
      $sort: {
        totalPoints: -1
      }
    },
    {
      $limit: 10
    },
    {
      $lookup: {
        from: userCollectionName,
        localField: "_id",
        foreignField: "_id",
        as: "participantDoc"
      }
    },
    {
      $unwind: {
        path: "$participantDoc",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        participantId: { $toString: "$_id" },
        name: { $ifNull: ["$participantDoc.name", "Unknown"] },
        totalPoints: 1
      }
    }
  ]);

  return leaderboard;
};

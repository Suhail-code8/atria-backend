import mongoose from "mongoose";
import { Event } from "../events/event.model";
import { CompetitionItem, ItemType } from "./competitionItem.model";
import { CompetitionEntry } from "./competitionEntry.model";
import { Result, IResult } from "./result.model";
import { Team, ITeam } from "./team.model";
import { User, UserRole } from "../users/user.model";
import { Participation, ParticipationStatus } from "../participation/participation.model";

interface AddResultInput {
  eventId: string;
  actorUserId: string;
  itemId: string;
  teamId?: string;
  entryId?: string;
  participantId?: string | null;
  place?: number;
  grade?: string;
  gradePoints?: any; // Added for legacy support
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
  item: any,
  grade?: string
): number => {
  if (!grade?.trim()) return 0;
  const normalizedGrade = grade.trim().toUpperCase();

  // 1. Try new gradeRanges array
  if (item.gradeRanges && Array.isArray(item.gradeRanges) && item.gradeRanges.length > 0) {
    const matchedRange = item.gradeRanges.find((r: any) => r.grade.toUpperCase() === normalizedGrade);
    if (matchedRange) return matchedRange.maxPoints;
  }

  // 2. Fallback to old gradePoints object
  if (item.gradePoints && typeof item.gradePoints === 'object') {
    // Map 'A' -> gradePoints['a']
    const oldKey = normalizedGrade.toLowerCase();
    const points = item.gradePoints[oldKey];
    if (points !== undefined) return Number(points);
  }

  return 0;
};

export const addResult = async ({
  eventId,
  actorUserId,
  itemId,
  teamId,
  entryId,
  participantId,
  place,
  grade
}: AddResultInput): Promise<IResult> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(actorUserId, "user ID");
  ensureValidObjectId(itemId, "item ID");
  if (teamId) {
    ensureValidObjectId(teamId, "team ID");
  }
  if (entryId) {
    ensureValidObjectId(entryId, "entry ID");
  }

  const actorUser = await User.findById(actorUserId);
  const event = await Event.findById(eventId);
  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.createdBy.toString() !== actorUserId && actorUser?.role !== UserRole.JUDGE) {
    const error: any = new Error("Forbidden: Only event creator or judge can add results");
    error.statusCode = 403;
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
    if (entry.participants.length > 0) {
      participantId = entry.participants[0].toString();
    } else {
      const error: any = new Error("participantId is required and no participants are enrolled in this entry");
      error.statusCode = 400;
      throw error;
    }
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
  const gradePoints = getPointsForGrade(item, grade);
  const earnedPoints = placePoints + gradePoints;

  const query: any = {
    event: eventObjectId,
    item: itemObjectId,
    entry: entry._id
  };
  
  if (item.type === ItemType.INDIVIDUAL) {
    query.participant = participantObjectId;
  }

  const existingResult = await Result.findOne(query);

  if (existingResult) {
    existingResult.participant = participantObjectId; // Ensure correct participant is set if updated
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
        from: Participation.collection.name,
        let: { pId: "$participant", eId: "$event" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$pId"] },
                  { $eq: ["$event", "$$eId"] }
                ]
              },
              status: { $in: [ParticipationStatus.REGISTERED, ParticipationStatus.APPROVED] }
            }
          }
        ],
        as: "participationDoc"
      }
    },
    {
      $unwind: "$participationDoc"
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
        "itemDoc.countsTowardOverallTotal": { $ne: false }
      }
    },
    {
      $lookup: {
        from: CompetitionEntry.collection.name,
        localField: "entry",
        foreignField: "_id",
        as: "entryDoc"
      }
    },
    {
      $unwind: {
        path: "$entryDoc",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        earnedPoints: 1,
        participant: 1,
        entryParticipants: { $ifNull: ["$entryDoc.participants", []] },
        isIndividual: { $eq: ["$itemDoc.type", ItemType.INDIVIDUAL] }
      }
    },
    {
      // If it's individual, we use the specific participant. 
      // If it's group, we duplicate points for all entry participants.
      $project: {
        earnedPoints: 1,
        allAffectedParticipants: {
          $cond: {
            if: "$isIndividual",
            then: ["$participant"],
            else: { $setUnion: [["$participant"], "$entryParticipants"] }
          }
        }
      }
    },
    {
       $unwind: "$allAffectedParticipants"
    },
    {
      $group: {
        _id: "$allAffectedParticipants",
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

/**
 * Get all individual results for an event with populated details.
 */
export const getResultsByEvent = async (eventId: string): Promise<IResult[]> => {
  ensureValidObjectId(eventId, "event ID");

  return Result.find({ event: new mongoose.Types.ObjectId(eventId) })
    .populate("participant", "name email")
    .populate("team", "name")
    .populate("item", "name type")
    .sort({ createdAt: -1 });
};

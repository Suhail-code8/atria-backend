import mongoose from "mongoose";
import { CompetitionItem } from "./competitionItem.model";
import { CompetitionEntry } from "./competitionEntry.model";
import { Result } from "./result.model";
import { Team } from "./team.model";
import { Participation } from "../participation/participation.model";

export const recalculateTeamPoints = async (
  teamId: mongoose.Types.ObjectId | string
): Promise<void> => {
  const normalizedTeamId =
    typeof teamId === "string" ? new mongoose.Types.ObjectId(teamId) : teamId;

  const totalAgg = await Result.aggregate<{ totalPoints: number }>([
    {
      $match: {
        team: normalizedTeamId
      }
    },
    {
      $lookup: {
        from: CompetitionItem.collection.name,
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
      $group: {
        _id: "$team",
        totalPoints: { $sum: "$earnedPoints" }
      }
    }
  ]);

  const totalPoints = totalAgg.length > 0 ? totalAgg[0].totalPoints : 0;

  await Team.findByIdAndUpdate(normalizedTeamId, { totalPoints });
};

export const recalculateIndividualPoints = async (
  eventId: mongoose.Types.ObjectId | string,
  participantIds: mongoose.Types.ObjectId[] | string[]
): Promise<void> => {
  const normalizedEventId =
    typeof eventId === "string" ? new mongoose.Types.ObjectId(eventId) : eventId;

  const uniqueParticipantIds = Array.from(
    new Set(participantIds.map((id) => id.toString()))
  ).map((id) => new mongoose.Types.ObjectId(id));

  for (const participantId of uniqueParticipantIds) {
    const totalAgg = await Result.aggregate<{ totalPoints: number }>([
      {
        $match: {
          event: normalizedEventId
        }
      },
      {
        $lookup: {
          from: CompetitionItem.collection.name,
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
        $match: {
          $or: [
            { participant: participantId },
            { "entryDoc.participants": participantId }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: "$earnedPoints" }
        }
      }
    ]);

    const totalPoints = totalAgg.length > 0 ? totalAgg[0].totalPoints : 0;

    await Participation.findOneAndUpdate(
      {
        event: normalizedEventId,
        user: participantId
      },
      {
        $set: { individualPoints: totalPoints }
      }
    );
  }
};

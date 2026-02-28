import mongoose, { Document, Schema } from "mongoose";
import { IEvent } from "../events/event.model";
import { ICompetitionItem } from "./competitionItem.model";
import { ICompetitionEntry, CompetitionEntry } from "./competitionEntry.model";
import { ITeam } from "./team.model";
import { IUser } from "../users/user.model";
import { Team } from "./team.model";
import { Participation } from "../participation/participation.model";

export interface IResult extends Document {
  event: mongoose.Types.ObjectId | string | IEvent;
  item: mongoose.Types.ObjectId | string | ICompetitionItem;
  entry?: mongoose.Types.ObjectId | string | ICompetitionEntry;
  team: mongoose.Types.ObjectId | string | ITeam;
  participant: mongoose.Types.ObjectId | string | IUser;
  place?: number;
  grade?: string;
  earnedPoints: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const resultSchema = new Schema<IResult>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "CompetitionItem",
      required: true
    },
    entry: {
      type: Schema.Types.ObjectId,
      ref: "CompetitionEntry"
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },
    participant: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    place: {
      type: Number
    },
    grade: {
      type: String,
      trim: true
    },
    earnedPoints: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const recalculateTeamPoints = async (
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
      $group: {
        _id: "$team",
        totalPoints: { $sum: "$earnedPoints" }
      }
    }
  ]);

  const totalPoints = totalAgg.length > 0 ? totalAgg[0].totalPoints : 0;

  await Team.findByIdAndUpdate(normalizedTeamId, { totalPoints });
};

const getEntryParticipantIdsForResult = async (
  resultDoc: IResult
): Promise<mongoose.Types.ObjectId[]> => {
  let entryId: string | undefined;

  if (resultDoc.entry) {
    entryId =
      typeof resultDoc.entry === "string"
        ? resultDoc.entry
        : (resultDoc.entry as mongoose.Types.ObjectId).toString();
  }

  let entry = entryId
    ? await CompetitionEntry.findById(entryId).select("participants")
    : null;

  if (!entry) {
    entry = await CompetitionEntry.findOne({
      event: resultDoc.event,
      item: resultDoc.item,
      team: resultDoc.team
    }).select("participants");
  }

  if (entry && entry.participants.length > 0) {
    return entry.participants.map((participant) =>
      typeof participant === "string"
        ? new mongoose.Types.ObjectId(participant)
        : (participant as mongoose.Types.ObjectId)
    );
  }

  const fallbackParticipantId =
    typeof resultDoc.participant === "string"
      ? resultDoc.participant
      : (resultDoc.participant as mongoose.Types.ObjectId).toString();

  return [new mongoose.Types.ObjectId(fallbackParticipantId)];
};

const recalculateIndividualPoints = async (
  eventId: mongoose.Types.ObjectId | string,
  participantIds: mongoose.Types.ObjectId[]
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

resultSchema.post("save", async function (doc) {
  await recalculateTeamPoints(doc.team as mongoose.Types.ObjectId | string);

  const participantIds = await getEntryParticipantIdsForResult(doc);
  await recalculateIndividualPoints(
    doc.event as mongoose.Types.ObjectId | string,
    participantIds
  );
});

resultSchema.post("findOneAndDelete", async function (doc: IResult | null) {
  if (!doc) {
    return;
  }

  await recalculateTeamPoints(doc.team as mongoose.Types.ObjectId | string);

  const participantIds = await getEntryParticipantIdsForResult(doc);
  await recalculateIndividualPoints(
    doc.event as mongoose.Types.ObjectId | string,
    participantIds
  );
});

resultSchema.index({ item: 1 });
resultSchema.index({ participant: 1 });

export const Result = mongoose.model<IResult>("Result", resultSchema);

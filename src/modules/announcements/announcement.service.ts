import mongoose from "mongoose";
import {
  Announcement,
  AnnouncementPriority,
  IAnnouncement
} from "./announcement.model";
import { Event } from "../events/event.model";

interface CreateAnnouncementInput {
  title: string;
  content: string;
  priority?: AnnouncementPriority;
  isPublished?: boolean;
}

interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  priority?: AnnouncementPriority;
  isPublished?: boolean;
}

const ensureValidObjectId = (id: string, label: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error: any = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

const ensureOrganizerOwnsEvent = async (eventId: string, organizerId: string) => {
  const event = await Event.findById(eventId);

  if (!event) {
    const error: any = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (event.createdBy.toString() !== organizerId) {
    const error: any = new Error("Forbidden: Only event organizer can manage announcements");
    error.statusCode = 403;
    throw error;
  }

  return event;
};

export const createAnnouncement = async (
  eventId: string,
  organizerId: string,
  data: CreateAnnouncementInput
): Promise<IAnnouncement> => {
  ensureValidObjectId(eventId, "event ID");
  ensureValidObjectId(organizerId, "organizer ID");

  if (!data.title || !data.content) {
    const error: any = new Error("Title and content are required");
    error.statusCode = 400;
    throw error;
  }

  await ensureOrganizerOwnsEvent(eventId, organizerId);

  const isPublished = data.isPublished ?? true;

  const announcement = await Announcement.create({
    event: new mongoose.Types.ObjectId(eventId),
    createdBy: new mongoose.Types.ObjectId(organizerId),
    title: data.title,
    content: data.content,
    priority: data.priority ?? AnnouncementPriority.INFO,
    isPublished,
    publishedAt: isPublished ? new Date() : undefined
  });

  return announcement;
};

export const getEventAnnouncements = async (
  eventId: string
): Promise<IAnnouncement[]> => {
  ensureValidObjectId(eventId, "event ID");

  const announcements = await Announcement.find({
    event: new mongoose.Types.ObjectId(eventId),
    isPublished: true
  })
    .populate("createdBy", "name email")
    .sort({ publishedAt: -1 });

  return announcements;
};

export const updateAnnouncement = async (
  announcementId: string,
  organizerId: string,
  data: UpdateAnnouncementInput
): Promise<IAnnouncement> => {
  ensureValidObjectId(announcementId, "announcement ID");
  ensureValidObjectId(organizerId, "organizer ID");

  const announcement = await Announcement.findById(announcementId).populate("event", "createdBy");

  if (!announcement) {
    const error: any = new Error("Announcement not found");
    error.statusCode = 404;
    throw error;
  }

  const event = announcement.event as any;
  const isEventOrganizer = event?.createdBy?.toString?.() === organizerId;
  const isAnnouncementCreator = announcement.createdBy.toString() === organizerId;

  if (!isEventOrganizer && !isAnnouncementCreator) {
    const error: any = new Error("Forbidden: You cannot update this announcement");
    error.statusCode = 403;
    throw error;
  }

  if (data.title !== undefined) {
    announcement.title = data.title;
  }

  if (data.content !== undefined) {
    announcement.content = data.content;
  }

  if (data.priority !== undefined) {
    announcement.priority = data.priority;
  }

  if (data.isPublished !== undefined) {
    announcement.isPublished = data.isPublished;
    announcement.publishedAt = data.isPublished ? announcement.publishedAt ?? new Date() : undefined;
  }

  await announcement.save();

  return announcement;
};

export const deleteAnnouncement = async (
  announcementId: string,
  organizerId: string
): Promise<{ deleted: true }> => {
  ensureValidObjectId(announcementId, "announcement ID");
  ensureValidObjectId(organizerId, "organizer ID");

  const announcement = await Announcement.findById(announcementId).populate("event", "createdBy");

  if (!announcement) {
    const error: any = new Error("Announcement not found");
    error.statusCode = 404;
    throw error;
  }

  const event = announcement.event as any;
  const isEventOrganizer = event?.createdBy?.toString?.() === organizerId;
  const isAnnouncementCreator = announcement.createdBy.toString() === organizerId;

  if (!isEventOrganizer && !isAnnouncementCreator) {
    const error: any = new Error("Forbidden: You cannot delete this announcement");
    error.statusCode = 403;
    throw error;
  }

  await announcement.deleteOne();

  return { deleted: true };
};

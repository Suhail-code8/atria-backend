import mongoose from "mongoose";
import {
  Announcement,
  AnnouncementPriority,
  IAnnouncement
} from "./announcement.model";
import { Event } from "../events/event.model";
import { Participation } from "../participation/participation.model";
import * as notificationService from "../notifications/notification.service";
import { sendEmail } from "../../utils/email.service";
import { env } from "../../config/env";

interface CreateAnnouncementInput {
  title: string;
  content: string;
  priority?: AnnouncementPriority;
  isPublished?: boolean;
  sendEmail?: boolean;
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

  const event = await ensureOrganizerOwnsEvent(eventId, organizerId);

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
  if (isPublished) {
    const participants = await Participation.find({
      event: new mongoose.Types.ObjectId(eventId),
      status: { $in: ["REGISTERED", "APPROVED"] }
    }).populate("user", "name email");

    const recipientIds = participants.map(p => (p.user as any)._id.toString());
    const eventName = event.title || "Event";


    if (recipientIds.length > 0) {
      // 1. In-App Notifications
      notificationService.sendBulkNotifications(recipientIds, {
        type: "ANNOUNCEMENT",
        title: `New Announcement: ${data.title}`,
        message: data.content.substring(0, 100) + (data.content.length > 100 ? "..." : ""),
        actionUrl: `/dashboard/events/${eventId}`,
        referenceId: eventId
      }).catch(err => console.error("Bulk notification failed for announcement:", err));

      // 2. Email Broadcasting (if requested)
      if (data.sendEmail) {
        const dashboardUrl = `${env.clientUrl}/dashboard/events/${eventId}`;
        
        // Using Promise.allSettled to ensure failure of one doesn't stop others, 
        // though sequential is safer for some SMTP limits. 
        // Given current scale, we'll fire them off.
        participants.forEach(p => {
          const user = p.user as any;
          if (user?.email) {
            const emailHtml = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
                <h2 style="color: #0f172a; margin-top: 0;">${data.title}</h2>
                <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">Message from <strong>${eventName}</strong></p>
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; color: #1e293b; white-space: pre-wrap;">${data.content}</div>
                <div style="margin-top: 32px; text-align: center;">
                  <a href="${dashboardUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Event Dashboard</a>
                </div>
                <hr style="margin-top: 32px; border: 0; border-top: 1px solid #e2e8f0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center;">You are receiving this because you are a registered participant of ${eventName}.</p>
              </div>
            `;
            
            sendEmail(user.email, `[${eventName}] ${data.title}`, emailHtml)
              .catch(err => console.error(`Failed to send announcement email to ${user.email}:`, err));
          }
        });
      }
    }
  }

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

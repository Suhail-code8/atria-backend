import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes";
import eventRoutes from "./modules/events/event.routes";
import participationRoutes from "./modules/participation/participation.routes";
import submissionRoutes from "./modules/submissions/submission.routes";
import { errorHandler } from "./middlewares/error.middleware";

import userRoutes from "./modules/users/user.routes";
import announcementRoutes from "./modules/announcements/announcement.routes";
import competitionItemRoutes from "./modules/competitions/competitionItem.routes";
import categoryRoutes from "./modules/competitions/category.routes";
import resultRoutes from "./modules/competitions/result.routes";
import teamRoutes from "./modules/competitions/team.routes";
import entryRoutes from "./modules/competitions/entry.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import eventJudgeRoutes from "./modules/events/eventJudge.routes";

import { env } from "./config/env";

const app = express();
// Build allowed origins list and normalize entries
const rawAllowed = (process.env.CLIENT_URLS || `${env.clientUrl},https://atria-frontend-new.vercel.app`)
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = Array.from(new Set(rawAllowed));

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like curl, Postman, or server-to-server)
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');

      // In development, allow all origins for easier local testing
      if (env.nodeEnv === 'development') return callback(null, true);

      if (allowedOrigins.includes(normalized)) return callback(null, true);
      return callback(new Error('CORS policy: Origin not allowed'));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.send("Atria API running");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events", submissionRoutes);
app.use("/api/participation", participationRoutes);
app.use("/api/participations", participationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/competition-items', competitionItemRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/event-judges', eventJudgeRoutes);

app.use(errorHandler);

export default app;



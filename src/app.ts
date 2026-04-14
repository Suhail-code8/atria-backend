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


const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
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

app.use(errorHandler);

export default app;



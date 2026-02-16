import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes";
import eventRoutes from "./modules/events/event.routes";
import participationRoutes from "./modules/participation/participation.routes";
import submissionRoutes from "./modules/submissions/submission.routes";
import { errorHandler } from "./middlewares/error.middleware";

import userRoutes from "./modules/users/user.routes";


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


app.use(errorHandler);

export default app;



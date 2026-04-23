import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env"; // Or use process.env if env.ts doesn't export what we need

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Join user-specific notification room
        socket.on("join_user_room", (userId: string) => {
            socket.join(userId);
            console.log(`Socket ${socket.id} joined room for user ${userId}`);
        });

        // ─── Workflow Engine: real-time leaderboard ───────────────────────────
        // Clients subscribe to live leaderboard updates for a specific event.
        // Emit channel: `event:<eventId>:leaderboard`  →  event: `leaderboard:update`
        socket.on("join_event_leaderboard", (eventId: string) => {
            if (typeof eventId === "string" && eventId.length > 0) {
                socket.join(`event:${eventId}:leaderboard`);
                console.log(`Socket ${socket.id} joined leaderboard room for event ${eventId}`);
            }
        });
        // ─────────────────────────────────────────────────────────────────────

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = (): SocketIOServer => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};


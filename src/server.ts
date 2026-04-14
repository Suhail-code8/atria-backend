import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { initSocket } from "./utils/socket";

const server = http.createServer(app);
initSocket(server);

const startServer = async () => {
  await connectDB();

  server.listen(env.port, () => {
    console.log(`Atria backend running on port ${env.port}`);
  });
};

startServer();


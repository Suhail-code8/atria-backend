import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { initSocket } from "./utils/socket";
import { runMigration } from "./scripts/migrate-events-to-workflow";

const server = http.createServer(app);
initSocket(server);

const startServer = async () => {
  await connectDB();

  // Run DB migration if env flag is set (e.g.  RUN_MIGRATION=true npm run dev)
  if (env.runMigration) {
    await runMigration();
  }

  server.listen(env.port, () => {
    console.log(`Atria backend running on port ${env.port}`);
  });
};

startServer();

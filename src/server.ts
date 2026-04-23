import { createServer } from "node:http";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { app } from "./app";
import { initializeSocket } from "./socket";

const server = createServer(app);
initializeSocket(server);

server.listen(env.PORT, () => {
  console.log(`JISphere backend running on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  console.log("Graceful shutdown initiated");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);


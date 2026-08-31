const { createApp } = require("./app");
const database = require("./config/database");
const { environment, validateEnvironment } = require("./config/environment");
const rateLimitRepository = require("./repositories/rate-limit.repository");

async function startServer() {
  validateEnvironment();
  const dialect = await database.initialize();
  await rateLimitRepository.deleteExpired();

  const app = createApp();
  const server = app.listen(environment.port, () => {
    console.log(
      `FinSafe API listening on port ${environment.port} using ${dialect}.`
    );
  });

  async function shutdown(signal) {
    console.log(`${signal} received. Shutting down gracefully.`);
    server.close(async () => {
      await database.close();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch(async (error) => {
  console.error("Server failed to start:", error.message);
  await database.close();
  process.exit(1);
});

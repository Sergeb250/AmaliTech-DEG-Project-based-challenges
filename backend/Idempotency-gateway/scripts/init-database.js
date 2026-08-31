const fs = require("fs/promises");
const path = require("path");
const database = require("../src/config/database");
const { validateEnvironment } = require("../src/config/environment");

async function initializeDatabase() {
  validateEnvironment();
  const dialect = await database.initialize();
  const schemaFile =
    dialect === "postgres" ? "database.sql" : "database.sqlite.sql";
  const schemaPath = path.resolve(__dirname, "..", schemaFile);
  const schema = await fs.readFile(schemaPath, "utf8");
  await database.executeSchema(schema);
  console.log(`Database schema initialized successfully using ${dialect}.`);
}

initializeDatabase()
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => database.close());

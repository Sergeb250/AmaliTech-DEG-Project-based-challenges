const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { Pool } = require("pg");
const { environment } = require("./environment");

let pool;
let sqlite;
let activeDialect;
let sqliteTransactionQueue = Promise.resolve();

function activateSqlite() {
  const sqlitePath = path.resolve(process.cwd(), environment.sqlitePath);
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  activeDialect = "sqlite";
  console.warn(`Using SQLite fallback database at ${sqlitePath}`);
}

async function initialize() {
  if (activeDialect) {
    return activeDialect;
  }

  if (environment.databaseUrl) {
    const candidatePool = new Pool({
      connectionString: environment.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000
    });

    try {
      await candidatePool.query("SELECT 1");
      pool = candidatePool;
      activeDialect = "postgres";
      pool.on("error", (error) => {
        console.error("Unexpected PostgreSQL pool error", error);
      });
      console.log("Connected to PostgreSQL.");
      return activeDialect;
    } catch (error) {
      await candidatePool.end().catch(() => undefined);
      console.warn(
        `PostgreSQL is unavailable (${error.code || "connection error"}); starting with SQLite.`
      );
    }
  } else {
    console.warn("DATABASE_URL is not set; starting with SQLite.");
  }

  activateSqlite();
  return activeDialect;
}

function requireDialect() {
  if (!activeDialect) {
    throw new Error("Database has not been initialized.");
  }
}

function sqliteClient() {
  return {
    dialect: "sqlite",
    get(text, parameters = []) {
      return sqlite.prepare(text).get(...parameters);
    },
    run(text, parameters = []) {
      return sqlite.prepare(text).run(...parameters);
    }
  };
}

async function transaction(work) {
  requireDialect();

  if (activeDialect === "postgres") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work({
        dialect: "postgres",
        query: (text, parameters) => client.query(text, parameters)
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const runTransaction = async () => {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const result = await work(sqliteClient());
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  };

  const result = sqliteTransactionQueue.then(runTransaction, runTransaction);
  sqliteTransactionQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

module.exports = {
  initialize,
  getDialect() {
    return activeDialect;
  },
  query(text, parameters) {
    requireDialect();
    if (activeDialect !== "postgres") {
      throw new Error("PostgreSQL query requested while SQLite is active.");
    }
    return pool.query(text, parameters);
  },
  sqliteGet(text, parameters = []) {
    requireDialect();
    return sqliteClient().get(text, parameters);
  },
  sqliteRun(text, parameters = []) {
    requireDialect();
    return sqliteClient().run(text, parameters);
  },
  executeSchema(schema) {
    requireDialect();
    if (activeDialect === "sqlite") {
      sqlite.exec(schema);
      return Promise.resolve();
    }
    return pool.query(schema);
  },
  transaction,
  async close() {
    if (pool) {
      await pool.end();
      pool = undefined;
    }
    if (sqlite) {
      sqlite.close();
      sqlite = undefined;
    }
    activeDialect = undefined;
  }
};

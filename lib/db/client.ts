import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const globalDatabase = globalThis as typeof globalThis & {
  mosaicSql?: ReturnType<typeof postgres>;
};

const sql =
  globalDatabase.mosaicSql ??
  postgres(databaseUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.mosaicSql = sql;
}

export const db = drizzle(sql, { schema });

export async function closeDatabaseConnection() {
  await sql.end();
}

export type Database = typeof db;

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.WAREHOUSE_ADMIN_DATABASE_URL;

if (!databaseUrl) throw new Error("WAREHOUSE_ADMIN_DATABASE_URL is required to run warehouse Drizzle commands.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./warehouse/schema.ts",
  out: "./warehouse/migrations",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});

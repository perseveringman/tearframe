import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/server/src/db/schema.ts",
  out: "./packages/server/drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TEARFRAME_DB_PATH ?? "./data/tearframe.db"
  }
});

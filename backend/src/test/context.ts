import "dotenv/config";
import { parseRuntimeEnvironment } from "../config.js";
import { createDatabase } from "../db.js";
export const testConfig = parseRuntimeEnvironment({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  SESSION_SECRET: process.env.TEST_SESSION_SECRET,
  AI_PROVIDER: "mock",
  AI_BASE_URL: undefined,
  AI_MODEL: undefined,
  AI_API_KEY: undefined,
});
export const testDb = createDatabase(testConfig);

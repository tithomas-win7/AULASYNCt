import { PrismaClient } from "@prisma/client";
import type { RuntimeConfig } from "./config.js";
export function createDatabase(config: RuntimeConfig) {
  return new PrismaClient({
    datasources: { db: { url: config.DATABASE_URL } },
  });
}

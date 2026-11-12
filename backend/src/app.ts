import express from "express";
import helmet from "helmet";
import session from "express-session";
import type { PrismaClient } from "@prisma/client";
import type { RuntimeConfig } from "./config.js";
import { PrismaSessionStore } from "./auth/session-store.js";
import { authRoutes, cookieName, cookieOptions } from "./auth/routes.js";
import { materiasRoutes } from "./materias/routes.js";
import { materialesRoutes } from "./materiales/routes.js";
import { resumenesRoutes, type SummaryProvider } from "./resumenes/routes.js";
import { errorHandler } from "./errors.js";

export type AppDependencies = {
  db: PrismaClient;
  config: RuntimeConfig;
  attemptLimit?: number;
  summaryProvider?: SummaryProvider;
  summaryTimeoutMs?: number;
};
export function createApp({
  db,
  config,
  attemptLimit,
  summaryProvider,
  summaryTimeoutMs,
}: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "aulasync-api", sprint: 5 });
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    session({
      name: cookieName(config),
      secret: config.SESSION_SECRET,
      store: new PrismaSessionStore(db),
      resave: false,
      saveUninitialized: false,
      rolling: false,
      cookie: {
        ...cookieOptions(config),
        maxAge: config.SESSION_TTL_HOURS * 3600000,
      },
    }),
  );
  app.use("/api/auth", authRoutes(db, config, attemptLimit));
  app.use("/api/materias", materiasRoutes(db, config));
  app.use(
    "/api",
    resumenesRoutes(db, config, summaryProvider, summaryTimeoutMs),
  );
  app.use("/api/materiales", materialesRoutes(db, config));
  app.use((_req, res) => {
    res.status(404).json({ error: "Recurso no disponible." });
  });
  app.use(errorHandler);
  return app;
}

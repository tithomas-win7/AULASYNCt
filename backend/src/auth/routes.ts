import { Router, type Request } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "@prisma/client";
import type { RuntimeConfig } from "../config.js";
import { HttpError } from "../errors.js";
import {
  hashPassword,
  verifyPassword,
  dummyPasswordHash,
} from "./passwords.js";
import {
  publicUserSelect,
  requireAuth,
  csrfProtection,
  saveSession,
} from "./middleware.js";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Ingresá un correo válido.")
  .max(254);
export const registrationSchema = z
  .object({
    nombre: z.string().trim().min(2, "Ingresá al menos 2 caracteres.").max(100),
    email: emailSchema,
    password: z
      .string()
      .min(10, "La contraseña debe tener al menos 10 caracteres.")
      .max(128, "La contraseña admite hasta 128 caracteres."),
  })
  .strict();
const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const cookieName = (config: RuntimeConfig) =>
  config.NODE_ENV === "production" ? "__Host-aulasync.sid" : "aulasync.sid";
export const cookieOptions = (config: RuntimeConfig) => ({
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.NODE_ENV === "production",
});

async function establishSession(req: Request, usuarioId: string) {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.usuarioId = usuarioId;
  req.session.autenticadoEn = Date.now();
  req.session.csrfToken = randomBytes(32).toString("hex");
  await saveSession(req);
}
export function authRoutes(
  db: PrismaClient,
  config: RuntimeConfig,
  attemptLimit = 20,
) {
  const router = Router();
  const csrf = csrfProtection(config);
  const limiter = () =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: attemptLimit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error:
          "Demasiados intentos. Esperá 15 minutos antes de volver a intentar.",
      },
    });
  router.get("/session", async (req, res) => {
    let usuario = null;
    if (
      req.session.usuarioId &&
      req.session.autenticadoEn &&
      Date.now() - req.session.autenticadoEn <
        config.SESSION_TTL_HOURS * 3600000
    ) {
      usuario = await db.usuario.findUnique({
        where: { id: req.session.usuarioId },
        select: publicUserSelect,
      });
    }
    if (!usuario && req.session.usuarioId) {
      await new Promise<void>((resolve, reject) =>
        req.session.regenerate((error) => (error ? reject(error) : resolve())),
      );
    }
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString("hex");
      await saveSession(req);
    }
    res.json({ usuario, csrfToken: req.session.csrfToken });
  });
  router.post("/register", csrf, limiter(), async (req, res) => {
    const input = registrationSchema.parse(req.body);
    const usuario = await db.usuario.create({
      data: {
        nombre: input.nombre,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      },
      select: publicUserSelect,
    });
    await establishSession(req, usuario.id);
    res.status(201).json({
      usuario,
      csrfToken: req.session.csrfToken,
      message: "Tu cuenta fue creada correctamente.",
    });
  });
  router.post("/login", csrf, limiter(), async (req, res) => {
    const input = loginSchema.parse(req.body);
    const usuario = await db.usuario.findUnique({
      where: { email: input.email },
    });
    const correct = await verifyPassword(
      input.password,
      usuario?.passwordHash ?? (await dummyPasswordHash),
    );
    if (!usuario || !correct)
      throw new HttpError(401, "El correo o la contraseña son incorrectos.");
    await establishSession(req, usuario.id);
    res.json({
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
      csrfToken: req.session.csrfToken,
      message: "Sesión iniciada.",
    });
  });
  router.post("/logout", requireAuth(db, config), csrf, async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie(cookieName(config), cookieOptions(config));
    res.status(204).end();
  });
  return router;
}

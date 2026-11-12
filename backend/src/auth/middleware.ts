import { timingSafeEqual } from "node:crypto";
import type { RequestHandler, Request } from "express";
import type { PrismaClient } from "@prisma/client";
import type { RuntimeConfig } from "../config.js";
import { HttpError } from "../errors.js";

export const publicUserSelect = {
  id: true,
  nombre: true,
  email: true,
} as const;
export function requireAuth(
  db: PrismaClient,
  config: RuntimeConfig,
): RequestHandler {
  return async (req, _res, next) => {
    if (
      !req.session.usuarioId ||
      !req.session.autenticadoEn ||
      Date.now() - req.session.autenticadoEn >=
        config.SESSION_TTL_HOURS * 3600000
    ) {
      throw new HttpError(401, "Iniciá sesión para continuar.");
    }
    const usuario = await db.usuario.findUnique({
      where: { id: req.session.usuarioId },
      select: publicUserSelect,
    });
    if (!usuario) throw new HttpError(401, "La sesión ya no está disponible.");
    req.usuario = usuario;
    next();
  };
}
export function csrfProtection(config: RuntimeConfig): RequestHandler {
  return (req, _res, next) => {
    const supplied = req.get("X-CSRF-Token");
    const expected = req.session.csrfToken;
    const origin = req.get("Origin");
    if (
      (origin && origin !== config.APP_ORIGIN) ||
      req.get("Sec-Fetch-Site") === "cross-site" ||
      !supplied ||
      !expected ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !/^[a-f0-9]{64}$/.test(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    ) {
      throw new HttpError(
        403,
        "La solicitud no pudo verificarse. Actualizá la página e intentá nuevamente.",
      );
    }
    next();
  };
}
export function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
}

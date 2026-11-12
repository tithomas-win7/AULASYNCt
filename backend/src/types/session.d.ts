import "express-session";
import type { Usuario } from "@prisma/client";
declare module "express-session" {
  interface SessionData {
    usuarioId?: string;
    csrfToken?: string;
    autenticadoEn?: number;
  }
}
declare global {
  namespace Express {
    interface Request {
      usuario?: Pick<Usuario, "id" | "nombre" | "email">;
    }
  }
}

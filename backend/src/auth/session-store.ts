import session from "express-session";
import type { Prisma, PrismaClient } from "@prisma/client";

export class PrismaSessionStore extends session.Store {
  constructor(private db: PrismaClient) {
    super();
  }
  override get(
    sid: string,
    callback: (error: unknown, data?: session.SessionData | null) => void,
  ) {
    this.db.sesion
      .findUnique({ where: { sid } })
      .then((row) => {
        callback(
          null,
          row && row.expiraEn.getTime() > Date.now()
            ? (row.datos as unknown as session.SessionData)
            : null,
        );
      })
      .catch(callback);
  }
  override set(
    sid: string,
    data: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    const expiraEn = new Date(
      data.cookie.expires ??
        Date.now() + (data.cookie.originalMaxAge ?? 8 * 3600000),
    );
    const datos = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
    this.db.sesion
      .upsert({
        where: { sid },
        create: { sid, datos, expiraEn },
        update: { datos, expiraEn },
      })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
  override destroy(sid: string, callback?: (error?: unknown) => void) {
    this.db.sesion
      .deleteMany({ where: { sid } })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
  override touch(
    sid: string,
    data: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    const expiraEn = new Date(
      data.cookie.expires ??
        Date.now() + (data.cookie.originalMaxAge ?? 8 * 3600000),
    );
    this.db.sesion
      .updateMany({ where: { sid }, data: { expiraEn } })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}

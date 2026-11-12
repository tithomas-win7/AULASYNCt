import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    res.status(400).json({ error: "Revisá los datos del formulario.", fields });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    return;
  }
  const status =
    error?.type === "entity.too.large"
      ? 413
      : error?.type === "entity.parse.failed"
        ? 400
        : 500;
  res.status(status).json({
    error:
      status === 413
        ? "Solicitud demasiado grande."
        : status === 400
          ? "JSON inválido."
          : "No pudimos completar la operación. Intentá nuevamente.",
  });
};

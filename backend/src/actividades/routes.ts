import { Router } from "express";
import { Prisma, TipoActividad, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { csrfProtection } from "../auth/middleware.js";
import type { RuntimeConfig } from "../config.js";
import { HttpError } from "../errors.js";

const inputSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(1, "Ingresá un título.")
      .max(200, "Usá hasta 200 caracteres."),
    tipo: z.enum(TipoActividad, {
      error: "Elegí tarea, trabajo práctico o examen.",
    }),
    fecha: z.iso
      .date("Ingresá una fecha válida con formato AAAA-MM-DD.")
      .refine(
        (fecha) => !fecha.startsWith("0000"),
        "Ingresá un año entre 0001 y 9999.",
      ),
  })
  .strict();
const materiaIdSchema = z.uuid("Identificador de materia inválido.");
const select = {
  id: true,
  titulo: true,
  tipo: true,
  fecha: true,
  materiaId: true,
} as const;

function serialize(
  actividad: Prisma.ActividadGetPayload<{ select: typeof select }>,
) {
  return { ...actividad, fecha: actividad.fecha.toISOString().slice(0, 10) };
}

// Se monta después del middleware de autenticación del router de materias.
export function actividadesRoutes(db: PrismaClient, config: RuntimeConfig) {
  const router = Router({ mergeParams: true });
  router.get<{ materiaId: string }>("/", async (req, res) => {
    const id = materiaIdSchema.parse(req.params.materiaId);
    const materia = await db.materia.findFirst({
      where: { id, usuarioId: req.usuario!.id },
      select: {
        actividades: { select, orderBy: [{ fecha: "asc" }, { id: "asc" }] },
      },
    });
    if (!materia) throw new HttpError(404, "Materia no encontrada.");
    res.json({ actividades: materia.actividades.map(serialize) });
  });
  router.post<{ materiaId: string }>(
    "/",
    csrfProtection(config),
    async (req, res) => {
      const id = materiaIdSchema.parse(req.params.materiaId);
      const { titulo, tipo, fecha } = inputSchema.parse(req.body);
      try {
        const actividad = await db.actividad.create({
          data: {
            titulo,
            tipo,
            fecha: new Date(fecha + "T00:00:00.000Z"),
            materia: {
              connect: { id_usuarioId: { id, usuarioId: req.usuario!.id } },
            },
          },
          select,
        });
        res.status(201).json({ actividad: serialize(actividad) });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2025" ||
            error.code === "P2003" ||
            error.code === "P2018")
        ) {
          throw new HttpError(404, "Materia no encontrada.");
        }
        throw error;
      }
    },
  );
  return router;
}

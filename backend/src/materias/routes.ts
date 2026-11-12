import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { RuntimeConfig } from "../config.js";
import { requireAuth, csrfProtection } from "../auth/middleware.js";
import { HttpError } from "../errors.js";
import { actividadesRoutes } from "../actividades/routes.js";

const fields = {
  nombre: z
    .string()
    .trim()
    .min(1, "Ingresá un nombre.")
    .max(120, "El nombre admite hasta 120 caracteres."),
  descripcion: z
    .string()
    .trim()
    .max(1000, "La descripción admite hasta 1000 caracteres.")
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null)),
};
const createSchema = z.object(fields).strict();
const editSchema = z
  .object({ nombre: fields.nombre.optional(), descripcion: fields.descripcion })
  .strict()
  .refine(
    (value) => value.nombre !== undefined || value.descripcion !== undefined,
    "Ingresá al menos un campo.",
  );
const selection = {
  id: true,
  nombre: true,
  descripcion: true,
  creadoEn: true,
  actualizadoEn: true,
} as const;
function idParam(value: unknown) {
  return z.uuid("Identificador de materia inválido.").parse(value);
}

export function materiasRoutes(db: PrismaClient, config: RuntimeConfig) {
  const router = Router();
  router.use(requireAuth(db, config));
  router.use("/:materiaId/actividades", actividadesRoutes(db, config));
  router.get("/", async (req, res) => {
    const materias = await db.materia.findMany({
      where: { usuarioId: req.usuario!.id },
      select: selection,
      orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
    });
    res.json({ materias });
  });
  router.get("/:id", async (req, res) => {
    const materia = await db.materia.findFirst({
      where: { id: idParam(req.params.id), usuarioId: req.usuario!.id },
      select: selection,
    });
    if (!materia) throw new HttpError(404, "Materia no encontrada.");
    res.json({ materia });
  });
  router.post("/", csrfProtection(config), async (req, res) => {
    const input = createSchema.parse(req.body);
    const materia = await db.materia.create({
      data: { ...input, usuarioId: req.usuario!.id },
      select: selection,
    });
    res.status(201).json({ materia });
  });
  router.patch("/:id", csrfProtection(config), async (req, res) => {
    const id = idParam(req.params.id);
    const input = editSchema.parse(req.body);
    const existing = await db.materia.findFirst({
      where: { id, usuarioId: req.usuario!.id },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, "Materia no encontrada.");
    const materia = await db.materia.update({
      where: { id, usuarioId: req.usuario!.id },
      data: input,
      select: selection,
    });
    res.json({ materia });
  });
  router.delete("/:id", csrfProtection(config), async (req, res) => {
    const id = idParam(req.params.id);
    const usuarioId = req.usuario!.id;
    await db.$transaction(async (tx) => {
      const owned = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Materia" WHERE id = ${id}::uuid AND "usuarioId" = ${usuarioId}::uuid FOR UPDATE`;
      if (!owned.length) throw new HttpError(404, "Materia no encontrada.");
      await tx.material.updateMany({
        where: { materiaId: id, usuarioId },
        data: { materiaId: null },
      });
      await tx.materia.delete({ where: { id, usuarioId } });
    });
    res.status(204).end();
  });
  return router;
}

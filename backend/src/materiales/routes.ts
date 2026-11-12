import express, { Router } from "express";
import { Prisma, TipoMaterial, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { RuntimeConfig } from "../config.js";
import { requireAuth, csrfProtection } from "../auth/middleware.js";
import { HttpError } from "../errors.js";
import { extractPdf, maxInput, validatePdf } from "../resumenes/pdf.js";
import { createExam } from "./exam.js";

const metadata = z
  .object({
    titulo: z.string().trim().min(1, "Ingresá un título.").max(200),
    materiaId: z.uuid("Materia inválida.").optional(),
  })
  .strict();

const textInput = metadata.extend({
  contenido: z.string().trim().min(1, "Ingresá contenido.").max(4000),
});
const pdfInput = metadata.extend({
  nombreArchivo: z
    .string()
    .min(5)
    .max(200)
    .regex(
      /^[^\p{Cc}\\/]+\.pdf$/iu,
      "El nombre debe corresponder a un archivo PDF.",
    ),
});
const selection = {
  id: true,
  titulo: true,
  tipo: true,
  nombreArchivo: true,
  tamanoBytes: true,
  materia: { select: { id: true, nombre: true } },
} satisfies Prisma.MaterialSelect;

export function materialesRoutes(db: PrismaClient, config: RuntimeConfig) {
  const router = Router();
  const csrf = csrfProtection(config);
  router.use(requireAuth(db, config));

  async function save(
    usuarioId: string,
    input: Omit<Prisma.MaterialUncheckedCreateInput, "usuarioId">,
  ) {
    return db.$transaction(async (tx) => {
      if (input.materiaId) {
        // Coordina con la eliminación de materias, que bloquea la misma fila.
        const owned = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Materia"
          WHERE id = ${input.materiaId}::uuid AND "usuarioId" = ${usuarioId}::uuid FOR KEY SHARE`;
        if (!owned.length) throw new HttpError(404, "Materia no encontrada.");
      }
      return tx.material.create({
        data: { ...input, usuarioId },
        select: selection,
      });
    });
  }

  router.get("/", async (req, res) => {
    const materiales = await db.material.findMany({
      where: { usuarioId: req.usuario!.id },
      select: selection,
      orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
    });
    res.json({ materiales });
  });

  router.post("/:id/simulacro", csrf, async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const material = await db.material.findFirst({
      where: { id, usuarioId: req.usuario!.id },
      select: { titulo: true, contenido: true, archivoPdf: true },
    });
    if (!material) throw new HttpError(404, "Material no encontrado.");
    const text =
      material.contenido?.slice(0, maxInput).trim() ||
      (material.archivoPdf ? await extractPdf(material.archivoPdf) : "");
    res.json({ titulo: material.titulo, preguntas: createExam(text) });
  });

  router.post("/", csrf, async (req, res) => {
    const input = textInput.parse(req.body);
    const material = await save(req.usuario!.id, {
      ...input,
      tipo: TipoMaterial.TEXTO,
    });
    res.status(201).json({ material });
  });

  router.post(
    "/pdf",
    csrf,
    express.raw({
      type: "application/pdf",
      limit: 5 * 1024 * 1024,
      inflate: false,
    }),
    async (req, res) => {
      if (!req.is("application/pdf"))
        throw new HttpError(415, "Enviá un archivo PDF.");
      const input = pdfInput.parse(req.query);
      const file: unknown = req.body;
      if (
        !Buffer.isBuffer(file) ||
        !/^%PDF-[12]\.\d[\r\n]/.test(file.subarray(0, 9).toString("latin1")) ||
        !/%%EOF[\s\0]*$/.test(file.subarray(-1024).toString("latin1"))
      ) {
        throw new HttpError(
          400,
          "El archivo no tiene un encabezado y cierre PDF válidos.",
        );
      }
      await validatePdf(file);
      const material = await save(req.usuario!.id, {
        ...input,
        tipo: TipoMaterial.PDF,
        archivoPdf: Uint8Array.from(file),
        mimeType: "application/pdf",
        tamanoBytes: file.length,
      });
      res.status(201).json({ material });
    },
  );

  router.get("/:id", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const material = await db.material.findFirst({
      where: { id, usuarioId: req.usuario!.id },
      select: { ...selection, contenido: true },
    });
    if (!material) throw new HttpError(404, "Material no encontrado.");
    res.json({ material });
  });

  router.get("/:id/pdf", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const material = await db.material.findFirst({
      where: { id, usuarioId: req.usuario!.id, tipo: TipoMaterial.PDF },
      select: { archivoPdf: true, nombreArchivo: true },
    });
    if (!material?.archivoPdf)
      throw new HttpError(404, "Archivo no encontrado.");
    res.attachment(material.nombreArchivo ?? "material.pdf");
    res.type("application/pdf").send(Buffer.from(material.archivoPdf));
  });

  return router;
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { csrfProtection, requireAuth } from "../auth/middleware.js";
import type { RuntimeConfig } from "../config.js";
import { HttpError } from "../errors.js";
import { extractPdf, maxInput } from "./pdf.js";
import {
  createSummaryProvider,
  generateSummary,
  type SummaryProvider,
} from "./provider.js";

const draftSchema = z.object({
  materialId: z.uuid(),
  contenido: z.string().trim().min(1).max(4000),
  creadoEn: z.iso.datetime(),
});
const saveSchema = z
  .object({
    borrador: z
      .string()
      .max(20000)
      .regex(/^[\w-]+\.[a-f0-9]{64}$/),
  })
  .strict();
const selection = {
  id: true,
  creadoEn: true,
  material: { select: { id: true, titulo: true } },
} satisfies Prisma.ResumenSelect;
const detailSelection = { ...selection, contenido: true };
const missing = () => new HttpError(404, "Material o resumen no encontrado.");
const duplicate = () =>
  new HttpError(409, "El material ya tiene un resumen guardado.");
const invalidDraft = () =>
  new HttpError(400, "El borrador venció o no es válido. Volvé a generarlo.");

export function resumenesRoutes(
  db: PrismaClient,
  config: RuntimeConfig,
  provider = createSummaryProvider(config),
  timeoutMs = config.AI_PROVIDER === "ollama" ? 90000 : 15000,
) {
  const router = Router();
  const csrf = csrfProtection(config);
  const running = new Set<string>();

  function sign(sessionId: string, payload: string) {
    return createHmac("sha256", config.SESSION_SECRET)
      .update("aulasync-resumen-v1:" + sessionId + ":" + payload)
      .digest();
  }

  router.use(
    ["/resumenes", "/materiales/:materialId/resumen"],
    requireAuth(db, config),
  );

  router.get("/resumenes", async (req, res) => {
    const resumenes = await db.resumen.findMany({
      where: { material: { usuarioId: req.usuario!.id } },
      select: selection,
      orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
    });
    res.json({ resumenes });
  });

  router.get("/resumenes/:id", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const resumen = await db.resumen.findFirst({
      where: { id, material: { usuarioId: req.usuario!.id } },
      select: detailSelection,
    });
    if (!resumen) throw missing();
    res.json({ resumen });
  });

  router.get("/materiales/:materialId/resumen", async (req, res) => {
    const materialId = z.uuid().parse(req.params.materialId);
    const resumen = await db.resumen.findFirst({
      where: { materialId, material: { usuarioId: req.usuario!.id } },
      select: detailSelection,
    });
    if (!resumen) throw missing();
    res.json({ resumen });
  });

  router.post(
    "/materiales/:materialId/resumen/generar",
    csrf,
    async (req, res) => {
      const materialId = z.uuid().parse(req.params.materialId);
      const material = await db.material.findFirst({
        where: { id: materialId, usuarioId: req.usuario!.id },
        select: {
          tipo: true,
          contenido: true,
          archivoPdf: true,
          resumen: { select: { id: true } },
        },
      });
      if (!material) throw missing();
      if (material.resumen) throw duplicate();
      if (!provider)
        throw new HttpError(
          503,
          "La generación de resúmenes no está configurada.",
        );
      if (running.has(materialId))
        throw new HttpError(409, "Ya se está procesando este material.");
      if (running.size >= 4)
        throw new HttpError(
          429,
          "Hay varias generaciones en curso. Intentá nuevamente.",
        );
      running.add(materialId);
      try {
        const stored = material.contenido?.slice(0, maxInput).trim();
        const text =
          stored ||
          (material.tipo === "PDF" && material.archivoPdf
            ? await extractPdf(material.archivoPdf)
            : "");
        if (!text)
          throw new HttpError(
            422,
            "El material no contiene texto procesable. Los PDF escaneados requieren una capa de texto.",
          );
        const contenido = await generateSummary(provider, text, timeoutMs);
        const creadoEn = new Date().toISOString();
        const payload = Buffer.from(
          JSON.stringify({ materialId, contenido, creadoEn }),
        ).toString("base64url");
        const borrador =
          payload + "." + sign(req.sessionID, payload).toString("hex");
        res.json({
          contenido,
          creadoEn,
          borrador,
          simulado: provider.simulated,
        });
      } finally {
        running.delete(materialId);
      }
    },
  );

  router.post("/materiales/:materialId/resumen", csrf, async (req, res) => {
    const materialId = z.uuid().parse(req.params.materialId);
    const material = await db.material.findFirst({
      where: { id: materialId, usuarioId: req.usuario!.id },
      select: { id: true },
    });
    if (!material) throw missing();
    const { borrador } = saveSchema.parse(req.body);
    const [payload, signature] = borrador.split(".");
    if (
      !timingSafeEqual(
        sign(req.sessionID, payload),
        Buffer.from(signature, "hex"),
      )
    )
      throw invalidDraft();
    const draft = draftSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    const age = Date.now() - Date.parse(draft.creadoEn);
    if (draft.materialId !== materialId || age < 0 || age > 15 * 60 * 1000)
      throw invalidDraft();
    try {
      const resumen = await db.resumen.create({
        data: {
          materialId,
          contenido: draft.contenido,
          creadoEn: new Date(draft.creadoEn),
        },
        select: detailSelection,
      });
      res.status(201).json({ resumen });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw duplicate();
        if (error.code === "P2003") throw missing();
      }
      throw error;
    }
  });

  return router;
}

export type { SummaryProvider };

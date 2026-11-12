import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

// Fixture local; no habilita cuentas ni endpoints de autenticación.
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV !== "development")
    throw new Error(
      "El seed requiere NODE_ENV=development y una base local de prueba.",
    );
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    target.pathname !== "/aulasync_dev"
  ) {
    throw new Error("El seed solo se permite en aulasync_dev local.");
  }
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 16)
    throw new Error(
      "Configurar SEED_PASSWORD local de al menos 16 caracteres.",
    );
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `scrypt$16384$8$1$${salt}$${scryptSync(seedPassword, salt, 64).toString("hex")}`;
  await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.upsert({
      where: { email: "estudiante@example.test" },
      update: {},
      create: {
        nombre: "Estudiante de prueba",
        email: "estudiante@example.test",
        passwordHash,
      },
    });
    const materia = await tx.materia.upsert({
      where: { id: "20000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "20000000-0000-4000-8000-000000000001",
        nombre: "Metodología en Sistemas",
        usuarioId: usuario.id,
      },
    });
    await tx.actividad.upsert({
      where: { id: "30000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "30000000-0000-4000-8000-000000000001",
        titulo: "Revisar historias de usuario",
        tipo: "TAREA",
        fecha: new Date("2026-11-20T00:00:00Z"),
        materiaId: materia.id,
      },
    });
    const material = await tx.material.upsert({
      where: { id: "40000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "40000000-0000-4000-8000-000000000001",
        titulo: "Apunte de prueba",
        tipo: "TEXTO",
        contenido:
          "Una historia de usuario expresa una necesidad desde la perspectiva de quien usa el sistema.",
        usuarioId: usuario.id,
        materiaId: materia.id,
      },
    });
    await tx.resumen.upsert({
      where: { materialId: material.id },
      update: {},
      create: {
        materialId: material.id,
        contenido:
          "Fixture de prueba escrito manualmente: una historia de usuario representa una necesidad del usuario. No fue generado por IA.",
      },
    });
  });
  console.info(
    "Fixtures locales preparadas. La interfaz no consume estos datos en Sprint 1.",
  );
}
main()
  .catch(() => {
    console.error(
      "No se pudo completar el seed. Verificá entorno, conexión y migraciones.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

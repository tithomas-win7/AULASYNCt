import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;
type DatabaseCounts = [number, number, number, number, number];
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

async function counts(): Promise<DatabaseCounts> {
  return Promise.all([
    prisma.usuario.count(),
    prisma.materia.count(),
    prisma.actividad.count(),
    prisma.material.count(),
    prisma.resumen.count(),
  ]);
}
async function fixture(tx: Tx) {
  const usuario = await tx.usuario.create({
    data: {
      nombre: "Fixture relacional",
      email: randomUUID() + "@example.test",
      passwordHash: "fixture-inutilizable-para-login",
    },
  });
  const materia = await tx.materia.create({
    data: { nombre: "Materia de prueba", usuarioId: usuario.id },
  });
  const actividad = await tx.actividad.create({
    data: {
      titulo: "Actividad de prueba",
      tipo: "TAREA",
      fecha: new Date("2026-11-06T00:00:00Z"),
      materiaId: materia.id,
    },
  });
  const material = await tx.material.create({
    data: {
      titulo: "Material de prueba",
      tipo: "TEXTO",
      contenido: "Contenido de fixture",
      usuarioId: usuario.id,
      materiaId: materia.id,
    },
  });
  const resumen = await tx.resumen.create({
    data: { contenido: "Resumen de fixture", materialId: material.id },
  });
  return { usuario, materia, actividad, material, resumen };
}
async function rejectsConstraint(
  operation: () => Promise<unknown>,
  code: string,
) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code,
  );
}

const cases: { name: string; run: (tx: Tx) => Promise<void> }[] = [
  {
    name: "Las cinco entidades se relacionan y pueden consultarse con Prisma",
    run: async (tx) => {
      const f = await fixture(tx);
      const result = await tx.usuario.findUniqueOrThrow({
        where: { id: f.usuario.id },
        include: {
          materias: { include: { actividades: true } },
          materiales: { include: { resumen: true } },
        },
      });
      assert.equal(result.materias[0].actividades[0].id, f.actividad.id);
      assert.equal(result.materiales[0].resumen?.id, f.resumen.id);
      assert.equal(result.materiales[0].materiaId, f.materia.id);
    },
  },
  {
    name: "Un material puede no tener materia",
    run: async (tx) => {
      const f = await fixture(tx);
      const material = await tx.material.create({
        data: {
          titulo: "Sin materia",
          tipo: "TEXTO",
          contenido: "Texto",
          usuarioId: f.usuario.id,
        },
      });
      assert.equal(material.materiaId, null);
    },
  },
  {
    name: "Email duplicado rechazado",
    run: async (tx) => {
      const f = await fixture(tx);
      await rejectsConstraint(
        () =>
          tx.usuario.create({
            data: {
              nombre: "Duplicado",
              email: f.usuario.email,
              passwordHash: "fixture-inutilizable-para-login",
            },
          }),
        "P2002",
      );
    },
  },
  {
    name: "Segundo resumen del mismo material rechazado",
    run: async (tx) => {
      const f = await fixture(tx);
      await rejectsConstraint(
        () =>
          tx.resumen.create({
            data: { contenido: "Duplicado", materialId: f.material.id },
          }),
        "P2002",
      );
    },
  },
  {
    name: "Material asociado a materia de otro propietario rechazado",
    run: async (tx) => {
      const f = await fixture(tx);
      const other = await tx.usuario.create({
        data: {
          nombre: "Otro",
          email: randomUUID() + "@example.test",
          passwordHash: "fixture-inutilizable-para-login",
        },
      });
      await rejectsConstraint(
        () =>
          tx.material.create({
            data: {
              titulo: "Asociacion invalida",
              tipo: "TEXTO",
              usuarioId: other.id,
              materiaId: f.materia.id,
            },
          }),
        "P2003",
      );
    },
  },
  {
    name: "Materia con usuario inexistente rechazada",
    run: async (tx) => {
      await rejectsConstraint(
        () =>
          tx.materia.create({
            data: { nombre: "Invalida", usuarioId: randomUUID() },
          }),
        "P2003",
      );
    },
  },
  {
    name: "Actividad con materia inexistente rechazada",
    run: async (tx) => {
      await rejectsConstraint(
        () =>
          tx.actividad.create({
            data: {
              titulo: "Invalida",
              tipo: "EXAMEN",
              fecha: new Date(),
              materiaId: randomUUID(),
            },
          }),
        "P2003",
      );
    },
  },
  {
    name: "Material con usuario inexistente rechazado",
    run: async (tx) => {
      await rejectsConstraint(
        () =>
          tx.material.create({
            data: {
              titulo: "Invalido",
              tipo: "TEXTO",
              usuarioId: randomUUID(),
            },
          }),
        "P2003",
      );
    },
  },
  {
    name: "Material con materia inexistente rechazado",
    run: async (tx) => {
      const f = await fixture(tx);
      await rejectsConstraint(
        () =>
          tx.material.create({
            data: {
              titulo: "Invalido",
              tipo: "TEXTO",
              usuarioId: f.usuario.id,
              materiaId: randomUUID(),
            },
          }),
        "P2003",
      );
    },
  },
  {
    name: "Resumen con material inexistente rechazado",
    run: async (tx) => {
      await rejectsConstraint(
        () =>
          tx.resumen.create({
            data: { contenido: "Invalido", materialId: randomUUID() },
          }),
        "P2003",
      );
    },
  },
  {
    name: "NoAction bloquea borrar una materia con materiales asociados",
    run: async (tx) => {
      const f = await fixture(tx);
      await rejectsConstraint(
        () => tx.materia.delete({ where: { id: f.materia.id } }),
        "P2003",
      );
    },
  },
  {
    name: "Borrar material elimina su resumen en cascada",
    run: async (tx) => {
      const f = await fixture(tx);
      await tx.material.delete({ where: { id: f.material.id } });
      assert.equal(
        await tx.resumen.findUnique({ where: { id: f.resumen.id } }),
        null,
      );
      assert.notEqual(
        await tx.usuario.findUnique({ where: { id: f.usuario.id } }),
        null,
      );
    },
  },
  {
    name: "Desvincular materiales permite borrar materia y sus actividades",
    run: async (tx) => {
      const f = await fixture(tx);
      await tx.material.update({
        where: { id: f.material.id },
        data: { materiaId: null },
      });
      await tx.materia.delete({ where: { id: f.materia.id } });
      assert.equal(
        await tx.actividad.findUnique({ where: { id: f.actividad.id } }),
        null,
      );
      assert.equal(
        (await tx.material.findUniqueOrThrow({ where: { id: f.material.id } }))
          .materiaId,
        null,
      );
      assert.notEqual(
        await tx.resumen.findUnique({ where: { id: f.resumen.id } }),
        null,
      );
    },
  },
  {
    name: "Borrar usuario elimina sus cuatro entidades dependientes",
    run: async (tx) => {
      const f = await fixture(tx);
      await tx.usuario.delete({ where: { id: f.usuario.id } });
      assert.equal(
        await tx.materia.findUnique({ where: { id: f.materia.id } }),
        null,
      );
      assert.equal(
        await tx.actividad.findUnique({ where: { id: f.actividad.id } }),
        null,
      );
      assert.equal(
        await tx.material.findUnique({ where: { id: f.material.id } }),
        null,
      );
      assert.equal(
        await tx.resumen.findUnique({ where: { id: f.resumen.id } }),
        null,
      );
    },
  },
];

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  assert.equal(process.env.NODE_ENV, "test", "Requiere entorno de pruebas");
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Requiere host local",
  );
  assert.equal(url.pathname, "/aulasync_test", "Solo se permite aulasync_test");
  const identity = await prisma.$queryRaw<
    { database: string; role: string; superuser: boolean }[]
  >`SELECT current_database() AS database, current_user AS role, rolsuper AS superuser FROM pg_roles WHERE rolname = current_user`;
  assert.equal(identity[0].database, "aulasync_test");
  assert.equal(identity[0].role, "aulasync_test_app");
  assert.equal(identity[0].superuser, false);
  const before = await counts();
  console.log(
    "Conexion Prisma verificada: aulasync_test, rol de aplicacion sin privilegios de superusuario.",
  );
  for (const test of cases) {
    const rollback = new Error("ROLLBACK_DE_FIXTURES");
    try {
      await prisma.$transaction(
        async (tx) => {
          await test.run(tx);
          throw rollback;
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (error !== rollback) {
        console.error("FALLO: " + test.name);
        throw error;
      }
    }
    console.log("OK: " + test.name);
  }
  const after = await counts();
  assert.deepEqual(
    after,
    before,
    "Las pruebas no deben modificar datos persistentes",
  );
  console.log(
    "14 comprobaciones relacionales aprobadas. Fixtures revertidas; conteos conservados: " +
      after.join(", "),
  );
}
main()
  .catch(() => {
    console.error(
      "Verificacion fallida; se detiene sin mostrar credenciales. Revisar antes de continuar.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

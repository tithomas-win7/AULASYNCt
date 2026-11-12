import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = parse(readFileSync(resolve(root, "backend/.env")));
const target = new URL(env.DATABASE_URL);
const origin = env.APP_ORIGIN ?? "http://127.0.0.1:5173";
if (
  env.NODE_ENV !== "development" ||
  target.pathname !== "/aulasync_dev" ||
  target.hostname !== "127.0.0.1" ||
  origin !== "http://127.0.0.1:5173"
) {
  console.error(
    "Smoke limitado a aulasync_dev y a la interfaz local 127.0.0.1:5173.",
  );
  process.exit(1);
}
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const emails = [
  "smoke-" + randomUUID() + "@example.test",
  "smoke-" + randomUUID() + "@example.test",
];
const password = randomBytes(24).toString("hex");
const sessionIds = new Set();
let steps = 0;
function client() {
  return {
    cookie: "",
    token: "",
    async send(path, method = "GET", body, expected = 200, csrf = this.token) {
      const response = await fetch(origin + "/api" + path, {
        method,
        signal: AbortSignal.timeout(10000),
        headers: {
          Cookie: this.cookie,
          Origin: origin,
          "X-CSRF-Token": csrf,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      for (const header of response.headers.getSetCookie()) {
        this.cookie = header.split(";")[0];
        const value = decodeURIComponent(
          this.cookie.slice(this.cookie.indexOf("=") + 1),
        );
        if (value.startsWith("s:"))
          sessionIds.add(value.slice(2).split(".")[0]);
      }
      assert.equal(response.status, expected, method + " " + path);
      steps++;
      const data = response.status === 204 ? null : await response.json();
      if (data?.csrfToken) this.token = data.csrfToken;
      return data;
    },
  };
}
async function snapshot() {
  return Promise.all([
    db.usuario.findMany({ orderBy: { id: "asc" } }),
    db.materia.findMany({ orderBy: { id: "asc" } }),
    db.actividad.findMany({ orderBy: { id: "asc" } }),
    db.material.findMany({ orderBy: { id: "asc" } }),
    db.resumen.findMany({ orderBy: { id: "asc" } }),
  ]);
}
async function main() {
  const before = await snapshot();
  assert.equal(await db.usuario.count({ where: { email: { in: emails } } }), 0);
  try {
    const a = client(),
      b = client();
    const health = await a.send("/health");
    assert.equal(health.sprint, 2);
    await a.send("/auth/session");
    await a.send(
      "/auth/register",
      "POST",
      { nombre: "Smoke A", email: emails[0], password },
      201,
    );
    await b.send("/auth/session");
    await b.send(
      "/auth/register",
      "POST",
      { nombre: "Smoke B", email: emails[1], password },
      201,
    );
    assert.equal((await a.send("/materias")).materias.length, 0);
    const created = await a.send(
      "/materias",
      "POST",
      { nombre: "Materia de smoke", descripcion: "Sólo prueba temporal" },
      201,
    );
    const id = created.materia.id;
    assert.equal((await a.send("/materias")).materias.length, 1);
    assert.equal((await b.send("/materias")).materias.length, 0);
    await b.send("/materias/" + id, "GET", undefined, 404);
    await b.send("/materias/" + id, "PATCH", { nombre: "Ajena" }, 404);
    await b.send("/materias/" + id, "DELETE", undefined, 404);
    await a.send("/materias", "POST", { nombre: "Sin CSRF" }, 403, "");
    const changed = await a.send("/materias/" + id, "PATCH", {
      nombre: "Materia editada",
      descripcion: "Modificada",
    });
    assert.equal(changed.materia.nombre, "Materia editada");
    await a.send("/materias/" + id, "DELETE", undefined, 204);
    const restored = client();
    restored.cookie = a.cookie;
    assert.equal(
      (await restored.send("/auth/session")).usuario.email,
      emails[0],
    );
    const oldCookie = a.cookie;
    await a.send("/auth/logout", "POST", undefined, 204);
    const revoked = client();
    revoked.cookie = oldCookie;
    await revoked.send("/materias", "GET", undefined, 401);
    await a.send("/auth/session");
    await a.send("/auth/login", "POST", {
      email: emails[0].toUpperCase(),
      password,
    });
    await a.send("/materias");
    await a.send("/auth/logout", "POST", undefined, 204);
    await b.send("/auth/logout", "POST", undefined, 204);
    for (const file of [
      ".local/postgres.env",
      "backend/.env",
      "backend/src/config.ts",
    ]) {
      const response = await fetch(
        origin + "/@fs/" + root.replaceAll("\\", "/") + "/" + file,
      );
      assert.equal(
        response.status,
        403,
        "Los archivos privados no deben servirse por Vite",
      );
      steps++;
    }
    for (const page of ["/login", "/registro", "/materias"]) {
      const response = await fetch(origin + page);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes('id="root"'));
      steps++;
    }
  } finally {
    // Estos emails y SIDs fueron generados por esta ejecución y no existían antes.
    await db.sesion.deleteMany({ where: { sid: { in: [...sessionIds] } } });
    await db.usuario.deleteMany({ where: { email: { in: emails } } });
  }
  assert.deepEqual(
    await snapshot(),
    before,
    "Se deben conservar los registros previos al smoke",
  );
  writeFileSync(
    resolve(root, ".local/sprint2-smoke.json"),
    JSON.stringify(
      {
        passed: true,
        steps,
        existingRecordsPreserved: true,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "Smoke HTTP a través de Vite aprobado: " +
      steps +
      " pasos. Cookies, CSRF, registro, login/logout, CRUD y aislamiento verificados; datos previos conservados.",
  );
}
main()
  .catch(() => {
    console.error(
      "Smoke fallido. Revisar servidores y pruebas sin mostrar credenciales.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

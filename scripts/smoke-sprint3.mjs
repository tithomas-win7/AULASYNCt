import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
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
let address;
function client() {
  return {
    cookie: "",
    token: "",
    async send(path, method = "GET", body, expected = 200, csrf = this.token) {
      const response = await fetch(address + "/api" + path, {
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
async function start() {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { createApp } from "./dist/app.js";
    import { parseRuntimeEnvironment } from "./dist/config.js";
    import { createDatabase } from "./dist/db.js";
    const config = parseRuntimeEnvironment(process.env);
    const db = createDatabase(config);
    await db.$connect();
    const server = createApp({ db, config }).listen(0, "127.0.0.1", () => {
      process.send(server.address().port);
    });
  `,
    ],
    {
      cwd: resolve(root, "backend"),
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    },
  );
  const timeout = setTimeout(() => child.kill(), 10000);
  try {
    const port = await new Promise((accept, reject) => {
      child.once("message", accept);
      child.once("error", reject);
      child.once("exit", () =>
        reject(new Error("El backend de prueba se detuvo al iniciar.")),
      );
    });
    address = "http://127.0.0.1:" + port;
    return child;
  } finally {
    clearTimeout(timeout);
  }
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill();
  await exited;
}

async function main() {
  const before = await snapshot();
  assert.equal(await db.usuario.count({ where: { email: { in: emails } } }), 0);
  const paths = [];
  const clients = [client(), client()];
  const expected = [];
  let child;
  try {
    child = await start();
    for (let index = 0; index < clients.length; index++) {
      const student = clients[index];
      await student.send("/auth/session");
      await student.send(
        "/auth/register",
        "POST",
        { nombre: "HU-04 estudiante " + index, email: emails[index], password },
        201,
      );
      const { materia } = await student.send(
        "/materias",
        "POST",
        { nombre: "HU-04 materia " + index },
        201,
      );
      const path = "/materias/" + materia.id + "/actividades";
      paths.push(path);
      const data = {
        titulo: "Actividad " + index,
        tipo: index === 0 ? "TAREA" : "EXAMEN",
        fecha: index === 0 ? "2000-01-01" : "2028-02-29",
      };
      const { actividad } = await student.send(path, "POST", data, 201);
      assert.equal(actividad.materiaId, materia.id);
      assert.equal(actividad.fecha, data.fecha);
      expected.push(actividad);
    }
    await clients[0].send(paths[1], "GET", undefined, 404);
    await clients[1].send(
      paths[0],
      "POST",
      { titulo: "Ajena", tipo: "TAREA", fecha: "2028-02-29" },
      404,
    );
    await stop(child);
    child = await start();
    for (let index = 0; index < clients.length; index++) {
      const { actividades } = await clients[index].send(paths[index]);
      assert.deepEqual(actividades, [expected[index]]);
    }
    await clients[0].send(paths[1], "GET", undefined, 404);
    await clients[1].send(
      paths[0],
      "POST",
      { titulo: "Ajena", tipo: "TAREA", fecha: "2028-02-29" },
      404,
    );
  } finally {
    await stop(child);
    await db.sesion.deleteMany({ where: { sid: { in: [...sessionIds] } } });
    await db.usuario.deleteMany({ where: { email: { in: emails } } });
  }
  assert.deepEqual(
    await snapshot(),
    before,
    "Los registros previos deben quedar intactos.",
  );
  writeFileSync(
    resolve(root, ".local/sprint3-smoke.json"),
    JSON.stringify(
      { passed: true, steps, restart: true, preserved: true },
      null,
      2,
    ),
  );
  console.log(
    "HU-04: " +
      steps +
      " pasos HTTP aprobados. Aislamiento, reinicio del backend y conservación de datos verificados.",
  );
}
main()
  .catch((error) => {
    console.error(
      "Falló el recorrido HU-04:",
      error instanceof assert.AssertionError
        ? error.message.split("\n")[0]
        : error.name,
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

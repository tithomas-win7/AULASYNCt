import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "./app.js";
import { createDatabase } from "./db.js";
import { testConfig as config, testDb as db } from "./test/context.js";

const app = createApp({ db, config, attemptLimit: 1000 });
const users = new Set<string>();
const sessions = new Set<string>();
const password = randomBytes(24).toString("hex");
const newEmail = () => "sprint2-" + randomUUID() + "@example.test";
function cookie(response: request.Response) {
  const values = response.headers["set-cookie"] as unknown as
    string[] | undefined;
  const value = values?.[0]?.split(";")[0] ?? "";
  if (value) {
    const sid = decodeURIComponent(value.slice(value.indexOf("=") + 1))
      .slice(2)
      .split(".")[0];
    sessions.add(sid);
  }
  return value;
}
function sid(value: string) {
  return decodeURIComponent(value.slice(value.indexOf("=") + 1))
    .slice(2)
    .split(".")[0];
}
async function anonymous(target = app) {
  const agent = request.agent(target);
  const response = await agent.get("/api/auth/session");
  expect(response.status).toBe(200);
  return {
    agent,
    token: response.body.csrfToken as string,
    cookie: cookie(response),
  };
}
async function register(target = app) {
  const client = await anonymous(target);
  const email = newEmail();
  const response = await client.agent
    .post("/api/auth/register")
    .set("Origin", config.APP_ORIGIN)
    .set("X-CSRF-Token", client.token)
    .send({ nombre: "Estudiante de prueba", email, password });
  expect(response.status).toBe(201);
  users.add(response.body.usuario.id);
  return {
    ...client,
    previousCookie: client.cookie,
    previousToken: client.token,
    cookie: cookie(response),
    token: response.body.csrfToken as string,
    usuario: response.body.usuario as {
      id: string;
      nombre: string;
      email: string;
    },
  };
}
beforeAll(async () => {
  const identity = await db.$queryRaw<
    { database: string; role: string }[]
  >`SELECT current_database() AS database, current_user AS role`;
  expect(identity[0]).toEqual({
    database: "aulasync_test",
    role: "aulasync_test_app",
  });
});
afterAll(async () => {
  // Se borran exclusivamente IDs creados por esta suite, nunca datos preexistentes.
  await db.sesion.deleteMany({ where: { sid: { in: [...sessions] } } });
  await db.usuario.deleteMany({ where: { id: { in: [...users] } } });
  await db.$disconnect();
});

describe.sequential("Sprint 2 sobre PostgreSQL real", () => {
  it("registra, normaliza nombre/correo y no expone el hash", async () => {
    const client = await anonymous();
    const email = newEmail();
    const response = await client.agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", client.token)
      .send({
        nombre: "  Ana Pérez  ",
        email: "  " + email.toUpperCase() + "  ",
        password,
      });
    expect(response.status).toBe(201);
    users.add(response.body.usuario.id);
    cookie(response);
    expect(response.body.usuario).toEqual({
      id: expect.any(String),
      nombre: "Ana Pérez",
      email,
    });
    expect(response.body.usuario.passwordHash).toBeUndefined();
    const user = await db.usuario.findUniqueOrThrow({
      where: { id: response.body.usuario.id },
    });
    expect(
      user.passwordHash.startsWith("scrypt$32768$") &&
        user.passwordHash !== password,
    ).toBe(true);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("rechaza registro inválido y propietario inyectado", async () => {
    const client = await anonymous();
    const response = await client.agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", client.token)
      .send({ nombre: " ", email: "invalido", password: "x" });
    expect(response.status).toBe(400);
    expect(response.body.fields).toHaveProperty("nombre");
    expect(response.body.fields).toHaveProperty("email");
    expect(response.body.fields).toHaveProperty("password");
    expect(
      (
        await client.agent
          .post("/api/auth/register")
          .set("X-CSRF-Token", client.token)
          .send({
            nombre: "Ana",
            email: newEmail(),
            password,
            usuarioId: randomUUID(),
          })
      ).status,
    ).toBe(400);
  });
  it("rechaza correos duplicados aun con espacios y mayúsculas", async () => {
    const first = await register();
    const second = await anonymous();
    const response = await second.agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", second.token)
      .send({
        nombre: "Otro estudiante",
        email: " " + first.usuario.email.toUpperCase() + " ",
        password,
      });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/correo/);
  });
  it("rota sesión y CSRF al autenticar, con cookies HttpOnly y SameSite", async () => {
    const client = await register();
    expect(client.cookie !== client.previousCookie).toBe(true);
    const row = await db.sesion.findUniqueOrThrow({
      where: { sid: sid(client.cookie) },
    });
    expect((row.datos as { usuarioId: string }).usuarioId).toBe(
      client.usuario.id,
    );
    expect(
      await db.sesion.findUnique({
        where: { sid: sid(client.previousCookie) },
      }),
    ).toBeNull();
    const session = await client.agent.get("/api/auth/session");
    expect(session.body.usuario.id).toBe(client.usuario.id);
    const raw = (
      session.headers["set-cookie"] as unknown as string[] | undefined
    )?.[0];
    // El contrato real de cookies también se comprueba sobre una sesión anónima nueva.
    const fresh = await request(app).get("/api/auth/session");
    cookie(fresh);
    const header = (fresh.headers["set-cookie"] as unknown as string[])[0];
    expect(
      header.includes("HttpOnly") &&
        header.includes("SameSite=Lax") &&
        !header.includes("; Secure"),
    ).toBe(true);
    expect(raw === undefined || raw.includes("HttpOnly")).toBe(true);
  });
  it("inicia sesión con correo normalizado y cierra invalidando la cookie anterior", async () => {
    const registered = await register();
    expect(
      (
        await registered.agent
          .post("/api/auth/logout")
          .set("X-CSRF-Token", registered.token)
      ).status,
    ).toBe(204);
    expect(
      (await request(app).get("/api/materias").set("Cookie", registered.cookie))
        .status,
    ).toBe(401);
    const client = await anonymous();
    const login = await client.agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", client.token)
      .send({
        email: " " + registered.usuario.email.toUpperCase() + " ",
        password,
      });
    expect(login.status).toBe(200);
    const authenticatedCookie = cookie(login);
    expect(login.body.usuario.id).toBe(registered.usuario.id);
    expect((await client.agent.get("/api/materias")).status).toBe(200);
    expect(
      (
        await client.agent
          .post("/api/auth/logout")
          .set("X-CSRF-Token", login.body.csrfToken)
      ).status,
    ).toBe(204);
    expect(
      await db.sesion.findUnique({ where: { sid: sid(authenticatedCookie) } }),
    ).toBeNull();
    expect(
      (
        await request(app)
          .get("/api/materias")
          .set("Cookie", authenticatedCookie)
      ).status,
    ).toBe(401);
  });
  it("rechaza credenciales incorrectas sin distinguir si existe el correo", async () => {
    const registered = await register();
    const client = await anonymous();
    const bad = await client.agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", client.token)
      .send({ email: registered.usuario.email, password: password + "x" });
    const missing = await client.agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", client.token)
      .send({ email: newEmail(), password });
    expect(bad.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(bad.body).toEqual(missing.body);
    expect(
      (await client.agent.get("/api/auth/session")).body.usuario,
    ).toBeNull();
  });
  it("protege todas las operaciones de materias sin autenticación", async () => {
    const id = randomUUID();
    expect((await request(app).get("/api/materias")).status).toBe(401);
    expect((await request(app).get("/api/materias/" + id)).status).toBe(401);
    expect(
      (await request(app).post("/api/materias").send({ nombre: "Ajena" }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .patch("/api/materias/" + id)
          .send({ nombre: "Ajena" })
      ).status,
    ).toBe(401);
    expect((await request(app).delete("/api/materias/" + id)).status).toBe(401);
    expect((await request(app).post("/api/auth/logout")).status).toBe(401);
  });
  it("completa el CRUD y preserva la descripción en un PATCH de nombre", async () => {
    const client = await register();
    expect((await client.agent.get("/api/materias")).body.materias).toEqual([]);
    const created = await client.agent
      .post("/api/materias")
      .set("X-CSRF-Token", client.token)
      .send({ nombre: "  Álgebra  ", descripcion: "  Vectores  " });
    expect(created.status).toBe(201);
    const id = created.body.materia.id;
    expect(created.body.materia.nombre).toBe("Álgebra");
    expect(created.body.materia.descripcion).toBe("Vectores");
    expect(
      (await client.agent.get("/api/materias")).body.materias,
    ).toHaveLength(1);
    expect(
      (await client.agent.get("/api/materias/" + id)).body.materia.id,
    ).toBe(id);
    const changed = await client.agent
      .patch("/api/materias/" + id)
      .set("X-CSRF-Token", client.token)
      .send({ nombre: "Álgebra II" });
    expect(changed.status).toBe(200);
    expect(changed.body.materia.descripcion).toBe("Vectores");
    const cleared = await client.agent
      .patch("/api/materias/" + id)
      .set("X-CSRF-Token", client.token)
      .send({ descripcion: "" });
    expect(cleared.body.materia.descripcion).toBeNull();
    expect(cleared.body.materia.nombre).toBe("Álgebra II");
    expect(
      (
        await client.agent
          .delete("/api/materias/" + id)
          .set("X-CSRF-Token", client.token)
      ).status,
    ).toBe(204);
    expect((await client.agent.get("/api/materias/" + id)).status).toBe(404);
  });
  it("valida materias, UUID, campos vacíos e intentos de cambiar propietario", async () => {
    const client = await register();
    for (const body of [
      { nombre: " " },
      { nombre: "a".repeat(121) },
      { nombre: "Válida", descripcion: "a".repeat(1001) },
      { nombre: "Válida", usuarioId: randomUUID() },
    ]) {
      expect(
        (
          await client.agent
            .post("/api/materias")
            .set("X-CSRF-Token", client.token)
            .send(body)
        ).status,
      ).toBe(400);
    }
    expect((await client.agent.get("/api/materias/no-es-uuid")).status).toBe(
      400,
    );
    const result = await client.agent
      .post("/api/materias")
      .set("X-CSRF-Token", client.token)
      .send({ nombre: "Válida" });
    expect(
      (
        await client.agent
          .patch("/api/materias/" + result.body.materia.id)
          .set("X-CSRF-Token", client.token)
          .send({})
      ).status,
    ).toBe(400);
  });
  it("aísla lectura, modificación y borrado entre dos estudiantes", async () => {
    const a = await register(),
      b = await register();
    const created = await a.agent
      .post("/api/materias")
      .set("X-CSRF-Token", a.token)
      .send({ nombre: "Sólo de A" });
    const id = created.body.materia.id;
    expect((await b.agent.get("/api/materias")).body.materias).toEqual([]);
    expect((await b.agent.get("/api/materias/" + id)).status).toBe(404);
    expect(
      (
        await b.agent
          .patch("/api/materias/" + id)
          .set("X-CSRF-Token", b.token)
          .send({ nombre: "Ataque" })
      ).status,
    ).toBe(404);
    expect(
      (await b.agent.delete("/api/materias/" + id).set("X-CSRF-Token", b.token))
        .status,
    ).toBe(404);
    expect((await a.agent.get("/api/materias/" + id)).body.materia.nombre).toBe(
      "Sólo de A",
    );
  });
  it("rechaza CSRF ausente, inválido, de otro usuario y orígenes ajenos", async () => {
    const a = await register(),
      b = await register();
    for (const token of ["", "f".repeat(64), "ñ".repeat(64), b.token]) {
      expect(
        (
          await a.agent
            .post("/api/materias")
            .set("X-CSRF-Token", token)
            .send({ nombre: "No crear" })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await a.agent
          .post("/api/materias")
          .set("Origin", "https://evil.example.test")
          .set("X-CSRF-Token", a.token)
          .send({ nombre: "No crear" })
      ).status,
    ).toBe(403);
    expect(
      (
        await a.agent
          .post("/api/materias")
          .set("Sec-Fetch-Site", "cross-site")
          .set("X-CSRF-Token", a.token)
          .send({ nombre: "No crear" })
      ).status,
    ).toBe(403);
    expect((await a.agent.post("/api/auth/logout")).status).toBe(403);
    expect((await a.agent.get("/api/materias")).body.materias).toEqual([]);
  });
  it("protege también registro e inicio de sesión contra CSRF", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .send({ nombre: "Sin token", email: newEmail(), password })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: newEmail(), password })
      ).status,
    ).toBe(403);
  });
  it("protege también la edición y el borrado sin token CSRF", async () => {
    const client = await register();
    const response = await client.agent
      .post("/api/materias")
      .set("X-CSRF-Token", client.token)
      .send({ nombre: "Conservar" });
    const id = response.body.materia.id;
    expect(
      (
        await client.agent
          .patch("/api/materias/" + id)
          .send({ nombre: "No cambiar" })
      ).status,
    ).toBe(403);
    expect((await client.agent.delete("/api/materias/" + id)).status).toBe(403);
    expect(
      (await client.agent.get("/api/materias/" + id)).body.materia.nombre,
    ).toBe("Conservar");
  });
  it("rechaza el CSRF anterior al login y las cookies alteradas", async () => {
    const client = await register();
    expect(
      (
        await client.agent
          .post("/api/materias")
          .set("X-CSRF-Token", client.previousToken)
          .send({ nombre: "No crear" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/materias")
          .set("Cookie", client.cookie + "alterada")
      ).status,
    ).toBe(401);
  });
  it("mantiene correo único ante dos registros concurrentes", async () => {
    const a = await anonymous(),
      b = await anonymous();
    const email = newEmail();
    const responses = await Promise.all([
      a.agent
        .post("/api/auth/register")
        .set("X-CSRF-Token", a.token)
        .send({ nombre: "Concurrente A", email, password }),
      b.agent.post("/api/auth/register").set("X-CSRF-Token", b.token).send({
        nombre: "Concurrente B",
        email: email.toUpperCase(),
        password,
      }),
    ]);
    for (const response of responses) {
      if (response.status === 201) {
        users.add(response.body.usuario.id);
        cookie(response);
      }
    }
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
  });
  it("limita también los intentos repetidos de registro", async () => {
    const limited = createApp({ db, config, attemptLimit: 2 });
    const client = await anonymous(limited);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await client.agent
            .post("/api/auth/register")
            .set("X-CSRF-Token", client.token)
            .send({})
        ).status,
      ).toBe(400);
    expect(
      (
        await client.agent
          .post("/api/auth/register")
          .set("X-CSRF-Token", client.token)
          .send({})
      ).status,
    ).toBe(429);
  });
  it("conserva la sesión al recrear la aplicación y su cliente de base", async () => {
    const client = await register();
    const secondDb = createDatabase(config);
    try {
      const secondApp = createApp({ db: secondDb, config });
      const restored = await request(secondApp)
        .get("/api/auth/session")
        .set("Cookie", client.cookie);
      expect(restored.status).toBe(200);
      cookie(restored);
      expect(restored.body.usuario.id).toBe(client.usuario.id);
    } finally {
      await secondDb.$disconnect();
    }
  });
  it("invalida sesiones vencidas en PostgreSQL", async () => {
    const client = await register();
    await db.sesion.update({
      where: { sid: sid(client.cookie) },
      data: { expiraEn: new Date(Date.now() - 1000) },
    });
    expect(
      (await request(app).get("/api/materias").set("Cookie", client.cookie))
        .status,
    ).toBe(401);
  });
  it("aplica el vencimiento absoluto aunque el registro tenga expiración futura", async () => {
    const client = await register();
    const sessionId = sid(client.cookie);
    const row = await db.sesion.findUniqueOrThrow({
      where: { sid: sessionId },
    });
    const datos = {
      ...(row.datos as object),
      autenticadoEn: Date.now() - 9 * 3600000,
    };
    await db.sesion.update({
      where: { sid: sessionId },
      data: { datos, expiraEn: new Date(Date.now() + 3600000) },
    });
    expect((await client.agent.get("/api/materias")).status).toBe(401);
    const response = await client.agent.get("/api/auth/session");
    cookie(response);
    expect(response.body.usuario).toBeNull();
  });
  it("limita los intentos repetidos de acceso", async () => {
    const limited = createApp({ db, config, attemptLimit: 2 });
    const client = await anonymous(limited);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await client.agent
            .post("/api/auth/login")
            .set("X-CSRF-Token", client.token)
            .send({ email: newEmail(), password })
        ).status,
      ).toBe(401);
    const blocked = await client.agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", client.token)
      .send({ email: newEmail(), password });
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
  it("usa Secure y prefijo __Host cuando hay HTTPS en producción", async () => {
    const production = createApp({
      db,
      config: { ...config, NODE_ENV: "production" },
    });
    // Simula sólo en esta instancia el proxy TLS de confianza.
    production.set("trust proxy", "loopback");
    const response = await request(production)
      .get("/api/auth/session")
      .set("X-Forwarded-Proto", "https");
    cookie(response);
    const header = (response.headers["set-cookie"] as unknown as string[])[0];
    expect(
      header.startsWith("__Host-aulasync.sid=") &&
        header.includes("; Secure") &&
        header.includes("HttpOnly") &&
        header.includes("SameSite=Lax"),
    ).toBe(true);
  });
  it("desvincula materiales y conserva resúmenes al borrar una materia propia", async () => {
    const client = await register();
    const response = await client.agent
      .post("/api/materias")
      .set("X-CSRF-Token", client.token)
      .send({ nombre: "Relaciones de prueba" });
    const id = response.body.materia.id;
    const actividad = await db.actividad.create({
      data: {
        titulo: "Fixture",
        tipo: "TAREA",
        fecha: new Date(),
        materiaId: id,
      },
    });
    const material = await db.material.create({
      data: {
        titulo: "Fixture",
        tipo: "TEXTO",
        contenido: "Sólo para prueba",
        materiaId: id,
        usuarioId: client.usuario.id,
        resumen: { create: { contenido: "Fixture" } },
      },
      include: { resumen: true },
    });
    expect(
      (
        await client.agent
          .delete("/api/materias/" + id)
          .set("X-CSRF-Token", client.token)
      ).status,
    ).toBe(204);
    expect(
      await db.actividad.findUnique({ where: { id: actividad.id } }),
    ).toBeNull();
    expect(
      (await db.material.findUniqueOrThrow({ where: { id: material.id } }))
        .materiaId,
    ).toBeNull();
    expect(
      await db.resumen.findUnique({ where: { id: material.resumen!.id } }),
    ).not.toBeNull();
  });
});

describe.sequential("HU-04 sobre PostgreSQL", () => {
  const valid = {
    titulo: "  Entrega  ",
    tipo: "TRABAJO_PRACTICO",
    fecha: "2028-02-29",
  };
  async function subject(
    client: Pick<Awaited<ReturnType<typeof register>>, "agent" | "token">,
  ) {
    const response = await client.agent
      .post("/api/materias")
      .set("X-CSRF-Token", client.token)
      .send({ nombre: "Materia HU-04" });
    expect(response.status).toBe(201);
    return "/api/materias/" + response.body.materia.id + "/actividades";
  }

  it("crea los tres tipos, conserva fechas y lista sólo la materia ordenada", async () => {
    const client = await register();
    const path = await subject(client);
    const other = await subject(client);
    for (const [tipo, fecha] of [
      ["EXAMEN", "2030-12-31"],
      ["TAREA", "2000-01-01"],
      ["TRABAJO_PRACTICO", valid.fecha],
      ["TAREA", valid.fecha],
    ]) {
      const created = await client.agent
        .post(path)
        .set("X-CSRF-Token", client.token)
        .send({ ...valid, tipo, fecha });
      expect(created.status).toBe(201);
      expect(created.body.actividad).toMatchObject({
        tipo,
        fecha,
        titulo: "Entrega",
      });
      expect(
        await db.actividad.findUnique({
          where: { id: created.body.actividad.id },
        }),
      ).not.toBeNull();
    }
    const response = await client.agent.get(path);
    expect(response.status).toBe(200);
    const items = response.body.actividades as { id: string; fecha: string }[];
    expect(items.map((item) => item.fecha)).toEqual([
      "2000-01-01",
      valid.fecha,
      valid.fecha,
      "2030-12-31",
    ]);
    expect(items[1].id < items[2].id).toBe(true);
    expect((await client.agent.get(other)).body).toEqual({ actividades: [] });
  });

  it("rechaza título, tipo, fecha e identificadores manipulados", async () => {
    const client = await register();
    const path = await subject(client);
    for (const changes of [
      { titulo: "" },
      { titulo: "   " },
      { titulo: "x".repeat(201) },
      { tipo: "PROYECTO" },
      { fecha: "" },
      { fecha: "2027-02-29" },
      { fecha: "0000-01-01" },
      { fecha: "2028-02-29T00:00:00Z" },
      { materiaId: randomUUID() },
      { usuarioId: client.usuario.id },
    ]) {
      expect(
        (
          await client.agent
            .post(path)
            .set("X-CSRF-Token", client.token)
            .send({ ...valid, ...changes })
        ).status,
      ).toBe(400);
    }
    expect(
      (await client.agent.get("/api/materias/no-es-uuid/actividades")).status,
    ).toBe(400);
    expect((await client.agent.get(path)).body).toEqual({ actividades: [] });
  });

  it("bloquea solicitudes sin sesión, sin CSRF o hacia materias ajenas e inexistentes", async () => {
    const a = await register(),
      b = await register();
    const path = await subject(a),
      other = await subject(b);
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).post(path).send(valid)).status).toBe(401);
    expect((await a.agent.post(path).send(valid)).status).toBe(403);
    expect(
      (await b.agent.post(other).set("X-CSRF-Token", a.token).send(valid))
        .status,
    ).toBe(403);
    expect(
      (await a.agent.post(path).set("X-CSRF-Token", a.token).send(valid))
        .status,
    ).toBe(201);
    expect(
      (await b.agent.post(other).set("X-CSRF-Token", b.token).send(valid))
        .status,
    ).toBe(201);
    const missing = "/api/materias/" + randomUUID() + "/actividades";
    const denied = await a.agent.get(other);
    const absent = await a.agent.get(missing);
    expect(denied.status).toBe(404);
    expect(absent.status).toBe(404);
    expect(denied.body).toEqual(absent.body);
    for (const target of [path, missing]) {
      const response = await b.agent
        .post(target)
        .set("X-CSRF-Token", b.token)
        .send(valid);
      expect(response.status).toBe(404);
      expect(response.body).toEqual(absent.body);
    }
    expect((await a.agent.get(path)).body.actividades).toHaveLength(1);
    expect((await b.agent.get(other)).body.actividades).toHaveLength(1);
  });

  it("conserva la integridad al eliminar una materia por su API", async () => {
    const client = await register();
    const path = await subject(client);
    const created = await client.agent
      .post(path)
      .set("X-CSRF-Token", client.token)
      .send(valid);
    expect(created.status).toBe(201);
    const { id, materiaId } = created.body.actividad;
    expect(
      (
        await client.agent
          .delete("/api/materias/" + materiaId)
          .set("X-CSRF-Token", client.token)
      ).status,
    ).toBe(204);
    expect(await db.actividad.findUnique({ where: { id } })).toBeNull();
    expect((await client.agent.get(path)).status).toBe(404);
  });
});

describe.sequential("Sprint 4 sobre PostgreSQL real", () => {
  it("crea texto y PDF, mantiene su contenido y aísla ambos recursos", async () => {
    const a = await register();
    const b = await register();
    const subject = await a.agent
      .post("/api/materias")
      .set("X-CSRF-Token", a.token)
      .send({ nombre: "Materia Sprint 4" });
    expect(subject.status).toBe(201);
    const materiaId = subject.body.materia.id as string;
    const text = await a.agent
      .post("/api/materiales")
      .set("X-CSRF-Token", a.token)
      .send({
        titulo: " Apunte ",
        contenido: "Primera línea\nSegunda línea",
        materiaId,
      });
    expect(text.status).toBe(201);
    expect(text.body.material).toMatchObject({
      titulo: "Apunte",
      tipo: "TEXTO",
      materia: { id: materiaId },
    });
    const pdfBytes = summaryPdf();
    const pdf = await a.agent
      .post("/api/materiales/pdf")
      .query({ titulo: "PDF de prueba", nombreArchivo: "física.pdf" })
      .set("X-CSRF-Token", a.token)
      .type("application/pdf")
      .send(pdfBytes);
    expect(pdf.status).toBe(201);
    expect(pdf.body.material).toMatchObject({
      tipo: "PDF",
      materia: null,
      tamanoBytes: pdfBytes.length,
    });
    const textPath = "/api/materiales/" + text.body.material.id;
    const pdfPath = "/api/materiales/" + pdf.body.material.id + "/pdf";
    const restarted = createApp({ db, config });
    const mine = await request(restarted)
      .get("/api/materiales")
      .set("Cookie", a.cookie);
    expect(mine.body.materiales.map((item: { id: string }) => item.id)).toEqual(
      [pdf.body.material.id, text.body.material.id],
    );
    expect(mine.body.materiales[0]).not.toHaveProperty("archivoPdf");
    const detail = await request(restarted)
      .get(textPath)
      .set("Cookie", a.cookie);
    expect(detail.body.material.contenido).toBe("Primera línea\nSegunda línea");
    const downloaded = await request(restarted)
      .get(pdfPath)
      .set("Cookie", a.cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toMatch(/^application\/pdf/);
    expect(downloaded.headers["content-disposition"]).toMatch(/^attachment/);
    expect(downloaded.body).toEqual(pdfBytes);
    expect((await b.agent.get("/api/materiales")).body.materiales).toEqual([]);
    expect((await b.agent.get(textPath)).status).toBe(404);
    expect((await b.agent.get(pdfPath)).status).toBe(404);
    expect(
      (
        await b.agent
          .post("/api/materiales")
          .set("X-CSRF-Token", b.token)
          .send({ titulo: "Ajeno", contenido: "Texto", materiaId })
      ).status,
    ).toBe(404);
    expect(
      (
        await a.agent
          .delete("/api/materias/" + materiaId)
          .set("X-CSRF-Token", a.token)
      ).status,
    ).toBe(204);
    expect((await a.agent.get(textPath)).body.material).toMatchObject({
      materia: null,
      contenido: "Primera línea\nSegunda línea",
    });
  });

  it("rechaza falta de sesión o CSRF, texto inválido y archivos falsos o excedidos", async () => {
    expect((await request(app).get("/api/materiales")).status).toBe(401);
    const a = await register();
    const data = { titulo: "Apunte", contenido: "Texto" };
    const pdf = () =>
      a.agent
        .post("/api/materiales/pdf")
        .query({ titulo: "Archivo", nombreArchivo: "prueba.pdf" });
    expect((await a.agent.post("/api/materiales").send(data)).status).toBe(403);
    expect(
      (await pdf().type("application/pdf").send(Buffer.from("PDF"))).status,
    ).toBe(403);
    expect(
      (
        await a.agent
          .post("/api/materiales")
          .set("X-CSRF-Token", a.token)
          .send({ ...data, contenido: " " })
      ).status,
    ).toBe(400);
    expect(
      (
        await a.agent
          .post("/api/materiales")
          .set("X-CSRF-Token", a.token)
          .send({ ...data, materiaId: randomUUID() })
      ).status,
    ).toBe(404);
    expect(
      (
        await pdf()
          .set("X-CSRF-Token", a.token)
          .type("text/plain")
          .send("texto")
      ).status,
    ).toBe(415);
    expect(
      (
        await pdf()
          .set("X-CSRF-Token", a.token)
          .type("application/pdf")
          .send(Buffer.from("PDF"))
      ).status,
    ).toBe(400);
    expect(
      (
        await pdf()
          .set("X-CSRF-Token", a.token)
          .type("application/pdf")
          .send(Buffer.alloc(5 * 1024 * 1024 + 1))
      ).status,
    ).toBe(413);
    expect((await a.agent.get("/api/materiales")).body.materiales).toEqual([]);
  });
});

function summaryPdf(withText = true) {
  const stream = withText
    ? "BT /F1 12 Tf 30 50 Td (La fotosintesis produce azucar.) Tj ET\n"
    : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream",
  ];
  let content = "%PDF-1.7\n";
  const offsets = objects.map((object, index) => {
    const offset = content.length;
    content += index + 1 + " 0 obj\n" + object + "\nendobj\n";
    return offset;
  });
  const xref = content.length;
  content += "xref\n0 6\n0000000000 65535 f \n";
  for (const offset of offsets)
    content += String(offset).padStart(10, "0") + " 00000 n \n";
  return Buffer.from(
    content +
      "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
      xref +
      "\n%%EOF\n",
  );
}

describe.sequential(
  "Sprint 5 sobre PostgreSQL real con proveedor simulado",
  () => {
    it("genera con el texto real y guarda una sola vez, con consulta aislada tras recrear la aplicación", async () => {
      const inputs: string[] = [];
      const target = createApp({
        db,
        config,
        summaryProvider: {
          simulated: true,
          async summarize(text) {
            inputs.push(text);
            return "Simulación: resultado de prueba";
          },
        },
      });
      const a = await register(target);
      const b = await register(target);
      const material = await db.material.create({
        data: {
          titulo: "Biología",
          tipo: "TEXTO",
          contenido: "Las plantas realizan fotosíntesis.",
          usuarioId: a.usuario.id,
        },
      });
      const path = "/api/materiales/" + material.id + "/resumen";
      expect((await request(target).post(path + "/generar")).status).toBe(401);
      expect((await a.agent.post(path + "/generar")).status).toBe(403);
      expect(
        (await b.agent.post(path + "/generar").set("X-CSRF-Token", b.token))
          .status,
      ).toBe(404);
      expect(
        (
          await a.agent
            .post("/api/materiales/" + randomUUID() + "/resumen/generar")
            .set("X-CSRF-Token", a.token)
        ).status,
      ).toBe(404);
      expect(
        (
          await a.agent
            .post(path)
            .set("X-CSRF-Token", a.token)
            .send({ contenido: "arbitrario" })
        ).status,
      ).toBe(400);
      const draft = await a.agent
        .post(path + "/generar")
        .set("X-CSRF-Token", a.token);
      expect(draft.status).toBe(200);
      expect(draft.body.simulado).toBe(true);
      expect(inputs).toEqual([material.contenido]);
      expect(
        await db.resumen.findUnique({ where: { materialId: material.id } }),
      ).toBeNull();
      expect(
        (
          await a.agent
            .post(path)
            .set("X-CSRF-Token", a.token)
            .send({ borrador: "fake." + "0".repeat(64) })
        ).status,
      ).toBe(400);
      expect(
        (await a.agent.post(path).send({ borrador: draft.body.borrador }))
          .status,
      ).toBe(403);
      expect(
        (
          await b.agent
            .post(path)
            .set("X-CSRF-Token", b.token)
            .send({ borrador: draft.body.borrador })
        ).status,
      ).toBe(404);
      const results = await Promise.all(
        Array.from({ length: 2 }, () =>
          a.agent
            .post(path)
            .set("X-CSRF-Token", a.token)
            .send({ borrador: draft.body.borrador }),
        ),
      );
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      const saved = results.find((result) => result.status === 201)!.body
        .resumen;
      expect(saved.creadoEn).toBe(draft.body.creadoEn);
      expect(
        (await a.agent.post(path + "/generar").set("X-CSRF-Token", a.token))
          .status,
      ).toBe(409);
      const restarted = createApp({
        db,
        config,
        summaryProvider: {
          simulated: true,
          async summarize() {
            throw new Error("La lectura no debe llamar al proveedor");
          },
        },
      });
      const read = (route: string, cookie: string) =>
        request(restarted).get(route).set("Cookie", cookie);
      expect((await read(path, a.cookie)).body.resumen).toEqual(saved);
      expect(
        (await read("/api/resumenes/" + saved.id, a.cookie)).body.resumen,
      ).toEqual(saved);
      expect((await read("/api/resumenes", a.cookie)).body.resumenes).toEqual([
        expect.objectContaining({ id: saved.id }),
      ]);
      expect((await read("/api/resumenes", b.cookie)).body.resumenes).toEqual(
        [],
      );
      expect((await read("/api/resumenes/" + saved.id, b.cookie)).status).toBe(
        404,
      );
      expect((await read(path, b.cookie)).status).toBe(404);
      expect(inputs).toHaveLength(1);
    });

    it("extrae contenido de un PDF persistido y lo entrega al proveedor", async () => {
      const inputs: string[] = [];
      const target = createApp({
        db,
        config,
        summaryProvider: {
          simulated: true,
          async summarize(text) {
            inputs.push(text);
            return "Simulación: fotosíntesis";
          },
        },
      });
      const a = await register(target);
      const upload = await a.agent
        .post("/api/materiales/pdf")
        .query({ titulo: "PDF de biología", nombreArchivo: "biologia.pdf" })
        .set("X-CSRF-Token", a.token)
        .type("application/pdf")
        .send(summaryPdf());
      expect(upload.status).toBe(201);
      const response = await a.agent
        .post("/api/materiales/" + upload.body.material.id + "/resumen/generar")
        .set("X-CSRF-Token", a.token);
      expect(response.status).toBe(200);
      expect(inputs).toEqual(["La fotosintesis produce azucar."]);
    });

    it("maneja errores, respuestas vacías, espera agotada y texto inexistente sin guardar", async () => {
      let attempt = 0;
      const target = createApp({
        db,
        config,
        summaryTimeoutMs: 30,
        summaryProvider: {
          simulated: true,
          async summarize(_text, signal) {
            attempt++;
            if (attempt === 1) throw new Error("detalle privado");
            if (attempt === 2) return " ";
            return new Promise<string>((_, reject) =>
              signal.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              }),
            );
          },
        },
      });
      const a = await register(target);
      const material = await db.material.create({
        data: {
          titulo: "Texto",
          tipo: "TEXTO",
          contenido: "Un texto",
          usuarioId: a.usuario.id,
        },
      });
      const empty = await db.material.create({
        data: {
          titulo: "Vacío",
          tipo: "TEXTO",
          contenido: " ",
          usuarioId: a.usuario.id,
        },
      });
      const generate = (id: string) =>
        a.agent
          .post("/api/materiales/" + id + "/resumen/generar")
          .set("X-CSRF-Token", a.token);
      expect((await generate(empty.id)).status).toBe(422);
      const failed = await generate(material.id);
      expect(failed.status).toBe(502);
      expect(failed.body.error).not.toContain("detalle privado");
      expect((await generate(material.id)).status).toBe(502);
      expect((await generate(material.id)).status).toBe(504);
      expect(
        await db.resumen.count({ where: { materialId: material.id } }),
      ).toBe(0);
    });
  },
);

describe("Sprint 6: recorrido HTTP integral", () => {
  it("persiste el resumen, lo consulta sin IA tras reiniciar y aísla a dos estudiantes", async () => {
    let calls = 0;
    const target = createApp({
      db,
      config,
      summaryProvider: {
        simulated: true,
        async summarize(input) {
          calls++;
          return input;
        },
      },
    });
    const a = await register(target);
    async function logout(
      client: Pick<Awaited<ReturnType<typeof register>>, "agent" | "token">,
    ) {
      const response = await client.agent
        .post("/api/auth/logout")
        .set("X-CSRF-Token", client.token);
      expect(response.status).toBe(204);
    }
    async function login(targetApp: ReturnType<typeof createApp>) {
      const client = await anonymous(targetApp);
      const response = await client.agent
        .post("/api/auth/login")
        .set("X-CSRF-Token", client.token)
        .send({ email: a.usuario.email, password });
      expect(response.status).toBe(200);
      return {
        ...client,
        token: response.body.csrfToken as string,
        cookie: cookie(response),
        usuario: a.usuario,
      };
    }
    await logout(a);
    const active = await login(target);
    const subject = await active.agent
      .post("/api/materias")
      .set("X-CSRF-Token", active.token)
      .send({ nombre: "Integración sintética" });
    expect(subject.status).toBe(201);
    const subjectId = subject.body.materia.id as string;
    const activityPath = `/api/materias/${subjectId}/actividades`;
    const activity = await active.agent
      .post(activityPath)
      .set("X-CSRF-Token", active.token)
      .send({
        titulo: "Actividad sintética",
        tipo: "EXAMEN",
        fecha: "2026-11-20",
      });
    expect(activity.status).toBe(201);
    const upload = await active.agent
      .post("/api/materiales/pdf")
      .query({
        titulo: "PDF sintético",
        nombreArchivo: "prueba.pdf",
        materiaId: subjectId,
      })
      .set("X-CSRF-Token", active.token)
      .type("application/pdf")
      .send(summaryPdf());
    expect(upload.status).toBe(201);
    const note = await active.agent
      .post("/api/materiales")
      .set("X-CSRF-Token", active.token)
      .send({
        titulo: "Apunte sintético",
        contenido: "La fotosíntesis transforma energía lumínica.",
        materiaId: subjectId,
      });
    expect(note.status).toBe(201);
    const materialPath = "/api/materiales/" + upload.body.material.id;
    const draft = await active.agent
      .post(materialPath + "/resumen/generar")
      .set("X-CSRF-Token", active.token);
    expect(draft.status).toBe(200);
    expect(draft.body.contenido).toContain("fotosintesis");
    const save = await active.agent
      .post(materialPath + "/resumen")
      .set("X-CSRF-Token", active.token)
      .send({ borrador: draft.body.borrador });
    expect(save.status).toBe(201);
    const summaryPath = "/api/resumenes/" + save.body.resumen.id;
    await logout(active);
    expect(
      (await request(target).get(summaryPath).set("Cookie", active.cookie))
        .status,
    ).toBe(401);

    const restartedDb = createDatabase(config);
    try {
      const restarted = createApp({
        db: restartedDb,
        config,
        summaryProvider: {
          simulated: true,
          async summarize() {
            calls++;
            throw new Error("La consulta no debe generar contenido");
          },
        },
      });
      const returning = await login(restarted);
      expect((await returning.agent.get(summaryPath)).body.resumen).toEqual(
        save.body.resumen,
      );
      expect(
        (await returning.agent.get(materialPath + "/resumen")).status,
      ).toBe(200);
      expect(
        (await returning.agent.get("/api/resumenes")).body.resumenes,
      ).toHaveLength(1);
      expect(calls).toBe(1);
      const b = await register(restarted);
      for (const path of [
        activityPath,
        materialPath,
        materialPath + "/pdf",
        summaryPath,
      ]) {
        expect((await b.agent.get(path)).status).toBe(404);
      }
      const ownSubject = await b.agent
        .post("/api/materias")
        .set("X-CSRF-Token", b.token)
        .send({ nombre: "Materia B" });
      expect(ownSubject.status).toBe(201);
      expect((await b.agent.get("/api/materias")).body.materias).toEqual([
        ownSubject.body.materia,
      ]);
      expect(
        await restartedDb.materia.count({
          where: { id: subjectId, usuarioId: a.usuario.id },
        }),
      ).toBe(1);
      expect(
        await restartedDb.actividad.count({ where: { materiaId: subjectId } }),
      ).toBe(1);
      expect(
        await restartedDb.material.count({
          where: { materiaId: subjectId, usuarioId: a.usuario.id },
        }),
      ).toBe(2);
      expect(
        await restartedDb.resumen.count({
          where: {
            id: save.body.resumen.id,
            material: { usuarioId: a.usuario.id },
          },
        }),
      ).toBe(1);
    } finally {
      await restartedDb.$disconnect();
    }
  });

  it("rechaza PDF vacío, corrupto o de extensión engañosa y distingue un PDF válido sin texto", async () => {
    const a = await register();
    const upload = (file: Buffer, filename = "archivo.pdf") =>
      a.agent
        .post("/api/materiales/pdf")
        .query({ titulo: "Prueba", nombreArchivo: filename })
        .set("X-CSRF-Token", a.token)
        .type("application/pdf")
        .send(file);
    expect((await upload(Buffer.alloc(0))).status).toBe(400);
    expect(
      (await upload(Buffer.from("%PDF-1.7\ncorrupto\n%%EOF\n"))).status,
    ).toBe(400);
    expect((await upload(summaryPdf(), "archivo.exe")).status).toBe(400);
    const blank = await upload(summaryPdf(false));
    expect(blank.status).toBe(201);
    const result = await a.agent
      .post("/api/materiales/" + blank.body.material.id + "/resumen/generar")
      .set("X-CSRF-Token", a.token);
    expect(result.status).toBe(422);
    expect(result.body.error).toContain("texto procesable");
  });
});

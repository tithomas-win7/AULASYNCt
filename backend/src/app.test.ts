import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { parseEnvironment, parseRuntimeEnvironment } from "./config.js";
import { testDb, testConfig } from "./test/context.js";

afterAll(() => testDb.$disconnect());
describe("Base HTTP", () => {
  const app = createApp({ db: testDb, config: testConfig });
  it("expone liveness sin prometer conexión a PostgreSQL", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "aulasync-api",
      sprint: 5,
    });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
  it("protege materiales y resúmenes", async () => {
    expect((await request(app).get("/api/materiales")).status).toBe(401);
    expect((await request(app).get("/api/resumenes")).status).toBe(401);
  });
  it("rechaza JSON inválido y cuerpos excesivos", async () => {
    expect(
      (
        await request(app)
          .post("/api/materias")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/materias")
          .send({ text: "a".repeat(40000) })
      ).status,
    ).toBe(413);
  });
  it("valida configuración y limita el destino a aulasync_dev local", () => {
    expect(parseEnvironment({}).PORT).toBe(3001);
    expect(() => parseEnvironment({ PORT: "-1" })).toThrow();
    expect(() => parseEnvironment({ NODE_ENV: "invalid" })).toThrow();
    expect(() =>
      parseRuntimeEnvironment({ ...process.env, SESSION_SECRET: "corto" }),
    ).toThrow();
    expect(() =>
      parseRuntimeEnvironment({
        ...process.env,
        DATABASE_URL: "postgresql://usuario@remote.example.test/produccion",
      }),
    ).toThrow();
  });
});

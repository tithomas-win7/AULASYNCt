import { describe, expect, it } from "vitest";
import { randomBytes, scryptSync } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords.js";
describe("Hash de contraseñas", () => {
  it("usa sales diferentes y verifica sin almacenar texto plano", async () => {
    const password = randomBytes(24).toString("hex");
    const first = await hashPassword(password),
      second = await hashPassword(password);
    expect(first !== second && !first.includes(password)).toBe(true);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password + "x", first)).toBe(false);
    expect(await verifyPassword(password, "hash-inválido")).toBe(false);
  });
  it("conserva compatibilidad con el scrypt del seed del Sprint 1", async () => {
    const password = randomBytes(24).toString("hex"),
      salt = randomBytes(16).toString("hex");
    const encoded = [
      "scrypt",
      "16384",
      "8",
      "1",
      salt,
      scryptSync(password, salt, 64).toString("hex"),
    ].join("$");
    expect(await verifyPassword(password, encoded)).toBe(true);
  });
});

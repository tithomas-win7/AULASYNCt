import { vi } from "vitest";
import type { Usuario } from "../lib/api";
export const testUser: Usuario = {
  id: "10000000-0000-4000-8000-000000000001",
  nombre: "Ana de prueba",
  email: "ana@example.test",
};
export const testToken = "a".repeat(64);
export function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export function mockApi(
  handler?: (
    path: string,
    options: RequestInit,
  ) => Response | undefined | Promise<Response | undefined>,
  user: Usuario | null = testUser,
) {
  const mock = vi.fn(
    async (input: string | URL | Request, options: RequestInit = {}) => {
      const path = String(input);
      const custom = await handler?.(path, options);
      if (custom) return custom;
      if (path === "/api/auth/session")
        return jsonResponse({ usuario: user, csrfToken: testToken });
      if (path === "/api/health")
        return jsonResponse({
          status: "ok",
          service: "aulasync-api",
          sprint: 2,
        });
      if (path === "/api/materias") return jsonResponse({ materias: [] });
      return jsonResponse({ error: "Recurso no disponible." }, 404);
    },
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

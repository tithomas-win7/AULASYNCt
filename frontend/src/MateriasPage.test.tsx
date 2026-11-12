import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { mockApi, jsonResponse, testToken } from "./test/api-mock";
import type { Materia } from "./lib/api";

describe("Gestión de materias", () => {
  it("crea, edita, confirma y elimina mediante la API", async () => {
    let materias: Materia[] = [];
    const fetchMock = mockApi((path, options) => {
      if (!path.startsWith("/api/materias")) return undefined;
      if (options.method === "POST") {
        const input = JSON.parse(String(options.body));
        const materia = {
          id: "20000000-0000-4000-8000-000000000002",
          ...input,
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        };
        materias = [materia];
        return jsonResponse({ materia }, 201);
      }
      if (options.method === "PATCH") {
        materias = [{ ...materias[0], ...JSON.parse(String(options.body)) }];
        return jsonResponse({ materia: materias[0] });
      }
      if (options.method === "DELETE") {
        materias = [];
        return jsonResponse(null, 204);
      }
      return jsonResponse({ materias });
    });
    render(
      <MemoryRouter initialEntries={["/materias"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Nueva materia" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre de la materia"), {
      target: { value: "Álgebra" },
    });
    fireEvent.change(screen.getByLabelText("Descripción (opcional)"), {
      target: { value: "Vectores" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar materia" }));
    expect(
      await screen.findByText("Materia creada correctamente."),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar Álgebra" }),
    );
    expect(screen.getByLabelText("Descripción (opcional)")).toHaveValue(
      "Vectores",
    );
    fireEvent.change(screen.getByLabelText("Nombre de la materia"), {
      target: { value: "Álgebra II" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar materia" }));
    expect(
      await screen.findByText("Materia actualizada correctamente."),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Eliminar Álgebra II" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      fetchMock.mock.calls.some((call) => (call[1] ?? {}).method === "DELETE"),
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Álgebra II" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );
    expect(
      await screen.findByText("Materia eliminada correctamente."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "Tu primera materia empieza acá",
      }),
    ).toBeInTheDocument();
    const writes = fetchMock.mock.calls.filter((call) =>
      ["POST", "PATCH", "DELETE"].includes((call[1] ?? {}).method ?? ""),
    );
    expect(writes.length).toBe(3);
    expect(
      writes.every(
        (call) =>
          ((call[1] ?? {}).headers as Record<string, string>)[
            "X-CSRF-Token"
          ] === testToken,
      ),
    ).toBe(true);
  });
  it("valida nombre vacío sin enviar cambios", async () => {
    const fetchMock = mockApi();
    render(
      <MemoryRouter initialEntries={["/materias"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Nueva materia" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar materia" }));
    expect(
      screen.getByText("Ingresá el nombre de la materia."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) => (call[1] ?? {}).method === "POST"),
    ).toBe(false);
  });
  it("permite reintentar la consulta de materias", async () => {
    let failed = true;
    mockApi((path) => {
      if (path !== "/api/materias") return undefined;
      if (failed) {
        failed = false;
        return jsonResponse(
          { error: "No pudimos consultar las materias." },
          500,
        );
      }
      return jsonResponse({ materias: [] });
    });
    render(
      <MemoryRouter initialEntries={["/materias"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("heading", {
        name: "Tu primera materia empieza acá",
      }),
    ).toBeInTheDocument();
  });
  it("conserva el formulario si falla el guardado", async () => {
    mockApi((path, options) =>
      path === "/api/materias" && options.method === "POST"
        ? jsonResponse({ error: "No se pudo guardar." }, 500)
        : undefined,
    );
    render(
      <MemoryRouter initialEntries={["/materias"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Nueva materia" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre de la materia"), {
      target: { value: "Análisis" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar materia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar",
    );
    expect(screen.getByLabelText("Nombre de la materia")).toHaveValue(
      "Análisis",
    );
  });
  it("vuelve al acceso cuando la sesión expiró", async () => {
    let expired = false;
    mockApi((path) => {
      if (path === "/api/materias") {
        expired = true;
        return jsonResponse({ error: "Iniciá sesión." }, 401);
      }
      if (path === "/api/auth/session" && expired)
        return jsonResponse({ usuario: null, csrfToken: testToken });
      return undefined;
    });
    render(
      <MemoryRouter initialEntries={["/materias"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Qué bueno verte de nuevo" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Tu sesión venció. Iniciá sesión nuevamente."),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App, ApiStatus } from "./App";
import { mockApi, jsonResponse, testToken } from "./test/api-mock";

describe("Rutas, dashboard y conexión", () => {
  it("redirige las rutas privadas al inicio de sesión", async () => {
    mockApi(undefined, null);
    render(
      <MemoryRouter initialEntries={["/materias"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nueva materia" }),
    ).not.toBeInTheDocument();
  });
  it("muestra sólo el conteo y las materias recibidas del backend", async () => {
    mockApi((path) =>
      path === "/api/materias"
        ? jsonResponse({
            materias: [
              { id: "1", nombre: "Álgebra", descripcion: "Vectores" },
              { id: "2", nombre: "Análisis", descripcion: null },
            ],
          })
        : undefined,
    );
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Álgebra" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Hola, Ana de prueba." }),
    ).toBeInTheDocument();
  });
  it("muestra la sección de resúmenes vacía", async () => {
    mockApi((path) =>
      path === "/api/resumenes" ? jsonResponse({ resumenes: [] }) : undefined,
    );
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("link", { name: "Resúmenes" }));
    expect(
      screen.getByRole("heading", { name: "Resúmenes" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Todavía no guardaste resúmenes."),
    ).toBeInTheDocument();
  });
  it("permite reintentar un error al consultar la sesión", async () => {
    let failed = true;
    mockApi((path) => {
      if (path === "/api/auth/session") {
        if (failed) {
          failed = false;
          throw new Error("offline");
        }
        return jsonResponse({ usuario: null, csrfToken: testToken });
      }
      return undefined;
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Reintentar conexión" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" }),
    ).toBeInTheDocument();
  });
  it("muestra el estado real de la API y un reintento después del error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        jsonResponse({ status: "ok", service: "aulasync-api" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ApiStatus />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("API disponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("ofrece una salida para rutas desconocidas", async () => {
    mockApi();
    render(
      <MemoryRouter initialEntries={["/desconocida"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Página no encontrada" }),
    ).toBeInTheDocument();
  });
});

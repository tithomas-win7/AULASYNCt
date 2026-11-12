import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { mockApi, jsonResponse, testUser, testToken } from "./test/api-mock";

const fillCredentials = () => {
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "  ANA@EXAMPLE.TEST  " },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "ContraseñaSóloDePrueba2026" },
  });
};
describe("Formularios de autenticación", () => {
  it("valida el registro antes de llamar al servidor", async () => {
    const fetchMock = mockApi(undefined, null);
    render(
      <MemoryRouter initialEntries={["/registro"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Crear cuenta" }),
    );
    expect(
      screen.getByText("Ingresá al menos 2 caracteres."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ingresá un correo válido.")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) => call[0] === "/api/auth/register"),
    ).toBe(false);
  });
  it("registra con correo normalizado, envía CSRF y muestra confirmación", async () => {
    const fetchMock = mockApi(
      (path) =>
        path === "/api/auth/register"
          ? jsonResponse(
              {
                usuario: testUser,
                csrfToken: "b".repeat(64),
                message: "Tu cuenta fue creada correctamente.",
              },
              201,
            )
          : undefined,
      null,
    );
    render(
      <MemoryRouter initialEntries={["/registro"]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Creá tu cuenta" });
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ana de prueba" },
    });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(
      await screen.findByText("Tu cuenta fue creada correctamente."),
    ).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/auth/register",
    )!;
    expect(JSON.parse(String((call[1] ?? {}).body)).email).toBe(
      "ana@example.test",
    );
    expect(
      ((call[1] ?? {}).headers as Record<string, string>)["X-CSRF-Token"] ===
        testToken,
    ).toBe(true);
  });
  it("muestra el conflicto de un correo duplicado", async () => {
    mockApi(
      (path) =>
        path === "/api/auth/register"
          ? jsonResponse({ error: "Ya existe una cuenta con ese correo." }, 409)
          : undefined,
      null,
    );
    render(
      <MemoryRouter initialEntries={["/registro"]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Creá tu cuenta" });
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ana" },
    });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya existe una cuenta",
    );
  });
  it("muestra las credenciales incorrectas y permite iniciar sesión después", async () => {
    let failed = true;
    mockApi((path) => {
      if (path !== "/api/auth/login") return undefined;
      if (failed) {
        failed = false;
        return jsonResponse(
          { error: "El correo o la contraseña son incorrectos." },
          401,
        );
      }
      return jsonResponse({
        usuario: testUser,
        csrfToken: "b".repeat(64),
        message: "Sesión iniciada.",
      });
    }, null);
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrectos");
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(
      await screen.findByRole("heading", { name: "Hola, Ana de prueba." }),
    ).toBeInTheDocument();
  });
  it("cierra sesión y regresa al formulario de acceso", async () => {
    let active = true;
    const fetchMock = mockApi((path) => {
      if (path === "/api/auth/logout") {
        active = false;
        return jsonResponse(null, 204);
      }
      if (path === "/api/auth/session")
        return jsonResponse({
          usuario: active ? testUser : null,
          csrfToken: testToken,
        });
      return undefined;
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Cerrar sesión" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cerraste sesión correctamente."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            call[0] === "/api/auth/logout" && (call[1] ?? {}).method === "POST",
        ),
      ).toBe(true),
    );
  });
});

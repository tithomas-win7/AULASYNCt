import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { mockApi } from "./test/api-mock";

function mockViewport(initialMobile: boolean) {
  let matches = initialMobile;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      get matches() {
        return matches;
      },
      addEventListener: (_event: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        listeners.delete(listener),
    }),
  );
  return (mobile: boolean) =>
    act(() => {
      matches = mobile;
      listeners.forEach((listener) => listener());
    });
}

describe("Accesibilidad de la navegación móvil", () => {
  beforeEach(() => {
    mockApi();
  });

  it("oculta e inhabilita los enlaces del panel cerrado", async () => {
    mockViewport(true);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole(
      "button",
      { name: "Abrir navegación" },
      { timeout: 5000 },
    );
    const panel = document.getElementById("sidebar")!;
    expect(panel).toHaveAttribute("hidden");
    expect(panel).toHaveAttribute("inert");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir navegación" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("abre un diálogo, bloquea el fondo y devuelve el foco al cerrar con Escape", async () => {
    mockViewport(true);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText("API disponible");
    const opener = screen.getByRole("button", { name: "Abrir navegación" });
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Menú de navegación" });
    const close = within(dialog).getByRole("button", {
      name: "Cerrar navegación",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).not.toHaveAttribute("hidden");
    expect(close).toHaveFocus();
    expect(document.querySelector(".main-shell")).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".main-shell")).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
  });

  it("mantiene Tab y Shift+Tab dentro del diálogo", async () => {
    mockViewport(true);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText("API disponible");
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
    const dialog = screen.getByRole("dialog");
    const first = within(dialog).getByRole("button", {
      name: "Cerrar navegación",
    });
    const last = within(dialog).getByRole("link", {
      name: "Simulacro de examen",
    });
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("cierra al elegir una sección y con su botón de cierre", async () => {
    mockViewport(true);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText("API disponible");
    const opener = screen.getByRole("button", { name: "Abrir navegación" });
    fireEvent.click(opener);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("link", {
        name: "Materias",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Mis materias" }),
    ).toBeInTheDocument();
    expect(opener).toHaveFocus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar navegación" }));
    expect(opener).toHaveFocus();
    expect(document.getElementById("sidebar")).toHaveAttribute("hidden");
  });

  it("mantiene disponible el menú de escritorio y gestiona el foco al cambiar de tamaño", async () => {
    const setMobile = mockViewport(false);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText("API disponible");
    const panel = document.getElementById("sidebar")!;
    const nav = screen.getByRole("navigation");
    within(nav).getByRole("link", { name: "Materias" }).focus();
    expect(panel).not.toHaveAttribute("hidden");
    setMobile(true);
    const opener = screen.getByRole("button", { name: "Abrir navegación" });
    expect(panel).toHaveAttribute("hidden");
    expect(opener).toHaveFocus();
    fireEvent.click(opener);
    setMobile(false);
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).not.toHaveAttribute("inert");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "AulaSync" })).toHaveFocus();
    expect(document.querySelector(".main-shell")).not.toHaveAttribute("inert");
  });
});

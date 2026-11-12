import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { jsonResponse, mockApi, testToken } from "./test/api-mock";

const materias = [
  { id: "a", nombre: "Álgebra" },
  { id: "b", nombre: "Física" },
];
function openPage() {
  render(
    <MemoryRouter initialEntries={["/actividades"]}>
      <App />
    </MemoryRouter>,
  );
}
async function selectMateria(id = "a") {
  const select = await screen.findByLabelText("Materia");
  fireEvent.change(select, { target: { value: id } });
  return select;
}
function fill() {
  fireEvent.change(screen.getByLabelText("Título"), {
    target: { value: " Entrega " },
  });
  fireEvent.change(screen.getByLabelText("Tipo"), {
    target: { value: "TRABAJO_PRACTICO" },
  });
  fireEvent.change(screen.getByLabelText("Fecha"), {
    target: { value: "2028-02-29" },
  });
}

describe("Actividades", () => {
  it("ofrece materias propias y controles con etiquetas, y valida campos requeridos", async () => {
    const fetchMock = mockApi((path) =>
      path === "/api/materias"
        ? jsonResponse({ materias })
        : path.endsWith("/actividades")
          ? jsonResponse({ actividades: [] })
          : undefined,
    );
    openPage();
    const select = await selectMateria();
    expect(select).toHaveValue("a");
    expect(screen.getByRole("option", { name: "Física" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Trabajo práctico" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha")).toHaveAttribute("type", "date");
    await screen.findByText("Esta materia todavía no tiene actividades.");
    fireEvent.click(screen.getByRole("button", { name: "Guardar actividad" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresá un título.");
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
  });

  it("envía el tipo y la fecha con CSRF, evita duplicados y actualiza la lista", async () => {
    let saved = false;
    let finish: (() => void) | undefined;
    const fetchMock = mockApi(async (path, options) => {
      if (path === "/api/materias") return jsonResponse({ materias });
      if (path !== "/api/materias/a/actividades") return undefined;
      if (options.method === "POST") {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        saved = true;
        return jsonResponse({}, 201);
      }
      return jsonResponse({
        actividades: saved
          ? [
              {
                id: "1",
                titulo: "Entrega",
                tipo: "TRABAJO_PRACTICO",
                fecha: "2028-02-29",
                materiaId: "a",
              },
            ]
          : [],
      });
    });
    openPage();
    const select = await selectMateria();
    await screen.findByText("Esta materia todavía no tiene actividades.");
    fill();
    const button = screen.getByRole("button", { name: "Guardar actividad" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(select).toBeDisabled();
    finish?.();
    expect(await screen.findByText("Actividad guardada.")).toBeInTheDocument();
    expect(await screen.findByText("Entrega")).toBeInTheDocument();
    expect(screen.getByText("29/02/2028")).toHaveAttribute(
      "datetime",
      "2028-02-29",
    );
    const writes = fetchMock.mock.calls.filter(
      ([, options]) => options?.method === "POST",
    );
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({
      titulo: "Entrega",
      tipo: "TRABAJO_PRACTICO",
      fecha: "2028-02-29",
    });
    expect(new Headers(writes[0][1]?.headers).get("X-CSRF-Token")).toBe(
      testToken,
    );
  });

  it("muestra errores de conexión y del servidor, y conserva la entrada al fallar", async () => {
    let offline = true;
    mockApi((path, options) => {
      if (path === "/api/materias") return jsonResponse({ materias });
      if (!path.endsWith("/actividades")) return undefined;
      if (options.method === "POST")
        return jsonResponse({ error: "Materia no encontrada." }, 404);
      if (offline) {
        offline = false;
        throw new Error("offline");
      }
      return jsonResponse({ actividades: [] });
    });
    openPage();
    await selectMateria();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos conectar",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reintentar actividades" }),
    );
    await screen.findByText("Esta materia todavía no tiene actividades.");
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Guardar actividad" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Materia no encontrada.",
    );
    expect(screen.getByLabelText("Título")).toHaveValue(" Entrega ");
  });

  it("muestra el acceso a Materias cuando el estudiante todavía no tiene ninguna", async () => {
    mockApi();
    openPage();
    expect(
      await screen.findByRole("link", { name: "Ir a materias" }),
    ).toHaveAttribute("href", "/materias");
    expect(
      screen.queryByRole("button", { name: "Guardar actividad" }),
    ).not.toBeInTheDocument();
  });
});

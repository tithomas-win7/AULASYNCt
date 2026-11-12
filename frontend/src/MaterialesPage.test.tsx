import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { jsonResponse, mockApi, testToken } from "./test/api-mock";

function open() {
  render(
    <MemoryRouter initialEntries={["/materiales"]}>
      <App />
    </MemoryRouter>,
  );
}

it("guarda texto con materia opcional, actualiza la lista y consulta su contenido", async () => {
  const material = {
    id: "1",
    titulo: "Apunte",
    tipo: "TEXTO",
    materia: { nombre: "Álgebra" },
  };
  let saved = false;
  const fetchMock = mockApi((path, options) => {
    if (path === "/api/materias")
      return jsonResponse({ materias: [{ id: "a", nombre: "Álgebra" }] });
    if (path === "/api/materiales/1")
      return jsonResponse({ material: { contenido: "Contenido de prueba" } });
    if (path === "/api/materiales") {
      if (options.method === "POST") {
        saved = true;
        return jsonResponse({ material }, 201);
      }
      return jsonResponse({ materiales: saved ? [material] : [] });
    }
  });
  open();
  await screen.findByText("Todavía no guardaste materiales.", undefined, {
    timeout: 5000,
  });
  await screen.findByRole("option", { name: "Álgebra" });
  fireEvent.change(screen.getByLabelText("Título"), {
    target: { value: " Apunte " },
  });
  fireEvent.change(screen.getByLabelText("Materia (opcional)"), {
    target: { value: "a" },
  });
  fireEvent.change(screen.getByLabelText("Contenido"), {
    target: { value: "Contenido de prueba" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar material" }));
  await screen.findByText("Material guardado.");
  fireEvent.click(
    await screen.findByRole("button", { name: "Ver texto Apunte" }),
  );
  expect(await screen.findByText("Contenido de prueba")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/materiales",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-Token": testToken }),
      body: JSON.stringify({
        titulo: "Apunte",
        materiaId: "a",
        contenido: "Contenido de prueba",
      }),
    }),
  );
});

it("envía el PDF en binario con CSRF y muestra su enlace de descarga", async () => {
  const material = { id: "2", titulo: "Guía", tipo: "PDF", materia: null };
  let saved = false;
  const fetchMock = mockApi((path) => {
    if (path === "/api/materias") return jsonResponse({ materias: [] });
    if (path.startsWith("/api/materiales/pdf?")) {
      saved = true;
      return jsonResponse({ material }, 201);
    }
    if (path === "/api/materiales")
      return jsonResponse({ materiales: saved ? [material] : [] });
  });
  open();
  await screen.findByText("Todavía no guardaste materiales.", undefined, {
    timeout: 5000,
  });
  fireEvent.change(screen.getByLabelText("Título"), {
    target: { value: "Guía" },
  });
  fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "PDF" } });
  const file = new File(["%PDF-1.7\n%%EOF\n"], "guia.pdf", {
    type: "application/pdf",
  });
  const input = screen.getByLabelText(
    "Archivo PDF (hasta 5 MiB)",
  ) as HTMLInputElement;
  // JSDOM no permite asignar un FileList real desde el evento.
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  const original = globalThis.FormData;
  class TestFormData extends original {
    constructor(form?: HTMLFormElement) {
      super(form);
      this.set("archivo", file);
    }
  }
  globalThis.FormData = TestFormData;
  try {
    fireEvent.submit(input.form!);
    expect(
      await screen.findByRole("link", { name: "Descargar PDF Guía" }),
    ).toHaveAttribute("href", "/api/materiales/2/pdf");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/materiales/pdf?titulo=Gu%C3%ADa&nombreArchivo=guia.pdf",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/pdf",
          "X-CSRF-Token": testToken,
        }),
        body: file,
      }),
    );
  } finally {
    globalThis.FormData = original;
  }
});

it("muestra el error de red y permite volver a consultar la lista", async () => {
  let offline = true;
  mockApi((path) => {
    if (path === "/api/materias") return jsonResponse({ materias: [] });
    if (path === "/api/materiales") {
      if (offline) throw new Error("offline");
      return jsonResponse({ materiales: [] });
    }
  });
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No pudimos conectar",
  );
  offline = false;
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar materiales" }),
  );
  expect(
    await screen.findByText("Todavía no guardaste materiales."),
  ).toBeInTheDocument();
});

it("genera un borrador identificado, lo guarda explícitamente y lee el resumen almacenado", async () => {
  const material = {
    id: "1",
    titulo: "Biología",
    tipo: "TEXTO",
    materia: null,
  };
  const resumen = {
    id: "r",
    material,
    creadoEn: "2026-11-12T12:00:00Z",
    contenido: "Simulación: síntesis de prueba",
  };
  const fetchMock = mockApi((path, options) => {
    if (path === "/api/materias") return jsonResponse({ materias: [] });
    if (path === "/api/materiales")
      return jsonResponse({ materiales: [material] });
    if (path.endsWith("/generar"))
      return jsonResponse({
        contenido: resumen.contenido,
        borrador: "firmado",
        simulado: true,
      });
    if (path === "/api/materiales/1/resumen" && options.method === "POST")
      return jsonResponse({ resumen }, 201);
    if (path === "/api/resumenes")
      return jsonResponse({ resumenes: [resumen] });
    if (path === "/api/resumenes/r") return jsonResponse({ resumen });
  });
  open();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Generar resumen con IA Biología",
    }),
  );
  expect(
    await screen.findByText("Simulación de desarrollo"),
  ).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.some(([path]) => path === "/api/materiales/1/resumen"),
  ).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar resumen Biología" }),
  );
  fireEvent.click(await screen.findByRole("link", { name: "Ver resúmenes" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Leer resumen Biología" }),
  );
  expect(await screen.findByText(resumen.contenido)).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.filter(([path]) => String(path).endsWith("/generar")),
  ).toHaveLength(1);
});

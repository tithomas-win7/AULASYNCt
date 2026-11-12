import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { SimulacroPage } from "./pages/SimulacroPage";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth/AuthContext", () => ({ useAuth: () => ({ request }) }));

it("corrige las respuestas al finalizar el simulacro", async () => {
  request.mockResolvedValueOnce({
    materiales: [{ id: "bio", titulo: "Biología", tipo: "TEXTO" }],
  });
  request.mockResolvedValueOnce({
    titulo: "Biología",
    preguntas: [
      {
        enunciado: "La planta libera ____.",
        opciones: ["oxígeno", "agua", "sal", "calcio"],
        correcta: 0,
        explicacion: "La planta libera oxígeno.",
      },
      {
        enunciado: "La ____ absorbe luz.",
        opciones: ["raíz", "clorofila", "flor", "corteza"],
        correcta: 1,
        explicacion: "La clorofila absorbe luz.",
      },
    ],
  });
  render(
    <MemoryRouter>
      <SimulacroPage />
    </MemoryRouter>,
  );
  fireEvent.change(await screen.findByLabelText("Material de estudio"), {
    target: { value: "bio" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Empezar simulacro" }));
  fireEvent.click(await screen.findByRole("radio", { name: "oxígeno" }));
  const submit = screen.getByRole("button", { name: "Ver resultado" });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: "raíz" }));
  fireEvent.click(submit);
  expect(screen.getByRole("status")).toHaveTextContent("1 de 2 correctas");
  expect(
    screen.getByText("Incorrecta. La clorofila absorbe luz."),
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith(
    "/api/materiales/bio/simulacro",
    expect.objectContaining({ method: "POST" }),
  );
});

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Material = { id: string; titulo: string; tipo: "PDF" | "TEXTO" };
type Question = {
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
};
type Exam = { titulo: string; preguntas: Question[] };

export function SimulacroPage() {
  const { request } = useAuth();
  const [materials, setMaterials] = useState<Material[]>();
  const [materialId, setMaterialId] = useState("");
  const [exam, setExam] = useState<Exam>();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    request<{ materiales: Material[] }>("/api/materiales")
      .then(({ materiales }) => {
        if (active) setMaterials(materiales);
      })
      .catch((cause) => {
        if (active) setLoadError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [request, attempt]);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (!materialId || pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      const next = await request<Exam>(
        `/api/materiales/${materialId}/simulacro`,
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
        },
      );
      setAnswers({});
      setFinished(false);
      setExam(next);
    } catch (cause) {
      setError(message(cause));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  const score = exam?.preguntas.filter(
    (question, index) => answers[index] === question.correcta,
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Simulacro de examen</h1>
          <p>Elegí un apunte y completá las frases con la opción correcta.</p>
        </div>
      </div>
      {loadError ? (
        <p role="alert">
          {loadError}{" "}
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setLoadError("");
              setAttempt(attempt + 1);
            }}
          >
            Reintentar
          </button>
        </p>
      ) : !materials ? (
        <p role="status">Cargando materiales…</p>
      ) : !materials.length ? (
        <p className="empty-state">
          Agregá un apunte en <Link to="/materiales">Materiales</Link> para
          practicar.
        </p>
      ) : (
        <form
          className="form-panel exam-controls"
          onSubmit={(event) => void start(event)}
        >
          <div className="field">
            <label htmlFor="exam-material">Material de estudio</label>
            <select
              id="exam-material"
              required
              value={materialId}
              onChange={(event) => setMaterialId(event.target.value)}
              disabled={loading}
            >
              <option value="">Elegí un material</option>
              {materials.map((material) => (
                <option value={material.id} key={material.id}>
                  {material.titulo} ·{" "}
                  {material.tipo === "PDF" ? "PDF" : "Texto"}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="primary-button"
            disabled={!materialId || loading}
          >
            {loading
              ? "Preparando…"
              : exam
                ? "Nuevo simulacro"
                : "Empezar simulacro"}
          </button>
          {error && (
            <p role="alert" className="feedback error">
              {error}
            </p>
          )}
        </form>
      )}
      {exam && (
        <form
          className="exam-questions"
          onSubmit={(event) => {
            event.preventDefault();
            if (Object.keys(answers).length === exam.preguntas.length)
              setFinished(true);
          }}
        >
          <h2>{exam.titulo}</h2>
          {finished && (
            <p className="feedback success" role="status">
              Resultado: {score} de {exam.preguntas.length} correctas.
            </p>
          )}
          {exam.preguntas.map((question, index) => (
            <fieldset
              className="form-panel exam-question"
              key={index}
              disabled={finished || loading}
            >
              <legend>
                {index + 1}. {question.enunciado}
              </legend>
              {question.opciones.map((option, choice) => (
                <label className="exam-option" key={option}>
                  <input
                    type="radio"
                    name={`question-${index}`}
                    checked={answers[index] === choice}
                    onChange={() =>
                      setAnswers((current) => ({ ...current, [index]: choice }))
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}
              {finished && (
                <p className="exam-explanation">
                  {answers[index] === question.correcta
                    ? "Correcta."
                    : "Incorrecta."}{" "}
                  {question.explicacion}
                </p>
              )}
            </fieldset>
          ))}
          {!finished && (
            <button
              type="submit"
              className="primary-button"
              disabled={
                loading || Object.keys(answers).length !== exam.preguntas.length
              }
            >
              Ver resultado
            </button>
          )}
        </form>
      )}
    </>
  );
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos preparar el simulacro.";
}

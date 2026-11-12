import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type Summary = {
  id: string;
  creadoEn: string;
  material: { id: string; titulo: string };
};
type Detail = { id: string; text?: string; error?: string };
const dateFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ResumenesPage() {
  const { request } = useAuth();
  const [items, setItems] = useState<Summary[]>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<Detail>();

  useEffect(() => {
    let active = true;
    request<{ resumenes: Summary[] }>("/api/resumenes")
      .then(({ resumenes }) => {
        if (active) setItems(resumenes);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [request, attempt]);

  async function open(id: string) {
    if (detail?.id === id) {
      setDetail(undefined);
      return;
    }
    setDetail({ id });
    try {
      const { resumen } = await request<{ resumen: { contenido: string } }>(
        "/api/resumenes/" + id,
      );
      setDetail((current) =>
        current?.id === id ? { id, text: resumen.contenido } : current,
      );
    } catch (cause) {
      setDetail((current) =>
        current?.id === id ? { id, error: message(cause) } : current,
      );
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Resúmenes</h1>
          <p>Consultá los resúmenes que guardaste para estudiar.</p>
        </div>
      </div>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            Reintentar
          </button>
        </p>
      ) : !items ? (
        <p role="status">Consultando resúmenes…</p>
      ) : !items.length ? (
        <p className="empty-state">Todavía no guardaste resúmenes.</p>
      ) : (
        <div className="subjects-grid">
          {items.map((item) => (
            <article key={item.id} className="form-panel material-card">
              <h2>{item.material.titulo}</h2>
              <p>
                Generado el{" "}
                <time dateTime={item.creadoEn}>
                  {dateFormat.format(new Date(item.creadoEn))}
                </time>
              </p>
              <button
                type="button"
                className="secondary-button"
                aria-expanded={detail?.id === item.id}
                onClick={() => void open(item.id)}
              >
                {detail?.id === item.id ? "Cerrar resumen" : "Leer resumen"}{" "}
                <span className="sr-only">{item.material.titulo}</span>
              </button>
              {detail?.id === item.id &&
                (detail.error ? (
                  <p role="alert">{detail.error}</p>
                ) : detail.text === undefined ? (
                  <p role="status">Consultando resumen…</p>
                ) : (
                  <p className="material-text">{detail.text}</p>
                ))}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos consultar los resúmenes.";
}

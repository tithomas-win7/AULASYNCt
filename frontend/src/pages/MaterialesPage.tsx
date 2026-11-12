import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { MaterialSummary } from "./MaterialSummary";
import { useMaterias } from "../hooks/useMaterias";

type Material = {
  id: string;
  titulo: string;
  tipo: "TEXTO" | "PDF";
  nombreArchivo: string | null;
  materia: { nombre: string } | null;
};

export function MaterialesPage() {
  const { request } = useAuth();
  const materias = useMaterias();
  const [items, setItems] = useState<Material[]>([]);
  const [tipo, setTipo] = useState<Material["tipo"]>("TEXTO");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [detail, setDetail] = useState<{
    id: string;
    text?: string;
    error?: string;
  }>();

  const reload = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      setItems(
        (await request<{ materiales: Material[] }>("/api/materiales"))
          .materiales,
      );
    } catch (err) {
      setListError(message(err));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFeedback("");
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const titulo = String(fields.get("titulo") ?? "").trim();
    const materiaId = String(fields.get("materiaId") ?? "");
    const contenido = String(fields.get("contenido") ?? "").trim();
    const file = fields.get("archivo");

    if (!titulo || titulo.length > 200) {
      setError("Ingresá un título de hasta 200 caracteres.");
      return;
    }
    if (tipo === "TEXTO" && (!contenido || contenido.length > 4000)) {
      setError("Ingresá entre 1 y 4000 caracteres de texto.");
      return;
    }
    if (
      tipo === "PDF" &&
      (!(file instanceof File) ||
        !/\.pdf$/i.test(file.name) ||
        file.name.length > 200 ||
        !file.size ||
        file.size > 5 * 1024 * 1024)
    ) {
      setError(
        "Elegí un PDF de hasta 5 MiB con un nombre de hasta 200 caracteres.",
      );
      return;
    }

    submitting.current = true;
    setSaving(true);
    try {
      const metadata = { titulo, ...(materiaId ? { materiaId } : {}) };
      if (tipo === "PDF" && file instanceof File) {
        const query = new URLSearchParams({
          ...metadata,
          nombreArchivo: file.name,
        });
        await request("/api/materiales/pdf?" + query, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: file,
        });
      } else {
        await request("/api/materiales", {
          method: "POST",
          body: JSON.stringify({ ...metadata, contenido }),
        });
      }
      form.reset();
      setTipo("TEXTO");
      setFeedback("Material guardado.");
      await reload();
    } catch (err) {
      setError(message(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  async function openText(id: string) {
    if (detail?.id === id) {
      setDetail(undefined);
      return;
    }
    setDetail({ id });
    try {
      const { material } = await request<{
        material: { contenido: string | null };
      }>("/api/materiales/" + id);
      setDetail((current) =>
        current?.id === id ? { id, text: material.contenido ?? "" } : current,
      );
    } catch (err) {
      setDetail((current) =>
        current?.id === id ? { id, error: message(err) } : current,
      );
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Materiales</h1>
          <p>Guardá y consultá tus documentos y textos de estudio.</p>
        </div>
      </div>
      <section className="form-panel" aria-labelledby="material-create">
        <h2 id="material-create">Nuevo material</h2>
        {materias.error && (
          <p role="alert">
            {materias.error}{" "}
            <button
              type="button"
              className="secondary-button"
              onClick={() => void materias.reload()}
            >
              Reintentar materias
            </button>
          </p>
        )}
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        {feedback && (
          <p className="feedback success" role="status">
            {feedback}
          </p>
        )}
        <form onSubmit={(event) => void save(event)}>
          <fieldset disabled={saving} className="material-fields">
            <label className="field">
              Título
              <input name="titulo" maxLength={200} required />
            </label>
            <label className="field">
              Tipo
              <select
                value={tipo}
                onChange={(event) =>
                  setTipo(event.target.value === "PDF" ? "PDF" : "TEXTO")
                }
              >
                <option value="TEXTO">Texto</option>
                <option value="PDF">PDF</option>
              </select>
            </label>
            <label className="field">
              Materia (opcional)
              <select
                name="materiaId"
                disabled={materias.loading || Boolean(materias.error)}
              >
                <option value="">
                  {materias.loading ? "Consultando materias…" : "Sin materia"}
                </option>
                {materias.materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </select>
            </label>
            {tipo === "TEXTO" ? (
              <label className="field">
                Contenido
                <textarea name="contenido" rows={5} maxLength={4000} required />
              </label>
            ) : (
              <label className="field">
                Archivo PDF (hasta 5 MiB)
                <input
                  name="archivo"
                  type="file"
                  accept=".pdf,application/pdf"
                  required
                />
              </label>
            )}
            <button className="primary-button" type="submit">
              {saving ? "Guardando…" : "Guardar material"}
            </button>
          </fieldset>
        </form>
      </section>
      <section aria-labelledby="material-list" className="materials-list">
        <h2 id="material-list">Tus materiales</h2>
        {loading && <p role="status">Consultando materiales…</p>}
        {listError && (
          <p role="alert">
            {listError}{" "}
            <button
              type="button"
              className="secondary-button"
              onClick={() => void reload()}
            >
              Reintentar materiales
            </button>
          </p>
        )}
        {!loading && !listError && !items.length && (
          <p className="empty-state">Todavía no guardaste materiales.</p>
        )}
        <div className="subjects-grid">
          {items.map((item) => (
            <article key={item.id} className="form-panel material-card">
              <h3>{item.titulo}</h3>
              <p>
                {item.tipo === "PDF" ? "PDF" : "Texto"} ·{" "}
                {item.materia?.nombre ?? "Sin materia"}
              </p>
              {item.tipo === "PDF" ? (
                <a
                  className="secondary-button"
                  href={"/api/materiales/" + item.id + "/pdf"}
                  download
                >
                  Descargar PDF <span className="sr-only">{item.titulo}</span>
                </a>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  aria-expanded={detail?.id === item.id}
                  onClick={() => void openText(item.id)}
                >
                  {detail?.id === item.id ? "Ocultar texto" : "Ver texto"}{" "}
                  <span className="sr-only">{item.titulo}</span>
                </button>
              )}
              {detail?.id === item.id &&
                (detail.error ? (
                  <p role="alert">{detail.error}</p>
                ) : detail.text === undefined ? (
                  <p role="status">Consultando texto…</p>
                ) : (
                  <p className="material-text">
                    {detail.text || "Contenido vacío."}
                  </p>
                ))}
              <MaterialSummary id={item.id} title={item.titulo} />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación.";
}

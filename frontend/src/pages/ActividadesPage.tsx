import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { useMaterias } from "../hooks/useMaterias";
import type { Materia } from "../lib/api";

const tipos = {
  TAREA: "Tarea",
  TRABAJO_PRACTICO: "Trabajo práctico",
  EXAMEN: "Examen",
} as const;
const schema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Ingresá un título.")
    .max(200, "Usá hasta 200 caracteres."),
  tipo: z.enum(["TAREA", "TRABAJO_PRACTICO", "EXAMEN"], {
    error: "Elegí un tipo de actividad.",
  }),
  fecha: z.iso
    .date("Ingresá una fecha válida.")
    .refine(
      (fecha) => !fecha.startsWith("0000"),
      "Ingresá un año entre 0001 y 9999.",
    ),
});
type Actividad = z.infer<typeof schema> & { id: string; materiaId: string };

function ActividadesMateria({
  materia,
  saving,
  setSaving,
}: {
  materia: Materia;
  saving: boolean;
  setSaving: (value: boolean) => void;
}) {
  const { request } = useAuth();
  const path = "/api/materias/" + materia.id + "/actividades";
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState("");
  const [items, setItems] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    void request<{ actividades: Actividad[] }>(path)
      .then(
        ({ actividades }) => {
          if (active) setItems(actividades);
        },
        (failure: Error) => {
          if (active) setLoadError(failure.message);
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, path, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setNotice("");
    setError("");
    const result = schema.safeParse({ titulo, tipo, fecha });
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      await request(path, {
        method: "POST",
        body: JSON.stringify(result.data),
      });
      setTitulo("");
      setTipo("");
      setFecha("");
      setNotice("Actividad guardada.");
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo guardar la actividad.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <form
        className="form-panel"
        onSubmit={save}
        noValidate
        aria-busy={saving}
      >
        <h2>Registrar actividad</h2>
        <div className="field">
          <label htmlFor="actividad-titulo">Título</label>
          <input
            id="actividad-titulo"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            required
            maxLength={200}
            disabled={saving}
          />
        </div>
        <div className="field">
          <label htmlFor="actividad-tipo">Tipo</label>
          <select
            id="actividad-tipo"
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
            required
            disabled={saving}
          >
            <option value="">Elegí un tipo</option>
            {Object.entries(tipos).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="actividad-fecha">Fecha</label>
          <input
            id="actividad-fecha"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            required
            disabled={saving}
          />
        </div>
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="feedback success" role="status">
            {notice}
          </p>
        )}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar actividad"}
        </button>
      </form>
      <section aria-labelledby="actividades-lista">
        <div className="section-heading">
          <h2 id="actividades-lista">Actividades de {materia.nombre}</h2>
        </div>
        {loading ? (
          <p role="status">Cargando actividades…</p>
        ) : loadError ? (
          <div className="feedback error" role="alert">
            {loadError}{" "}
            <button
              className="secondary-button"
              onClick={() => setRevision((value) => value + 1)}
            >
              Reintentar actividades
            </button>
          </div>
        ) : items.length === 0 ? (
          <p>Esta materia todavía no tiene actividades.</p>
        ) : (
          <ul className="subjects-grid">
            {items.map((item) => (
              <li key={item.id} className="subject-card">
                <h3>{item.titulo}</h3>
                <p>
                  {tipos[item.tipo]} · {materia.nombre}
                </p>
                <p>
                  <time dateTime={item.fecha}>
                    {item.fecha.split("-").reverse().join("/")}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function ActividadesPage() {
  const { materias, loading, error, reload } = useMaterias();
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const materia = materias.find((item) => item.id === selected);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Actividades</h1>
          <p>Registrá y consultá las actividades de tus materias.</p>
        </div>
      </div>
      {loading ? (
        <p role="status">Cargando materias…</p>
      ) : error ? (
        <div className="feedback error" role="alert">
          {error}{" "}
          <button className="secondary-button" onClick={() => void reload()}>
            Reintentar materias
          </button>
        </div>
      ) : materias.length === 0 ? (
        <div className="empty-state compact">
          <h2>Primero creá una materia</h2>
          <Link className="primary-button" to="/materias">
            Ir a materias
          </Link>
        </div>
      ) : (
        <>
          <div className="field actividad-materia">
            <label htmlFor="actividad-materia">Materia</label>
            <select
              id="actividad-materia"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={saving}
            >
              <option value="">Elegí una materia</option>
              {materias.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </div>
          {materia ? (
            <ActividadesMateria
              key={materia.id}
              materia={materia}
              saving={saving}
              setSaving={setSaving}
            />
          ) : (
            <p>Elegí una materia para registrar y consultar sus actividades.</p>
          )}
        </>
      )}
    </>
  );
}

import { useRef, useState, type FormEvent } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useMaterias } from "../hooks/useMaterias";
import { ApiError, type Materia } from "../lib/api";
import { materiaSchema, fieldErrors } from "../lib/validation";

export function MateriasPage() {
  const { request } = useAuth();
  const { materias, loading, error, reload } = useMaterias();
  const [editing, setEditing] = useState<Materia | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState({ nombre: "", descripcion: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [operationError, setOperationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Materia | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  function openForm(materia: Materia | null) {
    setEditing(materia);
    setValues({
      nombre: materia?.nombre ?? "",
      descripcion: materia?.descripcion ?? "",
    });
    setShowForm(true);
    setFields({});
    setNotice("");
    setOperationError("");
    setDeleting(null);
    window.setTimeout(() => nameInput.current?.focus(), 0);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setFields({});
    setOperationError("");
    const result = materiaSchema.safeParse(values);
    if (!result.success) {
      setFields(fieldErrors(result.error.issues));
      return;
    }
    setBusy(true);
    try {
      await request(editing ? "/api/materias/" + editing.id : "/api/materias", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(result.data),
      });
      setShowForm(false);
      setEditing(null);
      setNotice(
        editing
          ? "Materia actualizada correctamente."
          : "Materia creada correctamente.",
      );
      await reload();
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la materia.",
      );
      if (error instanceof ApiError) setFields(error.fields);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setOperationError("");
    setNotice("");
    try {
      await request<void>("/api/materias/" + deleting.id, { method: "DELETE" });
      setDeleting(null);
      setNotice("Materia eliminada correctamente.");
      await reload();
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la materia.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="eyebrow">TU ESPACIO ACADÉMICO</div>
      <div className="page-heading">
        <div>
          <h1>Mis materias</h1>
          <p>Un lugar para organizar lo que estás aprendiendo.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => openForm(null)}
          disabled={busy}
        >
          <Plus size={17} />
          Nueva materia
        </button>
      </div>
      {notice && (
        <div className="feedback success" role="status">
          {notice}
        </div>
      )}
      {operationError && (
        <div className="feedback error" role="alert">
          {operationError}
        </div>
      )}
      {showForm && (
        <section className="form-panel" aria-labelledby="materia-form-title">
          <h2 id="materia-form-title">
            {editing ? "Editar materia" : "Nueva materia"}
          </h2>
          <form onSubmit={submit} noValidate aria-busy={busy}>
            <div className="field">
              <label htmlFor="materia-nombre">Nombre de la materia</label>
              <input
                ref={nameInput}
                id="materia-nombre"
                required
                maxLength={120}
                value={values.nombre}
                aria-invalid={Boolean(fields.nombre)}
                aria-describedby={
                  fields.nombre ? "materia-nombre-error" : undefined
                }
                onChange={(event) =>
                  setValues({ ...values, nombre: event.target.value })
                }
              />
              {fields.nombre && (
                <span className="field-error" id="materia-nombre-error">
                  {fields.nombre}
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="materia-descripcion">
                Descripción (opcional)
              </label>
              <textarea
                id="materia-descripcion"
                rows={3}
                maxLength={1000}
                value={values.descripcion}
                aria-invalid={Boolean(fields.descripcion)}
                aria-describedby={
                  fields.descripcion ? "materia-descripcion-error" : undefined
                }
                onChange={(event) =>
                  setValues({ ...values, descripcion: event.target.value })
                }
              />
              {fields.descripcion && (
                <span className="field-error" id="materia-descripcion-error">
                  {fields.descripcion}
                </span>
              )}
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar materia"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
      {deleting && (
        <section className="delete-confirmation" aria-labelledby="delete-title">
          <h2 id="delete-title">¿Eliminar {deleting.nombre}?</h2>
          <p>
            Sus actividades se eliminarán. Los materiales y sus resúmenes se
            conservarán, sin asociación a esta materia.
          </p>
          <div className="button-row">
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Eliminando…" : "Confirmar eliminación"}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
      {loading ? (
        <p role="status">Cargando tus materias…</p>
      ) : error ? (
        <div className="feedback error" role="alert">
          {error}
          <button className="secondary-button" onClick={() => void reload()}>
            Reintentar
          </button>
        </div>
      ) : materias.length === 0 ? (
        <section className="empty-state">
          <span className="empty-icon">
            <BookOpen size={36} />
          </span>
          <h2>Tu primera materia empieza acá</h2>
          <p>
            Todavía no agregaste materias. Creá una para empezar a organizarte.
          </p>
          <button className="primary-button" onClick={() => openForm(null)}>
            Crear mi primera materia
          </button>
        </section>
      ) : (
        <div className="subjects-grid">
          {materias.map((materia) => (
            <article className="subject-card" key={materia.id}>
              <span className="module-icon tone-0">
                <BookOpen size={22} />
              </span>
              <h2>{materia.nombre}</h2>
              <p>{materia.descripcion || "Sin descripción."}</p>
              <div className="subject-actions">
                <button
                  className="text-button"
                  disabled={busy}
                  aria-label={"Editar " + materia.nombre}
                  onClick={() => openForm(materia)}
                >
                  <Pencil size={15} />
                  Editar
                </button>
                <button
                  className="text-button danger-text"
                  disabled={busy}
                  aria-label={"Eliminar " + materia.nombre}
                  onClick={() => {
                    setDeleting(materia);
                    setShowForm(false);
                    setOperationError("");
                    setNotice("");
                  }}
                >
                  <Trash2 size={15} />
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

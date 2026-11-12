import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Draft = { contenido: string; borrador: string; simulado: boolean };

export function MaterialSummary({ id, title }: { id: string; title: string }) {
  const { request } = useAuth();
  const [draft, setDraft] = useState<Draft>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const path = "/api/materiales/" + id + "/resumen";

  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (draft) {
        await request(path, {
          method: "POST",
          body: JSON.stringify({ borrador: draft.borrador }),
        });
        setSaved(true);
        setDraft(undefined);
      } else {
        setDraft(
          await request<Draft>(path + "/generar", {
            method: "POST",
            signal: AbortSignal.timeout(100000),
          }),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos completar la operación.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  return (
    <div className="material-summary">
      {draft && (
        <>
          <h4>Resumen generado</h4>
          {draft.simulado && <p>Simulación de desarrollo</p>}
          <p className="material-text">{draft.contenido}</p>
        </>
      )}
      {!saved && (
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void submit()}
        >
          {draft ? "Guardar resumen" : "Generar resumen con IA"}{" "}
          <span className="sr-only">{title}</span>
        </button>
      )}
      {busy && (
        <p role="status">
          {draft ? "Guardando resumen…" : "Procesando material…"}
        </p>
      )}
      {error && (
        <p role="alert" className="feedback error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status">
          Resumen guardado. <Link to="/resumenes">Ver resúmenes</Link>
        </p>
      )}
    </div>
  );
}

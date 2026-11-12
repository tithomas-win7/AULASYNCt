import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { Materia } from "../lib/api";
export function useMaterias() {
  const { request } = useAuth();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request<{ materias: Materia[] }>("/api/materias");
      setMaterias(data.materias);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudieron consultar tus materias.",
      );
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { materias, loading, error, reload };
}

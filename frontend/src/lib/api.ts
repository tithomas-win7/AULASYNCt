export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      signal: options.signal ?? AbortSignal.timeout(10000),
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "No pudimos conectar con AulaSync. Revisá la conexión e intentá nuevamente.",
    );
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.error ?? "No pudimos completar la solicitud.",
      data?.fields ?? {},
    );
  if (!data)
    throw new ApiError(500, "El servidor devolvió una respuesta inválida.");
  return data as T;
}
export type Usuario = { id: string; nombre: string; email: string };
export type Materia = {
  id: string;
  nombre: string;
  descripcion: string | null;
  creadoEn: string;
  actualizadoEn: string;
};

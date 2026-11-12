import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, ApiError, type Usuario } from "../lib/api";

type SessionResponse = {
  usuario: Usuario | null;
  csrfToken: string;
  message?: string;
};
type Credentials = { email: string; password: string; nombre?: string };
type AuthState = {
  usuario: Usuario | null;
  status: "loading" | "ready" | "error";
  error: string;
  notice: string;
  dismissNotice: () => void;
  refreshSession: () => Promise<void>;
  authenticate: (
    mode: "login" | "register",
    values: Credentials,
  ) => Promise<void>;
  logout: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
};
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const token = useRef("");
  const initialRequest = useRef<Promise<SessionResponse> | null>(null);
  const apply = useCallback((data: SessionResponse) => {
    token.current = data.csrfToken;
    setUsuario(data.usuario);
    setStatus("ready");
    setError("");
  }, []);
  const failed = useCallback((error: unknown) => {
    setError(
      error instanceof Error
        ? error.message
        : "No se pudo consultar la sesión.",
    );
    setStatus("error");
  }, []);
  const refreshSession = useCallback(async () => {
    setStatus("loading");
    try {
      apply(await apiRequest<SessionResponse>("/api/auth/session"));
    } catch (error) {
      failed(error);
    }
  }, [apply, failed]);
  useEffect(() => {
    let active = true;
    initialRequest.current ??= apiRequest<SessionResponse>("/api/auth/session");
    initialRequest.current
      .then((data) => {
        if (active) apply(data);
      })
      .catch((error) => {
        if (active) failed(error);
      });
    return () => {
      active = false;
    };
  }, [apply, failed]);
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiRequest<T>(path, {
          ...options,
          headers: { ...options.headers, "X-CSRF-Token": token.current },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setNotice("Tu sesión venció. Iniciá sesión nuevamente.");
          await refreshSession();
        }
        throw error;
      }
    },
    [refreshSession],
  );
  async function authenticate(mode: "login" | "register", values: Credentials) {
    const data = await apiRequest<SessionResponse>("/api/auth/" + mode, {
      method: "POST",
      headers: { "X-CSRF-Token": token.current },
      body: JSON.stringify(values),
    });
    apply(data);
    setNotice(data.message ?? "Sesión iniciada.");
  }
  async function logout() {
    await request<void>("/api/auth/logout", { method: "POST" });
    token.current = "";
    setUsuario(null);
    setNotice("Cerraste sesión correctamente.");
    await refreshSession();
  }
  return (
    <AuthContext.Provider
      value={{
        usuario,
        status,
        error,
        notice,
        dismissNotice: () => setNotice(""),
        refreshSession,
        authenticate,
        logout,
        request,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider es obligatorio.");
  return auth;
}

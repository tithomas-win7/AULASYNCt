import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { registerSchema, loginSchema, fieldErrors } from "../lib/validation";

export function AuthPage({ mode }: { mode: "register" | "login" }) {
  const auth = useAuth();
  const [values, setValues] = useState({ nombre: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";
  if (auth.usuario) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setErrors({});
    const result = registering
      ? registerSchema.safeParse(values)
      : loginSchema.safeParse({
          email: values.email,
          password: values.password,
        });
    if (!result.success) {
      setErrors(fieldErrors(result.error.issues));
      return;
    }
    setBusy(true);
    try {
      await auth.authenticate(mode, result.data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la solicitud.",
      );
      if (error instanceof ApiError) setErrors(error.fields);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Link className="brand" to="/login">
          <span className="brand-icon">
            <GraduationCap size={27} />
          </span>
          Aula<span>Sync</span>
        </Link>
        <div>
          <span className="eyebrow">TU ESPACIO ACADÉMICO</span>
          <h1>
            Más claridad.
            <br />
            Más espacio para aprender.
          </h1>
          <p>Organizá tus materias y construí tu propio espacio de estudio.</p>
        </div>
        <small>UTN · Metodología en Sistemas</small>
      </section>
      <main className="auth-main">
        <section className="auth-card">
          <span className="pill">BIENVENIDO A AULASYNC</span>
          <h1>{registering ? "Creá tu cuenta" : "Qué bueno verte de nuevo"}</h1>
          <p>
            {registering
              ? "Empezá con tus datos de estudiante."
              : "Ingresá para continuar con tus materias."}
          </p>
          {auth.notice && (
            <div className="feedback success" role="status">
              {auth.notice}
            </div>
          )}
          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit} noValidate aria-busy={busy}>
            {registering && (
              <div className="field">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  name="nombre"
                  autoComplete="name"
                  maxLength={100}
                  required
                  value={values.nombre}
                  aria-invalid={Boolean(errors.nombre)}
                  aria-describedby={errors.nombre ? "nombre-error" : undefined}
                  onChange={(event) =>
                    setValues({ ...values, nombre: event.target.value })
                  }
                />
                {errors.nombre && (
                  <span className="field-error" id="nombre-error">
                    {errors.nombre}
                  </span>
                )}
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={values.email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                onChange={(event) =>
                  setValues({ ...values, email: event.target.value })
                }
              />
              {errors.email && (
                <span className="field-error" id="email-error">
                  {errors.email}
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={registering ? 10 : 1}
                maxLength={128}
                required
                value={values.password}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "password-error" : "password-help"
                }
                onChange={(event) =>
                  setValues({ ...values, password: event.target.value })
                }
              />
              <small id="password-help">
                {registering
                  ? "Entre 10 y 128 caracteres. No compartas tu contraseña."
                  : "Usá la contraseña de tu cuenta."}
              </small>
              {errors.password && (
                <span className="field-error" id="password-error">
                  {errors.password}
                </span>
              )}
            </div>
            <button
              className="primary-button full-width"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Procesando…"
                : registering
                  ? "Crear cuenta"
                  : "Iniciar sesión"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {registering ? "¿Ya tenés una cuenta? " : "¿Primera vez por acá? "}
            <Link to={registering ? "/login" : "/registro"}>
              {registering ? "Iniciá sesión" : "Creá tu cuenta"}
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}

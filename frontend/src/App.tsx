import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { ActividadesPage } from "./pages/ActividadesPage";
import { MaterialesPage } from "./pages/MaterialesPage";
import { MateriasPage } from "./pages/MateriasPage";
import { ResumenesPage } from "./pages/ResumenesPage";
import { SimulacroPage } from "./pages/SimulacroPage";
import { Dashboard } from "./pages/Dashboard";
import { useMobileNavigation } from "./hooks/useMobileNavigation";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Menu,
  PanelLeftClose,
  Sparkles,
  X,
} from "lucide-react";

const sections = [
  {
    path: "/materias",
    title: "Materias",
    icon: BookOpen,
    sprint: 2,
    description: "Un lugar para organizar las materias de tu carrera.",
    detail: "Podrás crear, consultar, editar y eliminar tus materias.",
  },
  {
    path: "/actividades",
    title: "Actividades",
    icon: ListTodo,
    sprint: 3,
    description: "Tus tareas, trabajos prácticos y exámenes, en orden.",
    detail:
      "Podrás registrar actividades con título, tipo, fecha y materia asociada.",
  },
  {
    path: "/materiales",
    title: "Materiales",
    icon: FileText,
    sprint: 4,
    description: "Todo tu contenido de estudio, en un mismo espacio.",
    detail:
      "Podrás guardar documentos PDF y textos, con una materia asociada de forma opcional.",
  },
  {
    path: "/resumenes",
    title: "Resúmenes",
    icon: Sparkles,
    sprint: 5,
    description: "Transformá tus materiales en ideas más claras.",
    detail:
      "Podrás generar un resumen con IA, guardarlo y volver a consultarlo sin otra llamada al proveedor.",
  },
  { path: "/simulacro", title: "Simulacro de examen", icon: ClipboardList },
];

type Health = "loading" | "online" | "error";
export function ApiStatus() {
  const [status, setStatus] = useState<Health>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    setStatus("loading");
    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("API unavailable");
        const data = await response.json();
        if (data.status !== "ok" || data.service !== "aulasync-api")
          throw new Error("Invalid response");
        if (!cancelled) setStatus("online");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  return (
    <div className="api-status" role="status">
      <span className={`status-dot ${status}`} />
      <span>
        {status === "loading"
          ? "Consultando API…"
          : status === "online"
            ? "API disponible"
            : "API sin conexión"}
      </span>
      {status === "error" && (
        <button className="retry" onClick={() => setAttempt(attempt + 1)}>
          Reintentar
        </button>
      )}
    </div>
  );
}

function PrivateShell() {
  const auth = useAuth();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function signOut() {
    setLogoutBusy(true);
    setLogoutError("");
    try {
      await auth.logout();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "No se pudo cerrar sesión.",
      );
    } finally {
      setLogoutBusy(false);
    }
  }
  const {
    isMobile,
    mobileOpen,
    menuButtonRef,
    sidebarRef,
    openMenu,
    closeMenu,
  } = useMobileNavigation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" inert={mobileOpen}>
        Saltar al contenido
      </a>
      <button
        className="mobile-menu"
        ref={menuButtonRef}
        aria-label="Abrir navegación"
        aria-expanded={mobileOpen}
        aria-controls="sidebar"
        aria-haspopup="dialog"
        inert={mobileOpen}
        onClick={openMenu}
      >
        <Menu />
        <span>AulaSync</span>
      </button>
      {mobileOpen && (
        <button
          className="menu-overlay"
          aria-hidden="true"
          tabIndex={-1}
          onClick={closeMenu}
        />
      )}
      <aside
        id="sidebar"
        ref={sidebarRef}
        className={`sidebar ${mobileOpen ? "open" : ""}`}
        hidden={isMobile && !mobileOpen}
        inert={isMobile && !mobileOpen}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Menú de navegación" : undefined}
      >
        <button
          hidden={!isMobile}
          className="mobile-nav-close"
          onClick={closeMenu}
          aria-label="Cerrar navegación"
        >
          <X size={20} /> Cerrar
        </button>
        <Link
          className="brand"
          to="/"
          aria-label="AulaSync"
          onClick={closeMenu}
        >
          <span className="brand-icon">
            <GraduationCap size={27} />
          </span>
          Aula<span>Sync</span>
        </Link>
        <div className="workspace-label">ESPACIO DE ESTUDIO</div>
        <nav aria-label="Navegación principal">
          <NavLink end to="/" onClick={closeMenu}>
            <LayoutDashboard size={20} />
            Inicio
          </NavLink>
          {sections.map(({ path, title, icon: Icon }) => (
            <NavLink key={path} to={path} onClick={closeMenu}>
              <Icon size={20} />
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="project-note">
            <span className="project-note-icon">
              <BookOpen size={19} />
            </span>
            <h3>Aprender también es organizarse.</h3>
            <p>Tu próximo gran paso empieza con una idea clara.</p>
          </div>
          <div className="sidebar-footer">
            <span className="utn-mark">UTN</span>
            <div>
              Proyecto académico<small>Metodología en Sistemas</small>
            </div>
            <PanelLeftClose size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={mobileOpen}>
        <header className="topbar">
          <div className="breadcrumb">
            Mi espacio <ChevronRight size={14} />
            <span>AulaSync</span>
          </div>
          <div className="topbar-right">
            <ApiStatus />
            <span className="version-badge">SPRINT 05</span>
            <button
              className="secondary-button logout-button"
              disabled={logoutBusy}
              onClick={() => void signOut()}
            >
              {logoutBusy ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {auth.notice && (
            <div className="feedback success" role="status">
              {auth.notice}
              <button
                aria-label="Cerrar confirmación"
                onClick={auth.dismissNotice}
              >
                ×
              </button>
            </div>
          )}
          {logoutError && (
            <div className="feedback error" role="alert">
              {logoutError}
            </div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/materias" element={<MateriasPage />} />
            <Route path="/actividades" element={<ActividadesPage />} />
            <Route path="/materiales" element={<MaterialesPage />} />
            <Route path="/resumenes" element={<ResumenesPage />} />
            <Route path="/simulacro" element={<SimulacroPage />} />
            <Route
              path="*"
              element={
                <section className="empty-state">
                  <h1>Página no encontrada</h1>
                  <p>La dirección que buscás no existe.</p>
                  <Link className="primary-button" to="/">
                    Volver al inicio
                  </Link>
                </section>
              }
            />
          </Routes>
        </main>
        <footer className="main-footer">
          <span>
            AulaSync <span className="footer-dot">·</span> Organización para
            aprender mejor.
          </span>
          <span>Hecho para estudiantes.</span>
        </footer>
      </div>
    </div>
  );
}

function AppRoutes() {
  const auth = useAuth();
  if (auth.status === "loading")
    return (
      <main className="connection-screen">
        <p role="status">Consultando tu sesión…</p>
      </main>
    );
  if (auth.status === "error")
    return (
      <main className="connection-screen">
        <section className="form-panel">
          <h1>No pudimos abrir AulaSync</h1>
          <p role="alert">{auth.error}</p>
          <button
            className="primary-button"
            onClick={() => void auth.refreshSession()}
          >
            Reintentar conexión
          </button>
        </section>
      </main>
    );
  return (
    <Routes>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route
        path="/registro"
        element={<AuthPage key="register" mode="register" />}
      />
      <Route
        path="/*"
        element={
          auth.usuario ? <PrivateShell /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}
export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

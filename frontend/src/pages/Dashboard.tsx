import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useMaterias } from "../hooks/useMaterias";
export function Dashboard() {
  const { usuario } = useAuth();
  const { materias, loading, error, reload } = useMaterias();
  return (
    <>
      <div className="eyebrow">TU ESPACIO ACADÉMICO</div>
      <div className="page-heading">
        <div>
          <h1>Hola, {usuario?.nombre}.</h1>
          <p>Tu organización académica, en un mismo lugar.</p>
        </div>
        <span className="semester">UTN · Metodología en Sistemas</span>
      </div>
      <section className="welcome-card">
        <div className="welcome-content">
          <span className="pill">TU ESPACIO, A TU RITMO</span>
          <h2>
            Más claridad.
            <br />
            Más espacio para aprender.
          </h2>
          <p>
            Organizá las materias de tu carrera y mantené una descripción de
            cada una.
          </p>
          <Link className="primary-button" to="/materias">
            Ver mis materias <ArrowRight size={17} />
          </Link>
        </div>
        <div className="dashboard-art" aria-hidden="true">
          <GraduationCap size={110} />
        </div>
      </section>
      <div className="section-heading">
        <h2>Tu actividad académica</h2>
      </div>
      {loading ? (
        <p role="status">Cargando tu espacio…</p>
      ) : error ? (
        <div className="feedback error" role="alert">
          {error}
          <button className="secondary-button" onClick={() => void reload()}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="academic-stat">
            <span className="module-icon tone-0">
              <BookOpen />
            </span>
            <div>
              <strong>{materias.length}</strong>
              <span>
                {materias.length === 1
                  ? "materia registrada"
                  : "materias registradas"}
              </span>
            </div>
            <Link to="/materias">
              Gestionar materias <ArrowRight size={16} />
            </Link>
          </div>
          <div className="section-heading">
            <h2>Últimas materias agregadas</h2>
          </div>
          {materias.length ? (
            <div className="subjects-grid">
              {materias.slice(0, 4).map((materia) => (
                <Link to="/materias" className="subject-card" key={materia.id}>
                  <BookOpen size={22} />
                  <h3>{materia.nombre}</h3>
                  <p>{materia.descripcion || "Sin descripción."}</p>
                </Link>
              ))}
            </div>
          ) : (
            <section className="empty-state compact">
              <BookOpen size={30} />
              <h2>Aún no agregaste materias</h2>
              <p>Cuando crees una, aparecerá en este espacio.</p>
              <Link className="primary-button" to="/materias">
                Agregar mi primera materia <ArrowRight size={16} />
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}

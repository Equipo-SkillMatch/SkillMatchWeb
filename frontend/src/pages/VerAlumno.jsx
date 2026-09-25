import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../CSS/VerAlumno.css';
import { API_BASE, buildFileUrl } from '../config/api';
import AppIcon from '../components/AppIcon';

const splitList = (value) => String(value || '')
  .split(',')
  .map((item) => item.replace(/[\[\]"']/g, '').trim())
  .filter(Boolean);

const initials = (name) => name
  ? name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  : 'ST';

function ProjectCover({ project }) {
  const media = Array.isArray(project?.media) ? project.media : [];
  const first = project?.img_principal || media.find((item) => item?.tipo === 'imagen')?.ruta_archivo || '';
  if (!first) {
    return (
      <div className="student-project-cover student-project-cover--empty">
        <AppIcon name="image" size={28} />
        <span>Sin portada</span>
      </div>
    );
  }
  return <img className="student-project-cover" src={buildFileUrl(first)} alt={`Portada de ${project.titulo}`} />;
}

export default function VerAlumno() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [alumno, setAlumno] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    const cargarPerfilAlumno = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/estudiante/perfil-publico/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo cargar el perfil.');
        setAlumno(data.alumno);
        setProyectos(data.proyectos || []);
      } catch (err) {
        setError(err.message || 'Error de conexión con el servidor.');
      } finally {
        setLoading(false);
      }
    };
    cargarPerfilAlumno();
  }, [id]);

  const tecnologias = useMemo(() => splitList(alumno?.competencias), [alumno?.competencias]);
  const idiomas = useMemo(() => splitList(alumno?.idiomas), [alumno?.idiomas]);
  const links = [
    ['LinkedIn', alumno?.linkedin],
    ['GitHub', alumno?.github],
    ['Portafolio', alumno?.portafolio],
  ].filter(([, value]) => value);

  if (loading) return <div className="student-profile-state">Cargando perfil del estudiante...</div>;
  if (error) return (
    <div className="student-profile-state student-profile-state--error">
      <AppIcon name="alert" size={28} />
      <h3>{error}</h3>
      <button onClick={() => navigate(-1)}>Volver</button>
    </div>
  );

  const soft = alumno?.habilidades_blandas;

  return (
    <div className="perfil-alumno-container">
      <div className="student-profile-shell">
        <button className="btn-back student-back" onClick={() => navigate(-1)}>← Volver</button>

        <div className="student-profile-grid">
          <aside className="student-profile-aside">
            <div className="student-avatar">
              {alumno?.foto_perfil
                ? <img src={buildFileUrl(alumno.foto_perfil)} alt="Foto del estudiante" />
                : initials(`${alumno?.nombre || ''} ${alumno?.apellido || ''}`)}
            </div>
            <h1>{alumno?.nombre} {alumno?.apellido}</h1>
            <p className="student-professional-title">{alumno?.titulo_profesional || alumno?.carrera || 'Estudiante UTEQ'}</p>
            <span className="student-verified"><AppIcon name="check" size={14} /> Estudiante UTEQ</span>

            <div className="student-mini-stats">
              <div><strong>{proyectos.length}</strong><span>Proyectos</span></div>
              <div><strong>{alumno?.semestre || '—'}</strong><span>Cuatrimestre</span></div>
            </div>

            <div className="student-contact-list">
              <div><AppIcon name="mail" /><span>{alumno?.correo || 'Sin correo'}</span></div>
              {alumno?.telefono && <div><AppIcon name="phone" /><span>{alumno.telefono}</span></div>}
              {alumno?.ciudad && <div><AppIcon name="map" /><span>{alumno.ciudad}</span></div>}
            </div>

            {links.length > 0 && (
              <div className="student-link-list">
                {links.map(([label, href]) => (
                  <a key={label} href={/^https?:\/\//i.test(href) ? href : `https://${href}`} target="_blank" rel="noreferrer">
                    <AppIcon name="link" size={16} /> {label}
                  </a>
                ))}
              </div>
            )}
          </aside>

          <main className="student-profile-main">
            <section className="student-section student-about">
              <div className="student-section-head">
                <span>PERFIL PROFESIONAL</span>
                <h2>Sobre el estudiante</h2>
              </div>
              <p>{alumno?.biografia || 'Este estudiante todavía no ha agregado una presentación profesional.'}</p>
              <div className="student-fact-grid">
                <div><span>Carrera</span><strong>{alumno?.carrera || 'No especificada'}</strong></div>
                <div><span>Matrícula</span><strong>{alumno?.matricula || 'No especificada'}</strong></div>
                <div><span>Disponibilidad</span><strong>{alumno?.disponibilidad || 'No especificada'}</strong></div>
                <div><span>Modalidad preferida</span><strong>{alumno?.modalidad_preferida || 'No especificada'}</strong></div>
              </div>
            </section>

            <section className="student-section">
              <div className="student-section-head"><span>COMPETENCIAS</span><h2>Habilidades e idiomas</h2></div>
              <div className="student-skill-groups">
                <div>
                  <h3>Habilidades técnicas</h3>
                  <div className="student-chips">
                    {tecnologias.length ? tecnologias.map((item) => <span key={item}>{item}</span>) : <em>Sin habilidades registradas</em>}
                  </div>
                </div>
                <div>
                  <h3>Idiomas</h3>
                  <div className="student-chips student-chips--soft">
                    {idiomas.length ? idiomas.map((item) => <span key={item}>{item}</span>) : <em>Sin idiomas registrados</em>}
                  </div>
                </div>
              </div>
            </section>

            <section className="student-section">
              <div className="student-section-head"><span>SOFT SKILLS</span><h2>Habilidades blandas</h2></div>
              {soft ? (
                <div className="student-soft-grid">
                  {[
                    ['Global', soft.puntaje_total],
                    ['Comunicación', soft.comunicacion],
                    ['Trabajo en equipo', soft.trabajo_equipo],
                    ['Liderazgo', soft.liderazgo],
                    ['Resolución', soft.resolucion_problemas],
                    ['Adaptabilidad', soft.adaptabilidad],
                    ['Profesionalismo', soft.profesionalismo],
                  ].map(([label, value]) => (
                    <div key={label}><span>{label}</span><strong>{value ?? 0}%</strong><i><b style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} /></i></div>
                  ))}
                </div>
              ) : <div className="student-empty"><AppIcon name="brain" /> Aún no completa la evaluación de habilidades blandas.</div>}
            </section>

            <section className="student-section">
              <div className="student-section-head"><span>PORTAFOLIO</span><h2>Proyectos académicos</h2></div>
              {proyectos.length === 0 ? (
                <div className="student-empty"><AppIcon name="folder" /> Este estudiante aún no ha registrado proyectos públicos.</div>
              ) : (
                <div className="student-project-grid">
                  {proyectos.map((project) => (
                    <article key={project.id_proyecto} className="student-project-card">
                      <ProjectCover project={project} />
                      <div className="student-project-body">
                        <div className="student-project-meta">
                          <span>{project.tipo || 'Proyecto universitario'}</span>
                          <time>{project.fecha_registro ? new Date(project.fecha_registro).toLocaleDateString('es-MX') : ''}</time>
                        </div>
                        <h3>{project.titulo}</h3>
                        <p>{project.descripcion || 'Sin descripción.'}</p>
                        <div className="student-chips">
                          {splitList(project.tecnologias).slice(0, 6).map((tech) => <span key={tech}>{tech}</span>)}
                        </div>
                        <button onClick={() => navigate(`/proyecto/${project.id_proyecto}`)}>Ver proyecto <span>→</span></button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

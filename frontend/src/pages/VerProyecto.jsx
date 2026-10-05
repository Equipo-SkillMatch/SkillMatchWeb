import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import '../CSS/VerProyecto.css';
import { API_BASE, buildFileUrl } from '../config/api';
import AppIcon from '../components/AppIcon';
import { showToast } from '../components/InstitutionalUI';

function SafeImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`project-detail-image-fallback ${className}`.trim()}>
        <span><AppIcon name="image" size={30} /></span>
        <strong>Imagen no disponible</strong>
        <small>El resto de la información del proyecto sigue disponible.</small>
      </div>
    );
  }

  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}



function SafeVideo({ src, type, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`project-detail-image-fallback ${className}`.trim()}>
        <AppIcon name="video" size={30} />
        <strong>Video no disponible</strong>
        <small>El archivo pudo haberse perdido en un despliegue anterior. Puedes volver a subirlo desde el perfil del proyecto.</small>
      </div>
    );
  }
  return <video className={className} src={src} controls playsInline preload="metadata" onError={() => setFailed(true)} />;
}

const inferEvidenceMime = (item = {}) => {
  if (item.mime_type) return String(item.mime_type).toLowerCase();
  const source = String(item.ruta_archivo || item.nombre_original || '').split('?')[0].toLowerCase();
  if (/\.(jpe?g)$/.test(source)) return 'image/jpeg';
  if (/\.png$/.test(source)) return 'image/png';
  if (/\.webp$/.test(source)) return 'image/webp';
  if (/\.mp4$/.test(source)) return 'video/mp4';
  if (/\.webm$/.test(source)) return 'video/webm';
  if (/\.mov$/.test(source)) return 'video/quicktime';
  if (/\.pdf$/.test(source)) return 'application/pdf';
  return '';
};

const evidenceName = (item = {}) => {
  if (item.nombre_original) return item.nombre_original;
  const clean = String(item.ruta_archivo || '').split('?')[0];
  return clean.split('/').pop() || 'Documento del proyecto';
};

const formatImpact = (value) => {
  if (value === 'L') return 'Local';
  if (value === 'R') return 'Regional';
  if (value === 'N') return 'Nacional';
  return value || 'No definido';
};

const getInitials = (name = '', lastName = '') => `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'SM';

export default function VerProyecto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proyecto, setProyecto] = useState(null);
  const [evidencias, setEvidencias] = useState([]);
  const [mediaProyecto, setMediaProyecto] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [estrellasReview, setEstrellasReview] = useState(5);
  const [comentarioReview, setComentarioReview] = useState('');
  const [enviandoReview, setEnviandoReview] = useState(false);

  useEffect(() => {
    const cargarDetalle = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const res = await fetch(`${API_BASE}/public/proyectos/${id}`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.mensaje || 'No fue posible cargar el proyecto.');
        }

        setProyecto(data.proyecto);
        setEvidencias(data.evidencias || []);
        setMediaProyecto(data.media || data.proyecto?.media || []);
        setColaboradores(data.colaboradores || []);
        setComentarios(data.comentarios || []);
      } catch (error) {
        console.error('Error al cargar detalle:', error);
        setLoadError(error.message || 'Error de conexión con el servidor.');
      } finally {
        setLoading(false);
      }
    };

    cargarDetalle();
  }, [id]);

  const handleEnviarReseña = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    setEnviandoReview(true);
    try {
      const res = await fetch(`${API_BASE}/public/proyectos/${id}/calificar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estrellas: estrellasReview, comentario: comentarioReview }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.mensaje || 'No fue posible guardar la reseña.');
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Error de conexión al enviar la reseña.',{type:'error'});
    } finally {
      setEnviandoReview(false);
    }
  };

  const imagenes = useMemo(
    () => evidencias.filter((item) => inferEvidenceMime(item).startsWith('image/')),
    [evidencias],
  );
  const videos = useMemo(
    () => evidencias.filter((item) => inferEvidenceMime(item).startsWith('video/')),
    [evidencias],
  );
  const documentos = useMemo(
    () => evidencias.filter((item) => {
      const mime = inferEvidenceMime(item);
      return !mime.startsWith('image/') && !mime.startsWith('video/');
    }),
    [evidencias],
  );

  if (loading) {
    return (
      <div className="project-detail-state">
        <BrandLogo />
        <div className="project-detail-spinner" />
        <p>Cargando proyecto académico...</p>
      </div>
    );
  }

  if (!proyecto) {
    return (
      <div className="project-detail-state">
        <BrandLogo />
        <div className="project-detail-state__icon">!</div>
        <h1>No se encontró el proyecto</h1>
        <p>{loadError || 'El proyecto solicitado no está disponible.'}</p>
        <button type="button" onClick={() => navigate('/')}>Volver a SkillMatch</button>
      </div>
    );
  }

  const rating = Number(proyecto.rating || 0);
  const technologies = String(proyecto.tecnologias || '')
    .split(',')
    .map((item) => item.replaceAll('[', '').replaceAll(']', '').replaceAll('"', '').replaceAll("'", '').trim())
    .filter(Boolean);

  return (
    <div className="project-detail-page">
      <header className="project-detail-header">
        <div className="project-detail-header__inner">
          <button type="button" className="project-detail-brand" onClick={() => navigate('/')} aria-label="Ir a la landing de SkillMatch">
            <BrandLogo />
          </button>
          <div className="project-detail-header__partner">
            <span>Proyecto universitario</span>
            <img src="/logos/uteq-logo.png" alt="UTEQ Universidad Líder" />
          </div>
          <button type="button" className="project-detail-back" onClick={() => navigate(-1)}>← Volver</button>
        </div>
      </header>

      <main className="project-detail-shell">
        <section className="project-detail-intro">
          <div className="project-detail-intro__copy">
            <div className="project-detail-badges">
              <span className="is-blue">✓ Proyecto UTEQ</span>
              <span>{proyecto.area_trabajo || 'Área multidisciplinaria'}</span>
              <span className="is-gold">★ {rating.toFixed(1)} · {proyecto.total_reviews || 0} reseñas</span>
            </div>
            <h1>{proyecto.titulo}</h1>
            <div className="project-detail-author">
              <span className="project-detail-author__avatar">
                <b>{getInitials(proyecto.nombre, proyecto.apellido)}</b>
                {proyecto.foto_creador && (
                  <img src={buildFileUrl(proyecto.foto_creador)} alt="Creador del proyecto" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                )}
              </span>
              <div>
                <small>Realizado por</small>
                <strong>{proyecto.nombre} {proyecto.apellido}</strong>
              </div>
              <span className="project-detail-author__role">Creador</span>
            </div>
          </div>

          <div className="project-detail-intro__summary">
            <div><span>Impacto</span><strong>{formatImpact(proyecto.competencia_impacto)}</strong></div>
            <div><span>Tipo</span><strong>{proyecto.es_innovacion ? 'Innovación' : 'Académico'}</strong></div>
            <div><span>Ámbito</span><strong>{proyecto.ambito_desarrollo || 'No definido'}</strong></div>
          </div>
        </section>

        {colaboradores.length > 0 && (
          <section className="project-detail-collaborators">
            <div><span><AppIcon name="users" size={18} /></span><strong>Equipo colaborador</strong></div>
            <div className="project-detail-collaborators__list">
              {colaboradores.map((colaborador, index) => (
                <a key={`${colaborador.correo}-${index}`} href={`mailto:${colaborador.correo}`}>
                  <span>{getInitials(colaborador.nombre, colaborador.apellido)}</span>
                  <div><strong>{colaborador.nombre} {colaborador.apellido}</strong><small>{colaborador.correo}</small></div>
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="project-detail-layout">
          <div className="project-detail-main">
            <section className="project-detail-media-card project-detail-cover-card">
              {proyecto.img_principal ? (
                <SafeImage src={buildFileUrl(proyecto.img_principal)} alt={`Portada de ${proyecto.titulo}`} className="project-detail-cover" />
              ) : (
                <div className="project-detail-image-fallback">
                  <span>▧</span>
                  <strong>Portada no disponible</strong>
                  <small>La información y las evidencias del proyecto siguen disponibles.</small>
                </div>
              )}
              <div className="project-detail-cover-label">Portada del proyecto</div>
            </section>

            {mediaProyecto.length > 0 && (
              <section className="project-detail-card project-detail-gallery-card">
                <div className="project-detail-section-title"><span>GAL</span><div><small>MULTIMEDIA</small><h2>Galería del proyecto</h2></div></div>
                <p className="project-detail-gallery-copy">Imágenes y videos complementarios cargados por el autor.</p>
                <div className="project-detail-carousel">
                  {mediaProyecto.map((media) => (
                    <div className="project-detail-slide" key={media.id_media || media.ruta_archivo}>
                      {String(media.mime_type || '').startsWith('video/') || media.tipo === 'video' ? (
                        <SafeVideo src={buildFileUrl(media.ruta_archivo)} type={media.mime_type || 'video/mp4'} />
                      ) : (
                        <SafeImage src={buildFileUrl(media.ruta_archivo)} alt={`Galería de ${proyecto.titulo}`} />
                      )}
                    </div>
                  ))}
                </div>
                {mediaProyecto.length > 1 && <div className="project-detail-swipe-note">Desliza para ver {mediaProyecto.length} archivos</div>}
              </section>
            )}

            <section className="project-detail-card">
              <div className="project-detail-section-title"><span>01</span><div><small>CONTEXTO</small><h2>Descripción del proyecto</h2></div></div>
              <p className="project-detail-description">{proyecto.descripcion || 'No se agregó una descripción.'}</p>
              <div className="project-detail-two-columns">
                <article><span><AppIcon name="target" size={20} /></span><div><h3>Objetivo</h3><p>{proyecto.objetivo || 'No especificado'}</p></div></article>
                <article><span><AppIcon name="clipboard" size={20} /></span><div><h3>Actividades</h3><p>{proyecto.actividades || 'No especificadas'}</p></div></article>
              </div>
            </section>

            <section className="project-detail-card">
              <div className="project-detail-section-title"><span>02</span><div><small>RESULTADOS</small><h2>Evidencias y entregables</h2></div></div>

              {imagenes.length > 0 && (
                <div className="project-detail-evidence-block">
                  <h3>Galería de imágenes</h3>
                  <div className="project-detail-image-grid">
                    {imagenes.map((imagen) => (
                      <a key={imagen.id_evidencia} href={buildFileUrl(imagen.ruta_archivo)} target="_blank" rel="noreferrer">
                        <SafeImage src={buildFileUrl(imagen.ruta_archivo)} alt={imagen.nombre_original || 'Evidencia del proyecto'} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {documentos.length > 0 && (
                <div className="project-detail-evidence-block">
                  <h3>Documentación</h3>
                  <div className="project-detail-file-list">
                    {documentos.map((pdf) => (
                      <a key={pdf.id_evidencia} href={buildFileUrl(pdf.ruta_archivo)} target="_blank" rel="noreferrer">
                        <span>{inferEvidenceMime(pdf) === 'application/pdf' ? 'PDF' : 'DOC'}</span><div><strong>{evidenceName(pdf)}</strong><small>Abrir documentación en una pestaña nueva</small></div><b>↗</b>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {videos.length > 0 && (
                <div className="project-detail-evidence-block">
                  <h3>Demos en video</h3>
                  <div className="project-detail-video-grid">
                    {videos.map((video) => (
                      <article key={video.id_evidencia}>
                        <SafeVideo src={buildFileUrl(video.ruta_archivo)} type={inferEvidenceMime(video) || 'video/mp4'} />
                        <strong>{video.nombre_original || 'Video del proyecto'}</strong>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {evidencias.length === 0 && (
                <div className="project-detail-empty"><span><AppIcon name="folder" size={24} /></span><div><strong>Sin evidencias publicadas</strong><p>El equipo todavía no ha agregado archivos entregables.</p></div></div>
              )}
            </section>

            <section className="project-detail-card">
              <div className="project-detail-section-title"><span>03</span><div><small>COMUNIDAD</small><h2>Reseñas y comentarios</h2></div></div>

              {localStorage.getItem('token') ? (
                <form className="project-detail-review-form" onSubmit={handleEnviarReseña}>
                  <div>
                    <label htmlFor="project-rating">Calificación</label>
                    <select id="project-rating" value={estrellasReview} onChange={(event) => setEstrellasReview(Number(event.target.value))}>
                      <option value={5}>★★★★★ · Excelente</option>
                      <option value={4}>★★★★☆ · Muy bueno</option>
                      <option value={3}>★★★☆☆ · Bueno</option>
                      <option value={2}>★★☆☆☆ · Regular</option>
                      <option value={1}>★☆☆☆☆ · Deficiente</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="project-comment">Comentario</label>
                    <textarea id="project-comment" required value={comentarioReview} onChange={(event) => setComentarioReview(event.target.value)} placeholder="Comparte una opinión o sugerencia para el equipo..." />
                  </div>
                  <button type="submit" disabled={enviandoReview}>{enviandoReview ? 'Publicando...' : 'Publicar reseña'}</button>
                </form>
              ) : (
                <div className="project-detail-login-prompt">
                  <div><span><AppIcon name="bot" size={20} /></span><div><strong>Participa en la conversación</strong><p>Inicia sesión para calificar y dejar un comentario.</p></div></div>
                  <button type="button" onClick={() => navigate('/login')}>Iniciar sesión</button>
                </div>
              )}

              <div className="project-detail-comments">
                {comentarios.length > 0 ? comentarios.map((comentario, index) => (
                  <article key={`${comentario.fecha_registro}-${index}`}>
                    <header>
                      <span>{getInitials(comentario.nombre, comentario.apellido)}</span>
                      <div><strong>{comentario.nombre} {comentario.apellido}</strong><small>{new Date(comentario.fecha_registro).toLocaleDateString('es-MX')}</small></div>
                      <b>{'★'.repeat(comentario.estrellas)}{'☆'.repeat(5 - comentario.estrellas)}</b>
                    </header>
                    <p>{comentario.comentario || 'El usuario dejó una calificación sin comentario de texto.'}</p>
                  </article>
                )) : (
                  <div className="project-detail-empty"><span><AppIcon name="file" size={24} /></span><div><strong>Aún no hay reseñas</strong><p>Sé la primera persona en compartir una opinión.</p></div></div>
                )}
              </div>
            </section>
          </div>

          <aside className="project-detail-sidebar">
            <section>
              <small>FICHA TÉCNICA</small>
              <h2>Información clave</h2>
              <dl>
                <div><dt>Ámbito de desarrollo</dt><dd>{proyecto.ambito_desarrollo || 'No definido'}</dd></div>
                <div><dt>Nivel de impacto</dt><dd>{formatImpact(proyecto.competencia_impacto)}</dd></div>
                <div><dt>Clasificación</dt><dd>{proyecto.es_innovacion ? 'Proyecto de innovación' : 'Proyecto académico'}</dd></div>
              </dl>
            </section>

            <section>
              <small>TECNOLOGÍAS</small>
              <h2>Herramientas utilizadas</h2>
              <div className="project-detail-tags">
                {technologies.length > 0 ? technologies.map((technology) => <span key={technology}>{technology}</span>) : <p>No se registraron tecnologías.</p>}
              </div>
            </section>

            <button type="button" className="project-detail-sidebar__cta" onClick={() => navigate('/registro')}>
              <span>¿También tienes un proyecto?</span>
              <strong>Crea tu perfil en SkillMatch</strong>
              <b>Empezar ahora →</b>
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}

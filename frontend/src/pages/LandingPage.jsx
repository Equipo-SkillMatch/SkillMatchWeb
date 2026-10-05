import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import '../CSS/LandingPage.css';
import { API_BASE, buildFileUrl } from '../config/api';
import BrandLogo from '../components/BrandLogo';
import Reveal from '../components/Reveal';
import AppIcon from '../components/AppIcon';
import { showToast } from '../components/InstitutionalUI';

const benefits = [
  {
    icon: '01',
    title: 'Talento con evidencia',
    text: 'Portafolios académicos, habilidades y proyectos reunidos en un perfil verificable.',
  },
  {
    icon: '02',
    title: 'Vinculación inteligente',
    text: 'Empresas y universidad encuentran perfiles relevantes con filtros claros y datos útiles.',
  },
  {
    icon: '03',
    title: 'Seguimiento real',
    text: 'Postulaciones, vacantes, evidencias y avances visibles para cada tipo de usuario.',
  },
];

const steps = [
  { n: '01', title: 'Crea tu perfil', text: 'Registra tu información académica, experiencia, habilidades y disponibilidad.' },
  { n: '02', title: 'Muestra lo que sabes', text: 'Publica proyectos con imágenes, videos, documentos y tecnologías utilizadas.' },
  { n: '03', title: 'Conecta con oportunidades', text: 'Postúlate a vacantes o encuentra talento universitario con mayor precisión.' },
];

const roles = [
  { icon: 'users', title: 'Estudiantes', text: 'Construyen su portafolio, exploran vacantes y dan seguimiento a postulaciones.' },
  { icon: 'building', title: 'Empresas', text: 'Publican oportunidades, revisan perfiles y encuentran candidatos compatibles.' },
  { icon: 'teacher', title: 'Profesores', text: 'Acompañan proyectos, evidencias y crecimiento académico de sus estudiantes.' },
  { icon: 'report', title: 'Vinculación', text: 'Administra empresas, vacantes, candidatos y métricas desde un solo panel.' },
];

const testimonials = [
  {
    text: 'SkillMatch me permitió presentar mis proyectos como experiencia real y no solo como tareas de clase.',
    name: 'Andrea López',
    role: 'Estudiante de TI',
    initials: 'AL',
  },
  {
    text: 'Podemos revisar habilidades, evidencia y proyectos antes de contactar a un candidato.',
    name: 'Carlos Mendoza',
    role: 'Empresa aliada',
    initials: 'CM',
  },
  {
    text: 'La plataforma facilita el seguimiento académico y mejora la vinculación con el sector productivo.',
    name: 'Dra. Ramírez',
    role: 'Docente universitaria',
    initials: 'DR',
  },
];


const normalizeTags = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch (error) {
      // El backend también puede devolver una cadena separada por comas.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const getInitials = (nombre, apellido) => {
  if (!nombre) return 'SM';
  return `${nombre[0] || ''}${apellido?.[0] || ''}`.toUpperCase();
};

const getDashboardPath = (role) => {
  const value = String(role || '');
  if (value === '3') return '/dashboard-empresa';
  if (value === '4') return '/dashboard-profesores';
  if (value === '1' || value === '5') return '/dashboard-vinculacion';
  if (value === '2') return '/dashboard-estudiante';
  return '/';
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


const inferVisualType = (item = {}) => {
  const mime = String(item?.mime_type || '').toLowerCase();
  const path = String(item?.ruta_archivo || item?.url || item || '').split('?')[0].toLowerCase();
  if (item?.tipo === 'video' || mime.startsWith('video/') || /\.(mp4|webm|mov)$/.test(path)) return 'video';
  return 'imagen';
};

const getProjectVisual = (project = {}) => {
  if (project.img_principal) {
    return { ruta_archivo: project.img_principal, tipo: inferVisualType(project.img_principal) };
  }
  const media = Array.isArray(project.media) ? project.media : [];
  return media.find((item) => item?.ruta_archivo) || null;
};

function ProjectCardVisual({ project }) {
  const [failed, setFailed] = useState(false);
  const visual = getProjectVisual(project);
  const src = visual?.ruta_archivo ? buildFileUrl(visual.ruta_archivo) : '';
  const tipo = visual ? inferVisualType(visual) : '';

  if (!src || failed) {
    return <div className="project-placeholder"><AppIcon name="image" size={28} /><small>Multimedia no disponible</small></div>;
  }

  if (tipo === 'video') {
    return (
      <video
        className="project-card__visual"
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onCanPlay={(event) => event.currentTarget.play().catch(() => {})}
        onError={() => setFailed(true)}
      />
    );
  }

  return <img className="project-card__visual" src={src} alt={project.title || project.titulo || 'Proyecto SkillMatch'} loading="lazy" onError={() => setFailed(true)} />;
}

function StarRating({ rating = 0 }) {
  return (
    <span className="project-stars" aria-label={`${Number(rating).toFixed(1)} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < Math.round(Number(rating) || 0) ? 'is-filled' : ''}>★</span>
      ))}
    </span>
  );
}

function InteractiveStars({ value = 0, onRate }) {
  return (
    <div className="project-rate" aria-label="Calificar proyecto">
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        return (
          <button key={star} type="button" onClick={() => onRate(star)} aria-label={`Calificar con ${star} estrellas`}>
            <span className={star <= value ? 'is-filled' : ''}>★</span>
          </button>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [loadingProyectos, setLoadingProyectos] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginView, setIsLoginView] = useState(false);
  const [authForm, setAuthForm] = useState({ nombre: '', apellido: '', correo: '', password: '' });
  const [pendingRating, setPendingRating] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const whatsappUrl = 'https://wa.me/525661900743?text=Hola,%20tengo%20una%20duda%20sobre%20SkillMatch';

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        setIsAuthenticated(true);
        setUserData(JSON.parse(storedUser));
        return;
      } catch (error) {
        console.error('No fue posible leer la sesión:', error);
      }
    }
    setIsAuthenticated(false);
    setUserData({});
    setShowUserMenu(false);
  }, []);

  useEffect(() => {
    checkAuth();
    window.addEventListener('storage', checkAuth);
    window.addEventListener('focus', checkAuth);
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('focus', checkAuth);
    };
  }, [checkAuth]);

  useEffect(() => {
    const cargarProyectos = async () => {
      try {
        const response = await fetch(`${API_BASE}/public/proyectos`);
        const data = await response.json();
        if (data.ok) {
          setProyectos((data.proyectos || []).map((project) => ({
            ...project,
            userRating: Math.round(Number(project.rating) || 0),
          })));
        }
      } catch (error) {
        console.error('Error al cargar proyectos públicos:', error);
      } finally {
        setLoadingProyectos(false);
      }
    };
    cargarProyectos();
  }, []);

  const featuredProjects = useMemo(() => proyectos.slice(0, 6), [proyectos]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileNavOpen(false);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUserData({});
    setShowUserMenu(false);
  };

  const enviarCalificacionBackend = async (idProyecto, estrellas, token, index) => {
    try {
      const response = await fetch(`${API_BASE}/public/proyectos/${idProyecto}/calificar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estrellas, comentario: '' }),
      });
      const data = await response.json();
      if (!data.ok) {
        showToast(data.mensaje || 'No fue posible registrar la calificación.',{type:'error'});
        return;
      }
      setProyectos((current) => current.map((project, projectIndex) => (
        projectIndex === index ? { ...project, userRating: estrellas } : project
      )));
      showToast('Tu calificación fue registrada.',{type:'success'});
    } catch (error) {
      showToast('Error de conexión al calificar.',{type:'error'});
    }
  };

  const handleRate = (index, idProyecto, estrellas) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setPendingRating({ index, idProyecto, estrellas });
      setShowAuthModal(true);
      return;
    }
    enviarCalificacionBackend(idProyecto, estrellas, token, index);
  };

  const submitAuthModal = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const endpoint = isLoginView ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
    const payload = isLoginView
      ? { correo: authForm.correo, password: authForm.password }
      : { ...authForm, id_rol: 6 };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.ok) {
        setAuthError(data.mensaje || 'No fue posible completar el acceso.');
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.usuario));
      setIsAuthenticated(true);
      setUserData(data.usuario);
      setShowAuthModal(false);
      if (pendingRating) {
        await enviarCalificacionBackend(
          pendingRating.idProyecto,
          pendingRating.estrellas,
          data.token,
          pendingRating.index,
        );
        setPendingRating(null);
      }
    } catch (error) {
      setAuthError('Error de conexión con el servidor.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header__inner">
          <button type="button" className="brand-button" onClick={() => scrollTo('inicio')} aria-label="Ir al inicio">
            <BrandLogo />
          </button>

          <button
            type="button"
            className="mobile-nav-button"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-label="Abrir menú"
            aria-expanded={mobileNavOpen}
          >
            <span /><span /><span />
          </button>

          <nav className={`landing-nav ${mobileNavOpen ? 'is-open' : ''}`}>
            <button type="button" onClick={() => scrollTo('beneficios')}>Beneficios</button>
            <button type="button" onClick={() => scrollTo('como-funciona')}>Cómo funciona</button>
            <button type="button" onClick={() => scrollTo('proyectos')}>Proyectos</button>
            <button type="button" onClick={() => scrollTo('roles')}>Para quién es</button>
          </nav>

          <div className="landing-header__actions">
            {isAuthenticated ? (
              <div className="user-menu">
                <button type="button" className="user-avatar" onClick={() => setShowUserMenu((current) => !current)}>
                  {getInitials(userData.nombre, userData.apellido)}
                </button>
                {showUserMenu && (
                  <div className="user-popover">
                    <strong>{userData.nombre} {userData.apellido}</strong>
                    <span>{userData.correo}</span>
                    {String(userData.id_rol) !== '6' && (
                      <button type="button" onClick={() => navigate(getDashboardPath(userData.id_rol))}>Abrir mi panel</button>
                    )}
                    <button type="button" className="is-danger" onClick={cerrarSesion}>Cerrar sesión</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button type="button" className="button button--ghost header-login" onClick={() => navigate('/login')}>Iniciar sesión</button>
                <button type="button" className="button button--primary" onClick={() => navigate('/registro')}>Crear cuenta <ArrowIcon /></button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-orb hero-orb--one" />
          <div className="hero-orb hero-orb--two" />
          <div className="hero__inner">
            <div className="hero__copy">
              <div className="hero-eyebrow"><span /> Vinculación universitaria, simplificada</div>
              <h1>Tu talento merece <em>oportunidades reales.</em></h1>
              <p>
                SkillMatch conecta estudiantes, profesores, empresas y vinculación en una plataforma donde los proyectos se convierten en experiencia demostrable.
              </p>
              <div className="hero__actions">
                <button type="button" className="button button--primary button--large" onClick={() => navigate('/registro')}>
                  Crear mi perfil <ArrowIcon />
                </button>
                <button type="button" className="button button--soft button--large" onClick={() => scrollTo('proyectos')}>
                  Explorar proyectos
                </button>
              </div>
              <div className="hero-proof">
                <div className="hero-proof__avatars"><span>AL</span><span>CM</span><span>DR</span><span>+8</span></div>
                <div><strong>Una comunidad que muestra resultados</strong><small>Perfiles, proyectos y oportunidades en un mismo espacio.</small></div>
              </div>
            </div>

            <div className="hero-visual" aria-label="Vista previa de SkillMatch">
              <div className="hero-grid" />
              <div className="dashboard-preview">
                <div className="dashboard-preview__top">
                  <div className="preview-brand"><img src="/logos/skillmatch-logo.png" alt="" /><span>Panel de talento</span></div>
                  <div className="preview-avatar">DH</div>
                </div>
                <div className="dashboard-preview__content">
                  <div className="preview-heading"><div><small>BUENAS TARDES</small><strong>Encuentra tu siguiente oportunidad</strong></div><span>● En línea</span></div>
                  <div className="preview-kpis">
                    <div><span>Proyectos</span><strong>12</strong><small>+3 este mes</small></div>
                    <div><span>Postulaciones</span><strong>08</strong><small>4 en revisión</small></div>
                    <div><span>Compatibilidad</span><strong>92%</strong><small>Perfil destacado</small></div>
                  </div>
                  <div className="preview-chart">
                    <div className="preview-chart__head"><strong>Actividad del perfil</strong><span>Últimos 6 meses</span></div>
                    <div className="preview-chart__bars">
                      {[38, 58, 47, 76, 64, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
                    </div>
                  </div>
                  <div className="preview-opportunity">
                    <div className="preview-opportunity__icon">JS</div>
                    <div><strong>Desarrollador Front-end Jr.</strong><span>Coincidencia alta · Querétaro</span></div>
                    <button type="button" aria-label="Ver oportunidad"><ArrowIcon /></button>
                  </div>
                </div>
              </div>
              <a className="hero-bot-card" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Abrir el bot de SkillMatch en WhatsApp">
                <div className="hero-bot-card__qr"><QRCodeSVG value={whatsappUrl} size={88} level="H" /></div>
                <div className="hero-bot-card__copy">
                  <span>BOT SKILLMATCH</span>
                  <strong>¿Necesitas ayuda?</strong>
                  <small>Escanea el QR y conversa por WhatsApp.</small>
                </div>
              </a>
              <div className="floating-card floating-card--match"><span>Coincidencia</span><strong>92%</strong><small>React · Node.js · UX</small></div>
              <div className="floating-card floating-card--verified"><div><CheckIcon /></div><span><strong>Perfil verificado</strong><small>Información académica validada</small></span></div>
            </div>
          </div>
          <div className="hero-partners">
            <span>Impulsado para talento universitario</span>
            <div><img src="/logos/uteq-logo.png" alt="UTEQ Universidad Líder" /><div className="partner-divider" /><BrandLogo compact /></div>
          </div>
        </section>

        <section className="section section--light" id="beneficios">
          <div className="section__inner">
            <Reveal className="section-heading">
              <span className="section-kicker">UNA MEJOR FORMA DE VINCULAR</span>
              <h2>Del aula al mundo profesional,<br />sin perder el contexto.</h2>
              <p>Información clara, experiencias demostrables y herramientas diseñadas para cada participante.</p>
            </Reveal>
            <div className="benefit-grid">
              {benefits.map((benefit, index) => (
                <Reveal key={benefit.title} className="benefit-card" delay={index * 100}>
                  <div className="benefit-card__number">{benefit.icon}</div>
                  <div className="benefit-card__visual">
                    {index === 0 && <div className="mini-profile"><span>DH</span><div><i /><i /><i /></div><b>✓</b></div>}
                    {index === 1 && <div className="mini-match"><i>React</i><i>Node</i><strong>92%</strong><i>UX</i></div>}
                    {index === 2 && <div className="mini-stats"><i style={{ height: '42%' }} /><i style={{ height: '68%' }} /><i style={{ height: '55%' }} /><i style={{ height: '88%' }} /></div>}
                  </div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--navy" id="como-funciona">
          <div className="section__inner how-layout">
            <Reveal className="how-copy">
              <span className="section-kicker section-kicker--light">CÓMO FUNCIONA</span>
              <h2>Un proceso simple para demostrar, descubrir y conectar.</h2>
              <p>La plataforma organiza cada paso para que el talento sea fácil de entender y las oportunidades fáciles de encontrar.</p>
              <button type="button" className="button button--gold button--large" onClick={() => navigate('/registro')}>Comenzar ahora <ArrowIcon /></button>
            </Reveal>
            <div className="steps-list">
              {steps.map((step, index) => (
                <Reveal key={step.n} className="step-item" delay={index * 110}>
                  <span>{step.n}</span><div><h3>{step.title}</h3><p>{step.text}</p></div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section projects-section" id="proyectos">
          <div className="section__inner">
            <Reveal className="section-heading section-heading--row">
              <div><span className="section-kicker">PROYECTOS DESTACADOS</span><h2>El talento se demuestra creando.</h2></div>
              <p>Explora proyectos publicados por la comunidad y conoce las habilidades detrás de cada solución.</p>
            </Reveal>

            <div className="projects-grid">
              {loadingProyectos ? (
                Array.from({ length: 3 }, (_, index) => <div className="project-card project-card--loading" key={index}><div /><span /><span /><span /></div>)
              ) : featuredProjects.length === 0 ? (
                <div className="projects-empty">
                  <img src="/logos/skillmatch-logo.png" alt="" />
                  <h3>Los próximos proyectos aparecerán aquí</h3>
                  <p>La plataforma está lista para mostrar imágenes, videos, tecnologías, autores y calificaciones.</p>
                </div>
              ) : (
                featuredProjects.map((project, index) => (
                  <Reveal className="project-card" key={project.id_proyecto || index} delay={(index % 3) * 80}>
                    <div className="project-card__media">
                      <ProjectCardVisual project={project} />
                      <span className="verified-chip"><CheckIcon /> Proyecto verificado</span>
                    </div>
                    <div className="project-card__body">
                      <div className="project-card__meta"><span>{project.area_trabajo || project.categoria || 'Proyecto universitario'}</span><small>{project.estado || 'Publicado'}</small></div>
                      <h3>{project.title || project.titulo}</h3>
                      <p>{project.desc || project.descripcion || 'Conoce el propósito, tecnologías y resultados de este proyecto.'}</p>
                      <div className="project-tags">
                        {normalizeTags(project.tags || project.tecnologias).slice(0, 4).map((tag) => <span key={String(tag)}>{String(tag)}</span>)}
                      </div>
                      <div className="project-author-row">
                        <div className="project-author">
                          {project.foto_creador ? <img src={buildFileUrl(project.foto_creador)} alt="" /> : <span>{getInitials(project.nombre || project.author, project.apellido)}</span>}
                          <div><strong>{project.author || `${project.nombre || ''} ${project.apellido || ''}`.trim() || 'Talento SkillMatch'}</strong><small>Autor del proyecto</small></div>
                        </div>
                        <button type="button" className="project-open" onClick={() => navigate(`/proyecto/${project.id_proyecto}`)} aria-label="Explorar proyecto"><ArrowIcon /></button>
                      </div>
                      <div className="project-rating-row">
                        <div><StarRating rating={project.rating} /><small>{Number(project.rating || 0).toFixed(1)} · {project.total_reviews || 0} reseñas</small></div>
                        <InteractiveStars value={project.userRating} onRate={(stars) => handleRate(index, project.id_proyecto, stars)} />
                      </div>
                    </div>
                  </Reveal>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="section section--light" id="roles">
          <div className="section__inner">
            <Reveal className="section-heading section-heading--center">
              <span className="section-kicker">UNA PLATAFORMA, CUATRO EXPERIENCIAS</span>
              <h2>Cada usuario encuentra exactamente lo que necesita.</h2>
              <p>Dashboards consistentes, métricas relevantes y flujos adaptados a cada rol.</p>
            </Reveal>
            <div className="roles-grid">
              {roles.map((role, index) => (
                <Reveal className="role-card" key={role.title} delay={index * 80}>
                  <span className="role-card__icon"><AppIcon name={role.icon} size={24} /></span><h3>{role.title}</h3><p>{role.text}</p><i><ArrowIcon /></i>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section testimonials-section">
          <div className="section__inner">
            <Reveal className="section-heading section-heading--center">
              <span className="section-kicker">EXPERIENCIAS</span>
              <h2>Una comunidad conectada por lo que sabe hacer.</h2>
            </Reveal>
            <div className="testimonials-grid">
              {testimonials.map((testimonial, index) => (
                <Reveal className="testimonial-card" key={testimonial.name} delay={index * 90}>
                  <div className="testimonial-stars">★★★★★</div>
                  <blockquote>“{testimonial.text}”</blockquote>
                  <div><span>{testimonial.initials}</span><p><strong>{testimonial.name}</strong><small>{testimonial.role}</small></p></div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="contact-band" id="contacto">
          <div className="contact-band__inner">
            <Reveal className="contact-card">
              <div className="contact-card__copy">
                <span className="section-kicker section-kicker--light">¿TIENES DUDAS?</span>
                <h2>Conversemos sobre SkillMatch.</h2>
                <p>Escanea el código o abre WhatsApp para recibir orientación sobre acceso, perfiles y uso de la plataforma.</p>
                <a className="button button--gold button--large" href={whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp <ArrowIcon /></a>
              </div>
              <div className="contact-qr"><QRCodeSVG value={whatsappUrl} size={150} level="H" /><span>Escanea para conversar</span></div>
            </Reveal>
          </div>
        </section>

        <section className="final-cta">
          <div className="final-cta__inner">
            <Reveal>
              <span>Tu siguiente oportunidad puede empezar con un proyecto.</span>
              <h2>Haz visible tu talento.</h2>
              <button type="button" className="button button--gold button--large" onClick={() => navigate('/registro')}>Crear cuenta <ArrowIcon /></button>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div><BrandLogo light /><p>Talento universitario conectado con oportunidades reales.</p></div>
          <div><strong>Plataforma</strong><button type="button" onClick={() => scrollTo('beneficios')}>Beneficios</button><button type="button" onClick={() => scrollTo('proyectos')}>Proyectos</button><button type="button" onClick={() => navigate('/login')}>Iniciar sesión</button></div>
          <div><strong>Legal</strong><button type="button" onClick={() => navigate('/terminos')}>Términos</button><button type="button" onClick={() => navigate('/privacidad')}>Privacidad</button><a href={whatsappUrl} target="_blank" rel="noreferrer">Contacto</a></div>
          <div className="footer-uteq"><span>En colaboración con</span><img src="/logos/uteq-logo.png" alt="UTEQ Universidad Líder" /></div>
        </div>
        <div className="landing-footer__bottom">© 2026 SkillMatch · Querétaro, México · V5.0</div>
      </footer>

      {showAuthModal && (
        <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Acceso para calificar">
          <div className="auth-modal__card">
            <button type="button" className="auth-modal__close" onClick={() => { setShowAuthModal(false); setPendingRating(null); }}>×</button>
            <div className="auth-modal__brand"><BrandLogo compact /><div><span>PARTICIPA EN LA COMUNIDAD</span><h2>Califica este proyecto</h2></div></div>
            <div className="auth-modal__tabs">
              <button type="button" className={!isLoginView ? 'is-active' : ''} onClick={() => { setIsLoginView(false); setAuthError(''); }}>Crear cuenta</button>
              <button type="button" className={isLoginView ? 'is-active' : ''} onClick={() => { setIsLoginView(true); setAuthError(''); }}>Iniciar sesión</button>
            </div>
            {authError && <div className="auth-modal__error">{authError}</div>}
            <form onSubmit={submitAuthModal}>
              {!isLoginView && <div className="auth-modal__row"><input required placeholder="Nombre" value={authForm.nombre} onChange={(event) => setAuthForm({ ...authForm, nombre: event.target.value })} /><input required placeholder="Apellidos" value={authForm.apellido} onChange={(event) => setAuthForm({ ...authForm, apellido: event.target.value })} /></div>}
              <input type="email" required placeholder="Correo electrónico" value={authForm.correo} onChange={(event) => setAuthForm({ ...authForm, correo: event.target.value })} />
              <input type="password" required minLength={6} placeholder="Contraseña" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} />
              <button type="submit" className="button button--primary button--large" disabled={authLoading}>{authLoading ? 'Procesando...' : isLoginView ? 'Entrar y calificar' : 'Registrarme y calificar'} <ArrowIcon /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

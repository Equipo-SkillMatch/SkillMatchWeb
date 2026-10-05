import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../CSS/DashboardEmpresas.css';
import { API_BASE, buildFileUrl } from '../config/api';
import DashboardInsights from '../components/DashboardInsights';
import AppIcon from '../components/AppIcon';
import { showToast, confirmDialog } from '../components/InstitutionalUI';

// LISTA DE TECNOLOGÍAS PARA LAS BURBUJAS
const TECH_OPTIONS = [
  "React", "Node.js", "JavaScript", "TypeScript", "Python", "Java", "C#", "PHP", "Flutter", "Dart",
  "Angular", "Vue", "Next.js", "Express", "Spring Boot", "Laravel", "MySQL", "PostgreSQL", "MongoDB",
  "SQL Server", "Firebase", "AWS", "Azure", "Docker", "Kubernetes", "Git", "REST API", "GraphQL",
  "HTML", "CSS", "Tailwind", "Figma", "Power BI", "Excel", "IoT", "Linux", "Cybersecurity"
];

const SOFT_SKILL_OPTIONS = [
  "Comunicación", "Trabajo en equipo", "Resolución de problemas", "Adaptabilidad",
  "Profesionalismo", "Liderazgo", "Organización", "Pensamiento crítico"
];

export default function DashboardEmpresas() {
  const navigate = useNavigate();
  const [view, setView] = useState("dashboard"); 
  const [tabVacantes, setTabVacantes] = useState("todas");
  
  // ESTADO PARA EL MENÚ MÓVIL
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [metricas, setMetricas] = useState({ activas: 0, postulaciones: 0, revisados: 0, contrataciones: 0 });
  const [vacantes, setVacantes] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [showModalForm, setShowModalForm] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [loadingModal, setLoadingModal] = useState(false); 
  const [savingVacante, setSavingVacante] = useState(false);
  const [formError, setFormError] = useState("");

  const initialFormState = {
    titulo: "", categoria: "Tecnología", nivel: "JUNIOR", descripcion: "", requisitos: "", estado: "abierta",
    ubicacion: "", modalidad: "Presencial", tipo_oportunidad: "Estadía / Prácticas", horario: "",
    salario_min: "", salario_max: "", moneda: "MXN", mostrar_salario: false, plazas: 1, fecha_limite: "",
    actividades: "", responsabilidades: "", requisitos_obligatorios: "", requisitos_deseables: "",
    tecnologias_requeridas: [], tecnologias_deseables: [], habilidades_blandas: [], beneficios: "",
    experiencia: "Sin experiencia", carrera_preferida: ""
  };
  const [formVacante, setFormVacante] = useState(initialFormState);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVacante, setSelectedVacante] = useState(null);
  const [postulantes, setPostulantes] = useState([]); 
  
  const [companyData, setCompanyData] = useState(null);
  const [perfilForm, setPerfilForm] = useState({
    nombre: '', apellido: '', telefono: '', razon_social: '', giro: '', contacto: '', domicilio: '', ubicacion: '', sector: '',
    descripcion_empresa: '', sitio_web: '', tamano_empresa: '', anio_fundacion: '', linkedin: '', cultura_valores: '',
    beneficios_empresa: '', proceso_seleccion: '', nueva_password: ''
  });
  const [perfilFoto, setPerfilFoto] = useState(null);
  const [showPerfilPass, setShowPerfilPass] = useState(false);

  // ESTADOS PARA LA EXPERIENCIA DE MATCH
  const [selectedSkills, setSelectedSkills] = useState([]); 
  const [appliedSkills, setAppliedSkills] = useState([]); 
  const [isMatching, setIsMatching] = useState(false); 
  const [estudiantesMatch, setEstudiantesMatch] = useState([]); 
  const [nombreBusqueda, setNombreBusqueda] = useState(''); 
  const [busquedaAplicada, setBusquedaAplicada] = useState(false); 

  useEffect(() => {
    cargarDashboard();
    cargarPerfilEmpresa();
  }, []);

  // FUNCIÓN PARA CAMBIAR DE VISTA Y CERRAR EL MENÚ EN MÓVIL
  const handleNavClick = (vista) => {
    setView(vista);
    setIsMobileMenuOpen(false); // Cierra el menú al hacer clic
  };

  const cargarDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return; 
      const res = await fetch(`${API_BASE}/vacantes/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) {
        setMetricas(json.data.metricas);
        setVacantes(json.data.vacantes);
        if (json.data.estudiantes) {
          setEstudiantes(json.data.estudiantes); 
        }
      }
    } catch (error) {
      console.error("Error al cargar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarPerfilEmpresa = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/vacantes/perfil-info`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      const json = await res.json();
      if (json.ok) {
        setCompanyData(json.empresa);
        setPerfilForm({
          nombre: json.empresa.nombre || '',
          apellido: json.empresa.apellido || '',
          telefono: json.empresa.telefono || '',
          razon_social: json.empresa.razon_social || '',
          giro: json.empresa.giro || '',
          contacto: json.empresa.contacto || '',
          domicilio: json.empresa.domicilio || '',
          ubicacion: json.empresa.ubicacion || '',
          sector: json.empresa.sector || '',
          descripcion_empresa: json.empresa.descripcion_empresa || '',
          sitio_web: json.empresa.sitio_web || '',
          tamano_empresa: json.empresa.tamano_empresa || '',
          anio_fundacion: json.empresa.anio_fundacion || '',
          linkedin: json.empresa.linkedin || '',
          cultura_valores: json.empresa.cultura_valores || '',
          beneficios_empresa: json.empresa.beneficios_empresa || '',
          proceso_seleccion: json.empresa.proceso_seleccion || '',
          nueva_password: ''
        });
      }
    } catch (error) {
      console.error("Error al cargar perfil empresa:", error);
    }
  };

  const guardarPerfilEmpresa = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      Object.entries(perfilForm).forEach(([k, v]) => fd.append(k, v));
      if (perfilFoto) fd.append('foto_perfil', perfilFoto);

      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const json = await res.json();
      if (!json.ok) return showToast(json.mensaje || 'No se pudo actualizar el perfil',{type:'error'});
      showToast('Perfil actualizado correctamente',{type:'success'});
      setPerfilFoto(null);
      await cargarPerfilEmpresa();
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...currentUser, ...json.usuario }));
    } catch (error) {
      showToast('Error de conexión al actualizar perfil',{type:'error'});
    }
  };

  const handleAceptarAlumno = async (id_postulacion, nombreAlumno) => {
    const confirmar = await confirmDialog({title:'Aceptar postulante',message:`Se aceptará a ${nombreAlumno} y se enviará la notificación correspondiente.`,confirmText:'Aceptar alumno'});
    if (!confirmar) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/vacantes/postulaciones/${id_postulacion}/aceptar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();

      if (json.ok) {
        showToast('Alumno aceptado. Se ha enviado el correo de notificación.',{type:'success'});
        setPostulantes(postulantes.filter(p => p.id_postulacion !== id_postulacion));
        cargarDashboard();
      } else {
        showToast(json.mensaje || 'No se pudo aceptar al alumno.',{type:'error'});
      }
    } catch (error) {
      showToast('Error de conexión al procesar la aceptación.',{type:'error'});
    }
  };

  const abrirModalCrear = () => {
    if (companyData && companyData.estado !== 'habilitada') {
      showToast('Tu empresa aún no está habilitada por Vinculación. Puedes editar tu perfil, pero no publicar vacantes todavía.',{type:'warning'});
      return;
    }
    setEditingId(null);
    setFormVacante(initialFormState);
    setFormError("");
    setShowModalForm(true);
  };

  const abrirModalEditar = async (id_vacante) => {
    setFormError("");
    setEditingId(id_vacante);
    setShowModalForm(true); 
    setLoadingModal(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/vacantes/${id_vacante}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      
      if (json.ok) {
        const splitField = (value) => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
        setFormVacante({
          ...initialFormState,
          ...json.vacante,
          titulo: json.vacante.titulo || '',
          categoria: json.vacante.categoria || 'Tecnología',
          nivel: json.vacante.nivel || 'JUNIOR',
          descripcion: json.vacante.descripcion || '',
          requisitos: json.vacante.requisitos || '',
          estado: json.vacante.estado || 'abierta',
          salario_min: json.vacante.salario_min ?? '',
          salario_max: json.vacante.salario_max ?? '',
          plazas: json.vacante.plazas || 1,
          fecha_limite: json.vacante.fecha_limite ? String(json.vacante.fecha_limite).slice(0, 10) : '',
          tecnologias_requeridas: splitField(json.vacante.tecnologias_requeridas),
          tecnologias_deseables: splitField(json.vacante.tecnologias_deseables),
          habilidades_blandas: splitField(json.vacante.habilidades_blandas),
        });
      } else {
        setFormError("No se pudo cargar la info: " + json.mensaje);
      }
    } catch (error) {
      setFormError("Error de red al cargar la vacante.");
    } finally {
      setLoadingModal(false);
    }
  };

  const guardarVacante = async () => {
    setFormError("");
    if (!formVacante.titulo || !formVacante.descripcion) {
      return setFormError("El título y la descripción son obligatorios.");
    }

    setSavingVacante(true);
    try {
      const token = localStorage.getItem('token');
      const isEdit = editingId !== null;
      const url = isEdit ? `${API_BASE}/vacantes/${editingId}` : `${API_BASE}/vacantes`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formVacante)
      });
      
      const json = await res.json();
      if (json.ok) {
        setShowModalForm(false);
        cargarDashboard(); 
        if (showViewModal && selectedVacante && selectedVacante.id_vacante === editingId) {
          abrirModalVer(editingId);
        }
      } else {
        setFormError(json.mensaje);
      }
    } catch (error) {
      setFormError("Error de conexión al servidor.");
    } finally {
      setSavingVacante(false);
    }
  };

  const abrirModalVer = async (id_vacante) => {
    const vacanteBasica = vacantes.find(v => v.id_vacante === id_vacante);
    setSelectedVacante(vacanteBasica || { id_vacante, titulo: "Cargando..." });
    setPostulantes([]); 
    setShowViewModal(true); 
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/vacantes/${id_vacante}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      
      if (json.ok) {
        setSelectedVacante(prev => ({ ...prev, ...json.vacante }));
        setPostulantes(json.postulantes || []); 
      }
    } catch (error) {
      console.error("Error al cargar detalles completos", error);
    }
  };

  const formatearFecha = (fechaString) => {
    if(!fechaString) return "-";
    return new Date(fechaString).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const vacantesFiltradas = tabVacantes === "todas" ? vacantes : vacantes.filter((v) => v.estado.toLowerCase() === tabVacantes);
  const initials = (name) => name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "UT";

  const toggleVacanteList = (field, value) => {
    setFormVacante((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      return { ...prev, [field]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] };
    });
  };


  // LÓGICA DE BURBUJAS Y MATCH (BLINDADA)
  const toggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const ejecutarMatch = async () => {
    setIsMatching(true);
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (nombreBusqueda.trim()) params.set('nombre', nombreBusqueda.trim());
      if (selectedSkills.length) params.set('skills', selectedSkills.join(','));
      const res = await fetch(`${API_BASE}/vacantes/match-estudiantes?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();

      if (json.ok) {
        // El backend calcula y ordena el porcentaje de compatibilidad.
        setEstudiantesMatch(json.estudiantes || []);
      }
    } catch (error) {
      console.error("Error al buscar el match:", error);
    }

    setAppliedSkills(selectedSkills);
    setBusquedaAplicada(selectedSkills.length > 0 || nombreBusqueda.trim().length > 0);
    setTimeout(() => {
      setIsMatching(false);
    }, 1200); 
  };

  const listaRender = busquedaAplicada ? estudiantesMatch : estudiantes;

  return (
    <div className="app">
      {/* Estilo inyectado para la animación de pálpito */}
      <style>
        {`
          @keyframes pulseMatch {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; text-shadow: 0 0 20px rgba(255,255,255,0.8); }
            100% { transform: scale(1); opacity: 0.8; }
          }
          .match-loader {
            animation: pulseMatch 1s infinite ease-in-out;
          }
        `}
      </style>

 {/* OVERLAY MÓVIL */}
      {isMobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

 {/* SIDEBAR (Con clase dinámica) */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="brand">Skill<span>Match</span></div>
          <div className="subtitle">Portal Empresas</div>
        </div>
        <nav className="nav-section">
          <div className="nav-label">Principal</div>
          <div className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => handleNavClick("dashboard")}>
            <span className="icon"><AppIcon name="dashboard" /></span> Dashboard
          </div>
          <div className={`nav-item ${view === "perfil" ? "active" : ""}`} onClick={() => handleNavClick("perfil")}>
            <span className="icon"><AppIcon name="building" /></span> Perfil Empresa
          </div>
          <div className={`nav-item`} onClick={() => { abrirModalCrear(); setIsMobileMenuOpen(false); }}>
            <span className="icon"><AppIcon name="plus" /></span> Nueva Oferta
          </div>
          <div className={`nav-item ${view === "candidatos" ? "active" : ""}`} onClick={() => handleNavClick("candidatos")}>
            <span className="icon"><AppIcon name="target" /></span> Candidatos
          </div>
        </nav>
        <div className="sidebar-bottom">
          <button 
            onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
            style={{ width: "100%", padding: "10px", background: "rgba(239,68,68,0.2)", border: "1px solid #ef4444", borderRadius: "8px", color: "#fca5a5", fontWeight: "600", cursor: "pointer" }}
          >
            <AppIcon name="logout" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        {view === "dashboard" && (
          <>
            <div className="topbar">
              <div className="topbar-left-wrap">
 {/* BOTÓN HAMBURGUESA */}
                <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <div className="topbar-title">Dashboard <span>Empresas</span></div>
              </div>
              <div className="topbar-actions">
                <button className="btn btn-primary" onClick={abrirModalCrear}>+ Crear nueva oferta</button>
              </div>
            </div>

            <div className="content">
              {/* METRICS */}
              <div className="metrics-grid">
                <div className="metric-card" style={{"--card-accent": "#244E7C"}}>
                  <div className="metric-label">Vacantes Activas</div>
                  <div className="metric-value">{metricas.activas}</div>
                </div>
                <div className="metric-card" style={{"--card-accent": "#1a9e5c"}}>
                  <div className="metric-label">Postulaciones Totales</div>
                  <div className="metric-value">{metricas.postulaciones}</div>
                </div>
                <div className="metric-card" style={{"--card-accent": "#d97706"}}>
                  <div className="metric-label">Candidatos Revisados</div>
                  <div className="metric-value">{metricas.revisados}</div>
                </div>
                <div className="metric-card" style={{"--card-accent": "#232E56"}}>
                  <div className="metric-label">Contrataciones</div>
                  <div className="metric-value">{metricas.contrataciones}</div>
                </div>
              </div>

              <DashboardInsights
                title="Rendimiento de reclutamiento"
                subtitle="Vacantes, postulaciones y avance del proceso de selección"
                labels={['Vacantes', 'Postulaciones', 'Revisados', 'Contratados']}
                values={[metricas.activas, metricas.postulaciones, metricas.revisados, metricas.contrataciones]}
                progress={metricas.postulaciones ? Math.min(100, Math.round((metricas.revisados / metricas.postulaciones) * 100)) : 0}
                progressLabel="Candidatos revisados"
              />

              {companyData && companyData.estado !== 'habilitada' && (
                <div className="alert alert-error" style={{ marginTop: '18px' }}>
                  Tu empresa está en estado <b>{companyData.estado}</b>. Vinculación debe habilitarla antes de publicar vacantes.
                </div>
              )}

              {/* VACANTES TABLE */}
              <div className="section-header">
                <div className="section-title">Mis Vacantes <span className="count">{vacantes.length} registradas</span></div>
              </div>

              <div className="tabs">
                {["todas", "abierta", "cerrada"].map((t) => (
                  <button key={t} className={`tab ${tabVacantes === t ? "active" : ""}`} onClick={() => setTabVacantes(t)}>
                    {t === 'abierta' ? 'Activa' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <div className="table-wrap">
                <div className="table-header">
                  <div>Vacante</div><div>Nivel</div><div>Fecha</div><div>Postulaciones</div><div>Estado</div><div>Acciones</div>
                </div>
                {loading ? (
                  <div style={{padding: "20px", textAlign: "center"}}>Cargando...</div>
                ) : vacantesFiltradas.length === 0 ? (
                   <div style={{padding: "20px", textAlign: "center"}}>No hay vacantes.</div>
                ) : (
                  vacantesFiltradas.map((v) => (
                    <div className="table-row" key={v.id_vacante}>
                      <div>
                        <div className="vacante-title">{v.titulo}</div>
                        <div className="vacante-area">{v.categoria}</div>
                      </div>
                      <div>
                        <span className={`badge ${v.nivel === "SENIOR" ? "badge-amber" : "badge-green"}`}>{v.nivel}</span>
                      </div>
                      <div style={{fontSize: "13px"}}>{formatearFecha(v.fecha_registro)}</div>
                      <div><span className="post-count">{v.total_postulaciones || 0}</span></div>
                      <div>
                        <span className={`badge ${v.estado === "abierta" ? "badge-green" : v.estado === "pausada" ? "badge-amber" : "badge-red"}`}>
                          {v.estado === 'abierta' ? 'ACTIVA' : v.estado.toUpperCase()}
                        </span>
                      </div>
                      <div className="table-actions">
                        <button className="action-btn" onClick={(e) => { e.preventDefault(); abrirModalVer(v.id_vacante); }}>Ver</button>
                        <button className="action-btn" onClick={(e) => { e.preventDefault(); abrirModalEditar(v.id_vacante); }}>Editar</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ESTUDIANTES DESTACADOS */}
              <div className="section-header">
                <div className="section-title">
                  Estudiantes Destacados UTEQ <span className="count">{estudiantes.length} disponibles</span>
                </div>
                <button className="btn btn-ghost" style={{fontSize: "12px", padding: "7px 14px"}} onClick={() => handleNavClick("candidatos")}>
                  Ver todos →
                </button>
              </div>

              <div className="estudiantes-grid">
                {estudiantes.length > 0 ? (
                  estudiantes.slice(0, 4).map((e) => (
                    <div className="estudiante-card" key={e.id_usuario || e.id}>
                      <div className="est-header">
                        <div className="est-avatar">{initials(e.nombre)}</div>
                        <div>
                          <div className="est-name">{e.nombre}</div>
                          <div className="est-carrera">{e.carrera}</div>
                        </div>
                        <div style={{marginLeft: "auto"}}>
                          <span className="uteq-badge">✓ UTEQ</span>
                        </div>
                      </div>
                      <div className="est-stats">
                        <div className="est-stat-item">
                          <div className="est-stat-val">{e.habilidades?.length || 0}</div>
                          <div className="est-stat-label">Skills</div>
                        </div>
                        <div className="est-stat-item">
                          <div className="est-stat-val" style={{fontSize: "13px", color: "#166534", fontWeight: "700"}}>Disponible</div>
                          <div className="est-stat-label">Estado</div>
                        </div>
                      </div>
                      <div className="skills-list">
                        {e.habilidades && e.habilidades.map((h, idx) => {
                          const cleanH = h.replace(/[\[\]"']/g, '').trim();
                          if(!cleanH) return null;
                          return <span key={idx} className="skill-tag">{cleanH}</span>;
                        })}
                      </div>
                      <div style={{display: "flex", gap: "8px"}}>
                        <button 
                          className="btn btn-primary" 
                          style={{fontSize: "14px", padding: "10px", flex: 1}}
                          onClick={() => navigate(`/ver-alumno/${e.id_usuario}`)}
                        >
                          Ver perfil
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{padding: "20px", color: "var(--muted)"}}>No hay estudiantes registrados por ahora.</div>
                )}
              </div>
            </div>
          </>
        )}

        {view === "candidatos" && (
           <>
             <div className="topbar">
                <div className="topbar-left-wrap">
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                  <div className="topbar-title">Directorio de Estudiantes <span>Talento UTEQ</span></div>
                </div>
               <div className="topbar-actions">
                 <button className="btn btn-ghost" onClick={() => handleNavClick("dashboard")}>← Regresar al Dashboard</button>
               </div>
             </div>
             
             <div className="content">
                
 {/* NUEVO BANNER CON BURBUJAS DE MATCH */}
                <div style={{
                  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                  borderRadius: "16px",
                  padding: "30px",
                  marginBottom: "30px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  color: "white"
                }}>
                  <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <h2 style={{margin: 0, fontSize: "28px", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "12px"}}>
                      <AppIcon name="sparkles" size={20} /> Haz Match con tu candidato ideal
                    </h2>
                    <p style={{margin: "10px 0 0", color: "#94a3b8", fontSize: "15px"}}>
                      Selecciona tecnologías y, si lo necesitas, busca por nombre completo o parcial.
                    </p>
                    <div style={{ maxWidth: "520px", margin: "18px auto 0" }}>
                      <input
                        value={nombreBusqueda}
                        onChange={(e) => setNombreBusqueda(e.target.value)}
                        placeholder="Buscar candidato por nombre: Daniel Hernández"
                        style={{ width: "100%", padding: "13px 16px", borderRadius: "14px", border: "1px solid #475569", background: "#0f172a", color: "white", outline: "none", fontWeight: 600 }}
                      />
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                        La búsqueda ignora acentos y permite coincidencias parciales: “Daniel Hernández” encuentra “Daniel Mota Hernández”.
                      </div>
                    </div>
                  </div>

                  {/* Contenedor de Burbujas */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginBottom: "25px" }}>
                    {TECH_OPTIONS.map(tech => {
                      const isSelected = selectedSkills.includes(tech);
                      return (
                        <button
                          key={tech}
                          onClick={() => toggleSkill(tech)}
                          style={{
                            padding: "8px 18px",
                            borderRadius: "30px",
                            border: `2px solid ${isSelected ? "#3b82f6" : "#334155"}`,
                            background: isSelected ? "rgba(59, 130, 246, 0.2)" : "transparent",
                            color: isSelected ? "#60a5fa" : "#cbd5e1",
                            fontSize: "14px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {tech} {isSelected && "✓"}
                        </button>
                      );
                    })}
                  </div>

                  {/* Botón de Acción */}
                  <div style={{ textAlign: "center" }}>
                    <button 
                      onClick={ejecutarMatch}
                      style={{
                        background: selectedSkills.length > 0 ? "linear-gradient(to right, #3b82f6, #2563eb)" : "#334155",
                        color: "white",
                        padding: "14px 35px",
                        borderRadius: "30px",
                        border: "none",
                        fontSize: "16px",
                        fontWeight: "700",
                        cursor: (selectedSkills.length > 0 || nombreBusqueda.trim()) ? "pointer" : "not-allowed",
                        boxShadow: (selectedSkills.length > 0 || nombreBusqueda.trim()) ? "0 4px 15px rgba(59, 130, 246, 0.4)" : "none",
                        transition: "all 0.3s ease"
                      }}
                      disabled={(selectedSkills.length === 0 && !nombreBusqueda.trim()) || isMatching}
                    >
                      {isMatching ? "Analizando talento..." : `Hacer Match (${selectedSkills.length}${nombreBusqueda.trim() ? ' + nombre' : ''})`}
                    </button>
                    {busquedaAplicada && !isMatching && (
                      <div style={{marginTop: "12px"}}>
                        <button onClick={() => {setAppliedSkills([]); setSelectedSkills([]); setNombreBusqueda(''); setBusquedaAplicada(false);}} style={{background:"transparent", border:"none", color:"#ef4444", textDecoration:"underline", cursor:"pointer", fontSize:"13px"}}>
                          Limpiar búsqueda
                        </button>
                      </div>
                    )}
                  </div>
                </div>

 {/* PANTALLA DE CARGA Y RESULTADOS */}
                {isMatching ? (
                  <div style={{ padding: "60px 20px", textAlign: "center", background: "white", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
                    <div className="match-loader match-loader--icon"><AppIcon name="sparkles" size={46} /></div>
                    <h2 style={{ color: "#1e293b", margin: "0 0 10px 0" }}>Buscando compatibilidad...</h2>
                    <p style={{ color: "var(--muted)", margin: 0 }}>SkillMatch está comparando tecnologías, proyectos y habilidades blandas.</p>
                  </div>
                ) : (
                  <>
                    <div className="section-header">
                      <div className="section-title">
                        {appliedSkills.length > 0 ? 'Talento Compatible' : 'Todos los Estudiantes'} 
                        <span className="count">{listaRender.length} {busquedaAplicada ? 'encontrados' : 'disponibles en la plataforma'}</span>
                      </div>
                    </div>

                    <div className="estudiantes-grid">
                      {listaRender.length > 0 ? (
                        listaRender.map((e) => (
                          <div className="estudiante-card" key={e.id_usuario || e.id}>
                            <div className="est-header">
                              <div className="est-avatar" style={{ overflow: 'hidden' }}>
                                {e.foto_perfil ? <img src={buildFileUrl(e.foto_perfil)} alt={e.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(ev) => { ev.currentTarget.style.display = 'none'; }} /> : initials(e.nombre)}
                              </div>
                              <div>
                                <div className="est-name">{e.nombre}</div>
                                <div className="est-carrera">{e.carrera}</div>
                                {busquedaAplicada && Number.isFinite(Number(e.match_score)) && (
                                  <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 9px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 12, fontWeight: 900 }}>
                                    {e.match_score}% Match
                                  </div>
                                )}
                                <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 800, marginTop: 4 }}>
                                  Habilidades blandas: {e.habilidades_blandas?.puntaje_total ?? 'Sin test'}{e.habilidades_blandas?.puntaje_total ? '%' : ''}
                                </div>
                              </div>
                              <div style={{marginLeft: "auto"}}>
                                <span className="uteq-badge">✓ UTEQ</span>
                              </div>
                            </div>
                            <div className="est-stats">
                              <div className="est-stat-item">
                                <div className="est-stat-val">{e.habilidades?.length || 0}</div>
                                <div className="est-stat-label">Skills</div>
                              </div>
                              <div className="est-stat-item">
                                <div className="est-stat-val" style={{fontSize: "13px", color: "#166534", fontWeight: "700"}}>Disponible</div>
                                <div className="est-stat-label">Estado</div>
                              </div>
                            </div>
                            <div className="skills-list">
                              {e.habilidades && e.habilidades.map((h, idx) => {
                                const cleanH = h.replace(/[\[\]"']/g, '').trim();
                                if(!cleanH) return null;

                                const isMatch = appliedSkills.some(applied => cleanH.toLowerCase().includes(applied.toLowerCase()));
                                return (
                                  <span key={idx} className="skill-tag" style={isMatch ? {background: "#dbeafe", color: "#1e40af", borderColor: "#bfdbfe"} : {}}>
                                    {cleanH} {isMatch && "✨"}
                                  </span>
                                );
                              })}
                            </div>
                            {busquedaAplicada && e.match_detalle && (
                              <div style={{ margin: '12px 0', padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                                <b style={{ color: '#0f172a' }}>Por qué coincide:</b>{' '}
                                {e.match_detalle.coincidencias?.length ? e.match_detalle.coincidencias.join(', ') : 'sin coincidencias técnicas'}.
                                {e.match_detalle.faltantes?.length > 0 && <div style={{ marginTop: 4 }}><b>Brechas:</b> {e.match_detalle.faltantes.join(', ')}</div>}
                              </div>
                            )}
                            <div style={{display: "flex", gap: "8px"}}>
                              <button 
                                className="btn btn-primary" 
                                style={{fontSize: "14px", padding: "10px", flex: 1}}
                                onClick={() => navigate(`/ver-alumno/${e.id_usuario}`)}
                              >
                                Ver perfil completo
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{padding: "50px", textAlign: "center", width: "100%", gridColumn: "1 / -1", background: "white", borderRadius: "12px", border: "1px dashed #cbd5e1"}}>
                          <div className="empty-icon-minimal"><AppIcon name="target" size={38} /></div>
                          <h3 style={{color: "#334155", margin: "0 0 8px 0"}}>Sin Matches por ahora</h3>
                          <p style={{color: "var(--muted)", margin: 0}}>No encontramos estudiantes de la UTEQ con esa tecnología en sus proyectos.</p>
                          <button onClick={() => {setAppliedSkills([]); setSelectedSkills([]); setNombreBusqueda(''); setBusquedaAplicada(false);}} className="btn btn-ghost" style={{marginTop: "20px"}}>
                            Ver a todos los estudiantes
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
             </div>
           </>
        )}

        {view === "perfil" && (
           <>
             <div className="topbar">
               <div className="topbar-left-wrap">
                 <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>☰</button>
                 <div className="topbar-title">Perfil de <span>Empresa</span></div>
               </div>
             </div>
             {companyData ? (
               <div className="content">
                 <form onSubmit={guardarPerfilEmpresa} className="profile-container-full" style={{ background: "white", borderRadius: "20px", padding: "40px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", maxWidth: "850px" }}>
                   <div style={{ display: "flex", gap: "24px", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "24px", marginBottom: "24px", flexWrap: "wrap" }}>
                     {companyData.foto_perfil ? (
                       <img src={buildFileUrl(companyData.foto_perfil)} alt="perfil" style={{ width: "105px", height: "105px", objectFit: "cover", borderRadius: "24px" }} />
                     ) : (
                       <div style={{ width: "105px", height: "105px", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", fontWeight: "800", borderRadius: "24px" }}>{initials(companyData.razon_social)}</div>
                     )}
                     <div>
                       <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", margin: 0 }}>{companyData.razon_social}</h1>
                       <p style={{ color: "#64748b", margin: "6px 0" }}>Estado de validación: <b>{companyData.estado}</b></p>
                     </div>
                   </div>

                   <div className="company-profile-sections">
                     <section className="company-profile-section">
                       <div className="company-profile-section-title"><AppIcon name="building" size={19} /><div><strong>Identidad de la empresa</strong><small>Información pública que ayuda al estudiante a conocer la organización.</small></div></div>
                       <div className="company-profile-grid">
                         <div className="form-group"><label className="form-label">Logo / foto</label><input className="form-input" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e => setPerfilFoto(e.target.files?.[0] || null)} /></div>
                         <div className="form-group"><label className="form-label">Razón social</label><input className="form-input" value={perfilForm.razon_social} onChange={e => setPerfilForm({...perfilForm, razon_social: e.target.value})} /></div>
                         <div className="form-group"><label className="form-label">Giro</label><input className="form-input" value={perfilForm.giro} onChange={e => setPerfilForm({...perfilForm, giro: e.target.value})} /></div>
                         <div className="form-group"><label className="form-label">Sector</label><input className="form-input" value={perfilForm.sector} onChange={e => setPerfilForm({...perfilForm, sector: e.target.value})} /></div>
                         <div className="form-group"><label className="form-label">Tamaño de empresa</label><select className="form-select" value={perfilForm.tamano_empresa} onChange={e => setPerfilForm({...perfilForm, tamano_empresa: e.target.value})}><option value="">No especificado</option><option>1-10 colaboradores</option><option>11-50 colaboradores</option><option>51-250 colaboradores</option><option>251-1000 colaboradores</option><option>Más de 1000 colaboradores</option></select></div>
                         <div className="form-group"><label className="form-label">Año de fundación</label><input className="form-input" type="number" min="1900" max="2100" value={perfilForm.anio_fundacion} onChange={e => setPerfilForm({...perfilForm, anio_fundacion: e.target.value})} /></div>
                         <div className="form-group company-profile-wide"><label className="form-label">Descripción de la empresa</label><textarea className="form-textarea" value={perfilForm.descripcion_empresa} onChange={e => setPerfilForm({...perfilForm, descripcion_empresa: e.target.value})} placeholder="Qué hace la empresa, industria, productos, servicios y tipo de talento que suele integrar." /></div>
                       </div>
                     </section>

                     <section className="company-profile-section">
                       <div className="company-profile-section-title"><AppIcon name="map" size={19} /><div><strong>Ubicación y presencia digital</strong><small>Datos visibles en el detalle de las vacantes.</small></div></div>
                       <div className="company-profile-grid">
                         <div className="form-group"><label className="form-label">Ubicación</label><input className="form-input" value={perfilForm.ubicacion} onChange={e => setPerfilForm({...perfilForm, ubicacion: e.target.value})} placeholder="Querétaro, Qro." /></div>
                         <div className="form-group"><label className="form-label">Sitio web</label><input className="form-input" value={perfilForm.sitio_web} onChange={e => setPerfilForm({...perfilForm, sitio_web: e.target.value})} placeholder="https://..." /></div>
                         <div className="form-group"><label className="form-label">LinkedIn</label><input className="form-input" value={perfilForm.linkedin} onChange={e => setPerfilForm({...perfilForm, linkedin: e.target.value})} placeholder="https://linkedin.com/company/..." /></div>
                         <div className="form-group"><label className="form-label">Domicilio</label><input className="form-input" value={perfilForm.domicilio} onChange={e => setPerfilForm({...perfilForm, domicilio: e.target.value})} /></div>
                       </div>
                     </section>

                     <section className="company-profile-section">
                       <div className="company-profile-section-title"><AppIcon name="users" size={19} /><div><strong>Cultura y propuesta de valor</strong><small>Haz que el perfil explique por qué un estudiante querría trabajar aquí.</small></div></div>
                       <div className="company-profile-grid">
                         <div className="form-group company-profile-wide"><label className="form-label">Cultura y valores</label><textarea className="form-textarea" value={perfilForm.cultura_valores} onChange={e => setPerfilForm({...perfilForm, cultura_valores: e.target.value})} /></div>
                         <div className="form-group company-profile-wide"><label className="form-label">Beneficios habituales</label><textarea className="form-textarea" value={perfilForm.beneficios_empresa} onChange={e => setPerfilForm({...perfilForm, beneficios_empresa: e.target.value})} /></div>
                         <div className="form-group company-profile-wide"><label className="form-label">Proceso de selección</label><textarea className="form-textarea" value={perfilForm.proceso_seleccion} onChange={e => setPerfilForm({...perfilForm, proceso_seleccion: e.target.value})} placeholder="Ej. Revisión de perfil → entrevista RH → entrevista técnica → resultado." /></div>
                       </div>
                     </section>

                     <section className="company-profile-section">
                       <div className="company-profile-section-title"><AppIcon name="user" size={19} /><div><strong>Contacto responsable</strong><small>Información de la persona que gestiona la cuenta.</small></div></div>
                       <div className="company-profile-grid">
                         <div className="form-group"><label className="form-label">Contacto / RH</label><input className="form-input" value={perfilForm.contacto} onChange={e => setPerfilForm({...perfilForm, contacto: e.target.value})} /></div>
                         <div className="form-group"><label className="form-label">Nombre responsable</label><input className="form-input" value={perfilForm.nombre} onChange={e => setPerfilForm({...perfilForm, nombre: e.target.value})} /></div>
                         <div className="form-group"><label className="form-label">Apellido responsable</label><input className="form-input" value={perfilForm.apellido} onChange={e => setPerfilForm({...perfilForm, apellido: e.target.value})} /></div>
                         <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={perfilForm.telefono} onChange={e => setPerfilForm({...perfilForm, telefono: e.target.value})} /></div>
                         <div className="form-group"><label className="form-label">Nueva contraseña</label><div style={{ position: "relative" }}><input className="form-input" type={showPerfilPass ? 'text' : 'password'} minLength={8} placeholder="Opcional" value={perfilForm.nueva_password} onChange={e => setPerfilForm({...perfilForm, nueva_password: e.target.value})} /><button type="button" onClick={() => setShowPerfilPass(!showPerfilPass)} style={{ position: 'absolute', right: 10, top: 8, border: 0, background: 'transparent', cursor: 'pointer' }}><AppIcon name={showPerfilPass ? 'eyeOff' : 'eye'} size={18} /></button></div></div>
                       </div>
                     </section>
                   </div>
                   <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                     <button className="btn btn-primary" type="submit">Guardar cambios</button>
                     <button className="btn btn-ghost" type="button" onClick={() => handleNavClick("dashboard")}>← Regresar</button>
                   </div>
                 </form>
               </div>
             ) : <div style={{padding: "40px", textAlign: "center"}}>Cargando perfil de empresa...</div>}
           </>
        )}
      </main>

      {/* MODAL CREAR / EDITAR */}
      {showModalForm && (
        <div className="modal-overlay" onClick={() => setShowModalForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingId ? "✎ Editar Oferta" : "+ Crear Nueva Oferta"}</div>
            
            {formError && <div className="error-msg">{formError}</div>}
            
            {loadingModal ? (
              <div style={{textAlign:"center", padding:"40px"}}>Cargando información de la vacante...</div>
            ) : (
              <>
                <div className="vacancy-form-section">
                  <div className="vacancy-form-heading"><span>01</span><div><strong>Información general</strong><small>Datos principales que verá el estudiante.</small></div></div>
                  <div className="form-group">
                    <label className="form-label">Título del puesto *</label>
                    <input className="form-input" value={formVacante.titulo} onChange={(e) => setFormVacante({...formVacante, titulo: e.target.value})} placeholder="Ej. Desarrollador Full Stack Jr." />
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Área</label><select className="form-select" value={formVacante.categoria} onChange={(e) => setFormVacante({...formVacante, categoria: e.target.value})}><option>Tecnología</option><option>Diseño</option><option>Administración</option><option>Finanzas</option><option>Manufactura</option><option>Calidad</option><option>Comercial</option><option>Recursos Humanos</option></select></div>
                    <div className="form-group"><label className="form-label">Nivel</label><select className="form-select" value={formVacante.nivel} onChange={(e) => setFormVacante({...formVacante, nivel: e.target.value})}><option value="TRAINEE">Trainee / Becario</option><option value="JUNIOR">Junior</option><option value="SEMI-SENIOR">Semi-Senior</option><option value="SENIOR">Senior</option></select></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Tipo de oportunidad</label><select className="form-select" value={formVacante.tipo_oportunidad} onChange={(e) => setFormVacante({...formVacante, tipo_oportunidad: e.target.value})}><option>Estadía / Prácticas</option><option>Empleo de medio tiempo</option><option>Empleo de tiempo completo</option><option>Proyecto temporal</option><option>Servicio social</option></select></div>
                    <div className="form-group"><label className="form-label">Modalidad</label><select className="form-select" value={formVacante.modalidad} onChange={(e) => setFormVacante({...formVacante, modalidad: e.target.value})}><option>Presencial</option><option>Híbrida</option><option>Remota</option></select></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Ubicación</label><input className="form-input" value={formVacante.ubicacion} onChange={(e) => setFormVacante({...formVacante, ubicacion: e.target.value})} placeholder="Querétaro, Qro." /></div>
                    <div className="form-group"><label className="form-label">Horario</label><input className="form-input" value={formVacante.horario} onChange={(e) => setFormVacante({...formVacante, horario: e.target.value})} placeholder="L-V 8:00 a 14:00" /></div>
                  </div>
                </div>

                <div className="vacancy-form-section">
                  <div className="vacancy-form-heading"><span>02</span><div><strong>Qué hará el candidato</strong><small>Explica la oportunidad con suficiente contexto.</small></div></div>
                  <div className="form-group"><label className="form-label">Descripción de la vacante *</label><textarea className="form-textarea" value={formVacante.descripcion} onChange={(e) => setFormVacante({...formVacante, descripcion: e.target.value})} placeholder="Resume el propósito del puesto y el equipo al que se integrará." /></div>
                  <div className="form-group"><label className="form-label">Actividades principales</label><textarea className="form-textarea" value={formVacante.actividades} onChange={(e) => setFormVacante({...formVacante, actividades: e.target.value})} placeholder="Ej. Desarrollo de módulos, pruebas, documentación, participación en reuniones..." /></div>
                  <div className="form-group"><label className="form-label">Responsabilidades</label><textarea className="form-textarea" value={formVacante.responsabilidades} onChange={(e) => setFormVacante({...formVacante, responsabilidades: e.target.value})} placeholder="Responsabilidades y resultados esperados." /></div>
                </div>

                <div className="vacancy-form-section">
                  <div className="vacancy-form-heading"><span>03</span><div><strong>Perfil buscado</strong><small>Selecciona tecnologías; no es necesario escribirlas manualmente.</small></div></div>
                  <div className="form-group"><label className="form-label">Tecnologías requeridas *</label><div className="skill-picker">{TECH_OPTIONS.map((tech) => <button type="button" key={`req-${tech}`} className={formVacante.tecnologias_requeridas.includes(tech) ? 'skill-choice active' : 'skill-choice'} onClick={() => toggleVacanteList('tecnologias_requeridas', tech)}>{tech}</button>)}</div></div>
                  <div className="form-group"><label className="form-label">Tecnologías deseables</label><div className="skill-picker">{TECH_OPTIONS.map((tech) => <button type="button" key={`des-${tech}`} className={formVacante.tecnologias_deseables.includes(tech) ? 'skill-choice active' : 'skill-choice'} onClick={() => toggleVacanteList('tecnologias_deseables', tech)}>{tech}</button>)}</div></div>
                  <div className="form-group"><label className="form-label">Habilidades blandas prioritarias</label><div className="skill-picker">{SOFT_SKILL_OPTIONS.map((skill) => <button type="button" key={skill} className={formVacante.habilidades_blandas.includes(skill) ? 'skill-choice active' : 'skill-choice'} onClick={() => toggleVacanteList('habilidades_blandas', skill)}>{skill}</button>)}</div></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Experiencia</label><select className="form-select" value={formVacante.experiencia} onChange={(e) => setFormVacante({...formVacante, experiencia: e.target.value})}><option>Sin experiencia</option><option>Proyectos académicos</option><option>6 meses</option><option>1 año</option><option>2 años o más</option></select></div>
                    <div className="form-group"><label className="form-label">Carrera preferida</label><input className="form-input" value={formVacante.carrera_preferida} onChange={(e) => setFormVacante({...formVacante, carrera_preferida: e.target.value})} placeholder="Ej. Desarrollo de Software" /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Requisitos obligatorios</label><textarea className="form-textarea" value={formVacante.requisitos_obligatorios} onChange={(e) => setFormVacante({...formVacante, requisitos_obligatorios: e.target.value, requisitos: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Requisitos deseables</label><textarea className="form-textarea" value={formVacante.requisitos_deseables} onChange={(e) => setFormVacante({...formVacante, requisitos_deseables: e.target.value})} /></div>
                </div>

                <div className="vacancy-form-section">
                  <div className="vacancy-form-heading"><span>04</span><div><strong>Condiciones y beneficios</strong><small>Información que ayuda al estudiante a decidir antes de postularse.</small></div></div>
                  <div className="form-row"><div className="form-group"><label className="form-label">Salario / apoyo mínimo</label><input type="number" min="0" className="form-input" value={formVacante.salario_min} onChange={(e) => setFormVacante({...formVacante, salario_min: e.target.value})} /></div><div className="form-group"><label className="form-label">Salario / apoyo máximo</label><input type="number" min="0" className="form-input" value={formVacante.salario_max} onChange={(e) => setFormVacante({...formVacante, salario_max: e.target.value})} /></div></div>
                  <div className="form-row"><div className="form-group"><label className="form-label">Plazas</label><input type="number" min="1" className="form-input" value={formVacante.plazas} onChange={(e) => setFormVacante({...formVacante, plazas: e.target.value})} /></div><div className="form-group"><label className="form-label">Fecha límite</label><input type="date" className="form-input" value={formVacante.fecha_limite} onChange={(e) => setFormVacante({...formVacante, fecha_limite: e.target.value})} /></div></div>
                  <label className="check-row"><input type="checkbox" checked={Boolean(formVacante.mostrar_salario)} onChange={(e) => setFormVacante({...formVacante, mostrar_salario: e.target.checked})} /><span>Mostrar el rango de salario/apoyo a los estudiantes</span></label>
                  <div className="form-group"><label className="form-label">Beneficios / prestaciones / apoyos</label><textarea className="form-textarea" value={formVacante.beneficios} onChange={(e) => setFormVacante({...formVacante, beneficios: e.target.value})} placeholder="Ej. comedor, transporte, capacitación, horario flexible..." /></div>
                  {editingId && <div className="form-group"><label className="form-label">Estado de la vacante</label><select className="form-select" value={formVacante.estado} onChange={(e) => setFormVacante({...formVacante, estado: e.target.value})}><option value="abierta">Activa</option><option value="pausada">Pausada</option><option value="cerrada">Cerrada</option></select></div>}
                </div>

                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setShowModalForm(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={guardarVacante} disabled={savingVacante}>
                    {savingVacante ? "Guardando..." : (editingId ? "Guardar cambios ✓" : "Publicar oferta")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL VER */}
      {showViewModal && selectedVacante && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-wide-header">
              <div>
                <div style={{fontSize: "22px", fontWeight: "800", color: "var(--text)"}}>{selectedVacante.titulo}</div>
                <div style={{fontSize: "13px", color: "var(--muted)", marginTop: "4px"}}>
                  {selectedVacante.categoria} • {selectedVacante.nivel} • Publicada: {formatearFecha(selectedVacante.fecha_registro)}
                </div>
              </div>
              <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
                <span className={`badge ${selectedVacante.estado === 'abierta' ? 'badge-green' : 'badge-red'}`} style={{fontSize:"13px", padding:"6px 12px"}}>
                  {selectedVacante.estado === 'abierta' ? 'ACTIVA' : selectedVacante.estado?.toUpperCase()}
                </span>
                <button className="modal-close-btn" onClick={() => setShowViewModal(false)}>×</button>
              </div>
            </div>

            <div className="modal-wide-body">
              <div className="modal-col-left vacancy-company-detail">
                <div className="vacancy-view-facts">
                  <span><AppIcon name="map" size={15} />{selectedVacante.ubicacion || 'Ubicación por definir'}</span>
                  <span><AppIcon name="globe" size={15} />{selectedVacante.modalidad || 'Modalidad por definir'}</span>
                  <span><AppIcon name="briefcase" size={15} />{selectedVacante.tipo_oportunidad || selectedVacante.categoria || 'Oportunidad'}</span>
                  <span><AppIcon name="clock" size={15} />{selectedVacante.horario || 'Horario por definir'}</span>
                </div>

                <section className="vacancy-view-section">
                  <h3>Descripción del puesto</h3>
                  <p>{selectedVacante.descripcion || 'Sin descripción registrada.'}</p>
                </section>

                {selectedVacante.actividades && <section className="vacancy-view-section"><h3>Actividades principales</h3><p>{selectedVacante.actividades}</p></section>}
                {selectedVacante.responsabilidades && <section className="vacancy-view-section"><h3>Responsabilidades</h3><p>{selectedVacante.responsabilidades}</p></section>}

                <section className="vacancy-view-section">
                  <h3>Perfil buscado</h3>
                  <div className="vacancy-view-two-cols">
                    <div><strong>Requisitos obligatorios</strong><p>{selectedVacante.requisitos_obligatorios || selectedVacante.requisitos || 'No especificados.'}</p></div>
                    <div><strong>Deseables</strong><p>{selectedVacante.requisitos_deseables || 'No especificados.'}</p></div>
                  </div>
                  <div className="vacancy-view-skill-block"><strong>Tecnologías requeridas</strong><div className="vacancy-view-chips">{String(selectedVacante.tecnologias_requeridas || '').split(',').map(v => v.trim()).filter(Boolean).map(v => <span key={`vr-${v}`}>{v}</span>)}</div></div>
                  {selectedVacante.tecnologias_deseables && <div className="vacancy-view-skill-block"><strong>Tecnologías deseables</strong><div className="vacancy-view-chips muted">{String(selectedVacante.tecnologias_deseables || '').split(',').map(v => v.trim()).filter(Boolean).map(v => <span key={`vd-${v}`}>{v}</span>)}</div></div>}
                </section>

                <section className="vacancy-view-section">
                  <h3>Condiciones</h3>
                  <div className="vacancy-view-two-cols compact">
                    <div><strong>Experiencia</strong><p>{selectedVacante.experiencia || 'No especificada'}</p></div>
                    <div><strong>Plazas</strong><p>{selectedVacante.plazas || 1}</p></div>
                    <div><strong>Fecha límite</strong><p>{selectedVacante.fecha_limite ? formatearFecha(selectedVacante.fecha_limite) : 'Sin fecha límite'}</p></div>
                    <div><strong>Apoyo / salario</strong><p>{selectedVacante.mostrar_salario && (selectedVacante.salario_min || selectedVacante.salario_max) ? `$${Number(selectedVacante.salario_min || 0).toLocaleString('es-MX')} - $${Number(selectedVacante.salario_max || selectedVacante.salario_min || 0).toLocaleString('es-MX')} ${selectedVacante.moneda || 'MXN'}` : 'No publicado'}</p></div>
                  </div>
                  {selectedVacante.beneficios && <div className="vacante-detalle-text"><b>Beneficios:</b> {selectedVacante.beneficios}</div>}
                </section>

                <div style={{marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "18px"}}>
                  <button className="btn btn-ghost" onClick={() => { setShowViewModal(false); abrirModalEditar(selectedVacante.id_vacante); }}>
                    <AppIcon name="edit" size={16} /> Editar esta vacante
                  </button>
                </div>
              </div>

              <div className="modal-col-right">
                <div style={{padding:"24px", paddingBottom:"10px", fontSize: "13px", fontWeight: "700", color: "var(--primary)", textTransform: "uppercase", display:"flex", justifyContent:"space-between", position:"sticky", top:0, background:"#f8fafc", zIndex: 5}}>
                  <span>Candidatos Postulados</span>
                  <span style={{background:"var(--primary)", color:"white", padding:"2px 8px", borderRadius:"10px", fontSize:"11px"}}>
                    {selectedVacante.total_postulaciones || 0}
                  </span>
                </div>

                <div style={{padding:"0 24px 24px", display: "flex", flexDirection: "column", gap: "12px"}}>
                  {postulantes.length > 0 ? (
                    postulantes.map((p) => (
                      <div className="alumno-mini-card" key={`post-${p.id_usuario || p.id}`}>
                        <div className="al-mini-avatar">{p.foto_perfil ? <img src={buildFileUrl(p.foto_perfil)} alt={p.nombre} /> : initials(p.nombre)}</div>
                        <div className="al-mini-info">
                          <div className="al-mini-name">{p.nombre}</div>
                          <div className="al-mini-carrera">{p.carrera}</div>
                        </div>
                        <div style={{display: "flex", gap: "10px"}}>
                          <button 
                            className="btn btn-ghost" 
                            style={{padding:"4px 8px", fontSize:"10px"}}
                            onClick={() => navigate(`/ver-alumno/${p.id_usuario}`)}
                          >
                            Ver perfil
                          </button>
 {/* BOTÓN DE PALOMITA VERDE */}
                          <button 
                            className="btn btn-primary" 
                            style={{padding:"4px 10px", fontSize:"14px", background:"#22c55e", border:"none"}}
                            title="Aceptar Alumno"
                            onClick={() => handleAceptarAlumno(p.id_postulacion, p.nombre)}
                          >
                            <AppIcon name="check" size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{background: "white", padding: "16px", borderRadius: "10px", border: "1px dashed var(--border2)"}}>
                      <div style={{fontSize:"13px", fontWeight:"600", marginBottom:"4px"}}>Aún no hay postulaciones</div>
                      <div style={{fontSize:"12px", color:"var(--muted)", lineHeight:"1.5"}}>
                        Cuando un estudiante de la UTEQ se postule a esta vacante, aparecerá aquí.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

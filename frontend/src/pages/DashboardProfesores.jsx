import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../CSS/DashboardProfesores.css'; 
import { API_BASE, buildFileUrl } from '../config/api';
import DashboardInsights from '../components/DashboardInsights';
import AppIcon from '../components/AppIcon';
import { showToast, confirmDialog } from '../components/InstitutionalUI';

const initials = (name) =>
  name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'PR';

const formatFecha = (fecha) => {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-MX');
};

const badgeClassByEstado = (estado) => {
  if (estado === 'completado') return 'badge badge-active';
  if (estado === 'pausado') return 'badge badge-pending';
  return 'badge badge-approved';
};

// Función para obtener imagen (Si es Cloudinary o Local)
const getFileSource = (path) => {
  return buildFileUrl(path);
};

const tecnologiasDisponibles = [
  'React', 'Node.js', 'Express', 'MySQL', 'PostgreSQL', 'MongoDB',
  'JavaScript', 'TypeScript', 'PHP', 'Laravel', 'Python', 'Django',
  'Java', 'Spring Boot', 'Flutter', 'Firebase', 'HTML', 'CSS',
  'Tailwind', 'Bootstrap', 'Git', 'GitHub', 'Docker', 'API REST'
];

export default function DashboardProfesores() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [view, setView] = useState('dashboard');
  
  // ESTADO PARA EL MENÚ MÓVIL
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [evidencias, setEvidencias] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [perfilProfesor, setPerfilProfesor] = useState(null);
  const [perfilForm, setPerfilForm] = useState({ nombre: '', apellido: '', telefono: '', departamento: '', asignaturas: '', grado_academico: '', especialidad: '', biografia: '', linkedin: '', orcid: '', horario_atencion: '', mentorias: false, nueva_password: '' });
  const [perfilFoto, setPerfilFoto] = useState(null);
  const [showPerfilPass, setShowPerfilPass] = useState(false);
  const [horarioForm, setHorarioForm] = useState({ titulo: '', descripcion: '' });
  const [horarioFile, setHorarioFile] = useState(null);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingProyectos, setLoadingProyectos] = useState(false);
  const [loadingEvidencias, setLoadingEvidencias] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const [tecnologiasSeleccionadas, setTecnologiasSeleccionadas] = useState([]);
  const [imgPrincipal, setImgPrincipal] = useState(null);
  const imgProyectoRef = useRef(null);

  const [tituloProyecto, setTituloProyecto] = useState('');
  const [descProyecto, setDescProyecto] = useState('');
  const [estadoProyecto, setEstadoProyecto] = useState('en progreso');
  const [areaTrabajo, setAreaTrabajo] = useState('');
  const [ambitoDesarrollo, setAmbitoDesarrollo] = useState('');
  const [esInnovacion, setEsInnovacion] = useState(false);
  const [yaTrabaja, setYaTrabaja] = useState(false);
  const [competenciaImpacto, setCompetenciaImpacto] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [actividades, setActividades] = useState('');

  const [savingProyecto, setSavingProyecto] = useState(false);
  const [uploadResult, setUploadResult] = useState('');
  const [uploadError, setUploadError] = useState('');

  const [editingProyectoId, setEditingProyectoId] = useState(null);

  const [archivoEvidencia, setArchivoEvidencia] = useState(null);
  const [tipoEvidencia, setTipoEvidencia] = useState('');
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState('');

  const evidenciaRef = useRef(null);

  // ESTADOS PARA FACE ID
  const [errorBio, setErrorBio] = useState('');
  const [successBio, setSuccessBio] = useState('');
  const [loadingBio, setLoadingBio] = useState(false);

  const nombreCompleto = user.nombre ? `${user.nombre} ${user.apellido}` : 'Profesor';

  // FUNCIÓN PARA CAMBIAR DE VISTA Y CERRAR EL MENÚ EN MÓVIL
  const handleNavClick = (vista) => {
    setView(vista);
    setIsMobileMenuOpen(false);
  };

  const toggleTecnologia = (tech) => {
    setTecnologiasSeleccionadas((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const generarPDFPerfil = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('SkillMatch - Perfil del Profesor', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, 26);
    doc.line(14, 30, 196, 30);
    doc.text(`Nombre: ${nombreCompleto}`, 14, 40);
    doc.text(`Correo: ${user.correo || '—'}`, 14, 47);
    doc.text(`Proyectos registrados: ${proyectos.length}`, 14, 54);

    const rows = proyectos.map((p, i) => [i + 1, p.titulo, p.estado, formatFecha(p.fecha_registro)]);
    autoTable(doc, {
      startY: 65,
      head: [['#', 'Proyecto', 'Estado', 'Fecha']],
      body: rows,
      headStyles: { fillColor: [36, 78, 124] }
    });
    doc.save(`perfil_profesor_${user.nombre}.pdf`);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const cargarDashboard = async () => {
    try {
      setLoadingDashboard(true);
      const res = await fetch(`${API_BASE}/profesor/dashboard`, { 
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDashboardData(data.dashboard);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const cargarProyectos = async () => {
    try {
      setLoadingProyectos(true);
      const res = await fetch(`${API_BASE}/profesor/proyectos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProyectos(data.proyectos || []);
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setLoadingProyectos(false);
    }
  };

  const cargarEvidencias = async () => {
    try {
      setLoadingEvidencias(true);
      const res = await fetch(`${API_BASE}/profesor/evidencias`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEvidencias(data.evidencias || []);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setLoadingEvidencias(false);
    }
  };

  const cargarPerfilProfesor = async () => {
    try {
      const res = await fetch(`${API_BASE}/profesor/perfil`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) {
        setPerfilProfesor(data);
        setPerfilForm({
          nombre: data.usuario?.nombre || '',
          apellido: data.usuario?.apellido || '',
          telefono: data.usuario?.telefono || '',
          departamento: data.profesor?.departamento || '',
          asignaturas: data.profesor?.asignaturas || '',
          grado_academico: data.profesor?.grado_academico || '', especialidad: data.profesor?.especialidad || '', biografia: data.profesor?.biografia || '', linkedin: data.profesor?.linkedin || '', orcid: data.profesor?.orcid || '', horario_atencion: data.profesor?.horario_atencion || '', mentorias: Boolean(data.profesor?.mentorias),
          nueva_password: ''
        });
      }
    } catch (error) {
      console.error('Error al cargar perfil', error);
    }
  };

  const guardarPerfilProfesor = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(perfilForm).forEach(([k, v]) => fd.append(k, v));
      if (perfilFoto) fd.append('foto_perfil', perfilFoto);
      const res = await fetch(`${API_BASE}/profesor/perfil`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!data.ok) return showToast(data.mensaje || 'No se pudo actualizar el perfil',{type:'error'});
      localStorage.setItem('user', JSON.stringify({ ...user, ...data.usuario }));
      showToast('Perfil actualizado correctamente',{type:'success'});
      setPerfilFoto(null);
      cargarPerfilProfesor();
    } catch (error) {
      showToast('Error de conexión al actualizar perfil',{type:'error'});
    }
  };

  const cargarHorarios = async () => {
    try {
      setLoadingHorarios(true);
      const res = await fetch(`${API_BASE}/profesor/horarios`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setHorarios(data.horarios || []);
    } catch (error) {
      console.error('Error al cargar horarios', error);
    } finally {
      setLoadingHorarios(false);
    }
  };

  const subirHorario = async (e) => {
    e.preventDefault();
    if (!horarioForm.titulo || !horarioFile) return showToast('Título y archivo PDF o imagen son obligatorios',{type:'warning'});
    const fd = new FormData();
    fd.append('titulo', horarioForm.titulo);
    fd.append('descripcion', horarioForm.descripcion);
    fd.append('ruta_pdf', horarioFile);
    const res = await fetch(`${API_BASE}/profesor/horarios`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const data = await res.json();
    if (!data.ok) return showToast(data.mensaje || 'No se pudo subir el horario',{type:'error'});
    setHorarioForm({ titulo: '', descripcion: '' });
    setHorarioFile(null);
    cargarHorarios();
  };

  const eliminarHorario = async (id) => {
    if (!await confirmDialog({title:'Eliminar horario',message:'Esta acción retirará el horario seleccionado.',confirmText:'Eliminar',tone:'danger'})) return;
    await fetch(`${API_BASE}/profesor/horarios/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    cargarHorarios();
  };

  const handleRegistrarFaceID = async () => {
    setErrorBio(''); setSuccessBio(''); setLoadingBio(true);
    try {
      const resOptions = await fetch(`${API_BASE}/auth/biometric-reg-options`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const options = await resOptions.json();
      const regResp = await startRegistration(options);
      const resVerify = await fetch(`${API_BASE}/auth/biometric-reg-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...regResp, challenge: options.challenge })
      });
      const result = await resVerify.json();
      if (result.ok) setSuccessBio('✓ Face ID activado con éxito.');
      else throw new Error(result.mensaje);
    } catch (err) {
      setErrorBio('No se pudo activar la biometría: ' + err.message);
    } finally {
      setLoadingBio(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarDashboard();
    cargarProyectos();
    cargarEvidencias();
    cargarPerfilProfesor();
    cargarHorarios();
  }, []);

  const limpiarFormularioProyecto = () => {
    setTituloProyecto('');
    setDescProyecto('');
    setEstadoProyecto('en progreso');
    setAreaTrabajo('');
    setAmbitoDesarrollo('');
    setEsInnovacion(false);
    setYaTrabaja(false);
    setCompetenciaImpacto('');
    setObjetivo('');
    setActividades('');
    setTecnologiasSeleccionadas([]);
    setImgPrincipal(null);
    setEditingProyectoId(null);
    setUploadError('');
    setUploadResult('');
    if (imgProyectoRef.current) imgProyectoRef.current.value = '';
  };

  const handleGuardarProyecto = async () => {
    setUploadError(''); setUploadResult('');
    if (!tituloProyecto.trim()) { setUploadError('El título es obligatorio.'); return; }
    setSavingProyecto(true);
    try {
      const formData = new FormData();
      formData.append('titulo', tituloProyecto);
      formData.append('descripcion', descProyecto);
      formData.append('estado', estadoProyecto);
      formData.append('area_trabajo', areaTrabajo);
      formData.append('ambito_desarrollo', ambitoDesarrollo);
      formData.append('es_innovacion', esInnovacion ? '1' : '0');
      formData.append('ya_trabaja', yaTrabaja ? '1' : '0');
      formData.append('competencia_impacto', competenciaImpacto);
      formData.append('objetivo', objetivo);
      formData.append('actividades', actividades);
      formData.append('tecnologias', tecnologiasSeleccionadas.join(','));
      if (imgPrincipal) formData.append('img_principal', imgPrincipal);

      const url = editingProyectoId ? `${API_BASE}/profesor/proyectos/${editingProyectoId}` : `${API_BASE}/profesor/proyectos`;
      const res = await fetch(url, {
        method: editingProyectoId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Error al guardar');
      setUploadResult('Proyecto guardado con éxito.');
      limpiarFormularioProyecto();
      cargarProyectos();
      handleNavClick('proyectos');
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setSavingProyecto(false);
    }
  };

  const handleEditarProyecto = (p) => {
    setTituloProyecto(p.titulo || '');
    setDescProyecto(p.descripcion || '');
    setEstadoProyecto(p.estado || 'en progreso');
    setAreaTrabajo(p.area_trabajo || '');
    setAmbitoDesarrollo(p.ambito_desarrollo || '');
    setEsInnovacion(p.es_innovacion === 1);
    setYaTrabaja(p.ya_trabaja === 1);
    setCompetenciaImpacto(p.competencia_impacto || '');
    setObjetivo(p.objetivo || '');
    setActividades(p.actividades || '');
    setTecnologiasSeleccionadas(
      p.tecnologias ? p.tecnologias.split(',').map(t => t.trim()).filter(Boolean) : []
    );
    setImgPrincipal(null);
    setEditingProyectoId(p.id_proyecto);
    handleNavClick('subir');
  };

  const handleEliminarProyecto = async (id) => {
    const confirmar = await confirmDialog({title:'Eliminar proyecto',message:'Esta acción eliminará el proyecto seleccionado.',confirmText:'Eliminar',tone:'danger'});
    if (!confirmar) return;

    try {
      const res = await fetch(`${API_BASE}/profesor/proyectos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo eliminar el proyecto');

      cargarProyectos();
      cargarDashboard();
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleSubirEvidencia = async () => {
    setSavingProyecto(true);
    try {
      const formData = new FormData();
      formData.append('id_proyecto', proyectoSeleccionado);
      formData.append('archivo', archivoEvidencia);
      const res = await fetch(`${API_BASE}/profesor/evidencias`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) { setUploadResult('Evidencia subida.'); cargarEvidencias(); }
    } catch (err) { setUploadError(err.message); }
    finally { setSavingProyecto(false); }
  };

  return (
    <div className="app">
 {/* OVERLAY MÓVIL */}
      {isMobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

 {/* SIDEBAR (Con clase dinámica) */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="brand">Skill<span>Match</span></div>
          <div className="subtitle">Portal Profesores</div>
        </div>

        <div className="nav-wrap">
          <div className="nav-group-label">Principal</div>
          <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>
            <span className="icon"><AppIcon name="dashboard" /></span> Dashboard
          </div>
          
          <div className="nav-item" onClick={() => navigate('/estadias')}>
            <span className="nav-icon"><AppIcon name="graduation" /></span> Estadías
          </div>
          <div className={`nav-item ${view === 'horarios' ? 'active' : ''}`} onClick={() => handleNavClick('horarios')}>
            <span className="icon"><AppIcon name="calendar" /></span> Mi horario
          </div>

          <div className={`nav-item ${view === 'proyectos' ? 'active' : ''}`} onClick={() => handleNavClick('proyectos')}>
            <span className="icon"><AppIcon name="folder" /></span> Mis proyectos
          </div>
          <div className={`nav-item ${view === 'documentos' ? 'active' : ''}`} onClick={() => handleNavClick('documentos')}>
            <span className="icon"><AppIcon name="file" /></span> Documentos
          </div>

          <div className="nav-group-label" style={{ marginTop: '8px' }}>Cuenta</div>
          <div className={`nav-item ${view === 'perfil' ? 'active' : ''}`} onClick={() => handleNavClick('perfil')}>
            <span className="icon"><AppIcon name="user" /></span> Mi perfil
          </div>
        </div>
          
        <div className="sidebar-bottom">
          <button className="sidebar-logout-btn" onClick={cerrarSesion}><AppIcon name="logout" /> Cerrar sesión</button>
        </div>
      </aside>

      <main className="main">
        {view === 'dashboard' && (
          <>
            <div className="topbar">
              <div className="topbar-left-wrap">
 {/* BOTÓN HAMBURGUESA */}
                <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <div className="topbar-left">
                  <div className="topbar-title">Dashboard — Profesor</div>
                  <div className="topbar-sub">Gestión académica y seguimiento de proyectos</div>
                </div>
              </div>
            </div>
            <div className="content">
                <div className="perfil-card">
                  <div className="perf-avatar">{initials(nombreCompleto)}</div>
                  <div>
                    <div className="perf-name">{nombreCompleto}</div>
                    <div className="perf-cargo">Catedrático — SkillMatch UTEQ</div>
                  </div>
                </div>
                {/* Métricas rápidas */}
                <div className="metrics-grid">
                    <div className="metric-card" style={{ '--card-accent': '#244E7C' }}>
                      <div className="metric-label">Tus Proyectos</div>
                      <div className="metric-value">{proyectos.length}</div>
                    </div>
                    <div className="metric-card" style={{ '--card-accent': '#22c55e' }}>
                      <div className="metric-label">Horarios subidos</div>
                      <div className="metric-value">{horarios.length}</div>
                    </div>
                    <div className="metric-card" style={{ '--card-accent': '#d97706' }}>
                      <div className="metric-label">Siguiente mejora</div>
                      <div className="metric-value" style={{ fontSize: '18px' }}>Portafolio</div>
                    </div>
                </div>
                <DashboardInsights
                  title="Actividad académica"
                  subtitle="Proyectos, evidencias y recursos administrados desde tu panel"
                  labels={['Proyectos', 'Evidencias', 'Horarios']}
                  values={[proyectos.length, evidencias.length, horarios.length]}
                  progress={Math.min(100, 35 + (proyectos.length * 10) + (horarios.length * 5))}
                  progressLabel="Perfil académico"
                />
            </div>
          </>
        )}

        {view === 'horarios' && (
          <>
            <div className="topbar">
              <div className="topbar-left-wrap">
                <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>☰</button>
                <div className="topbar-left"><div className="topbar-title">Mi horario académico</div><div className="topbar-sub">Cada profesor administra su propio horario.</div></div>
              </div>
            </div>
            <div className="content">
              <form onSubmit={subirHorario} className="metric-card" style={{ maxWidth: 760, marginBottom: 24 }}>
                <h3>Subir horario PDF o imagen</h3>
                <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={horarioForm.titulo} onChange={e => setHorarioForm({ ...horarioForm, titulo: e.target.value })} placeholder="Horario Mayo-Agosto 2026" /></div>
                <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={horarioForm.descripcion} onChange={e => setHorarioForm({ ...horarioForm, descripcion: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Archivo PDF o imagen</label><input className="form-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setHorarioFile(e.target.files?.[0] || null)} /></div>
                <button className="btn btn-primary" type="submit">Subir horario</button>
              </form>
              <div className="table-wrap">
                <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}><div>Horario</div><div>Fecha</div><div>Acciones</div></div>
                {loadingHorarios ? <div className="loading-box">Cargando horarios...</div> : horarios.length === 0 ? <div style={{ padding: 20, color: 'var(--muted)' }}>No has subido horarios.</div> : horarios.map(h => (
                  <div className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr' }} key={h.id_horario}>
                    <div><b>{h.titulo}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>{h.descripcion || 'Sin descripción'}</div></div>
                    <div>{formatFecha(h.fecha_subida)}</div>
                    <div style={{ display: 'flex', gap: 8 }}><a className="btn btn-ghost" href={getFileSource(h.ruta_pdf)} target="_blank" rel="noreferrer">Ver</a><button className="btn btn-danger" onClick={() => eliminarHorario(h.id_horario)}>Eliminar</button></div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'proyectos' && (
            <>
              <div className="topbar">
                <div className="topbar-left-wrap">
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                  <div className="topbar-left"><div className="topbar-title">Mis proyectos registrados</div></div>
                </div>
                <div className="topbar-actions">
                  <button className="btn btn-primary" onClick={() => { limpiarFormularioProyecto(); handleNavClick('subir'); }}>+ Nuevo Proyecto</button>
                </div>
              </div>
              <div className="content">
                {proyectos.length === 0 ? (
                  <div className="table-wrap">
                    <div className="empty-state">
                      <div className="empty-icon"><AppIcon name="folder" size={32} /></div>
                      <div className="empty-title">No tienes proyectos aún</div>
                      <div className="empty-sub">Registra tu primer proyecto como profesor</div>
                    </div>
                  </div>
                ) : (
                  <div className="proyectos-grid">
                    {proyectos.map(p => (
                      <div key={p.id_proyecto} className="proyecto-card">
                          <div>
                            <div className="proyecto-header">
                              <div className="proyecto-titulo">{p.titulo}</div>
                              <div className="proyecto-desc">{p.descripcion || 'Sin descripción'}</div>
                              <div style={{fontSize: '11px', color: 'var(--muted)', marginTop: '8px'}}>
                                Registrado: {formatFecha(p.fecha_registro)}
                              </div>
                            </div>

                            {p.img_principal && (
                              <div style={{ marginBottom: '10px' }}>
                                <img
                                  src={getFileSource(p.img_principal)}
                                  alt={p.titulo}
                                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <div style={{ marginBottom: '10px' }}>
                              <span className={badgeClassByEstado(p.estado)}>{p.estado}</span>
                            </div>
                            <div className="proyecto-actions">
                              <button className="btn btn-ghost" onClick={() => handleEditarProyecto(p)}>Editar</button>
                              <button className="btn btn-danger" onClick={() => handleEliminarProyecto(p.id_proyecto)}>Eliminar</button>
                            </div>
                          </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
        )}

        {view === 'subir' && (
            <>
              <div className="topbar">
                <div className="topbar-left-wrap">
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                  <div className="topbar-title">{editingProyectoId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</div>
                </div>
              </div>
              <div className="content">
                <div style={{ maxWidth: '760px' }}>
                  {uploadResult && (
                    <div className="alert alert-success">
                      <span>✓</span> {uploadResult}
                    </div>
                  )}

                  {uploadError && (
                    <div className="alert alert-error">
                      <span>✕</span> {uploadError}
                    </div>
                  )}

                  <div className="metric-card">
                    <div className="form-group">
                      <label className="form-label">Título del proyecto *</label>
                      <input className="form-input" placeholder="Ej: Investigación de IA" value={tituloProyecto} onChange={e => setTituloProyecto(e.target.value)} />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Descripción</label>
                      <textarea className="form-textarea" placeholder="Describe brevemente el proyecto" value={descProyecto} onChange={e => setDescProyecto(e.target.value)} />
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Área de trabajo</label>
                        <input className="form-input" type="text" placeholder="Ej: Redes, Software" value={areaTrabajo} onChange={(e) => setAreaTrabajo(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ámbito de desarrollo</label>
                        <select className="form-input" value={ambitoDesarrollo} onChange={(e) => setAmbitoDesarrollo(e.target.value)}>
                          <option value="">Selecciona un ámbito</option>
                          <option value="Web">Web</option>
                          <option value="Móvil">Móvil</option>
                          <option value="Escritorio">Escritorio</option>
                          <option value="IoT">IoT</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', margin: '15px 0', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        <input type="checkbox" checked={esInnovacion} onChange={(e) => setEsInnovacion(e.target.checked)} />
                        ¿Es un proyecto de innovación?
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        <input type="checkbox" checked={yaTrabaja} onChange={(e) => setYaTrabaja(e.target.checked)} />
                        ¿Ya se está trabajando actualmente?
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Competencia / Impacto</label>
                      <select className="form-input" value={competenciaImpacto} onChange={(e) => setCompetenciaImpacto(e.target.value)}>
                        <option value="">Selecciona impacto</option>
                        <option value="L">Local</option>
                        <option value="R">Regional</option>
                        <option value="N">Nacional</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Objetivo del proyecto</label>
                      <textarea className="form-textarea" style={{ height: '80px' }} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Actividades realizadas</label>
                      <textarea className="form-textarea" style={{ height: '80px' }} value={actividades} onChange={(e) => setActividades(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Imagen principal</label>
                      <input className="form-input" type="file" accept=".jpg,.jpeg,.png,.webp" ref={imgProyectoRef} onChange={(e) => { if (e.target.files[0]) setImgPrincipal(e.target.files[0]); }} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Tecnologías usadas</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        {tecnologiasDisponibles.map((tech) => {
                          const selected = tecnologiasSeleccionadas.includes(tech);
                          return (
                            <button
                              key={tech}
                              type="button"
                              onClick={() => toggleTecnologia(tech)}
                              style={{
                                padding: '7px 12px',
                                borderRadius: '20px',
                                border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
                                background: selected ? 'var(--primary)' : 'white',
                                color: selected ? 'white' : 'var(--text)',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              {tech}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Estado</label>
                      <select className="form-input" value={estadoProyecto} onChange={(e) => setEstadoProyecto(e.target.value)}>
                        <option value="en progreso">En progreso</option>
                        <option value="completado">Completado</option>
                        <option value="pausado">Pausado</option>
                      </select>
                    </div>

                    <div className="modal-actions">
                      <button className="btn btn-ghost" onClick={limpiarFormularioProyecto} disabled={savingProyecto}>Limpiar</button>
                      <button className="btn btn-primary" onClick={handleGuardarProyecto} disabled={savingProyecto}>
                        {savingProyecto ? 'Guardando...' : editingProyectoId ? 'Guardar cambios' : '+ Registrar proyecto'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
        )}

        {view === 'documentos' && (
           <>
             <div className="topbar">
               <div className="topbar-left-wrap">
                 <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                 </button>
                 <div className="topbar-title">Documentos Registrados</div>
               </div>
             </div>
             <div className="content">
                <div className="table-wrap">
                  <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr' }}>
                    <div>Archivo</div>
                    <div>Fecha</div>
                  </div>
                  {evidencias.length === 0 ? (
                    <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>No tienes evidencias subidas.</div>
                  ) : (
                    evidencias.map(ev => (
                      <div className="table-row" style={{ gridTemplateColumns: '2fr 1fr' }} key={ev.id_evidencia}>
                        <div className="file-name">{ev.nombre_original || 'Archivo'}</div>
                        <div style={{fontSize: '12px', color: 'var(--muted)'}}>{formatFecha(ev.fecha_subida)}</div>
                      </div>
                    ))
                  )}
                </div>
             </div>
           </>
        )}

        {view === 'perfil' && (
          <>
            <div className="topbar">
              <div className="topbar-left-wrap">
                <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>☰</button>
                <div className="topbar-title">Mi Perfil</div>
              </div>
              <div className="topbar-actions"><button className="btn btn-ghost" onClick={generarPDFPerfil}>Descargar PDF</button></div>
            </div>
            <div className="content">
              <form onSubmit={guardarPerfilProfesor} className="metric-card" style={{ maxWidth: 820 }}>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 20 }}>
                  {perfilProfesor?.usuario?.foto_perfil ? <img src={getFileSource(perfilProfesor.usuario.foto_perfil)} alt="perfil" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '50%' }} /> : <div className="perf-avatar">{initials(nombreCompleto)}</div>}
                  <div><h3 style={{ margin: 0 }}>{nombreCompleto}</h3><p style={{ color: 'var(--muted)', margin: '4px 0' }}>Profesor UTEQ</p></div>
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  <div className="form-group"><label className="form-label">Foto de perfil</label><input className="form-input" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e => setPerfilFoto(e.target.files?.[0] || null)} /></div>
                  <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={perfilForm.nombre} onChange={e => setPerfilForm({ ...perfilForm, nombre: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Apellido</label><input className="form-input" value={perfilForm.apellido} onChange={e => setPerfilForm({ ...perfilForm, apellido: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={perfilForm.telefono} onChange={e => setPerfilForm({ ...perfilForm, telefono: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Departamento</label><input className="form-input" value={perfilForm.departamento} onChange={e => setPerfilForm({ ...perfilForm, departamento: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Asignaturas</label><input className="form-input" value={perfilForm.asignaturas} onChange={e => setPerfilForm({ ...perfilForm, asignaturas: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Grado académico</label><input className="form-input" value={perfilForm.grado_academico} onChange={e => setPerfilForm({ ...perfilForm, grado_academico: e.target.value })} placeholder="Ej. Maestría en Tecnologías de la Información" /></div>
                  <div className="form-group"><label className="form-label">Especialidad / áreas de experiencia</label><input className="form-input" value={perfilForm.especialidad} onChange={e => setPerfilForm({ ...perfilForm, especialidad: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Biografía profesional</label><textarea className="form-input" style={{ minHeight: 100 }} value={perfilForm.biografia} onChange={e => setPerfilForm({ ...perfilForm, biografia: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">LinkedIn</label><input className="form-input" value={perfilForm.linkedin} onChange={e => setPerfilForm({ ...perfilForm, linkedin: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">ORCID</label><input className="form-input" value={perfilForm.orcid} onChange={e => setPerfilForm({ ...perfilForm, orcid: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Horario de atención</label><input className="form-input" value={perfilForm.horario_atencion} onChange={e => setPerfilForm({ ...perfilForm, horario_atencion: e.target.value })} placeholder="Ej. Martes y jueves 13:00–15:00" /></div>
                  <label style={{ display:'flex', gap:8, alignItems:'center', margin:'8px 0 16px' }}><input type="checkbox" checked={perfilForm.mentorias} onChange={e => setPerfilForm({ ...perfilForm, mentorias: e.target.checked })} /> Disponible para mentorías</label>
                  <div className="form-group"><label className="form-label">Nueva contraseña</label><div style={{ position: 'relative' }}><input className="form-input" type={showPerfilPass ? 'text' : 'password'} minLength={8} placeholder="Opcional" value={perfilForm.nueva_password} onChange={e => setPerfilForm({ ...perfilForm, nueva_password: e.target.value })} /><button type="button" onClick={() => setShowPerfilPass(!showPerfilPass)} style={{ position: 'absolute', right: 10, top: 8, border: 0, background: 'transparent', cursor: 'pointer' }}><AppIcon name={showPerfilPass ? 'eyeOff' : 'eye'} size={18} /></button></div></div>
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: 16 }}>Guardar cambios</button>
              </form>
              <div className="metric-card" style={{ maxWidth: 820, marginTop: 20 }}>
                <h3>Seguridad Biométrica</h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Usa Face ID o huella digital para tu cuenta de profesor.</p>
                <button className="btn btn-primary" onClick={handleRegistrarFaceID}>Activar Face ID</button>
                {errorBio && <p className="error-msg" style={{ marginTop: '10px' }}>{errorBio}</p>}
                {successBio && <p style={{ color: 'var(--green)', fontSize: '13px', fontWeight: 'bold', marginTop: '10px' }}>{successBio}</p>}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

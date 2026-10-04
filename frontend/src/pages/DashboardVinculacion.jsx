import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../CSS/DashboardVinculacion.css';
import { API_BASE, buildFileUrl } from '../config/api';
import DashboardInsights from '../components/DashboardInsights';
import AppIcon from '../components/AppIcon';

const initials = (name) => name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'SM';
const formatFecha = (fecha) => fecha ? new Date(fecha).toLocaleDateString('es-MX') : '—';

const inferAssetType = (item = {}) => {
  const mime = String(item?.mime_type || '').toLowerCase();
  const ruta = String(item?.ruta_archivo || item || '').split('?')[0].toLowerCase();
  if (item?.tipo === 'video' || mime.startsWith('video/') || /\.(mp4|webm|mov)$/.test(ruta)) return 'video';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/.test(ruta)) return 'imagen';
  if (mime === 'application/pdf' || /\.pdf$/.test(ruta)) return 'documento';
  return 'archivo';
};

const archivoNombre = (item = {}) => item.nombre_original || String(item.ruta_archivo || '').split('?')[0].split('/').pop() || 'Archivo';

const estadoEmpresaLabel = {
  pendiente: 'Pendiente',
  habilitada: 'Habilitada',
  deshabilitada: 'Deshabilitada',
  rechazada: 'Rechazada'
};

const menuAdmin = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'alumnos', label: 'Estudiantes', icon: 'users' },
  { key: 'profesores', label: 'Profesores', icon: 'teacher' },
  { key: 'proyectos', label: 'Proyectos', icon: 'folder' },
  { key: 'empresas', label: 'Empresas', icon: 'building' },
  { key: 'estadias', label: 'Estadías', icon: 'graduation' },
  { key: 'chatbot', label: 'Chatbot', icon: 'bot' },
  { key: 'perfil', label: 'Mi perfil', icon: 'user' },
];

const menuVinculacion = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'empresas', label: 'Empresas', icon: 'building' },
  { key: 'vacantes', label: 'Vacantes', icon: 'briefcase' },
  { key: 'postulaciones', label: 'Postulaciones', icon: 'clipboard' },
  { key: 'candidatos', label: 'Candidatos', icon: 'target' },
  { key: 'reportes', label: 'Reportes', icon: 'report' },
  { key: 'perfil', label: 'Mi perfil', icon: 'user' },
];

export default function DashboardVinculacion() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = Number(user.id_rol) === 1;
  const isVinculacion = Number(user.id_rol) === 5;
  const menu = isAdmin ? menuAdmin : menuVinculacion;

  const [view, setView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [empresas, setEmpresas] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [vacantes, setVacantes] = useState([]);
  const [postulaciones, setPostulaciones] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [reportes, setReportes] = useState({});
  const [listSearch, setListSearch] = useState('');
  const [listStatus, setListStatus] = useState('todos');
  const [listSecondary, setListSecondary] = useState('todos');
  const [listSort, setListSort] = useState('recientes');

  const [detalle, setDetalle] = useState(null);
  const [detalleTipo, setDetalleTipo] = useState('');
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detallePermisos, setDetallePermisos] = useState({ puedeGestionar: false });

  const [chatbotItems, setChatbotItems] = useState([]);
  const [chatbotForm, setChatbotForm] = useState({ pregunta: '', respuesta: '', categoria: 'general', keywords: '', activa: true });
  const [editingBotId, setEditingBotId] = useState(null);

  const [perfil, setPerfil] = useState(null);
  const [perfilForm, setPerfilForm] = useState({ nombre: '', apellido: '', telefono: '', cargo_institucional: '', area_institucional: '', extension: '', oficina: '', bio_profesional: '', nueva_password: '', confirmar_password: '' });
  const [perfilFoto, setPerfilFoto] = useState(null);
  const [showPerfilPass, setShowPerfilPass] = useState(false);

  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [showEmpresaPassword, setShowEmpresaPassword] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({
    razon_social: '', rfc: '', domicilio: '', ubicacion: '', giro: '', sector: '', responsable_nombre: '', responsable_apellido: '', responsable_cargo: '', responsable_correo: '', responsable_telefono: '', correo: '', password: '', telefono: '', estado: 'habilitada', observaciones: ''
  });

  const navTitle = isAdmin ? 'Panel de Administración' : 'Panel de Vinculación';
  const navRole = isAdmin ? 'Administrador' : 'Vinculación';

  const handleNavClick = (vista) => {
    if (vista === 'estadias') {
      navigate('/estadias');
      setIsMobileMenuOpen(false);
      return;
    }

    setView(vista);
    setIsMobileMenuOpen(false);
    setListSearch('');
    setListStatus('todos');
    setListSecondary('todos');
    setListSort('recientes');
    if (vista === 'chatbot') cargarChatbot();
    if (vista === 'perfil') cargarPerfil();
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.mensaje || 'No se pudo cargar el panel');

      setStats(json.data.stats || {});
      setEmpresas(json.data.empresas || []);
      setAlumnos(json.data.alumnos || []);
      setProfesores(json.data.profesores || []);
      setProyectos(json.data.proyectos || []);
      setVacantes(json.data.vacantes || []);
      setPostulaciones(json.data.postulaciones || []);
      setCandidatos(json.data.candidatos || []);
      setReportes(json.data.reportes || {});
    } catch (error) {
      console.error('Error al cargar datos:', error);
      alert(error.message || 'Error al cargar datos del sistema');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarDatos();
  }, [token]);

  useEffect(() => {
    if (!menu.some(item => item.key === view)) setView('dashboard');
  }, [isAdmin, isVinculacion]);

  const abrirDetalle = async (tipo, id) => {
    setDetalleTipo(tipo);
    setDetalle(null);
    setDetallePermisos({ puedeGestionar: false });
    setDetalleLoading(true);
    try {
      const endpoint = tipo === 'empresa' ? 'empresas' : tipo === 'alumno' ? 'alumnos' : tipo === 'profesor' ? 'profesores' : tipo === 'proyecto' ? 'proyectos' : 'vacantes';
      const res = await fetch(`${API_BASE}/admin/${endpoint}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) {
        setDetalle(json[tipo]);
        setDetallePermisos(json.permisos || { puedeGestionar: isVinculacion });
      } else alert(json.mensaje || 'No se pudo cargar el detalle');
    } catch (error) {
      alert('Error de conexión al cargar detalle');
    } finally {
      setDetalleLoading(false);
    }
  };

  const abrirDetallePostulacion = async (postulacion) => {
    setDetalleTipo('postulacion');
    setDetalle(null);
    setDetalleLoading(true);
    try {
      const [alumnoRes, vacanteRes] = await Promise.all([
        fetch(`${API_BASE}/admin/alumnos/${postulacion.id_estudiante}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/vacantes/${postulacion.id_vacante}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const alumnoJson = await alumnoRes.json();
      const vacanteJson = await vacanteRes.json();
      if (!alumnoRes.ok || !alumnoJson.ok) throw new Error(alumnoJson.mensaje || 'No se pudo cargar el estudiante.');
      if (!vacanteRes.ok || !vacanteJson.ok) throw new Error(vacanteJson.mensaje || 'No se pudo cargar la vacante.');
      setDetalle({ postulacion, alumno: alumnoJson.alumno, vacante: vacanteJson.vacante });
    } catch (error) {
      alert(error.message || 'No se pudo cargar el detalle de la postulación.');
      setDetalleTipo('');
    } finally {
      setDetalleLoading(false);
    }
  };

  const cambiarEstadoEmpresa = async (id, nuevoEstado) => {
    if (!isVinculacion) return alert('Solo Vinculación puede cambiar el estado de empresas.');
    try {
      const res = await fetch(`${API_BASE}/admin/empresas/status/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nuevoEstado })
      });
      const data = await res.json();
      if (!data.ok) return alert(data.mensaje || 'No se pudo actualizar la empresa');
      await cargarDatos();
      if (detalleTipo === 'empresa') abrirDetalle('empresa', id);
    } catch (error) {
      alert('Error al actualizar empresa');
    }
  };

  const cambiarEstadoVacante = async (id, estado) => {
    if (!isVinculacion) return alert('Solo Vinculación puede cambiar el estado de vacantes.');
    try {
      const res = await fetch(`${API_BASE}/admin/vacantes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado })
      });
      const data = await res.json();
      if (!data.ok) return alert(data.mensaje || 'No se pudo actualizar la vacante');
      await cargarDatos();
      if (detalleTipo === 'vacante') abrirDetalle('vacante', id);
    } catch (error) {
      alert('Error al actualizar vacante');
    }
  };

  const cambiarEstadoUsuario = async (id, estado) => {
    if (!isAdmin) return alert('Solo el administrador puede suspender o habilitar cuentas.');
    const accion = estado === 'activo' ? 'habilitar' : 'suspender';
    if (!window.confirm(`¿Seguro que deseas ${accion} esta cuenta?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado })
      });
      const data = await res.json();
      if (!data.ok) return alert(data.mensaje || 'No se pudo cambiar el estado');
      await cargarDatos();
      if (detalle?.id_usuario === id) {
        setDetalle({ ...detalle, estado_usuario: estado });
      }
    } catch (error) {
      alert('Error al cambiar estado de cuenta');
    }
  };

  const handleCrearEmpresa = async (e) => {
    e.preventDefault();
    if (!isVinculacion) return alert('Solo Vinculación puede registrar empresas.');
    setSavingEmpresa(true);
    try {
      const res = await fetch(`${API_BASE}/admin/empresas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formEmpresa)
      });
      const data = await res.json();
      if (data.ok) {
        alert('Empresa registrada. Queda pendiente de validación por Vinculación.');
        setShowEmpresaModal(false);
        setFormEmpresa({ razon_social: '', rfc: '', domicilio: '', ubicacion: '', giro: '', sector: '', responsable_nombre: '', responsable_apellido: '', responsable_cargo: '', responsable_correo: '', responsable_telefono: '', correo: '', password: '', telefono: '', estado: 'habilitada', observaciones: '' });
        cargarDatos();
      } else alert(data.mensaje || 'No se pudo registrar la empresa');
    } catch (error) {
      alert('Error de conexión al registrar empresa');
    } finally {
      setSavingEmpresa(false);
    }
  };

  const cargarChatbot = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/admin/chatbot`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) setChatbotItems(json.items || []);
      else alert(json.mensaje || 'No se pudo cargar el chatbot');
    } catch (error) {
      console.error(error);
    }
  };

  const guardarChatbot = async (e) => {
    e.preventDefault();
    if (!isAdmin) return alert('Solo el administrador puede editar el chatbot.');
    const url = editingBotId ? `${API_BASE}/admin/chatbot/${editingBotId}` : `${API_BASE}/admin/chatbot`;
    const method = editingBotId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(chatbotForm)
    });
    const json = await res.json();
    if (!json.ok) return alert(json.mensaje || 'No se pudo guardar');
    setChatbotForm({ pregunta: '', respuesta: '', categoria: 'general', keywords: '', activa: true });
    setEditingBotId(null);
    cargarChatbot();
  };

  const editarChatbot = (item) => {
    setEditingBotId(item.id_pregunta);
    setChatbotForm({
      pregunta: item.pregunta || '',
      respuesta: item.respuesta || '',
      categoria: item.categoria || 'general',
      keywords: item.keywords || '',
      activa: item.activa !== false
    });
  };

  const eliminarChatbot = async (id) => {
    if (!window.confirm('¿Eliminar esta respuesta del chatbot?')) return;
    await fetch(`${API_BASE}/admin/chatbot/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    cargarChatbot();
  };

  const cargarPerfil = async () => {
    const res = await fetch(`${API_BASE}/admin/perfil`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.ok) {
      setPerfil(json.usuario);
      setPerfilForm({
        nombre: json.usuario.nombre || '',
        apellido: json.usuario.apellido || '',
        telefono: json.usuario.telefono || '',
        cargo_institucional: json.usuario.cargo_institucional || '',
        area_institucional: json.usuario.area_institucional || '',
        extension: json.usuario.extension || '',
        oficina: json.usuario.oficina || '',
        bio_profesional: json.usuario.bio_profesional || '',
        nueva_password: '',
        confirmar_password: ''
      });
    }
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    if (perfilForm.nueva_password && perfilForm.nueva_password !== perfilForm.confirmar_password) {
      alert('La nueva contraseña y la confirmación no coinciden.');
      return;
    }
    const fd = new FormData();
    Object.entries(perfilForm).forEach(([k, v]) => fd.append(k, v));
    if (perfilFoto) fd.append('foto_perfil', perfilFoto);
    const res = await fetch(`${API_BASE}/admin/perfil`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const json = await res.json();
    if (!json.ok) return alert(json.mensaje || 'No se pudo actualizar');
    localStorage.setItem('user', JSON.stringify({ ...user, ...json.usuario }));
    alert('Perfil actualizado correctamente');
    setPerfilFoto(null);
    cargarPerfil();
  };

  const filtrarLista = (items = []) => {
    const filtered = items.filter((item) => {
      const texto = Object.values(item || {}).filter((v) => ['string','number'].includes(typeof v)).join(' ').toLowerCase();
      const coincideTexto = !listSearch.trim() || texto.includes(listSearch.trim().toLowerCase());
      const estado = String(item?.estado || item?.estado_usuario || '').toLowerCase();
      const coincideEstado = listStatus === 'todos' || estado === listStatus;

      let coincideSecundario = true;
      if (listSecondary !== 'todos') {
        if (view === 'proyectos') coincideSecundario = String(item?.tipo_autor || '').toLowerCase() === listSecondary;
        if (view === 'alumnos') coincideSecundario = String(item?.estado_academico || '').toLowerCase() === listSecondary;
        if (view === 'empresas') coincideSecundario = String(item?.sector || '').toLowerCase().includes(listSecondary);
      }
      return coincideTexto && coincideEstado && coincideSecundario;
    });

    return [...filtered].sort((a, b) => {
      if (listSort === 'nombre') {
        const aa = String(a?.titulo || a?.nombre || a?.razon_social || a?.alumno || '').toLowerCase();
        const bb = String(b?.titulo || b?.nombre || b?.razon_social || b?.alumno || '').toLowerCase();
        return aa.localeCompare(bb, 'es');
      }
      const dateA = new Date(a?.fecha || a?.fecha_registro || a?.fecha_postulacion || 0).getTime() || 0;
      const dateB = new Date(b?.fecha || b?.fecha_registro || b?.fecha_postulacion || 0).getTime() || 0;
      return listSort === 'antiguos' ? dateA - dateB : dateB - dateA;
    });
  };

  const empresasPendientes = useMemo(() => empresas.filter(e => e.estado === 'pendiente'), [empresas]);

  if (loading) return <div className="loading-screen">Cargando datos del sistema...</div>;

  return (
    <div className="app">
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="brand">Skill<span>Match</span></div>
          <div className="brand-sub">{navTitle}</div>
        </div>
        <div className="nav-wrap">
          <div className="nav-group-label">Módulos</div>
          {menu.map((item) => (
            <div key={item.key} className={`nav-item ${view === item.key ? 'active' : ''}`} onClick={() => handleNavClick(item.key)}>
              <span className="nav-icon"><AppIcon name={item.icon} /></span>
              {item.label}
            </div>
          ))}
          <div className="nav-item" style={{ marginTop: 12, color: '#fca5a5' }} onClick={() => { localStorage.clear(); navigate('/'); }}>
            <span className="nav-icon"><AppIcon name="logout" /></span> Cerrar sesión
          </div>
          <div className="sidebar-build">SkillMatch V6.0</div>
        </div>
        <div className="sidebar-user">
          <div className="user-avatar">{initials(`${user.nombre || ''} ${user.apellido || ''}`)}</div>
          <div><div className="user-name">{user.nombre} {user.apellido}</div><div className="user-role">{navRole}</div></div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbar-left-wrap">
            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>☰</button>
            <div className="topbar-left">
              <div className="topbar-title">{getTituloVista(view, isAdmin)}</div>
              <div className="topbar-sub">{isAdmin ? 'Supervisión institucional y configuración general del sistema' : 'Gestión escuela-empresa, vacantes y candidatos'}</div>
            </div>
          </div>
          {isVinculacion && view === 'empresas' && <button className="btn btn-primary" onClick={() => setShowEmpresaModal(true)}>+ Registrar empresa</button>}
        </div>

        <div className="content">
          {view === 'dashboard' && <DashboardResumen isAdmin={isAdmin} stats={stats} empresasPendientes={empresasPendientes} abrirDetalle={abrirDetalle} handleNavClick={handleNavClick} />}

          {['empresas','alumnos','profesores','proyectos','vacantes','postulaciones','candidatos'].includes(view) && (
            <div className="list-filterbar">
              <div className="list-filterbar__search"><AppIcon name="search" size={16} /><input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Buscar por nombre, correo, carrera, empresa o palabra clave..." /></div>
              <select value={listStatus} onChange={e => setListStatus(e.target.value)} aria-label="Filtrar por estado">
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option><option value="inactivo">Inactivo</option>
                <option value="pendiente">Pendiente</option><option value="habilitada">Habilitada</option><option value="rechazada">Rechazada</option>
                <option value="abierta">Abierta</option><option value="pausada">Pausada</option><option value="cerrada">Cerrada</option>
                <option value="aceptada">Aceptada</option><option value="revisada">Revisada</option>
                <option value="en progreso">En progreso</option><option value="completado">Completado</option>
              </select>
              {view === 'proyectos' && <select value={listSecondary} onChange={e => setListSecondary(e.target.value)} aria-label="Filtrar proyectos por autor"><option value="todos">Todos los autores</option><option value="estudiante">Estudiantes</option><option value="profesor">Profesores</option></select>}
              {view === 'alumnos' && <select value={listSecondary} onChange={e => setListSecondary(e.target.value)} aria-label="Filtrar por estado académico"><option value="todos">Situación académica</option><option value="activo">Activo</option><option value="egresado">Egresado</option><option value="baja">Baja</option></select>}
              <select value={listSort} onChange={e => setListSort(e.target.value)} aria-label="Ordenar resultados"><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option><option value="nombre">A-Z</option></select>
              {(listSearch || listStatus !== 'todos' || listSecondary !== 'todos' || listSort !== 'recientes') && <button className="btn btn-ghost" onClick={() => { setListSearch(''); setListStatus('todos'); setListSecondary('todos'); setListSort('recientes'); }}>Limpiar</button>}
            </div>
          )}

          {view === 'empresas' && (
            <Table title={isAdmin ? 'Empresas registradas (solo consulta)' : 'Empresas registradas y validación'} empty="No hay empresas registradas" headers={['Empresa','Contacto','Estado','Vacantes','Acciones']}>
              {filtrarLista(empresas).map(e => <div className="table-row" key={e.id} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr' }}><div><b>{e.nombre}</b><div style={{ fontSize: 12, color: '#64748b' }}>{e.correo}</div></div><div>{e.contacto || '—'}</div><div><span className={`status ${e.estado}`}>{estadoEmpresaLabel[e.estado] || e.estado}</span></div><div>{e.total_vacantes || 0}</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn btn-ghost" onClick={() => abrirDetalle('empresa', e.id)}>Ver detalle</button>{isAdmin && <button className={e.estado_usuario === 'activo' ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => cambiarEstadoUsuario(e.id, e.estado_usuario === 'activo' ? 'inactivo' : 'activo')}>{e.estado_usuario === 'activo' ? 'Suspender' : 'Habilitar'}</button>}</div></div>)}
            </Table>
          )}

          {isAdmin && view === 'alumnos' && (
            <Table title="Estudiantes registrados" empty="No hay estudiantes registrados" headers={['Estudiante','Carrera','Cuatrimestre','Proyectos','Acciones']}>
              {filtrarLista(alumnos).map(a => <div className="table-row" key={a.id} style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{a.foto_perfil ? <img alt="perfil" src={buildFileUrl(a.foto_perfil)} style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' }} /> : <div className="user-avatar">{initials(a.nombre)}</div>}<div><b>{a.nombre}</b><div style={{ fontSize: 12, color: '#64748b' }}>{a.matricula}</div></div></div><div>{a.carrera}</div><div>{a.semestre || '—'}</div><div>{a.total_proyectos || 0}</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn btn-ghost" onClick={() => abrirDetalle('alumno', a.id)}>Ver detalle</button><button className={a.estado_usuario === 'activo' ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => cambiarEstadoUsuario(a.id, a.estado_usuario === 'activo' ? 'inactivo' : 'activo')}>{a.estado_usuario === 'activo' ? 'Suspender' : 'Habilitar'}</button></div></div>)}
            </Table>
          )}

          {isAdmin && view === 'profesores' && (
            <Table title="Profesores registrados" empty="No hay profesores registrados" headers={['Profesor','Departamento','Asignaturas','Horarios','Acciones']}>
              {filtrarLista(profesores).map(p => <div className="table-row" key={p.id} style={{ gridTemplateColumns: '2fr 1.4fr 2fr .8fr 1fr' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{p.foto_perfil ? <img alt="perfil" src={buildFileUrl(p.foto_perfil)} style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' }} /> : <div className="user-avatar">{initials(p.nombre)}</div>}<div><b>{p.nombre}</b><div style={{ fontSize: 12, color: '#64748b' }}>{p.correo}</div></div></div><div>{p.departamento || '—'}</div><div>{p.asignaturas || '—'}</div><div>{p.total_horarios || 0}</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn btn-ghost" onClick={() => abrirDetalle('profesor', p.id)}>Ver detalle</button><button className={p.estado_usuario === 'activo' ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => cambiarEstadoUsuario(p.id, p.estado_usuario === 'activo' ? 'inactivo' : 'activo')}>{p.estado_usuario === 'activo' ? 'Suspender' : 'Habilitar'}</button></div></div>)}
            </Table>
          )}

          {isAdmin && view === 'proyectos' && (
            <Table title="Proyectos" empty="No hay proyectos" headers={['Proyecto','Autor','Estado','Fecha','Acciones']}>
              {filtrarLista(proyectos).map(p => {
                const visual = p.img_principal || p.media?.find(m => inferAssetType(m) === 'imagen')?.ruta_archivo || p.media?.[0]?.ruta_archivo;
                return <div className="table-row" key={p.id} style={{ gridTemplateColumns: '2.2fr 1.4fr .9fr 1fr 1fr' }}>
                  <div className="project-admin-cell">
                    <div className="project-admin-thumb">{visual ? <img src={buildFileUrl(visual)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <AppIcon name="image" size={19} />}</div>
                    <div><b>{p.titulo}</b><div style={{ fontSize: 12, color: '#64748b' }}>{p.tipo_autor || 'Estudiante'} · {p.tecnologias || 'Sin tecnologías registradas'}</div></div>
                  </div>
                  <div>{p.autor || '—'}</div><div><span className="status">{p.estado || '—'}</span></div><div>{formatFecha(p.fecha)}</div><div><button className="btn btn-ghost" onClick={() => abrirDetalle('proyecto', p.id)}>Ver detalle</button></div>
                </div>;
              })}
            </Table>
          )}

          {isVinculacion && view === 'vacantes' && (
            <Table title="Vacantes de empresas" empty="No hay vacantes" headers={['Vacante','Empresa','Estado','Postulaciones','Acciones']}>
              {filtrarLista(vacantes).map(v => <div className="table-row" key={v.id} style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr' }}><div><b>{v.titulo}</b><div style={{ fontSize: 12, color: '#64748b' }}>{v.categoria || 'Sin categoría'}</div></div><div>{v.empresa}</div><div>{v.estado}</div><div>{v.total_postulaciones || 0}</div><div><button className="btn btn-ghost" onClick={() => abrirDetalle('vacante', v.id)}>Ver detalle</button></div></div>)}
            </Table>
          )}

          {isVinculacion && view === 'postulaciones' && (
            <Table title="Postulaciones" empty="No hay postulaciones" headers={['Alumno','Vacante','Empresa','Estado','Fecha','Acciones']}>
              {filtrarLista(postulaciones).map(p => <div className="table-row" key={p.id_postulacion} style={{ gridTemplateColumns: '2fr 1.7fr 1.5fr 1fr 1fr 1fr' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{p.foto_perfil ? <img alt="perfil" src={buildFileUrl(p.foto_perfil)} style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' }} /> : <div className="user-avatar">{initials(p.alumno)}</div>}<div><b>{p.alumno}</b><div style={{ fontSize: 12, color: '#64748b' }}>{p.carrera}</div></div></div><div>{p.vacante}</div><div>{p.empresa}</div><div>{p.estado}</div><div>{formatFecha(p.fecha_postulacion)}</div><div><button className="btn btn-ghost" onClick={() => abrirDetallePostulacion(p)}>Ver detalle</button></div></div>)}
            </Table>
          )}

          {isVinculacion && view === 'candidatos' && (
            <Table title="Candidatos con postulaciones" empty="Aún no hay candidatos postulados" headers={['Candidato','Carrera','Cuatrimestre','Postulaciones','Acciones']}>
              {filtrarLista(candidatos).map(c => <div className="table-row" key={c.id} style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{c.foto_perfil ? <img alt="perfil" src={buildFileUrl(c.foto_perfil)} style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' }} /> : <div className="user-avatar">{initials(c.nombre)}</div>}<div><b>{c.nombre}</b><div style={{ fontSize: 12, color: '#64748b' }}>{c.correo}</div></div></div><div>{c.carrera}</div><div>{c.semestre || '—'}</div><div>{c.total_postulaciones || 0}</div><div><button className="btn btn-ghost" onClick={() => abrirDetalle('alumno', c.id)}>Ver perfil</button></div></div>)}
            </Table>
          )}

          {isVinculacion && view === 'reportes' && <ReportesVinculacion stats={stats} reportes={reportes} />}

          {isAdmin && view === 'chatbot' && <ChatbotPanel chatbotItems={chatbotItems} chatbotForm={chatbotForm} setChatbotForm={setChatbotForm} editingBotId={editingBotId} setEditingBotId={setEditingBotId} guardarChatbot={guardarChatbot} editarChatbot={editarChatbot} eliminarChatbot={eliminarChatbot} />}

          {view === 'perfil' && (
            <form onSubmit={guardarPerfil} className="admin-form" style={{ background: 'white', padding: 28, borderRadius: 18, border: '1px solid #e2e8f0', maxWidth: 980 }}>
              <h3 style={{ marginBottom: 18 }}>Mi información</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, textAlign: 'center' }}>
                  {perfil?.foto_perfil ? <img alt="perfil" src={buildFileUrl(perfil.foto_perfil)} style={{ width: 118, height: 118, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 }} /> : <div className="user-avatar" style={{ width: 118, height: 118, margin: '0 auto 12px', fontSize: 32 }}>{initials(`${perfilForm.nombre} ${perfilForm.apellido}`)}</div>}
                  <label className="form-label">Foto de perfil</label>
                  <input className="form-input" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e => setPerfilFoto(e.target.files?.[0] || null)} />
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>{isAdmin ? 'Administrador institucional' : 'Gestión de Vinculación'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 16 }}>
                  <div><label className="form-label">Nombre</label><input className="form-input" value={perfilForm.nombre} onChange={e => setPerfilForm({ ...perfilForm, nombre: e.target.value })} /></div>
                  <div><label className="form-label">Apellido</label><input className="form-input" value={perfilForm.apellido} onChange={e => setPerfilForm({ ...perfilForm, apellido: e.target.value })} /></div>
                  <div><label className="form-label">Teléfono</label><input className="form-input" value={perfilForm.telefono} onChange={e => setPerfilForm({ ...perfilForm, telefono: e.target.value })} /></div>
                  <div><label className="form-label">Cargo institucional</label><input className="form-input" value={perfilForm.cargo_institucional} onChange={e => setPerfilForm({ ...perfilForm, cargo_institucional: e.target.value })} placeholder="Ej. Coordinador de plataforma" /></div>
                  <div><label className="form-label">Área / departamento</label><input className="form-input" value={perfilForm.area_institucional} onChange={e => setPerfilForm({ ...perfilForm, area_institucional: e.target.value })} /></div>
                  <div><label className="form-label">Extensión</label><input className="form-input" value={perfilForm.extension} onChange={e => setPerfilForm({ ...perfilForm, extension: e.target.value })} /></div>
                  <div><label className="form-label">Oficina</label><input className="form-input" value={perfilForm.oficina} onChange={e => setPerfilForm({ ...perfilForm, oficina: e.target.value })} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Descripción / responsabilidades</label><textarea className="form-input" style={{ minHeight: 100 }} value={perfilForm.bio_profesional} onChange={e => setPerfilForm({ ...perfilForm, bio_profesional: e.target.value })} placeholder="Responsabilidades, horarios de contacto o información útil para otros usuarios." /></div>
                  <div><label className="form-label">Nueva contraseña</label><div style={{ position: 'relative' }}><input className="form-input" type={showPerfilPass ? 'text' : 'password'} minLength={8} value={perfilForm.nueva_password} onChange={e => setPerfilForm({ ...perfilForm, nueva_password: e.target.value })} placeholder="Opcional" /><button type="button" onClick={() => setShowPerfilPass(!showPerfilPass)} style={{ position: 'absolute', right: 10, top: 8, border: 0, background: 'transparent', cursor: 'pointer' }}><AppIcon name={showPerfilPass ? 'eyeOff' : 'eye'} size={18} /></button></div></div>
                  <div><label className="form-label">Confirmar contraseña</label><div style={{ position: 'relative' }}><input className="form-input" type={showPerfilPass ? 'text' : 'password'} minLength={8} value={perfilForm.confirmar_password} onChange={e => setPerfilForm({ ...perfilForm, confirmar_password: e.target.value })} placeholder="Repite la contraseña" /><button type="button" onClick={() => setShowPerfilPass(!showPerfilPass)} style={{ position: 'absolute', right: 10, top: 8, border: 0, background: 'transparent', cursor: 'pointer' }}><AppIcon name={showPerfilPass ? 'eyeOff' : 'eye'} size={18} /></button></div></div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" type="submit">Guardar cambios</button></div>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>

      {(detalleLoading || detalle) && (
        <div className="modal-overlay" onClick={() => { setDetalle(null); setDetalleTipo(''); }}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => { setDetalle(null); setDetalleTipo(''); }}>×</button>
            {detalleLoading && <div style={{ padding: 40 }}>Cargando detalle...</div>}
            {detalle && detalleTipo === 'empresa' && <DetalleEmpresa empresa={detalle} puedeGestionar={detallePermisos.puedeGestionar && isVinculacion} cambiarEstadoEmpresa={cambiarEstadoEmpresa} token={token} onSaved={(empresaActualizada) => { setDetalle(empresaActualizada); cargarDatos(); }} />}
            {detalle && detalleTipo === 'alumno' && <DetalleAlumno alumno={detalle} />}
            {detalle && detalleTipo === 'profesor' && <DetalleProfesor profesor={detalle} />}
            {detalle && detalleTipo === 'vacante' && <DetalleVacante vacante={detalle} puedeGestionar={detallePermisos.puedeGestionar && isVinculacion} cambiarEstadoVacante={cambiarEstadoVacante} />}
            {detalle && detalleTipo === 'proyecto' && <DetalleProyecto proyecto={detalle} />}
            {detalle && detalleTipo === 'postulacion' && <DetallePostulacion data={detalle} />}
          </div>
        </div>
      )}

      {showEmpresaModal && (
        <div className="modal-overlay" onClick={() => setShowEmpresaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Registrar empresa</div>
            <form onSubmit={handleCrearEmpresa}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group"><label className="form-label">Razón social / nombre comercial *</label><input className="form-input" value={formEmpresa.razon_social} onChange={e => setFormEmpresa({ ...formEmpresa, razon_social: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">RFC *</label><input className="form-input" value={formEmpresa.rfc} onChange={e => setFormEmpresa({ ...formEmpresa, rfc: e.target.value.toUpperCase() })} required /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Domicilio *</label><input className="form-input" value={formEmpresa.domicilio} onChange={e => setFormEmpresa({ ...formEmpresa, domicilio: e.target.value })} placeholder="Calle, número, colonia o referencia" required /></div>
                <div className="form-group"><label className="form-label">Ubicación *</label><input className="form-input" value={formEmpresa.ubicacion} onChange={e => setFormEmpresa({ ...formEmpresa, ubicacion: e.target.value })} placeholder="Municipio, Estado" required /></div>
                <div className="form-group"><label className="form-label">Giro / sector</label><input className="form-input" value={formEmpresa.giro} onChange={e => setFormEmpresa({ ...formEmpresa, giro: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Nombre del responsable *</label><input className="form-input" value={formEmpresa.responsable_nombre} onChange={e => setFormEmpresa({ ...formEmpresa, responsable_nombre: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Apellido del responsable</label><input className="form-input" value={formEmpresa.responsable_apellido} onChange={e => setFormEmpresa({ ...formEmpresa, responsable_apellido: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Cargo del responsable</label><input className="form-input" value={formEmpresa.responsable_cargo} onChange={e => setFormEmpresa({ ...formEmpresa, responsable_cargo: e.target.value })} placeholder="RH, Director, Enlace, etc." /></div>
                <div className="form-group"><label className="form-label">Correo del responsable *</label><input className="form-input" type="email" value={formEmpresa.responsable_correo} onChange={e => setFormEmpresa({ ...formEmpresa, responsable_correo: e.target.value, correo: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Teléfono del responsable</label><input className="form-input" value={formEmpresa.responsable_telefono} onChange={e => setFormEmpresa({ ...formEmpresa, responsable_telefono: e.target.value, telefono: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Estado inicial</label><select className="form-input" value={formEmpresa.estado} onChange={e => setFormEmpresa({ ...formEmpresa, estado: e.target.value })}><option value="habilitada">Habilitada</option><option value="pendiente">Pendiente</option></select></div>
                <div className="form-group"><label className="form-label">Contraseña temporal *</label><div style={{ position: 'relative' }}><input className="form-input" type={showEmpresaPassword ? 'text' : 'password'} minLength={8} value={formEmpresa.password} onChange={e => setFormEmpresa({ ...formEmpresa, password: e.target.value })} required /><button type="button" onClick={() => setShowEmpresaPassword(!showEmpresaPassword)} style={{ position: 'absolute', right: 10, top: 8, border: 0, background: 'transparent', cursor: 'pointer' }}><AppIcon name={showEmpresaPassword ? 'eyeOff' : 'eye'} size={18} /></button></div></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Observaciones</label><textarea className="form-input" style={{ minHeight: 80 }} value={formEmpresa.observaciones} onChange={e => setFormEmpresa({ ...formEmpresa, observaciones: e.target.value })} /></div>
              </div>
              <div className="modal-actions"><button className="btn btn-ghost" type="button" onClick={() => setShowEmpresaModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={savingEmpresa}>{savingEmpresa ? 'Guardando...' : 'Guardar empresa'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getTituloVista(view, isAdmin) {
  const labels = {
    dashboard: isAdmin ? 'Dashboard administrador' : 'Dashboard vinculación',
    alumnos: 'Estudiantes',
    profesores: 'Profesores',
    proyectos: 'Proyectos',
    empresas: 'Empresas',
    vacantes: 'Vacantes',
    postulaciones: 'Postulaciones',
    candidatos: 'Candidatos',
    reportes: 'Reportes',
    chatbot: 'Chatbot',
    perfil: 'Mi perfil'
  };
  return labels[view] || 'SkillMatch';
}

function DashboardResumen({ isAdmin, stats, empresasPendientes, abrirDetalle, handleNavClick }) {
  const adminMetrics = [
    ['Empresas', stats.totalEmpresas, 'building', '#3b82f6', 'empresas'],
    ['Estudiantes', stats.totalEstudiantes, 'users', '#10b981', 'alumnos'],
    ['Profesores', stats.totalProfesores, 'teacher', '#0ea5e9', 'profesores'],
    ['Proyectos', stats.totalProyectos, 'folder', '#8b5cf6', 'proyectos'],
  ];
  const vincMetrics = [
    ['Empresas pendientes', stats.empresasPendientes, 'clock', '#f59e0b', 'empresas'],
    ['Empresas habilitadas', stats.empresasHabilitadas, 'check', '#10b981', 'empresas'],
    ['Vacantes activas', stats.vacantesActivas, 'briefcase', '#3b82f6', 'vacantes'],
    ['Postulaciones', stats.postulacionesTotales, 'clipboard', '#8b5cf6', 'postulaciones'],
  ];
  const metrics = isAdmin ? adminMetrics : vincMetrics;

  return <>
    <div className="metrics">
      {metrics.map(([label, value, icon, color, vista]) => <div className="metric-card" key={label} onClick={() => handleNavClick(vista)} style={{ '--mc': color }}><span className="mc-icon"><AppIcon name={icon} size={22} /></span><div className="mc-label">{label}</div><div className="mc-val">{value || 0}</div></div>)}
    </div>
    <DashboardInsights
      title={isAdmin ? 'Panorama institucional' : 'Actividad de vinculación'}
      subtitle={isAdmin ? 'Usuarios y proyectos registrados en SkillMatch' : 'Empresas, vacantes y postulaciones en seguimiento'}
      labels={metrics.map(([label]) => label)}
      values={metrics.map(([, value]) => value || 0)}
      progress={isAdmin ? Math.min(100, 45 + ((stats.totalProyectos || 0) * 3)) : (stats.totalEmpresas ? Math.round(((stats.empresasHabilitadas || 0) / stats.totalEmpresas) * 100) : 0)}
      progressLabel={isAdmin ? 'Actividad institucional' : 'Empresas habilitadas'}
    />
    <div className="table-wrap" style={{ marginTop: 24 }}>
      <div className="section-title" style={{ padding: 18 }}>{isAdmin ? 'Responsabilidad del administrador' : 'Empresas pendientes de validación'}</div>
      {isAdmin ? (
        <div style={{ padding: 18, color: '#475569', lineHeight: 1.7 }}>
          El administrador supervisa estudiantes, profesores, proyectos, empresas y configuración del chatbot. No gestiona altas operativas de empresas ni sube horarios de profesores.
        </div>
      ) : empresasPendientes.length ? empresasPendientes.map(e => <div className="table-row" key={e.id} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}><div>{e.nombre}</div><div>{e.contacto || '—'}</div><div><button className="btn btn-primary" onClick={() => abrirDetalle('empresa', e.id)}>Revisar</button></div></div>) : <div style={{ padding: 18, color: '#64748b' }}>No hay empresas pendientes.</div>}
    </div>
  </>;
}

function Table({ title, empty, headers, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return <div className="table-wrap"><div className="section-title" style={{ padding: 18 }}>{title}</div><div className="table-header" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>{headers.map(h => <div key={h}>{h}</div>)}</div>{items.length ? items : <div style={{ padding: 24, color: '#64748b' }}>{empty}</div>}</div>;
}

function ChatbotPanel({ chatbotItems, chatbotForm, setChatbotForm, editingBotId, setEditingBotId, guardarChatbot, editarChatbot, eliminarChatbot }) {
  const [searchBot, setSearchBot] = useState('');
  const [statusBot, setStatusBot] = useState('todas');

  const categories = [...new Set(chatbotItems.map((item) => item.categoria || 'general'))];
  const filteredItems = chatbotItems.filter((item) => {
    const text = `${item.pregunta || ''} ${item.respuesta || ''} ${item.keywords || ''} ${item.categoria || ''}`.toLowerCase();
    const searchOk = !searchBot.trim() || text.includes(searchBot.trim().toLowerCase());
    const statusOk = statusBot === 'todas' || (statusBot === 'activas' ? item.activa : !item.activa);
    return searchOk && statusOk;
  });
  const activas = chatbotItems.filter((item) => item.activa).length;

  return <div className="chatbot-studio">
    <div className="chatbot-studio__hero">
      <div>
        <span className="chatbot-studio__eyebrow">CENTRO DE CONOCIMIENTO</span>
        <h2>Chatbot SkillMatch</h2>
        <p>Administra intenciones, respuestas y palabras clave desde un panel más claro y fácil de mantener.</p>
      </div>
      <div className="chatbot-studio__metrics">
        <div><b>{chatbotItems.length}</b><span>Respuestas</span></div>
        <div><b>{activas}</b><span>Activas</span></div>
        <div><b>{categories.length}</b><span>Categorías</span></div>
      </div>
    </div>

    <div className="chatbot-studio__layout">
      <div className="admin-form chatbot-editor">
        <div className="chatbot-editor__title"><AppIcon name="bot" size={20} /><div><h3>{editingBotId ? 'Editar conocimiento' : 'Nueva respuesta'}</h3><small>Define una intención clara y una respuesta breve.</small></div></div>
        <form onSubmit={guardarChatbot}>
          <label className="form-label">Pregunta / intención</label>
          <input className="form-input" value={chatbotForm.pregunta} onChange={e => setChatbotForm({ ...chatbotForm, pregunta: e.target.value })} placeholder="Ej. ¿Cómo puedo postularme a una vacante?" />
          <label className="form-label">Palabras clave</label>
          <input className="form-input" value={chatbotForm.keywords} onChange={e => setChatbotForm({ ...chatbotForm, keywords: e.target.value })} placeholder="postulación, vacante, aplicar" />
          <label className="form-label">Categoría</label>
          <input className="form-input" list="chatbot-categories" value={chatbotForm.categoria} onChange={e => setChatbotForm({ ...chatbotForm, categoria: e.target.value })} />
          <datalist id="chatbot-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
          <label className="form-label">Respuesta</label>
          <textarea className="form-input" style={{ minHeight: 150, resize: 'vertical' }} value={chatbotForm.respuesta} onChange={e => setChatbotForm({ ...chatbotForm, respuesta: e.target.value })} placeholder="Escribe una respuesta directa, útil y con el siguiente paso para el usuario." />
          <label className="chatbot-toggle"><input type="checkbox" checked={chatbotForm.activa} onChange={e => setChatbotForm({ ...chatbotForm, activa: e.target.checked })} /><span /> Disponible para el chatbot</label>
          <div className="chatbot-editor__actions">
            <button className="btn btn-primary" type="submit">{editingBotId ? 'Guardar cambios' : 'Agregar respuesta'}</button>
            {editingBotId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingBotId(null); setChatbotForm({ pregunta: '', respuesta: '', categoria: 'general', keywords: '', activa: true }); }}>Cancelar</button>}
          </div>
        </form>
        <div className="chatbot-preview">
          <small>Vista previa</small>
          <div className="chatbot-preview__bubble">{chatbotForm.respuesta || 'La respuesta se verá aquí mientras la editas.'}</div>
        </div>
      </div>

      <div className="chatbot-library">
        <div className="chatbot-library__toolbar">
          <div className="chatbot-search"><AppIcon name="search" size={16} /><input value={searchBot} onChange={e => setSearchBot(e.target.value)} placeholder="Buscar por intención, keyword o respuesta" /></div>
          <select value={statusBot} onChange={e => setStatusBot(e.target.value)}><option value="todas">Todas</option><option value="activas">Activas</option><option value="inactivas">Inactivas</option></select>
        </div>
        <div className="chatbot-library__count">{filteredItems.length} de {chatbotItems.length} respuestas</div>
        <div className="chatbot-cards">
          {filteredItems.length ? filteredItems.map(item => <article className="chatbot-card" key={item.id_pregunta}>
            <div className="chatbot-card__top"><span className={`chatbot-status ${item.activa ? 'is-active' : ''}`}>{item.activa ? 'Activa' : 'Inactiva'}</span><span className="chatbot-category">{item.categoria || 'general'}</span></div>
            <h3>{item.pregunta}</h3>
            <p>{item.respuesta}</p>
            <div className="chatbot-keywords">{String(item.keywords || '').split(',').filter(Boolean).slice(0, 6).map(k => <span key={k}>{k.trim()}</span>)}</div>
            <div className="chatbot-card__actions"><button className="btn btn-ghost" onClick={() => editarChatbot(item)}>Editar</button><button className="btn btn-danger" onClick={() => eliminarChatbot(item.id_pregunta)}>Eliminar</button></div>
          </article>) : <div className="chatbot-empty">No hay respuestas que coincidan con los filtros.</div>}
        </div>
      </div>
    </div>
  </div>;
}

function ReportesVinculacion({ stats, reportes }) {
  return <div style={{ display: 'grid', gap: 20 }}>
    <div className="metrics">
      <div className="metric-card" style={{ '--mc': '#f59e0b' }}><span className="mc-icon"><AppIcon name="clock" size={22} /></span><div className="mc-label">Pendientes</div><div className="mc-val">{stats.empresasPendientes || 0}</div></div>
      <div className="metric-card" style={{ '--mc': '#10b981' }}><span className="mc-icon"><AppIcon name="check" size={22} /></span><div className="mc-label">Habilitadas</div><div className="mc-val">{stats.empresasHabilitadas || 0}</div></div>
      <div className="metric-card" style={{ '--mc': '#3b82f6' }}><span className="mc-icon"><AppIcon name="briefcase" size={22} /></span><div className="mc-label">Vacantes</div><div className="mc-val">{stats.totalVacantes || 0}</div></div>
      <div className="metric-card" style={{ '--mc': '#8b5cf6' }}><span className="mc-icon"><AppIcon name="clipboard" size={22} /></span><div className="mc-label">Postulaciones</div><div className="mc-val">{stats.postulacionesTotales || 0}</div></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
      <MiniReporte title="Empresas por estado" items={reportes.empresasPorEstado || []} />
      <MiniReporte title="Vacantes por estado" items={reportes.vacantesPorEstado || []} />
      <MiniReporte title="Postulaciones por estado" items={reportes.postulacionesPorEstado || []} />
    </div>
  </div>;
}

function MiniReporte({ title, items }) {
  return <div className="table-wrap" style={{ paddingBottom: 12 }}><div className="section-title" style={{ padding: 18 }}>{title}</div>{items.length ? items.map(item => <div className="table-row" key={item.estado} style={{ gridTemplateColumns: '1fr 1fr' }}><div>{item.estado}</div><div><b>{item.total}</b></div></div>) : <div style={{ padding: 18, color: '#64748b' }}>Sin datos</div>}</div>;
}

function DetalleEmpresa({ empresa, puedeGestionar, cambiarEstadoEmpresa, token, onSaved }) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(() => ({
    razon_social: empresa.razon_social || '',
    rfc: empresa.rfc || '',
    domicilio: empresa.domicilio || '',
    ubicacion: empresa.ubicacion || '',
    giro: empresa.giro || '',
    sector: empresa.sector || '',
    contacto: empresa.contacto || '',
    telefono: empresa.telefono || '',
    responsable_nombre: empresa.responsable_nombre || empresa.nombre || '',
    responsable_apellido: empresa.responsable_apellido || empresa.apellido || '',
    responsable_cargo: empresa.responsable_cargo || '',
    responsable_correo: empresa.responsable_correo || empresa.correo || '',
    responsable_telefono: empresa.responsable_telefono || empresa.telefono || '',
    observaciones: empresa.observaciones || '',
    estado: empresa.estado || 'pendiente'
  }));

  const update = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const guardarEmpresa = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/admin/empresas/${empresa.id_empresa}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo actualizar la empresa');
      const empresaActualizada = { ...empresa, ...form };
      onSaved?.(empresaActualizada);
      setEditando(false);
      alert('Empresa actualizada correctamente.');
    } catch (err) {
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (editando) {
    return <div>
      <h2>Editar empresa</h2>
      <form onSubmit={guardarEmpresa} className="empresa-form">
        <label>Razón social / Nombre de empresa<input value={form.razon_social} onChange={e => update('razon_social', e.target.value)} required /></label>
        <label>RFC<input value={form.rfc} onChange={e => update('rfc', e.target.value.toUpperCase())} required /></label>
        <label>Domicilio<input value={form.domicilio} onChange={e => update('domicilio', e.target.value)} required /></label>
        <label>Ubicación<input value={form.ubicacion} onChange={e => update('ubicacion', e.target.value)} required /></label>
        <label>Giro<input value={form.giro} onChange={e => update('giro', e.target.value)} /></label>
        <label>Sector<input value={form.sector} onChange={e => update('sector', e.target.value)} /></label>
        <label>Contacto general<input value={form.contacto} onChange={e => update('contacto', e.target.value)} /></label>
        <label>Teléfono general<input value={form.telefono} onChange={e => update('telefono', e.target.value)} /></label>
        <label>Responsable nombre<input value={form.responsable_nombre} onChange={e => update('responsable_nombre', e.target.value)} required /></label>
        <label>Responsable apellido<input value={form.responsable_apellido} onChange={e => update('responsable_apellido', e.target.value)} /></label>
        <label>Cargo del responsable<input value={form.responsable_cargo} onChange={e => update('responsable_cargo', e.target.value)} /></label>
        <label>Correo del responsable<input type="email" value={form.responsable_correo} onChange={e => update('responsable_correo', e.target.value)} required /></label>
        <label>Teléfono del responsable<input value={form.responsable_telefono} onChange={e => update('responsable_telefono', e.target.value)} /></label>
        <label>Estado<select value={form.estado} onChange={e => update('estado', e.target.value)}>{['pendiente','habilitada','deshabilitada','rechazada'].map(e => <option key={e} value={e}>{estadoEmpresaLabel[e]}</option>)}</select></label>
        <label className="full-row">Observaciones<textarea value={form.observaciones} onChange={e => update('observaciones', e.target.value)} /></label>
        <div className="full-row" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>;
  }

  return <div>
    <h2>{empresa.razon_social}</h2>
    <p><b>RFC:</b> {empresa.rfc || '—'} | <b>Estado:</b> {estadoEmpresaLabel[empresa.estado] || empresa.estado}</p>
    <p><b>Domicilio:</b> {empresa.domicilio || '—'}</p>
    <p><b>Ubicación:</b> {empresa.ubicacion || '—'}</p>
    <p><b>Giro:</b> {empresa.giro || '—'} | <b>Sector:</b> {empresa.sector || '—'}</p>
    <p><b>Contacto general:</b> {empresa.contacto || '—'} | <b>Teléfono:</b> {empresa.telefono || '—'}</p>
    <h3>Responsable ante la escuela</h3>
    <p><b>Nombre:</b> {empresa.responsable_nombre || empresa.nombre || '—'} {empresa.responsable_apellido || empresa.apellido || ''}</p>
    <p><b>Cargo:</b> {empresa.responsable_cargo || '—'} | <b>Correo:</b> {empresa.responsable_correo || empresa.correo || '—'} | <b>Teléfono:</b> {empresa.responsable_telefono || '—'}</p>
    {empresa.observaciones && <p><b>Observaciones:</b> {empresa.observaciones}</p>}
    {puedeGestionar ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      <button className="btn btn-primary" onClick={() => setEditando(true)}>Editar datos</button>
      {['pendiente','habilitada','deshabilitada','rechazada'].map(e => <button key={e} className="btn btn-ghost" onClick={() => cambiarEstadoEmpresa(empresa.id_empresa, e)}>{estadoEmpresaLabel[e]}</button>)}
    </div> : <div style={{ background: '#f8fafc', padding: 12, borderRadius: 12, color: '#475569', margin: '16px 0' }}>Vista de solo consulta. La validación y cambio de estado corresponde a Vinculación.</div>}
    <h3>Vacantes de la empresa</h3>
    {empresa.vacantes?.length ? empresa.vacantes.map(v => <div key={v.id_vacante} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}><div>{v.titulo}</div><div>{v.estado}</div><div>{v.total_postulaciones || 0} postulaciones</div></div>) : <p>No tiene vacantes registradas.</p>}
    <h3>Postulaciones relacionadas</h3>
    {empresa.postulaciones?.length ? empresa.postulaciones.map(p => <div key={p.id_postulacion} className="table-row" style={{ gridTemplateColumns: '2fr 1.5fr 1fr' }}><div>{p.vacante}</div><div>{p.estudiante}</div><div>{p.estado}</div></div>) : <p>No hay postulaciones relacionadas.</p>}
  </div>;
}

function DetalleAlumno({ alumno }) {
  const skills = String(alumno.competencias || '').split(',').map(v => v.trim()).filter(Boolean);
  return <div className="admin-student-detail">
    <div className="admin-project-detail__hero">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {alumno.foto_perfil ? <img alt="alumno" src={buildFileUrl(alumno.foto_perfil)} style={{ width: 82, height: 82, borderRadius: 22, objectFit: 'cover' }} /> : <div className="user-avatar" style={{ width: 82, height: 82, borderRadius: 22 }}>{initials(`${alumno.nombre} ${alumno.apellido}`)}</div>}
        <div><span className="admin-project-detail__eyebrow">PERFIL PROFESIONAL</span><h2 style={{ marginBottom: 5 }}>{alumno.nombre} {alumno.apellido}</h2><p>{alumno.titulo_profesional || alumno.carrera || 'Estudiante UTEQ'}</p></div>
      </div>
    </div>
    <div className="admin-project-facts">
      <div><small>Carrera</small><strong>{alumno.carrera || '—'}</strong></div>
      <div><small>Cuatrimestre</small><strong>{alumno.semestre || '—'}</strong></div>
      <div><small>Disponibilidad</small><strong>{alumno.disponibilidad || '—'}</strong></div>
    </div>
    <section><h3>Acerca de</h3><p>{alumno.biografia || 'Sin biografía profesional registrada.'}</p></section>
    <section><h3>Información de contacto</h3><p>{alumno.correo} · {alumno.telefono || 'Sin teléfono'} · {alumno.ciudad || 'Sin ciudad registrada'}</p></section>
    <section><h3>Habilidades técnicas</h3><div className="chatbot-keywords">{skills.length ? skills.map(skill => <span key={skill}>{skill}</span>) : <p>No hay habilidades registradas.</p>}</div></section>
    <section><h3>Perfil y enlaces</h3><p><b>Modalidad:</b> {alumno.modalidad_preferida || '—'} · <b>Idiomas:</b> {alumno.idiomas || '—'}</p><p><b>LinkedIn:</b> {alumno.linkedin || '—'}<br/><b>GitHub:</b> {alumno.github || '—'}<br/><b>Portafolio:</b> {alumno.portafolio || '—'}</p></section>
    <section><h3>Habilidades blandas</h3><p><b>Score global:</b> {alumno.soft_score ?? '—'}% · Comunicación {alumno.comunicacion ?? '—'}% · Equipo {alumno.trabajo_equipo ?? '—'}% · Liderazgo {alumno.liderazgo ?? '—'}%</p></section>
    <section><h3>Proyectos</h3>{alumno.proyectos?.length ? alumno.proyectos.map(p => <div className="table-row" key={p.id_proyecto} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}><div>{p.titulo}</div><div>{p.estado}</div><div>{formatFecha(p.fecha_registro)}</div></div>) : <p>No tiene proyectos.</p>}</section>
    <section><h3>Postulaciones</h3>{alumno.postulaciones?.length ? alumno.postulaciones.map(p => <div className="table-row" key={p.id_postulacion} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}><div>{p.vacante}</div><div>{p.empresa}</div><div>{p.estado}</div></div>) : <p>No tiene postulaciones.</p>}</section>
  </div>;
}

function DetalleProfesor({ profesor }) {
  return <div><div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>{profesor.foto_perfil ? <img alt="profesor" src={buildFileUrl(profesor.foto_perfil)} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} /> : <div className="user-avatar" style={{ width: 96, height: 96 }}>{initials(`${profesor.nombre} ${profesor.apellido}`)}</div>}<div><h2>{profesor.nombre} {profesor.apellido}</h2><p>{profesor.correo} | {profesor.telefono || 'Sin teléfono'}</p></div></div><p><b>Departamento:</b> {profesor.departamento || '—'}</p><p><b>Asignaturas:</b> {profesor.asignaturas || '—'}</p><h3>Horarios subidos por el profesor</h3>{profesor.horarios?.length ? profesor.horarios.map(h => <div className="table-row" key={h.id_horario} style={{ gridTemplateColumns: '2fr 1fr' }}><div>{h.ruta_pdf}</div><div>{formatFecha(h.fecha_subida)}</div></div>) : <p>No tiene horarios registrados.</p>}<h3>Proyectos del profesor</h3>{profesor.proyectos?.length ? profesor.proyectos.map(p => <div className="table-row" key={p.id_proyecto} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}><div>{p.titulo}</div><div>{p.estado}</div><div>{formatFecha(p.fecha_registro)}</div></div>) : <p>No tiene proyectos registrados.</p>}</div>;
}

function DetalleProyecto({ proyecto }) {
  const media = proyecto.media || [];
  const evidencias = proyecto.evidencias || [];
  const portada = proyecto.img_principal || media.find(m => inferAssetType(m) === 'imagen')?.ruta_archivo || null;
  const galeria = media.filter(m => m.ruta_archivo && m.ruta_archivo !== portada);
  const docs = evidencias.filter(e => inferAssetType(e) === 'documento' || inferAssetType(e) === 'archivo');
  const visualEvidence = evidencias.filter(e => ['imagen','video'].includes(inferAssetType(e)));

  return <div className="admin-project-detail">
    <div className="admin-project-detail__hero">
      <div>
        <span className="admin-project-detail__eyebrow">PROYECTO UNIVERSITARIO</span>
        <h2>{proyecto.titulo}</h2>
        <p><b>Autor:</b> {proyecto.autor || '—'} · <b>Tipo:</b> {proyecto.tipo_autor || '—'} · <b>Estado:</b> {proyecto.estado}</p>
      </div>
      {proyecto.foto_autor && <img className="admin-project-detail__author" alt="autor" src={buildFileUrl(proyecto.foto_autor)} />}
    </div>

    {portada && <div className="admin-project-cover"><img src={buildFileUrl(portada)} alt={`Portada de ${proyecto.titulo}`} /></div>}

    <div className="admin-project-facts">
      <div><small>Tecnologías</small><strong>{proyecto.tecnologias || 'No especificadas'}</strong></div>
      <div><small>Ámbito</small><strong>{proyecto.ambito_desarrollo || '—'}</strong></div>
      <div><small>Área</small><strong>{proyecto.area_trabajo || '—'}</strong></div>
    </div>

    <section><h3>Descripción</h3><p>{proyecto.descripcion || 'Sin descripción'}</p></section>
    <section><h3>Objetivo</h3><p>{proyecto.objetivo || 'No especificado'}</p></section>
    <section><h3>Actividades</h3><p>{proyecto.actividades || 'No especificadas'}</p></section>

    {galeria.length > 0 && <section><h3>Galería del proyecto</h3><div className="admin-project-gallery">{galeria.map(m => <div key={m.id_media || m.ruta_archivo} className="admin-project-media">{inferAssetType(m) === 'video' ? <video src={buildFileUrl(m.ruta_archivo)} controls preload="metadata" /> : <img src={buildFileUrl(m.ruta_archivo)} alt={archivoNombre(m)} />}</div>)}</div></section>}

    {visualEvidence.length > 0 && <section><h3>Evidencias multimedia</h3><div className="admin-project-gallery">{visualEvidence.map(e => <div key={e.id_evidencia} className="admin-project-media">{inferAssetType(e) === 'video' ? <video src={buildFileUrl(e.ruta_archivo)} controls preload="metadata" /> : <a href={buildFileUrl(e.ruta_archivo)} target="_blank" rel="noreferrer"><img src={buildFileUrl(e.ruta_archivo)} alt={archivoNombre(e)} /></a>}</div>)}</div></section>}

    <section>
      <h3>Documentación</h3>
      {docs.length ? <div className="admin-project-docs">{docs.map(e => <a key={e.id_evidencia} href={buildFileUrl(e.ruta_archivo)} target="_blank" rel="noreferrer"><AppIcon name="file" size={18} /><div><strong>{archivoNombre(e)}</strong><small>{e.mime_type || 'Documento del proyecto'}</small></div><span>↗</span></a>)}</div> : <p>No hay documentación registrada.</p>}
    </section>

    {proyecto.colaboradores?.length > 0 && <section><h3>Colaboradores</h3>{proyecto.colaboradores.map((c, idx) => <div key={idx} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}><div>{c.nombre} {c.apellido}</div><div>{c.correo}</div><div>{c.carrera}</div></div>)}</section>}
  </div>;
}

function DetallePostulacion({ data }) {
  const { postulacion, alumno, vacante } = data;
  return <div className="postulation-detail">
    <div className="admin-project-detail__hero"><div><span className="admin-project-detail__eyebrow">SEGUIMIENTO INSTITUCIONAL</span><h2>Detalle de postulación</h2><p>{postulacion.empresa} · {postulacion.vacante}</p></div><span className="badge badge-blue">{postulacion.estado}</span></div>
    <div className="admin-project-facts"><div><small>Fecha</small><strong>{formatFecha(postulacion.fecha_postulacion)}</strong></div><div><small>Carrera</small><strong>{alumno.carrera || '—'}</strong></div><div><small>Cuatrimestre</small><strong>{alumno.semestre || '—'}</strong></div></div>
    <section><h3>Estudiante</h3><p><b>{alumno.nombre} {alumno.apellido}</b><br/>{alumno.correo} · {alumno.telefono || 'Sin teléfono'}<br/>{alumno.titulo_profesional || alumno.carrera || 'Estudiante UTEQ'}</p></section>
    <section><h3>Vacante</h3><p><b>{vacante.titulo}</b><br/>{vacante.descripcion || 'Sin descripción'}</p><p><b>Ubicación:</b> {vacante.ubicacion || vacante.empresa_ubicacion || '—'} · <b>Modalidad:</b> {vacante.modalidad || '—'}</p></section>
    <section><h3>Compatibilidad y perfil</h3><p><b>Habilidades técnicas:</b> {alumno.competencias || 'No registradas'}<br/><b>Soft skills:</b> {alumno.soft_score ?? 'Sin evaluación'}{alumno.soft_score != null ? '%' : ''}<br/><b>Disponibilidad:</b> {alumno.disponibilidad || '—'}</p></section>
    <section><h3>Proyectos del estudiante</h3>{alumno.proyectos?.length ? alumno.proyectos.slice(0,5).map(p => <div className="table-row" key={p.id_proyecto} style={{gridTemplateColumns:'2fr 1fr'}}><div>{p.titulo}</div><div>{p.estado}</div></div>) : <p>No tiene proyectos registrados.</p>}</section>
  </div>;
}

function DetalleVacante({ vacante, puedeGestionar, cambiarEstadoVacante }) {
  return <div><h2>{vacante.titulo}</h2><p><b>Empresa:</b> {vacante.empresa} | <b>Estado:</b> {vacante.estado}</p><p><b>Categoría:</b> {vacante.categoria || '—'} | <b>Nivel:</b> {vacante.nivel || '—'}</p><h3>Descripción</h3><p>{vacante.descripcion || 'Sin descripción'}</p><h3>Requisitos</h3><p>{vacante.requisitos || 'Sin requisitos'}</p>{puedeGestionar && <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>{['abierta','pausada','cerrada'].map(e => <button key={e} className="btn btn-ghost" onClick={() => cambiarEstadoVacante(vacante.id_vacante, e)}>{e}</button>)}</div>}<h3>Postulantes</h3>{vacante.postulantes?.length ? vacante.postulantes.map(p => <div className="table-row" key={p.id_postulacion} style={{ gridTemplateColumns: '2fr 1.5fr 1fr' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{p.foto_perfil ? <img alt="perfil" src={buildFileUrl(p.foto_perfil)} style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: '50%' }} /> : <div className="user-avatar">{initials(p.nombre)}</div>}<div>{p.nombre}<div style={{ fontSize: 12, color: '#64748b' }}>{p.correo}</div></div></div><div>{p.carrera}</div><div>{p.estado}</div></div>) : <p>No hay postulantes aún.</p>}</div>;
}

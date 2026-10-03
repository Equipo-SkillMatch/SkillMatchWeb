import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../CSS/DashboardEstudiantes.css'; 
import { API_BASE, buildFileUrl } from '../config/api';
import DashboardInsights from '../components/DashboardInsights';
import AppIcon from '../components/AppIcon';

const initials = (name) =>
  name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ES';

const MESES_CUATRIMESTRE = [0, 4, 8]; // Enero, mayo y septiembre.

const parseFechaLocal = (fecha) => {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  const match = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  }
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatFecha = (fecha) => {
  const d = parseFechaLocal(fecha);
  if (!d) return fecha || '—';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatFechaLarga = (fecha) => {
  const d = parseFechaLocal(fecha);
  if (!d) return '—';
  return d.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const primerLunesDelMes = (year, monthIndex) => {
  const d = new Date(year, monthIndex, 1, 12, 0, 0);
  const day = d.getDay(); // Domingo 0, lunes 1.
  const offset = day === 1 ? 0 : (8 - day) % 7;
  d.setDate(1 + offset);
  return d;
};

const inicioCuatriActual = () => {
  const hoy = new Date();
  const mes = hoy.getMonth();
  const mesInicio = mes < 4 ? 0 : mes < 8 ? 4 : 8;
  return primerLunesDelMes(hoy.getFullYear(), mesInicio);
};

const calcularInicioEstimadoCarrera = (estudiante = {}) => {
  const cuatrimestre = Number(estudiante.cuatrimestre_actual || estudiante.semestre || estudiante.cuatrimestre_inicial || 1);
  if (!Number.isFinite(cuatrimestre) || cuatrimestre < 1) return null;

  const inicioActual = inicioCuatriActual();
  const inicioEstimado = new Date(inicioActual);
  inicioEstimado.setMonth(inicioEstimado.getMonth() - ((Math.min(cuatrimestre, 11) - 1) * 4));
  return primerLunesDelMes(inicioEstimado.getFullYear(), inicioEstimado.getMonth());
};

const getAnioIngresoEstimado = (estudiante = {}) => {
  const fecha = estudiante.fecha_inicio_estimada_carrera || calcularInicioEstimadoCarrera(estudiante);
  const d = parseFechaLocal(fecha);
  return d ? d.getFullYear() : '—';
};

const toInputDateValue = (fecha) => {
  const d = parseFechaLocal(fecha);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const badgeClassByEstado = (estado) => {
  if (estado === 'completado') return 'badge badge-active';
  if (estado === 'pausado') return 'badge badge-pending';
  return 'badge badge-approved';
};

const getFileSource = (path) => {
  return buildFileUrl(path);
};

const getProfilePhotoUrl = (path) => {
  return buildFileUrl(path);
};

const formatEstadoAcademico = (estado) => {
  if (estado === 'egresado') return 'Egresado';
  if (estado === 'baja') return 'Baja';
  return 'Estudiante activo';
};

const loadImageDataUrl = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    } catch (_error) {
      resolve(null);
    }
  };
  img.onerror = () => resolve(null);
  img.src = src;
});

const loadFirstImageDataUrl = async (sources = []) => {
  for (const src of sources) {
    const image = await loadImageDataUrl(src);
    if (image) return image;
  }
  return null;
};

const tecnologiasDisponibles = [
  'React', 'Node.js', 'Express', 'MySQL', 'PostgreSQL', 'MongoDB',
  'JavaScript', 'TypeScript', 'PHP', 'Laravel', 'Python', 'Django',
  'Java', 'Spring Boot', 'Flutter', 'Firebase', 'HTML', 'CSS',
  'Tailwind', 'Bootstrap', 'Git', 'GitHub', 'Docker', 'API REST'
];

export default function DashboardEstudiante() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [view, setView] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [evidencias, setEvidencias] = useState([]);
  const [vacantes, setVacantes] = useState([]); 
  const [vacanteDetalle, setVacanteDetalle] = useState(null);
  const [vacanteDetalleLoading, setVacanteDetalleLoading] = useState(false);
  const [showVacanteDetalle, setShowVacanteDetalle] = useState(false);
  const [softQuestions, setSoftQuestions] = useState([]);
  const [softAnswers, setSoftAnswers] = useState({});
  const [softResult, setSoftResult] = useState(null);
  const [softLoading, setSoftLoading] = useState(false);
  const [softMessage, setSoftMessage] = useState({ type: '', text: '' });

  // ESTADO PARA EL MENÚ MÓVIL
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingProyectos, setLoadingProyectos] = useState(false);
  const [loadingEvidencias, setLoadingEvidencias] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const [tecnologiasSeleccionadas, setTecnologiasSeleccionadas] = useState([]);
  const [imgPrincipal, setImgPrincipal] = useState(null);
  const [mediaProyecto, setMediaProyecto] = useState([]);
  const [nuevaTecnologia, setNuevaTecnologia] = useState('');
  const imgProyectoRef = useRef(null);
  const mediaProyectoRef = useRef(null);

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
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState('');

  const evidenciaRef = useRef(null);

  const [errorBio, setErrorBio] = useState('');
  const [successBio, setSuccessBio] = useState('');
  const [loadingBio, setLoadingBio] = useState(false);
  
  // NUEVO ESTADO: Para verificar si la biometría ya fue activada
  const [biometriaActiva, setBiometriaActiva] = useState(
    localStorage.getItem('biometriaActiva') === 'true'
  );

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [perfilForm, setPerfilForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    matricula: '',
    carrera: '',
    cuatrimestre_inicial: '',
    fecha_inicio_carrera: '',
    titulo_profesional: '',
    biografia: '',
    competencias: '',
    linkedin: '',
    github: '',
    portafolio: '',
    idiomas: '',
    disponibilidad: '',
    modalidad_preferida: '',
    ciudad: '',
    nueva_password: '',
    confirmar_password: ''
  });
  const [fotoPerfilFile, setFotoPerfilFile] = useState(null);
  const [mostrarNuevaPassword, setMostrarNuevaPassword] = useState(false);
  const [mostrarConfirmarPassword, setMostrarConfirmarPassword] = useState(false);

  const [colaboradoresData, setColaboradoresData] = useState({}); 
  const [nuevoColaboradorCorreo, setNuevoColaboradorCorreo] = useState('');
  const [proyectoActivoColab, setProyectoActivoColab] = useState(null); 

  const nombreCompleto = (dashboardData?.usuario?.nombre || user.nombre)
    ? `${dashboardData?.usuario?.nombre || user.nombre} ${dashboardData?.usuario?.apellido || user.apellido || ''}`.trim()
    : 'Estudiante';

  // FUNCIÓN PARA CAMBIAR DE VISTA Y CERRAR EL MENÚ EN MÓVIL
  const handleNavClick = (vista) => {
    setView(vista);
    setIsMobileMenuOpen(false); // Cierra el menú al hacer clic
  };

  const toggleTecnologia = (tech) => {
    setTecnologiasSeleccionadas((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const agregarTecnologiaPersonalizada = () => {
    const tech = nuevaTecnologia.trim();
    if (!tech) return;
    setTecnologiasSeleccionadas((prev) => prev.includes(tech) ? prev : [...prev, tech]);
    setNuevaTecnologia('');
  };

  const toggleAmbito = (ambito) => {
    setAmbitoDesarrollo((prev) => {
      const actuales = String(prev || '').split(',').map((a) => a.trim()).filter(Boolean);
      const nuevos = actuales.includes(ambito) ? actuales.filter((a) => a !== ambito) : [...actuales, ambito];
      return nuevos.join(',');
    });
  };

  // CV profesional con encabezado institucional y carga opcional de logos.
  // Coloca el logo UTEQ en frontend/public/logos/uteq.jpg o uteq.png.
  // Cuando exista, coloca el logo SkillMatch en frontend/public/logos/skillmatch.png.
  const generarPDFPerfil = async () => {
    const doc = new jsPDF();
    const est = dashboardData?.estudiante || {};
    const u = dashboardData?.usuario || user || {};

    const azulOscuro = [35, 46, 86];
    const azulMedio = [36, 78, 124];
    const azulSuave = [232, 240, 251];
    const grisTexto = [71, 85, 105];
    const grisClaro = [226, 232, 240];

    const logoUteq = await loadFirstImageDataUrl(['/logos/uteq-logo.png', '/logos/uteq.png', '/logos/uteq.jpg', '/logos/uteq.jpeg']);
    const logoSkillMatch = await loadFirstImageDataUrl(['/logos/skillmatch-logo.png', '/logos/skillmatch.png', '/logos/skillmatch.jpg', '/logos/skillmatch.jpeg']);
    const profilePhoto = u.foto_perfil ? await loadImageDataUrl(getProfilePhotoUrl(u.foto_perfil)) : null;
    const folioCv = `SM-${u.id_usuario || est.id_estudiante || 'UTEQ'}-${new Date().toISOString().slice(0,10).replaceAll('-', '')}`;
    const inicioEstimadoCarrera = est.fecha_inicio_estimada_carrera || calcularInicioEstimadoCarrera(est);
    const anioIngresoEstimado = getAnioIngresoEstimado({ ...est, fecha_inicio_estimada_carrera: inicioEstimadoCarrera });

    doc.setFillColor(...azulOscuro);
    doc.rect(0, 0, 210, 42, 'F');

    if (logoUteq) {
      doc.addImage(logoUteq, 'PNG', 14, 9, 24, 24);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 9, 24, 24, 2, 2, 'F');
      doc.setTextColor(...azulOscuro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('UTEQ', 26, 23, { align: 'center' });
    }

    if (logoSkillMatch) {
      doc.addImage(logoSkillMatch, 'PNG', 172, 9, 24, 24);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(172, 9, 24, 24, 2, 2, 'F');
      doc.setTextColor(...azulOscuro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('Skill', 184, 20, { align: 'center' });
      doc.text('Match', 184, 25, { align: 'center' });
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Perfil académico-profesional', 105, 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Universidad Tecnológica de Querétaro · SkillMatch', 105, 24, { align: 'center' });
    doc.text(`Generado el ${new Date().toLocaleDateString('es-MX')} · Folio ${folioCv}`, 105, 31, { align: 'center' });

    let y = 55;
    if (profilePhoto) {
      doc.addImage(profilePhoto, 'PNG', 14, 48, 26, 26);
    } else {
      doc.setFillColor(...azulSuave);
      doc.roundedRect(14, 48, 26, 26, 4, 4, 'F');
      doc.setTextColor(...azulOscuro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text((nombreCompleto || 'SM').split(' ').map(v => v[0]).join('').slice(0, 2).toUpperCase(), 27, 64, { align: 'center' });
    }

    doc.setTextColor(...azulOscuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text(nombreCompleto.toUpperCase(), 48, y + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...grisTexto);
    doc.text(est.titulo_profesional || `${est.carrera || 'Carrera no especificada'} · ${formatEstadoAcademico(est.estado_academico)}`, 48, y + 9);
    doc.setFontSize(8.5);
    doc.text(`${est.carrera || 'Carrera no especificada'} · ${formatEstadoAcademico(est.estado_academico)}`, 48, y + 15);

    y = 80;
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2.5, textColor: grisTexto },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: azulOscuro, cellWidth: 34 },
        1: { cellWidth: 62 },
        2: { fontStyle: 'bold', textColor: azulOscuro, cellWidth: 34 },
        3: { cellWidth: 52 },
      },
      body: [
        ['Correo', u.correo || user.correo || '—', 'Teléfono', u.telefono || '—'],
        ['Matrícula', est.matricula || '—', 'Cuatrimestre', est.estado_academico === 'egresado' ? 'Egresado' : `${est.cuatrimestre_actual || est.semestre || '—'}°`],
        ['Año de ingreso', anioIngresoEstimado || '—', 'Estado', formatEstadoAcademico(est.estado_academico)],
        ['Inicio estimado', inicioEstimadoCarrera ? formatFecha(inicioEstimadoCarrera) : '—', 'Fecha registrada', est.fecha_inicio_carrera ? formatFecha(est.fecha_inicio_carrera) : '—'],
      ],
    });

    y = doc.lastAutoTable.finalY + 12;
    const perfilObjetivo = est.titulo_profesional || 'Perfil profesional en desarrollo';
    const bio = est.biografia || 'Perfil académico-profesional registrado en SkillMatch para procesos de estadías, vinculación y oportunidades laborales.';
    const bioLines = doc.splitTextToSize(bio, 168);
    const perfilBoxHeight = Math.max(28, 18 + (bioLines.length * 4.5));

    doc.setFillColor(...azulSuave);
    doc.roundedRect(14, y, 182, perfilBoxHeight, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...azulOscuro);
    doc.text(perfilObjetivo, 20, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(...grisTexto);
    doc.text(bioLines, 20, y + 15);

    y += perfilBoxHeight + 8;
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8.5, cellPadding: 3.2, textColor: grisTexto, lineColor: grisClaro },
      columnStyles: { 0: { fontStyle: 'bold', textColor: azulOscuro, cellWidth: 38 }, 1: { cellWidth: 144 } },
      body: [
        ['Habilidades técnicas', est.competencias || 'No especificadas'],
        ['Idiomas', est.idiomas || 'No especificados'],
        ['Disponibilidad', est.disponibilidad || 'No especificada'],
        ['Modalidad preferida', est.modalidad_preferida || 'Sin preferencia'],
        ['Ciudad / zona', est.ciudad || 'No especificada'],
        ['LinkedIn', est.linkedin || '—'],
        ['GitHub', est.github || '—'],
        ['Portafolio', est.portafolio || '—'],
      ],
    });

    y = doc.lastAutoTable.finalY + 12;
    if (softResult) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...azulMedio);
      doc.text('Habilidades blandas', 14, y);
      doc.setDrawColor(...azulMedio);
      doc.line(14, y + 2, 60, y + 2);
      autoTable(doc, {
        startY: y + 6,
        theme: 'grid',
        margin: { left: 14, right: 14 },
        head: [['Competencia', 'Resultado', 'Competencia', 'Resultado']],
        body: [
          ['Comunicación', `${softResult.comunicacion ?? '—'}%`, 'Trabajo en equipo', `${softResult.trabajo_equipo ?? '—'}%`],
          ['Liderazgo', `${softResult.liderazgo ?? '—'}%`, 'Resolución de problemas', `${softResult.resolucion_problemas ?? '—'}%`],
          ['Adaptabilidad', `${softResult.adaptabilidad ?? '—'}%`, 'Profesionalismo', `${softResult.profesionalismo ?? '—'}%`],
        ],
        headStyles: { fillColor: azulMedio, textColor: [255,255,255], fontSize: 8.5 },
        styles: { fontSize: 8.3, cellPadding: 3, lineColor: grisClaro },
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...azulMedio);
    doc.text('Proyectos destacados', 14, y);
    doc.setDrawColor(...azulMedio);
    doc.line(14, y + 2, 72, y + 2);

    if (proyectos.length === 0) {
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grisTexto);
      doc.text('El estudiante aún no cuenta con proyectos registrados en la plataforma SkillMatch.', 14, y);
    } else {
      const rows = proyectos.map((p) => [
        `${p.titulo}\nEstado: ${p.estado || '—'}`,
        `${p.descripcion || 'Sin descripción detallada.'}\nTecnologías: ${p.tecnologias || 'No especificadas'}`,
        formatFecha(p.fecha_registro),
      ]);

      autoTable(doc, {
        startY: y + 7,
        head: [['Proyecto', 'Descripción y tecnologías', 'Fecha']],
        body: rows,
        theme: 'grid',
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: azulMedio, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak', lineColor: grisClaro },
        columnStyles: {
          0: { cellWidth: 44, fontStyle: 'bold', textColor: azulOscuro },
          1: { cellWidth: 104 },
          2: { cellWidth: 34, halign: 'center' },
        },
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 145);
      doc.setDrawColor(230, 230, 230);
      doc.line(14, 281, 196, 281);
      doc.text(`SkillMatch UTEQ · Folio ${folioCv} · Generado desde el perfil registrado`, 14, 286);
      doc.setFontSize(6.8);
      doc.text('Los datos de perfil y experiencia son proporcionados por el usuario; la plataforma conserva su contexto académico institucional.', 14, 290);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${pageCount}`, 196, 287, { align: 'right' });
    }

    const nombreArchivo = `CV_SkillMatch_${nombreCompleto.replace(/\s+/g, '_')}.pdf`;
    doc.save(nombreArchivo);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('biometriaActiva'); // Limpiamos el estado biométrico al salir
    navigate('/login');
  };

  const cargarDashboard = async () => {
    try {
      setLoadingDashboard(true);
      setGlobalError('');
      const res = await fetch(`${API_BASE}/estudiante/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo cargar el dashboard');
      setDashboardData(data.dashboard);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const cargarProyectos = async () => {
    try {
      setLoadingProyectos(true);
      const res = await fetch(`${API_BASE}/estudiante/proyectos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar los proyectos');
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
      const res = await fetch(`${API_BASE}/estudiante/evidencias`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar las evidencias');
      setEvidencias(data.evidencias || []);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setLoadingEvidencias(false);
    }
  };

  const cargarVacantes = async () => {
    try {
      const res = await fetch(`${API_BASE}/estudiante/vacantes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setVacantes(data.vacantes);
      }
    } catch (error) {
      console.error("Error al cargar vacantes", error);
    }
  };


  const cargarSoftSkills = async () => {
    try {
      const res = await fetch(`${API_BASE}/estudiante/habilidades-blandas/preguntas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSoftQuestions(data.preguntas || []);
        setSoftResult(data.resultado || null);
        const respuestasPrevias = {};
        if (Array.isArray(data.resultado?.respuestas)) {
          data.resultado.respuestas.forEach((r) => {
            respuestasPrevias[r.id_pregunta] = Number(r.valor);
          });
        }
        setSoftAnswers(respuestasPrevias);
      }
    } catch (error) {
      console.error('Error cargando habilidades blandas:', error);
    }
  };

  const guardarSoftSkills = async () => {
    setSoftMessage({ type: '', text: '' });
    if (!softQuestions.length) return;

    const faltantes = softQuestions.filter((q) => !softAnswers[q.id_pregunta]);
    if (faltantes.length) {
      setSoftMessage({ type: 'error', text: `Te faltan ${faltantes.length} pregunta(s) por responder.` });
      return;
    }

    setSoftLoading(true);
    try {
      const respuestas = softQuestions.map((q) => ({
        id_pregunta: q.id_pregunta,
        valor: Number(softAnswers[q.id_pregunta]),
      }));

      const res = await fetch(`${API_BASE}/estudiante/habilidades-blandas/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ respuestas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar el test.');
      setSoftResult(data.resultado);
      setSoftMessage({ type: 'success', text: 'Test de habilidades blandas guardado correctamente.' });
      await cargarDashboard();
    } catch (error) {
      setSoftMessage({ type: 'error', text: error.message });
    } finally {
      setSoftLoading(false);
    }
  };

  const cargarColaboradores = async (id_proyecto) => {
    try {
      const res = await fetch(`${API_BASE}/estudiante/proyectos/${id_proyecto}/colaboradores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setColaboradoresData(prev => ({ ...prev, [id_proyecto]: data.colaboradores }));
      }
    } catch (error) {
      console.error("Error al cargar colaboradores:", error);
    }
  };

  const handleAgregarColaborador = async (id_proyecto) => {
    if (!nuevoColaboradorCorreo.trim()) return alert("Por favor ingresa un correo.");
    
    try {
      const res = await fetch(`${API_BASE}/estudiante/proyectos/${id_proyecto}/colaboradores`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ correo_colaborador: nuevoColaboradorCorreo })
      });
      
      const data = await res.json();
      if (data.ok) {
        setNuevoColaboradorCorreo('');
        cargarColaboradores(id_proyecto); 
        alert("Colaborador agregado con éxito.");
      } else {
        alert(data.mensaje || "Error al agregar colaborador.");
      }
    } catch (error) {
      alert("Error de red al intentar agregar al colaborador.");
    }
  };

  const handleEliminarColaborador = async (id_proyecto, id_colaborador) => {
    const confirmar = window.confirm("¿Seguro que deseas eliminar a este compañero del proyecto?");
    if (!confirmar) return;

    try {
      const res = await fetch(`${API_BASE}/estudiante/proyectos/${id_proyecto}/colaboradores/${id_colaborador}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.ok) {
        cargarColaboradores(id_proyecto); 
      } else {
        alert(data.mensaje || "Error al eliminar colaborador.");
      }
    } catch (error) {
      alert("Error de red al intentar eliminar.");
    }
  };

  const togglePanelColaboradores = (id_proyecto) => {
    if (proyectoActivoColab === id_proyecto) {
      setProyectoActivoColab(null); 
    } else {
      setProyectoActivoColab(id_proyecto);
      cargarColaboradores(id_proyecto); 
    }
  };

  const handleRegistrarFaceID = async () => {
    setErrorBio('');
    setSuccessBio('');
    setLoadingBio(true);
    try {
      const resOptions = await fetch(`${API_BASE}/auth/biometric-reg-options`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!resOptions.ok) {
        const errData = await resOptions.json();
        throw new Error(errData.mensaje || 'Error al conectar con el servidor');
      }

      const options = await resOptions.json();
      const regResp = await startRegistration(options);

      const resVerify = await fetch(`${API_BASE}/auth/biometric-reg-verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ ...regResp, challenge: options.challenge })
      });

      const result = await resVerify.json();
      if (result.ok) {
        setSuccessBio('✓ Datos biométricos activados con éxito.');
        setBiometriaActiva(true); 
        localStorage.setItem('biometriaActiva', 'true'); 
      } else {
        throw new Error(result.mensaje || 'Error en la validación');
      }
    } catch (err) {
      console.error(err);
      setErrorBio(err.message.includes('undefined') 
        ? 'Error interno del servidor (ID no encontrado). Intenta cerrar y volver a iniciar sesión.' 
        : err.message);
    } finally {
      setLoadingBio(false);
    }
  };

  const iniciarEdicionPerfil = () => {
    setPerfilForm({
      nombre: dashboardData?.usuario?.nombre || user.nombre || '',
      apellido: dashboardData?.usuario?.apellido || user.apellido || '',
      telefono: dashboardData?.usuario?.telefono || user.telefono || '',
      matricula: dashboardData?.estudiante?.matricula || '',
      carrera: dashboardData?.estudiante?.carrera || '',
      cuatrimestre_inicial: dashboardData?.estudiante?.cuatrimestre_inicial || dashboardData?.estudiante?.semestre || '',
      fecha_inicio_carrera: toInputDateValue(dashboardData?.estudiante?.fecha_inicio_carrera),
      titulo_profesional: dashboardData?.estudiante?.titulo_profesional || '',
      biografia: dashboardData?.estudiante?.biografia || '',
      competencias: dashboardData?.estudiante?.competencias || '',
      linkedin: dashboardData?.estudiante?.linkedin || '',
      github: dashboardData?.estudiante?.github || '',
      portafolio: dashboardData?.estudiante?.portafolio || '',
      idiomas: dashboardData?.estudiante?.idiomas || '',
      disponibilidad: dashboardData?.estudiante?.disponibilidad || '',
      modalidad_preferida: dashboardData?.estudiante?.modalidad_preferida || '',
      ciudad: dashboardData?.estudiante?.ciudad || '',
      nueva_password: '',
      confirmar_password: ''
    });
    setFotoPerfilFile(null);
    setIsEditingProfile(true);
    setProfileMessage({ type: '', text: '' });
  };

  const handleGuardarPerfil = async () => {
    setSavingProfile(true);
    setProfileMessage({ type: '', text: '' });
    try {
      if (perfilForm.nueva_password || perfilForm.confirmar_password) {
        if (perfilForm.nueva_password.length < 8) {
          throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
        }
        if (perfilForm.nueva_password !== perfilForm.confirmar_password) {
          throw new Error('La confirmación de contraseña no coincide.');
        }
      }

      const formData = new FormData();
      formData.append('nombre', perfilForm.nombre);
      formData.append('apellido', perfilForm.apellido);
      formData.append('telefono', perfilForm.telefono || '');
      formData.append('matricula', perfilForm.matricula || '');
      formData.append('carrera', perfilForm.carrera || '');
      formData.append('cuatrimestre_inicial', perfilForm.cuatrimestre_inicial || '');
      formData.append('fecha_inicio_carrera', perfilForm.fecha_inicio_carrera || '');
      ['titulo_profesional','biografia','competencias','linkedin','github','portafolio','idiomas','disponibilidad','modalidad_preferida','ciudad'].forEach((k) => formData.append(k, perfilForm[k] || ''));
      if (perfilForm.nueva_password) formData.append('nueva_password', perfilForm.nueva_password);
      if (fotoPerfilFile) formData.append('foto_perfil', fotoPerfilFile);

      const res = await fetch(`${API_BASE}/estudiante/perfil`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.mensaje || 'Error al actualizar el perfil');

      setProfileMessage({ type: 'success', text: 'Datos actualizados correctamente.' });
      setIsEditingProfile(false);
      setFotoPerfilFile(null);
      
      const updatedUser = {
        ...user,
        ...(data.usuario || {}),
        nombre: perfilForm.nombre,
        apellido: perfilForm.apellido,
        telefono: perfilForm.telefono
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      await cargarDashboard(); 
    } catch (error) {
      setProfileMessage({ type: 'error', text: error.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEliminarCuenta = async () => {
    const confirmar = window.confirm('¿Seguro que deseas desactivar tu cuenta? Ya no podrás iniciar sesión con este usuario.');
    if (!confirmar) return;

    const confirmacionFinal = window.prompt('Para confirmar la baja de la cuenta escribe: ELIMINAR');
    if (confirmacionFinal !== 'ELIMINAR') {
      setProfileMessage({ type: 'error', text: 'La baja de cuenta fue cancelada.' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/estudiante/perfil`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo desactivar la cuenta.');

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('biometriaActiva');
      navigate('/login');
    } catch (error) {
      setProfileMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    cargarDashboard();
    cargarProyectos();
    cargarEvidencias();
    cargarVacantes(); 
    cargarSoftSkills();
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
    setMediaProyecto([]);
    setNuevaTecnologia('');
    setEditingProyectoId(null);
    setUploadError('');
    setUploadResult('');
    if (imgProyectoRef.current) imgProyectoRef.current.value = '';
    if (mediaProyectoRef.current) mediaProyectoRef.current.value = '';
  };

  const limpiarFormularioEvidencia = () => {
    setArchivoEvidencia(null);
    setProyectoSeleccionado('');
    setUploadError('');
    setUploadResult('');
    if (evidenciaRef.current) evidenciaRef.current.value = '';
  };

  const handleGuardarProyecto = async () => {
    setUploadError('');
    setUploadResult('');

    if (!tituloProyecto.trim()) {
      setUploadError('El título del proyecto es obligatorio.');
      return;
    }

    if (!objetivo.trim()) {
      setUploadError('El objetivo del proyecto es obligatorio.');
      return;
    }

    if (!actividades.trim()) {
      setUploadError('Las actividades realizadas son obligatorias.');
      return;
    }

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
      mediaProyecto.forEach((file) => formData.append('media', file));

      let res;
      if (editingProyectoId) {
        res = await fetch(`${API_BASE}/estudiante/proyectos/${editingProyectoId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        res = await fetch(`${API_BASE}/estudiante/proyectos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar el proyecto');

      setUploadResult(editingProyectoId ? 'Proyecto actualizado correctamente.' : 'Proyecto registrado correctamente.');
      limpiarFormularioProyecto();
      await cargarProyectos();
      await cargarDashboard();
      setView('proyectos');
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setSavingProyecto(false);
    }
  };

  const handleEditarProyecto = (proyecto) => {
    setTituloProyecto(proyecto.titulo || '');
    setDescProyecto(proyecto.descripcion || '');
    setEstadoProyecto(proyecto.estado || 'en progreso');
    setAreaTrabajo(proyecto.area_trabajo || '');
    setAmbitoDesarrollo(proyecto.ambito_desarrollo || '');
    setEsInnovacion(proyecto.es_innovacion === 1);
    setYaTrabaja(proyecto.ya_trabaja === 1);
    setCompetenciaImpacto(proyecto.competencia_impacto || '');
    setObjetivo(proyecto.objetivo || '');
    setActividades(proyecto.actividades || '');
    setTecnologiasSeleccionadas(
      proyecto.tecnologias ? proyecto.tecnologias.split(',').map(t => t.trim()).filter(Boolean) : []
    );
    setImgPrincipal(null);
    setMediaProyecto([]);
    setEditingProyectoId(proyecto.id_proyecto);
    setUploadError('');
    setUploadResult('');
    handleNavClick('subir');
  };

  const handleEliminarProyecto = async (id) => {
    const confirmar = window.confirm('¿Seguro que deseas eliminar este proyecto?');
    if (!confirmar) return;

    try {
      const res = await fetch(`${API_BASE}/estudiante/proyectos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo eliminar el proyecto');

      await cargarProyectos();
      await cargarDashboard();
      await cargarEvidencias();
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleSubirEvidencia = async () => {
    setUploadError('');
    setUploadResult('');

    if (!proyectoSeleccionado) {
      setUploadError('Debes seleccionar un proyecto.');
      return;
    }
    if (!archivoEvidencia) {
      setUploadError('Debes seleccionar un archivo.');
      return;
    }

    setSavingProyecto(true);
    try {
      const formData = new FormData();
      formData.append('id_proyecto', proyectoSeleccionado);
      formData.append('tipo', 'archivo'); 
      formData.append('archivo', archivoEvidencia);

      const res = await fetch(`${API_BASE}/estudiante/evidencias`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo subir la evidencia');

      setUploadResult('Evidencia subida correctamente.');
      limpiarFormularioEvidencia();
      await cargarEvidencias();
      await cargarDashboard();
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setSavingProyecto(false);
    }
  };

  const handleEliminarEvidencia = async (id) => {
    const confirmar = window.confirm('¿Seguro que deseas eliminar esta evidencia?');
    if (!confirmar) return;

    try {
      const res = await fetch(`${API_BASE}/estudiante/evidencias/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo eliminar la evidencia');

      await cargarEvidencias();
      await cargarDashboard();
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const abrirDetalleVacante = async (id_vacante) => {
    setShowVacanteDetalle(true);
    setVacanteDetalle(null);
    setVacanteDetalleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/estudiante/vacantes/${id_vacante}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo cargar la vacante.');
      setVacanteDetalle(data.vacante);
    } catch (error) {
      setVacanteDetalle({ error: error.message });
    } finally {
      setVacanteDetalleLoading(false);
    }
  };

  const handlePostular = async (id_vacante) => {
    try {
      const res = await fetch(`${API_BASE}/estudiante/postulaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_vacante })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setVacantes(vacantes.map(v => 
          v.id_vacante === id_vacante ? { ...v, estado_postulacion: 'pendiente' } : v
        ));
        alert("¡Te has postulado correctamente a esta vacante! La empresa revisará tu perfil.");
      } else {
        alert(data.mensaje || "Error al postularse");
      }
    } catch (error) {
      console.error("Error al postular:", error);
      alert("Ocurrió un error al enviar tu postulación.");
    }
  };

  const estudianteInfo = dashboardData?.estudiante || {};
  const resumen = dashboardData?.resumen || {};
  const usuarioInfo = dashboardData?.usuario || {};
  const fotoPerfilUrl = getProfilePhotoUrl(usuarioInfo.foto_perfil || user.foto_perfil);
  const cuatrimestreActual = estudianteInfo.cuatrimestre_actual || estudianteInfo.semestre;
  const estadoAcademico = formatEstadoAcademico(estudianteInfo.estado_academico);
  const fechaInicioEstimadaCarrera = estudianteInfo.fecha_inicio_estimada_carrera || calcularInicioEstimadoCarrera(estudianteInfo);
  const anioIngresoEstimado = getAnioIngresoEstimado({ ...estudianteInfo, fecha_inicio_estimada_carrera: fechaInicioEstimadaCarrera });

  return (
    <>
      <div className="app">
 {/* OVERLAY MÓVIL (Oscurece el fondo al abrir el menú) */}
        {isMobileMenuOpen && (
          <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}

 {/* SIDEBAR (Ahora con clase dinámica) */}
        <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="brand">Skill<span>Match</span></div>
            <div className="brand-sub">Portal Estudiante</div>
          </div>

          <div className="nav-wrap">
            <div className="nav-group-label">Principal</div>
            <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>
              <span className="nav-icon"><AppIcon name="dashboard" /></span> Dashboard
            </div>
            
            <div className="nav-item" onClick={() => navigate('/estadias')}>
              <span className="nav-icon"><AppIcon name="graduation" /></span> Mi estadía
            </div>
            <div className={`nav-item ${view === 'vacantes' ? 'active' : ''}`} onClick={() => handleNavClick('vacantes')}>
              <span className="nav-icon"><AppIcon name="briefcase" /></span> Bolsa de Trabajo
            </div>

            <div className={`nav-item ${view === 'habilidades' ? 'active' : ''}`} onClick={() => handleNavClick('habilidades')}>
              <span className="nav-icon"><AppIcon name="brain" /></span> Habilidades blandas
            </div>

            <div className={`nav-item ${view === 'proyectos' ? 'active' : ''}`} onClick={() => handleNavClick('proyectos')}>
              <span className="nav-icon"><AppIcon name="folder" /></span> Mis proyectos
            </div>
            <div className={`nav-item ${view === 'documentos' ? 'active' : ''}`} onClick={() => handleNavClick('documentos')}>
              <span className="nav-icon"><AppIcon name="file" /></span> Documentos
            </div>

            <div className="nav-group-label" style={{ marginTop: '8px' }}>Cuenta</div>
            <div className={`nav-item ${view === 'perfil' ? 'active' : ''}`} onClick={() => { setIsEditingProfile(false); handleNavClick('perfil'); }}>
              <span className="nav-icon"><AppIcon name="user" /></span> Mi perfil
            </div>
            
            <button className="sidebar-logout-btn" onClick={cerrarSesion}>
              <AppIcon name="logout" /> Cerrar sesión
            </button>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">{fotoPerfilUrl ? <img src={fotoPerfilUrl} alt="Foto de perfil" /> : initials(nombreCompleto)}</div>
            <div>
              <div className="user-name">{nombreCompleto}</div>
              <div className="user-role">Estudiante</div>
            </div>
          </div>
        </aside>

        <main className="main">
          {globalError && (
            <div style={{ padding: '16px 20px 0 20px' }}>
              <div className="error-box">{globalError}</div>
            </div>
          )}

          {view === 'dashboard' && (
            <>
              <div className="topbar">
                <div className="topbar-left-wrap">
 {/* BOTÓN HAMBURGUESA */}
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                  <div className="topbar-left">
                    <div className="topbar-title">Dashboard — Estudiante</div>
                    <div className="topbar-sub">Bienvenido, {user.nombre || 'Estudiante'} · {user.correo}</div>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => { limpiarFormularioProyecto(); handleNavClick('subir'); }}>
                  + Subir proyecto
                </button>
              </div>

              <div className="content">
                {loadingDashboard ? (
                  <div className="loading-box">Cargando dashboard...</div>
                ) : (
                  <>
                    <div className="perfil-card">
                      <div className="perf-avatar">{fotoPerfilUrl ? <img src={fotoPerfilUrl} alt="Foto de perfil" /> : initials(nombreCompleto)}</div>
                      <div>
                        <div className="perf-name">{nombreCompleto}</div>
                        <div className="perf-cargo">
                          {estudianteInfo.carrera || estadoAcademico} — SkillMatch
                        </div>
                        <div className="perf-tags">
                          <span className="perf-tag">Correo: {usuarioInfo.correo || user.correo}</span>
                          <span className="perf-tag">Matrícula: {estudianteInfo.matricula || 'Sin matrícula'}</span>
                          <span className="perf-tag">{estudianteInfo.estado_academico === 'egresado' ? 'Egresado' : (cuatrimestreActual ? `${cuatrimestreActual}° cuatrimestre` : 'Cuatrimestre no disponible')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="metrics">
                      <div className="metric-card" style={{ '--mc': '#244E7C' }}>
                        <span className="mc-icon"><AppIcon name="folder" size={22} /></span>
                        <div className="mc-label">Proyectos propios</div>
                        <div className="mc-val">{resumen.proyectos_propios || 0}</div>
                        <div className="mc-sub">registrados en plataforma</div>
                      </div>
                      <div className="metric-card" style={{ '--mc': '#22c55e' }}>
                        <span className="mc-icon"><AppIcon name="teacher" size={22} /></span>
                        <div className="mc-label">Carrera</div>
                        <div className="mc-val" style={{ fontSize: '18px', lineHeight: 1.2 }}>
                          {estudianteInfo.carrera || '—'}
                        </div>
                        <div className="mc-sub">perfil académico</div>
                      </div>
                      <div className="metric-card" style={{ '--mc': '#f59e0b' }}>
                        <span className="mc-icon"><AppIcon name="calendar" size={22} /></span>
                        <div className="mc-label">Cuatrimestre</div>
                        <div className="mc-val" style={{ fontSize: estudianteInfo.estado_academico === 'egresado' ? '18px' : '30px', lineHeight: 1.1 }}>
                          {estudianteInfo.estado_academico === 'egresado' ? 'Egresado' : (cuatrimestreActual ? `${cuatrimestreActual}°` : '—')}
                        </div>
                        <div className="mc-sub">{estadoAcademico}</div>
                      </div>
                      <div className="metric-card" style={{ '--mc': '#232E56' }}>
                        <span className="mc-icon"><AppIcon name="file" size={22} /></span>
                        <div className="mc-label">Documentos</div>
                        <div className="mc-val">{resumen.documentos || 0}</div>
                        <div className="mc-sub">relacionados a proyectos</div>
                      </div>
                    </div>

                    <DashboardInsights
                      title="Evolución de tu perfil"
                      subtitle="Resumen de proyectos, documentos y avance académico"
                      labels={['Proyectos', 'Documentos', 'Cuatrimestre']}
                      values={[resumen.proyectos_propios || 0, resumen.documentos || 0, cuatrimestreActual || 0]}
                      progress={Math.min(100, 30 + ((resumen.proyectos_propios || 0) * 12) + ((resumen.documentos || 0) * 5))}
                      progressLabel="Perfil completado"
                    />

                    <div className="section-hdr">
                      <div className="section-title">Acceso rápido</div>
                    </div>

                    <div className="quick-access-grid">
                      {[
                        { icon: 'briefcase', title: 'Vacantes', sub: 'Encuentra ofertas y estadías', action: () => handleNavClick('vacantes') },
                        { icon: 'folder', title: 'Mis proyectos', sub: 'Gestiona tus proyectos', action: () => handleNavClick('proyectos') },
                        { icon: 'brain', title: 'Habilidades blandas', sub: 'Test tipo entrevista', action: () => handleNavClick('habilidades') },
                        { icon: 'user', title: 'Mi perfil', sub: 'Datos y CV', action: () => { setIsEditingProfile(false); handleNavClick('perfil') } },
                      ].map((item, i) => (
                        <div
                          key={i}
                          onClick={item.action}
                          style={{
                            background: 'white',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '20px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(35,46,86,0.06)',
                          }}
                        >
                          <div className="quick-access-icon"><AppIcon name={item.icon} size={24} /></div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.sub}</div>
                        </div>
                      ))}
                    </div>

                    {proyectos.length > 0 && (
                      <>
                        <div className="section-hdr">
                          <div className="section-title">
                            Últimos proyectos <span className="section-count">{proyectos.length}</span>
                          </div>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '7px 14px' }} onClick={() => handleNavClick('proyectos')}>
                            Ver todos →
                          </button>
                        </div>
                        <div>
                          {proyectos.slice(0, 3).map((p) => (
                            <div key={p.id_proyecto} className="proyecto-card">
                              <div className="proyecto-icon"><AppIcon name="folder" size={20} /></div>
                              <div className="proyecto-info">
                                <div className="proyecto-name">{p.titulo}</div>
                                <div className="proyecto-meta">Fecha: {formatFecha(p.fecha_registro)}</div>
                                <div className="proyecto-desc">{p.descripcion || 'Sin descripción'}</div>
                              </div>
                              <div>
                                <span className={badgeClassByEstado(p.estado)}>{p.estado}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {view === 'vacantes' && (
            <>
              <div className="topbar">
                <div className="topbar-left-wrap">
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                  <div className="topbar-left">
                    <div className="topbar-title">Bolsa de Trabajo</div>
                    <div className="topbar-sub">Oportunidades laborales y estadías de empresas vinculadas</div>
                  </div>
                </div>
              </div>

              <div className="content">
                <div className="section-hdr">
                  <div className="section-title">Vacantes disponibles <span className="section-count">{vacantes.length} opciones</span></div>
                </div>

                {vacantes.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', background: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                    Aún no hay vacantes disponibles o cargando datos...
                  </div>
                ) : (
                  <div className="vacantes-grid">
                    {vacantes.map((v) => (
                      <div className="vacante-card" key={v.id_vacante}>
                        <div className="vacante-header">
                          <div className="vacante-empresa">{v.empresa || 'Empresa Confidencial'}</div>
                          <div className="vacante-title">{v.titulo}</div>
                        </div>
                        
                        <div className="vacante-tags">
                          <span className="vacante-tag"><AppIcon name="briefcase" size={13} /> {v.categoria || 'Área por definir'}</span>
                          <span className="vacante-tag"><AppIcon name="map" size={13} /> {v.ubicacion || v.empresa_ubicacion || 'Ubicación por definir'}</span>
                          <span className="vacante-tag"><AppIcon name="globe" size={13} /> {v.modalidad || 'Modalidad por definir'}</span>
                        </div>

                        <div className="vacante-desc">{v.descripcion}</div>
                        {v.tecnologias_requeridas && <div className="vacante-tech-preview">{String(v.tecnologias_requeridas).split(',').slice(0, 5).map((t) => <span key={t}>{t.trim()}</span>)}</div>}

                        <div className="vacante-footer vacancy-card-footer">
                          {v.estado_postulacion ? (
                            <div className="vacancy-applied"><AppIcon name="check" size={15} /> {v.estado_postulacion === 'pendiente' ? 'Postulación enviada' : `Estado: ${v.estado_postulacion}`}</div>
                          ) : null}
                          <button className="btn btn-primary" onClick={() => abrirDetalleVacante(v.id_vacante)}>
                            Ver vacante completa <span>→</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {showVacanteDetalle && (
            <div className="modal-overlay vacancy-detail-overlay" onClick={() => setShowVacanteDetalle(false)}>
              <div className="vacancy-detail-modal" onClick={(e) => e.stopPropagation()}>
                <button className="vacancy-detail-close" onClick={() => setShowVacanteDetalle(false)}>×</button>
                {vacanteDetalleLoading ? (
                  <div className="vacancy-detail-loading">Cargando oportunidad...</div>
                ) : vacanteDetalle?.error ? (
                  <div className="vacancy-detail-loading">{vacanteDetalle.error}</div>
                ) : vacanteDetalle ? (
                  <>
                    <header className="vacancy-detail-hero">
                      <div className="vacancy-company-logo">
                        {vacanteDetalle.empresa_logo ? <img src={buildFileUrl(vacanteDetalle.empresa_logo)} alt={vacanteDetalle.empresa} /> : <AppIcon name="building" size={30} />}
                      </div>
                      <div className="vacancy-detail-hero-copy">
                        <span className="vacancy-detail-eyebrow">OPORTUNIDAD PROFESIONAL</span>
                        <h2>{vacanteDetalle.titulo}</h2>
                        <button type="button" className="vacancy-company-link">{vacanteDetalle.empresa}</button>
                        <div className="vacancy-detail-tags">
                          <span><AppIcon name="map" size={14} /> {vacanteDetalle.ubicacion || vacanteDetalle.empresa_ubicacion || 'Ubicación por definir'}</span>
                          <span><AppIcon name="globe" size={14} /> {vacanteDetalle.modalidad || 'Modalidad por definir'}</span>
                          <span><AppIcon name="briefcase" size={14} /> {vacanteDetalle.tipo_oportunidad || vacanteDetalle.categoria || 'Oportunidad'}</span>
                        </div>
                      </div>
                    </header>

                    <div className="vacancy-detail-grid">
                      <div className="vacancy-detail-main">
                        <section><h3>Acerca de la oportunidad</h3><p>{vacanteDetalle.descripcion || 'La empresa no agregó una descripción.'}</p></section>
                        {vacanteDetalle.actividades && <section><h3>Qué harás</h3><p>{vacanteDetalle.actividades}</p></section>}
                        {vacanteDetalle.responsabilidades && <section><h3>Responsabilidades</h3><p>{vacanteDetalle.responsabilidades}</p></section>}
                        <section>
                          <h3>Perfil que busca la empresa</h3>
                          <div className="vacancy-detail-columns">
                            <div><strong>Requisitos obligatorios</strong><p>{vacanteDetalle.requisitos_obligatorios || vacanteDetalle.requisitos || 'No especificados.'}</p></div>
                            <div><strong>Deseables</strong><p>{vacanteDetalle.requisitos_deseables || 'No especificados.'}</p></div>
                          </div>
                        </section>
                        <section><h3>Tecnologías</h3><div className="vacancy-tech-groups"><div><strong>Requeridas</strong><div className="vacancy-chip-row">{String(vacanteDetalle.tecnologias_requeridas || '').split(',').filter(Boolean).map((t) => <span key={`r-${t}`}>{t.trim()}</span>)}</div></div><div><strong>Deseables</strong><div className="vacancy-chip-row muted">{String(vacanteDetalle.tecnologias_deseables || '').split(',').filter(Boolean).map((t) => <span key={`d-${t}`}>{t.trim()}</span>)}</div></div></div></section>
                        {vacanteDetalle.beneficios && <section><h3>Beneficios y apoyos</h3><p>{vacanteDetalle.beneficios}</p></section>}
                        <section className="vacancy-company-card">
                          <div className="vacancy-company-card-head"><AppIcon name="building" size={20} /><div><span>CONOCE A LA EMPRESA</span><h3>{vacanteDetalle.empresa}</h3></div></div>
                          <p>{vacanteDetalle.descripcion_empresa || 'Empresa validada por el área de Vinculación de la UTEQ.'}</p>
                          <div className="vacancy-company-facts"><span><b>Giro:</b> {vacanteDetalle.giro || '—'}</span><span><b>Sector:</b> {vacanteDetalle.sector || '—'}</span><span><b>Tamaño:</b> {vacanteDetalle.tamano_empresa || '—'}</span><span><b>Ubicación:</b> {vacanteDetalle.empresa_ubicacion || '—'}</span></div>
                          {vacanteDetalle.cultura_valores && <div><strong>Cultura y valores</strong><p>{vacanteDetalle.cultura_valores}</p></div>}
                          {vacanteDetalle.sitio_web && <a href={vacanteDetalle.sitio_web} target="_blank" rel="noreferrer">Visitar sitio web ↗</a>}
                        </section>
                      </div>

                      <aside className="vacancy-detail-side">
                        <div className="vacancy-summary-card">
                          <h3>Resumen</h3>
                          <div><span>Nivel</span><strong>{vacanteDetalle.nivel || '—'}</strong></div>
                          <div><span>Horario</span><strong>{vacanteDetalle.horario || 'Por definir'}</strong></div>
                          <div><span>Experiencia</span><strong>{vacanteDetalle.experiencia || 'No especificada'}</strong></div>
                          <div><span>Plazas</span><strong>{vacanteDetalle.plazas || 1}</strong></div>
                          <div><span>Fecha límite</span><strong>{vacanteDetalle.fecha_limite ? formatFecha(vacanteDetalle.fecha_limite) : 'Sin fecha límite'}</strong></div>
                          {vacanteDetalle.mostrar_salario && (vacanteDetalle.salario_min || vacanteDetalle.salario_max) && <div><span>Apoyo / salario</span><strong>${Number(vacanteDetalle.salario_min || 0).toLocaleString('es-MX')} - ${Number(vacanteDetalle.salario_max || vacanteDetalle.salario_min || 0).toLocaleString('es-MX')} {vacanteDetalle.moneda || 'MXN'}</strong></div>}
                        </div>
                        {vacanteDetalle.estado_postulacion ? <div className="vacancy-already-applied"><AppIcon name="check" size={18} /><div><strong>Ya te postulaste</strong><span>Estado: {vacanteDetalle.estado_postulacion}</span></div></div> : <button className="btn btn-primary vacancy-apply-button" onClick={async () => { await handlePostular(vacanteDetalle.id_vacante); setVacanteDetalle({...vacanteDetalle, estado_postulacion: 'pendiente'}); }}>Postularme a esta vacante →</button>}
                        <p className="vacancy-privacy-note"><AppIcon name="shield" size={14} /> Tu perfil profesional será compartido con esta empresa al postularte.</p>
                      </aside>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {view === 'subir' && (
            <>
              <div className="topbar">
                <div className="topbar-left-wrap">
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                  <div className="topbar-left">
                    <div className="topbar-title">
                      {editingProyectoId ? 'Editar proyecto' : 'Subir proyecto'}
                    </div>
                    <div className="topbar-sub">Registra tu proyecto académico en la plataforma</div>
                  </div>
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

                  <div className="upload-form-card">
                    <div className="section-hdr" style={{ marginBottom: '20px' }}>
                      <div className="section-title">Información del proyecto</div>
                    </div>

                    <div className="form-row">
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Título del proyecto *</label>
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Ej: Sistema de gestión de inventarios"
                          value={tituloProyecto}
                          onChange={(e) => setTituloProyecto(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Descripción</label>
                        <textarea
                          className="form-textarea"
                          placeholder="Describe brevemente tu proyecto"
                          value={descProyecto}
                          onChange={(e) => setDescProyecto(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">Área de trabajo</label>
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Ej: Backend, Diseño"
                          value={areaTrabajo}
                          onChange={(e) => setAreaTrabajo(e.target.value)}
                        />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Ámbito de desarrollo</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          {['Web', 'Móvil', 'IoT', 'Escritorio', 'Otro'].map((ambito) => {
                            const selected = String(ambitoDesarrollo || '').split(',').map(a => a.trim()).includes(ambito);
                            return (
                              <label key={ambito} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 700 }}>
                                <input type="checkbox" checked={selected} onChange={() => toggleAmbito(ambito)} />
                                {ambito}
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          Puedes elegir más de una opción.
                        </div>
                      </div>
                    </div>

                    <div className="form-row" style={{ display: 'flex', gap: '20px', margin: '15px 0', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        <input type="checkbox" checked={esInnovacion} onChange={(e) => setEsInnovacion(e.target.checked)} />
                        ¿Es un proyecto de innovación?
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        <input type="checkbox" checked={yaTrabaja} onChange={(e) => setYaTrabaja(e.target.checked)} />
                        ¿Ya se está trabajando actualmente?
                      </label>
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">Competencia / Impacto</label>
                        <select className="form-select" value={competenciaImpacto} onChange={(e) => setCompetenciaImpacto(e.target.value)}>
                          <option value="">Selecciona impacto</option>
                          <option value="L">Local</option>
                          <option value="R">Regional</option>
                          <option value="N">Nacional</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Objetivo del proyecto *</label>
                        <textarea
                          className="form-textarea"
                          style={{ height: '80px' }}
                          placeholder="¿Qué se busca lograr con este proyecto?"
                          value={objetivo}
                          onChange={(e) => setObjetivo(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Actividades realizadas *</label>
                        <textarea
                          className="form-textarea"
                          style={{ height: '80px' }}
                          placeholder="Menciona las principales actividades que realizaste"
                          value={actividades}
                          onChange={(e) => setActividades(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Imagen principal</label>
                        <input
                          className="form-input"
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          ref={imgProyectoRef}
                          onChange={(e) => {
                            if (e.target.files[0]) setImgPrincipal(e.target.files[0]);
                          }}
                        />
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: 6 }}>
                          Esta imagen se usa como portada del proyecto.
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Galería del proyecto: fotos o videos</label>
                        <input
                          className="form-input"
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
                          multiple
                          ref={mediaProyectoRef}
                          onChange={(e) => setMediaProyecto(Array.from(e.target.files || []))}
                        />
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: 6 }}>
                          Puedes subir varias imágenes o videos. Se mostrarán como carrusel en la landing y en el detalle del proyecto.
                        </div>
                        {mediaProyecto.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: '#334155' }}>{mediaProyecto.length} archivo(s) seleccionados.</div>}
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
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
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                          <input
                            className="form-input"
                            style={{ flex: 1, minWidth: 220 }}
                            placeholder="Agregar otra tecnología, ej. Angular, Kotlin, Arduino"
                            value={nuevaTecnologia}
                            onChange={(e) => setNuevaTecnologia(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTecnologiaPersonalizada(); } }}
                          />
                          <button type="button" className="btn btn-ghost" onClick={agregarTecnologiaPersonalizada}>Agregar</button>
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">Estado</label>
                        <select
                          className="form-select"
                          value={estadoProyecto}
                          onChange={(e) => setEstadoProyecto(e.target.value)}
                        >
                          <option value="en progreso">En progreso</option>
                          <option value="completado">Completado</option>
                          <option value="pausado">Pausado</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={limpiarFormularioProyecto}
                        disabled={savingProyecto}
                      >
                        Limpiar
                      </button>

                      <button
                        className="btn btn-primary"
                        onClick={handleGuardarProyecto}
                        disabled={savingProyecto}
                      >
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
                  <div className="topbar-left">
                    <div className="topbar-title">Documentos / Evidencias</div>
                    <div className="topbar-sub">{evidencias.length} archivos asociados a tus proyectos</div>
                  </div>
                </div>
              </div>

              <div className="content">
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

                <div className="upload-form-card" style={{ marginBottom: '20px' }}>
                  <div className="section-hdr" style={{ marginBottom: '20px' }}>
                    <div className="section-title">Subir evidencia</div>
                  </div>

                  <div className="form-row">
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Proyecto *</label>
                      <select
                        className="form-select"
                        value={proyectoSeleccionado}
                        onChange={(e) => setProyectoSeleccionado(e.target.value)}
                      >
                        <option value="">Selecciona un proyecto</option>
                        {proyectos.map((p) => (
                          <option key={p.id_proyecto} value={p.id_proyecto}>
                            {p.titulo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Archivo *</label>
                      <input
                        className="form-input"
                        type="file"
                        ref={evidenciaRef}
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            setArchivoEvidencia(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {archivoEvidencia && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
                      Archivo seleccionado: <strong>{archivoEvidencia.name}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={limpiarFormularioEvidencia}
                      disabled={savingProyecto}
                    >
                      Limpiar
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={handleSubirEvidencia}
                      disabled={savingProyecto}
                    >
                      {savingProyecto ? 'Subiendo...' : 'Subir evidencia'}
                    </button>
                  </div>
                </div>

                {loadingEvidencias ? (
                  <div className="loading-box">Cargando evidencias...</div>
                ) : evidencias.length === 0 ? (
                  <div className="docs-table-wrap">
                    <div className="empty-state">
                      <div className="empty-icon"><AppIcon name="file" size={30} /></div>
                      <div className="empty-title">No tienes evidencias registradas</div>
                      <div className="empty-sub">Sube tu primer archivo para que aparezca aquí</div>
                    </div>
                  </div>
                ) : (
                  <DocsTable evidencias={evidencias} onEliminar={handleEliminarEvidencia} />
                )}
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
                  <div className="topbar-left">
                    <div className="topbar-title">Mis proyectos</div>
                    <div className="topbar-sub">{proyectos.length} proyectos en tu cartera académica</div>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => { limpiarFormularioProyecto(); handleNavClick('subir'); }}>
                  + Agregar proyecto
                </button>
              </div>

              <div className="content">
                {loadingProyectos ? (
                  <div className="loading-box">Cargando proyectos...</div>
                ) : proyectos.length === 0 ? (
                  <div className="docs-table-wrap">
                    <div className="empty-state">
                      <div className="empty-icon"><AppIcon name="folder" size={30} /></div>
                      <div className="empty-title">No tienes proyectos aún</div>
                      <div className="empty-sub">Comienza registrando tu primer proyecto</div>
                      <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => { limpiarFormularioProyecto(); handleNavClick('subir'); }}>
                        + Agregar primer proyecto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {proyectos.map((p) => {
                      const isCreador = p.id_estudiante === dashboardData?.estudiante?.id_estudiante;

                      return (
                      <div key={p.id_proyecto} className="proyecto-card" style={{ display: 'block' }}>
                        <div className="proyecto-card-inner">
                          <div className="proyecto-icon"><AppIcon name="folder" size={20} /></div>

                          <div className="proyecto-info" style={{ flex: 1 }}>
                            <div className="proyecto-name">
                              {p.titulo} 
                              {!isCreador && <span style={{ marginLeft: '10px', fontSize: '11px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px' }}>Colaborador</span>}
                            </div>
                            <div className="proyecto-meta">Actualizado: {formatFecha(p.fecha_registro)}</div>
                            <div className="proyecto-desc">{p.descripcion || 'Sin descripción'}</div>

                            {p.img_principal && (
                              <div style={{ marginBottom: '10px' }}>
                                <img
                                  src={getFileSource(p.img_principal)}
                                  alt={p.titulo}
                                  style={{
                                    width: '100%',
                                    maxWidth: '220px',
                                    height: '120px',
                                    objectFit: 'cover',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)'
                                  }}
                                />
                              </div>
                            )}

                            {p.tecnologias && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                {p.tecnologias.split(',').map((tech, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '16px',
                                      background: 'var(--surface2)',
                                      border: '1px solid var(--border)',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      color: 'var(--muted)'
                                    }}
                                  >
                                    {tech.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="proyecto-acciones">
                            <span className={badgeClassByEstado(p.estado)}>
                              {p.estado}
                            </span>
                            
                            {isCreador && (
                              <div style={{display: 'flex', flexDirection: 'column', gap: '8px', width: '100%'}}>
                                <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '7px 14px', width: '100%' }} onClick={() => handleEditarProyecto(p)}>
                                  Editar
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '7px 14px', width: '100%', background: '#f0f9ff', color: '#4f46e5', borderColor: '#c7d2fe' }} onClick={() => togglePanelColaboradores(p.id_proyecto)}>
                                  <AppIcon name="users" size={15} /> Equipo
                                </button>
                                <button className="btn btn-danger" style={{ fontSize: '12px', padding: '7px 14px', width: '100%' }} onClick={() => handleEliminarProyecto(p.id_proyecto)}>
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {proyectoActivoColab === p.id_proyecto && isCreador && (
                          <div style={{ marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                            <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#1e293b' }}>Gestionar Equipo de Proyecto</h4>
                            
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                              <input 
                                type="email" 
                                placeholder="Correo institucional del compañero" 
                                className="form-input" 
                                value={nuevoColaboradorCorreo}
                                onChange={(e) => setNuevoColaboradorCorreo(e.target.value)}
                                style={{ flex: 1, minWidth: '200px' }}
                              />
                              <button className="btn btn-primary" onClick={() => handleAgregarColaborador(p.id_proyecto)}>
                                Agregar
                              </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {colaboradoresData[p.id_proyecto]?.length > 0 ? (
                                colaboradoresData[p.id_proyecto].map(colab => (
                                  <div key={colab.matricula} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                                    <div>
                                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>{colab.nombre} {colab.apellido}</div>
                                      <div style={{ fontSize: '11px', color: '#64748b' }}>{colab.correo} • {colab.matricula}</div>
                                    </div>
                                    <button 
                                      onClick={() => handleEliminarColaborador(p.id_proyecto, colab.matricula)} 
                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                      ✕ Quitar
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No hay compañeros agregados a este proyecto.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </>
          )}


          {view === 'habilidades' && (
            <>
              <div className="topbar">
                <div className="topbar-left-wrap">
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>☰</button>
                  <div className="topbar-left">
                    <div className="topbar-title">Habilidades blandas</div>
                    <div className="topbar-sub">Test tipo entrevista laboral para fortalecer tu perfil ante empresas.</div>
                  </div>
                </div>
              </div>
              <div className="content">
                <div className="profile-card" style={{ background: 'white', borderRadius: 18, padding: 26, border: '1px solid var(--border)', boxShadow: '0 8px 20px rgba(15,23,42,.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                      <h2 style={{ margin: 0, color: 'var(--text)' }}>Evaluación situacional de habilidades blandas</h2>
                      <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Responde pensando en lo que realmente harías en una situación de estudio o trabajo, no en la respuesta que parece ideal.</p>
                      <p style={{ margin: '6px 0 0', color: 'var(--muted)', maxWidth: 680 }}>
                        Responde con honestidad. Este resultado ayuda a las empresas a ver comunicación, trabajo en equipo, liderazgo, solución de problemas, adaptabilidad y profesionalismo.
                      </p>
                    </div>
                    <div style={{ minWidth: 150, textAlign: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 16, padding: 14 }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: '#1e40af' }}>{softResult?.puntaje_total ?? '—'}%</div>
                      <div style={{ fontSize: 12, color: '#1e3a8a', fontWeight: 800 }}>Puntaje global</div>
                    </div>
                  </div>

                  {softResult && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 22 }}>
                      {[
                        ['Comunicación', softResult.comunicacion],
                        ['Trabajo en equipo', softResult.trabajo_equipo],
                        ['Liderazgo', softResult.liderazgo],
                        ['Resolución de problemas', softResult.resolucion_problemas],
                        ['Adaptabilidad', softResult.adaptabilidad],
                        ['Profesionalismo', softResult.profesionalismo],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>{label}</div>
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, margin: '10px 0' }}>
                            <div style={{ width: `${value || 0}%`, height: 8, background: '#244E7C', borderRadius: 99 }} />
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#232E56' }}>{value ?? 0}%</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {softMessage.text && (
                    <div className={softMessage.type === 'success' ? 'success-box' : 'error-box'} style={{ marginBottom: 16 }}>{softMessage.text}</div>
                  )}

                  <div style={{ display: 'grid', gap: 14 }}>
                    {softQuestions.map((q, idx) => (
                      <div key={q.id_pregunta} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                          <span style={{ background: '#232E56', color: 'white', borderRadius: 10, padding: '4px 8px', fontSize: 12, fontWeight: 900 }}>{idx + 1}</span>
                          <div>
                            <div style={{ color: '#0f172a', fontWeight: 800 }}>{q.pregunta}</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Competencia: {String(q.competencia || '').replaceAll('_', ' ')}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[1, 2, 3, 4, 5].map((valor) => (
                            <label key={valor} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', background: Number(softAnswers[q.id_pregunta]) === valor ? '#dbeafe' : 'white', fontSize: 13, fontWeight: 700 }}>
                              <input type="radio" name={`soft-${q.id_pregunta}`} checked={Number(softAnswers[q.id_pregunta]) === valor} onChange={() => setSoftAnswers({ ...softAnswers, [q.id_pregunta]: valor })} />
                              {valor === 1 ? 'Nada probable' : valor === 2 ? 'Poco probable' : valor === 3 ? 'Neutral' : valor === 4 ? 'Probable' : 'Muy probable'}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    <button className="btn btn-primary" onClick={guardarSoftSkills} disabled={softLoading || !softQuestions.length}>
                      {softLoading ? 'Guardando...' : 'Guardar test'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'perfil' && (
            <>
              <div className="topbar">
                <div className="topbar-left-wrap">
                  <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                  <div className="topbar-left">
                    <div className="topbar-title">Mi perfil</div>
                    <div className="topbar-sub">Información personal y académica</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {!isEditingProfile && (
                    <button className="btn btn-ghost" onClick={iniciarEdicionPerfil}>
                      <AppIcon name="edit" size={16} /> Editar
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={generarPDFPerfil}>
                    <AppIcon name="download" size={16} /> Descargar CV
                  </button>
                </div>
              </div>

              <div className="content">
                {profileMessage.text && (
                  <div className={`alert alert-${profileMessage.type}`} style={{ marginBottom: '20px' }}>
                    {profileMessage.type === 'success' ? '✓' : '✕'} {profileMessage.text}
                  </div>
                )}

                <div className="perfil-view">
                  <div className="profile-overview-grid">
                    <div className="perfil-head">
                    <div className="perfil-avatar-large">{fotoPerfilUrl ? <img src={fotoPerfilUrl} alt="Foto de perfil" /> : initials(nombreCompleto)}</div>
                    <div className="perfil-header-info">
                      <div className="perfil-full-name">{nombreCompleto}</div>
                      <div className="perfil-email">{usuarioInfo.correo || user.correo}</div>
                      <div className="perfil-role">{estadoAcademico}</div>
                    </div>
                  </div>

                    {!isEditingProfile && (
                      <div className="biometric-security-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div className="biometric-icon"><AppIcon name="shield" size={24} /></div>
                        <div>
                          <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#232E56', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Doble Seguridad Biométrica
                          </h3>
                          <p style={{ fontSize: '13px', color: '#64748b' }}>
                            Protege tu cuenta activando el inicio de sesión con el sensor de tu dispositivo (Face ID o Huella).
                          </p>
                        </div>
                      </div>

                      {errorBio && <div className="alert alert-error" style={{ fontSize: '12px', padding: '10px' }}>{errorBio}</div>}
                      {successBio && <div className="alert alert-success" style={{ fontSize: '12px', padding: '10px' }}>{successBio}</div>}

 {/* NUEVA LÓGICA: Si ya tiene la biometría, muestra un mensaje. Si no, muestra el botón. */}
                      {biometriaActiva ? (
                        <div style={{ 
                          marginTop: '15px', 
                          padding: '12px 16px', 
                          background: '#dcfce7', 
                          color: '#166534', 
                          borderRadius: '8px', 
                          border: '1px solid #86efac', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          fontSize: '13px', 
                          fontWeight: 'bold' 
                        }}>
                          <span>✅</span> Datos biométricos ya registrados y listos para usar
                        </div>
                      ) : (
                        <button 
                          className="btn btn-primary" 
                          onClick={handleRegistrarFaceID}
                          disabled={loadingBio}
                          style={{ 
                            marginTop: '10px',
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '10px',
                            padding: '12px 24px',
                            flexWrap: 'wrap'
                          }}
                        >
                          {loadingBio ? 'Activando sensor...' : (
                            <>
 {/* ICONO FACE ID */}
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                                <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
                                <path d="M8 8h.01" />
                                <path d="M16 8h.01" />
                                <path d="M12 12v3" />
                                <path d="M8 16a4 4 0 0 0 8 0" />
                              </svg>
 {/* ICONO HUELLA DACTILAR */}
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
                                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                                <path d="M8.5 22c-.3-1.5-.5-3-.5-5v-5a4 4 0 0 1 8 0v1.5" />
                                <path d="M16 22v-1.5a6 6 0 0 0-2.1-4.9" />
                                <path d="M12 22v-3" />
                              </svg>
                              Activar datos biométricos
                            </>
                          )}
                        </button>
                      )}
                      </div>
                    )}
                  </div>

                  {isEditingProfile ? (
                    <div style={{ marginBottom: '24px', background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Editar mis datos
                      </div>

                      <div className="profile-edit-photo-row">
                        <div className="profile-edit-photo">
                          {fotoPerfilUrl ? <img src={fotoPerfilUrl} alt="Foto actual" /> : initials(nombreCompleto)}
                        </div>
                        <div className="form-field" style={{ flex: 1 }}>
                          <label className="form-label">Foto de perfil</label>
                          <input
                            className="form-input"
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={(e) => setFotoPerfilFile(e.target.files?.[0] || null)}
                          />
                          <small className="form-help">Formatos permitidos: JPG, PNG o WEBP. Tamaño máximo: 3 MB.</small>
                        </div>
                      </div>
                      
                      <div className="form-row">
                        <div className="form-field">
                          <label className="form-label">Nombre</label>
                          <input className="form-input" type="text" value={perfilForm.nombre} onChange={(e) => setPerfilForm({...perfilForm, nombre: e.target.value})} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Apellidos</label>
                          <input className="form-input" type="text" value={perfilForm.apellido} onChange={(e) => setPerfilForm({...perfilForm, apellido: e.target.value})} />
                        </div>
                      </div>

                      <div className="form-row" style={{ marginTop: '16px' }}>
                        <div className="form-field">
                          <label className="form-label">Número de teléfono</label>
                          <input className="form-input" type="tel" value={perfilForm.telefono} onChange={(e) => setPerfilForm({...perfilForm, telefono: e.target.value})} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Matrícula</label>
                          <input className="form-input" type="text" value={perfilForm.matricula} onChange={(e) => setPerfilForm({...perfilForm, matricula: e.target.value})} />
                        </div>
                      </div>

                      <div className="form-row" style={{ marginTop: '16px' }}>
                        <div className="form-field">
                          <label className="form-label">Carrera</label>
                          <input className="form-input" type="text" value={perfilForm.carrera} onChange={(e) => setPerfilForm({...perfilForm, carrera: e.target.value})} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Cuatrimestre al registrarse</label>
                          <input
                            className="form-input"
                            type="number"
                            min="1"
                            max="11"
                            value={perfilForm.cuatrimestre_inicial}
                            onChange={(e) => setPerfilForm({...perfilForm, cuatrimestre_inicial: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="form-row" style={{ marginTop: '16px' }}>
                        <div className="form-field">
                          <label className="form-label">Fecha real de inicio de carrera</label>
                          <input
                            className="form-input"
                            type="date"
                            value={perfilForm.fecha_inicio_carrera}
                            onChange={(e) => setPerfilForm({...perfilForm, fecha_inicio_carrera: e.target.value})}
                          />
                          <small className="form-help">Puedes capturar la fecha real. Si no la tienes, el sistema estima el ingreso con el cuatrimestre y el primer lunes de enero, mayo o septiembre.</small>
                        </div>
                        <div className="form-field">
                          <label className="form-label">Estado calculado</label>
                          <input className="form-input" type="text" value={estadoAcademico} disabled />
                        </div>
                      </div>

                      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#244E7C', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>Perfil profesional</div>
                        <div className="form-row">
                          <div className="form-field"><label className="form-label">Título profesional objetivo</label><input className="form-input" value={perfilForm.titulo_profesional} onChange={(e) => setPerfilForm({...perfilForm, titulo_profesional: e.target.value})} placeholder="Ej. Desarrollador Full Stack Jr." /></div>
                          <div className="form-field"><label className="form-label">Ciudad / zona</label><input className="form-input" value={perfilForm.ciudad} onChange={(e) => setPerfilForm({...perfilForm, ciudad: e.target.value})} placeholder="Querétaro, Qro." /></div>
                        </div>
                        <div className="form-field" style={{ marginTop: '16px' }}><label className="form-label">Acerca de mí</label><textarea className="form-input" style={{ minHeight: 100 }} value={perfilForm.biografia} onChange={(e) => setPerfilForm({...perfilForm, biografia: e.target.value})} placeholder="Resume tus intereses, fortalezas y el tipo de proyectos en los que buscas participar." /></div>
                        <div className="form-field" style={{ marginTop: '16px' }}><label className="form-label">Habilidades técnicas</label><textarea className="form-input" style={{ minHeight: 84 }} value={perfilForm.competencias} onChange={(e) => setPerfilForm({...perfilForm, competencias: e.target.value})} placeholder="Ej. React, Node.js, PostgreSQL, Flutter, Git, APIs REST" /><small className="form-help">Separa las habilidades por comas. Estas habilidades también ayudan al Match con vacantes.</small></div>
                        <div className="form-row" style={{ marginTop: '16px' }}>
                          <div className="form-field"><label className="form-label">Disponibilidad</label><input className="form-input" value={perfilForm.disponibilidad} onChange={(e) => setPerfilForm({...perfilForm, disponibilidad: e.target.value})} placeholder="Ej. Estadía inmediata / medio tiempo" /></div>
                          <div className="form-field"><label className="form-label">Modalidad preferida</label><select className="form-input" value={perfilForm.modalidad_preferida} onChange={(e) => setPerfilForm({...perfilForm, modalidad_preferida: e.target.value})}><option value="">Sin preferencia</option><option>Presencial</option><option>Híbrida</option><option>Remota</option></select></div>
                        </div>
                        <div className="form-row" style={{ marginTop: '16px' }}>
                          <div className="form-field"><label className="form-label">Idiomas</label><input className="form-input" value={perfilForm.idiomas} onChange={(e) => setPerfilForm({...perfilForm, idiomas: e.target.value})} placeholder="Español nativo, Inglés B2" /></div>
                          <div className="form-field"><label className="form-label">LinkedIn</label><input className="form-input" value={perfilForm.linkedin} onChange={(e) => setPerfilForm({...perfilForm, linkedin: e.target.value})} placeholder="https://linkedin.com/in/..." /></div>
                        </div>
                        <div className="form-row" style={{ marginTop: '16px' }}>
                          <div className="form-field"><label className="form-label">GitHub</label><input className="form-input" value={perfilForm.github} onChange={(e) => setPerfilForm({...perfilForm, github: e.target.value})} placeholder="https://github.com/..." /></div>
                          <div className="form-field"><label className="form-label">Portafolio</label><input className="form-input" value={perfilForm.portafolio} onChange={(e) => setPerfilForm({...perfilForm, portafolio: e.target.value})} placeholder="https://..." /></div>
                        </div>
                      </div>

                      <div className="form-row" style={{ marginTop: '16px' }}>
                        <div className="form-field">
                          <label className="form-label">Nueva contraseña</label>
                          <div className="password-input-wrap">
                            <input
                              className="form-input password-input"
                              type={mostrarNuevaPassword ? 'text' : 'password'}
                              minLength={8}
                              placeholder="Mínimo 8 caracteres"
                              value={perfilForm.nueva_password}
                              onChange={(e) => setPerfilForm({...perfilForm, nueva_password: e.target.value})}
                            />
                            <button
                              type="button"
                              className="password-eye-btn"
                              onClick={() => setMostrarNuevaPassword((prev) => !prev)}
                              aria-label={mostrarNuevaPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                              <AppIcon name={mostrarNuevaPassword ? 'eyeOff' : 'eye'} size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="form-field">
                          <label className="form-label">Confirmar contraseña</label>
                          <div className="password-input-wrap">
                            <input
                              className="form-input password-input"
                              type={mostrarConfirmarPassword ? 'text' : 'password'}
                              minLength={8}
                              placeholder="Repite la nueva contraseña"
                              value={perfilForm.confirmar_password}
                              onChange={(e) => setPerfilForm({...perfilForm, confirmar_password: e.target.value})}
                            />
                            <button
                              type="button"
                              className="password-eye-btn"
                              onClick={() => setMostrarConfirmarPassword((prev) => !prev)}
                              aria-label={mostrarConfirmarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                              <AppIcon name={mostrarConfirmarPassword ? 'eyeOff' : 'eye'} size={18} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost" onClick={() => setIsEditingProfile(false)} disabled={savingProfile}>
                          Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={handleGuardarPerfil} disabled={savingProfile}>
                          {savingProfile ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Información personal
                      </div>

                      <div className="perfil-fields">
                        <div className="perfil-field">
                          <div className="perfil-field-label">Nombre completo</div>
                          <div className="perfil-field-value">{nombreCompleto}</div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Correo institucional</div>
                          <div className="perfil-field-value">{usuarioInfo.correo || user.correo}</div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Número de teléfono</div>
                          <div className="perfil-field-value">{usuarioInfo.telefono || '—'}</div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Matrícula</div>
                          <div className="perfil-field-value">{estudianteInfo.matricula || '—'}</div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Carrera</div>
                          <div className="perfil-field-value">{estudianteInfo.carrera || '—'}</div>
                        </div>
                        <div className="perfil-field"><div className="perfil-field-label">Perfil objetivo</div><div className="perfil-field-value">{estudianteInfo.titulo_profesional || '—'}</div></div>
                        <div className="perfil-field"><div className="perfil-field-label">Habilidades técnicas</div><div className="perfil-field-value">{estudianteInfo.competencias || '—'}</div></div>
                        <div className="perfil-field"><div className="perfil-field-label">Disponibilidad</div><div className="perfil-field-value">{estudianteInfo.disponibilidad || '—'}</div></div>
                        <div className="perfil-field"><div className="perfil-field-label">Modalidad</div><div className="perfil-field-value">{estudianteInfo.modalidad_preferida || '—'}</div></div>
                        <div className="perfil-field"><div className="perfil-field-label">Idiomas</div><div className="perfil-field-value">{estudianteInfo.idiomas || '—'}</div></div>
                        <div className="perfil-field"><div className="perfil-field-label">Ciudad</div><div className="perfil-field-value">{estudianteInfo.ciudad || '—'}</div></div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Cuatrimestre actual</div>
                          <div className="perfil-field-value">{estudianteInfo.estado_academico === 'egresado' ? 'Egresado' : (cuatrimestreActual ? `${cuatrimestreActual}°` : '—')}</div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Año estimado de ingreso</div>
                          <div className="perfil-field-value">{anioIngresoEstimado}</div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Inicio estimado de carrera</div>
                          <div className="perfil-field-value">
                            {fechaInicioEstimadaCarrera ? formatFechaLarga(fechaInicioEstimadaCarrera) : '—'}
                            <small className="perfil-field-note">Calculado con tu cuatrimestre actual.</small>
                          </div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Fecha registrada</div>
                          <div className="perfil-field-value">{estudianteInfo.fecha_inicio_carrera ? formatFecha(estudianteInfo.fecha_inicio_carrera) : '—'}</div>
                        </div>
                        <div className="perfil-field">
                          <div className="perfil-field-label">Estado académico</div>
                          <div className="perfil-field-value">{estadoAcademico}</div>
                        </div>
                      </div>

                      <div className="professional-profile-card">
                        <div className="professional-profile-card__head">
                          <div><span>PERFIL PROFESIONAL</span><h3>{estudianteInfo.titulo_profesional || 'Completa tu perfil profesional'}</h3></div>
                          <button className="btn btn-ghost" onClick={iniciarEdicionPerfil}><AppIcon name="edit" size={16} /> Editar</button>
                        </div>
                        <p>{estudianteInfo.biografia || 'Agrega una breve descripción de tus intereses, fortalezas y el tipo de oportunidad que buscas.'}</p>
                        <div className="professional-profile-links">
                          {estudianteInfo.linkedin && <a href={estudianteInfo.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
                          {estudianteInfo.github && <a href={estudianteInfo.github} target="_blank" rel="noreferrer">GitHub ↗</a>}
                          {estudianteInfo.portafolio && <a href={estudianteInfo.portafolio} target="_blank" rel="noreferrer">Portafolio ↗</a>}
                          {!estudianteInfo.linkedin && !estudianteInfo.github && !estudianteInfo.portafolio && <span>Agrega LinkedIn, GitHub o portafolio para fortalecer tu perfil.</span>}
                        </div>
                      </div>

                      <div className="danger-zone">
                        <div>
                          <div className="danger-title">Dar de baja mi cuenta</div>
                          <div className="danger-text">Esta opción desactiva tu acceso si ya no continúas en la carrera. No se borra el historial académico.</div>
                        </div>
                        <button className="btn btn-danger" onClick={handleEliminarCuenta}>
                          Desactivar cuenta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function DocsTable({ evidencias, onEliminar }) {
  return (
    <div className="docs-table-wrap">
      <div className="docs-table-hdr" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 100px' }}>
        <div>Archivo</div>
        <div>Proyecto</div>
        <div>Fecha</div>
        <div>Acciones</div>
      </div>

      {evidencias.map((ev) => (
        <div className="docs-table-row" key={ev.id_evidencia} style={{ gridTemplateColumns: '1.5fr 1fr 1fr 100px' }}>
          <div>
            <div className="doc-nombre">
              {ev.nombre_original || ev.ruta_archivo?.split('/').pop()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
              <a
                href={getFileSource(ev.ruta_archivo)}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--primary)' }}
              >
                Ver archivo
              </a>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {ev.proyecto_titulo}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {formatFecha(ev.fecha_subida)}
          </div>
          <div>
            <button
              className="btn btn-danger"
              style={{ fontSize: '12px', padding: '7px 14px' }}
              onClick={() => onEliminar(ev.id_evidencia)}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
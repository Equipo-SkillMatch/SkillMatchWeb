import { useEffect, useState } from 'react';
import { API_BASE, buildFileUrl } from '../config/api';
import { showToast, confirmDialog, promptDialog } from './InstitutionalUI';
import '../CSS/FlujoOficialEstadia.css';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function api(path, options = {}) {
  const headers = { ...authHeaders(), ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}/estadias${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({ ok: false, mensaje: 'Respuesta inválida' }));
  if (!res.ok || data.ok === false) throw new Error(data.mensaje || 'No se pudo completar la operación.');
  return data;
}

const human = (value) => String(value || 'pendiente').replaceAll('_', ' ');
const statusClass = (value) => {
  const x = String(value || '').toLowerCase();
  if (['aprobado', 'validado', 'firmado_validado', 'terminada', 'activo'].some(k => x.includes(k))) return 'good';
  if (['rechaz', 'correccion'].some(k => x.includes(k))) return 'bad';
  if (['revision', 'generado', 'programada'].some(k => x.includes(k))) return 'warn';
  return 'pending';
};
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

function Status({ value }) {
  return <span className={`fo-status ${statusClass(value)}`}>{human(value)}</span>;
}
function Field({ label, children, full = false }) {
  return <label className={full ? 'full' : ''}><span>{label}</span>{children}</label>;
}

const officialFields = [
  ['empresa_razon_social', 'Razón social'], ['empresa_rfc', 'RFC'],
  ['empresa_domicilio', 'Domicilio'], ['empresa_colonia', 'Colonia o referencia'],
  ['empresa_pais', 'País'], ['empresa_codigo_postal', 'Código postal'],
  ['empresa_telefono', 'Teléfono'], ['empresa_tamano', 'Tamaño de empresa'],
  ['empresa_sector', 'Sector'], ['empresa_giro', 'Giro'],
  ['empresa_tipo', 'Tipo de empresa'], ['empresa_origen', 'Empresa nacional / extranjera'],
  ['empresa_inversion_nacional', '% inversión nacional'], ['empresa_inversion_extranjera', '% inversión extranjera'],
  ['empresa_pais_inversion', 'Origen de la inversión (país)'],
  ['asesor_org_nombre', 'Asesor de la organización · nombre'], ['asesor_org_puesto', 'Asesor de la organización · puesto'],
  ['asesor_org_telefono', 'Asesor de la organización · teléfono'], ['asesor_org_correo', 'Asesor de la organización · correo'],
  ['contacto_carta_nombre', 'Contacto para carta · nombre'], ['contacto_carta_puesto', 'Contacto para carta · puesto'],
  ['contacto_carta_telefono', 'Contacto para carta · teléfono'], ['contacto_carta_correo', 'Contacto para carta · correo'],
  ['proyecto_area', 'Área de trabajo'], ['proyecto_titulo', 'Nombre del proyecto'],
  ['proyecto_ambito', 'Ámbito de desarrollo'], ['proyecto_competencia_impacto', 'Competencia a la que impacta'],
  ['proyecto_objetivo_general', 'Objetivo del proyecto'], ['proyecto_actividades', 'Actividades del proyecto']
];
const longFields = new Set(['empresa_domicilio', 'proyecto_competencia_impacto', 'proyecto_objetivo_general', 'proyecto_actividades']);
const textAreaFields = new Set(['proyecto_competencia_impacto', 'proyecto_objetivo_general', 'proyecto_actividades']);

export default function FlujoOficialEstadia({ role }) {
  const [busy, setBusy] = useState(true);
  const [board, setBoard] = useState([]);
  const [student, setStudent] = useState({ contexto: null, estadia: null });
  const [form, setForm] = useState({ proyecto_titulo: '', empresa_rfc: '', empresa_razon_social: '' });
  const [empresa, setEmpresa] = useState(null);
  const [manualEmpresa, setManualEmpresa] = useState(false);
  const [dias, setDias] = useState(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
  const [entrada, setEntrada] = useState('08:00');
  const [salida, setSalida] = useState('17:00');
  const [comps, setComps] = useState([]);
  const [numeroSeguro, setNumeroSeguro] = useState('');
  const [queue, setQueue] = useState([]);
  const [titleQueue, setTitleQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [official, setOfficial] = useState(null);
  const [docs, setDocs] = useState([]);
  const [mail, setMail] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [adminForm, setAdminForm] = useState({
    nombre: '', apellido: '', correo: '', password: 'SkillMatch123', id_carrera: '', telefono: '',
    cargo_institucional: 'Administrador de Estadías', area_institucional: '', extension: '', oficina: ''
  });

  const toast = (message, type = 'success') => showToast(message, { type });

  async function load() {
    setBusy(true);
    try {
      if (role === 2) {
        const [ctx, mi, co] = await Promise.all([
          api('/registro/contexto'), api('/mi-estadia'), api('/mi-estadia/comprobantes-inicio').catch(() => ({ comprobantes: [] }))
        ]);
        setStudent({ contexto: ctx.contexto, estadia: mi.estadia });
        setComps(co.comprobantes || []);
        if (mi.estadia) {
          setForm({
            proyecto_titulo: mi.estadia.proyecto_titulo || '',
            empresa_rfc: mi.estadia.empresa_rfc || '',
            empresa_razon_social: mi.estadia.empresa_razon_social || ''
          });
        }
      } else if (role === 6) {
        const [initial, title] = await Promise.all([
          api('/servicios/comprobantes-inicio'),
          api('/aprobaciones-oficiales?area=pago_titulo').catch(() => ({ validaciones: [] }))
        ]);
        setQueue(initial.comprobantes || []);
        setTitleQueue(title.validaciones || []);
      } else {
        const b = await api('/tablero-oficial');
        setBoard(b.filas || []);
        if (role === 1) {
          const a = await api('/administradores-estadia');
          setAdmins(a.administradores || []);
          setCarreras(a.carreras || []);
        }
      }
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [role]);

  async function buscarRFC() {
    const rfc = form.empresa_rfc.trim().toUpperCase();
    if (rfc.length < 8) return toast('Escribe un RFC válido para buscar.', 'warning');
    try {
      const result = await api(`/empresas/buscar?q=${encodeURIComponent(rfc)}`);
      const exact = (result.coincidencias || []).find(x => String(x.rfc || '').trim().toUpperCase() === rfc) || result.empresa;
      if (exact) {
        setEmpresa(exact);
        setManualEmpresa(false);
        setForm(f => ({ ...f, empresa_razon_social: exact.razon_social || '' }));
        toast('Empresa encontrada en SkillMatch.');
      } else {
        setEmpresa(null);
        setManualEmpresa(true);
        setForm(f => ({ ...f, empresa_razon_social: '' }));
        toast('RFC no encontrado. Escribe el nombre de la empresa.', 'warning');
      }
    } catch (error) { toast(error.message, 'error'); }
  }

  async function saveInitial(event) {
    event.preventDefault();
    if (!dias.length) return toast('Selecciona al menos un día laboral.', 'warning');
    try {
      const result = await api('/mi-estadia', {
        method: 'POST',
        body: JSON.stringify({ ...form, horario_laboral: `${dias.join(', ')} | ${entrada} - ${salida}` })
      });
      toast(result.empresa_en_directorio ? 'Registro inicial guardado; la empresa fue localizada.' : 'Registro inicial guardado; el asesor completará la empresa.');
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function uploadComp(tipo, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('archivo', file);
    if (tipo === 'seguro_facultativo' && numeroSeguro) fd.append('numero_seguro', numeroSeguro);
    try {
      await api(`/mi-estadia/comprobantes-inicio/${tipo}`, { method: 'POST', body: fd });
      toast('Comprobante enviado a Servicios Escolares.');
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function resolveComp(item, estado) {
    let observaciones = '';
    if (estado !== 'aprobado') {
      observaciones = await promptDialog({
        title: estado === 'rechazado' ? 'Rechazar comprobante' : 'Solicitar corrección',
        label: 'Observaciones', multiline: true, required: true, confirmText: 'Guardar'
      });
      if (observaciones === null) return;
    }
    try {
      await api(`/servicios/comprobantes-inicio/${item.id_comprobante}`, {
        method: 'PUT', body: JSON.stringify({ estado, observaciones })
      });
      toast('Comprobante actualizado.');
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function resolveArea(id, area, estado = 'aprobado') {
    let observaciones = '';
    if (estado !== 'aprobado') {
      observaciones = await promptDialog({ title: 'Observaciones', label: 'Motivo / correcciones', multiline: true, required: true, confirmText: 'Guardar' });
      if (observaciones === null) return;
    }
    try {
      await api(`/aprobaciones-oficiales/${id}`, { method: 'PUT', body: JSON.stringify({ area, estado, observaciones }) });
      toast('Aprobación actualizada.');
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function confirmTitleData() {
    const yes = await confirmDialog({
      title: 'Confirmar datos para título',
      message: 'Confirma que tu nombre y datos personales están escritos correctamente para los documentos de titulación.',
      confirmText: 'Sí, mis datos son correctos'
    });
    if (!yes) return;
    try {
      await api('/cierre/datos-alumno', { method: 'PUT', body: JSON.stringify({}) });
      toast('Datos confirmados.');
    } catch (error) { toast(error.message, 'error'); }
  }

  async function uploadTitlePayment(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('archivo', file);
    try {
      await api('/cierre/pago-titulo', { method: 'POST', body: fd });
      toast('Pago de título enviado a Servicios Escolares.');
    } catch (error) { toast(error.message, 'error'); }
  }

  async function openOfficial(row) {
    try {
      const project = await api(`/profesor/estadias/${row.id_estadia}/proyecto-oficial`);
      const documentData = await api(`/estadias/${row.id_estadia}/documento-oficial`);
      setSelected(row);
      setOfficial({ ...project.expediente });
      setDocs(documentData.documentos || []);
    } catch (error) { toast(error.message, 'error'); }
  }

  async function saveOfficial() {
    try {
      await api(`/profesor/estadias/${selected.id_estadia}/proyecto-oficial`, { method: 'PUT', body: JSON.stringify(official) });
      toast('Expediente oficial guardado.');
      await openOfficial(selected);
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function requestFinalApprovals() {
    try {
      const result = await api(`/profesor/estadias/${selected.id_estadia}/solicitar-aprobaciones-finales`, { method: 'POST', body: '{}' });
      toast(result.mensaje);
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function authorizeFormalStart() {
    try {
      await api(`/estadias/${selected.id_estadia}/inicio-formal`, {
        method: 'PUT',
        body: JSON.stringify({ autorizado: true, fecha_inicio_real: official.periodo_inicio || null, observaciones: 'Inicio formal autorizado desde el expediente oficial.' })
      });
      toast('Inicio formal autorizado. Se habilitó la primera evaluación de empresa.');
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  const docState = tipo => docs.find(d => d.tipo === tipo)?.estado || 'no_generado';
  const signedDoc = tipo => docs.find(d => d.tipo === tipo)?.ruta_firmado || null;

  async function genDoc(tipo) {
    try {
      await api(`/estadias/${selected.id_estadia}/documentos/${tipo}/generar`, { method: 'POST', body: '{}' });
      const result = await api(`/estadias/${selected.id_estadia}/documento-oficial`);
      setDocs(result.documentos || []);
      printDoc(tipo, result.datos);
      toast('Documento generado y listo para imprimir.');
    } catch (error) { toast(error.message, 'error'); }
  }

  async function uploadSigned(tipo, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('archivo', file);
    try {
      await api(`/estadias/${selected.id_estadia}/documentos/${tipo}/firmado`, { method: 'POST', body: fd });
      toast('Documento firmado guardado.');
      await openOfficial(selected);
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function prepareMail() {
    try {
      const result = await api(`/estadias/${selected.id_estadia}/preparar-correo`, { method: 'POST', body: JSON.stringify(mail) });
      toast(result.mensaje, 'warning');
      setMail(null);
    } catch (error) { toast(error.message, 'error'); }
  }

  async function saveAdmin(event) {
    event.preventDefault();
    try {
      await api('/administradores-estadia', { method: 'POST', body: JSON.stringify(adminForm) });
      toast('Administrador guardado.');
      setAdminForm({ nombre: '', apellido: '', correo: '', password: 'SkillMatch123', id_carrera: '', telefono: '', cargo_institucional: 'Administrador de Estadías', area_institucional: '', extension: '', oficina: '' });
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function toggleAdmin(item) {
    try {
      await api(`/administradores-estadia/${item.id_usuario}/estado`, { method: 'PUT', body: JSON.stringify({ activo: !item.activo }) });
      toast('Estado actualizado.');
      await load();
    } catch (error) { toast(error.message, 'error'); }
  }

  function printDoc(tipo, d) {
    const fechaLarga = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    const alumno = `${d.alumno_nombre || ''} ${d.alumno_apellido || ''}`.trim();
    const autoridad = `${d.super_nombre || ''} ${d.super_apellido || ''}`.trim();
    const logoUteq = `${window.location.origin}/logos/uteq-logo.png`;
    const logoSkill = `${window.location.origin}/logos/skillmatch-logo.png`;
    const formatDate = value => value ? new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : 'por definir';
    const formatTime = value => value ? new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—';
    const validationName = area => d.validaciones?.find(v => v.area === area && v.estado === 'aprobado')?.responsable_nombre || 'Pendiente de firma';
    const finalCompany = d.evaluaciones_empresa?.find(e => e.momento === 'final');
    const jurado = Array.isArray(d.jurado) ? d.jurado : [];
    let title = '';
    let code = 'EA-F-00';
    let body = '';

    const signatures = items => `<div class="signs">${items.map(item => `<div class="sign"><div class="line"></div><b>${esc(item.name || 'PENDIENTE')}</b><span>${esc(item.role || '')}</span></div>`).join('')}</div>`;

    if (tipo === 'carta_inicio') {
      title = 'CARTA DE CONFIRMACIÓN DE ESTADÍA PROFESIONAL';
      code = 'EA-F-01';
      body = `
        <div class="letter-date">Santiago de Querétaro, Qro., a ${esc(fechaLarga)}<br><b>Oficio no. ${esc(`EST/${d.matricula || d.id_estadia}/${new Date().getFullYear()}`)}</b></div>
        <div class="recipient"><b>${esc((d.contacto_carta_nombre || d.asesor_org_nombre || 'RESPONSABLE DE LA ORGANIZACIÓN').toUpperCase())}</b><br>${esc((d.contacto_carta_puesto || '').toUpperCase())}<br>${esc((d.empresa_razon_social || '').toUpperCase())}<br><b>P R E S E N T E</b></div>
        <h1>${title}</h1>
        <p>Por este conducto, se presenta a <b>${esc(alumno.toUpperCase())}</b>, matrícula <b>${esc(d.matricula)}</b>, estudiante de la carrera de <b>${esc(d.carrera_nombre)}</b>, quien realizará su <b>Estadía Profesional</b> en <b>${esc(d.empresa_razon_social)}</b> durante el periodo comprendido del <b>${esc(formatDate(d.periodo_inicio))}</b> al <b>${esc(formatDate(d.periodo_fin))}</b>, con el horario laboral registrado de <b>${esc(d.horario_laboral || 'por definir')}</b>.</p>
        <p>El proyecto de estadía se denomina <b>“${esc(d.proyecto_titulo)}”</b> y se desarrollará en el área de <b>${esc(d.proyecto_area || 'por definir')}</b>. El objetivo registrado es: ${esc(d.proyecto_objetivo_general || 'por definir')}.</p>
        <p>Se hace constar que el alumno cuenta con Seguro Facultativo registrado bajo el número <b>${esc(d.numero_seguro || 'por definir')}</b>. La presente carta formaliza el inicio de la Estadía Profesional una vez que sea firmada por las partes involucradas y la versión firmada sea incorporada al expediente.</p>
        <p>Agradecemos de antemano la atención y facilidades brindadas para el desarrollo profesional del estudiante.</p>
        ${signatures([
          {name: autoridad || d.asesor_nombre, role: d.super_cargo || 'Autoridad académica'},
          {name: d.asesor_org_nombre, role: 'Asesor de la empresa'},
          {name: alumno, role: 'Alumno'}
        ])}`;
    } else if (tipo === 'carta_finalizacion') {
      title = 'CARTA DE FINALIZACIÓN Y LIBERACIÓN DE ESTADÍA';
      code = 'EA-F-02';
      body = `
        <div class="letter-date">Santiago de Querétaro, Qro., a ${esc(fechaLarga)}</div>
        <h1>${title}</h1>
        <p>Por medio de la presente se hace constar que el alumno <b>${esc(alumno.toUpperCase())}</b>, matrícula <b>${esc(d.matricula)}</b>, de la carrera de <b>${esc(d.carrera_nombre)}</b>, concluyó el proceso académico y documental correspondiente a su Estadía Profesional denominada <b>“${esc(d.proyecto_titulo)}”</b>, realizada en <b>${esc(d.empresa_razon_social)}</b>.</p>
        <p>El expediente cuenta con las liberaciones institucionales requeridas para continuar con el proceso de presentación de memoria y toma de protesta.</p>
        <table class="approval-table"><tr><th>Área</th><th>Responsable / liberación</th></tr>
          <tr><td>Asesor de empresa</td><td>${esc(d.asesor_org_nombre || 'Pendiente')}</td></tr>
          <tr><td>Profesor asesor</td><td>${esc(d.asesor_nombre || 'Pendiente')}</td></tr>
          <tr><td>Biblioteca</td><td>${esc(validationName('biblioteca'))}</td></tr>
          <tr><td>Laboratorios</td><td>${esc(validationName('laboratorios'))}</td></tr>
          <tr><td>Dirección</td><td>${esc(validationName('direccion') || autoridad)}</td></tr>
        </table>
        ${signatures([
          {name:d.asesor_org_nombre,role:'Asesor de la empresa'},
          {name:d.asesor_nombre,role:'Profesor asesor'},
          {name:validationName('biblioteca'),role:'Biblioteca'},
          {name:validationName('laboratorios'),role:'Laboratorios'},
          {name:validationName('direccion') || autoridad,role:d.super_cargo || 'Director de División'}
        ])}`;
    } else if (tipo === 'autorizacion_memoria') {
      title = 'AUTORIZACIÓN DE PRESENTACIÓN DE MEMORIA';
      code = 'EA-F-03';
      body = `
        <div class="letter-date">Querétaro, Qro., a ${esc(fechaLarga)}<br><br>Matrícula ${esc(d.matricula)}</div>
        <div class="recipient"><b>C. ${esc(alumno.toUpperCase())}</b><br>Candidato al grado correspondiente a ${esc(d.carrera_nombre)}<br><b>P r e s e n t e</b></div>
        <h1>${title}</h1>
        <p>Se informa a usted que se autoriza la presentación de la memoria de su Estadía Profesional, titulada <b>“${esc((d.proyecto_titulo || '').toUpperCase())}”</b>, realizada en la organización <b>${esc((d.empresa_razon_social || '').toUpperCase())}</b>.</p>
        <p>Trabajo revisado y liberado dentro del proceso institucional por el Comité de Asesores y las áreas correspondientes:</p>
        ${signatures([
          {name:d.asesor_org_nombre,role:'Asesor de la empresa'},
          {name:d.asesor_nombre,role:'Profesor asesor'},
          {name:validationName('biblioteca'),role:'Biblioteca UTEQ'},
          {name:validationName('laboratorios'),role:'Laboratorios UTEQ'}
        ])}
        <div class="director-sign">${signatures([{name:validationName('direccion') !== 'Pendiente de firma' ? validationName('direccion') : autoridad,role:d.super_cargo || 'Director de la División'}])}</div>`;
    } else if (tipo === 'acta_toma_protesta') {
      title = 'ACTA DE TOMA DE PROTESTA';
      code = 'EA-F-44';
      const tomaDate = d.toma?.fecha_hora ? formatDate(d.toma.fecha_hora) : 'fecha programada';
      const tomaTime = d.toma?.fecha_hora ? formatTime(d.toma.fecha_hora) : 'hora programada';
      body = `
        <h1 class="acta-title">${title}</h1>
        <p>En la <b>Universidad Tecnológica de Querétaro</b>, ubicada en la ciudad de Querétaro, Qro., siendo las <b>${esc(tomaTime)}</b> horas del día <b>${esc(tomaDate)}</b>, se reunieron los ciudadanos:</p>
        <table class="jury"><tr><th>NOMBRES</th><th>FIRMAS</th></tr>${[0,1,2].map(i=>`<tr><td>${esc((jurado[i]?.nombre || `PROFESOR EVALUADOR ${i+1}`).toUpperCase())}</td><td><span class="signature-line"></span></td></tr>`).join('')}</table>
        <p>Quienes procederán a dar fe de la entrega y presentación de la Memoria de Estadía Profesional del alumno:</p>
        <h2 class="student-name">${esc(alumno.toUpperCase())}</h2>
        <p>en virtud de haber cumplido satisfactoriamente con los requisitos institucionales correspondientes al proceso de Estadía Profesional.</p>
        <p>Por lo que queda facultado(a) para ejercer la carrera de:</p><h2 class="career">${esc(d.carrera_nombre)}</h2>
        <p>A continuación se tomó la protesta de Ley en los términos siguientes:</p>
        <p class="oath"><b>¿PROTESTA USTED EJERCER SU PROFESIÓN CON ENTUSIASMO Y HONRADEZ, PREPARARSE DE FORMA PERMANENTE EN LA CIENCIA, LA TÉCNICA Y LO HUMANO, REPRESENTAR SIEMPRE DE MANERA DIGNA A LA UNIVERSIDAD Y SERVIR CON INTEGRIDAD, INTELIGENCIA, VOLUNTAD Y AMOR A SU PATRIA?</b></p>
        <p class="yes">SÍ, PROTESTO</p>
        ${signatures([{name:alumno,role:'Nombre y firma del alumno'}])}
        <p class="closing"><b>SI ASÍ LO HICIERE, QUE LA UNIVERSIDAD Y LA NACIÓN SE LO PREMIEN; Y SI NO, SE LO DEMANDEN.</b></p>`;
    } else {
      title = 'ACTA FINAL DE ESTADÍA';
      code = 'EA-F-05';
      const juryAvg = jurado.length ? (jurado.reduce((sum,j)=>sum+Number(j.calificacion||0),0)/jurado.length).toFixed(2) : '—';
      body = `
        <h1>${title}</h1>
        <div class="info"><b>Alumno</b><span>${esc(alumno)}</span><b>Matrícula</b><span>${esc(d.matricula)}</span><b>Carrera</b><span>${esc(d.carrera_nombre)}</span><b>Grupo</b><span>${esc(d.grupo_nombre)}</span><b>Periodo</b><span>${esc(d.periodo_nombre)}</span><b>Proyecto</b><span>${esc(d.proyecto_titulo)}</span><b>Empresa</b><span>${esc(d.empresa_razon_social)}</span><b>Tutor académico</b><span>${esc(d.asesor_nombre)}</span></div>
        <h2 class="section-title">RESULTADOS ACADÉMICOS</h2>
        <table class="approval-table"><tr><th>Evaluación</th><th>Resultado</th></tr>
          <tr><td>Profesor asesor / promedio de talleres</td><td>${esc(d.calificacion_asesor ?? '—')}</td></tr>
          <tr><td>Evaluación final de empresa</td><td>${esc(finalCompany?.promedio ?? '—')} ${esc(finalCompany?.codigo_final ? `(${finalCompany.codigo_final})` : '')}</td></tr>
          ${jurado.map(j=>`<tr><td>Evaluador ${esc(j.orden)} · ${esc(j.nombre)}</td><td>${esc(j.calificacion ?? '—')} · ${esc(j.decision || 'evaluado')}</td></tr>`).join('')}
          <tr><td><b>Promedio del jurado</b></td><td><b>${esc(juryAvg)}</b></td></tr>
        </table>
        <h2 class="section-title">RESULTADO</h2><p>Se hace constar que el alumno concluyó satisfactoriamente su proceso de Estadía Profesional y toma de protesta conforme a los registros de su expediente institucional.</p>
        ${signatures([{name:alumno,role:'Alumno'},{name:d.asesor_nombre,role:'Tutor académico'},{name:autoridad,role:d.super_cargo || 'Control escolar / Dirección'}])}`;
    }

    const win = window.open('', '_blank');
    if (!win) return toast('El navegador bloqueó la ventana de impresión.', 'warning');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:letter;margin:15mm 16mm 17mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;font-size:10.7pt;line-height:1.42;margin:0;background:#fff}
      .institution-head{display:grid;grid-template-columns:105px 1fr 105px;align-items:center;border-bottom:2px solid #27364c;padding-bottom:9px;margin-bottom:18px}.institution-head img{max-width:84px;max-height:67px;object-fit:contain}.institution-head img:last-child{justify-self:end;max-width:92px}.institution-title{text-align:center}.institution-title strong{display:block;font-size:13pt;letter-spacing:.3px}.institution-title span{display:block;font-size:8.5pt;margin-top:4px;color:#536174}.format-code{text-align:right;font-size:7.7pt;line-height:1.25;margin-top:-8px;margin-bottom:14px;color:#333}
      h1{text-align:center;font-size:13.5pt;margin:23px 0 22px;letter-spacing:.15px}h1.acta-title{font-family:Georgia,serif;font-size:22pt;margin:32px 0}.letter-date{text-align:right;margin-bottom:28px}.recipient{margin:24px 0;line-height:1.35}p{text-align:justify;margin:12px 0}.info{display:grid;grid-template-columns:155px 1fr;gap:7px 14px;margin:22px 0}.section-title{font-size:11pt;margin:24px 0 10px}.approval-table{width:100%;border-collapse:collapse;margin:18px 0}.approval-table th,.approval-table td{border:1px solid #b8c1cc;padding:8px;text-align:left}.approval-table th{background:#f2f5f8}.signs{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:25px;margin-top:58px;text-align:center;page-break-inside:avoid}.sign .line{border-top:1px solid #222;height:8px}.sign b,.sign span{display:block;font-size:8.8pt}.sign span{margin-top:3px}.director-sign{max-width:340px;margin:18px auto 0}.jury{width:100%;border-collapse:collapse;margin:20px 0 48px}.jury th{font-weight:normal;padding:5px}.jury td{padding:9px 18px}.jury td:first-child{width:62%}.signature-line{display:block;border-bottom:1px solid #333;height:22px}.student-name,.career{text-align:center;text-decoration:underline;font-size:12pt;margin:18px 0}.oath{font-size:10.5pt;line-height:1.55;margin-top:24px}.yes{text-align:center;font-size:12pt;margin:25px 0}.closing{text-align:center;margin-top:28px}.footer{position:fixed;bottom:-9mm;left:0;right:0;border-top:1px solid #9ba6b2;padding-top:4px;font-size:7.5pt;color:#657181;display:flex;justify-content:space-between}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><div class="institution-head"><img src="${logoUteq}"><div class="institution-title"><strong>UNIVERSIDAD TECNOLÓGICA DE QUERÉTARO</strong><span>Proceso de Estadías Profesionales · SkillMatch</span></div><img src="${logoSkill}"></div><div class="format-code"><b>${esc(code)}</b><br>Rev. 01<br>Generado: ${esc(fechaLarga)}</div>${body}<div class="footer"><span>Documento generado automáticamente desde el expediente institucional SkillMatch</span><span>Matrícula ${esc(d.matricula || '')}</span></div><script>setTimeout(()=>window.print(),700)<\/script></body></html>`);
    win.document.close();
  }

  if (busy) return <div className="fo-loading">Cargando flujo oficial…</div>;

  if (role === 2) {
    return <StudentView
      student={student} form={form} setForm={setForm} empresa={empresa} manualEmpresa={manualEmpresa}
      buscarRFC={buscarRFC} saveInitial={saveInitial} dias={dias} setDias={setDias} entrada={entrada} setEntrada={setEntrada}
      salida={salida} setSalida={setSalida} comps={comps} numeroSeguro={numeroSeguro} setNumeroSeguro={setNumeroSeguro}
      uploadComp={uploadComp} confirmTitleData={confirmTitleData} uploadTitlePayment={uploadTitlePayment}
    />;
  }

  if (role === 6) {
    return <ServicesView queue={queue} titleQueue={titleQueue} resolveComp={resolveComp} resolveArea={resolveArea} />;
  }

  return <BoardView
    role={role} board={board} resolveArea={resolveArea} openOfficial={openOfficial}
    admins={admins} carreras={carreras} adminForm={adminForm} setAdminForm={setAdminForm} saveAdmin={saveAdmin} toggleAdmin={toggleAdmin}
    selected={selected} setSelected={setSelected} official={official} setOfficial={setOfficial} saveOfficial={saveOfficial}
    requestFinalApprovals={requestFinalApprovals} docs={docs} docState={docState} signedDoc={signedDoc} genDoc={genDoc}
    uploadSigned={uploadSigned} mail={mail} setMail={setMail} prepareMail={prepareMail} authorizeFormalStart={authorizeFormalStart}
  />;
}

function StudentView(props) {
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const { student, form, setForm, empresa, manualEmpresa, buscarRFC, saveInitial, dias, setDias, entrada, setEntrada, salida, setSalida, comps, numeroSeguro, setNumeroSeguro, uploadComp, confirmTitleData, uploadTitlePayment } = props;
  return <div className="fo-wrap">
    <div className="fo-hero"><span>PASO 1 · REGISTRO INICIAL</span><h2>Comienza tu estadía</h2><p>Solo necesitas registrar el proyecto, buscar la empresa por RFC y capturar tu horario laboral.</p></div>
    {!student.contexto ? <div className="fo-card"><h3>Aún no tienes un grupo de estadía asignado</h3><p>El administrador debe agregarte a un grupo antes de iniciar.</p></div> : <>
      <div className="fo-card">
        <div className="fo-card-title"><div><small>{student.contexto.grupo_nombre} · {student.contexto.periodo_nombre}</small><h3>Datos iniciales</h3></div>{student.estadia && <Status value="registrado" />}</div>
        <form className="fo-form" onSubmit={saveInitial}>
          <Field label="Nombre del proyecto" full><input value={form.proyecto_titulo} onChange={e => setForm({ ...form, proyecto_titulo: e.target.value })} required /></Field>
          <Field label="RFC de la empresa"><div className="fo-inline"><input value={form.empresa_rfc} onChange={e => setForm({ ...form, empresa_rfc: e.target.value.toUpperCase() })} required /><button type="button" onClick={buscarRFC}>Buscar RFC</button></div></Field>
          <Field label="Empresa"><input value={form.empresa_razon_social} readOnly={Boolean(empresa)} onChange={e => setForm({ ...form, empresa_razon_social: e.target.value })} placeholder={manualEmpresa ? 'Escribe el nombre de la empresa' : 'Busca primero por RFC'} />{empresa && <small className="fo-found">✓ Empresa encontrada: {empresa.razon_social}</small>}</Field>
          <div className="full"><span className="fo-label">Horario laboral</span><div className="fo-days">{days.map(day => <button type="button" key={day} className={dias.includes(day) ? 'active' : ''} onClick={() => setDias(v => v.includes(day) ? v.filter(x => x !== day) : [...v, day])}>{day.slice(0, 3)}</button>)}</div><div className="fo-times"><input type="time" value={entrada} onChange={e => setEntrada(e.target.value)} /><span>a</span><input type="time" value={salida} onChange={e => setSalida(e.target.value)} /></div></div>
          <button className="fo-primary">Guardar registro inicial</button>
        </form>
      </div>
      {student.estadia && <>
        <div className="fo-card"><div className="fo-card-title"><div><small>PASO 2 · SERVICIOS ESCOLARES</small><h3>Comprobantes previos</h3></div><span>{comps.filter(x => x.estado === 'aprobado').length}/3 aprobados</span></div><div className="fo-doc-grid">
          <DocUploadCard tipo="cuatrimestre" nombre="Pago del cuatrimestre" comps={comps} uploadComp={uploadComp} />
          <DocUploadCard tipo="seguro_facultativo" nombre="Seguro facultativo" comps={comps} uploadComp={uploadComp} extra={<input placeholder="Número de seguro facultativo" value={numeroSeguro} onChange={e => setNumeroSeguro(e.target.value)} />} />
          <DocUploadCard tipo="inscripcion" nombre="Comprobante de inscripción" comps={comps} uploadComp={uploadComp} />
        </div></div>
        <div className="fo-card"><div className="fo-card-title"><div><small>CIERRE · TITULACIÓN</small><h3>Datos y pago de título</h3></div></div><div className="fo-doc-grid"><div className="fo-doc"><strong>Visto bueno de datos personales</strong><p>Cuando llegues a este paso confirma que tu nombre y datos estén correctos para los documentos oficiales.</p><button className="fo-primary" onClick={confirmTitleData}>Confirmar mis datos</button></div><div className="fo-doc"><strong>Pago de título</strong><p>Sube el comprobante cuando Servicios Escolares habilite esta etapa.</p><label className="fo-upload">Subir comprobante<input type="file" accept="application/pdf,image/*" onChange={e => uploadTitlePayment(e.target.files?.[0])} /></label></div></div></div>
      </>}
    </>}
  </div>;
}

function DocUploadCard({ tipo, nombre, comps, uploadComp, extra = null }) {
  const item = comps.find(x => x.tipo === tipo);
  return <div className="fo-doc"><strong>{nombre}</strong><Status value={item?.estado || 'pendiente'} />{item?.observaciones && <p>{item.observaciones}</p>}{item?.ruta_archivo && <a href={buildFileUrl(item.ruta_archivo)} target="_blank" rel="noreferrer">Ver comprobante</a>}{extra}<label className="fo-upload">{item ? 'Reemplazar archivo' : 'Subir archivo'}<input type="file" accept="application/pdf,image/*" onChange={e => uploadComp(tipo, e.target.files?.[0])} /></label></div>;
}

function ServicesView({ queue, titleQueue, resolveComp, resolveArea }) {
  return <div className="fo-wrap"><div className="fo-hero"><span>SERVICIOS ESCOLARES</span><h2>Validación documental</h2><p>Aprueba los comprobantes que desbloquean el inicio formal y, al final del proceso, el pago de titulación.</p></div>
    <div className="fo-card"><h3>Comprobantes de inicio</h3><div className="fo-table-wrap"><table className="fo-table"><thead><tr><th>Alumno</th><th>Grupo</th><th>Documento</th><th>Estado</th><th>Archivo</th><th>Acciones</th></tr></thead><tbody>{queue.map(item => <tr key={item.id_comprobante}><td><b>{item.nombre} {item.apellido}</b><small>{item.matricula}</small></td><td>{item.grupo_nombre}</td><td>{human(item.tipo)}</td><td><Status value={item.estado} /></td><td><a href={buildFileUrl(item.ruta_archivo)} target="_blank" rel="noreferrer">Abrir</a></td><td><div className="fo-actions"><button onClick={() => resolveComp(item, 'aprobado')}>Aprobar</button><button onClick={() => resolveComp(item, 'requiere_correccion')}>Corrección</button><button className="danger" onClick={() => resolveComp(item, 'rechazado')}>Rechazar</button></div></td></tr>)}</tbody></table></div></div>
    <div className="fo-card"><h3>Pago de título</h3><div className="fo-table-wrap"><table className="fo-table"><thead><tr><th>Alumno</th><th>Grupo</th><th>Estado</th><th>Comprobante</th><th>Acciones</th></tr></thead><tbody>{titleQueue.map(item => <tr key={item.id_validacion}><td><b>{item.nombre} {item.apellido}</b><small>{item.matricula}</small></td><td>{item.grupo_nombre}</td><td><Status value={item.estado} /></td><td>{item.ruta_archivo ? <a href={buildFileUrl(item.ruta_archivo)} target="_blank" rel="noreferrer">Abrir</a> : '—'}</td><td><div className="fo-actions"><button onClick={() => resolveArea(item.id_validacion, 'pago_titulo', 'aprobado')}>Aprobar</button><button onClick={() => resolveArea(item.id_validacion, 'pago_titulo', 'requiere_correccion')}>Corrección</button><button className="danger" onClick={() => resolveArea(item.id_validacion, 'pago_titulo', 'rechazado')}>Rechazar</button></div></td></tr>)}</tbody></table></div></div>
  </div>;
}

function BoardView(props) {
  const { role, board, resolveArea, openOfficial, admins, carreras, adminForm, setAdminForm, saveAdmin, toggleAdmin, selected, setSelected, official, setOfficial, saveOfficial, requestFinalApprovals, docs, docState, signedDoc, genDoc, uploadSigned, mail, setMail, prepareMail, authorizeFormalStart } = props;
  return <div className="fo-wrap">
    <div className="fo-hero"><span>FLUJO OFICIAL DE ESTADÍAS</span><h2>{role === 4 ? 'Expedientes de mis alumnos' : role === 5 ? 'Aprobación de Vinculación' : 'Control institucional'}</h2><p>Seguimiento automático basado en los requisitos oficiales. Cada columna se actualiza cuando el responsable aprueba su paso.</p></div>
    {role === 1 && <AdminManager admins={admins} carreras={carreras} form={adminForm} setForm={setAdminForm} save={saveAdmin} toggle={toggleAdmin} />}
    <div className="fo-card"><div className="fo-table-wrap"><table className="fo-table green"><thead><tr><th>Alumno</th><th>Grupo</th><th>Docs inicio</th><th>Expediente</th><th>Carta inicio</th><th>Inicio formal</th><th>Eval. empresa 1</th><th>Talleres</th><th>Eval. empresa 2</th><th>Memoria</th><th>Biblioteca</th><th>Labs</th><th>Empresa</th><th>Donativo</th><th>Inglés</th><th>Dirección</th><th>Vinculación</th><th>Datos título</th><th>Pago título</th><th>Carta final</th><th>Autorización memoria</th><th>Toma</th><th></th></tr></thead><tbody>{board.map(row => <tr key={row.id_estadia}><td><b>{row.nombre} {row.apellido}</b><small>{row.matricula}</small></td><td>{row.grupo_nombre}</td><td><Status value={Number(row.comprobantes_inicio_aprobados) >= 3 ? 'aprobado' : `${row.comprobantes_inicio_aprobados}/3`} /></td><td><Status value={row.datos_oficiales_completos ? 'aprobado' : 'pendiente'} /></td><td><Status value={row.carta_inicio_estado} /></td><td><Status value={row.inicio_formal ? 'aprobado' : 'pendiente'} /></td><td><Status value={row.evaluacion_empresa_inicial} /></td><td><Status value={Number(row.talleres_aprobados) >= 3 ? 'aprobado' : `${row.talleres_aprobados}/3`} /></td><td><Status value={row.evaluacion_empresa_final} /></td><td><Status value={row.memoria_final_ruta ? 'aprobado' : 'pendiente'} /></td><td><Status value={row.biblioteca} /></td><td><Status value={row.laboratorios} /></td><td><Status value={row.empresa_memoria} /></td><td><Status value={row.donativo} /></td><td><Status value={row.ingles} /></td><td><Status value={row.direccion} /></td><td><Status value={row.vinculacion} /></td><td><Status value={row.datos_alumno} /></td><td><Status value={row.pago_titulo} /></td><td><Status value={row.carta_final_estado} /></td><td><Status value={row.autorizacion_memoria_estado} /></td><td><Status value={row.toma_estado} /></td><td><div className="fo-actions">{role === 4 && <button className="fo-link" onClick={() => openOfficial(row)}>Expediente</button>}{role === 1 && row.direccion_id && row.direccion !== 'aprobado' && <button onClick={() => resolveArea(row.direccion_id, 'direccion')}>Aprobar Dirección</button>}{role === 5 && row.vinculacion_id && row.vinculacion !== 'aprobado' && <button onClick={() => resolveArea(row.vinculacion_id, 'vinculacion')}>Aprobar Vinculación</button>}</div></td></tr>)}</tbody></table></div></div>
    {selected && official && <OfficialModal selected={selected} setSelected={setSelected} official={official} setOfficial={setOfficial} saveOfficial={saveOfficial} requestFinalApprovals={requestFinalApprovals} docState={docState} signedDoc={signedDoc} genDoc={genDoc} uploadSigned={uploadSigned} setMail={setMail} authorizeFormalStart={authorizeFormalStart} />}
    {mail && <MailModal mail={mail} setMail={setMail} prepareMail={prepareMail} />}
  </div>;
}

function AdminManager({ admins, carreras, form, setForm, save, toggle }) {
  return <div className="fo-card"><div className="fo-card-title"><div><small>SÚPER ADMINISTRADOR</small><h3>Administradores de estadía</h3></div></div><form className="fo-form" onSubmit={save}><Field label="Nombre"><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></Field><Field label="Apellido"><input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} required /></Field><Field label="Correo institucional"><input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} required /></Field><Field label="Contraseña inicial"><input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field><Field label="Carrera asignada"><select value={form.id_carrera} onChange={e => setForm({ ...form, id_carrera: e.target.value, area_institucional: carreras.find(c => String(c.id_carrera) === String(e.target.value))?.nombre || '' })} required><option value="">Selecciona</option>{carreras.map(c => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre}</option>)}</select></Field><Field label="Teléfono"><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></Field><button className="fo-primary">Crear administrador</button></form><div className="fo-table-wrap" style={{ marginTop: 18 }}><table className="fo-table"><thead><tr><th>Administrador</th><th>Carrera</th><th>Cargo</th><th>Estado</th><th></th></tr></thead><tbody>{admins.map(item => <tr key={item.id_usuario}><td><b>{item.nombre} {item.apellido}</b><small>{item.correo}</small></td><td>{item.carrera || 'Todas'}</td><td>{item.cargo_institucional || 'Administrador de Estadías'}</td><td><Status value={item.activo ? 'activo' : 'inactivo'} /></td><td><button className="fo-link" onClick={() => toggle(item)}>{item.activo ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody></table></div></div>;
}

function OfficialModal({ selected, setSelected, official, setOfficial, saveOfficial, requestFinalApprovals, docState, signedDoc, genDoc, uploadSigned, setMail, authorizeFormalStart }) {
  const documentTypes = [
    ['carta_inicio', 'Carta de inicio formal'], ['carta_finalizacion', 'Carta de finalización / liberación'],
    ['autorizacion_memoria', 'Autorización de presentación de memoria'], ['acta_toma_protesta', 'Acta de toma de protesta'], ['acta_final', 'Acta final de estadía']
  ];
  return <div className="fo-modal-bg" onClick={() => setSelected(null)}><div className="fo-modal" onClick={e => e.stopPropagation()}><div className="fo-modal-head"><div><small>{selected.matricula} · {selected.grupo_nombre}</small><h2>Expediente oficial del proyecto</h2><p>Campos basados en el formato oficial “Datos para registrar el proyecto de estadía”.</p></div><button onClick={() => setSelected(null)}>×</button></div><div className="fo-modal-body"><section className="fo-summary"><b>Alumno</b><span>{official.alumno_nombre} {official.alumno_apellido}</span><b>Matrícula</b><span>{official.matricula}</span><b>Correo</b><span>{official.alumno_correo}</span><b>Teléfono</b><span>{official.alumno_telefono || '—'}</span><b>Carrera</b><span>{official.carrera_nombre}</span><b>Horario</b><span>{official.horario_laboral || '—'}</span></section><div className="fo-official-form">{officialFields.map(([key, label]) => <Field key={key} label={label} full={longFields.has(key)}>{textAreaFields.has(key) ? <textarea value={official[key] || ''} onChange={e => setOfficial({ ...official, [key]: e.target.value })} /> : <input type={key.includes('inversion') ? 'number' : 'text'} value={official[key] ?? ''} onChange={e => setOfficial({ ...official, [key]: e.target.value })} />}</Field>)}<Field label="¿Proyecto de innovación / I+D?"><select value={String(Boolean(official.proyecto_innovacion))} onChange={e => setOfficial({ ...official, proyecto_innovacion: e.target.value === 'true' })}><option value="false">No</option><option value="true">Sí</option></select></Field><Field label="¿El alumno ya trabaja en la empresa?"><select value={String(Boolean(official.alumno_trabaja_empresa))} onChange={e => setOfficial({ ...official, alumno_trabaja_empresa: e.target.value === 'true' })}><option value="false">No</option><option value="true">Sí</option></select></Field></div><div className="fo-actions end"><button onClick={authorizeFormalStart}>Autorizar inicio formal</button><button onClick={requestFinalApprovals}>Solicitar Dirección / Vinculación</button><button className="fo-primary" onClick={saveOfficial}>Guardar expediente oficial</button></div><section className="fo-documents"><h3>Documentos oficiales</h3><p>SkillMatch llena los datos automáticamente. Se conserva el documento generado y la versión firmada.</p>{documentTypes.map(([tipo, nombre]) => <div className="fo-document-row" key={tipo}><div><strong>{nombre}</strong><Status value={docState(tipo)} />{signedDoc(tipo) && <a href={buildFileUrl(signedDoc(tipo))} target="_blank" rel="noreferrer">Ver firmado</a>}</div><div className="fo-actions"><button onClick={() => genDoc(tipo)}>Generar / imprimir</button><button onClick={() => setMail({ tipo: 'ENVIO_DOCUMENTO', para: official.contacto_carta_correo || official.asesor_org_correo || '', cc: official.alumno_correo || '', asunto: `${nombre} - ${official.alumno_nombre} ${official.alumno_apellido}`, mensaje: 'Se comparte el documento generado desde SkillMatch.', documento: tipo })}>Enviar por correo</button><label className="fo-small-upload">Subir firmado<input type="file" accept="application/pdf,image/*" onChange={e => uploadSigned(tipo, e.target.files?.[0])} /></label></div></div>)}</section></div></div></div>;
}

function MailModal({ mail, setMail, prepareMail }) {
  return <div className="fo-modal-bg" onClick={() => setMail(null)}><div className="fo-mail-modal" onClick={e => e.stopPropagation()}><h3>Enviar por correo</h3><p>La interfaz queda preparada; el proveedor SMTP/API se configurará después.</p><label>Para<input value={mail.para} onChange={e => setMail({ ...mail, para: e.target.value })} /></label><label>CC<input value={mail.cc || ''} onChange={e => setMail({ ...mail, cc: e.target.value })} /></label><label>Asunto<input value={mail.asunto} onChange={e => setMail({ ...mail, asunto: e.target.value })} /></label><label>Mensaje<textarea value={mail.mensaje} onChange={e => setMail({ ...mail, mensaje: e.target.value })} /></label><div className="fo-actions end"><button onClick={() => setMail(null)}>Cancelar</button><button className="fo-primary" onClick={prepareMail}>Preparar envío</button></div></div></div>;
}

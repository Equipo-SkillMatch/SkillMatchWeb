import { useEffect, useMemo, useState } from 'react';
import { API_BASE, buildFileUrl } from '../config/api';
import { showToast, confirmDialog } from './InstitutionalUI';
import AppIcon from './AppIcon';
import { jsPDF } from 'jspdf';

const labelArea={biblioteca:'Biblioteca',laboratorios:'Laboratorios',centro_idiomas:'Centro de Idiomas',servicios_escolares:'Servicios Escolares',empresa_memoria:'Empresa · Memoria técnica'};
const pretty=v=>String(v||'pendiente').replaceAll('_',' ');
const token=()=>localStorage.getItem('token');
const nivelNombre=n=>({NA:'No acreditado',CO:'Competente',CD:'Competente destacado',CA:'Competente autónomo'}[String(n?.codigo||'').toUpperCase()]||String(n?.nombre||''));
async function api(path,opts={}){const r=await fetch(`${API_BASE}/estadias${path}`,{...opts,headers:{Authorization:`Bearer ${token()}`,...(opts.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(opts.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo completar la operación.');return j;}
async function imageData(url){const r=await fetch(url);const b=await r.blob();return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(b);});}
function Badge({v}){const x=String(v||'pendiente').toLowerCase();const c=x.includes('aprob')||x.includes('termin')?'good':x.includes('rech')||x.includes('corre')?'bad':x.includes('revision')||x.includes('pend')?'warn':'neutral';return <span className={`status-chip ${c}`}>{pretty(v)}</span>}

const etapas=['biblioteca','laboratorios','centro_idiomas','servicios_escolares','empresa_memoria'];
const progreso=(cierre)=>{
  const p=cierre?.prerequisitos||{};
  const previos=[p.inicio_autorizado,p.seguro_estado==='validado',Number(p.avances_aprobados)>=3,p.evaluacion_empresa_final,p.memoria_final_autorizada&&p.memoria_final_ruta].filter(Boolean).length;
  const institucional=(cierre?.validaciones||[]).filter(v=>v.estado==='aprobado').length;
  const toma=cierre?.toma?.estado==='aprobada'?10:0;
  return Math.min(100,Math.round(previos*14+institucional*4+toma));
};
const pasoActual=(cierre)=>{
  const p=cierre?.prerequisitos||{};
  if(!p.inicio_autorizado)return 'Pendiente: autorización de inicio formal';
  if(p.seguro_estado!=='validado')return 'Pendiente: seguro facultativo';
  if(Number(p.avances_aprobados)<3)return `Pendiente: talleres aprobados (${p.avances_aprobados||0}/3)`;
  if(!p.evaluacion_empresa_final)return 'Pendiente: evaluación final de la empresa';
  if(!p.memoria_final_autorizada)return 'Pendiente: autorización de memoria por el asesor';
  if(!p.memoria_final_ruta)return 'Pendiente: subir la memoria técnica final';
  const by=Object.fromEntries((cierre?.validaciones||[]).map(v=>[v.area,v]));
  for(const a of etapas){if(by[a]?.estado!=='aprobado')return `${labelArea[a]}: ${pretty(by[a]?.estado||'pendiente')}`;}
  if(!cierre?.toma)return 'Pendiente: programar toma de protesta';
  if(cierre.toma.estado!=='aprobada')return `Toma de protesta: ${pretty(cierre.toma.estado)}`;
  return 'Estadía terminada';
};

export default function CierreEstadiaPanel({role,section='overview'}){
  const [loading,setLoading]=useState(true),[cierre,setCierre]=useState(null),[validaciones,setValidaciones]=useState([]),[cierresProfesor,setCierresProfesor]=useState([]),[tomas,setTomas]=useState([]);
  const [selected,setSelected]=useState(null),[observaciones,setObservaciones]=useState(''),[archivoIngles,setArchivoIngles]=useState(null),[archivoDonativo,setArchivoDonativo]=useState(null);
  const [profesores,setProfesores]=useState([]),[tomaForm,setTomaForm]=useState({id_estadia:'',fecha_hora:'',lugar:'',id_profesor_1:'',id_profesor_2:'',id_profesor_3:'',observaciones:''}),[evalForm,setEvalForm]=useState({id_toma:'',codigo_nivel:'',observaciones:''}),[niveles,setNiveles]=useState([]),[detalleProfesor,setDetalleProfesor]=useState(null),[enlacesJurado,setEnlacesJurado]=useState([]),[grupoHistorico,setGrupoHistorico]=useState('');

  const load=async()=>{setLoading(true);try{
    if(role===2){const j=await api('/cierre/mi');setCierre(j.cierre||null);}
    else if([6,7,8,9].includes(role)){const j=await api('/cierre/validaciones');setValidaciones(j.validaciones||[]);}
    else if(role===4){const [c,t,n]=await Promise.all([api('/profesor/cierres'),api('/profesor/tomas-protesta'),api('/niveles-evaluacion')]);setCierresProfesor(c.cierres||[]);setTomas(t.tomas||[]);setNiveles(n.niveles||[]);}
    else if(role===1){const j=await api('/cierre/overview');setValidaciones(j.cierres||[]);}
  }catch(e){showToast(e.message,{type:'error'});}finally{setLoading(false);}};
  useEffect(()=>{load();},[role]);

  const startClose=async()=>{if(!(await confirmDialog({title:'Iniciar cierre institucional',message:'Se enviará la memoria final a Biblioteca, Laboratorios y Empresa para revisión.',confirmText:'Enviar a validación'})))return;try{const j=await api('/cierre/solicitar',{method:'POST',body:'{}'});showToast(j.mensaje,{type:'success'});await load();}catch(e){showToast(e.message,{type:'error'});}};
  const upload=async(type,file)=>{if(!file)return showToast('Selecciona el archivo correspondiente.',{type:'warning'});const fd=new FormData();fd.append('archivo',file);try{const j=await api(`/cierre/${type}`,{method:'POST',body:fd});showToast(j.mensaje,{type:'success'});await load();}catch(e){showToast(e.message,{type:'error'});}};
  const resolve=async(v,estado)=>{try{await api(`/cierre/validaciones/${v.id_validacion}`,{method:'PUT',body:JSON.stringify({estado,observaciones})});showToast(`Validación ${estado}.`,{type:estado==='aprobado'?'success':'warning'});setSelected(null);setObservaciones('');await load();}catch(e){showToast(e.message,{type:'error'});}};
  const openSchedule=async(row)=>{try{const j=await api(`/profesor/estadias/${row.id_estadia}/evaluadores`);setProfesores(j.profesores||[]);setTomaForm({id_estadia:row.id_estadia,fecha_hora:'',lugar:'',id_profesor_1:'',id_profesor_2:'',id_profesor_3:'',observaciones:''});setSelected({type:'schedule',row});}catch(e){showToast(e.message,{type:'error'});}};
  const openProgress=async(row)=>{try{const j=await api(`/cierre/mi?id_estadia=${row.id_estadia}`);setDetalleProfesor(j.cierre);setSelected({type:'progress',row});}catch(e){showToast(e.message,{type:'error'});}};
  const generarEnlaceEmpresa=async(row)=>{try{const j=await api(`/profesor/estadias/${row.id_estadia}/enlace-memoria-empresa`,{method:'POST',body:'{}'});await navigator.clipboard.writeText(j.enlace);showToast('Enlace de revisión de memoria copiado. Puedes enviarlo a la empresa.',{type:'success'});}catch(e){showToast(e.message,{type:'error'});}};
  const pdfHeader=async(doc,titulo,subtitulo='')=>{
    doc.setFillColor(247,249,252);doc.rect(0,0,210,297,'F');
    doc.setFillColor(255,255,255);doc.roundedRect(8,8,194,281,3,3,'F');
    doc.setDrawColor(218,226,236);doc.roundedRect(8,8,194,281,3,3,'S');
    try{const [uteq,skill]=await Promise.all([imageData('/logos/uteq-logo.png'),imageData('/logos/skillmatch-logo.png')]);doc.addImage(uteq,'PNG',16,14,29,15,undefined,'FAST');doc.addImage(skill,'PNG',165,13,29,17,undefined,'FAST');}catch(_e){}
    doc.setTextColor(15,45,87);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(titulo,105,20,{align:'center',maxWidth:110});
    doc.setFont('helvetica','normal');doc.setTextColor(93,110,130);doc.setFontSize(8.5);if(subtitulo)doc.text(subtitulo,105,27,{align:'center',maxWidth:105});
    doc.setDrawColor(15,59,119);doc.setLineWidth(0.8);doc.line(16,34,194,34);
  };
  const pdfFooter=(doc,folio='')=>{doc.setDrawColor(218,226,236);doc.line(16,278,194,278);doc.setFont('helvetica','normal');doc.setTextColor(100,116,136);doc.setFontSize(7.5);doc.text('Universidad Tecnológica de Querétaro · SkillMatch',16,284);doc.text(folio||new Date().toLocaleDateString('es-MX'),194,284,{align:'right'});};
  const datosDoc=async(idEstadia)=>{const j=await api(`/profesor/estadias/${idEstadia}/documento-cierre`);return j.documento;};
  const descargarHojaPrevia=async(row)=>{try{
    const d=await datosDoc(row.id_estadia);const doc=new jsPDF();await pdfHeader(doc,'Hoja de liberación previa a toma de protesta','Documento institucional para firma del alumno, empresa y tutor académico');
    let y=47;doc.setFontSize(9.5);doc.setFillColor(246,249,252);doc.roundedRect(16,41,178,84,2,2,'F');const lines=[['Alumno',`${d.nombre} ${d.apellido}`],['Matrícula',d.matricula],['Grupo',d.grupo_nombre],['Carrera',d.carrera],['Periodo',d.periodo_nombre],['Proyecto',d.proyecto_titulo],['Empresa',d.empresa_razon_social],['Responsable empresa',d.responsable_nombre||'—'],['Tutor académico',d.tutor_nombre]];
    lines.forEach(([a,b])=>{doc.setFont('helvetica','bold');doc.text(`${a}:`,16,y);doc.setFont('helvetica','normal');doc.text(String(b||'—'),55,y,{maxWidth:135});y+=9;});
    y=137;doc.setFont('helvetica','bold');doc.setTextColor(15,59,119);doc.text('DECLARACIÓN DE LIBERACIÓN',16,y);y+=8;doc.setFont('helvetica','normal');doc.setTextColor(30,48,70);doc.setFillColor(248,251,255);doc.roundedRect(16,y-5,178,28,2,2,'F');doc.text('Las partes abajo firmantes manifiestan que la memoria técnica final fue revisada y que el alumno ha cumplido los requisitos para continuar al proceso de toma de protesta.',20,y+4,{maxWidth:170});
    y=205;[['Alumno',`${d.nombre} ${d.apellido}`],['Empresa',d.responsable_nombre||d.empresa_razon_social],['Tutor académico',d.tutor_nombre]].forEach(([rol,nombre],i)=>{const x=16+i*62;doc.setDrawColor(70,86,105);doc.line(x,218,x+52,218);doc.setFontSize(8);doc.setTextColor(70,86,105);doc.text(rol,x,224);doc.text(String(nombre||''),x,230,{maxWidth:52});});
    pdfFooter(doc,`Matrícula ${d.matricula} · ${new Date().toLocaleDateString('es-MX')}`);
    doc.save(`Hoja_Liberacion_${d.matricula}.pdf`);
    await api(`/profesor/estadias/${row.id_estadia}/hoja-previa-generada`,{method:'POST',body:'{}'});showToast('Hoja previa descargada. Ya puedes programar la toma de protesta.',{type:'success'});await load();
  }catch(e){showToast(e.message,{type:'error'});}};
  const descargarActaFinal=async(idEstadia)=>{try{
    const d=await datosDoc(idEstadia);if(d.toma?.estado!=='aprobada')return showToast('El acta final se habilita cuando los tres evaluadores aprueban la toma.',{type:'warning'});
    const doc=new jsPDF();await pdfHeader(doc,'Acta final de estadía','Documento oficial de conclusión y evaluación de estadía');let y=47;
    const info=[['Alumno',`${d.nombre} ${d.apellido}`],['Matrícula',d.matricula],['Carrera',d.carrera],['Grupo',d.grupo_nombre],['Periodo',d.periodo_nombre],['Proyecto',d.proyecto_titulo],['Empresa',d.empresa_razon_social],['Tutor',d.tutor_nombre]];
    doc.setFillColor(246,249,252);doc.roundedRect(16,41,178,78,2,2,'F');doc.setFontSize(9.5);info.forEach(([a,b])=>{doc.setFont('helvetica','bold');doc.text(`${a}:`,16,y);doc.setFont('helvetica','normal');doc.text(String(b||'—'),55,y,{maxWidth:135});y+=8;});
    y=130;doc.setFont('helvetica','bold');doc.setTextColor(15,59,119);doc.text('CALIFICACIONES',16,y);y+=8;doc.setFont('helvetica','normal');doc.text(`Profesor asesor / talleres: ${d.promedio_profesor??'—'}`,20,y);y+=7;doc.text(`Evaluación final de empresa: ${d.evaluacion_empresa?.promedio??'—'} ${d.evaluacion_empresa?.codigo_final?`(${d.evaluacion_empresa.codigo_final})`:''}`,20,y);y+=7;doc.text(`Memoria técnica por empresa: ${d.memoria_empresa?.calificacion_memoria_empresa??'—'}`,20,y);y+=10;
    (d.evaluadores||[]).forEach(e=>{doc.text(`Evaluador ${e.orden} · ${e.nombre}: ${e.calificacion??'—'} · ${e.decision||'pendiente'}`,20,y,{maxWidth:170});y+=8;});
    const vals=(d.evaluadores||[]).map(e=>Number(e.calificacion)).filter(Number.isFinite);if(vals.length){const prom=Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100;doc.setFont('helvetica','bold');doc.text(`Promedio del jurado: ${prom.toFixed(2)}`,20,y);y+=8;}
    y+=6;doc.setFont('helvetica','bold');doc.setTextColor(15,59,119);doc.text('RESULTADO',16,y);y+=8;doc.setFont('helvetica','normal');doc.text('Estadía concluida y toma de protesta aprobada por el jurado evaluador.',20,y,{maxWidth:170});y+=18;
    doc.setDrawColor(70,86,105);doc.line(20,y,75,y);doc.line(80,y,135,y);doc.line(140,y,195,y);doc.setFontSize(8);doc.setTextColor(70,86,105);doc.text('Alumno',20,y+6);doc.text('Tutor académico',80,y+6);doc.text('Control escolar / sello',140,y+6);pdfFooter(doc,`Acta ${d.matricula} · ${d.periodo_nombre}`);
    doc.save(`Acta_Final_Estadia_${d.matricula}.pdf`);
  }catch(e){showToast(e.message,{type:'error'});}};
  const verEnlacesJurado=async(row)=>{try{const j=await api(`/profesor/tomas-protesta/${row.id_toma}/enlaces`);setEnlacesJurado(j.enlaces||[]);setSelected({type:'links',row});}catch(e){showToast(e.message,{type:'error'});}};
  const saveSchedule=async()=>{try{
    if(!tomaForm.fecha_hora)return showToast('Selecciona la fecha y hora.',{type:'warning'});
    const f=new Date(tomaForm.fecha_hora);if([0,6].includes(f.getDay()))return showToast('La toma de protesta debe programarse de lunes a viernes.',{type:'warning'});
    if(!tomaForm.id_profesor_1||!tomaForm.id_profesor_2||!tomaForm.id_profesor_3)return showToast('Selecciona los tres profesores evaluadores.',{type:'warning'});
    await api(`/profesor/estadias/${tomaForm.id_estadia}/toma-protesta`,{method:'POST',body:JSON.stringify(tomaForm)});showToast('Toma de protesta programada con tres evaluadores.',{type:'success'});setSelected(null);await load();
  }catch(e){showToast(e.message,{type:'error'});}};
  const saveEval=async()=>{try{await api(`/profesor/tomas-protesta/${evalForm.id_toma}/evaluacion`,{method:'POST',body:JSON.stringify(evalForm)});showToast('Evaluación guardada.',{type:'success'});setSelected(null);await load();}catch(e){showToast(e.message,{type:'error'});}};

  const byArea=useMemo(()=>Object.fromEntries((cierre?.validaciones||[]).map(v=>[v.area,v])),[cierre]);
  if(loading)return <div className="panel"><div className="loading-state">Cargando cierre de estadía…</div></div>;

  if(role===2){
    const pre=cierre?.prerequisitos;if(!cierre)return <div className="panel"><h2>Cierre de estadía</h2><p>Aún no existe una estadía activa para iniciar el proceso de cierre.</p></div>;
    const initialSent=Boolean(byArea.biblioteca||byArea.laboratorios||byArea.empresa_memoria),initialRejected=['biblioteca','laboratorios','empresa_memoria'].some(a=>['rechazado','requiere_correccion'].includes(byArea[a]?.estado));
    if(pre?.estado_estadia==='terminada'||cierre?.toma?.estado==='aprobada') return <div className="completion-shell"><div className="completion-card"><div className="completion-mark"><AppIcon name="check"/></div><span className="eyebrow">ESTADÍA CONCLUIDA</span><h2>¡Felicidades, terminaste tu estadía!</h2><p>Tu expediente quedó cerrado al 100% y el acta final está disponible como comprobante oficial de conclusión.</p><div className="completion-actions"><button className="primary-btn" onClick={()=>descargarActaFinal(pre.id_estadia)}>Imprimir / descargar acta final</button></div></div></div>;
    const libLabOk=['biblioteca','laboratorios'].every(a=>byArea[a]?.estado==='aprobado'),idiomasOk=byArea.centro_idiomas?.estado==='aprobado',don=byArea.servicios_escolares;

    if(section==='idiomas') return <div className="closure-layout">
      <div className="panel service-student-card"><div className="section-title"><div><span>CENTRO DE IDIOMAS</span><h2>Certificado / examen de inglés</h2></div></div>
        <div className="service-status-row"><div><strong>Estado de validación</strong><small>Sube tu certificado, constancia o evidencia del examen aprobado.</small></div><Badge v={byArea.centro_idiomas?.estado||'pendiente'}/></div>
        {byArea.centro_idiomas?.observaciones&&<div className="feedback-box"><b>Observaciones:</b> {byArea.centro_idiomas.observaciones}</div>}
        {!libLabOk?<div className="info-box compact"><AppIcon name="info"/><p>Primero deben aprobar tu memoria Biblioteca y Laboratorios.</p></div>:<>
          {byArea.centro_idiomas?.ruta_archivo&&<div className="document-card"><div><span>Documento enviado</span><strong>{byArea.centro_idiomas.nombre_archivo||'Evidencia de inglés'}</strong></div><a className="secondary-btn small" href={buildFileUrl(byArea.centro_idiomas.ruta_archivo)} target="_blank" rel="noreferrer">Abrir documento</a></div>}
          {byArea.centro_idiomas?.estado!=='aprobado'&&<div className="upload-panel"><label>Certificado o comprobante<input type="file" accept="image/*,.pdf" onChange={e=>setArchivoIngles(e.target.files?.[0]||null)}/></label><button className="primary-btn" onClick={()=>upload('ingles',archivoIngles)}>{byArea.centro_idiomas?.estado==='rechazado'?'Reenviar certificado':'Enviar a Centro de Idiomas'}</button></div>}
        </>}
      </div>
    </div>;

    if(section==='servicios') return <div className="closure-layout">
      <div className="panel service-student-card"><div className="section-title"><div><span>SERVICIOS ESCOLARES</span><h2>Donativo de cierre</h2></div></div>
        <div className="service-status-row"><div><strong>Estado del donativo</strong><small>Este paso se habilita después de la aprobación de Centro de Idiomas.</small></div><Badge v={don?.estado||'pendiente'}/></div>
        {don?.observaciones&&<div className="feedback-box"><b>Observaciones:</b> {don.observaciones}</div>}
        {idiomasOk&&don&&<div className="donation-box"><div><span>Referencia</span><strong>{don.referencia_donativo||'Pendiente'}</strong></div><div><span>Monto</span><strong>{Number(don.monto_donativo||0)>0?`$${Number(don.monto_donativo).toLocaleString('es-MX',{minimumFractionDigits:2})}`:'Por definir por Administración'}</strong></div></div>}
        {!idiomasOk?<div className="info-box compact"><AppIcon name="info"/><p>Centro de Idiomas debe aprobar tu certificado antes de habilitar el donativo.</p></div>:<>
          {don?.ruta_archivo&&<div className="document-card"><div><span>Comprobante enviado</span><strong>{don.nombre_archivo||'Comprobante de donativo'}</strong></div><a className="secondary-btn small" href={buildFileUrl(don.ruta_archivo)} target="_blank" rel="noreferrer">Abrir comprobante</a></div>}
          {don?.estado!=='aprobado'&&<div className="upload-panel"><label>Comprobante de donativo<input type="file" accept="image/*,.pdf" onChange={e=>setArchivoDonativo(e.target.files?.[0]||null)}/></label><button className="primary-btn" onClick={()=>upload('donativo',archivoDonativo)}>{don?.estado==='rechazado'?'Reenviar comprobante':'Enviar a Servicios Escolares'}</button></div>}
        </>}
      </div>
    </div>;

    return <div className="closure-layout">
      <div className="panel closure-hero"><div><span className="eyebrow">CIERRE INSTITUCIONAL</span><h2>Ruta para concluir tu estadía</h2><p>SkillMatch te indica qué está aprobado, qué está en revisión y cuál es tu siguiente paso.</p><strong className="current-step">{pasoActual(cierre)}</strong></div><div className="closure-percent"><strong>{progreso(cierre)}%</strong><span>avance total</span></div></div>
      <div className="panel"><h3>1. Requisitos académicos previos</h3><div className="closure-grid"><Check l="Inicio formal" ok={pre?.inicio_autorizado}/><Check l="Seguro facultativo" ok={pre?.seguro_estado==='validado'}/><Check l="3 talleres aprobados" ok={Number(pre?.avances_aprobados)>=3}/><Check l="Evaluación final de empresa" ok={pre?.evaluacion_empresa_final}/><Check l="Memoria autorizada y PDF cargado" ok={pre?.memoria_final_autorizada&&pre?.memoria_final_ruta}/></div>{pre?.memoria_final_ruta&&<div className="memory-current"><div><strong>Memoria técnica actual</strong><small>{pre.memoria_final_nombre||'PDF final'} · Versión {pre.memoria_final_version||1}</small></div><a className="secondary-btn small" href={buildFileUrl(pre.memoria_final_ruta)} target="_blank" rel="noreferrer">Abrir PDF</a></div>}{pre?.listo&&(!initialSent||initialRejected)&&<button className="primary-btn" onClick={startClose}>{initialSent?'Reenviar memoria corregida':'Iniciar cierre institucional'}</button>}</div>
      <div className="panel"><h3>2. Validaciones institucionales</h3><div className="closure-steps">{etapas.map((a,i)=><div className="closure-step" key={a}><div className="step-num">{i+1}</div><div><strong>{labelArea[a]}</strong><small>{a==='centro_idiomas'?'Examen aprobado de inglés':a==='servicios_escolares'?'Donativo y comprobante':a==='empresa_memoria'?'Memoria técnica + calificación empresarial':'Revisión de memoria técnica'}</small></div><Badge v={byArea[a]?.estado||'pendiente'}/>{byArea[a]?.calificacion_memoria_empresa!=null&&<strong className="step-grade">Calificación {byArea[a].calificacion_memoria_empresa}</strong>}{byArea[a]?.observaciones&&<p className="step-note">{byArea[a].observaciones}</p>}</div>)}</div>
        {byArea.empresa_memoria&&<div className="upload-line"><div><strong>Revisión de memoria por la empresa</strong><small style={{display:'block'}}>Tu asesor puede generar y compartir el enlace directo con la empresa. Si la empresa solicita cambios, podrás reemplazar el PDF desde Mis entregas.</small></div><Badge v={byArea.empresa_memoria.estado}/></div>}
        <div className="info-box compact"><AppIcon name="info"/><p>Los documentos de Centro de Idiomas y Servicios Escolares se cargan desde sus apartados del menú lateral. Aquí solo se muestra el avance general.</p></div>
      </div>
      <div className="panel"><h3>3. Toma de protesta</h3>{cierre.listo_toma?<>{cierre.toma?<><div className="detail-grid"><Detail l="Estado" v={pretty(cierre.toma.estado)}/><Detail l="Fecha y hora" v={cierre.toma.fecha_hora?new Date(cierre.toma.fecha_hora).toLocaleString('es-MX'):'Por definir'}/><Detail l="Lugar" v={cierre.toma.lugar}/>{(cierre.evaluadores||[]).map((e,i)=><Detail key={i} l={`Evaluador ${i+1}`} v={`${e.nombre}${e.calificacion!=null?` · ${e.calificacion} · ${pretty(e.decision||'pendiente')}`:''}`}/>)}</div>{cierre.toma.estado==='aprobada'&&<div className="action-row"><button className="primary-btn" onClick={()=>descargarActaFinal(pre.id_estadia)}>Descargar acta final de estadía</button></div>}</>:<p>Todos los requisitos están aprobados. Tu asesor generará la hoja previa y programará la toma de protesta.</p>}</>:<p>Esta etapa se habilita cuando todas las validaciones anteriores estén aprobadas.</p>}</div>
    </div>;
  }

  if([6,7,8,9].includes(role)){
    const areaActual={6:'servicios_escolares',7:'biblioteca',8:'laboratorios',9:'centro_idiomas'}[role];
    return <div className="panel"><div className="section-title"><div><span>VALIDACIÓN INSTITUCIONAL</span><h2>{labelArea[areaActual]}</h2></div></div><p className="muted">Solo aparecen los alumnos que requieren revisión de tu área.</p><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Proyecto</th><th>Memoria técnica</th><th>Documento del área</th><th>Estado</th><th></th></tr></thead><tbody>{validaciones.map(v=><tr key={v.id_validacion}><td><strong>{v.nombre} {v.apellido}</strong><small>{v.matricula} · {v.grupo_nombre}</small></td><td>{v.proyecto_titulo}</td><td>{v.memoria_final_ruta?<a href={buildFileUrl(v.memoria_final_ruta)} target="_blank" rel="noreferrer">Abrir memoria PDF</a>:'Sin memoria cargada'}</td><td>{v.area==='servicios_escolares'?<><small>Ref. {v.referencia_donativo||'—'} · {Number(v.monto_donativo||0)>0?`$${Number(v.monto_donativo).toLocaleString('es-MX',{minimumFractionDigits:2})}`:'Monto por definir'}</small>{v.ruta_archivo&&<a href={buildFileUrl(v.ruta_archivo)} target="_blank" rel="noreferrer">Abrir comprobante</a>}</>:v.ruta_archivo?<a href={buildFileUrl(v.ruta_archivo)} target="_blank" rel="noreferrer">Abrir evidencia</a>:<span className="muted">No aplica</span>}</td><td><Badge v={v.estado}/></td><td><button className="secondary-btn small" onClick={()=>{setSelected({type:'validation',row:v});setObservaciones(v.observaciones||'')}}>Revisar</button></td></tr>)}{!validaciones.length&&<tr><td colSpan="6">No hay solicitudes pendientes.</td></tr>}</tbody></table></div>{selected?.type==='validation'&&<Modal close={()=>setSelected(null)} title={`${selected.row.nombre} ${selected.row.apellido}`}><div className="validation-review-head"><div><span>PROYECTO</span><strong>{selected.row.proyecto_titulo}</strong><small>{selected.row.matricula} · {selected.row.grupo_nombre}</small></div><Badge v={selected.row.estado}/></div><div className="validation-doc-grid">{selected.row.memoria_final_ruta&&<div className="validation-doc-card"><AppIcon name="file"/><div><span>Memoria técnica final</span><strong>{selected.row.memoria_final_nombre||'PDF final'}</strong></div><a className="secondary-btn small" href={buildFileUrl(selected.row.memoria_final_ruta)} target="_blank" rel="noreferrer">Abrir</a></div>}{selected.row.ruta_archivo&&<div className="validation-doc-card"><AppIcon name="file"/><div><span>{selected.row.area==='servicios_escolares'?'Comprobante de donativo':'Documento del área'}</span><strong>{selected.row.nombre_archivo||'Documento enviado'}</strong></div><a className="secondary-btn small" href={buildFileUrl(selected.row.ruta_archivo)} target="_blank" rel="noreferrer">Abrir</a></div>}</div>{selected.row.area==='servicios_escolares'&&<div className="donation-box"><div><span>Referencia</span><strong>{selected.row.referencia_donativo||'—'}</strong></div><div><span>Monto</span><strong>{Number(selected.row.monto_donativo||0)>0?`$${Number(selected.row.monto_donativo).toLocaleString('es-MX',{minimumFractionDigits:2})}`:'Por definir'}</strong></div></div>}<label className="review-observations"><span>Observaciones para el alumno</span><textarea placeholder="Escribe aquí cualquier corrección, indicación o comentario." value={observaciones} onChange={e=>setObservaciones(e.target.value)}/></label><div className="validation-actions"><button className="primary-btn" onClick={()=>resolve(selected.row,'aprobado')}>Aprobar documento</button><button className="danger-btn" onClick={()=>resolve(selected.row,'rechazado')}>Rechazar y devolver</button></div></Modal>}</div>;
  }

  if(role===4&&section==='terminadas'){
    const terminadas=cierresProfesor.filter(r=>r.estado==='terminada'||r.toma_estado==='aprobada');
    const grupos=[...new Set(terminadas.map(r=>r.grupo_nombre).filter(Boolean))].sort();
    const filtradas=grupoHistorico?terminadas.filter(r=>r.grupo_nombre===grupoHistorico):terminadas;
    return <div className="closure-layout"><div className="panel"><div className="section-title"><div><span>HISTORIAL ACADÉMICO</span><h2>Estadías terminadas</h2></div></div><p className="muted">Consulta únicamente alumnos de tus grupos que ya concluyeron la estadía. El expediente queda en modo de consulta y el acta final permanece disponible.</p><div className="history-toolbar"><label>Filtrar por grupo<select value={grupoHistorico} onChange={e=>setGrupoHistorico(e.target.value)}><option value="">Todos los grupos</option>{grupos.map(g=><option key={g} value={g}>{g}</option>)}</select></label><strong>{filtradas.length} alumnos concluidos</strong></div><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Grupo</th><th>Periodo</th><th>Proyecto</th><th>Conclusión</th><th>Acta final</th></tr></thead><tbody>{filtradas.length?filtradas.map(r=><tr key={r.id_estadia}><td><strong>{r.nombre} {r.apellido}</strong><small>{r.matricula}</small></td><td>{r.grupo_nombre}</td><td>{r.periodo_nombre}</td><td>{r.proyecto_titulo||'—'}</td><td>{r.cierre_completado_en?new Date(r.cierre_completado_en).toLocaleDateString('es-MX'):'Concluida'}</td><td><button className="primary-btn small" onClick={()=>descargarActaFinal(r.id_estadia)}>Ver / imprimir acta</button></td></tr>):<tr><td colSpan="6"><div className="empty-history">Aún no hay estadías terminadas para este filtro.</div></td></tr>}</tbody></table></div></div></div>;
  }

  if(role===4) return <div className="closure-layout">
    <div className="panel">
      <div className="section-title"><div><span>ASESOR DE ESTADÍA</span><h2>Cierre y toma de protesta</h2></div></div>
      <div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Grupo</th><th>Validaciones</th><th>Hoja previa</th><th>Toma</th><th>Acciones</th></tr></thead><tbody>
        {cierresProfesor.filter(r=>r.estado!=='terminada'&&r.toma_estado!=='aprobada').map(r=>{const lista=Number(r.validaciones_aprobadas)>=5;const fechaLista=r.toma_fecha&&new Date(r.toma_fecha)<=new Date();return <tr key={r.id_estadia}>
          <td><strong>{r.nombre} {r.apellido}</strong><small>{r.matricula}</small></td><td>{r.grupo_nombre}</td><td>{r.validaciones_aprobadas||0}/5 aprobadas</td>
          <td><Badge v={r.hoja_previa_toma_generada_en?'generada':'pendiente'}/></td><td><Badge v={r.toma_estado||'sin programar'}/>{r.toma_fecha&&<small>{new Date(r.toma_fecha).toLocaleString('es-MX')}</small>}</td>
          <td><div className="action-row"><button className="secondary-btn small" onClick={()=>openProgress(r)}>Ver ruta</button>
            {lista&&<button className="secondary-btn small" onClick={()=>descargarHojaPrevia(r)}>{r.hoja_previa_toma_generada_en?'Descargar hoja previa':'Generar hoja previa'}</button>}
            {lista&&r.hoja_previa_toma_generada_en&&<button className="primary-btn small" onClick={()=>openSchedule(r)}>{r.id_toma?'Reprogramar':'Programar toma'}</button>}
            {r.id_toma&&fechaLista&&r.toma_estado!=='aprobada'&&<button className="secondary-btn small" onClick={()=>verEnlacesJurado(r)}>Enlaces jurado</button>}
            {r.toma_estado==='aprobada'&&<button className="primary-btn small" onClick={()=>descargarActaFinal(r.id_estadia)}>Acta final</button>}
          </div></td>
        </tr>})}
      </tbody></table></div>
    </div>
    <div className="panel"><h3>Mis participaciones como evaluador</h3><p className="muted">La evaluación formal se responde mediante el enlace individual generado por el asesor cuando llega la fecha programada.</p><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Fecha</th><th>Participación</th><th>Estado</th><th>Resultado</th></tr></thead><tbody>{tomas.map(t=><tr key={`${t.id_toma}-${t.participacion}`}><td>{t.nombre} {t.apellido}<small>{t.matricula}</small></td><td>{new Date(t.fecha_hora).toLocaleString('es-MX')}</td><td>{pretty(t.participacion)}</td><td><Badge v={t.estado}/></td><td>{t.mi_calificacion!=null?`${t.mi_calificacion} · ${pretty(t.mi_decision||'registrada')}`:'Pendiente'}</td></tr>)}</tbody></table></div></div>

    {selected?.type==='progress'&&detalleProfesor&&<Modal close={()=>{setSelected(null);setDetalleProfesor(null)}} title={`Ruta de ${selected.row.nombre} ${selected.row.apellido}`}><div className="progress-summary"><strong>{progreso(detalleProfesor)}%</strong><span>{pasoActual(detalleProfesor)}</span></div><h3>Requisitos previos</h3><div className="closure-grid"><Check l="Inicio formal" ok={detalleProfesor.prerequisitos?.inicio_autorizado}/><Check l="Seguro" ok={detalleProfesor.prerequisitos?.seguro_estado==='validado'}/><Check l="3 talleres" ok={Number(detalleProfesor.prerequisitos?.avances_aprobados)>=3}/><Check l="Evaluación empresa" ok={detalleProfesor.prerequisitos?.evaluacion_empresa_final}/><Check l="Memoria final" ok={detalleProfesor.prerequisitos?.memoria_final_ruta&&detalleProfesor.prerequisitos?.memoria_final_autorizada}/><Check l="Hoja previa" ok={detalleProfesor.prerequisitos?.hoja_previa_toma_generada_en}/></div><h3>Validaciones</h3><div className="closure-steps">{etapas.map((a,i)=>{const v=(detalleProfesor.validaciones||[]).find(x=>x.area===a);return <div className="closure-step" key={a}><div className="step-num">{i+1}</div><div><strong>{labelArea[a]}</strong><small>{v?.observaciones||'Sin observaciones'}</small></div><Badge v={v?.estado||'pendiente'}/></div>})}</div>{detalleProfesor.prerequisitos?.memoria_final_ruta&&<div className="action-row"><a className="secondary-btn" href={buildFileUrl(detalleProfesor.prerequisitos.memoria_final_ruta)} target="_blank" rel="noreferrer">Abrir memoria final</a><button className="primary-btn" onClick={()=>generarEnlaceEmpresa(selected.row)}>Generar / copiar enlace para empresa</button></div>}</Modal>}

    {selected?.type==='schedule'&&<Modal close={()=>setSelected(null)} title="Programar toma de protesta"><div className="info-box compact"><AppIcon name="info"/><p>Selecciona tres profesores evaluadores activos. La fecha debe ser de lunes a viernes. Los profesores se administran desde el módulo Administrador → Profesores.</p></div><div className="form-grid"><label>Fecha y hora<input type="datetime-local" value={tomaForm.fecha_hora} onChange={e=>setTomaForm({...tomaForm,fecha_hora:e.target.value})}/></label><label>Lugar<input value={tomaForm.lugar} onChange={e=>setTomaForm({...tomaForm,lugar:e.target.value})}/></label><label>Evaluador 1<select value={tomaForm.id_profesor_1} onChange={e=>setTomaForm({...tomaForm,id_profesor_1:e.target.value})}><option value="">Selecciona…</option>{profesores.map(p=><option key={p.id_profesor} value={p.id_profesor}>{p.nombre} {p.apellido} · {p.carrera||p.departamento||'Profesor'}</option>)}</select></label><label>Evaluador 2<select value={tomaForm.id_profesor_2} onChange={e=>setTomaForm({...tomaForm,id_profesor_2:e.target.value})}><option value="">Selecciona…</option>{profesores.filter(p=>String(p.id_profesor)!==String(tomaForm.id_profesor_1)).map(p=><option key={p.id_profesor} value={p.id_profesor}>{p.nombre} {p.apellido} · {p.carrera||p.departamento||'Profesor'}</option>)}</select></label><label>Evaluador 3<select value={tomaForm.id_profesor_3} onChange={e=>setTomaForm({...tomaForm,id_profesor_3:e.target.value})}><option value="">Selecciona…</option>{profesores.filter(p=>![String(tomaForm.id_profesor_1),String(tomaForm.id_profesor_2)].includes(String(p.id_profesor))).map(p=><option key={p.id_profesor} value={p.id_profesor}>{p.nombre} {p.apellido} · {p.carrera||p.departamento||'Profesor'}</option>)}</select></label><label className="full">Observaciones<textarea value={tomaForm.observaciones} onChange={e=>setTomaForm({...tomaForm,observaciones:e.target.value})}/></label></div><button className="primary-btn" onClick={saveSchedule}>Guardar programación</button></Modal>}

    {selected?.type==='links'&&<Modal close={()=>{setSelected(null);setEnlacesJurado([])}} title={`Enlaces de jurado · ${selected.row.nombre} ${selected.row.apellido}`}><div className="info-box compact"><AppIcon name="info"/><p>Cada profesor recibe un enlace individual. Al abrirlo podrá responder las 5 preguntas, asignar calificaciones y aprobar o rechazar la toma.</p></div><div className="closure-steps">{enlacesJurado.map(e=><div className="closure-step" key={e.id_profesor}><div className="step-num">{e.orden}</div><div><strong>{e.nombre}</strong><small>{e.enlace}</small></div><button className="secondary-btn small" onClick={async()=>{await navigator.clipboard.writeText(e.enlace);showToast(`Enlace de ${e.nombre} copiado.`,{type:'success'})}}>Copiar enlace</button></div>)}</div></Modal>}
  </div>;

  if(role===1) return <div className="panel"><div className="section-title"><div><span>ADMINISTRACIÓN</span><h2>Cierre institucional de estadías</h2></div></div><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Grupo</th><th>Validaciones</th><th>Toma de protesta</th><th>Estado</th></tr></thead><tbody>{validaciones.map(r=><tr key={r.id_estadia}><td><strong>{r.nombre} {r.apellido}</strong><small>{r.matricula}</small></td><td>{r.grupo_nombre}</td><td>{r.validaciones_aprobadas||0}/5</td><td>{r.toma_fecha?new Date(r.toma_fecha).toLocaleString():'No programada'}<br/><Badge v={r.toma_estado||'pendiente'}/></td><td><Badge v={r.estado}/></td></tr>)}</tbody></table></div></div>;
  return null;
}
function Check({l,ok}){return <div className={`closure-check ${ok?'ok':''}`}><AppIcon name={ok?'check':'clock'}/><span>{l}</span><strong>{ok?'Listo':'Pendiente'}</strong></div>}
function Detail({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v||'—'}</strong></div>}
function Modal({children,close,title}){return <div className="internship-modal-backdrop" onClick={close}><div className="internship-modal wide-modal formal-modal" onClick={e=>e.stopPropagation()}><div className="formal-modal-head"><div><span>SKILLMATCH · UTEQ</span><h2>{title}</h2><p>Gestión institucional de estadías</p></div><button className="modal-close" onClick={close}>×</button></div><div className="formal-modal-body">{children}</div></div></div>}

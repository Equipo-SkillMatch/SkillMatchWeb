import { useEffect, useMemo, useState } from 'react';
import { API_BASE, buildFileUrl } from '../config/api';
import { showToast, confirmDialog } from './InstitutionalUI';
import AppIcon from './AppIcon';

const labelArea={biblioteca:'Biblioteca',laboratorios:'Laboratorios',centro_idiomas:'Centro de Idiomas',servicios_escolares:'Servicios Escolares',empresa_memoria:'Empresa · Memoria técnica'};
const pretty=v=>String(v||'pendiente').replaceAll('_',' ');
const token=()=>localStorage.getItem('token');
async function api(path,opts={}){const r=await fetch(`${API_BASE}/estadias${path}`,{...opts,headers:{Authorization:`Bearer ${token()}`,...(opts.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(opts.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo completar la operación.');return j;}

function Badge({v}){const x=String(v||'pendiente').toLowerCase();const c=x.includes('aprob')||x.includes('termin')?'good':x.includes('rech')||x.includes('corre')?'bad':x.includes('revision')||x.includes('pend')?'warn':'neutral';return <span className={`status-chip ${c}`}>{pretty(v)}</span>}

export default function CierreEstadiaPanel({role}){
  const [loading,setLoading]=useState(true);
  const [cierre,setCierre]=useState(null);
  const [validaciones,setValidaciones]=useState([]);
  const [cierresProfesor,setCierresProfesor]=useState([]);
  const [tomas,setTomas]=useState([]);
  const [selected,setSelected]=useState(null);
  const [observaciones,setObservaciones]=useState('');
  const [archivoIngles,setArchivoIngles]=useState(null);
  const [archivoDonativo,setArchivoDonativo]=useState(null);
  const [profesores,setProfesores]=useState([]);
  const [tomaForm,setTomaForm]=useState({id_estadia:'',fecha_hora:'',lugar:'',id_profesor_1:'',id_profesor_2:'',observaciones:''});
  const [evalForm,setEvalForm]=useState({id_toma:'',codigo_nivel:'',observaciones:''});
  const [niveles,setNiveles]=useState([]);

  const load=async()=>{
    setLoading(true);
    try{
      if(role===2){const j=await api('/cierre/mi');setCierre(j.cierre||null);}
      else if([6,7,8,9].includes(role)){const j=await api('/cierre/validaciones');setValidaciones(j.validaciones||[]);}
      else if(role===4){const [c,t,n]=await Promise.all([api('/profesor/cierres'),api('/profesor/tomas-protesta'),api('/niveles-evaluacion')]);setCierresProfesor(c.cierres||[]);setTomas(t.tomas||[]);setNiveles(n.niveles||[]);}
      else if(role===1){const j=await api('/cierre/overview');setValidaciones(j.cierres||[]);}
    }catch(e){showToast(e.message,{type:'error'});}finally{setLoading(false);}
  };
  useEffect(()=>{load();},[role]);

  const startClose=async()=>{if(!(await confirmDialog({title:'Iniciar cierre institucional',message:'Se enviará la estadía a Biblioteca, Laboratorios y a la empresa para revisión de la memoria técnica.',confirmText:'Enviar a validación'})))return;try{const j=await api('/cierre/solicitar',{method:'POST',body:'{}'});showToast(j.mensaje,{type:'success'});await load();}catch(e){showToast(e.message,{type:'error'});}};
  const upload=async(type,file)=>{if(!file)return showToast('Selecciona el archivo correspondiente.',{type:'warning'});const fd=new FormData();fd.append('archivo',file);try{const j=await api(`/cierre/${type}`,{method:'POST',body:fd});showToast(j.mensaje,{type:'success'});await load();}catch(e){showToast(e.message,{type:'error'});}};
  const resolve=async(v,estado)=>{try{await api(`/cierre/validaciones/${v.id_validacion}`,{method:'PUT',body:JSON.stringify({estado,observaciones})});showToast(`Validación ${estado}.`,{type:estado==='aprobado'?'success':'warning'});setSelected(null);setObservaciones('');await load();}catch(e){showToast(e.message,{type:'error'});}};
  const openSchedule=async(row)=>{try{const j=await api(`/profesor/estadias/${row.id_estadia}/evaluadores`);setProfesores(j.profesores||[]);setTomaForm({id_estadia:row.id_estadia,fecha_hora:'',lugar:'',id_profesor_1:'',id_profesor_2:'',observaciones:''});setSelected({type:'schedule',row});}catch(e){showToast(e.message,{type:'error'});}};
  const saveSchedule=async()=>{try{await api(`/profesor/estadias/${tomaForm.id_estadia}/toma-protesta`,{method:'POST',body:JSON.stringify(tomaForm)});showToast('Toma de protesta programada.',{type:'success'});setSelected(null);await load();}catch(e){showToast(e.message,{type:'error'});}};
  const saveEval=async()=>{try{await api(`/profesor/tomas-protesta/${evalForm.id_toma}/evaluacion`,{method:'POST',body:JSON.stringify(evalForm)});showToast('Evaluación guardada.',{type:'success'});setSelected(null);await load();}catch(e){showToast(e.message,{type:'error'});}};

  const byArea=useMemo(()=>Object.fromEntries((cierre?.validaciones||[]).map(v=>[v.area,v])),[cierre]);
  if(loading)return <div className="panel"><div className="loading-state">Cargando cierre de estadía…</div></div>;

  if(role===2){
    const pre=cierre?.prerequisitos;
    if(!cierre)return <div className="panel"><h2>Cierre de estadía</h2><p>Aún no existe una estadía activa para iniciar el proceso de cierre.</p></div>;
    const initialSent=Boolean(byArea.biblioteca||byArea.laboratorios||byArea.empresa_memoria);
    const initialRejected=['biblioteca','laboratorios'].some(a=>byArea[a]?.estado==='rechazado');
    const libLabOk=['biblioteca','laboratorios'].every(a=>byArea[a]?.estado==='aprobado');
    const idiomasOk=byArea.centro_idiomas?.estado==='aprobado';
    return <div className="closure-layout">
      <div className="panel closure-hero"><div><span className="eyebrow">CIERRE INSTITUCIONAL</span><h2>Ruta para concluir tu estadía</h2><p>Completa cada validación en orden. SkillMatch habilitará automáticamente el siguiente paso.</p></div><div className="closure-percent"><strong>{cierre.toma?.estado==='aprobada'?'100%':`${Math.round(((cierre.validaciones||[]).filter(v=>v.estado==='aprobado').length/5)*80)}%`}</strong><span>avance de cierre</span></div></div>
      <div className="panel"><h3>1. Requisitos académicos previos</h3><div className="closure-grid">
        <Check l="Inicio formal" ok={pre?.inicio_autorizado}/><Check l="Seguro facultativo" ok={pre?.seguro_estado==='validado'}/><Check l="3 talleres aprobados" ok={Number(pre?.avances_aprobados)>=3}/><Check l="Evaluación final de empresa" ok={pre?.evaluacion_empresa_final}/><Check l="Memoria autorizada por asesor" ok={pre?.memoria_final_autorizada}/>
      </div>{pre?.listo&&(!initialSent||initialRejected)&&<button className="primary-btn" onClick={startClose}>{initialSent?'Reenviar cierre institucional':'Iniciar cierre institucional'}</button>}</div>
      <div className="panel"><h3>2. Validaciones institucionales</h3><div className="closure-steps">{['biblioteca','laboratorios','centro_idiomas','servicios_escolares','empresa_memoria'].map((a,i)=><div className="closure-step" key={a}><div className="step-num">{i+1}</div><div><strong>{labelArea[a]}</strong><small>{a==='centro_idiomas'?'Validación del examen aprobado de inglés':a==='servicios_escolares'?'Validación del comprobante de donativo':a==='empresa_memoria'?'Revisión de la memoria técnica para evitar información sensible':'Liberación institucional'}</small></div><Badge v={byArea[a]?.estado||'pendiente'}/>{byArea[a]?.observaciones&&<p className="step-note">{byArea[a].observaciones}</p>}</div>)}</div>
        {byArea.empresa_memoria?.token_publico&&<div className="upload-line"><div><strong>Enlace para aprobación de la memoria por la empresa</strong><small style={{display:'block'}}>Úsalo si la empresa no tiene cuenta SkillMatch.</small></div><button className="secondary-btn small" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/aprobacion-memoria/${byArea.empresa_memoria.token_publico}`);showToast('Enlace copiado.',{type:'success'})}}>Copiar enlace</button></div>}
        {libLabOk&&(!byArea.centro_idiomas||byArea.centro_idiomas.estado==='rechazado')&&<div className="upload-line"><label>Captura/comprobante del examen aprobado de inglés<input type="file" accept="image/*,.pdf" onChange={e=>setArchivoIngles(e.target.files?.[0]||null)}/></label><button className="primary-btn small" onClick={()=>upload('ingles',archivoIngles)}>Enviar al Centro de Idiomas</button></div>}
        {idiomasOk&&(!byArea.servicios_escolares||byArea.servicios_escolares.estado==='rechazado')&&<div className="upload-line"><label>Comprobante de donativo<input type="file" accept="image/*,.pdf" onChange={e=>setArchivoDonativo(e.target.files?.[0]||null)}/></label><button className="primary-btn small" onClick={()=>upload('donativo',archivoDonativo)}>Enviar a Servicios Escolares</button></div>}
      </div>
      <div className="panel"><h3>3. Toma de protesta</h3>{cierre.listo_toma?<>{cierre.toma?<div className="detail-grid"><Detail l="Estado" v={pretty(cierre.toma.estado)}/><Detail l="Fecha y hora" v={cierre.toma.fecha_hora?new Date(cierre.toma.fecha_hora).toLocaleString():'Por definir'}/><Detail l="Lugar" v={cierre.toma.lugar}/>{(cierre.evaluadores||[]).map((e,i)=><Detail key={i} l={`Evaluador ${i+1}`} v={`${e.nombre}${e.codigo_nivel?` · ${e.codigo_nivel} (${e.calificacion})`:''}`}/>)}</div>:<p>Todos los requisitos están aprobados. Tu asesor debe programar la toma de protesta.</p>}</>:<p>Esta etapa se habilita cuando todas las validaciones anteriores estén aprobadas.</p>}</div>
    </div>;
  }

  if([6,7,8,9].includes(role)) return <div className="panel"><div className="section-title"><div><span>VALIDACIÓN INSTITUCIONAL</span><h2>{labelArea[{6:'servicios_escolares',7:'biblioteca',8:'laboratorios',9:'centro_idiomas'}[role]]}</h2></div></div><p className="muted">Solo aparecen los alumnos que requieren revisión de tu área.</p><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Grupo</th><th>Proyecto</th><th>Archivo</th><th>Estado</th><th></th></tr></thead><tbody>{validaciones.map(v=><tr key={v.id_validacion}><td><strong>{v.nombre} {v.apellido}</strong><small>{v.matricula}</small></td><td>{v.grupo_nombre}</td><td>{v.proyecto_titulo}</td><td>{v.ruta_archivo?<a href={buildFileUrl(v.ruta_archivo)} target="_blank" rel="noreferrer">Abrir comprobante</a>:v.area==='biblioteca'||v.area==='laboratorios'?'Sin archivo requerido':'—'}</td><td><Badge v={v.estado}/></td><td><button className="secondary-btn small" onClick={()=>{setSelected({type:'validation',row:v});setObservaciones(v.observaciones||'')}}>Revisar</button></td></tr>)}{!validaciones.length&&<tr><td colSpan="6">No hay solicitudes pendientes.</td></tr>}</tbody></table></div>{selected?.type==='validation'&&<Modal close={()=>setSelected(null)} title={`${selected.row.nombre} ${selected.row.apellido}`}><p><b>Proyecto:</b> {selected.row.proyecto_titulo}</p><textarea placeholder="Observaciones para el alumno" value={observaciones} onChange={e=>setObservaciones(e.target.value)}/><div className="action-row"><button className="primary-btn" onClick={()=>resolve(selected.row,'aprobado')}>Aprobar</button><button className="danger-btn" onClick={()=>resolve(selected.row,'rechazado')}>Rechazar</button></div></Modal>}</div>;

  if(role===4) return <div className="closure-layout"><div className="panel"><div className="section-title"><div><span>ASESOR DE ESTADÍA</span><h2>Cierre y toma de protesta</h2></div></div><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Grupo</th><th>Validaciones</th><th>Toma</th><th></th></tr></thead><tbody>{cierresProfesor.map(r=><tr key={r.id_estadia}><td><strong>{r.nombre} {r.apellido}</strong><small>{r.matricula}</small></td><td>{r.grupo_nombre}</td><td>{r.validaciones_aprobadas||0}/5 aprobadas</td><td><Badge v={r.toma_estado||'sin programar'}/></td><td>{Number(r.validaciones_aprobadas)>=5?<button className="primary-btn small" onClick={()=>openSchedule(r)}>{r.id_toma?'Reprogramar':'Programar toma'}</button>:<span className="muted">Pendiente de liberaciones</span>}</td></tr>)}</tbody></table></div></div><div className="panel"><h3>Mis participaciones como evaluador</h3><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Fecha</th><th>Participación</th><th>Estado</th><th></th></tr></thead><tbody>{tomas.map(t=><tr key={t.id_toma}><td>{t.nombre} {t.apellido}<small>{t.matricula}</small></td><td>{new Date(t.fecha_hora).toLocaleString()}</td><td>{pretty(t.participacion)}</td><td><Badge v={t.estado}/></td><td>{t.participacion==='evaluador'&&!t.mi_codigo&&<button className="primary-btn small" onClick={()=>{setEvalForm({id_toma:t.id_toma,codigo_nivel:'',observaciones:''});setSelected({type:'eval',row:t})}}>Calificar</button>}</td></tr>)}</tbody></table></div></div>{selected?.type==='schedule'&&<Modal close={()=>setSelected(null)} title="Programar toma de protesta"><div className="form-grid"><label>Fecha y hora<input type="datetime-local" value={tomaForm.fecha_hora} onChange={e=>setTomaForm({...tomaForm,fecha_hora:e.target.value})}/></label><label>Lugar<input value={tomaForm.lugar} onChange={e=>setTomaForm({...tomaForm,lugar:e.target.value})}/></label><label>Evaluador 1<select value={tomaForm.id_profesor_1} onChange={e=>setTomaForm({...tomaForm,id_profesor_1:e.target.value})}><option value="">Selecciona…</option>{profesores.map(p=><option key={p.id_profesor} value={p.id_profesor}>{p.nombre} {p.apellido}</option>)}</select></label><label>Evaluador 2<select value={tomaForm.id_profesor_2} onChange={e=>setTomaForm({...tomaForm,id_profesor_2:e.target.value})}><option value="">Selecciona…</option>{profesores.filter(p=>String(p.id_profesor)!==String(tomaForm.id_profesor_1)).map(p=><option key={p.id_profesor} value={p.id_profesor}>{p.nombre} {p.apellido}</option>)}</select></label><label className="full">Observaciones<textarea value={tomaForm.observaciones} onChange={e=>setTomaForm({...tomaForm,observaciones:e.target.value})}/></label></div><button className="primary-btn" onClick={saveSchedule}>Guardar programación</button></Modal>}{selected?.type==='eval'&&<Modal close={()=>setSelected(null)} title={`Evaluar a ${selected.row.nombre} ${selected.row.apellido}`}><label>Nivel<select value={evalForm.codigo_nivel} onChange={e=>setEvalForm({...evalForm,codigo_nivel:e.target.value})}><option value="">Selecciona…</option>{niveles.map(n=><option key={n.codigo} value={n.codigo}>{n.codigo} · {n.nombre} ({n.valor})</option>)}</select></label><label>Observaciones<textarea value={evalForm.observaciones} onChange={e=>setEvalForm({...evalForm,observaciones:e.target.value})}/></label><button className="primary-btn" onClick={saveEval}>Guardar evaluación</button></Modal>}</div>;

  if(role===1) return <div className="panel"><div className="section-title"><div><span>ADMINISTRACIÓN</span><h2>Cierre institucional de estadías</h2></div></div><div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Grupo</th><th>Validaciones</th><th>Toma de protesta</th><th>Estado</th></tr></thead><tbody>{validaciones.map(r=><tr key={r.id_estadia}><td><strong>{r.nombre} {r.apellido}</strong><small>{r.matricula}</small></td><td>{r.grupo_nombre}</td><td>{r.validaciones_aprobadas||0}/5</td><td>{r.toma_fecha?new Date(r.toma_fecha).toLocaleString():'No programada'}<br/><Badge v={r.toma_estado||'pendiente'}/></td><td><Badge v={r.estado}/></td></tr>)}</tbody></table></div></div>;
  return null;
}

function Check({l,ok}){return <div className={`closure-check ${ok?'ok':''}`}><AppIcon name={ok?'check':'clock'}/><span>{l}</span><strong>{ok?'Listo':'Pendiente'}</strong></div>}
function Detail({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v||'—'}</strong></div>}
function Modal({children,close,title}){return <div className="internship-modal-backdrop" onClick={close}><div className="internship-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={close}>×</button><div className="section-title"><div><span>SKILLMATCH</span><h2>{title}</h2></div></div>{children}</div></div>}

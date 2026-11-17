import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from '../config/api';
import BrandLogo from '../components/BrandLogo';
import '../CSS/ModuloEstadias.css';

export default function TomaProtestaPublica(){
  const {token}=useParams();
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[done,setDone]=useState(false);
  const [respuestas,setRespuestas]=useState({}),[decision,setDecision]=useState(''),[observaciones,setObservaciones]=useState('');
  const [availabilityNote,setAvailabilityNote]=useState(''),[availabilityDone,setAvailabilityDone]=useState(false);

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const r=await fetch(`${API_BASE}/public/toma-protesta/${token}`);
      const j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo cargar la toma de protesta.');
      setData(j);
      const prev={};(j.respuestas||[]).forEach(x=>{prev[x.id_pregunta]=Number(x.calificacion)});setRespuestas(prev);
      setDecision(j.toma?.decision||'');setObservaciones(j.toma?.observaciones||'');
    }catch(e){setError(e.message)}finally{setLoading(false)}
  };
  useEffect(()=>{load();},[token]);

  const promedio=useMemo(()=>{
    const vals=Object.values(respuestas).map(Number).filter(Number.isFinite);
    return vals.length?Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100:0;
  },[respuestas]);

  const respondAvailability=async(decisionDate)=>{
    setError('');
    try{
      const r=await fetch(`${API_BASE}/public/toma-protesta/${token}/disponibilidad`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:decisionDate,observaciones:availabilityNote})});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo registrar la disponibilidad.');
      setAvailabilityDone(true);await load();
    }catch(e){setError(e.message)}
  };

  const send=async()=>{
    setError('');
    if(!data?.habilitada)return setError('La evaluación todavía no está habilitada.');
    if((data.preguntas||[]).some(q=>respuestas[q.id_pregunta]===undefined))return setError(`Debes calificar los ${(data.preguntas||[]).length} criterios de la memoria técnica.`);
    if(!decision)return setError('Selecciona Aprobar o Rechazar.');
    try{
      const payload={
        respuestas:data.preguntas.map(q=>({id_pregunta:q.id_pregunta,calificacion:Number(respuestas[q.id_pregunta])})),
        decision,observaciones
      };
      const r=await fetch(`${API_BASE}/public/toma-protesta/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo guardar la evaluación.');
      setDone(true);
    }catch(e){setError(e.message)}
  };

  if(loading)return <main className="public-eval-shell"><div className="public-eval-card">Cargando…</div></main>;
  return <main className="public-eval-shell"><section className="public-eval-card"><BrandLogo/>
    {error&&<div className="feedback-box" style={{marginTop:18}}>{error}</div>}
    {done?<div style={{padding:'40px 0',textAlign:'center'}}><h1>Evaluación registrada</h1><p>Tu dictamen fue guardado correctamente en SkillMatch.</p></div>:data&&<>
      <span className="eyebrow">TOMA DE PROTESTA · EVALUADOR {data.toma.orden}</span>
      <h1>{data.toma.nombre} {data.toma.apellido}</h1>
      <div className="public-eval-summary">
        <div><small>Matrícula</small><strong>{data.toma.matricula}</strong></div>
        <div><small>Proyecto</small><strong>{data.toma.proyecto_titulo}</strong></div>
        <div><small>Empresa</small><strong>{data.toma.empresa_razon_social||'—'}</strong></div>
        <div><small>Periodo</small><strong>{data.toma.periodo_nombre}</strong></div>
        <div><small>Fecha y hora</small><strong>{new Date(data.toma.fecha_hora).toLocaleString('es-MX')}</strong></div>
        <div><small>Evaluador</small><strong>{data.toma.evaluador_nombre}</strong></div>
      </div>
      {data.toma.tipo_enlace==='disponibilidad' ? <div className="info-box compact" style={{marginTop:20}}><h2>Confirmación de fecha</h2><p>Confirma tu participación en la toma de protesta. La evaluación académica se enviará en un enlace diferente cuando los tres profesores hayan aceptado.</p><div className="public-eval-summary" style={{marginTop:14}}><div><small>Lugar</small><strong>{data.toma.lugar||'Por definir'}</strong></div><div><small>Profesores participantes</small><strong>{(data.toma.jurado||[]).map(x=>x.nombre).join(', ')}</strong></div></div>{data.toma.disponibilidad_estado==='aceptada'?<div className="feedback-box" style={{marginTop:16}}>✓ Ya aceptaste esta fecha. El asesor podrá liberar posteriormente tu enlace de evaluación.</div>:<><label className="review-observations"><span>Observaciones opcionales</span><textarea value={availabilityNote} onChange={e=>setAvailabilityNote(e.target.value)} placeholder="Si rechazas, indica el motivo o una alternativa."/></label><div className="validation-actions"><button className="primary-btn" onClick={()=>respondAvailability('aceptada')}>Aceptar fecha</button><button className="danger-btn" onClick={()=>respondAvailability('rechazada')}>Rechazar fecha</button></div>{availabilityDone&&<p>Respuesta registrada.</p>}</>}</div> : !data.toma.todos_aceptaron?<div className="info-box compact"><p>La evaluación todavía no está disponible porque falta la aceptación de uno o más profesores.</p></div> : !data.habilitada?<div className="info-box compact"><p>✓ Los tres profesores aceptaron la fecha. La evaluación se habilitará automáticamente al llegar la fecha y hora programadas.</p></div>:<>
        <h2>Evaluación del jurado</h2>
        <p className="muted">Evalúa con escala de 0 a 10 los mismos criterios académicos utilizados en los tres talleres de la memoria técnica.</p>
        <div className="criteria-evaluation">
          {[1,2,3].map(taller=>{const items=(data.preguntas||[]).filter(q=>Number(q.numero_taller)===taller);return items.length?<section key={taller} className="jury-workshop-section"><h3>Taller {taller}</h3>{items.map(q=><div className="criteria-row" key={q.id_pregunta}><div><strong>{q.pregunta}</strong></div><div><input type="number" min="0" max="10" step="0.1" value={respuestas[q.id_pregunta]??''} onChange={e=>setRespuestas({...respuestas,[q.id_pregunta]:e.target.value})} placeholder="0 - 10"/></div></div>)}</section>:null})}
        </div>
        <div className="evaluation-result-card" style={{marginTop:18}}><small>Promedio del evaluador</small><h2 style={{margin:'4px 0'}}>{promedio.toFixed(2)}</h2></div>
        <label className="review-observations"><span>Observaciones</span><textarea value={observaciones} onChange={e=>setObservaciones(e.target.value)} placeholder="Comentarios del jurado"/></label>
        <div className="validation-actions">
          <button className={`primary-btn ${decision==='aprobado'?'selected':''}`} onClick={()=>setDecision('aprobado')}>Aprobar toma</button>
          <button className="danger-btn" onClick={()=>setDecision('rechazado')}>Rechazar toma</button>
        </div>
        <button className="primary-btn public-submit" onClick={send}>Guardar evaluación</button>
      </>}
    </>}
  </section></main>;
}

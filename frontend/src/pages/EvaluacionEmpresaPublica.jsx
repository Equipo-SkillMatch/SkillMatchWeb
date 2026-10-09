import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from '../config/api';
import BrandLogo from '../components/BrandLogo';
import { showToast } from '../components/InstitutionalUI';
import '../CSS/ModuloEstadias.css';

export default function EvaluacionEmpresaPublica(){
  const {token}=useParams();
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[sending,setSending]=useState(false);
  const [meta,setMeta]=useState({evaluador_nombre:'',evaluador_correo:'',evaluador_cargo:'',observaciones:''});
  const [answers,setAnswers]=useState({});
  useEffect(()=>{(async()=>{try{const r=await fetch(`${API_BASE}/public/evaluacion-empresa/${token}`);const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo abrir la evaluación.');setData(j);}catch(e){showToast(e.message,{type:'error'});}finally{setLoading(false)}})()},[token]);
  const complete=useMemo(()=>data?.preguntas?.every(p=>answers[p.id_pregunta]),[data,answers]);
  const submit=async(e)=>{e.preventDefault();if(!complete)return showToast('Responde las 10 preguntas antes de enviar.',{type:'warning'});setSending(true);try{const r=await fetch(`${API_BASE}/public/evaluacion-empresa/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...meta,respuestas:data.preguntas.map(p=>({id_pregunta:p.id_pregunta,codigo_nivel:answers[p.id_pregunta]}))})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo guardar.');showToast(`Evaluación enviada. Resultado: ${j.codigo_final} (${j.promedio})`,{type:'success'});setData(d=>({...d,evaluacion:{...d.evaluacion,respondida_en:new Date().toISOString()}}));}catch(x){showToast(x.message,{type:'error'});}finally{setSending(false)}};
  if(loading)return <div className="public-eval-shell"><div className="public-eval-card"><p>Cargando evaluación…</p></div></div>;
  if(!data)return <div className="public-eval-shell"><div className="public-eval-card"><h2>Evaluación no disponible</h2><p>Solicita al profesor asesor un enlace nuevo.</p></div></div>;
  if(data.evaluacion.respondida_en)return <div className="public-eval-shell"><div className="public-eval-card"><BrandLogo/><h2>Evaluación registrada</h2><p>Gracias. Esta evaluación ya fue respondida y quedó asociada al expediente del estudiante.</p></div></div>;
  return <div className="public-eval-shell"><form className="public-eval-card" onSubmit={submit}>
    <div className="public-eval-brand"><BrandLogo/></div>
    <span className="eyebrow">EVALUACIÓN DE ESTADÍA PROFESIONAL</span>
    <h1>{data.evaluacion.momento==='inicial'?'Primera evaluación':'Evaluación final'} de la empresa</h1>
    <div className="public-eval-summary"><div><small>Alumno</small><strong>{data.evaluacion.nombre} {data.evaluacion.apellido}</strong></div><div><small>Matrícula</small><strong>{data.evaluacion.matricula}</strong></div><div><small>Proyecto</small><strong>{data.evaluacion.proyecto_titulo}</strong></div><div><small>Periodo</small><strong>{data.evaluacion.periodo_nombre}</strong></div></div>
    <div className="form-grid"><label className="field"><span>Nombre de quien evalúa</span><input required value={meta.evaluador_nombre} onChange={e=>setMeta({...meta,evaluador_nombre:e.target.value})}/></label><label className="field"><span>Correo</span><input type="email" value={meta.evaluador_correo} onChange={e=>setMeta({...meta,evaluador_correo:e.target.value})}/></label><label className="field full"><span>Cargo</span><input value={meta.evaluador_cargo} onChange={e=>setMeta({...meta,evaluador_cargo:e.target.value})}/></label></div>
    {['desempeno','actitud'].map(cat=><section className="evaluation-section" key={cat}><h2>{cat==='desempeno'?'Desempeño':'Actitud'}</h2>{data.preguntas.filter(p=>p.categoria===cat).map(p=><div className="evaluation-question" key={p.id_pregunta}><div><span>{p.orden}</span><p>{p.pregunta}</p></div><div className="rating-options">{data.niveles.map(n=><label key={n.codigo} className={answers[p.id_pregunta]===n.codigo?'selected':''}><input type="radio" name={`p${p.id_pregunta}`} value={n.codigo} checked={answers[p.id_pregunta]===n.codigo} onChange={()=>setAnswers({...answers,[p.id_pregunta]:n.codigo})}/><strong>{n.codigo}</strong><small>{n.nombre}</small></label>)}</div></div>)}</section>)}
    <label className="field full"><span>Observaciones generales</span><textarea rows="4" value={meta.observaciones} onChange={e=>setMeta({...meta,observaciones:e.target.value})}/></label>
    <button className="primary-btn public-submit" disabled={sending}>{sending?'Enviando…':'Enviar evaluación'}</button>
  </form></div>;
}

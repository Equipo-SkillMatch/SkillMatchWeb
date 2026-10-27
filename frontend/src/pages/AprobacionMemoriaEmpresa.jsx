import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE, buildFileUrl } from '../config/api';
import BrandLogo from '../components/BrandLogo';
import '../components/InstitutionalUI.css';

const statusText = (v) => ({
  en_revision: 'En revisión', aprobado: 'Aprobada', rechazado: 'Rechazada', requiere_correccion: 'Requiere corrección', pendiente: 'Pendiente'
}[v] || v || 'Pendiente');

export default function AprobacionMemoriaEmpresa(){
  const {token}=useParams();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [obs,setObs]=useState('');
  const [calificacion,setCalificacion]=useState(null);
  const [memoriaRevisada,setMemoriaRevisada]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState('');

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const r=await fetch(`${API_BASE}/public/aprobacion-memoria/${token}`);
      const j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.mensaje||'Enlace no válido.');
      setData(j.solicitud);
      setObs(j.solicitud?.observaciones||'');
      setCalificacion(j.solicitud?.calificacion_memoria_empresa||null);
    }catch(e){setError(e.message)}finally{setLoading(false)}
  };
  useEffect(()=>{load();},[token]);

  const revisarMemoria=()=>{
    if(!data?.memoria_final_ruta)return setError('El alumno todavía no tiene una memoria final disponible.');
    window.open(buildFileUrl(data.memoria_final_ruta),'_blank','noopener,noreferrer');
    setMemoriaRevisada(true);
  };

  const send=async(estado)=>{
    setError('');
    if(!memoriaRevisada)return setError('Primero abre y revisa la memoria técnica.');
    if(estado==='aprobado' && ![8,9,10].includes(Number(calificacion)))return setError('Selecciona una calificación de 8, 9 o 10.');
    if(['rechazado','requiere_correccion'].includes(estado) && !obs.trim())return setError('Escribe el motivo o la corrección que debe realizar el alumno.');
    try{
      const r=await fetch(`${API_BASE}/public/aprobacion-memoria/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado,observaciones:obs,calificacion:estado==='aprobado'?Number(calificacion):null})});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.mensaje||'No se pudo guardar.');
      setDone(true);
    }catch(e){setError(e.message)}
  };

  if(loading)return <main style={{padding:40}}>Cargando…</main>;
  return <div style={{minHeight:'100vh',background:'#f5f8fc',padding:'36px 18px'}}>
    <div style={{maxWidth:900,margin:'0 auto',background:'#fff',borderRadius:22,padding:28,boxShadow:'0 16px 45px rgba(15,45,80,.08)'}}>
      <BrandLogo/>
      {error&&<div style={{margin:'20px 0',padding:14,background:'#fef2f2',borderRadius:12,color:'#b91c1c'}}>{error}</div>}
      {done?<div style={{padding:'42px 0',textAlign:'center'}}><h2>Respuesta registrada</h2><p>SkillMatch notificará al alumno y a su asesor. Si se solicitó una corrección, este mismo enlace podrá utilizarse para revisar la nueva versión.</p></div>:data&&<>
        <span style={{fontSize:12,fontWeight:800,color:'#2f6da4'}}>REVISIÓN EMPRESARIAL</span>
        <h1 style={{margin:'8px 0 4px'}}>Memoria técnica final</h1>
        <p style={{color:'#64748b'}}>Revisa que la memoria no exponga información sensible o confidencial de la empresa y después emite tu evaluación.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,margin:'22px 0'}}>
          {[
            ['Alumno',`${data.nombre} ${data.apellido}`],['Matrícula',data.matricula],['Proyecto',data.proyecto_titulo],['Empresa',data.empresa_razon_social],['Grupo',data.grupo_nombre],['Periodo',data.periodo_nombre],['Versión',`Versión ${data.memoria_final_version||1}`],['Estado',statusText(data.estado)]
          ].map(([l,v])=><div key={l} style={{padding:14,border:'1px solid #e2e8f0',borderRadius:14}}><small style={{display:'block',color:'#64748b'}}>{l}</small><strong>{v||'—'}</strong></div>)}
        </div>

        <section style={{padding:20,border:'1px solid #dbe7f3',borderRadius:16,marginBottom:18}}>
          <div style={{display:'flex',gap:14,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
            <div><small style={{fontWeight:800,color:'#2f6da4'}}>PASO 1</small><h3 style={{margin:'4px 0'}}>Revisar memoria técnica</h3><p style={{margin:0,color:'#64748b'}}>{data.memoria_final_nombre||'Memoria final PDF'} · Versión {data.memoria_final_version||1}</p></div>
            <button onClick={revisarMemoria} style={{padding:'12px 18px',border:0,borderRadius:11,background:'#245f92',color:'#fff',fontWeight:800}}>Revisar memoria técnica</button>
          </div>
        </section>

        <section style={{padding:20,border:`1px solid ${memoriaRevisada?'#b7d7bf':'#e2e8f0'}`,borderRadius:16,opacity:memoriaRevisada?1:.55}}>
          <small style={{fontWeight:800,color:'#2f6da4'}}>PASO 2</small>
          <h3 style={{margin:'4px 0 14px'}}>Calificar y emitir dictamen</h3>
          {!memoriaRevisada&&<p style={{color:'#64748b'}}>Este apartado se habilita después de abrir la memoria técnica.</p>}
          <div style={{pointerEvents:memoriaRevisada?'auto':'none'}}>
            <strong>Calificación de la memoria final</strong>
            <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap'}}>{[8,9,10].map(n=><button key={n} onClick={()=>setCalificacion(n)} style={{padding:'11px 22px',border:`1px solid ${Number(calificacion)===n?'#245f92':'#cbd5e1'}`,borderRadius:10,background:Number(calificacion)===n?'#e8f2fb':'#fff',fontWeight:800}}>{n}</button>)}</div>
            <label style={{display:'grid',gap:8,marginTop:18}}><span style={{fontWeight:700}}>Comentario / observaciones</span><textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Escribe comentarios para el alumno. Es obligatorio si rechazas o solicitas corrección." style={{minHeight:110,padding:12,border:'1px solid #cbd5e1',borderRadius:12}}/></label>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}>
              <button onClick={()=>send('aprobado')} style={{padding:'11px 16px',border:0,borderRadius:10,background:'#15803d',color:'#fff',fontWeight:700}}>Aprobar con {calificacion||'8/9/10'}</button>
              <button onClick={()=>send('requiere_correccion')} style={{padding:'11px 16px',border:'1px solid #d97706',borderRadius:10,background:'#fff7ed',color:'#9a3412',fontWeight:700}}>Solicitar corrección</button>
              <button onClick={()=>send('rechazado')} style={{padding:'11px 16px',border:'1px solid #dc2626',borderRadius:10,background:'#fff',color:'#b91c1c',fontWeight:700}}>Rechazar</button>
            </div>
          </div>
        </section>
      </>}
    </div>
  </div>;
}

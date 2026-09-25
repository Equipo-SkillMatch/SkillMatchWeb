import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';

export default function Privacidad() {
  const navigate = useNavigate();

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <button 
          onClick={() => navigate(-1)} 
          style={{ background: 'none', border: 'none', color: '#244E7C', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '30px', fontSize: '15px' }}
        >
          ← Regresar
        </button>

        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ color: '#232E56', fontSize: '32px', fontWeight: '800', marginBottom: '10px' }}>Aviso de Privacidad</h1>
          <div style={{ width: '60px', height: '4px', background: '#244E7C', margin: '0 auto', borderRadius: '2px' }}></div>
          <p style={{ color: '#64748b', marginTop: '15px', fontSize: '14px' }}>Última actualización: Abril 2026</p>
        </header>

        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', color: '#334155', lineHeight: '1.7' }}>
          
          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#232E56', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #244E7C', paddingLeft: '15px' }}>Responsable del Tratamiento</h2>
            <p><strong>SkillMatch</strong>, plataforma académica de vinculación entre estudiantes y empresas, con domicilio en Querétaro, México, es responsable del uso y protección de los datos personales recabados en el marco de este sitio web.</p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#232E56', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #244E7C', paddingLeft: '15px' }}>Datos Personales Recabados</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
              <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '16px', color: '#244E7C', marginBottom: '10px' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 7 }}><AppIcon name="graduation" size={18} /></span>Estudiantes</h3>
                <ul style={{ paddingLeft: '20px', fontSize: '14px' }}>
                  <li>Nombre completo y Correo institucional.</li>
                  <li>Carrera y nivel académico.</li>
                  <li>Historial académico y documentos migrados.</li>
                  <li>CV generado y preferencias de búsqueda.</li>
                </ul>
              </div>
              <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '16px', color: '#244E7C', marginBottom: '10px' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 7 }}><AppIcon name="building" size={18} /></span>Empresas</h3>
                <ul style={{ paddingLeft: '20px', fontSize: '14px' }}>
                  <li>Razón social y nombre comercial.</li>
                  <li>Datos del representante de contacto.</li>
                  <li>Dirección, correo y teléfono corporativo.</li>
                  <li>Vacantes y métricas de dashboard.</li>
                </ul>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#232E56', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #244E7C', paddingLeft: '15px' }}>Finalidad del Uso de Datos</h2>
            <ol style={{ paddingLeft: '20px' }}>
              <li>Crear perfiles académicos y profesionales.</li>
              <li>Facilitar la vinculación laboral y de estadías.</li>
              <li>Generar documentación automatizada (CV, cuestionarios).</li>
              <li>Mejorar la experiencia mediante servicios personalizados.</li>
            </ol>
          </section>

          <section style={{ marginBottom: '30px', background: '#232E56', color: 'white', padding: '30px', borderRadius: '15px' }}>
            <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '15px' }}>Derechos ARCO</h2>
            <p style={{ fontSize: '14px', marginBottom: '20px' }}>Usted tiene derecho a conocer, corregir, cancelar u oponerse al uso de sus datos personales.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
              {['Acceso', 'Rectificación', 'Cancelación', 'Oposición'].map(d => (
                <div key={d} style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>{d}</div>
              ))}
            </div>
            <p style={{ marginTop: '20px', fontSize: '14px' }}>Para ejercerlos, envíe una solicitud con su identificación oficial a: <strong style={{ color: '#38bdf8' }}>privacidad@skillmatch.mx</strong>. El plazo de respuesta es de máximo 20 días hábiles.</p>
          </section>

          <section>
            <h2 style={{ color: '#232E56', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #244E7C', paddingLeft: '15px' }}>Confidencialidad y Seguridad</h2>
            <p>SkillMatch garantiza medidas de seguridad bajo estándares internacionales <strong>ISO 27001/27002</strong>, evitando pérdida, alteración o acceso no autorizado a su información.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';

export default function Terminos() {
  const navigate = useNavigate();

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '40px 20px', fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <button 
          onClick={() => navigate(-1)} 
          style={{ background: 'none', border: 'none', color: '#244E7C', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '30px', fontSize: '15px' }}
        >
          ← Regresar
        </button>

        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ color: '#232E56', fontSize: '32px', fontWeight: '800', marginBottom: '10px' }}>Términos y Condiciones</h1>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Deslinde Legal y Lineamientos de Seguridad</p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* CARD: DESLINDE */}
          <div style={{ background: 'white', padding: '35px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <h2 style={{ color: '#232E56', fontSize: '18px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span><AppIcon name="shield" size={20} /></span> Deslinde de Responsabilidad Legal
            </h2>
            <p style={{ fontSize: '15px', color: '#475569', lineHeight: '1.7' }}>
              Este documento establece los términos bajo los cuales se deslinda a <strong>SkillMatch</strong> y a la <strong>Universidad Tecnológica de Querétaro (UTEQ)</strong> de cualquier responsabilidad derivada del uso del software, conforme a la Ley General de Protección de Datos Personales y el Código Penal Federal.
            </p>
          </div>

          {/* CARD: RESPONSABILIDADES */}
          <div style={{ background: 'white', padding: '35px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <h2 style={{ color: '#232E56', fontSize: '18px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '20px' }}>Responsabilidad del Usuario</h2>
            <ul style={{ color: '#475569', fontSize: '14px', lineHeight: '2' }}>
              <li>El uso del sistema es responsabilidad exclusiva del estudiante o empresa.</li>
              <li>La información publicada por estudiantes debe ser veraz y será validada por un administrador.</li>
              <li>Queda prohibido el uso del sistema para fines distintos a los académicos o profesionales.</li>
              <li>La confidencialidad de las credenciales de acceso es responsabilidad total del usuario.</li>
            </ul>
          </div>

          {/* CARD: SEGURIDAD TÉCNICA */}
          <div style={{ background: '#fff', border: '2px solid #232E56', padding: '35px', borderRadius: '20px' }}>
            <h2 style={{ color: '#232E56', fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 8 }}><AppIcon name="shield" size={20} /></span>Lineamientos de Seguridad de la Información</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
              <div>
                <h4 style={{ color: '#244E7C', marginBottom: '10px' }}>Infraestructura y Red</h4>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  • Comunicación cifrada mediante <strong>HTTPS/TLS 1.3</strong>.<br />
                  • Monitoreo mediante firewalls y sistemas IDS/IPS (NIST CSF).<br />
                  • Auditorías semestrales bajo estándar <strong>ISO/IEC 27001</strong>.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#244E7C', marginBottom: '10px' }}>Desarrollo Seguro</h4>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  • Prevención activa contra inyección SQL y ataques XSS.<br />
                  • Criptografía asimétrica para accesos biométricos.<br />
                  • Bloqueo preventivo ante ataques de fuerza bruta.
                </p>
              </div>
            </div>
          </div>

          {/* CARD: PROPIEDAD Y DELITOS */}
          <div style={{ background: '#f1f5f9', padding: '30px', borderRadius: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              El uso del sistema para cometer actos ilícitos será sancionado conforme al <strong>Código Penal Federal</strong>. SkillMatch colaborará con las autoridades en caso de detectar fraudes o accesos no autorizados.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
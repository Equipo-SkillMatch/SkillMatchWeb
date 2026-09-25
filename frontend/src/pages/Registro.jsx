import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/Registro.css';
import { API_BASE } from '../config/api';
import BrandLogo from '../components/BrandLogo';
import AppIcon from '../components/AppIcon';

const carrerasDefault = [
  'Ing. en Desarrollo y Gestión de Software',
  'Ing. Mecatrónica',
  'Ing. Ambiental',
  'Ing. Redes',
];

const roleContent = {
  2: {
    label: 'Estudiante',
    title: 'Convierte tus proyectos en experiencia visible.',
    description: 'Crea un perfil profesional con habilidades, evidencias y proyectos que las empresas puedan conocer.',
    steps: [
      ['01', 'Construye tu perfil', 'Agrega tu información académica y habilidades.'],
      ['02', 'Publica tus proyectos', 'Muestra resultados, tecnologías y evidencias.'],
      ['03', 'Explora oportunidades', 'Postúlate a vacantes compatibles con tu talento.'],
    ],
  },
  4: {
    label: 'Profesor',
    title: 'Acompaña el talento desde el aula hasta la empresa.',
    description: 'Gestiona proyectos académicos, evidencias y actividades de vinculación desde un panel especializado.',
    steps: [
      ['01', 'Registra tu perfil', 'Vincula tu departamento y asignaturas.'],
      ['02', 'Gestiona proyectos', 'Publica proyectos y supervisa evidencias.'],
      ['03', 'Impulsa oportunidades', 'Haz visible el trabajo académico de tus estudiantes.'],
    ],
  },
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Registro() {
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [role, setRole] = useState(2);
  const [estForm, setEstForm] = useState({
    nombre: '',
    apellido: '',
    matricula: '',
    correo: '',
    telefono: '',
    password: '',
    confirmar: '',
    semestre: '',
    carrera: '',
    grupo: '',
    departamento: '',
    asignaturas: '',
  });

  const activeContent = roleContent[role];

  const handleEst = (event) => {
    setEstForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitRegistro = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!estForm.nombre || !estForm.apellido || !estForm.correo || !estForm.password || !estForm.telefono) {
      setError('Completa los campos personales básicos y de contacto.');
      return;
    }

    if (role === 2 && (!estForm.matricula || !estForm.carrera || !estForm.semestre)) {
      setError('Completa los datos académicos del estudiante.');
      return;
    }

    if (role === 4 && !estForm.departamento) {
      setError('El departamento es obligatorio para profesores.');
      return;
    }

    if (estForm.password !== estForm.confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (estForm.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!terms) {
      setError('Debes aceptar los términos y condiciones.');
      return;
    }

    setLoading(true);
    try {
      const basePayload = {
        nombre: estForm.nombre,
        apellido: estForm.apellido,
        correo: estForm.correo,
        telefono: estForm.telefono,
        password: estForm.password,
        id_rol: role,
      };

      const payload = role === 2
        ? {
          ...basePayload,
          matricula: estForm.matricula,
          carrera: estForm.carrera,
          semestre: Number(estForm.semestre),
          grupo: estForm.grupo,
        }
        : {
          ...basePayload,
          departamento: estForm.departamento,
          asignaturas: estForm.asignaturas,
        };

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.mensaje || 'Error al registrar la cuenta.');
        return;
      }
      setSuccess('Cuenta creada correctamente. Te dirigiremos al inicio de sesión.');
      window.setTimeout(() => navigate('/login'), 1800);
    } catch (requestError) {
      setError(`Error de conexión: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <aside className="register-showcase">
        <div className="register-showcase__mesh" />
        <button type="button" className="register-back" onClick={() => navigate('/')}><span>←</span> Volver al inicio</button>
        <div className="register-showcase__brand"><BrandLogo light /><img src="/logos/uteq-logo.png" alt="UTEQ Universidad Líder" /></div>

        <div className="register-showcase__content" key={role}>
          <span className="register-kicker">REGISTRO PARA {activeContent.label.toUpperCase()}</span>
          <h1>{activeContent.title}</h1>
          <p>{activeContent.description}</p>

          <div className="register-steps">
            {activeContent.steps.map(([number, title, text], index) => (
              <div className="register-step" key={number} style={{ '--delay': `${index * 90}ms` }}>
                <span>{number}</span><div><strong>{title}</strong><small>{text}</small></div>
              </div>
            ))}
          </div>
        </div>

        <div className="register-showcase__footer"><span>Plataforma de vinculación universitaria</span><strong>SkillMatch · 2026</strong></div>
      </aside>

      <main className="register-panel">
        <div className="register-card">
          <div className="register-mobile-brand"><BrandLogo /><img src="/logos/uteq-logo.png" alt="UTEQ" /></div>
          <div className="register-head">
            <div><span>CREA TU CUENTA</span><h2>Comienza en SkillMatch</h2><p>Selecciona tu tipo de perfil y completa la información.</p></div>
            <div className="register-progress"><strong>01</strong><span>de 01</span></div>
          </div>

          <div className="role-selector" role="tablist" aria-label="Tipo de perfil">
            <button type="button" className={role === 2 ? 'is-active' : ''} onClick={() => { setRole(2); setError(''); }}>
              <span><AppIcon name="graduation" size={22} /></span><div><strong>Estudiante</strong><small>Portafolio y vacantes</small></div>
            </button>
            <button type="button" className={role === 4 ? 'is-active' : ''} onClick={() => { setRole(4); setError(''); }}>
              <span><AppIcon name="teacher" size={22} /></span><div><strong>Profesor</strong><small>Proyectos y seguimiento</small></div>
            </button>
          </div>

          {error && <div className="register-alert register-alert--error"><span>!</span>{error}</div>}
          {success && <div className="register-alert register-alert--success"><span>✓</span>{success}</div>}

          <form className="register-form" onSubmit={submitRegistro}>
            <div className="register-section-title"><span>01</span><div><strong>Datos personales</strong><small>Información básica del perfil</small></div></div>
            <div className="register-grid register-grid--2">
              <label className="register-field"><span>Nombre(s)</span><input name="nombre" value={estForm.nombre} onChange={handleEst} placeholder="Daniel" autoComplete="given-name" required /></label>
              <label className="register-field"><span>Apellidos</span><input name="apellido" value={estForm.apellido} onChange={handleEst} placeholder="Hernández" autoComplete="family-name" required /></label>
            </div>

            <div className="register-section-title"><span>02</span><div><strong>Información académica</strong><small>Datos relacionados con tu rol</small></div></div>
            {role === 2 ? (
              <>
                <div className="register-grid register-grid--3">
                  <label className="register-field"><span>Matrícula</span><input name="matricula" value={estForm.matricula} onChange={handleEst} placeholder="2023371089" required /></label>
                  <label className="register-field"><span>Cuatrimestre</span><select name="semestre" value={estForm.semestre} onChange={handleEst} required><option value="">Selecciona</option>{Array.from({ length: 11 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}°</option>)}</select></label>
                  <label className="register-field"><span>Grupo</span><input name="grupo" value={estForm.grupo} onChange={handleEst} placeholder="A" /></label>
                </div>
                <div className="register-grid">
                  <label className="register-field"><span>Carrera</span><select name="carrera" value={estForm.carrera} onChange={handleEst} required><option value="">Selecciona tu carrera</option>{carrerasDefault.map((carrera) => <option key={carrera} value={carrera}>{carrera}</option>)}</select></label>
                </div>
              </>
            ) : (
              <div className="register-grid register-grid--2">
                <label className="register-field"><span>Departamento o academia</span><input name="departamento" value={estForm.departamento} onChange={handleEst} placeholder="Tecnologías de la Información" required /></label>
                <label className="register-field"><span>Asignaturas</span><input name="asignaturas" value={estForm.asignaturas} onChange={handleEst} placeholder="Programación Web, Base de Datos" /></label>
              </div>
            )}

            <div className="register-section-title"><span>03</span><div><strong>Contacto y acceso</strong><small>Credenciales para tu cuenta</small></div></div>
            <div className="register-grid register-grid--2">
              <label className="register-field"><span>Correo electrónico</span><input type="email" name="correo" value={estForm.correo} onChange={handleEst} placeholder={role === 2 ? 'alumno@uteq.edu.mx' : 'profesor@uteq.edu.mx'} autoComplete="email" required /></label>
              <label className="register-field"><span>Teléfono</span><input type="tel" name="telefono" value={estForm.telefono} onChange={handleEst} placeholder="442 000 0000" autoComplete="tel" required /></label>
            </div>
            <div className="register-grid register-grid--2">
              <label className="register-field"><span>Contraseña</span><div className="register-password"><input type={showPass ? 'text' : 'password'} name="password" value={estForm.password} onChange={handleEst} placeholder="Mínimo 8 caracteres" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowPass((current) => !current)}>{showPass ? 'Ocultar' : 'Ver'}</button></div></label>
              <label className="register-field"><span>Confirmar contraseña</span><div className="register-password"><input type={showPass2 ? 'text' : 'password'} name="confirmar" value={estForm.confirmar} onChange={handleEst} placeholder="Repite la contraseña" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowPass2((current) => !current)}>{showPass2 ? 'Ocultar' : 'Ver'}</button></div></label>
            </div>

            <label className="register-terms"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>Acepto los <Link to="/terminos">Términos y condiciones</Link> y el <Link to="/privacidad">Aviso de privacidad</Link>.</span></label>

            <button type="submit" className="register-submit" disabled={loading}><span>{loading ? 'Creando cuenta...' : `Crear cuenta de ${activeContent.label.toLowerCase()}`}</span><ArrowIcon /></button>
          </form>

          <p className="register-login">¿Ya tienes una cuenta? <button type="button" onClick={() => navigate('/login')}>Inicia sesión</button></p>
        </div>
      </main>
    </div>
  );
}

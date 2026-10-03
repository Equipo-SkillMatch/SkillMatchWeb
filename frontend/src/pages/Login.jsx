import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import '../CSS/Login.css';
import { AUTH_BASE } from '../config/api';
import BrandLogo from '../components/BrandLogo';

const API_BASE = AUTH_BASE;

const highlights = [
  { icon: '✓', title: 'Proyectos con evidencia', text: 'Muestra experiencia académica de forma profesional.' },
  { icon: '↗', title: 'Oportunidades relevantes', text: 'Explora vacantes compatibles con tu perfil.' },
  { icon: '◎', title: 'Acceso seguro', text: 'Contraseña, CAPTCHA y autenticación biométrica.' },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ correo: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBio, setLoadingBio] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0 });
  const [captchaInput, setCaptchaInput] = useState('');

  const generarCaptcha = () => {
    setCaptcha({
      num1: Math.floor(Math.random() * 10) + 1,
      num2: Math.floor(Math.random() * 10) + 1,
    });
    setCaptchaInput('');
  };

  useEffect(() => {
    generarCaptcha();
  }, []);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.usuario));
    const role = String(data.usuario.id_rol);

    if (role === '3') navigate('/dashboard-empresa');
    else if (role === '4') navigate('/dashboard-profesores');
    else if (role === '1' || role === '5') navigate('/dashboard-vinculacion');
    else if (role === '6') navigate('/estadias');
    else navigate('/dashboard-estudiante');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (Number.parseInt(captchaInput, 10) !== captcha.num1 + captcha.num2) {
      setError('El CAPTCHA es incorrecto. Resuelve la suma para continuar.');
      generarCaptcha();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.mensaje || 'Error al iniciar sesión.');
        generarCaptcha();
        return;
      }
      handleLoginSuccess(data);
    } catch (requestError) {
      setError(`Error de conexión con el servidor: ${requestError.message}`);
      generarCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleFaceIDLogin = async () => {
    setError('');
    setLoadingBio(true);
    try {
      const optionsResponse = await fetch(`${API_BASE}/biometric-login-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(options.mensaje || 'Error al conectar con el servidor.');

      const authenticationResponse = await startAuthentication(options);
      const verifyResponse = await fetch(`${API_BASE}/biometric-login-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authResponse: authenticationResponse, challenge: options.challenge }),
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(result.mensaje || 'Error en la verificación biométrica.');
      handleLoginSuccess(result);
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError.message === 'The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.'
          ? 'Operación cancelada o dispositivo no reconocido.'
          : requestError.message,
      );
    } finally {
      setLoadingBio(false);
    }
  };

  return (
    <div className="auth-page login-page">
      <section className="auth-showcase">
        <div className="auth-showcase__mesh" />
        <button type="button" className="auth-back" onClick={() => navigate('/')}>
          <span>←</span> Volver al inicio
        </button>

        <div className="auth-showcase__brand">
          <BrandLogo light />
          <div className="auth-university"><span>EN COLABORACIÓN CON</span><img src="/logos/uteq-logo.png" alt="UTEQ Universidad Líder" /></div>
        </div>

        <div className="auth-showcase__content">
          <span className="auth-kicker">TU ESPACIO DE CRECIMIENTO PROFESIONAL</span>
          <h1>Conecta tu talento con <em>oportunidades reales.</em></h1>
          <p>Accede a tu panel para administrar proyectos, perfiles, vacantes, evidencias y conexiones profesionales.</p>

          <div className="auth-highlights">
            {highlights.map((highlight, index) => (
              <div className="auth-highlight" key={highlight.title} style={{ '--delay': `${index * 110}ms` }}>
                <span>{highlight.icon}</span>
                <div><strong>{highlight.title}</strong><small>{highlight.text}</small></div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-showcase__preview">
          <div><span>Perfiles activos</span><strong>+240</strong></div>
          <div><span>Proyectos publicados</span><strong>+80</strong></div>
          <div><span>Coincidencia promedio</span><strong>89%</strong></div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-card__mobile-brand"><BrandLogo /><img src="/logos/uteq-logo.png" alt="UTEQ" /></div>
          <span className="auth-form-eyebrow">ACCESO A SKILLMATCH</span>
          <h2>Bienvenido de nuevo</h2>
          <p className="auth-form-subtitle">Ingresa tus credenciales para continuar.</p>

          {error && <div className="auth-alert" role="alert"><span>!</span><p>{error}</p></div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span>Correo electrónico</span>
              <div className="auth-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3zM3 6l9 7 9-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <input type="email" name="correo" placeholder="correo@uteq.edu.mx" value={form.correo} onChange={handleChange} autoComplete="email" required />
              </div>
            </label>

            <label className="auth-field">
              <span>Contraseña</span>
              <div className="auth-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
                <input type={mostrarPassword ? 'text' : 'password'} name="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={handleChange} autoComplete="current-password" minLength={8} required />
                <button type="button" className="auth-eye" onClick={() => setMostrarPassword((current) => !current)} aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {mostrarPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </label>

            <label className="auth-field">
              <span>Verificación de seguridad</span>
              <div className="captcha-row">
                <div className="captcha-question"><small>RESUELVE</small><strong>{captcha.num1} + {captcha.num2} = ?</strong></div>
                <input type="number" inputMode="numeric" placeholder="Resultado" value={captchaInput} onChange={(event) => setCaptchaInput(event.target.value)} required />
                <button type="button" onClick={generarCaptcha} aria-label="Generar otra suma">↻</button>
              </div>
            </label>

            <button type="submit" className="auth-submit" disabled={loading}>
              <span>{loading ? 'Iniciando sesión...' : 'Iniciar sesión'}</span><ArrowIcon />
            </button>
          </form>

          <div className="auth-divider"><span>O ACCEDE DE FORMA SEGURA</span></div>

          <button type="button" className="auth-biometric" onClick={handleFaceIDLogin} disabled={loadingBio}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M8 9h.01M16 9h.01M9 16c1.8 1.3 4.2 1.3 6 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            <span>{loadingBio ? 'Validando biometría...' : 'Entrar con datos biométricos'}</span>
          </button>

          <p className="auth-switch">¿Aún no tienes una cuenta? <button type="button" onClick={() => navigate('/registro')}>Crear cuenta</button></p>
          <div className="auth-legal">Al continuar aceptas los <button type="button" onClick={() => navigate('/terminos')}>Términos</button> y el <button type="button" onClick={() => navigate('/privacidad')}>Aviso de privacidad</button>.</div>
        </div>
      </section>
    </div>
  );
}

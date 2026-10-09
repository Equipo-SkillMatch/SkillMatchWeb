import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Registro from './pages/Registro';
import DashboardEmpresas from './pages/DashboardEmpresas';
import DashboardVinculacion from './pages/DashboardVinculacion';
import DashboardEstudiante from './pages/DashboardEstudiante';
import DashboardProfesores from './pages/DashboardProfesores';
import VerProyecto from './pages/VerProyecto';
import VerAlumno from './pages/VerAlumno';
import Terminos from './pages/Terminos';
import Privacidad from './pages/Privacidad';
import ModuloEstadias from './pages/ModuloEstadias';
import EvaluacionEmpresaPublica from './pages/EvaluacionEmpresaPublica';

import RutaProtegida from './components/RutaProtegida';
import './CSS/DashboardTheme.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
 {/* RUTAS PÚBLICAS */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/proyecto/:id" element={<VerProyecto />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/evaluacion-empresa/:token" element={<EvaluacionEmpresaPublica />} />

 {/* RUTAS PROTEGIDAS POR TOKEN Y ROL */}
        
        {/* Empresa (Rol 3) */}
        <Route 
          path="/dashboard-empresa/*" 
          element={
            <RutaProtegida rolesPermitidos={['3']}>
              <DashboardEmpresas />
            </RutaProtegida>
          } 
        />
        
        {/* Administrador / Vinculación (Roles 1 y 5) */}
        <Route 
          path="/dashboard-vinculacion/*" 
          element={
            <RutaProtegida rolesPermitidos={['1', '5']}>
              <DashboardVinculacion />
            </RutaProtegida>
          } 
        />
        
        {/* Profesor (Rol 4) */}
        <Route 
          path="/dashboard-profesores/*" 
          element={
            <RutaProtegida rolesPermitidos={['4']}>
              <DashboardProfesores />
            </RutaProtegida>
          } 
        />
        
        {/* Estudiante (Rol 2) */}
        <Route 
          path="/dashboard-estudiante/*" 
          element={
            <RutaProtegida rolesPermitidos={['2']}>
              <DashboardEstudiante />
            </RutaProtegida>
          } 
        />

        {/* Módulo institucional de estadías (Admin, Estudiante, Profesor, Servicios Escolares) */}
        <Route
          path="/estadias/*"
          element={
            <RutaProtegida rolesPermitidos={['1','2','4','6']}>
              <ModuloEstadias />
            </RutaProtegida>
          }
        />

        {/* Ver Alumno: Cualquier usuario logueado puede entrar */}
        <Route 
          path="/ver-alumno/:id" 
          element={
            <RutaProtegida>
              <VerAlumno />
            </RutaProtegida>
          } 
        />

 {/* RUTA COMODÍN */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
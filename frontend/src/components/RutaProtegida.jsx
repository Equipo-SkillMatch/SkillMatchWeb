import { Navigate } from 'react-router-dom';

const RutaProtegida = ({ children, rolesPermitidos }) => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    // 1. VALIDACIÓN RADICAL: Si no hay token o no hay datos de usuario,
    // significa que es una pestaña nueva o modo incógnito. RECHAZAR.
    if (!token || !userStr) {
        return <Navigate to="/login" replace />;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        // Si el JSON está corrupto, limpiar y sacar
        localStorage.clear();
        return <Navigate to="/login" replace />;
    }

    const userRol = String(user.id_rol);

    // 2. VALIDACIÓN DE ROL: Si el usuario tiene sesión pero intenta
    // entrar a un panel que no le toca (ej. Estudiante queriendo entrar a Admin)
    if (rolesPermitidos && !rolesPermitidos.includes(userRol)) {
        // Redirigir a su propio dashboard según su rol real
        if (userRol === '3') return <Navigate to="/dashboard-empresa" replace />;
        if (userRol === '1' || userRol === '5') return <Navigate to="/dashboard-vinculacion" replace />;
        if (userRol === '4') return <Navigate to="/dashboard-profesores" replace />;
        if (userRol === '2') return <Navigate to="/dashboard-estudiante" replace />;
        if (userRol === '6') return <Navigate to="/estadias" replace />;
        
        return <Navigate to="/" replace />;
    }

    // 3. PERMISO CONCEDIDO
    return children;
};

export default RutaProtegida;
# SkillMatch — versión visual renovada

Proyecto completo de SkillMatch con frontend en React y backend en Node.js/Express con PostgreSQL.
La actualización conserva las rutas, roles y lógica existentes, y renueva la experiencia visual de la landing, autenticación y dashboards.

## Cambios principales

- Landing page moderna, responsiva y alineada con la identidad azul/dorada de SkillMatch y UTEQ.
- Hero, beneficios, funcionamiento, perfiles, proyectos destacados, testimonios y CTA final.
- Transiciones suaves, efectos de entrada, estados hover y microinteracciones.
- Login y registro con diseño dividido, mejor jerarquía visual y adaptación móvil.
- Estilo unificado para los dashboards de Administrador/Vinculación, Empresa, Alumno y Profesor.
- Tarjetas KPI y visualizaciones ligeras integradas sin agregar una librería nueva de gráficas.
- Logos oficiales incluidos en `frontend/public/logos/`.
- Build de producción del frontend incluido en `frontend/build/`.

## Requisitos

- Node.js 18 o superior.
- npm.
- PostgreSQL.

## 1. Base de datos

Crea una base llamada `skillmatch` y ejecuta primero:

```text
backend/sql/Psql_skillmatch.sql
```

Después aplica, en orden, las migraciones numeradas que necesite tu instalación:

```text
02_postgres_extra_tables.sql
03_alumnos_mejoras.sql
04_alumnos_fechas_password_logo.sql
05_admin_empresa_profesor_vinculacion.sql
06_separacion_admin_vinculacion.sql
07_proyectos_admin_vinculacion_profesor.sql
08_soft_skills_nombre_busqueda.sql
```

## 2. Backend

```powershell
cd backend
copy .env.example .env
# Edita .env y confirma que PORT=4000
npm install
npm run dev
```

Edita `backend/.env` antes de iniciar y coloca tus credenciales reales de PostgreSQL y servicios externos. El backend debe ejecutarse en `http://localhost:4000`, que es la URL utilizada por el frontend.


### Comprobación rápida

Antes de iniciar sesión, abre `http://localhost:4000/` en el navegador. Debe mostrar:

```text
API SkillMatch funcionando
```

En la terminal del backend deben aparecer mensajes similares a:

```text
Servidor corriendo en http://localhost:4000
Conectado a PostgreSQL
```

## 3. Frontend

En otra terminal:

```powershell
cd frontend
npm install
npm start
```

El frontend se abre normalmente en `http://localhost:3000`.

Para generar producción:

```powershell
npm run build
```

## Notas de seguridad

El archivo `.env` original no se distribuye dentro de esta entrega. Se incluye `.env.example` con valores de muestra para evitar exponer contraseñas o claves privadas. Conserva tus credenciales únicamente en tu archivo local `.env`.

## Estructura relevante

```text
SkillMatchWeb_Moderno/
├── backend/
│   ├── .env.example
│   ├── sql/
│   ├── src/
│   └── server.js
└── frontend/
    ├── build/
    ├── public/logos/
    └── src/
        ├── components/
        ├── CSS/
        └── pages/
```

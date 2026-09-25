# SkillMatch V2 - Ajustes realizados

Esta version conserva la arquitectura React + Express + PostgreSQL y agrega una primera capa de mejoras orientadas a produccion y al concepto real de SkillMatch.

## Cambios incluidos

### Multimedia y fotos
- La portada del proyecto queda separada de la galeria.
- La landing utiliza `img_principal` como portada.
- El detalle de proyecto muestra portada, galeria y evidencias en secciones independientes.
- Se filtra la portada cuando registros antiguos la tienen repetida dentro de `proyecto_media`.
- Fotos de perfil y multimedia soportan Cloudinary cuando las variables CLOUDINARY estan configuradas.
- Se mantiene almacenamiento local como fallback de desarrollo.
- Se ajusto la politica Cross-Origin-Resource-Policy para que frontend y backend en dominios distintos puedan mostrar archivos.

### SkillMatch
- `/api/vacantes/match-estudiantes` ahora calcula un porcentaje de coincidencia explicable.
- Se consideran tecnologias seleccionadas y, cuando existe, el resultado de habilidades blandas.
- La empresa ve porcentaje, coincidencias y brechas en lugar de un filtro de texto que se presentaba como IA.

### Habilidades blandas
- Nueva migracion con 21 reactivos situacionales.
- Se mantienen seis dimensiones compatibles con el modelo existente.
- Se agregan reactivos inversos para mejorar consistencia de respuesta.

### Perfiles
- Estudiante: objetivo profesional, biografia, disponibilidad, modalidad, ciudad, idiomas, LinkedIn, GitHub y portafolio.
- Profesor: grado academico, especialidad, biografia, LinkedIn, ORCID, horario de atencion y disponibilidad para mentorias.
- Administrador/Vinculacion: cargo, area, extension, oficina y descripcion profesional.

### Interfaz
- Sistema de iconos SVG minimalistas reutilizable.
- Navegacion de los dashboards principales migrada a iconos consistentes.
- Filtros/buscador reutilizables en las principales listas de Administracion/Vinculacion.
- Chatbot de Super Admin transformado en un Centro de conocimiento con buscador, filtros, metricas, editor y vista previa.

## IMPORTANTE antes del deploy

### 1. Ejecutar migraciones PostgreSQL
Ejecutar en orden:

```sql
\i 'backend/sql/09_skillmatch_v2_soft_skills.sql'
\i 'backend/sql/10_perfiles_profesionales.sql'
```

Si se ejecutan desde otra carpeta, usar la ruta absoluta al archivo.

### 2. Configurar Cloudinary en produccion
El backend utiliza estas variables:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Para produccion se recomienda configurarlas en el proveedor donde corre el backend. Si no existen, el sistema cae a almacenamiento local; en proveedores con filesystem efimero esos archivos pueden perderse despues de un redeploy/reinicio.

### 3. Instalar dependencias y probar antes de main
No se incluyen `node_modules` en este ZIP.

Backend:
```bash
cd backend
npm install
npm test
npm start
```

Frontend:
```bash
cd frontend
npm install
npm run build
```

### 4. Desplegar desde una rama de prueba
Recomendado:

```bash
git checkout -b feature/skillmatch-v2
git add .
git commit -m "SkillMatch V2: media, perfiles, match y UI"
git push origin feature/skillmatch-v2
```

Validar la URL de preview/staging y despues fusionar a `main`.

## Pruebas recomendadas

1. Crear un proyecto con portada + 2 imagenes + 1 video y validar landing/detalle.
2. Cambiar foto de estudiante, profesor y administrador, cerrar sesion y validar persistencia.
3. Abrir el mismo perfil desde Administrador/Vinculacion y verificar la foto.
4. Ejecutar la nueva evaluacion de habilidades blandas y confirmar 21 preguntas.
5. Desde Empresa seleccionar tecnologias y validar que los candidatos aparezcan ordenados por `% Match`.
6. Revisar perfiles nuevos de estudiante/profesor/admin.
7. Probar filtros de listas en escritorio y movil.
8. Probar alta/edicion/busqueda de respuestas en Chatbot.

## Siguiente fase sugerida

Esta entrega deja una base mas profesional, pero la evolucion mas valiosa seria convertir Empresa en un mini ATS: pipeline Nuevo > Revisado > Entrevista > Seleccionado/Rechazado, favoritos, comparador de candidatos, match por vacante y analitica. Tambien conviene estructurar habilidades en tablas normalizadas para que el match deje de depender de textos libres.

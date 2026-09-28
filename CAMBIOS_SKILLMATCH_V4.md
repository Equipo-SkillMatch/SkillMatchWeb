# SkillMatch V4.0 — Vacantes, Empresa, Postulaciones y multimedia

## Cambios principales

### 1. Vacantes con detalle antes de postularse
- El estudiante ya no necesita postularse desde una tarjeta con información mínima.
- Cada vacante tiene una vista detallada con empresa, ubicación, modalidad, tipo de oportunidad, horario, actividades, responsabilidades, requisitos, tecnologías, beneficios, plazas, fecha límite y salario/apoyo cuando la empresa decide publicarlo.
- La vista también presenta información de la empresa para que el alumno pueda evaluar la oportunidad antes de postularse.

### 2. Nueva vacante profesional para Empresa
- Formulario organizado por secciones: información general, actividades, perfil buscado y condiciones.
- Catálogo seleccionable de tecnologías requeridas y deseables.
- Catálogo de habilidades blandas prioritarias.
- Campos nuevos: modalidad, tipo de oportunidad, ubicación, horario, actividades, responsabilidades, requisitos obligatorios/deseables, experiencia, carrera preferida, salario/apoyo, plazas, fecha límite y beneficios.

### 3. Perfil de Empresa ampliado
- Descripción corporativa, sector, ubicación, domicilio, sitio web, LinkedIn, tamaño, año de fundación, cultura/valores, beneficios y proceso de selección.
- Información de responsable y contacto conservada.

### 4. Perfil de estudiante visto por Empresa
- Corregido el error 500 causado por columnas antiguas/no existentes en la consulta de proyectos.
- Vista más legible con perfil profesional, habilidades técnicas, idiomas, soft skills, proyectos y enlaces.
- Las tarjetas de postulantes usan foto de perfil cuando existe.

### 5. Vinculación — detalle de postulaciones
- Nueva acción `Ver detalle`.
- Vinculación puede consultar estudiante, vacante, empresa, fecha, estado, carrera, perfil profesional, habilidades y proyectos relacionados.

### 6. Proyectos y galería
- Portada limitada a proporción 16:9 y altura controlada.
- Galería responsive en tarjetas en lugar de archivos gigantes en una sola fila.
- Videos con reproductor y fallback cuando el archivo ya no existe.
- Se evita que el sidebar invada visualmente la galería.

### 7. Marcador de versión
- Backend: `4.0.0-vacantes-empresa-media`.
- Landing/Vinculación: `V4.0` para confirmar que el deploy correcto está en producción.

## Base de datos
Ejecutar `backend/sql/12_vacantes_empresas_v4.sql` después de las migraciones anteriores.

> Nota sobre multimedia histórico: V4 mejora la presentación y detección de archivos, pero no puede recuperar archivos que hayan desaparecido físicamente del almacenamiento local de Render. Para esos archivos debe re-subirse únicamente el archivo faltante. Se recomienda Cloudinary en producción.

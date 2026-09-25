# SkillMatch V3.1 — correcciones de producción

## Qué corrige esta versión

1. **Multimedia pública de proyectos**
   - La URL de `/uploads` ahora se deriva automáticamente del dominio configurado en `REACT_APP_API_BASE_URL`; ya no cae por defecto a `localhost` en producción.
   - Landing: usa portada; si no existe, usa la primera imagen/video disponible de la galería.
   - Detalle público: separa portada, galería del proyecto y evidencias.
   - Soporta imágenes y videos en la galería.

2. **Documentación / evidencias**
   - Se consolidaron dentro de `backend/uploads/evidencias` los PDF heredados que estaban en `frontend/uploads/evidencias`, para que las rutas históricas `uploads/evidencias/...` vuelvan a ser servidas por el backend cuando esos archivos sí existen en el repositorio.
   - Nueva migración `11_media_evidencias_v3.sql` agrega nombre, MIME, tamaño y hash a `evidencias`.
   - Se conservan y devuelven esos metadatos al subir archivos.
   - El detalle público y el administrador muestran documentación, imágenes y videos.
   - Se aceptan PDF, Word, Excel, PowerPoint, TXT y ZIP además de imágenes/videos.

3. **Perfil profesional del estudiante**
   - Campos visibles y editables: objetivo profesional, biografía, habilidades técnicas, LinkedIn, GitHub, portafolio, idiomas, disponibilidad, modalidad preferida y ciudad.
   - Perfil público rediseñado para empresas/administración.
   - Proyectos del estudiante muestran portada y tecnologías.

4. **CV SkillMatch**
   - Usa los logos reales de `frontend/public/logos/skillmatch-logo.png` y `uteq-logo.png`.
   - Incluye fotografía cuando está disponible, folio, fecha de generación, perfil profesional, habilidades, idiomas, disponibilidad, links, soft skills y proyectos.
   - Se aclara qué información proviene del perfil del usuario para no presentar como validada información que no lo está.

5. **Administrador**
   - `Ver proyectos` incluye miniatura, portada, galería, evidencias multimedia y documentación.
   - Filtros visibles: búsqueda, estado, tipo de autor para proyectos, situación académica para estudiantes y ordenamiento.
   - El detalle de alumno incluye los nuevos campos profesionales.

6. **Iconografía / UI**
   - Se amplió `AppIcon` con iconos SVG lineales y se sustituyeron emojis visibles en dashboards, registro, privacidad y términos.
   - Marcadores de compilación visibles: `SkillMatch V3.1` en Admin/Vinculación y en la landing.

## Diagnóstico de los archivos que ya no existen

Esta versión evita que los archivos nuevos dependan del disco local cuando Cloudinary está configurado. Sin embargo, si una imagen/video/documento antiguo estaba guardado solamente en el disco efímero del servidor y ese archivo ya desapareció después de un deploy/reinicio, **el código no puede reconstruir sus bytes**. Ese archivo deberá recuperarse desde respaldo o volver a subirse.

## Migración obligatoria

Después de desplegar el backend V3, o antes de usar las nuevas evidencias, ejecutar:

```sql
\i 'C:/RUTA/SkillMatchWeb/backend/sql/11_media_evidencias_v3.sql'
```

Debe terminar con:

`Migracion 11 aplicada. Evidencias y rutas multimedia preparadas para SkillMatch V3.`

## Variables de producción

### Backend

Configurar en el hosting, no en Git:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Cloudinary es altamente recomendado para producción. Sin él se usa fallback local y los archivos pueden perderse si el hosting usa disco efímero.

### Frontend

- `REACT_APP_API_BASE_URL=https://TU-BACKEND/api`
- `REACT_APP_UPLOADS_BASE_URL` ahora es opcional. Si se omite, se calcula automáticamente como `https://TU-BACKEND/uploads`.

## Cómo verificar que realmente se desplegó V3

Backend:

`GET https://TU-BACKEND/api/public/version`

Debe devolver algo equivalente a:

```json
{"ok":true,"version":"3.1.0-media-profile","storage":"cloudinary"}
```

Frontend:

- Landing: debe verse `V3.1` en el pie de página.
- Admin/Vinculación: debe verse `SkillMatch V3.1` en la parte inferior del menú lateral.

Si el backend devuelve V3.1 pero esos marcadores no aparecen en frontend, el problema no es caché del navegador: el hosting del frontend está construyendo otra rama, otro directorio o un deploy anterior.

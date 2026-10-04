# SkillMatch V6 — Estadías integradas

## Cambios funcionales

- El módulo de Estadías usa el mismo tema visual de los dashboards SkillMatch.
- Vinculación queda fuera del módulo de Estadías.
- Servicios Escolares puede consultar a todos los alumnos, agrupados y filtrables, y mantiene una vista separada de Seguro Facultativo solo para alumnos en estadía.
- Servicios Escolares dispone de Mi perfil y cambio de contraseña.
- Administrador puede editar periodos.
- Se agrega catálogo de grupos escolares por carrera/generación y asignación de alumnos a grupo.
- Al registrarse, un estudiante puede seleccionar un grupo escolar existente.
- Los profesores pueden activarse/desactivarse como Tutor de estadía y asociarse a una carrera.
- Generación automática de grupos de estadía con 1 a 6 alumnos, misma carrera, mezcla permitida entre grupos escolares de origen y un tutor distinto por grupo.
- Administrador puede cambiar manualmente el tutor por otro tutor activo de la misma carrera.
- Taller = Entrega. El administrador define apertura/cierre y puede editar talleres. Las fechas se propagan a los grupos del periodo.
- Profesor ya no configura fechas ni rúbricas.
- Los avances se entregan mediante enlace de Google Docs/Drive y comentario del alumno.
- Después del cierre no se aceptan nuevas entregas.
- Profesor registra notas/ajustes, solicita correcciones y asigna SA/DE/AU.
- La escala SA/DE/AU es configurable por Administrador; valores iniciales 8/9/10.
- Se calcula promedio de evaluación para el alumno en la vista del tutor.
- El profesor marca la memoria técnica como terminada; después el alumno puede subir el PDF final.
- El PDF final valida nomenclatura `grupo_nombre.pdf`.
- El expediente considera la memoria final para llegar al 100%.
- En el registro de estadía del alumno solo se pide el nombre de empresa; el sistema resuelve internamente si existe en el directorio.
- Se eliminan Área/Departamento y Tecnologías del registro de estadía.

## Migración

Ejecutar únicamente después de haber aplicado V5 (`13_estadias_v5.sql`):

```sql
\i 'C:/ruta/SkillMatchWeb/backend/sql/14_estadias_v6.sql'
```

La API pública cambia a:

`6.0.0-estadias-integradas`

## Corrección de acceso de Administrador a Estadías
- Se agregó **Estadías** al menú del Administrador.
- El acceso navega a `/estadias` y mantiene Vinculación sin acceso al módulo.
- Se actualizó la etiqueta visual del panel a **SkillMatch V6.0**.
- Se eliminó el archivo temporal `backend/src/routes/estadiaRoutes.js.tmp`.

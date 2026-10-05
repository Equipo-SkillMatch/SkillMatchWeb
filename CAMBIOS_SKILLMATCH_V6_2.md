# SkillMatch V6.2 — correcciones de grupos y asignaciones de estadía

## Registro de alumnos
- El catálogo de grupos escolares se muestra completo.
- Al seleccionar un grupo existente se completa automáticamente la carrera correspondiente.
- Se mantiene la posibilidad de escribir un grupo libremente cuando aún no existe en el catálogo.

## Periodos
- La opción **Grupos que salen** ahora abre una selección manual con casillas.
- El administrador decide exactamente qué grupos escolares participan en cada periodo.
- La selección previa se conserva al volver a editar el periodo.

## Formación de grupos de estadía
- La generación automática sigue usando únicamente los grupos escolares seleccionados para el periodo.
- Se corrigió la asignación de estudiantes para admitir tanto alumnos vinculados por `id_grupo_escolar` como registros anteriores que conservan el grupo en texto.
- Los alumnos se asignan realmente a `grupo_estudiantes_estadia` al crear cada grupo.

## Administración de alumnos de un grupo
- Se corrigió la consulta de alumnos disponibles que podía fallar en PostgreSQL por un parámetro sin tipo en `IS NULL`.
- La vista **Ver / administrar alumnos** carga los integrantes actuales y los alumnos disponibles de la misma carrera.
- La asignación manual mantiene máximo 6 alumnos y evita que un alumno esté en dos grupos del mismo periodo.

## Eliminación de grupos de estadía
- Se agregó **Eliminar grupo**.
- Si ningún alumno del grupo ha registrado todavía su estadía, la eliminación retira automáticamente las asignaciones y fechas relacionadas mediante las relaciones existentes de la BD.
- Si existen estadías registradas, el sistema bloquea la eliminación para evitar pérdida accidental de expedientes.

## Versión API
`6.2.0-estadias-asignacion-grupos`

## Base de datos
Esta actualización no requiere una migración SQL adicional; utiliza el esquema V6.1 existente.

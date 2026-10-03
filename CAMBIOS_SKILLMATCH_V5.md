# SkillMatch V5.0 — Módulo Institucional de Estadías

Esta versión agrega la primera implementación integral del flujo de estadías sobre la base de SkillMatch V4, sin eliminar los módulos existentes de vacantes, proyectos, perfiles, empresas o postulaciones.

## Nuevo rol institucional
- **Servicios Escolares (id_rol = 6)**.
- El rol no puede registrarse desde el formulario público.
- Acceso directo al módulo de expedientes y validación del seguro facultativo.

## Administración
- Configuración de periodos de estadía.
- Fechas generales del periodo y límites administrativos.
- Configuración de grupos y asignación de profesor asesor.
- Asignación de estudiantes a grupos.
- Configuración de talleres por periodo.
- Creación de rúbricas con criterios y pesos.
- Escala institucional preparada para **SA = 8, DE = 9, AU = 10**.
- Carga y versionado de guía de estadía.
- Consulta institucional de expedientes y seguros.

## Profesor asesor
- Consulta únicamente de los grupos que tiene asignados.
- Consulta de alumnos de cada grupo.
- Configuración independiente de las **3 fechas de avance** por grupo.
- Asignación de rúbrica por avance.
- Revisión de entregas.
- Calificación SA / DE / AU.
- Observaciones y solicitud de correcciones.

## Estudiante
- El profesor asesor se obtiene automáticamente del grupo; el alumno no puede cambiarlo.
- Registro de empresa de estadía:
  - empresa existente en SkillMatch; o
  - empresa externa sin necesidad de aprobación de Vinculación.
- Registro amplio del proyecto de estadía: área, problemática, objetivos, alcance, actividades, entregables, tecnologías, responsable empresarial y fechas.
- Creación automática del **Expediente Digital Único de Estadía**.
- Registro y envío de información del seguro facultativo a Servicios Escolares.
- Consulta de las 3 fechas de avance.
- Carga versionada de avances.
- Bloqueo de entregas posteriores a la fecha límite.
- Consulta de calificación y observaciones del profesor.
- Consulta de guía de estadía vigente e históricas.

## Servicios Escolares
- Consulta de expedientes de estudiantes.
- Consulta de información personal, académica, empresa, proyecto, profesor y seguro.
- Validación del seguro facultativo.
- Estados: pendiente, en revisión, validado, requiere corrección y rechazado.
- Observaciones institucionales visibles para el estudiante.

## Expediente Digital Único
- Folio automático `EST-AÑO-000000`.
- Relación única estudiante + periodo.
- Contiene empresa, proyecto, grupo, asesor, seguro y entregas.
- Indicador de avance del expediente.
- El porcentaje se actualiza con validación del seguro y aprobación de avances.

## Seguridad
- Servicios Escolares queda bloqueado en registro público.
- Los profesores sólo pueden consultar grupos y entregas que les pertenecen.
- Los estudiantes sólo pueden consultar su grupo/calendario y su propia estadía.
- Los endpoints institucionales verifican rol desde el JWT.

## Base de datos
Ejecutar `backend/sql/13_estadias_v5.sql` antes de publicar V5.

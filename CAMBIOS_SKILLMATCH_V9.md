# SkillMatch V9.0 - Flujo oficial de Estadías UTEQ

Esta versión toma como base V8.5 y reorganiza el módulo de Estadías conforme al flujo oficial definido con profesores y documentos de referencia institucionales.

## Cambios principales
- Nuevo rol `administrador_estadias` (id 10), administrado por el Súper Administrador y asociado a carrera.
- Registro inicial del alumno simplificado: nombre del proyecto, RFC/empresa y horario laboral.
- Búsqueda de empresa por RFC; si existe se reutiliza razón social, si no, el alumno captura solo el nombre y el asesor completa el expediente.
- Expediente oficial del proyecto para el asesor basado en el formato “Datos para registrar el proyecto de estadía”.
- Tres comprobantes iniciales: cuatrimestre, seguro facultativo e inscripción; revisados por Servicios Escolares.
- Carta de inicio formal: autollenada, impresión, correo preparado y carga de versión firmada.
- Inicio formal bloqueado hasta aprobar comprobantes, completar expediente y cargar carta de inicio firmada.
- Primera evaluación de empresa se crea automáticamente al autorizar el inicio formal.
- Al aprobar los 3 talleres se habilita automáticamente la memoria final y la evaluación final de empresa.
- Donativo e Inglés funcionan como pasos independientes después de la memoria final.
- Nuevas aprobaciones oficiales: Dirección, Vinculación, confirmación de datos del alumno y pago de título.
- Carta de finalización/liberación y autorización de presentación de memoria solo se liberan cuando las validaciones oficiales están aprobadas.
- Toma de protesta requiere documentos finales firmados.
- El jurado primero acepta/rechaza la fecha propuesta desde su enlace; llegada la fecha, el mismo enlace habilita la evaluación de 5 preguntas.
- Tablero institucional tipo tabla verde con estados automáticos de todo el flujo.
- Preparación para correos: modal de envío y tabla de eventos, sin SMTP/API habilitado todavía.
- Documentos oficiales rediseñados con logos UTEQ/SkillMatch y datos automáticos del expediente.
- Usuarios demo: súper administradores, administradores por carrera, profesores y alumnos.

## Migración
Ejecutar una sola vez:
`backend/sql/22_estadias_v9_flujo_oficial.sql`

## Contraseña de usuarios demo
`SkillMatch123`

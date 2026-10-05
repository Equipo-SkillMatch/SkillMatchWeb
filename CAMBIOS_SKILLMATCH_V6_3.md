# SkillMatch V6.3 — experiencia institucional y seguimiento de estadías

## Ajustes principales

- Se retiró el texto informativo interno sobre detección de empresas en la vista del alumno.
- El horario laboral del alumno ahora se captura mediante selección de días, hora de entrada y hora de salida.
- Al guardar la información de estadía se muestra una notificación institucional: "Información guardada con éxito".
- El profesor puede consultar desde su grupo el detalle del alumno, empresa, responsable, horario y proyecto de estadía.
- Se eliminaron del frontend las ventanas nativas `alert`, `confirm` y `prompt` y se sustituyeron por notificaciones y modales institucionales reutilizables.
- El seguro facultativo enviado por el alumno queda en estado `en_revision`.
- Servicios Escolares es el único rol que acepta, solicita corrección o rechaza el seguro.
- El Administrador puede consultar en una tabla a todos los estudiantes con estadía, incluso si todavía no registraron seguro, junto con su estatus.
- Una vez validado el seguro, el alumno puede consultar los datos registrados y abrir su comprobante.
- Se agregaron métricas visuales para el control de seguros y modales de detalle.
- La API pública reporta `6.3.0-estadias-experiencia-institucional`.

## Base de datos

No requiere una migración SQL adicional. Se utilizan columnas y tablas existentes de V6/V6.1.

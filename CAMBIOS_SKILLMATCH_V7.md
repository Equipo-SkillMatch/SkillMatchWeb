# SkillMatch V7.0 — Evaluaciones, seguimiento y expediente integral

## Cambios funcionales

### Alumno / empresa de estadía
- El alumno busca primero la empresa por RFC o razón social.
- Si la empresa está habilitada en el directorio de SkillMatch, los datos institucionales se cargan automáticamente.
- Si no existe coincidencia, el alumno puede capturar la información de forma manual.

### Evaluación del profesor por taller
- Cada entrega corresponde a un taller.
- Taller 1: Resumen + Abstract, Definición del problema, Justificación y Objetivos.
- Taller 2: Entregables, Recursos utilizados, Cronograma y Desarrollo del proyecto.
- Taller 3: Análisis de resultados, Conclusiones, Referencias y Apéndice.
- Cada criterio registra Entregado / Completo, nivel y observación.
- La calificación del taller se calcula automáticamente con el promedio ponderado de sus criterios.
- La escala institucional queda parametrizada en BD: NA, CO, CD y CA. Los valores son configurables desde Administración.
- Se conserva compatibilidad histórica con SA/DE/AU.

### Evaluación de la empresa
- El profesor puede generar dos evaluaciones: primera evaluación y evaluación final.
- SkillMatch genera un enlace público con token y vigencia para compartir con el responsable de la empresa.
- Se agregó botón para preparar el correo al responsable.
- El formulario contiene 10 preguntas divididas en Desempeño y Actitud.
- Las 10 preguntas incluidas son una propuesta editable; deben sustituirse si la UTEQ entrega el cuestionario oficial.
- La empresa puede responder desde el enlace sin cuenta.
- Las empresas registradas en SkillMatch también tienen el apartado “Evaluación practicantes”.
- El profesor consulta estado, respuestas y calificación de ambas evaluaciones.

### Expediente Digital Único
- Integra datos del alumno, empresa, proyecto, seguro, inicio formal, talleres, evaluaciones de empresa, seguimiento y memoria final.
- Agrega un checklist institucional con estados.
- El porcentaje del expediente se recalcula considerando los componentes principales del proceso.

### Inicio formal y seguimiento
- El profesor/administrador puede confirmar fecha real y autorizar el inicio formal.
- Se conserva quién autorizó y cuándo.
- Se agregó bitácora de seguimiento con: inicio, seguimiento, incidencia, reunión, acuerdo y cierre.
- Cada registro puede incluir acuerdos y próxima fecha de revisión.

### Entrega y control de avances
- El profesor evalúa cada taller por apartados.
- El alumno puede consultar su retroalimentación por criterio.
- Se conserva el flujo de Google Docs y comentarios de entrega.
- Los estados de la entrega se actualizan de acuerdo con la revisión y correcciones.

## Versión API
`7.0.0-estadias-evaluacion-seguimiento`

## Migración requerida
Ejecutar una sola vez, después de las migraciones 13, 14 y 15:

`backend/sql/16_estadias_v7_evaluaciones_seguimiento.sql`

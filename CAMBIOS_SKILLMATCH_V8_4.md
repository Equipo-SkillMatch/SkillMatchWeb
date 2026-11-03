# SkillMatch V8.4 — Toma de protesta con 3 evaluadores

## Correcciones
- Se corrige el HTTP 500 de `/api/estadias/profesor/estadias/:idEstadia/evaluadores` causado por un filtro PostgreSQL con parámetro nulo de tipo ambiguo.
- El catálogo de evaluadores intenta respetar la carrera de la estadía y tiene fallback para registros históricos sin `id_carrera` normalizado.

## Hoja previa a toma de protesta
- Antes de programar la toma, el asesor genera y descarga una **Hoja de liberación previa** en PDF.
- Incluye alumno, matrícula, carrera, periodo, proyecto, empresa, responsable y tutor académico.
- Contiene espacios de firma para alumno, empresa y tutor.
- SkillMatch registra que la hoja fue generada; sin ese paso no permite programar la toma.

## Programación de toma
- Ahora requiere **3 profesores evaluadores diferentes**.
- El calendario acepta solo lunes a viernes; sábados y domingos se rechazan tanto en frontend como backend.
- Cada evaluador recibe un token/enlace individual.
- Los enlaces se habilitan al llegar la fecha y hora programadas.

## Evaluación pública del jurado
- Nueva ruta pública `/toma-protesta/:token`.
- 5 preguntas de evaluación.
- Cada pregunta recibe calificación de 0 a 10.
- El sistema calcula el promedio del evaluador.
- Cada profesor emite dictamen **Aprobar** o **Rechazar** y puede agregar observaciones.
- La estadía termina únicamente cuando los 3 evaluadores han respondido y los 3 aprueban.

## Acta final
- Cuando la toma queda aprobada se habilita **Acta final de estadía** en PDF.
- Incluye periodo, proyecto, empresa, tutor, promedio de talleres del profesor asesor, evaluación final de empresa, calificación de memoria por empresa y las tres calificaciones del jurado.

## Profesores de prueba
La migración 21 intenta detectar la carrera de TI actual y agrega:
- Laura Fernanda Mendoza Ruiz — `laura.mendoza@uteq.edu.mx`
- Ricardo Salazar Ortega — `ricardo.salazar@uteq.edu.mx`
- Mariana Alejandra Torres Vega — `mariana.torres@uteq.edu.mx`

Contraseña de prueba: `SkillMatch123`

## Migración
Ejecutar una sola vez:

```sql
\i 'C:/Users/danie/OneDrive/Desktop/SkillMatchWeb/backend/sql/21_estadias_v8_4_toma_protesta_3_evaluadores.sql'
```

# SkillMatch V8.3 · UX de cierre, profesor y empresa

## Alumno
- El menú `Seguro facultativo` cambia a `Servicios Escolares`.
- Servicios Escolares concentra seguro facultativo y donativo de cierre.
- Se agrega menú `Idiomas` para subir certificado/evidencia de inglés.
- Se corrige el estado de memoria final autorizada para que no aparezca pendiente después de que el asesor la habilita y el alumno carga el PDF.

## Profesor
- `Avances por revisar` muestra cada alumno una sola vez.
- Al abrir un alumno se muestran sus talleres habilitados, entregas recibidas y estado de evaluación.
- `Evaluación de empresa` se convierte en una bandeja por alumno con tres acciones: primera evaluación, evaluación final y revisión/calificación de memoria técnica.
- La programación de toma de protesta aclara de dónde salen los profesores evaluadores.

## Validaciones institucionales
- Se rediseñan los modales de revisión de comprobantes y documentos para separar memoria, documento del área, referencia/monto y observaciones.

## Backend
- Nuevos endpoints de profesor: `/profesor/alumnos-avances` y `/profesor/empresa-resumen`.
- Al habilitar la memoria final se establece también `memoria_final_autorizada=TRUE`.
- Se conserva la corrección del nombre de archivo PDF y el origen de Vercel en CORS.

## SQL
Ejecutar únicamente:

`backend/sql/20_estadias_v8_3_ux_y_flujo.sql`

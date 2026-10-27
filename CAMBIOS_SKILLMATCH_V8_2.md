# SkillMatch V8.2 - Flujo simplificado de memoria final

## Objetivo
Reducir pasos manuales y corregir la sincronización entre alumno, profesor, empresa y áreas institucionales durante el cierre de estadía.

## Cambios
- La memoria final cargada por el alumno se registra de inmediato en Biblioteca, Laboratorios y revisión de Empresa.
- Si la memoria ya existía antes de V8.2, la migración 19 crea las revisiones faltantes sin borrar información.
- El profesor puede generar/copiar un enlace único por alumno para revisión empresarial de la memoria.
- La vista pública empresarial tiene dos pasos: Revisar memoria -> Calificar y emitir dictamen.
- La empresa califica la memoria con 8, 9 o 10, agrega comentario y puede aprobar, solicitar corrección o rechazar.
- Si se rechaza/solicita corrección, el comentario es obligatorio; el alumno puede reemplazar el PDF y la misma liga vuelve a servir para la nueva versión.
- El alumno ve la memoria cargada, versión y estados de revisión.
- Biblioteca y Laboratorios reciben automáticamente la memoria PDF.
- Centro de Idiomas sigue validando el comprobante de examen; cuando su solicitud existe también puede consultar la memoria final como contexto.
- El perfil de Empresa usa el mismo mecanismo de guardado que el enlace público para las evaluaciones de practicantes.
- Las evaluaciones contestadas muestran código/promedio y las respuestas almacenadas al volver a abrirlas.
- Se reparan textos de preguntas que podían aparecer con caracteres como `tÃ©cnicos`.

## Migración
Ejecutar únicamente después de la migración 18:

\i 'C:/Users/danie/OneDrive/Desktop/SkillMatchWeb/backend/sql/19_estadias_v8_2_memoria_flujo_simple.sql'

No volver a ejecutar migraciones anteriores.

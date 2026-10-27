# SkillMatch V8.1 - Ajustes de cierre institucional

## Cambios incluidos

1. Corrige caracteres mojibake en la escala institucional (Competente autónomo).
2. Una entrega marcada con correcciones conserva su calificación y estado aprobado. Las observaciones se muestran como correcciones a incorporar en el siguiente taller.
3. La memoria final muestra archivo, versión y fecha de carga; puede reemplazarse después de un rechazo.
4. La empresa puede abrir el PDF final y aprobarlo con calificación 8, 9 o 10, o solicitar corrección/rechazar.
5. Biblioteca, Laboratorios y Centro de Idiomas pueden abrir la memoria técnica final; cada área mantiene sus documentos propios de validación.
6. Si se reemplaza la memoria, Biblioteca, Laboratorios y Empresa vuelven automáticamente a estado En revisión.
7. El donativo usa referencia automática y monto configurable por periodo. El alumno carga el comprobante y Servicios Escolares aprueba/rechaza.
8. Alumno y profesor tienen una ruta visual de progreso con requisitos, validaciones, porcentaje y siguiente paso.
9. Se corrigió el SQL opcional de usuarios institucionales para evitar problemas de codificación.

## Migración requerida

Ejecutar una sola vez después de la migración 17:

\i 'C:/Users/danie/OneDrive/Desktop/SkillMatchWeb/backend/sql/18_estadias_v8_1_ajustes_cierre.sql'

## Importante

Después de aplicar la migración 18, Administración debe editar el periodo de estadía activo y capturar el monto de donativo correspondiente.

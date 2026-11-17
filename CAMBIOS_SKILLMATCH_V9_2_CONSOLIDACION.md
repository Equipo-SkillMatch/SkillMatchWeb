# SkillMatch V9.2 — Consolidación profunda del flujo de Estadías

Esta versión consolida el flujo oficial de Estadías sobre V9.1 y elimina rutas/acciones heredadas que permitían duplicar pasos o dejar al usuario sin saber qué seguía.

## Cambios estructurales

- La aprobación de **Dirección** pertenece al **Súper Administrador**.
- El **Administrador de Estadías** queda como responsable operativo de su carrera: formación de grupos, tutores, talleres, expedientes y seguimiento, con consultas y acciones restringidas a su carrera.
- **Servicios Escolares** controla fechas oficiales del periodo y ventanas de pago.
- La memoria técnica sigue un único flujo canónico: asesor autoriza → **empresa aprueba primero** → se habilitan automáticamente Biblioteca, Laboratorios, Dirección y Vinculación.
- Se eliminó la solicitud manual redundante de aprobaciones finales.
- Vinculación ahora cuenta con revisión de memoria técnica y aprobación propia.
- El cierre oficial usa 9 validaciones: empresa_memoria, biblioteca, laboratorios, centro_idiomas, servicios_escolares, direccion, vinculacion, datos_alumno y pago_titulo.

## Documentación inicial y seguro

- Inscripción y pago de cuatrimestre se consolidan en un solo requisito.
- Solo existen dos comprobantes iniciales: inscripción/pago de cuatrimestre y seguro facultativo.
- El NSS ya no lo captura el alumno; lo administra Servicios Escolares.
- La migración genera NSS ficticios de 11 dígitos para cuentas de prueba que no tengan uno.
- No se puede reemplazar un archivo enviado mientras esté en revisión/aprobado; solo después de rechazo o solicitud de corrección.

## Documentos oficiales

- El tablero diferencia documento **generado** y documento **firmado/subido**.
- No se puede subir una versión firmada si el documento no fue generado previamente.
- Carta de inicio: exige expediente oficial + comprobantes iniciales aprobados.
- Carta de finalización y autorización de presentación: exigen todas las validaciones oficiales aprobadas.
- Toma de protesta: exige documentos finales firmados y cierre oficial completo.
- Acta final: solo se libera con la Estadía terminada.

## Flujo guiado y UX

- El tablero oficial incluye una columna **Acción actual** que indica el siguiente paso real.
- Los botones se habilitan progresivamente; se retiraron acciones duplicadas de evaluaciones y aprobaciones.
- El alumno ve módulos de manera progresiva según el estado de su Estadía.
- El alumno también ve su ruta de avance.
- Servicios Escolares agrupa comprobantes por alumno, con búsqueda y separación Pendientes/Aprobados.
- El profesor gestiona el flujo desde Mis grupos/Expediente y conserva vistas de consulta de datos ya generados.
- Se corrigieron mensajes/toasts para mostrarse por encima de ventanas modales.

## Administrador de Estadías

- Se corrigieron pantallas en blanco provocadas por vistas restringidas únicamente a role=1.
- Nueva vista **Formación de grupos**.
- Ve los periodos definidos por Servicios Escolares en modo lectura.
- Selecciona únicamente grupos escolares de su carrera para participar en Estadías.
- Generar grupos no modifica los grupos administrados por otras carreras.
- Asignaciones y consultas quedan verificadas también en backend, no solo en frontend.

## Responsive y tablas

- Tableros grandes cuentan con desplazamiento horizontal real y visible.
- Primera columna fija para mantener identificado al alumno.
- Búsqueda por nombre/matrícula y filtro por grupo.
- Adaptación de navegación, tarjetas, formularios y modales para laptop, tablet y celular.

## Correcciones generales

- Correcciones de cadenas UTF-8/mojibake en datos institucionales comunes.
- Se retiró la captura/enlace de ubicación innecesario en talleres.
- Se corrigió la asociación de alumnos/grupos para que los grupos disponibles se filtren correctamente.
- Se mantiene la integración de correo V9.1 preparada, con MAIL_PROVIDER=disabled por defecto.

## Migraciones

1. `23_usuarios_institucionales_skillmatch.sql` — usuarios institucionales de prueba con perfiles completos.
2. `24_estadias_v9_2_consolidacion_flujo.sql` — consolidación de documentos iniciales, ventanas de pago, NSS y correcciones de codificación.

## Validación realizada

- Sintaxis de todos los archivos JavaScript de backend: OK.
- Parseo JSX de las vistas principales modificadas: OK.
- No quedan referencias activas al endpoint manual `solicitar-aprobaciones-finales`.
- No quedan llamadas activas del frontend al flujo antiguo de seguro facultativo.

El build completo de React no pudo ejecutarse en el entorno de empaquetado porque `react-scripts` no está instalado allí. Vercel realizará la compilación real al desplegar.

# SkillMatch V6.1 — ajustes de control de estadías

- Asignación de alumnos a grupos escolares corregida y sincronizada con el nombre del grupo.
- Filtro por grupo en la administración de alumnos.
- Registro público permite escribir el grupo libremente y muestra los grupos dados de alta como sugerencias.
- Formación automática de grupos de estadía conserva asignación aleatoria de tutor y permite cambio manual.
- Administración de alumnos dentro de cada grupo de estadía: ver, agregar y retirar antes de que registren su estadía.
- Resumen de Administración agrega gráficas de grupos por carrera, periodo y alumnos por grupo.
- Eliminación segura de periodos (bloqueada si ya contienen estadías).
- Eliminación segura de talleres (bloqueada si ya tienen entregas).
- Actualizaciones del módulo ya no sustituyen toda la pantalla por el cargador; la carga completa solo se usa al entrar.
- El menú del alumno muestra "Mi estadía" únicamente cuando está asignado a un grupo de estadía activo.
- API reporta versión 6.1.0-estadias-control-grupos.

## Migración
Ejecutar después de 14_estadias_v6.sql:

`backend/sql/15_estadias_v6_1.sql`

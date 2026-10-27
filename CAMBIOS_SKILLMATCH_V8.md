# SkillMatch V8 — Cierre institucional y toma de protesta

## Objetivo
Cerrar formalmente el ciclo de estadía después de las evaluaciones académicas y empresariales, incorporando las liberaciones institucionales y la toma de protesta.

## Nuevos roles institucionales
- Rol 7: Biblioteca
- Rol 8: Laboratorios
- Rol 9: Centro de Idiomas

Los tres roles ingresan al módulo de Estadías y únicamente ven las solicitudes que deben validar.

## Flujo de cierre
1. La estadía debe tener inicio formal autorizado, seguro validado, tres talleres aprobados, evaluación final de empresa respondida y memoria técnica autorizada por el asesor.
2. El alumno inicia el cierre institucional.
3. SkillMatch envía en paralelo a Biblioteca y Laboratorios y genera la revisión de memoria técnica por la empresa.
4. Cuando Biblioteca y Laboratorios aprueban, se habilita la carga del comprobante del examen aprobado de inglés.
5. Centro de Idiomas aprueba o rechaza el comprobante.
6. Cuando Centro de Idiomas aprueba, se habilita el comprobante de donativo.
7. Servicios Escolares aprueba o rechaza el donativo.
8. La empresa aprueba la memoria técnica o solicita correcciones por información sensible.
9. Con las cinco validaciones aprobadas, el asesor puede programar la toma de protesta.
10. El asesor selecciona exactamente dos profesores evaluadores, fecha, hora y lugar.
11. Cada profesor evaluador registra su calificación y observaciones.
12. Cuando ambas evaluaciones son aprobatorias, SkillMatch marca la estadía como terminada y el expediente queda cerrado al 100%.

## Nuevas tablas
- `validaciones_cierre_estadia`
- `tomas_protesta`
- `toma_protesta_evaluadores`
- `evaluaciones_toma_protesta`

## Progreso del expediente V8
- Etapa académica y operativa previa: 70%
- Cinco validaciones institucionales: 20% (4% cada una)
- Toma de protesta aprobada: 10%
- Total: 100%

## Empresa
Las empresas con cuenta SkillMatch tienen `Memorias por aprobar` en su panel. Las empresas externas pueden usar un enlace público seguro generado al iniciar el cierre.

## Migración
Ejecutar solamente después de la migración 16:

`backend/sql/17_estadias_v8_cierre_institucional.sql`

No volver a ejecutar migraciones anteriores si ya están aplicadas.

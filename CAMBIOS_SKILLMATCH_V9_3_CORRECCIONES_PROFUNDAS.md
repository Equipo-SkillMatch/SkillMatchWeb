# SkillMatch V9.3 — Correcciones profundas del flujo de Estadías

Esta versión corrige las causas estructurales detectadas durante la prueba completa de V9.2.

## Cambios principales

1. **Expediente / tablero del profesor**
   - Tabla institucional azul.
   - Navegación horizontal explícita con botones Anterior / Siguiente.
   - Columnas agrupadas por etapa del proceso.
   - Primera columna fija para no perder de vista al alumno.
   - Ya no es necesario reducir el zoom del navegador para recorrer el flujo.

2. **Validación de memorias técnicas**
   - Vinculación cuenta con acceso visible a `Validar memorias técnicas`.
   - Súper Administrador cuenta con acceso visible a la misma sección para la aprobación de Dirección.
   - Solo aparecen memorias que ya fueron aprobadas por la empresa.
   - Vinculación y Dirección conservan validaciones independientes.

3. **Asignación de grupos escolares**
   - Se corrigió la detección de carrera para alumnos que todavía no tienen grupo.
   - La compatibilidad ya no depende únicamente del texto de la carrera.
   - El backend impide asignaciones entre carreras diferentes.
   - Administradores de Estadía continúan limitados a su carrera asignada.

4. **Corrección de caracteres dañados**
   - La migración 25 corrige registros existentes con secuencias como `GestiÃ³n`, `SofÃ­a`, `PeÃ±a`, `VinculaciÃ³n`, etc.
   - Se corrigen usuarios, estudiantes, carreras, grupos escolares, profesores y datos de titulación afectados.

5. **Vista del alumno**
   - Se elimina la lista vertical duplicada de todos los estados en `Mi estadía`.
   - Se muestra únicamente la etapa actual con una explicación breve.
   - El detalle completo continúa disponible en `Cierre de estadía`.

6. **Datos para título**
   - Nuevo expediente de datos de titulación independiente del perfil general.
   - Antes de confirmar, el alumno ve: nombre, apellidos, matrícula, carrera, año de inicio y año de finalización.
   - Puede editar y guardar correcciones antes de confirmar.
   - Una vez confirmado, los datos quedan congelados para documentos finales.
   - Los documentos finales toman este snapshot confirmado.

## Migración requerida

Ejecutar después de haber aplicado la migración 24:

```sql
\i 'C:/Users/danie/OneDrive/Desktop/SkillMatchWeb/backend/sql/25_estadias_v9_3_correcciones_integrales.sql'
```

Resultado esperado:

`Migracion 25 aplicada. SkillMatch V9.3 correcciones integrales listas.`

# SkillMatch V8.5 — Cierre final del ciclo de estadías

## Objetivo
Cerrar formalmente el ciclo de estadías y separar el periodo activo del historial académico sin eliminar información.

## Cambios principales

### Administrador
- Las fechas del periodo se presentan explícitamente como **Inicio de estadía** y **Fin de estadía**.
- Backend valida que la fecha final no sea anterior a la inicial.
- Los periodos muestran estado de calendario: Próxima, En curso o Finalizada.
- Al abrir un nuevo periodo/grupo no se borran estadías anteriores.

### Profesor asesor
- Nuevo módulo **Estadías terminadas** cuando el profesor ya tiene al menos una estadía concluida.
- El módulo histórico permite filtrar por grupo.
- Solo muestra alumnos terminados y su acta final.
- Los alumnos terminados salen de la bandeja operativa de Toma de protesta para evitar mezclar ciclos activos e históricos.
- El acta final se puede volver a generar, consultar, imprimir o descargar en cualquier momento.

### Alumno
- Cuando la toma de protesta queda aprobada y la estadía cambia a `terminada`, desaparecen los módulos operativos de estadía.
- Solo queda **Estadía terminada**.
- Se muestra una pantalla de felicitación con expediente cerrado al 100%.
- Botón único para **Imprimir / descargar acta final**.

### Documentos
- Hoja de liberación previa y acta final rediseñadas con formato institucional.
- Se incorporan los logos UTEQ y SkillMatch desde `/public/logos`.
- Encabezado, marco, jerarquía tipográfica, áreas de datos, firmas y pie documental mejorados.

### Pantallas emergentes
- Overlay con blur.
- Encabezado institucional azul.
- Mejor jerarquía de títulos y subtítulos.
- Formularios con grid, campos uniformes y mejor espaciado.
- Modales heredados del módulo también reciben estilo formal.

## Base de datos
V8.5 no agrega columnas ni tablas. Si V8.4 ya fue instalada y se ejecutó la migración 21, **no hay migración 22**.

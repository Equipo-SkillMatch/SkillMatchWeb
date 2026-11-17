-- ============================================================
-- SKILLMATCH V9.2 - CONSOLIDACION REAL DEL FLUJO OFICIAL
-- Ejecutar DESPUES de 23_usuarios_institucionales_skillmatch.sql
-- ============================================================
BEGIN;

-- Servicios Escolares administra el NSS de cada alumno.
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS numero_seguro_social VARCHAR(20);

-- Ventanas oficiales de pago por periodo.
ALTER TABLE periodos_estadia
  ADD COLUMN IF NOT EXISTS fecha_inicio_donativo DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_donativo DATE,
  ADD COLUMN IF NOT EXISTS fecha_inicio_pago_titulo DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_pago_titulo DATE;

-- Unificar inscripción + pago de cuatrimestre como un solo requisito.
-- Si hay ambos registros, se conserva primero el de inscripción y se elimina el duplicado de cuatrimestre.
DELETE FROM comprobantes_inicio_estadia c
USING comprobantes_inicio_estadia i
WHERE c.id_estadia=i.id_estadia AND c.tipo='cuatrimestre' AND i.tipo='inscripcion';
UPDATE comprobantes_inicio_estadia SET tipo='inscripcion' WHERE tipo='cuatrimestre';
ALTER TABLE comprobantes_inicio_estadia DROP CONSTRAINT IF EXISTS comprobantes_inicio_estadia_tipo_check;
ALTER TABLE comprobantes_inicio_estadia ADD CONSTRAINT comprobantes_inicio_estadia_tipo_check
  CHECK(tipo IN ('inscripcion','seguro_facultativo'));

-- Los NSS de prueba quedan completos para poder generar cartas automáticas.
WITH alumnos AS (
  SELECT e.id_estudiante, ROW_NUMBER() OVER (ORDER BY e.id_estudiante) n
  FROM estudiantes e
  JOIN usuarios u ON u.id_usuario=e.id_estudiante
  WHERE u.estado='activo' AND e.numero_seguro_social IS NULL
)
UPDATE estudiantes e
SET numero_seguro_social = '442' || LPAD((10000000 + alumnos.n)::text, 8, '0')
FROM alumnos
WHERE e.id_estudiante=alumnos.id_estudiante;


-- Reparar textos heredados con codificación UTF-8 interpretada incorrectamente.
UPDATE carreras SET nombre = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(nombre,
  'GestiÃ³n','Gestión'),'MecatrÃ³nica','Mecatrónica'),'IngenierÃ­a','Ingeniería'),
  'TecnologÃ­as','Tecnologías'),'InformaciÃ³n','Información'),'EstadÃ­a','Estadía')
WHERE nombre LIKE '%Ã%';

UPDATE estudiantes SET carrera = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(carrera,
  'GestiÃ³n','Gestión'),'MecatrÃ³nica','Mecatrónica'),'IngenierÃ­a','Ingeniería'),
  'TecnologÃ­as','Tecnologías'),'InformaciÃ³n','Información'),'EstadÃ­a','Estadía')
WHERE carrera LIKE '%Ã%';

UPDATE grupos_estadia SET carrera = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(carrera,
  'GestiÃ³n','Gestión'),'MecatrÃ³nica','Mecatrónica'),'IngenierÃ­a','Ingeniería'),
  'TecnologÃ­as','Tecnologías'),'InformaciÃ³n','Información'),'EstadÃ­a','Estadía')
WHERE carrera LIKE '%Ã%';

UPDATE usuarios
SET cargo_institucional = CASE WHEN cargo_institucional LIKE '%Ã%' THEN REPLACE(REPLACE(REPLACE(cargo_institucional,'GestiÃ³n','Gestión'),'DirecciÃ³n','Dirección'),'CoordinaciÃ³n','Coordinación') ELSE cargo_institucional END,
    area_institucional = CASE WHEN area_institucional LIKE '%Ã%' THEN REPLACE(REPLACE(REPLACE(REPLACE(area_institucional,'TecnologÃ­as','Tecnologías'),'InformaciÃ³n','Información'),'GestiÃ³n','Gestión'),'MecatrÃ³nica','Mecatrónica') ELSE area_institucional END
WHERE COALESCE(cargo_institucional,'') LIKE '%Ã%' OR COALESCE(area_institucional,'') LIKE '%Ã%';

COMMIT;
SELECT 'Migracion 24 aplicada. SkillMatch V9.2 consolidado.' AS resultado;

BEGIN;

ALTER TABLE evidencias
  ADD COLUMN IF NOT EXISTS nombre_original VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS tamano_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS hash_archivo VARCHAR(64);

ALTER TABLE evidencias
  ALTER COLUMN ruta_archivo TYPE TEXT;

ALTER TABLE proyectos
  ALTER COLUMN img_principal TYPE TEXT;

ALTER TABLE proyecto_media
  ALTER COLUMN ruta_archivo TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_evidencias_proyecto ON evidencias(id_proyecto);

UPDATE evidencias
SET mime_type = CASE
  WHEN LOWER(split_part(ruta_archivo, '?', 1)) ~ '\.(jpg|jpeg)$' THEN 'image/jpeg'
  WHEN LOWER(split_part(ruta_archivo, '?', 1)) ~ '\.png$' THEN 'image/png'
  WHEN LOWER(split_part(ruta_archivo, '?', 1)) ~ '\.webp$' THEN 'image/webp'
  WHEN LOWER(split_part(ruta_archivo, '?', 1)) ~ '\.mp4$' THEN 'video/mp4'
  WHEN LOWER(split_part(ruta_archivo, '?', 1)) ~ '\.webm$' THEN 'video/webm'
  WHEN LOWER(split_part(ruta_archivo, '?', 1)) ~ '\.mov$' THEN 'video/quicktime'
  WHEN LOWER(split_part(ruta_archivo, '?', 1)) ~ '\.pdf$' THEN 'application/pdf'
  ELSE mime_type
END
WHERE mime_type IS NULL OR mime_type = '';

UPDATE evidencias
SET nombre_original = regexp_replace(split_part(ruta_archivo, '?', 1), '^.*/', '')
WHERE (nombre_original IS NULL OR nombre_original = '')
  AND ruta_archivo IS NOT NULL;

COMMIT;

SELECT 'Migracion 11 aplicada. Evidencias y rutas multimedia preparadas para SkillMatch V3.' AS resultado;

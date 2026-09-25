-- =========================================================
-- SKILLMATCH V2 - Perfiles profesionales ampliados
-- Campos opcionales para dar más contexto a estudiantes y profesores.
-- =========================================================
BEGIN;


ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cargo_institucional VARCHAR(140),
  ADD COLUMN IF NOT EXISTS area_institucional VARCHAR(140),
  ADD COLUMN IF NOT EXISTS extension VARCHAR(30),
  ADD COLUMN IF NOT EXISTS oficina VARCHAR(140),
  ADD COLUMN IF NOT EXISTS bio_profesional TEXT;

ALTER TABLE estudiantes
  ADD COLUMN IF NOT EXISTS titulo_profesional VARCHAR(140),
  ADD COLUMN IF NOT EXISTS biografia TEXT,
  ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255),
  ADD COLUMN IF NOT EXISTS github VARCHAR(255),
  ADD COLUMN IF NOT EXISTS portafolio VARCHAR(255),
  ADD COLUMN IF NOT EXISTS idiomas VARCHAR(255),
  ADD COLUMN IF NOT EXISTS disponibilidad VARCHAR(80),
  ADD COLUMN IF NOT EXISTS modalidad_preferida VARCHAR(80),
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(120);

ALTER TABLE profesores
  ADD COLUMN IF NOT EXISTS grado_academico VARCHAR(140),
  ADD COLUMN IF NOT EXISTS especialidad VARCHAR(180),
  ADD COLUMN IF NOT EXISTS biografia TEXT,
  ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255),
  ADD COLUMN IF NOT EXISTS orcid VARCHAR(80),
  ADD COLUMN IF NOT EXISTS horario_atencion VARCHAR(180),
  ADD COLUMN IF NOT EXISTS mentorias BOOLEAN NOT NULL DEFAULT false;

COMMIT;
SELECT 'Migracion 10 aplicada. Perfiles profesionales ampliados.' AS resultado;

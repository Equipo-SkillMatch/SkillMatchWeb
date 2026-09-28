-- =========================================================
-- SKILLMATCH V4 - Vacantes profesionales y perfil de empresa
-- Ejecutar después de 11_media_evidencias_v3.sql
-- =========================================================
BEGIN;

ALTER TABLE vacantes
  ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(180),
  ADD COLUMN IF NOT EXISTS modalidad VARCHAR(30),
  ADD COLUMN IF NOT EXISTS tipo_oportunidad VARCHAR(50),
  ADD COLUMN IF NOT EXISTS horario VARCHAR(120),
  ADD COLUMN IF NOT EXISTS salario_min NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS salario_max NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS mostrar_salario BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plazas INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fecha_limite DATE,
  ADD COLUMN IF NOT EXISTS actividades TEXT,
  ADD COLUMN IF NOT EXISTS responsabilidades TEXT,
  ADD COLUMN IF NOT EXISTS requisitos_obligatorios TEXT,
  ADD COLUMN IF NOT EXISTS requisitos_deseables TEXT,
  ADD COLUMN IF NOT EXISTS tecnologias_requeridas TEXT,
  ADD COLUMN IF NOT EXISTS tecnologias_deseables TEXT,
  ADD COLUMN IF NOT EXISTS habilidades_blandas TEXT,
  ADD COLUMN IF NOT EXISTS beneficios TEXT,
  ADD COLUMN IF NOT EXISTS experiencia VARCHAR(120),
  ADD COLUMN IF NOT EXISTS carrera_preferida VARCHAR(180);

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS descripcion_empresa TEXT,
  ADD COLUMN IF NOT EXISTS sitio_web VARCHAR(220),
  ADD COLUMN IF NOT EXISTS tamano_empresa VARCHAR(60),
  ADD COLUMN IF NOT EXISTS anio_fundacion INTEGER,
  ADD COLUMN IF NOT EXISTS linkedin VARCHAR(220),
  ADD COLUMN IF NOT EXISTS cultura_valores TEXT,
  ADD COLUMN IF NOT EXISTS beneficios_empresa TEXT,
  ADD COLUMN IF NOT EXISTS proceso_seleccion TEXT;

CREATE INDEX IF NOT EXISTS idx_vacantes_modalidad ON vacantes(modalidad);
CREATE INDEX IF NOT EXISTS idx_vacantes_fecha_limite ON vacantes(fecha_limite);

COMMIT;

SELECT 'Migracion 12 aplicada. Vacantes y empresas preparadas para SkillMatch V4.' AS resultado;

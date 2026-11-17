-- ============================================================
-- SKILLMATCH V9.5 - TOMA DE PROTESTA Y DOCUMENTOS FINALES
-- Ejecutar DESPUES de 26_estadias_v9_4_datos_titulo_pago.sql
-- PostgreSQL
-- ============================================================
BEGIN;

-- Separa el enlace para confirmar disponibilidad del enlace de evaluación.
ALTER TABLE toma_protesta_evaluadores
  ADD COLUMN IF NOT EXISTS token_evaluacion VARCHAR(96);

CREATE UNIQUE INDEX IF NOT EXISTS uq_toma_evaluador_token_evaluacion
  ON toma_protesta_evaluadores(token_evaluacion)
  WHERE token_evaluacion IS NOT NULL;

-- La evaluación de la toma reutiliza la estructura académica de los 3 talleres.
ALTER TABLE preguntas_toma_protesta
  ADD COLUMN IF NOT EXISTS numero_taller INTEGER,
  ADD COLUMN IF NOT EXISTS id_criterio_taller INTEGER REFERENCES criterios_taller_estadia(id_criterio_taller) ON DELETE SET NULL;

-- Sincroniza las preguntas con los criterios oficiales de Taller 1, 2 y 3.
WITH criterios AS (
  SELECT id_criterio_taller,numero_taller,criterio,
         ROW_NUMBER() OVER (ORDER BY numero_taller,orden,id_criterio_taller)::INTEGER AS orden_global
  FROM criterios_taller_estadia
  WHERE activo=TRUE
)
INSERT INTO preguntas_toma_protesta(pregunta,orden,activa,numero_taller,id_criterio_taller)
SELECT criterio,orden_global,TRUE,numero_taller,id_criterio_taller
FROM criterios
ON CONFLICT (orden) DO UPDATE SET
  pregunta=EXCLUDED.pregunta,
  activa=TRUE,
  numero_taller=EXCLUDED.numero_taller,
  id_criterio_taller=EXCLUDED.id_criterio_taller;

UPDATE preguntas_toma_protesta p
SET activa=FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM criterios_taller_estadia c
  WHERE c.activo=TRUE AND c.id_criterio_taller=p.id_criterio_taller
);

-- Los enlaces de evaluación previos se regeneran únicamente cuando los tres
-- profesores hayan aceptado la fecha.
UPDATE toma_protesta_evaluadores SET token_evaluacion=NULL
WHERE disponibilidad_estado IS DISTINCT FROM 'aceptada';

COMMIT;

SELECT 'Migracion 27 aplicada. SkillMatch V9.5 toma de protesta y documentos lista.' AS resultado;

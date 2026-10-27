-- ============================================================
-- SKILLMATCH V8.1 - AJUSTES DE TALLERES, MEMORIA Y CIERRE
-- Ejecutar DESPUES de 17_estadias_v8_cierre_institucional.sql
-- ============================================================
BEGIN;

-- Corrige texto que pudo quedar con mojibake por codificacion Windows/UTF-8.
UPDATE niveles_evaluacion_estadia
SET nombre = U&'Competente aut\00F3nomo'
WHERE codigo = 'CA';

-- Una observacion/correccion se incorpora al siguiente taller y no invalida
-- la calificacion ya obtenida en el taller anterior.
UPDATE entregas_avances_estadia ea
SET estado='aprobado'
WHERE ea.estado='requiere_correccion'
  AND EXISTS (
    SELECT 1 FROM revisiones_avances_estadia r
    WHERE r.id_entrega=ea.id_entrega AND r.requiere_correccion=TRUE
  );

-- Version visible de la memoria final.
ALTER TABLE estadias
  ADD COLUMN IF NOT EXISTS memoria_final_version INTEGER NOT NULL DEFAULT 0;

UPDATE estadias
SET memoria_final_version=1
WHERE memoria_final_ruta IS NOT NULL AND memoria_final_version=0;

-- Monto de donativo configurable por periodo.
ALTER TABLE periodos_estadia
  ADD COLUMN IF NOT EXISTS monto_donativo NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Datos específicos del cierre.
ALTER TABLE validaciones_cierre_estadia
  ADD COLUMN IF NOT EXISTS calificacion_memoria_empresa NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS referencia_donativo VARCHAR(80),
  ADD COLUMN IF NOT EXISTS monto_donativo NUMERIC(10,2);

ALTER TABLE validaciones_cierre_estadia
  DROP CONSTRAINT IF EXISTS chk_calificacion_memoria_empresa_v81;
ALTER TABLE validaciones_cierre_estadia
  ADD CONSTRAINT chk_calificacion_memoria_empresa_v81
  CHECK (calificacion_memoria_empresa IS NULL OR calificacion_memoria_empresa IN (8,9,10));

COMMIT;
SELECT 'Migracion 18 aplicada. SkillMatch V8.1 listo.' AS resultado;

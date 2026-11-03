BEGIN;

-- V8.3: en versiones anteriores el asesor habilitaba la entrega final pero
-- memoria_final_autorizada podía quedar en FALSE. Se corrigen registros ya probados.
UPDATE estadias
SET memoria_final_autorizada = TRUE,
    memoria_final_autorizada_en = COALESCE(memoria_final_autorizada_en, memoria_final_subida_en, CURRENT_TIMESTAMP)
WHERE memoria_final_habilitada = TRUE
  AND memoria_final_ruta IS NOT NULL
  AND COALESCE(memoria_final_autorizada,FALSE) = FALSE;

COMMIT;

SELECT 'Migracion 20 aplicada. SkillMatch V8.3 listo.' AS resultado;

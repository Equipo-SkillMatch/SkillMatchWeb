BEGIN;

-- SkillMatch V6.1: compatibilidad entre grupos escolares catalogados y grupo escrito libremente.
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS grupo VARCHAR(80);

-- Sincroniza el texto visible para alumnos que ya tienen un grupo escolar catalogado.
UPDATE estudiantes e
SET grupo = ge.nombre
FROM grupos_escolares ge
WHERE e.id_grupo_escolar = ge.id_grupo_escolar
  AND (e.grupo IS NULL OR TRIM(e.grupo) = '');

COMMIT;

SELECT 'Migracion 15 aplicada. SkillMatch V6.1 listo.' AS resultado;

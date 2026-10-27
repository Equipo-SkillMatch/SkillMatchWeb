-- ============================================================
-- SKILLMATCH V8.2 - MEMORIA FINAL Y FLUJO EMPRESARIAL SIMPLIFICADO
-- Ejecutar DESPUES de 18_estadias_v8_1_ajustes_cierre.sql
-- No elimina datos existentes.
-- ============================================================
BEGIN;

-- Repara preguntas que pudieron quedar con mojibake por codificacion de consola.
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Cumple las actividades y responsabilidades asignadas.' WHERE orden=1;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Entrega su trabajo con la calidad esperada.' WHERE orden=2;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Cumple los tiempos y compromisos acordados.' WHERE orden=3;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Aplica adecuadamente sus conocimientos t\00E9cnicos en el trabajo.' WHERE orden=4;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Analiza problemas y propone soluciones pertinentes.' WHERE orden=5;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Muestra puntualidad, responsabilidad y disciplina.' WHERE orden=6;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Se comunica de forma clara y profesional.' WHERE orden=7;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Trabaja de manera colaborativa con el equipo.' WHERE orden=8;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Muestra iniciativa y disposici\00F3n para aprender.' WHERE orden=9;
UPDATE preguntas_evaluacion_empresa SET pregunta=U&'Act\00FAa con respeto, \00E9tica y profesionalismo.' WHERE orden=10;

-- Las memorias finales ya cargadas deben aparecer inmediatamente en Biblioteca y Laboratorios.
INSERT INTO validaciones_cierre_estadia(id_estadia,area,estado,enviado_en)
SELECT e.id_estadia,'biblioteca','en_revision',COALESCE(e.memoria_final_subida_en,CURRENT_TIMESTAMP)
FROM estadias e
WHERE e.memoria_final_ruta IS NOT NULL
ON CONFLICT(id_estadia,area) DO NOTHING;

INSERT INTO validaciones_cierre_estadia(id_estadia,area,estado,enviado_en)
SELECT e.id_estadia,'laboratorios','en_revision',COALESCE(e.memoria_final_subida_en,CURRENT_TIMESTAMP)
FROM estadias e
WHERE e.memoria_final_ruta IS NOT NULL
ON CONFLICT(id_estadia,area) DO NOTHING;

-- También se crea la revisión empresarial para memorias ya cargadas.
-- El token se genera sin depender de extensiones adicionales de PostgreSQL.
INSERT INTO validaciones_cierre_estadia(id_estadia,area,estado,token_publico,enviado_en)
SELECT e.id_estadia,'empresa_memoria','en_revision',
       md5(random()::text || clock_timestamp()::text || e.id_estadia::text),
       COALESCE(e.memoria_final_subida_en,CURRENT_TIMESTAMP)
FROM estadias e
WHERE e.memoria_final_ruta IS NOT NULL
ON CONFLICT(id_estadia,area) DO NOTHING;

COMMIT;
SELECT 'Migracion 19 aplicada. SkillMatch V8.2 flujo de memoria listo.' AS resultado;

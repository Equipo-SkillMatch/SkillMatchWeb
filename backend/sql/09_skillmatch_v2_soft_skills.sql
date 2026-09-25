-- =========================================================
-- SKILLMATCH V2 - Evaluacion situacional de habilidades blandas
-- 21 reactivos, 6 dimensiones, con reactivos inversos de consistencia.
-- Escala: 1 nada probable, 2 poco probable, 3 neutral, 4 probable, 5 muy probable.
-- =========================================================
BEGIN;

ALTER TABLE soft_skills_preguntas
  ADD COLUMN IF NOT EXISTS inversa BOOLEAN NOT NULL DEFAULT false;

-- Conserva historico, pero deja activa solo la bateria V2.
UPDATE soft_skills_preguntas SET activa = false WHERE activa = true;

INSERT INTO soft_skills_preguntas (competencia, pregunta, orden, activa, inversa)
VALUES
('comunicacion', 'En una reunion notas que una persona no entendio una explicacion tecnica. Reformulas la idea con un ejemplo sencillo y confirmas que haya quedado clara.', 101, true, false),
('comunicacion', 'Recibes una instruccion ambigua y la fecha de entrega es cercana. Confirmas alcance, prioridad y resultado esperado antes de avanzar.', 102, true, false),
('comunicacion', 'Cuando existe un desacuerdo, prefieres dejar de explicar tu punto para evitar cualquier conversacion incomoda.', 103, true, true),
('trabajo_equipo', 'Un integrante del equipo se retrasa y eso afecta el proyecto. Hablas con la persona, entiendes el bloqueo y acuerdan como recuperar el avance.', 104, true, false),
('trabajo_equipo', 'Recibes retroalimentacion sobre una parte de tu trabajo. Revisas la evidencia, preguntas lo necesario y aplicas los cambios utiles.', 105, true, false),
('trabajo_equipo', 'Si tu parte ya esta terminada, consideras que los problemas del resto del equipo ya no te corresponden.', 106, true, true),
('liderazgo', 'Nadie ha organizado un proyecto con varias tareas urgentes. Propones prioridades, responsables y fechas sin imponer tus decisiones.', 107, true, false),
('liderazgo', 'Durante una entrega aparece un bloqueo. Tomas iniciativa para coordinar alternativas y mantienes informado al equipo.', 108, true, false),
('liderazgo', 'Cuando coordinas una actividad, prefieres tomar todas las decisiones tu solo para avanzar mas rapido.', 109, true, true),
('resolucion_problemas', 'Una funcion que ayer operaba correctamente empieza a fallar. Reproduces el problema, aislas posibles causas y pruebas soluciones de forma ordenada.', 110, true, false),
('resolucion_problemas', 'Tienes dos soluciones posibles. Comparas impacto, tiempo, riesgos y evidencia antes de elegir una.', 111, true, false),
('resolucion_problemas', 'Si encuentras una solucion que parece funcionar, normalmente dejas de validar otras causas o efectos secundarios.', 112, true, true),
('adaptabilidad', 'A mitad del proyecto cambian los requisitos. Identificas que partes se ven afectadas, reorganizas el plan y aprendes lo necesario para continuar.', 113, true, false),
('adaptabilidad', 'Te asignan una herramienta que no conoces. Buscas documentacion, practicas con un ejemplo y pides apoyo puntual si lo necesitas.', 114, true, false),
('adaptabilidad', 'Cuando cambia una herramienta que ya dominas, prefieres seguir utilizando la anterior aunque el equipo haya adoptado la nueva.', 115, true, true),
('profesionalismo', 'Detectas que no llegaras a una fecha comprometida. Avisas con anticipacion, explicas el impacto y propones un nuevo plan realista.', 116, true, false),
('profesionalismo', 'Trabajas con informacion sensible de una empresa. La compartes solo con personas autorizadas y por medios adecuados.', 117, true, false),
('profesionalismo', 'Si el resultado funciona, consideras poco importante documentarlo o presentarlo de forma clara.', 118, true, true),
('comunicacion', 'Debes presentar un avance con problemas pendientes. Explicas con claridad lo logrado, los riesgos y la ayuda que necesitas.', 119, true, false),
('trabajo_equipo', 'Una idea de otra persona es mejor que la tuya. La reconoces y apoyas su implementacion aunque tu propuesta no sea elegida.', 120, true, false),
('profesionalismo', 'Cometes un error que afecta una entrega. Lo comunicas, asumes responsabilidad y participas en corregirlo y prevenir que se repita.', 121, true, false)
ON CONFLICT DO NOTHING;

COMMIT;
SELECT 'Migracion 09 aplicada. Test V2 con 21 reactivos.' AS resultado;

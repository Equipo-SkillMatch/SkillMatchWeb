BEGIN;

-- V9.3: expediente específico de datos para titulación.
CREATE TABLE IF NOT EXISTS datos_titulacion_estadia (
  id_estadia INTEGER PRIMARY KEY REFERENCES estadias(id_estadia) ON DELETE CASCADE,
  nombre VARCHAR(120) NOT NULL,
  apellido VARCHAR(160) NOT NULL,
  matricula VARCHAR(30) NOT NULL,
  carrera VARCHAR(180) NOT NULL,
  anio_inicio INTEGER,
  anio_finalizacion INTEGER,
  confirmado BOOLEAN NOT NULL DEFAULT FALSE,
  confirmado_en TIMESTAMP NULL,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO datos_titulacion_estadia(
  id_estadia,nombre,apellido,matricula,carrera,anio_inicio,anio_finalizacion
)
SELECT e.id_estadia,u.nombre,u.apellido,es.matricula,
       COALESCE(c.nombre,es.carrera,'Carrera por definir'),
       EXTRACT(YEAR FROM COALESCE(es.fecha_inicio_carrera,u.fecha_registro::date))::INTEGER,
       EXTRACT(YEAR FROM COALESCE(e.fecha_fin,p.fecha_fin))::INTEGER
FROM estadias e
JOIN usuarios u ON u.id_usuario=e.id_estudiante
JOIN estudiantes es ON es.id_estudiante=e.id_estudiante
JOIN periodos_estadia p ON p.id_periodo=e.id_periodo
LEFT JOIN grupos_estadia g ON g.id_grupo=e.id_grupo
LEFT JOIN carreras c ON c.id_carrera=g.id_carrera
ON CONFLICT (id_estadia) DO NOTHING;

-- Corrige mojibake heredado de cargas SQL ejecutadas desde consolas Windows.
CREATE OR REPLACE FUNCTION skillmatch_fix_mojibake(v TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r TEXT := COALESCE(v,'');
BEGIN
  r := replace(r,'Ã¡','á'); r := replace(r,'Ã©','é'); r := replace(r,'Ã­','í');
  r := replace(r,'Ã³','ó'); r := replace(r,'Ãº','ú'); r := replace(r,'Ã¼','ü'); r := replace(r,'Ã±','ñ');
  r := replace(r,'Ã','Á'); r := replace(r,'Ã‰','É'); r := replace(r,'Ã','Í');
  r := replace(r,'Ã“','Ó'); r := replace(r,'Ãš','Ú'); r := replace(r,'Ã‘','Ñ');
  r := replace(r,'Â¿','¿'); r := replace(r,'Â¡','¡'); r := replace(r,'Â°','°'); r := replace(r,'Â·','·');
  r := replace(r,'Â','');
  RETURN r;
END;
$$;

UPDATE usuarios SET
  nombre=skillmatch_fix_mojibake(nombre),
  apellido=skillmatch_fix_mojibake(apellido),
  cargo_institucional=skillmatch_fix_mojibake(cargo_institucional),
  area_institucional=skillmatch_fix_mojibake(area_institucional),
  oficina=skillmatch_fix_mojibake(oficina),
  bio_profesional=skillmatch_fix_mojibake(bio_profesional)
WHERE concat_ws(' ',nombre,apellido,cargo_institucional,area_institucional,oficina,bio_profesional) LIKE '%Ã%'
   OR concat_ws(' ',nombre,apellido,cargo_institucional,area_institucional,oficina,bio_profesional) LIKE '%Â%';

UPDATE estudiantes SET carrera=skillmatch_fix_mojibake(carrera)
WHERE carrera LIKE '%Ã%' OR carrera LIKE '%Â%';

UPDATE carreras SET nombre=skillmatch_fix_mojibake(nombre)
WHERE nombre LIKE '%Ã%' OR nombre LIKE '%Â%';

UPDATE grupos_escolares SET nombre=skillmatch_fix_mojibake(nombre), generacion=skillmatch_fix_mojibake(generacion)
WHERE nombre LIKE '%Ã%' OR nombre LIKE '%Â%' OR generacion LIKE '%Ã%' OR generacion LIKE '%Â%';

UPDATE profesores SET departamento=skillmatch_fix_mojibake(departamento)
WHERE departamento LIKE '%Ã%' OR departamento LIKE '%Â%';

UPDATE datos_titulacion_estadia SET
  nombre=skillmatch_fix_mojibake(nombre),
  apellido=skillmatch_fix_mojibake(apellido),
  carrera=skillmatch_fix_mojibake(carrera)
WHERE concat_ws(' ',nombre,apellido,carrera) LIKE '%Ã%' OR concat_ws(' ',nombre,apellido,carrera) LIKE '%Â%';

DROP FUNCTION skillmatch_fix_mojibake(TEXT);

COMMIT;

SELECT 'Migracion 25 aplicada. SkillMatch V9.3 correcciones integrales listas.' AS resultado;

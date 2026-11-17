BEGIN;

-- Garantiza la estructura utilizada por la pantalla "Revisar mis datos" aun en
-- instalaciones que llegaron a V9.3 sin ejecutar correctamente la migración 25.
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

ALTER TABLE datos_titulacion_estadia
  ADD COLUMN IF NOT EXISTS confirmado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmado_en TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Recupera expedientes faltantes sin sobrescribir correcciones ya hechas por el alumno.
INSERT INTO datos_titulacion_estadia(
  id_estadia,nombre,apellido,matricula,carrera,anio_inicio,anio_finalizacion
)
SELECT e.id_estadia,u.nombre,u.apellido,es.matricula,
       COALESCE(c.nombre,es.carrera,'Carrera por definir'),
       EXTRACT(YEAR FROM COALESCE(es.fecha_inicio_carrera,u.fecha_registro::date))::INTEGER,
       EXTRACT(YEAR FROM COALESCE(e.fecha_fin,p.fecha_fin,CURRENT_DATE))::INTEGER
FROM estadias e
JOIN usuarios u ON u.id_usuario=e.id_estudiante
JOIN estudiantes es ON es.id_estudiante=e.id_estudiante
JOIN periodos_estadia p ON p.id_periodo=e.id_periodo
LEFT JOIN grupos_estadia g ON g.id_grupo=e.id_grupo
LEFT JOIN carreras c ON c.id_carrera=g.id_carrera
ON CONFLICT (id_estadia) DO NOTHING;

COMMIT;

SELECT 'Migracion 26 aplicada. Datos de titulacion y pago de titulo listos.' AS resultado;

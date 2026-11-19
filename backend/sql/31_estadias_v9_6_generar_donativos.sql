BEGIN;

-- Genera el requisito de donativo para estadías cuya memoria ya fue aprobada por la empresa.
-- No sustituye comprobantes existentes ni cambia aprobaciones/rechazos ya registrados.
INSERT INTO validaciones_cierre_estadia (
  id_estadia,
  area,
  estado,
  enviado_en,
  referencia_donativo,
  monto_donativo
)
SELECT
  e.id_estadia,
  'servicios_escolares',
  'pendiente',
  CURRENT_TIMESTAMP,
  'DON-' || EXTRACT(YEAR FROM COALESCE(p.fecha_inicio, CURRENT_DATE))::INT || '-' || LPAD(e.id_estadia::TEXT, 6, '0'),
  COALESCE(p.monto_donativo, 0)
FROM estadias e
JOIN periodos_estadia p ON p.id_periodo=e.id_periodo
WHERE EXISTS (
  SELECT 1
  FROM validaciones_cierre_estadia em
  WHERE em.id_estadia=e.id_estadia
    AND em.area='empresa_memoria'
    AND em.estado='aprobado'
)
ON CONFLICT (id_estadia, area) DO UPDATE SET
  referencia_donativo=COALESCE(validaciones_cierre_estadia.referencia_donativo, EXCLUDED.referencia_donativo),
  monto_donativo=COALESCE(validaciones_cierre_estadia.monto_donativo, EXCLUDED.monto_donativo),
  actualizado_en=CURRENT_TIMESTAMP;

COMMIT;

SELECT
  e.id_estadia,
  es.matricula,
  v.estado,
  v.referencia_donativo,
  v.monto_donativo,
  v.ruta_archivo
FROM validaciones_cierre_estadia v
JOIN estadias e ON e.id_estadia=v.id_estadia
JOIN estudiantes es ON es.id_estudiante=e.id_estudiante
WHERE v.area='servicios_escolares'
ORDER BY e.id_estadia DESC;

-- ============================================================
-- SKILLMATCH V9.2 - USUARIOS INSTITUCIONALES PARA PRUEBAS
-- Ejecutar DESPUES de 22_estadias_v9_flujo_oficial.sql
-- Password comun de todos los usuarios creados: SkillMatch123
--
-- IMPORTANTE:
-- - Los nombres y correos de este archivo son datos ficticios con formato
--   institucional para pruebas/presentacion del sistema.
-- - No se afirma que los buzones @uteq.edu.mx existan realmente.
-- - La migracion es idempotente: puede ejecutarse mas de una vez.
-- ============================================================

BEGIN;

-- Rol operativo de administrador de estadias (por si la 22 no lo creo).
INSERT INTO roles(id_rol,nombre_rol)
VALUES (10,'administrador_estadias')
ON CONFLICT(id_rol) DO UPDATE SET nombre_rol=EXCLUDED.nombre_rol;

CREATE TABLE IF NOT EXISTS administradores_estadia (
  id_usuario INTEGER PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_carrera INTEGER REFERENCES carreras(id_carrera) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 1. LIMPIEZA EXCLUSIVA DE CUENTAS DEMO GENERADAS POR V9
--    No elimina profesores/usuarios originales de SkillMatch.
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Administradores demo antiguos.
  DELETE FROM administradores_estadia
   WHERE id_usuario IN (
     SELECT id_usuario FROM usuarios
      WHERE correo IN (
        'superadmin.skillmatch@uteq.edu.mx',
        'superadmin.academico@uteq.edu.mx',
        'raul.estadias@uteq.edu.mx',
        'ubaldo.estadias@uteq.edu.mx'
      )
      OR correo LIKE 'demo.estudiante%@uteq.edu.mx'
   );

  -- Perfiles profesor demo antiguos.
  DELETE FROM profesores
   WHERE id_profesor IN (
     SELECT id_usuario FROM usuarios
      WHERE correo IN (
        'karina.mendoza@uteq.edu.mx',
        'eduardo.salas@uteq.edu.mx',
        'paola.rivera@uteq.edu.mx',
        'alberto.mejia@uteq.edu.mx',
        'sofia.navarro@uteq.edu.mx',
        'jorge.cervantes@uteq.edu.mx'
      )
   );

  -- Perfiles estudiante demo antiguos.
  DELETE FROM estudiantes
   WHERE id_estudiante IN (
     SELECT id_usuario FROM usuarios
      WHERE correo LIKE 'demo.estudiante%@uteq.edu.mx'
   );

  -- Usuarios demo antiguos creados por la migracion 22.
  DELETE FROM usuarios
   WHERE correo IN (
      'superadmin.skillmatch@uteq.edu.mx',
      'superadmin.academico@uteq.edu.mx',
      'raul.estadias@uteq.edu.mx',
      'ubaldo.estadias@uteq.edu.mx',
      'karina.mendoza@uteq.edu.mx',
      'eduardo.salas@uteq.edu.mx',
      'paola.rivera@uteq.edu.mx',
      'alberto.mejia@uteq.edu.mx',
      'sofia.navarro@uteq.edu.mx',
      'jorge.cervantes@uteq.edu.mx'
   )
   OR correo LIKE 'demo.estudiante%@uteq.edu.mx';
END $$;

-- ============================================================
-- 2. USUARIOS INSTITUCIONALES
-- ============================================================
DO $$
DECLARE
  v_hash TEXT := '$2b$12$kj3IQuOtk1lUMh1kbBXMVu5cPfw4j34tyXbh5BnqkJ1ISKjYbsRA2';
  v_soft INTEGER;
  v_meca INTEGER;
  v_uid INTEGER;
BEGIN
  -- Detectar carreras existentes sin asumir IDs fijos.
  SELECT id_carrera INTO v_soft
    FROM carreras
   WHERE nombre ILIKE '%Software%'
      OR nombre ILIKE '%Desarrollo%Gestion%Software%'
      OR nombre ILIKE '%Tecnolog%Inform%'
   ORDER BY
      CASE WHEN nombre ILIKE '%Software%' THEN 0 ELSE 1 END,
      id_carrera
   LIMIT 1;

  SELECT id_carrera INTO v_meca
    FROM carreras
   WHERE nombre ILIKE '%Mecatr%'
   ORDER BY id_carrera
   LIMIT 1;

  IF v_soft IS NULL THEN
    RAISE NOTICE 'No se encontro carrera de Software/TI. Los usuarios se crean, pero algunas asignaciones de carrera quedaran NULL.';
  END IF;

  IF v_meca IS NULL THEN
    RAISE NOTICE 'No se encontro carrera de Mecatronica. Los usuarios se crean, pero algunas asignaciones de carrera quedaran NULL.';
  END IF;

  -- ----------------------------------------------------------
  -- SUPER ADMINISTRADORES
  -- ----------------------------------------------------------
  INSERT INTO usuarios(
    nombre,apellido,correo,password_hash,id_rol,estado,telefono,
    cargo_institucional,area_institucional,extension,oficina,bio_profesional
  ) VALUES (
    'Adriana Patricia','Velázquez Cárdenas','adriana.velazquez@uteq.edu.mx',v_hash,1,'activo','4422096101',
    'Directora de División','Tecnologías de la Información','2101','Dirección de División',
    'Responsable institucional de la administración general de SkillMatch, procesos de estadía y validaciones académicas.'
  )
  ON CONFLICT(correo) DO UPDATE SET
    nombre=EXCLUDED.nombre, apellido=EXCLUDED.apellido, password_hash=EXCLUDED.password_hash,
    id_rol=1, estado='activo', telefono=EXCLUDED.telefono,
    cargo_institucional=EXCLUDED.cargo_institucional,
    area_institucional=EXCLUDED.area_institucional,
    extension=EXCLUDED.extension, oficina=EXCLUDED.oficina,
    bio_profesional=EXCLUDED.bio_profesional;

  INSERT INTO usuarios(
    nombre,apellido,correo,password_hash,id_rol,estado,telefono,
    cargo_institucional,area_institucional,extension,oficina,bio_profesional
  ) VALUES (
    'Héctor Manuel','Robles Navarro','hector.robles@uteq.edu.mx',v_hash,1,'activo','4422096102',
    'Coordinador Institucional de Estadías y Titulación','Servicios Académicos','2102','Coordinación Académica',
    'Responsable de coordinación institucional, seguimiento de estadías y procesos previos a titulación.'
  )
  ON CONFLICT(correo) DO UPDATE SET
    nombre=EXCLUDED.nombre, apellido=EXCLUDED.apellido, password_hash=EXCLUDED.password_hash,
    id_rol=1, estado='activo', telefono=EXCLUDED.telefono,
    cargo_institucional=EXCLUDED.cargo_institucional,
    area_institucional=EXCLUDED.area_institucional,
    extension=EXCLUDED.extension, oficina=EXCLUDED.oficina,
    bio_profesional=EXCLUDED.bio_profesional;

  -- ----------------------------------------------------------
  -- ADMINISTRADORES DE ESTADIAS
  -- ----------------------------------------------------------
  INSERT INTO usuarios(
    nombre,apellido,correo,password_hash,id_rol,estado,telefono,
    cargo_institucional,area_institucional,extension,oficina,bio_profesional
  ) VALUES (
    'Raúl Alberto','Hernández Trejo','raul.hernandez@uteq.edu.mx',v_hash,10,'activo','4422096201',
    'Administrador de Estadías','Desarrollo y Gestión de Software','2201','Coordinación de Software',
    'Responsable operativo de grupos, asesores y seguimiento de estadías de la división de Software.'
  )
  ON CONFLICT(correo) DO UPDATE SET
    nombre=EXCLUDED.nombre, apellido=EXCLUDED.apellido, password_hash=EXCLUDED.password_hash,
    id_rol=10, estado='activo', telefono=EXCLUDED.telefono,
    cargo_institucional=EXCLUDED.cargo_institucional,
    area_institucional=EXCLUDED.area_institucional,
    extension=EXCLUDED.extension, oficina=EXCLUDED.oficina,
    bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='raul.hernandez@uteq.edu.mx';
  INSERT INTO administradores_estadia(id_usuario,id_carrera,activo)
  VALUES(v_uid,v_soft,TRUE)
  ON CONFLICT(id_usuario) DO UPDATE SET id_carrera=EXCLUDED.id_carrera,activo=TRUE;

  INSERT INTO usuarios(
    nombre,apellido,correo,password_hash,id_rol,estado,telefono,
    cargo_institucional,area_institucional,extension,oficina,bio_profesional
  ) VALUES (
    'Ubaldo Martín','Ramírez Solís','ubaldo.ramirez@uteq.edu.mx',v_hash,10,'activo','4422096202',
    'Administrador de Estadías','Mecatrónica','2202','Coordinación de Mecatrónica',
    'Responsable operativo de grupos, asesores y seguimiento de estadías de la división de Mecatrónica.'
  )
  ON CONFLICT(correo) DO UPDATE SET
    nombre=EXCLUDED.nombre, apellido=EXCLUDED.apellido, password_hash=EXCLUDED.password_hash,
    id_rol=10, estado='activo', telefono=EXCLUDED.telefono,
    cargo_institucional=EXCLUDED.cargo_institucional,
    area_institucional=EXCLUDED.area_institucional,
    extension=EXCLUDED.extension, oficina=EXCLUDED.oficina,
    bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='ubaldo.ramirez@uteq.edu.mx';
  INSERT INTO administradores_estadia(id_usuario,id_carrera,activo)
  VALUES(v_uid,v_meca,TRUE)
  ON CONFLICT(id_usuario) DO UPDATE SET id_carrera=EXCLUDED.id_carrera,activo=TRUE;

  -- ----------------------------------------------------------
  -- PROFESORES / ASESORES - SOFTWARE
  -- ----------------------------------------------------------
  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Karla Ximena','Paredes León','karla.paredes@uteq.edu.mx',v_hash,4,'activo','4422096301','Profesora de Tiempo Completo / Asesora de Estadías','Desarrollo y Gestión de Software','2301','Edificio TI - Docencia','Asesora académica en desarrollo de software, bases de datos y proyectos integradores.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=4,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='karla.paredes@uteq.edu.mx';
  INSERT INTO profesores(id_profesor,departamento,asignaturas,id_carrera,tutor_estadia,grado_academico,especialidad)
  VALUES(v_uid,'Tecnologías de la Información','Desarrollo Web, Bases de Datos, Estadías',v_soft,TRUE,'Maestría','Ingeniería de Software')
  ON CONFLICT(id_profesor) DO UPDATE SET departamento=EXCLUDED.departamento,asignaturas=EXCLUDED.asignaturas,id_carrera=v_soft,tutor_estadia=TRUE,grado_academico=EXCLUDED.grado_academico,especialidad=EXCLUDED.especialidad;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Jorge Luis','Maldonado Ruiz','jorge.maldonado@uteq.edu.mx',v_hash,4,'activo','4422096302','Profesor de Asignatura / Asesor de Estadías','Desarrollo y Gestión de Software','2302','Edificio TI - Docencia','Asesor académico en arquitectura de software, servicios web y gestión de proyectos tecnológicos.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=4,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='jorge.maldonado@uteq.edu.mx';
  INSERT INTO profesores(id_profesor,departamento,asignaturas,id_carrera,tutor_estadia,grado_academico,especialidad)
  VALUES(v_uid,'Tecnologías de la Información','Arquitectura de Software, Servicios Web, Estadías',v_soft,TRUE,'Maestría','Sistemas de Información')
  ON CONFLICT(id_profesor) DO UPDATE SET departamento=EXCLUDED.departamento,asignaturas=EXCLUDED.asignaturas,id_carrera=v_soft,tutor_estadia=TRUE,grado_academico=EXCLUDED.grado_academico,especialidad=EXCLUDED.especialidad;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Fernanda Itzel','Castañeda Soto','fernanda.castaneda@uteq.edu.mx',v_hash,4,'activo','4422096303','Profesora de Tiempo Completo / Asesora de Estadías','Desarrollo y Gestión de Software','2303','Edificio TI - Docencia','Asesora académica en aplicaciones móviles, experiencia de usuario y calidad de software.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=4,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='fernanda.castaneda@uteq.edu.mx';
  INSERT INTO profesores(id_profesor,departamento,asignaturas,id_carrera,tutor_estadia,grado_academico,especialidad)
  VALUES(v_uid,'Tecnologías de la Información','Aplicaciones Móviles, UX, Calidad de Software, Estadías',v_soft,TRUE,'Maestría','Tecnologías de Información')
  ON CONFLICT(id_profesor) DO UPDATE SET departamento=EXCLUDED.departamento,asignaturas=EXCLUDED.asignaturas,id_carrera=v_soft,tutor_estadia=TRUE,grado_academico=EXCLUDED.grado_academico,especialidad=EXCLUDED.especialidad;

  -- ----------------------------------------------------------
  -- PROFESORES / ASESORES - MECATRONICA
  -- ----------------------------------------------------------
  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Alejandro','Márquez Torres','alejandro.marquez@uteq.edu.mx',v_hash,4,'activo','4422096401','Profesor de Tiempo Completo / Asesor de Estadías','Mecatrónica','2401','Edificio Mecatrónica - Docencia','Asesor académico en automatización, instrumentación y control industrial.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=4,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='alejandro.marquez@uteq.edu.mx';
  INSERT INTO profesores(id_profesor,departamento,asignaturas,id_carrera,tutor_estadia,grado_academico,especialidad)
  VALUES(v_uid,'Mecatrónica','Automatización, Instrumentación, Estadías',v_meca,TRUE,'Maestría','Automatización y Control')
  ON CONFLICT(id_profesor) DO UPDATE SET departamento=EXCLUDED.departamento,asignaturas=EXCLUDED.asignaturas,id_carrera=v_meca,tutor_estadia=TRUE,grado_academico=EXCLUDED.grado_academico,especialidad=EXCLUDED.especialidad;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Diana Laura','Salcedo Reyes','diana.salcedo@uteq.edu.mx',v_hash,4,'activo','4422096402','Profesora de Tiempo Completo / Asesora de Estadías','Mecatrónica','2402','Edificio Mecatrónica - Docencia','Asesora académica en electrónica industrial, robótica y sistemas de control.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=4,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='diana.salcedo@uteq.edu.mx';
  INSERT INTO profesores(id_profesor,departamento,asignaturas,id_carrera,tutor_estadia,grado_academico,especialidad)
  VALUES(v_uid,'Mecatrónica','Electrónica Industrial, Robótica, Estadías',v_meca,TRUE,'Maestría','Mecatrónica')
  ON CONFLICT(id_profesor) DO UPDATE SET departamento=EXCLUDED.departamento,asignaturas=EXCLUDED.asignaturas,id_carrera=v_meca,tutor_estadia=TRUE,grado_academico=EXCLUDED.grado_academico,especialidad=EXCLUDED.especialidad;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Luis Fernando','Ochoa Peña','luis.ochoa@uteq.edu.mx',v_hash,4,'activo','4422096403','Profesor de Asignatura / Asesor de Estadías','Mecatrónica','2403','Edificio Mecatrónica - Docencia','Asesor académico en mantenimiento industrial, sistemas eléctricos y proyectos de automatización.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=4,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='luis.ochoa@uteq.edu.mx';
  INSERT INTO profesores(id_profesor,departamento,asignaturas,id_carrera,tutor_estadia,grado_academico,especialidad)
  VALUES(v_uid,'Mecatrónica','Mantenimiento Industrial, Sistemas Eléctricos, Estadías',v_meca,TRUE,'Maestría','Ingeniería Mecatrónica')
  ON CONFLICT(id_profesor) DO UPDATE SET departamento=EXCLUDED.departamento,asignaturas=EXCLUDED.asignaturas,id_carrera=v_meca,tutor_estadia=TRUE,grado_academico=EXCLUDED.grado_academico,especialidad=EXCLUDED.especialidad;

  -- ----------------------------------------------------------
  -- ESTUDIANTES - SOFTWARE
  -- ----------------------------------------------------------
  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Daniela Sofía','Ríos Méndez','2026171101@uteq.edu.mx',v_hash,2,'activo','4425187101')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026171101@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026171101','Ing. en Desarrollo y Gestión de Software',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Emiliano','Cruz Herrera','2026171102@uteq.edu.mx',v_hash,2,'activo','4425187102')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026171102@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026171102','Ing. en Desarrollo y Gestión de Software',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Valeria Montserrat','Peña Soto','2026171103@uteq.edu.mx',v_hash,2,'activo','4425187103')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026171103@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026171103','Ing. en Desarrollo y Gestión de Software',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Mateo Alejandro','Vargas Luna','2026171104@uteq.edu.mx',v_hash,2,'activo','4425187104')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026171104@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026171104','Ing. en Desarrollo y Gestión de Software',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  -- ----------------------------------------------------------
  -- ESTUDIANTES - MECATRONICA
  -- ----------------------------------------------------------
  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Camila Fernanda','Ruiz Mora','2026172101@uteq.edu.mx',v_hash,2,'activo','4425187201')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026172101@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026172101','Ing. Mecatrónica',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Santiago','Herrera Nieto','2026172102@uteq.edu.mx',v_hash,2,'activo','4425187202')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026172102@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026172102','Ing. Mecatrónica',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Renata','García Cervantes','2026172103@uteq.edu.mx',v_hash,2,'activo','4425187203')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026172103@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026172103','Ing. Mecatrónica',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
  VALUES('Diego Armando','López Vázquez','2026172104@uteq.edu.mx',v_hash,2,'activo','4425187204')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=2,estado='activo',telefono=EXCLUDED.telefono;
  SELECT id_usuario INTO v_uid FROM usuarios WHERE correo='2026172104@uteq.edu.mx';
  INSERT INTO estudiantes(id_estudiante,matricula,carrera,semestre)
  VALUES(v_uid,'2026172104','Ing. Mecatrónica',11)
  ON CONFLICT(id_estudiante) DO UPDATE SET matricula=EXCLUDED.matricula,carrera=EXCLUDED.carrera,semestre=EXCLUDED.semestre;

  -- ----------------------------------------------------------
  -- AREAS INSTITUCIONALES
  -- ----------------------------------------------------------
  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Laura Isabel','Carrillo Sánchez','laura.carrillo@uteq.edu.mx',v_hash,6,'activo','4422096501','Responsable de Servicios Escolares','Servicios Escolares','2501','Servicios Escolares','Responsable de validación de inscripción, seguro facultativo, pagos y documentación escolar asociada a estadías.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=6,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Mónica Alejandra','Flores Trejo','monica.flores@uteq.edu.mx',v_hash,7,'activo','4422096502','Responsable de Biblioteca','Biblioteca','2502','Biblioteca Universitaria','Responsable de revisión documental y validación de memoria técnica para cierre de estadía.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=7,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Arturo','Medina Escobar','arturo.medina@uteq.edu.mx',v_hash,8,'activo','4422096503','Responsable de Laboratorios','Laboratorios','2503','Coordinación de Laboratorios','Responsable de validación de adeudos, equipo y liberación de laboratorios para estudiantes en proceso de estadía.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=8,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Claudia Fernanda','Soto Ríos','claudia.soto@uteq.edu.mx',v_hash,9,'activo','4422096504','Responsable de Acreditación de Idioma','Centro de Idiomas','2504','Centro de Idiomas','Responsable de revisión y validación de constancias o certificados de idioma requeridos para cierre de estadía.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=9,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;

  INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono,cargo_institucional,area_institucional,extension,oficina,bio_profesional)
  VALUES('Patricia Elena','Morales Vega','patricia.morales@uteq.edu.mx',v_hash,5,'activo','4422096505','Responsable de Vinculación','Vinculación','2505','Dirección de Vinculación','Responsable de validación institucional del expediente y seguimiento de vinculación con empresas durante la estadía.')
  ON CONFLICT(correo) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=5,estado='activo',telefono=EXCLUDED.telefono,cargo_institucional=EXCLUDED.cargo_institucional,area_institucional=EXCLUDED.area_institucional,extension=EXCLUDED.extension,oficina=EXCLUDED.oficina,bio_profesional=EXCLUDED.bio_profesional;

END $$;

-- Ajustar secuencia del rol debido al ID fijo 10.
SELECT setval(
  pg_get_serial_sequence('roles','id_rol'),
  GREATEST((SELECT MAX(id_rol) FROM roles),10),
  true
);

COMMIT;

-- ============================================================
-- RESUMEN DE CUENTAS CREADAS / ACTUALIZADAS
-- ============================================================
SELECT
  u.id_usuario,
  u.nombre || ' ' || u.apellido AS nombre_completo,
  u.correo,
  r.nombre_rol AS rol,
  u.cargo_institucional,
  u.area_institucional,
  u.estado
FROM usuarios u
JOIN roles r ON r.id_rol=u.id_rol
WHERE u.correo IN (
  'adriana.velazquez@uteq.edu.mx',
  'hector.robles@uteq.edu.mx',
  'raul.hernandez@uteq.edu.mx',
  'ubaldo.ramirez@uteq.edu.mx',
  'karla.paredes@uteq.edu.mx',
  'jorge.maldonado@uteq.edu.mx',
  'fernanda.castaneda@uteq.edu.mx',
  'alejandro.marquez@uteq.edu.mx',
  'diana.salcedo@uteq.edu.mx',
  'luis.ochoa@uteq.edu.mx',
  '2026171101@uteq.edu.mx',
  '2026171102@uteq.edu.mx',
  '2026171103@uteq.edu.mx',
  '2026171104@uteq.edu.mx',
  '2026172101@uteq.edu.mx',
  '2026172102@uteq.edu.mx',
  '2026172103@uteq.edu.mx',
  '2026172104@uteq.edu.mx',
  'laura.carrillo@uteq.edu.mx',
  'monica.flores@uteq.edu.mx',
  'arturo.medina@uteq.edu.mx',
  'claudia.soto@uteq.edu.mx',
  'patricia.morales@uteq.edu.mx'
)
ORDER BY u.id_rol,u.apellido,u.nombre;

SELECT 'Migracion 23 aplicada. Usuarios institucionales SkillMatch cargados. Password comun: SkillMatch123' AS resultado;

-- OPCIONAL / SOLO PRUEBAS
-- Crear cuentas para los nuevos roles institucionales.
-- NO es parte obligatoria de la migracion 17.
-- Password temporal para las 3 cuentas: SkillMatch123
-- Cambiar correos/nombres si la institucion define otros.

INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
VALUES
('Área','Biblioteca','biblioteca@uteq.edu.mx','$2b$12$kj3IQuOtk1lUMh1kbBXMVu5cPfw4j34tyXbh5BnqkJ1ISKjYbsRA2',7,'activo',NULL),
('Área','Laboratorios','laboratorios@uteq.edu.mx','$2b$12$kj3IQuOtk1lUMh1kbBXMVu5cPfw4j34tyXbh5BnqkJ1ISKjYbsRA2',8,'activo',NULL),
('Centro','de Idiomas','centro.idiomas@uteq.edu.mx','$2b$12$kj3IQuOtk1lUMh1kbBXMVu5cPfw4j34tyXbh5BnqkJ1ISKjYbsRA2',9,'activo',NULL)
ON CONFLICT(correo) DO UPDATE SET
nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=EXCLUDED.id_rol,estado='activo';

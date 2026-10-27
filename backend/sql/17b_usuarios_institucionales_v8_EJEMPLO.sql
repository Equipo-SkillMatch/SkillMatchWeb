-- OPCIONAL / SOLO PRUEBAS
-- Crear cuentas para los nuevos roles institucionales.
-- Password temporal para las 3 cuentas: SkillMatch123

INSERT INTO usuarios(nombre,apellido,correo,password_hash,id_rol,estado,telefono)
VALUES
('Biblioteca','UTEQ','biblioteca@uteq.edu.mx','$2b$12$kj3IQuOtk1lUMh1kbBXMVu5cPfw4j34tyXbh5BnqkJ1ISKjYbsRA2',7,'activo',NULL),
('Laboratorios','UTEQ','laboratorios@uteq.edu.mx','$2b$12$kj3IQuOtk1lUMh1kbBXMVu5cPfw4j34tyXbh5BnqkJ1ISKjYbsRA2',8,'activo',NULL),
('Centro de Idiomas','UTEQ','centro.idiomas@uteq.edu.mx','$2b$12$kj3IQuOtk1lUMh1kbBXMVu5cPfw4j34tyXbh5BnqkJ1ISKjYbsRA2',9,'activo',NULL)
ON CONFLICT(correo) DO UPDATE SET
nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,password_hash=EXCLUDED.password_hash,id_rol=EXCLUDED.id_rol,estado='activo';

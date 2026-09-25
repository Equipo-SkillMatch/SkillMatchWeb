const db = require('../config/db');

class Usuario {
  static async findByCorreo(correo) {
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE correo = ? LIMIT 1',
      [correo]
    );
    return rows[0];
  }

  static async findById(id_usuario) {
    const [rows] = await db.query(
      `SELECT id_usuario, nombre, apellido, correo, telefono, foto_perfil, id_rol, estado, fecha_registro, cargo_institucional, area_institucional, extension, oficina, bio_profesional
       FROM usuarios
       WHERE id_usuario = ?
       LIMIT 1`,
      [id_usuario]
    );
    return rows[0];
  }

  static async create({ nombre, apellido, correo, password_hash, telefono = null, id_rol, conn }) {
    const connection = conn || db;

    const [result] = await connection.query(
      `INSERT INTO usuarios (nombre, apellido, correo, password_hash, telefono, id_rol, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'activo')`,
      [nombre, apellido, correo, password_hash, telefono, id_rol]
    );

    return result.insertId;
  }
}

module.exports = Usuario;

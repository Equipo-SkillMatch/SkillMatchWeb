const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const Usuario = require('../models/Usuario');
const Estudiante = require('../models/Estudiante');
const Empresa = require('../models/Empresa'); 
const Profesor = require('../models/Profesor');
const forge = require('node-forge');
const CryptoJS = require('crypto-js');
const { securityLog } = require('../utils/securityLogger');
const { uploadedFilePath } = require('../utils/fileUrl');

// ==========================================
// SEGURIDAD: GENERACIÓN DE LLAVES RSA (ESCENARIO 1)
// ==========================================
let rsaKeyPair = null;

forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, function (err, keypair) {
  if (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error("❌ Error generando llaves RSA:", err);
    }
  } else {
    rsaKeyPair = keypair;
    if (process.env.NODE_ENV !== 'test') {
      console.log("Llaves RSA generadas correctamente para el Cifrado Híbrido");
    }
  }
});

exports.obtenerLlavePublica = (req, res) => {
  if (!rsaKeyPair) {
    return res.status(500).json({ ok: false, mensaje: 'Las llaves aún se están generando. Intenta en un momento.' });
  }
  const publicKeyPem = forge.pki.publicKeyToPem(rsaKeyPair.publicKey);
  res.json({ ok: true, publicKey: publicKeyPem });
};

// ==========================================
// LOGICA PARA FACE ID / WEBAUTHN
// ==========================================
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

exports.opcionesRegistroBiometrico = async (req, res) => {
  try {
    const usuario = req.usuario || req.user; 

    if (!usuario) {
      return res.status(401).json({ ok: false, mensaje: 'Sesión no válida' });
    }

    const id_actual = usuario.id_usuario || usuario.id || usuario.sub;

    if (!id_actual) {
      return res.status(400).json({ 
        ok: false, 
        mensaje: 'ID no encontrado. Por favor, cierra sesión e ingresa de nuevo para actualizar tu acceso.' 
      });
    }

    const [autenticadores] = await db.query(
      'SELECT id_credencial FROM autenticadores_biometricos WHERE id_usuario = ?', 
      [id_actual]
    );

    const options = await generateRegistrationOptions({
      rpName: 'SkillMatch UTEQ',
      rpID: RP_ID,
      userID: Buffer.from(String(id_actual)), 
      userName: usuario.correo || 'usuario@uteq.edu.mx',
      attestationType: 'none',
      excludeCredentials: autenticadores.map(auth => ({
        id: auth.id_credencial,
        type: 'public-key',
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    res.json(options);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error("❌ Error en opciones registro:", error);
    res.status(500).json({ ok: false, mensaje: error.message });
  }
};

exports.verificarRegistroBiometrico = async (req, res) => {
  try {
    const { body } = req;
    const usuario = req.usuario || req.user;
    const id_actual = usuario.id_usuario || usuario.id || usuario.sub;

    if (!body || !body.id) {
      return res.status(400).json({ ok: false, mensaje: 'Datos de registro incompletos' });
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: body.challenge, 
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { registrationInfo } = verification;
      const credentialData = registrationInfo.credential;

      if (!credentialData || !credentialData.id || !credentialData.publicKey) {
          return res.status(400).json({ ok: false, mensaje: 'La información del dispositivo es incompleta.' });
      }

      const credentialID = credentialData.id; 
      const credentialPublicKey = Buffer.from(credentialData.publicKey);
      const counter = credentialData.counter || 0;

      await db.query(
        'INSERT INTO autenticadores_biometricos (id_credencial, id_usuario, llave_publica, contador) VALUES (?, ?, ?, ?)',
        [credentialID, id_actual, credentialPublicKey, counter]
      );
      
      return res.json({ ok: true, mensaje: 'Face ID activado correctamente' });
    }
    
    res.status(400).json({ ok: false, mensaje: 'La verificación biométrica falló' });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error("❌ Error verificando biometría:", error);
    res.status(500).json({ ok: false, mensaje: error.message });
  }
};

exports.opcionesLoginBiometrico = async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
    });

    res.json(options);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error("❌ Error en opciones login:", error);
    res.status(500).json({ ok: false, mensaje: error.message });
  }
};

exports.verificarLoginBiometrico = async (req, res) => {
  try {
    const { authResponse, challenge } = req.body;
    
    const [rows] = await db.query(
      `SELECT u.*, a.id_credencial, a.llave_publica, a.contador 
       FROM usuarios u 
       INNER JOIN autenticadores_biometricos a ON u.id_usuario = a.id_usuario 
       WHERE a.id_credencial = ?`,
      [authResponse.id]
    );

    if (rows.length === 0) return res.status(400).json({ ok: false, mensaje: 'Credencial no reconocida en este dispositivo.' });

    const user = rows[0];

    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: user.id_credencial,
        publicKey: Buffer.from(user.llave_publica),
        counter: Number(user.contador || 0),
      },
    });

    if (verification.verified) {
      await db.query('UPDATE autenticadores_biometricos SET contador = ? WHERE id_credencial = ?', 
        [verification.authenticationInfo.newCounter, user.id_credencial]);

      const token = jwt.sign(
        { id_usuario: user.id_usuario, correo: user.correo, id_rol: user.id_rol },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      return res.json({
        ok: true,
        token,
        usuario: {
          id_usuario: user.id_usuario,
          nombre: user.nombre,
          apellido: user.apellido,
          correo: user.correo,
          id_rol: user.id_rol
        }
      });
    }

    res.status(400).json({ ok: false, mensaje: 'Error al verificar biometría' });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error("❌ Error en verificación login:", error);
    res.status(500).json({ ok: false, mensaje: error.message });
  }
};

// ==========================================
// LOGICA DE AUTENTICACIÓN CONVENCIONAL
// ==========================================

const generarToken = (usuario) => {
  const id = usuario.id_usuario || usuario.id;
  return jwt.sign(
    {
      id_usuario: id,
      correo: usuario.correo,
      id_rol: usuario.id_rol
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

exports.register = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const {
      nombre, apellido, correo, password, telefono, id_rol,
      matricula, carrera, semestre, fecha_inicio_carrera,
      razon_social, giro, contacto,
      departamento, asignaturas
    } = req.body;

    if (!nombre || !apellido || !correo || !password || !id_rol) {
      return res.status(400).json({ ok: false, mensaje: 'Todos los campos obligatorios deben enviarse' });
    }

    if ([1, 5].includes(Number(id_rol))) {
      return res.status(403).json({ ok: false, mensaje: 'Los roles administrativos no se pueden registrar desde el formulario público.' });
    }

    const usuarioExistente = await Usuario.findByCorreo(correo);
    if (usuarioExistente) return res.status(409).json({ ok: false, mensaje: 'El correo ya está registrado' });

    await conn.beginTransaction();
    const password_hash = await bcrypt.hash(password, 10);

    const id_usuario = await Usuario.create({
      nombre, apellido, correo, password_hash, telefono, id_rol, conn
    });

    if (Number(id_rol) === 2) {
      if (!matricula || !carrera || !semestre) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: 'Faltan datos de estudiante' });
      }
      await Estudiante.create({ id_usuario, matricula, carrera, semestre, fecha_inicio_carrera, conn });
    } 
    else if (Number(id_rol) === 3) {
      if (!razon_social || !contacto) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: 'Faltan datos de empresa' });
      }
      await Empresa.create({ id_usuario, razon_social, giro: giro || null, contacto, conn });
    }
    else if (Number(id_rol) === 4) {
      await Profesor.create({ id_usuario, departamento, asignaturas, conn });
    }

    await conn.commit();

    const nuevoUsuario = await Usuario.findById(id_usuario);
    const token = generarToken(nuevoUsuario);

    return res.status(201).json({ 
      ok: true, 
      mensaje: 'Usuario registrado correctamente', 
      usuario: {
        id_usuario: nuevoUsuario.id_usuario,
        nombre: nuevoUsuario.nombre,
        apellido: nuevoUsuario.apellido,
        correo: nuevoUsuario.correo,
        telefono: nuevoUsuario.telefono,
        foto_perfil: nuevoUsuario.foto_perfil,
        id_rol: nuevoUsuario.id_rol
      },
      token 
    });

  } catch (error) {
    if (conn) await conn.rollback();
    if (process.env.NODE_ENV !== 'test') console.error('💥 ERROR GENERAL:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

exports.login = async (req, res) => {
  try {
    const {
      correo,
      password,
      encryptedPassword,
      encryptedAesKey,
      iv
    } = req.body || {};

    const hasMaliciousChars = /[<>'"]/g.test(correo || '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!correo || hasMaliciousChars || !emailRegex.test(correo)) {
      if (process.env.NODE_ENV !== 'test') {
        securityLog('LOGIN_FAILED', req, { reason: 'invalid_or_malicious_email_format' });
      }

      return res.status(400).json({
        ok: false,
        mensaje: 'Formato de correo inválido o caracteres no permitidos.'
      });
    }

    let finalPassword = password;

    if (encryptedPassword && encryptedAesKey && iv) {
      try {
        const decryptedAesKey = rsaKeyPair.privateKey.decrypt(
          forge.util.decode64(encryptedAesKey)
        );

        const aesKeyWordArray = CryptoJS.enc.Base64.parse(decryptedAesKey);
        const ivWordArray = CryptoJS.enc.Base64.parse(iv);

        const decryptedData = CryptoJS.AES.decrypt(
          encryptedPassword,
          aesKeyWordArray,
          {
            iv: ivWordArray,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }
        );

        finalPassword = decryptedData.toString(CryptoJS.enc.Utf8);

        if (!finalPassword) {
          throw new Error('Invalid encrypted payload');
        }
      } catch (_error) {
        if (process.env.NODE_ENV !== 'test') {
          securityLog('LOGIN_DECRYPTION_FAILED', req, { reason: 'invalid_encrypted_payload' });
        }

        return res.status(400).json({
          ok: false,
          mensaje: 'Error de integridad en el inicio de sesión seguro.'
        });
      }
    }

    if (!finalPassword) {
      if (process.env.NODE_ENV !== 'test') {
        securityLog('LOGIN_FAILED', req, { reason: 'missing_password' });
      }

      return res.status(400).json({
        ok: false,
        mensaje: 'Contraseña obligatoria'
      });
    }

    const usuario = await Usuario.findByCorreo(correo);

    if (!usuario || usuario.estado !== 'activo') {
      if (process.env.NODE_ENV !== 'test') {
        securityLog('LOGIN_FAILED', req, { reason: 'invalid_credentials_or_inactive' });
      }

      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas'
      });
    }

    const passwordValido = await bcrypt.compare(
      finalPassword,
      usuario.password_hash
    );

    if (!passwordValido) {
      if (process.env.NODE_ENV !== 'test') {
        securityLog('LOGIN_FAILED', req, { reason: 'invalid_credentials' });
      }

      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas'
      });
    }

    const token = generarToken(usuario);

    if (process.env.NODE_ENV !== 'test') {
      securityLog('LOGIN_SUCCESS', req, {
        userId: usuario.id_usuario || usuario.id,
        roleId: usuario.id_rol
      });
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id_usuario: usuario.id_usuario || usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        telefono: usuario.telefono,
        foto_perfil: usuario.foto_perfil,
        id_rol: usuario.id_rol,
        estado: usuario.estado
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      securityLog('LOGIN_ERROR', req, { reason: 'internal_error' });
      console.error('Error interno durante el inicio de sesión:', error.name);
    }

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

exports.logout = async (req, res) => {
  return res.status(200).json({ ok: true, mensaje: 'Logout exitoso.' });
};

exports.obtenerMiPerfil = async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const usuario = await Usuario.findById(id_usuario);
    if (!usuario) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    let perfil = null;
    if (Number(usuario.id_rol) === 3) {
      const [rows] = await db.query('SELECT * FROM empresas WHERE id_empresa = ? LIMIT 1', [id_usuario]);
      perfil = rows[0] || null;
    } else if (Number(usuario.id_rol) === 4) {
      const [rows] = await db.query('SELECT * FROM profesores WHERE id_profesor = ? LIMIT 1', [id_usuario]);
      perfil = rows[0] || null;
    }

    return res.json({ ok: true, usuario, perfil });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error('Error obteniendo perfil:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar perfil' });
  }
};

exports.actualizarMiPerfil = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id_usuario = req.usuario.id_usuario;
    const usuarioActual = await Usuario.findById(id_usuario);
    if (!usuarioActual) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    const {
      nombre,
      apellido,
      telefono,
      nueva_password,
      razon_social,
      giro,
      contacto,
      domicilio,
      ubicacion,
      sector,
      descripcion_empresa,
      sitio_web,
      tamano_empresa,
      anio_fundacion,
      linkedin,
      cultura_valores,
      beneficios_empresa,
      proceso_seleccion,
      departamento,
      asignaturas
    } = req.body;

    if (!nombre || !apellido) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre y apellido son obligatorios.' });
    }
    if (nueva_password && String(nueva_password).length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    const updates = ['nombre = ?', 'apellido = ?', 'telefono = ?'];
    const params = [nombre, apellido, telefono || null];

    if (req.file) {
      updates.push('foto_perfil = ?');
      params.push(uploadedFilePath(req.file, 'perfiles'));
    }

    if (nueva_password) {
      updates.push('password_hash = ?');
      params.push(await bcrypt.hash(String(nueva_password), 10));
    }

    params.push(id_usuario);

    await conn.beginTransaction();
    await conn.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id_usuario = ?`, params);

    if (Number(usuarioActual.id_rol) === 3) {
      await conn.query(
        `UPDATE empresas SET
          razon_social = COALESCE(?, razon_social),
          giro = ?, contacto = ?, domicilio = ?, ubicacion = ?, sector = ?,
          descripcion_empresa = ?, sitio_web = ?, tamano_empresa = ?, anio_fundacion = ?,
          linkedin = ?, cultura_valores = ?, beneficios_empresa = ?, proceso_seleccion = ?
         WHERE id_empresa = ?`,
        [
          razon_social || null, giro || null, contacto || null, domicilio || null, ubicacion || null,
          sector || null, descripcion_empresa || null, sitio_web || null, tamano_empresa || null,
          anio_fundacion ? Number(anio_fundacion) : null, linkedin || null, cultura_valores || null,
          beneficios_empresa || null, proceso_seleccion || null, id_usuario
        ]
      );
    }

    if (Number(usuarioActual.id_rol) === 4) {
      await conn.query(
        `UPDATE profesores SET departamento = ?, asignaturas = ? WHERE id_profesor = ?`,
        [departamento || null, asignaturas || null, id_usuario]
      );
    }

    await conn.commit();

    const usuario = await Usuario.findById(id_usuario);
    return res.json({ ok: true, mensaje: 'Perfil actualizado correctamente', usuario });
  } catch (error) {
    if (conn) await conn.rollback();
    if (process.env.NODE_ENV !== 'test') console.error('Error actualizando perfil:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar perfil' });
  } finally {
    if (conn) conn.release();
  }
};

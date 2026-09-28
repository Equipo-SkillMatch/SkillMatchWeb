const express = require('express');
const router = express.Router();
const estudianteController = require('../controllers/estudianteController');
const evidenciaController = require('../controllers/evidenciaController');
const verificarToken = require('../middlewares/authMiddleware');
// CAMBIO 1: Importamos con llaves { } las dos funciones del middleware
const { uploadEvidencias, procesarYSubirACloudinary } = require('../middlewares/uploadEvidencias');
const { camposProyectoMedia } = require('../middlewares/uploadProyectoMedia');
const uploadPerfilImagen = require('../middlewares/uploadPerfilImagen');
const softSkillsController = require('../controllers/softSkillsController');

router.get('/dashboard', verificarToken, estudianteController.obtenerDashboard);
router.put('/perfil', verificarToken, uploadPerfilImagen.single('foto_perfil'), estudianteController.actualizarPerfil);
router.delete('/perfil', verificarToken, estudianteController.eliminarCuenta);

// ==========================================
// RUTAS DE PROYECTOS
// ==========================================
router.get('/proyectos', verificarToken, estudianteController.listarMisProyectos);
router.get('/proyectos/:id', verificarToken, estudianteController.obtenerProyecto);
router.post('/proyectos', verificarToken, camposProyectoMedia, estudianteController.crearProyecto);
router.put('/proyectos/:id', verificarToken, camposProyectoMedia, estudianteController.actualizarProyecto);
router.delete('/proyectos/:id', verificarToken, estudianteController.eliminarProyecto);

// ==========================================
// RUTAS PARA COLABORADORES
// ==========================================
router.post('/proyectos/:id_proyecto/colaboradores', verificarToken, estudianteController.agregarColaborador);
router.get('/proyectos/:id_proyecto/colaboradores', verificarToken, estudianteController.obtenerColaboradores);
router.delete('/proyectos/:id_proyecto/colaboradores/:id_colaborador', verificarToken, estudianteController.eliminarColaborador);

// ==========================================
// RUTAS DE EVIDENCIAS
// ==========================================
router.get('/evidencias', verificarToken, evidenciaController.listarMisEvidencias);
// CAMBIO 2: Arreglamos la ruta, agregamos verificarToken y usamos evidenciaController
router.post('/evidencias', verificarToken, uploadEvidencias.single('archivo'), procesarYSubirACloudinary, evidenciaController.subirEvidencia);
router.delete('/evidencias/:id', verificarToken, evidenciaController.eliminarEvidencia);

// ==========================================
// RUTAS DE VACANTES
// ==========================================
router.get('/vacantes', verificarToken, estudianteController.obtenerVacantes);
router.get('/vacantes/:id', verificarToken, estudianteController.obtenerVacanteDetalle);
router.post('/postulaciones', verificarToken, estudianteController.postularVacante);

// ==========================================
// RUTAS DE HABILIDADES BLANDAS
// ==========================================
router.get('/habilidades-blandas/preguntas', verificarToken, softSkillsController.obtenerPreguntas);
router.get('/habilidades-blandas/resultado', verificarToken, softSkillsController.obtenerResultado);
router.post('/habilidades-blandas/responder', verificarToken, softSkillsController.responderTest);

router.get('/perfil-publico/:id', verificarToken, estudianteController.getPerfilPublico);

module.exports = router;
const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

const verificarToken = require('../middlewares/authMiddleware'); 

router.get('/version', publicController.obtenerVersion);
router.get('/grupos-escolares', publicController.listarGruposEscolaresPublicos);
router.get('/proyectos', publicController.listarProyectosPublicos);
router.get('/proyectos/:id', publicController.obtenerDetalleProyecto);

router.post('/proyectos/:id_proyecto/calificar', verificarToken, publicController.calificarProyecto);

module.exports = router;
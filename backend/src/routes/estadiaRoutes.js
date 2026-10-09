const express = require('express');
const router = express.Router();
const verificarToken = require('../middlewares/authMiddleware');
const controller = require('../controllers/estadiaController');
const { uploadEvidencias, procesarYSubirACloudinary } = require('../middlewares/uploadEvidencias');

router.use(verificarToken);
router.get('/resumen', controller.resumen);
router.get('/periodos', controller.listarPeriodos);
router.post('/periodos', controller.crearPeriodo);
router.get('/guias', controller.listarGuias);
router.post('/guias', uploadEvidencias.single('archivo'), procesarYSubirACloudinary, controller.crearGuia);
router.get('/rubricas', controller.listarRubricas);
router.get('/talleres', controller.listarTalleres);
router.post('/talleres', controller.crearTaller);
router.post('/rubricas', controller.crearRubrica);
router.get('/grupos', controller.listarGrupos);
router.post('/grupos', controller.crearGrupo);
router.post('/grupos/:id/alumnos', controller.asignarAlumnoGrupo);
router.get('/grupos/:id/alumnos', controller.alumnosGrupo);
router.get('/grupos/:id/fechas', controller.fechasGrupo);
router.put('/grupos/:id/fechas', controller.guardarFechasGrupo);
router.get('/catalogos-admin', controller.catalogosAdmin);
router.get('/registro/contexto', controller.miContextoRegistro);
router.get('/mi-estadia', controller.obtenerMiEstadia);
router.post('/mi-estadia', controller.registrarMiEstadia);
router.post('/mi-estadia/seguro', uploadEvidencias.single('archivo'), procesarYSubirACloudinary, controller.guardarSeguro);
router.get('/seguros', controller.listarSeguros);
router.put('/seguros/:id', controller.validarSeguro);
router.post('/avances/:idFecha/entregas', uploadEvidencias.single('archivo'), procesarYSubirACloudinary, controller.entregarAvance);
router.get('/profesor/entregas', controller.entregasProfesor);
router.post('/profesor/entregas/:id/revision', controller.revisarEntrega);
router.get('/expedientes', controller.listarExpedientes);
router.get('/expedientes/:id', controller.detalleExpediente);


router.put('/periodos/:id', controller.actualizarPeriodo);
router.delete('/periodos/:id', controller.eliminarPeriodo);
router.delete('/talleres/:id', controller.eliminarTaller);
router.get('/grupos/:id/disponibles', controller.alumnosDisponiblesGrupoEstadia);
router.post('/grupos/:id/alumnos-manual', controller.agregarAlumnoGrupoEstadia);
router.delete('/grupos/:id/alumnos/:idEstudiante', controller.quitarAlumnoGrupoEstadia);
router.delete('/grupos/:id', controller.eliminarGrupoEstadia);
router.get('/resumen-v61', controller.resumenV61);

router.get('/catalogos-v6', controller.catalogosV6);
router.post('/grupos-escolares', controller.crearGrupoEscolar);
router.put('/alumnos/:id/escolar', controller.actualizarAlumnoEscolar);
router.put('/profesores/:id/tutor', controller.actualizarProfesorTutor);
router.put('/grupos/:id/tutor', controller.actualizarTutorGrupo);
router.get('/periodos/:id/grupos-escolares', controller.obtenerGruposPeriodo);
router.put('/periodos/:id/grupos-escolares', controller.guardarGruposPeriodo);
router.post('/periodos/:id/generar-grupos', controller.generarGruposEstadia);
router.put('/talleres/:id', controller.actualizarTaller);
router.get('/configuracion-calificaciones', controller.obtenerCalificaciones);
router.put('/configuracion-calificaciones', controller.actualizarCalificaciones);
router.get('/servicios/alumnos', controller.alumnosServicios);
router.get('/servicios/alumnos/:id', controller.detalleAlumnoServicios);
router.get('/profesor/grupos', controller.gruposProfesor);
router.get('/profesor/grupos/:id', controller.detalleGrupoProfesor);
router.post('/avances/:idFecha/enlace', controller.entregarEnlace);
router.post('/mi-estadia/memoria-final', uploadEvidencias.single('archivo'), procesarYSubirACloudinary, controller.subirMemoriaFinal);
router.put('/profesor/estadias/:idEstadia/memoria-final', controller.autorizarMemoriaFinal);


// V7: directorio de empresas y evaluaciones estructuradas
router.get('/empresas/buscar', controller.buscarEmpresaEstadia);
router.get('/talleres/:numero/criterios', controller.criteriosTaller);
router.get('/niveles-evaluacion', controller.listarNivelesEvaluacion);
router.put('/niveles-evaluacion', controller.actualizarNivelesEvaluacion);
router.get('/criterios-taller', controller.listarCriteriosUniversales);
router.put('/criterios-taller/:numero', controller.actualizarCriteriosTaller);
router.get('/profesor/entregas/:id/evaluacion', controller.detalleEvaluacionEntrega);
router.post('/profesor/entregas/:id/evaluacion-criterios', controller.evaluarEntregaPorCriterios);
router.post('/profesor/estadias/:idEstadia/evaluacion-empresa', controller.generarEvaluacionEmpresa);
router.get('/profesor/evaluaciones-empresa', controller.evaluacionesEmpresaProfesor);
router.get('/evaluaciones-empresa/:id', controller.detalleEvaluacionEmpresa);
router.get('/empresa/practicantes', controller.practicantesEmpresa);
router.post('/empresa/evaluaciones/:id/responder', controller.responderEvaluacionEmpresaCuenta);
router.get('/estadias/:idEstadia/inicio-formal', controller.obtenerInicioFormal);
router.put('/estadias/:idEstadia/inicio-formal', controller.actualizarInicioFormal);
router.get('/estadias/:idEstadia/seguimientos', controller.listarSeguimientos);
router.post('/estadias/:idEstadia/seguimientos', controller.crearSeguimiento);

module.exports = router;

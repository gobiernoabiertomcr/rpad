import { Router } from 'express';
import { authMiddleware, sesionOpcional, adminOnly, cargaNotasDgmit, usaGeneradorDeNotas, cronAuth } from '../middleware/auth.js';
import { limiteLoginPorIp, limiteLoginPorUsuario, limiteRecuperarPorIp, limiteRecuperarPorIdentificador, limiteLinkDeAcceso } from '../middleware/rateLimit.js';

// Controladores
import {
  login, verifySession, changePassword, updateProfile, getProfile,
  recuperarContrasena, validarLinkDeAcceso, establecerContrasenaConLink
} from '../controllers/authController.js';
import {
  getDatasets,
  getDatasetById,
  createDataset,
  updateDataset,
  deleteDataset,
  getEstadisticas,
  registrarActualizacion,
  getCalculoPedido,
  getOpcionesProxima
} from '../controllers/datasetController.js';
import { getTemas, getFrecuencias, getFormatos } from '../controllers/catalogController.js';
import { fetchFromAndino } from '../controllers/andinoController.js';
import {
  getAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea
} from '../controllers/areasController.js';
import {
  ejecutarNotificacionesDiarias,
  pruebaAvisoArea,
  verificarSMTP,
  previewEmail,
  ejecutarNotificacionCambiosPendientes,
  previewCambiosPendientes
} from '../controllers/notificacionesController.js';
import {
  listarNotas,
  obtenerNota,
  descargarPdf,
  descargarAnexo,
  descargarWord,
  reintentarNota,
  verEstado,
  verPreview,
  verPreviewPdf,
  verPreviewAnexo,
  enviarPrueba,
  verConfig,
  guardarConfig,
  subirFirma,
  verFirma,
  subirMembrete,
  verMembrete,
  listarFirmantes,
  elegirFirmante
} from '../controllers/notasDigitalesController.js';
import { verMiFirma, guardarMiFirma, verImagenMiFirma } from '../controllers/firmasController.js';
import {
  reporteEstadoGeneral,
  reporteAvisos,
  reportePorArea,
  reporteAgenda,
  reporteParaCompletar,
  reporteInformeAnual,
  reporteCicloDeVida
} from '../controllers/reportesController.js';
import {
  listarAreasDelGenerador, verAreaDelGenerador, verMembreteDelGenerador, verVistaPrevia, generarNota
} from '../controllers/notasController.js';
import {
  getContadorPendientes,
  getCambiosPendientesParaRevisar,
  getMisCambios,
  getCambioPendienteById,
  verificarDatasetBloqueado,
  aprobarCambio,
  rechazarCambio,
  getDatasetsConPendientes
} from '../controllers/cambiosPendientesController.js';
import {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  reactivarUsuario,
  enviarAcceso
} from '../controllers/usuariosController.js';
import {
  listarLicencias, listarDiasSinAuditor, crearLicencia, editarLicencia, anularLicencia
} from '../controllers/licenciasController.js';
import { enviarContacto } from '../controllers/contactoController.js';
import {
  getMetricasAutomaticas,
  getMetricasManuales,
  createMetricaManual,
  deleteMetricaManual,
  getProyectos,
  getProyectoById,
  createProyecto,
  updateProyecto,
  deleteProyecto,
  createHito,
  updateHito,
  deleteHito,
  getTimeline,
  createLogro,
  exportarMetricasCSV,
  uploadProyectoDocumentos,
  descargarProyectoDocumento,
  deleteProyectoDocumento,
  uploadHitoArchivos,
  descargarHitoArchivo,
  deleteHitoArchivo
} from '../controllers/gestionController.js';
import { listarSeguimiento, verSeguimiento, descargarSeguimientoPdf } from '../controllers/seguimientoController.js';
import { verMetricas, descargarMetricasPdf } from '../controllers/metricasController.js';
import { cargarNotaDgmit, corregirNotaDgmit, anularNotaDgmit } from '../controllers/notasDgmitController.js';
import { uploadProyectoMiddleware, uploadHitoMiddleware } from '../config/upload.js';

const router = Router();

// =====================================================
// Rutas públicas (sin autenticación)
// =====================================================

// Auth (con límite de intentos fallidos)
router.post('/auth/login', limiteLoginPorIp, limiteLoginPorUsuario, login);

// Links de acceso: "¿Olvidaste tu contraseña?" y elegir contraseña (con límite de pedidos)
router.post('/auth/recuperar', limiteRecuperarPorIp, limiteRecuperarPorIdentificador, recuperarContrasena);
router.post('/auth/link/validar', limiteLinkDeAcceso, validarLinkDeAcceso);
router.post('/auth/establecer-contrasena', limiteLinkDeAcceso, establecerContrasenaConLink);

// Datasets (lectura). Con una sesión de administración, con los datos de contacto del área (sesionOpcional: nunca responde
// 401 ni 403; spec 2026-10-24-configuracion, 5.1)
router.get('/datasets', sesionOpcional, getDatasets);
router.get('/datasets/estadisticas', getEstadisticas);
// Cálculo para la pantalla de admin (esta ruta no es pública). Va antes de /datasets/:id, que si no la tomaría por un id
router.get('/datasets/calculo-pedido', authMiddleware, adminOnly, getCalculoPedido);
router.get('/datasets/:id', sesionOpcional, getDatasetById);

// Catálogos
router.get('/catalogos/temas', getTemas);
router.get('/catalogos/frecuencias', getFrecuencias);
router.get('/catalogos/formatos', getFormatos);

// Áreas (lectura pública para selects). Con una sesión de administración, con los datos de contacto y las cuentas de la
// pestaña Áreas de Configuración (sesionOpcional: nunca responde 401 ni 403; spec 2026-10-24-configuracion, 5.1)
router.get('/areas', sesionOpcional, getAreas);
router.get('/areas/:id', sesionOpcional, getAreaById);

// Andino (Portal de Datos Abiertos)
router.get('/andino/fetch', fetchFromAndino);

// Contacto (público con rate limiting)
router.post('/contacto', enviarContacto);

// =====================================================
// Rutas protegidas (requieren autenticación)
// =====================================================

// Auth
router.get('/auth/verify', authMiddleware, verifySession);
router.post('/auth/change-password', authMiddleware, changePassword);

// Perfil
router.get('/auth/profile', authMiddleware, getProfile);
router.put('/auth/profile', authMiddleware, updateProfile);

// Mi firma (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1): admin y superadmin
router.get('/auth/profile/firma', authMiddleware, adminOnly, verMiFirma);
router.put('/auth/profile/firma', authMiddleware, adminOnly, guardarMiFirma);
router.get('/auth/profile/firma/imagen', authMiddleware, adminOnly, verImagenMiFirma);

// Datasets (escritura - solo admin)
router.post('/datasets', authMiddleware, adminOnly, createDataset);
router.put('/datasets/:id', authMiddleware, adminOnly, updateDataset);
router.delete('/datasets/:id', authMiddleware, adminOnly, deleteDataset);
router.post('/datasets/:id/actualizar', authMiddleware, adminOnly, registrarActualizacion);
router.get('/datasets/:id/opciones-proxima', authMiddleware, adminOnly, getOpcionesProxima);

// Áreas (escritura - solo admin)
router.post('/areas', authMiddleware, adminOnly, createArea);
router.put('/areas/:id', authMiddleware, adminOnly, updateArea);
router.delete('/areas/:id', authMiddleware, adminOnly, deleteArea);

// =====================================================
// Cambios Pendientes (protegidas - solo admin)
// =====================================================
router.get('/cambios-pendientes/contador', authMiddleware, adminOnly, getContadorPendientes);
router.get('/cambios-pendientes/para-revisar', authMiddleware, adminOnly, getCambiosPendientesParaRevisar);
router.get('/cambios-pendientes/mis-cambios', authMiddleware, adminOnly, getMisCambios);
router.get('/cambios-pendientes/datasets-bloqueados', authMiddleware, adminOnly, getDatasetsConPendientes);
router.get('/cambios-pendientes/:id', authMiddleware, adminOnly, getCambioPendienteById);
router.get('/cambios-pendientes/verificar/:datasetId', authMiddleware, adminOnly, verificarDatasetBloqueado);
router.post('/cambios-pendientes/:id/aprobar', authMiddleware, adminOnly, aprobarCambio);
router.post('/cambios-pendientes/:id/rechazar', authMiddleware, adminOnly, rechazarCambio);

// =====================================================
// Usuarios (panel: admin y superadmin)
// =====================================================
router.get('/usuarios', authMiddleware, adminOnly, listarUsuarios);
router.post('/usuarios', authMiddleware, adminOnly, crearUsuario);
// Licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5): antes de /usuarios/:id
router.get('/usuarios/licencias', authMiddleware, adminOnly, listarLicencias);
// Días sin auditor (los advierte el formulario de licencias)
router.get('/usuarios/licencias/sin-auditor', authMiddleware, adminOnly, listarDiasSinAuditor);
router.post('/usuarios/licencias', authMiddleware, adminOnly, crearLicencia);
router.put('/usuarios/licencias/:id', authMiddleware, adminOnly, editarLicencia);
router.post('/usuarios/licencias/:id/anular', authMiddleware, adminOnly, anularLicencia);
router.get('/usuarios/:id', authMiddleware, adminOnly, obtenerUsuario);
router.put('/usuarios/:id', authMiddleware, adminOnly, actualizarUsuario);
router.post('/usuarios/:id/desactivar', authMiddleware, adminOnly, desactivarUsuario);
router.post('/usuarios/:id/reactivar', authMiddleware, adminOnly, reactivarUsuario);
router.post('/usuarios/:id/enviar-acceso', authMiddleware, adminOnly, enviarAcceso);

// =====================================================
// Notificaciones (protegidas - solo admin)
// =====================================================
router.get('/notificaciones/ejecutar', authMiddleware, adminOnly, ejecutarNotificacionesDiarias);
router.post('/notificaciones/prueba-area', authMiddleware, adminOnly, pruebaAvisoArea);
router.get('/notificaciones/verificar-smtp', authMiddleware, adminOnly, verificarSMTP);
router.get('/notificaciones/preview/:tipo', authMiddleware, adminOnly, previewEmail);
router.get('/notificaciones/cambios-pendientes', authMiddleware, adminOnly, ejecutarNotificacionCambiosPendientes);
router.get('/notificaciones/preview-cambios-pendientes', authMiddleware, adminOnly, previewCambiosPendientes);

// Notas Digitales (solo admin)
router.get('/notificaciones/notas-digitales', authMiddleware, adminOnly, listarNotas);
router.get('/notificaciones/notas-digitales/estado', authMiddleware, adminOnly, verEstado);
router.get('/notificaciones/notas-digitales/preview', authMiddleware, adminOnly, verPreview);
router.get('/notificaciones/notas-digitales/preview/pdf', authMiddleware, adminOnly, verPreviewPdf);
router.get('/notificaciones/notas-digitales/preview/anexo', authMiddleware, adminOnly, verPreviewAnexo);
router.post('/notificaciones/notas-digitales/prueba', authMiddleware, adminOnly, enviarPrueba);
router.get('/notificaciones/notas-digitales/config', authMiddleware, adminOnly, verConfig);
router.put('/notificaciones/notas-digitales/config', authMiddleware, adminOnly, guardarConfig);
router.get('/notificaciones/notas-digitales/config/firma', authMiddleware, adminOnly, verFirma);
router.put('/notificaciones/notas-digitales/config/firma', authMiddleware, adminOnly, subirFirma);
router.get('/notificaciones/notas-digitales/config/membrete', authMiddleware, adminOnly, verMembrete);
router.put('/notificaciones/notas-digitales/config/membrete', authMiddleware, adminOnly, subirMembrete);
router.get('/notificaciones/notas-digitales/config/firmantes', authMiddleware, adminOnly, listarFirmantes);
router.put('/notificaciones/notas-digitales/config/firmante', authMiddleware, adminOnly, elegirFirmante);
router.get('/notificaciones/notas-digitales/:id', authMiddleware, adminOnly, obtenerNota);
router.get('/notificaciones/notas-digitales/:id/pdf', authMiddleware, adminOnly, descargarPdf);
router.get('/notificaciones/notas-digitales/:id/anexo', authMiddleware, adminOnly, descargarAnexo);
router.get('/notificaciones/notas-digitales/:id/word', authMiddleware, adminOnly, descargarWord);
router.post('/notificaciones/notas-digitales/:id/reintentar', authMiddleware, adminOnly, reintentarNota);

// =====================================================
// Reportes PDF (protegidas, para todos los roles con sesión: spec 2026-10-24-metricas-y-reportes, 5 y 6). Avisos del RPAD reemplaza
// al Historial de notificaciones, y el Cumplimiento ya no está
// =====================================================
router.get('/reportes/estado-general', authMiddleware, reporteEstadoGeneral);
router.get('/reportes/avisos', authMiddleware, reporteAvisos);
router.get('/reportes/por-area/:areaId', authMiddleware, reportePorArea);
router.get('/reportes/agenda', authMiddleware, reporteAgenda);
router.get('/reportes/para-completar', authMiddleware, reporteParaCompletar);
router.get('/reportes/informe-anual', authMiddleware, reporteInformeAnual);
router.get('/reportes/ciclo-de-vida', authMiddleware, reporteCicloDeVida);

// =====================================================
// Seguimiento del dataset (protegidas, para todos los roles con sesión)
// =====================================================
router.get('/seguimiento', authMiddleware, listarSeguimiento);
router.get('/seguimiento/:id/pdf', authMiddleware, descargarSeguimientoPdf);
router.get('/seguimiento/:id', authMiddleware, verSeguimiento);

// =====================================================
// Métricas (protegidas, para todos los roles con sesión: spec 2026-10-24-metricas-y-reportes, 2.3)
// =====================================================
router.get('/metricas', authMiddleware, verMetricas);
router.get('/metricas/pdf', authMiddleware, descargarMetricasPdf);

// =====================================================
// Notas DGMIT (protegidas: administración y el colaborador; corregir y anular, quien la cargó o administración)
// =====================================================
router.post('/notas-dgmit', authMiddleware, cargaNotasDgmit, cargarNotaDgmit);
router.put('/notas-dgmit/:id', authMiddleware, cargaNotasDgmit, corregirNotaDgmit);
router.post('/notas-dgmit/:id/anular', authMiddleware, cargaNotasDgmit, anularNotaDgmit);

// =====================================================
// Generador de notas (protegidas: administración y el colaborador, los que cargan notas DGMIT; spec 2026-10-24-generador-de-notas)
// =====================================================
router.get('/notas/areas', authMiddleware, usaGeneradorDeNotas, listarAreasDelGenerador);
router.get('/notas/areas/:id', authMiddleware, usaGeneradorDeNotas, verAreaDelGenerador);
router.get('/notas/membrete', authMiddleware, usaGeneradorDeNotas, verMembreteDelGenerador);
router.post('/notas/vista-previa', authMiddleware, usaGeneradorDeNotas, verVistaPrevia);
router.post('/notas/generar', authMiddleware, usaGeneradorDeNotas, generarNota);

// =====================================================
// Cron (protegido por clave secreta)
// =====================================================
router.get('/cron/notificaciones', cronAuth, ejecutarNotificacionesDiarias);
router.get('/cron/cambios-pendientes', cronAuth, ejecutarNotificacionCambiosPendientes);

// =====================================================
// Gestión: Métricas y Proyectos (protegidas)
// =====================================================

// Métricas (lectura: todos los autenticados; escritura: solo admin)
router.get('/gestion/metricas', authMiddleware, getMetricasAutomaticas);
router.get('/gestion/metricas/csv', authMiddleware, exportarMetricasCSV);
router.get('/gestion/metricas-manuales', authMiddleware, getMetricasManuales);
router.post('/gestion/metricas-manuales', authMiddleware, adminOnly, createMetricaManual);
router.delete('/gestion/metricas-manuales/:id', authMiddleware, adminOnly, deleteMetricaManual);

// Proyectos (lectura: todos los autenticados; escritura: solo admin)
router.get('/gestion/proyectos', authMiddleware, getProyectos);
router.get('/gestion/proyectos/:id', authMiddleware, getProyectoById);
router.post('/gestion/proyectos', authMiddleware, adminOnly, createProyecto);
router.put('/gestion/proyectos/:id', authMiddleware, adminOnly, updateProyecto);
router.delete('/gestion/proyectos/:id', authMiddleware, adminOnly, deleteProyecto);

// Logros del Área (hitos sin proyecto, solo admin)
router.post('/gestion/logros', authMiddleware, adminOnly, createLogro);

// Hitos (solo admin)
router.post('/gestion/proyectos/:proyecto_id/hitos', authMiddleware, adminOnly, createHito);
router.put('/gestion/hitos/:id', authMiddleware, adminOnly, updateHito);
router.delete('/gestion/hitos/:id', authMiddleware, adminOnly, deleteHito);

// Documentos de proyecto (solo admin)
router.post('/gestion/proyectos/:id/documentos', authMiddleware, adminOnly, uploadProyectoMiddleware, uploadProyectoDocumentos);
router.get('/gestion/proyectos/:id/documentos/:docId/descargar', authMiddleware, adminOnly, descargarProyectoDocumento);
router.delete('/gestion/proyectos/:id/documentos/:docId', authMiddleware, adminOnly, deleteProyectoDocumento);

// Archivos de hitos (solo admin)
router.post('/gestion/hitos/:id/archivos', authMiddleware, adminOnly, uploadHitoMiddleware, uploadHitoArchivos);
router.get('/gestion/hitos/:id/archivos/:archivoId/descargar', authMiddleware, adminOnly, descargarHitoArchivo);
router.delete('/gestion/hitos/:id/archivos/:archivoId', authMiddleware, adminOnly, deleteHitoArchivo);

// Timeline (todos los autenticados)
router.get('/gestion/timeline', authMiddleware, getTimeline);

export default router;

// Generador de Notas (spec 2026-10-24-generador-de-notas, secciones 1, 3, 4.6 y 7): la nota con la que la DGMIT le pide los datos
// a un área, interna (a la Subsecretaría) o externa (al organismo), solicitud o reiteración. Las rutas exigen authMiddleware +
// usaGeneradorDeNotas (administración y el colaborador). No se guarda nada: ni el número, ni la nota, ni quién la generó.
// - GET /api/notas/areas: las áreas con datasets que se pueden elegir (paso 1), con el estado de hoy.
// - GET /api/notas/areas/:id?fecha=: un área con sus datasets calculados a la fecha de la nota (paso 2).
// - GET /api/notas/membrete: la imagen del membrete y el pie, para la hoja de la vista previa.
// - POST /api/notas/vista-previa y POST /api/notas/generar: el HTML de la nota y su Word. Los dos salen de los mismos bloques
//   (construirNotaDgmit), así la vista previa y el Word no pueden decir cosas distintas.
// La validación de los campos es pura (services/notasGeneradorReglas.js) y las consultas están en services/notasGeneradorDatos.js;
// acá se chequea lo que necesita la base: que el área exista y que cada dataset sea del área, se pueda elegir y no esté al día a
// la fecha de la nota.
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
import {
  validarPedidoDeNota, ORDEN_DE_CAMPOS, MENSAJES_GENERADOR, textoAlDia, textoDeOtraArea
} from '../services/notasGeneradorReglas.js';
import { textoNoSePuedeElegir } from '../services/notasDgmitReglas.js';
import { construirNotaDgmit, renderHtmlDeBloques, nombreDelWord } from '../services/notasGeneradorContenido.js';
import { renderDocx, membreteParaWord } from '../services/notasWord.js';
import { disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import {
  areasParaElGenerador, areaParaElGenerador, areaDelGenerador, datasetsDeLaNota, enElOrdenDeLaTabla, membreteParaLaVistaPrevia
} from '../services/notasGeneradorDatos.js';

const TIPO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const AREA_NO_ENCONTRADA = { success: false, error: 'Área no encontrada' };

// [status, cuerpo] de un 400 de validación: { success: false, error, campo, errores }, con el primer error en el orden de los campos
const rechazoEnCampo = (campo, error) => [400, { success: false, error, campo, errores: { [campo]: error } }];
const rechazoDeValidacion = (errores) => {
  const campo = ORDEN_DE_CAMPOS.find((c) => errores[c]);
  return [400, { success: false, error: errores[campo], campo, errores }];
};

// El id de la ruta: solo dígitos y un entero positivo seguro ('abc', '0', '-3', '1.5' y '1e3' no lo son). null si no lo es (404)
const idDelArea = (texto) => {
  if (!/^\d+$/.test(texto ?? '')) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// Responde 500 con el error registrado
const errorInterno = (res, mensaje, error) => {
  console.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: mensaje });
};

/**
 * El pedido de una nota, validado y armado: [status, { datos, bloques, nombre }] o [400, cuerpo del error].
 * Primero la validación pura (validarPedidoDeNota); después, en la base, que el área exista y que cada dataset, en el orden
 * recibido, exista y sea del área, se pueda elegir (sePuedeElegir) y no esté al día a la fecha de la nota; el primero que no
 * cumple da el 400 en `datasets`. Por último, la nota como bloques, con los datasets en el orden de la tabla.
 * @param {unknown} cuerpo El cuerpo del pedido: { fecha, numero, tipo, pedido, anteriores, area_id, datasets }.
 * @param {string} hoy 'AAAA-MM-DD'
 */
const prepararNota = async (cuerpo, hoy) => {
  const { datos, errores } = validarPedidoDeNota(cuerpo, hoy);
  if (Object.keys(errores).length > 0) return rechazoDeValidacion(errores);

  const area = await areaDelGenerador(datos.area_id);
  if (!area) return rechazoEnCampo('area', MENSAJES_GENERADOR.area);

  const porId = await datasetsDeLaNota(datos.datasets, datos.fecha);
  for (const id of datos.datasets) {
    const dataset = porId.get(id);
    if (!dataset || dataset.area_id !== area.id) return rechazoEnCampo('datasets', textoDeOtraArea(dataset?.titulo ?? String(id)));
    if (!dataset.se_puede_elegir) return rechazoEnCampo('datasets', textoNoSePuedeElegir(dataset.titulo));
    if (!dataset.se_puede_pedir) return rechazoEnCampo('datasets', textoAlDia(dataset.titulo));
  }

  const elegidos = enElOrdenDeLaTabla(datos.datasets.map((id) => porId.get(id)));
  const bloques = construirNotaDgmit({
    tipo: datos.tipo,
    pedido: datos.pedido,
    fecha: datos.fecha,
    numero: datos.numero,
    anteriores: datos.anteriores,
    area: { nombre: area.nombre, articulo: area.articulo, area_superior: area.area_superior, articulo_superior: area.articulo_superior },
    datasets: elegidos.map((d) => ({
      titulo: d.titulo, frecuencia: d.frecuencia, datosSolicitados: d.datos_solicitados, queSeSolicita: d.que_se_solicita
    }))
  });
  const nombre = nombreDelWord({ tipo: datos.tipo, pedido: datos.pedido, area: area.nombre, fecha: datos.fecha });
  return [200, { datos, bloques, nombre }];
};

// GET /api/notas/areas: las áreas con datasets que se pueden elegir, con el estado de hoy
export const listarAreasDelGenerador = async (req, res) => {
  try {
    res.json({ success: true, data: await areasParaElGenerador(hoyArgentina()) });
  } catch (error) {
    errorInterno(res, 'Error al obtener las áreas', error);
  }
};

// GET /api/notas/areas/:id?fecha=AAAA-MM-DD: el área con sus datasets a la fecha de la nota (sin fecha, hoy). Un id que no es un
// entero positivo o que no existe, 404; una fecha que no sirve para una nota, el 400 de la fecha (la misma regla de la nota)
export const verAreaDelGenerador = async (req, res) => {
  try {
    const id = idDelArea(req.params.id);
    if (id === null) return res.status(404).json(AREA_NO_ENCONTRADA);
    const hoy = hoyArgentina();
    const fecha = req.query.fecha || hoy;
    const errorFecha = validarPedidoDeNota({ fecha }, hoy).errores.fecha;
    if (errorFecha) {
      const [status, cuerpo] = rechazoEnCampo('fecha', errorFecha);
      return res.status(status).json(cuerpo);
    }
    const area = await areaParaElGenerador(id, fecha);
    if (!area) return res.status(404).json(AREA_NO_ENCONTRADA);
    res.json({ success: true, data: area });
  } catch (error) {
    errorInterno(res, 'Error al obtener el área', error);
  }
};

// GET /api/notas/membrete: la imagen del membrete (un data URL, o null) y el pie, los mismos que lleva el Word
export const verMembreteDelGenerador = async (req, res) => {
  try {
    res.json({ success: true, data: await membreteParaLaVistaPrevia() });
  } catch (error) {
    errorInterno(res, 'Error al obtener el membrete', error);
  }
};

// POST /api/notas/vista-previa: { html, nombre }, el cuerpo de la nota (sin la hoja: la pone la página) y el nombre del Word
export const verVistaPrevia = async (req, res) => {
  try {
    const [status, cuerpo] = await prepararNota(req.body, hoyArgentina());
    if (status !== 200) return res.status(status).json(cuerpo);
    res.json({ success: true, data: { html: renderHtmlDeBloques(cuerpo.bloques), nombre: cuerpo.nombre } });
  } catch (error) {
    errorInterno(res, 'Error al armar la vista previa de la nota', error);
  }
};

// POST /api/notas/generar: el Word, en la hoja membretada y sin firma ("Nota interna - <área> - <AAAA-MM-DD>.docx")
export const generarNota = async (req, res) => {
  try {
    const [status, cuerpo] = await prepararNota(req.body, hoyArgentina());
    if (status !== 200) return res.status(status).json(cuerpo);
    const word = await renderDocx(cuerpo.bloques, await membreteParaWord());
    res.setHeader('Content-Type', TIPO_WORD);
    res.setHeader('Content-Disposition', disposicionDeAdjunto(cuerpo.nombre));
    res.send(word);
  } catch (error) {
    errorInterno(res, 'Error al generar la nota', error);
  }
};

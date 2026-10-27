// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, sección 10): el panel personal de cada usuario, con sus licencias y
// sus horas extras. Todas las rutas llevan authMiddleware y trabajan siempre sobre req.user.userId: nadie ve lo de otra persona.
// Lo cargado se lee con services/miEspacioDatos.js, se calcula con las reglas puras (services/miEspacioReglas.js) y se arma
// como datos con services/miEspacioResumen.js: la página imprime los números y los textos tal cual (Ruling 19). Hoy es
// hoyArgentina(). Respuestas { success, data?, error?, campo? }; un año que no sirve da 400 en `anio`, antes que nada.
// Sin modalidad (sin vínculo cargado en Configuración → Usuarios), las licencias, las horas extras, el año y el saldo inicial
// responden { modalidad: null, mensaje } y no muestran nada; el Resumen lo dice en su `mensaje` (sección 1).
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_MI_ESPACIO, DIAS_VACACIONES, anioVigente, camposDelSaldoInicial, mitadesDe
} from '../services/miEspacioReglas.js';
import { resumenDe, filasDeLicencias, tablaDeHorasExtras, proximoFeriadoDe } from '../services/miEspacioResumen.js';
import { estadoDe, contextoDe } from '../services/miEspacioDatos.js';

// Los años que se pueden pedir (las reglas aceptan más: el control va acá)
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

// El año del pedido como número: sin `anio` (o vacío), el en curso; un texto de cuatro cifras de ANIO_MINIMO a ANIO_MAXIMO, ese
// año; cualquier otra cosa ('abc', '1999', '2026.5', ' 2026', un `anio` repetido, que Express da como lista), null (400)
const anioDelPedido = (valor, hoy) => {
  if (valor === undefined || valor === '') return Number(hoy.slice(0, 4));
  if (typeof valor !== 'string' || !/^\d{4}$/.test(valor)) return null;
  const anio = Number(valor);
  return anio >= ANIO_MINIMO && anio <= ANIO_MAXIMO ? anio : null;
};

// [status, cuerpo]: lo que responde cada ruta
const rechazoDelAnio = () => [400, { success: false, error: MENSAJES_MI_ESPACIO.anio, campo: 'anio' }];
const sinModalidad = () => [200, { success: true, data: { modalidad: null, mensaje: MENSAJES_MI_ESPACIO.sinModalidad } }];
const conDatos = (data) => [200, { success: true, data }];

// Responde lo que devolvió la operación, o 500 con `mensaje` si algo inesperado falló (el error completo, solo en la consola)
const responder = async (res, mensaje, operacion) => {
  try {
    const [status, cuerpo] = await operacion();
    res.status(status).json(cuerpo);
  } catch (error) {
    console.error(`${mensaje}:`, error);
    res.status(500).json({ success: false, error: mensaje });
  }
};

// GET /api/mi-espacio/resumen: el Resumen «Niveles», ya calculado. «Hoy y mañana» lleva el próximo feriado, con las mismas
// filas de los feriados del cálculo (sin leerlas otra vez)
export const verResumen = (req, res) => responder(res, 'Error al obtener el Resumen', async () => {
  const hoy = hoyArgentina();
  const { persona, estado, feriados, filasFeriados, calculo } = await contextoDe(req.user.userId, hoy);
  const hoyYManana = { ausentes: [], proximo_feriado: proximoFeriadoDe(filasFeriados, hoy) };
  return conDatos(resumenDe({ persona, estado, calculo, hoy, feriados, hoyYManana }));
});

// GET /api/mi-espacio/licencias?anio=AAAA: la pestaña Licencias de un año (sin `anio`, el en curso)
export const listarLicenciasMias = (req, res) => responder(res, 'Error al obtener las licencias', async () => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return rechazoDelAnio();
  const { persona, estado, feriados, calculo } = await contextoDe(req.user.userId, hoy);
  if (estado.modalidad === null) return sinModalidad();
  // Sin el paso a Configuración todavía: ninguna fila tiene vínculo con una licencia de Configuración
  return conDatos(filasDeLicencias(estado, calculo, { anio, hoy, persona, vinculos: new Map(), feriados }));
});

// GET /api/mi-espacio/horas-extras?anio=AAAA: la pestaña Horas extras de un año (sin `anio`, el en curso)
export const listarHorasExtras = (req, res) => responder(res, 'Error al obtener las horas extras', async () => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return rechazoDelAnio();
  const { estado, feriados, calculo } = await contextoDe(req.user.userId, hoy);
  if (estado.modalidad === null) return sinModalidad();
  return conDatos(tablaDeHorasExtras(estado, calculo, { anio, hoy, feriados }));
});

// «Se habilitan en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el
// 31/12 de dos años después.», con los días del año (`mitadesDe`: con un número impar, la primera es la mayor). Sin días
// elegidos para ese año ni para uno anterior, «la mitad el 1/7/2026 y la otra mitad el 1/1/2027»
const textoDeLasMitades = (anio, dias) => {
  const primera = `1/7/${anio}`;
  const segunda = `1/1/${anio + 1}`;
  let enDos = `la mitad el ${primera} y la otra mitad el ${segunda}`;
  if (DIAS_VACACIONES.includes(dias)) {
    const [mayor, menor] = mitadesDe(dias);
    enDos = `${mayor} el ${primera} y ${menor} el ${segunda}`;
  }
  return `Se habilitan en dos mitades: ${enDos} (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años `
    + 'después.';
};

// GET /api/mi-espacio/anio/:anio: los días de vacaciones y los estudios que valen ese año, para «Mis vacaciones y saldos». Si no
// los eligió para ese año, los del anterior más cercano (`anioVigente`), con `heredado`; sin ninguno, null
export const verAnio = (req, res) => responder(res, 'Error al obtener el año', async () => {
  const anio = anioDelPedido(req.params.anio, hoyArgentina());
  if (anio === null) return rechazoDelAnio();
  const estado = await estadoDe(req.user.userId);
  if (estado.modalidad === null) return sinModalidad();
  const vigente = anioVigente(estado.anios, anio);
  return conDatos({
    anio,
    dias_vacaciones: vigente?.dias_vacaciones ?? null,
    estudios: vigente?.estudios ?? null,
    heredado: vigente !== null && vigente.anio !== anio,
    texto_mitades: textoDeLasMitades(anio, vigente?.dias_vacaciones)
  });
});

// GET /api/mi-espacio/saldo-inicial: los campos de «Para arrancar» (`camposDelSaldoInicial`, con el arranque o, si todavía no
// hay, con hoy), cada uno con lo guardado en `valor` (null si no hay nada guardado de ese concepto y ese año)
export const verSaldoInicial = (req, res) => responder(res, 'Error al obtener el saldo inicial', async () => {
  const hoy = hoyArgentina();
  const estado = await estadoDe(req.user.userId);
  if (estado.modalidad === null) return sinModalidad();
  const { modalidad, arranque, anios, saldos } = estado;
  const campos = camposDelSaldoInicial({ modalidad, arranque: arranque ?? hoy, anios }).map((campo) => ({
    ...campo,
    valor: saldos.find((saldo) => saldo.concepto === campo.concepto && saldo.anio === campo.anio)?.cantidad ?? null
  }));
  return conDatos({ arranque, modalidad, campos });
});

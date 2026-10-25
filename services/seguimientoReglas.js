// Reglas del Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset-design, "Las fuentes y los movimientos"): qué se
// cuenta de un dataset y con qué textos. Funciones puras, sin base de datos ni Date local para "hoy": las fechas son
// strings 'AAAA-MM-DD' y los momentos 'AAAA-MM-DD HH:MM:SS' en hora argentina. Las fuentes (`Fuentes`) las arma
// services/seguimientoDatos.js. Ninguna función tira error: con datos raros ignoran lo que no pueden leer.
import { esFechaIso, formatoCorto, diasEntre } from './notasDigitalesCalendario.js';
import { NOMBRES_TIPO_PEDIDO, estadoDelDataset, tipoEfectivo, pedido as calcularPedido } from './fechasDatasetReglas.js';
import { cintaDe } from './seguimientoCinta.js';
import { normalizarRequiereNota, textoRequiereNota } from './requiereNotaReglas.js';
import { TEXTO_TIPO_NOTA_DGMIT } from './notasDgmitReglas.js';
import { textoOrigen } from './registroReglas.js';

// Desde cuándo hay registro: el primer email registrado es del 06/12/2025 y el primer cambio, del 26/01/2026
export const REGISTRO_DESDE = Object.freeze({ envios: '2025-12-06', cambios: '2026-01-26' });

// Los asuntos originales de los emails que se retiraron (git show 70c7042^:services/emailTemplates.js), más el del aviso al área
export const ASUNTOS_EMAIL = Object.freeze({
  'interno-60': 'Planificación: Datasets Internos (60 días)',
  'interno-30': 'Atención: Vencimiento en 1 mes (Internos)',
  'interno-vencido': 'Resumen Mensual: Datasets Atrasados (Internos)',
  'externo-60': 'Gestión Administrativa: Redacción de Notas',
  'externo-40': 'Logística: Distribución de Notas',
  'externo-5': 'Seguimiento: Vencimiento Inminente',
  'externo-vencido': 'Resumen Mensual: Sin Respuesta (Externos)',
  'area-aviso-40': 'Aviso: Solicitud próxima de actualización de datos'
});

// Qué pedía cada email a DGMIT, en el título del movimiento (neutro: el asunto original solo se cita en el detalle)
export const QUE_PEDIA = Object.freeze({
  'externo-60': 'redacción de notas',
  'externo-40': 'distribución de notas',
  'externo-5': 'vencimiento inminente',
  'externo-vencido': 'resumen mensual de vencidos',
  'interno-60': 'planificación (60 días)',
  'interno-30': 'vence en 1 mes',
  'interno-vencido': 'resumen mensual de vencidos'
});

// Cuántos días faltaban para el vencimiento cuando salía cada email (los mensuales de vencidos no lo dicen)
export const FALTABAN = Object.freeze({ 'externo-60': 60, 'externo-40': 40, 'externo-5': 5, 'interno-60': 60, 'interno-30': 30 });

// A qué filtro de la lista pertenece cada tipo de movimiento ('dgmit': las notas DGMIT al área, spec 2026-10-24-notas-dgmit)
const FILTRO_DEL_TIPO = Object.freeze({
  nota: 'avisos', email: 'avisos', area: 'area', act: 'actualizaciones', cambio: 'cambios',
  rech: 'propuestas', actp: 'propuestas', cambiop: 'propuestas', auditoria: 'auditoria', alta: 'altas', baja: 'altas', dgmit: 'dgmit'
});

// La aprobación de un alta y la creación del dataset caen en el mismo instante de la transacción: con 5 s alcanza de sobra
const SEGUNDOS_PARA_UNIR_ALTA = 5;

const ENVIO_AUTOMATICO = 'Envío automático';

// ---------------------------------------------------------------------------------------------------------------------
// Fechas, momentos y nombres
// ---------------------------------------------------------------------------------------------------------------------

// 'AAAA-MM-DD' de una fecha o de un momento en texto; también de los JSON viejos ('2025-07-31T03:00:00.000Z'). Si no es un día que existe, null
export const diaDe = (valor) => {
  if (typeof valor !== 'string') return null;
  const dia = valor.slice(0, 10);
  const corte = valor[10];
  return esFechaIso(dia) && (corte === undefined || corte === 'T' || corte === ' ') ? dia : null;
};

// 'AAAA-MM-DD HH:MM:SS' o null (la hora se corta como texto; acá no hay conversión de zona). Lo usan también las métricas
export const momentoDe = (valor) => {
  if (typeof valor !== 'string') return null;
  const partes = valor.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return partes && esFechaIso(partes[1]) ? `${partes[1]} ${partes[2]}` : null;
};

// Los segundos de un momento en hora argentina (para restar dos momentos: la zona no importa), o null. Lo usan también las métricas
// (cuánto tarda la doble verificación)
export const segundosDe = (valor) => {
  const momento = momentoDe(valor);
  if (!momento) return null;
  const [anio, mes, dia, hora, minuto, segundo] = momento.split(/[- :]/).map(Number);
  return Date.UTC(anio, mes - 1, dia, hora, minuto, segundo) / 1000;
};

// "Nombre y apellido corto": el primer nombre y el último apellido, tal como está cargado ('Elena Noelia Cuatro' → 'Elena
// Cuatro'). Con dos palabras o menos, completo. Sin texto, null.
export const nombreCorto = (nombre) => {
  if (typeof nombre !== 'string') return null;
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return null;
  return palabras.length <= 2 ? palabras.join(' ') : `${palabras[0]} ${palabras[palabras.length - 1]}`;
};

const lista = (valor) => (Array.isArray(valor) ? valor : []);
const objeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const textoVacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '';
const sinPunto = (texto) => String(texto).trim().replace(/\.+$/, '');
// El texto recortado y con punto final; si ya termina en punto, en signo de pregunta o de exclamación, o en puntos suspensivos, tal cual
const conPunto = (texto) => {
  const limpio = String(texto).trim();
  return /[.?!…]$/.test(limpio) ? limpio : `${limpio}.`;
};

// ---------------------------------------------------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------------------------------------------------

// Los cambios 'crear' quedan con dataset_id NULL al aprobarse. Se unen al dataset al leer, sin tocar aprobarCambio: la
// aprobación a ≤ 5 s del alta y, entre las que cumplen, primero la de título igual; si el título cambió después, solo la hora.
// Los dos momentos están en hora argentina, así que la diferencia en segundos es exacta.
export const unirAlta = (dataset, altasSinDataset) => {
  const alta = segundosDe(dataset?.alta);
  if (alta === null || !Array.isArray(altasSinDataset)) return null;
  const titulo = textoVacio(dataset.titulo) ? null : String(dataset.titulo).trim();
  const cercanas = altasSinDataset
    .flatMap((cambio) => {
      const revisado = segundosDe(cambio?.revisado);
      return revisado === null ? [] : [{ cambio, distancia: Math.abs(revisado - alta) }];
    })
    .filter(({ distancia }) => distancia <= SEGUNDOS_PARA_UNIR_ALTA)
    .sort((a, b) => a.distancia - b.distancia);
  const mismoTitulo = titulo === null ? undefined
    : cercanas.find(({ cambio }) => !textoVacio(cambio.nuevos?.titulo) && String(cambio.nuevos.titulo).trim() === titulo);
  return (mismoTitulo ?? cercanas[0])?.cambio ?? null;
};

// ---------------------------------------------------------------------------------------------------------------------
// Lo que cambió en un cambio de la ficha
// ---------------------------------------------------------------------------------------------------------------------

// Los campos que cuentan, en el orden en que se dicen. `rotulo`: el nombre en la comparación. Los que tienen `frase` la dicen
// con su valor nuevo; `otro`: no tiene frase propia y va junto en "Cambió: …" (con `enTexto`). Los de tipo 'texto' dicen su valor
// con `texto` (el origen de los datos, spec 2026-10-24-metricas-y-reportes, 4: «Fuente pública», «Los entregó el área» o —).
const CAMPOS = [
  { campo: 'ultima_actualizacion', rotulo: 'Cargado en el portal', tipo: 'fecha', frase: (dia) => `Cargado en el portal el ${dia}.` },
  { campo: 'datos_al', rotulo: 'Datos al', tipo: 'fecha', frase: (dia) => `Datos al ${dia}.` },
  { campo: 'recibido_el', rotulo: 'Recibido el', tipo: 'fecha', frase: (dia) => `Recibido el ${dia}.` },
  { campo: 'origen_datos', rotulo: 'Origen de los datos', tipo: 'texto', texto: textoOrigen, frase: (texto) => `Origen de los datos: ${texto}.` },
  { campo: 'proxima_actualizacion', rotulo: 'Próxima actualización', tipo: 'fecha' },
  { campo: 'frecuencia_id', rotulo: 'Frecuencia', tipo: 'catalogo', catalogo: 'frecuencias', prefijo: 'Frecuencia' },
  { campo: 'area_id', rotulo: 'Área responsable', tipo: 'catalogo', catalogo: 'areas', prefijo: 'Área' },
  { campo: 'titulo', rotulo: 'Título', enTexto: 'título', otro: true },
  { campo: 'descripcion', rotulo: 'Descripción', enTexto: 'descripción', otro: true },
  { campo: 'url_dataset', rotulo: 'URL en el portal', enTexto: 'URL en el portal', otro: true },
  { campo: 'que_se_solicita', rotulo: 'Qué se solicita', enTexto: 'qué se solicita', otro: true },
  { campo: 'observaciones', rotulo: 'Observaciones', enTexto: 'observaciones', otro: true },
  { campo: 'tipo_pedido', rotulo: 'Tipo de pedido', tipo: 'pedido', enTexto: 'tipo de pedido', otro: true },
  { campo: 'tipo_gestion', rotulo: 'Gestión', enTexto: 'gestión', otro: true },
  { campo: 'requiere_nota', rotulo: 'Requiere nota DGMIT', enTexto: 'requiere nota DGMIT', otro: true },
  { campo: 'tema_principal_id', rotulo: 'Tema principal', catalogo: 'temas', enTexto: 'tema principal', otro: true },
  { campo: 'tema_secundario_id', rotulo: 'Tema secundario', catalogo: 'temas', enTexto: 'tema secundario', otro: true },
  { campo: 'formatos', rotulo: 'Formatos', catalogo: 'formatos', enTexto: 'formatos', otro: true }
];

const ordenados = (valores) => [...valores].map(String).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

// El valor de un campo para compararlo: las fechas por su día, las listas ordenadas y el resto como texto recortado. Requiere
// nota DGMIT por su texto (de la base llega 0 o 1; 1, '1' y true son lo mismo, y sin dato es vacío), y los de tipo 'texto' también
// (un valor que no es un origen es como vacío)
const normalizado = (k, valor) => {
  if (k.campo === 'requiere_nota') return textoRequiereNota(valor, '');
  if (k.tipo === 'texto') return k.texto(valor, '');
  if (k.tipo === 'fecha') return diaDe(valor) ?? (textoVacio(valor) ? '' : String(valor).trim());
  if (Array.isArray(valor)) return ordenados(valor).join(',');
  return textoVacio(valor) ? '' : String(valor).trim();
};

// El nombre de un id en el catálogo del campo; si no hay catálogo o no está, el id
const nombreEnCatalogo = (k, valor, catalogos) => {
  const nombres = objeto(objeto(catalogos)[k.catalogo]);
  return Object.hasOwn(nombres, valor) ? String(nombres[valor]) : String(valor);
};

// El valor de un campo para mostrarlo: las fechas en dd/mm/aaaa, los ids por su nombre (si no hay catálogo, el id; una lista, en
// orden alfabético) y '—' si está vacío. Requiere nota DGMIT dice Sí, No o — (el 0 es un valor, no un vacío; «Sin dato» es solo
// de la ficha, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.3 y 1.7)
const textoDelValor = (k, valor, catalogos) => {
  if (k.campo === 'requiere_nota') return textoRequiereNota(valor);
  if (k.tipo === 'texto') return k.texto(valor);
  if (k.tipo === 'fecha') return formatoCorto(diaDe(valor));
  if (Array.isArray(valor)) {
    if (!valor.length) return '—';
    return ordenados(k.catalogo ? valor.map((v) => nombreEnCatalogo(k, v, catalogos)) : valor).join(', ');
  }
  if (textoVacio(valor)) return '—';
  if (k.catalogo) return nombreEnCatalogo(k, valor, catalogos);
  if (k.tipo === 'pedido' && Object.hasOwn(NOMBRES_TIPO_PEDIDO, valor)) return NOMBRES_TIPO_PEDIDO[valor];
  return String(valor).trim();
};

// Los campos de la lista que están en `nuevos` (Object.hasOwn) y difieren de `anteriores`
const camposCambiados = (cambio) => {
  const nuevos = objeto(cambio.nuevos);
  const anteriores = objeto(cambio.anteriores);
  return CAMPOS.filter((k) => Object.hasOwn(nuevos, k.campo) && normalizado(k, nuevos[k.campo]) !== normalizado(k, anteriores[k.campo]));
};

// Las frases de lo que cambió, en el orden de la lista; los campos sin frase propia van juntos al final en "Cambió: …".
const frasesDeLosCampos = (cambio, cambiados, catalogos) => {
  const nuevos = objeto(cambio.nuevos);
  const anteriores = objeto(cambio.anteriores);
  const cambiaLaCarga = cambiados.some((k) => k.campo === 'ultima_actualizacion');
  const frases = cambiados.filter((k) => !k.otro).map((k) => {
    if (k.tipo === 'texto') return k.frase(textoDelValor(k, nuevos[k.campo], catalogos));
    if (k.tipo === 'catalogo') {
      return `${k.prefijo}: ${textoDelValor(k, anteriores[k.campo], catalogos)} a ${textoDelValor(k, nuevos[k.campo], catalogos)}.`;
    }
    const nuevo = diaDe(nuevos[k.campo]);
    if (k.campo === 'proxima_actualizacion') {
      const viejo = diaDe(anteriores[k.campo]);
      if (nuevo === null) return 'Próxima: sin fecha.';
      // Si el mismo cambio mueve la carga, la próxima vieja era de otro ciclo: se dice solo la nueva
      return cambiaLaCarga || viejo === null ? `Próxima: ${formatoCorto(nuevo)}.` : `Próxima: ${formatoCorto(viejo)} a ${formatoCorto(nuevo)}.`;
    }
    return nuevo === null ? `${k.rotulo}: sin fecha.` : k.frase(formatoCorto(nuevo));
  });
  const otros = cambiados.filter((k) => k.otro);
  if (otros.length) frases.push(`Cambió: ${otros.map((k) => k.enTexto).join(', ')}.`);
  return frases;
};

const camposParaMostrar = (cambio, cambiados, catalogos) => {
  const nuevos = objeto(cambio.nuevos);
  const anteriores = objeto(cambio.anteriores);
  return cambiados.map((k) => ({
    campo: k.rotulo,
    antes: textoDelValor(k, anteriores[k.campo], catalogos),
    despues: textoDelValor(k, nuevos[k.campo], catalogos)
  }));
};

// ---------------------------------------------------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------------------------------------------------

const movimiento = (tipo, fecha, momento, titulo, detalle, quien, extra) =>
  ({ tipo, filtro: FILTRO_DEL_TIPO[tipo], fecha, momento, titulo, detalle, quien, extra });

// ['Propuso X', 'Aprobó Y']: lo que no tiene nombre se omite
const quienDe = (...pares) => pares.flatMap(([verbo, nombre]) => {
  const corto = nombreCorto(nombre);
  return corto ? [`${verbo} ${corto}`] : [];
});

// El número de una Nota Digital como lo escribe el libro ('2/26'); sin año, el número solo: la nota que el anexo de la
// reiteración suma en la vista previa ('XX') y en la prueba ('PRUEBA'). Las notas de la base que no son de prueba siempre tienen
// año. Lo usan también las métricas (qué fue el aviso de un ciclo)
export const numeroDeNota = (nota) => (nota.anio === null || nota.anio === undefined
  ? String(nota.numero) : `${nota.numero}/${String(nota.anio).slice(-2)}`);

const movimientoDeAlta = (dataset, alta) => {
  const momento = momentoDe(dataset?.alta);
  if (!momento) return null;
  return movimiento('alta', momento.slice(0, 10), momento, 'Alta en el RPAD',
    alta ? `Cambio #${alta.id}.` : 'Carga inicial del registro.',
    alta ? quienDe(['Propuso', alta.propuso], ['Aprobó', alta.reviso]) : [],
    { cambio_id: alta ? alta.id : null });
};

// Un cambio de la ficha (editar o eliminar) en cualquiera de sus estados. Los 'crear' no entran: el alta sale del dataset.
const movimientoDeCambio = (cambio, catalogos) => {
  const eliminar = cambio.tipo === 'eliminar';
  if (!eliminar && cambio.tipo !== 'editar') return null;
  const cambiados = eliminar ? [] : camposCambiados(cambio);
  const cambiaLaCarga = cambiados.some((k) => k.campo === 'ultima_actualizacion');
  const partes = eliminar ? ['Pedía dar de baja el dataset.'] : frasesDeLosCampos(cambio, cambiados, catalogos);
  const propuesta = ['Propuso', cambio.propuso];
  const numero = `Cambio #${cambio.id}.`;
  const creado = momentoDe(cambio.creado);
  const revisado = momentoDe(cambio.revisado) ?? creado;
  const extra = { cambio_id: cambio.id, campos: camposParaMostrar(cambio, cambiados, catalogos), creado, revisado: momentoDe(cambio.revisado) };

  if (cambio.estado === 'pendiente') {
    if (!creado) return null;
    const tipo = !eliminar && cambiaLaCarga ? 'actp' : 'cambiop';
    const titulo = eliminar ? 'Baja pendiente de aprobación'
      : cambiaLaCarga ? 'Actualización pendiente de aprobación' : 'Cambio pendiente de aprobación';
    return movimiento(tipo, creado.slice(0, 10), creado, titulo, [...partes, numero].join(' '), quienDe(propuesta), extra);
  }
  if (!revisado) return null;
  if (cambio.estado === 'rechazado') {
    const motivo = textoVacio(cambio.motivo) ? [] : [`Motivo: "${String(cambio.motivo).trim()}".`];
    return movimiento('rech', revisado.slice(0, 10), revisado, 'Propuesta rechazada', [...partes, ...motivo, numero].join(' '),
      quienDe(propuesta, ['Rechazó', cambio.reviso]), extra);
  }
  if (cambio.estado !== 'aprobado') return null;
  const quien = quienDe(propuesta, ['Aprobó', cambio.reviso]);
  if (eliminar) return movimiento('baja', revisado.slice(0, 10), revisado, 'Baja del RPAD', numero, quien, extra);
  if (cambiaLaCarga) {
    const carga = diaDe(objeto(cambio.nuevos).ultima_actualizacion) ?? revisado.slice(0, 10);
    return movimiento('act', carga, revisado, 'Actualización registrada', [...partes, numero].join(' '), quien, extra);
  }
  return movimiento('cambio', revisado.slice(0, 10), revisado, 'Cambio en la ficha', [...partes, numero].join(' '), quien, extra);
};

// Las actualizaciones anteriores a la doble verificación: las filas del historial sin cambio_id, una sola por fecha
const movimientosDeHistorial = (historial) => {
  const vistas = new Set();
  const filas = lista(historial).filter((h) => h && typeof h === 'object' && (h.cambio_id === null || h.cambio_id === undefined))
    .sort((a, b) => comparar(String(a.creado ?? ''), String(b.creado ?? '')));
  return filas.flatMap((h) => {
    const fecha = diaDe(h.fecha);
    if (fecha === null || vistas.has(fecha)) return [];
    vistas.add(fecha);
    const momento = momentoDe(h.creado) ?? `${fecha} 00:00:00`;
    const usuario = nombreCorto(h.usuario);
    return [{ mov: movimiento('act', fecha, momento, 'Actualización registrada',
      `Cargado en el portal el ${formatoCorto(fecha)}. Registro anterior a la doble verificación.`, usuario ? [usuario] : [],
      { cambio_id: null, campos: [], creado: momentoDe(h.creado), revisado: null }), id: 0 }];
  });
};

// Una Nota Digital (a DGMIT o de auditoría) sin enviar lo dice al final del detalle
const estadoDeLaNota = (nota) => (nota.estado === 'pendiente' ? ['Pendiente de envío.'] : nota.estado === 'fallida' ? ['No se pudo enviar.'] : []);

// Quién en una Nota Digital: "Generada por X" (o "Envío automático" si la generó la corrida) y "Firmó X" si hay firmante
const quienDeLaNota = (nota) => {
  const generada = nombreCorto(nota.creado_por);
  return [generada ? `Generada por ${generada}` : ENVIO_AUTOMATICO, ...quienDe(['Firmó', nota.firmante])];
};

const movimientoDeNota = (nota) => {
  if (!nota || (nota.tipo !== 'aviso' && nota.tipo !== 'reiteracion')) return null;
  const fecha = diaDe(nota.fecha);
  if (fecha === null) return null;
  const vencimiento = diaDe(nota.vencimiento);
  const deGestion = textoVacio(nota.gestion) ? '' : ` de gestión ${nota.gestion}`;
  const seccion = nota.seccion === 'vencido' ? ', sección vencidos' : nota.seccion === 'proximo' ? ', próximos a vencer' : '';
  const cabecera = nota.tipo === 'reiteracion' ? `Reiteración${deGestion}` : `Aviso${deGestion}${seccion}`;
  const verbo = vencimiento !== null && vencimiento < fecha ? 'vencía' : 'vence';
  const frases = [`${cabecera}${vencimiento === null ? '' : `: ${verbo} el ${formatoCorto(vencimiento)}`}.`];
  if (!textoVacio(nota.datos_solicitados)) frases.push(`Pide: ${sinPunto(nota.datos_solicitados)}.`);
  frases.push(...estadoDeLaNota(nota));
  const enviada = momentoDe(nota.enviada);
  return { mov: movimiento('nota', fecha, enviada ?? `${fecha} 00:00:00`, `Nota Digital N° ${numeroDeNota(nota)} a DGMIT`, frases.join(' '), quienDeLaNota(nota), {
    nota_id: nota.id, numero: nota.numero, anio: nota.anio, vencimiento, datos_solicitados: nota.datos_solicitados ?? null,
    para: nota.para ?? null, cc: nota.cc ?? null, enviada, estado: nota.estado ?? null
  }), id: Number(nota.id) || 0 };
};

// Una nota DGMIT (la nota formal que la DGMIT le manda al área, cargada a mano; spec 2026-10-24-notas-dgmit) que se puede leer: con
// número, un tipo conocido y una fecha de recepción que existe. { id, numero, tipo, recibida, anulada, cargada } o null
const notaDgmitLeida = (nota) => {
  if (!nota || typeof nota !== 'object' || textoVacio(nota.numero) || !Object.hasOwn(TEXTO_TIPO_NOTA_DGMIT, nota.tipo) || !esFechaIso(nota.recibida)) return null;
  return {
    id: Number(nota.id) || 0, numero: String(nota.numero).trim(), tipo: nota.tipo, recibida: nota.recibida,
    anulada: Boolean(nota.anulada), cargada: momentoDe(nota.cargada)
  };
};

// "Anulada el dd/mm/aaaa por X: motivo." con la anulación del historial (ya con los nombres cortos); lo que falta se omite, y sin la
// fila de la anulación, solo "Anulada."
const textoDeAnulacion = (historial) => {
  const anulacion = historial.find((h) => h.accion === 'anulacion');
  if (!anulacion) return 'Anulada.';
  const dia = diaDe(anulacion.momento);
  const cabecera = `Anulada${dia ? ` el ${formatoCorto(dia)}` : ''}${anulacion.por ? ` por ${anulacion.por}` : ''}`;
  return textoVacio(anulacion.motivo) ? `${cabecera}.` : `${cabecera}: ${conPunto(anulacion.motivo)}`;
};

// La nota DGMIT de un dataset. El título y el detalle dicen lo de la nota (y, si está anulada, la anulación al final: la pantalla la
// tacha); "otros" son los demás datasets de la nota. Va el día en que el área la recibió, a las 00:00 (para el orden dentro del día).
// En `extra`, los nombres van cortos y `area` es la del dataset hoy; `por_id` lo saca conNotasDgmitEditables según quién mira.
const movimientoDeNotaDgmit = (nota, dataset) => {
  const leida = notaDgmitLeida(nota);
  if (!leida) return null;
  const propio = objeto(dataset);
  const datasets = lista(nota.datasets).filter((d) => d && typeof d === 'object').map((d) => ({ id: d.id ?? null, titulo: d.titulo ?? null }));
  const otros = datasets.filter((d) => Number(d.id) !== Number(propio.id) && !textoVacio(d.titulo)).map((d) => String(d.titulo).trim());
  const historial = lista(nota.historial).filter((h) => h && typeof h === 'object')
    .map((h) => ({ accion: h.accion ?? null, motivo: h.motivo ?? null, por: nombreCorto(h.por), momento: momentoDe(h.momento) }));
  const frases = [`Recibida por el área el ${formatoCorto(leida.recibida)}.`];
  if (otros.length) frases.push(`La misma nota pide también ${unirConY(otros)}.`);
  if (leida.anulada) frases.push(textoDeAnulacion(historial));
  const titulo = `Nota DGMIT N° ${leida.numero} al área: ${TEXTO_TIPO_NOTA_DGMIT[leida.tipo].toLowerCase()}`;
  return { mov: movimiento('dgmit', leida.recibida, `${leida.recibida} 00:00:00`, titulo, frases.join(' '), quienDe(['Cargó', nota.por]), {
    nota_id: nota.id ?? null, numero: leida.numero, tipo: leida.tipo, recibida: leida.recibida, anulada: leida.anulada, cargada: leida.cargada,
    por: nombreCorto(nota.por), por_id: nota.por_id ?? null, area: propio.area ?? null, datasets, historial
  }), id: leida.id };
};

const movimientoDeAuditoria = (auditoria) => {
  const fecha = diaDe(auditoria?.fecha);
  if (fecha === null) return null;
  const reiterado = auditoria.seccion === 'reiterado' ? ' (reiterado)' : '';
  const detalle = [`Pidió auditar el cambio #${auditoria.cambio_id}${reiterado}.`, ...estadoDeLaNota(auditoria)].join(' ');
  return { mov: movimiento('auditoria', fecha, `${fecha} 00:00:00`, `Nota Digital N° ${numeroDeNota(auditoria)} de auditoría`,
    detalle, quienDeLaNota(auditoria), { nota_id: auditoria.id, cambio_id: auditoria.cambio_id }),
  id: Number(auditoria.id) || 0 };
};

// Los siete emails retirados a DGMIT y el aviso de los 40 días al área
const movimientoDeEmail = (email) => {
  const momento = momentoDe(email?.enviado);
  if (!momento) return null;
  const fecha = momento.slice(0, 10);
  const fallo = !email.success;
  const extra = (asunto) => ({ asunto, destinatarios: email.destinatarios ?? null, enviado: momento, success: Boolean(email.success), error: email.error ?? null });
  const id = Number(email.id) || 0;
  if (email.tipo === 'area-aviso-40') {
    const area = textoVacio(email.area) ? null : String(email.area).trim();
    const detalle = fallo ? 'No se pudo enviar.' : area === null ? 'Al área.' : `${email.area_articulo === 'el' ? 'Al' : 'A la'} ${area}.`;
    const asunto = area === null ? ASUNTOS_EMAIL['area-aviso-40'] : `${ASUNTOS_EMAIL['area-aviso-40']} - ${area}`;
    return { mov: movimiento('area', fecha, momento, 'Email al área: anticipo de la nota formal', detalle, ['Sistema'], extra(asunto)), id };
  }
  if (!Object.hasOwn(QUE_PEDIA, email.tipo)) return null;
  const frases = [];
  if (fallo) frases.push('No se pudo enviar.');
  else {
    if (Object.hasOwn(FALTABAN, email.tipo)) frases.push(`Faltaban ${FALTABAN[email.tipo]} días.`);
    const otros = (Number(email.cantidad) || 0) - 1;
    frases.push(otros >= 2 ? `Junto con otros ${otros} datasets.` : otros === 1 ? 'Junto con otro dataset.' : 'Solo este dataset.');
  }
  return { mov: movimiento('email', fecha, momento, `Email a DGMIT: ${QUE_PEDIA[email.tipo]}`, frases.join(' '), ['Sistema'], extra(ASUNTOS_EMAIL[email.tipo])), id };
};

// Todos los movimientos de un dataset (`Fuentes` de services/seguimientoDatos.js), del más nuevo al más viejo: la fecha, después
// el momento y después el id, de mayor a menor. Cada uno: { tipo, filtro, fecha, momento, titulo, detalle, quien, extra }.
// Las notas DGMIT van todas, también las anuladas, menos las recibidas después de `hoy` ('AAAA-MM-DD'); sin `hoy`, todas.
export const movimientosDe = (fuentes, hoy) => {
  if (!fuentes || typeof fuentes !== 'object') return [];
  const { dataset, catalogos } = fuentes;
  const entradas = [];
  const alta = dataset ? movimientoDeAlta(dataset, unirAlta(dataset, fuentes.altasSinDataset)) : null;
  if (alta) entradas.push({ mov: alta, id: 0 });
  for (const cambio of lista(fuentes.cambios)) {
    const mov = cambio && typeof cambio === 'object' ? movimientoDeCambio(cambio, catalogos) : null;
    if (mov) entradas.push({ mov, id: Number(cambio.id) || 0 });
  }
  entradas.push(...movimientosDeHistorial(fuentes.historial));
  const notasDgmit = lista(fuentes.notasDgmit).map((nota) => movimientoDeNotaDgmit(nota, dataset))
    .filter((entrada) => entrada && (!esFechaIso(hoy) || entrada.mov.fecha <= hoy));
  for (const entrada of [...lista(fuentes.notas).map(movimientoDeNota), ...lista(fuentes.auditorias).map(movimientoDeAuditoria),
    ...lista(fuentes.emails).map(movimientoDeEmail), ...notasDgmit]) {
    if (entrada) entradas.push(entrada);
  }
  entradas.sort((a, b) => comparar(b.mov.fecha, a.mov.fecha) || comparar(b.mov.momento, a.mov.momento) || b.id - a.id);
  return entradas.map((entrada) => entrada.mov);
};

// ---------------------------------------------------------------------------------------------------------------------
// Ciclos
// ---------------------------------------------------------------------------------------------------------------------

const esMeses = (meses) => Number.isInteger(meses) && meses > 0;
const diasTexto = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
// 'a', 'a y b', 'a, b y c'
const unirConY = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`);
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const porMomentoYId = (a, b) => comparar(a.momento, b.momento) || a.id - b.id;

// Un ciclo es el tiempo en que rige un vencimiento (spec, "Ciclos"). Se reconstruye con los cambios 'editar' aprobados y las
// actualizaciones anteriores a la doble verificación (las filas del historial sin cambio_id, una por día), en el orden en que pasaron,
// y el último, el abierto, vence siempre en la próxima actual del dataset. Cada ciclo:
// { inicio, venc, cierre, como, nueva?, desde, hasta, origen, diasVencido }. `inicio`, `venc` y `cierre` son días; `desde` y
// `hasta`, los momentos (el alta, o la aprobación o la actualización que lo abrió, y la que lo cerró) entre los que el ciclo rige en el
// RPAD; `como`: 'actualizacion', 'reprogramacion' (con `nueva`, la próxima a la que se pasó), 'baja' o null (abierto); `origen`:
// cómo empezó, 'alta', 'actualizacion' o 'reprogramacion'; `diasVencido`: cuánto estuvo vencido (hasta el cierre, o hasta hoy).
// Una actualización de antes de la doble verificación cierra el ciclo en su fecha, pero la próxima que se cumplía no quedó
// guardada: si nada la dice, el ciclo que cierra tiene `venc` null y `diasVencido` 0 (no se inventa un atraso). Una que después se
// deshizo por fuera del sistema (la carga que sigue es anterior a ella) no cuenta. null si el dataset no tiene ciclos: es eventual
// (frecuencia sin meses) o no tiene próxima.
export const ciclosDe = (fuentes, hoy) => {
  const dataset = fuentes?.dataset;
  if (!dataset || typeof dataset !== 'object' || !esFechaIso(hoy)) return null;
  const proxima = diaDe(dataset.proxima);
  if (!esMeses(dataset.meses) || proxima === null) return null;

  const aprobados = (tipo) => lista(fuentes.cambios)
    .filter((c) => c && typeof c === 'object' && c.tipo === tipo && c.estado === 'aprobado' && momentoDe(c.revisado) !== null)
    .map((c) => ({ cambio: c, momento: momentoDe(c.revisado), id: Number(c.id) || 0 }))
    .sort(porMomentoYId);
  const ediciones = aprobados('editar');
  const baja = aprobados('eliminar').pop();
  // La carga que siguió a un momento: la anterior del primer cambio aprobado posterior que la trae o, si no hay, la de hoy
  const cargaSiguiente = (momento) => {
    const siguiente = ediciones.find((e) => e.momento > momento && diaDe(objeto(e.cambio.anteriores).ultima_actualizacion) !== null);
    return siguiente ? diaDe(objeto(siguiente.cambio.anteriores).ultima_actualizacion) : diaDe(dataset.ultima);
  };
  // Las actualizaciones simples (el botón de antes de la doble verificación): una por día, la primera, como en los movimientos.
  // Una que después se deshizo por fuera del sistema (la carga que siguió es anterior a ella) no cortó nada
  const vistas = new Set();
  const simples = lista(fuentes.historial)
    .filter((h) => h && typeof h === 'object' && (h.cambio_id === null || h.cambio_id === undefined))
    .sort((a, b) => comparar(String(a.creado ?? ''), String(b.creado ?? '')))
    .flatMap((h) => {
      const fecha = diaDe(h.fecha);
      if (fecha === null || vistas.has(fecha)) return [];
      vistas.add(fecha);
      const momento = momentoDe(h.creado) ?? `${fecha} 00:00:00`;
      const despues = cargaSiguiente(momento);
      return despues !== null && despues < fecha ? [] : [{ simple: fecha, momento, id: 0 }];
    });
  const eventos = [...ediciones, ...simples].sort(porMomentoYId);

  // El vencimiento con el que nació el dataset: la próxima anterior del primer cambio que la trae; sin cambios, la próxima actual.
  // Solo valen los cambios de antes de la primera actualización simple: el vencimiento que ella cumplió no se conoce
  const primeraSimple = simples.length ? simples[0].momento : null;
  const anterioresALaSimple = primeraSimple === null ? ediciones : ediciones.filter((e) => e.momento < primeraSimple);
  const vencInicial = anterioresALaSimple.map(({ cambio }) => diaDe(objeto(cambio.anteriores).proxima_actualizacion)).find(Boolean)
    ?? (primeraSimple === null ? proxima : null);
  let venc = vencInicial;
  // Sin alta conocida, el primer ciclo empieza en su vencimiento; si tampoco se conoce (hubo una simple antes), lo de antes de la
  // simple no es un ciclo: el primero es el que ella abre
  const alta = momentoDe(dataset.alta);
  let inicio = alta ? alta.slice(0, 10) : vencInicial;
  let desde = alta ?? (inicio === null ? null : `${inicio} 00:00:00`);
  let origen = 'alta';
  const ciclos = [];

  for (const evento of eventos) {
    if (evento.simple) {
      // Movía la carga y la próxima en el momento: cierra el ciclo en su fecha y abre otro, cuyo vencimiento lo dirá el cambio
      // siguiente (su próxima anterior) o, si no hay, la próxima actual
      if (inicio !== null) ciclos.push({ inicio, venc, cierre: evento.simple, como: 'actualizacion', desde, hasta: evento.momento, origen });
      inicio = evento.simple; desde = evento.momento; venc = null; origen = 'actualizacion';
      continue;
    }
    const { cambio, momento } = evento;
    // Cada cambio arranca de su propia próxima anterior: si la próxima se corrigió por fuera del sistema (por SQL) después del
    // cambio de antes, manda la que el dataset tenía al proponer este
    const anterior = diaDe(objeto(cambio.anteriores).proxima_actualizacion);
    if (anterior) venc = anterior;
    const nuevos = objeto(cambio.nuevos);
    const cargaAnterior = diaDe(objeto(cambio.anteriores).ultima_actualizacion);
    const carga = diaDe(nuevos.ultima_actualizacion);
    const nuevaProxima = diaDe(nuevos.proxima_actualizacion);
    const dia = momento.slice(0, 10);
    if (carga && carga !== cargaAnterior && nuevaProxima && nuevaProxima !== venc) {
      // Mueve la carga y la próxima: una actualización. El atraso corre hasta la carga; el ciclo rige en el RPAD hasta la aprobación
      ciclos.push({ inicio, venc, cierre: carga, como: 'actualizacion', desde, hasta: momento, origen });
      inicio = carga; desde = momento; venc = nuevaProxima; origen = 'actualizacion';
    } else if (nuevaProxima && nuevaProxima !== venc) {
      // Solo mueve la próxima: antes de vencer se reprograma dentro del ciclo; después de vencer, lo cierra
      if (dia > venc) {
        ciclos.push({ inicio, venc, cierre: dia, como: 'reprogramacion', nueva: nuevaProxima, desde, hasta: momento, origen });
        inicio = dia; desde = momento; origen = 'reprogramacion';
      }
      venc = nuevaProxima;
    }
  }

  const abierto = { inicio, venc: proxima, cierre: null, como: null, desde, hasta: null, origen };
  if (baja) Object.assign(abierto, { cierre: baja.momento.slice(0, 10), como: 'baja', hasta: baja.momento });
  ciclos.push(abierto);
  for (const ciclo of ciclos) {
    const fin = ciclo.cierre ?? hoy;
    ciclo.diasVencido = ciclo.venc !== null && fin > ciclo.venc ? diasEntre(ciclo.venc, fin) : 0;
  }
  return ciclos;
};

// El índice del ciclo al que pertenece un aviso. Con `vencimiento` (el de una Nota Digital), el ciclo que lo tiene; si hay varios,
// el que regía en `momento` o, si ninguno, el último. Sin vencimiento, o si ningún ciclo lo tiene (una próxima corregida por SQL),
// el que regía en el momento del envío: desde la aprobación que lo abrió hasta la que lo cerró (esa ya es del siguiente). Si
// ninguno, el 0. `momento`: 'AAAA-MM-DD HH:MM:SS' (de una nota, `enviada ?? fecha + ' 00:00:00'`).
export const cicloDelAviso = (ciclos, momento, vencimiento = null) => {
  const todos = lista(ciclos);
  const cuando = momentoDe(momento);
  const rige = (ciclo) => cuando !== null && cuando >= ciclo.desde && (!ciclo.hasta || cuando < ciclo.hasta);
  const dia = diaDe(vencimiento);
  if (dia !== null) {
    const con = todos.flatMap((ciclo, i) => (ciclo.venc === dia ? [i] : []));
    if (con.length === 1) return con[0];
    if (con.length > 1) return con.find((i) => rige(todos[i])) ?? con[con.length - 1];
  }
  const i = todos.findIndex(rige);
  return i === -1 ? 0 : i;
};

// ¿Algún ciclo regía en `momento` ('AAAA-MM-DD HH:MM:SS')? El mismo criterio que cicloDelAviso (desde la aprobación que lo abrió
// hasta la que lo cerró), sin su respaldo del ciclo 0: dice si cicloDelAviso encontró el ciclo o cayó en el 0 porque ninguno regía
const algunCicloRige = (ciclos, momento) => {
  const cuando = momentoDe(momento);
  return cuando !== null && lista(ciclos).some((ciclo) => Boolean(ciclo) && cuando >= ciclo.desde && (!ciclo.hasta || cuando < ciclo.hasta));
};

// Qué es un aviso del RPAD a la DGMIT y cuándo salió. Se exportan para que las métricas (services/metricasReglas.js) cuenten los
// mismos avisos que el Seguimiento, sin una copia de la regla.
// Una Nota Digital de aviso o de reiteración que se envió
export const esNotaEnviada = (nota) => Boolean(nota) && (nota.tipo === 'aviso' || nota.tipo === 'reiteracion') && nota.estado === 'enviada';
// El momento de una nota enviada: cuándo se mandó, y si no está, el día de la nota a las 00:00
export const momentoDeEnvioDeNota = (nota) => {
  const fecha = diaDe(nota.fecha);
  return momentoDe(nota.enviada) ?? (fecha === null ? null : `${fecha} 00:00:00`);
};
const masNuevo = (a, b) => (a === null || b > a ? b : a);
// Un email a la DGMIT (los siete retirados, QUE_PEDIA) que se pudo enviar
export const esEmailADgmit = (email) => Boolean(email?.success) && Object.hasOwn(QUE_PEDIA, email.tipo);

// Los avisos de un ciclo: los emails a DGMIT con éxito (`emails`), las Notas Digitales enviadas de aviso y reiteración (`notas`:
// '2/26', por orden de envío) y las fechas de los emails al área (`alArea`, de la más vieja a la más nueva). `total`: emails +
// notas; `ultimo`: el día del más reciente de ellos (sin contar los emails al área), o null. Las notas de auditoría no son avisos:
// tratan de un cambio, no del pedido de datos.
export const avisosDelCiclo = (fuentes, ciclos, indice) => {
  const avisos = { emails: 0, notas: [], alArea: [], total: 0, ultimo: null };
  if (!fuentes || typeof fuentes !== 'object' || !Array.isArray(ciclos)) return avisos;
  const alArea = [];
  for (const email of lista(fuentes.emails)) {
    const delArea = Boolean(email?.success) && email.tipo === 'area-aviso-40';
    const momento = delArea || esEmailADgmit(email) ? momentoDe(email.enviado) : null;
    if (momento === null || cicloDelAviso(ciclos, momento) !== indice) continue;
    if (delArea) alArea.push(momento);
    else { avisos.emails += 1; avisos.ultimo = masNuevo(avisos.ultimo, momento.slice(0, 10)); }
  }
  const notas = [];
  for (const nota of lista(fuentes.notas)) {
    const momento = esNotaEnviada(nota) ? momentoDeEnvioDeNota(nota) : null;
    if (momento !== null && cicloDelAviso(ciclos, momento, nota.vencimiento) === indice) {
      notas.push({ momento, id: Number(nota.id) || 0, numero: numeroDeNota(nota) });
      avisos.ultimo = masNuevo(avisos.ultimo, momento.slice(0, 10));
    }
  }
  avisos.alArea = alArea.sort().map((momento) => momento.slice(0, 10));
  avisos.notas = notas.sort(porMomentoYId).map(({ numero }) => numero);
  avisos.total = avisos.emails + avisos.notas.length;
  return avisos;
};

// El día del aviso más reciente (email a DGMIT con éxito o Nota Digital enviada), de cualquier ciclo; null si no hubo. La lista de
// "Sin elegir" no lo usa: muestra el último del ciclo abierto (`avisosDelCiclo(...).ultimo`), el mismo ciclo que cuenta
export const ultimoAviso = (fuentes) => {
  if (!fuentes || typeof fuentes !== 'object') return null;
  const dias = [
    ...lista(fuentes.emails).filter(esEmailADgmit).map((email) => momentoDe(email.enviado)?.slice(0, 10)),
    ...lista(fuentes.notas).filter(esNotaEnviada).map((nota) => momentoDeEnvioDeNota(nota)?.slice(0, 10))
  ].filter(Boolean);
  return dias.length === 0 ? null : dias.reduce((mayor, dia) => (dia > mayor ? dia : mayor));
};

// Las notas DGMIT vigentes de un dataset (no anuladas y recibidas hasta `hoy`), leídas, de la más vieja a la más nueva: por recibida,
// después por el momento de la carga y después por id
const notasDgmitVigentes = (fuentes, hoy) => lista(fuentes.notasDgmit).map(notaDgmitLeida)
  .filter((n) => n && !n.anulada && n.recibida <= hoy)
  .sort((a, b) => comparar(a.recibida, b.recibida) || comparar(a.cargada ?? '', b.cargada ?? '') || a.id - b.id);

// Las notas DGMIT de cada ciclo (spec 2026-10-24-notas-dgmit, 5; las métricas las ubican igual que el Seguimiento: spec
// 2026-10-24-metricas-y-reportes, 1.2). Una nota DGMIT no es un aviso del RPAD: no cuenta en avisosDelCiclo ni en ultimoAviso, y no
// cambia los ciclos, los hitos ni el estado. Cuentan las vigentes. Cada una es del ciclo que regía el día en que el área la recibió,
// a las 00:00 (cicloDelAviso), así que si ese mismo día se aprobó la actualización que cerró un ciclo, la nota es de ese ciclo (se
// mandó antes de que llegaran los datos). Si ningún ciclo regía ese día (anterior al primero, o posterior a la baja), cicloDelAviso
// da el 0; si ese 0 es el abierto (un solo ciclo), la nota es suya solo si no es anterior a la última carga en el portal
// (`dataset.ultima`; sin ella, o si no es una fecha, lo es), porque una nota anterior ya la respondió esa carga o una anterior
// (ruling R7 de la revisión final); si no, no es de ningún ciclo. Una lista por ciclo, en el orden de `ciclos`, cada una con sus
// notas { id, numero, tipo, recibida, anulada, cargada } de la más vieja a la más nueva (por recibida, después por el momento de
// la carga y después por id). Sin ciclos (eventual o sin fecha), [].
export const notasDgmitPorCiclo = (fuentes, ciclos, hoy) => {
  if (!Array.isArray(ciclos)) return [];
  const porCiclo = ciclos.map(() => []);
  if (ciclos.length === 0 || !fuentes || typeof fuentes !== 'object' || !esFechaIso(hoy)) return porCiclo;
  const abierto = ciclos.length - 1;
  const ultima = diaDe(objeto(fuentes.dataset).ultima);
  for (const nota of notasDgmitVigentes(fuentes, hoy)) {
    const momento = `${nota.recibida} 00:00:00`;
    const indice = cicloDelAviso(ciclos, momento);
    // R7: el ciclo 0 de respaldo, cuando es el abierto, no se queda con una nota anterior a la última carga
    if (indice === abierto && !algunCicloRige(ciclos, momento) && ultima !== null && nota.recibida < ultima) continue;
    porCiclo[indice].push(nota);
  }
  return porCiclo;
};

// La nota DGMIT del ciclo abierto (spec 2026-10-24-notas-dgmit, 5): la más reciente de las suyas en notasDgmitPorCiclo (la última
// de la lista del último ciclo). Sin ciclos (eventual o sin fecha), la vigente más reciente. { numero, tipo, recibida } o null.
export const notaDgmitDelCiclo = (fuentes, ciclos, hoy) => {
  if (!fuentes || typeof fuentes !== 'object' || !esFechaIso(hoy)) return null;
  const hayCiclos = Array.isArray(ciclos) && ciclos.length > 0;
  const nota = (hayCiclos ? notasDgmitPorCiclo(fuentes, ciclos, hoy).at(-1) : notasDgmitVigentes(fuentes, hoy)).at(-1);
  return nota ? { numero: nota.numero, tipo: nota.tipo, recibida: nota.recibida } : null;
};

// Un hito por ciclo que llegó a su vencimiento, del más nuevo al más viejo: { fecha, tipo, texto }. `fecha` es el vencimiento.
export const hitosDe = (ciclos, hoy) => {
  const hitos = [];
  for (const ciclo of lista(ciclos)) {
    if (ciclo.como === 'reprogramacion') {
      hitos.push({ fecha: ciclo.venc, tipo: 'reprogramado', texto: `Venció. Reprogramado el ${formatoCorto(ciclo.cierre)} al ${formatoCorto(ciclo.nueva)}` });
    } else if (ciclo.como === 'actualizacion') {
      if (ciclo.diasVencido > 0) {
        hitos.push({ fecha: ciclo.venc, tipo: 'actualizado',
          texto: `Venció. Actualizado el ${formatoCorto(ciclo.cierre)}, ${diasTexto(ciclo.diasVencido)} después del vencimiento` });
      }
    } else if (ciclo.venc < (ciclo.cierre ?? hoy)) {
      hitos.push({ fecha: ciclo.venc, tipo: 'vencio', texto: 'Venció' });
    }
  }
  return hitos.reverse().sort((a, b) => comparar(b.fecha, a.fecha));
};

// ---------------------------------------------------------------------------------------------------------------------
// Estado y circuito
// ---------------------------------------------------------------------------------------------------------------------

const TEXTO_DEL_ESTADO = Object.freeze({ actualizado: 'Actualizado', proximo: 'Próximo a vencer', eventual: 'Eventual', 'sin-fecha': 'Sin fecha' });

// El estado en el Seguimiento: los dos vencidos (atrasado y sin respuesta) son uno solo, 'vencido', y un dataset dado de baja es
// 'baja'. `dias`, el de estadoDelDataset: negativo si ya venció (null si no tiene vencimiento o está dado de baja).
export const estadoDeSeguimiento = (dataset, hoy) => {
  if (dataset?.activo === false) return { estado: 'baja', texto: 'Dado de baja', dias: null };
  const { estado, dias } = estadoDelDataset({ proxima: diaDe(dataset?.proxima), meses: dataset?.meses, tipoGestion: dataset?.tipo_gestion, hoy });
  if (estado === 'atrasado' || estado === 'sin-respuesta') return { estado: 'vencido', texto: 'Vencido', dias };
  return { estado, texto: TEXTO_DEL_ESTADO[estado], dias };
};

const NODO_MEDIO = Object.freeze({
  externa: Object.freeze({ nombre: 'DGMIT y Dirección Administrativa', rol: 'Mandan la nota formal al área' }),
  interna: Object.freeze({ nombre: 'DGMIT y Dirección de Investigación Territorial', rol: 'Hacen el relevamiento' })
});
// El tramo de afuera de la gestión interna: el relevamiento, que no queda registrado
const TRAMO_RELEVAMIENTO = Object.freeze({ titulo: 'Relevamiento', texto: 'Por fuera del RPAD: no queda registrado' });
// La nota formal de la gestión externa cuando no hay una nota DGMIT cargada en el ciclo abierto (spec 2026-10-24-notas-dgmit, 6 y 7).
// Nunca un reproche: «Pendiente de carga» dice que falta el registro, no la nota. En el anexo de la reiteración, que le llega a la
// DGMIT, el texto es neutral.
const TITULO_NOTA_FORMAL = 'Nota formal';
const TEXTO_NOTA_FORMAL = Object.freeze({
  pendiente: 'Pendiente de carga', // el ciclo abierto ya tuvo algún aviso del RPAD o ya venció: ya hacía falta la nota
  todavia: 'Todavía no hizo falta', // sin avisos en el ciclo abierto y sin vencer, o sin ciclos (eventual o sin fecha)
  baja: 'Ya no se pide', // dado de baja
  anexo: 'La manda la DGMIT al área' // en el anexo de la reiteración
});
// Un externo con «Requiere nota DGMIT» en «No» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7): DGMIT y la Dirección
// Administrativa siguen recibiendo el aviso, pero no hay nota formal al área: los datos se obtienen de la fuente
const NODO_MEDIO_SIN_NOTA = Object.freeze({ ...NODO_MEDIO.externa, rol: 'No hace falta nota formal' });
const TRAMO_FUERA_SIN_NOTA = Object.freeze({ titulo: 'Sin nota formal', texto: 'Los datos se obtienen de la fuente' });

// «Requiere nota DGMIT» del dataset: 1 (Sí), 0 (No) o null (sin dato). En gestión interna es siempre null; un valor que no es Sí ni
// No es sin dato. El 0 es un valor: sobre este campo nunca se usa `|| null`.
const requiereNotaDe = (dataset) => {
  if (dataset?.tipo_gestion === 'interna') return null;
  try {
    return normalizarRequiereNota(dataset?.requiere_nota) ?? null;
  } catch {
    return null;
  }
};

const tituloDeAvisos = (total) => (total === 0 ? 'Sin avisos' : total === 1 ? '1 aviso' : `${total} avisos`);

// "5 emails y la Nota Digital N° 2/26"; con avisos de una sola clase, solo esa. Sin avisos, "Todavía no hizo falta", salvo que el
// ciclo ya esté vencido (`vencido`): ahí sí hacía falta
const textoDeAvisos = ({ emails, notas }, vencido) => {
  const partes = [];
  if (emails > 0) partes.push(emails === 1 ? '1 email' : `${emails} emails`);
  if (notas.length === 1) partes.push(`la Nota Digital N° ${notas[0]}`);
  else if (notas.length > 1) partes.push(`las Notas Digitales N° ${unirConY(notas)}`);
  if (partes.length === 0) return vencido ? 'Todavía no se envió ningún aviso' : 'Todavía no hizo falta';
  return mayuscula(partes.join(' y '));
};

// Las versiones cada vez más cortas del texto de los avisos, para el PDF, donde el texto tiene dos renglones de letra fija (spec
// 2026-10-24-reiteracion-en-su-anexo, decisión del usuario: «recortar del medio»). Se sacan números de notas del medio, de a uno:
// con k notas, la versión m (m = 1 … k − 3) conserva la primera y las últimas k − 1 − m, con «…» entre las dos partes ("11 emails y
// las Notas Digitales N° 2/26, …, 9/26 y 2/27"). Siempre quedan la primera y las dos últimas: la reiteración que acompaña al anexo
// va última. La parte de los emails no cambia. Con 3 notas o menos no hay nada que sacar: []. La pantalla no las usa.
const textosCortosDeAvisos = ({ emails, notas }) => {
  const versiones = [];
  for (let m = 1; m <= notas.length - 3; m++) versiones.push(textoDeAvisos({ emails, notas: [notas[0], '…', ...notas.slice(m + 1)] }));
  return versiones;
};

const textoDelArea = ({ estado, dias }) => {
  if (estado === 'baja') return 'Dado de baja';
  if (dias === null) return 'Sin vencimiento';
  if (dias < 0) return `Vencido hace ${diasTexto(-dias)}`;
  return dias === 0 ? 'Vence hoy' : `Vence en ${diasTexto(dias)}`;
};

// El email que anticipa la nota formal al área (solo en gestión externa), con las fechas del ciclo abierto
const alAreaDe = (fechas) => {
  const el = unirConY(fechas.map((fecha) => `el ${formatoCorto(fecha)}`));
  return {
    fechas,
    texto: fechas.length ? `Además, ${el} el RPAD le anticipó por email al área que iba a recibir una nota formal.` : null,
    textoPdf: fechas.length ? `Al área: ${el} el RPAD le anticipó por email que iba a recibir una nota formal.`
      : 'Al área: en este ciclo todavía no se le envió el email que anticipa la nota formal.'
  };
};

// El circuito del ciclo abierto, para la pantalla y el PDF: el RPAD avisa a DGMIT (`avisos`), ellas mandan la nota formal al área
// (`nodoMedio`, `tramoFuera`) y el área (`area`) vence o no. `ciclos`: los de ciclosDe (si no se pasan, los arma). Sin ciclos
// (eventual o sin fecha) no hay avisos que contar ni vencimiento. `desde`: desde cuándo se cuentan los avisos, el inicio del ciclo
// abierto y cómo empezó ({ fecha, origen, texto }: "Desde la actualización del 16/12/2025"); null sin ciclos o si el ciclo empieza
// en un alta que no se conoce. `avisos`: { titulo, texto, textosCortos }; `textosCortos` son las versiones del texto recortadas del
// medio (textosCortosDeAvisos), solo para el PDF.
// El tramo de afuera (`tramoFuera`): { titulo, texto, registrada, nota, tituloPdf, textoPdf }. En gestión externa, con una nota DGMIT
// del ciclo abierto (notaDgmitDelCiclo), la nota (`registrada` true y `nota` { numero, tipo, recibida }): la pantalla dice cuándo la
// recibió el área ("hoy", "hace 1 día", "hace N días") y el PDF no, porque el anexo queda guardado y se lee después. Sin nota, "Nota
// formal" con «Pendiente de carga», «Todavía no hizo falta» o «Ya no se pide», o, en el anexo de la reiteración
// (`opciones.anexo`), «La manda la DGMIT al área»; el PDF dice lo mismo que la pantalla. En gestión interna, el relevamiento.
// Con «Requiere nota DGMIT» en «No» (solo externos) y sin nota DGMIT no hay nota formal: cambian los textos del medio y del tramo de
// afuera, y el renglón «Al área» (`alArea`) es null, salvo que el RPAD ya le haya mandado al área el email de los 40 días en el ciclo
// abierto (pasa si el dataset estaba en «Sí» y después pasó a «No»): ese email existió y se muestra con sus fechas. Con «No», lo que
// nunca aparece es «todavía no se le envió el email que anticipa la nota formal». Con «Sí» o sin dato, todo como siempre. Si con «No»
// hay una nota DGMIT, existió y se muestra, y el medio vuelve a decir que mandan la nota formal al área.
// Con nota DGMIT, el renglón «Al área» del PDF (`alArea.textoPdf`) nombra la nota; la pantalla (`alArea.texto`) sigue con el email.
const DESDE = Object.freeze({ alta: 'Desde el alta del', actualizacion: 'Desde la actualización del', reprogramacion: 'Desde la reprogramación del' });
const desdeDe = (abierto, dataset) => {
  if (!abierto || !Object.hasOwn(DESDE, abierto.origen) || !esFechaIso(abierto.inicio)) return null;
  if (abierto.origen === 'alta' && momentoDe(dataset.alta) === null) return null;
  return { fecha: abierto.inicio, origen: abierto.origen, texto: `${DESDE[abierto.origen]} ${formatoCorto(abierto.inicio)}` };
};

// Un tramo sin nota DGMIT: el PDF dice lo mismo que la pantalla
const tramoSinRegistro = ({ titulo, texto }) => ({ titulo, texto, registrada: false, nota: null, tituloPdf: titulo, textoPdf: texto });

// "hoy", "hace 1 día" o "hace N días": los días de calendario entre la recepción y hoy, contados como texto
const haceDias = (recibida, hoy) => {
  const dias = diasEntre(recibida, hoy);
  return dias === 0 ? 'hoy' : `hace ${diasTexto(dias)}`;
};

// El tramo con la nota DGMIT del ciclo abierto (`nota`: la de notaDgmitDelCiclo, recibida hasta hoy)
const tramoDeLaNota = (nota, hoy) => {
  const tipo = TEXTO_TIPO_NOTA_DGMIT[nota.tipo];
  const dia = formatoCorto(nota.recibida);
  return {
    titulo: `Nota DGMIT N° ${nota.numero}`, texto: `${tipo} recibida por el área el ${dia}, ${haceDias(nota.recibida, hoy)}`,
    registrada: true, nota: { ...nota }, tituloPdf: 'Nota DGMIT', textoPdf: `${tipo} ${nota.numero}. Recibida el ${dia}`
  };
};

const textoPdfAlAreaDeLaNota = (nota) =>
  `Al área: el ${formatoCorto(nota.recibida)} recibió la nota DGMIT N° ${nota.numero} (${TEXTO_TIPO_NOTA_DGMIT[nota.tipo].toLowerCase()}), que pide los datos de este dataset.`;

export const circuitoDe = (fuentes, ciclos, hoy, opciones = {}) => {
  const dataset = fuentes?.dataset;
  if (!dataset || typeof dataset !== 'object') return null;
  const anexo = objeto(opciones).anexo === true;
  const todos = ciclos === undefined ? ciclosDe(fuentes, hoy) : ciclos;
  const hayCiclos = Array.isArray(todos) && todos.length > 0;
  const abierto = hayCiclos ? todos[todos.length - 1] : null;
  const gestion = dataset.tipo_gestion === 'interna' ? 'interna' : 'externa';
  const estado = estadoDeSeguimiento(dataset, hoy);
  const delCiclo = hayCiclos ? avisosDelCiclo(fuentes, todos, todos.length - 1) : { emails: 0, notas: [], alArea: [], total: 0 };
  const nota = gestion === 'externa' ? notaDgmitDelCiclo(fuentes, todos, hoy) : null;
  // «Requiere nota DGMIT» en «No» y sin nota DGMIT: no hay nota formal
  const sinNotaFormal = gestion === 'externa' && requiereNotaDe(dataset) === 0 && nota === null;
  const fechasAlArea = [...new Set(delCiclo.alArea)];

  let tramoFuera;
  if (gestion === 'interna') tramoFuera = tramoSinRegistro(TRAMO_RELEVAMIENTO);
  else if (nota) tramoFuera = tramoDeLaNota(nota, hoy);
  else if (sinNotaFormal) tramoFuera = tramoSinRegistro(TRAMO_FUERA_SIN_NOTA);
  else {
    const texto = anexo ? TEXTO_NOTA_FORMAL.anexo
      : estado.estado === 'baja' ? TEXTO_NOTA_FORMAL.baja
        : hayCiclos && (delCiclo.total > 0 || abierto.diasVencido > 0) ? TEXTO_NOTA_FORMAL.pendiente
          : TEXTO_NOTA_FORMAL.todavia;
    tramoFuera = tramoSinRegistro({ titulo: TITULO_NOTA_FORMAL, texto });
  }

  let alArea = null;
  if (gestion === 'externa' && nota) alArea = { ...alAreaDe(fechasAlArea), textoPdf: textoPdfAlAreaDeLaNota(nota) };
  else if (gestion === 'externa' && !(sinNotaFormal && fechasAlArea.length === 0)) alArea = alAreaDe(fechasAlArea);

  const vencido = hayCiclos && abierto.diasVencido > 0;
  return {
    nodoMedio: { ...(sinNotaFormal ? NODO_MEDIO_SIN_NOTA : NODO_MEDIO[gestion]) },
    tramoFuera,
    avisos: {
      titulo: tituloDeAvisos(delCiclo.total),
      texto: hayCiclos ? textoDeAvisos(delCiclo, vencido) : 'Sin vencimiento',
      textosCortos: hayCiclos ? textosCortosDeAvisos(delCiclo) : []
    },
    area: { nombre: dataset.area ?? null, texto: textoDelArea(estado), vencido: estado.estado === 'vencido' },
    alArea,
    desde: desdeDe(abierto, dataset),
    vencimiento: abierto ? { fecha: abierto.venc, texto: `Vencimiento del ${formatoCorto(abierto.venc)}` } : null
  };
};

// ---------------------------------------------------------------------------------------------------------------------
// Ensamblado y nombre del PDF
// ---------------------------------------------------------------------------------------------------------------------

// Solo http y https: una URL de otra clase (javascript:, data:, una ruta) no se ofrece como link
const urlWeb = (valor) => {
  if (typeof valor !== 'string') return null;
  const url = valor.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  try { new URL(url); return url; } catch { return null; }
};

// La ficha: lo que muestran la pantalla y el PDF del dataset. `baja`: el día de la baja aprobada (la del movimiento 'baja', el más
// nuevo si hubiera más de uno), o null. `pedido`: el texto de lo que se pediría hoy, o null (eventual, sin vencimiento o dado de
// baja: a un dataset dado de baja ya no se le pide nada). `requiere_nota`: «Requiere nota DGMIT», 1 (Sí), 0 (No) o null (sin dato;
// siempre null en gestión interna): cada pantalla lo escribe a su manera (Sí, No o Sin dato).
const fichaDe = (dataset, movimientos, hoy) => {
  const datos = objeto(dataset);
  const proxima = diaDe(datos.proxima);
  const datosAl = diaDe(datos.datos_al);
  const tipo = tipoEfectivo({ tipo_pedido: datos.tipo_pedido, tipo_gestion: datos.tipo_gestion, meses: datos.meses });
  return {
    id: datos.id ?? null,
    titulo: datos.titulo ?? null,
    area: datos.area ?? null,
    area_superior: datos.area_superior ?? null,
    tipo_gestion: datos.tipo_gestion ?? null,
    requiere_nota: requiereNotaDe(datos),
    frecuencia: datos.frecuencia ?? null,
    datos_al: datosAl,
    ultima: diaDe(datos.ultima),
    proxima,
    pedido: datos.activo === false ? null : calcularPedido({ vencimiento: proxima, tipo, datosAl, meses: datos.meses, hoy })?.texto ?? null,
    url_dataset: urlWeb(datos.url_dataset),
    estado: estadoDeSeguimiento(datos, hoy),
    activo: datos.activo !== false,
    baja: lista(movimientos).find((m) => m?.tipo === 'baja')?.fecha ?? null
  };
};

// Todo el Seguimiento de un dataset, listo para la pantalla y el PDF: { ficha, circuito, cinta, movimientos, hitos, registro }.
// `opcionesCinta`: { separacion, letra } de cintaDe (el PDF usa 12 y 8,4; sin opciones, las de la pantalla). `opciones`: las de
// circuitoDe ({ anexo: true } en el anexo de la reiteración). Los movimientos (sin las notas DGMIT recibidas después de `hoy`) y los
// ciclos se calculan una sola vez.
export const seguimientoDe = (fuentes, hoy, opcionesCinta = {}, opciones = {}) => {
  const movimientos = movimientosDe(fuentes, hoy);
  const ciclos = ciclosDe(fuentes, hoy);
  return {
    ficha: fichaDe(fuentes?.dataset, movimientos, hoy),
    circuito: circuitoDe(fuentes, ciclos, hoy, opciones),
    cinta: cintaDe({ ...objeto(opcionesCinta), fuentes, ciclos, movimientos, hoy }),
    movimientos,
    hitos: hitosDe(ciclos, hoy),
    registro: { ...REGISTRO_DESDE }
  };
};

// Para quien no administra: el seguimiento sin el texto técnico del error de un email que no se pudo enviar (por ejemplo,
// "connect ECONNREFUSED …"), en los emails a DGMIT y al área; el detalle sigue diciendo "No se pudo enviar.". Devuelve una copia
// (no toca la que recibe) y deja todo lo demás igual. El PDF no muestra esos textos.
export const sinErroresTecnicos = (seguimiento) => {
  if (!seguimiento || typeof seguimiento !== 'object' || !Array.isArray(seguimiento.movimientos)) return seguimiento;
  const deEmail = (m) => (m?.tipo === 'email' || m?.tipo === 'area') && m.extra && typeof m.extra === 'object';
  return { ...seguimiento, movimientos: seguimiento.movimientos.map((m) => (deEmail(m) ? { ...m, extra: { ...m.extra, error: null } } : m)) };
};

// Según quién mira (spec 2026-10-24-notas-dgmit, 8): en cada movimiento de una nota DGMIT, `extra.editable` dice si puede corregirla
// o anularla (quien la cargó o administración) y `extra.por_id` sale de la respuesta. `usuarioId`: el id de quien mira;
// `administracion`: si es de administración (esAdmin); falla cerrado, solo cuenta el `true` literal. Una nota sin quién la cargó solo
// la edita administración. Devuelve una copia (no toca la que recibe) y deja todo lo demás igual.
export const conNotasDgmitEditables = (seguimiento, quien = {}) => {
  if (!seguimiento || typeof seguimiento !== 'object' || !Array.isArray(seguimiento.movimientos)) return seguimiento;
  const { usuarioId, administracion } = objeto(quien);
  const esSuya = (porId) => porId !== null && porId !== undefined && usuarioId !== null && usuarioId !== undefined && String(porId) === String(usuarioId);
  return {
    ...seguimiento,
    movimientos: seguimiento.movimientos.map((m) => {
      if (m?.tipo !== 'dgmit' || !m.extra || typeof m.extra !== 'object') return m;
      const { por_id: porId, ...extra } = m.extra;
      return { ...m, extra: { ...extra, editable: administracion === true || esSuya(porId) } };
    })
  };
};

// Una fila de la lista de "Sin elegir": el estado (la clave corta de estadoDeSeguimiento), los días (negativos si ya venció), los
// avisos del ciclo abierto (sin ciclos, eventual o sin fecha, en cero), el día del último aviso, si hay un cambio pendiente,
// «Requiere nota DGMIT» (1, 0 o null, como la ficha) y la nota DGMIT del ciclo abierto (`nota_dgmit`: { numero, tipo, recibida } o null).
export const resumenParaLista = (fuentes, hoy) => {
  const dataset = objeto(fuentes?.dataset);
  const ciclos = ciclosDe(fuentes, hoy);
  const { estado, dias } = estadoDeSeguimiento(dataset, hoy);
  const delCiclo = Array.isArray(ciclos) ? avisosDelCiclo(fuentes, ciclos, ciclos.length - 1) : { emails: 0, notas: [] };
  return {
    id: dataset.id ?? null,
    titulo: dataset.titulo ?? null,
    area: dataset.area ?? null,
    tipo_gestion: dataset.tipo_gestion ?? null,
    requiere_nota: requiereNotaDe(dataset),
    activo: dataset.activo !== false,
    estado,
    dias,
    proxima: diaDe(dataset.proxima),
    avisos: { total: delCiclo.emails + delCiclo.notas.length, emails: delCiclo.emails, notas: delCiclo.notas.length },
    ultimo_aviso: delCiclo.ultimo ?? null,
    nota_dgmit: notaDgmitDelCiclo(fuentes, ciclos, hoy),
    pendiente: lista(fuentes?.cambios).some((cambio) => cambio?.estado === 'pendiente')
  };
};

// El nombre del PDF descargado. La pantalla (public/js/seguimiento.js) lleva una copia de esta regla: si cambia acá, cambia allá.
export const nombreDelPdf = (titulo, hoy) => `Seguimiento - ${titulo} - ${hoy}.pdf`;

// El encabezado Content-Disposition de una descarga. Un encabezado HTTP solo admite ASCII visible: `filename` lleva el nombre sin
// tildes y con "_" en lugar de lo que no sea ASCII, las comillas y la barra invertida (ERR_INVALID_CHAR), y `filename*` (RFC 5987)
// lleva el nombre completo codificado, con el apóstrofo, los paréntesis y el asterisco también.
export const disposicionDeAdjunto = (nombre) => {
  const texto = typeof nombre === 'string' ? nombre : String(nombre ?? '');
  const ascii = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]|["\\]/g, '_');
  const rfc5987 = encodeURIComponent(texto.toWellFormed()).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${rfc5987}`;
};

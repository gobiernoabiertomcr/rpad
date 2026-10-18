// Contenido de las Notas Digitales: textos fijos, estructura de la nota y versiones HTML y texto plano.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6)
import {
  formatoCorto, formatoLargo, mesYAnio, diasEntre, esFechaIso, textoRangoMeses, diasHabilesTranscurridos
} from './notasDigitalesCalendario.js';
import { RPAD_URL } from './emailTemplates.js';
import { NOMBRES_TIPO_PEDIDO } from './fechasDatasetReglas.js';

const REF = 'Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal';
const DESTINATARIO = 'DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL';
const REMITENTE = 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN';

const PARRAFO_INICIAL = {
  aviso: {
    interna: 'Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación, publicados en el Portal de Datos Abiertos Municipal, requieren ser actualizados. En tal sentido, solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.',
    // El externo pide el período de cada dataset y la fecha sugerida de envío (spec 2026-10-17-fechas-datasets, 9). El interno
    // no: casi todos sus pedidos son relevamientos, sin fechas
    externa: 'Informo a Ud. que los conjuntos de datos detallados a continuación, publicados en el Portal de Datos Abiertos Municipal y provistos por otras áreas municipales y organismos, requieren ser actualizados. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso y, de ser posible, antes de la fecha sugerida de envío.'
  },
  reiteracion: {
    interna: 'Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos de gestión interna informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.',
    externa: 'Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).'
  }
};

const SECCIONES = {
  proximo: {
    titulo: 'Próximos a vencer',
    introduccion: 'Los siguientes conjuntos de datos se encuentran próximos a cumplir su plazo de actualización:'
  },
  vencido: {
    titulo: 'Plazo de actualización vencido',
    introduccion: 'Los siguientes conjuntos de datos se encuentran con su plazo de actualización vencido:'
  }
};

const JUSTIFICACION = {
  aviso: [
    'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos, tanto de áreas municipales como de organismos externos, en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar).',
    'La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.'
  ],
  reiteracion: [
    'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar). La información actualizada puede ser remitida a datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, y será publicada en cumplimiento del Artículo 9° de la mencionada ordenanza.'
  ]
};

const CAMPOS_CONTACTO = [
  ['area_superior', 'Depende de'],
  ['email_principal', 'Email'],
  ['email_secundario', 'Email alternativo'],
  ['telefono_area', 'Teléfono'],
  ['celular_area', 'Celular'],
  ['nombre_contacto', 'Persona de contacto'],
  ['telefono_contacto', 'Teléfono de contacto'],
  ['email_contacto', 'Email de contacto']
];

// Primera línea del email (en bordó en el HTML): la nota formal es el PDF adjunto, y el aviso suma su anexo
const AVISO_ADJUNTO = { aviso: 'SE ADJUNTAN NOTA Y ANEXO EN PDF', reiteracion: 'SE ADJUNTA NOTA EN PDF' };

// Personal contratado (usuarios.vinculo = 'contrato', sin designación formal; pedido del usuario el 16/10/2026): en la firma,
// un renglón más chico entre el nombre y el cargo; dentro de los párrafos, en minúscula. Quien no es contratado (o no tiene
// el dato) sale como siempre. La palabra es neutra: el sistema no infiere el género.
export const RENGLON_FIRMA_CONTRATADO = 'Personal contratado, cumpliendo funciones de';
const CONTRATADO_EN_TEXTO = 'personal contratado, cumpliendo funciones de';

// El cargo de una persona como se nombra dentro de un párrafo
export const cargoEnTexto = ({ cargo, contratado }) => (contratado ? `${CONTRATADO_EN_TEXTO} ${cargo}` : cargo);

// Los renglones de una firma, en orden: el nombre, el renglón del personal contratado (chico: más chico que el cargo) y el
// cargo. Los dibujan el HTML, el texto y el PDF.
export const renglonesDeFirma = ({ nombre, cargo, contratado }) => [
  { texto: nombre, chico: false },
  ...(contratado ? [{ texto: RENGLON_FIRMA_CONTRATADO, chico: true }] : []),
  { texto: cargo, chico: false }
];

// Autorización para presentar las notas durante la licencia del firmante (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.2).
// a: { nombre, cargo, contratado, desde, hasta } de la persona autorizada y la licencia
const periodoLicencia = ({ desde, hasta }) => `del ${formatoCorto(desde)} al ${formatoCorto(hasta)}`;
const PARRAFO_AUTORIZACION = (a) => `Asimismo, por medio de la presente autorizo expresamente a ${a.nombre}, ${cargoEnTexto(a)}, a presentar en mi nombre las Notas Digitales durante mi licencia, ${periodoLicencia(a)}, con el objetivo de mantener el correcto flujo de trabajo.`;
const TEXTO_NOTA_AUTORIZACION = (a) => `Por medio de la presente informo que, durante mi licencia ${periodoLicencia(a)}, autorizo expresamente a ${a.nombre}, ${cargoEnTexto(a)}, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.`;
const REF_AUTORIZACION = 'Autorización para la presentación de Notas Digitales';

export const escapeHtml = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const urlSegura = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null);
const cantidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

const textoNumero = ({ numero, anio, esPrueba = false }) => {
  if (esPrueba) return 'PRUEBA';
  if (numero == null) return 'XX';
  return `${numero}/${String(anio).slice(-2)}`;
};

// Leyenda de una nota presentada por la persona autorizada (spec 2026-10-15, 7.2): cita la nota de autorización
export const textoLeyendaAutorizacion = ({ presentante, titular, nota, licencia }) =>
  `Nota presentada por ${presentante.nombre}, ${cargoEnTexto(presentante)}, en nombre de ${titular.nombre}, ${cargoEnTexto(titular)}, `
  + `conforme a la autorización conferida mediante Nota Digital N° ${textoNumero(nota)} (licencia ${periodoLicencia(licencia)}).`;

// La firma de la nota: la del titular (o la de la configuración, sin firmante elegido: nunca de personal contratado) y,
// durante su licencia con autorización, la de quien la presenta con la leyenda (spec 2026-10-15, 7.2). Cada una dice si es
// de personal contratado.
const firmaDeLaNota = (firma, config) => ({
  nombre: firma?.titular?.nombre ?? config?.firma_nombre ?? '',
  cargo: firma?.titular?.cargo ?? config?.firma_cargo ?? '',
  contratado: Boolean(firma?.titular?.contratado),
  presentante: firma?.presentante
    ? { nombre: firma.presentante.nombre, cargo: firma.presentante.cargo, contratado: Boolean(firma.presentante.contratado) }
    : null,
  leyenda: firma?.presentante ? firma.leyenda ?? null : null
});

const situacion = (vencimiento, fecha) => {
  const dias = diasEntre(fecha, vencimiento);
  if (dias > 0) return `${dias === 1 ? 'Falta' : 'Faltan'} ${cantidad(dias, 'día', 'días')}`;
  if (dias === 0) return 'Vence hoy';
  return `Vencido hace ${cantidad(-dias, 'día', 'días')}`;
};

// "A", "B" y "C": los elementos separados por coma y un "y" antes del último
const enumeracion = (elementos) => (elementos.length > 1
  ? `${elementos.slice(0, -1).join(', ')} y ${elementos.at(-1)}`
  : elementos.join(''));

// Un vencido que nunca tuvo aviso (spec 5.3, condición 2) dice "Sin aviso previo". Un dataset con más de un aviso (aviso
// anticipado y aviso en su fecha, spec 2026-10-15, 7.6) los nombra todos: informado es el primero y informado.tambien, los demás
const textoInformado = (dataset) => {
  const avisos = dataset.informado ? [dataset.informado, ...(dataset.informado.tambien ?? [])] : [];
  const base = avisos.length
    ? `Nota Digital ${enumeracion(avisos.map(aviso => `N° ${textoNumero(aviso)} (${formatoCorto(aviso.fecha)})`))}`
    : 'Sin aviso previo';
  return dataset.reiteraciones > 0 ? `${base} – reiterado ${cantidad(dataset.reiteraciones, 'vez', 'veces')}` : base;
};

// Párrafo del aviso en su fecha con persona autorizada (spec 2026-10-15, 7.6): los datasets que la nota anticipada de la víspera
// ya había pedido (adelantado: { numero, anio, fecha }) se citan con esa nota. Si lo adelantó la misma nota a todos, "Este
// pedido …"; si no, una oración por cada nota que adelantó alguno, en el orden de su primera aparición, con los títulos
// entre comillas. Sin ningún adelantado, null. Solo se cita una nota que se envió: un dataset cuyo aviso anticipado quedó
// pendiente o fallido trae adelantado null (pendientesEnSuFecha) y se trata como no adelantado.
export const textoAdelanto = (datasets) => {
  const porNota = new Map();
  for (const dataset of datasets) {
    if (!dataset.adelantado) continue;
    const { numero, anio } = dataset.adelantado;
    const clave = `${numero}/${anio}`;
    if (!porNota.has(clave)) porNota.set(clave, { nota: dataset.adelantado, titulos: [] });
    porNota.get(clave).titulos.push(dataset.titulo);
  }
  if (porNota.size === 0) return null;
  const cita = ({ nota }) => `Nota Digital N° ${textoNumero(nota)} del ${formatoCorto(nota.fecha)}`;
  const [unica] = porNota.values();
  if (porNota.size === 1 && unica.titulos.length === datasets.length) return `Este pedido ya se había adelantado por ${cita(unica)}.`;
  return [...porNota.values()].map((grupo) => {
    const titulos = enumeracion(grupo.titulos.map(titulo => `"${titulo}"`));
    return grupo.titulos.length === 1
      ? `El conjunto de datos ${titulos} ya se había adelantado por ${cita(grupo)}.`
      : `Los conjuntos de datos ${titulos} ya se habían adelantado por ${cita(grupo)}.`;
  }).join(' ');
};

// Antecedente de los emails anteriores (spec 6.4). En los avisos, una fila a todo el ancho debajo de la del dataset:
const textoAntecedente = (antecedente) => {
  if (!antecedente) return null;
  if (antecedente.cantidad === 1) {
    return `Antecedente: notificado a la DGMIT por correo electrónico el ${formatoCorto(antecedente.primera)}.`;
  }
  return `Antecedente: notificado a la DGMIT por correo electrónico en ${antecedente.cantidad} oportunidades, entre el ${formatoCorto(antecedente.primera)} y el ${formatoCorto(antecedente.ultima)}.`;
};

// En las reiteraciones, la segunda oración de la celda "Informado en", en letra más chica (pedido del usuario el
// 14/10/2026): va después del texto de la nota, que entonces termina en punto
const textoAnteriormente = (antecedente) => {
  if (!antecedente) return null;
  if (antecedente.cantidad === 1) return `Anteriormente notificado DGMIT por e-mail el ${formatoCorto(antecedente.primera)}`;
  return `Anteriormente notificado DGMIT por e-mail en ${antecedente.cantidad} oportunidades, entre el ${formatoCorto(antecedente.primera)} y el ${formatoCorto(antecedente.ultima)}`;
};

// Una celda sin valor: "Datos solicitados" de un dataset sin pedido (eventual, o sin datos para calcularlo) y una fecha
// vacía del detalle de un registro de actualización (nota de auditoría)
const RAYA = '—';

// Columnas de cada tabla (spec 2026-10-17-fechas-datasets, 9). Los próximos a vencer de un aviso: 5, con el pedido y la
// fecha sugerida de envío (el vencimiento). Las demás (la reiteración y la sección de vencidos que pudiera traer un aviso):
// las 7 de la reiteración, con "Informado en" al final, porque la segunda parte de esa celda (informadoAnterior) va en la
// última columna en el HTML, el texto y el PDF.
const conColumnasDeAviso = (tipo, clave) => tipo === 'aviso' && clave === 'proximo';
const columnasDe = (tipo, gestion, clave) => {
  const comunes = ['Conjunto de datos', gestion === 'externa' ? 'Área responsable' : 'Área', 'Frecuencia', 'Datos solicitados'];
  if (conColumnasDeAviso(tipo, clave)) return [...comunes, 'Fecha sugerida de envío'];
  return [...comunes, clave === 'vencido' ? 'Venció' : 'Vence', 'Situación', 'Informado en'];
};

export const construirNota = ({ tipo, gestion, numero = null, anio = null, esPrueba = false, fecha, datasets, areas = [], config, firma = null, rangoVencimientos = null, autorizacion = null }) => {
  const numeroTexto = textoNumero({ numero, anio, esPrueba });
  const ref = `${tipo === 'reiteracion' ? 'Reiteración – ' : ''}${REF}`;
  // El mes de la nota o, en un aviso anticipado por la licencia del firmante, el rango de meses de los vencimientos (7.3)
  const cuando = rangoVencimientos
    ? `vencimientos de ${textoRangoMeses(rangoVencimientos.desde, rangoVencimientos.hasta)}`
    : mesYAnio(fecha);
  const asunto = `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${ref} (gestión ${gestion} – ${cuando})`;

  const secciones = ['proximo', 'vencido'].map((clave) => {
    const incluidos = datasets.filter(d => (d.vencimiento < fecha ? 'vencido' : 'proximo') === clave);
    const columnas = columnasDe(tipo, gestion, clave);
    const filas = incluidos.map((d) => {
      // "Datos solicitados": el pedido calculado el día de la nota (d.pedido, de la selección). El vencimiento es la fecha
      // sugerida de envío del aviso
      const valores = [d.titulo, d.area_nombre, d.frecuencia_nombre, d.pedido?.texto || RAYA, formatoCorto(d.vencimiento)];
      // Reiteraciones: el antecedente de los emails anteriores es la segunda parte de la celda "Informado en", en
      // todas las filas (con aviso o "Sin aviso previo"); cada formato la escribe en letra más chica
      const informadoAnterior = tipo === 'reiteracion' ? textoAnteriormente(d.antecedente) : null;
      if (!conColumnasDeAviso(tipo, clave)) {
        valores.push(situacion(d.vencimiento, fecha), `${textoInformado(d)}${informadoAnterior ? '.' : ''}`);
      }
      return {
        valores,
        url: urlSegura(d.url_dataset),
        // Avisos: el antecedente va en una fila a todo el ancho, debajo de la del dataset
        antecedente: tipo === 'aviso' ? textoAntecedente(d.antecedente) : null,
        informadoAnterior
      };
    });
    return { clave, ...SECCIONES[clave], columnas, filas };
  }).filter(seccion => seccion.filas.length > 0);

  const contactos = gestion === 'externa'
    ? areas.map((area) => {
      const lineas = CAMPOS_CONTACTO
        .filter(([campo]) => String(area[campo] ?? '').trim())
        .map(([campo, etiqueta]) => `${etiqueta}: ${area[campo]}`);
      return { nombre: area.nombre, lineas: lineas.length ? lineas : ['Sin datos de contacto registrados'] };
    })
    : [];

  return {
    tipo,
    gestion,
    esPrueba,
    fecha,
    numeroTexto,
    asunto,
    ref,
    destinatario: DESTINATARIO,
    avisoAdjunto: AVISO_ADJUNTO[tipo],
    parrafoInicial: PARRAFO_INICIAL[tipo][gestion],
    secciones,
    contactos,
    // Una hoja del anexo por dataset (spec 6.7); solo los avisos llevan anexo
    anexo: tipo === 'aviso' ? `Anexo: reporte de los conjuntos de datos (${cantidad(datasets.length, 'hoja', 'hojas')}).` : null,
    autorizacion: autorizacion ? PARRAFO_AUTORIZACION(autorizacion) : null,
    // Solo el aviso en su fecha cita la nota que adelantó el pedido; la reiteración no (7.6)
    adelanto: tipo === 'aviso' ? textoAdelanto(datasets) : null,
    justificacion: JUSTIFICACION[tipo],
    remitente: REMITENTE,
    fechaLarga: formatoLargo(fecha),
    firma: firmaDeLaNota(firma, config),
    lineaCc: (gestion === 'externa' ? config.linea_cc_externa : config.linea_cc_interna) ?? ''
  };
};

// Nota de autorización (spec 2026-10-15, 7.2): la que sale cuando la víspera no hay avisos, o cuando la autorización se da
// después. Firma solo el titular. Tiene la misma forma que las demás notas para que la rendericen las mismas funciones.
export const construirNotaDeAutorizacion = ({ numero = null, anio = null, esPrueba = false, fecha, firma, autorizacion }) => {
  const numeroTexto = textoNumero({ numero, anio, esPrueba });
  return {
    tipo: 'autorizacion',
    gestion: null,
    esPrueba,
    fecha,
    numeroTexto,
    asunto: `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${REF_AUTORIZACION} (licencia ${periodoLicencia(autorizacion)})`,
    ref: REF_AUTORIZACION,
    destinatario: DESTINATARIO,
    avisoAdjunto: AVISO_ADJUNTO.reiteracion,
    parrafoInicial: TEXTO_NOTA_AUTORIZACION(autorizacion),
    secciones: [],
    contactos: [],
    anexo: null,
    autorizacion: null,
    adelanto: null,
    justificacion: [],
    remitente: REMITENTE,
    fechaLarga: formatoLargo(fecha),
    firma: firmaDeLaNota({ titular: firma.titular, presentante: null, leyenda: null }),
    lineaCc: ''
  };
};

// =====================================================
// Nota de auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 10)
// =====================================================
const REF_AUDITORIA = 'Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets';
const PARRAFO_AUDITORIA = 'Me dirijo a Ud. a fin de solicitarle la auditoría de los cambios propuestos en el Registro Permanente de Actualización de Datasets (RPAD) que se detallan a continuación, que se encuentran pendientes de verificación. Conforme al procedimiento de doble verificación, cada modificación del registro debe ser revisada y aprobada por una persona distinta de quien la propuso antes de aplicarse.';
const SECCIONES_AUDITORIA = { nuevo: 'Cambios pendientes de auditoría', reiterado: 'Cambios ya solicitados que continúan pendientes' };
const COLUMNAS_AUDITORIA = ['Conjunto de datos', 'Tipo de cambio', 'Propuesto por', 'Fecha de la propuesta', 'Días hábiles pendiente'];
// Proporción del ancho de cada columna en el PDF: 5 columnas los nuevos y 6 los reiterados (con "Solicitado en")
const PROPORCIONES_AUDITORIA = { nuevo: [32, 14, 26, 14, 14], reiterado: [22, 12, 18, 14, 12, 22] };
const TIPO_DE_CAMBIO = { crear: 'Alta', editar: 'Modificación', eliminar: 'Baja' };
// Un registro de actualización (POST /datasets/:id/actualizar) es una edición con la marca registro_actualizacion: en la nota
// es una "Actualización" (spec 2026-10-17-fechas-datasets, 9), como en Mi Perfil ("Actualización registrada")
const esRegistroDeActualizacion = (cambio) => cambio.tipo_cambio === 'editar' && cambio.datos_nuevos?.registro_actualizacion === true;
const tipoDelCambio = (cambio) => (esRegistroDeActualizacion(cambio)
  ? 'Actualización'
  : TIPO_DE_CAMBIO[cambio.tipo_cambio] ?? cambio.tipo_cambio);
// Puntos 5 y 6 de la spec 10.3: apartados con título, como "Justificación:" (Decisiones del plan 8)
const QUE_IMPLICA = {
  titulo: 'Qué implica la auditoría:',
  parrafos: ['La auditoría consiste en verificar que:'],
  items: [
    'los datos coincidan con la información remitida por el área responsable;',
    'el enlace al Portal de Datos Abiertos funcione y muestre la versión informada;',
    'las fechas de última y próxima actualización sean coherentes con la frecuencia del conjunto de datos y que la próxima actualización sea el último día de un mes;',
    'el título, la descripción, el área, los temas, los formatos y "qué se solicita" sean correctos.'
  ],
  cierre: [`Cada cambio se aprueba o se rechaza, con un comentario, desde el RPAD: ${RPAD_URL}/perfil.html (sección "Para revisar").`]
};
const IMPORTANCIA = {
  titulo: 'Importancia:',
  parrafos: ['Mientras un cambio no se audita, el conjunto de datos permanece bloqueado para nuevas modificaciones y el registro no refleja su estado real, lo que afecta los avisos y reiteraciones que emite esta Dirección y el cumplimiento de la Ordenanza N° 17.662/23. Por ello, solicito tenga a bien realizar la auditoría a la brevedad.'],
  items: [],
  cierre: []
};

// Campos del dataset con las etiquetas del formulario (public/admin.html), en su orden. catalogo: de qué catálogo sale el
// nombre de un id. Las fechas y el tipo de pedido llevan los rótulos de la spec 2026-10-17-fechas-datasets (10.1), los
// mismos de Mi Perfil: la fecha de carga es "Cargado en el portal", y "Recibido el" llega con un registro de actualización
const CAMPOS_DEL_DATASET = [
  { campo: 'titulo', etiqueta: 'Título' },
  { campo: 'area_id', etiqueta: 'Área Responsable', catalogo: 'areas' },
  { campo: 'descripcion', etiqueta: 'Descripción' },
  { campo: 'tema_principal_id', etiqueta: 'Tema Principal', catalogo: 'temas' },
  { campo: 'tema_secundario_id', etiqueta: 'Tema Secundario', catalogo: 'temas' },
  { campo: 'frecuencia_id', etiqueta: 'Frecuencia', catalogo: 'frecuencias' },
  { campo: 'tipo_gestion', etiqueta: 'Tipo de Gestión' },
  { campo: 'formatos', etiqueta: 'Formatos del Dataset', catalogo: 'formatos' },
  { campo: 'tipo_pedido', etiqueta: 'Tipo de pedido' },
  { campo: 'datos_al', etiqueta: 'Datos al' },
  { campo: 'ultima_actualizacion', etiqueta: 'Cargado en el portal' },
  { campo: 'recibido_el', etiqueta: 'Recibido el' },
  { campo: 'proxima_actualizacion', etiqueta: 'Próxima actualización' },
  { campo: 'url_dataset', etiqueta: 'URL en Portal' },
  { campo: 'que_se_solicita', etiqueta: 'Qué se solicita' },
  { campo: 'observaciones', etiqueta: 'Observaciones' }
];
const CAMPOS_DE_FECHA = ['datos_al', 'ultima_actualizacion', 'recibido_el', 'proxima_actualizacion'];
// Las filas del detalle de un registro de actualización: siempre las cuatro fechas, en este orden (spec 2026-10-17, 9)
const CAMPOS_DEL_REGISTRO = ['datos_al', 'ultima_actualizacion', 'recibido_el', 'proxima_actualizacion']
  .map(campo => CAMPOS_DEL_DATASET.find(c => c.campo === campo));
const SIN_DATO = 'Sin dato';
const GESTION_DEL_DATASET = { interna: 'Interna', externa: 'Externa' };

const vacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '' || (Array.isArray(valor) && valor.length === 0);

// Para comparar el valor anterior con el nuevo: las fechas por el día (al proponer un cambio, las fechas guardadas llegan
// con hora, "2026-03-15T03:00:00.000Z": el día es el de los primeros 10 caracteres con Node en hora argentina o en UTC) y
// los formatos sin importar el orden
const valorComparable = (campo, valor) => {
  if (vacio(valor)) return '';
  if (campo === 'formatos') return (Array.isArray(valor) ? valor : [valor]).map(Number).sort((a, b) => a - b).join(',');
  if (CAMPOS_DE_FECHA.includes(campo)) return String(valor).slice(0, 10);
  return String(valor);
};

// Un valor del dataset como se lee en la nota: el nombre de un id de catálogo o de un tipo de pedido, la fecha dd/mm/aaaa,
// la gestión con mayúscula; si está vacío, siVacio ("Sin dato")
const valorDelCampo = ({ campo, catalogo }, valor, catalogos, siVacio = SIN_DATO) => {
  if (vacio(valor)) return siVacio;
  if (campo === 'formatos') return (Array.isArray(valor) ? valor : [valor]).map(id => catalogos.formatos?.[id] ?? String(id)).join(', ');
  if (catalogo) return catalogos[catalogo]?.[valor] ?? String(valor);
  if (campo === 'tipo_gestion') return GESTION_DEL_DATASET[valor] ?? String(valor);
  if (campo === 'tipo_pedido') return NOMBRES_TIPO_PEDIDO[valor] ?? String(valor);
  if (CAMPOS_DE_FECHA.includes(campo) && esFechaIso(String(valor).slice(0, 10))) return formatoCorto(String(valor).slice(0, 10));
  return String(valor);
};

const tituloDelCambio = (cambio) =>
  cambio.dataset_titulo ?? cambio.datos_nuevos?.titulo ?? cambio.datos_anteriores?.titulo ?? 'Conjunto de datos sin título';
const filaSimple = (valores) => ({ valores, url: null, antecedente: null, informadoAnterior: null });

// Fila de las tablas de nuevos y reiterados (spec 10.3, punto 3). "Propuesto por": el nombre y, si tiene, el cargo (con
// "personal contratado, cumpliendo funciones de" si quien propuso es contratado)
const filaDeCambio = (cambio, fecha, conSolicitud) => {
  const proponente = cambio.usuario_cargo
    ? `${cambio.usuario_nombre}, ${cargoEnTexto({ cargo: cambio.usuario_cargo, contratado: cambio.usuario_contratado })}`
    : cambio.usuario_nombre;
  const valores = [
    tituloDelCambio(cambio), tipoDelCambio(cambio), proponente,
    formatoCorto(cambio.fecha_propuesta), String(diasHabilesTranscurridos(cambio.fecha_propuesta, fecha))
  ];
  // "Solicitado en": "Nota Digital N° 12/26 (09/10/2026)" y, si ya se reiteró, " – reiterado N veces" (Decisiones del plan 5): el
  // mismo formato que "Informado en" de las reiteraciones de datasets
  if (conSolicitud) valores.push(textoInformado({ informado: cambio.solicitado, reiteraciones: cambio.solicitado.reiteraciones }));
  return filaSimple(valores);
};

// Detalle de un cambio (spec 10.3, punto 4): de una modificación, los campos que cambian con el valor anterior y el nuevo;
// de un alta, los datos del dataset propuesto; de una baja, el dataset que se daría de baja. De un registro de
// actualización, sus cuatro fechas con el valor anterior y el nuevo aunque alguna no cambie (spec 2026-10-17, 9); lo vacío
// es "—" (Recibido el no tiene valor anterior)
const detalleDelCambio = (cambio, numero, catalogos) => {
  const titulo = `${numero}. ${tituloDelCambio(cambio)} – ${tipoDelCambio(cambio)}`;
  const propuesta = `Propuesta por ${cambio.usuario_nombre} el ${formatoCorto(cambio.fecha_propuesta)}.`;
  if (esRegistroDeActualizacion(cambio)) {
    const anteriores = cambio.datos_anteriores ?? {};
    const valor = (c, datos) => valorDelCampo(c, datos[c.campo], catalogos, RAYA);
    return {
      titulo, introduccion: `${propuesta} Fechas de la actualización registrada, con el valor anterior y el nuevo:`,
      columnas: ['Campo', 'Valor anterior', 'Valor nuevo'], proporciones: [24, 38, 38], partirPalabras: true,
      filas: CAMPOS_DEL_REGISTRO.map(c => filaSimple([c.etiqueta, valor(c, anteriores), valor(c, cambio.datos_nuevos)]))
    };
  }
  if (cambio.tipo_cambio === 'editar') {
    const nuevos = cambio.datos_nuevos ?? {};
    const anteriores = cambio.datos_anteriores ?? {};
    const filas = CAMPOS_DEL_DATASET
      .filter(c => Object.hasOwn(nuevos, c.campo) && valorComparable(c.campo, anteriores[c.campo]) !== valorComparable(c.campo, nuevos[c.campo]))
      .map(c => filaSimple([c.etiqueta, valorDelCampo(c, anteriores[c.campo], catalogos), valorDelCampo(c, nuevos[c.campo], catalogos)]));
    return {
      titulo, introduccion: `${propuesta} Campos que cambian, con el valor anterior y el nuevo:`,
      columnas: ['Campo', 'Valor anterior', 'Valor nuevo'], proporciones: [24, 38, 38], partirPalabras: true,
      filas: filas.length ? filas : [filaSimple(['—', 'Sin diferencias registradas', '—'])]
    };
  }
  const datos = (cambio.tipo_cambio === 'crear' ? cambio.datos_nuevos : cambio.datos_anteriores) ?? {};
  const filas = CAMPOS_DEL_DATASET
    .filter(c => !vacio(datos[c.campo]))
    .map(c => filaSimple([c.etiqueta, valorDelCampo(c, datos[c.campo], catalogos)]));
  return {
    titulo,
    introduccion: cambio.tipo_cambio === 'crear'
      ? `${propuesta} Datos principales del conjunto de datos propuesto:`
      : `${propuesta} Conjunto de datos que se daría de baja:`,
    columnas: ['Campo', 'Valor'], proporciones: [28, 72], partirPalabras: true,
    filas: filas.length ? filas : [filaSimple(['Título', tituloDelCambio(cambio)])]
  };
};

/**
 * Nota de auditoría (spec 10): pide a la Dirección General que audite los cambios pendientes. nuevos y reiterados: cambios
 * de auditoriaService (los reiterados con solicitado). catalogos: { areas, frecuencias, temas, formatos } (id → nombre).
 * firma: la de firmaParaFecha (titular, o las dos firmas con la leyenda); sin ella, la de la configuración.
 * Tiene la misma forma que las demás notas, más detalles y apartados.
 */
export const construirNotaDeAuditoria = ({
  numero = null, anio = null, esPrueba = false, fecha, nuevos = [], reiterados = [], catalogos = {}, firma = null, config = null
}) => {
  const numeroTexto = textoNumero({ numero, anio, esPrueba });
  const ref = nuevos.length ? REF_AUDITORIA : `Reiteración – ${REF_AUDITORIA}`;
  const secciones = [['nuevo', nuevos], ['reiterado', reiterados]]
    .filter(([, lista]) => lista.length > 0)
    .map(([clave, lista]) => ({
      clave,
      titulo: SECCIONES_AUDITORIA[clave],
      introduccion: '',
      columnas: clave === 'reiterado' ? [...COLUMNAS_AUDITORIA, 'Solicitado en'] : COLUMNAS_AUDITORIA,
      proporciones: PROPORCIONES_AUDITORIA[clave],
      filas: lista.map(cambio => filaDeCambio(cambio, fecha, clave === 'reiterado'))
    }));
  return {
    tipo: 'auditoria',
    gestion: null,
    esPrueba,
    fecha,
    numeroTexto,
    asunto: `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${ref}`,
    ref,
    destinatario: DESTINATARIO,
    avisoAdjunto: AVISO_ADJUNTO.reiteracion,
    parrafoInicial: PARRAFO_AUDITORIA,
    secciones,
    detalles: {
      titulo: 'Detalle de cada cambio',
      secciones: [...nuevos, ...reiterados].map((cambio, i) => detalleDelCambio(cambio, i + 1, catalogos))
    },
    contactos: [],
    anexo: null,
    autorizacion: null,
    adelanto: null,
    apartados: [QUE_IMPLICA, IMPORTANCIA],
    justificacion: [],
    remitente: REMITENTE,
    fechaLarga: formatoLargo(fecha),
    firma: firmaDeLaNota(firma, config),
    lineaCc: ''
  };
};

const ETIQUETA_GESTION = { interna: 'GESTIÓN INTERNA', externa: 'GESTIÓN EXTERNA' };

// Indicador de estado del anexo: la fecha sugerida de envío (el vencimiento) y los días que faltan (spec
// 2026-10-17-fechas-datasets, 9). Los avisos solo llevan datasets a vencer; un vencimiento pasado (posible con datos
// armados a mano) dice hace cuántos días fue, en lugar de "faltan" días negativos.
const estadoDelAnexo = (vencimiento, fecha) => {
  const dias = diasEntre(fecha, vencimiento);
  if (dias === 0) return 'Vence hoy';
  const envio = `Fecha sugerida de envío: ${formatoCorto(vencimiento)}`;
  if (dias < 0) return `${envio} · hace ${cantidad(-dias, 'día', 'días')}`;
  return `${envio} · ${dias === 1 ? 'falta' : 'faltan'} ${cantidad(dias, 'día', 'días')}`;
};

// Línea de tiempo del anexo (spec 2026-10-17-fechas-datasets, 9): arranca en los datos publicados (Datos al) o, sin ellos,
// en la carga en el portal, y termina en la fecha sugerida de envío. Una fecha que no es una fecha (la fecha cero de
// MariaDB, '0000-00-00', con sql_mode no estricto) se toma como sin registro: con ella la línea no se puede dibujar. Sin
// ninguna de las dos, renderAnexo dice "Sin registro".
const lineaDelAnexo = (f, fecha) => {
  const datosAl = esFechaIso(f.datos_al) ? f.datos_al : null;
  const carga = esFechaIso(f.ultima_actualizacion) ? f.ultima_actualizacion : null;
  return { inicio: datosAl ?? carga, rotuloInicio: datosAl ? 'Datos publicados al' : 'Cargado en el portal', fin: f.vencimiento, hoy: fecha };
};

// "Qué se solicita" de un dataset que no lo tiene cargado (spec 6.7.4)
const QUE_SE_SOLICITA_POR_DEFECTO = 'La versión actualizada del conjunto de datos publicado, con la misma estructura y el mismo nivel de detalle que el archivo disponible en el portal.';

// Anexo de los avisos: una hoja por dataset con su ficha completa (spec 6.7). Las fechas no se repiten en la ficha:
// están en la línea de tiempo. El pedido tampoco: va en el recuadro "Datos solicitados" de la cabecera.
export const construirAnexo = ({ numero = null, anio = null, esPrueba = false, fecha, fichas }) => ({
  numeroTexto: textoNumero({ numero, anio, esPrueba }),
  fechaLarga: formatoLargo(fecha),
  hojas: fichas.map((f) => {
    // Los mismos datos que los contactos de la nota (6.4); "Depende de" ya está en la ficha
    const lineas = CAMPOS_CONTACTO
      .filter(([campo]) => campo !== 'area_superior' && String(f[campo] ?? '').trim())
      .map(([campo, etiqueta]) => `${etiqueta}: ${f[campo]}`);
    return {
      titulo: f.titulo,
      etiqueta: `CONJUNTO DE DATOS · ${ETIQUETA_GESTION[f.tipo_gestion] ?? ''}`.trim(),
      estado: estadoDelAnexo(f.vencimiento, fecha),
      // El texto del pedido de la nota (el de la ficha, que es el de la tabla: spec 2026-10-17-fechas-datasets, 9); sin
      // pedido, null, y la hoja va sin el recuadro
      pedido: String(f.pedido?.texto ?? '').trim() || null,
      linea: lineaDelAnexo(f, fecha),
      campos: [
        ['Área responsable', f.area_nombre],
        ['Depende de', f.area_superior],
        ['Gestión', f.tipo_gestion === 'externa' ? 'Externa' : 'Interna'],
        ['Frecuencia', f.frecuencia_nombre],
        ['Tema principal', f.tema_principal],
        ['Tema secundario', f.tema_secundario],
        ['Formatos', f.formatos]
      ].filter(([, valor]) => String(valor ?? '').trim()),
      url: urlSegura(f.url_dataset),
      descripcion: String(f.descripcion ?? '').trim() || 'Sin descripción registrada.',
      observaciones: String(f.observaciones ?? '').trim() || null,
      queSeSolicita: String(f.que_se_solicita ?? '').trim() || QUE_SE_SOLICITA_POR_DEFECTO,
      contacto: { nombre: f.area_nombre, lineas: lineas.length ? lineas : ['Sin datos de contacto registrados'] }
    };
  })
});

const ESTILO_CELDA = 'border:1px solid #000000;padding:5px 6px;vertical-align:top;text-align:left;';

// Los renglones de una firma, uno por línea; el del personal contratado, en 12px (el cargo va en los 15px de la nota)
const renglonesFirmaHtml = (firma) => renglonesDeFirma(firma)
  .map(({ texto, chico }) => (chico ? `<span style="font-size:12px">${escapeHtml(texto)}</span>` : escapeHtml(texto)))
  .join('<br>');

// Una firma (sin presentante): a la derecha, como siempre. Con presentante: las dos lado a lado, quien presenta a la
// izquierda y el titular a la derecha, y la leyenda debajo
const bloqueFirmaHtml = (firma) => {
  if (!firma.presentante) {
    return `<p style="margin:32px 0 0;text-align:right;">${renglonesFirmaHtml(firma)}</p>`;
  }
  const celda = (una) => `<td style="width:50%;text-align:center;vertical-align:top;">${renglonesFirmaHtml(una)}</td>`;
  return `<table cellspacing="0" cellpadding="0" style="width:100%;margin:32px 0 0;"><tr>${celda(firma.presentante)}${celda(firma)}</tr></table>
<p style="margin:12px 0 0;font-size:12px;font-style:italic;text-align:justify;">${escapeHtml(firma.leyenda)}</p>`;
};

export const renderHtml = (nota) => {
  const parrafo = (texto) => `<p style="margin:0 0 12px;text-align:justify;">${escapeHtml(texto)}</p>`;

  const tabla = (seccion) => {
    const encabezado = seccion.columnas.map(c => `<th style="${ESTILO_CELDA}font-weight:bold;">${escapeHtml(c)}</th>`).join('');
    const filas = seccion.filas.map((fila) => {
      const [titulo, ...resto] = fila.valores;
      const celdaTitulo = fila.url
        ? `<a href="${escapeHtml(fila.url)}" style="color:#000000;">${escapeHtml(titulo)}</a>`
        : escapeHtml(titulo);
      // La segunda parte de la última celda ("Informado en" de las reiteraciones), debajo y en letra más chica
      const segunda = (k) => (k === resto.length - 1 && fila.informadoAnterior
        ? `<br><span style="font-size:11px">${escapeHtml(fila.informadoAnterior)}</span>` : '');
      const principal = `<tr><td style="${ESTILO_CELDA}">${celdaTitulo}</td>${resto.map((v, k) => `<td style="${ESTILO_CELDA}">${escapeHtml(v)}${segunda(k)}</td>`).join('')}</tr>`;
      const antecedente = fila.antecedente
        ? `<tr><td colspan="${seccion.columnas.length}" style="${ESTILO_CELDA}font-style:italic;font-size:12px;">${escapeHtml(fila.antecedente)}</td></tr>`
        : '';
      return principal + antecedente;
    }).join('');
    return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 16px;"><tr>${encabezado}</tr>${filas}</table>`;
  };

  // (una sección sin introducción, como las de la nota de auditoría, no la escribe)
  const secciones = nota.secciones
    .map(s => `<p style="margin:16px 0 6px;"><b>${escapeHtml(s.titulo)}</b></p>${s.introduccion ? parrafo(s.introduccion) : ''}${tabla(s)}`)
    .join('\n');
  // Nota de auditoría (spec 2026-10-15, 10.3): el detalle de cada cambio y los apartados con viñetas
  const detalles = nota.detalles?.secciones.length
    ? `<p style="margin:16px 0 6px;"><b>${escapeHtml(nota.detalles.titulo)}</b></p>\n${nota.detalles.secciones
      .map(s => `<p style="margin:12px 0 6px;"><b>${escapeHtml(s.titulo)}</b></p>${s.introduccion ? parrafo(s.introduccion) : ''}${tabla(s)}`)
      .join('\n')}`
    : '';
  const apartados = (nota.apartados ?? []).map(a => `<p style="margin:16px 0 6px;"><b>${escapeHtml(a.titulo)}</b></p>
${a.parrafos.map(parrafo).join('\n')}${a.items.length ? `<ul style="margin:0 0 12px;padding-left:24px;">${a.items.map(i => `<li style="margin:0 0 4px;text-align:justify;">${escapeHtml(i)}</li>`).join('')}</ul>` : ''}${(a.cierre ?? []).map(parrafo).join('\n')}`).join('\n');

  const contactos = nota.contactos.length
    ? `<p style="margin:16px 0 6px;"><b>Datos de contacto de las áreas responsables</b></p>${nota.contactos
      .map(c => `<p style="margin:0 0 10px;"><b>${escapeHtml(c.nombre)}</b><br>${c.lineas.map(escapeHtml).join('<br>')}</p>`)
      .join('')}`
    : '';
  // Párrafo de autorización (avisos de la víspera de la licencia del firmante): inmediatamente después del primer párrafo
  const autorizacion = nota.autorizacion ? `\n${parrafo(nota.autorizacion)}` : '';
  // Párrafo del adelanto (aviso en su fecha de un pedido ya anticipado): enseguida del de autorización, si lo hay
  const adelanto = nota.adelanto ? `\n${parrafo(nota.adelanto)}` : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(nota.asunto)}</title></head>
<body style="margin:0;padding:24px;background:#ffffff;">
<div style="max-width:760px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#000000;">
<p style="margin:0 0 20px;color:#800000;font-weight:bold;">${escapeHtml(nota.avisoAdjunto)}</p>
<p style="margin:0 0 4px;"><b><u>REF.:</u></b> "${escapeHtml(nota.ref)}"</p>
<p style="margin:0 0 24px;text-align:right;"><b>Nota Digital N°</b> ${escapeHtml(nota.numeroTexto)}</p>
<p style="margin:0 0 16px;"><b><u>${escapeHtml(nota.destinatario)}</u></b></p>
${parrafo(nota.parrafoInicial)}${autorizacion}${adelanto}
${secciones}
${detalles}${contactos}${apartados}
${nota.anexo ? `<p style="margin:16px 0 0;">${escapeHtml(nota.anexo)}</p>` : ''}
${nota.justificacion.length ? `<p style="margin:16px 0 6px;"><b>Justificación:</b></p>
${nota.justificacion.map(parrafo).join('\n')}` : ''}
<p style="margin:24px 0 0;"><b><u>${escapeHtml(nota.remitente)}</u></b>, ${escapeHtml(nota.fechaLarga)}.</p>
${bloqueFirmaHtml(nota.firma)}
<p style="margin:24px 0 0;">${escapeHtml(nota.lineaCc)}</p>
</div></body></html>`;
};

const lineasDeUnaFirma = (firma) => renglonesDeFirma(firma).map(r => r.texto);
const lineasFirma = (firma) => (firma.presentante
  ? [...lineasDeUnaFirma(firma.presentante), '', ...lineasDeUnaFirma(firma), '', firma.leyenda]
  : lineasDeUnaFirma(firma));

// Una sección con tabla en texto plano: el título, la introducción (si tiene) y cada fila con sus columnas
const lineasDeSeccion = (seccion) => {
  const lineas = [seccion.titulo, ...(seccion.introduccion ? [seccion.introduccion] : []), ''];
  for (const fila of seccion.filas) {
    lineas.push(`- ${fila.valores[0]}${fila.url ? ` (${fila.url})` : ''}`);
    // La segunda parte de la última celda ("Informado en" de las reiteraciones) va en la misma línea
    seccion.columnas.slice(1).forEach((columna, i) => {
      const segunda = i + 1 === seccion.columnas.length - 1 && fila.informadoAnterior ? ` ${fila.informadoAnterior}` : '';
      lineas.push(`    ${columna}: ${fila.valores[i + 1]}${segunda}`);
    });
    if (fila.antecedente) lineas.push(`    ${fila.antecedente}`);
  }
  lineas.push('');
  return lineas;
};

export const renderTexto = (nota) => {
  const lineas = [nota.avisoAdjunto, '', `REF.: "${nota.ref}"`, `Nota Digital N° ${nota.numeroTexto}`, '', nota.destinatario, '', nota.parrafoInicial, ''];
  // Párrafo de autorización (avisos de la víspera de la licencia del firmante): inmediatamente después del primer párrafo
  if (nota.autorizacion) lineas.push(nota.autorizacion, '');
  // Párrafo del adelanto (aviso en su fecha de un pedido ya anticipado): enseguida del de autorización, si lo hay
  if (nota.adelanto) lineas.push(nota.adelanto, '');
  for (const seccion of nota.secciones) lineas.push(...lineasDeSeccion(seccion));
  // Nota de auditoría (spec 2026-10-15, 10.3): el detalle de cada cambio
  if (nota.detalles?.secciones.length) {
    lineas.push(nota.detalles.titulo, '');
    for (const seccion of nota.detalles.secciones) lineas.push(...lineasDeSeccion(seccion));
  }
  if (nota.contactos.length) {
    lineas.push('Datos de contacto de las áreas responsables');
    for (const contacto of nota.contactos) lineas.push(contacto.nombre, ...contacto.lineas.map(l => `    ${l}`));
    lineas.push('');
  }
  for (const apartado of nota.apartados ?? []) {
    lineas.push(apartado.titulo, ...apartado.parrafos, ...apartado.items.map(i => `- ${i}`), ...(apartado.cierre ?? []), '');
  }
  lineas.push(...(nota.anexo ? [nota.anexo, ''] : []), ...(nota.justificacion.length ? ['Justificación:', ...nota.justificacion, ''] : []),
    `${nota.remitente}, ${nota.fechaLarga}.`, '', ...lineasFirma(nota.firma), '', nota.lineaCc);
  return lineas.join('\n');
};

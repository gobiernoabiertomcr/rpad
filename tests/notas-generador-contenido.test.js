// Generador de Notas (spec 2026-10-24-generador-de-notas, sección 4): el contenido de la nota de la DGMIT como bloques, el
// HTML de la vista previa y el nombre del Word. Puro, sin base. Los textos esperados están copiados de la spec (4.2 a 4.5).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LETRA, ANCHOS_TABLA, INFORMACION_SIN_PEDIDO, ESPACIO,
  construirNotaDgmit, textoDeNotasAnteriores, renderHtmlDeBloques, nombreDelWord
} from '../services/notasGeneradorContenido.js';
import { QUE_SE_SOLICITA_POR_DEFECTO } from '../services/notasDigitalesContenido.js';

// ---------------------------------------------------------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------------------------------------------------------

// El texto de un párrafo (o de una celda): sus partes unidas
const textoDe = (conPartes) => conPartes.partes.map(p => p.texto).join('');
// Los textos de los párrafos de la nota, en orden
const parrafos = (bloques) => bloques.filter(b => b.tipo === 'parrafo');
const textos = (bloques) => parrafos(bloques).map(textoDe);
// El párrafo cuyo texto empieza con `inicio`
const parrafoQueEmpieza = (bloques, inicio) => parrafos(bloques).find(b => textoDe(b).startsWith(inicio));
// La posición del primer bloque que cumple la condición
const posicion = (bloques, condicion) => bloques.findIndex(condicion);
const esParrafoQueEmpieza = (inicio) => (b) => b.tipo === 'parrafo' && textoDe(b).startsWith(inicio);
const esTabla = (b) => b.tipo === 'tabla';

// Áreas como están en la base (spec, Anexo A)
const MUJER = Object.freeze({ nombre: 'Secretaría de la Mujer, Género y Diversidad', articulo: 'la', area_superior: 'Intendencia', articulo_superior: 'la' });
const DEPORTES = Object.freeze({ nombre: 'Ente Autárquico Comodoro Deportes', articulo: 'el', area_superior: 'Intendencia', articulo_superior: 'la' });
const ESTADISTICA = Object.freeze({ nombre: 'Dirección de Estadística y Evaluación Educativa', articulo: 'la', area_superior: 'Ministerio de Educación del Chubut', articulo_superior: 'el' });
const SUELDOS = Object.freeze({ nombre: 'Dirección General de Sueldos', articulo: 'la', area_superior: null, articulo_superior: null });
const INDEC = Object.freeze({ nombre: 'Instituto Nacional de Estadística y Censos de la República Argentina', articulo: 'el', area_superior: null, articulo_superior: null });
const COOPERATIVA = Object.freeze({ nombre: 'Sociedad Cooperativa Popular Limitada', articulo: 'la', area_superior: null, articulo_superior: null });

const AREAS_ESPECIFICAS = Object.freeze({
  titulo: 'Áreas específicas de género',
  frecuencia: 'Anualmente',
  datosSolicitados: 'Vigente al 30/09/2026',
  queSeSolicita: 'Listado completo y actualizado de las áreas e instituciones municipales y provinciales específicas de género.'
});
const PRESUPUESTO = Object.freeze({
  titulo: 'Presupuesto con perspectiva de género',
  frecuencia: 'Anualmente',
  datosSolicitados: 'Presupuesto del ejercicio 2026',
  queSeSolicita: ''
});
const GIMNASIOS = Object.freeze({ titulo: 'Gimnasios Municipales', frecuencia: 'Eventual', datosSolicitados: null, queSeSolicita: null });

const NOTA = Object.freeze({
  tipo: 'interna', pedido: 'solicitud', fecha: '2026-10-24', numero: null, anteriores: [], area: MUJER,
  datasets: [AREAS_ESPECIFICAS, PRESUPUESTO]
});
const nota = (cambios = {}) => construirNotaDgmit({ ...NOTA, ...cambios });

// Textos de la spec, copiados al pie de la letra
const REF_SOLICITUD = 'REF.: "Solicitud de datos para el Portal de Datos Abiertos Municipal"';
const REF_REITERACION = 'REF.: "Reiteración – Solicitud de datos para el Portal de Datos Abiertos Municipal"';
const SUBSECRETARIA = 'SUBSECRETARÍA DE MODERNIZACIÓN Y TRANSPARENCIA';
const DGMIT = 'DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL';
const FORMATO = 'preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:';
const JUSTIFICACION_INTERNA = 'Dicha solicitud se enmarca en el cumplimiento de la Ordenanza N° 17.662/23, que establece la necesidad de garantizar que los datos publicados en el portal de datos abiertos, datos.comodoro.gov.ar, mantengan su valor. Motivo por el cual resulta fundamental mantener actualizada la información disponible en el mencionado sitio.';
const CORREOS_INTERNA = 'Los datos solicitados pueden ser remitidos a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar. Los mismos, una vez recibidos, serán publicados en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza, garantizando su disponibilidad en formatos abiertos y reutilizables para generar valor económico y social.';
const PRIMERO_EXTERNA = 'Nos dirigimos a Uds. a fin de solicitarles tengan a bien brindar la siguiente información, preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:';
const PRIMERO_EXTERNA_REITERACION = 'Nos dirigimos nuevamente a Uds. a fin de reiterar la solicitud de la siguiente información, preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:';
const MOTIVA = 'Motiva dicha solicitud la necesidad de actualizar y publicar los datasets disponibles en la página oficial de Datos Abiertos de la Municipalidad de Comodoro Rivadavia (datos.comodoro.gov.ar), en cumplimiento de la Ordenanza N° 17.662/23 y los principios de transparencia y acceso a la información pública que sustentan nuestras políticas de gobierno abierto.';
const CORREOS_EXTERNA = 'Los datos pueden ser remitidos a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar.';
const QUEDAMOS = 'Quedamos a disposición para coordinar los detalles técnicos o administrativos necesarios.';
const SIN_MAS = 'Sin más, saludamos a Uds. atentamente.';
const REITERACION_UNA = 'La presente reiteración se debe a que, al día de la fecha, no se ha recibido la información solicitada mediante Nota N° 97/26, conforme a lo establecido en la Ordenanza N° 17.662/23.';
const REITERACION_DOS = 'La presente reiteración se debe a que, al día de la fecha, no se ha recibido la información solicitada mediante Notas N° 88/26 y N° 102/26, conforme a lo establecido en la Ordenanza N° 17.662/23.';
const REITERACION_SIN = 'La presente reiteración se debe a que, al día de la fecha, no se ha recibido la información correspondiente, conforme a lo establecido en la Ordenanza N° 17.662/23.';

// ---------------------------------------------------------------------------------------------------------------------------

describe('constantes', () => {
  it('las letras en medios puntos (cuerpo 12, tabla 10, "Qué se solicita" 9), los anchos de la tabla y el texto sin pedido', () => {
    assert.deepEqual({ ...LETRA }, { cuerpo: 24, tabla: 20, queSeSolicita: 18 });
    assert.deepEqual([...ANCHOS_TABLA], [38, 24, 38]);
    assert.equal(ANCHOS_TABLA.reduce((a, b) => a + b, 0), 100);
    assert.equal(INFORMACION_SIN_PEDIDO, 'Información actualizada disponible');
  });

  it('el texto por defecto del "Qué se solicita" es el de las Notas Digitales, exportado', () => {
    assert.equal(QUE_SE_SOLICITA_POR_DEFECTO, 'La versión actualizada del conjunto de datos publicado, con la misma estructura y el mismo nivel de detalle que el archivo disponible en el portal.');
  });

  it('los espacios entre párrafos son twips enteros y crecientes', () => {
    for (const valor of Object.values(ESPACIO)) assert.ok(Number.isInteger(valor) && valor > 0);
    assert.ok(ESPACIO.renglon < ESPACIO.parrafo && ESPACIO.parrafo < ESPACIO.bloque);
  });
});

describe('construirNotaDgmit: interna, solicitud (spec 4.2)', () => {
  const bloques = nota();

  it('el REF y el número, a la derecha: sin número, "____/AA" con el año de la fecha de la nota', () => {
    const [ref, numero] = bloques;
    assert.equal(ref.tipo, 'parrafo');
    assert.equal(ref.alinear, 'derecha');
    assert.equal(textoDe(ref), REF_SOLICITUD);
    assert.deepEqual(ref.partes[0], { texto: 'REF.:', negrita: true });
    assert.equal(numero.alinear, 'derecha');
    assert.equal(textoDe(numero), 'Nota N° ____/26');
    assert.deepEqual(numero.partes[0], { texto: 'Nota N°', negrita: true });
  });

  it('con número, el número tal cual', () => {
    assert.equal(textoDe(nota({ numero: '156/26' })[1]), 'Nota N° 156/26');
    assert.equal(textoDe(nota({ numero: '12/26/DGMIT—“x” 😀' })[1]), 'Nota N° 12/26/DGMIT—“x” 😀');
  });

  it('el año del hueco sale de la fecha de la nota', () => {
    assert.equal(textoDe(nota({ fecha: '2027-01-05' })[1]), 'Nota N° ____/27');
  });

  it('el destinatario, la Subsecretaría, en negrita y subrayado', () => {
    const destinatario = bloques[2];
    assert.equal(destinatario.tipo, 'parrafo');
    assert.equal(destinatario.alinear, 'izquierda');
    assert.deepEqual(destinatario.partes, [{ texto: SUBSECRETARIA, negrita: true, subrayado: true }]);
  });

  it('el primer párrafo (4.2, punto 4), justificado, completo y con el área en negrita', () => {
    const primero = bloques[3];
    assert.equal(primero.alinear, 'justificado');
    assert.equal(textoDe(primero), `Solicito a Ud. tenga a bien gestionar ante la Secretaría de la Mujer, Género y Diversidad, dependiente de la Intendencia, la remisión de la siguiente información, ${FORMATO}`);
    const negritas = primero.partes.filter(p => p.negrita);
    assert.deepEqual(negritas, [{ texto: 'Secretaría de la Mujer, Género y Diversidad', negrita: true }]);
  });

  it('después de la tabla: "Justificación:" en negrita y los dos párrafos de la spec, justificados', () => {
    const iTabla = posicion(bloques, esTabla);
    assert.equal(iTabla, 4);
    const justificacion = bloques[iTabla + 1];
    assert.deepEqual(justificacion.partes, [{ texto: 'Justificación:', negrita: true }]);
    assert.equal(textoDe(bloques[iTabla + 2]), JUSTIFICACION_INTERNA);
    assert.equal(bloques[iTabla + 2].alinear, 'justificado');
    assert.equal(textoDe(bloques[iTabla + 3]), CORREOS_INTERNA);
    assert.equal(bloques[iTabla + 3].alinear, 'justificado');
  });

  it('los correos van subrayados', () => {
    const correos = parrafoQueEmpieza(bloques, 'Los datos solicitados');
    assert.deepEqual(correos.partes.filter(p => p.subrayado).map(p => p.texto), ['datospublicos@comodoro.gov.ar', 'mit@comodoro.gov.ar']);
  });

  it('el cierre, la Dirección General en negrita y subrayado con la fecha larga, y al final el espacio para una firma', () => {
    const cierre = bloques.at(-2);
    assert.equal(textoDe(cierre), `${DGMIT}, 24 de octubre de 2026.`);
    assert.deepEqual(cierre.partes[0], { texto: DGMIT, negrita: true, subrayado: true });
    assert.deepEqual(bloques.at(-1), { tipo: 'firma', columnas: 1 });
  });

  it('todo en el orden de la spec, sin el párrafo de la reiteración', () => {
    assert.deepEqual(bloques.map(b => b.tipo), ['parrafo', 'parrafo', 'parrafo', 'parrafo', 'tabla', 'parrafo', 'parrafo', 'parrafo', 'parrafo', 'firma']);
    assert.ok(!textos(bloques).some(t => t.startsWith('La presente reiteración')));
  });

  it('el párrafo que sigue a la tabla deja su espacio antes (la tabla de Word no tiene margen)', () => {
    const iTabla = posicion(bloques, esTabla);
    assert.equal(bloques[iTabla + 1].antes, ESPACIO.trasLaTabla);
  });
});

describe('construirNotaDgmit: artículos (Review Focus 1)', () => {
  const primero = (area, cambios = {}) => textoDe(parrafoQueEmpieza(nota({ area, ...cambios }), 'Solicito a Ud.'));

  it('un área con "el": "ante el …", y su dependencia con "la"', () => {
    assert.ok(primero(DEPORTES).includes('gestionar ante el Ente Autárquico Comodoro Deportes, dependiente de la Intendencia, la remisión'));
  });

  it('una dependencia con "el": "dependiente del …", nunca "de el"', () => {
    const texto = primero(ESTADISTICA);
    assert.ok(texto.includes(', dependiente del Ministerio de Educación del Chubut, '));
    assert.ok(!texto.includes('de el '));
  });

  it('sin dependencia: "…ante la {área}, la remisión…"', () => {
    assert.ok(primero(SUELDOS).includes('ante la Dirección General de Sueldos, la remisión'));
    assert.ok(!primero(SUELDOS).includes('dependiente'));
  });

  it('sin dependencia y con "el": "ante el {área}, la remisión…"', () => {
    assert.ok(primero(INDEC).includes('ante el Instituto Nacional de Estadística y Censos de la República Argentina, la remisión'));
  });

  it('una dependencia de solo espacios cuenta como sin dependencia; sin artículo de la dependencia, "la"', () => {
    assert.ok(primero({ ...SUELDOS, area_superior: '   ' }).includes('ante la Dirección General de Sueldos, la remisión'));
    assert.ok(primero({ ...MUJER, articulo_superior: null }).includes(', dependiente de la Intendencia, '));
  });

  it('en la reiteración interna, los mismos artículos: "…dependiente del …, el pedido…" y, sin dependencia, "…, el pedido…"', () => {
    assert.ok(primero(ESTADISTICA, { pedido: 'reiteracion' }).includes('reiterar ante la Dirección de Estadística y Evaluación Educativa, dependiente del Ministerio de Educación del Chubut, el pedido'));
    assert.ok(primero(SUELDOS, { pedido: 'reiteracion' }).includes('reiterar ante la Dirección General de Sueldos, el pedido'));
  });

  it('externa con "el": el bloque "Al"; con "la", "A la"', () => {
    const externa = (area) => nota({ tipo: 'externa', area });
    assert.equal(textoDe(externa(INDEC)[1]), 'Al');
    assert.equal(textoDe(externa(COOPERATIVA)[1]), 'A la');
  });
});

describe('construirNotaDgmit: externa, solicitud (spec 4.3)', () => {
  const bloques = nota({ tipo: 'externa', area: COOPERATIVA });

  it('la fecha, a la derecha y sin punto; después "A la", el área y PRESENTE, en negrita y subrayado', () => {
    assert.equal(bloques[0].alinear, 'derecha');
    assert.equal(textoDe(bloques[0]), 'Comodoro Rivadavia, 24 de octubre de 2026');
    assert.equal(textoDe(bloques[1]), 'A la');
    assert.deepEqual(bloques[2].partes, [{ texto: 'Sociedad Cooperativa Popular Limitada', negrita: true, subrayado: true }]);
    assert.deepEqual(bloques[3].partes, [{ texto: 'PRESENTE', negrita: true, subrayado: true }]);
  });

  it('el REF y el número a la derecha, "De nuestra consideración:" y el primer párrafo (punto 8), justificado', () => {
    assert.equal(textoDe(bloques[4]), REF_SOLICITUD);
    assert.equal(bloques[4].alinear, 'derecha');
    assert.equal(textoDe(bloques[5]), 'Nota N° ____/26');
    assert.equal(bloques[5].alinear, 'derecha');
    assert.equal(textoDe(bloques[6]), 'De nuestra consideración:');
    assert.equal(textoDe(bloques[7]), PRIMERO_EXTERNA);
    assert.equal(bloques[7].alinear, 'justificado');
    assert.ok(esTabla(bloques[8]));
  });

  it('después de la tabla, los párrafos de la spec en orden; el remitente sin fecha; al final, la firma', () => {
    assert.deepEqual(textos(bloques.slice(9)), [MOTIVA, CORREOS_EXTERNA, QUEDAMOS, SIN_MAS, DGMIT]);
    assert.equal(bloques[9].alinear, 'justificado');
    assert.equal(bloques[10].alinear, 'justificado');
    assert.deepEqual(bloques.at(-2).partes, [{ texto: DGMIT, negrita: true, subrayado: true }]);
    assert.deepEqual(bloques.at(-1), { tipo: 'firma', columnas: 1 });
  });

  it('los enlaces del párrafo "Motiva…" y de los correos van subrayados', () => {
    assert.deepEqual(bloques[9].partes.filter(p => p.subrayado).map(p => p.texto), ['datos.comodoro.gov.ar']);
    assert.deepEqual(bloques[10].partes.filter(p => p.subrayado).map(p => p.texto), ['datospublicos@comodoro.gov.ar', 'mit@comodoro.gov.ar']);
  });

  it('la externa no lleva la Subsecretaría, ni la justificación de la interna', () => {
    const todo = textos(bloques).join('\n');
    assert.ok(!todo.includes(SUBSECRETARIA));
    assert.ok(!todo.includes('Justificación:'));
  });
});

describe('construirNotaDgmit: reiteración (spec 4.4)', () => {
  it('interna con una nota anterior: el REF, el primer párrafo y el párrafo de la reiteración entre la tabla y "Justificación:"', () => {
    const bloques = nota({ pedido: 'reiteracion', anteriores: ['97/26'] });
    assert.equal(textoDe(bloques[0]), REF_REITERACION);
    assert.equal(textoDe(bloques[3]), `Solicito a Ud. tenga a bien reiterar ante la Secretaría de la Mujer, Género y Diversidad, dependiente de la Intendencia, el pedido de la siguiente información, ${FORMATO}`);
    assert.ok(textoDe(bloques[3]).startsWith('Solicito a Ud. tenga a bien reiterar ante la '));
    const iTabla = posicion(bloques, esTabla);
    const iReiteracion = posicion(bloques, esParrafoQueEmpieza('La presente reiteración'));
    const iJustificacion = posicion(bloques, esParrafoQueEmpieza('Justificación:'));
    assert.equal(iReiteracion, iTabla + 1);
    assert.equal(iJustificacion, iReiteracion + 1);
    assert.equal(textoDe(bloques[iReiteracion]), REITERACION_UNA);
    assert.equal(bloques[iReiteracion].alinear, 'justificado');
    // El espacio después de la tabla lo deja el párrafo de la reiteración, no "Justificación:"
    assert.equal(bloques[iReiteracion].antes, ESPACIO.trasLaTabla);
    assert.equal(bloques[iJustificacion].antes, undefined);
  });

  it('externa con dos notas anteriores: "…mediante Notas N° 88/26 y N° 102/26, conforme…", antes de "Motiva dicha solicitud…"', () => {
    const bloques = nota({ tipo: 'externa', pedido: 'reiteracion', area: COOPERATIVA, anteriores: ['88/26', '102/26'] });
    assert.equal(textoDe(bloques[4]), REF_REITERACION);
    assert.equal(textoDe(bloques[7]), PRIMERO_EXTERNA_REITERACION);
    const iTabla = posicion(bloques, esTabla);
    const iReiteracion = posicion(bloques, esParrafoQueEmpieza('La presente reiteración'));
    assert.equal(iReiteracion, iTabla + 1);
    assert.equal(textoDe(bloques[iReiteracion]), REITERACION_DOS);
    assert.equal(posicion(bloques, esParrafoQueEmpieza('Motiva dicha solicitud')), iReiteracion + 1);
  });

  it('externa sin notas anteriores: "…no se ha recibido la información correspondiente, conforme…"', () => {
    const bloques = nota({ tipo: 'externa', pedido: 'reiteracion', area: COOPERATIVA, anteriores: [] });
    assert.equal(textoDe(parrafoQueEmpieza(bloques, 'La presente reiteración')), REITERACION_SIN);
  });

  it('interna sin notas anteriores (también sin la lista): "…la información correspondiente…"', () => {
    assert.equal(textoDe(parrafoQueEmpieza(nota({ pedido: 'reiteracion', anteriores: undefined }), 'La presente reiteración')), REITERACION_SIN);
  });

  it('con tres notas: "Notas N° a, N° b y N° c"', () => {
    const bloques = nota({ pedido: 'reiteracion', anteriores: ['1/26', '2/26', '3/26'] });
    assert.ok(textoDe(parrafoQueEmpieza(bloques, 'La presente reiteración')).includes('solicitada mediante Notas N° 1/26, N° 2/26 y N° 3/26, conforme a'));
  });

  it('el resto de la nota no cambia: el mismo cierre y la misma firma', () => {
    const solicitud = textos(nota());
    const reiteracion = textos(nota({ pedido: 'reiteracion', anteriores: ['97/26'] }));
    assert.deepEqual(reiteracion.slice(-3), solicitud.slice(-3));
    assert.deepEqual(nota({ pedido: 'reiteracion' }).at(-1), { tipo: 'firma', columnas: 1 });
  });

  it('una solicitud no cita las notas anteriores aunque lleguen', () => {
    const bloques = nota({ anteriores: ['97/26'] });
    assert.ok(!textos(bloques).some(t => t.includes('97/26')));
    assert.equal(textoDe(bloques[0]), REF_SOLICITUD);
  });
});

describe('construirNotaDgmit: la tabla (spec 4.5)', () => {
  const tabla = nota({ datasets: [AREAS_ESPECIFICAS, PRESUPUESTO, GIMNASIOS] }).find(esTabla);

  it('tres columnas con los anchos fijos', () => {
    assert.deepEqual(tabla.anchos, [...ANCHOS_TABLA]);
  });

  it('el encabezado: Conjunto de datos | Frecuencia | Datos solicitados, en negrita sobre gris y en letra de tabla', () => {
    const [encabezado] = tabla.filas;
    assert.equal(encabezado.encabezado, true);
    assert.deepEqual(encabezado.celdas.map(textoDe), ['Conjunto de datos', 'Frecuencia', 'Datos solicitados']);
    for (const celda of encabezado.celdas) {
      assert.equal(celda.fondo, 'gris');
      assert.equal(celda.letra, LETRA.tabla);
      assert.ok(celda.partes.every(p => p.negrita));
    }
  });

  it('cada dataset, una fila con sus tres datos y debajo una a todo el ancho: "Qué se solicita:" en cursiva y el texto', () => {
    const [, fila, solicita] = tabla.filas;
    assert.equal(fila.encabezado, undefined);
    assert.deepEqual(fila.celdas.map(textoDe), ['Áreas específicas de género', 'Anualmente', 'Vigente al 30/09/2026']);
    assert.ok(fila.celdas.every(c => c.letra === LETRA.tabla && !c.abarca && !c.fondo));
    assert.equal(solicita.celdas.length, 1);
    const [celda] = solicita.celdas;
    assert.equal(celda.abarca, 3);
    assert.equal(celda.letra, LETRA.queSeSolicita);
    assert.deepEqual(celda.partes[0], { texto: 'Qué se solicita:', cursiva: true });
    assert.equal(textoDe(celda), `Qué se solicita: ${AREAS_ESPECIFICAS.queSeSolicita}`);
  });

  it('en el orden recibido: el encabezado y dos filas por dataset', () => {
    assert.equal(tabla.filas.length, 1 + 2 * 3);
    assert.deepEqual([1, 3, 5].map(i => textoDe(tabla.filas[i].celdas[0])), ['Áreas específicas de género', 'Presupuesto con perspectiva de género', 'Gimnasios Municipales']);
    const alReves = nota({ datasets: [GIMNASIOS, AREAS_ESPECIFICAS] }).find(esTabla);
    assert.deepEqual([1, 3].map(i => textoDe(alReves.filas[i].celdas[0])), ['Gimnasios Municipales', 'Áreas específicas de género']);
  });

  it('sin "Qué se solicita" (vacío o null), el texto por defecto de las Notas Digitales', () => {
    assert.equal(textoDe(tabla.filas[4].celdas[0]), `Qué se solicita: ${QUE_SE_SOLICITA_POR_DEFECTO}`);
    assert.equal(textoDe(tabla.filas[6].celdas[0]), `Qué se solicita: ${QUE_SE_SOLICITA_POR_DEFECTO}`);
    const conEspacios = nota({ datasets: [{ ...PRESUPUESTO, queSeSolicita: '   ' }] }).find(esTabla);
    assert.equal(textoDe(conEspacios.filas[2].celdas[0]), `Qué se solicita: ${QUE_SE_SOLICITA_POR_DEFECTO}`);
  });

  it('un eventual (sin pedido) dice "Información actualizada disponible"', () => {
    assert.deepEqual(tabla.filas[5].celdas.map(textoDe), ['Gimnasios Municipales', 'Eventual', 'Información actualizada disponible']);
  });

  it('las dos notas, interna y externa, llevan la misma tabla', () => {
    const externa = nota({ tipo: 'externa', area: COOPERATIVA, datasets: [AREAS_ESPECIFICAS, PRESUPUESTO, GIMNASIOS] }).find(esTabla);
    assert.deepEqual(externa, tabla);
  });
});

describe('textoDeNotasAnteriores', () => {
  it('ninguna → null; una → "Nota N° …"; dos → "Notas N° … y N° …"; tres → "Notas N° a, N° b y N° c"', () => {
    assert.equal(textoDeNotasAnteriores([]), null);
    assert.equal(textoDeNotasAnteriores(['97/26']), 'Nota N° 97/26');
    assert.equal(textoDeNotasAnteriores(['88/26', '102/26']), 'Notas N° 88/26 y N° 102/26');
    assert.equal(textoDeNotasAnteriores(['a', 'b', 'c']), 'Notas N° a, N° b y N° c');
  });

  it('sin lista, null', () => {
    assert.equal(textoDeNotasAnteriores(undefined), null);
    assert.equal(textoDeNotasAnteriores(null), null);
  });
});

describe('renderHtmlDeBloques', () => {
  it('un párrafo es un <p> con su alineación y sus espacios; negrita, subrayado, cursiva y salto', () => {
    const html = renderHtmlDeBloques([
      { tipo: 'parrafo', alinear: 'justificado', antes: 240, despues: 200, partes: [
        { texto: 'Uno ', negrita: true }, { texto: 'dos', subrayado: true }, { texto: 'tres', cursiva: true, salto: true },
        { texto: 'todo', negrita: true, subrayado: true, cursiva: true }
      ] },
      { tipo: 'parrafo', alinear: 'derecha', partes: [{ texto: 'a' }] },
      { tipo: 'parrafo', alinear: 'centro', partes: [{ texto: 'b' }] },
      { tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'c' }] }
    ]);
    assert.match(html, /<p style="text-align:justify;margin:1em 0 0\.833em">/);
    assert.ok(html.includes('<b>Uno </b><u>dos</u><br><i>tres</i><b><u><i>todo</i></u></b></p>'));
    assert.match(html, /<p style="text-align:right;margin:0 0 0">a<\/p>/);
    assert.match(html, /<p style="text-align:center;margin:0 0 0">b<\/p>/);
    assert.match(html, /<p style="text-align:left;margin:0 0 0">c<\/p>/);
  });

  it('la letra de una parte, relativa a la del cuerpo', () => {
    const html = renderHtmlDeBloques([{ tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'chico', letra: 18 }] }]);
    assert.ok(html.includes('<span style="font-size:0.75em">chico</span>'));
  });

  it('la tabla: <table class="nota-tabla"> con los anchos, el encabezado en <th> sobre gris y el "Qué se solicita" con colspan', () => {
    const html = renderHtmlDeBloques(nota({ datasets: [AREAS_ESPECIFICAS] }));
    assert.ok(html.includes('<table class="nota-tabla">'));
    assert.ok(html.includes('<colgroup><col style="width:38%"><col style="width:24%"><col style="width:38%"></colgroup>'));
    assert.ok(html.includes('<th scope="col" style="font-size:0.833em;background:#d9d9d9"><b>Conjunto de datos</b></th>'));
    assert.ok(html.includes('<td style="font-size:0.833em">Áreas específicas de género</td>'));
    assert.ok(html.includes(`<td colspan="3" style="font-size:0.75em"><i>Qué se solicita:</i> ${AREAS_ESPECIFICAS.queSeSolicita}</td>`));
  });

  it('la nota entera: el área en <b>, los subrayados en <u>, la firma como <div class="nota-firma"></div> al final', () => {
    const html = renderHtmlDeBloques(nota());
    assert.ok(html.includes('<b>Secretaría de la Mujer, Género y Diversidad</b>'));
    assert.ok(html.includes(`<b><u>${SUBSECRETARIA}</u></b>`));
    assert.ok(html.includes('<u>datospublicos@comodoro.gov.ar</u>'));
    assert.ok(html.trimEnd().endsWith('<div class="nota-firma"></div>'));
  });

  it('una lista es un <ul> con un <li> por ítem', () => {
    const html = renderHtmlDeBloques([{ tipo: 'lista', items: [[{ texto: 'uno' }], [{ texto: 'dos', negrita: true }]] }]);
    assert.ok(html.includes('<ul><li>uno</li><li><b>dos</b></li></ul>'));
  });

  it('una firma de dos columnas también deja el espacio en blanco', () => {
    assert.equal(renderHtmlDeBloques([{ tipo: 'firma', columnas: 2 }]), '<div class="nota-firma"></div>');
  });

  it('escapa todo el texto: un título <script> sale como texto', () => {
    const html = renderHtmlDeBloques(nota({
      area: { ...MUJER, nombre: 'Área <b>"x"</b> & \'y\'' },
      numero: '<i>1</i>',
      datasets: [{ ...AREAS_ESPECIFICAS, titulo: '<script>alert(1)</script>', queSeSolicita: '<img src=x onerror=alert(1)>' }]
    }));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('<b>Área &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;</b>'));
    assert.ok(html.includes('&lt;i&gt;1&lt;/i&gt;'));
  });

  it('sin bloques, vacío', () => {
    assert.equal(renderHtmlDeBloques([]), '');
  });
});

describe('nombreDelWord', () => {
  it('"Nota {tipo}[ reiteracion] - {área} - {fecha}.docx"', () => {
    assert.equal(nombreDelWord({ tipo: 'interna', pedido: 'reiteracion', area: 'Secretaría de Cultura', fecha: '2026-10-24' }), 'Nota interna reiteracion - Secretaría de Cultura - 2026-10-24.docx');
    assert.equal(nombreDelWord({ tipo: 'externa', pedido: 'solicitud', area: 'Sociedad Cooperativa Popular Limitada', fecha: '2026-10-24' }), 'Nota externa - Sociedad Cooperativa Popular Limitada - 2026-10-24.docx');
  });
});

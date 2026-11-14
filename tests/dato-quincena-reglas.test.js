// El dato de la quincena (spec 2026-11-07-dato-quincena, 5, 6, 7, 9 y 12): la forma de la edición, sus mensajes y su clave;
// las partes contra el manifiesto, la huella del paquete y el token; los textos y las filas que arma el servidor, con los
// fixtures inventados de tests/dato-quincena-fixtures.js y el ejemplo inventado de la sección 9; la lista y el detalle de las
// lecturas, contra las respuestas inventadas de tests/fixtures/dato-quincena-respuestas.json, que lee la página.
// Puro: sin base ni Date local, hoy llega por parámetro. El token de prueba sale al azar en cada corrida y no se imprime.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  NOMBRE_DEL_BOT, TOPES, TOPE_DEL_PEDIDO, PARTES, ARCHIVOS, FECHA_MINIMA, MAXIMO_DE_ERRORES, MENSAJES_VALIDACION,
  validarEdicion, claveDeEdicion, sha256 as sha256DeLasReglas, esPng, esTextoUtf8, esSvg, textoDeMetadata, validarAdjuntos,
  erroresDeLaEdicion, huellaDelPaquete, estadoDelToken,
  fechaLarga, marcaDePiloto, horaArgentina, diaArgentino, textoDeLlegada, textoDelCorreo, textoDeCantidad, textoDelResto,
  textoDelNumero, tamanoTexto, fotoDelDataset, textoParaCopiar, borradorParaCopiar, filasDeLaEdicion, avisosDeLaEdicion,
  reciboDe, anioDeLaLista, nombreDeLaEdicion, TIPO_DE_DESCARGA, itemDeLaLista, detalleDeLaEdicion, fechasPrevias
} from '../services/datoQuincenaReglas.js';
import { sumarDias } from '../services/notasDigitalesCalendario.js';
import { RPAD_URL } from '../services/emailTemplates.js';
import { envioDelRecibo, lineaDelCorreo, pastillaDelEnvio } from '../services/datoQuincenaCorreoReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';
import {
  FECHA_DE_PRUEBA, edicionDePrueba, pilotoDePrueba, pngDePrueba, svgDePrueba, efemerideDePrueba, partesDePrueba, repeticionDePrueba
} from './dato-quincena-fixtures.js';

const validar = (edicion, hoy = FECHA_DE_PRUEBA) => validarEdicion(edicion, { hoy });
const error = (campo, clave) => {
  assert.ok(Object.hasOwn(MENSAJES_VALIDACION, clave), `no hay mensaje ${clave}`);
  return { campo, mensaje: MENSAJES_VALIDACION[clave] };
};
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// 'propuestas[1].dataset.nombre' → ['propuestas', 1, 'dataset', 'nombre']
const tramos = (ruta) => ruta.match(/[^.[\]]+/g).map((t) => (/^\d+$/.test(t) ? Number(t) : t));
const padreDe = (objeto, ruta) => {
  const lista = tramos(ruta);
  const ultimo = lista.pop();
  return [lista.reduce((o, t) => o[t], objeto), ultimo];
};
// La edición con un valor cambiado (o una clave sacada) en la ruta. La cambia y la devuelve
const con = (edicion, ruta, valor) => {
  const [padre, clave] = padreDe(edicion, ruta);
  padre[clave] = valor;
  return edicion;
};
const sin = (edicion, ruta) => {
  const [padre, clave] = padreDe(edicion, ruta);
  delete padre[clave];
  return edicion;
};
// Los errores de la edición de prueba con un solo valor cambiado
const erroresCon = (ruta, valor, base = edicionDePrueba, hoy = FECHA_DE_PRUEBA) => validar(con(base(), ruta, valor), hoy);

const CLAVES_DE_LA_EDICION = [
  'schema_version', 'agente', 'fecha_edicion', 'tipo', 'referencia_piloto', 'titulo', 'generado_at', 'correo', 'nota_archivo',
  'agenda', 'propuestas', 'adjuntos'
];
const CLAVES_DE_LA_PROPUESTA = [
  'orden', 'titulo', 'etiquetas', 'dataset', 'rpad_snapshot', 'cifra_clave', 'calculo', 'contexto_historico', 'por_que_hoy',
  'angulo', 'idea_placa', 'texto_redes', 'puntos_centrales', 'borrador_nota', 'notas_validacion', 'fuentes'
];
// Cada clave de cada objeto cerrado, con su ruta en la edición de prueba
const TODAS_LAS_CLAVES = [
  ...CLAVES_DE_LA_EDICION,
  'correo.estado', 'correo.enviado_at',
  'agenda[0].titulo', 'agenda[0].fecha', 'agenda[0].detalle', 'agenda[0].url',
  ...CLAVES_DE_LA_PROPUESTA.map((clave) => `propuestas[1].${clave}`),
  'propuestas[1].dataset.rpad_id', 'propuestas[1].dataset.ckan_slug', 'propuestas[1].dataset.nombre', 'propuestas[1].dataset.url',
  'propuestas[1].rpad_snapshot.estado', 'propuestas[1].rpad_snapshot.datos_al', 'propuestas[1].rpad_snapshot.ultima_actualizacion',
  'propuestas[1].rpad_snapshot.updated_at', 'propuestas[1].rpad_snapshot.dias_para_vencer',
  'propuestas[1].borrador_nota.titulo', 'propuestas[1].borrador_nota.parrafos',
  'adjuntos[0].campo', 'adjuntos[0].nombre', 'adjuntos[0].mime', 'adjuntos[0].bytes', 'adjuntos[0].sha256'
];
// Cada objeto cerrado de la edición de prueba ('' es la raíz)
const OBJETOS_CERRADOS = [
  '', 'correo', 'agenda[0]', 'propuestas[1]', 'propuestas[1].dataset', 'propuestas[1].rpad_snapshot', 'propuestas[1].borrador_nota',
  'adjuntos[0]'
];
const objetoEn = (edicion, ruta) => (ruta === '' ? edicion : padreDe(edicion, ruta).reduce((padre, clave) => padre[clave]));
const unir = (ruta, clave) => (ruta === '' ? clave : `${ruta}.${clave}`);

const textos = (n, texto = 'Un texto.') => Array.from({ length: n }, () => texto);
const direcciones = (n) => Array.from({ length: n }, (_, i) => `https://datos.ejemplo.gob.ar/${i}.csv`);

describe('las constantes', () => {
  // Provisorio (spec 2026-11-12-dato-quincena-correo, 14): una sola constante del servidor, que usan todos sus textos
  it('el nombre del bot', () => {
    assert.equal(NOMBRE_DEL_BOT, 'Datito');
  });

  it('los topes de cada parte y del pedido', () => {
    assert.deepEqual({ ...TOPES }, {
      metadata: 256 * 1024, infografia_png: 5 * 1024 * 1024, correo_texto: 256 * 1024, calculos: 256 * 1024,
      infografia_svg: 1024 * 1024
    });
    assert.equal(TOPE_DEL_PEDIDO, 7 * 1024 * 1024);
    assert.ok(Object.values(TOPES).reduce((suma, tope) => suma + tope, 0) < TOPE_DEL_PEDIDO, 'la suma y el margen del multipart');
    assert.ok(Object.isFrozen(TOPES));
  });

  it('las partes, los archivos, la fecha mínima y el tope de errores', () => {
    assert.deepEqual([...PARTES], ['metadata', 'infografia_png', 'correo_texto', 'calculos', 'infografia_svg']);
    assert.deepEqual([...ARCHIVOS], ['infografia_png', 'correo_texto', 'calculos', 'infografia_svg']);
    assert.ok(Object.isFrozen(PARTES) && Object.isFrozen(ARCHIVOS));
    assert.equal(FECHA_MINIMA, '2026-11-01');
    assert.equal(MAXIMO_DE_ERRORES, 50);
  });

  it('los mensajes, al pie de la letra', () => {
    assert.deepEqual({ ...MENSAJES_VALIDACION }, {
      edicion: 'La edición tiene que ser un objeto JSON.',
      objeto: 'Tiene que ser un objeto.',
      lista: 'Tiene que ser una lista.',
      falta: 'Falta esta clave: va siempre, aunque sea null.',
      sobra: 'Esta clave no está en el formato de la edición.',
      sobraOtra: 'Trae una clave que no está en el formato de la edición.',
      schemaVersion: 'La versión del formato tiene que ser 1.0.',
      agente: 'El agente tiene que ser dato-de-la-quincena.',
      fechaEdicion: 'La fecha de la edición tiene que ser un día AAAA-MM-DD que exista, desde el 01/11/2026 hasta mañana.',
      tipo: 'El tipo tiene que ser regular o piloto.',
      referenciaRegular: 'Una edición regular no lleva referencia de piloto: va null.',
      referenciaPiloto: 'La referencia de un piloto tiene que ser piloto-N, con N de 1 a 999 y sin ceros a la izquierda.',
      generadoAt: 'Una edición regular tiene que traer la hora en que se generó.',
      correoEstado: 'El estado del correo tiene que ser enviado o no_enviado.',
      enviadoAt: 'Una edición regular tiene que traer la hora en que salió el correo.',
      enviadoAtSinCorreo: 'Con el correo no enviado, la hora del correo va null.',
      texto: 'Tiene que ser un texto.',
      vacio: 'El texto no puede quedar vacío ni con solo espacios.',
      caracterNulo: 'El texto no puede llevar el carácter nulo.',
      hasta200: 'Puede tener hasta 200 caracteres.',
      hasta1000: 'Puede tener hasta 1000 caracteres.',
      hasta2000: 'Puede tener hasta 2000 caracteres.',
      hasta4000: 'Puede tener hasta 4000 caracteres.',
      hasta10000: 'Puede tener hasta 10000 caracteres.',
      hasta20000: 'Puede tener hasta 20000 caracteres.',
      fecha: 'Tiene que ser una fecha AAAA-MM-DD que exista.',
      instante: 'Tiene que ser un instante AAAA-MM-DDTHH:MM:SS, con hasta 9 decimales y Z o ±HH:MM al final, de un día que exista, '
        + 'desde el año 1900.',
      fechaOInstante: 'Tiene que ser una fecha AAAA-MM-DD o un instante con su zona.',
      direccion: 'Tiene que ser una dirección https:// válida, de hasta 2048 caracteres.',
      orden: 'Las propuestas van numeradas 1, 2, 3… en su orden, sin saltos.',
      etiqueta: 'Las etiquetas posibles son Principal, Validar, Agenda, Efemeride y Repite.',
      etiquetaRepetida: 'Esta etiqueta ya está en la propuesta.',
      principal: 'Exactamente una propuesta tiene que llevar la etiqueta Principal.',
      motivoDeRepeticion: 'El motivo de una repetición tiene que ser datos_nuevos o hecho_actual.',
      alcanceDeRepeticion: 'El alcance de una repetición tiene que ser dataset o tema.',
      repiteSinRepeticion: 'La propuesta tiene la etiqueta Repite pero no tiene repeticion.',
      repeticionSinRepite: 'La propuesta tiene repeticion pero no tiene la etiqueta Repite.',
      enteroPositivo: 'Tiene que ser un número entero positivo.',
      estado: 'Tiene que ser uno de los estados de GET /api/datasets.',
      diasParaVencer: 'Tiene que ser un número entero de -100000 a 100000.',
      sha256: 'Tiene que ser un SHA-256 en hexadecimal: 64 caracteres en minúsculas.',
      agenda: 'La agenda puede traer hasta 20 eventos.',
      tipoDeEvento: 'El tipo de un evento de la agenda tiene que ser evento o efemeride.',
      propuestas: 'La edición tiene que traer de 1 a 5 propuestas.',
      adjuntos: 'El manifiesto tiene que describir de 2 a 4 archivos.',
      puntosCentrales: 'Tiene que traer de 3 a 5 puntos centrales.',
      parrafos: 'El borrador tiene que traer 2 o 3 párrafos.',
      notasValidacion: 'Puede traer hasta 20 notas de validación.',
      fuentes: 'Tiene que traer de 1 a 20 fuentes.',
      campo: 'El campo tiene que ser infografia_png, correo_texto, calculos o infografia_svg.',
      campoRepetido: 'Este campo ya está en otra entrada del manifiesto.',
      sinParte: 'El pedido no trae la parte que describe esta entrada.',
      sinEntradaInfografia: 'El manifiesto no describe la parte infografia_png, que llegó en el pedido.',
      sinEntradaCorreo: 'El manifiesto no describe la parte correo_texto, que llegó en el pedido.',
      sinEntradaCalculos: 'El manifiesto no describe la parte calculos, que llegó en el pedido.',
      sinEntradaSvg: 'El manifiesto no describe la parte infografia_svg, que llegó en el pedido.',
      nombre: 'El nombre del archivo tiene que tener de 1 a 255 caracteres, sin /, \\ ni caracteres de control.',
      mime: 'El tipo tiene que ser image/png en la infografía, text/plain en el texto del correo, text/markdown o text/plain en '
        + 'los cálculos e image/svg+xml en la infografía editable.',
      bytesDistintos: 'No coincide con el tamaño de la parte recibida.',
      sha256Distinto: 'No coincide con el SHA-256 de la parte recibida.',
      png: 'La infografía tiene que ser un PNG completo, de 1 a 4096 píxeles de ancho y de alto.',
      svg: 'La infografía editable tiene que ser un SVG que empiece con <svg, sin scripts, sin foreignObject, sin atributos on… y '
        + 'sin referencias externas.',
      utf8: 'Tiene que ser un texto UTF-8 válido, sin el carácter nulo.'
    });
    assert.ok(Object.isFrozen(MENSAJES_VALIDACION));
  });

  it('ningún mensaje usa las palabras que el sistema evita', () => {
    for (const mensaje of Object.values(MENSAJES_VALIDACION)) {
      assert.doesNotMatch(mensaje, /tardanza|demora|atraso|atrasad|sin respuesta|sin entregar|no mandó/i, mensaje);
    }
  });
});

describe('los fixtures', () => {
  it('la edición de prueba es una regular de dos propuestas, con los datasets 1 y 2', () => {
    const edicion = edicionDePrueba();
    assert.equal(edicion.tipo, 'regular');
    assert.equal(edicion.fecha_edicion, FECHA_DE_PRUEBA);
    assert.equal(FECHA_DE_PRUEBA, '2026-11-02');
    assert.deepEqual(edicion.propuestas.map((p) => [p.dataset.rpad_id, p.dataset.nombre]),
      [[1, 'Dataset de prueba A'], [2, 'Dataset de prueba B']]);
    assert.deepEqual(edicion.adjuntos.map((a) => a.campo), ['infografia_png', 'correo_texto', 'calculos']);
  });

  it('cambios pisa claves de la raíz y cada llamada arma objetos nuevos', () => {
    assert.equal(edicionDePrueba({ titulo: 'Otro' }).titulo, 'Otro');
    const una = edicionDePrueba();
    una.propuestas[0].titulo = 'Cambiado';
    una.adjuntos.pop();
    assert.equal(edicionDePrueba().propuestas[0].titulo, 'Un título inventado');
    assert.equal(edicionDePrueba().adjuntos.length, 3);
    const piloto = pilotoDePrueba({ referencia_piloto: 'piloto-12' });
    assert.equal(piloto.tipo, 'piloto');
    assert.equal(piloto.referencia_piloto, 'piloto-12');
    assert.equal(piloto.generado_at, null);
    assert.equal(piloto.correo.enviado_at, null);
  });

  it('pngDePrueba: la firma, un IHDR de 13 bytes con sus medidas, el IDAT y el IEND, con sus CRC', () => {
    const png = pngDePrueba({ ancho: 3, alto: 5 });
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(png.readUInt32BE(8), 13);
    assert.equal(png.toString('latin1', 12, 16), 'IHDR');
    assert.equal(png.readUInt32BE(16), 3);
    assert.equal(png.readUInt32BE(20), 5);
    assert.equal(png.readUInt32BE(29), zlib.crc32(png.subarray(12, 29)));
    const largoIdat = png.readUInt32BE(33);
    assert.equal(png.toString('latin1', 37, 41), 'IDAT');
    assert.equal(zlib.inflateSync(png.subarray(41, 41 + largoIdat)).length, 5 * (3 + 1));
    assert.equal(png.readUInt32BE(41 + largoIdat), zlib.crc32(png.subarray(37, 41 + largoIdat)));
    assert.equal(png.subarray(-12).toString('hex'), '0000000049454e44ae426082');
    assert.equal(pngDePrueba().readUInt32BE(16), 2);
    assert.equal(pngDePrueba().readUInt32BE(20), 2);
  });

  it('partesDePrueba: el manifiesto describe las partes y metadata es su JSON, sin tocar la edición', () => {
    const edicion = edicionDePrueba();
    const antes = structuredClone(edicion);
    const partes = partesDePrueba(edicion);
    assert.deepEqual(Object.keys(partes), ['metadata', 'infografia_png', 'correo_texto', 'calculos']);
    assert.deepEqual(edicion, antes);
    const metadata = JSON.parse(partes.metadata.toString('utf8'));
    assert.deepEqual(metadata, edicionDePrueba(), 'sin cambios, el manifiesto de la edición de prueba ya es el de sus partes');
    for (const entrada of metadata.adjuntos) {
      assert.equal(entrada.bytes, partes[entrada.campo].length);
      assert.equal(entrada.sha256, sha256(partes[entrada.campo]));
    }
    assert.equal(partes.metadata.toString('utf8'), JSON.stringify(metadata));
  });

  it('partesDePrueba: con otras partes recalcula el manifiesto, y con calculos: null no los incluye', () => {
    const correo = Buffer.from('Otro correo.\n', 'utf8');
    const png = pngDePrueba({ ancho: 7, alto: 3 });
    const partes = partesDePrueba(edicionDePrueba(), { infografia_png: png, correo_texto: correo });
    const manifiesto = JSON.parse(partes.metadata).adjuntos;
    assert.equal(partes.correo_texto, correo);
    assert.deepEqual(manifiesto[0], {
      campo: 'infografia_png', nombre: 'infografia-prueba.png', mime: 'image/png', bytes: png.length, sha256: sha256(png)
    });
    assert.deepEqual(manifiesto[1], {
      campo: 'correo_texto', nombre: 'correo-prueba.txt', mime: 'text/plain', bytes: correo.length, sha256: sha256(correo)
    });

    const sinCalculos = partesDePrueba(pilotoDePrueba(), { calculos: null });
    assert.deepEqual(Object.keys(sinCalculos), ['metadata', 'infografia_png', 'correo_texto']);
    const metadata = JSON.parse(sinCalculos.metadata);
    assert.deepEqual(metadata.adjuntos.map((a) => a.campo), ['infografia_png', 'correo_texto']);
    assert.equal(metadata.tipo, 'piloto');
    assert.deepEqual(validar(metadata), []);
  });

  it('svgDePrueba: chico, en UTF-8 y con la forma del que manda el bot', () => {
    const svg = svgDePrueba();
    assert.ok(svg.toString('utf8').startsWith(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">'
    ));
    assert.ok(svg.length < 1024, `${svg.length} bytes`);
    assert.ok(svg.toString('utf8').includes('font-family="DejaVu Sans,Arial,sans-serif"'));
    assert.ok(svg.toString('utf8').includes('ñandú'), 'con caracteres fuera de ASCII');
  });

  it('partesDePrueba: con infografia_svg suma la parte al final y su entrada al manifiesto; sin ella, nada cambia', () => {
    const svg = svgDePrueba();
    const partes = partesDePrueba(edicionDePrueba(), { infografia_svg: svg });
    assert.deepEqual(Object.keys(partes), ['metadata', 'infografia_png', 'correo_texto', 'calculos', 'infografia_svg']);
    assert.equal(partes.infografia_svg, svg);
    const metadata = JSON.parse(partes.metadata.toString('utf8'));
    assert.deepEqual(metadata.adjuntos.at(-1), {
      campo: 'infografia_svg', nombre: 'infografia-prueba.svg', mime: 'image/svg+xml', bytes: svg.length, sha256: sha256(svg)
    });
    assert.equal(metadata.adjuntos.length, 4);
    assert.deepEqual(validar(metadata), []);
    // Si la entrada ya estaba, la actualiza sin repetirla
    const otro = Buffer.from(`${svg.toString('utf8')}\n`, 'utf8');
    const deNuevo = JSON.parse(partesDePrueba(metadata, { infografia_svg: otro }).metadata.toString('utf8'));
    assert.deepEqual(deNuevo.adjuntos.map((a) => a.campo), ['infografia_png', 'correo_texto', 'calculos', 'infografia_svg']);
    assert.equal(deNuevo.adjuntos.at(-1).bytes, otro.length);
    // Sin el SVG, el paquete de siempre: los mismos bytes
    assert.deepEqual(partesDePrueba(edicionDePrueba(), {}), partesDePrueba(edicionDePrueba()));
    assert.ok(!Object.hasOwn(partesDePrueba(edicionDePrueba()), 'infografia_svg'));
  });
});

describe('validarEdicion: la edición de prueba y el piloto de prueba', () => {
  it('no tienen errores', () => {
    assert.deepEqual(validar(edicionDePrueba()), []);
    assert.deepEqual(validar(pilotoDePrueba()), []);
    assert.deepEqual(validar(JSON.parse(partesDePrueba(edicionDePrueba()).metadata)), []);
  });

  it('no cambia la edición que valida', () => {
    const edicion = con(edicionDePrueba(), 'propuestas[0].titulo', '   ');
    const antes = structuredClone(edicion);
    validar(edicion);
    assert.deepEqual(edicion, antes);
  });
});

describe('validarEdicion: lo que no es una edición', () => {
  it('null, una lista, un número o un texto dan un solo error, con el campo vacío', () => {
    for (const valor of [null, [], 3, 'edicion', undefined]) {
      assert.deepEqual(validar(valor), [error('', 'edicion')], String(valor));
    }
  });

  it('sin opciones o sin un hoy válido, no tira y la fecha de la edición no pasa', () => {
    assert.deepEqual(validarEdicion(edicionDePrueba()), [error('fecha_edicion', 'fechaEdicion')]);
    assert.deepEqual(validarEdicion(edicionDePrueba(), null), [error('fecha_edicion', 'fechaEdicion')]);
    assert.deepEqual(validar(edicionDePrueba(), '2026-13-01'), [error('fecha_edicion', 'fechaEdicion')]);
  });
});

describe('validarEdicion: los objetos cerrados', () => {
  it('cada clave que falta da su error con su ruta', () => {
    for (const ruta of TODAS_LAS_CLAVES) {
      assert.deepEqual(validar(sin(edicionDePrueba(), ruta)), [error(ruta, 'falta')], ruta);
    }
  });

  it('una clave que puede ser null también tiene que estar: generado_at en un piloto', () => {
    assert.deepEqual(validar(sin(pilotoDePrueba(), 'generado_at')), [error('generado_at', 'falta')]);
    assert.deepEqual(validar(sin(pilotoDePrueba(), 'correo.enviado_at')), [error('correo.enviado_at', 'falta')]);
    assert.deepEqual(validar(sin(pilotoDePrueba(), 'propuestas[1].dataset.ckan_slug')), [error('propuestas[1].dataset.ckan_slug', 'falta')]);
  });

  it('una clave con undefined cuenta como que falta', () => {
    assert.deepEqual(erroresCon('propuestas[1].puntos_centrales', undefined), [error('propuestas[1].puntos_centrales', 'falta')]);
  });

  it('cada clave de más da su error con su ruta', () => {
    for (const ruta of OBJETOS_CERRADOS) {
      const edicion = edicionDePrueba();
      objetoEn(edicion, ruta).sobrante = 1;
      assert.deepEqual(validar(edicion), [error(unir(ruta, 'sobrante'), 'sobra')], ruta || 'la raíz');
    }
  });

  it('una clave de más con un nombre raro no se repite: el error va en el objeto que la trae', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[1]['<b>clave rara</b>'] = 1;
    edicion.adjuntos[0][`a${'x'.repeat(64)}`] = 1;
    edicion['ñandú'] = 1;
    assert.deepEqual(validar(edicion), [
      error('propuestas[1]', 'sobraOtra'), error('adjuntos[0]', 'sobraOtra'), error('', 'sobraOtra')
    ]);
    assert.deepEqual(validar({ ...edicionDePrueba(), [`a${'x'.repeat(63)}`]: 1 }), [error(`a${'x'.repeat(63)}`, 'sobra')]);
  });

  it('lo que tiene que ser un objeto y no lo es', () => {
    for (const ruta of ['correo', 'agenda[0]', 'propuestas[1]', 'propuestas[1].dataset', 'propuestas[1].rpad_snapshot',
      'propuestas[1].borrador_nota', 'adjuntos[1]']) {
      for (const valor of [null, [], 'x', 3]) {
        assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'objeto')], `${ruta} ${JSON.stringify(valor)}`);
      }
    }
  });

  it('lo que tiene que ser una lista y no lo es', () => {
    for (const ruta of ['agenda', 'propuestas[1].etiquetas', 'propuestas[1].puntos_centrales', 'propuestas[1].borrador_nota.parrafos',
      'propuestas[1].notas_validacion', 'propuestas[1].fuentes', 'adjuntos']) {
      for (const valor of [null, {}, 'x']) {
        assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'lista')], `${ruta} ${JSON.stringify(valor)}`);
      }
    }
    assert.deepEqual(erroresCon('propuestas', null), [error('propuestas', 'lista')]);
  });
});

describe('validarEdicion: la cabecera', () => {
  it('schema_version es 1.0 y agente es dato-de-la-quincena', () => {
    for (const valor of ['1.1', '1', 1, null]) {
      assert.deepEqual(erroresCon('schema_version', valor), [error('schema_version', 'schemaVersion')], String(valor));
    }
    for (const valor of ['otro-agente', 'Dato-de-la-quincena', null]) {
      assert.deepEqual(erroresCon('agente', valor), [error('agente', 'agente')], String(valor));
    }
  });

  it('la fecha de la edición: un día que existe, desde FECHA_MINIMA hasta mañana', () => {
    const hoy = '2026-11-20';
    const fecha = (valor) => erroresCon('fecha_edicion', valor, edicionDePrueba, hoy);
    assert.deepEqual(fecha('2026-11-01'), []);
    assert.deepEqual(fecha(hoy), []);
    assert.deepEqual(fecha(sumarDias(hoy, 1)), []);
    for (const valor of [sumarDias(hoy, 2), '2026-10-31', '2026-02-30', '2026-11-5', '05/11/2026', 20261105, null]) {
      assert.deepEqual(fecha(valor), [error('fecha_edicion', 'fechaEdicion')], String(valor));
    }
  });

  it('el tipo es regular o piloto', () => {
    for (const valor of ['especial', 'Regular', null]) assert.deepEqual(erroresCon('tipo', valor), [error('tipo', 'tipo')]);
  });

  it('referencia_piloto: piloto-N con N de 1 a 999 en un piloto, null en una regular', () => {
    for (const valor of ['piloto-1', 'piloto-4', 'piloto-999']) {
      assert.deepEqual(erroresCon('referencia_piloto', valor, pilotoDePrueba), [], valor);
    }
    for (const valor of ['piloto-0', 'piloto-01', 'piloto-1000', 'Piloto-4', 'piloto-4 ', 'piloto4', 4, null]) {
      assert.deepEqual(erroresCon('referencia_piloto', valor, pilotoDePrueba), [error('referencia_piloto', 'referenciaPiloto')],
        String(valor));
    }
    for (const valor of ['piloto-4', 'un texto', '']) {
      assert.deepEqual(erroresCon('referencia_piloto', valor), [error('referencia_piloto', 'referenciaRegular')], valor);
    }
  });

  it('una regular trae la hora en que se generó y la del correo; un piloto puede no traerlas', () => {
    assert.deepEqual(erroresCon('generado_at', null), [error('generado_at', 'generadoAt')]);
    assert.deepEqual(erroresCon('correo.enviado_at', null), [error('correo.enviado_at', 'enviadoAt')]);
    assert.deepEqual(erroresCon('generado_at', '2026-11-02T10:00:00Z', pilotoDePrueba), []);
    assert.deepEqual(erroresCon('correo.enviado_at', '2026-11-02T10:00:00Z', pilotoDePrueba), []);
  });

  it('el correo tiene el estado enviado o no_enviado', () => {
    for (const valor of ['pendiente', 'Enviado', 'no enviado', 'NO_ENVIADO', 'no-enviado', '', null, false]) {
      assert.deepEqual(erroresCon('correo.estado', valor), [error('correo.estado', 'correoEstado')], String(valor));
    }
  });

  // Datito archiva la edición aunque el correo no haya salido: la regular también pasa sin la hora del correo
  it('con el correo no enviado, la hora del correo va null, en una regular y en un piloto', () => {
    const sinCorreo = { estado: 'no_enviado', enviado_at: null };
    assert.deepEqual(erroresCon('correo', sinCorreo), []);
    assert.deepEqual(erroresCon('correo', { ...sinCorreo }, pilotoDePrueba), []);
    for (const valor of ['2026-11-02T11:12:00Z', '2026-11-02T08:12:00-03:00', 'x', '', 0]) {
      for (const base of [edicionDePrueba, pilotoDePrueba]) {
        assert.deepEqual(erroresCon('correo', { estado: 'no_enviado', enviado_at: valor }, base),
          [error('correo.enviado_at', 'enviadoAtSinCorreo')], String(valor));
      }
    }
    assert.deepEqual(validar(sin(edicionDePrueba({ correo: { ...sinCorreo } }), 'correo.enviado_at')),
      [error('correo.enviado_at', 'falta')]);
    // La hora en que se generó la sigue pidiendo una regular, haya salido o no el correo
    assert.deepEqual(validar(edicionDePrueba({ correo: { ...sinCorreo }, generado_at: null })), [error('generado_at', 'generadoAt')]);
  });

  // Con un estado mal escrito, un solo error: pedir la hora podría llevar al bot a ponerla en un correo que no salió
  it('con el correo enviado, una regular sigue pidiendo la hora; con un estado que no vale, solo ese error', () => {
    assert.deepEqual(erroresCon('correo', { estado: 'enviado', enviado_at: null }), [error('correo.enviado_at', 'enviadoAt')]);
    for (const estado of ['otro', 'no enviado', null]) {
      assert.deepEqual(erroresCon('correo', { estado, enviado_at: null }), [error('correo.estado', 'correoEstado')], String(estado));
      assert.deepEqual(erroresCon('correo', { estado, enviado_at: '2026-11-02T11:12:00Z' }), [error('correo.estado', 'correoEstado')],
        String(estado));
      assert.deepEqual(erroresCon('correo', { estado, enviado_at: 'x' }),
        [error('correo.estado', 'correoEstado'), error('correo.enviado_at', 'instante')], String(estado));
    }
    assert.deepEqual(validar(sin(edicionDePrueba(), 'correo.estado')), [error('correo.estado', 'falta')]);
  });
});

describe('validarEdicion: los instantes y las fechas', () => {
  it('un instante raro no pasa', () => {
    for (const valor of [
      '2026-11-02T10:00:00', '2026-11-02T23:59:60Z', '2026-11-02t10:00:00Z', '2026-11-02T10:00:00z', '2026-11-02 10:00:00Z',
      '2026-02-30T10:00:00Z', '2026-11-02T10:00:00.1234567890Z', '2026-11-02T10:00Z', '2026-11-02T25:00:00Z',
      '2026-11-02T10:00:00+0300', '2026-11-02', '', 1793613600000
    ]) {
      assert.deepEqual(erroresCon('generado_at', valor), [error('generado_at', 'instante')], String(valor));
      assert.deepEqual(erroresCon('correo.enviado_at', valor, pilotoDePrueba), [error('correo.enviado_at', 'instante')], String(valor));
      assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.updated_at', valor),
        [error('propuestas[0].rpad_snapshot.updated_at', 'instante')], String(valor));
    }
  });

  it('un instante con fracción de hasta 9 cifras y con Z o ±HH:MM pasa', () => {
    for (const valor of [
      '2026-11-02T10:00:00Z', '2026-11-02T10:00:00.123456789Z', '2026-11-02T07:00:00-03:00', '2026-11-02T10:00:00.5+00:00',
      '2026-11-02T13:00:00.000+03:00'
    ]) {
      assert.deepEqual(erroresCon('generado_at', valor), [], valor);
      assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.updated_at', valor), [], valor);
    }
    assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.updated_at', null), []);
  });

  // Antes de 1900 no es un dato creíble, y un instante muy viejo se imprimiría roto, para siempre, en el detalle de una edición
  // que no se puede corregir: con la hora histórica de Argentina (−3:53:48), el 01/01/1000 a las 00:00 UTC cae en el año 999,
  // que Intl no completa con ceros
  it('el año de un instante va de 1900 en adelante; una fecha AAAA-MM-DD no cambia', () => {
    for (const valor of ['1899-12-31T23:59:59Z', '1000-01-01T00:00:00Z', '0999-12-31T23:59:59Z', '0001-01-01T00:00:00Z',
      '0000-01-01T00:00:00Z']) {
      assert.deepEqual(erroresCon('generado_at', valor), [error('generado_at', 'instante')], valor);
      assert.deepEqual(erroresCon('correo.enviado_at', valor, pilotoDePrueba), [error('correo.enviado_at', 'instante')], valor);
      assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.updated_at', valor),
        [error('propuestas[0].rpad_snapshot.updated_at', 'instante')], valor);
      assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.datos_al', valor),
        [error('propuestas[0].rpad_snapshot.datos_al', 'fechaOInstante')], valor);
    }
    for (const valor of ['1900-01-01T00:00:00Z', '1900-01-01T00:00:00+14:00', '9999-12-31T23:59:59Z']) {
      assert.deepEqual(erroresCon('generado_at', valor), [], valor);
      assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.updated_at', valor), [], valor);
      assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.datos_al', valor), [], valor);
    }
    assert.deepEqual(erroresCon('propuestas[0].rpad_snapshot.datos_al', '0999-12-31'), []);
  });

  it('datos_al y ultima_actualizacion: una fecha, un instante o null', () => {
    for (const clave of ['datos_al', 'ultima_actualizacion']) {
      const ruta = `propuestas[0].rpad_snapshot.${clave}`;
      for (const valor of ['2026-10-31', '2026-06-03T03:00:00.000Z', null]) assert.deepEqual(erroresCon(ruta, valor), [], `${clave} ${valor}`);
      for (const valor of ['ayer', '2026-02-30', '31/10/2026', '2026-06-03 03:00:00', 20261031]) {
        assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'fechaOInstante')], `${clave} ${valor}`);
      }
    }
  });

  it('la fecha de un evento de la agenda es un día que existe', () => {
    assert.deepEqual(erroresCon('agenda[0].fecha', '2027-02-28'), []);
    for (const valor of ['2027-02-29', '2026-11-10T10:00:00Z', null]) {
      assert.deepEqual(erroresCon('agenda[0].fecha', valor), [error('agenda[0].fecha', 'fecha')], String(valor));
    }
  });
});

describe('validarEdicion: las direcciones', () => {
  const RUTAS = ['propuestas[0].fuentes[1]', 'propuestas[1].dataset.url', 'agenda[0].url'];
  const conLargo = (largo) => {
    const base = 'https://datos.ejemplo.gob.ar/';
    return base + 'a'.repeat(largo - base.length);
  };

  it('una dirección https:// que new URL acepta, de hasta 2048 caracteres', () => {
    for (const ruta of RUTAS) {
      assert.deepEqual(erroresCon(ruta, conLargo(2048)), [], ruta);
      assert.deepEqual(erroresCon(ruta, 'https://datos.ejemplo.gob.ar/búsqueda?q=ñandú&x=1#arriba'), [], ruta);
    }
  });

  it('http://, rota, de 2049, con el carácter nulo o que no es un texto, no', () => {
    for (const ruta of RUTAS) {
      for (const valor of [
        'http://datos.ejemplo.gob.ar/a.csv', 'HTTPS://datos.ejemplo.gob.ar/a.csv', 'https://', 'https:// datos', 'https://[x',
        'datos.ejemplo.gob.ar/a.csv', conLargo(2049), 'https://datos.ejemplo.gob.ar/a\u0000.csv', '', null, 5
      ]) {
        assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'direccion')], `${ruta} ${String(valor).slice(0, 40)}`);
      }
    }
  });
});

describe('validarEdicion: las propuestas', () => {
  const variasPropuestas = (n) => {
    const edicion = edicionDePrueba();
    edicion.propuestas = Array.from({ length: n }, (_, i) => ({
      ...(i === 0 ? edicion.propuestas[0] : edicion.propuestas[1]), orden: i + 1
    }));
    return edicion;
  };

  it('de 1 a 5', () => {
    assert.deepEqual(validar(variasPropuestas(1)), []);
    assert.deepEqual(validar(variasPropuestas(5)), []);
    assert.deepEqual(validar(variasPropuestas(6)), [error('propuestas', 'propuestas')]);
    assert.deepEqual(erroresCon('propuestas', []), [error('propuestas', 'propuestas')]);
  });

  it('el orden va 1, 2, 3… sin saltos', () => {
    assert.deepEqual(erroresCon('propuestas[1].orden', 3), [error('propuestas[1].orden', 'orden')]);
    for (const valor of ['2', 2.5, null, 0]) {
      assert.deepEqual(erroresCon('propuestas[1].orden', valor), [error('propuestas[1].orden', 'orden')], String(valor));
    }
    const cruzadas = con(con(edicionDePrueba(), 'propuestas[0].orden', 2), 'propuestas[1].orden', 1);
    assert.deepEqual(validar(cruzadas), [error('propuestas[0].orden', 'orden'), error('propuestas[1].orden', 'orden')]);
  });

  it('exactamente una lleva Principal', () => {
    assert.deepEqual(erroresCon('propuestas[0].etiquetas', ['Validar']), [error('propuestas', 'principal')]);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Principal']), [error('propuestas', 'principal')]);
    assert.deepEqual(erroresCon('propuestas[0].etiquetas', []), [error('propuestas', 'principal')]);
  });

  // spec 2026-11-14-dato-quincena-v1-3, 1: suman Efemeride (sin tilde, como la escribe el bot) y Repite, que pide su repeticion
  it('las etiquetas: sin repetidos, solo Principal, Validar, Agenda, Efemeride y Repite', () => {
    assert.deepEqual(erroresCon('propuestas[0].etiquetas', ['Principal', 'Validar', 'Agenda']), []);
    assert.deepEqual(erroresCon('propuestas[0].etiquetas', ['Principal', 'Validar', 'Agenda', 'Efemeride']), []);
    const conLasCinco = con(edicionDePrueba(), 'propuestas[0].repeticion', repeticionDePrueba());
    assert.deepEqual(validar(con(conLasCinco, 'propuestas[0].etiquetas', ['Principal', 'Validar', 'Agenda', 'Efemeride', 'Repite'])), []);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', []), []);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Efemeride']), []);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Agenda', 'Agenda']), [error('propuestas[1].etiquetas[1]', 'etiquetaRepetida')]);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Efemeride', 'Efemeride']),
      [error('propuestas[1].etiquetas[1]', 'etiquetaRepetida')]);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Urgente']), [error('propuestas[1].etiquetas[0]', 'etiqueta')]);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Validar', 'agenda', 3]),
      [error('propuestas[1].etiquetas[1]', 'etiqueta'), error('propuestas[1].etiquetas[2]', 'etiqueta')]);
    // La etiqueta para mostrar no es un valor del JSON
    for (const rara of ['Efeméride', 'efemeride', 'repite', 'Repetida']) {
      assert.deepEqual(erroresCon('propuestas[1].etiquetas', [rara]), [error('propuestas[1].etiquetas[0]', 'etiqueta')], rara);
    }
  });

  it('los puntos centrales, de 3 a 5', () => {
    const ruta = 'propuestas[1].puntos_centrales';
    assert.deepEqual(erroresCon(ruta, textos(3)), []);
    assert.deepEqual(erroresCon(ruta, textos(5)), []);
    assert.deepEqual(erroresCon(ruta, textos(2)), [error(ruta, 'puntosCentrales')]);
    assert.deepEqual(erroresCon(ruta, textos(6)), [error(ruta, 'puntosCentrales')]);
  });

  it('los párrafos del borrador, 2 o 3', () => {
    const ruta = 'propuestas[1].borrador_nota.parrafos';
    assert.deepEqual(erroresCon(ruta, textos(2)), []);
    assert.deepEqual(erroresCon(ruta, textos(3)), []);
    assert.deepEqual(erroresCon(ruta, textos(1)), [error(ruta, 'parrafos')]);
    assert.deepEqual(erroresCon(ruta, textos(4)), [error(ruta, 'parrafos')]);
  });

  it('las fuentes, de 1 a 20', () => {
    const ruta = 'propuestas[1].fuentes';
    assert.deepEqual(erroresCon(ruta, direcciones(1)), []);
    assert.deepEqual(erroresCon(ruta, direcciones(20)), []);
    assert.deepEqual(erroresCon(ruta, []), [error(ruta, 'fuentes')]);
    assert.deepEqual(erroresCon(ruta, direcciones(21)), [error(ruta, 'fuentes')]);
  });

  it('las notas de validación, de 0 a 20', () => {
    const ruta = 'propuestas[0].notas_validacion';
    assert.deepEqual(erroresCon(ruta, []), []);
    assert.deepEqual(erroresCon(ruta, textos(20)), []);
    assert.deepEqual(erroresCon(ruta, textos(21)), [error(ruta, 'notasValidacion')]);
  });

  it('la agenda, de 0 a 20 eventos', () => {
    const evento = edicionDePrueba().agenda[0];
    assert.deepEqual(erroresCon('agenda', []), []);
    assert.deepEqual(erroresCon('agenda', Array.from({ length: 20 }, () => ({ ...evento }))), []);
    assert.deepEqual(erroresCon('agenda', Array.from({ length: 21 }, () => ({ ...evento }))), [error('agenda', 'agenda')]);
  });

  // spec 2026-11-12-dato-quincena-correo, 11: tipo es opcional, y sin él el evento sigue valiendo (el contrato de antes)
  it('agenda con tipo: evento o efemeride pasan, sin tipo pasa; otro valor da su error', () => {
    assert.ok(!Object.hasOwn(edicionDePrueba().agenda[0], 'tipo'), 'el evento de prueba no trae tipo');
    assert.deepEqual(validar(edicionDePrueba()), []);
    for (const tipo of ['efemeride', 'evento']) {
      assert.deepEqual(erroresCon('agenda[0].tipo', tipo), [], tipo);
    }
    assert.deepEqual(erroresCon('agenda', [edicionDePrueba().agenda[0], efemerideDePrueba()]), []);
    for (const tipo of ['feriado', 'Efemeride', 'efeméride', 'EVENTO', '', null, 1, ['evento'], { tipo: 'evento' }]) {
      assert.deepEqual(erroresCon('agenda[0].tipo', tipo), [error('agenda[0].tipo', 'tipoDeEvento')], JSON.stringify(tipo));
    }
    // Una clave de más sigue siendo de más, también con tipo; y con undefined, como cualquier clave, falta
    assert.deepEqual(erroresCon('agenda[0]', { ...efemerideDePrueba(), color: 'rojo' }), [error('agenda[0].color', 'sobra')]);
    assert.deepEqual(erroresCon('agenda[0]', { ...efemerideDePrueba(), tipo: undefined }), [error('agenda[0].tipo', 'falta')]);
    // Va en su lugar, después de las claves de siempre
    assert.deepEqual(erroresCon('agenda[1]', { ...efemerideDePrueba(), tipo: 'feriado', fecha: '2026-02-30' }),
      [error('agenda[1].fecha', 'fecha'), error('agenda[1].tipo', 'tipoDeEvento')]);
  });

  it('el dataset: rpad_id entero positivo o null', () => {
    const ruta = 'propuestas[1].dataset.rpad_id';
    for (const valor of [1, 2147483647, null]) assert.deepEqual(erroresCon(ruta, valor), [], String(valor));
    for (const valor of [0, -1, '3', 1.5, true, 2 ** 53]) {
      assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'enteroPositivo')], String(valor));
    }
  });

  it('la foto del RPAD: el estado de GET /api/datasets o null', () => {
    const ruta = 'propuestas[1].rpad_snapshot.estado';
    for (const valor of ['actualizado', 'proximo', 'atrasado', 'sin-respuesta', 'sin-fecha', 'eventual', null]) {
      assert.deepEqual(erroresCon(ruta, valor), [], String(valor));
    }
    for (const valor of ['vencido', 'Actualizado', '', 1]) assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'estado')], String(valor));
  });

  it('la foto del RPAD: dias_para_vencer entero de -100000 a 100000 o null', () => {
    const ruta = 'propuestas[1].rpad_snapshot.dias_para_vencer';
    for (const valor of [-100000, -3, 0, 100000, null]) assert.deepEqual(erroresCon(ruta, valor), [], String(valor));
    for (const valor of [-100001, 100001, 1.5, '3']) {
      assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'diasParaVencer')], String(valor));
    }
  });
});

// spec 2026-11-14-dato-quincena-v1-3, 1: repeticion es opcional, como tipo en la agenda; si está, null o un objeto cerrado de cuatro
// claves. La etiqueta Repite y la repeticion van juntas, y los dos textos de la coherencia los copia Datito tal cual
describe('validarEdicion: la repetición (contrato v1.3)', () => {
  // La edición de prueba con la propuesta i repitiendo (la etiqueta Repite y su repeticion)
  const repitiendo = (i = 1, cambios = {}) => {
    const edicion = edicionDePrueba();
    edicion.propuestas[i].etiquetas.push('Repite');
    edicion.propuestas[i].repeticion = repeticionDePrueba(cambios);
    return edicion;
  };
  const ruta = 'propuestas[1].repeticion';

  it('una edición v1.2, sin la clave ni las etiquetas nuevas, sigue valiendo', () => {
    const edicion = edicionDePrueba();
    assert.ok(edicion.propuestas.every((p) => !Object.hasOwn(p, 'repeticion')), 'la edición de prueba no trae repeticion');
    assert.deepEqual(validar(edicion), []);
    assert.deepEqual(validar(pilotoDePrueba()), []);
  });

  it('sin la clave, con null (sin Repite) o con un objeto (con Repite), pasa', () => {
    assert.deepEqual(erroresCon(ruta, null), []);
    assert.deepEqual(validar(repitiendo()), []);
    assert.deepEqual(validar(repitiendo(0)), []);
    for (const motivo of ['datos_nuevos', 'hecho_actual']) {
      for (const alcance of ['dataset', 'tema']) assert.deepEqual(validar(repitiendo(1, { motivo, alcance })), [], `${motivo} ${alcance}`);
    }
    // Una fecha posterior o la misma de la edición pasa: el RPAD no la compara con lo archivado (eso da un aviso, no un 422)
    for (const fecha of ['2026-11-02', '2026-12-31', '2020-01-01']) {
      assert.deepEqual(validar(repitiendo(1, { fecha_edicion_previa: fecha })), [], fecha);
    }
    // El detalle hasta 1000 caracteres, contados con Array.from, y con sus propios saltos de línea
    assert.deepEqual(validar(repitiendo(1, { detalle: '😀'.repeat(1000) })), []);
    assert.deepEqual(validar(repitiendo(1, { detalle: 'Primer renglón.\nSegundo renglón.' })), []);
  });

  it('lo que no es null ni un objeto: el error objeto de siempre', () => {
    for (const valor of ['sí', 3, true, [], [repeticionDePrueba()]]) {
      const edicion = repitiendo();
      edicion.propuestas[1].repeticion = valor;
      assert.deepEqual(validar(edicion), [error(ruta, 'objeto')], JSON.stringify(valor));
    }
  });

  it('cada clave mal: la fecha, el motivo, el alcance y el detalle, en su ruta', () => {
    for (const fecha of ['2026-02-30', '02/11/2026', '2026-11-02T00:00:00Z', null, 20261102]) {
      assert.deepEqual(validar(repitiendo(1, { fecha_edicion_previa: fecha })), [error(`${ruta}.fecha_edicion_previa`, 'fecha')],
        String(fecha));
    }
    for (const motivo of ['datos nuevos', 'Datos_nuevos', 'otro', '', null, 1]) {
      assert.deepEqual(validar(repitiendo(1, { motivo })), [error(`${ruta}.motivo`, 'motivoDeRepeticion')], String(motivo));
    }
    for (const alcance of ['datasets', 'Tema', '', null, ['dataset']]) {
      assert.deepEqual(validar(repitiendo(1, { alcance })), [error(`${ruta}.alcance`, 'alcanceDeRepeticion')], String(alcance));
    }
    const casosDelDetalle = [['', 'vacio'], ['   ', 'vacio'], [null, 'texto'], [7, 'texto'], ['a\u0000b', 'caracterNulo'],
      ['x'.repeat(1001), 'hasta1000']];
    for (const [detalle, clave] of casosDelDetalle) {
      assert.deepEqual(validar(repitiendo(1, { detalle })), [error(`${ruta}.detalle`, clave)], JSON.stringify(detalle).slice(0, 20));
    }
  });

  it('un objeto cerrado: cada clave que falta (también con undefined) y cada una de más, en su ruta', () => {
    for (const clave of ['fecha_edicion_previa', 'motivo', 'alcance', 'detalle']) {
      const edicion = repitiendo();
      delete edicion.propuestas[1].repeticion[clave];
      assert.deepEqual(validar(edicion), [error(`${ruta}.${clave}`, 'falta')], clave);
      assert.deepEqual(validar(repitiendo(1, { [clave]: undefined })), [error(`${ruta}.${clave}`, 'falta')], clave);
    }
    assert.deepEqual(validar(repitiendo(1, { edicion_previa_id: 3 })), [error(`${ruta}.edicion_previa_id`, 'sobra')]);
    assert.deepEqual(validar(repitiendo(1, { 'con espacio': 3 })), [error(ruta, 'sobraOtra')]);
    // Con undefined, como cualquier clave, falta; y la coherencia lo cuenta como que no está
    const sinValor = repitiendo();
    sinValor.propuestas[1].repeticion = undefined;
    assert.deepEqual(validar(sinValor), [error(ruta, 'falta'), error(ruta, 'repiteSinRepeticion')]);
  });

  it('la coherencia: Repite sin repeticion (o con null) y repeticion sin Repite, con las rutas desde 0', () => {
    assert.equal(MENSAJES_VALIDACION.repiteSinRepeticion, 'La propuesta tiene la etiqueta Repite pero no tiene repeticion.');
    assert.equal(MENSAJES_VALIDACION.repeticionSinRepite, 'La propuesta tiene repeticion pero no tiene la etiqueta Repite.');
    const sinClave = repitiendo();
    delete sinClave.propuestas[1].repeticion;
    assert.deepEqual(validar(sinClave), [error(ruta, 'repiteSinRepeticion')]);
    const conNull = repitiendo();
    conNull.propuestas[1].repeticion = null;
    assert.deepEqual(validar(conNull), [error(ruta, 'repiteSinRepeticion')]);
    const sinEtiqueta = edicionDePrueba();
    sinEtiqueta.propuestas[0].repeticion = repeticionDePrueba();
    assert.deepEqual(validar(sinEtiqueta), [error('propuestas[0].etiquetas', 'repeticionSinRepite')]);
    // Sin ninguna etiqueta, también
    const sinEtiquetas = edicionDePrueba();
    sinEtiquetas.propuestas[1].etiquetas = [];
    sinEtiquetas.propuestas[1].repeticion = repeticionDePrueba();
    assert.deepEqual(validar(sinEtiquetas), [error('propuestas[1].etiquetas', 'repeticionSinRepite')]);
  });

  it('la coherencia solo mira una lista de etiquetas y una repeticion que es objeto o falta o es null', () => {
    // Un valor que no es un objeto ya tiene su error: no suma el de la coherencia, con Repite o sin ella
    const rara = repitiendo();
    rara.propuestas[1].repeticion = 'sí';
    assert.deepEqual(validar(rara), [error(ruta, 'objeto')]);
    const raraSinRepite = edicionDePrueba();
    raraSinRepite.propuestas[1].repeticion = 'sí';
    assert.deepEqual(validar(raraSinRepite), [error(ruta, 'objeto')]);
    // Unas etiquetas que no son una lista tienen su error y no se miran
    const sinLista = edicionDePrueba();
    sinLista.propuestas[1].etiquetas = 'Repite';
    sinLista.propuestas[1].repeticion = repeticionDePrueba();
    assert.deepEqual(validar(sinLista), [error('propuestas[1].etiquetas', 'lista')]);
    // Una repetición con una clave mal sigue siendo un objeto: con Repite no hay error de coherencia, sin Repite sí
    const malSinRepite = edicionDePrueba();
    malSinRepite.propuestas[1].repeticion = repeticionDePrueba({ motivo: 'otro' });
    assert.deepEqual(validar(malSinRepite),
      [error(`${ruta}.motivo`, 'motivoDeRepeticion'), error('propuestas[1].etiquetas', 'repeticionSinRepite')]);
  });

  it('el orden: los de cada propuesta (la coherencia al final de los suyos), y Principal después de todas', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[0].etiquetas = ['Validar', 'Repite'];
    edicion.propuestas[0].titulo = '';
    edicion.propuestas[1].repeticion = repeticionDePrueba({ alcance: 'otro' });
    edicion.propuestas[1].cifra_clave = null;
    assert.deepEqual(validar(edicion), [
      error('propuestas[0].titulo', 'vacio'),
      error('propuestas[0].repeticion', 'repiteSinRepeticion'),
      error('propuestas[1].cifra_clave', 'texto'),
      error('propuestas[1].repeticion.alcance', 'alcanceDeRepeticion'),
      error('propuestas[1].etiquetas', 'repeticionSinRepite'),
      error('propuestas', 'principal')
    ]);
  });

  it('no cambia la edición que valida', () => {
    const edicion = repitiendo();
    const copia = structuredClone(edicion);
    validar(edicion);
    assert.deepEqual(edicion, copia);
  });
});

describe('validarEdicion: los textos', () => {
  it('se cuentan con Array.from: un título de 200 emojis pasa y uno de 201 no', () => {
    assert.deepEqual(erroresCon('titulo', '🧉'.repeat(200)), []);
    assert.deepEqual(erroresCon('titulo', '🧉'.repeat(201)), [error('titulo', 'hasta200')]);
    assert.deepEqual(erroresCon('propuestas[0].titulo', `${'\u00f1'.repeat(199)}🧉`), []);
  });

  it('un texto obligatorio no queda vacío ni con solo espacios, ni lleva el carácter nulo', () => {
    for (const ruta of ['titulo', 'propuestas[0].cifra_clave', 'propuestas[1].puntos_centrales[2]', 'agenda[0].detalle',
      'propuestas[0].notas_validacion[0]', 'propuestas[1].dataset.nombre']) {
      for (const valor of ['', '   ', '\n\t ']) assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'vacio')], ruta);
      assert.deepEqual(erroresCon(ruta, 'a\u0000b'), [error(ruta, 'caracterNulo')], ruta);
      for (const valor of [null, 5, ['a'], { a: 1 }]) assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'texto')], ruta);
    }
  });

  it('un texto que puede ser null: null, un texto o vacío pasan; otra cosa o el carácter nulo, no', () => {
    for (const ruta of ['nota_archivo', 'propuestas[0].dataset.ckan_slug']) {
      for (const valor of [null, 'Un texto.', '']) assert.deepEqual(erroresCon(ruta, valor), [], `${ruta} ${valor}`);
      assert.deepEqual(erroresCon(ruta, 5), [error(ruta, 'texto')], ruta);
      assert.deepEqual(erroresCon(ruta, '\u0000'), [error(ruta, 'caracterNulo')], ruta);
    }
  });

  it('el tope de cada texto', () => {
    const TOPES_DE_TEXTO = [
      ['titulo', 200], ['nota_archivo', 4000], ['agenda[0].titulo', 200], ['agenda[0].detalle', 4000],
      ['propuestas[0].titulo', 200], ['propuestas[0].dataset.nombre', 200], ['propuestas[0].dataset.ckan_slug', 200],
      ['propuestas[0].cifra_clave', 1000], ['propuestas[0].calculo', 20000], ['propuestas[0].contexto_historico', 20000],
      ['propuestas[0].por_que_hoy', 10000], ['propuestas[0].angulo', 10000], ['propuestas[0].idea_placa', 10000],
      ['propuestas[0].texto_redes', 10000], ['propuestas[0].puntos_centrales[0]', 2000],
      ['propuestas[0].borrador_nota.titulo', 200], ['propuestas[0].borrador_nota.parrafos[1]', 10000],
      ['propuestas[0].notas_validacion[1]', 10000]
    ];
    for (const [ruta, tope] of TOPES_DE_TEXTO) {
      assert.deepEqual(erroresCon(ruta, '\u00e9'.repeat(tope)), [], ruta);
      assert.deepEqual(erroresCon(ruta, '\u00e9'.repeat(tope + 1)), [error(ruta, `hasta${tope}`)], ruta);
    }
  });
});

describe('validarEdicion: el manifiesto (solo su forma)', () => {
  it('de 2 a 4 entradas (la cuarta, el SVG)', () => {
    const edicion = edicionDePrueba();
    const conSvg = JSON.parse(partesDePrueba(edicion, { infografia_svg: svgDePrueba() }).metadata.toString('utf8')).adjuntos;
    assert.equal(conSvg.length, 4);
    assert.deepEqual(erroresCon('adjuntos', edicion.adjuntos.slice(0, 2)), []);
    assert.deepEqual(erroresCon('adjuntos', conSvg), []);
    assert.deepEqual(erroresCon('adjuntos', edicion.adjuntos.slice(0, 1)), [error('adjuntos', 'adjuntos')]);
    assert.deepEqual(erroresCon('adjuntos', [...conSvg, { ...conSvg[3] }]), [error('adjuntos', 'adjuntos')]);
    assert.deepEqual(erroresCon('adjuntos', []), [error('adjuntos', 'adjuntos')]);
  });

  it('un elemento que no es un objeto', () => {
    for (const valor of [null, 'infografia_png', 3, []]) {
      assert.deepEqual(erroresCon('adjuntos[2]', valor), [error('adjuntos[2]', 'objeto')], JSON.stringify(valor));
    }
  });

  it('sha256: 64 hex en minúsculas', () => {
    const bueno = edicionDePrueba().adjuntos[0].sha256;
    for (const valor of [bueno.toUpperCase(), bueno.slice(1), `${bueno}0`, `g${bueno.slice(1)}`, null, 5]) {
      assert.deepEqual(erroresCon('adjuntos[0].sha256', valor), [error('adjuntos[0].sha256', 'sha256')], String(valor));
    }
  });

  it('bytes: entero positivo', () => {
    for (const valor of [0, -1, 1.5, '10', null]) {
      assert.deepEqual(erroresCon('adjuntos[1].bytes', valor), [error('adjuntos[1].bytes', 'enteroPositivo')], String(valor));
    }
  });

  it('campo, nombre y mime: textos (sus valores los mira validarAdjuntos, con las partes)', () => {
    for (const clave of ['campo', 'nombre', 'mime']) {
      const ruta = `adjuntos[1].${clave}`;
      for (const valor of [null, 5, ['a']]) assert.deepEqual(erroresCon(ruta, valor), [error(ruta, 'texto')], `${ruta} ${valor}`);
      assert.deepEqual(erroresCon(ruta, 'otro valor'), [], ruta);
    }
  });
});

describe('validarEdicion: varios errores', () => {
  it('los junta todos, en el orden de la edición', () => {
    const edicion = edicionDePrueba();
    edicion.agente = 'otro';
    edicion.propuestas[0].puntos_centrales = textos(2);
    edicion.propuestas[1].dataset.url = 'http://datos.ejemplo.gob.ar/b';
    edicion.adjuntos[1].sha256 = 'A';
    assert.deepEqual(validar(edicion), [
      error('agente', 'agente'), error('propuestas[0].puntos_centrales', 'puntosCentrales'),
      error('propuestas[1].dataset.url', 'direccion'), error('adjuntos[1].sha256', 'sha256')
    ]);
  });

  it('una edición con 60 problemas da los primeros 50', () => {
    const edicion = edicionDePrueba();
    for (let i = 1; i <= 60; i++) edicion[`sobrante_${i}`] = i;
    const errores = validar(edicion);
    assert.equal(errores.length, MAXIMO_DE_ERRORES);
    assert.deepEqual(errores, Array.from({ length: 50 }, (_, i) => error(`sobrante_${i + 1}`, 'sobra')));
  });

  it('una lista enorme de problemas también corta en 50', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[0].fuentes = Array.from({ length: 500 }, () => 'http://x');
    assert.equal(validar(edicion).length, 50);
  });
});

describe('claveDeEdicion', () => {
  it('una regular y un piloto', () => {
    assert.equal(claveDeEdicion(edicionDePrueba({ fecha_edicion: '2026-11-23' })), 'dq:regular:2026-11-23');
    assert.equal(claveDeEdicion(pilotoDePrueba({ fecha_edicion: '2026-11-06', referencia_piloto: 'piloto-4' })),
      'dq:piloto:2026-11-06:piloto-4');
    assert.equal(claveDeEdicion({ tipo: 'regular', fecha_edicion: '2026-11-23', referencia_piloto: null }), 'dq:regular:2026-11-23');
  });
});

describe('sha256', () => {
  it('el SHA-256 en hexadecimal, en minúsculas', () => {
    assert.equal(sha256DeLasReglas(Buffer.from('abc', 'utf8')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(sha256DeLasReglas(Buffer.alloc(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('esPng', () => {
  // Una copia del PNG de prueba con un cambio en sus bytes
  const pngCon = (cambiar) => {
    const png = Buffer.from(pngDePrueba());
    cambiar(png);
    return png;
  };

  it('el PNG de prueba sí, de 1 × 1 y de 4096 × 4096 también', () => {
    assert.equal(esPng(pngDePrueba()), true);
    assert.equal(esPng(pngDePrueba({ ancho: 1, alto: 1 })), true);
    assert.equal(esPng(pngDePrueba({ ancho: 4096, alto: 4096 })), true);
  });

  it('un ancho o un alto de 4097 o de 0, no', () => {
    for (const medidas of [{ ancho: 4097, alto: 1 }, { ancho: 1, alto: 4097 }, { ancho: 0, alto: 2 }, { ancho: 2, alto: 0 }]) {
      assert.equal(esPng(pngDePrueba(medidas)), false, JSON.stringify(medidas));
    }
  });

  it('sin la firma, o con un IHDR de otro largo o de otro tipo, no', () => {
    assert.equal(esPng(pngCon((png) => { png[0] = 0x88; })), false);
    assert.equal(esPng(pngCon((png) => { png[7] = 0x0b; })), false);
    assert.equal(esPng(pngCon((png) => png.writeUInt32BE(14, 8))), false);
    assert.equal(esPng(pngCon((png) => png.write('IDAT', 12, 'latin1'))), false);
  });

  it('cortado o con bytes después del IEND, no', () => {
    const png = pngDePrueba();
    for (const cortado of [png.subarray(0, -1), png.subarray(0, 33), png.subarray(0, 20), png.subarray(0, 8), Buffer.alloc(0)]) {
      assert.equal(esPng(cortado), false, `${cortado.length} bytes`);
    }
    assert.equal(esPng(Buffer.concat([png, Buffer.from([0])])), false);
    assert.equal(esPng(Buffer.concat([png, Buffer.from('\n', 'utf8')])), false);
  });

  it('lo que no es un Buffer, no', () => {
    for (const valor of [undefined, null, 'png', [0x89, 0x50]]) assert.equal(esPng(valor), false, String(valor));
  });
});

describe('esTextoUtf8 y textoDeMetadata', () => {
  it('esTextoUtf8: un UTF-8 válido sí; uno roto o con el carácter nulo, no', () => {
    assert.equal(esTextoUtf8(Buffer.from('ñandú 🧉', 'utf8')), true);
    assert.equal(esTextoUtf8(Buffer.from([0xff])), false);
    assert.equal(esTextoUtf8(Buffer.from('ñ', 'utf8').subarray(0, 1)), false);
    assert.equal(esTextoUtf8(Buffer.from([0xed, 0xa0, 0x80])), false, 'la mitad de un par sustituto');
    assert.equal(esTextoUtf8(Buffer.from('a\u0000b', 'utf8')), false);
    for (const valor of [undefined, null, 'ñandú']) assert.equal(esTextoUtf8(valor), false, String(valor));
  });

  it('textoDeMetadata: el texto, con el BOM conservado (y el JSON.parse falla); null si no es UTF-8', () => {
    const conBom = textoDeMetadata(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]));
    assert.equal(conBom, '﻿{}');
    assert.throws(() => JSON.parse(conBom), SyntaxError);
    assert.equal(textoDeMetadata(Buffer.from('{"a":"ñandú 🧉"}', 'utf8')), '{"a":"ñandú 🧉"}');
    assert.equal(textoDeMetadata(Buffer.from([0xff])), null);
    for (const valor of [undefined, null, '{}']) assert.equal(textoDeMetadata(valor), null, String(valor));
  });
});

// spec 2026-11-12-dato-quincena-correo, 11: el SVG nunca se dibuja (se adjunta a un mail y se descarga), pero igual no puede
// traer scripts ni referencias externas. Los SVG de acá son inventados
describe('esSvg', () => {
  const svg = (texto) => Buffer.from(texto, 'utf8');
  const CUERPO = '<rect width="10" height="10"/></svg>';
  const APERTURA = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">';

  it('acepta el SVG del bot: directo con <svg xmlns=…>, o con la declaración XML, comentarios y espacios delante', () => {
    assert.equal(esSvg(svgDePrueba()), true);
    for (const texto of [
      `${APERTURA}${CUERPO}`,
      `<?xml version="1.0"?>\n<!-- Una infografía inventada -->\n${APERTURA}${CUERPO}`,
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!-- uno --><!-- dos -->${APERTURA}${CUERPO}`,
      `  \n\t${APERTURA}${CUERPO}`,
      `<!-- solo un comentario -->\n<svg>${CUERPO}`,
      `<svg\nxmlns="http://www.w3.org/2000/svg">${CUERPO}`
    ]) {
      assert.equal(esSvg(svg(texto)), true, texto.slice(0, 60));
    }
  });

  it('acepta las referencias a su propio #id, con espacios y comillas', () => {
    for (const texto of [
      `${APERTURA}<use href="#a"/><rect fill="url(#grad)"/></svg>`,
      `${APERTURA}<use xlink:href = '#a'/><rect style="fill: url( '#grad' )"/></svg>`,
      `${APERTURA}<use HREF=#a /><rect fill="URL(&quot;#grad&quot;)"/><rect fill='url( "#g")'/></svg>`
    ]) {
      assert.equal(esSvg(svg(texto)), true, texto);
    }
  });

  it('acepta textos que se parecen a lo prohibido sin serlo', () => {
    for (const texto of [
      `${APERTURA}<text font-family="DejaVu Sans" font-size="32">Personas con onda; version 2</text></svg>`,
      `${APERTURA}<g requiredExtensions="x" id="icono1"><polygon points="0,0 1,1"/></g></svg>`,
      `${APERTURA}<text>Descripción &amp; datos: &#241;and&#xFA;</text></svg>`
    ]) {
      assert.equal(esSvg(svg(texto)), true, texto);
    }
  });

  it('rechaza un script, foreignObject, un atributo on…, @import y las referencias externas, con mayúsculas o espacios', () => {
    for (const texto of [
      `${APERTURA}<SCRIPT>alert(1)</SCRIPT></svg>`,
      `${APERTURA}<script href="#a"/></svg>`,
      '<svg ONLOAD = "x"></svg>',
      `${APERTURA}<rect onclick="x"/></svg>`,
      `${APERTURA}<rect\tOnMouseOver\n=\n'x'/></svg>`,
      `${APERTURA}<g/onclick="x"/></svg>`,
      `${APERTURA}<rect x="1"onload="x"/></svg>`,
      `${APERTURA}<foreignObject><div/></foreignObject></svg>`,
      `${APERTURA}<FOREIGNOBJECT/></svg>`,
      `${APERTURA}<image xlink:href = "https://x.test/a.png"/></svg>`,
      `${APERTURA}<image href='//x.test'/></svg>`,
      `${APERTURA}<a href="javascript:alert(1)"><rect/></a></svg>`,
      `${APERTURA}<image href=" https://x.test"/></svg>`,
      `${APERTURA}<image HREF="data:image/png;base64,AAAA"/></svg>`,
      `${APERTURA}<rect style="fill:url( http://x.test)"/></svg>`,
      `${APERTURA}<rect style="fill:URL('https://x.test/a.svg#b')"/></svg>`,
      `${APERTURA}<style>@import "https://x.test/a.css";</style></svg>`,
      `${APERTURA}<style>@IMPORT url(#a);</style></svg>`
    ]) {
      assert.equal(esSvg(svg(texto)), false, texto);
    }
  });

  // Lo que XML permite para esquivar las reglas de arriba: un prefijo, el espacio de nombres de HTML y una animación del href
  it('rechaza un script o un foreignObject con prefijo, HTML por su espacio de nombres y una animación de un href o un on…', () => {
    const HTML = 'http://www.w3.org/1999/xhtml';
    for (const texto of [
      `${APERTURA}<h:script xmlns:h="${HTML}">alert(1)</h:script></svg>`,
      `${APERTURA}<svg:SCRIPT>alert(1)</svg:SCRIPT></svg>`,
      `${APERTURA}<svg:foreignObject/></svg>`,
      `${APERTURA}<g xmlns="${HTML}"><iframe/></g></svg>`,
      `${APERTURA}<g xmlns="HTTP://WWW.W3.ORG/1999/XHTML"/></svg>`,
      `${APERTURA}<a><animate attributeName="href" values="javascript:alert(1)"/></a></svg>`,
      `${APERTURA}<a><set attributeName = 'xlink:href' to="https://x.test"/></a></svg>`,
      `${APERTURA}<rect><set attributeName="onmouseover" to="alert(1)"/></rect></svg>`
    ]) {
      assert.equal(esSvg(svg(texto)), false, texto);
    }
    // Una animación de otra cosa, sí
    assert.equal(esSvg(svg(`${APERTURA}<rect><animate attributeName="opacity" values="0;1" dur="1s"/></rect></svg>`)), true);
  });

  // Lo que el lector de XML decodifica (&#…; y las cinco entidades) se mira también decodificado: una referencia externa no se
  // esconde con un carácter escrito como entidad
  it('rechaza lo prohibido escrito con entidades de XML', () => {
    for (const texto of [
      `${APERTURA}<rect style="fill:u&#114;l(https://x.test/a.png)"/></svg>`,
      `${APERTURA}<rect style="fill:&#x75;rl(https://x.test/a.png)"/></svg>`,
      `${APERTURA}<style>&#64;import "https://x.test/a.css";</style></svg>`,
      `${APERTURA}<text>&lt;script&gt;</text></svg>`
    ]) {
      assert.equal(esSvg(svg(texto)), false, texto);
    }
    // Una entidad que no es un carácter válido no rompe
    assert.equal(esSvg(svg(`${APERTURA}<text>&#xFFFFFFF; &#99999999999; &#xD800;</text></svg>`)), true);
  });

  it('rechaza lo que no empieza con <svg: un BOM, otro elemento, un DOCTYPE, otra instrucción o un comentario sin cerrar', () => {
    for (const texto of [
      `\uFEFF${APERTURA}${CUERPO}`,
      `<html><body>${APERTURA}${CUERPO}</body></html>`,
      `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">${APERTURA}${CUERPO}`,
      `<?xml-stylesheet type="text/css" href="#a"?>${APERTURA}${CUERPO}`,
      `<?xml version="1.0"?><?xml version="1.0"?>${APERTURA}${CUERPO}`,
      `<!-- sin cerrar ${APERTURA}${CUERPO}`,
      `<?xml version="1.0" ${APERTURA}${CUERPO}`,
      `un texto${APERTURA}${CUERPO}`,
      `<svgx>${CUERPO}`,
      `<svg/>`,
      `<SVG>${CUERPO}`,
      '<svg',
      '',
      '   '
    ]) {
      assert.equal(esSvg(svg(texto)), false, JSON.stringify(texto.slice(0, 40)));
    }
  });

  it('rechaza un nulo, un UTF-8 roto (latin1) y lo que no es un Buffer', () => {
    assert.equal(esSvg(svg(`${APERTURA}<text>a\u0000b</text></svg>`)), false);
    assert.equal(esSvg(Buffer.from(`${APERTURA}<text>ñandú</text></svg>`, 'latin1')), false);
    assert.equal(esSvg(Buffer.from([0xef, 0xbb, 0xbf, ...svg(`${APERTURA}${CUERPO}`)])), false, 'el BOM en bytes');
    for (const valor of [undefined, null, `${APERTURA}${CUERPO}`, [0x3c]]) assert.equal(esSvg(valor), false, String(valor));
  });

  // Ningún control vuelve atrás de más: el principio se lee de corrido, y una expresión con dos \s* separados por algo opcional
  // se repartía los mismos espacios de n² maneras (1 MB de espacios después de href=, url( o attributeName= trababa el servidor
  // media hora). Cada caso, primero con 32 KB, donde una vuelta atrás cuadrática ya pasa el tope y el test falla en segundos en
  // lugar de trabarse, y después con 1 MB. Los topes son decenas de veces lo que tarda: no dependen de la máquina
  it('1 MB armado para trabarlo se revisa en menos de 500 ms, en el principio, en cada control y en las entidades', () => {
    const veces = (texto, n) => texto.repeat(Math.ceil(n / texto.length));
    const espacios = (n) => ' '.repeat(n);
    const en = (adentro) => `${APERTURA}${adentro}</svg>`;
    // [qué, cómo se arma con unos n bytes, lo que tiene que dar]
    const CASOS = [
      ['el principio: espacios y otro elemento', (n) => `${espacios(n)}<x>`, false],
      ['el principio: comentarios y otro elemento', (n) => `${veces('<!---->', n)}<x>`, false],
      ['el principio: comentarios y el svg', (n) => `${veces('<!---->', n)}${APERTURA}${CUERPO}`, true],
      ['el principio: la declaración sin cerrar', (n) => `<?xml ${espacios(n)}`, false],
      ['el principio: un comentario sin cerrar', (n) => `<!--${espacios(n)}`, false],
      ['el principio: una declaración larga y el svg', (n) => `<?xml ${espacios(n)}?>${APERTURA}${CUERPO}`, true],
      ['comentarios adentro del svg', (n) => en(veces('<!-- a --> ', n)), true],
      ['script: un < y un nombre largo', (n) => en(`<${'a'.repeat(n)}/>`), true],
      ['script: muchos <a.', (n) => en(veces('<a.', n)), true],
      ['script: muchos <', (n) => en(veces('<', n)), true],
      ['on…: on y una palabra larga', (n) => en(`<text> on${'a'.repeat(n)}</text>`), true],
      ['on…: onx y espacios', (n) => en(`<text> onx${espacios(n)}</text>`), true],
      ['on…: muchos on', (n) => en(veces(' on', n)), true],
      ['attributeName= y espacios', (n) => en(`<set attributeName=${espacios(n)}x/>`), true],
      ['attributeName=" y espacios', (n) => en(`<set attributeName="${espacios(n)}x"/>`), true],
      ['attributeName= espacios, comilla y espacios', (n) => en(`<set attributeName=${espacios(n / 2)}"${espacios(n / 2)}x"/>`), true],
      ['attributeName= y un nombre largo', (n) => en(`<set attributeName="${'a'.repeat(n)}"/>`), true],
      ['href= y espacios', (n) => en(`<use href=${espacios(n)}x/>`), false],
      ['href=" y espacios', (n) => en(`<use href="${espacios(n)}x"/>`), false],
      ['href= espacios, comilla y espacios', (n) => en(`<use href=${espacios(n / 2)}"${espacios(n / 2)}x"/>`), false],
      ['href= espacios y #', (n) => en(`<use href=${espacios(n)}#a/>`), true],
      ['href sin = y espacios', (n) => en(`<text>href${espacios(n)}x</text>`), true],
      ['url( y espacios', (n) => en(`<rect fill="url(${espacios(n)}x)"/>`), false],
      ['url(" y espacios', (n) => en(`<rect fill='url("${espacios(n)}x")'/>`), false],
      ['url( espacios, comilla y espacios', (n) => en(`<rect fill='url(${espacios(n / 2)}"${espacios(n / 2)}x")'/>`), false],
      ['url( espacios y #', (n) => en(`<rect fill="url(${espacios(n)}#g)"/>`), true],
      ['entidades: &#x y muchas cifras sin ;', (n) => en(`<text>&#x${'a'.repeat(n)}</text>`), true],
      ['entidades: &# y muchas cifras sin ;', (n) => en(`<text>&#${'1'.repeat(n)}</text>`), true],
      ['entidades: &#x y muchas cifras con ;', (n) => en(`<text>&#x${'1'.repeat(n)};</text>`), true],
      ['entidades: muchos &amp;', (n) => en(`<text>${veces('&amp;', n)}</text>`), true],
      ['entidades: muchos &', (n) => en(`<text>${veces('&', n)}</text>`), true],
      ['un SVG grande y sano', (n) => en(veces('<text x="1" y="2" font-family="DejaVu Sans">Un texto inventado.</text>', n)), true]
    ];
    for (const [bytes, tope] of [[32 * 1024, 100], [1024 * 1024, 500]]) {
      for (const [nombre, armar, esperado] of CASOS) {
        const entrada = svg(armar(bytes));
        const inicio = performance.now();
        const resultado = esSvg(entrada);
        const ms = performance.now() - inicio;
        assert.equal(resultado, esperado, `${nombre} (${bytes} bytes)`);
        assert.ok(ms < tope, `${nombre} (${bytes} bytes): ${ms.toFixed(0)} ms, el tope es ${tope}`);
      }
    }
  });
});

// El manifiesto de las partes, como lo lee el controlador de metadata
const manifiestoDe = (partes) => JSON.parse(partes.metadata.toString('utf8')).adjuntos;

describe('validarAdjuntos: el manifiesto contra las partes', () => {
  // Las partes de prueba (con los cambios de partes) y su manifiesto, con el cambio de manifiesto antes de validar
  const revisar = ({ partes: cambios = {}, manifiesto = () => {} } = {}) => {
    const partes = partesDePrueba(edicionDePrueba(), cambios);
    const adjuntos = manifiestoDe(partes);
    manifiesto(adjuntos);
    return validarAdjuntos(adjuntos, partes);
  };
  const entradaDeLosCalculos = () => edicionDePrueba().adjuntos[2];

  it('el manifiesto de partesDePrueba, con cálculos o sin ellos, no tiene errores', () => {
    assert.deepEqual(revisar(), []);
    assert.deepEqual(revisar({ partes: { calculos: null } }), []);
    assert.deepEqual(validarAdjuntos(edicionDePrueba().adjuntos, partesDePrueba(edicionDePrueba())), []);
  });

  it('la entrada sin la parte', () => {
    assert.deepEqual(revisar({ partes: { calculos: null }, manifiesto: (a) => a.push(entradaDeLosCalculos()) }),
      [error('adjuntos[2].campo', 'sinParte')]);
  });

  it('la parte sin la entrada', () => {
    assert.deepEqual(revisar({ manifiesto: (a) => a.pop() }), [error('adjuntos', 'sinEntradaCalculos')]);
    assert.deepEqual(revisar({ manifiesto: (a) => a.shift() }), [error('adjuntos', 'sinEntradaInfografia')]);
    assert.deepEqual(revisar({ manifiesto: (a) => a.splice(1, 1) }), [error('adjuntos', 'sinEntradaCorreo')]);
  });

  it('bytes y sha256 distintos de los de la parte', () => {
    assert.deepEqual(revisar({ manifiesto: (a) => { a[1].bytes += 1; } }), [error('adjuntos[1].bytes', 'bytesDistintos')]);
    assert.deepEqual(revisar({ manifiesto: (a) => { a[0].sha256 = sha256(Buffer.from('otra cosa', 'utf8')); } }),
      [error('adjuntos[0].sha256', 'sha256Distinto')]);
    assert.deepEqual(revisar({ manifiesto: (a) => { a[2].bytes = a[1].bytes; a[2].sha256 = a[1].sha256; } }),
      [error('adjuntos[2].bytes', 'bytesDistintos'), error('adjuntos[2].sha256', 'sha256Distinto')]);
  });

  it('bytes o sha256 sin su forma no se comparan: ese error ya lo da validarEdicion', () => {
    assert.deepEqual(revisar({ manifiesto: (a) => { a[1].bytes = '10'; a[0].sha256 = a[0].sha256.toUpperCase(); } }), []);
    assert.deepEqual(revisar({ manifiesto: (a) => { a[1].bytes = 0; a[2].sha256 = null; } }), []);
  });

  it('un campo repetido: solo ese error y el de su nombre, sin comparar lo demás', () => {
    assert.deepEqual(revisar({ partes: { calculos: null }, manifiesto: (a) => a.push({ ...a[1] }) }),
      [error('adjuntos[2].campo', 'campoRepetido')]);
    assert.deepEqual(revisar({ manifiesto: (a) => { a[2] = { ...a[1] }; } }),
      [error('adjuntos[2].campo', 'campoRepetido'), error('adjuntos', 'sinEntradaCalculos')]);
    assert.deepEqual(revisar({
      partes: { calculos: null },
      manifiesto: (a) => a.push({ ...a[1], nombre: 'a/b.txt', mime: 'text/html', bytes: a[1].bytes + 1, sha256: a[0].sha256 })
    }), [error('adjuntos[2].campo', 'campoRepetido'), error('adjuntos[2].nombre', 'nombre')]);
  });

  it('un campo que no es un archivo de la edición: correo_html, metadata y otros', () => {
    assert.deepEqual(revisar({ manifiesto: (a) => { a[1].campo = 'correo_html'; } }),
      [error('adjuntos[1].campo', 'campo'), error('adjuntos', 'sinEntradaCorreo')]);
    for (const valor of ['metadata', 'Calculos', '', 'toString', '__proto__']) {
      assert.deepEqual(revisar({ manifiesto: (a) => { a[2].campo = valor; } }),
        [error('adjuntos[2].campo', 'campo'), error('adjuntos', 'sinEntradaCalculos')], valor);
    }
  });

  it('un campo que no es un texto no se repite (lo da validarEdicion), pero esa parte queda sin entrada', () => {
    assert.deepEqual(revisar({ manifiesto: (a) => { a[1].campo = 5; } }), [error('adjuntos', 'sinEntradaCorreo')]);
  });

  it('el mime de cada campo: text/html en el texto no, text/plain en los cálculos sí', () => {
    assert.deepEqual(revisar({ manifiesto: (a) => { a[1].mime = 'text/html'; } }), [error('adjuntos[1].mime', 'mime')]);
    assert.deepEqual(revisar({ manifiesto: (a) => { a[2].mime = 'text/plain'; } }), []);
    for (const [i, valor] of [
      [0, 'image/jpeg'], [0, 'IMAGE/PNG'], [0, 'text/plain'], [1, 'text/markdown'], [1, 'text/plain; charset=utf-8'],
      [2, 'text/html'], [2, 'image/png'], [2, '']
    ]) {
      assert.deepEqual(revisar({ manifiesto: (a) => { a[i].mime = valor; } }), [error(`adjuntos[${i}].mime`, 'mime')], `${i} ${valor}`);
    }
    assert.deepEqual(revisar({ manifiesto: (a) => { a[1].mime = null; } }), [], 'sin texto lo da validarEdicion');
  });

  it('el nombre: de 1 a 255 caracteres, sin /, \\ ni caracteres de control', () => {
    for (const valor of ['x'.repeat(255), '🧉'.repeat(255), 'infografía del 2 de noviembre.png']) {
      assert.deepEqual(revisar({ manifiesto: (a) => { a[0].nombre = valor; } }), [], valor.slice(0, 20));
    }
    for (const valor of [
      'carpeta/infografia.png', 'carpeta\\infografia.png', 'info\ngrafia.png', '\u0007.png', 'a\u0000b.png', 'a\u007fb.png',
      'a\u0085b.png', '', 'x'.repeat(256), '🧉'.repeat(256)
    ]) {
      assert.deepEqual(revisar({ manifiesto: (a) => { a[0].nombre = valor; } }), [error('adjuntos[0].nombre', 'nombre')],
        JSON.stringify(valor.slice(0, 20)));
    }
    assert.deepEqual(revisar({ manifiesto: (a) => { a[2].nombre = 5; } }), [], 'sin texto lo da validarEdicion');
  });

  it('una infografía que no es PNG', () => {
    assert.deepEqual(revisar({ partes: { infografia_png: Buffer.from('no es un PNG', 'utf8') } }), [error('infografia_png', 'png')]);
    assert.deepEqual(revisar({ partes: { infografia_png: pngDePrueba({ ancho: 4097, alto: 1 }) } }), [error('infografia_png', 'png')]);
  });

  it('un texto que no es UTF-8 o que trae el carácter nulo', () => {
    assert.deepEqual(revisar({ partes: { correo_texto: Buffer.from([0xff]) } }), [error('correo_texto', 'utf8')]);
    assert.deepEqual(revisar({ partes: { calculos: Buffer.from('a\u0000b', 'utf8') } }), [error('calculos', 'utf8')]);
  });

  // spec 2026-11-12-dato-quincena-correo, 11: el SVG es una parte opcional; su entrada va solo si llegó
  it('validarAdjuntos con SVG: la entrada image/svg+xml y la parte, sin errores', () => {
    assert.deepEqual(revisar({ partes: { infografia_svg: svgDePrueba() } }), []);
    assert.deepEqual(revisar({ partes: { infografia_svg: svgDePrueba(), calculos: null } }), []);
    // El SVG puede ir en cualquier lugar del manifiesto
    assert.deepEqual(revisar({ partes: { infografia_svg: svgDePrueba() }, manifiesto: (a) => a.unshift(a.pop()) }), []);
  });

  it('validarAdjuntos con SVG: la parte sin entrada, la entrada sin la parte y la entrada repetida', () => {
    assert.deepEqual(revisar({ partes: { infografia_svg: svgDePrueba() }, manifiesto: (a) => a.pop() }),
      [error('adjuntos', 'sinEntradaSvg')]);
    const entradaDelSvg = manifiestoDe(partesDePrueba(edicionDePrueba(), { infografia_svg: svgDePrueba() })).at(-1);
    assert.deepEqual(revisar({ manifiesto: (a) => a.push(entradaDelSvg) }), [error('adjuntos[3].campo', 'sinParte')]);
    assert.deepEqual(revisar({ partes: { infografia_svg: svgDePrueba(), calculos: null }, manifiesto: (a) => a.push({ ...a[2] }) }),
      [error('adjuntos[3].campo', 'campoRepetido')]);
  });

  it('validarAdjuntos con SVG: el mime es image/svg+xml', () => {
    for (const valor of ['image/png', 'image/svg', 'IMAGE/SVG+XML', 'image/svg+xml; charset=utf-8', 'text/xml', '']) {
      assert.deepEqual(revisar({ partes: { infografia_svg: svgDePrueba() }, manifiesto: (a) => { a[3].mime = valor; } }),
        [error('adjuntos[3].mime', 'mime')], valor);
    }
    // image/svg+xml en otra parte, no
    assert.deepEqual(revisar({ manifiesto: (a) => { a[0].mime = 'image/svg+xml'; } }), [error('adjuntos[0].mime', 'mime')]);
  });

  it('validarAdjuntos con SVG: bytes y sha256 contra la parte, y un contenido que no es un SVG', () => {
    assert.deepEqual(revisar({ partes: { infografia_svg: svgDePrueba() }, manifiesto: (a) => { a[3].bytes += 1; } }),
      [error('adjuntos[3].bytes', 'bytesDistintos')]);
    for (const contenido of [
      Buffer.from('<svg><script>alert(1)</script></svg>', 'utf8'), Buffer.from('<html></html>', 'utf8'), pngDePrueba(),
      Buffer.from([0xff])
    ]) {
      assert.deepEqual(revisar({ partes: { infografia_svg: contenido } }),
        [{ campo: 'infografia_svg', mensaje: MENSAJES_VALIDACION.svg }], contenido.toString('utf8').slice(0, 30));
    }
    // El PNG en la parte del SVG y el SVG en la del PNG: cada una con su error
    assert.deepEqual(revisar({ partes: { infografia_png: svgDePrueba(), infografia_svg: pngDePrueba() } }),
      [error('infografia_png', 'png'), error('infografia_svg', 'svg')]);
  });

  it('un elemento que no es un objeto no rompe y se saltea (lo informa validarEdicion)', () => {
    for (const valor of [null, 'calculos', 3, []]) {
      assert.deepEqual(revisar({ partes: { calculos: null }, manifiesto: (a) => a.push(valor) }), [], JSON.stringify(valor));
    }
    assert.deepEqual(revisar({ manifiesto: (a) => { a[2] = null; } }), [error('adjuntos', 'sinEntradaCalculos')]);
  });

  it('un manifiesto que no es una lista da [] (lo informa validarEdicion)', () => {
    const partes = partesDePrueba(edicionDePrueba());
    for (const valor of [undefined, null, {}, 'adjuntos']) assert.deepEqual(validarAdjuntos(valor, partes), [], String(valor));
  });

  it('el orden: cada entrada con sus claves, y después cada parte sin entrada o con otro contenido', () => {
    assert.deepEqual(revisar({
      partes: { correo_texto: Buffer.from([0xff]) },
      manifiesto: (a) => {
        a.pop();
        a[1].nombre = 'a/b.txt';
        a[1].mime = 'text/html';
        a[1].bytes += 1;
        a[0].sha256 = a[1].sha256;
      }
    }), [
      error('adjuntos[0].sha256', 'sha256Distinto'), error('adjuntos[1].nombre', 'nombre'), error('adjuntos[1].mime', 'mime'),
      error('adjuntos[1].bytes', 'bytesDistintos'), error('correo_texto', 'utf8'), error('adjuntos', 'sinEntradaCalculos')
    ]);
  });

  it('también corta en 50', () => {
    const otra = { campo: 'otro', nombre: 'otro.txt', mime: 'text/plain', bytes: 1, sha256: 'a'.repeat(64) };
    const adjuntos = Array.from({ length: 60 }, () => ({ ...otra }));
    const errores = validarAdjuntos(adjuntos, partesDePrueba(edicionDePrueba()));
    assert.deepEqual(errores, Array.from({ length: 50 }, (_, i) => error(`adjuntos[${i}].campo`, 'campo')));
  });
});

describe('erroresDeLaEdicion: la forma y las partes, con un solo tope', () => {
  // La edición como la lee el controlador (el JSON de metadata) y sus partes
  const recibir = (edicion = edicionDePrueba(), cambios = {}) => {
    const partes = partesDePrueba(edicion, cambios);
    return [JSON.parse(partes.metadata.toString('utf8')), partes];
  };
  const errores = (edicion, partes) => erroresDeLaEdicion(edicion, partes, { hoy: FECHA_DE_PRUEBA });

  it('la edición de prueba y el piloto sin cálculos no tienen errores', () => {
    assert.deepEqual(errores(...recibir()), []);
    assert.deepEqual(errores(...recibir(pilotoDePrueba(), { calculos: null })), []);
  });

  it('con el SVG y una efeméride en la agenda, tampoco; con un SVG que no sirve, el error de su parte', () => {
    const conEfemeride = edicionDePrueba({ agenda: [...edicionDePrueba().agenda, efemerideDePrueba()] });
    assert.deepEqual(errores(...recibir(conEfemeride, { infografia_svg: svgDePrueba() })), []);
    assert.deepEqual(errores(...recibir(pilotoDePrueba(), { calculos: null, infografia_svg: svgDePrueba() })), []);
    const conScript = Buffer.from('<svg><script>alert(1)</script></svg>', 'utf8');
    assert.deepEqual(errores(...recibir(conEfemeride, { infografia_svg: conScript })), [error('infografia_svg', 'svg')]);
  });

  it('primero los de la forma y después los de las partes, sin repetir uno', () => {
    const [edicion, partes] = recibir();
    edicion.agente = 'otro';
    edicion.adjuntos[0].sha256 = edicion.adjuntos[0].sha256.toUpperCase();
    edicion.adjuntos[1].bytes += 1;
    edicion.adjuntos[2].mime = 'text/html';
    assert.deepEqual(errores(edicion, partes), [
      error('agente', 'agente'), error('adjuntos[0].sha256', 'sha256'), error('adjuntos[1].bytes', 'bytesDistintos'),
      error('adjuntos[2].mime', 'mime')
    ]);
  });

  it('sin una lista de adjuntos, solo los de la forma', () => {
    const [, partes] = recibir();
    for (const valor of [null, {}, 'x']) {
      const [edicion] = recibir();
      edicion.adjuntos = valor;
      assert.deepEqual(errores(edicion, partes), [error('adjuntos', 'lista')], JSON.stringify(valor));
    }
    const [sinAdjuntos] = recibir();
    delete sinAdjuntos.adjuntos;
    assert.deepEqual(errores(sinAdjuntos, partes), [error('adjuntos', 'falta')]);
    for (const valor of [null, [], 'edicion', undefined]) assert.deepEqual(errores(valor, partes), [error('', 'edicion')], String(valor));
  });

  it('sin opciones no tira: la fecha de la edición no pasa', () => {
    const [edicion, partes] = recibir();
    assert.deepEqual(erroresDeLaEdicion(edicion, partes), [error('fecha_edicion', 'fechaEdicion')]);
  });

  it('el tope de 50 vale para las dos juntas', () => {
    const [edicion, partes] = recibir();
    for (let i = 1; i <= 49; i++) edicion[`sobrante_${i}`] = i;
    edicion.adjuntos[0].sha256 = sha256(Buffer.from('otra cosa', 'utf8'));
    edicion.adjuntos[1].bytes += 1;
    assert.deepEqual(errores(edicion, partes), [
      ...Array.from({ length: 49 }, (_, i) => error(`sobrante_${i + 1}`, 'sobra')), error('adjuntos[0].sha256', 'sha256Distinto')
    ]);
    for (let i = 50; i <= 60; i++) edicion[`sobrante_${i}`] = i;
    assert.deepEqual(errores(edicion, partes), Array.from({ length: 50 }, (_, i) => error(`sobrante_${i + 1}`, 'sobra')));
  });
});

describe('huellaDelPaquete', () => {
  // El texto de la sección 6, armado a mano: un renglón por parte, en su orden, con - si no llegó; el del SVG (spec
  // 2026-11-12-dato-quincena-correo, 11), al final y solo si llegó
  const esperada = (partes) => sha256(Buffer.from(
    `metadata:${sha256(partes.metadata)}\n`
    + `infografia_png:${sha256(partes.infografia_png)}\n`
    + `correo_texto:${sha256(partes.correo_texto)}\n`
    + `calculos:${partes.calculos === undefined ? '-' : sha256(partes.calculos)}\n`
    + (partes.infografia_svg === undefined ? '' : `infografia_svg:${sha256(partes.infografia_svg)}\n`),
    'utf8'
  ));

  it('el SHA-256 del texto de la sección 6, con los cálculos y sin ellos', () => {
    const partes = partesDePrueba(edicionDePrueba());
    assert.match(huellaDelPaquete(partes), /^[0-9a-f]{64}$/);
    assert.equal(huellaDelPaquete(partes), esperada(partes));
    const sinCalculos = partesDePrueba(pilotoDePrueba(), { calculos: null });
    assert.equal(huellaDelPaquete(sinCalculos), esperada(sinCalculos));
  });

  // Un paquete sin SVG da la huella de antes del SVG, así un reenvío de algo ya archivado sigue dando 200. Los valores se
  // calcularon con la regla anterior al SVG, sobre partes fijas (no con pngDePrueba: el deflate puede cambiar con zlib)
  it('la huella sin SVG no cambia', () => {
    const paquete = {
      metadata: Buffer.from('{"edicion":"inventada"}', 'utf8'),
      infografia_png: Buffer.from('una infografía inventada', 'utf8'),
      correo_texto: Buffer.from('un correo inventado', 'utf8'),
      calculos: Buffer.from('unos cálculos inventados', 'utf8')
    };
    const { calculos, ...sinCalculos } = paquete;
    assert.equal(huellaDelPaquete(paquete), '33bb4bde5eac96a034b04bb80375230a9b3d1bd2ce84780d130bda32d423e0a8');
    assert.equal(huellaDelPaquete(sinCalculos), 'c4d6f86fd0cdf20698734c813ebd2d2ef42b99e9e1be037393ac29e87e525772');
    assert.equal(huellaDelPaquete({ ...paquete, infografia_svg: undefined }), huellaDelPaquete(paquete));
    assert.equal(huellaDelPaquete({ ...paquete, infografia_svg: 'no es un Buffer' }), huellaDelPaquete(paquete));
  });

  it('con SVG suma su renglón, al final', () => {
    const partes = partesDePrueba(edicionDePrueba(), { infografia_svg: svgDePrueba() });
    assert.equal(huellaDelPaquete(partes), esperada(partes));
    const { infografia_svg, ...sinSvg } = partes;
    assert.notEqual(huellaDelPaquete(partes), huellaDelPaquete(sinSvg));
    assert.notEqual(huellaDelPaquete(partes), huellaDelPaquete({ ...sinSvg, infografia_svg: Buffer.alloc(0) }));
    // Sin cálculos y con SVG: el renglón de los cálculos con - y el del SVG después
    const { calculos, ...sinCalculos } = partes;
    assert.equal(huellaDelPaquete(sinCalculos), esperada(sinCalculos));
    assert.ok(infografia_svg.length > 0 && calculos.length > 0);
  });

  it('igual con las mismas partes, y no depende del orden en que llegaron', () => {
    const partes = partesDePrueba(edicionDePrueba());
    const copia = Object.fromEntries(Object.entries(partesDePrueba(edicionDePrueba())).reverse());
    assert.deepEqual(Object.keys(copia), ['calculos', 'correo_texto', 'infografia_png', 'metadata']);
    assert.equal(huellaDelPaquete(copia), huellaDelPaquete(partes));
    const conSvg = partesDePrueba(edicionDePrueba(), { infografia_svg: svgDePrueba() });
    const alReves = Object.fromEntries(Object.entries(conSvg).reverse());
    assert.equal(Object.keys(alReves)[0], 'infografia_svg');
    assert.equal(huellaDelPaquete(alReves), huellaDelPaquete(conSvg));
  });

  it('distinta si cambia un byte de cualquier parte', () => {
    const partes = partesDePrueba(edicionDePrueba(), { infografia_svg: svgDePrueba() });
    const original = huellaDelPaquete(partes);
    for (const parte of PARTES) {
      for (const posicion of [0, partes[parte].length - 1]) {
        const cambiada = Buffer.from(partes[parte]);
        cambiada[posicion] ^= 1;
        assert.notEqual(huellaDelPaquete({ ...partes, [parte]: cambiada }), original, `${parte} ${posicion}`);
      }
    }
  });

  it('distinta con los cálculos y sin ellos, y con unos cálculos vacíos', () => {
    const partes = partesDePrueba(edicionDePrueba());
    const { calculos, ...sinCalculos } = partes;
    assert.ok(calculos.length > 0);
    const huellas = [huellaDelPaquete(partes), huellaDelPaquete(sinCalculos), huellaDelPaquete({ ...sinCalculos, calculos: Buffer.alloc(0) })];
    assert.equal(new Set(huellas).size, 3);
  });
});

describe('estadoDelToken', () => {
  // Un token al azar en cada corrida, como el de openssl rand -hex 32, y su huella: ningún mensaje los repite
  const token = crypto.randomBytes(32).toString('hex');
  const huella = sha256(Buffer.from(token, 'utf8'));
  const conToken = `Bearer ${token}`;

  it('sin una huella de 64 caracteres hexadecimales, apagado, aunque el token sea el correcto', () => {
    const raras = [undefined, null, '', huella.slice(1), `${huella}0`, 'z'.repeat(64), `${huella}\n`, ` ${huella.slice(1)}`, 64];
    raras.forEach((configurada, i) => assert.equal(estadoDelToken(conToken, configurada), 'apagado', `huella rara ${i}`));
  });

  it('sin el encabezado, con otro esquema, sin token o con otro token, rechazado', () => {
    const otro = crypto.randomBytes(32).toString('hex');
    const raros = [
      undefined, null, '', 'Basic x', `Basic ${token}`, 'Bearer ', 'Bearer', `bearer ${token}`, `Bearer  ${token}`, `Bearer ${otro}`,
      `Bearer ${token}x`, token, [conToken]
    ];
    raros.forEach((authorization, i) => assert.equal(estadoDelToken(authorization, huella), 'rechazado', `encabezado raro ${i}`));
  });

  it('el token correcto, aceptado, también con la huella en mayúsculas', () => {
    assert.equal(estadoDelToken(conToken, huella), 'aceptado');
    assert.equal(estadoDelToken(conToken, huella.toUpperCase()), 'aceptado');
  });

  it('el token tiene de 1 a 512 caracteres: con 513, rechazado aunque la huella sea la suya', () => {
    const largo = crypto.randomBytes(256).toString('hex');
    assert.equal(largo.length, 512);
    assert.equal(estadoDelToken(`Bearer ${largo}`, sha256(Buffer.from(largo, 'utf8'))), 'aceptado');
    const demasiado = `${largo}a`;
    assert.equal(estadoDelToken(`Bearer ${demasiado}`, sha256(Buffer.from(demasiado, 'utf8'))), 'rechazado');
    assert.equal(estadoDelToken('Bearer x', sha256(Buffer.from('x', 'utf8'))), 'aceptado');
  });

  it('compara con crypto.timingSafeEqual, sobre dos buffers de 32 bytes', (t) => {
    const comparar = t.mock.method(crypto, 'timingSafeEqual');
    assert.equal(estadoDelToken(conToken, huella), 'aceptado');
    assert.equal(estadoDelToken(`Bearer ${token}0`, huella), 'rechazado');
    assert.equal(comparar.mock.callCount(), 2);
    for (const llamada of comparar.mock.calls) assert.deepEqual(llamada.arguments.map((b) => b.length), [32, 32]);
  });
});

// Las palabras que el sistema evita en lo que arma (CLAUDE.md, «Lenguaje y nombres»)
const PALABRAS_EVITADAS = /tardanza|demora|atraso|atrasad|sin respuesta|sin entregar|no mandó/i;
// Un instante en segundos UNIX, como UNIX_TIMESTAMP de la base
const segundosUtc = (...partes) => Date.UTC(...partes) / 1000;

describe('fechaLarga y marcaDePiloto', () => {
  it('el día de la semana con mayúscula y la fecha larga', () => {
    assert.equal(fechaLarga('2026-11-06'), 'Viernes 6 de noviembre de 2026');
    assert.equal(fechaLarga('2026-11-23'), 'Lunes 23 de noviembre de 2026');
    assert.equal(fechaLarga('2026-11-03'), 'Martes 3 de noviembre de 2026');
    assert.equal(fechaLarga('2026-11-04'), 'Miércoles 4 de noviembre de 2026');
    assert.equal(fechaLarga('2026-11-05'), 'Jueves 5 de noviembre de 2026');
    assert.equal(fechaLarga('2026-11-07'), 'Sábado 7 de noviembre de 2026');
    assert.equal(fechaLarga('2026-11-08'), 'Domingo 8 de noviembre de 2026');
    assert.equal(fechaLarga('2027-01-01'), 'Viernes 1 de enero de 2027');
  });

  it('lo que no es una fecha que existe da «—», sin tirar', () => {
    for (const raro of [null, undefined, '', '2026-02-30', '06/11/2026', 20261106]) assert.equal(fechaLarga(raro), '—', String(raro));
  });

  it('la marca: «Piloto N» en un piloto, null en una regular', () => {
    assert.equal(marcaDePiloto('piloto', 'piloto-12'), 'Piloto 12');
    assert.equal(marcaDePiloto('piloto', 'piloto-4'), 'Piloto 4');
    assert.equal(marcaDePiloto('piloto', 'piloto-999'), 'Piloto 999');
    assert.equal(marcaDePiloto('regular', null), null);
    assert.equal(marcaDePiloto('regular', 'piloto-4'), null);
    assert.equal(marcaDePiloto('piloto', null), null);
    assert.equal(marcaDePiloto('piloto', 'piloto-04'), null);
  });
});

describe('horaArgentina y diaArgentino', () => {
  it('de segundos UNIX: la fecha, la hora y el instante con su zona', () => {
    assert.deepEqual(horaArgentina(segundosUtc(2026, 10, 23, 11, 14, 2)),
      { fecha: '23/11/2026', hora: '08:14', iso: '2026-11-23T08:14:02-03:00' });
  });

  it('de segundos UNIX en texto, como los puede dar la base: lo mismo', () => {
    assert.deepEqual(horaArgentina(String(segundosUtc(2026, 10, 23, 11, 14, 2))),
      { fecha: '23/11/2026', hora: '08:14', iso: '2026-11-23T08:14:02-03:00' });
  });

  it('de un instante RFC 3339, sea cual sea su zona', () => {
    assert.equal(horaArgentina('2026-11-23T11:12:00Z').hora, '08:12');
    const esperada = { fecha: '23/11/2026', hora: '08:12', iso: '2026-11-23T08:12:00-03:00' };
    assert.deepEqual(horaArgentina('2026-11-23T11:12:00Z'), esperada);
    assert.deepEqual(horaArgentina('2026-11-23T08:12:00-03:00'), esperada);
    assert.deepEqual(horaArgentina('2026-11-23T14:12:00+03:00'), esperada);
    assert.deepEqual(horaArgentina('2026-11-23T11:12:00.123456789Z'), esperada);
  });

  it('pasada la medianoche UTC, todavía es el día anterior en Argentina', () => {
    assert.deepEqual(horaArgentina(segundosUtc(2026, 10, 24, 2, 30, 0)),
      { fecha: '23/11/2026', hora: '23:30', iso: '2026-11-23T23:30:00-03:00' });
    assert.deepEqual(horaArgentina('2026-11-24T02:30:00Z'),
      { fecha: '23/11/2026', hora: '23:30', iso: '2026-11-23T23:30:00-03:00' });
  });

  // El primer año que acepta la validación: con la hora histórica de Argentina (−4:16:48 entre 1894 y 1920) cae en 1899, con
  // sus cuatro cifras
  it('un instante del 01/01/1900, el más viejo que se acepta, sale bien armado', () => {
    for (const [valor, hora] of [['1900-01-01T00:00:00Z', '19:43'], ['1900-01-01T00:00:00+14:00', '05:43']]) {
      const resultado = horaArgentina(valor);
      assert.equal(resultado.fecha, '31/12/1899', valor);
      assert.equal(resultado.hora, hora, valor);
      assert.match(resultado.iso, /^1899-12-31T\d{2}:\d{2}:\d{2}-03:00$/, valor);
      assert.equal(diaArgentino(valor), '31/12/1899', valor);
      assert.equal(textoDelCorreo(valor), `Correo enviado el 31/12/1899 a las ${hora}, según Datito.`, valor);
    }
  });

  it('lo que no es un instante da null, sin tirar', () => {
    for (const raro of [null, undefined, '', 'x', NaN, Infinity, {}]) assert.equal(horaArgentina(raro), null, String(raro));
  });

  it('diaArgentino: una fecha tal cual, un instante con su día en Argentina, null «—»', () => {
    assert.equal(diaArgentino('2026-06-30'), '30/06/2026');
    assert.equal(diaArgentino('2026-06-03T03:00:00.000Z'), '03/06/2026');
    assert.equal(diaArgentino('2026-06-03T02:59:59Z'), '02/06/2026');
    assert.equal(diaArgentino('2026-06-03T00:30:00-03:00'), '03/06/2026');
    assert.equal(diaArgentino(null), '—');
    for (const raro of [undefined, '', '2026-02-30', '2026-06-03T25:00:00Z', 'x', 5]) assert.equal(diaArgentino(raro), '—', String(raro));
  });
});

describe('los textos del detalle y de la lista', () => {
  it('la llegada al RPAD, en hora argentina', () => {
    assert.equal(textoDeLlegada(segundosUtc(2026, 10, 23, 11, 14, 2)), 'Llegó al RPAD el 23/11/2026 a las 08:14.');
    assert.equal(textoDeLlegada(null), null);
  });

  it('el correo, con la hora pasada a Argentina, o sin la hora', () => {
    assert.equal(textoDelCorreo('2026-11-23T11:12:00Z'), 'Correo enviado el 23/11/2026 a las 08:12, según Datito.');
    assert.equal(textoDelCorreo('2026-11-23T14:12:00+03:00'), 'Correo enviado el 23/11/2026 a las 08:12, según Datito.');
    assert.equal(textoDelCorreo(edicionDePrueba().correo.enviado_at), 'Correo enviado el 02/11/2026 a las 08:12, según Datito.');
    assert.equal(textoDelCorreo(null), 'Correo enviado según Datito, sin la hora.');
    assert.equal(textoDelCorreo(pilotoDePrueba().correo.enviado_at), 'Correo enviado según Datito, sin la hora.');
    assert.equal(textoDelCorreo('2026-11-23T11:12:00Z', 'enviado'), 'Correo enviado el 23/11/2026 a las 08:12, según Datito.');
  });

  it('el correo no enviado: siempre el mismo texto, cierto aunque el correo salga después', () => {
    assert.equal(textoDelCorreo(null, 'no_enviado'), 'Datito archivó esta edición sin que saliera el correo.');
    assert.equal(textoDelCorreo('2026-11-23T11:12:00Z', 'no_enviado'), 'Datito archivó esta edición sin que saliera el correo.');
  });

  // spec 2026-11-12-dato-quincena-correo, 6 y 14: también en las ediciones ya archivadas, con el nombre de NOMBRE_DEL_BOT
  it('textoDelCorreo dice Datito: las tres frases', () => {
    assert.equal(textoDelCorreo('2026-11-09T11:00:00Z', 'enviado'), 'Correo enviado el 09/11/2026 a las 08:00, según Datito.');
    assert.equal(textoDelCorreo(null, 'enviado'), 'Correo enviado según Datito, sin la hora.');
    assert.equal(textoDelCorreo(null, 'no_enviado'), 'Datito archivó esta edición sin que saliera el correo.');
    for (const texto of [textoDelCorreo('2026-11-09T11:00:00Z'), textoDelCorreo(null), textoDelCorreo(null, 'no_enviado')]) {
      assert.ok(texto.includes(NOMBRE_DEL_BOT), texto);
      assert.doesNotMatch(texto, /Grok/, texto);
    }
  });

  it('la cantidad de propuestas', () => {
    assert.equal(textoDeCantidad(1), '1 propuesta');
    assert.equal(textoDeCantidad(2), '2 propuestas');
    assert.equal(textoDeCantidad(5), '5 propuestas');
  });

  // spec 2026-11-12-dato-quincena-correo, 12: el número de una regular (cuántas regulares hay con su fecha o antes)
  it('el número de edición: «N.º 3»; null si no es un entero positivo', () => {
    assert.equal(textoDelNumero(3), 'N.º 3');
    assert.equal(textoDelNumero(1), 'N.º 1');
    assert.equal(textoDelNumero(27), 'N.º 27');
    for (const raro of [0, -1, 1.5, '3', null, undefined, NaN, Infinity, 2 ** 53, true, [3]]) {
      assert.equal(textoDelNumero(raro), null, String(raro));
    }
  });

  it('el resto de las propuestas de la lista', () => {
    assert.equal(textoDelResto([]), null);
    assert.equal(textoDelResto(['A']), 'Y 1 propuesta más: A.');
    assert.equal(textoDelResto(['A', 'B']), 'Y 2 propuestas más: A y B.');
    assert.equal(textoDelResto(['A', 'B', 'C']), 'Y 3 propuestas más: A, B y C.');
    assert.equal(textoDelResto(['Dataset A', 'Dataset B', 'Dataset C', 'Dataset D']),
      'Y 4 propuestas más: Dataset A, Dataset B, Dataset C y Dataset D.');
  });

  it('el tamaño: en KB redondeado hacia arriba y, desde 1 MB, en MB con un decimal y coma', () => {
    assert.equal(tamanoTexto(99511), '98 KB');
    assert.equal(tamanoTexto(97 * 1024), '97 KB');
    assert.equal(tamanoTexto(1), '1 KB');
    assert.equal(tamanoTexto(1024), '1 KB');
    assert.equal(tamanoTexto(1025), '2 KB');
    assert.equal(tamanoTexto(1024 * 1024 - 1), '1024 KB');
    assert.equal(tamanoTexto(1024 * 1024), '1,0 MB');
    assert.equal(tamanoTexto(1572864), '1,5 MB');
    assert.equal(tamanoTexto(1572865), '1,6 MB');
    assert.equal(tamanoTexto(5 * 1024 * 1024), '5,0 MB');
  });
});

describe('fotoDelDataset', () => {
  const foto = (cambios) => fotoDelDataset({
    estado: 'actualizado', datos_al: '2026-10-31', ultima_actualizacion: '2026-11-05', updated_at: null, dias_para_vencer: 25,
    ...cambios
  });
  const valorDe = (filas, rotulo) => filas.find((f) => f.rotulo === rotulo)?.valor;

  it('el ejemplo de la sección 9', () => {
    assert.deepEqual(foto(), [
      { rotulo: 'En el RPAD ese día:', valor: 'Actualizado' },
      { rotulo: 'Datos al', valor: '31/10/2026' },
      { rotulo: 'Última actualización', valor: '05/11/2026' },
      { rotulo: 'Próxima en', valor: '25 días' }
    ]);
  });

  it('cada estado y null; atrasado y sin-respuesta son «Vencido»', () => {
    const textos = {
      actualizado: 'Actualizado', proximo: 'Próximo a vencer', atrasado: 'Vencido', 'sin-respuesta': 'Vencido',
      'sin-fecha': 'Sin fecha', eventual: 'Eventual'
    };
    for (const [estado, texto] of Object.entries(textos)) assert.equal(valorDe(foto({ estado }), 'En el RPAD ese día:'), texto, estado);
    assert.equal(valorDe(foto({ estado: null }), 'En el RPAD ese día:'), 'Sin dato');
  });

  it('ningún valor ni rótulo dice «Sin respuesta» ni usa las palabras que el sistema evita', () => {
    for (const estado of ['actualizado', 'proximo', 'atrasado', 'sin-respuesta', 'sin-fecha', 'eventual', null]) {
      for (const dias_para_vencer of [25, 1, 0, -1, -3, null]) {
        for (const { rotulo, valor } of foto({ estado, dias_para_vencer })) {
          assert.doesNotMatch(`${rotulo} ${valor}`, PALABRAS_EVITADAS, `${estado} ${dias_para_vencer}`);
        }
      }
    }
  });

  it('los días: 0 o más, «Próxima en»; negativo, «Venció hace»; null, sin la fila', () => {
    assert.deepEqual(foto({ dias_para_vencer: 0 }).at(-1), { rotulo: 'Próxima en', valor: '0 días' });
    assert.deepEqual(foto({ dias_para_vencer: 1 }).at(-1), { rotulo: 'Próxima en', valor: '1 día' });
    assert.deepEqual(foto({ dias_para_vencer: 2 }).at(-1), { rotulo: 'Próxima en', valor: '2 días' });
    assert.deepEqual(foto({ dias_para_vencer: -3 }).at(-1), { rotulo: 'Venció hace', valor: '3 días' });
    assert.deepEqual(foto({ dias_para_vencer: -1 }).at(-1), { rotulo: 'Venció hace', valor: '1 día' });
    assert.deepEqual(foto({ dias_para_vencer: null }).map((f) => f.rotulo), ['En el RPAD ese día:', 'Datos al', 'Última actualización']);
  });

  it('las fechas como AAAA-MM-DD, como instante (su día en Argentina) o null', () => {
    const filas = foto({ datos_al: null, ultima_actualizacion: '2026-06-03T03:00:00.000Z' });
    assert.equal(valorDe(filas, 'Datos al'), '—');
    assert.equal(valorDe(filas, 'Última actualización'), '03/06/2026');
    assert.equal(valorDe(foto({ datos_al: '2026-06-30', ultima_actualizacion: null }), 'Datos al'), '30/06/2026');
    assert.equal(valorDe(foto({ ultima_actualizacion: null }), 'Última actualización'), '—');
  });

  it('la foto de la segunda propuesta de prueba, y la fila del estado siempre va', () => {
    assert.deepEqual(fotoDelDataset(edicionDePrueba().propuestas[1].rpad_snapshot), [
      { rotulo: 'En el RPAD ese día:', valor: 'Próximo a vencer' },
      { rotulo: 'Datos al', valor: '—' },
      { rotulo: 'Última actualización', valor: '03/06/2026' },
      { rotulo: 'Próxima en', valor: '4 días' }
    ]);
    assert.deepEqual(fotoDelDataset({
      estado: null, datos_al: null, ultima_actualizacion: null, updated_at: null, dias_para_vencer: null
    }), [
      { rotulo: 'En el RPAD ese día:', valor: 'Sin dato' },
      { rotulo: 'Datos al', valor: '—' },
      { rotulo: 'Última actualización', valor: '—' }
    ]);
  });
});

describe('textoParaCopiar y borradorParaCopiar', () => {
  // La propuesta del ejemplo de la sección 9 (inventado): la principal de prueba con los valores del ejemplo
  const propuestaDelEjemplo = () => ({
    ...edicionDePrueba().propuestas[0],
    cifra_clave: '1.234 casos · octubre de 2026',
    rpad_snapshot: {
      estado: 'actualizado', datos_al: '2026-10-31', ultima_actualizacion: '2026-11-05', updated_at: '2026-11-05T14:05:00.000Z',
      dias_para_vencer: 25
    },
    calculo: '<calculo>',
    contexto_historico: '<contexto_historico>',
    por_que_hoy: '<por_que_hoy>',
    angulo: '<angulo>',
    idea_placa: '<idea_placa>',
    texto_redes: '<texto_redes>',
    puntos_centrales: ['<punto 1>', '<punto 2>', '<punto 3>'],
    borrador_nota: { titulo: '<título del borrador>', parrafos: ['<párrafo 1>', '<párrafo 2>'] }
  });
  // El ejemplo de la sección 9, renglón por renglón
  const EJEMPLO = [
    'Un título inventado [Principal, Validar]',
    '',
    '1.234 casos · octubre de 2026',
    '',
    'Dataset: Dataset de prueba A',
    'https://datos.ejemplo.gob.ar/dataset/prueba-a',
    '',
    'En el RPAD ese día: Actualizado. Datos al 31/10/2026. Última actualización 05/11/2026. Próxima en 25 días.',
    '',
    'Para validar antes de publicar',
    '- Primera nota.',
    '- Segunda nota.',
    '',
    'Cómo se calculó',
    '<calculo>',
    '',
    'Contexto histórico',
    '<contexto_historico>',
    '',
    'Por qué hoy',
    '<por_que_hoy>',
    '',
    'Ángulo',
    '<angulo>',
    '',
    'Idea de placa',
    '<idea_placa>',
    '',
    'Texto para redes',
    '<texto_redes>',
    '',
    'Puntos centrales',
    '- <punto 1>',
    '- <punto 2>',
    '- <punto 3>',
    '',
    'Borrador de nota',
    '<título del borrador>',
    '',
    '<párrafo 1>',
    '',
    '<párrafo 2>',
    '',
    'Fuentes',
    'https://datos.ejemplo.gob.ar/a.csv',
    'https://datos.ejemplo.gob.ar/b.csv'
  ].join('\n');

  it('la propuesta del ejemplo, entera', () => {
    assert.equal(textoParaCopiar(propuestaDelEjemplo()), EJEMPLO);
  });

  it('sin etiquetas, el título va solo; sin notas de validación, ese bloque no va', () => {
    const texto = textoParaCopiar({ ...propuestaDelEjemplo(), etiquetas: [], notas_validacion: [] });
    assert.equal(texto, EJEMPLO
      .replace('Un título inventado [Principal, Validar]\n', 'Un título inventado\n')
      .replace('Para validar antes de publicar\n- Primera nota.\n- Segunda nota.\n\n', ''));
    assert.doesNotMatch(texto, /[[\]]/);
    assert.doesNotMatch(texto, /Para validar/);
  });

  it('una sola etiqueta, y las notas sin etiquetas', () => {
    const texto = textoParaCopiar({ ...propuestaDelEjemplo(), etiquetas: ['Agenda'] });
    assert.equal(texto, EJEMPLO.replace('[Principal, Validar]', '[Agenda]'));
  });

  it('los textos van tal como llegaron, con sus propios saltos de línea', () => {
    const propuesta = edicionDePrueba().propuestas[0];
    const texto = textoParaCopiar(propuesta);
    assert.ok(texto.includes('\n\nTexto para redes\nUn texto para redes inventado.\nCon un segundo renglón.\n\nPuntos centrales\n'));
    assert.ok(texto.includes(`\n\nBorrador de nota\n${borradorParaCopiar(propuesta.borrador_nota)}\n\nFuentes\n`));
  });

  it('la segunda propuesta de prueba: una etiqueta, sin notas, tres párrafos, una fuente y la foto con un instante', () => {
    assert.equal(textoParaCopiar(edicionDePrueba().propuestas[1]), [
      'Otro título inventado [Agenda]',
      '56 casos · septiembre de 2026',
      'Dataset: Dataset de prueba B\nhttps://datos.ejemplo.gob.ar/dataset/prueba-b',
      'En el RPAD ese día: Próximo a vencer. Datos al —. Última actualización 03/06/2026. Próxima en 4 días.',
      'Cómo se calculó\nOtro cálculo inventado.',
      'Contexto histórico\nOtro contexto inventado.',
      'Por qué hoy\nOtra razón inventada.',
      'Ángulo\nOtro ángulo inventado.',
      'Idea de placa\nOtra placa inventada.',
      'Texto para redes\nOtro texto para redes inventado.',
      'Puntos centrales\n- Un punto.\n- Otro punto.\n- Un tercer punto.',
      'Borrador de nota\nOtro borrador inventado\n\nUn párrafo.\n\nOtro párrafo.\n\nUn tercer párrafo.',
      'Fuentes\nhttps://datos.ejemplo.gob.ar/c.csv'
    ].join('\n\n'));
  });

  // spec 2026-11-14-dato-quincena-v1-3, 3: las etiquetas para mostrar (Efemeride es «Efeméride») y, con repetición, su bloque
  // después del renglón de la foto y antes de «Para validar antes de publicar»
  it('con Efemeride y Repite: el título con las etiquetas para mostrar y el bloque de la repetición después de la foto', () => {
    const propuesta = {
      ...propuestaDelEjemplo(), etiquetas: ['Principal', 'Validar', 'Efemeride', 'Repite'], repeticion: repeticionDePrueba()
    };
    assert.equal(textoParaCopiar(propuesta), EJEMPLO
      .replace('[Principal, Validar]', '[Principal, Validar, Efeméride, Repite]')
      .replace('Próxima en 25 días.\n\n', 'Próxima en 25 días.\n\nRepite el dataset de la edición del 02/11/2026.\n'
        + 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.\n\n'));
    // El tema, por un hecho actual, sin notas de validación: el bloque va antes de «Cómo se calculó», con el detalle tal cual
    const tema = {
      ...propuestaDelEjemplo(), etiquetas: ['Repite'], notas_validacion: [],
      repeticion: repeticionDePrueba({ alcance: 'tema', motivo: 'hecho_actual', fecha_edicion_previa: '2026-10-19', detalle: 'Uno.\nDos.' })
    };
    assert.ok(textoParaCopiar(tema).includes('Próxima en 25 días.\n\nRepite el tema de la edición del 19/10/2026.\nHecho actual: Uno.\nDos.'
      + '\n\nCómo se calculó\n'));
    assert.ok(textoParaCopiar(tema).startsWith('Un título inventado [Repite]\n\n'));
  });

  it('sin repetición (sin la clave o con null), el texto de siempre', () => {
    assert.equal(textoParaCopiar({ ...propuestaDelEjemplo(), repeticion: null }), EJEMPLO);
    assert.equal(textoParaCopiar({ ...propuestaDelEjemplo(), etiquetas: ['Principal', 'Efemeride'] }),
      EJEMPLO.replace('[Principal, Validar]', '[Principal, Efeméride]'));
  });

  it('no cambia la propuesta', () => {
    const propuesta = propuestaDelEjemplo();
    const copia = structuredClone(propuesta);
    textoParaCopiar(propuesta);
    assert.deepEqual(propuesta, copia);
    const conRepeticion = { ...propuestaDelEjemplo(), etiquetas: ['Efemeride', 'Repite'], repeticion: repeticionDePrueba() };
    const otraCopia = structuredClone(conRepeticion);
    textoParaCopiar(conRepeticion);
    assert.deepEqual(conRepeticion, otraCopia);
  });

  it('el borrador: el título y sus párrafos, separados por un renglón en blanco', () => {
    assert.equal(borradorParaCopiar({ titulo: 'Un título', parrafos: ['Uno.', 'Dos.'] }), 'Un título\n\nUno.\n\nDos.');
    assert.equal(borradorParaCopiar({ titulo: 'Un título', parrafos: ['Uno.\nCon dos renglones.', 'Dos.', 'Tres.'] }),
      'Un título\n\nUno.\nCon dos renglones.\n\nDos.\n\nTres.');
  });
});

describe('filasDeLaEdicion y avisosDeLaEdicion', () => {
  it('una fila por propuesta, en su orden, con principal 1 en la que lleva la etiqueta', () => {
    assert.deepEqual(filasDeLaEdicion(edicionDePrueba()), [
      {
        orden: 1, titulo: 'Un título inventado', cifra_clave: '1.234 casos · septiembre de 2026', principal: 1, rpad_id: 1,
        dataset_nombre: 'Dataset de prueba A'
      },
      {
        orden: 2, titulo: 'Otro título inventado', cifra_clave: '56 casos · septiembre de 2026', principal: 0, rpad_id: 2,
        dataset_nombre: 'Dataset de prueba B'
      }
    ]);
  });

  it('un rpad_id null queda null, y la principal puede no ser la primera', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[0].etiquetas = ['Validar'];
    edicion.propuestas[1].etiquetas = ['Agenda', 'Principal'];
    edicion.propuestas[1].dataset.rpad_id = null;
    assert.deepEqual(filasDeLaEdicion(edicion).map(({ orden, principal, rpad_id }) => ({ orden, principal, rpad_id })), [
      { orden: 1, principal: 0, rpad_id: 1 },
      { orden: 2, principal: 1, rpad_id: null }
    ]);
  });

  it('sin avisos si cada dataset citado quedó enlazado', () => {
    assert.deepEqual(avisosDeLaEdicion(edicionDePrueba(), [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: 2 }]), []);
  });

  it('un aviso por cada dataset citado que no está en el RPAD, en el orden de las propuestas', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[1].dataset.rpad_id = 999;
    assert.deepEqual(avisosDeLaEdicion(edicion, [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: null }]),
      ['La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.']);
    assert.deepEqual(avisosDeLaEdicion(edicion, [{ orden: 2, dataset_id: null }, { orden: 1, dataset_id: null }]), [
      'La propuesta 1 cita el dataset 1, que no está en el RPAD: se guardó sin enlace.',
      'La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.'
    ]);
  });

  it('una propuesta sin rpad_id no da aviso', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[1].dataset.rpad_id = null;
    assert.deepEqual(avisosDeLaEdicion(edicion, [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: null }]), []);
  });

  it('los avisos no usan las palabras que el sistema evita', () => {
    for (const aviso of avisosDeLaEdicion(edicionDePrueba(), [])) assert.doesNotMatch(aviso, PALABRAS_EVITADAS);
  });
});

// spec 2026-11-14-dato-quincena-v1-3, 2: lo que depende de lo archivado nunca da un 422, da un aviso. La edición de la quincena
// siguiente (16/11) vuelve sobre la de prueba (02/11), que está en el RPAD con el id 12 y cita los datasets 1 y 2
describe('fechasPrevias y los avisos de la repetición', () => {
  const FECHA = '2026-11-16';
  // La edición del 16/11 con la propuesta i repitiendo, con los cambios de su repetición
  const conRepeticion = (repeticiones) => {
    const edicion = edicionDePrueba({ fecha_edicion: FECHA });
    for (const [i, cambios] of Object.entries(repeticiones)) {
      edicion.propuestas[i].etiquetas.push('Repite');
      edicion.propuestas[i].repeticion = repeticionDePrueba(cambios);
    }
    return edicion;
  };
  const ENLAZADAS = Object.freeze([{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: 2 }]);
  const PREVIAS = new Map([[FECHA_DE_PRUEBA, { id: 12, rpad_ids: [1, 2] }]]);

  it('fechasPrevias: las de las repeticiones anteriores a la edición, sin repetir, en el orden de las propuestas', () => {
    assert.deepEqual(fechasPrevias(edicionDePrueba()), []);
    assert.deepEqual(fechasPrevias(conRepeticion({ 0: {}, 1: {} })), [FECHA_DE_PRUEBA]);
    assert.deepEqual(fechasPrevias(conRepeticion({ 0: { fecha_edicion_previa: '2026-11-09' }, 1: {} })), ['2026-11-09', FECHA_DE_PRUEBA]);
    // La misma fecha de la edición o una posterior no se busca; null tampoco
    assert.deepEqual(fechasPrevias(conRepeticion({ 0: { fecha_edicion_previa: FECHA }, 1: { fecha_edicion_previa: '2026-11-30' } })), []);
    const conNull = edicionDePrueba({ fecha_edicion: FECHA });
    conNull.propuestas[1].repeticion = null;
    assert.deepEqual(fechasPrevias(conNull), []);
  });

  it('sin aviso: la edición previa está, es anterior y cita el dataset; o el alcance es el tema; o la propuesta no cita dataset', () => {
    assert.deepEqual(avisosDeLaEdicion(conRepeticion({ 0: {}, 1: {} }), ENLAZADAS, PREVIAS), []);
    const otro = conRepeticion({ 1: { alcance: 'tema' } });
    otro.propuestas[1].dataset.rpad_id = 999;
    assert.deepEqual(avisosDeLaEdicion(otro, [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: null }], PREVIAS),
      ['La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.']);
    const sinDataset = conRepeticion({ 1: {} });
    sinDataset.propuestas[1].dataset.rpad_id = null;
    assert.deepEqual(avisosDeLaEdicion(sinDataset, [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: null }], PREVIAS), []);
  });

  it('1. una fecha igual o posterior a la de la edición: «no es anterior a esta», aunque esa edición esté en el RPAD', () => {
    const misma = conRepeticion({ 1: { fecha_edicion_previa: FECHA } });
    const previas = new Map([[FECHA, { id: 14, rpad_ids: [1, 2] }]]);
    assert.deepEqual(avisosDeLaEdicion(misma, ENLAZADAS, previas),
      ['La propuesta 2 repite la edición del 16/11/2026, que no es anterior a esta: se guardó sin enlace.']);
    assert.deepEqual(avisosDeLaEdicion(conRepeticion({ 0: { fecha_edicion_previa: '2026-11-30' } }), ENLAZADAS, PREVIAS),
      ['La propuesta 1 repite la edición del 30/11/2026, que no es anterior a esta: se guardó sin enlace.']);
  });

  it('2. sin una edición regular de esa fecha en el RPAD: «no está en el RPAD»', () => {
    assert.deepEqual(avisosDeLaEdicion(conRepeticion({ 0: { fecha_edicion_previa: '2026-10-19', alcance: 'tema' } }), ENLAZADAS, PREVIAS),
      ['La propuesta 1 repite la edición del 19/10/2026, que no está en el RPAD: se guardó sin enlace.']);
  });

  it('3. con el dataset como alcance y una edición que no lo cita: «esa edición no lo tiene»', () => {
    const edicion = conRepeticion({ 1: {} });
    edicion.propuestas[1].dataset.rpad_id = 3;
    const guardadas = [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: 3 }];
    assert.deepEqual(avisosDeLaEdicion(edicion, guardadas, PREVIAS),
      ['La propuesta 2 repite el dataset 3 de la edición del 02/11/2026, pero esa edición no lo tiene.']);
    // Una edición previa sin propuestas que citen datasets
    assert.deepEqual(avisosDeLaEdicion(conRepeticion({ 0: {} }), ENLAZADAS, new Map([[FECHA_DE_PRUEBA, { id: 12, rpad_ids: [] }]])),
      ['La propuesta 1 repite el dataset 1 de la edición del 02/11/2026, pero esa edición no lo tiene.']);
  });

  it('el orden: por propuesta, primero el del dataset y después el de la repetición', () => {
    const edicion = conRepeticion({ 0: { fecha_edicion_previa: '2026-10-19' }, 1: {} });
    edicion.propuestas[0].dataset.rpad_id = 998;
    edicion.propuestas[1].dataset.rpad_id = 999;
    assert.deepEqual(avisosDeLaEdicion(edicion, [{ orden: 1, dataset_id: null }, { orden: 2, dataset_id: null }], PREVIAS), [
      'La propuesta 1 cita el dataset 998, que no está en el RPAD: se guardó sin enlace.',
      'La propuesta 1 repite la edición del 19/10/2026, que no está en el RPAD: se guardó sin enlace.',
      'La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.',
      'La propuesta 2 repite el dataset 999 de la edición del 02/11/2026, pero esa edición no lo tiene.'
    ]);
  });

  it('sin previas, como si no hubiera ediciones previas: el caso 1 se sabe igual', () => {
    const edicion = conRepeticion({ 0: {}, 1: { fecha_edicion_previa: FECHA } });
    const esperados = [
      'La propuesta 1 repite la edición del 02/11/2026, que no está en el RPAD: se guardó sin enlace.',
      'La propuesta 2 repite la edición del 16/11/2026, que no es anterior a esta: se guardó sin enlace.'
    ];
    assert.deepEqual(avisosDeLaEdicion(edicion, ENLAZADAS), esperados);
    assert.deepEqual(avisosDeLaEdicion(edicion, ENLAZADAS, new Map()), esperados);
  });

  // Si las ediciones previas no se pudieron leer (null, lo que da edicionesPreviasSinFallar), el recibo no dice nada de las
  // repeticiones, ni siquiera el caso 1: un aviso que dependa de lo archivado podría ser falso, y la edición ya se guardó
  it('con previas null (no se pudieron leer): solo los avisos del dataset, sin ninguno de la repetición', () => {
    const edicion = conRepeticion({ 0: { fecha_edicion_previa: '2026-10-19' }, 1: { fecha_edicion_previa: FECHA } });
    edicion.propuestas[1].dataset.rpad_id = 999;
    const guardadas = [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: null }];
    assert.deepEqual(avisosDeLaEdicion(edicion, guardadas, null),
      ['La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.']);
    assert.deepEqual(avisosDeLaEdicion(conRepeticion({ 0: {}, 1: {} }), ENLAZADAS, null), []);
    // Con un Map, los de siempre
    assert.equal(avisosDeLaEdicion(edicion, guardadas, PREVIAS).length, 3);
  });

  it('una edición v1.2 da los avisos de siempre, con previas o sin ellas', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[1].dataset.rpad_id = 999;
    const esperados = ['La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.'];
    assert.deepEqual(avisosDeLaEdicion(edicion, [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: null }]), esperados);
    assert.deepEqual(avisosDeLaEdicion(edicion, [{ orden: 1, dataset_id: 1 }, { orden: 2, dataset_id: null }], PREVIAS), esperados);
  });

  it('los avisos no usan las palabras que el sistema evita y no cambian lo que reciben', () => {
    const edicion = conRepeticion({ 0: { fecha_edicion_previa: '2026-10-19' }, 1: { fecha_edicion_previa: FECHA } });
    const antes = structuredClone(edicion);
    const avisos = avisosDeLaEdicion(edicion, ENLAZADAS, PREVIAS);
    assert.equal(avisos.length, 2);
    for (const aviso of avisos) assert.doesNotMatch(aviso, PALABRAS_EVITADAS);
    assert.deepEqual(edicion, antes);
    assert.deepEqual([...PREVIAS], [[FECHA_DE_PRUEBA, { id: 12, rpad_ids: [1, 2] }]]);
  });
});

describe('reciboDe', () => {
  const edicion = {
    id: 12, clave: 'dq:regular:2026-11-23', tipo: 'regular', fecha_edicion: '2026-11-23', huella: 'a'.repeat(64),
    recibida_ts: segundosUtc(2026, 10, 23, 11, 14, 2)
  };
  const infografia = { campo: 'infografia_png', bytes: 98000, sha256: 'b'.repeat(64) };
  const correo = { campo: 'correo_texto', bytes: 17000, sha256: 'c'.repeat(64) };
  const calculos = { campo: 'calculos', bytes: 3000, sha256: 'd'.repeat(64) };

  // El envío (spec 2026-11-12-dato-quincena-correo, 11), el de envioDelRecibo: una regular del lunes 23/11/2026 (feriado en la
  // precarga) que llegó a las 8:14, programada para el martes a las 8:05
  const ENVIO = envioDelRecibo({
    tipo: 'regular', fecha_edicion: '2026-11-23', correo: { estado: 'programada', motivo: null, enviada_at: null }, envios: [],
    envioActivo: true, ahora: '2026-11-23 08:14:02', calendario: calendarioCon(FILAS_PRECARGA)
  });

  it('todas sus claves, en el orden de la sección 7, con el envío al final', () => {
    assert.deepEqual(ENVIO, {
      estado: 'programada', programado_at: '2026-11-24T08:05:00-03:00', texto: 'Se envía el martes 24/11/2026 a las 8:05.'
    });
    const recibo = reciboDe(edicion, [infografia, correo], [], false, ENVIO);
    assert.deepEqual(recibo, {
      id: 12, clave: 'dq:regular:2026-11-23', tipo: 'regular', fecha_edicion: '2026-11-23', huella: 'a'.repeat(64),
      recibida_at: '2026-11-23T08:14:02-03:00', repetida: false, adjuntos: [infografia, correo],
      url: `${RPAD_URL}/dato-quincena.html?id=12`, avisos: [], envio: ENVIO
    });
    assert.deepEqual(Object.keys(recibo), [
      'id', 'clave', 'tipo', 'fecha_edicion', 'huella', 'recibida_at', 'repetida', 'adjuntos', 'url', 'avisos', 'envio'
    ]);
    assert.deepEqual(Object.keys(recibo.envio), ['estado', 'programado_at', 'texto']);
    assert.match(recibo.url, /^https?:\/\/[^/]+\/dato-quincena\.html\?id=12$/);
  });

  it('sin envío (una regular archivada antes, sin fila de correo), envio null: la clave va igual', () => {
    for (const envio of [null, undefined]) {
      const recibo = reciboDe(edicion, [infografia, correo], [], false, envio);
      assert.equal(recibo.envio, null, String(envio));
      assert.equal(Object.keys(recibo).at(-1), 'envio');
    }
  });

  it('los adjuntos en el orden de ARCHIVOS y solo con campo, bytes y sha256', () => {
    const conMas = (adjunto) => ({ ...adjunto, nombre: 'x.txt', mime: 'text/plain', contenido: Buffer.from('x') });
    const recibo = reciboDe(edicion, [conMas(calculos), conMas(correo), conMas(infografia)], [], false);
    assert.deepEqual(recibo.adjuntos, [infografia, correo, calculos]);
    // El SVG, al final, aunque haya llegado primero
    const svg = { campo: 'infografia_svg', bytes: 7000, sha256: 'e'.repeat(64) };
    assert.deepEqual(reciboDe(edicion, [conMas(svg), conMas(correo), conMas(infografia)], [], false).adjuntos,
      [infografia, correo, svg]);
  });

  it('una repetida con sus avisos', () => {
    const avisos = ['La propuesta 3 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.'];
    const recibo = reciboDe(edicion, [infografia, correo], avisos, true);
    assert.equal(recibo.repetida, true);
    assert.deepEqual(recibo.avisos, avisos);
  });

  it('un piloto', () => {
    const recibo = reciboDe({ ...edicion, id: 7, clave: 'dq:piloto:2026-11-23:piloto-4', tipo: 'piloto' }, [infografia, correo], [], false);
    assert.equal(recibo.clave, 'dq:piloto:2026-11-23:piloto-4');
    assert.equal(recibo.tipo, 'piloto');
    assert.equal(recibo.url, `${RPAD_URL}/dato-quincena.html?id=7`);
  });
});

// Las lecturas (sección 9): la lista y el detalle, contra las respuestas inventadas que lee la página
const RESPUESTAS = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-respuestas.json', import.meta.url), 'utf8'));

// Las claves de cada objeto, en su orden, a cualquier profundidad: deepEqual no mira el orden
const ordenDeLasClaves = (valor) => {
  if (Array.isArray(valor)) return valor.map(ordenDeLasClaves);
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).map(([clave, hijo]) => [clave, ordenDeLasClaves(hijo)]);
  }
  return null;
};

describe('anioDeLaLista', () => {
  it('sin año, válido y null: la lista toma el más reciente', () => {
    assert.deepEqual(anioDeLaLista(undefined), { valido: true, anio: null });
  });

  it('un entero de 2000 a 2100 con cuatro cifras, ese año', () => {
    for (const anio of [2000, 2026, 2027, 2100]) assert.deepEqual(anioDeLaLista(String(anio)), { valido: true, anio });
  });

  it('otra cosa no es válida: fuera del rango, letras, vacío, con signo, con decimales, con espacios, repetido u objeto', () => {
    for (const valor of ['1999', '2101', '0000', '9999', 'abc', '', '+2026', '-2026', '2026.0', '2e3', ' 2026', '2026 ', '02026',
      '0x7EA', ['2026', '2027'], { anio: '2026' }, 2026, null]) {
      assert.deepEqual(anioDeLaLista(valor), { valido: false, anio: null }, JSON.stringify(valor));
    }
  });
});

describe('nombreDeLaEdicion y TIPO_DE_DESCARGA', () => {
  it('el nombre de la edición completa: la clave sin dq: y con - en lugar de :', () => {
    assert.equal(nombreDeLaEdicion('dq:regular:2026-11-02'), 'dato-quincena-regular-2026-11-02.json');
    assert.equal(nombreDeLaEdicion('dq:piloto:2026-11-02:piloto-4'), 'dato-quincena-piloto-2026-11-02-piloto-4.json');
  });

  it('el Content-Type fijo de cada descarga: el texto y los cálculos, como texto en UTF-8; el SVG, image/svg+xml', () => {
    assert.deepEqual({ ...TIPO_DE_DESCARGA }, {
      infografia_png: 'image/png',
      infografia_svg: 'image/svg+xml',
      correo_texto: 'text/plain; charset=utf-8',
      calculos: 'text/plain; charset=utf-8',
      metadata: 'application/json; charset=utf-8'
    });
    assert.ok(Object.isFrozen(TIPO_DE_DESCARGA));
  });
});

// Una fila de listarEdiciones: la primera propuesta es la principal (la del fixture) y las demás, una por nombre. numero, el de
// la consulta: cuántas regulares hay con esa fecha o antes (null en un piloto)
const filaDeLaLista = (id, tipo, fecha_edicion, referencia_piloto, nombres, numero = null) => ({
  id,
  tipo,
  fecha_edicion,
  referencia_piloto,
  numero,
  propuestas: nombres.map((dataset_nombre, i) => (i === 0
    ? { orden: 1, titulo: 'Un título inventado', cifra_clave: '1.234 casos · septiembre de 2026', principal: true, dataset_nombre }
    : { orden: i + 1, titulo: `Otro título ${i + 1}`, cifra_clave: `${i + 1} casos`, principal: false, dataset_nombre }))
});

// La pastilla del envío de cada edición de las respuestas de la página (spec 2026-11-12-dato-quincena-correo, 6), armada con
// pastillaDelEnvio para quien no es de administración, con el calendario de la precarga: la del 16/11, que el RPAD mandó ese
// lunes a las 8:05; el piloto 4; la del 02/11, archivada con el envío automático apagado y con el correo de Datito (la de la
// transición, como la guarda tests/dato-quincena-api.test.js); y la de enero de 2027, que espera la corrida de las 8:05 de ese
// lunes
const pastillaDe = (cambios) => pastillaDelEnvio({
  tipo: 'regular', correo: null, envios: [], reenvios: [], lista: [], correoDelBot: null, envioActivo: true,
  ahora: '2026-11-20 10:00:00', calendario: calendarioCon(FILAS_PRECARGA), admin: false, ...cambios
});
const PASTILLAS = Object.freeze({
  14: pastillaDe({
    fecha_edicion: '2026-11-16', correo: { estado: 'enviada', motivo: null, enviada_at: '2026-11-16 08:05:12' },
    envios: [{ usuario_id: 1, tipo: 'automatico', estado: 'enviado', intentos: 1, enviado_at: '2026-11-16 08:05:12' }]
  }),
  13: pastillaDe({ tipo: 'piloto', fecha_edicion: '2026-11-02' }),
  12: pastillaDe({
    fecha_edicion: '2026-11-02', correo: { estado: 'no_enviada', motivo: 'apagado', enviada_at: null }, envioActivo: false,
    correoDelBot: edicionDePrueba().correo
  }),
  15: pastillaDe({
    fecha_edicion: '2027-01-11', correo: { estado: 'programada', motivo: null, enviada_at: null }, ahora: '2027-01-11 07:40:00'
  })
});

describe('itemDeLaLista', () => {
  it('las ediciones de las respuestas de la página, con las claves en su orden y la pastilla del envío al final', () => {
    assert.deepEqual({ ...PASTILLAS }, {
      14: { tipo: 'enviada', texto: 'Enviada el lun 16/11' },
      13: { tipo: 'piloto', texto: 'Piloto: no se envía' },
      12: { tipo: 'enviada', texto: 'Enviada por Datito el lun 02/11' },
      15: { tipo: 'programada', texto: 'Sale hoy a las 8:05' }
    });
    const items = [
      filaDeLaLista(14, 'regular', '2026-11-16', null, ['Dataset de prueba A', 'Dataset de prueba B', 'Dataset de prueba C'], 2),
      filaDeLaLista(13, 'piloto', '2026-11-02', 'piloto-4', ['Dataset de prueba A']),
      filaDeLaLista(12, 'regular', '2026-11-02', null, ['Dataset de prueba A', 'Dataset de prueba B'], 1)
    ].map((fila) => itemDeLaLista(fila, PASTILLAS[fila.id]));
    assert.deepEqual(items, RESPUESTAS.lista.data.ediciones);
    assert.deepEqual(ordenDeLasClaves(items), ordenDeLasClaves(RESPUESTAS.lista.data.ediciones));
    assert.deepEqual(items, RESPUESTAS.lista_dos_anios.data.ediciones);
    assert.deepEqual(ordenDeLasClaves(items), ordenDeLasClaves(RESPUESTAS.lista_dos_anios.data.ediciones));

    const deEnero = itemDeLaLista(
      filaDeLaLista(15, 'regular', '2027-01-11', null, ['Dataset de prueba A', 'Dataset de prueba B'], 3), PASTILLAS[15]
    );
    assert.deepEqual(deEnero, RESPUESTAS.lista_de_2027.data.ediciones[0]);
    assert.deepEqual(ordenDeLasClaves(deEnero), ordenDeLasClaves(RESPUESTAS.lista_de_2027.data.ediciones[0]));
  });

  // spec 2026-11-12-dato-quincena-correo, 12: la pastilla la arma el controlador (pastillaDelEnvio, con lo de quien pide) y la
  // lista la pone tal cual; una edición sin pastilla (sin envío del RPAD y sin el correo del bot), null
  it('el envío: la pastilla que recibe, al final; sin ella, null', () => {
    const fila = filaDeLaLista(16, 'regular', '2026-11-09', null, ['A'], 3);
    const pastilla = { tipo: 'parcial', texto: 'Enviada a 3 de 4' };
    const item = itemDeLaLista(fila, pastilla);
    assert.deepEqual(item.envio, pastilla);
    assert.equal(Object.keys(item).at(-1), 'envio');
    for (const sin of [null, undefined]) {
      const otro = itemDeLaLista(fila, sin);
      assert.equal(otro.envio, null, String(sin));
      assert.equal(Object.keys(otro).at(-1), 'envio');
    }
    assert.equal(itemDeLaLista(fila).envio, null);
  });

  // spec 2026-11-12-dato-quincena-correo, 12: lo que lleva la tarjeta, con los textos ya armados
  it('el número, las partes de la fecha y la cantidad de propuestas', () => {
    const item = itemDeLaLista(filaDeLaLista(16, 'regular', '2026-11-09', null, ['A', 'B', 'C', 'D'], 3));
    assert.equal(item.numero, 'N.º 3');
    assert.deepEqual(item.fecha_partes, { dia: 'Lunes', fecha: '9 de noviembre', anio: 'de 2026' });
    assert.equal(item.cantidad, '4 propuestas');
    assert.equal(itemDeLaLista(filaDeLaLista(17, 'regular', '2026-11-23', null, ['A'], 4)).cantidad, '1 propuesta');
    assert.deepEqual(itemDeLaLista(filaDeLaLista(18, 'regular', '2027-01-01', null, ['A'], 5)).fecha_partes,
      { dia: 'Viernes', fecha: '1 de enero', anio: 'de 2027' });
    assert.deepEqual(itemDeLaLista(filaDeLaLista(19, 'regular', '2026-12-09', null, ['A'], 6)).fecha_partes,
      { dia: 'Miércoles', fecha: '9 de diciembre', anio: 'de 2026' });
  });

  it('el número: null en un piloto aunque la consulta traiga uno, y null si la fila no trae un entero positivo', () => {
    assert.equal(itemDeLaLista(filaDeLaLista(13, 'piloto', '2026-11-02', 'piloto-4', ['A'], 2)).numero, null);
    for (const numero of [null, undefined, 0, -1, '3', 1.5]) {
      assert.equal(itemDeLaLista(filaDeLaLista(12, 'regular', '2026-11-02', null, ['A'], numero)).numero, null, String(numero));
    }
    const { numero, ...sinNumero } = filaDeLaLista(12, 'regular', '2026-11-02', null, ['A'], 1);
    assert.equal(numero, 1);
    assert.equal(itemDeLaLista(sinNumero).numero, null);
  });

  it('una fecha que no existe (solo con un SQL a mano): sin partes, como fecha_texto da «—»', () => {
    const item = itemDeLaLista(filaDeLaLista(20, 'regular', '2026-02-30', null, ['A'], 1));
    assert.equal(item.fecha_texto, '—');
    assert.equal(item.fecha_partes, null);
  });

  it('la principal puede no ser la primera: el resto nombra las demás, en su orden aunque lleguen en otro', () => {
    const propuesta = (orden, principal) => ({
      orden, titulo: `Título ${orden}`, cifra_clave: `${orden} casos`, principal, dataset_nombre: `Dataset ${orden}`
    });
    const fila = {
      id: 3, tipo: 'regular', fecha_edicion: '2026-11-23', referencia_piloto: null,
      propuestas: [propuesta(4, false), propuesta(1, false), propuesta(2, true), propuesta(5, false), propuesta(3, false)]
    };
    assert.deepEqual(itemDeLaLista(fila), {
      id: 3,
      fecha_texto: 'Lunes 23 de noviembre de 2026',
      marca: null,
      principal: { titulo: 'Título 2', cifra_clave: '2 casos' },
      resto: 'Y 4 propuestas más: Dataset 1, Dataset 3, Dataset 4 y Dataset 5.',
      numero: null,
      fecha_partes: { dia: 'Lunes', fecha: '23 de noviembre', anio: 'de 2026' },
      cantidad: '5 propuestas',
      envio: null
    });
  });

  it('el mismo dataset en dos propuestas se nombra dos veces: el resto cuenta propuestas', () => {
    const fila = filaDeLaLista(4, 'regular', '2026-11-23', null, ['Dataset A', 'Dataset B', 'Dataset B']);
    assert.equal(itemDeLaLista(fila).resto, 'Y 2 propuestas más: Dataset B y Dataset B.');
  });

  it('sin ninguna marcada como principal (el POST no lo deja pasar), la primera', () => {
    const fila = filaDeLaLista(5, 'piloto', '2026-11-23', 'piloto-12', ['Dataset A', 'Dataset B']);
    fila.propuestas[0].principal = false;
    const item = itemDeLaLista(fila);
    assert.deepEqual(item.principal, { titulo: 'Un título inventado', cifra_clave: '1.234 casos · septiembre de 2026' });
    assert.equal(item.resto, 'Y 1 propuesta más: Dataset B.');
    assert.equal(item.marca, 'Piloto 12');
  });

  it('sin propuestas (solo con un SQL a mano), principal y resto null, sin tirar', () => {
    assert.deepEqual(itemDeLaLista(filaDeLaLista(6, 'regular', '2026-11-23', null, [], 2)), {
      id: 6, fecha_texto: 'Lunes 23 de noviembre de 2026', marca: null, principal: null, resto: null, numero: 'N.º 2',
      fecha_partes: { dia: 'Lunes', fecha: '23 de noviembre', anio: 'de 2026' }, cantidad: '0 propuestas', envio: null
    });
  });

  it('no cambia la fila', () => {
    const fila = filaDeLaLista(14, 'regular', '2026-11-16', null, ['Dataset A', 'Dataset B', 'Dataset C']);
    fila.propuestas.reverse();
    const antes = structuredClone(fila);
    itemDeLaLista(fila);
    assert.deepEqual(fila, antes);
  });
});

describe('detalleDeLaEdicion', () => {
  // La edición de prueba con una efeméride en la agenda (después del evento de prueba, que no trae tipo) y con el SVG, como la
  // guarda el POST (metadata, el texto de partesDePrueba), con el id 12 de las respuestas de la página, la primera regular
  // (numero 1, el de la consulta), recibida el 02/11/2026 a las 08:14 en Argentina; el dataset 1 activo y el 2 dado de baja
  const edicionDelDetalle = () => edicionDePrueba({ agenda: [...edicionDePrueba().agenda, efemerideDePrueba()] });
  const metadata = partesDePrueba(edicionDelDetalle(), { infografia_svg: svgDePrueba() }).metadata.toString('utf8');
  const filaDePrueba = (cambios = {}) => ({
    id: 12, clave: 'dq:regular:2026-11-02', tipo: 'regular', fecha_edicion: '2026-11-02', referencia_piloto: null,
    titulo: 'El dato de la quincena: edición de prueba', metadata, recibida_ts: segundosUtc(2026, 10, 2, 11, 14, 0), numero: 1,
    ...cambios
  });
  const GUARDADAS = Object.freeze([
    { orden: 1, dataset_id: 1, dataset_activo: true }, { orden: 2, dataset_id: 2, dataset_activo: false }
  ]);
  const adjuntosDe = (edicion) => edicion.adjuntos.map(({ campo, nombre, mime, bytes }) => ({ campo, nombre, mime, bytes }));
  const detalle = ({ fila = filaDePrueba(), edicion = JSON.parse(fila.metadata), guardadas = GUARDADAS, adjuntos, linea, previas } = {}) =>
    detalleDeLaEdicion({ fila, edicion, guardadas, adjuntos: adjuntos ?? adjuntosDe(edicion), lineaDelCorreo: linea, previas });

  // La línea del correo de la edición de prueba (spec 2026-11-12-dato-quincena-correo, 6), la que arma el controlador: archivada
  // con el envío automático apagado y con el correo de Datito, muestra el del bot (la transición)
  const lineaDePrueba = (cambios = {}) => lineaDelCorreo({
    tipo: 'regular', fecha_edicion: '2026-11-02', correo: { estado: 'no_enviada', motivo: 'apagado', enviada_at: null },
    envios: [], reenvios: [], lista: [], correoDelBot: edicionDePrueba().correo, envioActivo: false,
    ahora: '2026-11-12 10:00:00', calendario: calendarioCon(FILAS_PRECARGA), ...cambios
  });

  it('la edición de prueba da el detalle de las respuestas de la página, entero y con las claves en su orden', () => {
    const d = detalle({ linea: lineaDePrueba() });
    assert.deepEqual(d, RESPUESTAS.detalle.data);
    assert.deepEqual(ordenDeLasClaves(d), ordenDeLasClaves(RESPUESTAS.detalle.data));
  });

  // spec 2026-11-12-dato-quincena-correo, 6 y 12: la línea la arma el controlador con lineaDelCorreo (el envío del RPAD) y el
  // detalle la pone tal cual. Sin ella (el modelo del mail no la usa), la del bot, como antes de esta entrega
  it('la línea del correo: la que recibe, tal cual; sin ella, la del correo del bot', () => {
    const programada = lineaDePrueba({
      fecha_edicion: '2026-11-23', correo: { estado: 'programada', motivo: null, enviada_at: null }, envioActivo: true,
      ahora: '2026-11-23 07:40:00'
    });
    assert.equal(programada, 'Se envía el martes 24/11/2026 a las 8:05.');
    assert.equal(detalle({ linea: programada }).correo, programada);
    const apagado = lineaDePrueba({ correoDelBot: { estado: 'no_enviado', enviado_at: null } });
    assert.equal(apagado, 'No se envió: el envío automático estaba apagado.');
    assert.equal(detalle({ linea: apagado }).correo, apagado);
    assert.equal(detalle({ linea: 'Los pilotos no se envían por correo.' }).correo, 'Los pilotos no se envían por correo.');
    assert.equal(detalle().correo, 'Correo enviado el 02/11/2026 a las 08:12, según Datito.');
    assert.deepEqual(Object.keys(detalle({ linea: programada })), Object.keys(RESPUESTAS.detalle.data));
  });

  it('cada propuesta trae para_copiar y borrador_para_copiar armados por textoParaCopiar y borradorParaCopiar', () => {
    const edicion = edicionDePrueba();
    const d = detalle();
    assert.deepEqual(d.propuestas.map((p) => p.para_copiar), edicion.propuestas.map(textoParaCopiar));
    assert.deepEqual(d.propuestas.map((p) => p.borrador_para_copiar),
      edicion.propuestas.map((p) => borradorParaCopiar(p.borrador_nota)));
    assert.deepEqual(d.propuestas.map((p) => p.foto), edicion.propuestas.map((p) => fotoDelDataset(p.rpad_snapshot)));
  });

  it('id_enlace: el id solo si el dataset existe y está activo; el nombre y la dirección, siempre como llegaron', () => {
    const casos = [
      [{ orden: 1, dataset_id: 1, dataset_activo: true }, 1],
      [{ orden: 1, dataset_id: 1, dataset_activo: false }, null],
      [{ orden: 1, dataset_id: null, dataset_activo: false }, null]
    ];
    for (const [guardada, idEnlace] of casos) {
      const d = detalle({ guardadas: [guardada, { orden: 2, dataset_id: 2, dataset_activo: true }] });
      assert.deepEqual(d.propuestas[0].dataset, {
        nombre: 'Dataset de prueba A', id_enlace: idEnlace, url: 'https://datos.ejemplo.gob.ar/dataset/prueba-a'
      }, JSON.stringify(guardada));
      assert.equal(d.propuestas[1].dataset.id_enlace, 2);
    }
    // Sin su fila guardada, tampoco
    assert.equal(detalle({ guardadas: [] }).propuestas[0].dataset.id_enlace, null);
  });

  it('los archivos, en su orden aunque los adjuntos lleguen en otro: el SVG después de la infografía; sin cálculos ni SVG, tres', () => {
    const edicion = JSON.parse(metadata);
    const alReves = adjuntosDe(edicion).reverse();
    assert.deepEqual(alReves.map((a) => a.campo), ['infografia_svg', 'calculos', 'correo_texto', 'infografia_png']);
    assert.deepEqual(detalle({ adjuntos: alReves }).archivos, RESPUESTAS.detalle.data.archivos);
    assert.deepEqual(RESPUESTAS.detalle.data.archivos.map((a) => a.campo),
      ['infografia_png', 'infografia_svg', 'correo_texto', 'calculos', 'metadata']);
    assert.deepEqual(RESPUESTAS.detalle.data.archivos[1], {
      campo: 'infografia_svg', rotulo: 'Infografía editable', nombre: 'infografia-prueba.svg', detalle: 'SVG · 1 KB',
      se_puede_ver: false
    });

    const sinCalculos = adjuntosDe(edicion).filter((a) => a.campo !== 'calculos');
    assert.deepEqual(detalle({ adjuntos: sinCalculos }).archivos.map((a) => a.campo),
      ['infografia_png', 'infografia_svg', 'correo_texto', 'metadata']);
    const sinSvg = adjuntosDe(edicion).filter((a) => a.campo !== 'infografia_svg');
    assert.deepEqual(detalle({ adjuntos: sinSvg }).archivos.map((a) => a.campo),
      ['infografia_png', 'correo_texto', 'calculos', 'metadata']);
    const ninguno = sinSvg.filter((a) => a.campo !== 'calculos');
    assert.deepEqual(detalle({ adjuntos: ninguno }).archivos.map((a) => a.campo), ['infografia_png', 'correo_texto', 'metadata']);
  });

  it('el tamaño de cada archivo: el de sus bytes; el de la edición completa, el de metadata en UTF-8', () => {
    const adjuntos = [
      { campo: 'infografia_png', nombre: 'grande.png', mime: 'image/png', bytes: 1572864 },
      { campo: 'correo_texto', nombre: 'correo.txt', mime: 'text/plain', bytes: 1025 },
      { campo: 'calculos', nombre: 'calculos.txt', mime: 'text/plain', bytes: 0 },
      { campo: 'infografia_svg', nombre: 'editable.svg', mime: 'image/svg+xml', bytes: 7000 }
    ];
    // 1024 eñes son 2048 bytes en UTF-8: 2 KB, no 1
    const fila = filaDePrueba({ metadata: 'ñ'.repeat(1024) });
    const d = detalle({ fila, edicion: edicionDePrueba(), adjuntos });
    assert.deepEqual(d.archivos.map((a) => a.detalle), ['PNG · 1,5 MB', 'SVG · 7 KB', '2 KB', '0 KB', 'JSON · 2 KB']);
    assert.deepEqual(d.archivos.map((a) => a.nombre),
      ['grande.png', 'editable.svg', 'correo.txt', 'calculos.txt', 'dato-quincena-regular-2026-11-02.json']);
    assert.deepEqual(d.archivos[1], {
      campo: 'infografia_svg', rotulo: 'Infografía editable', nombre: 'editable.svg', detalle: 'SVG · 7 KB', se_puede_ver: false
    });
  });

  it('un piloto: su marca, el correo sin la hora, sin nota de archivo y el nombre de su edición completa', () => {
    const edicion = pilotoDePrueba();
    const fila = filaDePrueba({
      id: 13, clave: 'dq:piloto:2026-11-02:piloto-4', tipo: 'piloto', referencia_piloto: 'piloto-4', titulo: edicion.titulo,
      metadata: JSON.stringify(edicion)
    });
    const d = detalle({ fila });
    assert.equal(d.id, 13);
    assert.equal(d.marca, 'Piloto 4');
    assert.equal(d.numero, null, 'un piloto no tiene número, aunque la fila traiga uno');
    assert.equal(d.titulo, 'El dato de la quincena: piloto de prueba');
    assert.equal(d.correo, 'Correo enviado según Datito, sin la hora.');
    assert.equal(d.nota_archivo, null);
    assert.equal(d.archivos.at(-1).nombre, 'dato-quincena-piloto-2026-11-02-piloto-4.json');
  });

  it('una nota de archivo vacía o con solo espacios es null; una con texto, tal cual', () => {
    for (const nota of ['', '   ', ' \n\t ']) {
      assert.equal(detalle({ edicion: edicionDePrueba({ nota_archivo: nota }) }).nota_archivo, null, JSON.stringify(nota));
    }
    assert.equal(detalle({ edicion: edicionDePrueba({ nota_archivo: ' Con espacios.\n' }) }).nota_archivo, ' Con espacios.\n');
  });

  it('la llegada desde recibida_ts, también en texto como la puede dar la base, y el correo en hora argentina', () => {
    const d = detalle({ fila: filaDePrueba({ recibida_ts: String(segundosUtc(2026, 10, 3, 2, 5, 0)) }) });
    assert.equal(d.llegada, 'Llegó al RPAD el 02/11/2026 a las 23:05.');
    const otraZona = edicionDePrueba({ correo: { estado: 'enviado', enviado_at: '2026-11-02T14:12:00+03:00' } });
    assert.equal(detalle({ edicion: otraZona }).correo, 'Correo enviado el 02/11/2026 a las 08:12, según Datito.');
    const sinCorreo = edicionDePrueba({ correo: { estado: 'no_enviado', enviado_at: null } });
    assert.equal(detalle({ edicion: sinCorreo }).correo, 'Datito archivó esta edición sin que saliera el correo.');
  });

  it('la agenda con su fecha dd/mm/aaaa, en su orden; sin agenda, una lista vacía', () => {
    const agenda = [
      { titulo: 'Segundo', fecha: '2026-12-01', detalle: 'Uno inventado.', url: 'https://datos.ejemplo.gob.ar/b' },
      { titulo: 'Primero', fecha: '2026-11-10', detalle: 'Otro inventado.', url: 'https://datos.ejemplo.gob.ar/a' }
    ];
    assert.deepEqual(detalle({ edicion: edicionDePrueba({ agenda }) }).agenda, [
      { fecha_texto: '01/12/2026', titulo: 'Segundo', detalle: 'Uno inventado.', url: 'https://datos.ejemplo.gob.ar/b', etiqueta: null },
      { fecha_texto: '10/11/2026', titulo: 'Primero', detalle: 'Otro inventado.', url: 'https://datos.ejemplo.gob.ar/a', etiqueta: null }
    ]);
    assert.deepEqual(detalle({ edicion: edicionDePrueba({ agenda: [] }) }).agenda, []);
  });

  // spec 2026-11-12-dato-quincena-correo, 11: la etiqueta «Efeméride»; un evento, con tipo o sin él, no lleva
  it('la agenda con una efeméride: etiqueta «Efeméride»; un evento, null', () => {
    const agenda = [
      { ...efemerideDePrueba() },
      { titulo: 'Con tipo', fecha: '2026-11-25', detalle: 'Un evento inventado.', url: 'https://datos.ejemplo.gob.ar/c', tipo: 'evento' },
      edicionDePrueba().agenda[0]
    ];
    const d = detalle({ edicion: edicionDePrueba({ agenda }) });
    assert.deepEqual(d.agenda.map((e) => [e.titulo, e.etiqueta]),
      [['Efeméride de prueba', 'Efeméride'], ['Con tipo', null], ['Evento de prueba', null]]);
    assert.deepEqual(d.agenda[0], {
      fecha_texto: '20/11/2026', titulo: 'Efeméride de prueba', detalle: 'Una efeméride inventada para las pruebas.',
      url: 'https://datos.ejemplo.gob.ar/agenda/efemeride-de-prueba', etiqueta: 'Efeméride'
    });
    assert.deepEqual(RESPUESTAS.detalle.data.agenda.map((e) => e.etiqueta), [null, 'Efeméride']);
  });

  // spec 2026-11-12-dato-quincena-correo, 12: el número lo cuenta la consulta; la regla lo arma
  it('el número de edición: «N.º N» de la fila en una regular; null sin un entero positivo', () => {
    assert.equal(detalle().numero, 'N.º 1');
    assert.equal(detalle({ fila: filaDePrueba({ numero: 3 }) }).numero, 'N.º 3');
    for (const numero of [null, undefined, 0, '2']) {
      assert.equal(detalle({ fila: filaDePrueba({ numero }) }).numero, null, String(numero));
    }
  });

  it('la principal puede no ser la primera; la cantidad, en singular con una sola propuesta', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas[0].etiquetas = ['Validar'];
    edicion.propuestas[1].etiquetas = ['Agenda', 'Principal'];
    const d = detalle({ edicion });
    assert.deepEqual(d.propuestas.map((p) => [p.orden_texto, p.principal]), [['Propuesta 1', false], ['Propuesta 2', true]]);
    assert.deepEqual(d.propuestas[1].etiquetas, ['Agenda', 'Principal']);

    const una = edicionDePrueba();
    una.propuestas = [una.propuestas[0]];
    assert.equal(detalle({ edicion: una }).cantidad, '1 propuesta');
    assert.equal(detalle({ edicion: una }).propuestas.length, 1);
  });

  // spec 2026-11-14-dato-quincena-v1-3, 3: la edición del 16/11 de las respuestas de la página (id 14, la N.º 2, enviada por el
  // RPAD ese lunes a las 8:05, como la pastilla de la lista), con tres propuestas: la principal vuelve sobre el dataset 1 de la de
  // prueba (02/11, id 12, en las previas), con enlace; la segunda es una efeméride, sin repetición; la tercera vuelve sobre el tema
  // de una edición del 19/10 que no está en el RPAD, sin enlace. Con el SVG, como la de prueba
  const FECHA_CON_REPETICION = '2026-11-16';
  const PREVIAS = new Map([[FECHA_DE_PRUEBA, { id: 12, rpad_ids: [1, 2] }]]);
  const edicionConRepeticion = () => {
    const edicion = edicionDePrueba({
      fecha_edicion: FECHA_CON_REPETICION, titulo: 'El dato de la quincena: edición de prueba con repeticiones',
      agenda: [...edicionDePrueba().agenda, efemerideDePrueba()]
    });
    const [principal, segunda] = edicion.propuestas;
    principal.etiquetas.push('Repite');
    principal.repeticion = repeticionDePrueba();
    segunda.etiquetas = ['Agenda', 'Efemeride'];
    edicion.propuestas.push({
      ...structuredClone(segunda),
      orden: 3,
      titulo: 'Un tercer título inventado',
      etiquetas: ['Repite'],
      dataset: {
        rpad_id: 3, ckan_slug: 'prueba-c', nombre: 'Dataset de prueba C', url: 'https://datos.ejemplo.gob.ar/dataset/prueba-c'
      },
      cifra_clave: '7 casos · octubre de 2026',
      repeticion: repeticionDePrueba({
        fecha_edicion_previa: '2026-10-19', motivo: 'hecho_actual', alcance: 'tema',
        detalle: 'Esta quincena el tema volvió a estar en agenda.'
      })
    });
    return edicion;
  };
  const metadataConRepeticion = partesDePrueba(edicionConRepeticion(), { infografia_svg: svgDePrueba() }).metadata.toString('utf8');
  const detalleConRepeticion = (cambios = {}) => detalle({
    fila: filaDePrueba({
      id: 14, clave: `dq:regular:${FECHA_CON_REPETICION}`, fecha_edicion: FECHA_CON_REPETICION,
      titulo: 'El dato de la quincena: edición de prueba con repeticiones', metadata: metadataConRepeticion,
      recibida_ts: segundosUtc(2026, 10, 16, 10, 40, 0), numero: 2
    }),
    guardadas: [...GUARDADAS, { orden: 3, dataset_id: null, dataset_activo: false }],
    linea: lineaDePrueba({
      fecha_edicion: FECHA_CON_REPETICION, correo: { estado: 'enviada', motivo: null, enviada_at: '2026-11-16 08:05:12' },
      envios: [{ usuario_id: 1, tipo: 'automatico', estado: 'enviado', intentos: 1, enviado_at: '2026-11-16 08:05:12' }],
      correoDelBot: null, envioActivo: true, ahora: '2026-11-20 10:00:00'
    }),
    previas: PREVIAS,
    ...cambios
  });

  it('la edición con repeticiones es válida y da el detalle de las respuestas de la página, entero y con las claves en su orden', () => {
    assert.deepEqual(validar(edicionConRepeticion(), FECHA_CON_REPETICION), []);
    const d = detalleConRepeticion();
    assert.deepEqual(d, RESPUESTAS.detalle_con_repeticion.data);
    assert.deepEqual(ordenDeLasClaves(d), ordenDeLasClaves(RESPUESTAS.detalle_con_repeticion.data));
    assert.equal(RESPUESTAS.detalle_con_repeticion.success, true);
    // La repetición va después de la foto, en todas las propuestas, también en la edición de prueba (null)
    for (const respuesta of [RESPUESTAS.detalle, RESPUESTAS.detalle_con_repeticion]) {
      for (const propuesta of respuesta.data.propuestas) {
        const claves = Object.keys(propuesta);
        assert.equal(claves.indexOf('repeticion'), claves.indexOf('foto') + 1);
      }
    }
    assert.deepEqual(RESPUESTAS.detalle.data.propuestas.map((p) => p.repeticion), [null, null]);
    assert.equal(d.correo, 'Enviada por correo el lunes 16/11/2026 a las 8:05.');
  });

  it('las etiquetas para mostrar: Efemeride es «Efeméride», las demás igual; principal mira el valor del JSON', () => {
    const d = detalleConRepeticion();
    assert.deepEqual(d.propuestas.map((p) => p.etiquetas), [['Principal', 'Validar', 'Repite'], ['Agenda', 'Efeméride'], ['Repite']]);
    assert.deepEqual(d.propuestas.map((p) => p.principal), [true, false, false]);
    // Una edición v1.2: sus etiquetas, tal cual
    assert.deepEqual(detalle().propuestas.map((p) => p.etiquetas), [['Principal', 'Validar'], ['Agenda']]);
  });

  it('la repetición: el texto con el alcance y la fecha, el motivo con el detalle tal cual y el id de la edición previa', () => {
    const [principal, segunda, tercera] = detalleConRepeticion().propuestas;
    assert.deepEqual(principal.repeticion, {
      texto: 'Repite el dataset de la edición del 02/11/2026.',
      motivo: 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.',
      id_edicion: 12
    });
    assert.equal(segunda.repeticion, null);
    assert.deepEqual(tercera.repeticion, {
      texto: 'Repite el tema de la edición del 19/10/2026.',
      motivo: 'Hecho actual: Esta quincena el tema volvió a estar en agenda.',
      id_edicion: null
    });
  });

  it('id_edicion: solo si la edición previa está en las previas y es anterior; sin previas, null', () => {
    assert.equal(detalleConRepeticion({ previas: undefined }).propuestas[0].repeticion.id_edicion, null);
    assert.equal(detalleConRepeticion({ previas: new Map() }).propuestas[0].repeticion.id_edicion, null);
    // Una repetición de la misma fecha de la edición no enlaza, aunque esa fecha esté en las previas
    const misma = edicionConRepeticion();
    misma.propuestas[0].repeticion.fecha_edicion_previa = FECHA_CON_REPETICION;
    const previas = new Map([[FECHA_CON_REPETICION, { id: 14, rpad_ids: [1] }], ...PREVIAS]);
    const [principal] = detalleConRepeticion({ edicion: misma, previas }).propuestas;
    assert.deepEqual(principal.repeticion, {
      texto: 'Repite el dataset de la edición del 16/11/2026.',
      motivo: 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.',
      id_edicion: null
    });
    // El id no depende de que la edición previa cite el dataset (eso solo da el aviso)
    const sinElDataset = new Map([[FECHA_DE_PRUEBA, { id: 12, rpad_ids: [] }]]);
    assert.equal(detalleConRepeticion({ previas: sinElDataset }).propuestas[0].repeticion.id_edicion, 12);
  });

  // Si las ediciones previas no se pudieron leer (null), el detalle sale igual: la repetición, sin enlace
  it('con previas null (no se pudieron leer): el detalle sale igual, con las repeticiones sin enlace', () => {
    const d = detalleConRepeticion({ previas: null });
    assert.deepEqual(d.propuestas.map((p) => p.repeticion?.id_edicion ?? null), [null, null, null]);
    assert.deepEqual(d, detalleConRepeticion({ previas: new Map() }));
    assert.equal(d.propuestas[0].repeticion.texto, 'Repite el dataset de la edición del 02/11/2026.');
  });

  it('para_copiar suma el bloque de la repetición después de la foto y lleva las etiquetas para mostrar', () => {
    const edicion = edicionConRepeticion();
    const d = detalleConRepeticion();
    assert.deepEqual(d.propuestas.map((p) => p.para_copiar), edicion.propuestas.map(textoParaCopiar));
    assert.ok(d.propuestas[0].para_copiar.startsWith('Un título inventado [Principal, Validar, Repite]\n\n'));
    assert.ok(d.propuestas[0].para_copiar.includes('Próxima en 29 días.\n\nRepite el dataset de la edición del 02/11/2026.\n'
      + 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.\n\nPara validar antes de publicar\n'));
    assert.ok(d.propuestas[1].para_copiar.startsWith('Otro título inventado [Agenda, Efeméride]\n\n'));
    assert.ok(!d.propuestas[1].para_copiar.includes('Repite'));
  });

  it('una edición v1.2: repeticion null en cada propuesta y lo demás igual que siempre', () => {
    const d = detalle({ previas: PREVIAS });
    assert.deepEqual(d, detalle());
    assert.deepEqual(d.propuestas.map((p) => p.repeticion), [null, null]);
    const conNull = edicionDePrueba();
    conNull.propuestas[1].repeticion = null;
    assert.deepEqual(detalle({ edicion: conNull }).propuestas, detalle().propuestas);
  });

  it('no cambia lo que recibe', () => {
    const fila = filaDePrueba();
    const edicion = JSON.parse(fila.metadata);
    const guardadas = structuredClone(GUARDADAS);
    const adjuntos = adjuntosDe(edicion).reverse();
    const antes = structuredClone({ fila, edicion, guardadas, adjuntos });
    detalleDeLaEdicion({ fila, edicion, guardadas, adjuntos });
    assert.deepEqual({ fila, edicion, guardadas, adjuntos }, antes);
    const conRepeticion = edicionConRepeticion();
    const otraAntes = structuredClone(conRepeticion);
    const previas = new Map(PREVIAS);
    detalleDeLaEdicion({ fila, edicion: conRepeticion, guardadas, adjuntos, previas });
    assert.deepEqual(conRepeticion, otraAntes);
    assert.deepEqual([...previas], [...PREVIAS]);
  });
});

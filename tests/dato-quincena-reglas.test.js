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
  TOPES, TOPE_DEL_PEDIDO, PARTES, ARCHIVOS, FECHA_MINIMA, MAXIMO_DE_ERRORES, MENSAJES_VALIDACION,
  validarEdicion, claveDeEdicion, sha256 as sha256DeLasReglas, esPng, esTextoUtf8, textoDeMetadata, validarAdjuntos,
  erroresDeLaEdicion, huellaDelPaquete, estadoDelToken,
  fechaLarga, marcaDePiloto, horaArgentina, diaArgentino, textoDeLlegada, textoDelCorreo, textoDeCantidad, textoDelResto,
  tamanoTexto, fotoDelDataset, textoParaCopiar, borradorParaCopiar, filasDeLaEdicion, avisosDeLaEdicion, reciboDe,
  anioDeLaLista, nombreDeLaEdicion, TIPO_DE_DESCARGA, itemDeLaLista, detalleDeLaEdicion
} from '../services/datoQuincenaReglas.js';
import { sumarDias } from '../services/notasDigitalesCalendario.js';
import { RPAD_URL } from '../services/emailTemplates.js';
import {
  FECHA_DE_PRUEBA, edicionDePrueba, pilotoDePrueba, pngDePrueba, partesDePrueba
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
  it('los topes de cada parte y del pedido', () => {
    assert.deepEqual({ ...TOPES }, {
      metadata: 256 * 1024, infografia_png: 5 * 1024 * 1024, correo_texto: 256 * 1024, calculos: 256 * 1024
    });
    assert.equal(TOPE_DEL_PEDIDO, 6 * 1024 * 1024);
    assert.ok(Object.isFrozen(TOPES));
  });

  it('las partes, los archivos, la fecha mínima y el tope de errores', () => {
    assert.deepEqual([...PARTES], ['metadata', 'infografia_png', 'correo_texto', 'calculos']);
    assert.deepEqual([...ARCHIVOS], ['infografia_png', 'correo_texto', 'calculos']);
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
      etiqueta: 'Las etiquetas posibles son Principal, Validar y Agenda.',
      etiquetaRepetida: 'Esta etiqueta ya está en la propuesta.',
      principal: 'Exactamente una propuesta tiene que llevar la etiqueta Principal.',
      enteroPositivo: 'Tiene que ser un número entero positivo.',
      estado: 'Tiene que ser uno de los estados de GET /api/datasets.',
      diasParaVencer: 'Tiene que ser un número entero de -100000 a 100000.',
      sha256: 'Tiene que ser un SHA-256 en hexadecimal: 64 caracteres en minúsculas.',
      agenda: 'La agenda puede traer hasta 20 eventos.',
      propuestas: 'La edición tiene que traer de 1 a 5 propuestas.',
      adjuntos: 'El manifiesto tiene que describir 2 o 3 archivos.',
      puntosCentrales: 'Tiene que traer de 3 a 5 puntos centrales.',
      parrafos: 'El borrador tiene que traer 2 o 3 párrafos.',
      notasValidacion: 'Puede traer hasta 20 notas de validación.',
      fuentes: 'Tiene que traer de 1 a 20 fuentes.',
      campo: 'El campo tiene que ser infografia_png, correo_texto o calculos.',
      campoRepetido: 'Este campo ya está en otra entrada del manifiesto.',
      sinParte: 'El pedido no trae la parte que describe esta entrada.',
      sinEntradaInfografia: 'El manifiesto no describe la parte infografia_png, que llegó en el pedido.',
      sinEntradaCorreo: 'El manifiesto no describe la parte correo_texto, que llegó en el pedido.',
      sinEntradaCalculos: 'El manifiesto no describe la parte calculos, que llegó en el pedido.',
      nombre: 'El nombre del archivo tiene que tener de 1 a 255 caracteres, sin /, \\ ni caracteres de control.',
      mime: 'El tipo tiene que ser image/png en la infografía, text/plain en el texto del correo y text/markdown o text/plain en '
        + 'los cálculos.',
      bytesDistintos: 'No coincide con el tamaño de la parte recibida.',
      sha256Distinto: 'No coincide con el SHA-256 de la parte recibida.',
      png: 'La infografía tiene que ser un PNG completo, de 1 a 4096 píxeles de ancho y de alto.',
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

  // Grok Bot archiva la edición aunque el correo no haya salido: la regular también pasa sin la hora del correo
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
  });

  it('con el correo enviado, una regular sigue pidiendo la hora; con un estado que no vale, la hora se revisa igual', () => {
    assert.deepEqual(erroresCon('correo', { estado: 'enviado', enviado_at: null }), [error('correo.enviado_at', 'enviadoAt')]);
    assert.deepEqual(erroresCon('correo', { estado: 'otro', enviado_at: null }),
      [error('correo.estado', 'correoEstado'), error('correo.enviado_at', 'enviadoAt')]);
    assert.deepEqual(erroresCon('correo', { estado: 'otro', enviado_at: '2026-11-02T11:12:00Z' }),
      [error('correo.estado', 'correoEstado')]);
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

  it('las etiquetas: sin repetidos, solo Principal, Validar y Agenda', () => {
    assert.deepEqual(erroresCon('propuestas[0].etiquetas', ['Principal', 'Validar', 'Agenda']), []);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', []), []);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Agenda', 'Agenda']), [error('propuestas[1].etiquetas[1]', 'etiquetaRepetida')]);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Urgente']), [error('propuestas[1].etiquetas[0]', 'etiqueta')]);
    assert.deepEqual(erroresCon('propuestas[1].etiquetas', ['Validar', 'agenda', 3]),
      [error('propuestas[1].etiquetas[1]', 'etiqueta'), error('propuestas[1].etiquetas[2]', 'etiqueta')]);
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
  it('de 2 o 3 entradas', () => {
    const edicion = edicionDePrueba();
    assert.deepEqual(erroresCon('adjuntos', edicion.adjuntos.slice(0, 2)), []);
    assert.deepEqual(erroresCon('adjuntos', edicion.adjuntos.slice(0, 1)), [error('adjuntos', 'adjuntos')]);
    assert.deepEqual(erroresCon('adjuntos', [...edicion.adjuntos, { ...edicion.adjuntos[2] }]), [error('adjuntos', 'adjuntos')]);
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
  // El texto de la sección 6, armado a mano: un renglón por parte, en su orden, con - si no llegó
  const esperada = (partes) => sha256(Buffer.from(
    `metadata:${sha256(partes.metadata)}\n`
    + `infografia_png:${sha256(partes.infografia_png)}\n`
    + `correo_texto:${sha256(partes.correo_texto)}\n`
    + `calculos:${partes.calculos === undefined ? '-' : sha256(partes.calculos)}\n`,
    'utf8'
  ));

  it('el SHA-256 del texto de la sección 6, con los cálculos y sin ellos', () => {
    const partes = partesDePrueba(edicionDePrueba());
    assert.match(huellaDelPaquete(partes), /^[0-9a-f]{64}$/);
    assert.equal(huellaDelPaquete(partes), esperada(partes));
    const sinCalculos = partesDePrueba(pilotoDePrueba(), { calculos: null });
    assert.equal(huellaDelPaquete(sinCalculos), esperada(sinCalculos));
  });

  it('igual con las mismas partes, y no depende del orden en que llegaron', () => {
    const partes = partesDePrueba(edicionDePrueba());
    const copia = Object.fromEntries(Object.entries(partesDePrueba(edicionDePrueba())).reverse());
    assert.deepEqual(Object.keys(copia), ['calculos', 'correo_texto', 'infografia_png', 'metadata']);
    assert.equal(huellaDelPaquete(copia), huellaDelPaquete(partes));
  });

  it('distinta si cambia un byte de cualquier parte', () => {
    const partes = partesDePrueba(edicionDePrueba());
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
      assert.equal(textoDelCorreo(valor), `Correo enviado el 31/12/1899 a las ${hora}, según Grok Bot.`, valor);
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
    assert.equal(textoDelCorreo('2026-11-23T11:12:00Z'), 'Correo enviado el 23/11/2026 a las 08:12, según Grok Bot.');
    assert.equal(textoDelCorreo('2026-11-23T14:12:00+03:00'), 'Correo enviado el 23/11/2026 a las 08:12, según Grok Bot.');
    assert.equal(textoDelCorreo(edicionDePrueba().correo.enviado_at), 'Correo enviado el 02/11/2026 a las 08:12, según Grok Bot.');
    assert.equal(textoDelCorreo(null), 'Correo enviado según Grok Bot, sin la hora.');
    assert.equal(textoDelCorreo(pilotoDePrueba().correo.enviado_at), 'Correo enviado según Grok Bot, sin la hora.');
    assert.equal(textoDelCorreo('2026-11-23T11:12:00Z', 'enviado'), 'Correo enviado el 23/11/2026 a las 08:12, según Grok Bot.');
  });

  it('el correo no enviado: siempre el mismo texto, cierto aunque el correo salga después', () => {
    assert.equal(textoDelCorreo(null, 'no_enviado'), 'Grok Bot archivó esta edición sin que saliera el correo.');
    assert.equal(textoDelCorreo('2026-11-23T11:12:00Z', 'no_enviado'), 'Grok Bot archivó esta edición sin que saliera el correo.');
  });

  it('la cantidad de propuestas', () => {
    assert.equal(textoDeCantidad(1), '1 propuesta');
    assert.equal(textoDeCantidad(2), '2 propuestas');
    assert.equal(textoDeCantidad(5), '5 propuestas');
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

  it('no cambia la propuesta', () => {
    const propuesta = propuestaDelEjemplo();
    const copia = structuredClone(propuesta);
    textoParaCopiar(propuesta);
    assert.deepEqual(propuesta, copia);
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

describe('reciboDe', () => {
  const edicion = {
    id: 12, clave: 'dq:regular:2026-11-23', tipo: 'regular', fecha_edicion: '2026-11-23', huella: 'a'.repeat(64),
    recibida_ts: segundosUtc(2026, 10, 23, 11, 14, 2)
  };
  const infografia = { campo: 'infografia_png', bytes: 98000, sha256: 'b'.repeat(64) };
  const correo = { campo: 'correo_texto', bytes: 17000, sha256: 'c'.repeat(64) };
  const calculos = { campo: 'calculos', bytes: 3000, sha256: 'd'.repeat(64) };

  it('todas sus claves, en el orden de la sección 7', () => {
    const recibo = reciboDe(edicion, [infografia, correo], [], false);
    assert.deepEqual(recibo, {
      id: 12, clave: 'dq:regular:2026-11-23', tipo: 'regular', fecha_edicion: '2026-11-23', huella: 'a'.repeat(64),
      recibida_at: '2026-11-23T08:14:02-03:00', repetida: false, adjuntos: [infografia, correo],
      url: `${RPAD_URL}/dato-quincena.html?id=12`, avisos: []
    });
    assert.deepEqual(Object.keys(recibo), [
      'id', 'clave', 'tipo', 'fecha_edicion', 'huella', 'recibida_at', 'repetida', 'adjuntos', 'url', 'avisos'
    ]);
    assert.match(recibo.url, /^https?:\/\/[^/]+\/dato-quincena\.html\?id=12$/);
  });

  it('los adjuntos en el orden de ARCHIVOS y solo con campo, bytes y sha256', () => {
    const conMas = (adjunto) => ({ ...adjunto, nombre: 'x.txt', mime: 'text/plain', contenido: Buffer.from('x') });
    const recibo = reciboDe(edicion, [conMas(calculos), conMas(correo), conMas(infografia)], [], false);
    assert.deepEqual(recibo.adjuntos, [infografia, correo, calculos]);
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

  it('el Content-Type fijo de cada descarga: el texto y los cálculos, como texto en UTF-8', () => {
    assert.deepEqual({ ...TIPO_DE_DESCARGA }, {
      infografia_png: 'image/png',
      correo_texto: 'text/plain; charset=utf-8',
      calculos: 'text/plain; charset=utf-8',
      metadata: 'application/json; charset=utf-8'
    });
    assert.ok(Object.isFrozen(TIPO_DE_DESCARGA));
  });
});

// Una fila de listarEdiciones: la primera propuesta es la principal (la del fixture) y las demás, una por nombre
const filaDeLaLista = (id, tipo, fecha_edicion, referencia_piloto, nombres) => ({
  id,
  tipo,
  fecha_edicion,
  referencia_piloto,
  propuestas: nombres.map((dataset_nombre, i) => (i === 0
    ? { orden: 1, titulo: 'Un título inventado', cifra_clave: '1.234 casos · septiembre de 2026', principal: true, dataset_nombre }
    : { orden: i + 1, titulo: `Otro título ${i + 1}`, cifra_clave: `${i + 1} casos`, principal: false, dataset_nombre }))
});

describe('itemDeLaLista', () => {
  it('las ediciones de las respuestas de la página, con las claves en su orden', () => {
    const items = [
      filaDeLaLista(14, 'regular', '2026-11-16', null, ['Dataset de prueba A', 'Dataset de prueba B', 'Dataset de prueba C']),
      filaDeLaLista(13, 'piloto', '2026-11-02', 'piloto-4', ['Dataset de prueba A']),
      filaDeLaLista(12, 'regular', '2026-11-02', null, ['Dataset de prueba A', 'Dataset de prueba B'])
    ].map(itemDeLaLista);
    assert.deepEqual(items, RESPUESTAS.lista.data.ediciones);
    assert.deepEqual(ordenDeLasClaves(items), ordenDeLasClaves(RESPUESTAS.lista.data.ediciones));

    const deEnero = itemDeLaLista(filaDeLaLista(15, 'regular', '2027-01-11', null, ['Dataset de prueba A', 'Dataset de prueba B']));
    assert.deepEqual(deEnero, RESPUESTAS.lista_de_2027.data.ediciones[0]);
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
      resto: 'Y 4 propuestas más: Dataset 1, Dataset 3, Dataset 4 y Dataset 5.'
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
    assert.deepEqual(itemDeLaLista(filaDeLaLista(6, 'regular', '2026-11-23', null, [])), {
      id: 6, fecha_texto: 'Lunes 23 de noviembre de 2026', marca: null, principal: null, resto: null
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
  // La edición de prueba como la guarda el POST (metadata, el texto de partesDePrueba), con el id 12 de las respuestas de la
  // página, recibida el 02/11/2026 a las 08:14 en Argentina; el dataset 1 activo y el 2 dado de baja
  const metadata = partesDePrueba(edicionDePrueba()).metadata.toString('utf8');
  const filaDePrueba = (cambios = {}) => ({
    id: 12, clave: 'dq:regular:2026-11-02', tipo: 'regular', fecha_edicion: '2026-11-02', referencia_piloto: null,
    titulo: 'El dato de la quincena: edición de prueba', metadata, recibida_ts: segundosUtc(2026, 10, 2, 11, 14, 0), ...cambios
  });
  const GUARDADAS = Object.freeze([
    { orden: 1, dataset_id: 1, dataset_activo: true }, { orden: 2, dataset_id: 2, dataset_activo: false }
  ]);
  const adjuntosDe = (edicion) => edicion.adjuntos.map(({ campo, nombre, mime, bytes }) => ({ campo, nombre, mime, bytes }));
  const detalle = ({ fila = filaDePrueba(), edicion = JSON.parse(fila.metadata), guardadas = GUARDADAS, adjuntos } = {}) =>
    detalleDeLaEdicion({ fila, edicion, guardadas, adjuntos: adjuntos ?? adjuntosDe(edicion) });

  it('la edición de prueba da el detalle de las respuestas de la página, entero y con las claves en su orden', () => {
    const d = detalle();
    assert.deepEqual(d, RESPUESTAS.detalle.data);
    assert.deepEqual(ordenDeLasClaves(d), ordenDeLasClaves(RESPUESTAS.detalle.data));
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

  it('los archivos, en su orden aunque los adjuntos lleguen en otro; sin cálculos, tres', () => {
    const edicion = edicionDePrueba();
    const alReves = adjuntosDe(edicion).reverse();
    assert.deepEqual(detalle({ adjuntos: alReves }).archivos, RESPUESTAS.detalle.data.archivos);

    const sinCalculos = adjuntosDe(edicion).filter((a) => a.campo !== 'calculos');
    assert.deepEqual(detalle({ adjuntos: sinCalculos }).archivos.map((a) => a.campo), ['infografia_png', 'correo_texto', 'metadata']);
  });

  it('el tamaño de cada archivo: el de sus bytes; el de la edición completa, el de metadata en UTF-8', () => {
    const adjuntos = [
      { campo: 'infografia_png', nombre: 'grande.png', mime: 'image/png', bytes: 1572864 },
      { campo: 'correo_texto', nombre: 'correo.txt', mime: 'text/plain', bytes: 1025 },
      { campo: 'calculos', nombre: 'calculos.txt', mime: 'text/plain', bytes: 0 }
    ];
    // 1024 eñes son 2048 bytes en UTF-8: 2 KB, no 1
    const fila = filaDePrueba({ metadata: 'ñ'.repeat(1024) });
    const d = detalle({ fila, edicion: edicionDePrueba(), adjuntos });
    assert.deepEqual(d.archivos.map((a) => a.detalle), ['PNG · 1,5 MB', '2 KB', '0 KB', 'JSON · 2 KB']);
    assert.deepEqual(d.archivos.map((a) => a.nombre), ['grande.png', 'correo.txt', 'calculos.txt', 'dato-quincena-regular-2026-11-02.json']);
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
    assert.equal(d.titulo, 'El dato de la quincena: piloto de prueba');
    assert.equal(d.correo, 'Correo enviado según Grok Bot, sin la hora.');
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
    assert.equal(detalle({ edicion: otraZona }).correo, 'Correo enviado el 02/11/2026 a las 08:12, según Grok Bot.');
    const sinCorreo = edicionDePrueba({ correo: { estado: 'no_enviado', enviado_at: null } });
    assert.equal(detalle({ edicion: sinCorreo }).correo, 'Grok Bot archivó esta edición sin que saliera el correo.');
  });

  it('la agenda con su fecha dd/mm/aaaa, en su orden; sin agenda, una lista vacía', () => {
    const agenda = [
      { titulo: 'Segundo', fecha: '2026-12-01', detalle: 'Uno inventado.', url: 'https://datos.ejemplo.gob.ar/b' },
      { titulo: 'Primero', fecha: '2026-11-10', detalle: 'Otro inventado.', url: 'https://datos.ejemplo.gob.ar/a' }
    ];
    assert.deepEqual(detalle({ edicion: edicionDePrueba({ agenda }) }).agenda, [
      { fecha_texto: '01/12/2026', titulo: 'Segundo', detalle: 'Uno inventado.', url: 'https://datos.ejemplo.gob.ar/b' },
      { fecha_texto: '10/11/2026', titulo: 'Primero', detalle: 'Otro inventado.', url: 'https://datos.ejemplo.gob.ar/a' }
    ]);
    assert.deepEqual(detalle({ edicion: edicionDePrueba({ agenda: [] }) }).agenda, []);
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

  it('no cambia lo que recibe', () => {
    const fila = filaDePrueba();
    const edicion = JSON.parse(fila.metadata);
    const guardadas = structuredClone(GUARDADAS);
    const adjuntos = adjuntosDe(edicion).reverse();
    const antes = structuredClone({ fila, edicion, guardadas, adjuntos });
    detalleDeLaEdicion({ fila, edicion, guardadas, adjuntos });
    assert.deepEqual({ fila, edicion, guardadas, adjuntos }, antes);
  });
});

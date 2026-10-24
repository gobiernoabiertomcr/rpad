// «Registrar actualización» (spec 2026-10-24-metricas-y-reportes, sección 4): las reglas puras del registro.
// El origen de los datos (solo en gestión externa): 'area' (los entregó el área) o 'fuente_publica' (Datos Públicos los
// obtuvo de una fuente pública), y los mensajes de la validación.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIGENES_DATOS, OPCIONES_ORIGEN, TEXTO_ORIGEN,
  MENSAJE_FALTA_RECIBIDO, MENSAJE_FALTA_ORIGEN, MENSAJE_EDICION_REGISTRA,
  normalizarOrigen, origenSugerido, rotuloDeLaFecha, textoOrigen
} from '../services/registroReglas.js';

describe('los orígenes y sus textos', () => {
  it('los orígenes son el área y la fuente pública, y no se pueden cambiar', () => {
    assert.deepEqual(ORIGENES_DATOS, ['area', 'fuente_publica']);
    assert.ok(Object.isFrozen(ORIGENES_DATOS));
  });

  it('las opciones del modal dicen quién entregó los datos', () => {
    assert.deepEqual(OPCIONES_ORIGEN, {
      area: 'Los entregó el área',
      fuente_publica: 'Los obtuvo Datos Públicos de una fuente pública'
    });
    assert.ok(Object.isFrozen(OPCIONES_ORIGEN));
  });

  it('el texto corto es el de las comparaciones y los movimientos', () => {
    assert.deepEqual(TEXTO_ORIGEN, { area: 'Los entregó el área', fuente_publica: 'Fuente pública' });
    assert.ok(Object.isFrozen(TEXTO_ORIGEN));
  });

  it('cada origen tiene su opción y su texto', () => {
    for (const origen of ORIGENES_DATOS) {
      assert.equal(typeof OPCIONES_ORIGEN[origen], 'string', origen);
      assert.equal(typeof TEXTO_ORIGEN[origen], 'string', origen);
    }
  });
});

describe('los mensajes', () => {
  it('son los textos exactos de la validación', () => {
    assert.equal(MENSAJE_FALTA_RECIBIDO, 'Indicá cuándo se recibieron los datos.');
    assert.equal(MENSAJE_FALTA_ORIGEN, 'Indicá quién entregó los datos.');
    assert.equal(MENSAJE_EDICION_REGISTRA, 'Para registrar una actualización, usá «Registrar actualización».');
  });
});

describe('normalizarOrigen', () => {
  it('los dos orígenes quedan como vinieron', () => {
    assert.equal(normalizarOrigen('area'), 'area');
    assert.equal(normalizarOrigen('fuente_publica'), 'fuente_publica');
  });

  it('null, undefined y el texto vacío son null (sin dato)', () => {
    assert.strictEqual(normalizarOrigen(null), null);
    assert.strictEqual(normalizarOrigen(undefined), null);
    assert.strictEqual(normalizarOrigen(), null);
    assert.strictEqual(normalizarOrigen(''), null);
  });

  it('cualquier otro valor tira TypeError', () => {
    for (const valor of ['otro', 'Area', 'AREA', ' area', 'area ', 'fuente pública', 'Fuente pública', 'publica',
      0, 1, true, false, NaN, {}, [], ['area'], () => 'area']) {
      assert.throws(() => normalizarOrigen(valor), TypeError, String(valor));
    }
  });
});

describe('origenSugerido', () => {
  it('un externo con «Requiere nota DGMIT: No» sugiere la fuente pública', () => {
    assert.equal(origenSugerido({ tipo_gestion: 'externa', requiere_nota: 0 }), 'fuente_publica');
  });

  it('un externo con Sí o sin dato no sugiere nada', () => {
    assert.strictEqual(origenSugerido({ tipo_gestion: 'externa', requiere_nota: null }), null);
    assert.strictEqual(origenSugerido({ tipo_gestion: 'externa', requiere_nota: undefined }), null);
    assert.strictEqual(origenSugerido({ tipo_gestion: 'externa', requiere_nota: 1 }), null);
  });

  it('el 0 se compara con ===: false y "0" no cuentan como No', () => {
    assert.strictEqual(origenSugerido({ tipo_gestion: 'externa', requiere_nota: false }), null);
    assert.strictEqual(origenSugerido({ tipo_gestion: 'externa', requiere_nota: '0' }), null);
  });

  it('en gestión interna no se pregunta el origen: nunca sugiere', () => {
    assert.strictEqual(origenSugerido({ tipo_gestion: 'interna', requiere_nota: 0 }), null);
    assert.strictEqual(origenSugerido({ tipo_gestion: 'interna', requiere_nota: null }), null);
  });

  it('sin dataset no sugiere nada y no tira', () => {
    assert.strictEqual(origenSugerido(), null);
    assert.strictEqual(origenSugerido({}), null);
  });
});

describe('rotuloDeLaFecha', () => {
  it('con la fuente pública la fecha es «Obtenido el»', () => {
    assert.equal(rotuloDeLaFecha('fuente_publica'), 'Obtenido el');
  });

  it('con el área, sin origen o con uno raro, es «Recibido el»', () => {
    for (const origen of ['area', null, undefined, '', 'otro']) {
      assert.equal(rotuloDeLaFecha(origen), 'Recibido el', String(origen));
    }
  });
});

describe('textoOrigen', () => {
  it('cada origen dice su texto corto', () => {
    assert.equal(textoOrigen('area'), 'Los entregó el área');
    assert.equal(textoOrigen('fuente_publica'), 'Fuente pública');
  });

  it('sin dato devuelve el texto que se le pide (por defecto, la raya)', () => {
    for (const valor of [null, undefined, '']) {
      assert.equal(textoOrigen(valor), '—', String(valor));
      assert.equal(textoOrigen(valor, 'Sin dato'), 'Sin dato', String(valor));
    }
  });

  it('un valor que no es un origen cuenta como sin dato y nunca tira', () => {
    assert.equal(textoOrigen('x'), '—');
    for (const valor of ['x', 'Fuente pública', 0, 1, {}, NaN]) {
      assert.equal(textoOrigen(valor, 'Sin dato'), 'Sin dato', String(valor));
    }
  });
});

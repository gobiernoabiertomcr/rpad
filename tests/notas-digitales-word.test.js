// La Nota Digital en Word (spec 2026-10-24-generador-de-notas, sección 6): los bloques del Word salen del HTML guardado de la nota
// (notas_digitales.html), tal como se envió, sin la primera línea del email y sin la firma, en la hoja membretada.
// Los HTML de prueba (tests/fixtures/notas-digitales-html/) los armaron construirNota y renderHtml con los datos de ejemplo()
// (notasDigitales.js) y firmas inventadas; aviso-interno-viejo.html está escrito a mano con la forma de la nota 1/26 (13/10/2026):
// sin la primera línea, una tabla de 6 columnas con "Última actualización" y la firma sin negrita.
// La API (GET /notificaciones/notas-digitales/:id/word), contra una base de prueba propia.
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// jszip llega con docx (lo usa para armar el .docx): acá abre el Word para leer su XML
import JSZip from 'jszip';
import { bloquesDeNotaDigital, NotaNoReconocida } from '../services/notasDigitalesWord.js';
import { renderDocx } from '../services/notasWord.js';
import {
  construirNota, construirNotaDeAutorizacion, renderHtml, AVISO_ADJUNTO, PROPORCIONES_EXTERNA, RENGLON_FIRMA_CONTRATADO
} from '../services/notasDigitalesContenido.js';
import { PROPORCIONES, PROPORCIONES_CON_SEGUNDA } from '../services/notasDigitalesPdf.js';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb } from './helpers.js';
import { crearNota } from './notas-fixtures.js';
import pool from '../config/database.js';
import { descargarWord } from '../controllers/notasDigitalesController.js';

const TIPO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SIN_REMITENTE = 'No se encontró el remitente de la nota.';
const SIN_FIRMA = 'No se encontró la firma de la nota.';
const REMITENTE = 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN';

const leer = (nombre) => fs.readFileSync(new URL(`./fixtures/notas-digitales-html/${nombre}.html`, import.meta.url), 'utf8');
const HTML = Object.freeze({
  avisoExterno: leer('aviso-externo'),
  dosFirmas: leer('reiteracion-externa-dos-firmas'),
  auditoria: leer('auditoria'),
  autorizacion: leer('autorizacion'),
  viejo: leer('aviso-interno-viejo')
});

// El texto de un bloque: sus partes (o las de sus celdas o ítems) unidas
const textoDePartes = (partes) => partes.map(p => p.texto).join('');
const textoDe = (bloque) => {
  if (bloque.tipo === 'parrafo') return textoDePartes(bloque.partes);
  if (bloque.tipo === 'tabla') return bloque.filas.flatMap(f => f.celdas.map(c => textoDePartes(c.partes))).join(' ');
  if (bloque.tipo === 'lista') return bloque.items.map(textoDePartes).join(' ');
  return '';
};
const indiceDeLaFirma = (bloques) => bloques.findIndex(b => b.tipo === 'firma');
const tablasDe = (bloques) => bloques.filter(b => b.tipo === 'tabla');
const encabezadoDe = (tabla) => tabla.filas[0].celdas.map(c => textoDePartes(c.partes));

// ---------------------------------------------------------------------------------------------------------------------------
// Cada HTML de prueba
// ---------------------------------------------------------------------------------------------------------------------------

describe('bloquesDeNotaDigital: cada HTML de prueba', () => {
  for (const [nombre, html] of Object.entries(HTML)) {
    describe(nombre, () => {
      const bloques = bloquesDeNotaDigital(html);
      const iFirma = indiceDeLaFirma(bloques);
      // La leyenda de las dos firmas cita a las dos personas: es lo único que puede nombrarlas
      const sinLaLeyenda = bloques.filter((_, i) => !(nombre === 'dosFirmas' && i === iFirma + 1));

      it('la firma no queda: ningún bloque tiene "Nombre Apellido" ni "Cargo" ni el renglón del personal contratado', () => {
        for (const bloque of sinLaLeyenda) {
          assert.ok(!textoDe(bloque).includes('Nombre Apellido'), textoDe(bloque));
          assert.ok(!textoDe(bloque).includes('Cargo'), textoDe(bloque));
        }
        assert.ok(bloques.every(b => !textoDe(b).includes(RENGLON_FIRMA_CONTRATADO)));
      });

      it('tiene un solo bloque firma, justo después del remitente, que se conserva con la fecha', () => {
        assert.equal(bloques.filter(b => b.tipo === 'firma').length, 1);
        assert.deepEqual(bloques[iFirma], { tipo: 'firma', columnas: nombre === 'dosFirmas' ? 2 : 1 });
        const remitente = bloques[iFirma - 1];
        assert.equal(remitente.tipo, 'parrafo');
        assert.match(textoDe(remitente), new RegExp(`^${REMITENTE}, \\d{1,2} de [a-z]+ de 2026\\.$`));
        assert.deepEqual(remitente.partes[0], { texto: REMITENTE, negrita: true, subrayado: true });
      });

      it('no tiene la primera línea del email: empieza en el REF', () => {
        assert.ok(textoDe(bloques[0]).startsWith('REF.: "'), textoDe(bloques[0]));
        assert.ok(bloques.every(b => !Object.values(AVISO_ADJUNTO).includes(textoDe(b))));
      });

      it('todas sus tablas van en 8,5 pt y con 3 pt de margen: una sola letra de tabla en la nota', () => {
        const tablas = tablasDe(bloques);
        assert.ok(tablas.length > 0 || nombre === 'autorizacion');
        for (const tabla of tablas) assert.deepEqual([tabla.letra, tabla.margen], [17, 60]);
      });

      it('renderDocx lo arma en la hoja oficio: abre con JSZip y su sección mide 12240 de ancho', async () => {
        const zip = await JSZip.loadAsync(await renderDocx(bloques, { membrete: null, pie: '' }));
        const documento = await zip.file('word/document.xml').async('string');
        assert.match(documento, /<w:pgSz w:w="12240" w:h="20160"/);
        assert.ok(!documento.includes('Personal contratado, cumpliendo funciones de'));
      });
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// La firma, la leyenda y el CC
// ---------------------------------------------------------------------------------------------------------------------------

describe('bloquesDeNotaDigital: después del remitente', () => {
  it('con dos firmas: las dos columnas, la leyenda en cursiva (se conserva) y el CC', () => {
    const bloques = bloquesDeNotaDigital(HTML.dosFirmas);
    const iFirma = indiceDeLaFirma(bloques);
    assert.equal(bloques.length, iFirma + 3);
    const [leyenda, cc] = bloques.slice(iFirma + 1);
    assert.equal(leyenda.tipo, 'parrafo');
    assert.equal(leyenda.alinear, 'justificado');
    assert.equal(leyenda.antes, 180);
    assert.ok(leyenda.partes.every(p => p.cursiva === true && p.letra === 18));
    assert.equal(textoDe(leyenda), 'Nota presentada por Nombre Apellido Dos, personal contratado, cumpliendo funciones de Cargo Dos, en nombre de '
      + 'Nombre Apellido, Cargo, conforme a la autorización conferida mediante Nota Digital N° 8/26 (licencia del 26/10/2026 al 13/11/2026).');
    assert.deepEqual(cc, { tipo: 'parrafo', alinear: 'izquierda', antes: 360, despues: 0, partes: [{ texto: 'CC. Dir. Administrativa' }] });
  });

  it('la autorización tiene el CC vacío: termina en la firma, sin un párrafo vacío al final', () => {
    const bloques = bloquesDeNotaDigital(HTML.autorizacion);
    assert.deepEqual(bloques.at(-1), { tipo: 'firma', columnas: 1 });
    assert.ok(bloques.every(b => b.tipo !== 'parrafo' || textoDe(b).trim() !== ''));
  });

  it('la vieja: la firma sin negrita es una firma de una columna, y el CC se conserva', () => {
    const bloques = bloquesDeNotaDigital(HTML.viejo);
    const iFirma = indiceDeLaFirma(bloques);
    assert.deepEqual(bloques[iFirma], { tipo: 'firma', columnas: 1 });
    assert.equal(bloques.length, iFirma + 2);
    assert.equal(textoDe(bloques.at(-1)), 'CC. Dir. de Investigación Territorial');
  });

  it('lo que va después del remitente y no es la firma, la leyenda ni el último párrafo no se lee', () => {
    const html = `<html><body><div><p>Texto.</p>
<p style="margin:24px 0 0;"><b><u>${REMITENTE}</u></b>, 2 de noviembre de 2026.</p>
<p style="margin:32px 0 0;text-align:right;"><b>Nombre Apellido</b><br><span style="font-size:14px">Cargo</span></p>
<p style="margin:4px 0 0;">Cargo de más</p>
<p style="margin:24px 0 0;">CC. Dir. Administrativa</p></div></body></html>`;
    const bloques = bloquesDeNotaDigital(html);
    assert.deepEqual(bloques.map(textoDe), ['Texto.', `${REMITENTE}, 2 de noviembre de 2026.`, '', 'CC. Dir. Administrativa']);
  });

  // Falla cerrado, como con el remitente: nunca una firma inventada ni un CC que no lo es
  it('sin la firma justo después del remitente tira NotaNoReconocida, aunque haya una firma más abajo', () => {
    const remitente = `<p style="margin:24px 0 0;"><b><u>${REMITENTE}</u></b>, 2 de noviembre de 2026.</p>`;
    const firma = '<p style="margin:32px 0 0;text-align:right;">Nombre Apellido<br>Cargo</p>';
    const cc = '<p style="margin:24px 0 0;">CC. Dir. Administrativa</p>';
    for (const despues of [
      cc,
      '',
      `<p style="margin:24px 0 0;text-align:right;">Nombre Apellido<br>Cargo</p>${cc}`,
      `<p>Otra cosa</p>${firma}${cc}`,
      `<ul><li>Cargo</li></ul>${firma}${cc}`
    ]) {
      const html = `<html><body><div><p>REF.</p>${remitente}${despues}</div></body></html>`;
      assert.throws(() => bloquesDeNotaDigital(html), (error) => error instanceof NotaNoReconocida && error.message === SIN_FIRMA, despues);
    }
  });

  it('el remitente es el último párrafo que empieza con el de la Dirección', () => {
    const html = `<html><body><div><p>${REMITENTE} (una mención en el cuerpo)</p>
<p style="margin:24px 0 0;"><b><u>${REMITENTE}</u></b>, 2 de noviembre de 2026.</p>
<p style="margin:32px 0 0;text-align:right;">Firma</p><p style="margin:24px 0 0;"></p></div></body></html>`;
    const bloques = bloquesDeNotaDigital(html);
    assert.deepEqual(bloques.map(b => b.tipo), ['parrafo', 'parrafo', 'firma']);
    assert.equal(textoDe(bloques[0]), `${REMITENTE} (una mención en el cuerpo)`);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// La primera línea, el remitente que falta y el texto
// ---------------------------------------------------------------------------------------------------------------------------

const conCuerpo = (cuerpo) => `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>T</title></head><body><div>${cuerpo}
<p style="margin:24px 0 0;"><b><u>${REMITENTE}</u></b>, 2 de noviembre de 2026.</p>
<p style="margin:32px 0 0;text-align:right;">Firma</p>
<p style="margin:24px 0 0;">CC</p></div></body></html>`;

describe('bloquesDeNotaDigital: la primera línea del email y el remitente', () => {
  it('quita la primera línea por su color bordó o por su texto, aunque no tenga el color', () => {
    for (const primera of [
      '<p style="margin:0 0 20px;color:#800000;font-weight:bold;">Otro texto</p>',
      `<p>${AVISO_ADJUNTO.soloNota}</p>`,
      `<p style="margin:0 0 20px;">${AVISO_ADJUNTO.conAnexo}</p>`
    ]) {
      const bloques = bloquesDeNotaDigital(conCuerpo(`${primera}<p>REF.</p>`));
      assert.equal(textoDe(bloques[0]), 'REF.', primera);
    }
  });

  it('solo quita el primer bloque: un párrafo bordó más abajo se conserva', () => {
    const bloques = bloquesDeNotaDigital(conCuerpo('<p>REF.</p><p style="color:#800000;">Bordó</p>'));
    assert.deepEqual(bloques.slice(0, 2).map(textoDe), ['REF.', 'Bordó']);
  });

  it('un HTML sin el remitente tira (y uno vacío o null, también)', () => {
    for (const html of [
      '', null, undefined, '<p>Hola</p>',
      '<html><body><div><p>REF.</p><p style="margin:24px 0 0;"><b>OTRA DIRECCIÓN</b>, 2 de noviembre de 2026.</p></div></body></html>',
      conCuerpo('').replace('<div>', '<section>').replace('</div>', '</section>')
    ]) {
      assert.throws(() => bloquesDeNotaDigital(html), (error) => error instanceof NotaNoReconocida && error.message === SIN_REMITENTE, String(html));
    }
  });
});

describe('bloquesDeNotaDigital: los párrafos', () => {
  const bloques = bloquesDeNotaDigital(HTML.dosFirmas);

  it('el REF: negrita y subrayado, y el margen en twips (px × 15)', () => {
    assert.deepEqual(bloques[0], {
      tipo: 'parrafo', alinear: 'izquierda', antes: 0, despues: 60,
      partes: [{ texto: 'REF.:', negrita: true, subrayado: true }, { texto: ' "Reiteración – Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal"' }]
    });
  });

  it('el número, a la derecha; el párrafo inicial, justificado', () => {
    assert.deepEqual(bloques[1], {
      tipo: 'parrafo', alinear: 'derecha', antes: 0, despues: 360, partes: [{ texto: 'Nota Digital N°', negrita: true }, { texto: ' 9/26' }]
    });
    assert.equal(bloques[3].alinear, 'justificado');
    assert.equal(bloques[3].despues, 180);
  });

  it('los datos de contacto: el nombre en negrita y cada renglón con su salto', () => {
    const contacto = bloques.find(b => b.tipo === 'parrafo' && textoDe(b).startsWith('Área de ejemplo'));
    assert.deepEqual(contacto.partes, [
      { texto: 'Área de ejemplo', negrita: true },
      { texto: 'Depende de: Secretaría de ejemplo', salto: true },
      { texto: 'Email: x@ejemplo.gob.ar', salto: true },
      { texto: 'Teléfono: 297 400-0000', salto: true },
      { texto: 'Persona de contacto: Persona de contacto', salto: true }
    ]);
  });

  it('las cinco entidades de escapeHtml, decodificadas (también "&amp;lt;", que es "&lt;")', () => {
    const [parrafo] = bloquesDeNotaDigital(conCuerpo('<p>&amp; &lt;b&gt; &quot;x&quot; d&#39;a &amp;lt;</p>'));
    assert.equal(textoDe(parrafo), '& <b> "x" d\'a &lt;');
  });

  it('un link es su texto; cursiva, letras de 15, 13, 12 y 11 px y los espacios del HTML juntados', () => {
    const [parrafo] = bloquesDeNotaDigital(conCuerpo(`<p style="margin:16px 0 6px;text-align:center;">
      <a href="https://x" style="color:#000000;">Link</a> <span style="font-style:italic">cursiva</span>
      <span style="font-size:15px">a</span><span style="font-size:13px">b</span><span style="font-size:12px">c</span><span style="font-size:11px">d</span></p>`));
    assert.deepEqual(parrafo, {
      tipo: 'parrafo', alinear: 'centro', antes: 240, despues: 90,
      partes: [
        { texto: 'Link' }, { texto: ' ' }, { texto: 'cursiva', cursiva: true }, { texto: ' ' },
        { texto: 'a', letra: 24 }, { texto: 'b', letra: 20 }, { texto: 'c', letra: 18 }, { texto: 'd', letra: 16 }
      ]
    });
  });

  it('la lista de la auditoría: un ítem por <li>', () => {
    const lista = bloquesDeNotaDigital(HTML.auditoria).find(b => b.tipo === 'lista');
    assert.equal(lista.items.length, 4);
    assert.equal(textoDePartes(lista.items[0]), 'los datos coincidan con la información remitida por el área responsable;');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Las tablas
// ---------------------------------------------------------------------------------------------------------------------------

describe('bloquesDeNotaDigital: las tablas', () => {
  it('la vieja: 6 columnas con PROPORCIONES[6] en 8,5 pt, el encabezado en negrita y el antecedente, a todo el ancho, con su dataset', () => {
    const [tabla] = tablasDe(bloquesDeNotaDigital(HTML.viejo));
    assert.equal(tabla.anchos.length, 6);
    assert.deepEqual(tabla.anchos, PROPORCIONES[6]);
    assert.equal(tabla.letra, 17);
    assert.equal(tabla.margen, 60);
    assert.equal(tabla.sinPartirPalabras, true);
    assert.deepEqual(encabezadoDe(tabla), ['Conjunto de datos', 'Área', 'Frecuencia', 'Última actualización', 'Venció', 'Situación']);
    assert.equal(tabla.filas[0].encabezado, true);
    assert.ok(tabla.filas[0].celdas.every(c => c.partes.every(p => p.negrita === true)));
    // El dataset (con el link y las entidades decodificadas), su antecedente en cursiva a todo el ancho (12 px, 9 pt, achicado
    // como la tabla: 7,5 pt), y el siguiente
    const [, dataset, antecedente, otro] = tabla.filas;
    assert.equal(dataset.conLaSiguiente, true);
    assert.equal(textoDePartes(otro.celdas[0].partes), 'Dataset de ejemplo dos & "tres"');
    assert.equal(antecedente.celdas.length, 1);
    assert.equal(antecedente.celdas[0].abarca, 6);
    assert.equal(antecedente.celdas[0].letra, 15);
    assert.ok(antecedente.celdas[0].partes.every(p => p.cursiva === true));
    assert.equal(antecedente.conLaSiguiente, undefined);
  });

  it('el aviso externo: 5 columnas con PROPORCIONES[5], en 8,5 pt (13 px, achicado) y el antecedente (12 px) en 7,5 pt', () => {
    const [tabla] = tablasDe(bloquesDeNotaDigital(HTML.avisoExterno));
    assert.deepEqual(tabla.anchos, PROPORCIONES[5]);
    assert.equal(encabezadoDe(tabla)[3], 'Requiere nota DGMIT');
    assert.equal(tabla.letra, 17);
    assert.equal(tabla.margen, 60);
    assert.equal(tabla.filas[2].celdas[0].letra, 15);
  });

  it('la reiteración externa: PROPORCIONES_EXTERNA con la segunda parte de "Informado en" y sin ella, en 8,5 pt y con 3 pt de margen', () => {
    const [proximos, vencidos] = tablasDe(bloquesDeNotaDigital(HTML.dosFirmas));
    assert.deepEqual(proximos.anchos, PROPORCIONES_EXTERNA.conSegunda);
    assert.deepEqual(vencidos.anchos, PROPORCIONES_EXTERNA.sinSegunda);
    for (const tabla of [proximos, vencidos]) {
      assert.equal(tabla.letra, 17);
      assert.equal(tabla.margen, 60);
      assert.equal(tabla.sinPartirPalabras, true);
    }
    // La situación, debajo de la fecha; la segunda parte de "Informado en", en un renglón propio y más chica (7 pt, la del PDF)
    const celdas = proximos.filas[1].celdas;
    assert.deepEqual(celdas[5].partes, [{ texto: '30/11/2026' }, { texto: 'Faltan 28 días', salto: true }]);
    assert.deepEqual(celdas[6].partes[0], { texto: 'Nota Digital N°\u00a01/26 (03/10/2026).' });
    assert.equal(celdas[6].partes[1].salto, true);
    assert.equal(celdas[6].partes[1].letra, 14);
    assert.match(celdas[6].partes[1].texto, /^Anteriormente notificado DGMIT/);
  });

  it('la auditoría: 5 y 6 columnas con PROPORCIONES, y las del detalle, parejas y sin ensanchar; todas en 8,5 pt', () => {
    const tablas = tablasDe(bloquesDeNotaDigital(HTML.auditoria));
    const porColumnas = (n) => tablas.filter(t => t.anchos.length === n);
    assert.deepEqual(porColumnas(5)[0].anchos, PROPORCIONES[5]);
    assert.deepEqual(porColumnas(6)[0].anchos, PROPORCIONES[6]);
    assert.ok(tablas.every(t => t.letra === 17 && t.margen === 60));
    for (const tabla of [...porColumnas(3), ...porColumnas(2)]) {
      assert.ok(tabla.anchos.every(a => Math.abs(a - 100 / tabla.anchos.length) < 1e-9));
      assert.equal(tabla.sinPartirPalabras, undefined);
    }
    assert.ok(porColumnas(3).length > 0 && porColumnas(2).length > 0);
  });

  // Con el código de hoy (renderHtml): la reiteración interna tiene 7 columnas, sin "Requiere nota DGMIT"
  it('la reiteración interna de hoy: PROPORCIONES_CON_SEGUNDA[7] con la segunda parte y PROPORCIONES[7] sin ella', () => {
    const dataset = (cambios) => ({
      id: 1, titulo: 'Dataset', area_nombre: 'Área', frecuencia_nombre: 'Trimestralmente', tipo_pedido: 'relevamiento', meses: 3,
      vencimiento: '2026-10-31', pedido: { texto: 'Relevamiento actualizado' }, informado: { numero: 1, anio: 2026, fecha: '2026-10-01' },
      reiteraciones: 0, antecedente: null, ...cambios
    });
    const html = (datasets) => renderHtml(construirNota({
      tipo: 'reiteracion', gestion: 'interna', numero: 9, anio: 2026, fecha: '2026-11-02', datasets,
      config: { linea_cc_interna: 'CC. Dir. de Investigación Territorial' }, firma: { titular: { nombre: 'Nombre Apellido', cargo: 'Cargo' } }
    }));
    const [sinSegunda] = tablasDe(bloquesDeNotaDigital(html([dataset()])));
    const [conSegunda] = tablasDe(bloquesDeNotaDigital(html([dataset({ antecedente: { cantidad: 1, primera: '2026-09-01', ultima: '2026-09-01' } })])));
    assert.deepEqual(sinSegunda.anchos, PROPORCIONES[7]);
    assert.deepEqual(conSegunda.anchos, PROPORCIONES_CON_SEGUNDA[7]);
    assert.equal(sinSegunda.letra, 17);
    assert.equal(conSegunda.letra, 17);
  });

  it('un vencimiento que abre un grupo (en negrita, a todo el ancho) va con la fila de su dataset', () => {
    const fila = (titulo) => `<tr><td>${titulo}</td><td>Área</td><td>Anualmente</td><td>Del 01/01/2026 al 31/10/2026</td></tr>`;
    const html = conCuerpo(`<table style="font-size:13px;"><tr><th>Conjunto de datos</th><th>Área</th><th>Frecuencia</th><th>Datos solicitados</th></tr>
<tr><td colspan="4" style="font-weight:bold;">Vence el 30/11/2026</td></tr>${fila('Uno')}<tr><td colspan="4" style="font-weight:bold;">Vencen el 31/12/2026</td></tr>${fila('Dos')}${fila('Tres')}</table>`);
    const [tabla] = tablasDe(bloquesDeNotaDigital(html));
    assert.deepEqual(tabla.anchos, PROPORCIONES[4]);
    assert.deepEqual(tabla.filas.map(f => f.conLaSiguiente === true), [false, true, false, true, false, false]);
    assert.deepEqual(tabla.filas[1].celdas, [{ partes: [{ texto: 'Vence el 30/11/2026', negrita: true }], abarca: 4 }]);
  });

  // Como en el PDF (conFechasJuntas): "Del" sola arriba y "N°" con el número abajo no van en una nota formal
  it('en las celdas, salvo la del título, «Del» y «al» van con su fecha y «N°» con su número, con un espacio duro', () => {
    const [proximos] = tablasDe(bloquesDeNotaDigital(HTML.dosFirmas));
    const [titulo, , , , pedido] = proximos.filas[1].celdas;
    assert.equal(textoDePartes(pedido.partes), 'Del\u00a001/11/2025 al\u00a031/10/2026');
    const html = conCuerpo('<table><tr><td>Del 01/01/2026 al 31/03/2026 N° 3</td><td>Del 01/01/2026, N° 3/26</td><td colspan="1">x</td><td>y</td></tr></table>');
    const [tabla] = tablasDe(bloquesDeNotaDigital(html));
    assert.deepEqual(tabla.filas[0].celdas.slice(0, 2).map(c => textoDePartes(c.partes)), ['Del 01/01/2026 al 31/03/2026 N° 3', 'Del\u00a001/01/2026, N°\u00a03/26']);
    assert.equal(textoDePartes(titulo.partes), 'Dataset de ejemplo próximo a vencer');
  });

  it('otra cantidad de columnas: anchos parejos', () => {
    const [tabla] = tablasDe(bloquesDeNotaDigital(conCuerpo('<table><tr><td>a</td><td>b</td><td>c</td></tr></table>')));
    assert.ok(tabla.anchos.every(a => Math.abs(a - 100 / 3) < 1e-9));
  });
});

// Con el código de hoy: la nota de autorización que arma renderHtml se reconoce (el remitente y la firma)
describe('bloquesDeNotaDigital: el HTML que arma hoy renderHtml', () => {
  it('reconoce la nota de autorización recién armada', () => {
    const html = renderHtml(construirNotaDeAutorizacion({
      numero: 3, anio: 2026, fecha: '2026-11-02', firma: { titular: { nombre: 'Nombre Apellido', cargo: 'Cargo' } },
      autorizacion: { nombre: 'Persona Autorizada', cargo: 'Coordinación de ejemplo', desde: '2026-11-16', hasta: '2026-11-27' }
    }));
    const bloques = bloquesDeNotaDigital(html);
    assert.deepEqual(bloques.map(b => b.tipo), ['parrafo', 'parrafo', 'parrafo', 'parrafo', 'parrafo', 'firma']);
    assert.ok(bloques.every(b => !textoDe(b).includes('Nombre Apellido')));
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// La API
// ---------------------------------------------------------------------------------------------------------------------------

describe('GET /notificaciones/notas-digitales/:id/word', () => {
  let base, servidor, api, usuarios, dbReal;
  const ids = {};

  before(async () => {
    dbReal = process.env.DB_NAME;
    base = await crearBaseDePrueba('rpad_test_notas_digitales_word');
    process.env.DB_NAME = base.nombre;
    servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
    api = crearCliente(servidor.url);
    usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', lector: 'lector', colab: 'colaborador' });
    ids.reiteracion = await crearNota({ tipo: 'reiteracion', gestion: 'externa', fecha: '2026-11-02', numero: 9, anio: 2026, html: HTML.dosFirmas });
    ids.prueba = await crearNota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-11-02', esPrueba: 1, html: HTML.avisoExterno });
    ids.sinRemitente = await crearNota({ tipo: 'aviso', gestion: 'interna', fecha: '2026-11-02', numero: 10, anio: 2026, html: '<p>Hola</p>' });
    // La 1/26 sin el bloque de la firma: el remitente y, enseguida, el CC
    const sinFirma = HTML.viejo.replace(/<p style="margin:32px 0 0;text-align:right;">Nombre Apellido<br>Cargo<\/p>\r?\n/, '');
    assert.notEqual(sinFirma, HTML.viejo);
    ids.sinFirma = await crearNota({ tipo: 'aviso', gestion: 'interna', fecha: '2026-10-13', numero: 1, anio: 2026, html: sinFirma });
  });

  after(async () => {
    await limpiarDatosPrueba(usuarios);
    await cerrarDb();
    await servidor?.detener();
    // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
    if (dbReal === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = dbReal;
    await base?.borrar();
  });

  const comoAdmin = () => ({ token: usuarios.adminA.token });

  it('administración baja el Word: «Nota-Digital-9-26.docx», en la hoja oficio, sin la firma y con la leyenda', async () => {
    const res = await api.get(`/notificaciones/notas-digitales/${ids.reiteracion}/word`, comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), TIPO_WORD);
    assert.match(res.headers.get('content-disposition'), /Nota-Digital-/);
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="Nota-Digital-9-26.docx"; filename*=UTF-8\'\'Nota-Digital-9-26.docx');
    const documento = await (await JSZip.loadAsync(res.body)).file('word/document.xml').async('string');
    assert.match(documento, /<w:pgSz w:w="12240" w:h="20160"/);
    assert.ok(documento.includes('Nota Digital N°'));
    assert.ok(documento.includes('conforme a la autorización conferida mediante Nota Digital N° 8/26'));
    assert.ok(!documento.includes(AVISO_ADJUNTO.conAnexo));
    assert.ok(!documento.includes(RENGLON_FIRMA_CONTRATADO));
  });

  it('una nota de prueba se llama «Nota-Digital-PRUEBA-<id>.docx», como su PDF en el Libro', async () => {
    const res = await api.get(`/notificaciones/notas-digitales/${ids.prueba}/word`, comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), new RegExp(`^attachment; filename="Nota-Digital-PRUEBA-${ids.prueba}\\.docx"`));
  });

  it('el lector y el colaborador reciben 403; sin sesión, 401', async () => {
    for (const usuario of [usuarios.lector, usuarios.colab]) {
      const res = await api.get(`/notificaciones/notas-digitales/${ids.reiteracion}/word`, { token: usuario.token });
      assert.equal(res.status, 403, usuario.rol);
    }
    assert.equal((await api.get(`/notificaciones/notas-digitales/${ids.reiteracion}/word`)).status, 401);
  });

  it('una nota cuyo HTML no tiene el remitente da 422 con el mensaje, nunca un Word roto', async () => {
    const res = await api.get(`/notificaciones/notas-digitales/${ids.sinRemitente}/word`, comoAdmin());
    assert.equal(res.status, 422);
    assert.deepEqual(res.body, { success: false, error: SIN_REMITENTE });
  });

  it('una nota cuyo HTML no tiene la firma da 422 con el mensaje, nunca una firma inventada', async () => {
    const res = await api.get(`/notificaciones/notas-digitales/${ids.sinFirma}/word`, comoAdmin());
    assert.equal(res.status, 422);
    assert.deepEqual(res.body, { success: false, error: SIN_FIRMA });
  });

  it('una nota que no existe da 404 (también un id que no es un número)', async () => {
    for (const id of [999999, 'abc']) {
      const res = await api.get(`/notificaciones/notas-digitales/${id}/word`, comoAdmin());
      assert.equal(res.status, 404, String(id));
      assert.deepEqual(res.body, { success: false, error: 'Nota no encontrada' });
    }
  });
});

// El controlador, sin servidor: la base se simula (mock de pool.query) para hacer fallar el conversor con un error que no es
// NotaNoReconocida. El HTML guardado de una nota real no lo provoca (siempre es texto): acá la fila trae un HTML que al
// convertirlo en texto tira
describe('descargarWord: un error inesperado del conversor', () => {
  it('es un 500 con el mensaje del controlador y se registra, nunca un 422', async () => {
    const inesperado = new Error('Falla inesperada');
    const html = { toString: () => { throw inesperado; } };
    const consulta = mock.method(pool, 'query', async () => [[{ numero: 9, anio: 2026, es_prueba: 0, html }]]);
    const registro = mock.method(console, 'error', () => {});
    try {
      const res = {
        estado: null,
        cuerpo: null,
        status(codigo) { this.estado = codigo; return this; },
        json(cuerpo) { this.cuerpo = cuerpo; return this; },
        setHeader() { throw new Error('No debería armar un Word'); },
        send() { throw new Error('No debería armar un Word'); }
      };
      await descargarWord({ params: { id: '9' } }, res);
      assert.equal(res.estado, 500);
      assert.deepEqual(res.cuerpo, { success: false, error: 'Error al descargar el Word' });
      assert.equal(consulta.mock.callCount(), 1);
      assert.equal(registro.mock.callCount(), 1);
      assert.equal(registro.mock.calls[0].arguments[1], inesperado);
    } finally {
      consulta.mock.restore();
      registro.mock.restore();
    }
  });
});

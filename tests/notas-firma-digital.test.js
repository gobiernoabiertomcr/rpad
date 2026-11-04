// La firma digital de las Notas Digitales, lo puro (spec 2026-11-03-notas-firma-digital, 4): si un PDF subido es esa nota firmada, y qué nota
// espera. Con las fixtures de tests/fixtures/firma-digital/: PDF con datos inventados, firmados una vez con certificados de prueba, en la
// forma en que firma el Firmador. Las notas reales firmadas no se versionan
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  HORA_LIMITE_DE_FIRMA, HORA_DE_LA_ALERTA_DE_FIRMA, esperaDeMas, paso14, debeEsperarFirma, leerFirmaAgregada, verificarNotaFirmada, mensajeDelRechazo, numeroDeLaNota, archivoDeLaNota,
  textoDeLaLineaDeFirma, conLineaDeFirma, revisionDelCertificado, puedeReintentarLaQueEspera
} from '../services/notasFirmaDigital.js';
import { bloquesDeNotaDigital } from '../services/notasDigitalesWord.js';
import { construirNota, renderHtml } from '../services/notasDigitalesContenido.js';

const leer = (archivo) => fs.readFileSync(new URL(`./fixtures/firma-digital/${archivo}`, import.meta.url));
const A = { numero: 12, anio: 2026, pdf: leer('nota-a.pdf') };
const B = { numero: 13, anio: 2026, pdf: leer('nota-b.pdf') };
const FIRMADA_A = leer('nota-a-firmada.pdf');
const FIRMADA_B = leer('nota-b-firmada.pdf');
const C = { numero: 14, anio: 2026, pdf: leer('nota-c.pdf') };
const FIRMADA_C = leer('nota-c-firmada.pdf');

// Una copia de la firmada de A con un texto reemplazado por otro del mismo largo (los rangos no se corren)
const conTexto = (de, por) => {
  const inicio = FIRMADA_A.indexOf(de, A.pdf.length, 'latin1');
  assert.ok(inicio > 0, `No está: ${de}`);
  const copia = Buffer.from(FIRMADA_A);
  copia.write(por.padEnd(de.length, ' '), inicio, 'latin1');
  return copia;
};
const rango = () => /\/ByteRange \[0 (\d+) (\d+) (\d+) *\]/.exec(FIRMADA_A.toString('latin1'));
const conRango = (a, b, c, d) => conTexto(rango()[0], `/ByteRange [${a} ${b} ${c} ${d} `.padEnd(rango()[0].length - 1, ' ') + ']');

describe('las fixtures tienen la forma de lo que firma el Firmador', () => {
  it('la firmada empieza con el original y agrega una firma invisible, con su relleno de ceros', () => {
    assert.ok(FIRMADA_A.subarray(0, A.pdf.length).equals(A.pdf));
    const agregado = FIRMADA_A.subarray(A.pdf.length).toString('latin1');
    assert.match(agregado, /\/Filter\/Adobe\.PPKLite/);
    assert.match(agregado, /\/SubFilter\/adbe\.pkcs7\.detached/);
    assert.match(agregado, /\/Rect\[0 0 0 0\]/);
    const [, b, c] = rango().map(Number);
    assert.equal(c - b - 2, 30000);
    assert.match(FIRMADA_A.subarray(c - 200, c - 1).toString('latin1'), /^0+$/);
  });

  it('la clave privada no se versiona', () => {
    for (const archivo of fs.readdirSync(new URL('./fixtures/firma-digital/', import.meta.url))) {
      assert.doesNotMatch(leer(archivo).toString('latin1'), /PRIVATE KEY-----/, archivo);
      assert.doesNotMatch(archivo, /\.(pem|key|p12|pfx)$/, archivo);
    }
  });
});

describe('verificarNotaFirmada', () => {
  it('la firmada, en la fila de su nota: quién firmó y cuándo, en hora argentina', () => {
    const r = verificarNotaFirmada(FIRMADA_A, A, [B]);
    assert.equal(r.resultado, 'firmada');
    assert.equal(r.firmado_por, 'Julieta Ferreyra');
    assert.match(r.firmado_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('un nombre con acentos y eñes llega tal cual', () => {
    assert.equal(verificarNotaFirmada(FIRMADA_B, B).firmado_por, 'José Núñez');
  });

  it('si el CMS trae más de un certificado, firmó aquel cuya clave verifica, aunque no vaya primero', () => {
    const r = verificarNotaFirmada(FIRMADA_C, C);
    assert.equal(r.resultado, 'firmada');
    assert.equal(r.firmado_por, 'Julieta Ferreyra');
  });

  it('la firmada de otra nota, en esta fila: la nombra, si se la puede nombrar', () => {
    const r = verificarNotaFirmada(FIRMADA_B, A, [B]);
    assert.equal(r.resultado, 'otra_nota');
    assert.equal(r.otra, B);
    assert.equal(verificarNotaFirmada(FIRMADA_B, A, []).resultado, 'no_es');
    assert.equal(verificarNotaFirmada(FIRMADA_B, A, 'nada').resultado, 'no_es');
  });

  it('el PDF original tal cual, o con algo agregado sin firma: no tiene firma', () => {
    assert.equal(verificarNotaFirmada(A.pdf, A).resultado, 'sin_firma');
    assert.equal(verificarNotaFirmada(Buffer.concat([A.pdf, Buffer.from('\nnada')]), A).resultado, 'sin_firma');
    assert.equal(verificarNotaFirmada(conTexto('/ByteRange', '/ByteRangX'), A).resultado, 'sin_firma');
  });

  it('otro PDF, o lo que no es un archivo: no es esta nota, sin tirar', () => {
    assert.equal(verificarNotaFirmada(Buffer.from('%PDF-1.3 otra cosa'), A).resultado, 'no_es');
    for (const raro of [Buffer.alloc(0), null, undefined, 'texto', 12, {}]) {
      assert.equal(verificarNotaFirmada(raro, A, [B]).resultado, 'no_es', String(raro));
    }
    for (const nota of [null, undefined, {}, { pdf: 'texto' }, { pdf: Buffer.alloc(0) }]) {
      assert.equal(verificarNotaFirmada(FIRMADA_A, nota).resultado, 'no_es');
    }
  });

  it('un byte cambiado en lo original ya no es esta nota', () => {
    const copia = Buffer.from(FIRMADA_A);
    copia[100] ^= 1;
    assert.equal(verificarNotaFirmada(copia, A).resultado, 'no_es');
  });

  it('un byte cambiado en lo agregado, en lo que cubre la firma, no verifica', () => {
    const copia = Buffer.from(FIRMADA_A);
    copia[A.pdf.length + 3] ^= 1;
    assert.equal(verificarNotaFirmada(copia, A).resultado, 'firma_invalida');
    const alFinal = Buffer.from(FIRMADA_A);
    alFinal[alFinal.length - 3] ^= 1;
    assert.equal(verificarNotaFirmada(alFinal, A).resultado, 'firma_invalida');
  });

  it('un byte cambiado en la firma RSA, en los atributos firmados o en la estructura no verifica', () => {
    const [, b, c] = rango().map(Number);
    const hexadecimal = FIRMADA_A.subarray(b + 1, c - 1).toString('latin1');
    const finDelCms = hexadecimal.replace(/0+$/, '').length;
    // La firma RSA es lo último del CMS; los atributos firmados, justo antes (el certificado va antes de ellos)
    for (const posicion of [b + 1 + finDelCms - 10, b + 1 + finDelCms - 600, b + 1 + 3]) {
      const copia = Buffer.from(FIRMADA_A);
      copia[posicion] = copia[posicion] === 0x41 ? 0x42 : 0x41;
      assert.equal(verificarNotaFirmada(copia, A).resultado, 'firma_invalida', String(posicion - b));
    }
  });

  it('un relleno que no son ceros, o algo que no es hexadecimal, no verifica', () => {
    const [, , c] = rango().map(Number);
    const relleno = Buffer.from(FIRMADA_A);
    relleno[c - 10] = 0x31;
    assert.equal(verificarNotaFirmada(relleno, A).resultado, 'firma_invalida');
    const noHex = Buffer.from(FIRMADA_A);
    noHex[c - 10] = 0x5a;
    assert.equal(verificarNotaFirmada(noHex, A).resultado, 'firma_invalida');
  });

  it('un /ByteRange que no cubre todo, o que no está en lo agregado, no verifica', () => {
    const [, b, c, d] = rango().map(Number);
    assert.equal(verificarNotaFirmada(conRango(1, b, c, d), A).resultado, 'firma_invalida', 'no empieza en 0');
    assert.equal(verificarNotaFirmada(conRango(0, b, c, d - 1), A).resultado, 'firma_invalida', 'no llega al final');
    assert.equal(verificarNotaFirmada(conRango(0, 100, c, d), A).resultado, 'firma_invalida', 'corta dentro del original');
    assert.equal(verificarNotaFirmada(conRango(0, b, b, d), A).resultado, 'firma_invalida', 'al revés');
  });

  it('otra versión guardada antes de firmar (más de un %%EOF en lo agregado): con cambios, aunque la firma verifique', () => {
    // Una actualización más entre el original y la firma, como la deja un comentario o «Fill & Sign»
    const conOtra = Buffer.concat([A.pdf, Buffer.from('\n99 0 obj\n<<>>\nendobj\nstartxref\n1\n%%EOF\n', 'latin1'), FIRMADA_A.subarray(A.pdf.length)]);
    assert.deepEqual(verificarNotaFirmada(conOtra, A), { resultado: 'con_cambios' });
    assert.equal(leerFirmaAgregada(conOtra, A.pdf.length).motivo, 'con_cambios');
    assert.equal(mensajeDelRechazo({ resultado: 'con_cambios' }, A), 'Ese PDF se guardó con cambios antes de firmarlo. Firmá la nota tal como te llegó. No se guardó nada.');
    // Sin firma, sigue diciendo que no tiene firma; la firmada de verdad tiene uno solo
    assert.deepEqual(verificarNotaFirmada(Buffer.concat([A.pdf, Buffer.from('\nstartxref\n1\n%%EOF\n', 'latin1')]), A), { resultado: 'sin_firma' });
    assert.equal(FIRMADA_A.subarray(A.pdf.length).toString('latin1').split('%%EOF').length, 2);
    assert.equal(verificarNotaFirmada(FIRMADA_A, A).resultado, 'firmada');
  });

  it('esperaDeMas: de un día anterior, o de hoy pasadas las 14:15', () => {
    assert.equal(HORA_DE_LA_ALERTA_DE_FIRMA, '14:15');
    assert.equal(esperaDeMas('2026-12-01', '2026-12-02', '2026-12-02 07:00:00'), true);
    assert.equal(esperaDeMas('2026-12-02', '2026-12-02', '2026-12-02 14:14:59'), false);
    assert.equal(esperaDeMas('2026-12-02', '2026-12-02', '2026-12-02 14:15:00'), true);
    assert.equal(esperaDeMas('2026-12-02', '2026-12-02', '2026-11-04 20:00:00'), false, 'un ahora de otro día no dice la hora de hoy');
    assert.equal(esperaDeMas('2026-12-02', '2026-12-02', null), false);
  });

  it('bytes agregados después de la firma no verifican', () => {
    assert.equal(verificarNotaFirmada(Buffer.concat([FIRMADA_A, Buffer.from('\n')]), A).resultado, 'firma_invalida');
  });

  it('una firma vieja seguida de otra: manda la última, y si es mala, no verifica', () => {
    const conOtra = Buffer.concat([FIRMADA_A, Buffer.from('\n/ByteRange [0 1 2 3 ]')]);
    assert.equal(verificarNotaFirmada(conOtra, A).resultado, 'firma_invalida');
  });
});

describe('leerFirmaAgregada', () => {
  it('nunca tira, con lo que sea', () => {
    assert.equal(leerFirmaAgregada(FIRMADA_A, A.pdf.length).ok, true);
    assert.equal(leerFirmaAgregada(FIRMADA_A, FIRMADA_A.length).motivo, 'sin_firma');
    for (const raro of [null, undefined, 'texto', {}, 12]) assert.equal(leerFirmaAgregada(raro, 0).ok, false);
    // Un CMS cortado: unos pocos bytes y ceros
    const [, b, c] = rango().map(Number);
    const cortado = Buffer.from(FIRMADA_A);
    cortado.fill(0x30, b + 21, c - 1);
    assert.deepEqual(leerFirmaAgregada(cortado, A.pdf.length), { ok: false, motivo: 'invalida' });
  });
});

describe('qué nota espera', () => {
  const PERSONA = { id: 1 };
  it('las 14:00 son el límite: 13:59:59 todavía sí, 14:00:00 ya no', () => {
    assert.equal(HORA_LIMITE_DE_FIRMA, '14:00');
    assert.equal(paso14('2026-12-01 13:59:59'), false);
    assert.equal(paso14('2026-12-01 14:00:00'), true);
    assert.equal(paso14('2026-12-01 08:05:00'), false);
    for (const raro of [null, undefined, '', 'mañana', 14]) assert.equal(paso14(raro), true, String(raro));
  });

  it('espera con el interruptor prendido, antes de las 14:00 y con quién firme', () => {
    const base = { activa: 1, ahora: '2026-12-01 08:05:00', quienFirma: PERSONA };
    assert.equal(debeEsperarFirma(base), true);
    assert.equal(debeEsperarFirma({ ...base, activa: true }), true);
    assert.equal(debeEsperarFirma({ ...base, ahora: '2026-12-01 14:00:00' }), false);
    assert.equal(debeEsperarFirma({ ...base, quienFirma: null }), false);
    for (const activa of [0, false, null, undefined, '1', 2]) assert.equal(debeEsperarFirma({ ...base, activa }), false, String(activa));
  });
});

describe('los textos', () => {
  it('lo que dice un archivo que no se guarda, y los nombres', () => {
    assert.equal(numeroDeLaNota(A), '12/26');
    assert.equal(archivoDeLaNota(A), 'Nota-Digital-12-26.pdf');
    assert.equal(mensajeDelRechazo({ resultado: 'otra_nota', otra: B }, A), 'Ese PDF es la Nota Digital N° 13/26, no la 12/26. No se guardó nada.');
    assert.equal(mensajeDelRechazo({ resultado: 'sin_firma' }, A), 'Ese PDF es esta nota, pero no tiene firma digital. Firmala y volvé a subirla.');
    assert.equal(mensajeDelRechazo({ resultado: 'firma_invalida' }, A), 'La firma de ese PDF no se pudo verificar. Volvé a firmarla.');
    assert.equal(mensajeDelRechazo({ resultado: 'no_es' }, A), 'Ese PDF no es esta nota. No se guardó nada.');
  });

  it('la línea va justo debajo de la primera, escapada en el HTML y no en el texto', () => {
    const r = conLineaDeFirma({ html: '<p style="color:#800000">SE ADJUNTA NOTA EN PDF</p><p>Cuerpo</p>', texto: 'SE ADJUNTA NOTA EN PDF\n\nCuerpo' }, '<b>"Paz"</b>');
    assert.equal(r.html,
      '<p style="color:#800000">SE ADJUNTA NOTA EN PDF</p><p style="margin:0 0 20px;color:#800000;">La nota está firmada digitalmente por &lt;b&gt;&quot;Paz&quot;&lt;/b&gt;, en conformidad con la Ordenanza N° 15.276/20.</p><p>Cuerpo</p>');
    assert.equal(r.texto, `SE ADJUNTA NOTA EN PDF\n${textoDeLaLineaDeFirma('<b>"Paz"</b>')}\n\nCuerpo`);
  });

  it('el texto, la norma y el aire, con el HTML de una nota de verdad: igual de separada del título y del REF', () => {
    assert.equal(textoDeLaLineaDeFirma('Julieta Ferreyra'), 'La nota está firmada digitalmente por Julieta Ferreyra, en conformidad con la Ordenanza N° 15.276/20.');
    const html = renderHtml(construirNota({
      tipo: 'aviso', gestion: 'interna', numero: 12, anio: 2026, esPrueba: false, fecha: '2026-11-02', datasets: [], areas: [],
      config: { linea_cc_interna: 'CC', linea_cc_externa: 'CC', firma_nombre: 'Nombre', firma_cargo: 'Cargo' }
    }));
    const r = conLineaDeFirma({ html, texto: 'SE ADJUNTA NOTA EN PDF\n\nCuerpo' }, 'Julieta Ferreyra');
    const parrafos = [...r.html.matchAll(/<p style="([^"]*)">([^<]*|<b>)/g)].map(m => m[1]);
    assert.match(parrafos[0], /^margin:0 0 20px;color:#800000;font-weight:bold;/);
    assert.equal(parrafos[1], 'margin:0 0 20px;color:#800000;');
    assert.match(parrafos[2], /^margin:0 0 4px;/);
    assert.ok(r.html.indexOf('firmada digitalmente') < r.html.indexOf('REF.:'));
    assert.ok(!html.includes('firmada digitalmente'), 'el html guardado no la tiene');
  });

  it('sin un párrafo o sin un salto, también', () => {
    const r = conLineaDeFirma({ html: 'solo', texto: 'solo' }, 'X');
    assert.ok(r.html.endsWith('solo') && r.html.includes('firmada digitalmente por X'));
    assert.equal(r.texto, 'solo\nLa nota está firmada digitalmente por X, en conformidad con la Ordenanza N° 15.276/20.');
  });

  it('el Word sale del html guardado: con la línea tampoco se confundiría, pero no se guarda', () => {
    const html = fs.readFileSync(new URL('./fixtures/notas-digitales-html/aviso-externo.html', import.meta.url), 'utf8');
    const antes = bloquesDeNotaDigital(html);
    const conLinea = conLineaDeFirma({ html, texto: 'x' }, 'X');
    assert.ok(conLinea.html.includes('firmada digitalmente por X'));
    assert.ok(conLinea.html.startsWith(html.slice(0, html.indexOf('</p>') + 4)));
    assert.deepEqual(bloquesDeNotaDigital(html), antes);
  });
});

// El certificado al revisar (spec 2026-11-04-firma-digital-leyenda, 2.5): se ve, avisa y nunca frena
describe('revisionDelCertificado', () => {
  const VIGENTE = { emisor: 'AC MODERNIZACION-PFDR', desde: '2026-10-29 10:12:04', hasta: '2030-10-29 10:12:04' };
  const OJO_EMISOR = 'Ojo: el emisor del certificado no es uno de los certificadores conocidos (AC MODERNIZACION-PFDR y AC ONTI). Mirá que sea la firma digital oficial.';
  const OJO_VIGENCIA = 'Ojo: el certificado no estaba vigente cuando se firmó la nota.';

  it('un certificado conocido y vigente: el texto, sin avisos', () => {
    assert.deepEqual(revisionDelCertificado(VIGENTE, '2026-12-22 09:00:00'), { texto: 'Certificado de AC MODERNIZACION-PFDR, vigente hasta el 29/10/2030.', avisos: [] });
    assert.deepEqual(revisionDelCertificado({ ...VIGENTE, emisor: 'AC ONTI' }, '2026-12-22 09:00:00').avisos, []);
  });

  it('otro emisor o ninguno: lo avisa', () => {
    assert.deepEqual(revisionDelCertificado({ ...VIGENTE, emisor: 'Autoridad Inventada' }, '2026-12-22 09:00:00').avisos, [OJO_EMISOR]);
    assert.equal(revisionDelCertificado({ ...VIGENTE, emisor: '' }, '2026-12-22 09:00:00').texto, 'Certificado de un emisor sin nombre, vigente hasta el 29/10/2030.');
    assert.deepEqual(revisionDelCertificado({ ...VIGENTE, emisor: '' }, '2026-12-22 09:00:00').avisos, [OJO_EMISOR]);
  });

  it('un momento fuera de la vigencia, antes o después: lo avisa; en el borde, no', () => {
    assert.deepEqual(revisionDelCertificado(VIGENTE, '2026-10-29 10:12:03').avisos, [OJO_VIGENCIA]);
    assert.deepEqual(revisionDelCertificado(VIGENTE, '2030-10-29 10:12:05').avisos, [OJO_VIGENCIA]);
    assert.deepEqual(revisionDelCertificado(VIGENTE, '2026-10-29 10:12:04').avisos, []);
    assert.deepEqual(revisionDelCertificado(VIGENTE, '2030-10-29 10:12:04').avisos, []);
  });

  it('los dos avisos juntos, primero el emisor', () => {
    assert.deepEqual(revisionDelCertificado({ ...VIGENTE, emisor: 'Otra' }, '2031-01-01 00:00:00').avisos, [OJO_EMISOR, OJO_VIGENCIA]);
  });

  it('sin momento o sin fechas no dice nada de la vigencia', () => {
    assert.deepEqual(revisionDelCertificado(VIGENTE, null).avisos, []);
    const sinFechas = revisionDelCertificado({ emisor: 'AC ONTI', desde: null, hasta: null }, '2026-12-22 09:00:00');
    assert.deepEqual(sinFechas, { texto: 'Certificado de AC ONTI.', avisos: [] });
  });

  it('las firmas de prueba, autofirmadas, verifican igual: el aviso no frena', () => {
    const r = verificarNotaFirmada(FIRMADA_A, A, [], '2026-12-22 09:00:00');
    assert.equal(r.resultado, 'firmada');
    assert.match(r.certificado.texto, /^Certificado de .+, vigente hasta el \d{2}\/\d{2}\/\d{4}\.$/);
    assert.ok(r.certificado.avisos.includes(OJO_EMISOR));
  });

  it('una firma que no verifica no trae certificado', () => {
    const r = verificarNotaFirmada(A.pdf, A);
    assert.equal(r.resultado, 'sin_firma');
    assert.equal(r.certificado, undefined);
  });
});

// Soltar a mano una nota que sigue esperando (spec 2026-11-04-firma-digital-leyenda, 2.6)
describe('puedeReintentarLaQueEspera', () => {
  const HOY = '2026-12-22';
  const puede = (cambios) => puedeReintentarLaQueEspera({ fecha: HOY, hoy: HOY, ahora: `${HOY} 14:15:00`, envioActivo: true, diaHabil: true, ...cambios });

  it('la de hoy, recién a las 14:15', () => {
    assert.equal(puede({ ahora: `${HOY} 08:15:00` }), false);
    assert.equal(puede({ ahora: `${HOY} 14:00:00` }), false);
    assert.equal(puede({ ahora: `${HOY} 14:14:59` }), false);
    assert.equal(puede({ ahora: `${HOY} 14:15:00` }), true);
    assert.equal(puede({ ahora: `${HOY} 17:00:00` }), true);
  });

  it('la de un día anterior, a cualquier hora', () => {
    assert.equal(puede({ fecha: '2026-12-21', ahora: `${HOY} 08:15:00` }), true);
  });

  it('una de otro día futuro, nunca', () => {
    assert.equal(puede({ fecha: '2026-12-23', ahora: `${HOY} 15:00:00` }), false);
  });

  it('con el envío apagado o un día no hábil, tampoco: las 14:00 tampoco la mandarían', () => {
    assert.equal(puede({ envioActivo: false }), false);
    assert.equal(puede({ diaHabil: false }), false);
    assert.equal(puede({ fecha: '2026-12-21', envioActivo: false }), false);
  });
});

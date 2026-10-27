// Mi espacio, la nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word, sección 3): la hoja A4 blanca, Arial 11
// con interlineado 1,15, sin encabezado ni pie, y los bloques de la nota en el orden de la vista (htmlDeLaNota). Puro, sin base:
// la nota sale de notaDeLicencia y el Word se abre con JSZip para leer su XML. Las personas son inventadas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { HOJA_DE_LA_NOTA, TIPO_WORD, renderNotaDocx } from '../services/miEspacioNotaWord.js';
import { LINEA_DE_LA_FIRMA, notaDeLicencia, htmlDeLaNota } from '../services/miEspacioNota.js';

// ---------------------------------------------------------------------------------------------------------------------------
// Las notas
// ---------------------------------------------------------------------------------------------------------------------------

const PLANTA = Object.freeze({ nombre: 'Lucía Fernández', cargo: 'Jefa de División Datos Abiertos', vinculo: 'planta_permanente' });
const CONTRATADA = Object.freeze({ nombre: 'Paula Benítez', cargo: 'Analista de Datos', vinculo: 'contrato' });
const SIN_CARGO = Object.freeze({ nombre: 'Marta Ríos', cargo: null, vinculo: 'contrato' });
const SIN_VINCULO = Object.freeze({ nombre: 'Elena Suárez', cargo: 'Administrativa', vinculo: null });
// El lunes 23/11/2026, feriado de la tabla (los 9 fijos ya los saca esDiaHabil)
const FERIADOS = new Set(['2026-11-23']);
const FECHA = '2026-10-27';

// Una licencia de cada tipo con nota
const LICENCIAS = Object.freeze({
  vacaciones: { tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-27', horas: null },
  franquicia: { tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: 3 },
  estudios: { tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-17', horas: null },
  medica: { tipo: 'medica', desde: '2026-11-12', hasta: '2026-11-13', horas: null },
  medica_extraordinaria: { tipo: 'medica_extraordinaria', desde: '2026-11-23', hasta: '2026-12-04', horas: null },
  familiar: { tipo: 'familiar', desde: '2026-11-20', hasta: '2026-11-20', horas: null },
  franco: { tipo: 'franco', desde: '2026-12-14', hasta: '2026-12-14', horas: null },
  horas_a_favor: { tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2.5 }
});

const notaDe = (licencia = LICENCIAS.vacaciones, persona = PLANTA) => {
  const resultado = notaDeLicencia(licencia, { fecha: FECHA, persona, feriados: FERIADOS });
  assert.ok(resultado.nota, `sin nota: ${JSON.stringify(resultado)}`);
  return resultado.nota;
};

// ---------------------------------------------------------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------------------------------------------------------

// El Word abierto: los nombres de sus archivos, el cuerpo y los estilos
const abrir = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const leer = (nombre) => zip.file(nombre).async('string');
  return {
    archivos: Object.keys(zip.files).filter((n) => !zip.files[n].dir),
    documento: await leer('word/document.xml'),
    estilos: await leer('word/styles.xml')
  };
};
const wordDe = (nota) => renderNotaDocx(nota).then(abrir);

// Los atributos de la primera etiqueta `<nombre …/>` de un XML, como objeto (en cualquier orden)
const atributosDe = (xml, nombre) => {
  const etiqueta = xml.match(new RegExp(`<${nombre}(\\s[^>]*?)?/?>`));
  if (!etiqueta) return null;
  return Object.fromEntries([...(etiqueta[1] ?? '').matchAll(/([\w:]+)="([^"]*)"/g)].map(([, clave, valor]) => [clave, valor]));
};

const ENTIDADES_XML = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const ENTIDADES_HTML = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// Los párrafos del cuerpo del Word, en orden: el texto (los <w:t> unidos, decodificados) y lo que lo diagrama
const parrafosDelWord = (documento) => {
  const cuerpo = documento.slice(documento.indexOf('<w:body>'), documento.indexOf('<w:sectPr'));
  return (cuerpo.match(/<w:p(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/w:p>)/g) ?? []).map((xml) => {
    const ind = atributosDe(xml, 'w:ind') ?? {};
    const sz = atributosDe(xml, 'w:sz');
    return {
      xml,
      texto: (xml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|apos);/g, (e) => ENTIDADES_XML[e]))
        .join(''),
      alineado: atributosDe(xml, 'w:jc')?.['w:val'] ?? null,
      sangria: ind['w:firstLine'] ?? null,
      izquierda: ind['w:left'] ?? null,
      letra: sz?.['w:val'] ?? null
    };
  });
};
const sinXml = ({ xml, ...resto }) => resto;

// Los renglones de la vista (htmlDeLaNota), traducidos a lo que tiene que decir el Word: la clase `derecha` es la alineación a
// la derecha, `justificado` la justificada, `sangria` la sangría de 1,25 cm en el primer renglón (709 twips), la firma va
// centrada en la mitad derecha (sangría izquierda de 8 cm: 4535) y `chico` es la letra de 9 pt (18 medios puntos)
const renglonesDeLaVista = (html) => {
  const firma = html.indexOf('<div class="firma">');
  return [...html.matchAll(/<p(?: class="([^"]*)")?>([^<]*)<\/p>/g)].map((m) => {
    const clases = (m[1] ?? '').split(' ').filter(Boolean);
    const enLaFirma = firma >= 0 && m.index > firma;
    return {
      texto: m[2].replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTIDADES_HTML[e]),
      alineado: enLaFirma ? 'center' : clases.includes('derecha') ? 'right' : clases.includes('justificado') ? 'both' : null,
      sangria: clases.includes('sangria') ? '709' : null,
      izquierda: enLaFirma ? '4535' : null,
      letra: clases.includes('chico') ? '18' : null
    };
  });
};

// ---------------------------------------------------------------------------------------------------------------------------
// Las constantes y la hoja
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderNotaDocx: la hoja', () => {
  it('HOJA_DE_LA_NOTA es A4 con 2,5 cm arriba y abajo y 3 cm a los costados, en twips', () => {
    assert.deepEqual({ ...HOJA_DE_LA_NOTA }, { ancho: 11906, alto: 16838, arriba: 1417, abajo: 1417, izquierda: 1701, derecha: 1701 });
    assert.ok(Object.isFrozen(HOJA_DE_LA_NOTA));
  });

  it('TIPO_WORD es el MIME de Word', () => {
    assert.equal(TIPO_WORD, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('devuelve un Buffer que es un .docx (un ZIP)', async () => {
    const buffer = await renderNotaDocx(notaDe());
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK');
  });

  it('la sección es A4, con los márgenes de la nota', async () => {
    const { documento } = await wordDe(notaDe());
    const hoja = atributosDe(documento, 'w:pgSz');
    assert.equal(hoja['w:w'], '11906');
    assert.equal(hoja['w:h'], '16838');
    const margenes = atributosDe(documento, 'w:pgMar');
    assert.equal(margenes['w:top'], '1417');
    assert.equal(margenes['w:right'], '1701');
    assert.equal(margenes['w:bottom'], '1417');
    assert.equal(margenes['w:left'], '1701');
    assert.equal(documento.split('<w:sectPr').length - 1, 1);
  });

  it('el párrafo por defecto: Arial 11, interlineado 1,15 y sin espacio entre párrafos', async () => {
    const { estilos } = await wordDe(notaDe());
    const defecto = estilos.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)[0];
    const letra = defecto.match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/)[0];
    assert.match(letra, /w:ascii="Arial"/);
    assert.match(letra, /<w:sz w:val="22"\/>/);
    const parrafo = defecto.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/)[0];
    const espacio = atributosDe(parrafo, 'w:spacing');
    assert.equal(espacio['w:line'], '276');
    assert.equal(espacio['w:lineRule'], 'auto');
    assert.equal(espacio['w:after'], '0');
  });

  it('el interlineado va en el estilo por defecto, no en cada párrafo', async () => {
    const { documento } = await wordDe(notaDe());
    assert.ok(!documento.includes('<w:spacing'));
  });

  it('sin encabezado ni pie: hoja blanca, sin membrete ni imágenes', async () => {
    const { archivos, documento } = await wordDe(notaDe());
    assert.deepEqual(archivos.filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n)), []);
    assert.deepEqual(archivos.filter((n) => n.startsWith('word/media/')), []);
    assert.ok(!documento.includes('<w:headerReference'));
    assert.ok(!documento.includes('<w:footerReference'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Los bloques
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderNotaDocx: los bloques, en orden', () => {
  it('la fecha, el destinatario, el «S / D», el saludo, el cuerpo, el cierre y la firma, con su diagramación', async () => {
    const nota = notaDe();
    const parrafos = parrafosDelWord((await wordDe(nota)).documento).filter((p) => p.texto !== '');
    assert.deepEqual(parrafos.map((p) => p.texto), [
      'Comodoro Rivadavia, 27 de octubre de 2026',
      'Al Señor Director General de',
      'Modernización e Investigación Territorial',
      `S${' '.repeat(15)}/${' '.repeat(15)}D`,
      'De mi mayor consideración:',
      nota.cuerpo,
      'Sin otro particular, saludo a Ud. atentamente.',
      '______________________________',
      'Lucía Fernández',
      'Jefa de División Datos Abiertos'
    ]);
    assert.ok(nota.cuerpo.startsWith('Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de nueve (9) días hábiles'));
    const [fecha, destinatario1, destinatario2, sd, saludo, cuerpo, cierre, linea, nombre, cargo] = parrafos;
    // La fecha, a la derecha
    assert.match(fecha.xml, /<w:jc w:val="right"\/>/);
    // El destinatario, el «S / D» y el saludo, a la izquierda y sin sangría; los espacios del «S / D» se conservan
    for (const p of [destinatario1, destinatario2, sd, saludo]) assert.deepEqual([p.alineado, p.sangria, p.izquierda], [null, null, null]);
    assert.match(sd.xml, /<w:t xml:space="preserve">S {15}\/ {15}D<\/w:t>/);
    // El cuerpo, justificado y con sangría de 1,25 cm en el primer renglón
    assert.match(cuerpo.xml, /<w:jc w:val="both"\/>/);
    assert.match(cuerpo.xml, /w:firstLine="709"/);
    // El cierre, con la misma sangría y sin justificar
    assert.match(cierre.xml, /w:firstLine="709"/);
    assert.equal(cierre.alineado, null);
    // La firma: la línea, el nombre y el cargo, centrados en la mitad derecha (8 cm a la izquierda), en la letra de la nota
    for (const p of [linea, nombre, cargo]) {
      assert.match(p.xml, /w:left="4535"/);
      assert.match(p.xml, /<w:jc w:val="center"\/>/);
      assert.equal(p.sangria, null);
      assert.equal(p.letra, null);
    }
  });

  it('la línea de la firma es la de la vista (LINEA_DE_LA_FIRMA, 30 guiones bajos)', async () => {
    assert.equal(LINEA_DE_LA_FIRMA, '_'.repeat(30));
    const parrafos = parrafosDelWord((await wordDe(notaDe())).documento);
    assert.equal(parrafos.filter((p) => p.texto === LINEA_DE_LA_FIRMA).length, 1);
  });

  it('en un contratado, el renglón «Personal contratado, cumpliendo funciones de», en 9 pt, entre el nombre y el cargo', async () => {
    const parrafos = parrafosDelWord((await wordDe(notaDe(LICENCIAS.vacaciones, CONTRATADA))).documento);
    const firma = parrafos.slice(-4);
    assert.deepEqual(firma.map((p) => p.texto), [
      '______________________________', 'Paula Benítez', 'Personal contratado, cumpliendo funciones de', 'Analista de Datos'
    ]);
    assert.match(firma[2].xml, /<w:sz w:val="18"\/>/);
    assert.match(firma[2].xml, /w:left="4535"/);
    assert.match(firma[2].xml, /<w:jc w:val="center"\/>/);
    for (const p of [firma[0], firma[1], firma[3]]) assert.equal(p.letra, null);
  });

  it('sin cargo, la firma es la línea y el nombre', async () => {
    const parrafos = parrafosDelWord((await wordDe(notaDe(LICENCIAS.vacaciones, SIN_CARGO))).documento);
    assert.deepEqual(parrafos.slice(-2).map((p) => p.texto), ['______________________________', 'Marta Ríos']);
    assert.ok(!parrafos.some((p) => p.texto.startsWith('Personal contratado')));
  });

  it('los renglones vacíos: dos después de la fecha, uno después del «S / D», del saludo y del cuerpo, cuatro después del cierre', async () => {
    const nota = notaDe();
    const textos = parrafosDelWord((await wordDe(nota)).documento).map((p) => p.texto);
    assert.deepEqual(textos, [
      nota.fecha, '', '',
      ...nota.destinatario, nota.sd, '',
      nota.saludo, '',
      nota.cuerpo, '',
      nota.cierre, '', '', '', '',
      LINEA_DE_LA_FIRMA, 'Lucía Fernández', 'Jefa de División Datos Abiertos'
    ]);
  });

  it('los renglones vacíos no tienen diagramación propia: toman la letra y el interlineado del párrafo por defecto', async () => {
    const vacios = parrafosDelWord((await wordDe(notaDe())).documento).filter((p) => p.texto === '');
    assert.equal(vacios.length, 9);
    for (const p of vacios) assert.deepEqual(sinXml(p), { texto: '', alineado: null, sangria: null, izquierda: null, letra: null });
  });

  it('la nota opcional de la licencia no va: el Word tiene solo lo que trae la nota', async () => {
    const licencia = { ...LICENCIAS.vacaciones, nota: 'Turno con el dentista' };
    const { documento } = await wordDe(notaDe(licencia));
    assert.ok(!documento.includes('dentista'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// La vista y el Word dicen lo mismo
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderNotaDocx: los mismos renglones que la vista (htmlDeLaNota)', () => {
  for (const [tipo, licencia] of Object.entries(LICENCIAS)) {
    for (const [quien, persona] of Object.entries({ PLANTA, CONTRATADA, SIN_CARGO, SIN_VINCULO })) {
      it(`${tipo}, ${quien}: el mismo texto, en el mismo orden y con la misma diagramación`, async () => {
        const nota = notaDe(licencia, persona);
        const word = parrafosDelWord((await wordDe(nota)).documento).map(sinXml);
        assert.deepEqual(word, renglonesDeLaVista(htmlDeLaNota(nota)));
      });
    }
  }

  it('con caracteres que se escapan en el HTML (&, <, comillas), el Word dice lo mismo que la vista', async () => {
    const nota = notaDe(LICENCIAS.vacaciones, { nombre: 'Ana "Anita" O\'Neil & <Cía>', cargo: 'Jefa <de> & "Datos"', vinculo: 'contrato' });
    const word = parrafosDelWord((await wordDe(nota)).documento).map(sinXml);
    assert.deepEqual(word, renglonesDeLaVista(htmlDeLaNota(nota)));
    assert.ok(word.some((p) => p.texto === 'Ana "Anita" O\'Neil & <Cía>'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Un carácter raro no daña el Word
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderNotaDocx: los caracteres que el XML no admite', () => {
  // Lo que el XML de Word no admite: los caracteres de control (salvo el tab y los saltos), U+FFFE, U+FFFF y los surrogates solos
  const NO_ADMITIDOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/;

  it('una persona con un carácter de control y un surrogate solo da un Word que se abre, sin ellos en el XML', async () => {
    const nota = notaDe(LICENCIAS.vacaciones, { nombre: 'Ana\u0001 Luz\uD800', cargo: 'Cargo\u0007 raro\uDC00', vinculo: 'contrato' });
    const { documento } = await wordDe(nota);
    assert.ok(!documento.includes('\u0001'));
    assert.ok(!NO_ADMITIDOS.test(documento));
    assert.ok(documento.isWellFormed());
    const textos = parrafosDelWord(documento).map((p) => p.texto);
    assert.ok(textos.includes('Ana Luz�'), textos.join(' | '));
    assert.ok(textos.includes('Cargo raro�'), textos.join(' | '));
  });

  it('el texto de cualquier campo de la nota pasa por el mismo filtro', async () => {
    const nota = {
      ...notaDe(),
      fecha: 'Comodoro\u0002 Rivadavia',
      destinatario: ['Al\u0003 Señor', 'Director￾'],
      sd: 'S\u0004 / D',
      saludo: 'De mi\u0005 mayor consideración:',
      cuerpo: 'Me dirijo\u0006 a Ud.',
      cierre: 'Sin otro\u000B particular.',
      firma: [{ texto: 'Nombre\u000C', chico: false }, { texto: 'Chico\u001F', chico: true }, { texto: 'Cargo￿', chico: false }]
    };
    const { documento } = await wordDe(nota);
    assert.ok(!NO_ADMITIDOS.test(documento));
    const textos = parrafosDelWord(documento).map((p) => p.texto).filter(Boolean);
    assert.deepEqual(textos, [
      'Comodoro Rivadavia', 'Al Señor', 'Director', 'S / D', 'De mi mayor consideración:', 'Me dirijo a Ud.',
      'Sin otro particular.', LINEA_DE_LA_FIRMA, 'Nombre', 'Chico', 'Cargo'
    ]);
  });
});

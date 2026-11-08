// El dato de la quincena (spec 2026-11-07-dato-quincena, 5 y 15): una edición inventada, sus partes y un PNG chico armado
// byte a byte. Ningún dato sale de una edición real de Grok Bot.
import crypto from 'node:crypto';
import zlib from 'node:zlib';

// Fija, pasada y desde FECHA_MINIMA (2026-11-01): la API valida con el hoy real
export const FECHA_DE_PRUEBA = '2026-11-02';

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Un bloque del PNG: largo, tipo, contenido y el CRC del tipo y el contenido
const bloque = (tipo, contenido) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(contenido.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), contenido]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
};

// Un PNG en escala de grises de 8 bits, negro: un byte de filtro (0) por fila y uno por píxel
export const pngDePrueba = ({ ancho = 2, alto = 2 } = {}) => {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8;
  const filas = Buffer.alloc(alto * (ancho + 1));
  return Buffer.concat([
    FIRMA_PNG, bloque('IHDR', cabecera), bloque('IDAT', zlib.deflateSync(filas)), bloque('IEND', Buffer.alloc(0))
  ]);
};

const correoDePrueba = () => Buffer.from(
  'El dato de la quincena (prueba)\n\nUn correo inventado para las pruebas del RPAD: ñandú, cigüeña y 1.234 casos.\n', 'utf8'
);
const calculosDePrueba = () => Buffer.from('# Cálculos de prueba\n\nUna suma inventada: 1.000 + 234 = 1.234 casos.\n', 'utf8');

const entrada = (campo, nombre, mime, contenido) => ({ campo, nombre, mime, bytes: contenido.length, sha256: sha256(contenido) });

// La principal: el título, el dataset, las notas y las fuentes del ejemplo de «La propuesta para copiar» (spec, 9)
const propuestaA = () => ({
  orden: 1,
  titulo: 'Un título inventado',
  etiquetas: ['Principal', 'Validar'],
  dataset: {
    rpad_id: 1, ckan_slug: 'prueba-a', nombre: 'Dataset de prueba A', url: 'https://datos.ejemplo.gob.ar/dataset/prueba-a'
  },
  rpad_snapshot: {
    estado: 'actualizado', datos_al: '2026-09-30', ultima_actualizacion: '2026-10-30',
    updated_at: '2026-10-30T14:05:00.000Z', dias_para_vencer: 29
  },
  cifra_clave: '1.234 casos · septiembre de 2026',
  calculo: 'Un cálculo inventado: 1.000 casos más 234.',
  contexto_historico: 'Un contexto histórico inventado.',
  por_que_hoy: 'Una razón inventada para publicarlo hoy.',
  angulo: 'Un ángulo inventado.',
  idea_placa: 'Una idea de placa inventada.',
  texto_redes: 'Un texto para redes inventado.\nCon un segundo renglón.',
  puntos_centrales: ['Primer punto inventado.', 'Segundo punto inventado.', 'Tercer punto inventado.'],
  borrador_nota: { titulo: 'Un borrador inventado', parrafos: ['Primer párrafo inventado.', 'Segundo párrafo inventado.'] },
  notas_validacion: ['Primera nota.', 'Segunda nota.'],
  fuentes: ['https://datos.ejemplo.gob.ar/a.csv', 'https://datos.ejemplo.gob.ar/b.csv']
});

const propuestaB = () => ({
  orden: 2,
  titulo: 'Otro título inventado',
  etiquetas: ['Agenda'],
  dataset: { rpad_id: 2, ckan_slug: null, nombre: 'Dataset de prueba B', url: 'https://datos.ejemplo.gob.ar/dataset/prueba-b' },
  rpad_snapshot: {
    estado: 'proximo', datos_al: null, ultima_actualizacion: '2026-06-03T03:00:00.000Z', updated_at: null, dias_para_vencer: 4
  },
  cifra_clave: '56 casos · septiembre de 2026',
  calculo: 'Otro cálculo inventado.',
  contexto_historico: 'Otro contexto inventado.',
  por_que_hoy: 'Otra razón inventada.',
  angulo: 'Otro ángulo inventado.',
  idea_placa: 'Otra placa inventada.',
  texto_redes: 'Otro texto para redes inventado.',
  puntos_centrales: ['Un punto.', 'Otro punto.', 'Un tercer punto.'],
  borrador_nota: { titulo: 'Otro borrador inventado', parrafos: ['Un párrafo.', 'Otro párrafo.', 'Un tercer párrafo.'] },
  notas_validacion: [],
  fuentes: ['https://datos.ejemplo.gob.ar/c.csv']
});

// Una regular válida de dos propuestas, con el manifiesto de las partes que arma partesDePrueba sin cambios. cambios pisa
// claves de la raíz. Cada llamada arma objetos nuevos: un test puede cambiarlos sin tocar el próximo
export const edicionDePrueba = (cambios = {}) => ({
  schema_version: '1.0',
  agente: 'dato-de-la-quincena',
  fecha_edicion: FECHA_DE_PRUEBA,
  tipo: 'regular',
  referencia_piloto: null,
  titulo: 'El dato de la quincena: edición de prueba',
  generado_at: '2026-11-02T07:58:00-03:00',
  correo: { estado: 'enviado', enviado_at: '2026-11-02T11:12:00Z' },
  nota_archivo: 'Una nota de archivo inventada.',
  agenda: [{
    titulo: 'Evento de prueba', fecha: '2026-11-10', detalle: 'Un evento inventado para las pruebas.',
    url: 'https://datos.ejemplo.gob.ar/agenda/evento-de-prueba'
  }],
  propuestas: [propuestaA(), propuestaB()],
  adjuntos: [
    entrada('infografia_png', 'infografia-prueba.png', 'image/png', pngDePrueba()),
    entrada('correo_texto', 'correo-prueba.txt', 'text/plain', correoDePrueba()),
    entrada('calculos', 'calculos-prueba.md', 'text/markdown', calculosDePrueba())
  ],
  ...cambios
});

// Un piloto válido: el piloto 4 del mismo día, sin la hora de generación ni la del correo y sin nota de archivo
export const pilotoDePrueba = (cambios = {}) => edicionDePrueba({
  tipo: 'piloto',
  referencia_piloto: 'piloto-4',
  titulo: 'El dato de la quincena: piloto de prueba',
  generado_at: null,
  correo: { estado: 'enviado', enviado_at: null },
  nota_archivo: null,
  ...cambios
});

// Las partes de un pedido: las de prueba o las que se pasan; con calculos: null, sin los cálculos. El manifiesto de una copia
// de la edición pasa a describir esas partes (bytes y sha256; sin la entrada de los cálculos si no van) y metadata es su
// JSON.stringify. La edición que se pasa no cambia
export const partesDePrueba = (edicion, { infografia_png, correo_texto, calculos } = {}) => {
  const archivos = {
    infografia_png: infografia_png ?? pngDePrueba(),
    correo_texto: correo_texto ?? correoDePrueba(),
    ...(calculos === null ? {} : { calculos: calculos ?? calculosDePrueba() })
  };
  const copia = structuredClone(edicion);
  if (copia !== null && typeof copia === 'object' && Array.isArray(copia.adjuntos)) {
    const esEntrada = (a) => a !== null && typeof a === 'object' && typeof a.campo === 'string';
    copia.adjuntos = copia.adjuntos
      .filter((a) => !(esEntrada(a) && a.campo === 'calculos' && calculos === null))
      .map((a) => (esEntrada(a) && Object.hasOwn(archivos, a.campo)
        ? { ...a, bytes: archivos[a.campo].length, sha256: sha256(archivos[a.campo]) }
        : a));
  }
  return { metadata: Buffer.from(JSON.stringify(copia), 'utf8'), ...archivos };
};

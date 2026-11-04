// La firma digital de las Notas Digitales, puro (spec 2026-11-03-notas-firma-digital, 4): qué nota espera la firma, si un PDF subido
// es esa nota firmada y la línea que lo dice en el email. Sin pool ni dependencias nuevas; nada de acá tira.
//
// Cómo firma el Firmador: agrega la firma al final del PDF, como una actualización incremental (el archivo empieza con los bytes
// exactos del original). `/ByteRange [0 b c d]` dice qué cubre la firma: todo, menos el `/Contents` que va entre b y c; ahí, en
// hexadecimal, un CMS SignedData seguido de ceros de relleno.
// Esta validación evita errores, no un fraude (quien sube ya es de administración): no comprueba la cadena de confianza ni la
// revocación, que son del validador oficial, ni que haya firmado quien debía: el nombre del certificado se muestra.
import crypto, { X509Certificate } from 'node:crypto';
import { ahoraArgentina } from './notasDigitalesCalendario.js';

// Hasta esta hora espera una nota: a las 14:00 sale lo que quede (spec, 4.1 y 4.9)
export const HORA_LIMITE_DE_FIRMA = '14:00';

// ¿Ya pasó la hora límite? ahora: 'AAAA-MM-DD HH:MM:SS', en hora argentina. Lo que no es un momento cuenta como pasada: una nota nunca
// espera por un dato raro
export const paso14 = (ahora) => !(typeof ahora === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(ahora))
  || ahora.slice(11, 16) >= HORA_LIMITE_DE_FIRMA;

/**
 * ¿La nota generada por la corrida espera la firma? (spec, 4.1). activa: la columna de la configuración (1, o el true literal);
 * ahora: el momento de la corrida; quienFirma: la persona disponible para firmarla, o null.
 */
export const debeEsperarFirma = ({ activa, ahora, quienFirma }) => (activa === 1 || activa === true)
  && !paso14(ahora) && Boolean(quienFirma);

// ---------- Un lector de DER chico, solo con largos definidos: lo que se sale del buffer tira, y lo ataja leerFirmaAgregada ----------
const elemento = (der, inicio) => {
  if (inicio + 2 > der.length) throw new RangeError('DER cortado');
  const tag = der[inicio];
  let largo = der[inicio + 1];
  let cabeza = 2;
  if (largo === 0x80) throw new RangeError('DER con largo indefinido');
  if (largo & 0x80) {
    const bytes = largo & 0x7f;
    if (bytes > 4 || inicio + 2 + bytes > der.length) throw new RangeError('DER con un largo inválido');
    largo = 0;
    for (let i = 0; i < bytes; i++) largo = largo * 256 + der[inicio + 2 + i];
    cabeza = 2 + bytes;
  }
  const fin = inicio + cabeza + largo;
  if (fin > der.length) throw new RangeError('DER cortado');
  return { tag, inicio, cuerpo: inicio + cabeza, fin };
};
const hijosDe = (der, padre) => {
  const hijos = [];
  for (let p = padre.cuerpo; p < padre.fin;) {
    const hijo = elemento(der, p);
    hijos.push(hijo);
    p = hijo.fin;
  }
  return hijos;
};
const bytesDe = (der, e) => der.subarray(e.cuerpo, e.fin);
const hexDe = (der, e) => bytesDe(der, e).toString('hex');

const OID_SIGNED_DATA = '2a864886f70d010702';
const OID_MESSAGE_DIGEST = '2a864886f70d010904';
const OID_SIGNING_TIME = '2a864886f70d010905';
const DIGESTS = Object.freeze({
  '608648016503040201': 'sha256',
  '608648016503040202': 'sha384',
  '608648016503040203': 'sha512'
});
const TAG_CONTEXTO_0 = 0xa0;

// UTCTime ('261104021340Z') o GeneralizedTime ('20261104021340Z'), en hora argentina; null si no se puede leer
const momentoDe = (texto) => {
  const m = /^(\d{2}|\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(texto);
  if (!m) return null;
  const anio = m[1].length === 2 ? (Number(m[1]) < 50 ? 2000 : 1900) + Number(m[1]) : Number(m[1]);
  const fecha = new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
  return Number.isNaN(fecha.getTime()) ? null : ahoraArgentina(fecha);
};

// El CN del `subject` de un certificado, tal cual. Node escapa con una barra lo que RFC 2253 pide escapar (una coma en el nombre)
const cnDe = (subject) => {
  const linea = String(subject).split('\n').find(l => l.startsWith('CN='));
  return linea ? linea.slice(3).replace(/\\(.)/g, '$1').trim().slice(0, 255) : '';
};

/**
 * La firma que `subido` agrega después de los primeros `largoDelOriginal` bytes (spec, 4.6, pasos 2 a 4):
 * { ok: true, firmado_por, firmado_at } o { ok: false, motivo }. motivo: 'sin_firma' (no hay ningún /ByteRange en lo agregado) o
 * 'invalida'. Nunca tira.
 */
export const leerFirmaAgregada = (subido, largoDelOriginal) => {
  try {
    const agregado = subido.subarray(largoDelOriginal).toString('latin1');
    const rangos = [...agregado.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
    if (rangos.length === 0) return { ok: false, motivo: 'sin_firma' };
    const [inicio, hastaContents, desdeContents, resto] = rangos.at(-1).slice(1).map(Number);
    // La firma cubre todo y es nueva: empieza en 0, llega al final y su /Contents está en lo agregado
    if (inicio !== 0 || hastaContents < largoDelOriginal || desdeContents <= hastaContents + 1
      || desdeContents + resto !== subido.length) return { ok: false, motivo: 'invalida' };
    if (subido[hastaContents] !== 0x3c || subido[desdeContents - 1] !== 0x3e) return { ok: false, motivo: 'invalida' };
    const hexadecimal = subido.subarray(hastaContents + 1, desdeContents - 1).toString('latin1');
    if (hexadecimal.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hexadecimal)) return { ok: false, motivo: 'invalida' };
    const der = Buffer.from(hexadecimal, 'hex');

    // ContentInfo: el SignedData; después, solo ceros de relleno
    const raiz = elemento(der, 0);
    if (der.subarray(raiz.fin).some(byte => byte !== 0)) return { ok: false, motivo: 'invalida' };
    const [tipo, contexto] = hijosDe(der, raiz);
    if (hexDe(der, tipo) !== OID_SIGNED_DATA) return { ok: false, motivo: 'invalida' };
    // SignedData: version, digestAlgorithms, encapContentInfo, [0] certificates, [1] crls (si hay), signerInfos
    const signedData = hijosDe(der, hijosDe(der, contexto)[0]);
    const certificados = signedData.find(h => h.tag === TAG_CONTEXTO_0);
    const firmante = hijosDe(der, signedData.at(-1))[0];
    // SignerInfo: version, sid, digestAlgorithm, [0] signedAttrs, signatureAlgorithm, signature, [1] unsignedAttrs (si hay)
    const [, , algoritmo, atributos, , firma] = hijosDe(der, firmante);
    if (!certificados || atributos?.tag !== TAG_CONTEXTO_0 || !firma) return { ok: false, motivo: 'invalida' };
    const digest = DIGESTS[hexDe(der, hijosDe(der, algoritmo)[0])];
    if (!digest) return { ok: false, motivo: 'invalida' };

    let hashFirmado = null;
    let momento = null;
    for (const atributo of hijosDe(der, atributos)) {
      const [oid, valores] = hijosDe(der, atributo);
      const valor = hijosDe(der, valores)[0];
      if (hexDe(der, oid) === OID_MESSAGE_DIGEST) hashFirmado = bytesDe(der, valor);
      if (hexDe(der, oid) === OID_SIGNING_TIME) momento = momentoDe(bytesDe(der, valor).toString('latin1'));
    }
    const hash = crypto.createHash(digest).update(subido.subarray(0, hastaContents)).update(subido.subarray(desdeContents)).digest();
    if (!hashFirmado?.equals(hash)) return { ok: false, motivo: 'invalida' };

    // Lo que se firma son los atributos, con su etiqueta original de SET (CMS, RFC 5652, 5.4), no la [0] con que van guardados
    const primero = hijosDe(der, certificados)[0];
    const certificado = new X509Certificate(der.subarray(primero.inicio, primero.fin));
    const firmados = Buffer.from(der.subarray(atributos.inicio, atributos.fin));
    firmados[0] = 0x31;
    if (!crypto.createVerify(digest).update(firmados).verify(certificado.publicKey, bytesDe(der, firma))) {
      return { ok: false, motivo: 'invalida' };
    }
    const nombre = cnDe(certificado.subject);
    if (!nombre) return { ok: false, motivo: 'invalida' };
    return { ok: true, firmado_por: nombre, firmado_at: momento };
  } catch {
    return { ok: false, motivo: 'invalida' };
  }
};

const empiezaCon = (archivo, pdf) => Buffer.isBuffer(pdf) && pdf.length > 0 && archivo.length >= pdf.length
  && archivo.subarray(0, pdf.length).equals(pdf);

/**
 * El PDF subido a la fila de `nota`, comparado byte por byte con su PDF (spec, 4.5 y 4.6). otras: las demás notas que se pueden nombrar
 * ([{ numero, anio, pdf }]). Da { resultado, otra, firmado_por, firmado_at }:
 * - 'firmada': es esta nota, con una firma que verifica (con quién firmó y cuándo);
 * - 'sin_firma': es esta nota, sin nada agregado o sin firma en lo agregado;
 * - 'firma_invalida': es esta nota, con una firma que no verifica;
 * - 'otra_nota': empieza con el PDF de una de `otras` (va en `otra`);
 * - 'no_es': nada de lo anterior. Lo que no es un Buffer, también. Nunca tira.
 */
export const verificarNotaFirmada = (subido, nota, otras = []) => {
  if (!Buffer.isBuffer(subido) || subido.length === 0) return { resultado: 'no_es' };
  if (!empiezaCon(subido, nota?.pdf)) {
    const otra = Array.isArray(otras) ? otras.find(o => empiezaCon(subido, o?.pdf)) : null;
    return otra ? { resultado: 'otra_nota', otra } : { resultado: 'no_es' };
  }
  if (subido.length === nota.pdf.length) return { resultado: 'sin_firma' };
  const firma = leerFirmaAgregada(subido, nota.pdf.length);
  if (firma.ok) return { resultado: 'firmada', firmado_por: firma.firmado_por, firmado_at: firma.firmado_at };
  return { resultado: firma.motivo === 'sin_firma' ? 'sin_firma' : 'firma_invalida' };
};

// El número como lo escribe la nota: «12/26»
export const numeroDeLaNota = ({ numero, anio }) => `${numero}/${String(anio).slice(-2)}`;
export const archivoDeLaNota = ({ numero, anio }) => `Nota-Digital-${numero}-${String(anio).slice(-2)}.pdf`;

// Lo que dice la subida de un archivo que no se guarda (spec, 4.5). Texto plano
export const mensajeDelRechazo = ({ resultado, otra }, nota) => {
  if (resultado === 'otra_nota') {
    return `Ese PDF es la Nota Digital N° ${numeroDeLaNota(otra)}, no la ${numeroDeLaNota(nota)}. No se guardó nada.`;
  }
  if (resultado === 'sin_firma') return 'Ese PDF es esta nota, pero no tiene firma digital. Firmala y volvé a subirla.';
  if (resultado === 'firma_invalida') return 'La firma de ese PDF no se pudo verificar. Volvé a firmarla.';
  return 'Ese PDF no es esta nota. No se guardó nada.';
};
export const MENSAJE_FIRMADA_GUARDADA = 'Guardada. Falta enviarla.';
export const MENSAJE_NOTA_YA_SALIO = 'Esta nota ya salió.';
export const MENSAJE_ESPERA_FIRMA = 'Esta nota espera la firma digital: sale sola a las 14:00.';
export const MENSAJE_CORRIDA_EN_CURSO = 'Hay una corrida de Notas Digitales en curso. Probá de nuevo en unos minutos.';

// La línea del email a los destinatarios de una nota firmada (spec, 4.8). Texto plano
export const textoDeLaLineaDeFirma = (nombre) => `La nota está firmada digitalmente por ${nombre}.`;

const escaparHtml = (texto) => String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * El HTML y el texto del email con la línea de la firma, justo debajo de la primera línea (la que dice que se adjunta la nota, en
 * bordó). Se arma al enviar y no se guarda: `html` sigue como se generó y el Word no cambia.
 */
export const conLineaDeFirma = ({ html, texto }, nombre) => {
  const linea = textoDeLaLineaDeFirma(nombre);
  const finDelParrafo = html.indexOf('</p>');
  const parrafo = `<p style="margin:4px 0 0;color:#800000;">${escaparHtml(linea)}</p>`;
  const finDelRenglon = texto.indexOf('\n');
  return {
    html: finDelParrafo < 0 ? `${parrafo}${html}` : `${html.slice(0, finDelParrafo + 4)}${parrafo}${html.slice(finDelParrafo + 4)}`,
    texto: finDelRenglon < 0 ? `${texto}\n${linea}` : `${texto.slice(0, finDelRenglon)}\n${linea}${texto.slice(finDelRenglon)}`
  };
};

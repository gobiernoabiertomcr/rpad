// Arma los PDF de prueba de la firma digital (spec 2026-11-03-notas-firma-digital, 9). Se corre una sola vez, a mano, con openssl:
//   node tests/fixtures/firma-digital/generar.mjs
// Los tests no lo llaman. Dos notas con texto inventado y sus firmadas, con la forma en que firma el Firmador: una actualización
// incremental con /Filter/Adobe.PPKLite, /SubFilter/adbe.pkcs7.detached, /ByteRange, un /Contents de 30000 hexadecimales (el CMS y ceros
// de relleno) y un widget invisible. Los certificados son autofirmados y de nombres inventados. La clave privada vive solo en una
// carpeta temporal, que se borra al terminar: no se guarda en ningún lado.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LARGO_CONTENTS = 30000;

const pdfDeNota = (numero, firmante) => new Promise((listo) => {
  const doc = new PDFDocument({ size: [612, 1008], margin: 72, info: { Title: `Nota Digital ${numero}`, Author: 'RPAD' } });
  const partes = [];
  doc.on('data', p => partes.push(p));
  doc.on('end', () => listo(Buffer.concat(partes)));
  doc.font('Helvetica').fontSize(11).text('Comodoro Rivadavia, 1 de diciembre de 2026.', { align: 'right' }).moveDown(2);
  doc.font('Helvetica-Bold').text(`Nota Digital N° ${numero}`).moveDown();
  doc.font('Helvetica').text(`Nota de prueba con datos inventados. Firma: ${firmante}.`);
  doc.end();
});

// La firma agregada al final: los objetos nuevos, su xref y su trailer. Como iText, deja un salto de línea antes de lo agregado
const firmar = (original, { carpeta, sujeto, cuando, conCadena = false }) => {
  const clave = path.join(carpeta, 'clave.pem');
  const certificado = path.join(carpeta, 'certificado.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-utf8', '-keyout', clave, '-out', certificado, '-days', '3650',
    '-subj', sujeto, '-sha256'], { stdio: 'ignore' });
  const texto = original.toString('latin1');
  const previo = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(texto)[1]);
  const tamano = Number(/\/Size (\d+)/.exec(texto.slice(texto.lastIndexOf('trailer')))[1]);
  const raiz = Number(/\/Root (\d+) 0 R/.exec(texto.slice(texto.lastIndexOf('trailer')))[1]);
  const catalogo = new RegExp(`(?:^|\\n)${raiz} 0 obj\\s*<<([\\s\\S]*?)>>\\s*endobj`).exec(texto)[1];
  const [idFirma, idWidget] = [tamano, tamano + 1];

  const espacio = (n) => ' '.repeat(n);
  let agregado = '\n';
  const posiciones = {};
  const objeto = (id, cuerpo) => {
    posiciones[id] = original.length + Buffer.byteLength(agregado, 'latin1');
    agregado += `${id} 0 obj\n${cuerpo}\nendobj\n`;
  };
  const contenidoVacio = '0'.repeat(LARGO_CONTENTS);
  const reservaRango = espacio(40);
  objeto(idFirma, `<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/M(D:${cuando}-03'00')/ByteRange [@@${reservaRango}]/Contents <${contenidoVacio}>>>`);
  objeto(idWidget, `<</Subtype/Widget/T(Signature1)/V ${idFirma} 0 R/F 132/Type/Annot/FT/Sig/DR<<>>/Rect[0 0 0 0]>>`);
  objeto(raiz, `<<${catalogo}/AcroForm<</Fields[${idWidget} 0 R]/SigFlags 3>>>>`);
  const inicioXref = original.length + Buffer.byteLength(agregado, 'latin1');
  const fila = (n) => `${String(n).padStart(10, '0')} 00000 n \n`;
  agregado += `xref\n${raiz} 1\n${fila(posiciones[raiz])}${idFirma} 2\n${fila(posiciones[idFirma])}${fila(posiciones[idWidget])}`;
  agregado += `trailer\n<</Size ${tamano + 2}/Root ${raiz} 0 R/Prev ${previo}>>\nstartxref\n${inicioXref}\n%%EOF\n`;

  // Los rangos, con su largo fijo: los números van en el lugar reservado, y lo que sobra, con espacios
  const sinRango = Buffer.concat([original, Buffer.from(agregado, 'latin1')]);
  const inicioDeContents = sinRango.indexOf(`/Contents <${contenidoVacio}`, original.length, 'latin1') + '/Contents '.length;
  const finDeContents = inicioDeContents + LARGO_CONTENTS + 2;
  const rango = `0 ${inicioDeContents} ${finDeContents} ${sinRango.length - finDeContents} `;
  const marca = sinRango.indexOf(`[@@${reservaRango}]`, original.length, 'latin1') + 1;
  sinRango.write(rango.padEnd(2 + reservaRango.length, ' '), marca, 'latin1');

  // El CMS, sin el contenido (detached), sobre los dos rangos
  const cubierto = path.join(carpeta, 'cubierto.bin');
  const salida = path.join(carpeta, 'firma.der');
  fs.writeFileSync(cubierto, Buffer.concat([sinRango.subarray(0, inicioDeContents), sinRango.subarray(finDeContents)]));
  // Con otro certificado de una clave EC, más corto: los certificados del CMS van ordenados por sus bytes, así que va antes que el del firmante
  const cadena = [];
  if (conCadena) {
    const otra = path.join(carpeta, 'otra.pem');
    const otro = path.join(carpeta, 'otro.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', otra, '-out', otro, '-days', '3650',
      '-subj', '/CN=Autoridad de Prueba/C=AR'], { stdio: 'ignore' });
    cadena.push('-certfile', otro);
  }
  execFileSync('openssl', ['cms', '-sign', '-binary', '-md', 'sha256', '-nosmimecap', '-in', cubierto, '-signer', certificado, '-inkey', clave,
    ...cadena, '-outform', 'DER', '-out', salida], { stdio: 'ignore' });
  const hexadecimal = fs.readFileSync(salida).toString('hex');
  if (hexadecimal.length > LARGO_CONTENTS) throw new Error('El CMS no entra en /Contents');
  sinRango.write(hexadecimal.padEnd(LARGO_CONTENTS, '0'), inicioDeContents + 1, 'latin1');
  return sinRango;
};

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'rpad-firma-'));
try {
  const notas = [
    { archivo: 'nota-a', numero: '12/26', firmante: 'Julieta Ferreyra', sujeto: '/CN=Julieta Ferreyra/serialNumber=CUIL 00000000000/C=AR', cuando: '20261201091200' },
    { archivo: 'nota-b', numero: '13/26', firmante: 'José Núñez', sujeto: '/CN=José Núñez/serialNumber=CUIL 00000000001/C=AR', cuando: '20261201091500' },
    { archivo: 'nota-c', numero: '14/26', firmante: 'Julieta Ferreyra', sujeto: '/CN=Julieta Ferreyra/serialNumber=CUIL 00000000000/C=AR', cuando: '20261201091800', conCadena: true }
  ];
  for (const nota of notas) {
    const original = await pdfDeNota(nota.numero, nota.firmante);
    fs.writeFileSync(path.join(AQUI, `${nota.archivo}.pdf`), original);
    fs.writeFileSync(path.join(AQUI, `${nota.archivo}-firmada.pdf`), firmar(original, { carpeta, ...nota }));
  }
} finally {
  fs.rmSync(carpeta, { recursive: true, force: true });
}

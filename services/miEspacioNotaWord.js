/**
 * Mi espacio, la nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word, sección 3): el .docx que la persona imprime
 * y firma, armado con la librería `docx` (8.5.0) desde la nota de `notaDeLicencia` (`services/miEspacioNota.js`), la misma de la
 * vista del segundo paso (`htmlDeLaNota`): los mismos renglones, en el mismo orden, con los mismos renglones vacíos.
 *
 * La hoja: A4 blanca, con 2,5 cm arriba y abajo y 3 cm a los costados, sin encabezado, sin pie, sin membrete ni marca de agua.
 * Arial 11 con interlineado 1,15 y sin espacio entre párrafos, en el párrafo por defecto del documento (no en cada párrafo):
 * los renglones vacíos miden lo mismo que los escritos. Es un armado propio y chico, aparte del de `services/notasWord.js`: así
 * el Word del Generador de Notas y el de las Notas Digitales no cambian. Todo texto de la nota pasa por `textoParaWord`: un
 * carácter que el XML no admite (un carácter de control, un surrogate solo) no deja el Word dañado.
 *
 * Las medidas van en twips (20 por punto, 1440 por pulgada, 567 por centímetro) y las letras en medios puntos, como las pide
 * `docx`. Las de la hoja van escritas como literales: `convertMillimetersToTwip` redondea para abajo y daría 11905 × 16837.
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, LineRuleType } from 'docx';
import { textoParaWord } from './notasWord.js';
import { LINEA_DE_LA_FIRMA } from './miEspacioNota.js';

// La hoja, en twips: A4 (210 × 297 mm) con 2,5 cm arriba y abajo y 3 cm a los costados
export const HOJA_DE_LA_NOTA = Object.freeze({ ancho: 11906, alto: 16838, arriba: 1417, abajo: 1417, izquierda: 1701, derecha: 1701 });

// El MIME de Word, el mismo que el de los Word de controllers/notasController.js
export const TIPO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// La letra, en medios puntos: Arial 11 y, en el renglón del personal contratado de la firma, 9 (como en las Notas Digitales)
const LETRA = 22;
const LETRA_CHICA = 18;
// Interlineado 1,15: 276 (con lineRule auto, 240 es el sencillo)
const INTERLINEADO = 276;
// La sangría del primer renglón del cuerpo y del cierre: 1,25 cm
const SANGRIA = 709;
// La firma va centrada en la mitad derecha: 8 cm de sangría izquierda
const SANGRIA_DE_LA_FIRMA = 4535;

const listaDe = (valor) => (Array.isArray(valor) ? valor : []);
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

// Un renglón de la nota: un párrafo con su texto (que pasa por textoParaWord) y su diagramación; `chico`, en 9 pt
const renglon = (texto, { chico = false, ...diagramacion } = {}) => new Paragraph({
  ...diagramacion,
  children: [new TextRun({ text: textoParaWord(texto), size: chico ? LETRA_CHICA : undefined })]
});
// Los renglones vacíos, sin diagramación propia: la letra y el interlineado del párrafo por defecto
const vacios = (cuantos) => Array.from({ length: cuantos }, () => new Paragraph({}));

const A_LA_DERECHA = { alignment: AlignmentType.RIGHT };
const CON_SANGRIA = { indent: { firstLine: SANGRIA } };
const DE_LA_FIRMA = { alignment: AlignmentType.CENTER, indent: { left: SANGRIA_DE_LA_FIRMA } };

// Los párrafos de la nota, en el orden de htmlDeLaNota: la fecha a la derecha y dos renglones vacíos; el destinatario, el «S / D»
// y uno vacío; el saludo y uno vacío; el cuerpo, justificado y con sangría, y uno vacío; el cierre, con sangría, y cuatro vacíos;
// y la firma (la línea, el nombre, el renglón chico y el cargo), centrada en la mitad derecha. Una línea de la firma que no es
// un objeto no va, como en la vista
const parrafosDe = (nota) => [
  renglon(nota.fecha, A_LA_DERECHA), ...vacios(2),
  ...listaDe(nota.destinatario).map((linea) => renglon(linea)), renglon(nota.sd), ...vacios(1),
  renglon(nota.saludo), ...vacios(1),
  renglon(nota.cuerpo, { ...CON_SANGRIA, alignment: AlignmentType.JUSTIFIED }), ...vacios(1),
  renglon(nota.cierre, CON_SANGRIA), ...vacios(4),
  renglon(LINEA_DE_LA_FIRMA, DE_LA_FIRMA),
  ...listaDe(nota.firma).filter(esObjeto).map((linea) => renglon(linea.texto, { ...DE_LA_FIRMA, chico: linea.chico === true }))
];

/**
 * El Word de una nota de licencia.
 * @param {{ fecha: string, destinatario: string[], sd: string, saludo: string, cuerpo: string, cierre: string,
 *   firma: Array<{ texto: string, chico: boolean }> }} nota La nota de `notaDeLicencia`.
 * @returns {Promise<Buffer>}
 */
export const renderNotaDocx = (nota) => {
  if (!esObjeto(nota)) return Promise.reject(new TypeError('La nota de licencia no es una nota'));
  const documento = new Document({
    creator: 'RPAD',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: LETRA },
          paragraph: { spacing: { line: INTERLINEADO, lineRule: LineRuleType.AUTO, before: 0, after: 0 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: HOJA_DE_LA_NOTA.ancho, height: HOJA_DE_LA_NOTA.alto },
          margin: {
            top: HOJA_DE_LA_NOTA.arriba, right: HOJA_DE_LA_NOTA.derecha, bottom: HOJA_DE_LA_NOTA.abajo, left: HOJA_DE_LA_NOTA.izquierda
          }
        }
      },
      children: parrafosDe(nota)
    }]
  });
  return Packer.toBuffer(documento);
};

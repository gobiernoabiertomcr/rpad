// Imágenes que llegan en el cuerpo de un pedido como base64 (firma y banner del membrete de Correos, firma de Mi Perfil).
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 9)
export const IMAGEN_MAX_BYTES = 500 * 1024;
// Primeros bytes de cada formato aceptado
const CABECERAS = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };

export class ImagenSubidaInvalida extends Error {}

/**
 * { imagen: base64 o data URL, mime } → Buffer listo para guardar. Lanza ImagenSubidaInvalida con el mensaje para la
 * pantalla. tipoInvalido: el mensaje si el formato no es PNG ni JPEG; validar(datos, mime): decodifica la imagen y lanza
 * si está dañada (una imagen dañada con la cabecera correcta haría fallar cada nota).
 */
export const decodificarImagenSubida = ({ imagen, mime }, { tipoInvalido, validar }) => {
  // Object.hasOwn: 'constructor' o '__proto__' no son formatos válidos aunque existan en Object.prototype
  if (typeof mime !== 'string' || !Object.hasOwn(CABECERAS, mime) || typeof imagen !== 'string') {
    throw new ImagenSubidaInvalida(tipoInvalido);
  }
  const base64 = imagen.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ImagenSubidaInvalida('La imagen no es base64 válido');
  const datos = Buffer.from(base64, 'base64');
  if (datos.length === 0 || datos.length > IMAGEN_MAX_BYTES) throw new ImagenSubidaInvalida('La imagen debe pesar como máximo 500 KB');
  if (!CABECERAS[mime].every((byte, i) => datos[i] === byte)) {
    throw new ImagenSubidaInvalida('El contenido no corresponde a una imagen PNG o JPEG');
  }
  try {
    validar(datos, mime);
  } catch (error) {
    throw new ImagenSubidaInvalida(error.message);
  }
  return datos;
};

// Lo que se responde cuando el cuerpo de un pedido no se puede usar (spec 2026-11-03-validacion-api-publica). Un texto fijo y un
// renglón en la consola: err.message y err.body repiten lo que mandó el cliente, que puede ser una contraseña

const MENSAJES_DEL_CUERPO = {
  400: 'Los datos enviados no tienen un formato válido.',
  413: 'Los datos enviados superan el tamaño permitido.'
};

const rechazar = (req, res, status, motivo) => {
  console.warn(`Pedido rechazado (${motivo}): ${req.method} ${req.path}`);
  res.status(status).json({ success: false, error: MENSAJES_DEL_CUERPO[status] });
};

// Las claves que pisan lo que todo objeto trae de fábrica. Ninguna pantalla las manda
const CLAVES_RESERVADAS = new Set(['__proto__', 'constructor', 'toString', 'valueOf']);

// Sin recursión (un JSON puede venir muy anidado) y después de leerlo: un `reviver` de JSON.parse haría mucho más lenta la lectura
export const tieneClaveReservada = (raiz) => {
  const pendientes = [raiz];
  while (pendientes.length > 0) {
    const valor = pendientes.pop();
    if (Array.isArray(valor)) {
      for (const hijo of valor) if (typeof hijo === 'object' && hijo !== null) pendientes.push(hijo);
    } else if (typeof valor === 'object' && valor !== null) {
      for (const clave of Object.keys(valor)) {
        if (CLAVES_RESERVADAS.has(clave)) return true;
        const hijo = valor[clave];
        if (typeof hijo === 'object' && hijo !== null) pendientes.push(hijo);
      }
    }
  }
  return false;
};

// Después de express.json y express.urlencoded: un valor del cuerpo tiene que comportarse como un dato común, en todas las rutas
export const sinClavesReservadas = (req, res, next) => {
  if (tieneClaveReservada(req.body)) return rechazar(req, res, 400, 'clave reservada');
  next();
};

// Antes del manejador global: los errores de la lectura del cuerpo (los que traen err.type) que son del pedido. Los demás siguen de largo
export const erroresDelCuerpo = (err, req, res, next) => {
  if (typeof err.type === 'string' && Object.hasOwn(MENSAJES_DEL_CUERPO, err.status)) return rechazar(req, res, err.status, err.type);
  next(err);
};

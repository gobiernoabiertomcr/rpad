/**
 * Mi espacio - RPAD (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 8 y 11)
 * El panel personal de cada usuario: sus licencias, sus horas extras, lo que le queda y su agenda, en cuatro pestañas que viajan en
 * la dirección (#resumen, #licencias, #horas y #agenda). Lo que se carga acá lo ve solo su dueño, salvo los eventos que comparte. Los
 * números y los textos los arma el servidor (GET /api/mi-espacio/resumen, /mi-espacio/licencias?anio=, /mi-espacio/horas-extras?anio=
 * y /mi-espacio/eventos?desde=&hasta=, con services/miEspacioResumen.js y services/miEspacioEventosReglas.js) y la página los imprime
 * tal cual: no recalcula nada (Ruling 19). Sin la modalidad cargada, las tres primeras pestañas muestran el mensaje del servidor y no
 * dejan cargar nada; la agenda se ve igual (decisión del usuario, 27/10/2026).
 * - Resumen «Titular» (spec 2026-10-27-mi-espacio-resumen): los faltantes en un aviso ámbar; la banda celeste, con la frase («Te
 *   quedan 33 días de vacaciones», con el día y la modalidad arriba y la bajada debajo), «Vence pronto» (cada cosa como una entrada
 *   amarilla con su talón, su línea y el botón que la resuelve) y la regla (los días por licencia, un tramo por capa, con su lista);
 *   «El resto de 2026» (un número con su línea por saldo, cada uno un link a su pestaña, los francos o las horas a favor mes por mes
 *   y la médica extraordinaria); y «Hoy y mañana» en columnas (los eventos de hoy y de mañana, quién no está —solo para
 *   administración— y el próximo feriado). La pestaña lleva una marca ámbar si algo vence pronto.
 * - Licencias: la lista del año, con el selector del año y los filtros por tipo (con su cantidad); al final, el saldo inicial con
 *   «Cambiar». Lo anterior al saldo inicial y lo que no corresponde a la modalidad actual se ven en gris, con su motivo. Cada
 *   licencia, menos el uso autorizado, tiene «Word» al lado de «Editar» (spec 2026-10-27-mi-espacio-licencia-word, 6): la nota de
 *   licencia, de GET /mi-espacio/licencias/:id/word con un fetch propio (el token en el encabezado; API.pedirArchivo no da los
 *   encabezados), con el nombre del Content-Disposition (nombreDelAdjunto) y bajada con descargarBlob (bajarWordDeLicencia).
 * - Horas extras: la tabla por mes (en planta, los francos; en contrato, las horas a favor, con lo mismo en días de franco debajo)
 *   y el día por día de un mes (cada mes de la tabla es un botón; de entrada, el en curso; en contrato, las salidas de la planilla,
 *   cada una con «Editar», data-editar-salida) y, en contrato, las horas no utilizadas previamente. La planilla de contrato (spec
 *   2026-10-27-mi-espacio-horas, secciones 4 y 9): lo puro arma las semanas y las filas de un mes con los cambios de la página
 *   encima, la banda, el pie, «Sumar el día», los errores y el cuerpo de PUT /mi-espacio/salidas; la página (#modal-planilla, que
 *   abren en contrato «Cargar horas extras» y «Editar» del día por día; en planta, todo sigue con #modal-horas) pide cada mes una
 *   vez por apertura (GET /mi-espacio/salidas?mes=; el en curso, sin él), actualiza la fila, la semana, la banda y el pie mientras
 *   se escribe (sin volver a dibujar la fila), guarda los días cambiados de todos los meses juntos (con un fetch propio:
 *   API.pedirJson no da los errores de cada día; mientras tanto, la planilla no acepta cambios) y, al cerrar con cambios, pregunta
 *   en la confirmación de la página.
 * - Agenda (spec 2026-10-26-mi-espacio-agenda, 6): el mes de lunes a domingo, con «‹», «›», «Hoy» y hasta 3 cosas por día («y N
 *   más» muestra el resto), en sus colores (lo tuyo, lo compartido, tus licencias y francos, los feriados y los compañeros que no
 *   están) con su leyenda, y al costado los próximos 30 días (Hoy, Mañana, Esta semana y Más adelante). El mes no va en la
 *   dirección. «Hoy y mañana» del Resumen suma los eventos de hoy y de mañana. Un evento propio (de la grilla o de los próximos) abre
 *   su formulario; uno de otra persona, su detalle con «Mi recordatorio» (que se guarda al elegirlo); los dos «Nuevo evento», el
 *   formulario vacío (hoy y «2 horas antes»), también sin modalidad. Compartir («¿Quién lo ve?», con las personas de
 *   GET /mi-espacio/personas, pedidas una vez, o «Todos») es solo de administración (Auth.isAdmin(), el true literal): el lector y
 *   el colaborador tienen solo eventos personales. Cuándo sale el recordatorio lo dice el servidor (GET /mi-espacio/eventos/aviso,
 *   300 ms después del último cambio; una respuesta vieja se descarta).
 * Los formularios (secciones 4, 6 y 8; maqueta 2), modales que un clic en el velo no cierra: «Cargar licencia» (los tipos de la
 * modalidad con lo que queda de cada uno, el cálculo del servidor 300 ms después del último cambio, «Mostrar a mis compañeros»,
 * el aviso del paso a Configuración, la persona a cargo del firmante en sus vacaciones y los días sin auditor), «Cargar horas
 * extras» (con lo que suman en el mes; en contrato, la planilla del mes), «Mis vacaciones y saldos» (se abre solo sin el saldo
 * inicial), «Registrar un uso autorizado» y la confirmación de un borrado (o de salir de la planilla con cambios), que se abre sobre
 * el formulario. Los abren los botones del encabezado y los data-* de las pestañas (data-cargar, data-abrir, data-editar-licencia,
 * data-editar-horas, data-editar-salida y, en «Vence pronto», data-accion con su data-tipo). Al guardar una licencia (no un uso
 * autorizado), «Cargar licencia» no se cierra: pasa al segundo paso (spec
 * 2026-10-27-mi-espacio-licencia-word, 6; la versión C de la maqueta), con la licencia guardada, la nota a la vista (GET
 * /mi-espacio/licencias/:id/nota, la hoja armada y escapada por el servidor, que va tal cual), «Listo» y «Descargar Word»; lo
 * guardado se anuncia en #me-anuncio, sin aviso flotante, y al cerrar el foco va adonde va después de cualquier guardado.
 * Copias mínimas, para avisar en el momento (el servidor valida igual), atadas por tests de paridad: los mensajes y
 * las constantes de services/miEspacioReglas.js, horasDelHorario (horasDe), en la planilla horasDelDiaDeLaPlanilla (horasDeLaSalida,
 * con el tipo del día que manda el servidor), enDiasDeFranco, textoDeLaSumaDelMes y erroresDeLaPlanilla (los pasos 3 a 7 de
 * validarSalida), camposConLoElegido (camposDelSaldoInicial), las de
 * Configuración (efectoEnNotas, textoSinAuditor, textoAusenciasAutorizado y parametrosSinAuditor, de usuarios.js) y, en la agenda,
 * DIAS_DE_PROXIMOS (services/miEspacioEventosReglas.js), diaLargoDe (diaLargo) y tituloDelMes (mesTitulo, los dos de
 * services/miEspacioResumen.js), y en el evento, las de services/miEspacioEventosReglas.js: MENSAJES_EVENTO, LARGO_TITULO_EVENTO,
 * LARGO_DETALLE_EVENTO, FECHA_MINIMA_EVENTO, fechaMaximaEvento, textoRangoDelEvento (textoRangoEvento), RECORDATORIOS,
 * RECORDATORIO_POR_DEFECTO, TEXTO_RECORDATORIO, erroresDelEvento (validarEvento, en sus bordes), cuandoDelEventoDe
 * (cuandoDelEvento) e iniciales (inicialesDe), e idDeLaPersona (idPositivo de services/proyectosReglas.js). La agenda no recalcula
 * días hábiles ni textos: los días que pinta una licencia o un compañero, el aviso, quién está y «Hasta el …» los manda el
 * servidor; acá solo se cuentan los días de la grilla, con Date.UTC.
 * Al cargarse el archivo solo declara (tests/mi-espacio-frontend.test.js lo carga en un vm después del api.js de verdad): lo que
 * arma HTML es puro y va primero; lo que toca el DOM o la API va aparte, al final (iniciarMiEspacio, enganchado a
 * DOMContentLoaded), con los eventos delegados en contenedores fijos: volver a dibujar no engancha nada, y el foco vuelve al control
 * que se usó (en la agenda, al del mismo lugar —la grilla o los próximos—, saltando los ocultos). Pide los datos con
 * API.pedirJson. Todo texto del servidor pasa por Utils.escapeHtml (también en los aria-label) y un número se escribe con String
 * (Utils.escapeHtml(0) da ''); lo que va con textContent (los títulos de los modales, la confirmación), tal cual. Lo que cambia se anuncia en #me-anuncio, la única región viva de la página (en cada modal, su error sin
 * campo es role="alert"); lo que dice el servidor al guardar o borrar (salvo al guardar una licencia: lo dice el segundo paso), y
 * un formulario que no se pudo abrir, se ve además en un aviso (avisarMiEspacio: el showToast de main.js, como en Áreas, Feriados
 * y Proyectos).
 */

// =====================================================
// Constantes
// =====================================================

// Las pestañas, en su orden: el fragmento de la dirección. Uno desconocido, o ninguno, abre el Resumen
const PESTANAS = Object.freeze(['resumen', 'licencias', 'horas', 'agenda']);

// Copia de MENSAJES_MI_ESPACIO.sinArranque (services/miEspacioReglas.js), atada por un test de paridad
const TEXTO_SIN_ARRANQUE = 'Para empezar, completá «Mis vacaciones y saldos».';

// El color de la insignia de cada tipo de licencia
const CLASE_DEL_TIPO = Object.freeze({
  vacaciones: 'azul', franquicia: 'violeta', estudios: 'ambar', medica: 'rojo', medica_extraordinaria: 'rojo', familiar: 'azul',
  franco: 'verde', horas_a_favor: 'verde', uso_autorizado: 'gris'
});
// El color de la situación de un mes de horas extras (el `estado` que manda el servidor): todavía suma, se habilita, para usar o
// usado. Lo que ya no se usa (no genera franco, no utilizado previamente, ya está en el saldo inicial) va en gris, sin insignia
const CLASE_DE_LA_SITUACION = Object.freeze({ sumando: 'gris', proximo: 'azul', en_uso: 'ambar', usados: 'verde', usadas: 'verde' });
const SITUACIONES_EN_GRIS = Object.freeze(['sin_franco', 'no_utilizado', 'no_utilizadas', 'antes_del_arranque']);

// La nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word, 6): el nombre del archivo si la respuesta no trae
// Content-Disposition, y lo que se dice si la descarga falla sin un mensaje del servidor
const NOMBRE_DEL_WORD_POR_DEFECTO = 'Nota de licencia.docx';
const MENSAJE_SIN_DESCARGA = 'No se pudo descargar la nota. Probá de nuevo en unos minutos.';

const NOTA_DE_LAS_LICENCIAS = 'Los días se cuentan hábiles: sin sábados, domingos ni feriados.';
const NOTA_DE_LOS_FRANCOS = 'Solo las horas extras al 100%. Cada 7 horas de un mes dan un franco compensatorio, que se usa dos meses '
  + 'después, en ese mes.';
const NOTA_DE_LAS_HORAS_A_FAVOR = 'Cada hora extra de un mes es una hora menos de trabajo el mes siguiente, de a media hora. 7 horas '
  + 'son el día entero.';
const NOTA_DE_LAS_NO_UTILIZADAS = 'Quedan a la vista aunque su mes ya pasó. Vuelven a cero el 1/1.';

// El Resumen «Titular»: la clase de cada capa del tanque de vacaciones, en un tramo de la regla y en su muestra (la `clase` del
// servidor; una desconocida, en tinta), y la de cada mes de los francos o de las horas a favor (el `estado`; el disponible, sin
// clase)
const CLASE_DE_LA_CAPA = Object.freeze({
  vence: 'vence', tinta: 'tinta', medio: 'medio', cargadas: 'cargadas', por_habilitar: 'por_habilitar'
});
const CLASE_DE_LA_PASTILLA = Object.freeze({ vence: 'vence', pendiente: 'pendiente' });
// El movimiento del Resumen (spec 2026-10-27-mi-espacio-resumen, 3), en milisegundos: los tramos de la regla empiezan a los 250 y
// duran en total unos 1300, cada uno max(160, n / capacidad × 1300), uno detrás del otro; las líneas del resto, a los 900 y 90
// más por línea, de 700 cada una. Se escriben en el style de cada tramo y de cada línea (--demora y --duracion; la duración de
// las líneas, en el <style>), y con los mismos tiempos suben los números (animarLaBanda)
const DEMORA_DE_LA_REGLA = 250;
const DURACION_DE_LA_REGLA = 1300;
const TRAMO_MINIMO = 160;
const DEMORA_DEL_RESTO = 900;
const ENTRE_LINEAS = 90;
const DURACION_DE_LA_LINEA = 700;
// La ola de abajo de la banda: el dibujo de las páginas públicas, en el celeste de la banda (currentColor), que cae sobre el fondo
// de la página. Decorativa
const OLA_DE_LA_BANDA = '<svg class="me-ola" viewBox="0 0 1200 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
  + '<path d="M0 0 H1200 V14 C 1100 26, 1000 26, 900 14 S 700 2, 600 12 S 400 28, 300 16 S 100 4, 0 18 Z" fill="currentColor"/></svg>';
const TEXTO_DE_LA_MARCA = 'Hay algo que vence pronto';
// El nombre de la lista de la regla (la de la maqueta aprobada): la barra es decorativa y la lista dice lo mismo en texto
const TEXTO_DE_LA_REGLA = 'Tus vacaciones, por licencia';

// =====================================================
// Lo puro: lo que arma el HTML
// =====================================================

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const listaDe = (valor) => (Array.isArray(valor) ? valor.filter(esObjeto) : []);
// Un texto o un número del servidor, escapado (un número también: Utils.escapeHtml(0) da '')
const esc = (valor) => Utils.escapeHtml(String(valor ?? ''));
// El valor de un mapa del servidor, o el de reserva (sin heredar nada de Object.prototype)
const deMapa = (mapa, clave, reserva) => (esObjeto(mapa) && Object.hasOwn(mapa, clave) ? mapa[clave] : reserva);
const conTexto = (valor) => typeof valor === 'string' && valor.trim() !== '';
// Un año del servidor en un título o en un vacío («de 2026», «en 2026»); uno que no es un año, nada
const delAnio = (anio) => (Number.isInteger(anio) ? ` de ${String(anio)}` : '');
const enElAnio = (anio) => (Number.isInteger(anio) ? ` en ${String(anio)}` : '');

function pestanaDeHash(hash) {
  const nombre = String(hash ?? '').replace(/^#/, '');
  return PESTANAS.includes(nombre) ? nombre : PESTANAS[0];
}

// El mensaje del servidor en lugar de una pestaña (sin modalidad cargada)
function htmlDeMensaje(texto) {
  return `<p class="me-aviso me-aviso-gris">${esc(texto)}</p>`;
}

// Con la modalidad y sin el saldo inicial: el botón abre «Mis vacaciones y saldos»
function htmlSinArranque() {
  return `<div class="me-aviso me-aviso-azul"><p>${esc(TEXTO_SIN_ARRANQUE)}</p>`
    + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-abrir="saldos">Mis vacaciones y saldos</button></div>';
}

// Un error de una carga, en la pestaña
function htmlDeError(texto) {
  return `<p class="me-aviso me-aviso-error">${esc(texto)}</p>`;
}

// ---- El Resumen «Titular» (spec 2026-10-27-mi-espacio-resumen, 2 y 5) ----

// La marca ámbar de la pestaña Resumen cuando algo vence pronto (como la del Estado en Correos: una imagen con su nombre, no un
// title). Solo con el true literal
function htmlDeMarca(marca) {
  return marca === true ? `<span class="me-marca" role="img" aria-label="${TEXTO_DE_LA_MARCA}"></span>` : '';
}

// Los faltantes (lo guardado que dejó de cerrar), con su texto neutro, en un aviso ámbar arriba de todo. Sin ninguno, ''
function htmlDeFaltantes(faltantes) {
  const textos = (Array.isArray(faltantes) ? faltantes : []).filter(conTexto);
  if (textos.length === 0) return '';
  if (textos.length === 1) return `<p class="me-aviso me-aviso-ambar">${esc(textos[0])}</p>`;
  return `<div class="me-aviso me-aviso-ambar"><ul class="me-faltantes">${textos.map((texto) => `<li>${esc(texto)}</li>`).join('')}</ul></div>`;
}

// El número de la frase como texto: el del servidor ('33'; uno que es un número, con String). Sin él, ''
const textoDeLaCifra = (cifra) => {
  if (typeof cifra === 'number' && Number.isFinite(cifra)) return String(cifra);
  return conTexto(cifra) ? cifra : '';
};

/**
 * La frase de la banda (el `titular` del Resumen: `{ encabezado, antes, cifra, despues, bajada: [{ texto, vence }] }`): arriba, el día
 * y la modalidad; el título de la pestaña, «Te quedan 33 días de vacaciones», con el número tres veces: el final, invisible, que le
 * da al número su ancho desde el primer cuadro; el que se ve, encima (el que sube al abrir, data-contar); los dos, decorativos
 * (aria-hidden); y el oculto a la vista, que un lector de pantalla lee siempre con su valor final. Debajo, la bajada, las oraciones
 * unidas con un espacio, la que vence en negrita. Sin `cifra` (con 0 días), la frase sin el número; sin oraciones, sin bajada. Sin
 * titular, ''
 */
function htmlDeLaFrase(titular) {
  if (!esObjeto(titular)) return '';
  const cifra = textoDeLaCifra(titular.cifra);
  const numero = cifra === '' ? ''
    : `<span class="me-cifra"><span class="me-cifra-final" aria-hidden="true">${esc(cifra)}</span>`
      + `<span aria-hidden="true" data-contar>${esc(cifra)}</span><span class="visualmente-oculto">${esc(cifra)}</span></span>`;
  const frase = [conTexto(titular.antes) ? esc(titular.antes) : '', numero, conTexto(titular.despues) ? esc(titular.despues) : '']
    .filter((parte) => parte !== '').join(' ');
  const oraciones = listaDe(titular.bajada).filter((oracion) => conTexto(oracion.texto))
    .map((oracion) => (oracion.vence === true ? `<b class="vence">${esc(oracion.texto)}</b>` : esc(oracion.texto)));
  return '<div class="me-titular">'
    + `${conTexto(titular.encabezado) ? `<p class="me-banda-dia">${esc(titular.encabezado)}</p>` : ''}`
    + `<h2 class="me-frase" id="me-frase">${frase}</h2>`
    + `${oraciones.length > 0 ? `<p class="me-frase-bajada">${oraciones.join(' ')}</p>` : ''}</div>`;
}

/**
 * «Vence pronto» (los `vence_pronto` del Resumen, `{ fecha, dia, mes, titulo, texto, accion }`), al lado de la frase: cada cosa es
 * una entrada amarilla con el talón de la fecha (decorativo: la línea ya la dice), el título, su línea («Vence el viernes 30/10, en 4
 * días.») y el botón que la resuelve, que abre «Cargar licencia» con su tipo (data-accion y data-tipo) y se describe con el título.
 * Sin nada, ''
 */
function htmlDeVencePronto(lista) {
  const cosas = listaDe(lista);
  if (cosas.length === 0) return '';
  const entradas = cosas.map((cosa, i) => {
    const accion = esObjeto(cosa.accion) ? cosa.accion : {};
    return `<li class="me-entrada"><span class="me-talon" aria-hidden="true"><b>${esc(cosa.dia)}</b>${esc(cosa.mes)}</span>`
      + `<span class="me-entrada-cuerpo"><b id="me-vence-${i}">${esc(cosa.titulo)}</b><span class="me-entrada-texto">${esc(cosa.texto)}</span>`
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-accion="cargar-licencia" data-tipo="${esc(accion.tipo)}" `
      + `aria-describedby="me-vence-${i}">${esc(accion.texto)}</button></span></li>`;
  });
  return '<aside class="me-vence" aria-labelledby="me-vence-titulo"><h2 id="me-vence-titulo">Vence pronto</h2>'
    + `<ol class="me-entradas">${entradas.join('')}</ol></aside>`;
}

// Una cantidad de una capa: un número positivo; lo demás, 0
const cantidadDeLaCapa = (capa) => (typeof capa.n === 'number' && Number.isFinite(capa.n) && capa.n > 0 ? capa.n : 0);

// Cuándo empieza y cuánto dura cada tramo de la regla, en ms (spec, 3): el primero a los 250 y cada uno max(160, n / capacidad ×
// 1300), redondeado, y el que sigue empieza donde termina el anterior. Con una capacidad que no es un número positivo, todos en 0
// (quietos). Recibe las cantidades ya leídas (cantidadDeLaCapa) y devuelve [{ demora, duracion }]
function tiemposDeLaRegla(cantidades, capacidad) {
  if (!(typeof capacidad === 'number' && Number.isFinite(capacidad) && capacidad > 0)) return cantidades.map(() => ({ demora: 0, duracion: 0 }));
  let demora = DEMORA_DE_LA_REGLA;
  return cantidades.map((n) => {
    const tiempo = { demora, duracion: Math.round(Math.max(TRAMO_MINIMO, (n / capacidad) * DURACION_DE_LA_REGLA)) };
    demora += tiempo.duracion;
    return tiempo;
  });
}

/**
 * La regla (el tanque de vacaciones: `{ capacidad, capas: [{ clase, n, nombre, nota }] }`): la barra, decorativa (la lista de debajo
 * dice lo mismo en texto), partida en un tramo por capa, cada uno en su columna de n fracciones (minmax(0, nfr): uno de 1 día entre
 * 40 se ve igual, y su número, si no entra, lo oculta el <style>), en el color de su clase, con un casillero por día (--n) y lo que
 * necesita el movimiento (--demora y --duracion); debajo, la lista («Tus vacaciones, por licencia»): cada capa con su muestra,
 * «Licencia 2024: 3» y su nota, la que vence en ámbar. Una n que no es un número positivo cuenta 0. Sin capas, ''
 */
function htmlDeLaRegla(vacaciones) {
  if (!esObjeto(vacaciones)) return '';
  const capas = listaDe(vacaciones.capas);
  if (capas.length === 0) return '';
  const cantidades = capas.map(cantidadDeLaCapa);
  const tiempos = tiemposDeLaRegla(cantidades, vacaciones.capacidad);
  const columnas = cantidades.map((n) => `minmax(0, ${String(n)}fr)`).join(' ');
  const tramos = capas.map((capa, i) => {
    const n = String(cantidades[i]);
    const { demora, duracion } = tiempos[i];
    return `<span class="me-tramo ${deMapa(CLASE_DE_LA_CAPA, capa.clase, 'tinta')}" `
      + `style="--n:${n};--demora:${String(demora)}ms;--duracion:${String(duracion)}ms"><span>${n}</span></span>`;
  });
  const lista = capas.map((capa, i) => {
    const clase = deMapa(CLASE_DE_LA_CAPA, capa.clase, 'tinta');
    return `<li${clase === 'vence' ? ' class="vence"' : ''}><i class="me-muestra ${clase}" aria-hidden="true"></i>`
      + `<span><b>${esc(capa.nombre)}: ${String(cantidades[i])}</b>${esc(capa.nota)}</span></li>`;
  });
  return `<div class="me-regla"><div class="me-barra" aria-hidden="true" style="grid-template-columns: ${columnas}">${tramos.join('')}</div>`
    + `<ul class="me-regla-lista" aria-label="${TEXTO_DE_LA_REGLA}">${lista.join('')}</ul></div>`;
}

/**
 * La banda celeste, arriba del Resumen: una section que se nombra con la frase; adentro, la frase, «Vence pronto» (a la derecha en la
 * compu; sin nada por vencer, la frase y la regla a todo el ancho: sin-vence) y la regla, y debajo la ola. Sin la frase o sin los
 * tanques (sin un hoy válido), o sin el Resumen, ''
 */
function htmlDeLaBanda(resumen) {
  if (!esObjeto(resumen) || !esObjeto(resumen.titular) || !esObjeto(resumen.tanques)) return '';
  const vence = htmlDeVencePronto(resumen.vence_pronto);
  return `<section class="me-banda" aria-labelledby="me-frase"><div class="me-banda-cuerpo${vence === '' ? ' sin-vence' : ''}">`
    + `${htmlDeLaFrase(resumen.titular)}${vence}${htmlDeLaRegla(resumen.tanques.vacaciones)}</div>${OLA_DE_LA_BANDA}</section>`;
}

// Lo que se llena la línea de un número del resto, en %: valor / total × 100, redondeado a un decimal y entre 0 y 100. Con un total
// que no es un número positivo, o un valor que no es un número, 0
const llenoDe = (valor, total) => {
  if (!(typeof total === 'number' && Number.isFinite(total) && total > 0) || !(typeof valor === 'number' && Number.isFinite(valor))) return 0;
  return Math.min(100, Math.max(0, Math.round((valor / total) * 1000) / 10));
};

/**
 * Los francos compensatorios o las horas a favor, mes por mes, en una línea (las `pastillas` del Resumen): el título y una etiqueta
 * por mes, «1 Diciembre Octubre sigue sumando», la del mes que vence en amarillo, la que todavía suma punteada y lo no utilizado
 * previamente en gris. Sin ningún mes ni nada no utilizado, ''
 */
function htmlDeLosMeses(pastillas) {
  if (!esObjeto(pastillas)) return '';
  const mes = (clase, numero, titulo, nota) => `<span class="me-mes${clase ? ` ${clase}` : ''}"><strong>${esc(numero)}</strong> `
    + `${esc(titulo)} <span>${esc(nota)}</span></span>`;
  const meses = listaDe(pastillas.meses).map((uno) => mes(deMapa(CLASE_DE_LA_PASTILLA, uno.estado, ''), uno.numero, uno.mes, uno.nota));
  const { previo } = pastillas;
  if (esObjeto(previo)) meses.push(mes('previo', previo.numero, previo.titulo, previo.nota));
  if (meses.length === 0) return '';
  return `<p class="me-meses"><b>${esc(pastillas.titulo)}:</b>${meses.join('')}</p>`;
}

/**
 * «El resto de 2026», debajo de la banda: la cabeza (el título con el año, el día y «Mis vacaciones y saldos»), un número por cada
 * uno de los demás tanques (franquicias u horas a favor, estudios, atención médica y grupo familiar), cada uno un link a su pestaña
 * (Horas extras o, si no, Licencias) con el aria-label del servidor, con el número que sube al abrir (data-contar) y su unidad, el
 * nombre, su total y una línea decorativa que se llena en la proporción valor / total (--p, con su --demora: 900 ms y 90 más por
 * línea); el que vence, en ámbar. Después, los meses y la médica extraordinaria. Sin tanques (sin un hoy válido), o sin el Resumen,
 * ''
 */
function htmlDelResto(resumen) {
  if (!esObjeto(resumen) || !esObjeto(resumen.tanques)) return '';
  const numeros = listaDe(resumen.tanques.otros).map((tanque, i) => {
    const pestana = tanque.pestana === 'horas' ? 'horas' : 'licencias';
    const linea = `--p:${String(llenoDe(tanque.valor, tanque.total))}%;--demora:${String(DEMORA_DEL_RESTO + ENTRE_LINEAS * i)}ms`;
    return `<li><a class="me-numero${tanque.vence === true ? ' vence' : ''}" href="#${pestana}" data-pestana="${pestana}" aria-label="${esc(tanque.aria)}">`
      + `<span class="grande"><b data-contar>${esc(tanque.numero)}</b><small>${esc(tanque.unidad)}</small></span>`
      + `<span class="nombre">${esc(tanque.nombre)}</span><span class="de">${esc(tanque.de)}</span>`
      + `<span class="me-linea" aria-hidden="true"><i style="${linea}"></i></span></a></li>`;
  });
  return '<section class="me-resto" aria-labelledby="me-resto-titulo"><div class="me-resto-cabeza">'
    + `<h2 id="me-resto-titulo">El resto${delAnio(resumen.anio)}</h2><span class="me-resto-al">`
    + `${conTexto(resumen.al_texto) ? `<span>${esc(resumen.al_texto)}</span>` : ''}`
    + '<button type="button" class="sg-link" data-abrir="saldos">Mis vacaciones y saldos</button></span></div>'
    + `${numeros.length > 0 ? `<ul class="me-numeros">${numeros.join('')}</ul>` : ''}`
    + htmlDeLosMeses(resumen.pastillas)
    + `${conTexto(resumen.extraordinaria) ? `<p class="me-extra">${esc(resumen.extraordinaria)}</p>` : ''}</section>`;
}

// Para el movimiento: el valor de un número del Resumen como lo escribe el servidor ('33'; con decimales, con coma: '1,5'); lo que
// no es un número así (vacío, negativo, con otra cosa), null
const numeroDelTexto = (texto) => {
  const limpio = typeof texto === 'string' ? texto.trim() : '';
  return /^\d+(?:,\d+)?$/.test(limpio) ? Number(limpio.replace(',', '.')) : null;
};

// …y la demora de una línea del resto, en ms, del style que escribe htmlDelResto ('--p:59.5%;--demora:900ms'). Sin ella, 0
const demoraDelEstilo = (estilo) => {
  const ms = /--demora:\s*(\d+(?:\.\d+)?)ms/.exec(typeof estilo === 'string' ? estilo : '')?.[1];
  return ms === undefined ? 0 : Number(ms);
};

// Las iniciales de un nombre, decorativas: la primera letra del primero y del último. Lo que no es un texto, '' (copia de inicialesDe
// de services/miEspacioEventosReglas.js, atada por un test de paridad)
const iniciales = (nombre) => {
  const palabras = typeof nombre === 'string' ? nombre.trim().split(/\s+/).filter(Boolean) : [];
  const inicial = (palabra) => Array.from(palabra)[0].toUpperCase();
  if (palabras.length === 0) return '';
  return palabras.length === 1 ? inicial(palabras[0]) : inicial(palabras[0]) + inicial(palabras.at(-1));
};

/**
 * «Hoy y mañana» (el `hoy_y_manana` del Resumen), al final y en columnas: «Hoy», con los eventos de hoy (`dia: 'hoy'`: la hora, el
 * título y debajo `quien`, «solo vos», «con 4 personas»…) y, para quien ve a sus compañeros (`veCompaneros`, el true literal:
 * administración), los que hoy no están, con el texto y la vuelta que manda el servidor (nunca el tipo); «Mañana», lo mismo de
 * mañana; y «Próximo feriado». Una columna sin nada no va: solo se ven los de administración que eligieron mostrarse, así que «están
 * todos» podría no ser cierto. Con la agenda (`eventos` es una lista, aunque vacía), la sección va siempre (decisión del usuario,
 * 27/10/2026): sin ningún evento, «No tenés eventos hoy ni mañana.» debajo del título, y «Ver la agenda», que abre su pestaña
 * (data-pestana, como los números del resto), al final de la última columna o, sin columnas, después de esa frase. Sin la lista (un
 * Resumen anterior a la agenda), sin «Ver la agenda», y sin ninguna columna no hay sección
 */
function htmlDeHoyYManana(datos, veCompaneros) {
  const hoy = esObjeto(datos) ? datos : {};
  const conEventos = Array.isArray(hoy.eventos);
  const eventos = listaDe(hoy.eventos);
  // La hora y el título, con un espacio entre los dos (sin él, un lector de pantalla y lo copiado dirían «09:00Título»)
  const filaDeEvento = (evento) => `<li>${conTexto(evento.hora) ? `<time>${esc(evento.hora)}</time> ` : ''}${esc(evento.titulo)}`
    + `${conTexto(evento.quien) ? `<small>${esc(evento.quien)}</small>` : ''}</li>`;
  const filaDeAusente = (ausente) => `<li class="ausente">${esc(ausente.texto)}`
    + `${conTexto(ausente.vuelve_texto) ? `<small>${esc(ausente.vuelve_texto)}</small>` : ''}</li>`;
  const delDia = (dia, ausentes) => [
    ...eventos.filter((evento) => evento.dia === dia).map(filaDeEvento),
    ...(veCompaneros === true ? listaDe(ausentes).map(filaDeAusente) : [])
  ];
  const { proximo_feriado: feriado } = hoy;
  const columnas = [
    ['Hoy', delDia('hoy', hoy.ausentes_hoy)],
    ['Mañana', delDia('manana', hoy.ausentes_manana)],
    ['Próximo feriado', esObjeto(feriado) ? [`<li><b>${esc(feriado.cuando)}</b><small>${esc(feriado.nombre)}</small></li>`] : []]
  ].filter(([, filas]) => filas.length > 0);
  if (!conEventos && columnas.length === 0) return '';
  const verLaAgenda = conEventos ? '<a class="sg-link" href="#agenda" data-pestana="agenda">Ver la agenda</a>' : '';
  const sinEventos = conEventos && !eventos.some((evento) => evento.dia === 'hoy' || evento.dia === 'manana');
  const html = columnas.map(([titulo, filas], i) => `<div class="me-columna"><h3>${titulo}</h3><ul>${filas.join('')}</ul>`
    + `${i === columnas.length - 1 ? verLaAgenda : ''}</div>`);
  return '<section class="me-hoy" aria-labelledby="me-hoy-titulo"><h2 id="me-hoy-titulo">Hoy y mañana</h2>'
    + `${sinEventos ? '<p class="me-vacio">No tenés eventos hoy ni mañana.</p>' : ''}`
    + `${html.length > 0 ? `<div class="me-columnas">${html.join('')}</div>` : verLaAgenda}</section>`;
}

/**
 * La pestaña Resumen (lo que manda GET /api/mi-espacio/resumen). Sin modalidad, el mensaje del servidor; sin el saldo inicial,
 * la invitación a «Mis vacaciones y saldos»; si no, los faltantes, la banda (la frase, «Vence pronto» y la regla), «El resto de
 * 2026» y «Hoy y mañana».
 */
function htmlDelResumen(resumen) {
  if (!esObjeto(resumen)) return '';
  if (!esObjeto(resumen.modalidad)) return htmlDeMensaje(resumen.mensaje);
  if (resumen.abrir_saldos === true) return htmlSinArranque();
  return htmlDeFaltantes(resumen.faltantes) + htmlDeLaBanda(resumen) + htmlDelResto(resumen)
    + htmlDeHoyYManana(resumen.hoy_y_manana, esObjeto(resumen.persona) ? resumen.persona.ve_companeros : false);
}

// Los años del selector (los que manda el servidor), con aria-pressed en el elegido
function htmlDelSelectorDeAnio(anios, anio) {
  const botones = (Array.isArray(anios) ? anios : []).filter(Number.isInteger)
    .map((uno) => `<button type="button" data-anio="${String(uno)}" aria-pressed="${String(uno === anio)}">${String(uno)}</button>`)
    .join('');
  return botones ? `<span class="me-segmento" role="group" aria-label="Año">${botones}</span>` : '';
}

// El filtro elegido, si está entre los del año; si no (el elegido en otro año), Todas
const filtroElegido = (filtros, elegido) => (listaDe(filtros).some((filtro) => filtro.tipo === elegido) ? elegido : 'todas');

// «Todas» y cada tipo con filas en el año, con su cantidad
function htmlDeFiltrosDeLicencias(filtros, elegido) {
  const actual = filtroElegido(filtros, elegido);
  const botones = listaDe(filtros).map((filtro) => `<button type="button" class="sg-chip" data-filtro-licencia="${esc(filtro.tipo)}" `
    + `aria-pressed="${String(filtro.tipo === actual)}">${esc(filtro.nombre)} <b>${esc(filtro.cantidad)}</b></button>`).join('');
  return `<div class="sg-chips" role="group" aria-label="Filtrar las licencias por tipo">${botones}</div>`;
}

// Una licencia: las fechas con lo que suman, la insignia del tipo, «Próxima» si no empezó, por qué no cuenta (en gris), de qué
// licencia salen las vacaciones, cómo está en Configuración (en ámbar si hay algo para revisar), si la ven los compañeros, la nota
// y, a la derecha, «Word» (la nota de licencia; todas menos el uso autorizado, también las que ya pasaron) y «Editar»
function htmlDeFilaDeLicencia(fila) {
  const gris = conTexto(fila.no_cuenta_texto);
  const cantidad = conTexto(fila.cantidad_texto) ? `<small>${esc(fila.cantidad_texto)}</small>` : '';
  const partes = [`<span class="me-insignia ${deMapa(CLASE_DEL_TIPO, fila.tipo, 'gris')}">${esc(fila.tipo_nombre)}</span>`];
  if (fila.proxima === true) partes.push('<span class="me-insignia borde">Próxima</span>');
  const detalle = (texto, clase = 'me-detalle') => { if (conTexto(texto)) partes.push(`<span class="${clase}">${esc(texto)}</span>`); };
  detalle(fila.no_cuenta_texto);
  detalle(fila.de_licencias_texto);
  if (esObjeto(fila.configuracion)) {
    detalle(fila.configuracion.texto, fila.configuracion.insignia === 'aviso' ? 'me-detalle me-detalle-aviso' : 'me-detalle');
  }
  detalle(fila.mostrar_texto);
  detalle(fila.nota, 'me-detalle me-fila-nota');
  const word = fila.tipo === 'uso_autorizado' ? ''
    : `<button type="button" class="sg-link" data-word-licencia="${esc(fila.id)}" `
      + `aria-label="Descargar en Word la nota de la licencia del ${esc(fila.fechas_texto)}">Word</button>`;
  return `<li class="me-fila${gris ? ' tenue' : ''}"><span class="me-fila-fecha">${esc(fila.fechas_texto)}${cantidad}</span>`
    + `<span class="me-fila-cuerpo">${partes.join('')}</span>`
    + `<span class="me-fila-acciones">${word}`
    + `<button type="button" class="sg-link" data-editar-licencia="${esc(fila.id)}" aria-label="Editar la licencia del ${esc(fila.fechas_texto)}">`
    + 'Editar</button></span></li>';
}

/**
 * El nombre del archivo de un Content-Disposition (el que arma disposicionDeAdjunto de services/seguimientoReglas.js): el
 * `filename*` en UTF-8 (RFC 5987), decodificado; si no hay, o no se puede decodificar (un % roto), el `filename` entre comillas;
 * si no, null. Nunca tira
 */
function nombreDelAdjunto(cabecera) {
  if (!conTexto(cabecera)) return null;
  const extendido = /(?:^|;)\s*filename\*\s*=\s*([^;]*)/i.exec(cabecera)?.[1].trim() ?? '';
  const enUtf8 = /^utf-8'[^']*'(.*)$/i.exec(extendido)?.[1] ?? '';
  try {
    const decodificado = decodeURIComponent(enUtf8);
    if (decodificado !== '') return decodificado;
  } catch {
    // Un % roto: sigue con el filename
  }
  const comun = /(?:^|;)\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(cabecera)?.[1].replace(/\\(.)/g, '$1') ?? '';
  return comun === '' ? null : comun;
}

// El saldo inicial, al final de la lista del año del arranque
function htmlDelSaldoInicial(saldo) {
  return `<li class="me-fila tenue"><span class="me-fila-fecha">${esc(saldo.titulo)}<small>${esc(saldo.cargado_texto)}</small></span>`
    + `<span class="me-fila-cuerpo">${esc(saldo.texto)}</span>`
    + '<button type="button" class="sg-link" data-abrir="saldos" aria-label="Cambiar el saldo inicial">Cambiar</button></li>';
}

/**
 * La pestaña Licencias (lo que manda GET /api/mi-espacio/licencias): la tarjeta del año, con el selector del año y «Cargar
 * licencia», los filtros, las filas del tipo elegido (`filtro`: 'todas' o un tipo; uno que no está en el año es Todas), el saldo
 * inicial (con Todas) y la nota de los días hábiles. Sin modalidad, solo el mensaje del servidor.
 */
function htmlDeListaDeLicencias(datos, filtro) {
  if (!esObjeto(datos)) return '';
  if (datos.modalidad === null) return htmlDeMensaje(datos.mensaje);
  const anio = Number.isInteger(datos.anio) ? datos.anio : null;
  const licencias = listaDe(datos.licencias);
  const actual = filtroElegido(datos.filtros, filtro);
  const visibles = actual === 'todas' ? licencias : licencias.filter((fila) => fila.tipo === actual);
  const filas = visibles.map(htmlDeFilaDeLicencia);
  if (actual === 'todas' && esObjeto(datos.saldo_inicial)) filas.push(htmlDelSaldoInicial(datos.saldo_inicial));
  return '<div class="me-tarjeta"><div class="me-cabeza">'
    + `<h2>Mis licencias${delAnio(anio)}</h2><span class="me-acciones">${htmlDelSelectorDeAnio(datos.anios, anio)}`
    + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-cargar="licencia">Cargar licencia</button></span></div>'
    + (licencias.length > 0 ? htmlDeFiltrosDeLicencias(datos.filtros, actual) : '')
    + (visibles.length === 0 ? `<p class="me-vacio">No hay licencias cargadas${enElAnio(anio)}.</p>` : '')
    + (filas.length > 0 ? `<ul class="me-lista">${filas.join('')}</ul>` : '')
    + `<p class="me-nota">${NOTA_DE_LAS_LICENCIAS}</p></div>`;
}

// El mes del día por día de entrada: el en curso, si está en la tabla; si no, el más nuevo de la tabla; sin meses, null
function mesInicialDe(tabla) {
  const meses = listaDe(tabla?.meses).map((fila) => fila.mes);
  if (meses.includes(tabla?.mes_en_curso)) return tabla.mes_en_curso;
  return meses[0] ?? null;
}

// El mes pedido, si está en la tabla; si no, el de entrada
const mesDeLaTabla = (tabla, mes) => (listaDe(tabla?.meses).some((fila) => fila.mes === mes) ? mes : mesInicialDe(tabla));

// La cabeza de la tarjeta de las horas extras: el título, el selector del año y «Cargar horas extras»
const cabezaDeHoras = (titulo, tabla) => `<div class="me-cabeza"><h2>${titulo}${delAnio(tabla?.anio)}</h2>`
  + `<span class="me-acciones">${htmlDelSelectorDeAnio(tabla?.anios, tabla?.anio)}`
  + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-cargar="horas">Cargar horas extras</button></span></div>';

// El mes trabajado de una fila de la tabla: un botón que elige el día por día de ese mes
const botonDelMes = (fila, elegido) => `<button type="button" class="me-mes-boton" data-mes="${esc(fila.mes)}" `
  + `aria-pressed="${String(fila.mes === elegido)}">${esc(fila.mes_texto)}</button>`;

// La situación de un mes, con el color de su estado; la que ya no se usa, como texto (la fila va en gris)
function htmlDeSituacion(fila) {
  const clase = deMapa(CLASE_DE_LA_SITUACION, fila.estado, null);
  return clase === null ? esc(fila.situacion) : `<span class="me-insignia ${clase}">${esc(fila.situacion)}</span>`;
}
const claseDeLaFila = (fila) => (SITUACIONES_EN_GRIS.includes(fila.estado) ? ' class="tenue"' : '');

// La tabla de una modalidad, o el vacío del año
function htmlDeTabla(tabla, columnas, filas) {
  if (filas.length === 0) return `<p class="me-vacio">No hay horas extras cargadas${enElAnio(tabla?.anio)}.</p>`;
  return `<div class="me-tabla-marco"><table class="me-tabla"><thead><tr>${columnas.map((columna) => `<th>${columna}</th>`).join('')}`
    + `</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
}

// «Registrar un uso autorizado»: el texto del servidor y, si queda algo no utilizado previamente, el botón
function htmlDelUsoAutorizado(uso) {
  if (!esObjeto(uso)) return '';
  const boton = uso.puede === true
    ? '<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-abrir="uso">Registrar un uso autorizado</button>' : '';
  return `<div class="me-uso"><p class="me-nota">${esc(uso.texto)}</p>${boton}</div>`;
}

/**
 * Planta: las horas extras al 100% de cada mes trabajado, los francos que dan, en qué mes se usan y su situación, con el uso
 * autorizado debajo. `mes` es el mes del día por día (de entrada, el en curso), que se marca en la tabla.
 */
function htmlDeTablaDeFrancos(tabla, mes = mesInicialDe(tabla)) {
  const filas = listaDe(tabla?.meses).map((fila) => `<tr${claseDeLaFila(fila)}><td>${botonDelMes(fila, mes)}</td>`
    + `<td class="num">${esc(fila.horas_texto)}<small>${esc(fila.dias_texto)}</small></td><td class="num">${esc(fila.francos)}</td>`
    + `<td>${esc(fila.uso_texto)}</td><td>${htmlDeSituacion(fila)}</td></tr>`);
  return `<div class="me-tarjeta">${cabezaDeHoras('Horas extras al 100%', tabla)}`
    + htmlDeTabla(tabla, ['Mes trabajado', 'Horas', 'Francos', 'Para usar en', 'Situación'], filas)
    + `<p class="me-nota">${NOTA_DE_LOS_FRANCOS}</p>${htmlDelUsoAutorizado(tabla?.uso_autorizado)}</div>`;
}

/**
 * Contrato: las horas extras de cada mes trabajado, el mes en que quedan a favor (con lo mismo en días de franco debajo, en chico:
 * `a_favor_detalle`, «2 días de franco y 4 horas»; spec 2026-10-27-mi-espacio-horas, sección 5), lo que se usó (con cada uso
 * debajo) y su situación. `mes`, como en la de francos.
 */
function htmlDeTablaDeHorasAFavor(tabla, mes = mesInicialDe(tabla)) {
  const filas = listaDe(tabla?.meses).map((fila) => `<tr${claseDeLaFila(fila)}><td>${botonDelMes(fila, mes)}</td>`
    + `<td class="num">${esc(fila.horas_texto)}</td>`
    + `<td>${esc(fila.a_favor_texto)}${conTexto(fila.a_favor_detalle) ? `<small>${esc(fila.a_favor_detalle)}</small>` : ''}</td>`
    + `<td class="num">${esc(fila.usadas_texto)}${conTexto(fila.usadas_detalle) ? `<small>${esc(fila.usadas_detalle)}</small>` : ''}</td>`
    + `<td>${htmlDeSituacion(fila)}</td></tr>`);
  return `<div class="me-tarjeta">${cabezaDeHoras('Horas extras y horas a favor', tabla)}`
    + htmlDeTabla(tabla, ['Mes trabajado', 'Horas extras', 'A favor en', 'Usadas', 'Situación'], filas)
    + `<p class="me-nota">${NOTA_DE_LAS_HORAS_A_FAVOR}</p></div>`;
}

// Las horas extras de un mes de la tabla, día por día, cada una con «Editar»; un mes que no está en la tabla, nada
function htmlDeDiaPorDia(tabla, mes) {
  const fila = listaDe(tabla?.meses).find((uno) => uno.mes === mes);
  const dias = listaDe(deMapa(tabla?.dias_por_mes, mes, []));
  if (fila === undefined || dias.length === 0) return '';
  const filas = dias.map((dia) => `<li class="me-fila"><span class="me-fila-fecha">${esc(dia.fecha_texto)}</span>`
    + `<span class="me-fila-cuerpo">${esc(dia.horario)}<span class="me-detalle">${esc(dia.horas_texto)}</span>`
    + `${conTexto(dia.nota) ? `<span class="me-detalle me-fila-nota">${esc(dia.nota)}</span>` : ''}</span>`
    + `<button type="button" class="sg-link" data-editar-horas="${esc(dia.id)}" `
    + `aria-label="Editar las horas extras del ${esc(dia.fecha_texto)} de ${esc(dia.horario)}">Editar</button></li>`);
  return `<div class="me-tarjeta"><div class="me-cabeza"><h3>${esc(fila.mes_texto)}, día por día</h3>`
    + `<span>${esc(deMapa(tabla.totales_por_mes, mes, ''))}</span></div><ul class="me-lista">${filas.join('')}</ul></div>`;
}

/**
 * Contrato: las salidas de un mes de la tabla, día por día (spec 2026-10-27-mi-espacio-horas, sección 5; la maqueta,
 * `filaDelDiaPorDia`), con lo que manda el servidor: la fecha con la marca del día (Feriado, Sábado o Domingo), el horario («Salida
 * 16:20», o «De 09:21 a 12:10» en un día que no es hábil), la entrada de un día hábil, las horas en una pastilla (los que dan 0, en
 * gris con «No llega a media hora»), el aviso de una salida que dejó de cerrar, la nota y «Editar», que abre la planilla en ese día
 * (`data-editar-salida` con la fecha, y el día en su nombre: «Editar el lunes 05/10»). Un mes que no está en la tabla, nada.
 */
function htmlDeDiaPorDiaDeSalidas(tabla, mes) {
  const fila = listaDe(tabla?.meses).find((uno) => uno.mes === mes);
  const dias = listaDe(deMapa(tabla?.dias_por_mes, mes, []));
  if (fila === undefined || dias.length === 0) return '';
  const detalle = (texto, clase = 'me-detalle') => (conTexto(texto) ? `<span class="${clase}">${esc(texto)}</span>` : '');
  const filas = dias.map((dia) => {
    const largo = esFechaDeTexto(dia.fecha) ? diaLargoDe(dia.fecha) : dia.fecha_texto;
    const cero = dia.cero === true;
    return `<li class="me-fila${cero ? ' tenue' : ''}"><span class="me-fila-fecha">${esc(dia.fecha_texto)}`
      + `${conTexto(dia.tipo_texto) ? `<small>${esc(dia.tipo_texto)}</small>` : ''}</span>`
      + `<span class="me-fila-cuerpo">${esc(dia.horario)}${detalle(dia.entrada_texto)}${detalle(dia.horas_texto, 'me-dia-horas')}`
      + `${cero ? '<span class="me-detalle">No llega a media hora</span>' : ''}${detalle(dia.aviso, 'me-detalle me-fila-aviso')}`
      + `${detalle(dia.nota, 'me-detalle me-fila-nota')}</span>`
      + `<button type="button" class="sg-link" data-editar-salida="${esc(dia.fecha)}" aria-label="Editar el ${esc(largo)}">Editar</button></li>`;
  });
  return `<div class="me-tarjeta"><div class="me-cabeza"><h3>${esc(fila.mes_texto)}, día por día</h3>`
    + `<span>${esc(deMapa(tabla.totales_por_mes, mes, ''))}</span></div><ul class="me-lista">${filas.join('')}</ul></div>`;
}

// Contrato: «Horas no utilizadas previamente», cada mes con su origen (y lo del saldo inicial), con el uso autorizado debajo
function htmlDeNoUtilizadas(tabla) {
  const noUtilizadas = tabla?.no_utilizadas;
  if (!esObjeto(noUtilizadas)) return '';
  const filas = listaDe(noUtilizadas.filas).map((fila) => `<li class="me-fila me-fila-dos"><span class="me-fila-fecha">${esc(fila.titulo)}</span>`
    + `<span class="me-fila-cuerpo">${esc(fila.texto)}${conTexto(fila.detalle) ? `<span class="me-detalle">${esc(fila.detalle)}</span>` : ''}`
    + '</span></li>');
  return '<div class="me-tarjeta"><div class="me-cabeza"><h3>Horas no utilizadas previamente</h3>'
    + `<span>${esc(noUtilizadas.total_texto)}</span></div>`
    + (filas.length > 0 ? `<ul class="me-lista">${filas.join('')}</ul>` : '')
    + `<p class="me-nota">${NOTA_DE_LAS_NO_UTILIZADAS}</p>${htmlDelUsoAutorizado(noUtilizadas.uso_autorizado)}</div>`;
}

/**
 * La pestaña Horas extras (lo que manda GET /api/mi-espacio/horas-extras): en planta, la tabla de francos y el día por día; en
 * contrato, la de horas a favor, el día por día de las salidas de la planilla y las horas no utilizadas previamente. `mes` es el
 * del día por día (uno que no está en la tabla, el de entrada). Sin modalidad, solo el mensaje del servidor.
 */
function htmlDeHorasExtras(tabla, mes) {
  if (!esObjeto(tabla)) return '';
  const elegido = mesDeLaTabla(tabla, mes);
  if (tabla.modalidad === 'planta') return htmlDeTablaDeFrancos(tabla, elegido) + htmlDeDiaPorDia(tabla, elegido);
  if (tabla.modalidad === 'contrato') {
    return htmlDeTablaDeHorasAFavor(tabla, elegido) + htmlDeDiaPorDiaDeSalidas(tabla, elegido) + htmlDeNoUtilizadas(tabla);
  }
  return htmlDeMensaje(tabla.mensaje);
}

// =====================================================
// Lo puro: los formularios
// =====================================================

// ---- Copias mínimas, para avisar en el momento (el servidor valida igual), atadas por tests de paridad ----

// Las claves de MENSAJES_MI_ESPACIO (services/miEspacioReglas.js) que usan los formularios
const MENSAJES_FORMULARIOS = Object.freeze({
  tipo: 'Elegí el tipo de licencia.',
  fecha: 'Elegí una fecha válida.',
  hastaAntes: 'La licencia no puede terminar antes de empezar.',
  horasEnteras: 'Las franquicias se toman por hora entera, de 1 a 7.',
  horasMedias: 'Las horas van de a media hora, de 0,5 a 7.',
  nota: 'La nota puede tener hasta 200 caracteres.',
  horario: 'Elegí de qué hora a qué hora, de a media hora.',
  diasVacaciones: 'Elegí 10, 15, 20, 25 o 30 días.',
  estudios: 'Elegí universitaria, secundaria o «No estudio».',
  saldoMedias: 'Escribí las horas de a media hora.',
  yaEmpezo: 'Ya empezó: no se puede borrar',
  soloHasta: 'Ya empezó: solo podés cambiar hasta cuándo.',
  fechasFijas: 'Ya terminó: las fechas quedan fijas.',
  // Los de la planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 7 y 8)
  horaSalida: 'Escribí la hora como 16:45.',
  salidaQueCuenta: 'Falta la salida: es la que cuenta.',
  salidaFalta: 'Falta la salida.',
  entradaFeriado: 'En un feriado, poné también la entrada.',
  entradaFinde: 'En un sábado o domingo, poné también la entrada.',
  salidaAntes: 'La salida tiene que ser después de la entrada.',
  muchosDias: 'Guardá de a 100 días como mucho.'
});
// Los días de vacaciones que se eligen por año, los de estudios según la carrera y los de cada examen, las horas de un día entero y
// el largo de una nota (en caracteres contados con Array.from): los de services/miEspacioReglas.js
const DIAS_VACACIONES = Object.freeze([10, 15, 20, 25, 30]);
const DIAS_ESTUDIOS = Object.freeze({ universitario: 15, secundario: 10 });
const DIAS_POR_EXAMEN = 3;
const JORNADA = 7;
const LARGO_NOTA = 200;

// Un número con coma y a lo sumo un decimal, como numeroTexto del servidor: '10,5'
const numeroConComa = (valor) => {
  const numero = Math.round(Number(valor) * 10) / 10;
  return Number.isFinite(numero) ? String(numero).replace('.', ',') : '—';
};
// Copia de textoSaldo: «Escribí un número de 0 a 30.»
const textoSaldo = (maximo) => `Escribí un número de 0 a ${numeroConComa(maximo)}.`;

// Copia de horasDe: las horas de un horario 'HH:MM' de a media hora; con hasta antes que desde, pasa la medianoche (+24 h). null
// si son iguales o alguna no es una hora en punto o y media
const minutosDelDia = (hora) => {
  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):(00|30)$/.test(hora)) return null;
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
};
const horasDelHorario = (desde, hasta) => {
  const inicio = minutosDelDia(desde);
  const fin = minutosDelDia(hasta);
  if (inicio === null || fin === null || inicio === fin) return null;
  return ((fin > inicio ? fin : fin + 24 * 60) - inicio) / 60;
};

// La planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 3 y 9), para decir las horas de cada día y
// lo que suma el mes mientras se escribe: la jornada termina a las 15:00; una media hora vale aunque falten hasta 14 minutos en un
// día hábil y hasta 10 en uno que no lo es; se guardan de a 100 días como mucho. Copias de las de services/miEspacioReglas.js
const SALIDA_DE_LA_JORNADA = '15:00';
const TOLERANCIA_DIA_HABIL = 14;
const TOLERANCIA_DIA_INHABIL = 10;
const MAXIMO_DIAS_POR_GUARDADO = 100;
// Los tipos de día de la planilla (los de tipoDeDia del servidor)
const TIPOS_DE_DIA = Object.freeze(['habil', 'feriado', 'finde']);
// Copia de horaSalidaValida: una hora 'HH:MM' de un día, con cualquier minuto (de 00:00 a 23:59), en minutos desde las 00:00; lo que
// no lo es («16:46:00», «9:05», «25:00»), null
const minutosDeLaSalida = (hora) => (typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
  ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null);

/**
 * Copia de horasDeLaSalida (spec, sección 3), con el `tipo` del día que manda el servidor ('habil', 'feriado' o 'finde': el de
 * tipoDeDia con los feriados de ese momento) en lugar de la fecha y los feriados. Las horas extras de un día, de a 0,5, o null:
 * - en un día hábil, los minutos después de las 15:00 (antes, 0), con una media hora desde su minuto 16; la entrada no cuenta;
 * - en un feriado, un sábado o un domingo, los minutos de la entrada a la salida, con 10 de tolerancia.
 * null sin una salida válida, en un día que no es hábil sin una entrada válida, con una entrada válida y la salida antes o igual
 * que ella (también en un día hábil) o con un tipo que no es de la planilla. Nunca tira.
 */
function horasDelDiaDeLaPlanilla(dia) {
  if (!esObjeto(dia) || !TIPOS_DE_DIA.includes(dia.tipo)) return null;
  const salida = minutosDeLaSalida(dia.salida);
  if (salida === null) return null;
  const entrada = minutosDeLaSalida(dia.entrada);
  if (entrada !== null && salida <= entrada) return null;
  if (dia.tipo === 'habil') {
    const minutos = Math.max(0, salida - minutosDeLaSalida(SALIDA_DE_LA_JORNADA));
    return Math.floor((minutos + TOLERANCIA_DIA_HABIL) / 30) / 2;
  }
  if (entrada === null) return null;
  return Math.floor((salida - entrada + TOLERANCIA_DIA_INHABIL) / 30) / 2;
}

// Copia de diasYHorasDe: unas horas en días de franco (cada 7, JORNADA) y las que sobran, con un decimal; con lo que no es un
// número positivo, ninguno
const diasYHorasDeLaPlanilla = (horas) => {
  if (typeof horas !== 'number' || !Number.isFinite(horas) || horas <= 0) return { dias: 0, resto: 0 };
  const total = Math.round(horas * 10) / 10;
  const dias = Math.floor(total / JORNADA);
  return { dias, resto: Math.round((total - dias * JORNADA) * 10) / 10 };
};
// Las partes de enDiasDeFranco: ['2 días de franco', '4,5 horas'], ['3 días de franco'], ['4,5 horas'] o []
const partesEnDiasDeFranco = (horas) => {
  const { dias, resto } = diasYHorasDeLaPlanilla(horas);
  return [dias > 0 ? `${dias} ${dias === 1 ? 'día' : 'días'} de franco` : '', resto > 0 ? textoDeHoras(resto) : '']
    .filter((parte) => parte !== '');
};
// Copia de enDiasDeFranco: «2 días de franco y 4,5 horas», «3 días de franco», «4,5 horas», «1 hora»; '' sin horas
const enDiasDeFranco = (horas) => partesEnDiasDeFranco(horas).join(' y ');

// La frase de la banda de la planilla, con cada parte de lo que se suma («2 días de franco», «4 horas a favor») pasada por
// `marcar`: en el texto plano, tal cual; en la banda, en negrita. «a favor» va con las horas sueltas, la última parte
const fraseDeLaSumaDelMes = (mes, horas, hoy, marcar) => {
  if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !esFechaDeTexto(hoy)) return '';
  const paso = mes < hoy.slice(0, 7);
  const partes = partesEnDiasDeFranco(horas);
  if (partes.length === 0) {
    return paso ? `En ${nombreDelMes(mes)} no hiciste horas extras.` : `Todavía no sumaste horas extras en ${nombreDelMes(mes)}.`;
  }
  // El mes siguiente tiene que existir, como en mesMas del servidor: del año 1 al 9999
  const anioSiguiente = Number(mes.slice(0, 4)) + (mes.endsWith('-12') ? 1 : 0);
  if (anioSiguiente < 1 || anioSiguiente > 9999) return '';
  const aFavor = diasYHorasDeLaPlanilla(horas).resto > 0 ? ' a favor' : '';
  const marcadas = partes.map((parte, indice) => marcar(indice === partes.length - 1 ? `${parte}${aFavor}` : parte));
  return `En ${nombreDelMes(mes, 1)} ${paso ? 'tuviste' : 'vas a tener'} ${marcadas.join(' y ')}.`;
};
// Copia de textoDeLaSumaDelMes: «En noviembre vas a tener 2 días de franco y 4,5 horas a favor.», «En octubre tuviste 1 día de
// franco.», «Todavía no sumaste horas extras en octubre.», «En septiembre no hiciste horas extras.»; sin un mes o un hoy válidos, ''
const textoDeLaSumaDelMes = (mes, horas, hoy) => fraseDeLaSumaDelMes(mes, horas, hoy, (parte) => parte);

// Copias de usuarios.js (Configuración → Licencias): el efecto de la licencia del firmante en las notas, los días sin auditor y
// las ausencias de la persona autorizada, con los mismos textos. efectoEnNotas recibe «hoy» por parámetro

// 'AAAA-MM-DD' → 'dd/mm/aaaa' sin pasar por Date
const fechaCorta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const efectoEnNotas = (licencia, autorizadoNombre, hoy) => {
  if (hoy && licencia?.desde && licencia.desde <= hoy) {
    return autorizadoNombre
      ? `Licencia en curso: ${autorizadoNombre} presenta las notas con las dos firmas, citando la nota que comunica la autorización (si todavía no salió, la próxima corrida la genera primero), y vuelve a presentar en su fecha cada aviso que se adelantó.`
      : 'Licencia en curso sin persona autorizada: no se generan notas hasta la vuelta. Lo que toque avisar y las reiteraciones salen el primer día hábil después de la licencia.';
  }
  const cuando = licencia?.vispera ? `el ${fechaCorta(licencia.vispera)}` : 'el último día hábil anterior';
  return autorizadoNombre
    ? `Los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15), en una nota que comunica la autorización a ${autorizadoNombre}. Durante la licencia, ${autorizadoNombre} presenta las demás notas con las dos firmas, citando esa nota, y vuelve a presentar cada aviso en su fecha.`
    : `Sin persona autorizada: los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15) y las reiteraciones se postergan a la vuelta. Cargá la licencia antes de ese día.`;
};
const listaConY = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join(''));
const textoSinAuditor = ({ desde, hasta, vuelve, respaldo }) => {
  const unDia = desde === hasta;
  const cuando = unDia ? `El ${fechaCorta(desde)}` : `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
  const hastaCuando = vuelve ? `el ${fechaCorta(vuelve)}` : 'que haya un auditor disponible';
  const texto = `${cuando} no va a haber ningún auditor disponible: los cambios que se propongan ${unDia ? 'ese día' : 'en esos días'} van a quedar pendientes hasta ${hastaCuando}.`;
  return respaldo?.length
    ? `${texto} En ${unDia ? 'ese día' : 'esos días'} solo pueden auditar de respaldo: ${listaConY(respaldo)} (nunca un cambio propio).`
    : texto;
};
const MAXIMO_DIAS_SIN_AUDITOR = 366;
const diaUtc = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const esFechaValida = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') && new Date(diaUtc(iso)).toISOString().slice(0, 10) === iso;
const diasDelRango = (desde, hasta) => (diaUtc(hasta) - diaUtc(desde)) / 86400000 + 1;
const textoAusenciasAutorizado = (nombre, ausencias, desde, hasta) => {
  if (!nombre || !esFechaValida(desde) || !esFechaValida(hasta)) return [];
  return [...(ausencias ?? [])]
    .sort((x, y) => x.desde.localeCompare(y.desde))
    .map(({ desde: d, hasta: h, vuelve }) => ({ a: d > desde ? d : desde, b: h < hasta ? h : hasta, vuelve }))
    .filter(({ a, b }) => a <= b)
    .map(({ a, b, vuelve }) => {
      const cuando = a === b ? `el ${fechaCorta(a)}: ese día` : `del ${fechaCorta(a)} al ${fechaCorta(b)}: esos días`;
      const presenta = vuelve && vuelve <= hasta ? ` Desde el ${fechaCorta(vuelve)} las presenta en tu nombre.` : '';
      return `${nombre} va a estar de licencia ${cuando} no se generan notas.${presenta}`;
    });
};
const parametrosSinAuditor = ({ usuarioId, desde, hasta, excluir = null, hoy = '' }) => {
  if (!usuarioId || !esFechaValida(desde) || !esFechaValida(hasta)) return null;
  const inicio = hoy && desde < hoy ? hoy : desde;
  if (inicio > hasta || diasDelRango(inicio, hasta) > MAXIMO_DIAS_SIN_AUDITOR) return null;
  return { desde: inicio, hasta, usuario_id: usuarioId, ...(excluir ? { excluir } : {}) };
};

// ---- Lo de cada formulario ----

const comoTexto = (valor) => (typeof valor === 'string' ? valor : '');
// 'AAAA-MM-DD' de un día que existe (como esFechaIso del servidor, sobre el texto: sin Date local)
const esFechaDeTexto = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && Utils.soloFecha(valor) === valor;
// Un número escrito en un campo, con coma o con punto: '' es null; lo que no es un número, NaN
const numeroDelCampo = (texto) => {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  return limpio === '' ? null : Number(limpio);
};
const largoDeLaNota = (nota) => Array.from(comoTexto(nota).trim()).length;

// Los tipos de un solo día (el campo es «Fecha»: desde y hasta son el mismo) y los que se cargan en horas: copias de
// TIPOS_DE_UN_DIA y TIPOS_POR_HORAS de services/miEspacioReglas.js, atadas por un test de paridad
const TIPOS_DE_UN_DIA = Object.freeze(['franquicia', 'franco', 'horas_a_favor', 'uso_autorizado']);
const TIPOS_CON_HORAS = Object.freeze(['franquicia', 'horas_a_favor', 'uso_autorizado']);
const deUnDia = (tipo) => TIPOS_DE_UN_DIA.includes(tipo);
// Cómo se cargan las horas de un tipo: 'enteras' (la franquicia, de 1 a 7), 'medias' (las horas a favor y el uso autorizado de
// contrato, de 0,5 a 7) o null (sin horas; el uso autorizado de planta es un franco, el día entero)
const horasDelTipo = (tipo, modalidad) => {
  if (tipo === 'franquicia') return 'enteras';
  if (tipo === 'horas_a_favor' || (tipo === 'uso_autorizado' && modalidad !== 'planta')) return 'medias';
  return null;
};
// Si una licencia es de día entero, como esDiaEntero del servidor (atada por un test de paridad): una de horas, solo con la
// jornada entera (el uso autorizado de planta es un franco, el día entero). Solo esas se les muestran a los compañeros (spec,
// sección 7): las de menos de 7 horas, nunca. `horas`, como las escribe el campo
const esDeDiaEntero = (tipo, horas, modalidad) => !TIPOS_CON_HORAS.includes(tipo) || horasDelTipo(tipo, modalidad) === null
  || numeroDelCampo(horas) === JORNADA;
// Lo que dice el formulario si el cálculo no llegó (un error del servidor, o sin conexión): sin él no se ve qué pasa con
// Configuración, así que «Guardar» lo vuelve a pedir antes de guardar
const textoSinCalculo = (falla) => `No se pudo calcular: ${falla?.status ? 'hubo un error en el servidor'
  : 'no se pudo conectar con el servidor'}. Probá de nuevo en unos minutos.`;

/**
 * Los valores de «Cargar licencia» (o del uso autorizado): los de una fila de la lista que se corrige o, sin fila, los de una
 * nueva con `tipo` (el de «Vence pronto»; sin él, ninguno). Las horas, como texto. `autorizado` es la persona a cargo elegida y
 * `autorizado_inicial`, la que ya tenía (de `en_configuracion`, solo de una creada): autorizado_id viaja solo si cambian.
 * `licencia_oficial` es el id de su licencia de Configuración (el excluir del aviso de los días sin auditor), o null.
 */
function valoresDeLicencia(fila, tipo) {
  const datos = esObjeto(fila) ? fila : {};
  const enConfiguracion = esObjeto(datos.en_configuracion) ? datos.en_configuracion : {};
  const autorizado = Number.isInteger(enConfiguracion.autorizado_id) ? String(enConfiguracion.autorizado_id) : '';
  let elTipo = '';
  if (conTexto(datos.tipo)) elTipo = datos.tipo;
  else if (conTexto(tipo)) elTipo = tipo;
  return {
    id: datos.id ?? null,
    tipo: elTipo,
    desde: comoTexto(datos.desde),
    hasta: comoTexto(datos.hasta),
    horas: typeof datos.horas === 'number' && Number.isFinite(datos.horas) ? String(datos.horas) : '',
    nota: comoTexto(datos.nota),
    mostrar: datos.mostrar !== false,
    autorizado,
    autorizado_inicial: autorizado,
    licencia_oficial: Number.isInteger(enConfiguracion.licencia_id) ? enConfiguracion.licencia_id : null
  };
}

/**
 * Los errores de una licencia antes de pedir nada (`{ campo: mensaje }`, en el orden del formulario; sin ninguno, {}): el tipo,
 * las fechas (el formato y que el hasta no sea anterior; en los de un día, solo la fecha), las horas de los tipos que se cargan
 * en horas (con `modalidad`: en planta, el uso autorizado no lleva) y el largo de la nota. Los mensajes son los del servidor, que
 * controla además el rango, los días hábiles, los topes y lo que se superpone.
 */
function erroresDeLicencia(valores, { modalidad = null } = {}) {
  const datos = esObjeto(valores) ? valores : {};
  const errores = {};
  if (!conTexto(datos.tipo)) errores.tipo = MENSAJES_FORMULARIOS.tipo;
  if (!esFechaDeTexto(datos.desde)) errores.desde = MENSAJES_FORMULARIOS.fecha;
  else if (!deUnDia(datos.tipo)) {
    if (!esFechaDeTexto(datos.hasta)) errores.hasta = MENSAJES_FORMULARIOS.fecha;
    else if (datos.hasta < datos.desde) errores.hasta = MENSAJES_FORMULARIOS.hastaAntes;
  }
  const enHoras = horasDelTipo(datos.tipo, modalidad);
  const horas = numeroDelCampo(datos.horas);
  if (enHoras === 'enteras' && !(Number.isInteger(horas) && horas >= 1 && horas <= JORNADA)) {
    errores.horas = MENSAJES_FORMULARIOS.horasEnteras;
  }
  if (enHoras === 'medias' && !(horas !== null && Number.isInteger(horas * 2) && horas >= 0.5 && horas <= JORNADA)) {
    errores.horas = MENSAJES_FORMULARIOS.horasMedias;
  }
  if (largoDeLaNota(datos.nota) > LARGO_NOTA) errores.nota = MENSAJES_FORMULARIOS.nota;
  return errores;
}

/**
 * El cuerpo de POST /licencias y PUT /licencias/:id (y del cálculo previo): el tipo, las fechas (en los de un día, el hasta es
 * el desde), las horas (solo en los tipos de horas que las llevan, como número), «Mostrar» y la nota recortada. `autorizado_id`
 * va solo en las vacaciones del firmante titular (`soyTitular`: el campo «Autorizo a…» está a la vista) y, al corregir, solo si
 * se cambió la persona: si no, el servidor conserva la de Configuración. Vacío es null (nadie).
 */
function cuerpoDeLicencia(valores, { soyTitular = false } = {}) {
  const datos = esObjeto(valores) ? valores : {};
  const cuerpo = {
    tipo: datos.tipo, desde: datos.desde, hasta: deUnDia(datos.tipo) ? datos.desde : datos.hasta, mostrar: datos.mostrar !== false,
    nota: comoTexto(datos.nota).trim()
  };
  const horas = numeroDelCampo(datos.horas);
  if (TIPOS_CON_HORAS.includes(datos.tipo) && horas !== null) cuerpo.horas = horas;
  const nueva = datos.id === null || datos.id === undefined;
  if (soyTitular === true && datos.tipo === 'vacaciones'
    && (nueva || comoTexto(datos.autorizado) !== comoTexto(datos.autorizado_inicial))) {
    cuerpo.autorizado_id = conTexto(datos.autorizado) ? Number(datos.autorizado) : null;
  }
  return cuerpo;
}

// Los tipos de «Cargar licencia» (los `tipos` del Resumen): radios grandes, cada uno con lo que queda. El uso autorizado no va:
// tiene su propio formulario
function htmlDeTiposDeLicencia(tipos, elegido) {
  return listaDe(tipos).filter((opcion) => opcion.tipo !== 'uso_autorizado').map((opcion) => '<label class="me-opcion">'
    + `<input type="radio" name="ml-tipo" value="${esc(opcion.tipo)}"${opcion.tipo === elegido ? ' checked' : ''} `
    + 'aria-describedby="ml-tipos-error">'
    + `<span><b>${esc(opcion.nombre)}</b>${conTexto(opcion.queda_texto) ? `<small>${esc(opcion.queda_texto)}</small>` : ''}`
    + '</span></label>')
    .join('');
}

// Las horas que se pueden elegir: enteras, de 1 a 7, o de a media hora, de 0,5 a 7 (7 es el día entero), con la elegida
function htmlDeOpcionesDeHoras(enHoras, elegida) {
  const paso = enHoras === 'enteras' ? 1 : 0.5;
  const opciones = ['<option value="">—</option>'];
  for (let horas = paso; horas <= JORNADA; horas += paso) {
    opciones.push(`<option value="${String(horas)}"${String(horas) === elegida ? ' selected' : ''}>`
      + `${numeroConComa(horas)}${horas === JORNADA ? ', el día entero' : ''}</option>`);
  }
  return opciones.join('');
}

// El cálculo del servidor (la `vista` de POST /licencias/calculo): los días hábiles (en los estudios, si es el máximo por
// examen), de qué licencia salen y lo que queda. Sin vista (la licencia no se puede guardar como está), ''
function htmlDelCalculo(data, tipo) {
  const vista = esObjeto(data) && esObjeto(data.vista) ? data.vista : null;
  if (vista === null || !conTexto(vista.texto_dias)) return '';
  const examen = tipo === 'estudios' && vista.dias_habiles === DIAS_POR_EXAMEN ? ', el máximo por examen' : '';
  const resto = [vista.texto_reparto, vista.queda_texto, vista.texto_antes_del_arranque].filter(conTexto).map(esc);
  return [`<b>${esc(vista.texto_dias)}${examen}.</b>`, ...resto].join(' ');
}

/**
 * Lo que dice el formulario del paso a Configuración (el `paso` del cálculo), un párrafo por texto. Si pasa, los avisos del
 * servidor y, en las vacaciones del firmante titular, el efecto en las notas con la persona a cargo elegida (`autorizado`, su
 * nombre, o null: nadie) y los días en que ella está de licencia (`ausencias`, las de GET /mi-espacio/firmante), con las fechas
 * del formulario (`desde` y `hasta`) y `hoy`. Con `conEfecto` false (no se sabe quién queda a cargo), el efecto no va. Si no
 * pasa, por qué (una de administración que la cubre o con la que se superpone); sin nada que decir, ''.
 */
function htmlDelPaso(paso, { autorizado = null, ausencias = [], hoy = '', desde = '', hasta = '', conEfecto = true } = {}) {
  if (!esObjeto(paso)) return '';
  const parrafos = [];
  if (paso.pasa === true) {
    parrafos.push(...(Array.isArray(paso.avisos) ? paso.avisos : []).filter(conTexto));
    if (conEfecto !== false && esObjeto(paso.firmante) && paso.firmante.puede_autorizar === true) {
      const nombre = conTexto(autorizado) ? autorizado : null;
      parrafos.push(efectoEnNotas({ desde, vispera: paso.firmante.vispera }, nombre, hoy));
      if (nombre !== null) parrafos.push(...textoAusenciasAutorizado(nombre, listaDe(ausencias), desde, hasta));
    }
  } else if (conTexto(paso.sin_pasar_previsto)) parrafos.push(paso.sin_pasar_previsto);
  return parrafos.map((texto) => `<p>${esc(texto)}</p>`).join('');
}

// Las personas que el firmante puede dejar a cargo (`[{ id, nombre }]`), después de «Nadie»
function htmlDeAutorizables(personas) {
  return ['<option value="">Nadie: se anticipan los avisos</option>',
    ...listaDe(personas).map((persona) => `<option value="${esc(persona.id)}">${esc(persona.nombre)}</option>`)].join('');
}

// La confirmación de un borrado, en texto plano (va con textContent): qué se borra y, de una licencia creada en Configuración, que
// también se anula allá. Una fila de horas extras (la del día por día) tiene su horario
function textoDeConfirmacion(fila) {
  const datos = esObjeto(fila) ? fila : {};
  const nota = conTexto(datos.nota) ? ` («${datos.nota}»)` : '';
  if (typeof datos.horario === 'string') return `Horas extras del ${comoTexto(datos.fecha_texto)}, de ${datos.horario}${nota}.`;
  const enConfiguracion = esObjeto(datos.en_configuracion) ? ' También se anula en Configuración → Licencias.' : '';
  return `${comoTexto(datos.tipo_nombre)} del ${comoTexto(datos.fechas_texto)}${nota}.${enConfiguracion}`;
}

// ---- El segundo paso de «Cargar licencia» (spec 2026-10-27-mi-espacio-licencia-word, 6; la versión C de la maqueta) ----

// Lo que dice el segundo paso mientras llega GET …/nota y, si no llega, que la licencia igual quedó guardada
const TEXTO_ARMANDO_LA_NOTA = 'Armando la nota…';
const MENSAJE_SIN_VISTA = 'La licencia quedó guardada, pero no se pudo armar la vista de la nota. Probá «Descargar Word» o bajala '
  + 'después con «Word» en la lista.';
// La tilde verde de la licencia guardada (check de Lucide), decorativa: lo dice el título del modal
const TILDE_DEL_SEGUNDO_PASO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" '
  + 'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
  + '<path d="M20 6 9 17l-5-5"/></svg>';

// El título del modal en el segundo paso: el alta o la corrección
const tituloDelSegundoPaso = (corregida) => (corregida === true ? 'Licencia corregida' : 'Licencia cargada');

// Los avisos con los que respondió el guardado (solo la corrección los trae: por ejemplo, que ya no se copia a Configuración), los
// que son un texto con algo
const avisosDelGuardado = (avisos) => (Array.isArray(avisos) ? avisos.filter(conTexto) : []);

// Lo que se anuncia en #me-anuncio al pasar al segundo paso (no hay aviso flotante: lo dice el título): qué se guardó, que se puede
// bajar la nota y los avisos
const anuncioDelSegundoPaso = (corregida, avisos) =>
  [`${tituloDelSegundoPaso(corregida)}. Podés descargar la nota en Word.`, ...avisosDelGuardado(avisos)].join(' ');

// Los avisos del guardado, en un recuadro ámbar arriba de todo (sin avisos, '')
const htmlDeLosAvisosDelGuardado = (avisos) => {
  const textos = avisosDelGuardado(avisos);
  return textos.length > 0 ? `<div class="me-recuadro ambar">${textos.map((texto) => `<p>${esc(texto)}</p>`).join('')}</div>` : '';
};

// El segundo paso sin la nota: los avisos y «Armando la nota…», hasta que llega; o los avisos y MENSAJE_SIN_VISTA, si no llegó
const htmlDelSegundoPasoEnEspera = (avisos) => htmlDeLosAvisosDelGuardado(avisos) + htmlDeMensaje(TEXTO_ARMANDO_LA_NOTA);
const htmlDelSegundoPasoSinVista = (avisos) => htmlDeLosAvisosDelGuardado(avisos) + htmlDeError(MENSAJE_SIN_VISTA);

/**
 * El cuerpo del segundo paso con lo que manda GET …/nota: los avisos del guardado (`avisos`, en ámbar); la licencia guardada, con la
 * tilde, la insignia de su tipo, las fechas y lo que suma y, en gris, de qué licencias sale, lo de Configuración y lo que ven los
 * compañeros (los textos de `fila`, la misma de la lista, aunque la lista muestre otro año); «Así sale la nota», con la
 * `aclaracion` debajo; y la hoja (`html`, armada y escapada por el servidor: va tal cual, como la nota del Generador de Notas) sobre
 * la mesa gris. Todo otro texto del servidor, escapado. Sin fila, sin la licencia; sin hoja, la mesa vacía
 */
function htmlDelSegundoPaso({ fila = null, html = '', aclaracion = '', avisos = [] } = {}) {
  const partes = [htmlDeLosAvisosDelGuardado(avisos)];
  if (esObjeto(fila)) {
    const linea = [`<span class="me-insignia ${deMapa(CLASE_DEL_TIPO, fila.tipo, 'gris')}">${esc(fila.tipo_nombre)}</span>`];
    if (conTexto(fila.fechas_texto)) linea.push(`<b class="me-paso-dos-fechas">${esc(fila.fechas_texto)}</b>`);
    if (conTexto(fila.cantidad_texto)) linea.push(`<span class="me-paso-dos-cantidad">${esc(fila.cantidad_texto)}</span>`);
    const detalles = [fila.de_licencias_texto, esObjeto(fila.configuracion) ? fila.configuracion.texto : null, fila.mostrar_texto]
      .filter(conTexto).map((texto) => `<span>${esc(texto)}</span>`);
    partes.push(`<div class="me-paso-dos-hecho"><span class="me-tilde" aria-hidden="true">${TILDE_DEL_SEGUNDO_PASO}</span>`
      + `<div class="me-paso-dos-licencia"><p class="me-paso-dos-linea">${linea.join('')}</p>`
      + (detalles.length > 0 ? `<p class="me-paso-dos-detalle">${detalles.join(' ')}</p>` : '') + '</div></div>');
  }
  partes.push('<h3 class="me-paso-dos-titulo">Así sale la nota</h3>');
  if (conTexto(aclaracion)) partes.push(`<p class="me-paso-dos-ayuda">${esc(aclaracion)}</p>`);
  partes.push(`<div class="me-mesa">${typeof html === 'string' ? html : ''}</div>`);
  return partes.join('');
}

// ---- Las horas extras ----

const NOMBRES_DE_LOS_MESES = Object.freeze([
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]);
// El nombre del mes de 'AAAA-MM', o del que viene `mas` meses después
const nombreDelMes = (mes, mas = 0) => NOMBRES_DE_LOS_MESES[(Number(mes.slice(5, 7)) - 1 + mas) % 12];
const textoDeHoras = (horas) => `${numeroConComa(horas)} ${horas === 1 ? 'hora' : 'horas'}`;

/**
 * Lo que suman unas horas extras mientras se cargan en el modal de planta: «3,5 horas.» y, si la fecha es del año de la tabla
 * cargada (la de la pestaña), lo que lleva el mes con ellas (sin contar dos veces las que se corrigen, `valores.id`; un mes sin fila
 * en la tabla, la primera carga del mes, llevaba 0) y los francos compensatorios que da para usar dos meses después («… En octubre
 * llevás 14 horas: 2 francos compensatorios para usar en diciembre.»; sin llegar a 7 horas, solo lo que lleva). Contrato carga en
 * la planilla, que dice su propia suma (htmlDeLaBandaDeLaPlanilla; spec 2026-10-27-mi-espacio-horas, sección 9): con otra
 * modalidad, solo las horas. Un horario que no sirve, ''.
 */
function textoDeLaSuma(valores, tabla, modalidad) {
  const datos = esObjeto(valores) ? valores : {};
  const horas = horasDelHorario(datos.desde, datos.hasta);
  if (horas === null) return '';
  const base = `${textoDeHoras(horas)}.`;
  const mes = esFechaDeTexto(datos.fecha) ? datos.fecha.slice(0, 7) : null;
  if (modalidad !== 'planta' || mes === null || !esObjeto(tabla) || tabla.anio !== Number(mes.slice(0, 4))) return base;
  const otras = listaDe(deMapa(tabla.dias_por_mes, mes, []))
    .filter((dia) => datos.id === null || datos.id === undefined || String(dia.id) !== String(datos.id))
    .reduce((suma, dia) => suma + (horasDelHorario(dia.desde, dia.hasta) ?? 0), 0);
  const total = otras + horas;
  const lleva = `En ${nombreDelMes(mes)} llevás ${textoDeHoras(total)}`;
  const francos = Math.floor(total / JORNADA);
  if (francos === 0) return `${base} ${lleva}.`;
  return `${base} ${lleva}: ${francos} ${francos === 1 ? 'franco compensatorio' : 'francos compensatorios'} para usar en `
    + `${nombreDelMes(mes, 2)}.`;
}

// Los valores de «Cargar horas extras»: los de un día del día por día que se corrige, o vacíos
function valoresDeHoras(dia) {
  const datos = esObjeto(dia) ? dia : {};
  return {
    id: datos.id ?? null, fecha: comoTexto(datos.fecha), desde: comoTexto(datos.desde), hasta: comoTexto(datos.hasta),
    nota: comoTexto(datos.nota)
  };
}

// Los errores de unas horas extras antes de pedir nada, con los mensajes y los campos del servidor (el horario va en `desde`)
function erroresDeHoras(valores) {
  const datos = esObjeto(valores) ? valores : {};
  const errores = {};
  if (!esFechaDeTexto(datos.fecha)) errores.fecha = MENSAJES_FORMULARIOS.fecha;
  if (horasDelHorario(datos.desde, datos.hasta) === null) errores.desde = MENSAJES_FORMULARIOS.horario;
  if (largoDeLaNota(datos.nota) > LARGO_NOTA) errores.nota = MENSAJES_FORMULARIOS.nota;
  return errores;
}

// El cuerpo de POST /horas-extras y PUT /horas-extras/:id
const cuerpoDeHoras = (valores) => ({
  fecha: valores.fecha, desde: valores.desde, hasta: valores.hasta, nota: comoTexto(valores.nota).trim()
});

// ---- La planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 4 y 9; la maqueta aprobada) ----
//
// La planilla de un mes es la que manda GET /mi-espacio/salidas?mes= (planillaDelMes de services/miEspacioResumen.js): sus `dias`
// (los de lunes a viernes, también los feriados y los que todavía no llegaron, y los sábados y domingos con una salida) y sus
// `fines_de_semana` (los demás sábados y domingos hasta hoy, para «Sumar el día»), cada uno con lo guardado y su `tipo`. Encima van
// los cambios de la página: `cambios`, un Map de cada fecha tocada a su estado completo `{ entrada, salida, nota }` (lo que se
// manda; todo vacío es un borrado) o `{ quitar: true }` («Quitar»: también un borrado, y un sábado o domingo guardado deja de
// verse); `agregados`, un Set de los sábados y domingos sumados; `errores`, un Map de cada fecha a su `{ campo, mensaje }`;
// `notasAbiertas`, un Set de las fechas con la nota abierta. «Quitar» (lo hace la página) saca además el día de `agregados`: si
// no, un sábado o domingo sumado y quitado seguiría a la vista; y volver a sumar uno guardado que se quitó deshace el «Quitar»
// (vuelve con lo guardado). Los Map y los Set se reconocen por lo que saben hacer, no por su clase (los tests los arman fuera del
// vm). Las semanas y sus totales son de presentación, como diasDeLaGrilla de la agenda.

const esMapa = (valor) => valor !== null && typeof valor === 'object' && typeof valor.get === 'function'
  && typeof valor.has === 'function' && typeof valor[Symbol.iterator] === 'function';
const esConjunto = (valor) => valor !== null && typeof valor === 'object' && typeof valor.has === 'function';
const cambioDe = (cambios, fecha) => (esMapa(cambios) ? cambios.get(fecha) : undefined);
const tieneEn = (conjunto, fecha) => esConjunto(conjunto) && conjunto.has(fecha) === true;
// Un sábado o un domingo (también uno que además es feriado: se suma y se quita como los demás)
const esFinDeSemana = (fecha) => lugarEnLaSemana(fecha) >= 5;

// Una hora como se manda: la de un <input type="time"> ('16:46', o con segundos, '16:46:00' o '16:46:00.000'), cortada a 'HH:MM'
// (Review Focus 1); otro texto, recortado (el servidor lo rechaza con su mensaje, y la página también); lo que no es un texto, ''
const horaDelCampo = (valor) => {
  if (typeof valor !== 'string') return '';
  const limpio = valor.trim();
  return /^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(limpio) ? limpio.slice(0, 5) : limpio;
};
// Lo de un día como se manda y como se compara con lo guardado: `{ entrada, salida, nota }`, con las horas cortadas, la nota
// recortada y lo vacío como ''. Un «Quitar», o lo que no es un objeto, todo vacío
const valoresDeLaSalida = (fuente) => {
  const datos = esObjeto(fuente) && fuente.quitar !== true ? fuente : {};
  return { entrada: horaDelCampo(datos.entrada), salida: horaDelCampo(datos.salida), nota: comoTexto(datos.nota).trim() };
};
// Lo que muestra un día en sus campos, como se escribió: el cambio de la página (un «Quitar», vacío) o lo guardado
const valorDelDia = (dia, cambio) => {
  const fuente = esObjeto(cambio) ? cambio : (esObjeto(dia) ? dia : {});
  if (fuente.quitar === true) return { entrada: '', salida: '', nota: '' };
  return { entrada: comoTexto(fuente.entrada), salida: comoTexto(fuente.salida), nota: comoTexto(fuente.nota) };
};

/**
 * Los días del servidor por fecha (los del mes y los sábados y domingos para sumar), de una lista de planillas o de lo que se pueda
 * recorrer (los meses ya pedidos: `pagina.planilla.meses.values()`): un Map de la fecha al día, con lo guardado y su `tipo`.
 */
function diasPorFechaDe(planillas) {
  const lista = Array.isArray(planillas) ? planillas
    : (planillas !== null && typeof planillas === 'object' && typeof planillas[Symbol.iterator] === 'function' ? [...planillas] : []);
  const porFecha = new Map();
  for (const planilla of lista.filter(esObjeto)) {
    for (const dia of [...listaDe(planilla.dias), ...listaDe(planilla.fines_de_semana)]) {
      if (esFechaDeTexto(dia.fecha) && !porFecha.has(dia.fecha)) porFecha.set(dia.fecha, dia);
    }
  }
  return porFecha;
}

/**
 * Las fechas con cambios sin guardar, en orden: las de `cambios` cuyo `{ entrada, salida, nota }` (como se manda) es distinto de lo
 * guardado (el día de `diasPorFecha`; uno que no está ahí, vacío). Un día que se cambió y volvió a quedar como estaba no cuenta
 * (Review Focus 5: el pie vuelve a «Todo guardado.» y no se manda), ni un sábado o domingo sumado sin nada.
 */
function fechasCambiadas(cambios, diasPorFecha) {
  if (!esMapa(cambios)) return [];
  const fechas = [];
  for (const [fecha, cambio] of cambios) {
    if (!esFechaDeTexto(fecha)) continue;
    const ahora = valoresDeLaSalida(cambio);
    const antes = valoresDeLaSalida(esMapa(diasPorFecha) ? diasPorFecha.get(fecha) : null);
    if (ahora.entrada !== antes.entrada || ahora.salida !== antes.salida || ahora.nota !== antes.nota) fechas.push(fecha);
  }
  return fechas.sort();
}

// Los pasos 3 a 7 de validarSalida (services/miEspacioReglas.js) sobre lo que se manda (`valoresDeLaSalida`) y el tipo del día, con
// los mismos campos y los mismos mensajes: `{ campo, mensaje }`, o null. Todo vacío es un borrado y pasa. Los pasos 1 y 2 (un día
// que no llegó o uno de licencia) no hacen falta: la página no deja escribir en esos días (el servidor los controla igual)
const errorDeLaSalida = (tipo, { entrada, salida, nota }) => {
  if (entrada === '' && salida === '' && nota === '') return null;
  if (entrada !== '' && minutosDeLaSalida(entrada) === null) return { campo: 'entrada', mensaje: MENSAJES_FORMULARIOS.horaSalida };
  if (salida !== '' && minutosDeLaSalida(salida) === null) return { campo: 'salida', mensaje: MENSAJES_FORMULARIOS.horaSalida };
  if (salida === '') {
    return { campo: 'salida', mensaje: tipo === 'habil' ? MENSAJES_FORMULARIOS.salidaQueCuenta : MENSAJES_FORMULARIOS.salidaFalta };
  }
  if (tipo !== 'habil' && entrada === '') {
    return { campo: 'entrada', mensaje: tipo === 'feriado' ? MENSAJES_FORMULARIOS.entradaFeriado : MENSAJES_FORMULARIOS.entradaFinde };
  }
  if (entrada !== '' && minutosDeLaSalida(salida) <= minutosDeLaSalida(entrada)) {
    return { campo: 'salida', mensaje: MENSAJES_FORMULARIOS.salidaAntes };
  }
  if (largoDeLaNota(nota) > LARGO_NOTA) return { campo: 'nota', mensaje: MENSAJES_FORMULARIOS.nota };
  return null;
};

/**
 * Los errores de la planilla antes de pedir nada: un Map de cada fecha con cambios (`fechasCambiadas`) al primer error de su día
 * (los pasos 3 a 7 de validarSalida: el formato de las horas, la salida que falta, la entrada que falta, el orden y la nota), con
 * el tipo de día que mandó el servidor. Un día que no está en `diasPorFecha` (sin su tipo) no se controla: lo controla el servidor.
 */
function erroresDeLaPlanilla(cambios, diasPorFecha) {
  const errores = new Map();
  for (const fecha of fechasCambiadas(cambios, diasPorFecha)) {
    const dia = esMapa(diasPorFecha) ? diasPorFecha.get(fecha) : null;
    if (!esObjeto(dia) || !TIPOS_DE_DIA.includes(dia.tipo)) continue;
    const error = errorDeLaSalida(dia.tipo, valoresDeLaSalida(cambioDe(cambios, fecha)));
    if (error !== null) errores.set(fecha, error);
  }
  return errores;
}

// El cuerpo de PUT /mi-espacio/salidas: cada fecha pedida con su estado completo, como se manda (las horas cortadas a 'HH:MM', la
// nota recortada y lo vacío como ''; un «Quitar», todo vacío: un borrado)
const cuerpoDeLaPlanilla = (cambios, fechas) => ({
  dias: (Array.isArray(fechas) ? fechas : []).map((fecha) => ({ fecha, ...valoresDeLaSalida(cambioDe(cambios, fecha)) }))
});

/**
 * Los días que se ven en la planilla de un mes, por fecha: los del servidor (`dias`), salvo un sábado o domingo guardado que se
 * quitó, y los sábados y domingos sumados (`agregados`, de los `fines_de_semana` o uno quitado que se vuelve a sumar).
 */
function diasVisiblesDeLaPlanilla(planilla, estado) {
  const { cambios = null, agregados = null } = esObjeto(estado) ? estado : {};
  if (!esObjeto(planilla)) return [];
  const visibles = new Map();
  for (const dia of listaDe(planilla.dias)) {
    if (!esFechaDeTexto(dia.fecha) || visibles.has(dia.fecha)) continue;
    const quitado = cambioDe(cambios, dia.fecha)?.quitar === true;
    if (!esFinDeSemana(dia.fecha) || !quitado || tieneEn(agregados, dia.fecha)) visibles.set(dia.fecha, dia);
  }
  for (const dia of listaDe(planilla.fines_de_semana)) {
    if (esFechaDeTexto(dia.fecha) && !visibles.has(dia.fecha) && tieneEn(agregados, dia.fecha)) visibles.set(dia.fecha, dia);
  }
  return [...visibles.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

// Los sábados y domingos del mes que se pueden sumar («¿Trabajaste un sábado o un domingo?»): los que no se ven, de los
// `fines_de_semana` del servidor (hasta hoy) y uno guardado que se quitó, por fecha
function finesDeSemanaParaSumar(planilla, estado) {
  if (!esObjeto(planilla)) return [];
  const visibles = new Set(diasVisiblesDeLaPlanilla(planilla, estado).map((dia) => dia.fecha));
  const libres = new Map();
  for (const dia of [...listaDe(planilla.dias), ...listaDe(planilla.fines_de_semana)]) {
    if (esFechaDeTexto(dia.fecha) && esFinDeSemana(dia.fecha) && !visibles.has(dia.fecha)) libres.set(dia.fecha, dia);
  }
  return [...libres.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

// Lo que suman unos días de la planilla, con los cambios encima (con horasDelDiaDeLaPlanilla): la banda y el total de cada semana
const horasDeLosDias = (dias, cambios) => listaDe(dias).reduce((suma, dia) => suma
  + (horasDelDiaDeLaPlanilla({ tipo: dia.tipo, ...valoresDeLaSalida(valorDelDia(dia, cambioDe(cambios, dia.fecha))) }) ?? 0), 0);

/**
 * La banda de arriba de la planilla (spec, sección 4): el total del mes en grande («18 h») y la frase de textoDeLaSumaDelMes, con lo
 * que se suma en negrita («En noviembre vas a tener <b>2 días de franco</b> y <b>4 horas a favor</b>.»). No es una región viva.
 */
function htmlDeLaBandaDeLaPlanilla(mes, horas, hoy) {
  return `<span class="mp-suma-cifra">${esc(numeroConComa(horas))}<small>h</small></span>`
    + `<p class="mp-suma-texto">${fraseDeLaSumaDelMes(mes, horas, hoy, (parte) => `<b>${esc(parte)}</b>`)}</p>`;
}

/**
 * El pie de la planilla: «Todo guardado.» o cuántos días tienen cambios sin guardar, con sus meses si son más de uno («3 días con
 * cambios sin guardar (septiembre y octubre).»; el mismo mes de dos años, con el año). Texto plano.
 */
function textoDelPieDeLaPlanilla(fechas) {
  const partes = partesDelPie(fechas);
  return partes === null ? 'Todo guardado.' : `${partes.cuenta}${partes.resto}`;
}
// …y en el pie de la página, con la cuenta en negrita, como en la maqueta («<b>3 días</b> con cambios sin guardar (septiembre y
// octubre).»), escapado
function htmlDelPieDeLaPlanilla(fechas) {
  const partes = partesDelPie(fechas);
  return partes === null ? 'Todo guardado.' : `<b>${esc(partes.cuenta)}</b>${esc(partes.resto)}`;
}
// Las dos partes del pie: la cuenta («3 días») y lo que sigue; sin fechas, null
function partesDelPie(fechas) {
  const validas = [...new Set((Array.isArray(fechas) ? fechas : []).filter(esFechaDeTexto))];
  if (validas.length === 0) return null;
  const meses = [...new Set(validas.map((fecha) => fecha.slice(0, 7)))].sort();
  const nombres = meses.map((mes) => nombreDelMes(mes));
  const conAnio = new Set(nombres).size < nombres.length;
  const enMeses = meses.length > 1
    ? ` (${listaConY(meses.map((mes, indice) => (conAnio ? `${nombres[indice]} de ${mes.slice(0, 4)}` : nombres[indice])))})` : '';
  return { cuenta: `${validas.length} ${validas.length === 1 ? 'día' : 'días'}`, resto: ` con cambios sin guardar${enMeses}.` };
}

/**
 * «¿Trabajaste un sábado o un domingo?» al final de la planilla (lo que va en #mp-sumar): el selector de los sábados y domingos del
 * mes que se pueden sumar (`finesDeSemanaParaSumar`, con su texto corto del servidor) y «Sumar el día»; sin ninguno, por qué. Una
 * planilla que no llegó, ''.
 */
function htmlDelSumarDeLaPlanilla(planilla, estado) {
  if (!esObjeto(planilla) || !esMesDeTexto(planilla.mes)) return '';
  const libres = finesDeSemanaParaSumar(planilla, estado);
  if (libres.length === 0) return `<p>No quedan sábados ni domingos para sumar en ${esc(nombreDelMes(planilla.mes))}.</p>`;
  const opciones = libres.map((dia) => `<option value="${esc(dia.fecha)}">${esc(conTexto(dia.fecha_texto) ? dia.fecha_texto : dia.fecha)}</option>`);
  return '<label class="form-label" for="mp-finde">¿Trabajaste un sábado o un domingo?</label>'
    + `<select class="form-select" id="mp-finde">${opciones.join('')}</select>`
    + '<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" id="mp-sumar-boton">Sumar el día</button>';
}

// Lo que dicen la confirmación de salir con cambios («Los cambios de 3 días se pierden.»), el aviso de arriba del cuerpo con los
// días marcados («Revisá el día marcado.», «Revisá los 2 días marcados.») y el último renglón de «Cómo se cuentan las horas» («Las
// horas de octubre son horas a favor en noviembre.»; un mes que no sirve, '')
const textoDeSalirSinGuardar = (cantidad) => `Los cambios de ${cantidad === 1 ? '1 día' : `${String(cantidad)} días`} se pierden.`;
const textoDeLosErroresDeLaPlanilla = (cantidad) => (cantidad === 1 ? 'Revisá el día marcado.' : `Revisá los ${String(cantidad)} días marcados.`);
const textoDeComoSeCuentan = (mes) => (esMesDeTexto(mes)
  ? `Las horas de ${nombreDelMes(mes)} son horas a favor en ${nombreDelMes(mes, 1)}.` : '');

// El renglón de una semana de la planilla: «5 al 9 de octubre», «1 y 2 de octubre» (dos días seguidos), «30 de octubre»; sin
// fechas, ''. Los días son los del mes de la primera
function textoDeLaSemana(fechas) {
  const validas = (Array.isArray(fechas) ? fechas : []).filter(esFechaDeTexto).sort();
  if (validas.length === 0) return '';
  const dias = validas.map((fecha) => Number(fecha.slice(8, 10)));
  const delMes = ` de ${nombreDelMes(validas[0])}`;
  if (dias.length === 1) return `${dias[0]}${delMes}`;
  if (dias.length === 2 && dias[1] - dias[0] === 1) return `${dias[0]} y ${dias[1]}${delMes}`;
  return `${dias[0]} al ${dias.at(-1)}${delMes}`;
}
// Lo que suma una semana: «3 h», o la raya si no suma nada
const textoDelTotalDeLaSemana = (horas) => (horas > 0 ? `${numeroConComa(horas)} h` : '—');

/**
 * Las horas de una fila de la planilla mientras se escribe (lo que va en su #mp-h-AAAA-MM-DD), con el tipo del día y lo que tienen
 * sus campos: la pastilla con las horas («1,5 h»), «0» con «No llega a media hora», o la raya, sola (sin salida, o con una hora que
 * no se puede leer) o con lo que falta («Falta la salida» o «Poné la entrada» en un día que no es hábil, «La salida va después»).
 */
function htmlDeLasHorasDeLaFila(dia, valor) {
  const tipo = esObjeto(dia) ? dia.tipo : null;
  const { entrada, salida } = valoresDeLaSalida(valor);
  const nada = '<b class="nada">—</b>';
  if (salida === '') return tipo !== 'habil' && entrada !== '' ? `${nada}<small>Falta la salida</small>` : nada;
  const horas = horasDelDiaDeLaPlanilla({ tipo, entrada, salida });
  if (horas === null) {
    if (minutosDeLaSalida(salida) === null || (entrada !== '' && minutosDeLaSalida(entrada) === null)) return nada;
    if (tipo !== 'habil' && entrada === '') return `${nada}<small>Poné la entrada</small>`;
    return `${nada}<small>La salida va después</small>`;
  }
  if (horas === 0) return '<b class="cero">0</b><small>No llega a media hora</small>';
  return `<b>${esc(numeroConComa(horas))} h</b>`;
}

// Las marcas debajo de la fecha de una fila: el feriado en ámbar con su nombre (también un sábado o domingo que lo es), o el
// sábado o el domingo con un borde, y la licencia de unas horas («2 h a favor»; con `conEntera`, también la del día entero)
const htmlDeLasMarcasDelDia = (dia, { conEntera = false } = {}) => {
  const marcas = [];
  if (dia.tipo === 'feriado') marcas.push(`<span class="me-insignia ambar">Feriado: ${esc(dia.feriado)}</span>`);
  else if (dia.tipo === 'finde' && conTexto(dia.finde_texto)) marcas.push(`<span class="me-insignia borde">${esc(dia.finde_texto)}</span>`);
  if (esObjeto(dia.licencia) && (dia.licencia.entera !== true || conEntera)) {
    marcas.push(`<span class="me-insignia verde">${esc(dia.licencia.texto)}</span>`);
  }
  return marcas.length > 0 ? `<span class="mp-marcas">${marcas.join('')}</span>` : '';
};

/**
 * Una fila de la planilla (un día; la maqueta, `htmlDelDia`), con sus clases (`feriado` o `finde`, `licencia`, `futuro`, `hoy` y
 * `cambiado`, la raya de lo que no se guardó):
 * - un día que todavía no llegó: «Todavía no llegó.», sin campos;
 * - un día de licencia de día entero: su tipo y «Es un día de licencia: no se cargan horas.», sin campos; con una salida guardada de
 *   antes, la salida (y la entrada) como texto, sus horas, el aviso del servidor y «Quitar»;
 * - los demás, un grupo con el nombre de su fecha (`role="group"` y `aria-labelledby`): la entrada (opcional en un día hábil), la
 *   salida, las horas, «Quitar» en un sábado o domingo, «Nota» (abre su campo debajo; con nota, la nota en cursiva y «Cambiar
 *   nota») y, mientras el día no cambió, el aviso del servidor («Ahora es feriado: falta la entrada.»). Un error va debajo, con
 *   `aria-invalid` y `aria-describedby` en su campo (uno en la nota la abre; uno sin campo de la fila, del servidor, va a la salida).
 * Un error del servidor en una fila sin campos queda atado a lo que recibe el foco: en una que no llegó o de licencia sin salida, la
 * fila (un grupo con su nombre, `tabindex="-1"` y el error en su `aria-describedby`); en una de licencia con una salida de antes,
 * «Quitar» (con el aviso y el error). Cada fila es un <div>: van en #mp-dias, sin semántica de lista.
 */
function htmlDeLaFilaDeLaPlanilla(dia, { cambios, errores, notasAbiertas, cambiadas }) {
  const { fecha } = dia;
  const id = esc(fecha);
  const largo = conTexto(dia.fecha_larga) ? dia.fecha_larga : diaLargoDe(fecha);
  const valor = valorDelDia(dia, cambioDe(cambios, fecha));
  const entera = esObjeto(dia.licencia) && dia.licencia.entera === true;
  const cambiado = cambiadas.has(fecha);
  const error = esMapa(errores) && esObjeto(errores.get(fecha)) ? errores.get(fecha) : null;
  const clases = ['mp-dia'];
  if (dia.tipo === 'feriado') clases.push('feriado');
  else if (dia.tipo === 'finde') clases.push('finde');
  if (entera) clases.push('licencia');
  if (dia.futuro === true) clases.push('futuro');
  if (dia.hoy === true) clases.push('hoy');
  if (cambiado) clases.push('cambiado');
  const abre = `<div class="${clases.join(' ')}" id="mp-dia-${id}"`;
  const nombre = `<b id="mp-f-${id}">${esc(dia.fecha_texto)}${dia.hoy === true ? ' <span class="mp-hoy">Hoy</span>' : ''}</b>`;
  const htmlDelError = error === null ? '' : `<p class="mp-error" id="mp-e-${id}">${esc(error.mensaje)}</p>`;
  const insigniaEntera = entera ? `<span class="me-insignia verde">${esc(dia.licencia.texto)}</span> ` : '';
  const conSalida = valor.salida.trim() !== '';
  const grupo = `${abre} role="group" aria-labelledby="mp-f-${id}"`;

  if (dia.futuro === true || (entera && !conSalida)) {
    const texto = dia.futuro === true ? 'Todavía no llegó.' : 'Es un día de licencia: no se cargan horas.';
    // Sin campos, un error (del servidor) describe la fila, que recibe el foco
    const conError = error === null ? '>' : ` tabindex="-1" aria-describedby="mp-e-${id}">`;
    return `${error === null ? abre : grupo}${conError}<span class="mp-fecha">${nombre}${htmlDeLasMarcasDelDia(dia)}</span>`
      + `<span class="mp-lugar">${insigniaEntera}${texto}</span>${htmlDelError}</div>`;
  }

  const aviso = !cambiado && conTexto(dia.aviso) ? `<p class="mp-aviso" id="mp-a-${id}">${esc(dia.aviso)}</p>` : '';
  const nota = conTexto(valor.nota) ? `<p class="mp-nota-vista">${esc(valor.nota)}</p>` : '';

  if (entera) {
    // Una licencia de día entero con una salida guardada de antes: sigue sumando, como texto, hasta que se la quita. «Quitar» es lo
    // único que recibe el foco: lo describen el aviso y el error
    const entrada = valor.entrada.trim() !== '' ? `<small>Entrada ${esc(valor.entrada)}</small>` : '';
    const ids = [...(aviso === '' ? [] : [`mp-a-${id}`]), ...(error === null ? [] : [`mp-e-${id}`])];
    const describe = ids.length === 0 ? '' : ` aria-describedby="${ids.join(' ')}"`;
    return `${grupo}><span class="mp-fecha">${nombre}${htmlDeLasMarcasDelDia(dia, { conEntera: true })}</span>`
      + `<span class="mp-guardada">Salida ${esc(valor.salida)}${entrada}</span>`
      + `<span class="mp-horas" id="mp-h-${id}">${htmlDeLasHorasDeLaFila(dia, valor)}</span>`
      + `<span class="mp-acciones"><button type="button" class="sg-link me-link-rojo" data-quitar="${id}" `
      + `aria-label="Quitar la salida del ${esc(largo)}"${describe}>Quitar</button></span>${nota}${aviso}${htmlDelError}</div>`;
  }

  // El campo del error: el suyo (entrada, salida o nota) o, uno sin campo de la fila, la salida
  const campoDelError = error === null ? null : (['entrada', 'salida', 'nota'].includes(error.campo) ? error.campo : 'salida');
  const describir = (campo) => {
    const ids = [...(campoDelError === campo ? [`mp-e-${id}`] : []), ...(campo === 'salida' && aviso !== '' ? [`mp-a-${id}`] : [])];
    return (campoDelError === campo ? ' aria-invalid="true"' : '') + (ids.length > 0 ? ` aria-describedby="${ids.join(' ')}"` : '');
  };
  const habil = dia.tipo === 'habil';
  const rotulo = habil ? 'Entrada (opcional)' : 'Entrada';
  const tieneNota = valor.nota.trim() !== '';
  const abierta = tieneEn(notasAbiertas, fecha) || campoDelError === 'nota';
  const quitar = esFinDeSemana(fecha) ? `<button type="button" class="sg-link me-link-rojo" data-quitar="${id}" `
    + `aria-label="Quitar el ${esc(largo)}">Quitar</button>` : '';
  const campoDeLaNota = `<span class="mp-nota-campo"><input type="text" data-campo="nota" data-fecha="${id}" value="${esc(valor.nota)}" `
    + `placeholder="Por ejemplo: cierre del informe mensual" aria-label="Nota del ${esc(largo)}"${describir('nota')}></span>`;
  return `${grupo}><span class="mp-fecha">${nombre}${htmlDeLasMarcasDelDia(dia)}</span>`
    + `<label class="mp-campo entrada"><span class="mp-rotulo">${rotulo}</span><input type="time"${habil ? ' class="opcional"' : ''} `
    + `data-campo="entrada" data-fecha="${id}" value="${esc(valor.entrada)}" data-vacio="${valor.entrada.trim() === '' ? '1' : '0'}" `
    + `aria-label="${rotulo} del ${esc(largo)}"${describir('entrada')}></label>`
    + '<label class="mp-campo salida"><span class="mp-rotulo">Salida</span><input type="time" '
    + `data-campo="salida" data-fecha="${id}" value="${esc(valor.salida)}" aria-label="Salida del ${esc(largo)}"${describir('salida')}></label>`
    + `<span class="mp-horas" id="mp-h-${id}">${htmlDeLasHorasDeLaFila(dia, valor)}</span>`
    + `<span class="mp-acciones">${quitar}<button type="button" class="sg-link" data-nota="${id}" aria-expanded="${String(abierta)}" `
    + `aria-label="${tieneNota ? 'Cambiar la nota' : 'Agregar una nota'} del ${esc(largo)}">${tieneNota ? 'Cambiar nota' : 'Nota'}</button></span>`
    + `${abierta ? campoDeLaNota : nota}${aviso}${htmlDelError}</div>`;
}

/**
 * La planilla de un mes (lo que va en #mp-dias, un <div>: sin semántica de lista, porque cada día es un grupo): los días que se
 * ven (`diasVisiblesDeLaPlanilla`), agrupados por semana (de lunes a domingo), cada semana con su renglón («5 al 9 de octubre» y lo
 * que suma, con los cambios, en .mp-semana-total: la página lo cambia mientras se escribe) y después sus filas
 * (`htmlDeLaFilaDeLaPlanilla`). Nada de esto es una región viva. Una planilla que no llegó, ''.
 */
function htmlDeLaPlanilla(planilla, estado) {
  const { cambios = null, agregados = null, errores = null, notasAbiertas = null } = esObjeto(estado) ? estado : {};
  const dias = diasVisiblesDeLaPlanilla(planilla, { cambios, agregados });
  const contexto = { cambios, errores, notasAbiertas, cambiadas: new Set(fechasCambiadas(cambios, diasPorFechaDe([planilla]))) };
  const semanas = [];
  for (const dia of dias) {
    const lunes = sumarDiasA(dia.fecha, -lugarEnLaSemana(dia.fecha));
    if (semanas.length === 0 || semanas.at(-1).lunes !== lunes) semanas.push({ lunes, dias: [] });
    semanas.at(-1).dias.push(dia);
  }
  return semanas.map(({ dias: deLaSemana }) => {
    const fechas = deLaSemana.map((dia) => dia.fecha);
    return `<div class="mp-semana" data-fechas="${esc(fechas.join(','))}"><span>${esc(textoDeLaSemana(fechas))}</span>`
      + `<span class="mp-semana-total">${esc(textoDelTotalDeLaSemana(horasDeLosDias(deLaSemana, cambios)))}</span></div>`
      + deLaSemana.map((dia) => htmlDeLaFilaDeLaPlanilla(dia, contexto)).join('');
  }).join('');
}

// ---- «Mis vacaciones y saldos» ----

/**
 * Los campos de «Para arrancar» (los de GET /saldo-inicial, que arma camposDelSaldoInicial con lo guardado) con lo que se elige
 * en el modal antes de guardarlo, si el saldo es del año del modal (`anio`; el de los campos es el de su `medica`): el máximo de
 * las vacaciones del año es la primera mitad de los días elegidos (con un número impar, la mayor), y el campo de los estudios
 * está solo si estudia, hasta los días de su carrera, antes de la atención médica. Cada campo conserva su `valor`.
 */
function camposConLoElegido(campos, { anio, dias, estudios } = {}) {
  const lista = listaDe(campos);
  if (!Number.isInteger(anio) || lista.find((campo) => campo.concepto === 'medica')?.anio !== anio) return lista;
  const conDias = DIAS_VACACIONES.includes(dias)
    ? lista.map((campo) => (campo.clave === `vacaciones-${anio}` ? { ...campo, maximo: Math.ceil(dias / 2) } : campo))
    : lista;
  const sinEstudios = conDias.filter((campo) => campo.clave !== 'estudios');
  if (typeof estudios !== 'string' || !Object.hasOwn(DIAS_ESTUDIOS, estudios)) return sinEstudios;
  const antes = conDias.find((campo) => campo.clave === 'estudios');
  const delCampo = {
    clave: 'estudios', concepto: 'estudios', anio, rotulo: 'Días de estudios', maximo: DIAS_ESTUDIOS[estudios], paso: 1,
    valor: antes?.valor ?? null
  };
  const medica = sinEstudios.findIndex((campo) => campo.concepto === 'medica');
  return [...sinEstudios.slice(0, medica), delCampo, ...sinEstudios.slice(medica)];
}

// Lo que muestra cada campo al abrir: lo guardado, con coma; sin nada guardado, vacío
const valoresDelSaldo = (campos) => Object.fromEntries(listaDe(campos)
  .map((campo) => [campo.clave, campo.valor === null || campo.valor === undefined ? '' : numeroConComa(campo.valor)]));

// Los errores del saldo inicial (`{ clave: mensaje }`), como validarSaldoInicial: de 0 a su máximo, entero o, con paso 0,5, de a
// media hora
function erroresDelSaldo(valores, campos) {
  const errores = {};
  for (const campo of listaDe(campos)) {
    const maximo = Number(campo.maximo);
    if (typeof campo.clave !== 'string' || !Number.isFinite(maximo)) continue;
    const cantidad = numeroDelCampo(deMapa(valores, campo.clave, ''));
    const enMedias = campo.paso === 0.5;
    if (cantidad === null || !(cantidad >= 0 && cantidad <= maximo)) errores[campo.clave] = textoSaldo(maximo);
    else if (!Number.isInteger(enMedias ? cantidad * 2 : cantidad)) {
      errores[campo.clave] = enMedias ? MENSAJES_FORMULARIOS.saldoMedias : textoSaldo(maximo);
    }
  }
  return errores;
}

// El cuerpo de PUT /saldo-inicial: un número por campo
const cuerpoDelSaldo = (valores, campos) => ({
  saldos: Object.fromEntries(listaDe(campos).map((campo) => [campo.clave, numeroDelCampo(deMapa(valores, campo.clave, ''))]))
});

// Los días de vacaciones del año, como números para elegir (cada uno describe el error del grupo, como los tipos de licencia)
const htmlDeDiasDeVacaciones = (elegidos) => DIAS_VACACIONES.map((dias) => '<label class="me-numero">'
  + `<input type="radio" name="ms-dia" value="${String(dias)}"${dias === elegidos ? ' checked' : ''} aria-describedby="ms-dias-error">`
  + `<span>${String(dias)}</span></label>`)
  .join('');

// La licencia por estudios: universitaria, secundaria o «No estudio» (el valor vacío). `elegidos`: la carrera, '' por «No
// estudio» o undefined (todavía no eligió)
function htmlDeEstudios(elegidos) {
  const opciones = [
    ['universitario', 'Universitaria', `${String(DIAS_ESTUDIOS.universitario)} días por año`],
    ['secundario', 'Secundaria', `${String(DIAS_ESTUDIOS.secundario)} días por año`],
    ['', 'No estudio', 'Sin licencia por estudios']
  ];
  return opciones.map(([valor, nombre, detalle]) => '<label class="me-opcion">'
    + `<input type="radio" name="ms-estudio" value="${valor}"${valor === elegidos ? ' checked' : ''} aria-describedby="ms-estudios-error">`
    + `<span><b>${nombre}</b><small>${detalle}</small></span></label>`).join('');
}

// Un campo de «Para arrancar», con su error
const htmlDeCampoDelSaldo = (campo, valores) => {
  const id = `ms-campo-${String(campo.clave)}`;
  return `<div class="form-group"><label class="form-label" for="${esc(id)}">${esc(campo.rotulo)}</label>`
    + `<input type="text" inputmode="decimal" class="form-input" id="${esc(id)}" data-saldo="${esc(campo.clave)}" `
    + `value="${esc(deMapa(valores, campo.clave, ''))}" autocomplete="off" aria-describedby="${esc(id)}-error">`
    + `<p class="form-error" id="${esc(id)}-error" hidden></p></div>`;
};

// «Para arrancar»: lo que quedaba de cada licencia ordinaria; después, «Y lo que ya usaste en 2026:» y, en contrato, las horas no
// utilizadas previamente
function htmlDeCamposDelSaldo(campos, valores) {
  const lista = listaDe(campos).filter((campo) => typeof campo.clave === 'string');
  const grupo = (filtro) => {
    const delGrupo = lista.filter(filtro);
    if (delGrupo.length === 0) return '';
    return `<div class="me-campos-saldo">${delGrupo.map((campo) => htmlDeCampoDelSaldo(campo, valores)).join('')}</div>`;
  };
  const anio = lista.find((campo) => campo.concepto === 'medica')?.anio;
  return grupo((campo) => campo.concepto === 'vacaciones')
    + (Number.isInteger(anio) ? `<p class="form-hint">Y lo que ya usaste en ${String(anio)}:</p>` : '')
    + grupo((campo) => !['vacaciones', 'horas_no_utilizadas'].includes(campo.concepto))
    + grupo((campo) => campo.concepto === 'horas_no_utilizadas');
}

// =====================================================
// Lo puro: la agenda (spec 2026-10-26-mi-espacio-agenda, 6)
// =====================================================

// Los próximos van de hoy a hoy + 30 (copia de DIAS_DE_PROXIMOS de services/miEspacioEventosReglas.js, atada por un test de paridad).
// En un día del mes se ven hasta 3 cosas; el resto, con «y N más»
const DIAS_DE_PROXIMOS = 30;
const COSAS_POR_DIA = 3;
// Los días de la semana, de lunes a domingo: el nombre («lunes 26/10») y el corto (la cabeza del mes y «Mié 28»)
const NOMBRES_DE_LOS_DIAS = Object.freeze(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
const DIAS_CORTOS = Object.freeze(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);

// 'AAAA-MM' de un mes que se puede pedir (de 2000 a 2100, los años de las fechas de GET /mi-espacio/eventos)
const esMesDeTexto = (mes) => typeof mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
  && Number(mes.slice(0, 4)) >= 2000 && Number(mes.slice(0, 4)) <= 2100;
// Los días se cuentan con Date.UTC sobre las partes de la fecha (diaUtc), nunca con la hora local: la fecha de un momento UTC y la
// fecha de `dias` días después (o antes)
const fechaDeUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
const sumarDiasA = (fecha, dias) => fechaDeUtc(diaUtc(fecha) + dias * 86400000);
// El lugar de una fecha en la semana: 0 el lunes … 6 el domingo
const lugarEnLaSemana = (fecha) => (new Date(diaUtc(fecha)).getUTCDay() + 6) % 7;
// «lunes 26/10» (como diaLargo de services/miEspacioResumen.js, atada por un test de paridad), «Mié 28» y «Mar 03/11»
const diaLargoDe = (fecha) => `${NOMBRES_DE_LOS_DIAS[lugarEnLaSemana(fecha)]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
const diaDeEstaSemana = (fecha) => `${DIAS_CORTOS[lugarEnLaSemana(fecha)]} ${String(Number(fecha.slice(8, 10)))}`;
const diaMasAdelante = (fecha) => `${DIAS_CORTOS[lugarEnLaSemana(fecha)]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/**
 * Los días de la grilla de un mes ('AAAA-MM'), de lunes a domingo: del lunes de la semana del 1 al domingo de la del último, cada
 * uno `{ fecha, dia, del_mes, finde }` (`dia`, el número del día; `del_mes`, si es del mes y no de un vecino; `finde`, sábado o
 * domingo). Un mes que no sirve, [].
 */
function diasDeLaGrilla(mes) {
  if (!esMesDeTexto(mes)) return [];
  const primero = `${mes}-01`;
  const ultimo = fechaDeUtc(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
  const hasta = sumarDiasA(ultimo, 6 - lugarEnLaSemana(ultimo));
  const dias = [];
  for (let fecha = sumarDiasA(primero, -lugarEnLaSemana(primero)); fecha <= hasta; fecha = sumarDiasA(fecha, 1)) {
    dias.push({ fecha, dia: Number(fecha.slice(8, 10)), del_mes: fecha.slice(0, 7) === mes, finde: lugarEnLaSemana(fecha) >= 5 });
  }
  return dias;
}

// El mes `n` meses después (con `n` negativo, antes): 'AAAA-MM', o null si el mes o `n` no sirven o se sale de los que se piden
function mesVecino(mes, n) {
  if (!esMesDeTexto(mes) || !Number.isInteger(n)) return null;
  const indice = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  const vecino = `${String(Math.floor(indice / 12))}-${String((indice % 12) + 1).padStart(2, '0')}`;
  return esMesDeTexto(vecino) ? vecino : null;
}

// 'Octubre 2026' (como mesTitulo de services/miEspacioResumen.js, atada por un test de paridad); un mes que no sirve, ''
function tituloDelMes(mes) {
  if (!esMesDeTexto(mes)) return '';
  const nombre = nombreDelMes(mes);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${mes.slice(0, 4)}`;
}

// Lo que se pide para un mes (`{ desde, hasta }`: toda su grilla, con los días de los meses vecinos) y para los próximos (de hoy a
// hoy + DIAS_DE_PROXIMOS); con un mes o un hoy que no sirven, null
function rangoDeLaGrilla(mes) {
  const dias = diasDeLaGrilla(mes);
  return dias.length > 0 ? { desde: dias[0].fecha, hasta: dias.at(-1).fecha } : null;
}
const rangoDeProximos = (hoy) => (esFechaDeTexto(hoy) ? { desde: hoy, hasta: sumarDiasA(hoy, DIAS_DE_PROXIMOS) } : null);

// La hora de un evento ('HH:MM'), o ''
const horaDelEvento = (evento) => (typeof evento.desde === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(evento.desde) ? evento.desde : '');
// El color de un evento: violeta si es compartido (también uno de otra persona, que se ve solo porque te lo compartieron); si no,
// tinta
const claseDelEvento = (evento) => (evento.compartido === true || evento.es_mio !== true ? 'compartido' : 'propio');
// Los eventos (los ítems de GET /mi-espacio/eventos) con una fecha, por fecha, hora y título
const eventosEnOrden = (eventos) => listaDe(eventos).filter((evento) => esFechaDeTexto(evento.fecha))
  .sort((a, b) => a.fecha.localeCompare(b.fecha) || horaDelEvento(a).localeCompare(horaDelEvento(b))
    || comoTexto(a.titulo).localeCompare(comoTexto(b.titulo), 'es'));
// Los días en que se pinta una licencia o un compañero: los hábiles dentro del rango (`dias`, del servidor)
const diasPintados = (fila) => (Array.isArray(fila.dias) ? fila.dias.filter(esFechaDeTexto) : []);

/**
 * Lo que va en cada día del mes (lo que manda GET /mi-espacio/eventos para la grilla): `Map<fecha, [{ clase, texto, evento_id? }]>`.
 * En un día, en este orden: los feriados («Feriado: …»), tus licencias («Franquicia, 2 h»), los compañeros que no están («Laura
 * Gómez no está») y los eventos por hora y título («10:00 Reunión de equipo», con su `evento_id`). Las licencias y los compañeros,
 * en sus `dias`. `clase` es el color: 'feriado', 'licencia', 'ausente', 'propio' o 'compartido'.
 */
function cosasPorDia(datos) {
  const fuente = esObjeto(datos) ? datos : {};
  const porDia = new Map();
  const sumar = (fecha, cosa) => {
    if (!esFechaDeTexto(fecha)) return;
    if (!porDia.has(fecha)) porDia.set(fecha, []);
    porDia.get(fecha).push(cosa);
  };
  for (const feriado of listaDe(fuente.feriados)) sumar(feriado.fecha, { clase: 'feriado', texto: comoTexto(feriado.texto) });
  for (const licencia of listaDe(fuente.licencias)) {
    for (const dia of diasPintados(licencia)) sumar(dia, { clase: 'licencia', texto: comoTexto(licencia.texto) });
  }
  for (const ausente of listaDe(fuente.ausentes)) {
    for (const dia of diasPintados(ausente)) sumar(dia, { clase: 'ausente', texto: comoTexto(ausente.texto) });
  }
  for (const evento of eventosEnOrden(fuente.eventos)) {
    const texto = [horaDelEvento(evento), comoTexto(evento.titulo)].filter(conTexto).join(' ');
    sumar(evento.fecha, { clase: claseDelEvento(evento), texto, evento_id: evento.id ?? null });
  }
  return porDia;
}

// Una cosa de un día: un evento es un botón (lo abre, con su id); lo demás, un texto. Los dos con su title: en la celda se corta
const htmlDeCosa = (cosa) => {
  const texto = esc(cosa.texto);
  return Object.hasOwn(cosa, 'evento_id')
    ? `<button type="button" class="me-ev ${cosa.clase}" data-evento="${esc(cosa.evento_id)}" title="${texto}">${texto}</button>`
    : `<span class="me-ev ${cosa.clase}" title="${texto}">${texto}</span>`;
};

// Un día de la grilla: su número y hasta 3 cosas; el resto, oculto, y «y N más», que lo muestra (data-ver-mas). Hoy, con
// aria-current; los fines de semana, los feriados y los días de los meses vecinos, con otro fondo
function htmlDeLaCelda(dia, cosas, hoy) {
  const clases = ['me-celda', !dia.del_mes && 'otro-mes', dia.finde && 'finde', cosas.some((cosa) => cosa.clase === 'feriado') && 'feriado',
    dia.fecha === hoy && 'hoy'].filter(Boolean).join(' ');
  const resto = cosas.slice(COSAS_POR_DIA);
  const mas = resto.length > 0 ? `<div class="me-resto" hidden>${resto.map(htmlDeCosa).join('')}</div>`
    + `<button type="button" class="me-mas" data-ver-mas="${dia.fecha}">y ${String(resto.length)} más</button>` : '';
  return `<td class="${clases}"${dia.fecha === hoy ? ' aria-current="date"' : ''}><div class="me-celda-cuerpo">`
    + `<span class="me-num">${String(dia.dia)}</span>${cosas.slice(0, COSAS_POR_DIA).map(htmlDeCosa).join('')}${mas}</div></td>`;
}

/**
 * El mes ('AAAA-MM') con lo que manda GET /mi-espacio/eventos para su grilla (`datos`; sin ellos, mientras se piden, la grilla
 * vacía) y `hoy`: una tabla de lunes a domingo, nombrada por el título del mes (#ag-mes-titulo), con la cabeza de los días (el corto
 * a la vista y el nombre para el lector de pantalla) y una celda por día. Un mes que no sirve, ''.
 */
function htmlDelMes(mes, datos, hoy) {
  const dias = diasDeLaGrilla(mes);
  if (dias.length === 0) return '';
  const cosas = cosasPorDia(datos);
  const cabeza = DIAS_CORTOS.map((corto, i) => `<th scope="col"><span aria-hidden="true">${corto}</span>`
    + `<span class="visualmente-oculto">${NOMBRES_DE_LOS_DIAS[i]}</span></th>`).join('');
  const semanas = [];
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(`<tr>${dias.slice(i, i + 7).map((dia) => htmlDeLaCelda(dia, cosas.get(dia.fecha) ?? [], hoy)).join('')}</tr>`);
  }
  return `<table class="me-mes" aria-labelledby="ag-mes-titulo"><thead><tr>${cabeza}</tr></thead><tbody>${semanas.join('')}</tbody></table>`;
}

/**
 * Los próximos (lo que manda GET /mi-espacio/eventos de hoy a hoy + 30), agrupados en «Hoy, lunes 26/10», «Mañana, martes 27/10»,
 * «Esta semana» (hasta el domingo) y «Más adelante», sin grupos vacíos: `[{ titulo, items }]`. Cada ítem, `{ hora, titulo, detalle,
 * clase }` y, si es un evento, `quien` y `evento_id`. En un día, primero lo de todo el día (los feriados, tus licencias y los
 * compañeros, en ese orden) y después los eventos por hora y título. Hoy y mañana dicen la hora (o «Todo el día»); esta semana,
 * «Mié 28», y más adelante, «Mar 03/11», con la hora del evento en el título. Lo de varios días va una vez, el día en que empieza o
 * hoy, si ya empezó, con su «Hasta el …»; lo que terminó antes de hoy o es de después del rango no va. El detalle de un evento es su
 * aviso corto («Aviso 2 h antes») y `quien`, el «Solo vos», «Con 4 personas» o «De …» del servidor. Con un hoy que no sirve, [].
 */
function gruposDeProximos(datos, hoy) {
  const rango = rangoDeProximos(hoy);
  if (rango === null) return [];
  const fuente = esObjeto(datos) ? datos : {};
  const enRango = (fecha) => esFechaDeTexto(fecha) && fecha >= hoy && fecha <= rango.hasta;
  const cosas = [];
  const deTodoElDia = (fecha, clase, texto, detalle) => {
    if (enRango(fecha)) cosas.push({ fecha, clase, texto: comoTexto(texto), detalle: comoTexto(detalle) });
  };
  const deVariosDias = (fila, clase) => {
    if (!esFechaDeTexto(fila.desde) || !esFechaDeTexto(fila.hasta) || fila.hasta < hoy) return;
    deTodoElDia(fila.desde > hoy ? fila.desde : hoy, clase, fila.texto, fila.hasta_texto);
  };
  for (const feriado of listaDe(fuente.feriados)) deTodoElDia(feriado.fecha, 'feriado', feriado.texto, '');
  for (const licencia of listaDe(fuente.licencias)) deVariosDias(licencia, 'licencia');
  for (const ausente of listaDe(fuente.ausentes)) deVariosDias(ausente, 'ausente');
  for (const evento of eventosEnOrden(fuente.eventos)) {
    if (!enRango(evento.fecha)) continue;
    cosas.push({
      fecha: evento.fecha, clase: claseDelEvento(evento), hora: horaDelEvento(evento), texto: comoTexto(evento.titulo),
      detalle: comoTexto(esObjeto(evento.aviso) ? evento.aviso.corto : ''), quien: comoTexto(evento.quien_texto), evento_id: evento.id ?? null
    });
  }
  // Por fecha; en un día, en el orden en que se sumaron (sort es estable)
  cosas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const manana = sumarDiasA(hoy, 1);
  const domingo = sumarDiasA(hoy, 6 - lugarEnLaSemana(hoy));
  const grupos = [
    { titulo: `Hoy, ${diaLargoDe(hoy)}`, es: (fecha) => fecha === hoy, dia: null },
    { titulo: `Mañana, ${diaLargoDe(manana)}`, es: (fecha) => fecha === manana, dia: null },
    { titulo: 'Esta semana', es: (fecha) => fecha <= domingo, dia: diaDeEstaSemana },
    { titulo: 'Más adelante', es: () => true, dia: diaMasAdelante }
  ].map((grupo) => ({ ...grupo, items: [] }));
  for (const cosa of cosas) {
    const grupo = grupos.find((uno) => uno.es(cosa.fecha));
    const esEvento = Object.hasOwn(cosa, 'evento_id');
    const item = grupo.dia === null
      ? { hora: esEvento ? cosa.hora : 'Todo el día', titulo: cosa.texto }
      : { hora: grupo.dia(cosa.fecha), titulo: esEvento && cosa.hora ? `${cosa.hora} ${cosa.texto}` : cosa.texto };
    Object.assign(item, { detalle: cosa.detalle, clase: cosa.clase });
    if (esEvento) Object.assign(item, { quien: cosa.quien, evento_id: cosa.evento_id });
    grupo.items.push(item);
  }
  return grupos.filter((grupo) => grupo.items.length > 0).map(({ titulo, items }) => ({ titulo, items }));
}

// Una cosa de los próximos: la hora, el título (un evento es un botón con su id: lo abre) y el detalle (de un evento, quién está, en
// su color, y su aviso)
const htmlDeProximo = (item) => {
  const titulo = Object.hasOwn(item, 'evento_id')
    ? `<button type="button" class="me-prox-titulo" data-evento="${esc(item.evento_id)}">${esc(item.titulo)}</button>`
    : `<span class="me-prox-titulo">${esc(item.titulo)}</span>`;
  const quien = conTexto(item.quien) ? `<span class="me-insignia ${item.clase === 'propio' ? 'azul' : 'violeta'}">${esc(item.quien)}</span>` : '';
  const detalle = quien !== '' || conTexto(item.detalle) ? `<span class="me-prox-detalle">${quien}${esc(item.detalle)}</span>` : '';
  return `<li class="me-prox ${esc(item.clase)}"><span class="me-prox-hora">${esc(item.hora)}</span>${titulo}${detalle}</li>`;
};

// Los próximos, cada grupo con su título; sin nada, «No hay nada en los próximos 30 días.»
function htmlDeProximos(grupos) {
  const conAlgo = listaDe(grupos).filter((grupo) => listaDe(grupo.items).length > 0);
  if (conAlgo.length === 0) return `<p class="me-vacio">No hay nada en los próximos ${String(DIAS_DE_PROXIMOS)} días.</p>`;
  return conAlgo.map((grupo) => `<h3>${esc(grupo.titulo)}</h3><ul class="me-prox-lista">${listaDe(grupo.items).map(htmlDeProximo).join('')}</ul>`)
    .join('');
}

// =====================================================
// Lo puro: el formulario del evento y el detalle de uno ajeno (spec 2026-10-26-mi-espacio-agenda, 1, 2 y 6; maqueta 2)
// =====================================================

// ---- Copias mínimas de services/miEspacioEventosReglas.js, para avisar en el momento (el servidor valida igual), atadas por tests
// de paridad ----

const MENSAJES_EVENTO = Object.freeze({
  titulo: 'Escribí qué es el evento.',
  tituloLargo: 'El título puede tener hasta 150 caracteres.',
  desde: 'Elegí a qué hora empieza.',
  hasta: 'La hora de fin tiene que ser después de la de inicio, el mismo día.',
  detalle: 'El detalle puede tener hasta 1000 caracteres.',
  personas: 'Elegí con quién lo compartís, o «Todos».',
  personasInvalidas: 'Solo podés compartirlo con las personas de la lista.',
  recordatorio: 'Elegí cuándo te llega el recordatorio.',
  sinPermiso: 'No tenés permiso para compartir eventos.',
  noEncontrado: 'Evento no encontrado',
  miRecordatorio: 'Elegí si querés el recordatorio.',
  esTuyo: 'El recordatorio de tu evento se cambia en el evento.'
});
// El largo del título y del detalle (en caracteres contados con Array.from) y la fecha más vieja; la más nueva, fechaMaximaEvento
const LARGO_TITULO_EVENTO = 150;
const LARGO_DETALLE_EVENTO = 1000;
const FECHA_MINIMA_EVENTO = '2025-01-01';
// Los recordatorios, en el orden del formulario, el de entrada y cómo se muestra cada uno
const RECORDATORIOS = Object.freeze(['1h', '2h', 'dia_anterior', 'ninguno']);
const RECORDATORIO_POR_DEFECTO = '2h';
const TEXTO_RECORDATORIO = Object.freeze({
  '1h': '1 hora antes', '2h': '2 horas antes', dia_anterior: 'El día hábil anterior', ninguno: 'Sin aviso'
});

// La fecha más nueva de un evento: el mismo día dos años después de hoy (un 29/02 da el 28/02); null si hoy no es una fecha; después
// del año 9999, el 31/12/9999
const fechaMaximaEvento = (hoy) => {
  if (!esFechaDeTexto(hoy)) return null;
  const anio = Number(hoy.slice(0, 4)) + 2;
  if (anio > 9999) return '9999-12-31';
  const mesYDia = hoy.slice(5) === '02-29' ? '02-28' : hoy.slice(5);
  return `${String(anio).padStart(4, '0')}-${mesYDia}`;
};
// El error de una fecha fuera del rango, como textoRangoEvento: «La fecha tiene que ser del 01/01/2025 al 26/10/2028.» (sin un
// tope, la raya)
const textoRangoDelEvento = (hasta) => `La fecha tiene que ser del ${Utils.fechaCorta(FECHA_MINIMA_EVENTO)} al ${Utils.fechaCorta(hasta)}.`;
// Un id de una persona, como idPositivo de services/proyectosReglas.js: un entero positivo de hasta 10 cifras, en número o en texto;
// si no, null
const idDeLaPersona = (valor) => {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const texto = String(valor);
  return /^[1-9]\d{0,9}$/.test(texto) ? Number(texto) : null;
};
// 'HH:MM' de 00:00 a 23:59 (ni '9:00' ni '10:00:00')
const esHoraDeTexto = (valor) => typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
// 'martes 27/10/2026', de una fecha ya controlada
const diaConFechaDe = (fecha) => `${NOMBRES_DE_LOS_DIAS[lugarEnLaSemana(fecha)]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
// Cuándo es un evento, como cuandoDelEvento: «martes 27/10/2026 de 10:00 a 11:00», o «… a las 10:00» sin hora de fin; si no sirve,
// la raya
const cuandoDelEventoDe = (evento) => {
  if (!esObjeto(evento) || !esFechaDeTexto(evento.fecha) || !esHoraDeTexto(evento.desde)) return '—';
  const dia = diaConFechaDe(evento.fecha);
  return esHoraDeTexto(evento.hasta) ? `${dia} de ${evento.desde} a ${evento.hasta}` : `${dia} a las ${evento.desde}`;
};
const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Los errores de un evento antes de pedir nada (`{ campo: mensaje }`, todos, en el orden del formulario; sin ninguno, {}), con los
 * controles y los mensajes de validarEvento (el primero es el suyo: test de paridad en sus bordes). `valores` tiene las claves del
 * cuerpo (titulo, fecha, desde, hasta, detalle, compartido, para_todos, personas y recordatorio): el título y el detalle recortados
 * y contados con Array.from; la fecha de FECHA_MINIMA_EVENTO a fechaMaximaEvento(hoy); las horas 'HH:MM' y la de fin, si viene,
 * después de la de inicio; compartido sin «Todos» (solo el true literal), con personas que sean ids (una lista que falta o vacía,
 * `personas`; un id que no sirve, `personasInvalidas`; los dos en `personas`); con «Todos», las personas no cuentan; y el
 * recordatorio (sin él, o null, 2 horas antes) de la lista. Quién puede compartir y que las personas sean de la lista, el servidor.
 */
function erroresDelEvento(valores, hoy) {
  const datos = esObjeto(valores) ? valores : {};
  const errores = {};
  const titulo = comoTexto(datos.titulo).trim();
  if (titulo === '') errores.titulo = MENSAJES_EVENTO.titulo;
  else if (Array.from(titulo).length > LARGO_TITULO_EVENTO) errores.titulo = MENSAJES_EVENTO.tituloLargo;
  const maxima = fechaMaximaEvento(hoy);
  if (!esFechaDeTexto(datos.fecha) || maxima === null || datos.fecha < FECHA_MINIMA_EVENTO || datos.fecha > maxima) {
    errores.fecha = textoRangoDelEvento(maxima);
  }
  if (!esHoraDeTexto(datos.desde)) errores.desde = MENSAJES_EVENTO.desde;
  const sinHasta = datos.hasta === undefined || datos.hasta === null || datos.hasta === '';
  if (!sinHasta && (!esHoraDeTexto(datos.hasta) || (esHoraDeTexto(datos.desde) && datos.hasta <= datos.desde))) {
    errores.hasta = MENSAJES_EVENTO.hasta;
  }
  if (Array.from(comoTexto(datos.detalle).trim()).length > LARGO_DETALLE_EVENTO) errores.detalle = MENSAJES_EVENTO.detalle;
  if (datos.compartido === true && datos.para_todos !== true) {
    if (!Array.isArray(datos.personas) || datos.personas.length === 0) errores.personas = MENSAJES_EVENTO.personas;
    else if (datos.personas.some((id) => idDeLaPersona(id) === null)) errores.personas = MENSAJES_EVENTO.personasInvalidas;
  }
  if (!RECORDATORIOS.includes(datos.recordatorio ?? RECORDATORIO_POR_DEFECTO)) errores.recordatorio = MENSAJES_EVENTO.recordatorio;
  return errores;
}

// ---- Lo de cada formulario ----

/**
 * Los valores del formulario del evento: los de un evento propio (un ítem de GET /mi-espacio/eventos, con `personas_ids`) o, sin él,
 * los de uno nuevo, con la `fecha` que se le pasa (hoy) y «2 horas antes». Las horas y el detalle, como texto ('' sin ellos);
 * `personas`, los ids elegidos ([] con «Todos»); `conocidas`, las personas del evento con su nombre (`{ id, nombre }`), así una
 * que ya no está en la lista para compartir (dejó de ser administración) se ve y no se saca sin querer.
 */
function valoresDelEvento(item, { fecha = '' } = {}) {
  if (!esObjeto(item)) {
    return {
      id: null, titulo: '', fecha: comoTexto(fecha), desde: '', hasta: '', detalle: '', compartido: false, para_todos: false,
      personas: [], conocidas: [], recordatorio: RECORDATORIO_POR_DEFECTO
    };
  }
  const nombres = Array.isArray(item.personas) ? item.personas : [];
  const conocidas = (Array.isArray(item.personas_ids) ? item.personas_ids : [])
    .map((id, i) => ({ id: idDeLaPersona(id), nombre: comoTexto(nombres[i]) })).filter((persona) => persona.id !== null);
  const compartido = item.compartido === true;
  const paraTodos = compartido && item.para_todos === true;
  return {
    id: item.id ?? null, titulo: comoTexto(item.titulo), fecha: comoTexto(item.fecha), desde: comoTexto(item.desde),
    hasta: comoTexto(item.hasta), detalle: comoTexto(item.detalle), compartido, para_todos: paraTodos,
    personas: paraTodos ? [] : conocidas.map((persona) => persona.id), conocidas,
    recordatorio: RECORDATORIOS.includes(item.recordatorio) ? item.recordatorio : RECORDATORIO_POR_DEFECTO
  };
}

/**
 * El cuerpo de POST /mi-espacio/eventos y PUT /mi-espacio/eventos/:id (el formulario entero): el título y el detalle recortados, la
 * fecha, las horas (sin hora de fin, null) y el recordatorio. Solo con `puedeCompartir` (administración; el true literal), además
 * `compartido`, `para_todos` (solo si es compartido) y `personas` (con «Todos» o sin compartir, []): el lector y el colaborador
 * tienen solo eventos personales, y su cuerpo no trae nada de eso.
 */
function cuerpoDelEvento(valores, { puedeCompartir = false } = {}) {
  const datos = esObjeto(valores) ? valores : {};
  const cuerpo = {
    titulo: comoTexto(datos.titulo).trim(), fecha: comoTexto(datos.fecha), desde: comoTexto(datos.desde),
    hasta: conTexto(datos.hasta) ? datos.hasta : null, detalle: comoTexto(datos.detalle).trim(), recordatorio: datos.recordatorio
  };
  if (puedeCompartir !== true) return cuerpo;
  const compartido = datos.compartido === true;
  const paraTodos = compartido && datos.para_todos === true;
  return {
    ...cuerpo, compartido, para_todos: paraTodos,
    personas: compartido && !paraTodos && Array.isArray(datos.personas) ? [...datos.personas] : []
  };
}

// Las personas para elegir: las de la lista para compartir (GET /mi-espacio/personas; null mientras llega o si no llegó) y, al
// final, las del evento que no están en ella (`valores.conocidas`)
function personasParaElegir(lista, valores) {
  const delServidor = listaDe(lista);
  const enLaLista = new Set(delServidor.map((persona) => idDeLaPersona(persona.id)));
  const delEvento = listaDe(esObjeto(valores) ? valores.conocidas : null)
    .filter((persona) => idDeLaPersona(persona.id) !== null && !enLaLista.has(idDeLaPersona(persona.id)));
  return [...delServidor, ...delEvento];
}

// El ícono de «Todos» (Lucide «users»), decorativo
const ICONO_DE_TODOS = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
  + '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const MENSAJE_SIN_PERSONAS = 'No se pudo cargar la lista de personas. Probá de nuevo en unos minutos.';

/**
 * Con quién se comparte: «Todos» primero (`data-persona="todos"`) y cada persona (`data-persona="<id>"`, con sus iniciales,
 * decorativas, y su nombre), botones con aria-pressed. Con «Todos» elegido, las demás van deshabilitadas (todos ya están). `sinLista`:
 * 'cargando' o 'fallo' dice por qué todavía no está la lista (las del evento y «Todos» se pueden elegir igual); con 'fallo', `motivo`
 * es el mensaje del servidor que lo explica (el 403 de un rol viejo en el navegador), escapado, y sin él, «Probá de nuevo…».
 */
function htmlDePersonasDelEvento(personas, valores, { sinLista = null, motivo = '' } = {}) {
  const datos = esObjeto(valores) ? valores : {};
  const paraTodos = datos.para_todos === true;
  const elegidas = Array.isArray(datos.personas) ? datos.personas : [];
  const botones = [`<button type="button" class="me-persona" data-persona="todos" aria-pressed="${String(paraTodos)}">`
    + `<i aria-hidden="true">${ICONO_DE_TODOS}</i>Todos</button>`];
  for (const persona of listaDe(personas)) {
    const id = idDeLaPersona(persona.id);
    if (id === null) continue;
    const sigla = conTexto(persona.iniciales) ? persona.iniciales : iniciales(persona.nombre);
    botones.push(`<button type="button" class="me-persona" data-persona="${String(id)}" `
      + `aria-pressed="${String(!paraTodos && elegidas.includes(id))}"${paraTodos ? ' disabled' : ''}>`
      + `<i aria-hidden="true">${esc(sigla)}</i>${esc(persona.nombre)}</button>`);
  }
  let estado = '';
  if (sinLista === 'cargando') estado = 'Cargando las personas…';
  else if (sinLista === 'fallo') estado = conTexto(motivo) ? esc(motivo) : MENSAJE_SIN_PERSONAS;
  return botones.join('') + (estado ? `<span class="me-personas-estado">${estado}</span>` : '');
}

// Un clic en una persona (`valor`: 'todos' o su id): «Todos» se prende o se apaga y saca a las elegidas (con «Todos» están todos);
// una persona se suma o se saca, salvo con «Todos». Devuelve los valores nuevos
function elegirPersona(valores, valor) {
  const datos = esObjeto(valores) ? valores : {};
  const personas = Array.isArray(datos.personas) ? datos.personas : [];
  if (valor === 'todos') return { ...datos, para_todos: datos.para_todos !== true, personas: [] };
  const id = idDeLaPersona(valor);
  if (id === null || datos.para_todos === true) return { ...datos, personas: [...personas] };
  return { ...datos, personas: personas.includes(id) ? personas.filter((otra) => otra !== id) : [...personas, id] };
}

// Cuántas personas eligió, al lado de «Con quién»: «(1 persona)», «(4 personas)»; sin ninguna o con «Todos», nada
function textoDeCuantasPersonas(valores) {
  const datos = esObjeto(valores) ? valores : {};
  const cuantas = Array.isArray(datos.personas) ? datos.personas.length : 0;
  if (datos.para_todos === true || cuantas === 0) return '';
  return `(${String(cuantas)} ${cuantas === 1 ? 'persona' : 'personas'})`;
}

// Los recordatorios, en el orden de RECORDATORIOS, con el elegido (uno que no es de la lista, el de entrada)
function htmlDeOpcionesDeRecordatorio(elegido) {
  const actual = RECORDATORIOS.includes(elegido) ? elegido : RECORDATORIO_POR_DEFECTO;
  return RECORDATORIOS.map((clave) => `<option value="${clave}"${clave === actual ? ' selected' : ''}>${esc(TEXTO_RECORDATORIO[clave])}</option>`)
    .join('');
}

// La ruta de GET /mi-espacio/eventos/aviso (cuándo sale el recordatorio, que calcula el servidor con los feriados) para la fecha, la
// hora y el recordatorio del formulario; sin una fecha o una hora que sirvan, o con «Sin aviso» (no hay nada que decir), null
function pedidoDelAviso(valores) {
  const { fecha, desde, recordatorio } = esObjeto(valores) ? valores : {};
  if (!esFechaDeTexto(fecha) || !esHoraDeTexto(desde) || !RECORDATORIOS.includes(recordatorio) || recordatorio === 'ninguno') return null;
  return `/mi-espacio/eventos/aviso?fecha=${encodeURIComponent(fecha)}&desde=${encodeURIComponent(desde)}`
    + `&recordatorio=${encodeURIComponent(recordatorio)}`;
}

// «Mi recordatorio» de un evento ajeno: 'evento' (el que eligió quien lo creó) o 'ninguno' (lo apagó, o quien lo creó eligió «Sin
// aviso»)
function miRecordatorioDe(item) {
  const datos = esObjeto(item) ? item : {};
  const conAviso = RECORDATORIOS.includes(datos.recordatorio) && datos.recordatorio !== 'ninguno';
  return conAviso && datos.mi_recordatorio !== 'ninguno' ? 'evento' : 'ninguno';
}

/**
 * El detalle de un evento ajeno (un ítem de GET /mi-espacio/eventos con `es_mio` false), cada parte en HTML escapado (el título va
 * con textContent): `cuando` («Jueves 29/10/2026 de 09:00 a 10:00»), `detalle` (el texto; los renglones los respeta el <style>),
 * `quien` (la insignia «Compartido» y el «Lo creó … Están: vos, …» del servidor) y `opciones`, las de «Mi recordatorio»: el que
 * eligió quien lo creó («2 horas antes (el que eligió Martín Ríos)») y «Sin aviso», con la elegida; si quien lo creó eligió «Sin
 * aviso», solo ese texto.
 */
function htmlDelEventoAjeno(item) {
  const datos = esObjeto(item) ? item : {};
  const cuando = cuandoDelEventoDe(datos);
  const elegido = miRecordatorioDe(datos);
  const conAviso = RECORDATORIOS.includes(datos.recordatorio) && datos.recordatorio !== 'ninguno';
  const textoDelEvento = conTexto(datos.recordatorio_texto) ? datos.recordatorio_texto : TEXTO_RECORDATORIO[datos.recordatorio] ?? '';
  const opcion = (valor, texto) => `<option value="${valor}"${valor === elegido ? ' selected' : ''}>${esc(texto)}</option>`;
  const opciones = conAviso
    ? opcion('evento', `${textoDelEvento}${conTexto(datos.creador) ? ` (el que eligió ${datos.creador})` : ''}`)
      + opcion('ninguno', TEXTO_RECORDATORIO.ninguno)
    : opcion('ninguno', conTexto(datos.recordatorio_texto) ? datos.recordatorio_texto : TEXTO_RECORDATORIO.ninguno);
  return {
    cuando: esc(cuando === '—' ? cuando : conMayuscula(cuando)),
    detalle: esc(comoTexto(datos.detalle)),
    quien: `<span class="me-insignia violeta">Compartido</span>${conTexto(datos.quien_largo) ? `<span>${esc(datos.quien_largo)}</span>` : ''}`,
    opciones
  };
}

/**
 * La confirmación del borrado de un evento propio, en texto plano (va con textContent): «¿Borrar «Reunión de equipo» del martes
 * 27/10/2026?» y, si es compartido, a quiénes les llega la cancelación: « A las 4 personas les llega un email que dice que se
 * canceló.», «A la persona…» o «A toda la administración…». Uno de antes de hoy (`hoy`) no la manda: el servidor no avisa de un
 * evento que ya empezó.
 */
function textoDeConfirmacionDeEvento(item, { hoy = '' } = {}) {
  const datos = esObjeto(item) ? item : {};
  const cuando = esFechaDeTexto(datos.fecha) ? ` del ${diaConFechaDe(datos.fecha)}` : '';
  const pregunta = `¿Borrar «${comoTexto(datos.titulo).trim()}»${cuando}?`;
  const yaPaso = esFechaDeTexto(hoy) && esFechaDeTexto(datos.fecha) && datos.fecha < hoy;
  if (datos.compartido !== true || yaPaso) return pregunta;
  const cancelacion = 'un email que dice que se canceló.';
  if (datos.para_todos === true) return `${pregunta} A toda la administración le llega ${cancelacion}`;
  const cuantas = Array.isArray(datos.personas) ? datos.personas.length : 0;
  if (cuantas === 0) return pregunta;
  return cuantas === 1 ? `${pregunta} A la persona le llega ${cancelacion}` : `${pregunta} A las ${String(cuantas)} personas les llega ${cancelacion}`;
}

// =====================================================
// La página (DOM y API)
// =====================================================

// Todos los roles con sesión la ven; sin sesión, al login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  iniciarMiEspacio();
});

// El estado de la página: el Resumen, la lista de licencias con su filtro, la tabla de horas extras con su mes y, en la agenda, el
// mes que se ve (`mesDeEventos`, 'AAAA-MM': de entrada, el de hoy; no va en la dirección), lo de su grilla (`delMes`) y los próximos
// (`proximos`) (null hasta que llegan, y después de una carga que falló). `pedidos` numera las cargas de cada pestaña (en la agenda,
// las del mes y las de los próximos): una respuesta que llega después de otra más nueva se descarta. `cargandoResumen`: hay un
// pedido del Resumen en vuelo. `bandaAnimada`: la banda del Resumen ya se movió (pasa una sola vez). Los formularios:
// `modales`, los abiertos, del de abajo al de arriba (la confirmación se abre sobre el formulario); `formulario`, el de «Cargar
// licencia» o del uso autorizado abierto; `horasExtras`, el de las horas extras; `saldos`, el de «Mis vacaciones y saldos»
// (`saldosAbiertosSolos`: ya se abrió solo una vez); `confirmacion`, el borrado que se confirma; y `firmante`, el pedido de
// GET /mi-espacio/firmante (una sola vez). El segundo paso de «Cargar licencia» (la licencia ya guardada, con la nota a la vista):
// `segundoPaso`, `{ id, corregida, avisos }` mientras se ve (si no, null), y `pedidos.nota` numera cada GET …/nota (también al
// cerrar: la respuesta que llega con el modal cerrado o después de otro guardado se descarta). La agenda: `evento`, el formulario
// del evento abierto (su propio estado: el cálculo de las licencias mira `formulario`, y no se tienen que cruzar); `eventoAjeno`,
// el detalle de un evento de otra persona; y `personas`, el pedido de GET /mi-espacio/personas (una sola vez, y solo para
// administración). La planilla de horas extras de contrato: `planilla`, su propio estado mientras está abierta (ver abrirPlanilla;
// si no, null)
const pagina = {
  pestana: PESTANAS[0], resumen: null, licencias: null, filtro: 'todas', horas: null, mes: null, bandaAnimada: false,
  mesDeEventos: null, delMes: null, proximos: null,
  cargandoResumen: false, pedidos: { resumen: 0, licencias: 0, horas: 0, mes: 0, proximos: 0, nota: 0 },
  modales: [], formulario: null, horasExtras: null, saldos: null, saldosAbiertosSolos: false, confirmacion: null, firmante: null,
  segundoPaso: null, evento: null, eventoAjeno: null, personas: null, planilla: null
};

const porId = (id) => document.getElementById(id);

// La región viva de la página (#me-anuncio, fuera de lo que se vuelve a dibujar). Un texto igual al anterior se cambia apenas (un
// espacio duro al final), para que se vuelva a anunciar
function anunciar(texto) {
  const region = porId('me-anuncio');
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto} ` : texto;
}

// Un aviso de la página, como en Áreas, Feriados y Proyectos: el toast de main.js (showToast inserta HTML: se escapa) y, como el
// toast no se anuncia, lo mismo en #me-anuncio. `tipo`: 'success', 'error' o 'warning'
function avisarMiEspacio(texto, tipo) {
  if (!conTexto(texto)) return;
  if (typeof showToast === 'function') showToast(esc(texto), tipo);
  anunciar(texto);
}

// Lo que se dice cuando un formulario no se puede abrir
const MENSAJE_SIN_RESUMEN = 'No se pudo abrir el formulario: no se pudo cargar el resumen. Probá de nuevo en unos minutos.';
const MENSAJE_SIN_SALDOS = 'No se pudo abrir «Mis vacaciones y saldos». Probá de nuevo en unos minutos.';

// La sesión venció (401): se cierra y al login
function irAlLogin() {
  if (typeof Auth.clearSession === 'function') Auth.clearSession();
  window.location.href = 'login.html';
}

// Lo que no se pudo cargar, en su pestaña y, si se pide, anunciado
function mostrarFalla(vista, texto, conAnuncio = true) {
  porId(vista).innerHTML = htmlDeError(texto);
  if (conAnuncio) anunciar(texto);
}

// Los controles de una pestaña con ese atributo y ese valor (en la agenda, un evento está en la grilla y en los próximos), y el
// primero, o null
const controlesCon = (vista, atributo, valor) =>
  [...porId(vista).querySelectorAll(`[${atributo}]`)].filter((uno) => uno.getAttribute(atributo) === valor);
const controlCon = (vista, atributo, valor) => controlesCon(vista, atributo, valor)[0] ?? null;

// Después de volver a dibujar una pestaña, el foco va al control equivalente al que se usó (el botón viejo ya no está)
function enfocar(vista, atributo, valor) {
  controlCon(vista, atributo, valor)?.focus();
}

// Abre la pestaña de la dirección y pide el Resumen (primero: la pestaña Resumen no lo pide dos veces). Devuelve las cargas, para
// quien quiera esperarlas
function iniciarMiEspacio() {
  conectarEventos();
  const resumen = cargarResumen();
  const cargas = Promise.all([mostrarPestana(pestanaDeHash(window.location.hash)), resumen]);
  // Las fuentes llegan después y ensanchan las pestañas: la elegida se vuelve a llevar a la vista
  document.fonts?.ready?.then?.(() => llevarALaVista(porId(`tab-${pagina.pestana}`)));
  return cargas;
}

function conectarEventos() {
  for (const nombre of PESTANAS) {
    const pestana = porId(`tab-${nombre}`);
    pestana.addEventListener('click', () => mostrarPestana(nombre));
    pestana.addEventListener('keydown', teclaEnPestanas);
  }
  window.addEventListener?.('hashchange', () => mostrarPestana(pestanaDeHash(window.location.hash)));
  porId('vista-resumen').addEventListener('click', alTocarResumen);
  porId('vista-licencias').addEventListener('click', alTocarLicencias);
  porId('vista-horas').addEventListener('click', alTocarHoras);
  porId('vista-agenda').addEventListener('click', alTocarEventos);
  porId('btn-cargar-licencia').addEventListener('click', (evento) => abrirLicencia({ volverA: evento.currentTarget }));
  porId('btn-cargar-horas').addEventListener('click', (evento) => abrirCargaDeHoras({ volverA: evento.currentTarget }));
  porId('btn-nuevo-evento').addEventListener('click', (evento) => abrirEvento({ volverA: evento.currentTarget }));
  conectarFormularios();
}

// ---- Las pestañas ----

// Muestra una pestaña, la escribe en la dirección (replaceState: no suma pasos al botón Atrás) y, la primera vez (o después de una
// carga que falló), pide sus datos. Devuelve la carga
function mostrarPestana(nombre) {
  pagina.pestana = PESTANAS.includes(nombre) ? nombre : PESTANAS[0];
  for (const otra of PESTANAS) {
    const activa = otra === pagina.pestana;
    const pestana = porId(`tab-${otra}`);
    pestana.setAttribute('aria-selected', String(activa));
    pestana.tabIndex = activa ? 0 : -1;
    porId(`vista-${otra}`).hidden = !activa;
  }
  llevarALaVista(porId(`tab-${pagina.pestana}`));
  window.history?.replaceState?.(null, '', `#${pagina.pestana}`);
  if (pagina.pestana === 'resumen') {
    if (pagina.resumen === null && !pagina.cargandoResumen) return cargarResumen();
    animarLaBanda();
  }
  if (pagina.pestana === 'licencias' && pagina.licencias === null) return cargarLicencias(null);
  if (pagina.pestana === 'horas' && pagina.horas === null) return cargarHorasExtras(null);
  if (pagina.pestana === 'agenda' && (pagina.delMes === null || pagina.proximos === null)) return cargarEventos();
  return Promise.resolve();
}

// En el teléfono no entran las cuatro pestañas y la barra se desplaza de costado: la elegida se lleva a la vista (al abrir con
// #agenda, por ejemplo desde un email), moviendo solo la barra, nunca la página
function llevarALaVista(pestana) {
  const barra = pestana?.parentNode;
  const caja = pestana?.getBoundingClientRect?.();
  const marco = barra?.getBoundingClientRect?.();
  if (!caja || !marco || typeof barra.scrollLeft !== 'number') return;
  if (caja.right > marco.right) barra.scrollLeft += caja.right - marco.right;
  else if (caja.left < marco.left) barra.scrollLeft -= marco.left - caja.left;
}

// Teclado en la barra: flechas (con vuelta), Inicio y Fin. Mueven el foco y activan la pestaña. Con Alt, Ctrl o Cmd son atajos del
// navegador: no se tocan
function teclaEnPestanas(evento) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const actual = PESTANAS.indexOf(evento.target?.dataset?.pestana);
  if (actual === -1) return;
  const ultima = PESTANAS.length - 1;
  let destino;
  if (evento.key === 'ArrowRight') destino = actual === ultima ? 0 : actual + 1;
  else if (evento.key === 'ArrowLeft') destino = actual === 0 ? ultima : actual - 1;
  else if (evento.key === 'Home') destino = 0;
  else if (evento.key === 'End') destino = ultima;
  else return;
  evento.preventDefault?.();
  mostrarPestana(PESTANAS[destino]);
  porId(`tab-${PESTANAS[destino]}`).focus();
}

// ---- El Resumen ----

// El Resumen dice la modalidad: sin ella, no se carga nada (los botones del encabezado quedan ocultos) y la pestaña muestra el
// mensaje; con ella y sin el saldo inicial, invita a completar «Mis vacaciones y saldos» y lo abre solo (una vez); si no,
// «Titular», con la marca en la pestaña si algo vence pronto. Si falla, volver a la pestaña lo pide otra vez
async function cargarResumen() {
  const pedido = ++pagina.pedidos.resumen;
  pagina.cargandoResumen = true;
  try {
    const { data } = await API.pedirJson('GET', '/mi-espacio/resumen');
    if (pedido !== pagina.pedidos.resumen) return;
    pagina.resumen = esObjeto(data) ? data : {};
    pintarResumen();
  } catch (error) {
    if (pedido !== pagina.pedidos.resumen) return;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.resumen = null;
      mostrarFalla('vista-resumen', 'No se pudo cargar el resumen. Probá de nuevo en unos minutos.');
    }
  } finally {
    if (pedido === pagina.pedidos.resumen) pagina.cargandoResumen = false;
  }
}

function pintarResumen() {
  const { resumen } = pagina;
  const conModalidad = esObjeto(resumen.modalidad);
  porId('btn-cargar-horas').hidden = !conModalidad;
  porId('btn-cargar-licencia').hidden = !conModalidad;
  const vista = porId('vista-resumen');
  // Un Resumen que se vuelve a dibujar (por ejemplo, al guardar una licencia) llega quieto, aunque la banda vieja todavía se
  // estuviera moviendo: sin data-animar, sus tramos y sus líneas se dibujan llenos
  vista.removeAttribute('data-animar');
  vista.innerHTML = htmlDelResumen(resumen);
  porId('me-marca').innerHTML = htmlDeMarca(resumen.marca);
  // La primera vez que la banda se dibuja y se ve, se mueve (una sola vez)
  animarLaBanda();
  // La primera vez, sin el saldo inicial, «Mis vacaciones y saldos» se abre solo (el foco vuelve a su botón del Resumen)
  if (conModalidad && resumen.abrir_saldos === true && !pagina.saldosAbiertosSolos && pagina.modales.length === 0) {
    pagina.saldosAbiertosSolos = true;
    abrirSaldos(vista.querySelector('[data-abrir="saldos"]'));
  }
}

// El único movimiento de la página (spec 2026-10-27-mi-espacio-resumen, 3), una sola vez por carga: la primera vez que la banda
// está dibujada y se ve (también si aparece recién al guardar «Mis vacaciones y saldos», desde la invitación). Le pone data-animar
// a #vista-resumen, que en el <style> deja vacíos los tramos de la regla y las líneas del resto, y se lo saca dos cuadros después:
// en el primero el navegador los dibuja vacíos y en el segundo empiezan las transiciones, cada una con su --demora y su --duracion
// (quietas con prefers-reduced-motion). Al mismo tiempo suben los números: el de la frase con la regla y cada uno del resto con su
// línea. Con el Resumen oculto (se abrió otra pestaña), espera a que se vea (mostrarPestana); sin requestAnimationFrame no hace
// nada: todo queda en su valor final
function animarLaBanda() {
  const vista = porId('vista-resumen');
  if (pagina.bandaAnimada || vista.hidden || !vista.querySelector('.me-banda')) return;
  if (typeof window.requestAnimationFrame !== 'function') return;
  pagina.bandaAnimada = true;
  vista.setAttribute('data-animar', '');
  const cifra = vista.querySelector('.me-cifra [data-contar]');
  if (cifra) contarHasta(cifra, DEMORA_DE_LA_REGLA, DURACION_DE_LA_REGLA);
  for (const numero of vista.querySelectorAll('.me-resto .me-numero')) {
    const contador = numero.querySelector('[data-contar]');
    if (contador) contarHasta(contador, demoraDelEstilo(numero.querySelector('.me-linea i')?.getAttribute('style')), DURACION_DE_LA_LINEA);
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => vista.removeAttribute('data-animar')));
}

// La persona pidió menos movimiento (prefers-reduced-motion: reduce). Sin matchMedia, no
const menosMovimiento = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)')?.matches === true;

// Un número que sube al abrir (data-contar). Lee el valor final del texto que dejó el HTML ('33'; con coma: '1,5'), escribe 0 y lo
// sube con los tiempos de requestAnimationFrame: espera `demoraMs` desde el primer cuadro y dura `duracionMs`, rápido al principio
// y despacio al final, en enteros (nunca más que el final) hasta el último cuadro, que deja el texto final tal cual. Un cuadro sin
// tiempo escribe el final. Si el número ya no está en el documento (el Resumen se volvió a dibujar), se detiene sin escribir nada.
// No cuenta lo que no es un número mayor que 0 (un 0 queda en 0), ni sin requestAnimationFrame, ni con prefers-reduced-motion:
// reduce (spec, 3: nada se mueve). Lo que lee un lector de pantalla no cambia: el número que sube va con aria-hidden
function contarHasta(elemento, demoraMs, duracionMs) {
  const final = elemento.textContent;
  const hasta = numeroDelTexto(final);
  if (hasta === null || hasta <= 0 || typeof window.requestAnimationFrame !== 'function' || menosMovimiento()) return;
  const demora = Number.isFinite(demoraMs) && demoraMs > 0 ? demoraMs : 0;
  const duracion = Number.isFinite(duracionMs) && duracionMs > 0 ? duracionMs : 0;
  let inicio = null;
  const paso = (tiempo) => {
    if (!elemento.isConnected) return;
    if (typeof tiempo !== 'number' || !Number.isFinite(tiempo)) {
      elemento.textContent = final;
      return;
    }
    inicio ??= tiempo;
    const transcurrido = tiempo - inicio - demora;
    let avance = 0;
    if (transcurrido > 0) avance = duracion > 0 ? Math.min(1, transcurrido / duracion) : 1;
    if (avance >= 1) {
      elemento.textContent = final;
      return;
    }
    elemento.textContent = String(Math.floor(hasta * (1 - (1 - avance) ** 3)));
    window.requestAnimationFrame(paso);
  };
  elemento.textContent = '0';
  window.requestAnimationFrame(paso);
}

// Un clic en el Resumen: «Mis vacaciones y saldos» y los botones de «Vence pronto» abren su formulario (el de licencia, con su
// tipo); un número del resto (y «Ver la agenda») abre su pestaña y el foco va a la pestaña (con Ctrl, Cmd, Mayúsculas, Alt o un
// botón que no es el principal, el link hace lo suyo: otra pestaña del navegador)
function alTocarResumen(evento) {
  const saldos = evento.target?.closest?.('[data-abrir="saldos"]');
  if (saldos) {
    abrirSaldos(saldos);
    return;
  }
  const accion = evento.target?.closest?.('[data-accion="cargar-licencia"]');
  if (accion) {
    abrirLicencia({ tipo: accion.dataset.tipo, volverA: accion });
    return;
  }
  const destino = evento.target?.closest?.('[data-pestana]');
  if (!destino || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey || (evento.button ?? 0) !== 0) return;
  evento.preventDefault?.();
  mostrarPestana(destino.dataset.pestana);
  porId(`tab-${pagina.pestana}`).focus();
}

// ---- Licencias ----

// Pide las licencias de un año (null: el en curso). Al elegir un año, se anuncia el título de la tarjeta (`conAnuncio`: después de
// guardar, no; ahí se anuncia lo que se guardó). Si falla, la pestaña lo dice y queda sin lista: volver a ella la pide otra vez (la
// del año en curso). Devuelve si dibujó la lista (una respuesta vieja o una falla, no)
async function cargarLicencias(anio, { conAnuncio = true } = {}) {
  const pedido = ++pagina.pedidos.licencias;
  try {
    const { data } = await API.pedirJson('GET', Number.isInteger(anio) ? `/mi-espacio/licencias?anio=${anio}` : '/mi-espacio/licencias');
    if (pedido !== pagina.pedidos.licencias) return false;
    pagina.licencias = esObjeto(data) ? data : {};
    pintarLicencias();
    if (conAnuncio && Number.isInteger(anio) && Number.isInteger(pagina.licencias.anio)) anunciar(`Mis licencias de ${pagina.licencias.anio}`);
    return true;
  } catch (error) {
    if (pedido !== pagina.pedidos.licencias) return false;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.licencias = null;
      mostrarFalla('vista-licencias', 'No se pudieron cargar tus licencias. Probá de nuevo en unos minutos.', conAnuncio);
    }
    return false;
  }
}

function pintarLicencias() {
  porId('vista-licencias').innerHTML = htmlDeListaDeLicencias(pagina.licencias, pagina.filtro);
}

// ---- La nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word, 6) ----

// Descarga un Blob con ese nombre de archivo y libera su URL (copiado de correos.js)
const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// El Word de una licencia (GET /mi-espacio/licencias/:id/word), con el token en el encabezado: `{ blob, nombre }`, con el nombre
// del Content-Disposition (null si no viene). Es local, como pedirWord de notas.js, porque API.pedirArchivo no da el estado ni los
// encabezados (api.js no cambia). Si el servidor responde un error, tira un Error con su `status` (401: la sesión venció) y su
// mensaje ('' si no trae uno)
async function pedirWordDeLicencia(id) {
  const response = await fetch(`${CONFIG.API_URL}/mi-espacio/licencias/${encodeURIComponent(id)}/word`, {
    method: 'GET',
    headers: Auth.getAuthHeaders()
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(esObjeto(data) && conTexto(data.error) ? data.error : '');
    error.status = response.status;
    throw error;
  }
  return { blob: await response.blob(), nombre: nombreDelAdjunto(response.headers?.get?.('content-disposition') ?? null) };
}

/**
 * «Word» de una fila de la lista (y «Descargar Word» del segundo paso del modal): baja la nota de la licencia `id` con el nombre que
 * da el servidor (o NOMBRE_DEL_WORD_POR_DEFECTO). Mientras baja, `boton` queda deshabilitado (un segundo clic no pide nada) y, si
 * tenía el foco y se perdió mientras tanto (deshabilitado, el navegador lo suelta a <body>), lo recupera al terminar; si la persona
 * lo llevó a otro lado (otro control, o el modal que abrió o cerró mientras bajaba), ahí queda. Con un 401, al login; con otro
 * error, el aviso con el mensaje del servidor (el 409 de una licencia sin días hábiles) o, sin mensaje (o sin respuesta),
 * MENSAJE_SIN_DESCARGA
 */
async function bajarWordDeLicencia(id, boton) {
  if (boton?.disabled) return;
  const teniaElFoco = Boolean(boton) && document.activeElement === boton;
  if (boton) boton.disabled = true;
  let falla = null;
  try {
    const { blob, nombre } = await pedirWordDeLicencia(id);
    descargarBlob(blob, conTexto(nombre) ? nombre : NOMBRE_DEL_WORD_POR_DEFECTO);
  } catch (error) {
    falla = error ?? new Error('');
  }
  if (boton) boton.disabled = false;
  if (falla?.status === 401) {
    irAlLogin();
    return;
  }
  const activo = document.activeElement;
  if (teniaElFoco && (!activo || activo === document.body)) boton.focus?.();
  if (falla) avisarMiEspacio(Number.isInteger(falla.status) && conTexto(falla.message) ? falla.message : MENSAJE_SIN_DESCARGA, 'error');
}

// Un clic en la pestaña: «Cargar licencia», «Word» o «Editar» de una fila, «Cambiar» el saldo inicial, un año del selector (el
// elegido no pide nada) o un filtro (dibuja sin pedir nada)
async function alTocarLicencias(evento) {
  const objetivo = evento.target;
  if (objetivo?.closest?.('[data-cargar="licencia"]')) {
    abrirLicencia({ volverA: objetivo.closest('[data-cargar="licencia"]') });
    return;
  }
  const word = objetivo?.closest?.('[data-word-licencia]');
  if (word) {
    await bajarWordDeLicencia(word.dataset.wordLicencia, word);
    return;
  }
  const editar = objetivo?.closest?.('[data-editar-licencia]');
  if (editar) {
    const fila = listaDe(pagina.licencias?.licencias).find((una) => String(una.id) === editar.dataset.editarLicencia);
    if (fila) abrirLicencia({ fila, volverA: editar });
    return;
  }
  const saldos = objetivo?.closest?.('[data-abrir="saldos"]');
  if (saldos) {
    abrirSaldos(saldos);
    return;
  }
  const anio = objetivo?.closest?.('[data-anio]');
  if (anio) {
    if (anio.getAttribute('aria-pressed') === 'true') return;
    if (await cargarLicencias(Number(anio.dataset.anio))) enfocar('vista-licencias', 'data-anio', anio.dataset.anio);
    return;
  }
  const filtro = objetivo?.closest?.('[data-filtro-licencia]');
  if (filtro) {
    pagina.filtro = filtro.dataset.filtroLicencia;
    pintarLicencias();
    enfocar('vista-licencias', 'data-filtro-licencia', pagina.filtro);
  }
}

// ---- Horas extras ----

// Pide las horas extras de un año (null: el en curso); el día por día vuelve al mes de entrada o, con `mes` (la recarga después
// de guardar), sigue en ese mes si está en la tabla. Si falla, como las licencias: volver a la pestaña la pide otra vez.
// Devuelve si dibujó la pestaña
async function cargarHorasExtras(anio, { conAnuncio = true, mes = null } = {}) {
  const pedido = ++pagina.pedidos.horas;
  try {
    const { data } = await API.pedirJson('GET', Number.isInteger(anio) ? `/mi-espacio/horas-extras?anio=${anio}` : '/mi-espacio/horas-extras');
    if (pedido !== pagina.pedidos.horas) return false;
    pagina.horas = esObjeto(data) ? data : {};
    pagina.mes = mesDeLaTabla(pagina.horas, mes);
    pintarHoras();
    if (conAnuncio && Number.isInteger(anio) && Number.isInteger(pagina.horas.anio)) anunciar(`Horas extras de ${pagina.horas.anio}`);
    return true;
  } catch (error) {
    if (pedido !== pagina.pedidos.horas) return false;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.horas = null;
      pagina.mes = null;
      mostrarFalla('vista-horas', 'No se pudieron cargar tus horas extras. Probá de nuevo en unos minutos.', conAnuncio);
    }
    return false;
  }
}

function pintarHoras() {
  porId('vista-horas').innerHTML = htmlDeHorasExtras(pagina.horas, pagina.mes);
}

// Un clic en la pestaña: «Cargar horas extras» (en contrato, la planilla), «Editar» de un día (en contrato, la planilla en ese día),
// «Registrar un uso autorizado», un año del selector o un mes de la tabla (cambia el día por día sin pedir nada)
async function alTocarHoras(evento) {
  const objetivo = evento.target;
  if (objetivo?.closest?.('[data-cargar="horas"]')) {
    abrirCargaDeHoras({ volverA: objetivo.closest('[data-cargar="horas"]') });
    return;
  }
  const salida = objetivo?.closest?.('[data-editar-salida]');
  if (salida) {
    const fecha = salida.getAttribute('data-editar-salida');
    if (esFechaDeTexto(fecha)) abrirPlanilla({ mes: fecha.slice(0, 7), fecha, volverA: salida });
    return;
  }
  const editar = objetivo?.closest?.('[data-editar-horas]');
  if (editar) {
    const dia = Object.values(esObjeto(pagina.horas?.dias_por_mes) ? pagina.horas.dias_por_mes : {}).flatMap(listaDe)
      .find((uno) => String(uno.id) === editar.dataset.editarHoras);
    if (dia) abrirHorasExtras({ dia, volverA: editar });
    return;
  }
  const uso = objetivo?.closest?.('[data-abrir="uso"]');
  if (uso) {
    abrirUso({ volverA: uso });
    return;
  }
  const anio = objetivo?.closest?.('[data-anio]');
  if (anio) {
    if (anio.getAttribute('aria-pressed') === 'true') return;
    if (await cargarHorasExtras(Number(anio.dataset.anio))) enfocar('vista-horas', 'data-anio', anio.dataset.anio);
    return;
  }
  const mes = objetivo?.closest?.('[data-mes]');
  if (mes) {
    pagina.mes = mes.dataset.mes;
    pintarHoras();
    enfocar('vista-horas', 'data-mes', pagina.mes);
  }
}

// ---- La agenda ----

// Lo que se dice cuando no llega el mes o los próximos (en su lugar de la pestaña y en #me-anuncio)
const MENSAJE_SIN_MES = 'No se pudo cargar el mes. Probá de nuevo en unos minutos.';
const MENSAJE_SIN_PROXIMOS = 'No se pudieron cargar los próximos. Probá de nuevo en unos minutos.';

// GET /mi-espacio/eventos de un rango `{ desde, hasta }`
const rutaDeEventos = ({ desde, hasta }) => `/mi-espacio/eventos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;

// La pestaña Agenda: pide lo de la grilla del mes que se ve (de entrada, el de hoy) y los próximos, dos GET /mi-espacio/eventos, los
// que todavía no llegaron o, con `forzar` (después de guardar o de borrar), los dos, sin borrar lo que se ve mientras. `conAnuncio`:
// una falla se anuncia (después de guardar, no). Devuelve las cargas
function cargarEventos({ forzar = false, conAnuncio = true } = {}) {
  if (!esMesDeTexto(pagina.mesDeEventos)) pagina.mesDeEventos = Utils.hoyEnArgentina().slice(0, 7);
  const cargas = [];
  if (forzar || pagina.delMes === null) cargas.push(cargarMesDeEventos(pagina.mesDeEventos, { conAnuncio }));
  if (forzar || pagina.proximos === null) cargas.push(cargarProximos({ conAnuncio }));
  return Promise.all(cargas);
}

// Pide lo de la grilla de un mes y lo dibuja; mientras, sin nada de antes, la grilla vacía con su título. Una respuesta vieja (de otro
// mes o de un pedido anterior) se descarta. `anunciarElMes`: al cambiar de mes, su título se anuncia cuando llega. Si falla, la
// grilla lo dice y queda sin datos: volver a la pestaña lo pide otra vez
async function cargarMesDeEventos(mes, { conAnuncio = true, anunciarElMes = false } = {}) {
  const rango = rangoDeLaGrilla(mes);
  if (rango === null) return;
  const pedido = ++pagina.pedidos.mes;
  if (pagina.delMes === null) pintarMesDeEventos();
  try {
    const { data } = await API.pedirJson('GET', rutaDeEventos(rango));
    if (pedido !== pagina.pedidos.mes) return;
    pagina.delMes = esObjeto(data) ? data : {};
    pintarMesDeEventos();
    if (anunciarElMes) anunciar(tituloDelMes(mes));
  } catch (error) {
    if (pedido !== pagina.pedidos.mes) return;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.delMes = null;
      mostrarFalla('ag-mes', MENSAJE_SIN_MES, conAnuncio);
    }
  }
}

// El título y la grilla del mes que se ve. «Compañeros que no están», en la leyenda, solo para quien los ve (decisión del usuario,
// 27/10/2026): lo dice el servidor (`puede_compartir`, administración) y, hasta que llega, queda oculto
function pintarMesDeEventos() {
  porId('ag-mes-titulo').textContent = tituloDelMes(pagina.mesDeEventos);
  porId('ag-mes').innerHTML = htmlDelMes(pagina.mesDeEventos, pagina.delMes, Utils.hoyEnArgentina());
  if (esObjeto(pagina.delMes)) porId('ag-leyenda-ausentes').hidden = pagina.delMes.puede_compartir !== true;
}

// Muestra otro mes («‹», «›» y «Hoy»): el título y la grilla vacía enseguida, y lo de la grilla cuando llega
function mostrarMesDeEventos(mes) {
  if (!esMesDeTexto(mes)) return Promise.resolve();
  pagina.mesDeEventos = mes;
  pagina.delMes = null;
  return cargarMesDeEventos(mes, { anunciarElMes: true });
}

// Pide los próximos (de hoy a hoy + 30) y los dibuja; si falla, como el mes
async function cargarProximos({ conAnuncio = true } = {}) {
  const rango = rangoDeProximos(Utils.hoyEnArgentina());
  if (rango === null) return;
  const pedido = ++pagina.pedidos.proximos;
  try {
    const { data } = await API.pedirJson('GET', rutaDeEventos(rango));
    if (pedido !== pagina.pedidos.proximos) return;
    pagina.proximos = esObjeto(data) ? data : {};
    pintarProximos();
  } catch (error) {
    if (pedido !== pagina.pedidos.proximos) return;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.proximos = null;
      mostrarFalla('ag-proximos', MENSAJE_SIN_PROXIMOS, conAnuncio);
    }
  }
}

function pintarProximos() {
  porId('ag-proximos').innerHTML = htmlDeProximos(gruposDeProximos(pagina.proximos, Utils.hoyEnArgentina()));
}

// «y N más»: muestra el resto en su celda, se va y el foco pasa a lo primero que apareció (un texto lo recibe con tabindex="-1")
function verElResto(boton) {
  const resto = boton.closest('.me-celda')?.querySelector('.me-resto');
  if (!resto) return;
  resto.hidden = false;
  const primero = resto.querySelector('.me-ev');
  if (primero && String(primero.tagName).toLowerCase() !== 'button') primero.setAttribute('tabindex', '-1');
  primero?.focus?.();
  boton.hidden = true;
}

// Un evento de la grilla o de los próximos (el botón con su data-evento): el ítem de lo que llegó, buscado primero en lo del mismo
// lugar (los próximos o el mes), o null
function eventoDelBoton(boton) {
  const id = boton.getAttribute('data-evento');
  const delMes = listaDe(pagina.delMes?.eventos);
  const proximos = listaDe(pagina.proximos?.eventos);
  const enOrden = porId('ag-proximos')?.contains?.(boton) ? [...proximos, ...delMes] : [...delMes, ...proximos];
  return enOrden.find((item) => String(item.id) === id) ?? null;
}

// Un clic en la pestaña: «‹» y «›» (el mes anterior o el siguiente), «Hoy» (el mes de hoy; si ya se ve y llegó, nada), «Nuevo
// evento», un evento (el propio abre su formulario; el de otra persona, su detalle) y «y N más»
function alTocarEventos(evento) {
  const objetivo = evento.target;
  const nuevo = objetivo?.closest?.('#ag-nuevo-evento');
  if (nuevo) {
    abrirEvento({ volverA: nuevo });
    return;
  }
  const deUnEvento = objetivo?.closest?.('[data-evento]');
  if (deUnEvento) {
    const item = eventoDelBoton(deUnEvento);
    if (item?.es_mio === true) abrirEvento({ item, volverA: deUnEvento });
    else if (item) abrirEventoAjeno({ item, volverA: deUnEvento });
    return;
  }
  if (objetivo?.closest?.('#ag-anterior')) {
    mostrarMesDeEventos(mesVecino(pagina.mesDeEventos, -1));
    return;
  }
  if (objetivo?.closest?.('#ag-siguiente')) {
    mostrarMesDeEventos(mesVecino(pagina.mesDeEventos, 1));
    return;
  }
  if (objetivo?.closest?.('#ag-hoy')) {
    const deHoy = Utils.hoyEnArgentina().slice(0, 7);
    if (deHoy !== pagina.mesDeEventos || pagina.delMes === null) mostrarMesDeEventos(deHoy);
    return;
  }
  const verMas = objetivo?.closest?.('[data-ver-mas]');
  if (verMas) verElResto(verMas);
}

// =====================================================
// Los formularios (DOM y API)
// =====================================================

// La espera entre el último cambio y el pedido del cálculo, y la del velo antes de poner el foco (hasta que termina su transición,
// no deja enfocar)
const ESPERA_DEL_CALCULO = 300;
const ESPERA_DEL_VELO = 100;

// Cada formulario: su modal, el prefijo de sus ids (el error sin campo es <prefijo>-error) y el control de cada campo de los errores
// del servidor
const FORMULARIOS = Object.freeze({
  licencia: {
    modal: 'modal-licencia', prefijo: 'ml',
    campos: {
      tipo: 'ml-tipos', desde: 'ml-desde', hasta: 'ml-hasta', horas: 'ml-horas', nota: 'ml-nota', autorizado_id: 'ml-autorizado'
    }
  },
  uso: {
    modal: 'modal-uso', prefijo: 'mu',
    campos: { desde: 'mu-fecha', hasta: 'mu-fecha', horas: 'mu-horas', nota: 'mu-nota' }
  },
  horasExtras: {
    modal: 'modal-horas', prefijo: 'mh', campos: { fecha: 'mh-fecha', desde: 'mh-desde', hasta: 'mh-hasta', nota: 'mh-nota' }
  },
  // La planilla de contrato: sus errores van en cada día (los dibuja htmlDeLaPlanilla); el resto, en #mp-error
  planilla: { modal: 'modal-planilla', prefijo: 'mp', campos: {} },
  saldos: { modal: 'modal-saldos', prefijo: 'ms', campos: { dias_vacaciones: 'ms-dias', estudios: 'ms-estudios' } },
  // La agenda: el formulario del evento (`compartido`, el permiso, no tiene control: va arriba del modal) y el detalle de uno ajeno
  // (todo lo que falla, en #mea-error)
  evento: {
    modal: 'modal-evento', prefijo: 'ev',
    campos: {
      titulo: 'ev-titulo', fecha: 'ev-fecha', desde: 'ev-desde', hasta: 'ev-hasta', detalle: 'ev-detalle', personas: 'ev-personas',
      recordatorio: 'ev-recordatorio'
    }
  },
  eventoAjeno: { modal: 'modal-evento-ajeno', prefijo: 'mea', campos: {} },
  confirmar: { modal: 'modal-confirmar', prefijo: 'mc', campos: {} }
});

// La modalidad de la persona ('planta', 'contrato' o null), la del Resumen
const modalidadActual = () => pagina.resumen?.modalidad?.clave ?? pagina.horas?.modalidad ?? null;
const anioDeHoy = () => Number(Utils.hoyEnArgentina().slice(0, 4));

function conectarFormularios() {
  for (const { modal } of Object.values(FORMULARIOS)) {
    // Cierran la × y «Cancelar» (data-cerrar), si es el de arriba y no está guardando (la planilla, preguntando si tiene cambios);
    // un clic en el velo, nunca
    porId(modal).addEventListener('click', (evento) => {
      const cerrar = evento.target?.closest?.('[data-cerrar]');
      if (cerrar && pagina.modales.at(-1)?.id === modal && !estaOcupado(modal)) pedirCerrarModal(modal, cerrar);
    });
  }
  document.addEventListener('keydown', alApretarUnaTecla);

  porId('ml-tipos').addEventListener('change', (evento) => {
    if (evento.target?.name !== 'ml-tipo' || !pagina.formulario) return;
    pagina.formulario.tipo = evento.target.value;
    pintarCamposDelTipo();
    programarCalculo();
  });
  for (const id of ['ml-desde', 'ml-hasta', 'mu-fecha']) {
    porId(id).addEventListener('input', programarCalculo);
    porId(id).addEventListener('change', programarCalculo);
  }
  for (const id of ['ml-horas', 'mu-horas']) {
    porId(id).addEventListener('change', () => {
      pintarMostrar();
      programarCalculo();
    });
  }
  porId('ml-autorizado').addEventListener('change', () => { if (pagina.formulario) pintarPaso(pagina.formulario); });
  for (const nombre of ['licencia', 'uso']) {
    const { prefijo } = FORMULARIOS[nombre];
    porId(`${prefijo}-guardar`).addEventListener('click', () => guardarLicencia(nombre));
    porId(`${prefijo}-borrar`).addEventListener('click', () => pedirBorrarLicencia(nombre));
  }
  // «Descargar Word» del segundo paso: la nota de la licencia guardada, por el mismo camino que «Word» de la lista
  porId('ml-descargar-word').addEventListener('click', () => {
    if (pagina.segundoPaso) bajarWordDeLicencia(pagina.segundoPaso.id, porId('ml-descargar-word'));
  });

  for (const id of ['mh-fecha', 'mh-desde', 'mh-hasta']) {
    porId(id).addEventListener('input', actualizarLaSuma);
    porId(id).addEventListener('change', actualizarLaSuma);
  }
  porId('mh-guardar').addEventListener('click', guardarHorasExtras);
  porId('mh-borrar').addEventListener('click', pedirBorrarHorasExtras);

  // La planilla de contrato: lo que se escribe en cada día, «Nota» y «Quitar» (delegados en #mp-dias, que se vuelve a dibujar),
  // Enter, «Sumar el día» (delegado en #mp-sumar), las flechas del mes y «Guardar»
  for (const tipo of ['input', 'change']) porId('mp-dias').addEventListener(tipo, alEscribirEnLaPlanilla);
  porId('mp-dias').addEventListener('click', alTocarLaPlanilla);
  porId('modal-planilla').addEventListener('keydown', alApretarEnLaPlanilla);
  porId('mp-sumar').addEventListener('click', (evento) => { if (evento.target?.closest?.('#mp-sumar-boton')) sumarElDia(); });
  porId('mp-anterior').addEventListener('click', () => irAlMesDeLaPlanilla('anterior'));
  porId('mp-siguiente').addEventListener('click', () => irAlMesDeLaPlanilla('siguiente'));
  porId('mp-guardar').addEventListener('click', guardarPlanilla);

  porId('ms-dias').addEventListener('change', alElegirEnLosSaldos);
  porId('ms-estudios').addEventListener('change', alElegirEnLosSaldos);
  porId('ms-guardar').addEventListener('click', guardarSaldos);

  // El evento: la fecha, la hora y el recordatorio piden cuándo sale el aviso; «Solo yo» y «Compartido»; cada persona (delegado en
  // la lista, que se vuelve a dibujar); «Guardar» y «Borrar». El detalle de uno ajeno: «Mi recordatorio» se guarda enseguida
  for (const id of ['ev-fecha', 'ev-desde', 'ev-recordatorio']) {
    porId(id).addEventListener('input', alCambiarElCuando);
    porId(id).addEventListener('change', alCambiarElCuando);
  }
  porId('ev-solo').addEventListener('click', () => elegirQuienLoVe(false));
  porId('ev-compartido').addEventListener('click', () => elegirQuienLoVe(true));
  porId('ev-personas').addEventListener('click', alTocarUnaPersona);
  porId('ev-guardar').addEventListener('click', guardarEvento);
  porId('ev-borrar').addEventListener('click', pedirBorrarEvento);
  porId('mea-recordatorio').addEventListener('change', guardarMiRecordatorio);

  porId('modal-confirmar-si').addEventListener('click', confirmarElBorrado);
}

// ---- Los modales ----

// Abre un modal sobre los que ya están: el foco va a `foco()` después de la transición del velo y, al cerrarlo, vuelve a `volverA`
// (el botón que lo abrió); `alCerrar` limpia lo del formulario
function abrirModal(id, { volverA = null, foco = null, alCerrar = null } = {}) {
  const sesion = { id, volverA, alCerrar };
  pagina.modales.push(sesion);
  porId(id).classList.add('active');
  setTimeout(() => {
    if (pagina.modales.at(-1) === sesion) foco?.()?.focus?.();
  }, ESPERA_DEL_VELO);
}

function cerrarModal(id) {
  const lugar = pagina.modales.findIndex((sesion) => sesion.id === id);
  if (lugar === -1) return;
  const [sesion] = pagina.modales.splice(lugar, 1);
  porId(id).classList.remove('active');
  sesion.alCerrar?.();
  if (sesion.volverA && sesion.volverA.isConnected !== false) sesion.volverA.focus?.();
}

// Mientras se guarda o se borra, su modal no se cierra (ni con Escape, ni con la ×, ni con «Cancelar»)
function estaOcupado(modal) {
  if (modal === 'modal-confirmar') return pagina.confirmacion?.ocupado === true;
  if (modal === 'modal-horas') return pagina.horasExtras?.guardando === true;
  if (modal === 'modal-planilla') return pagina.planilla?.guardando === true;
  if (modal === 'modal-saldos') return pagina.saldos?.guardando === true;
  if (modal === 'modal-evento') return pagina.evento?.guardando === true;
  if (modal === 'modal-evento-ajeno') return pagina.eventoAjeno?.guardando === true;
  return pagina.formulario?.guardando === true && FORMULARIOS[pagina.formulario.nombre].modal === modal;
}

// Escape cierra el modal de arriba: primero la confirmación, después el formulario (la planilla, preguntando si tiene cambios)
function alApretarUnaTecla(evento) {
  if (evento.key !== 'Escape' || pagina.modales.length === 0) return;
  const arriba = pagina.modales.at(-1).id;
  evento.preventDefault?.();
  if (!estaOcupado(arriba)) pedirCerrarModal(arriba, document.activeElement);
}

// Cerrar un modal con la ×, «Cancelar» o Escape (`desde`, el control que se usó o el que tenía el foco): la planilla pregunta antes
// si tiene cambios (pedirSalirDeLaPlanilla); los demás se cierran
function pedirCerrarModal(modal, desde) {
  if (modal === 'modal-planilla') pedirSalirDeLaPlanilla(desde);
  else cerrarModal(modal);
}

// ---- Los errores ----

// Un grupo de opciones: el fieldset de unos radios (ml-tipos, ms-dias, ms-estudios)
const esGrupoDeOpciones = (control) => String(control?.tagName).toLowerCase() === 'fieldset';

// Si un control está dentro de algo oculto (un grupo con hidden, como el «Hasta» de los tipos de un día): su error no se vería
const estaOculto = (control) => {
  for (let nodo = control; typeof nodo?.tagName === 'string'; nodo = nodo.parentNode) if (nodo.hidden === true) return true;
  return false;
};

// Muestra (o saca, con null) el error de un campo: su párrafo (<id>-error) y aria-invalid en el control. En un grupo de opciones,
// aria-invalid va en cada radio (en un fieldset no vale: ARIA 1.2), que ya lo describe con aria-describedby. false si el control
// no está o, al poner un error, si está oculto (quien llama lo dice arriba del modal)
function ponerError(id, mensaje) {
  const control = id ? porId(id) : null;
  if (!control || (mensaje && estaOculto(control))) return false;
  const parrafo = porId(`${id}-error`);
  if (parrafo) {
    parrafo.textContent = mensaje ?? '';
    parrafo.hidden = !mensaje;
  }
  for (const marcado of esGrupoDeOpciones(control) ? control.querySelectorAll('input') : [control]) {
    if (mensaje) marcado.setAttribute('aria-invalid', 'true');
    else marcado.removeAttribute('aria-invalid');
  }
  return true;
}

// El control que recibe el foco de un campo: en un grupo de opciones, la elegida o la primera; en una lista de botones (las
// personas de un evento), el primero que se puede tocar
function controlDeFoco(id) {
  const control = porId(id);
  if (esGrupoDeOpciones(control)) return control.querySelector('input:checked') ?? control.querySelector('input') ?? control;
  if (String(control?.tagName).toLowerCase() === 'div') {
    return [...control.querySelectorAll('button')].find((boton) => !boton.disabled) ?? control;
  }
  return control;
}

// El error sin campo, arriba del cuerpo del modal (nunca detrás del velo)
function avisoDelModal(nombre, mensaje) {
  const aviso = porId(`${FORMULARIOS[nombre].prefijo}-error`);
  aviso.textContent = mensaje ?? '';
  aviso.hidden = !mensaje;
  if (mensaje) aviso.scrollIntoView?.({ block: 'nearest' });
}

// Los controles con error de un formulario: los de sus campos y, en «Mis vacaciones y saldos», los de «Para arrancar»
const controlesDe = (nombre) => [...new Set(Object.values(FORMULARIOS[nombre].campos)),
  ...(nombre === 'saldos' ? [...porId('ms-campos').querySelectorAll('[data-saldo]')].map((campo) => campo.id) : [])];

function limpiarErrores(nombre) {
  for (const id of controlesDe(nombre)) ponerError(id, null);
  avisoDelModal(nombre, '');
}

// Los errores (`[[id del control, mensaje]]`), todos juntos (los demás campos quedan limpios), y el foco al primero. Uno sin un
// control a la vista va arriba del modal. true si hubo
function mostrarErrores(nombre, errores) {
  limpiarErrores(nombre);
  const conControl = errores.filter(([id, mensaje]) => ponerError(id, mensaje));
  const sinControl = errores.filter((error) => !conControl.includes(error));
  if (sinControl.length > 0) avisoDelModal(nombre, sinControl.map(([, mensaje]) => mensaje).join(' '));
  if (conControl.length > 0) controlDeFoco(conControl[0][0])?.focus?.();
  return errores.length > 0;
}

// Los errores de un formulario por campo (`{ campo: mensaje }`) con su control
const conSusControles = (nombre, errores) => Object.entries(errores)
  .map(([campo, mensaje]) => [deMapa(FORMULARIOS[nombre].campos, campo, null), mensaje]);

// Un pedido que no llegó al servidor: API.pedirJson tira el error del navegador («Failed to fetch»), sin status y en inglés
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.';
const MENSAJE_NO_SE_GUARDO = 'No se pudo guardar. Probá de nuevo en unos minutos.';
const MENSAJE_NO_SE_BORRO = 'No se pudo borrar. Probá de nuevo en unos minutos.';

// Lo que se dice de una falla: el mensaje del servidor; sin respuesta (sin status), MENSAJE_SIN_CONEXION; sin mensaje, `sinMensaje`
const motivoDeLaFalla = (falla, sinMensaje) => {
  if (!falla?.status) return MENSAJE_SIN_CONEXION;
  return conTexto(falla.message) ? falla.message : sinMensaje;
};

// Un error del servidor al guardar: con un campo del formulario a la vista, en ese campo y con el foco ahí; sin campo (o uno que
// no es del formulario o está oculto, o sin respuesta), arriba del modal, con el foco en el botón (quien llama lo habilita antes:
// uno deshabilitado no recibe el foco)
function mostrarFallaDelServidor(nombre, falla, boton) {
  limpiarErrores(nombre);
  const mensaje = motivoDeLaFalla(falla, MENSAJE_NO_SE_GUARDO);
  const id = deMapa(FORMULARIOS[nombre].campos, falla?.campo, null);
  if (ponerError(id, mensaje)) {
    controlDeFoco(id)?.focus?.();
    return;
  }
  avisoDelModal(nombre, mensaje);
  boton.focus?.();
}

// Las pestañas que se vuelven a dibujar después de guardar o de borrar, y lo que identifica a un control que abre un modal, en este
// orden: el «Editar» de una fila (por su id; en el día por día de contrato, por su fecha), «Mis vacaciones y saldos», «Cambiar» o
// «Registrar un uso autorizado», «Cargar licencia» o «Cargar horas extras» de una tarjeta, un botón de «Vence pronto» (por su tipo)
// y un evento de la agenda (por su id)
const VISTAS_QUE_SE_DIBUJAN = Object.freeze(['vista-resumen', 'vista-licencias', 'vista-horas', 'vista-agenda']);
const IDENTIDADES_DEL_FOCO = Object.freeze(['data-editar-licencia', 'data-editar-horas', 'data-editar-salida', 'data-abrir',
  'data-cargar', 'data-tipo', 'data-evento']);

// El id del lugar de la pestaña donde está un control (el primer antepasado con id, antes de la pestaña: en la agenda, 'ag-mes' o
// 'ag-proximos'), o null
const lugarDe = (control) => {
  for (let nodo = control?.parentNode; typeof nodo?.getAttribute === 'function'; nodo = nodo.parentNode) {
    const id = nodo.getAttribute('id');
    if (id) return VISTAS_QUE_SE_DIBUJAN.includes(id) ? null : id;
  }
  return null;
};

// Lo que identifica a un control: su atributo, su valor y su lugar (`dentro`: un evento está en la grilla y en los próximos)
const identidadDe = (control) => {
  const atributo = IDENTIDADES_DEL_FOCO.find((uno) => typeof control?.getAttribute?.(uno) === 'string');
  return atributo ? { atributo, valor: control.getAttribute(atributo), dentro: lugarDe(control) } : null;
};

/**
 * Adónde va el foco cuando se vuelve a dibujar la pestaña del control que lo tiene (el botón que abrió el modal, al que cerrarModal
 * lo devolvió y que la recarga reemplaza), como respaldoDeLaEliminacion de proyectos.js: `{ vista, candidatos }`, del preferido al
 * último, o null si el control no está en una pestaña (los del encabezado no se vuelven a dibujar) o no abre un modal. Los
 * candidatos: el mismo control (el «Editar» de la misma fila), los de su misma lista (el que seguía, después el anterior: la fila
 * se borró), el título de su panel (por su texto), el primer título de la pestaña y la pestaña misma.
 */
function respaldoDelFoco(control) {
  const vista = VISTAS_QUE_SE_DIBUJAN.find((id) => porId(id)?.contains?.(control));
  const propia = identidadDe(control);
  if (!vista || propia === null) return null;
  const lista = control.closest('li')?.parentNode;
  const botones = lista ? [...lista.querySelectorAll('button')] : [];
  const lugar = botones.indexOf(control);
  const vecinos = lugar === -1 ? [] : [...botones.slice(lugar + 1), ...botones.slice(0, lugar).reverse()];
  const panel = control.closest('.me-tarjeta') ?? control.closest('section');
  const titulo = panel?.querySelector('h2') ?? panel?.querySelector('h3');
  return {
    vista,
    candidatos: [propia, ...vecinos.map(identidadDe).filter((identidad) => identidad !== null),
      ...(titulo ? [{ titulo: titulo.textContent }] : []), { primerTitulo: true }, { pestana: true }]
  };
}

// Los controles de la pestaña que corresponden a un candidato de respaldoDelFoco, del preferido al último ([] si no hay): de un
// control, los que están a la vista y habilitados (uno dentro de un «y N más» oculto, no), primero el del mismo lugar que el que
// se usó (los próximos o la grilla); de un título, el que dice ese texto, el primero de la pestaña o la pestaña misma
function controlesDelCandidato(vista, candidato) {
  if (candidato.atributo) {
    const controles = controlesCon(vista, candidato.atributo, candidato.valor).filter((uno) => !uno.disabled && !estaOculto(uno));
    const lugar = candidato.dentro ? porId(candidato.dentro) : null;
    return lugar ? [...controles.filter((uno) => lugar.contains(uno)), ...controles.filter((uno) => !lugar.contains(uno))] : controles;
  }
  const titulos = [...porId(vista).querySelectorAll('h2'), ...porId(vista).querySelectorAll('h3')];
  let control = porId(`tab-${vista.slice('vista-'.length)}`);
  if (candidato.titulo !== undefined) control = titulos.find((uno) => uno.textContent === candidato.titulo) ?? null;
  else if (candidato.primerTitulo) control = titulos[0] ?? null;
  return control ? [control] : [];
}

// Si el foco se perdió (el control que lo tenía ya no está: quedó en <body>), va al primer candidato que está y que lo toma (si uno
// no lo toma, el siguiente). Un título recibe el foco con tabindex="-1". Con un modal abierto, o si el foco ya está en otro lado, no
// se toca
function devolverElFoco(respaldo) {
  if (respaldo === null || pagina.modales.length > 0) return;
  const activo = document.activeElement;
  if (activo && activo !== document.body && activo.isConnected !== false) return;
  for (const candidato of respaldo.candidatos) {
    for (const control of controlesDelCandidato(respaldo.vista, candidato)) {
      if (/^h[23]$/.test(String(control.tagName).toLowerCase())) control.setAttribute('tabindex', '-1');
      control.focus?.();
      if (document.activeElement === control) return;
    }
  }
}

// Después de guardar o de borrar: el Resumen y las pestañas que ya se cargaron (la que se ve, enseguida y con el año que tenía
// y, en Horas extras, el mes del día por día, y en la agenda, el mes que se ve, sin anunciarlo: se anuncia lo que se guardó; las
// otras, cuando se vuelvan a abrir). La agenda se vuelve a pedir siempre: también muestra las licencias. El foco, que cerrarModal
// devolvió al botón que abrió el modal, va a su equivalente cuando terminan (respaldoDelFoco: la recarga reemplazó el botón)
async function volverAPedirTodo() {
  const respaldo = respaldoDelFoco(document.activeElement);
  const cargas = [cargarResumen()];
  const anioQueTenia = (datos) => (Number.isInteger(datos.anio) && datos.anio !== anioDeHoy() ? datos.anio : null);
  if (pagina.licencias !== null) {
    if (pagina.pestana === 'licencias') cargas.push(cargarLicencias(anioQueTenia(pagina.licencias), { conAnuncio: false }));
    else pagina.licencias = null;
  }
  if (pagina.horas !== null) {
    if (pagina.pestana === 'horas') {
      cargas.push(cargarHorasExtras(anioQueTenia(pagina.horas), { conAnuncio: false, mes: pagina.mes }));
    } else pagina.horas = null;
  }
  if (pagina.pestana === 'agenda') cargas.push(cargarEventos({ forzar: true, conAnuncio: false }));
  else {
    // Lo que se estaba pidiendo ya es viejo: se descarta
    pagina.delMes = null;
    pagina.proximos = null;
    pagina.pedidos.mes += 1;
    pagina.pedidos.proximos += 1;
  }
  await Promise.all(cargas);
  devolverElFoco(respaldo);
}

// Lo que dice el servidor al guardar: el mensaje y sus avisos (por ejemplo, que una corrección ya no se copia a Configuración)
const textoDeLaRespuesta = (respuesta) => [respuesta?.message, ...(Array.isArray(respuesta?.avisos) ? respuesta.avisos : [])]
  .filter(conTexto).join(' ');
// …en un aviso de la página: de éxito o, con avisos, de advertencia
const avisarLaRespuesta = (respuesta) => avisarMiEspacio(textoDeLaRespuesta(respuesta),
  Array.isArray(respuesta?.avisos) && respuesta.avisos.some(conTexto) ? 'warning' : 'success');

// Un 404 (lo que se corregía o se borraba ya no está): se cierra el formulario, se avisa y se vuelve a pedir todo
function noEstaMas(modal, falla) {
  cerrarModal(modal);
  avisarMiEspacio(falla?.message, 'error');
  volverAPedirTodo();
}

// Los formularios necesitan el Resumen (los tipos de «Cargar licencia» y si falta el saldo inicial): si todavía no llegó, o
// falló, se pide antes de abrir; si no llega, se avisa. true si se puede abrir (si mientras tanto se abrió otro modal, no)
async function hayResumen() {
  if (pagina.resumen !== null) return true;
  await cargarResumen();
  if (pagina.resumen === null) {
    avisarMiEspacio(MENSAJE_SIN_RESUMEN, 'error');
    return false;
  }
  return pagina.modales.length === 0;
}

// ---- «Cargar licencia» y «Registrar un uso autorizado» ----

// Abre «Cargar licencia»: nueva (con el `tipo` de «Vence pronto») o la corrección de una fila de la lista. El uso autorizado tiene su
// formulario. Sin el saldo inicial no se puede cargar nada: abre «Mis vacaciones y saldos»
async function abrirLicencia({ fila = null, tipo = null, volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (pagina.resumen?.abrir_saldos === true) {
    abrirSaldos(volverA);
    return;
  }
  if (fila?.tipo === 'uso_autorizado') {
    abrirUso({ fila, volverA });
    return;
  }
  const valores = valoresDeLicencia(fila, tipo);
  // El tipo de la fila, aunque ya no esté entre los de la modalidad (o con «No estudio»): se ve elegido
  const tipos = listaDe(pagina.resumen?.tipos);
  const opciones = fila && !tipos.some((opcion) => opcion.tipo === valores.tipo)
    ? [...tipos, { tipo: valores.tipo, nombre: fila.tipo_nombre, queda_texto: '' }] : tipos;
  // Siempre abre el formulario (el segundo paso se va al cerrar el modal: esto es por las dudas)
  quitarSegundoPaso();
  porId('modal-licencia-titulo').textContent = fila ? `Corregir la licencia del ${comoTexto(fila.fechas_texto)}` : 'Cargar licencia';
  porId('ml-tipos-opciones').innerHTML = htmlDeTiposDeLicencia(opciones, valores.tipo);
  porId('ml-desde').value = valores.desde;
  porId('ml-hasta').value = valores.hasta;
  porId('ml-horas').value = valores.horas;
  porId('ml-grupo-autorizado').hidden = true;
  // Una creada que ya empezó o que ya terminó: lo que se puede cambiar de sus fechas (lo controla el servidor; el desde no se
  // bloquea, así se puede volver a las fechas de Configuración)
  const fechas = porId('ml-fechas-ayuda');
  fechas.textContent = fila?.fechas_fijas === true ? MENSAJES_FORMULARIOS.fechasFijas
    : (fila?.solo_hasta === true ? MENSAJES_FORMULARIOS.soloHasta : '');
  fechas.hidden = fechas.textContent === '';
  iniciarFormulario('licencia', { fila, valores });
  pintarCamposDelTipo();
  abrirModal('modal-licencia', { volverA, foco: () => controlDeFoco('ml-tipos'), alCerrar: cerrarFormulario });
  if (Object.keys(erroresDeLicencia(valores, { modalidad: modalidadActual() })).length === 0) programarCalculo();
}

// Abre «Registrar un uso autorizado» (nuevo, o la corrección de una fila): la fecha y, en contrato, las horas
async function abrirUso({ fila = null, volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (pagina.resumen?.abrir_saldos === true) {
    abrirSaldos(volverA);
    return;
  }
  const valores = valoresDeLicencia(fila, 'uso_autorizado');
  porId('modal-uso-titulo').textContent = fila ? `Corregir el uso autorizado del ${comoTexto(fila.fechas_texto)}`
    : 'Registrar un uso autorizado';
  porId('mu-fecha').value = valores.desde;
  const enHoras = horasDelTipo('uso_autorizado', modalidadActual());
  porId('mu-grupo-horas').hidden = enHoras === null;
  porId('mu-horas').innerHTML = enHoras === null ? '' : htmlDeOpcionesDeHoras(enHoras, valores.horas);
  porId('mu-horas').value = enHoras === null ? '' : valores.horas;
  iniciarFormulario('uso', { fila, valores });
  abrirModal('modal-uso', { volverA, foco: () => porId('mu-fecha'), alCerrar: cerrarFormulario });
  if (Object.keys(erroresDeLicencia(valores, { modalidad: modalidadActual() })).length === 0) programarCalculo();
}

// Lo común de los dos: el estado del formulario (el pedido del cálculo numera cada uno: una respuesta vieja se descarta;
// `esperando`, hay uno programado o en vuelo, y «Guardar» espera su respuesta; `sinCalculo`, el último no llegó, y «Guardar» lo
// vuelve a pedir en lugar de guardar), la nota, «Mostrar a mis compañeros», «Borrar» (o por qué no se puede) y lo que dice el
// cálculo, vacío hasta que llega
function iniciarFormulario(nombre, { fila, valores }) {
  const { prefijo } = FORMULARIOS[nombre];
  cerrarFormulario();
  pagina.formulario = {
    nombre, fila, valores, tipo: valores.tipo, paso: null, pedido: 0, esperando: false, sinCalculo: false, temporizador: null,
    guardando: false, pedidoSinAuditor: 0, firmante: null, autorizadoListo: false
  };
  limpiarErrores(nombre);
  porId(`${prefijo}-nota`).value = valores.nota;
  porId(`${prefijo}-mostrar`).checked = valores.mostrar;
  pintarMostrar();
  const quien = comoTexto(pagina.resumen?.persona?.nombre);
  porId(`${prefijo}-mostrar-ayuda`).textContent = `Ven «${quien} no está», sin el tipo de licencia.`;
  porId(`${prefijo}-borrar`).hidden = !(fila && fila.puede_borrar !== false);
  const pie = porId(`${prefijo}-pie`);
  pie.textContent = fila && fila.puede_borrar === false ? MENSAJES_FORMULARIOS.yaEmpezo : '';
  pie.hidden = pie.textContent === '';
  for (const caja of [`${prefijo}-calculo`, `${prefijo}-paso`, `${prefijo}-sin-auditor`]) {
    porId(caja).innerHTML = '';
    porId(caja).hidden = true;
  }
  porId(`${prefijo}-guardar`).disabled = false;
}

// Al cerrar el formulario, lo que esperaba se descarta
function cerrarFormulario() {
  clearTimeout(pagina.formulario?.temporizador);
  pagina.formulario = null;
}

// Los campos del tipo elegido: «Desde» y «Hasta, inclusive», o «Fecha» en los de un día, y las horas en los que van por horas
function pintarCamposDelTipo() {
  const { tipo, valores } = pagina.formulario;
  const unDia = deUnDia(tipo);
  porId('ml-desde-rotulo').textContent = unDia ? 'Fecha' : 'Desde';
  porId('ml-grupo-hasta').hidden = unDia;
  const enHoras = horasDelTipo(tipo, modalidadActual());
  porId('ml-grupo-horas').hidden = enHoras === null;
  if (enHoras !== null) {
    const elegidas = porId('ml-horas').value || valores.horas;
    porId('ml-horas').innerHTML = htmlDeOpcionesDeHoras(enHoras, elegidas);
    porId('ml-horas').value = elegidas;
  }
  pintarMostrar();
}

// «Mostrar a mis compañeros»: solo para administración (los compañeros son administración) y solo en una licencia de día
// entero (esDeDiaEntero): una franquicia o unas horas de menos de 7 horas no se les muestran nunca (spec, sección 7). Oculta,
// no se lee: viaja lo que tenía
function pintarMostrar() {
  const formulario = pagina.formulario;
  if (!formulario) return;
  const { prefijo } = FORMULARIOS[formulario.nombre];
  const horas = porId(`${prefijo}-grupo-horas`).hidden ? '' : porId(`${prefijo}-horas`).value;
  porId(`${prefijo}-grupo-mostrar`).hidden = pagina.resumen?.persona?.ve_companeros !== true
    || !esDeDiaEntero(formulario.tipo, horas, modalidadActual());
}

// Lo que dice el formulario abierto, como lo lee valoresDeLicencia
function valoresDelFormulario(formulario) {
  const { nombre, valores, tipo } = formulario;
  const { prefijo } = FORMULARIOS[nombre];
  const desde = porId(nombre === 'licencia' ? 'ml-desde' : 'mu-fecha').value;
  const grupoDeHoras = porId(`${prefijo}-grupo-horas`);
  const leidos = {
    ...valores, tipo, desde,
    hasta: nombre === 'licencia' && !deUnDia(tipo) ? porId('ml-hasta').value : desde,
    horas: grupoDeHoras.hidden ? '' : porId(`${prefijo}-horas`).value,
    nota: porId(`${prefijo}-nota`).value
  };
  if (!porId(`${prefijo}-grupo-mostrar`).hidden) leidos.mostrar = porId(`${prefijo}-mostrar`).checked;
  if (nombre === 'licencia' && !porId('ml-grupo-autorizado').hidden) leidos.autorizado = porId('ml-autorizado').value;
  return leidos;
}

// Si el campo «Autorizo a…» está a la vista: el firmante titular, en unas vacaciones que pasan a Configuración
const conPersonaACargo = (formulario) => formulario.nombre === 'licencia' && !porId('ml-grupo-autorizado').hidden;

// Cada cambio pide el cálculo 300 ms después del último; mientras, «Guardar» espera
function programarCalculo() {
  const formulario = pagina.formulario;
  if (!formulario) return;
  clearTimeout(formulario.temporizador);
  formulario.pedido += 1;
  formulario.esperando = true;
  porId(`${FORMULARIOS[formulario.nombre].prefijo}-guardar`).disabled = true;
  formulario.temporizador = setTimeout(() => pedirCalculo(formulario), ESPERA_DEL_CALCULO);
}

// Pide el cálculo enseguida, sin la espera (desde «Guardar», cuando el anterior no llegó): mientras, «Guardar» espera
function calcularYa(formulario) {
  clearTimeout(formulario.temporizador);
  formulario.esperando = true;
  porId(`${FORMULARIOS[formulario.nombre].prefijo}-guardar`).disabled = true;
  return pedirCalculo(formulario);
}

// El cálculo del servidor (POST /licencias/calculo, sin guardar nada): los días, de qué licencia salen, lo que queda, el error si
// no se puede guardar (en su campo, sin llevarse el foco) y el paso a Configuración. Sin el tipo y las fechas (o las horas) no hay
// nada que pedir. Una respuesta vieja (el formulario cambió o se cerró mientras) se descarta. Si no llega (un error del servidor
// o sin conexión), el formulario lo dice y queda `sinCalculo`: sin él no se ve qué pasa con Configuración
async function pedirCalculo(formulario) {
  if (pagina.formulario !== formulario) return;
  const pedido = ++formulario.pedido;
  const valores = valoresDelFormulario(formulario);
  const { tipo, desde, hasta, horas } = erroresDeLicencia(valores, { modalidad: modalidadActual() });
  let data = null;
  let falla = null;
  if (!tipo && !desde && !hasta && !horas) {
    const cuerpo = cuerpoDeLicencia(valores);
    if (valores.id !== null) cuerpo.id = valores.id;
    try {
      ({ data } = await API.pedirJson('POST', '/mi-espacio/licencias/calculo', cuerpo));
    } catch (error) {
      if (pagina.formulario !== formulario || pedido !== formulario.pedido) return;
      if (error?.status === 401) {
        irAlLogin();
        return;
      }
      falla = error ?? {};
    }
    if (pagina.formulario !== formulario || pedido !== formulario.pedido) return;
  }
  formulario.sinCalculo = falla !== null;
  await pintarCalculo(formulario, esObjeto(data) ? data : null, valores, falla);
  if (pagina.formulario !== formulario || pedido !== formulario.pedido) return;
  formulario.esperando = false;
  porId(`${FORMULARIOS[formulario.nombre].prefijo}-guardar`).disabled = formulario.guardando;
}

async function pintarCalculo(formulario, data, valores, falla = null) {
  const { nombre } = formulario;
  const { prefijo } = FORMULARIOS[nombre];
  formulario.paso = esObjeto(data?.paso) ? data.paso : null;
  limpiarErrores(nombre);
  if (falla !== null) avisoDelModal(nombre, textoSinCalculo(falla));
  if (esObjeto(data?.error) && conTexto(data.error.mensaje)) {
    if (!ponerError(deMapa(FORMULARIOS[nombre].campos, data.error.campo, null), data.error.mensaje)) {
      avisoDelModal(nombre, data.error.mensaje);
    }
  }
  const calculo = porId(`${prefijo}-calculo`);
  calculo.innerHTML = htmlDelCalculo(data, valores.tipo);
  calculo.hidden = calculo.innerHTML === '';
  if (nombre === 'licencia') await prepararPersonaACargo(formulario);
  if (pagina.formulario !== formulario) return;
  pintarPaso(formulario);
  actualizarSinAuditor(formulario, valores);
}

// El campo «Autorizo a presentar las notas en mi nombre a:» (spec, sección 6): solo cuando el paso pasa y el firmante titular
// carga vacaciones, con las personas de GET /mi-espacio/firmante. Viene vacío; al corregir, con la persona a cargo que ya tiene
// (y, si ya no cumple las condiciones, igual elegida: si no, guardar otro cambio la quitaría)
async function prepararPersonaACargo(formulario) {
  const grupo = porId('ml-grupo-autorizado');
  const paso = formulario.paso;
  if (!(paso?.pasa === true && paso.firmante?.puede_autorizar === true)) {
    grupo.hidden = true;
    return;
  }
  const firmante = await datosDelFirmante();
  if (pagina.formulario !== formulario) return;
  if (firmante.soy_titular !== true) {
    grupo.hidden = true;
    return;
  }
  formulario.firmante = firmante;
  if (!formulario.autorizadoListo) {
    const actual = formulario.valores.autorizado;
    const personas = listaDe(firmante.autorizables).map((persona) => ({ id: String(persona.id), nombre: persona.nombre_completo }));
    if (conTexto(actual) && !personas.some((persona) => persona.id === actual)) {
      personas.push({ id: actual, nombre: 'Otro usuario (ya no cumple las condiciones)' });
    }
    porId('ml-autorizado').innerHTML = htmlDeAutorizables(personas);
    porId('ml-autorizado').value = actual;
    formulario.autorizadoListo = true;
  }
  grupo.hidden = false;
}

// GET /mi-espacio/firmante, una sola vez (si falla, se vuelve a pedir la próxima)
function datosDelFirmante() {
  pagina.firmante ??= API.pedirJson('GET', '/mi-espacio/firmante').then(
    ({ data }) => (esObjeto(data) ? data : {}),
    (error) => {
      pagina.firmante = null;
      if (error?.status === 401) irAlLogin();
      return {};
    }
  );
  return pagina.firmante;
}

// El aviso del paso a Configuración: azul si pasa; si no, en ámbar, por qué. En las vacaciones del titular, con el efecto en las
// notas de la persona elegida y sus días de licencia, solo si se sabe quién queda a cargo: «Nadie» o una de la lista. Con el
// campo oculto al corregir (GET /mi-espacio/firmante falló: la persona que tenía se conserva) o con «Otro usuario (ya no cumple
// las condiciones)», «Sin persona autorizada…» sería falso y el efecto no va. En unas nuevas con el campo oculto, nadie queda a
// cargo (autorizado_id no viaja): ahí sí es cierto y va
function pintarPaso(formulario) {
  const caja = porId(`${FORMULARIOS[formulario.nombre].prefijo}-paso`);
  const valores = valoresDelFormulario(formulario);
  const conCampo = conPersonaACargo(formulario);
  const elegida = conCampo
    ? listaDe(formulario.firmante?.autorizables).find((persona) => String(persona.id) === valores.autorizado) : undefined;
  const nuevaSinCampo = !conCampo && formulario.nombre === 'licencia' && formulario.fila === null;
  caja.innerHTML = htmlDelPaso(formulario.paso, {
    autorizado: elegida?.nombre_completo ?? null, ausencias: elegida?.ausencias ?? [],
    hoy: formulario.firmante?.hoy ?? Utils.hoyEnArgentina(), desde: valores.desde, hasta: valores.hasta,
    conEfecto: nuevaSinCampo || (conCampo && (elegida !== undefined || !conTexto(valores.autorizado)))
  });
  caja.hidden = caja.innerHTML === '';
  caja.classList.toggle('azul', formulario.paso?.pasa === true);
  caja.classList.toggle('ambar', formulario.paso?.pasa !== true);
}

// Los días sin auditor de las fechas del formulario (GET /usuarios/licencias/sin-auditor, como en Configuración): solo para quien
// audita y solo si el paso pasa. Al corregir una creada, sin contar su licencia de Configuración (excluir). Solo avisa
async function actualizarSinAuditor(formulario, valores) {
  const caja = porId(`${FORMULARIOS[formulario.nombre].prefijo}-sin-auditor`);
  const pedido = ++formulario.pedidoSinAuditor;
  const parametros = formulario.paso?.pasa === true && Auth.isAuditor?.() === true ? parametrosSinAuditor({
    usuarioId: Auth.getUser?.()?.id, desde: valores.desde, hasta: valores.hasta, excluir: valores.licencia_oficial,
    hoy: Utils.hoyEnArgentina()
  }) : null;
  if (parametros === null) {
    caja.hidden = true;
    return;
  }
  let periodos = [];
  try {
    periodos = listaDe(await API.getSinAuditor(parametros));
  } catch { /* sin el dato no hay aviso */ }
  if (pagina.formulario !== formulario || pedido !== formulario.pedidoSinAuditor) return;
  caja.innerHTML = periodos.map((periodo) => `<p>${esc(textoSinAuditor(periodo))}</p>`).join('');
  caja.hidden = periodos.length === 0;
}

// «Guardar»: los errores del formulario antes de pedir nada; si el último cálculo no llegó, lo vuelve a pedir y no guarda (sin él
// no se vio qué pasa con Configuración); si no, POST o PUT. Mientras, «Guardar» queda deshabilitado (un doble clic manda un solo
// pedido). Guardada una licencia, el modal pasa al segundo paso (pasarAlSegundoPaso); un uso autorizado, que no tiene nota, se
// cierra, se avisa lo que dijo el servidor y se vuelve a pedir todo
async function guardarLicencia(nombre) {
  const formulario = pagina.formulario;
  const boton = porId(`${FORMULARIOS[nombre].prefijo}-guardar`);
  if (formulario?.nombre !== nombre || formulario.guardando || formulario.esperando) return;
  const valores = valoresDelFormulario(formulario);
  if (mostrarErrores(nombre, conSusControles(nombre, erroresDeLicencia(valores, { modalidad: modalidadActual() })))) return;
  if (formulario.sinCalculo) {
    await calcularYa(formulario);
    // Mientras esperaba quedó deshabilitado: el foco vuelve a él
    if (pagina.formulario === formulario) boton.focus?.();
    return;
  }
  const cuerpo = cuerpoDeLicencia(valores, { soyTitular: conPersonaACargo(formulario) });
  formulario.guardando = true;
  boton.disabled = true;
  try {
    const respuesta = formulario.fila
      ? await API.pedirJson('PUT', `/mi-espacio/licencias/${encodeURIComponent(formulario.fila.id)}`, cuerpo)
      : await API.pedirJson('POST', '/mi-espacio/licencias', cuerpo);
    formulario.guardando = false;
    if (nombre === 'licencia') {
      pasarAlSegundoPaso(formulario, respuesta);
      return;
    }
    cerrarModal(FORMULARIOS[nombre].modal);
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    formulario.guardando = false;
    boton.disabled = formulario.esperando;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) noEstaMas(FORMULARIOS[nombre].modal, error);
    else if (pagina.formulario === formulario) mostrarFallaDelServidor(nombre, error, boton);
  } finally {
    if (pagina.formulario === formulario) boton.disabled = formulario.esperando;
  }
}

// ---- El segundo paso de «Cargar licencia» (spec 2026-10-27-mi-espacio-licencia-word, 6) ----

/**
 * Guardada una licencia (POST o PUT, 2xx), el modal no se cierra: pasa al segundo paso (mostrarSegundoPaso), con la licencia
 * guardada, la nota a la vista y «Descargar Word». Antes de recargar se guarda adónde va el foco al cerrar: el respaldo del botón
 * que abrió el modal, como después de cualquier guardado (volverAPedirTodo lo calcula con el foco, que acá queda en el modal, y la
 * recarga reemplaza ese botón). La página vuelve a pedir todo de fondo (así la lista de atrás ya la muestra) y el formulario
 * termina: su cálculo, la persona a cargo y sus temporizadores ya no siguen. Al cerrar el modal (Escape, la × o «Listo»), el
 * segundo paso se va, el foco que quedó en el modal se suelta y, cuando termina la recarga, va al respaldo (si el botón que lo abrió
 * sigue ahí, cerrarModal se lo da mientras tanto)
 */
function pasarAlSegundoPaso(formulario, respuesta) {
  const { modal } = FORMULARIOS.licencia;
  const sesion = pagina.modales.find((una) => una.id === modal) ?? null;
  const respaldo = respaldoDelFoco(sesion?.volverA ?? null);
  const recarga = volverAPedirTodo();
  mostrarSegundoPaso({
    id: respuesta?.data?.id ?? formulario.fila?.id ?? null, corregida: Boolean(formulario.fila), avisos: respuesta?.avisos ?? []
  });
  cerrarFormulario();
  if (sesion === null) return;
  sesion.alCerrar = () => {
    soltarElFocoDe(modal);
    quitarSegundoPaso();
    const aplicar = () => devolverElFoco(respaldo);
    recarga.then(aplicar, aplicar);
  };
}

// El foco que quedó dentro de un modal que se cierra se suelta (queda en <body>): así devolverElFoco lo lleva al respaldo
function soltarElFocoDe(id) {
  const activo = document.activeElement;
  if (activo && activo !== document.body && porId(id)?.contains?.(activo)) activo.blur?.();
}

/**
 * Muestra el segundo paso de la licencia `id` en lugar del formulario: el título («Licencia cargada» o «Licencia corregida»), el
 * cuerpo (los avisos del guardado y «Armando la nota…», hasta que llega GET …/nota) y el pie («Listo» y «Descargar Word»). El
 * foco va a «Descargar Word» y #me-anuncio dice lo que se guardó, con los avisos (no hay aviso flotante: lo dice el título)
 */
function mostrarSegundoPaso({ id, corregida, avisos }) {
  pagina.segundoPaso = { id, corregida: corregida === true, avisos: avisosDelGuardado(avisos) };
  const pedido = ++pagina.pedidos.nota;
  porId('modal-licencia-titulo').textContent = tituloDelSegundoPaso(pagina.segundoPaso.corregida);
  porId('ml-cuerpo').hidden = true;
  porId('ml-pie-del-formulario').hidden = true;
  const cuerpo = porId('ml-paso-dos');
  cuerpo.innerHTML = htmlDelSegundoPasoEnEspera(pagina.segundoPaso.avisos);
  cuerpo.hidden = false;
  cuerpo.scrollTop = 0;
  porId('ml-paso-dos-pie').hidden = false;
  porId('ml-descargar-word').focus?.();
  anunciar(anuncioDelSegundoPaso(pagina.segundoPaso.corregida, pagina.segundoPaso.avisos));
  pedirLaNotaDelSegundoPaso(id, pedido);
}

// GET …/nota: con la respuesta, la licencia y la hoja (htmlDelSegundoPaso); si no llega (o llega sin hoja), MENSAJE_SIN_VISTA,
// también anunciado, con los avisos del guardado detrás (el anuncio pisa el anterior, que los decía): la licencia ya se guardó y
// «Descargar Word» sigue andando. Con un 401, al login. Una respuesta de otro segundo
// paso, o que llega con el modal cerrado (`pedido` ya no es el último), no toca nada
async function pedirLaNotaDelSegundoPaso(id, pedido) {
  let data = null;
  let falla = null;
  try {
    ({ data } = await API.pedirJson('GET', `/mi-espacio/licencias/${encodeURIComponent(id)}/nota`));
  } catch (error) {
    falla = error ?? new Error('');
  }
  if (pedido !== pagina.pedidos.nota || pagina.segundoPaso === null) return;
  if (falla?.status === 401) {
    irAlLogin();
    return;
  }
  const { avisos } = pagina.segundoPaso;
  if (falla === null && esObjeto(data) && conTexto(data.html)) {
    porId('ml-paso-dos').innerHTML = htmlDelSegundoPaso({ fila: data.fila, html: data.html, aclaracion: data.aclaracion, avisos });
    return;
  }
  porId('ml-paso-dos').innerHTML = htmlDelSegundoPasoSinVista(avisos);
  anunciar([MENSAJE_SIN_VISTA, ...avisos].join(' '));
}

// Al cerrar el modal: el segundo paso se va (una respuesta de GET …/nota que llegue después se descarta) y vuelven el cuerpo y el
// pie del formulario, para la próxima vez que se abra
function quitarSegundoPaso() {
  pagina.pedidos.nota += 1;
  pagina.segundoPaso = null;
  const cuerpo = porId('ml-paso-dos');
  cuerpo.hidden = true;
  cuerpo.innerHTML = '';
  porId('ml-paso-dos-pie').hidden = true;
  porId('ml-cuerpo').hidden = false;
  porId('ml-pie-del-formulario').hidden = false;
}

// «Borrar»: la confirmación, sobre el formulario
function pedirBorrarLicencia(nombre) {
  const formulario = pagina.formulario;
  if (formulario?.nombre !== nombre || !formulario.fila || formulario.guardando) return;
  const { id } = formulario.fila;
  pedirConfirmacion({
    titulo: nombre === 'uso' ? '¿Borrar el uso autorizado?' : '¿Borrar la licencia?', texto: textoDeConfirmacion(formulario.fila),
    volverA: porId(`${FORMULARIOS[nombre].prefijo}-borrar`), formulario: FORMULARIOS[nombre].modal,
    borrar: () => API.pedirJson('DELETE', `/mi-espacio/licencias/${encodeURIComponent(id)}`)
  });
}

// ---- «Cargar horas extras» ----

// Abre «Cargar horas extras» (nuevas, o la corrección de un día del día por día), con lo que suman en el mes: si la tabla de la
// pestaña todavía no llegó, la pide, sin mostrar la pestaña
async function abrirHorasExtras({ dia = null, volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (pagina.resumen?.abrir_saldos === true) {
    abrirSaldos(volverA);
    return;
  }
  const valores = valoresDeHoras(dia);
  let titulo = modalidadActual() === 'planta' ? 'Cargar horas extras al 100%' : 'Cargar horas extras';
  if (dia) titulo = `Corregir las horas extras del ${comoTexto(dia.fecha_texto)}`;
  porId('modal-horas-titulo').textContent = titulo;
  for (const campo of ['fecha', 'desde', 'hasta', 'nota']) porId(`mh-${campo}`).value = valores[campo];
  pagina.horasExtras = { dia, valores, guardando: false };
  limpiarErrores('horasExtras');
  porId('mh-borrar').hidden = !dia;
  porId('mh-guardar').disabled = false;
  actualizarLaSuma();
  if (pagina.horas === null) cargarHorasExtras(null, { conAnuncio: false }).then(actualizarLaSuma);
  abrirModal('modal-horas', { volverA, foco: () => porId('mh-fecha'), alCerrar: () => { pagina.horasExtras = null; } });
}

const valoresDeLasHorasExtras = () => ({
  ...pagina.horasExtras.valores, fecha: porId('mh-fecha').value, desde: porId('mh-desde').value, hasta: porId('mh-hasta').value,
  nota: porId('mh-nota').value
});

function actualizarLaSuma() {
  if (!pagina.horasExtras) return;
  const suma = porId('mh-suma');
  suma.textContent = textoDeLaSuma(valoresDeLasHorasExtras(), pagina.horas, modalidadActual());
  suma.hidden = suma.textContent === '';
}

async function guardarHorasExtras() {
  const formulario = pagina.horasExtras;
  const boton = porId('mh-guardar');
  if (!formulario || formulario.guardando) return;
  const valores = valoresDeLasHorasExtras();
  if (mostrarErrores('horasExtras', conSusControles('horasExtras', erroresDeHoras(valores)))) return;
  formulario.guardando = true;
  boton.disabled = true;
  try {
    const respuesta = formulario.dia
      ? await API.pedirJson('PUT', `/mi-espacio/horas-extras/${encodeURIComponent(formulario.dia.id)}`, cuerpoDeHoras(valores))
      : await API.pedirJson('POST', '/mi-espacio/horas-extras', cuerpoDeHoras(valores));
    formulario.guardando = false;
    cerrarModal('modal-horas');
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    formulario.guardando = false;
    boton.disabled = false;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) noEstaMas('modal-horas', error);
    else if (pagina.horasExtras === formulario) mostrarFallaDelServidor('horasExtras', error, boton);
  } finally {
    boton.disabled = false;
  }
}

function pedirBorrarHorasExtras() {
  const formulario = pagina.horasExtras;
  if (!formulario?.dia || formulario.guardando) return;
  const { id } = formulario.dia;
  pedirConfirmacion({
    titulo: '¿Borrar las horas extras?', texto: textoDeConfirmacion(formulario.dia), volverA: porId('mh-borrar'),
    formulario: 'modal-horas', borrar: () => API.pedirJson('DELETE', `/mi-espacio/horas-extras/${encodeURIComponent(id)}`)
  });
}

// ---- La planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 4 y 9; la maqueta aprobada) ----

// Lo que se dice cuando un mes de la planilla no llega y el servidor no dice por qué
const MENSAJE_SIN_LA_PLANILLA = 'No se pudo cargar el mes. Probá de nuevo en unos minutos.';

// «Cargar horas extras» (el del encabezado y el de la tarjeta de la pestaña): en contrato, la planilla; si no, el modal de planta,
// como siempre. Sin el Resumen todavía (dice la modalidad), lo pide antes
async function abrirCargaDeHoras({ volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (modalidadActual() === 'contrato') abrirPlanilla({ volverA });
  else abrirHorasExtras({ volverA });
}

/**
 * Abre la planilla en un mes ('AAAA-MM'; sin él, el en curso), con su propio estado, `pagina.planilla` (no se cruza con el de los
 * otros formularios):
 * - `mes`, el que se ve (null hasta que llega el primero), y `meses`, los ya pedidos en esta apertura, por mes (cada uno se pide una
 *   vez: cambiar de mes no pierde lo cargado);
 * - `cambios`, `agregados`, `errores` y `notasAbiertas`, encima de lo que mandó el servidor (ver «La planilla de horas extras de
 *   contrato», en lo puro);
 * - `guardando` (mientras tanto, no se cierra ni acepta cambios: pintarElGuardadoDeLaPlanilla), `pedido` (el número del último
 *   GET: una respuesta vieja se descarta) y `cargando` (el mes que se está pidiendo, o 'en curso': mientras tanto, las flechas no
 *   hacen nada);
 * - `aviso`, lo que dice #mp-error, y `avisoDeLosDias`, si es el de los días marcados (se va cuando no queda ninguno);
 * - `foco`, adónde va el foco al abrir: la salida de `fecha` (la de «Editar») o, en el mes en curso, la de hoy, o la primera; un día
 *   sin salida para escribir (uno de licencia con una salida de antes), su «Quitar».
 * Sin el saldo inicial abre «Mis vacaciones y saldos», como los demás formularios. Sin `mes`, el primer GET va sin él (el servidor
 * da el de hoy: con el reloj del teléfono adelantado un mes, pedir el de su fecha daría 400) y el mes es el que llega; mientras
 * tanto, el título dice el de la fecha del teléfono.
 */
async function abrirPlanilla({ mes = null, fecha = null, volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (pagina.resumen?.abrir_saldos === true) {
    abrirSaldos(volverA);
    return;
  }
  if (pagina.planilla !== null) return;
  const planilla = {
    mes: null, meses: new Map(), cambios: new Map(), agregados: new Set(), errores: new Map(), notasAbiertas: new Set(),
    guardando: false, pedido: 0, cargando: null, aviso: '', avisoDeLosDias: false,
    foco: { fecha: esFechaDeTexto(fecha) ? fecha : null, pendiente: true, velo: false }
  };
  pagina.planilla = planilla;
  const mesPedido = esMesDeTexto(mes) ? mes : null;
  const elMes = mesPedido ?? Utils.hoyEnArgentina().slice(0, 7);
  // Lo de la apertura anterior se va; mientras llega el mes, su título y las flechas apagadas
  porId('mp-cuerpo').inert = false;
  porId('mp-mes-titulo').textContent = tituloDelMes(elMes);
  porId('mp-anterior').disabled = true;
  porId('mp-siguiente').disabled = true;
  porId('mp-como-mes').textContent = textoDeComoSeCuentan(elMes);
  for (const id of ['mp-suma', 'mp-dias', 'mp-sumar']) porId(id).innerHTML = '';
  porId('mp-dias').removeAttribute('aria-busy');
  porId('mp-pendientes').innerHTML = htmlDelPieDeLaPlanilla([]);
  porId('mp-anuncio').textContent = '';
  porId('mp-guardar').disabled = false;
  porId('mp-cuerpo').scrollTop = 0;
  pintarElAvisoDeLaPlanilla(planilla);
  abrirModal('modal-planilla', {
    volverA, foco: () => focoAlAbrirLaPlanilla(planilla),
    alCerrar: () => { if (pagina.planilla === planilla) pagina.planilla = null; }
  });
  await cargarMesDeLaPlanilla(mesPedido);
}

// El primer foco (abrirModal lo pide después del velo): el día de `foco`, si su mes ya llegó; si no, la × (nunca detrás del velo), y
// el día cuando llegue el mes (mostrarMesDeLaPlanilla, si el foco sigue en la ×)
function focoAlAbrirLaPlanilla(planilla) {
  planilla.foco.velo = true;
  return controlDelFocoInicial(planilla) ?? porId('modal-planilla').querySelector('.modal-close');
}

// El control del día de `foco` (y lo da por usado): la salida de su fecha o, sin ella, su «Quitar»; si el día no está o no tiene
// ninguno, el de hoy, y si no, la primera salida del mes. Con la fila a la vista, centrada. Antes de que llegue el mes, null
function controlDelFocoInicial(planilla) {
  const datos = planilla.meses.get(planilla.mes);
  if (!planilla.foco.pendiente || !datos) return null;
  planilla.foco.pendiente = false;
  const hoy = listaDe(datos.dias).find((dia) => dia.hoy === true)?.fecha ?? null;
  for (const fecha of [planilla.foco.fecha, hoy]) {
    const fila = esFechaDeTexto(fecha) ? porId(`mp-dia-${fecha}`) : null;
    const control = fila?.querySelector('[data-campo="salida"]') ?? fila?.querySelector('[data-quitar]') ?? null;
    if (control) {
      fila.scrollIntoView?.({ block: 'center' });
      return control;
    }
  }
  return porId('mp-dias').querySelector('[data-campo="salida"]');
}

/**
 * Muestra un mes en la planilla: uno ya pedido en esta apertura, enseguida; si no, lo pide (GET /mi-espacio/salidas?mes=) y,
 * mientras tanto, el que se veía sigue a la vista, ocupado (aria-busy), y las flechas no hacen nada. Una respuesta vieja (de un
 * pedido anterior, o de otra apertura) se descarta. Si no llega, lo dice arriba del cuerpo (con un 401, al login) y el mes que se
 * veía sigue. Con `mes` null, el en curso: el GET va sin `mes` y el mes es el que dice el servidor (abrirPlanilla). Devuelve si lo
 * mostró
 */
async function cargarMesDeLaPlanilla(mes) {
  const planilla = pagina.planilla;
  const enCurso = mes === null;
  if (!planilla || (!enCurso && !esMesDeTexto(mes))) return false;
  if (!enCurso && planilla.meses.has(mes)) {
    mostrarMesYaPedido(planilla, mes);
    return true;
  }
  const pedido = ++planilla.pedido;
  planilla.cargando = enCurso ? 'en curso' : mes;
  porId('mp-dias').setAttribute('aria-busy', 'true');
  let datos = null;
  let falla = null;
  try {
    const ruta = enCurso ? '/mi-espacio/salidas' : `/mi-espacio/salidas?mes=${encodeURIComponent(mes)}`;
    ({ data: datos } = await API.pedirJson('GET', ruta));
  } catch (error) {
    falla = error ?? new Error('');
  }
  if (pagina.planilla !== planilla || pedido !== planilla.pedido) return false;
  planilla.cargando = null;
  porId('mp-dias').removeAttribute('aria-busy');
  if (falla?.status === 401) {
    irAlLogin();
    return false;
  }
  const llego = esObjeto(datos) && Array.isArray(datos.dias) && esMesDeTexto(datos.mes) && (enCurso || datos.mes === mes);
  if (falla || !llego) {
    planilla.aviso = falla ? motivoDeLaFalla(falla, MENSAJE_SIN_LA_PLANILLA) : (conTexto(datos?.mensaje) ? datos.mensaje : MENSAJE_SIN_LA_PLANILLA);
    planilla.avisoDeLosDias = false;
    pintarElAvisoDeLaPlanilla(planilla);
    return false;
  }
  planilla.meses.set(datos.mes, datos);
  mostrarMesDeLaPlanilla(planilla, datos.mes);
  return true;
}

// El mes que se estaba pidiendo pasa a ser viejo (se descarta al llegar: no cambia el mes que se ve) y las flechas vuelven a andar
function soltarElMesPedido(planilla) {
  planilla.pedido += 1;
  planilla.cargando = null;
  porId('mp-dias').removeAttribute('aria-busy');
}

// Un mes ya pedido: lo que se estaba pidiendo pasa a ser viejo y se muestra enseguida
function mostrarMesYaPedido(planilla, mes) {
  soltarElMesPedido(planilla);
  mostrarMesDeLaPlanilla(planilla, mes);
}

// Dibuja el mes (si es otro, el cuerpo vuelve arriba; el aviso de una falla se va, el de los días marcados queda) y, la primera vez,
// el foco va al día de `foco` si quedó en la × mientras llegaba
function mostrarMesDeLaPlanilla(planilla, mes) {
  const cambia = planilla.mes !== mes;
  planilla.mes = mes;
  if (!planilla.avisoDeLosDias) planilla.aviso = '';
  pintarLaPlanilla();
  if (cambia) porId('mp-cuerpo').scrollTop = 0;
  if (planilla.foco.pendiente && planilla.foco.velo) {
    const activo = document.activeElement;
    const cerrar = porId('modal-planilla').querySelector('.modal-close');
    const control = controlDelFocoInicial(planilla);
    if (control && (!activo || activo === document.body || activo === cerrar)) control.focus?.();
  }
}

// La planilla del mes que se ve: el título y las flechas (no van a un mes que todavía no llegó ni antes del primero: los dice el
// servidor), «Cómo se cuentan», los días, «Sumar el día», la banda, las semanas, el pie y el aviso de arriba del cuerpo
function pintarLaPlanilla() {
  const planilla = pagina.planilla;
  const datos = planilla?.meses.get(planilla.mes);
  if (!datos) return;
  porId('mp-mes-titulo').textContent = conTexto(datos.mes_texto) ? datos.mes_texto : tituloDelMes(planilla.mes);
  pintarLasFlechasDeLaPlanilla(planilla);
  porId('mp-como-mes').textContent = textoDeComoSeCuentan(planilla.mes);
  porId('mp-dias').innerHTML = htmlDeLaPlanilla(datos, planilla);
  porId('mp-sumar').innerHTML = htmlDelSumarDeLaPlanilla(datos, planilla);
  pintarLaSumaDeLaPlanilla();
  pintarElAvisoDeLaPlanilla(planilla);
}

// Las flechas del mes: al anterior y al siguiente que dice el servidor (nunca a uno que todavía no llegó ni antes del primero) y,
// mientras se guarda, apagadas
function pintarLasFlechasDeLaPlanilla(planilla) {
  const datos = planilla.meses.get(planilla.mes);
  porId('mp-anterior').disabled = planilla.guardando || !esMesDeTexto(datos?.anterior);
  porId('mp-siguiente').disabled = planilla.guardando || !esMesDeTexto(datos?.siguiente);
}

// Mientras se guarda, la planilla no acepta cambios (spec, sección 2: que no se pierda lo cargado sin aviso; lo que se escribiera
// mientras tanto no iría en el PUT y, al cerrar, se perdería): el cuerpo inerte (ni el foco, ni los clics, ni el lector de pantalla
// llegan a los días ni a «Sumar el día»), las flechas y «Guardar» apagados (y los que cambian algo no hacen nada: `guardando`). Al
// responder, todo vuelve. El cuerpo es de la página: vuelve siempre; las flechas, solo si la planilla sigue abierta
function pintarElGuardadoDeLaPlanilla(planilla) {
  porId('mp-cuerpo').inert = planilla.guardando;
  porId('mp-guardar').disabled = planilla.guardando;
  if (pagina.planilla === planilla) pintarLasFlechasDeLaPlanilla(planilla);
}

// Las fechas con cambios sin guardar, de todos los meses pedidos
const fechasDeLaPlanilla = (planilla) => fechasCambiadas(planilla.cambios, diasPorFechaDe(planilla.meses.values()));

// Lo que cambia mientras se escribe, sin volver a dibujar las filas: la banda (lo que suma el mes, con los cambios), el total de
// cada semana y el pie (los días con cambios, de todos los meses)
function pintarLaSumaDeLaPlanilla() {
  const planilla = pagina.planilla;
  const datos = planilla?.meses.get(planilla.mes);
  if (!datos) return;
  const visibles = diasVisiblesDeLaPlanilla(datos, planilla);
  porId('mp-suma').innerHTML = htmlDeLaBandaDeLaPlanilla(planilla.mes, horasDeLosDias(visibles, planilla.cambios), datos.hoy);
  const porFecha = new Map(visibles.map((dia) => [dia.fecha, dia]));
  for (const semana of porId('mp-dias').querySelectorAll('.mp-semana')) {
    const dias = comoTexto(semana.getAttribute('data-fechas')).split(',').map((fecha) => porFecha.get(fecha)).filter(Boolean);
    const total = semana.querySelector('.mp-semana-total');
    if (total) total.textContent = textoDelTotalDeLaSemana(horasDeLosDias(dias, planilla.cambios));
  }
  porId('mp-pendientes').innerHTML = htmlDelPieDeLaPlanilla(fechasDeLaPlanilla(planilla));
}

// #mp-error (role="alert"): el aviso de la planilla, o nada. Un texto igual al que tiene no se vuelve a escribir (se volvería a
// anunciar cada vez que se dibuja la planilla)
function pintarElAvisoDeLaPlanilla(planilla) {
  const aviso = porId('mp-error');
  if (aviso.textContent !== planilla.aviso) aviso.textContent = planilla.aviso;
  aviso.hidden = planilla.aviso === '';
}

// El aviso de un «Guardar» que no salió: se anuncia aunque diga lo mismo que el que ya está (un guardado que vuelve a fallar igual),
// con un espacio al final, como anunciar. Queda así en `aviso`: volver a dibujar la planilla no lo repite
function avisoQueSeAnuncia(planilla, texto) {
  planilla.aviso = porId('mp-error').textContent === texto ? `${texto} ` : texto;
}

// La región viva de la planilla (#mp-anuncio, dentro del diálogo: con aria-modal, #me-anuncio puede no leerse), como anunciar
function anunciarEnLaPlanilla(texto) {
  const region = porId('mp-anuncio');
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto} ` : texto;
}

// Los días de la planilla de todos los meses pedidos, por fecha, y el de una fecha
const diaDeLaPlanilla = (planilla, fecha) => diasPorFechaDe(planilla.meses.values()).get(fecha) ?? null;

// Lo que se escribe en un día (la entrada, la salida o la nota): su estado completo pasa a `cambios` y se actualizan, sin volver a
// dibujar nada (el campo que se usa sigue siendo el mismo: no pierde el foco ni lo que se está escribiendo), su fila, la banda, las
// semanas y el pie. Escribir en un día con error lo saca (y, sin ninguno, el aviso de arriba). Mientras guarda, nada
function alEscribirEnLaPlanilla(evento) {
  const planilla = pagina.planilla;
  const campo = evento.target?.closest?.('[data-campo]');
  if (!planilla || planilla.guardando || !campo) return;
  const fecha = campo.getAttribute('data-fecha');
  const nombre = campo.getAttribute('data-campo');
  const dia = diaDeLaPlanilla(planilla, fecha);
  if (!dia || !['entrada', 'salida', 'nota'].includes(nombre)) return;
  planilla.cambios.set(fecha, { ...valorDelDia(dia, planilla.cambios.get(fecha)), [nombre]: comoTexto(campo.value) });
  if (nombre === 'entrada') campo.setAttribute('data-vacio', comoTexto(campo.value).trim() === '' ? '1' : '0');
  if (planilla.errores.delete(fecha)) sinErrorDeLosDias(planilla);
  actualizarLaFilaDeLaPlanilla(fecha);
  pintarLaSumaDeLaPlanilla();
}

// Si ya no queda ningún día con error, el aviso de los días marcados se va
function sinErrorDeLosDias(planilla) {
  if (planilla.errores.size > 0 || !planilla.avisoDeLosDias) return;
  planilla.aviso = '';
  planilla.avisoDeLosDias = false;
  pintarElAvisoDeLaPlanilla(planilla);
}

// Una fila mientras se escribe, sin reemplazarla: sus horas, la raya de lo cambiado, el aviso del servidor (a la vista, y en la
// descripción de la salida, solo mientras el día no cambió) y, si ya no tiene error, sin su error ni aria-invalid
function actualizarLaFilaDeLaPlanilla(fecha) {
  const planilla = pagina.planilla;
  const fila = porId(`mp-dia-${fecha}`);
  const dia = diaDeLaPlanilla(planilla, fecha);
  if (!fila || !dia) return;
  const cambio = planilla.cambios.get(fecha);
  const cambiada = cambio !== undefined && fechasCambiadas(new Map([[fecha, cambio]]), new Map([[fecha, dia]])).length > 0;
  const horas = porId(`mp-h-${fecha}`);
  if (horas) horas.innerHTML = htmlDeLasHorasDeLaFila(dia, valorDelDia(dia, cambio));
  fila.classList.toggle('cambiado', cambiada);
  const aviso = porId(`mp-a-${fecha}`);
  if (aviso) aviso.hidden = cambiada;
  const conError = planilla.errores.has(fecha);
  const error = porId(`mp-e-${fecha}`);
  if (error && !conError) error.hidden = true;
  for (const control of fila.querySelectorAll('[data-campo]')) {
    if (!conError) control.removeAttribute('aria-invalid');
    const ids = comoTexto(control.getAttribute('aria-describedby')).split(/\s+/)
      .filter((uno) => uno !== '' && uno !== `mp-a-${fecha}` && (conError || uno !== `mp-e-${fecha}`));
    if (aviso && !cambiada && control.getAttribute('data-campo') === 'salida') ids.push(`mp-a-${fecha}`);
    if (ids.length > 0) control.setAttribute('aria-describedby', ids.join(' '));
    else control.removeAttribute('aria-describedby');
  }
}

// Enter en una salida o en una nota lleva a la salida del día siguiente que se carga; en la última, a «Guardar» (spec, sección 4).
// Con Alt, Ctrl, Cmd o Mayúsculas, no se toca
function alApretarEnLaPlanilla(evento) {
  if (evento.key !== 'Enter' || evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
  const campo = evento.target?.closest?.('#mp-dias [data-campo]');
  const nombre = campo?.getAttribute('data-campo');
  if (nombre !== 'salida' && nombre !== 'nota') return;
  evento.preventDefault?.();
  const salidas = [...porId('mp-dias').querySelectorAll('[data-campo="salida"]')];
  const lugar = salidas.findIndex((salida) => salida.getAttribute('data-fecha') === campo.getAttribute('data-fecha'));
  const siguiente = lugar === -1 ? null : (salidas[lugar + 1] ?? null);
  (siguiente ?? porId('mp-guardar')).focus?.();
}

// Un clic en los días: «Nota» o «Quitar» (mientras guarda, nada)
function alTocarLaPlanilla(evento) {
  if (!pagina.planilla || pagina.planilla.guardando) return;
  const nota = evento.target?.closest?.('[data-nota]');
  if (nota) {
    alternarLaNota(nota.getAttribute('data-nota'));
    return;
  }
  const quitar = evento.target?.closest?.('[data-quitar]');
  if (quitar) quitarElDia(quitar.getAttribute('data-quitar'));
}

// «Nota» abre el campo de la nota debajo de la fila, con el foco; otra vez, lo cierra (la nota escrita queda a la vista) y el foco
// vuelve al botón. Mientras guarda, nada
function alternarLaNota(fecha) {
  const planilla = pagina.planilla;
  if (!planilla || planilla.guardando) return;
  const abrir = !planilla.notasAbiertas.has(fecha);
  if (abrir) planilla.notasAbiertas.add(fecha);
  else planilla.notasAbiertas.delete(fecha);
  pintarLaPlanilla();
  const fila = porId(`mp-dia-${fecha}`);
  (fila?.querySelector(abrir ? '[data-campo="nota"]' : '[data-nota]') ?? fila?.querySelector('[data-nota]'))?.focus?.();
}

// «Quitar» un día (un sábado o domingo, o la salida de antes de un día de licencia): lo saca de los sumados y, si tenía algo
// guardado, se borra al guardar (`{ quitar: true }`); si no, su cambio se va. El foco va a «Guardar». Mientras guarda, nada
function quitarElDia(fecha) {
  const planilla = pagina.planilla;
  if (!planilla || planilla.guardando) return;
  const guardado = valoresDeLaSalida(diaDeLaPlanilla(planilla, fecha));
  planilla.agregados.delete(fecha);
  if (guardado.entrada !== '' || guardado.salida !== '' || guardado.nota !== '') planilla.cambios.set(fecha, { quitar: true });
  else planilla.cambios.delete(fecha);
  planilla.notasAbiertas.delete(fecha);
  if (planilla.errores.delete(fecha)) sinErrorDeLosDias(planilla);
  pintarLaPlanilla();
  porId('mp-guardar').focus?.();
}

// «Sumar el día»: el sábado o domingo elegido (sin elegir, el primero) aparece en su semana, con el foco en su entrada; uno guardado
// que se había quitado vuelve con lo guardado. Mientras guarda, nada
function sumarElDia() {
  const planilla = pagina.planilla;
  const datos = planilla?.meses.get(planilla.mes);
  const selector = porId('mp-finde');
  if (!datos || !selector || planilla.guardando) return;
  const fecha = comoTexto(selector.value) || comoTexto(selector.querySelector('option')?.getAttribute('value'));
  if (!finesDeSemanaParaSumar(datos, planilla).some((dia) => dia.fecha === fecha)) return;
  planilla.agregados.add(fecha);
  if (planilla.cambios.get(fecha)?.quitar === true) planilla.cambios.delete(fecha);
  pintarLaPlanilla();
  const fila = porId(`mp-dia-${fecha}`);
  fila?.scrollIntoView?.({ block: 'center' });
  fila?.querySelector('[data-campo="entrada"]')?.focus?.();
}

// Las flechas del mes («anterior» o «siguiente»: los meses que dice el servidor; mientras llega uno, nada). El mes que se elige se
// anuncia en la planilla; si la flecha que se usó se apagó (el primer mes o el en curso), el foco pasa a la otra. Mientras guarda,
// nada
async function irAlMesDeLaPlanilla(cual) {
  const planilla = pagina.planilla;
  const boton = porId(cual === 'anterior' ? 'mp-anterior' : 'mp-siguiente');
  const otra = porId(cual === 'anterior' ? 'mp-siguiente' : 'mp-anterior');
  const destino = planilla?.meses.get(planilla.mes)?.[cual];
  if (!planilla || planilla.guardando || planilla.cargando !== null || boton.disabled || !esMesDeTexto(destino)) return;
  if (!(await cargarMesDeLaPlanilla(destino)) || pagina.planilla !== planilla) return;
  anunciarEnLaPlanilla(porId('mp-mes-titulo').textContent);
  const activo = document.activeElement;
  if (boton.disabled && !otra.disabled && (!activo || activo === document.body || activo === boton)) otra.focus?.();
}

// PUT /mi-espacio/salidas, con un fetch propio (como pedirWordDeLicencia): API.pedirJson no da los errores de cada día de un 400
// (`errores`, `[{ fecha, campo, mensaje }]`) y api.js no cambia. Devuelve la respuesta; con un error del servidor, tira un Error con
// su `status`, su mensaje y sus `errores`; sin respuesta, el del navegador (sin status)
async function pedirGuardarLaPlanilla(cuerpo) {
  const response = await fetch(`${CONFIG.API_URL}/mi-espacio/salidas`, {
    method: 'PUT', headers: Auth.getAuthHeaders(), body: JSON.stringify(cuerpo)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(esObjeto(data) && conTexto(data.error) ? data.error : '');
    error.status = response.status;
    error.errores = esObjeto(data) ? listaDe(data.errores) : [];
    throw error;
  }
  return esObjeto(data) ? data : {};
}

/**
 * «Guardar» (spec, sección 4): sin cambios, cierra; con más de MAXIMO_DIAS_POR_GUARDADO días, lo dice arriba del cuerpo. Controla
 * los días cambiados con las copias (erroresDeLaPlanilla) y, si alguno falla, no pide nada: los marca (marcarLosDias). Si no, manda
 * todos los días cambiados de todos los meses juntos; al responder bien cierra, avisa (aviso y #me-anuncio, como los demás) y vuelve
 * a pedir el Resumen y la pestaña. Mientras guarda, «Guardar» queda deshabilitado, el modal no se cierra (un doble clic manda un
 * solo pedido) y la planilla no acepta cambios (pintarElGuardadoDeLaPlanilla: lo que se escribiera no iría en el PUT); al responder,
 * todo vuelve, antes de mostrar el error (el foco tiene que poder ir al día). Un error del servidor con días va a esos días; sin
 * días, arriba del cuerpo, con el foco en «Guardar»
 */
async function guardarPlanilla() {
  const planilla = pagina.planilla;
  if (!planilla || planilla.guardando) return;
  const porFecha = diasPorFechaDe(planilla.meses.values());
  const fechas = fechasCambiadas(planilla.cambios, porFecha);
  if (fechas.length === 0) {
    cerrarModal('modal-planilla');
    return;
  }
  if (fechas.length > MAXIMO_DIAS_POR_GUARDADO) {
    avisarSinLosDias(planilla, MENSAJES_FORMULARIOS.muchosDias);
    return;
  }
  const errores = erroresDeLaPlanilla(planilla.cambios, porFecha);
  if (errores.size > 0) {
    marcarLosDias(planilla, errores);
    return;
  }
  planilla.guardando = true;
  pintarElGuardadoDeLaPlanilla(planilla);
  let respuesta = null;
  let falla = null;
  try {
    respuesta = await pedirGuardarLaPlanilla(cuerpoDeLaPlanilla(planilla.cambios, fechas));
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    planilla.guardando = false;
    pintarElGuardadoDeLaPlanilla(planilla);
  }
  if (falla === null) {
    cerrarModal('modal-planilla');
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } else if (falla.status === 401) irAlLogin();
  else if (pagina.planilla === planilla) mostrarFallaDeLaPlanilla(planilla, falla, porFecha);
}

// Un error del servidor al guardar: los días de `errores` que están en la planilla, en sus filas; sin ninguno, el mensaje arriba
// del cuerpo (sin respuesta, MENSAJE_SIN_CONEXION)
function mostrarFallaDeLaPlanilla(planilla, falla, porFecha) {
  const errores = new Map();
  for (const error of listaDe(falla?.errores)) {
    if (esFechaDeTexto(error.fecha) && porFecha.has(error.fecha) && !errores.has(error.fecha) && conTexto(error.mensaje)) {
      errores.set(error.fecha, { campo: comoTexto(error.campo), mensaje: error.mensaje });
    }
  }
  if (errores.size > 0) marcarLosDias(planilla, errores);
  else avisarSinLosDias(planilla, motivoDeLaFalla(falla, MENSAJE_NO_SE_GUARDO));
}

// Un aviso de la planilla sin días marcados (los que había se van), arriba del cuerpo, con el foco en «Guardar» (se anuncia aunque
// sea el mismo de antes: avisoQueSeAnuncia)
function avisarSinLosDias(planilla, mensaje) {
  planilla.errores = new Map();
  avisoQueSeAnuncia(planilla, mensaje);
  planilla.avisoDeLosDias = false;
  pintarLaPlanilla();
  pintarElAvisoDeLaPlanilla(planilla);
  porId('mp-guardar').focus?.();
}

// Los días con error (de la página o del servidor), cada uno en su fila, con «Revisá el día marcado.» arriba del cuerpo y el foco en
// el primero por fecha; si es de otro mes, la planilla pasa a ese mes (Review Focus 4), y se anuncia. Un mes que se estaba pidiendo
// se descarta (al llegar, no cambia el mes ni se lleva el foco del error) y el aviso se anuncia aunque sea el mismo de antes
function marcarLosDias(planilla, errores) {
  soltarElMesPedido(planilla);
  planilla.errores = errores;
  avisoQueSeAnuncia(planilla, textoDeLosErroresDeLaPlanilla(errores.size));
  planilla.avisoDeLosDias = true;
  const [primero] = [...errores.keys()].sort();
  const mes = primero.slice(0, 7);
  if (mes !== planilla.mes && planilla.meses.has(mes)) {
    mostrarMesYaPedido(planilla, mes);
    anunciarEnLaPlanilla(porId('mp-mes-titulo').textContent);
  } else pintarLaPlanilla();
  (controlDelError(primero, errores.get(primero)) ?? porId('mp-guardar')).focus?.();
}

// El control de un día con error: su campo (uno que no es de la fila, la salida); en una fila sin campos, su «Quitar» o la fila
// misma (htmlDeLaFilaDeLaPlanilla la deja recibir el foco). Un día que no se ve, null
function controlDelError(fecha, error) {
  const fila = porId(`mp-dia-${fecha}`);
  if (!fila) return null;
  const campo = ['entrada', 'salida', 'nota'].includes(error?.campo) ? error.campo : 'salida';
  return fila.querySelector(`[data-campo="${campo}"]`) ?? fila.querySelector('[data-campo="salida"]')
    ?? fila.querySelector('[data-quitar]') ?? (fila.getAttribute('tabindex') === '-1' ? fila : null);
}

/**
 * Salir de la planilla (la ×, «Cancelar» o Escape; `desde`, el control que se usó o el que tenía el foco): sin cambios, se cierra;
 * con cambios, pregunta en la confirmación de la página («¿Salir sin guardar?» / «Los cambios de 3 días se pierden.»): «Seguir
 * cargando» (con el foco) vuelve a donde estaba, sin perder nada, y «Salir sin guardar» cierra y descarta. Mientras guarda, nada
 */
function pedirSalirDeLaPlanilla(desde = null) {
  const planilla = pagina.planilla;
  if (!planilla || planilla.guardando) return;
  const cantidad = fechasDeLaPlanilla(planilla).length;
  if (cantidad === 0) {
    cerrarModal('modal-planilla');
    return;
  }
  pedirConfirmacion({
    titulo: '¿Salir sin guardar?', texto: textoDeSalirSinGuardar(cantidad),
    volverA: desde && porId('modal-planilla').contains(desde) ? desde : porId('mp-guardar'), formulario: 'modal-planilla',
    textoSi: 'Salir sin guardar', textoNo: 'Seguir cargando', alConfirmar: () => cerrarModal('modal-planilla')
  });
}

// ---- «Mis vacaciones y saldos» ----

// Abre «Mis vacaciones y saldos» (spec, sección 4) con lo que vale para el año en curso (GET /anio/:anio) y los campos de «Para
// arrancar» (GET /saldo-inicial). Si no se puede, un aviso lo dice (sin el saldo inicial, los botones de carga llevan acá: nunca
// quedan sin responder). `recargarAlCerrar`: el año se guardó y el saldo no; al cerrarlo, la página se vuelve a pedir
async function abrirSaldos(volverA = null) {
  if (pagina.saldos !== null) return;
  const anio = anioDeHoy();
  pagina.saldos = { cargando: true };
  let deEseAnio;
  let saldo;
  try {
    [{ data: deEseAnio }, { data: saldo }] = await Promise.all([
      API.pedirJson('GET', `/mi-espacio/anio/${anio}`), API.pedirJson('GET', '/mi-espacio/saldo-inicial')
    ]);
  } catch (error) {
    pagina.saldos = null;
    if (error?.status === 401) irAlLogin();
    else avisarMiEspacio(MENSAJE_SIN_SALDOS, 'error');
    return;
  }
  if (!esObjeto(deEseAnio) || !esObjeto(saldo) || !Array.isArray(saldo.campos)) {
    pagina.saldos = null;
    avisarMiEspacio(comoTexto(saldo?.mensaje) || comoTexto(deEseAnio?.mensaje) || MENSAJE_SIN_SALDOS, 'warning');
    return;
  }
  const dias = DIAS_VACACIONES.includes(deEseAnio.dias_vacaciones) ? deEseAnio.dias_vacaciones : null;
  pagina.saldos = {
    anio, campos: saldo.campos, camposDelModal: saldo.campos, textos: deEseAnio.textos_mitades, guardando: false,
    recargarAlCerrar: false
  };
  const modalidad = pagina.resumen?.modalidad?.texto;
  porId('ms-modalidad').innerHTML = conTexto(modalidad)
    ? `Modalidad: <b>${esc(modalidad)}</b> <span class="me-opcional">(la carga administración en Configuración → Usuarios)</span>` : '';
  porId('ms-modalidad').hidden = !conTexto(modalidad);
  porId('ms-dias-rotulo').textContent = `Días de la licencia ${String(anio)}`;
  porId('ms-dias-opciones').innerHTML = htmlDeDiasDeVacaciones(dias);
  // Sin días elegidos todavía (la primera vez), los estudios tampoco; si no, null es «No estudio»
  porId('ms-estudios-opciones').innerHTML = htmlDeEstudios(dias === null ? undefined : (deEseAnio.estudios ?? ''));
  pintarCamposDelSaldo(valoresDelSaldo(saldo.campos));
  limpiarErrores('saldos');
  porId('ms-guardar').disabled = false;
  abrirModal('modal-saldos', { volverA, foco: () => controlDeFoco('ms-dias'), alCerrar: cerrarSaldos });
}

// Al cerrar «Mis vacaciones y saldos» guardado a medias (con «Cancelar», la × o Escape), los días del año nuevos ya están en la
// base: la página se vuelve a pedir, después de que el foco vuelva al botón que lo abrió (respaldoDelFoco lo busca)
function cerrarSaldos() {
  const recargar = pagina.saldos?.recargarAlCerrar === true;
  pagina.saldos = null;
  if (recargar) Promise.resolve().then(volverAPedirTodo);
}

// Lo elegido en el modal: los días (o null) y los estudios (la carrera, null por «No estudio» o undefined si no eligió)
const diasElegidos = () => {
  const dias = Number(porId('ms-dias').querySelector('input:checked')?.value);
  return DIAS_VACACIONES.includes(dias) ? dias : null;
};
const estudiosElegidos = () => {
  const elegido = porId('ms-estudios').querySelector('input:checked');
  if (!elegido) return undefined;
  return conTexto(elegido.value) ? elegido.value : null;
};
const valoresEscritosDelSaldo = () => Object.fromEntries([...porId('ms-campos').querySelectorAll('[data-saldo]')]
  .map((campo) => [campo.dataset.saldo, campo.value]));

// «Para arrancar» con lo elegido arriba (camposConLoElegido) y lo escrito, y la ayuda de los días: cómo se habilitan los elegidos
function pintarCamposDelSaldo(valores) {
  const saldos = pagina.saldos;
  const dias = diasElegidos();
  saldos.camposDelModal = camposConLoElegido(saldos.campos, { anio: saldos.anio, dias, estudios: estudiosElegidos() });
  porId('ms-campos').innerHTML = htmlDeCamposDelSaldo(saldos.camposDelModal, valores);
  porId('ms-dias-mitades').textContent = dias === null ? '' : comoTexto(deMapa(saldos.textos, String(dias), ''));
}

function alElegirEnLosSaldos() {
  if (pagina.saldos?.campos) pintarCamposDelSaldo(valoresEscritosDelSaldo());
}

// «Guardar»: primero los días y los estudios del año (PUT /anio/:anio) y después el saldo inicial (PUT /saldo-inicial). Si el
// segundo falla, el modal queda abierto: el año ya se guardó
async function guardarSaldos() {
  const saldos = pagina.saldos;
  const boton = porId('ms-guardar');
  if (!saldos?.campos || saldos.guardando) return;
  const dias = diasElegidos();
  const estudios = estudiosElegidos();
  const valores = valoresEscritosDelSaldo();
  const errores = [];
  if (dias === null) errores.push(['ms-dias', MENSAJES_FORMULARIOS.diasVacaciones]);
  if (estudios === undefined) errores.push(['ms-estudios', MENSAJES_FORMULARIOS.estudios]);
  for (const [clave, mensaje] of Object.entries(erroresDelSaldo(valores, saldos.camposDelModal))) {
    errores.push([`ms-campo-${clave}`, mensaje]);
  }
  if (mostrarErrores('saldos', errores)) return;
  saldos.guardando = true;
  boton.disabled = true;
  let anioGuardado = false;
  try {
    await API.pedirJson('PUT', `/mi-espacio/anio/${saldos.anio}`, { dias_vacaciones: dias, estudios });
    anioGuardado = true;
    const respuesta = await API.pedirJson('PUT', '/mi-espacio/saldo-inicial', cuerpoDelSaldo(valores, saldos.camposDelModal));
    saldos.guardando = false;
    saldos.recargarAlCerrar = false;
    cerrarModal('modal-saldos');
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    saldos.guardando = false;
    boton.disabled = false;
    if (error?.status === 401) irAlLogin();
    else if (pagina.saldos === saldos && !anioGuardado) mostrarFallaDelServidor('saldos', error, boton);
    else if (pagina.saldos === saldos) {
      // El año ya se guardó: el motivo del saldo, en su campo (si es de «Para arrancar» o de los días) y arriba del modal
      saldos.recargarAlCerrar = true;
      limpiarErrores('saldos');
      const id = porId(`ms-campo-${error?.campo}`) ? `ms-campo-${error.campo}` : deMapa(FORMULARIOS.saldos.campos, error?.campo, null);
      const motivo = motivoDeLaFalla(error, MENSAJE_NO_SE_GUARDO);
      ponerError(id, motivo);
      avisoDelModal('saldos', `Los días del año se guardaron, pero el saldo inicial no: ${motivo.replace(/\.$/, '')}.`);
      (id ? controlDeFoco(id) : boton)?.focus?.();
    }
  } finally {
    boton.disabled = false;
  }
}

// ---- La confirmación de un borrado ----

// Abre la confirmación sobre el formulario (`formulario`, su modal): `texto`, en texto plano; «Borrar» corre `borrar`. El foco va
// a «Cancelar», que no borra nada, y vuelve a `volverA`. Para otra pregunta (salir de la planilla con cambios), los textos de los
// dos botones (`textoSi`, el que confirma, y `textoNo`, el que vuelve, con el foco; de entrada, «Borrar» y «Cancelar») y, en lugar
// de `borrar`, `alConfirmar`, lo que pasa al confirmar (sin pedir nada: se cierra la confirmación y corre)
function pedirConfirmacion({
  titulo, texto, volverA, formulario, borrar = null, alConfirmar = null, textoSi = 'Borrar', textoNo = 'Cancelar'
}) {
  pagina.confirmacion = { formulario, borrar, alConfirmar, ocupado: false };
  porId('modal-confirmar-titulo').textContent = titulo;
  porId('modal-confirmar-texto').textContent = texto;
  porId('modal-confirmar-si').textContent = textoSi;
  porId('modal-confirmar').querySelector('.modal-footer [data-cerrar]').textContent = textoNo;
  avisoDelModal('confirmar', '');
  porId('modal-confirmar-si').disabled = false;
  abrirModal('modal-confirmar', {
    volverA, foco: () => porId('modal-confirmar').querySelector('.modal-footer [data-cerrar]'),
    alCerrar: () => { pagina.confirmacion = null; }
  });
}

// «Borrar»: si sale bien, se cierran la confirmación y el formulario, se anuncia y se vuelve a pedir todo; si no, el error queda en
// la confirmación (un 404, como al guardar). Con `alConfirmar` (salir de la planilla sin guardar), se cierra la confirmación y corre
async function confirmarElBorrado() {
  const actual = pagina.confirmacion;
  const boton = porId('modal-confirmar-si');
  if (!actual || actual.ocupado) return;
  if (typeof actual.alConfirmar === 'function') {
    cerrarModal('modal-confirmar');
    actual.alConfirmar();
    return;
  }
  actual.ocupado = true;
  boton.disabled = true;
  avisoDelModal('confirmar', '');
  try {
    const respuesta = await actual.borrar();
    actual.ocupado = false;
    cerrarModal('modal-confirmar');
    cerrarModal(actual.formulario);
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    actual.ocupado = false;
    boton.disabled = false;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) {
      cerrarModal('modal-confirmar');
      noEstaMas(actual.formulario, error);
    } else if (pagina.confirmacion === actual) {
      avisoDelModal('confirmar', motivoDeLaFalla(error, MENSAJE_NO_SE_BORRO));
      boton.focus?.();
    }
  } finally {
    boton.disabled = false;
  }
}

// ---- El evento (la agenda: spec 2026-10-26-mi-espacio-agenda, 1, 2 y 6) ----

// GET /mi-espacio/personas, una sola vez (si falla, se vuelve a pedir la próxima): `{ lista, motivo }`, con quiénes se puede
// compartir o, si no llegó, `lista` null y, con un 403 (un rol viejo en el navegador: ya no es administración), el mensaje del
// servidor en `motivo` («No tenés permiso para compartir eventos.»); con otra falla, ''
function personasParaCompartir() {
  pagina.personas ??= API.pedirJson('GET', '/mi-espacio/personas').then(
    ({ data }) => ({ lista: listaDe(data), motivo: '' }),
    (error) => {
      pagina.personas = null;
      if (error?.status === 401) irAlLogin();
      return { lista: null, motivo: error?.status === 403 ? comoTexto(error.message) : '' };
    }
  );
  return pagina.personas;
}

/**
 * Abre el formulario del evento: «Nuevo evento» (hoy y «2 horas antes») o «Editar evento» con uno propio (`item`, de lo que llegó de
 * GET /mi-espacio/eventos). Sin modalidad se abre igual (decisión del usuario, 27/10/2026). «¿Quién lo ve?» y las personas, solo
 * con Auth.isAdmin() (el true literal): el lector y el colaborador tienen solo eventos personales, y no piden la lista. El foco va
 * a «Qué» y, al cerrar, vuelve a `volverA`
 */
function abrirEvento({ item = null, volverA = null } = {}) {
  if (pagina.evento !== null) return;
  const puedeCompartir = Auth.isAdmin?.() === true;
  const valores = valoresDelEvento(item, { fecha: Utils.hoyEnArgentina() });
  const formulario = {
    item, valores, puedeCompartir, guardando: false, temporizador: null, pedidoDelAviso: 0, lista: null,
    sinLista: puedeCompartir ? 'cargando' : null, motivoSinLista: ''
  };
  pagina.evento = formulario;
  porId('modal-evento-titulo').textContent = item ? 'Editar evento' : 'Nuevo evento';
  for (const campo of ['titulo', 'fecha', 'desde', 'hasta', 'detalle']) porId(`ev-${campo}`).value = valores[campo];
  porId('ev-recordatorio').innerHTML = htmlDeOpcionesDeRecordatorio(valores.recordatorio);
  porId('ev-recordatorio').value = valores.recordatorio;
  porId('ev-grupo-quien').hidden = !puedeCompartir;
  porId('ev-borrar').hidden = item === null;
  porId('ev-guardar').disabled = false;
  limpiarErrores('evento');
  pintarQuienLoVe();
  // Cuándo sale su aviso: el que llegó con el evento, mientras se pide de nuevo (pudo pasar el día)
  mostrarAvisoDelEvento(item && valores.recordatorio !== 'ninguno' ? item.aviso?.texto : '');
  programarAvisoDelEvento();
  abrirModal('modal-evento', { volverA, foco: () => porId('ev-titulo'), alCerrar: cerrarFormularioDeEvento });
  if (puedeCompartir) {
    personasParaCompartir().then(({ lista, motivo }) => {
      if (pagina.evento !== formulario) return;
      formulario.lista = lista;
      formulario.sinLista = lista === null ? 'fallo' : null;
      formulario.motivoSinLista = motivo;
      pintarPersonas();
    });
  }
}

// Al cerrar el formulario, lo que esperaba se descarta
function cerrarFormularioDeEvento() {
  clearTimeout(pagina.evento?.temporizador);
  pagina.evento = null;
}

// Lo que dice el formulario abierto: lo escrito y lo elegido con los botones
const valoresDelFormularioDeEvento = (formulario) => ({
  ...formulario.valores, titulo: porId('ev-titulo').value, fecha: porId('ev-fecha').value, desde: porId('ev-desde').value,
  hasta: porId('ev-hasta').value, detalle: porId('ev-detalle').value, recordatorio: porId('ev-recordatorio').value
});

// Debajo del recordatorio de un evento compartido
const AYUDA_DEL_RECORDATORIO_COMPARTIDO = 'Les llega a todas las personas del evento.';

// «Solo yo» o «Compartido» (aria-pressed) y, si es compartido, con quién y que el recordatorio les llega a todos. Esa ayuda la
// describe el select (aria-describedby), que la lee aunque esté oculta: en uno personal, además de ocultarse, se vacía
function pintarQuienLoVe() {
  const { valores, puedeCompartir } = pagina.evento;
  const compartido = puedeCompartir && valores.compartido;
  porId('ev-solo').setAttribute('aria-pressed', String(!valores.compartido));
  porId('ev-compartido').setAttribute('aria-pressed', String(valores.compartido));
  porId('ev-grupo-personas').hidden = !compartido;
  const ayuda = porId('ev-recordatorio-ayuda');
  ayuda.textContent = compartido ? AYUDA_DEL_RECORDATORIO_COMPARTIDO : '';
  ayuda.hidden = !compartido;
  pintarPersonas();
}

function pintarPersonas() {
  const formulario = pagina.evento;
  if (!formulario) return;
  porId('ev-personas').innerHTML = htmlDePersonasDelEvento(personasParaElegir(formulario.lista, formulario.valores), formulario.valores,
    { sinLista: formulario.sinLista, motivo: formulario.motivoSinLista });
  porId('ev-personas-cuantas').textContent = textoDeCuantasPersonas(formulario.valores);
}

function elegirQuienLoVe(compartido) {
  const formulario = pagina.evento;
  if (!formulario || formulario.guardando) return;
  formulario.valores = { ...formulario.valores, compartido };
  ponerError('ev-personas', null);
  pintarQuienLoVe();
}

// Un clic en una persona (o en «Todos»): la lista se vuelve a dibujar y el foco queda en la que se tocó
function alTocarUnaPersona(evento) {
  const formulario = pagina.evento;
  const boton = evento.target?.closest?.('[data-persona]');
  if (!formulario || formulario.guardando || !boton || boton.disabled) return;
  const valor = boton.getAttribute('data-persona');
  formulario.valores = elegirPersona(formulario.valores, valor);
  ponerError('ev-personas', null);
  pintarPersonas();
  porId('ev-personas').querySelector(`[data-persona="${valor}"]`)?.focus?.();
}

// Cuándo sale el recordatorio, debajo del select (lo describe: no es una región viva); sin nada que decir, oculto
function mostrarAvisoDelEvento(texto) {
  const aviso = porId('ev-aviso');
  aviso.textContent = comoTexto(texto);
  aviso.hidden = aviso.textContent === '';
}

// Cambió la fecha, la hora o el recordatorio: el aviso que se veía ya no vale, y se vuelve a pedir
function alCambiarElCuando() {
  if (!pagina.evento) return;
  mostrarAvisoDelEvento('');
  programarAvisoDelEvento();
}

// El aviso se pide 300 ms después del último cambio (sin una fecha y una hora que sirvan, o con «Sin aviso», no se pide); lo que
// estaba en vuelo queda viejo
function programarAvisoDelEvento() {
  const formulario = pagina.evento;
  if (!formulario) return;
  clearTimeout(formulario.temporizador);
  formulario.pedidoDelAviso += 1;
  const ruta = pedidoDelAviso(valoresDelFormularioDeEvento(formulario));
  if (ruta === null) return;
  formulario.temporizador = setTimeout(() => pedirAvisoDelEvento(formulario, ruta), ESPERA_DEL_CALCULO);
}

// GET /mi-espacio/eventos/aviso: el texto del servidor (con los feriados). Una respuesta vieja (el formulario cambió o se cerró
// mientras) se descarta; si falla, no se dice nada (el error, si lo hay, sale al guardar)
async function pedirAvisoDelEvento(formulario, ruta) {
  if (pagina.evento !== formulario) return;
  const pedido = formulario.pedidoDelAviso;
  const vigente = () => pagina.evento === formulario && pedido === formulario.pedidoDelAviso;
  try {
    const { data } = await API.pedirJson('GET', ruta);
    if (vigente()) mostrarAvisoDelEvento(esObjeto(data) ? data.texto : '');
  } catch (error) {
    if (!vigente()) return;
    if (error?.status === 401) irAlLogin();
    else mostrarAvisoDelEvento('');
  }
}

// «Guardar»: los errores antes de pedir nada; si no, POST o PUT. Mientras, «Guardar» queda deshabilitado y el modal no se cierra: un
// doble clic manda un solo pedido (dos eventos compartidos mandarían dos invitaciones). Al guardar, se cierra, se avisa lo que dijo el
// servidor y se vuelve a pedir todo (la agenda y el Resumen)
async function guardarEvento() {
  const formulario = pagina.evento;
  const boton = porId('ev-guardar');
  if (!formulario || formulario.guardando) return;
  const valores = valoresDelFormularioDeEvento(formulario);
  if (mostrarErrores('evento', conSusControles('evento', erroresDelEvento(valores, Utils.hoyEnArgentina())))) return;
  const cuerpo = cuerpoDelEvento(valores, { puedeCompartir: formulario.puedeCompartir });
  formulario.guardando = true;
  boton.disabled = true;
  try {
    const respuesta = formulario.item
      ? await API.pedirJson('PUT', `/mi-espacio/eventos/${encodeURIComponent(formulario.item.id)}`, cuerpo)
      : await API.pedirJson('POST', '/mi-espacio/eventos', cuerpo);
    formulario.guardando = false;
    cerrarModal('modal-evento');
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    formulario.guardando = false;
    boton.disabled = false;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) noEstaMas('modal-evento', error);
    else if (pagina.evento === formulario) mostrarFallaDelServidor('evento', error, boton);
  } finally {
    boton.disabled = false;
  }
}

// «Borrar el evento»: la confirmación, sobre el formulario, con lo guardado (no lo que se está escribiendo)
function pedirBorrarEvento() {
  const formulario = pagina.evento;
  if (!formulario?.item || formulario.guardando) return;
  const { item } = formulario;
  pedirConfirmacion({
    titulo: 'Borrar el evento', texto: textoDeConfirmacionDeEvento(item, { hoy: Utils.hoyEnArgentina() }), volverA: porId('ev-borrar'),
    formulario: 'modal-evento', borrar: () => API.pedirJson('DELETE', `/mi-espacio/eventos/${encodeURIComponent(item.id)}`)
  });
}

// ---- El detalle de un evento ajeno ----

/**
 * Abre el detalle de un evento que compartió otra persona (spec, sección 2; maqueta 2, #evento-ajeno): el título (con textContent),
 * cuándo es, el detalle, quién lo creó y quiénes están, y «Mi recordatorio», con el foco. Solo quien lo creó puede cambiarlo.
 * `recargarAlCerrar`: «Mi recordatorio» cambió; la agenda se vuelve a pedir al cerrar, después de que el foco vuelva al evento
 * (mientras está abierto, volver a dibujar la agenda dejaría a `volverA` fuera de la página)
 */
function abrirEventoAjeno({ item, volverA = null }) {
  if (pagina.eventoAjeno !== null) return;
  const partes = htmlDelEventoAjeno(item);
  const elegido = miRecordatorioDe(item);
  pagina.eventoAjeno = { item, elegido, guardando: false, recargarAlCerrar: false };
  porId('modal-evento-ajeno-titulo').textContent = comoTexto(item.titulo);
  porId('mea-cuando').innerHTML = partes.cuando;
  porId('mea-detalle').innerHTML = partes.detalle;
  porId('mea-detalle').hidden = partes.detalle === '';
  porId('mea-quien').innerHTML = partes.quien;
  const select = porId('mea-recordatorio');
  select.innerHTML = partes.opciones;
  select.value = elegido;
  select.disabled = false;
  mostrarAvisoAjeno(item.aviso?.texto, elegido);
  avisoDelModal('eventoAjeno', '');
  abrirModal('modal-evento-ajeno', { volverA, foco: () => porId('mea-recordatorio'), alCerrar: cerrarEventoAjeno });
}

function cerrarEventoAjeno() {
  const recargar = pagina.eventoAjeno?.recargarAlCerrar === true;
  pagina.eventoAjeno = null;
  if (recargar) Promise.resolve().then(volverAPedirTodo);
}

// Cuándo sale «Mi recordatorio» (el texto del servidor); apagado, nada
function mostrarAvisoAjeno(texto, elegido) {
  const aviso = porId('mea-aviso');
  aviso.textContent = elegido === 'evento' ? comoTexto(texto) : '';
  aviso.hidden = aviso.textContent === '';
}

// «Mi recordatorio»: el PUT enseguida (el evento no cambia). Mientras, el select queda deshabilitado y el detalle no se cierra; si
// sale bien, se anuncia y se dice cuándo sale; si falla, el select vuelve a lo de antes y el error va arriba del detalle (un 404,
// como al guardar). El foco vuelve al select
async function guardarMiRecordatorio() {
  const ajeno = pagina.eventoAjeno;
  const select = porId('mea-recordatorio');
  if (!ajeno || ajeno.guardando || select.value === ajeno.elegido) return;
  const elegido = select.value;
  ajeno.guardando = true;
  select.disabled = true;
  avisoDelModal('eventoAjeno', '');
  try {
    const respuesta = await API.pedirJson('PUT', `/mi-espacio/eventos/${encodeURIComponent(ajeno.item.id)}/mi-recordatorio`,
      { sin_aviso: elegido === 'ninguno' });
    ajeno.guardando = false;
    ajeno.elegido = elegido;
    ajeno.recargarAlCerrar = true;
    select.disabled = false;
    mostrarAvisoAjeno(respuesta?.data?.aviso?.texto, elegido);
    avisarLaRespuesta(respuesta);
    select.focus?.();
  } catch (error) {
    ajeno.guardando = false;
    select.disabled = false;
    select.value = ajeno.elegido;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) {
      // noEstaMas ya vuelve a pedir todo: cerrar el detalle no lo pide otra vez (aunque antes un cambio haya salido bien)
      ajeno.recargarAlCerrar = false;
      noEstaMas('modal-evento-ajeno', error);
    } else if (pagina.eventoAjeno === ajeno) {
      avisoDelModal('eventoAjeno', motivoDeLaFalla(error, MENSAJE_NO_SE_GUARDO));
      select.focus?.();
    }
  }
}

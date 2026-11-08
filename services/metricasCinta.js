// El recorrido típico de la pestaña Métricas como datos (spec 2026-11-08-metricas-recorrido-tipico, 4 y 5): cuánto lleva un pedido,
// desde el pedido de la DDPC hasta la publicación en el portal, con las cifras del circuito (la mediana o el promedio de cada tramo, los
// Tramo de vistaDe en services/metricasReglas.js) una detrás de la otra. Es «la línea con hitos»: los tramos a escala (la redacción y la
// respuesta en la externa, la producción en la interna), cada uno con su ancho; la preparación y carga al final, de ancho fijo y fuera
// de escala, y el Portal; arriba, el total, que suma las cifras de los tramos (una referencia, no la duración de un caso), y debajo, el
// aviso anticipado, que va por fuera: corre junto con el primer tramo y no se suma al total.
// Todo lo arma el servidor (Ruling 19): los textos, los plurales, los porcentajes, los anchos, la x del vencimiento y el largo de la
// regla del aviso. La foto del 31/12 guarda las cuatro combinaciones ya armadas (services/metricasFoto.js), y solo la dibuja la página
// (htmlDeCinta, en public/js/reportes.js), que imprime lo que llega sin calcular nada: el PDF de Métricas y el Informe anual no la llevan.
// Funciones puras: ninguna tira error, y lo que no se puede leer cuenta como sin cifra.
import { unidadDe, cantidadDeLasDos, SIN_NOTAS_DGMIT, GESTIONES } from './metricasReglas.js';

// La forma del objeto: la página no dibuja una cinta sin ella (una de otra forma, como la de una foto vieja, oculta la sección)
export const FORMA_DE_LA_CINTA = 'recorrido';

// Los tramos de cada gestión en el orden del circuito, con quién actúa (el color de la banda de «El circuito»: la DGMIT en violeta, el
// área en verde azulado y la DDPC en tinta). La carga es siempre la última y va fuera de escala; el aviso no está: va aparte
const CADENA = Object.freeze({
  externa: Object.freeze([
    Object.freeze({ clave: 'tramite', actor: 'dgmit' }),
    Object.freeze({ clave: 'respuesta', actor: 'area' }),
    Object.freeze({ clave: 'carga', actor: 'ddpc' })
  ]),
  interna: Object.freeze([
    Object.freeze({ clave: 'produccion', actor: 'dgmit' }),
    Object.freeze({ clave: 'carga', actor: 'ddpc' })
  ])
});
const FUERA_DE_ESCALA = 'carga';
// Un tramo sin cifra se dibuja en gris
const SIN_ACTOR = 'gris';

// Los textos (spec, 4), al pie de la letra
const TITULO = 'El recorrido típico';
const bajadaDe = (gestion) =>
  `Cuánto lleva un pedido de la gestión ${gestion}, desde el pedido de la DDPC hasta la publicación en el portal.`;
const TOTAL_ANTES = 'En total, unos ';
const TOTAL_EN_EL_DIA = Object.freeze({ antes: 'En total, ', cifra: 'en el día', despues: '' });
const SIN_TOTAL = Object.freeze({ antes: 'El total se completa cuando haya casos de todos los tramos', cifra: '', despues: '' });
const EN_EL_DIA = 'en el día';
const GRANDE_EN_EL_DIA = 'En el día';
const SIN_CASOS = 'Sin casos';
const SE_COMPLETA = 'se completa cuando haya casos';
const SE_COMPLETA_SIN_NOTAS_DGMIT = 'se completa cuando haya notas DGMIT cargadas';
const SIN_CASOS_TODAVIA = 'sin casos todavía';
const MENOS_DEL_UNO = 'menos del 1 %';
const PORTAL = Object.freeze({ nombre: 'Portal', texto: 'datos publicados' });
const ROTULO_DEL_AVISO = 'Aviso anticipado:';
const AVISO_EN_EL_DIA = 'el mismo día del vencimiento';
const ANTES_DEL_VENCIMIENTO = ' antes del vencimiento';
const VENCIMIENTO = 'vencimiento';
const ORIENTATIVO = 'con tan pocos casos, es orientativo.';
const ACLARACION = Object.freeze({
  mediana: 'El total suma las medianas de cada tramo: es una referencia, no la duración de un caso.',
  promedio: 'El total suma los promedios de cada tramo: es una referencia, no la duración de un caso.'
});

// Un tramo a escala de menos de este ancho (en % de la zona a escala) no lleva nada arriba de su línea (la lista lleva sus cifras), y
// la lista va siempre
const ANGOSTA = 12;
// Lo que ocupa un tramo sin cifra: el 70 % de lo que suman los tramos con cifra, y al menos 1 día
const LUGAR_SIN_CIFRA = 0.7;
const LUGAR_MINIMO = 1;

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const suma = (valores) => valores.reduce((total, valor) => total + valor, 0);
// Dos decimales, sin el −0 de Math.round
const redondear = (valor) => {
  const redondeado = Math.round(valor * 100) / 100;
  return redondeado === 0 ? 0 : redondeado;
};
const conMinuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);
const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Unos días: 0 o más y finitos; si no, null (sin cifra)
const dias0OMas = (valor) => (Number.isFinite(valor) && valor >= 0 ? valor : null);
// La cifra de un tramo (`cifra.valor`) y sus hábiles (`habiles.valor`, los que trae en la vista en corridos)
const valorDe = (tramo) => dias0OMas(esObjeto(tramo) && esObjeto(tramo.cifra) ? tramo.cifra.valor : null);
const habilesDe = (tramo) => dias0OMas(esObjeto(tramo) && esObjeto(tramo.habiles) ? tramo.habiles.valor : null);
const nombreDe = (tramo) => (esObjeto(tramo) && typeof tramo.nombre === 'string' ? tramo.nombre.trim() : '');
const orientativo = (tramo) => esObjeto(tramo) && esObjeto(tramo.cifra) && tramo.cifra.orientativo === true;
const sinNotasDgmit = (tramo) => esObjeto(tramo) && esObjeto(tramo.vacio) && tramo.vacio.titulo === SIN_NOTAS_DGMIT;

// «Nombre: texto»; sin nombre (un tramo que no se puede leer), el texto solo, con mayúscula
const conNombre = (nombre, texto) => (nombre === '' ? conMayuscula(texto) : `${nombre}: ${texto}`);

// Los porcentajes de unos días (con un total de más de 0), redondeados por el resto mayor para que sumen 100: cada uno se queda con su
// parte entera y lo que falta va de a 1 a los de resto más grande (a igual resto, al primero en la cadena). Un tramo de 0 días no recibe
// nada. El resto se cuenta con `%` sobre 100 × días, que con días enteros es exacto
const porcentajesDe = (valores) => {
  const total = suma(valores);
  const partes = valores.map((valor, i) => {
    const resto = (100 * valor) % total;
    return { i, valor, resto, entero: Math.round((100 * valor - resto) / total) };
  });
  let faltan = 100 - suma(partes.map((p) => p.entero));
  const enOrden = partes.filter((p) => p.valor > 0).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const parte of enOrden) {
    if (faltan <= 0) break;
    parte.entero += 1;
    faltan -= 1;
  }
  return partes.map((p) => p.entero);
};

// Los anchos de los tramos a escala, en % con dos decimales: cada uno por sus días; uno sin cifra, el 70 % de lo que suman los que
// tienen (al menos 1 día); todos en 0, partes iguales. El último absorbe el redondeo, para que sumen 100
const anchosDe = (aEscala) => {
  const lugarSinCifra = Math.max(LUGAR_SIN_CIFRA * suma(aEscala.filter((t) => t.valor !== null).map((t) => t.valor)), LUGAR_MINIMO);
  let pesos = aEscala.map((t) => t.valor ?? lugarSinCifra);
  if (pesos.every((peso) => peso === 0)) pesos = pesos.map(() => 1);
  const total = suma(pesos);
  const anchos = [];
  pesos.forEach((peso, i) => {
    anchos.push(i === pesos.length - 1 ? redondear(100 - suma(anchos)) : redondear((100 * peso) / total));
  });
  return anchos;
};

// El recorrido típico de una gestión, o null si no se dibuja (`tramos` no es una lista, o ningún tramo del circuito, sin contar el
// aviso, tiene cifra). `tramos`: los de vistaDe para la gestión (circuito.externa o circuito.interna), de los que se lee `clave`,
// `nombre`, `cifra.valor`, `cifra.orientativo`, `habiles.valor` y `vacio.titulo`; `opciones`: { gestion: 'externa' (la de entrada) |
// 'interna', dias: 'habiles' (los de entrada) | 'corridos', estadistico: 'mediana' (el de entrada) | 'promedio' }. Devuelve:
//   { forma: 'recorrido', titulo, bajada,
//     total: { antes, cifra, despues },                          // la cifra va en negrita
//     partes: [{ clave, actor, ancho, angosta, grande, nombre, dias }],  // los tramos a escala, en orden; los anchos suman 100
//     carga: { clave: 'carga', actor, grande, nombre, dias },     // de ancho fijo, al final
//     portal: { nombre: 'Portal', texto: 'datos publicados' },
//     vencimiento: { x } | null,                                  // % de la zona a escala
//     aviso: { rotulo: 'Aviso anticipado:', texto, ancho, sigue, vencimiento },  // ancho: % de la zona a escala, o null sin regla
//     orientativos: [texto], lista: [{ actor, nombre, texto }], lista_siempre, aclaracion, descripcion }
// `actor`: 'dgmit', 'area', 'ddpc' o 'gris' (sin cifra). En la vista en corridos, los días van con los hábiles entre paréntesis
// (cantidadDeLasDos); en la de hábiles, «N días hábiles». Los porcentajes, solo en la externa con todos los tramos con cifra y un total
// de más de 0; un tramo de 0 días no lleva («En el día»).
export const cintaDeMetricas = (tramos, opciones) => {
  if (!Array.isArray(tramos)) return null;
  const o = esObjeto(opciones) ? opciones : {};
  const gestion = o.gestion === 'interna' ? 'interna' : 'externa';
  const dias = o.dias === 'corridos' ? 'corridos' : 'habiles';
  const estadistico = o.estadistico === 'promedio' ? 'promedio' : 'mediana';

  // Cada tramo con lo que se lee de él: su cifra y, en la vista en corridos, sus hábiles (null si no se pueden leer)
  const leer = (clave, actor) => {
    const tramo = tramos.find((t) => esObjeto(t) && t.clave === clave) ?? null;
    const valor = valorDe(tramo);
    return {
      clave, tramo, valor, nombre: nombreDe(tramo),
      actor: valor === null ? SIN_ACTOR : actor,
      habiles: valor !== null && dias === 'corridos' ? habilesDe(tramo) : null
    };
  };
  const cadena = CADENA[gestion].map(({ clave, actor }) => leer(clave, actor));
  if (cadena.every((t) => t.valor === null)) return null;
  const aviso = leer('aviso', null);
  const aEscala = cadena.filter((t) => t.clave !== FUERA_DE_ESCALA);
  const carga = cadena.find((t) => t.clave === FUERA_DE_ESCALA);

  // Los días de un tramo con cifra: «38 días corridos (25 hábiles)», «25 días hábiles» o, con 0, «en el día»
  const cuantos = (t) => {
    if (t.valor === 0) return EN_EL_DIA;
    return dias === 'corridos' ? cantidadDeLasDos(t.valor, t.habiles) : `${t.valor} ${unidadDe(t.valor, dias)}`;
  };
  // Lo que los hábiles agregan después de los corridos (« (25 hábiles)»): solo en la vista en corridos, con los hábiles y más de 0 días
  const loQueAgreganLosHabiles = (valor, habiles) => {
    if (dias !== 'corridos' || habiles === null || valor === 0) return '';
    const corridos = `${valor} ${unidadDe(valor, 'corridos')}`;
    const conLosDos = cantidadDeLasDos(valor, habiles);
    return conLosDos.startsWith(corridos) ? conLosDos.slice(corridos.length) : '';
  };

  // El total: con todos los tramos con cifra, la suma, y los hábiles si todos los traen
  const completa = cadena.every((t) => t.valor !== null);
  const sumaTotal = completa ? suma(cadena.map((t) => t.valor)) : null;
  const habilesTotales = completa && cadena.every((t) => t.habiles !== null) ? suma(cadena.map((t) => t.habiles)) : null;
  let total = SIN_TOTAL;
  if (sumaTotal === 0) total = TOTAL_EN_EL_DIA;
  else if (sumaTotal !== null) {
    total = {
      antes: TOTAL_ANTES,
      cifra: `${sumaTotal} ${unidadDe(sumaTotal, dias)}`,
      despues: loQueAgreganLosHabiles(sumaTotal, habilesTotales)
    };
  }

  // Los porcentajes, solo en la externa completa y con un total de más de 0; un tramo de 0 días no lleva
  const porcentajes = gestion === 'externa' && sumaTotal !== null && sumaTotal > 0 ? porcentajesDe(cadena.map((t) => t.valor)) : null;
  const porcentajeDe = (t) => {
    if (porcentajes === null || t.valor === 0) return null;
    const porcentaje = porcentajes[cadena.indexOf(t)];
    return porcentaje === 0 ? MENOS_DEL_UNO : `${porcentaje} %`;
  };

  // Lo que va arriba de un tramo: la cifra grande (el porcentaje o los días) y, debajo del nombre, sus días o lo que falta
  const arribaDe = (t) => {
    if (t.valor === null) return { grande: SIN_CASOS, dias: sinNotasDgmit(t.tramo) ? SE_COMPLETA_SIN_NOTAS_DGMIT : SE_COMPLETA };
    if (t.valor === 0) return { grande: GRANDE_EN_EL_DIA, dias: '' };
    const porcentaje = porcentajeDe(t);
    if (porcentaje !== null) return { grande: porcentaje, dias: cuantos(t) };
    return { grande: `${t.valor} ${unidadDe(t.valor, dias)}`, dias: loQueAgreganLosHabiles(t.valor, t.habiles).trim() };
  };
  // Los días de un tramo en la lista y en la descripción, con su porcentaje (separado por `separador`) si lleva
  const diasConPorcentaje = (t, separador) => {
    if (t.valor === null) return SIN_CASOS_TODAVIA;
    const porcentaje = porcentajeDe(t);
    return porcentaje === null ? cuantos(t) : `${cuantos(t)}${separador}${porcentaje}`;
  };

  const anchos = anchosDe(aEscala);
  const partes = aEscala.map((t, i) => {
    const { grande, dias: debajo } = arribaDe(t);
    return { clave: t.clave, actor: t.actor, ancho: anchos[i], angosta: anchos[i] < ANGOSTA, grande, nombre: t.nombre, dias: debajo };
  });
  const deLaCarga = arribaDe(carga);

  // El vencimiento y la regla del aviso: solo con el aviso y todos los tramos de la cadena con cifra, la carga también (spec, 4: con un
  // tramo sin casos no hay vencimiento). El vencimiento cae donde termina el aviso, contado desde el inicio (al final de la zona a escala
  // si cae dentro de la carga); si cae después de la publicación (`sigue`), la regla llega hasta el final, sin vencimiento
  const conRegla = aviso.valor !== null && completa;
  const sigue = conRegla && aviso.valor > sumaTotal;
  const diasAEscala = conRegla ? suma(aEscala.map((t) => t.valor)) : 0;
  let x = null;
  if (conRegla && !sigue) x = diasAEscala === 0 ? 100 : redondear(Math.min(100, (100 * aviso.valor) / diasAEscala));
  let textoDelAviso;
  if (aviso.valor === null) textoDelAviso = SIN_CASOS_TODAVIA;
  else if (aviso.valor === 0) textoDelAviso = AVISO_EN_EL_DIA;
  else if (sigue) {
    const antes = aviso.valor - sumaTotal;
    textoDelAviso = `${cuantos(aviso)}; la publicación llega ${antes} ${unidadDe(antes, dias)}${ANTES_DEL_VENCIMIENTO}`;
  } else if (!conRegla) textoDelAviso = `${cuantos(aviso)}${ANTES_DEL_VENCIMIENTO}`;
  else textoDelAviso = cuantos(aviso);

  const descripcion = [
    `El recorrido típico de un pedido de la gestión ${gestion}: ${conMinuscula(`${total.antes}${total.cifra}${total.despues}`)}.`,
    ...cadena.map((t) => `${conNombre(t.nombre, diasConPorcentaje(t, ', '))}.`),
    `${ROTULO_DEL_AVISO} ${textoDelAviso}${x !== null && aviso.valor > 0 ? ANTES_DEL_VENCIMIENTO : ''}.`
  ].join(' ');

  return {
    forma: FORMA_DE_LA_CINTA,
    titulo: TITULO,
    bajada: bajadaDe(gestion),
    total: { ...total },
    partes,
    carga: { clave: carga.clave, actor: carga.actor, grande: deLaCarga.grande, nombre: carga.nombre, dias: deLaCarga.dias },
    portal: { ...PORTAL },
    vencimiento: x === null ? null : { x },
    aviso: {
      rotulo: ROTULO_DEL_AVISO,
      texto: textoDelAviso,
      ancho: sigue ? 100 : x,
      sigue,
      vencimiento: x === null ? '' : VENCIMIENTO
    },
    orientativos: [aviso, ...cadena].filter((t) => t.valor !== null && orientativo(t.tramo)).map((t) => conNombre(t.nombre, ORIENTATIVO)),
    lista: cadena.map((t) => ({ actor: t.actor, nombre: t.nombre, texto: diasConPorcentaje(t, ' · ') })),
    lista_siempre: partes.some((p) => p.angosta),
    aclaracion: sumaTotal === null ? '' : ACLARACION[estadistico],
    descripcion
  };
};

// Los recorridos de una vista (la de vistaDe con `estadistico` y `dias`): { externa, interna }, cada uno el de cintaDeMetricas con el
// circuito de su gestión (null si no se dibuja). Así los guarda la foto (services/metricasFoto.js) y así los manda la API de métricas en
// vivo (controllers/metricasController.js). Nunca tira: sin vista, los dos null.
export const cintasDeLaVista = (vista, opciones) => {
  const { estadistico, dias } = esObjeto(opciones) ? opciones : {};
  const circuito = esObjeto(vista) && esObjeto(vista.circuito) ? vista.circuito : {};
  return Object.fromEntries(GESTIONES.map((gestion) => [gestion, cintaDeMetricas(circuito[gestion], { gestion, dias, estadistico })]));
};

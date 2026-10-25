// El PDF «Métricas del año» (spec 2026-10-24-metricas-y-reportes, 5 y 2): lo mismo que la pestaña Métricas para el año elegido, con el
// diseño de los anexos (5.1; maqueta 6-reportes-datos-reales.html). Son cuatro partes, cada una desde una hoja nueva:
// 1. el circuito de cada gestión, en un recuadro con el borde azul, los resultados del año y «Cómo se cuenta»;
// 2. las cintas del recorrido típico de las dos gestiones y, si hay, los casos destildados;
// 3. el contexto (el índice mes a mes y la antigüedad de los vencidos) y el trabajo del RPAD;
// 4. el ranking de áreas y los datasets por tema y por frecuencia.
// La píldora dice la combinación de los selectores y lo destildado («Mediana en días hábiles · con todos los datasets»); el pie,
// «Métricas del RPAD · AAAA · Hoja k de N». Dibuja con la base de los reportes (reportesPdfBase.js) lo que manda el servidor: los datos
// de metricasDe (controllers/metricasController.js, los de GET /api/metricas) con los mismos textos que imprime la pestaña
// (public/js/reportes.js). No recalcula ninguna regla: solo arma las cintas desde el circuito de la vista, con la letra del PDF
// (OPCIONES_CINTA_PDF), también en un año con foto (la foto guarda las de la pantalla). Puro: sin pool (los tests lo llaman sin base).
import {
  COLOR, IZQUIERDA, CONTENIDO, NORMAL, NEGRITA, ASCENDENTE, DESCENDENTE, desdeBase, ajustar, escribir, renglon, filete
} from './notasDigitalesAnexo.js';
import { mesYAnio } from './notasDigitalesCalendario.js';
import { COLORES, VIOLETA, dibujarRayado } from './seguimientoPdf.js';
import { cintasDeLaVista } from './metricasCinta.js';
import { ESTADISTICOS, DIAS, GESTIONES } from './metricasReglas.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, dibujarJuntos, prepararTitulo, prepararPildora, prepararTarjetas, prepararSeccion,
  prepararParrafo, prepararRecuadro, prepararTabla, fechaCorta, ENTRE, ANCHO_DEL_RECUADRO
} from './reportesPdfBase.js';

// La cinta del PDF se calcula con esta letra (la opción de cintaDeMetricas, services/metricasCinta.js): el dibujo de 1000 de ancho se
// escala al ancho útil de la hoja (U puntos por unidad) y las letras de la pantalla (6,6 por letra) escaladas no se leerían; con 8 por
// letra, la de LETRA.cinta entra en lo que la cinta midió. Como OPCIONES_CINTA_PDF del Seguimiento (services/seguimientoPdf.js)
export const OPCIONES_CINTA_PDF = Object.freeze({ letra: 8 });
const U = CONTENIDO / 1000;

// Letras (en puntos)
const LETRA = {
  nodo: 7.4, nodoRol: 6.2, cifra: 12, cifraMin: 9, unidad: 6.6, vacio: 7.4, vacioMin: 6.6, debajo: 6.4, orientativo: 6.2, nombre: 7,
  chico: 6.4, insignia: 6.2, aclaracion: 7, columna: 8, heroe: 16, heroeMin: 12, de: 7.5, texto: 7, mini: 7, barra: 7, pie: 7,
  cinta: 7, eje: 6.8, leyenda: 7, indice: 6.5
};

const OJO = ASCENDENTE + DESCENDENTE;
const VERDE = COLORES.verde;
const AMBAR = COLORES.ambar;
// La barra de la antigüedad de los vencidos, en ámbar (la de la pantalla: .mt-barras i.ambar)
const BARRA_AMBAR = '#E2B23A';
const COLOR_DE_LA_CINTA = Object.freeze({ tinta: COLOR.tinta, violeta: VIOLETA, verde: VERDE });

// Los textos fijos de la pestaña (public/reportes.html y public/js/reportes.js): la página los escribe en su HTML y en reportes.js, y el
// PDF los toma de acá (también las funciones de abajo que arman lo mismo que la pestaña: textoDelDesglose, textoDeLoQueFalta,
// textoDeDondeSale, textoDelMesManual, textoSinManuales y textoDelPieDeLosCasos). tests/reportes-frontend.test.js comprueba que son los
// de la pestaña: si cambia uno allá, falla
export const TEXTOS_DE_LA_PESTANA = Object.freeze({
  estadisticos: Object.freeze({ mediana: 'Mediana', promedio: 'Promedio' }),
  dias: Object.freeze({ habiles: 'días hábiles', corridos: 'días corridos' }),
  bajada: Object.freeze({
    habiles: 'Los días son hábiles: de lunes a viernes, sin los feriados nacionales fijos.',
    corridos: 'Los días son corridos: todos los días del calendario.'
  }),
  pieDelCircuito: 'Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio» o «Días corridos», cada cifra lo dice debajo.',
  orientativo: 'con tan pocos casos, es orientativo',
  seCuentaHasta: 'Se cuenta hasta que se registra la actualización.',
  // Lo que hace cada nodo del circuito
  roles: Object.freeze({
    rpad: 'Datos Públicos avisa', da: 'Mandan la nota formal', dit: 'Hacen el relevamiento', area: 'Prepara los datos',
    ddpc: 'Limpia y estructura', portal: 'Datos publicados'
  }),
  // Qué es cada marca de la cinta, en su leyenda
  leyenda: Object.freeze({
    aviso: 'Aviso del RPAD', nota: 'Nota DGMIT recibida por el área',
    datos: Object.freeze({ externa: 'Datos entregados', interna: 'Relevamiento entregado' }),
    carga: 'Carga en el portal', 'datos-y-carga': 'Entrega y carga juntas', rayado: 'Después del vencimiento'
  }),
  titulos: Object.freeze({
    resultados: 'Resultados del año', aTiempo: 'Actualizados a tiempo', cobertura: 'Cobertura del aviso', reiteraciones: 'Reiteraciones por ciclo',
    contexto: 'Contexto', indice: 'Índice de actualización, mes a mes', antiguedad: 'Antigüedad de los vencidos', trabajo: 'El trabajo del RPAD',
    porMes: 'Por mes', manuales: 'Métricas manuales (las carga administración)', auditoria: 'Doble verificación', ranking: 'Ranking de áreas',
    areas: 'Áreas y temas'
  }),
  bajadaDeResultados: (anio) => `Lo que dejó el circuito en ${anio}, con las dos gestiones juntas.`,
  bajadaDelTrabajo: (anio) => `Lo que hizo el sistema y el equipo de Datos Públicos en ${anio}.`,
  aTiempo: 'Cargados en el portal hasta el día del vencimiento.',
  gruposDelRpad: Object.freeze([['ninguna', 'Ninguna'], ['una', '1'], ['dos_o_mas', '2 o más']]),
  gruposDeLaDgmit: Object.freeze([['ninguna', 'Ninguna'], ['una_o_mas', '1 o más']]),
  pieDeLasReiteraciones: 'Del RPAD a la DGMIT, los avisos de cada ciclo después del aviso de la regla (o del primero, si se avisó ya vencido); de la DGMIT al área, las notas DGMIT de reiteración.',
  pieDelIndice: 'Es el índice de la portada: al día (actualizados y próximos a vencer) sobre los que tienen vencimiento. Un punto por el primer día de cada mes, y el último, el de hoy (en un año cerrado, el 31/12).',
  antiguedad: Object.freeze(['Menos de 3 meses', 'De 3 a 12 meses', 'Más de un año']),
  pieDeLaAntiguedad: 'Por días corridos desde el vencimiento. Los eventuales y los sin fecha no tienen vencimiento.',
  series: Object.freeze([['avisos', 'Avisos y notas'], ['actualizaciones', 'Actualizaciones'], ['auditados', 'Cambios auditados']]),
  tiposManuales: Object.freeze({
    reuniones_capacitaciones: 'Reuniones y capacitaciones', consultas_atendidas: 'Consultas atendidas', notas_enviadas: 'Notas enviadas fuera del RPAD'
  }),
  pieDeLaAuditoria: 'De la propuesta a la revisión, en tiempo corrido.',
  sinAreas: 'Sin datos de áreas',
  alDia: 'Al día sobre los que tienen vencimiento'
});
const T = TEXTOS_DE_LA_PESTANA;
// Lo que el PDF suma a la pestaña, que lo dice con su diseño: las siglas de los nodos (la hoja no tiene lugar para los nombres
// enteros) y desde cuándo cuenta un tramo
const SIGLAS = 'En los circuitos, DA es la Dirección Administrativa; DIT, la Dirección de Investigación Territorial, y DDPC, la Dirección de Datos Públicos y Comunicación.';
const EN_EL_ANIO = 'Un tramo cuenta en el año en que terminó.';

// Los nodos del circuito (spec 2.2), con la sigla de quien es (la maqueta de los PDF) y qué hace: lo de la DGMIT en violeta, el Portal en
// verde y el resto en el acento
const NODOS = Object.freeze({
  rpad: { nombre: 'RPAD', rol: T.roles.rpad, color: COLOR.acento },
  da: { nombre: 'DGMIT y DA', rol: T.roles.da, color: VIOLETA },
  dit: { nombre: 'DGMIT y DIT', rol: T.roles.dit, color: VIOLETA },
  area: { nombre: 'Área', rol: T.roles.area, color: COLOR.acento },
  ddpc: { nombre: 'DDPC', rol: T.roles.ddpc, color: COLOR.acento },
  portal: { nombre: 'Portal', rol: T.roles.portal, color: VERDE }
});
// El circuito de cada gestión: cada nodo con la clave del tramo que sale de él (la flecha se busca por esa clave entre los tramos del
// servidor), y la parte del ancho de cada nodo y de cada flecha (la de la maqueta)
const CIRCUITO_DE_LA_GESTION = Object.freeze({
  externa: { pasos: [['rpad', 'aviso'], ['da', 'tramite'], ['area', 'respuesta'], ['ddpc', 'carga'], ['portal', null]], nodos: [0.8, 1, 0.85, 0.85, 0.75], flecha: 1.35 },
  interna: { pasos: [['rpad', 'aviso'], ['dit', 'produccion'], ['ddpc', 'carga'], ['portal', null]], nodos: [0.8, 1.1, 0.85, 0.75], flecha: 1.6 }
});
// El nodo: el relleno, el alto mínimo y el radio; la flecha: el margen a cada lado de sus textos y el aire sobre y bajo la línea
const NODO = { relleno: 3.5, alto: 30, radio: 5 };
const FLECHA = { margen: 4, sobre: 3, bajo: 4 };

// La cinta: la leyenda (las marcas, como se dibujan, y el rayado, en un orden fijo; qué es cada una, en T.leyenda)
const LEYENDA_DE_LA_CINTA = ['aviso', 'nota', 'datos', 'carga', 'datos-y-carga', 'rayado'];
const TIPOS_DE_MARCA = ['aviso', 'nota', 'datos', 'carga', 'datos-y-carga'];

// Los resultados: tres columnas, con su separación; la lista de los que no tuvieron el aviso de la regla se corta en este alto (con
// muchísimos, «y N más.»: así los resultados entran siempre en una hoja)
const SEPARACION_COLUMNAS = 14;
const ANCHO_COLUMNA = (CONTENIDO - 2 * SEPARACION_COLUMNAS) / 3;
const ALTO_MAXIMO_DE_LA_LISTA = 260;

// El trabajo del RPAD: los cinco totales (las series por mes y los grupos de las reiteraciones, en T)
const TOTALES_DEL_TRABAJO = ['avisos', 'actualizaciones', 'auditados', 'nuevos', 'fuente_publica'];

// El gráfico del índice: el alto del área de los valores (de 0 a 100 %), el lugar de los rótulos del eje a la izquierda, el de los
// valores arriba, el de los meses abajo (en dos renglones si dos se pisan) y el aire a los costados del primer y del último mes
const GRAFICO = { alto: 100, izquierda: 24, arriba: 12, abajo: 20, aire: 10 };

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const objeto = (valor) => (esObjeto(valor) ? valor : {});
const lista = (valor) => (Array.isArray(valor) ? valor : []);
const esNumero = (valor) => typeof valor === 'number' && Number.isFinite(valor);
// Un texto del servidor; lo que no es un texto ni un número, vacío (nunca «null» ni «undefined»)
const texto = (valor) => (typeof valor === 'string' ? valor : esNumero(valor) ? String(valor) : '');
const cuenta = (valor) => (esNumero(valor) ? String(valor) : '0');
const elegido = (valor, validos) => (validos.includes(valor) ? valor : validos[0]);

// =====================================================
// La píldora y lo de arriba
// =====================================================

// La combinación de los selectores y lo destildado (spec 1.5 y 1.7), con lo que manda el servidor (`datos`: { estadistico, dias,
// sin_titulos }): «Mediana en días hábiles · con todos los datasets» o «… · calculado sin 1 dataset: Parque Automotor»
export const textoDeLaPildora = (datos) => {
  const d = objeto(datos);
  const estadistico = elegido(d.estadistico, ESTADISTICOS);
  const dias = elegido(d.dias, DIAS);
  const titulos = lista(d.sin_titulos).filter((titulo) => typeof titulo === 'string' && titulo);
  const cuales = titulos.length === 0 ? 'con todos los datasets'
    : `calculado sin ${titulos.length === 1 ? '1 dataset' : `${titulos.length} datasets`}: ${titulos.join(', ')}`;
  return `${T.estadisticos[estadistico]} en ${T.dias[dias]} · ${cuales}`;
};

// El rótulo de cada parte: «Métricas · año 2026, en curso» o, en un año cerrado, «Métricas · año 2026, al 31/12/2026»
const rotuloDelAnio = (d) => (lista(d.anios).at(-1) === d.anio
  ? `Métricas · año ${d.anio}, en curso`
  : `Métricas · año ${d.anio}, al ${fechaCorta(d.al)}`);

// De dónde sale un año cerrado (lo que dice la barra de la pestaña): el aviso de la foto que falta (del servidor) o la foto del 31/12;
// en vivo, nada
export const textoDeDondeSale = (datos) => {
  const d = objeto(datos);
  if (texto(d.aviso_foto)) return texto(d.aviso_foto);
  return d.en_vivo === false ? `Sale de la foto del ${fechaCorta(d.al)}, calculada con todos los datasets.` : '';
};

// El desglose de «Actualizados a tiempo» por gestión: «Externa: 4 de 27 · Interna: 1 de 6»
export const textoDelDesglose = (aTiempo) => {
  const a = objeto(aTiempo);
  return [['externa', 'Externa'], ['interna', 'Interna']]
    .map(([clave, nombre]) => `${nombre}: ${cuenta(lista(a[clave])[0])} de ${cuenta(lista(a[clave])[1])}`).join(' · ');
};

// Un vencimiento sin el aviso de la regla, en la cobertura: «Listado de Proveedores (vencimiento 31/01/2026), se avisó ya vencido»
export const textoDeLoQueFalta = (falta) => {
  const f = objeto(falta);
  return `${texto(f.titulo)} (vencimiento ${fechaCorta(f.venc)}), ${texto(f.motivo)}`;
};

// El mes de una métrica manual: «Marzo 2026»
export const textoDelMesManual = (mes, anio) => {
  const m = Number(mes);
  if (!Number.isInteger(m) || m < 1 || m > 12) return String(anio);
  const nombre = mesYAnio(`${anio}-${String(m).padStart(2, '0')}-01`);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
};

// Sin métricas manuales en el año: «Todavía no hay métricas manuales cargadas en 2026.»
export const textoSinManuales = (anio) => `Todavía no hay métricas manuales cargadas en ${anio}.`;

// Lo que va debajo de la lista de casos: «Debajo de cada fecha, los días hábiles del tramo o su estado.»
export const textoDelPieDeLosCasos = (dias) => `Debajo de cada fecha, los ${T.dias[elegido(dias, DIAS)]} del tramo o su estado.`;

// =====================================================
// Piezas: lo que va adentro de un recuadro o de una columna ({ alto, dibujar(y, x) })
// =====================================================

// Un texto ajustado a `ancho` en hasta `lineas` líneas (se achica hasta `min`; si no entra, se corta con "…"). Sin texto, null
const pieza = (doc, valor, { ancho, tamano, min = tamano, fuente = NORMAL, color = COLOR.gris, lineas = 2, align = 'left' }) => {
  const t = texto(valor);
  if (!t) return null;
  const ajuste = ajustar(doc, t, { ancho, lineas, max: tamano, min, fuente });
  return { alto: ajuste.alto, dibujar: (y, x) => escribir(doc, ajuste, x, y, color, align === 'left' ? {} : { align }) };
};

// Las piezas una debajo de la otra, con `entre` puntos entre cada dos (las null no van)
const apilar = (piezas, entre = 2) => {
  const hay = piezas.filter(Boolean);
  const alto = hay.reduce((total, p) => total + p.alto, 0) + entre * Math.max(0, hay.length - 1);
  return {
    alto,
    dibujar: (y, x) => {
      let yPieza = y;
      for (const p of hay) {
        p.dibujar(yPieza, x);
        yPieza += p.alto + entre;
      }
    }
  };
};

// Una pieza del ancho útil como elemento de la base (para dibujarJuntos): dibujar(y) → la y de lo que sigue
const comoElemento = (p) => ({
  alto: p.alto,
  dibujar: (y) => {
    p.dibujar(y, IZQUIERDA);
    return y + p.alto + ENTRE;
  }
});

// El contorno de un rectángulo redondeado, con líneas y curvas: los nodos del circuito, las insignias y los tramos de la cinta van
// adentro de otro dibujo, y un roundedRect sería, para el test de diagramación, un bloque encimado con su recuadro (la marca del
// Seguimiento tampoco lo usa). Devuelve el documento, para pintarlo
const KAPPA = 0.5523;
const contorno = (doc, x, y, ancho, alto, radio) => {
  const r = Math.max(0, Math.min(radio, ancho / 2, alto / 2));
  const c = r * (1 - KAPPA);
  return doc.moveTo(x + r, y).lineTo(x + ancho - r, y).bezierCurveTo(x + ancho - c, y, x + ancho, y + c, x + ancho, y + r)
    .lineTo(x + ancho, y + alto - r).bezierCurveTo(x + ancho, y + alto - c, x + ancho - c, y + alto, x + ancho - r, y + alto)
    .lineTo(x + r, y + alto).bezierCurveTo(x + c, y + alto, x, y + alto - c, x, y + alto - r)
    .lineTo(x, y + r).bezierCurveTo(x, y + c, x + c, y, x + r, y).closePath();
};

// Un número grande con lo que va al lado en la misma línea de base («27» + «días hábiles», «5» + «de 33 ciclos»); si los dos no entran
// en `ancho`, lo de al lado va debajo (la unidad nunca se corta en dos renglones)
const piezaDeCifra = (doc, { numero, lado }, { ancho, tamano, min, tamanoLado, color, colorLado = COLOR.gris, fuenteLado = NEGRITA }) => {
  const grande = ajustar(doc, texto(numero), { ancho, lineas: 1, max: tamano, min, fuente: NEGRITA });
  const anchoGrande = doc.font(NEGRITA).fontSize(grande.tamano).widthOfString(grande.texto);
  const deLado = texto(lado);
  const chico = deLado ? ajustar(doc, deLado, { ancho, lineas: 2, max: tamanoLado, min: tamanoLado, fuente: fuenteLado }) : null;
  const anchoChico = chico ? doc.font(fuenteLado).fontSize(tamanoLado).widthOfString(chico.texto) : 0;
  const alLado = chico !== null && chico.alto <= doc.font(fuenteLado).fontSize(tamanoLado).currentLineHeight(true) + 0.01
    && anchoGrande + 2.5 + anchoChico <= ancho;
  const alto = grande.alto + (chico && !alLado ? chico.alto : 0);
  return {
    alto,
    dibujar: (y, x) => {
      escribir(doc, grande, x, y, color);
      if (!chico) return;
      if (alLado) {
        // En la misma línea de base que el número
        const base = y + ASCENDENTE * grande.tamano;
        escribir(doc, chico, x + anchoGrande + 2.5, base - ASCENDENTE * tamanoLado, colorLado);
      } else {
        escribir(doc, chico, x, y + grande.alto, colorLado);
      }
    }
  };
};

// La insignia de quién está a cargo de un tramo (nunca solo el color): el texto en negrita en una píldora blanca
const piezaDeInsignia = (doc, valor, { ancho, color }) => {
  const t = texto(valor);
  if (!t) return null;
  const tamano = LETRA.insignia;
  const alto = 10;
  const anchoTexto = Math.min(ancho - 8, doc.font(NEGRITA).fontSize(tamano).widthOfString(t) + 1);
  return {
    alto,
    dibujar: (y, x) => {
      doc.save();
      contorno(doc, x, y, anchoTexto + 8, alto, alto / 2).fill(COLOR.blanco);
      doc.restore();
      renglon(doc, t, x + 4, y + (alto - ASCENDENTE * tamano) / 2, { ancho: anchoTexto, tamano, fuente: NEGRITA, color });
    }
  };
};

// Barras horizontales ([texto, cantidad], cada una relativa a la más larga), con el texto a la izquierda y la cantidad a la derecha
const piezaDeBarras = (doc, filas, { ancho, anchoTexto, color = COLOR.acento }) => {
  const valores = filas.map(([, n]) => (esNumero(n) ? n : 0));
  const maximo = Math.max(0, ...valores);
  const anchoCantidad = 22;
  const largo = ancho - anchoTexto - anchoCantidad - 8;
  const renglones = filas.map(([t], i) => {
    const etiqueta = ajustar(doc, texto(t), { ancho: anchoTexto, lineas: 2, max: LETRA.barra, min: LETRA.barra });
    return { etiqueta, valor: valores[i], alto: Math.max(etiqueta.alto, 9) + 3 };
  });
  return {
    alto: renglones.reduce((total, r) => total + r.alto, 0),
    dibujar: (y, x) => {
      let yRenglon = y;
      for (const r of renglones) {
        escribir(doc, r.etiqueta, x, yRenglon, COLOR.tinta);
        const centro = yRenglon + (ASCENDENTE * LETRA.barra) / 2;
        const largoBarra = maximo > 0 ? (r.valor * largo) / maximo : 0;
        if (largoBarra > 0) doc.rect(x + anchoTexto + 4, centro - 3.5, largoBarra, 7).fill(color);
        renglon(doc, String(r.valor), x + ancho - anchoCantidad, yRenglon, { ancho: anchoCantidad, tamano: LETRA.barra, fuente: NEGRITA, align: 'right' });
        yRenglon += r.alto;
      }
    }
  };
};

// El medidor: una barra fina con el porcentaje del servidor lleno (sin porcentaje, no va)
const piezaDeMedidor = (doc, porcentaje, ancho) => {
  if (!esNumero(porcentaje)) return null;
  const lleno = (Math.min(100, Math.max(0, porcentaje)) * ancho) / 100;
  return {
    alto: 4,
    dibujar: (y, x) => {
      doc.rect(x, y, ancho, 4).fill(COLOR.linea);
      if (lleno > 0) doc.rect(x, y, lleno, 4).fill(COLOR.acento);
    }
  };
};

// =====================================================
// El circuito
// =====================================================

// Un nodo: su sigla en su color y lo que hace, centrados
const nodoDe = (doc, clave, ancho) => {
  const nodo = NODOS[clave];
  const anchoTexto = ancho - 2 * NODO.relleno;
  return {
    color: nodo.color,
    contenido: apilar([
      pieza(doc, nodo.nombre, { ancho: anchoTexto, tamano: LETRA.nodo, min: LETRA.nodo - 1, fuente: NEGRITA, color: nodo.color, lineas: 2, align: 'center' }),
      pieza(doc, nodo.rol, { ancho: anchoTexto, tamano: LETRA.nodoRol, min: LETRA.nodoRol - 0.5, color: COLOR.gris, lineas: 3, align: 'center' })
    ], 1.5)
  };
};

// La flecha de un tramo (un Tramo de vistaDe), con lo que manda el servidor, como htmlDeFlecha de la pestaña: arriba de la línea, la
// cifra con su unidad al lado y el estadístico con los ciclos debajo («27» + «días hábiles», «mediana de 32 ciclos»; con 0, «En el día»
// y «mediana en días hábiles», con los ciclos debajo de la línea), «con tan pocos casos, es orientativo» o, sin cifra, por qué
// (`vacio.titulo`), y el nombre del tramo; debajo, «desde → hasta», los pendientes de carga de la DGMIT, los en curso (con «Se cuenta
// hasta que se registra la actualización.») y la insignia de quién está a cargo. Lo de la DGMIT en violeta; sin cifra, la línea punteada
const flechaDe = (doc, tramo, ancho) => {
  const t = objeto(tramo);
  const cifra = esObjeto(t.cifra) ? t.cifra : null;
  const vacio = cifra === null && esObjeto(t.vacio) ? t.vacio : null;
  const dgmit = t.dgmit === true;
  const tinta = cifra === null ? COLOR.gris : dgmit ? VIOLETA : COLOR.tinta;
  const anchoTexto = ancho - 2 * FLECHA.margen;
  const chico = (valor, { color = COLOR.gris, fuente = NORMAL, lineas = 3, tamano = LETRA.chico } = {}) =>
    pieza(doc, valor, { ancho: anchoTexto, tamano, fuente, color, lineas });
  const arriba = apilar([
    cifra
      ? piezaDeCifra(doc, { numero: cifra.texto, lado: cifra.unidad }, {
        ancho: anchoTexto, tamano: LETRA.cifra, min: LETRA.cifraMin, tamanoLado: LETRA.unidad, color: tinta
      })
      : pieza(doc, vacio?.titulo, { ancho: anchoTexto, tamano: LETRA.vacio, min: LETRA.vacioMin, fuente: NEGRITA, color: COLOR.gris, lineas: 3 }),
    cifra ? chico(cifra.debajo, { fuente: NEGRITA, color: dgmit ? VIOLETA : COLOR.gris, tamano: LETRA.debajo, lineas: 2 }) : null,
    cifra?.orientativo === true ? chico(T.orientativo, { fuente: NEGRITA, color: AMBAR, tamano: LETRA.orientativo }) : null,
    pieza(doc, t.nombre, { ancho: anchoTexto, tamano: LETRA.nombre, fuente: NEGRITA, color: tinta, lineas: 2 })
  ], 1);
  const deLaDgmit = t.clave === 'tramite';
  let pendientes = null;
  if (vacio && texto(vacio.texto)) {
    pendientes = chico(vacio.texto, deLaDgmit ? { color: VIOLETA, fuente: NEGRITA, lineas: 5 } : { lineas: 5 });
  } else if (texto(t.pendientes_texto)) {
    pendientes = chico(t.pendientes_texto, { color: VIOLETA, fuente: NEGRITA, lineas: 5 });
  }
  const enCurso = esObjeto(t.en_curso) && texto(t.en_curso.texto)
    ? [chico(t.en_curso.texto, { color: AMBAR, fuente: NEGRITA, lineas: 6 }), chico(T.seCuentaHasta)] : [];
  const abajo = apilar([
    chico(t.desde_hasta, { lineas: 2 }),
    cifra?.en_el_dia === true ? chico(cifra.ciclos_texto, { color: COLOR.tinta, fuente: NEGRITA, lineas: 1 }) : null,
    pendientes,
    ...enCurso,
    piezaDeInsignia(doc, t.responsable, { ancho: anchoTexto, color: dgmit ? VIOLETA : COLOR.acento })
  ], 1);
  return { arriba, abajo, color: cifra === null ? COLOR.grisClaro : dgmit ? VIOLETA : COLOR.acento, punteada: cifra === null };
};

// El circuito de una gestión (spec 2.2), del ancho de adentro de un recuadro: los nodos y, entre cada dos, la flecha de su tramo, con
// todas las líneas a la misma altura y los nodos centrados en ella. `tramos`: los de vistaDe para la gestión
const piezaDelCircuito = (doc, tramos, gestion) => {
  const { pasos, nodos: pesos, flecha } = CIRCUITO_DE_LA_GESTION[gestion];
  const unidad = ANCHO_DEL_RECUADRO / (pesos.reduce((total, p) => total + p, 0) + flecha * (pasos.length - 1));
  const tramoDe = (clave) => lista(tramos).find((t) => esObjeto(t) && t.clave === clave) ?? null;
  const nodos = [];
  const flechas = [];
  let x = 0;
  pasos.forEach(([nodo, clave], i) => {
    const anchoNodo = pesos[i] * unidad;
    nodos.push({ x, ancho: anchoNodo, ...nodoDe(doc, nodo, anchoNodo) });
    x += anchoNodo;
    if (clave === null) return;
    const anchoFlecha = flecha * unidad;
    flechas.push({ x, ancho: anchoFlecha, ...flechaDe(doc, tramoDe(clave), anchoFlecha) });
    x += anchoFlecha;
  });
  const altoNodo = Math.max(NODO.alto, ...nodos.map((n) => n.contenido.alto + 2 * NODO.relleno));
  const yLinea = Math.max(Math.max(...flechas.map((f) => f.arriba.alto)) + FLECHA.sobre, altoNodo / 2);
  const alto = Math.max(yLinea + FLECHA.bajo + Math.max(...flechas.map((f) => f.abajo.alto)), yLinea + altoNodo / 2);
  return {
    alto,
    dibujar: (y, x0) => {
      const linea = y + yLinea;
      for (const n of nodos) {
        const yNodo = linea - altoNodo / 2;
        doc.save();
        contorno(doc, x0 + n.x, yNodo, n.ancho, altoNodo, NODO.radio).lineWidth(0.9).fillAndStroke(COLOR.blanco, n.color);
        doc.restore();
        n.contenido.dibujar(yNodo + (altoNodo - n.contenido.alto) / 2, x0 + n.x + NODO.relleno);
      }
      for (const f of flechas) {
        const xFlecha = x0 + f.x;
        f.arriba.dibujar(linea - FLECHA.sobre - f.arriba.alto, xFlecha + FLECHA.margen);
        const desde = xFlecha + 2;
        const hasta = xFlecha + f.ancho - 2;
        doc.save();
        doc.lineWidth(1.4);
        if (f.punteada) doc.dash(3, { space: 2 });
        doc.moveTo(desde, linea).lineTo(hasta - 5, linea).stroke(f.color);
        doc.restore();
        doc.polygon([hasta, linea], [hasta - 5.5, linea - 3], [hasta - 5.5, linea + 3]).fill(f.color);
        f.abajo.dibujar(linea + FLECHA.bajo, xFlecha + FLECHA.margen);
      }
    }
  };
};

// Lo de adentro del recuadro de una gestión: el circuito y, debajo, sus aclaraciones (las del servidor: los avisados ya vencidos y, en
// la externa, los resueltos con una fuente pública y los de datasets que no requieren nota DGMIT; las vacías no van)
const piezaDeLaGestion = (doc, circuito, gestion) => {
  const aclaraciones = objeto(objeto(circuito.aclaraciones)[gestion]);
  const textos = [aclaraciones.ya_vencidos, aclaraciones.fuente_publica, aclaraciones.no_requieren_nota].map((a) => texto(objeto(a).texto));
  return apilar([
    piezaDelCircuito(doc, circuito[gestion], gestion),
    ...textos.map((t) => pieza(doc, t, { ancho: ANCHO_DEL_RECUADRO, tamano: LETRA.aclaracion, color: COLOR.gris, lineas: 4 }))
  ], 5);
};

// =====================================================
// Los resultados del año (las tres tarjetas de la pestaña, en tres columnas)
// =====================================================

const tituloDeColumna = (doc, t) => pieza(doc, t, { ancho: ANCHO_COLUMNA, tamano: LETRA.columna, fuente: NEGRITA, color: COLOR.tinta, lineas: 1 });
const textoDeColumna = (doc, t, { color = COLOR.tinta, tamano = LETRA.texto, lineas = 6 } = {}) => pieza(doc, t, { ancho: ANCHO_COLUMNA, tamano, color, lineas });
const heroe = (doc, valor, de) => piezaDeCifra(doc, { numero: cuenta(valor), lado: de }, {
  ancho: ANCHO_COLUMNA, tamano: LETRA.heroe, min: LETRA.heroeMin, tamanoLado: LETRA.de, color: COLOR.tinta, fuenteLado: NORMAL
});

// Actualizados a tiempo: «5 de 33 ciclos» con el medidor, qué es estar a tiempo, cuánto después se cargaron los otros y el desglose por
// gestión; sin casos, el texto del servidor
const columnaATiempo = (doc, a, t) => {
  const titulo = tituloDeColumna(doc, T.titulos.aTiempo);
  if (texto(t.vacio)) return apilar([titulo, textoDeColumna(doc, t.vacio, { color: COLOR.gris })], 5);
  const despues = texto(objeto(a.despues).texto);
  return apilar([
    titulo, heroe(doc, a.a_tiempo, t.de), piezaDeMedidor(doc, t.medidor, ANCHO_COLUMNA),
    textoDeColumna(doc, despues ? `${T.aTiempo} ${despues}` : T.aTiempo), textoDeColumna(doc, textoDelDesglose(a), { color: COLOR.gris })
  ], 4);
};

// Cobertura del aviso: «34 de 35 vencimientos» con el medidor, qué es estar avisado y los que faltan, con su vencimiento y su motivo
// (si son muchísimos, los que entran y «y N más.»); sin vencimientos, el texto del servidor
const columnaDeCobertura = (doc, c, t) => {
  const titulo = tituloDeColumna(doc, T.titulos.cobertura);
  if (texto(t.vacio)) return apilar([titulo, textoDeColumna(doc, t.vacio, { color: COLOR.gris })], 5);
  const faltan = lista(c.faltan).filter(esObjeto);
  const items = [];
  let alto = 0;
  for (const [i, f] of faltan.entries()) {
    const item = textoDeColumna(doc, textoDeLoQueFalta(f), { lineas: 2 });
    if (alto + item.alto > ALTO_MAXIMO_DE_LA_LISTA && i < faltan.length - 1) {
      items.push(textoDeColumna(doc, `y ${faltan.length - i} más.`, { color: COLOR.gris }));
      break;
    }
    items.push(item);
    alto += item.alto + 3;
  }
  return apilar([
    titulo, heroe(doc, c.si, t.de), piezaDeMedidor(doc, t.medidor, ANCHO_COLUMNA), textoDeColumna(doc, t.regla),
    ...(items.length && texto(t.faltan) ? [textoDeColumna(doc, t.faltan, { color: COLOR.gris }), apilar(items, 3)] : [])
  ], 4);
};

// Reiteraciones por ciclo: del RPAD a la DGMIT (Ninguna, 1 y 2 o más) y de la DGMIT al área (Ninguna y 1 o más), cada grupo con su
// título del servidor y, sin nada que mostrar, por qué; debajo de las del RPAD, la aclaración de los emails viejos si el servidor la manda
const columnaDeReiteraciones = (doc, r, t) => {
  const rpad = objeto(r.rpad);
  const dgmit = esObjeto(r.dgmit) ? r.dgmit : null;
  const mini = (valor, color) => pieza(doc, valor, { ancho: ANCHO_COLUMNA, tamano: LETRA.mini, fuente: NEGRITA, color, lineas: 2 });
  const barras = (grupos, datos) => piezaDeBarras(doc, grupos.map(([clave, nombre]) => [nombre, datos[clave]]), { ancho: ANCHO_COLUMNA, anchoTexto: 42 });
  const delRpad = texto(t.rpad_vacio) ? textoDeColumna(doc, t.rpad_vacio, { color: COLOR.gris }) : barras(T.gruposDelRpad, rpad);
  const deLaDgmit = texto(t.dgmit_vacio) || dgmit === null ? textoDeColumna(doc, t.dgmit_vacio, { color: COLOR.gris }) : barras(T.gruposDeLaDgmit, dgmit);
  return apilar([
    tituloDeColumna(doc, T.titulos.reiteraciones),
    mini(t.rpad, COLOR.tinta), delRpad, textoDeColumna(doc, t.aclaracion, { color: COLOR.gris, tamano: LETRA.chico }),
    mini(t.dgmit, VIOLETA), deLaDgmit, textoDeColumna(doc, T.pieDeLasReiteraciones, { color: COLOR.gris, tamano: LETRA.chico })
  ], 4);
};

// Los resultados del año (vista.resultados), con las dos gestiones juntas: tres columnas, cada una con una línea fina arriba
const piezaDeResultados = (doc, resultados) => {
  const textos = objeto(resultados.textos);
  const columnas = [
    columnaATiempo(doc, objeto(resultados.a_tiempo), objeto(textos.a_tiempo)),
    columnaDeCobertura(doc, objeto(resultados.cobertura), objeto(textos.cobertura)),
    columnaDeReiteraciones(doc, objeto(resultados.reiteraciones), objeto(textos.reiteraciones))
  ];
  const sobre = 6;
  return {
    alto: sobre + Math.max(...columnas.map((c) => c.alto)),
    dibujar: (y, x) => columnas.forEach((columna, i) => {
      const xColumna = x + i * (ANCHO_COLUMNA + SEPARACION_COLUMNAS);
      filete(doc, xColumna, y, ANCHO_COLUMNA);
      columna.dibujar(y + sobre, xColumna);
    })
  };
};

// =====================================================
// La cinta del recorrido típico (cintaDeMetricas, en el espacio de 1000 de ancho, escalada al ancho útil)
// =====================================================

// Un texto de la cinta en el lugar que le dio la cinta: (x, y) en sus unidades, con su anclaje, en la caja que midió con la letra del PDF
// (largo × OPCIONES_CINTA_PDF.letra); si la letra no entra en esa caja, se achica hasta que entre. Helvetica no tiene el signo menos de
// los números del eje: va una raya
const textoDeLaCinta = (doc, valor, x, y, anclaje, yCinta, { fuente = NEGRITA, tamano = LETRA.cinta, color = COLOR.tinta } = {}) => {
  const t = texto(valor).replace(/−/g, '–');
  if (!t) return;
  const caja = t.length * OPCIONES_CINTA_PDF.letra;
  const x0 = anclaje === 'start' ? x : anclaje === 'end' ? x - caja : x - caja / 2;
  const ancho = doc.font(fuente).fontSize(tamano).widthOfString(t);
  const letra = ancho > caja * U ? (tamano * caja * U) / ancho : tamano;
  const align = anclaje === 'start' ? 'left' : anclaje === 'end' ? 'right' : 'center';
  renglon(doc, t, IZQUIERDA + x0 * U, desdeBase(yCinta + y * U, letra), { ancho: caja * U + 0.5, tamano: letra, fuente, color, align });
};

// Una marca de la cinta centrada en (cx, cy), en puntos, como en la pantalla y en la maqueta 7 (`s`: puntos por unidad): el rombo del
// aviso, el cuadrado violeta de la nota DGMIT, el aro de los datos, el punto verde de la carga y, si la entrega y la carga van juntas, el
// punto verde con el aro tinta
const dibujarMarca = (doc, tipo, cx, cy, s) => {
  doc.save();
  switch (tipo) {
    case 'aviso': {
      const d = 7 * Math.SQRT2 * s;
      doc.polygon([cx, cy - d], [cx + d, cy], [cx, cy + d], [cx - d, cy]).fill(COLOR.tinta);
      break;
    }
    case 'nota': contorno(doc, cx - 6 * s, cy - 6 * s, 12 * s, 12 * s, 3 * s).lineWidth(1.5 * s).fillAndStroke(VIOLETA, COLOR.blanco); break;
    case 'datos': doc.circle(cx, cy, 6.5 * s).lineWidth(2.5 * s).fillAndStroke(COLOR.blanco, COLOR.tinta); break;
    case 'carga': doc.circle(cx, cy, 7 * s).lineWidth(2 * s).fillAndStroke(VERDE, COLOR.blanco); break;
    default: doc.circle(cx, cy, 8.5 * s).lineWidth(2.5 * s).fillAndStroke(VERDE, COLOR.tinta); break;
  }
  doc.restore();
};

const conX = (valor) => esObjeto(valor) && esNumero(valor.x0) && esNumero(valor.x1);

// La cinta con su tope en y (en puntos), con los datos de cintaDeMetricas tal como llegan: la línea del eje y sus números, la banda
// celeste, el rayado, el gris donde se corta la cadena (con su texto), el vencimiento, los tramos, las marcas, los rótulos y el del eje.
// Sin texto dentro de la banda (spec 2.2). Lo que no se puede leer no se dibuja
const dibujarLaCinta = (doc, cinta, y) => {
  const A = objeto(cinta.alturas);
  const banda = objeto(A.banda);
  const segmentos = objeto(A.segmentos);
  const vencimiento = objeto(A.vencimiento);
  const X = (x) => IZQUIERDA + x * U;
  const Y = (v) => y + v * U;
  if (conX(cinta.linea) && esNumero(A.linea)) {
    doc.save();
    doc.lineWidth(Math.max(0.5, U)).moveTo(X(cinta.linea.x0), Y(A.linea)).lineTo(X(cinta.linea.x1), Y(A.linea)).stroke(COLOR.linea);
    doc.restore();
  }
  for (const tick of lista(cinta.ticks).filter((t) => esObjeto(t) && esNumero(t.x))) {
    textoDeLaCinta(doc, tick.texto, tick.x, A.ticks, 'middle', y, { fuente: NORMAL, color: COLOR.gris });
  }
  if (conX(cinta.banda)) doc.rect(X(cinta.banda.x0), Y(banda.y), (cinta.banda.x1 - cinta.banda.x0) * U, banda.alto * U).fill(COLOR.acentoSuave);
  if (conX(cinta.rayado)) {
    dibujarRayado(doc, X(cinta.rayado.x0), Y(banda.y), (cinta.rayado.x1 - cinta.rayado.x0) * U, banda.alto * U, 7 * U * Math.SQRT2, 3 * U);
  }
  if (conX(cinta.gris)) {
    doc.save();
    doc.rect(X(cinta.gris.x0), Y(banda.y), (cinta.gris.x1 - cinta.gris.x0) * U, banda.alto * U).lineWidth(U).fillAndStroke(COLOR.fondo, COLOR.linea);
    doc.restore();
    textoDeLaCinta(doc, cinta.gris.texto, (cinta.gris.x0 + cinta.gris.x1) / 2, A.textoDelGris, 'middle', y, { color: COLOR.gris });
  }
  if (esObjeto(cinta.vencimiento) && esNumero(cinta.vencimiento.x)) {
    const x = X(cinta.vencimiento.x);
    doc.save();
    doc.lineWidth(1.5 * U).dash(3 * U, { space: 3 * U }).moveTo(x, Y(vencimiento.desde)).lineTo(x, Y(vencimiento.hasta)).stroke(COLOR.tinta);
    doc.restore();
    textoDeLaCinta(doc, 'vencimiento', cinta.vencimiento.x, vencimiento.texto, 'middle', y);
  }
  for (const s of lista(cinta.segmentos).filter(conX)) {
    doc.save();
    contorno(doc, X(s.x0), Y(segmentos.y), (s.x1 - s.x0) * U, segmentos.alto * U, 4 * U).fill(COLOR_DE_LA_CINTA[s.color] ?? COLOR.tinta);
    doc.restore();
  }
  for (const m of lista(cinta.marcas).filter((marca) => esObjeto(marca) && esNumero(marca.x) && TIPOS_DE_MARCA.includes(marca.tipo))) {
    dibujarMarca(doc, m.tipo, X(m.x), Y(A.marcas), U);
  }
  for (const r of lista(cinta.rotulos).filter((rotulo) => esObjeto(rotulo) && esNumero(rotulo.x) && esNumero(rotulo.y))) {
    textoDeLaCinta(doc, r.texto, r.x, r.y, r.anclaje, y, { color: COLOR_DE_LA_CINTA[r.color] ?? COLOR.tinta });
  }
  if (esObjeto(cinta.eje) && esNumero(cinta.eje.x) && esNumero(cinta.eje.y)) {
    textoDeLaCinta(doc, cinta.eje.texto, cinta.eje.x, cinta.eje.y, cinta.eje.anclaje, y, { fuente: NORMAL, tamano: LETRA.eje, color: COLOR.gris });
  }
};

// La leyenda de la cinta: solo lo que se dibuja (las marcas, como se dibujan, y el rayado), en un orden fijo, en los renglones que
// hagan falta
const piezaDeLeyenda = (doc, cinta, gestion) => {
  const hay = new Set(lista(cinta.marcas).filter(esObjeto).map((marca) => marca.tipo));
  if (conX(cinta.rayado)) hay.add('rayado');
  const items = LEYENDA_DE_LA_CINTA.filter((tipo) => hay.has(tipo)).map((tipo) => {
    const nombre = T.leyenda[tipo];
    const t = esObjeto(nombre) ? nombre[gestion] : nombre;
    return { tipo, texto: t, ancho: (tipo === 'rayado' ? 16 : 10) + 4 + doc.font(NORMAL).fontSize(LETRA.leyenda).widthOfString(t) + 1 };
  });
  const renglonDeLeyenda = 11;
  const lugares = [];
  let x = 0;
  let fila = 0;
  for (const item of items) {
    if (x > 0 && x + item.ancho > CONTENIDO) {
      fila += 1;
      x = 0;
    }
    lugares.push({ ...item, x, fila });
    x += item.ancho + 12;
  }
  return {
    alto: lugares.length === 0 ? 0 : (fila + 1) * renglonDeLeyenda,
    dibujar: (y, x0) => {
      for (const l of lugares) {
        const top = y + l.fila * renglonDeLeyenda;
        const centro = top + (ASCENDENTE * LETRA.leyenda) / 2;
        const anchoIcono = l.tipo === 'rayado' ? 16 : 10;
        if (l.tipo === 'rayado') dibujarRayado(doc, x0 + l.x, centro - 3.5, 16, 7, 3.5, 1.4);
        else dibujarMarca(doc, l.tipo, x0 + l.x + 5, centro, 0.55);
        renglon(doc, l.texto, x0 + l.x + anchoIcono + 4, top, { ancho: l.ancho - anchoIcono - 4, tamano: LETRA.leyenda, color: COLOR.gris });
      }
    }
  };
};

// La cinta de una gestión como elemento de la base: la cinta, la leyenda y la aclaración del servidor
const elementoDeLaCinta = (doc, cinta, gestion) => {
  const leyenda = piezaDeLeyenda(doc, cinta, gestion);
  const aclaracion = prepararParrafo(doc, cinta.aclaracion, { tamano: LETRA.pie });
  const altoCinta = (esNumero(cinta.alto) ? cinta.alto : 0) * U;
  const piezas = [{ alto: altoCinta, dibujar: (y) => dibujarLaCinta(doc, cinta, y) }, leyenda.alto > 0 ? leyenda : null,
    texto(cinta.aclaracion) ? aclaracion : null];
  return comoElemento(apilar(piezas, 6));
};

// =====================================================
// Los casos destildados
// =====================================================

// Una fecha con, debajo, lo que dice el servidor (los textos que no están vacíos, con « · »)
const celdaDeFecha = (dia, textos) => {
  const debajo = textos.map(texto).filter(Boolean).join(' · ');
  return debajo ? `${fechaCorta(dia)}\n${debajo}` : fechaCorta(dia);
};

// Los casos destildados (los ciclos de los datasets que no cuentan: vista.casos con `contar` false), de las dos gestiones, con las
// columnas de la lista de casos de la pestaña y la gestión; sin destildados, nada
const elementosDeLosDestildados = (doc, vista, dias) => {
  const filas = lista(vista.casos).filter((fila) => esObjeto(fila) && fila.contar === false);
  if (filas.length === 0) return [];
  const tabla = prepararTabla(doc, {
    columnas: [
      { titulo: 'Dataset', ancho: 2.9 }, { titulo: 'Gestión', ancho: 0.95 }, { titulo: 'Vencimiento', ancho: 1.15 }, { titulo: 'Aviso', ancho: 2 },
      { titulo: 'Nota DGMIT', ancho: 1.35 }, { titulo: 'Recibido el', ancho: 1.45 }, { titulo: 'Carga', ancho: 1.1 }
    ],
    filas: filas.map((fila) => {
      const aviso = objeto(fila.aviso);
      const nota = objeto(fila.nota);
      const recibido = objeto(fila.recibido);
      const carga = objeto(fila.carga);
      const debajoDeLaNota = [nota.tipo, nota.texto].map(texto).filter(Boolean).join(' · ');
      const celdaDeNota = texto(nota.numero) ? [texto(nota.numero), debajoDeLaNota].filter(Boolean).join('\n')
        : ['—', texto(nota.texto)].filter(Boolean).join('\n');
      return [
        [texto(fila.titulo), texto(fila.area)].filter(Boolean).join('\n'),
        fila.gestion === 'interna' ? 'Interna' : 'Externa',
        fechaCorta(fila.vencimiento),
        celdaDeFecha(aviso.fecha, [aviso.texto, aviso.que]),
        fila.gestion === 'interna' ? '—' : celdaDeNota,
        celdaDeFecha(recibido.fecha, [recibido.texto, recibido.origen]),
        celdaDeFecha(carga.fecha, [carga.texto])
      ];
    })
  });
  return [
    [prepararSeccion(doc, { titulo: `Los casos destildados (${filas.length})`, derecha: 'No cuentan en ninguna cifra de este PDF' }), tabla],
    [prepararParrafo(doc, textoDelPieDeLosCasos(dias), { tamano: LETRA.pie })]
  ];
};

// =====================================================
// El contexto
// =====================================================

// El índice de actualización mes a mes (contexto.indice) como gráfico de línea, una sola serie: un punto por cada día que manda el
// servidor (el primero de cada mes y hoy), los que no tienen tasa no se dibujan y cortan la línea. El PDF no tiene el mouse de la
// pestaña: cada punto lleva su valor arriba (si se pisaría con el de al lado, va el más nuevo) y debajo su mes (si se pisa con el
// anterior, un renglón más abajo)
const piezaDelIndice = (doc, indice) => {
  const puntos = lista(indice).filter((p) => esObjeto(p) && typeof p.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dia));
  const conTasa = puntos.filter((p) => esNumero(p.tasa));
  if (conTasa.length === 0) return null;
  const alto = GRAFICO.arriba + GRAFICO.alto + GRAFICO.abajo;
  return {
    alto,
    dibujar: (y, x) => {
      const x0 = x + GRAFICO.izquierda;
      const x1 = x + CONTENIDO;
      const xDelDia = (dia) => x0 + GRAFICO.aire
        + ((Number(dia.slice(5, 7)) - 1 + (Number(dia.slice(8, 10)) - 1) / 31) / 12) * (x1 - x0 - 2 * GRAFICO.aire);
      const cero = y + GRAFICO.arriba + GRAFICO.alto;
      const yDe = (tasa) => cero - (Math.min(100, Math.max(0, tasa)) * GRAFICO.alto) / 100;
      for (const valor of [0, 25, 50, 75, 100]) {
        doc.save();
        doc.lineWidth(valor === 0 ? 0.8 : 0.5).moveTo(x0, yDe(valor)).lineTo(x1, yDe(valor)).stroke(valor === 0 ? COLOR.grisClaro : COLOR.linea);
        doc.restore();
        renglon(doc, `${valor}%`, x, desdeBase(yDe(valor) + (ASCENDENTE * LETRA.indice) / 2, LETRA.indice),
          { ancho: GRAFICO.izquierda - 4, tamano: LETRA.indice, color: COLOR.gris, align: 'right' });
      }
      // La línea, cortada donde falta un valor
      const tramos = [[]];
      for (const p of puntos) {
        if (esNumero(p.tasa)) tramos.at(-1).push(p);
        else if (tramos.at(-1).length) tramos.push([]);
      }
      for (const tramo of tramos.filter((t) => t.length > 1)) {
        doc.save();
        doc.lineWidth(1.6).moveTo(xDelDia(tramo[0].dia), yDe(tramo[0].tasa));
        for (const p of tramo.slice(1)) doc.lineTo(xDelDia(p.dia), yDe(p.tasa));
        doc.stroke(COLOR.acento);
        doc.restore();
      }
      const ultimo = conTasa.at(-1);
      for (const p of conTasa) doc.circle(xDelDia(p.dia), yDe(p.tasa), p === ultimo ? 3.2 : 2.4).fill(COLOR.acento);
      // Los valores, del más nuevo al más viejo: uno que se pisaría con uno ya escrito no va
      const escritos = [];
      for (const p of [...conTasa].reverse()) {
        const valor = `${p.tasa}%`;
        const ancho = doc.font(NEGRITA).fontSize(LETRA.indice).widthOfString(valor) + 1;
        const cx = xDelDia(p.dia);
        const caja = [cx - ancho / 2, cx + ancho / 2, yDe(p.tasa) - 4 - OJO * LETRA.indice, yDe(p.tasa) - 4];
        if (escritos.some(([a, b, c, d]) => caja[0] < b + 2 && a < caja[1] + 2 && caja[2] < d && c < caja[3])) continue;
        escritos.push(caja);
        renglon(doc, valor, caja[0], caja[2], { ancho, tamano: LETRA.indice, fuente: NEGRITA, color: COLOR.tinta, align: 'center' });
      }
      // Los meses (y «hoy»)
      let anterior = null;
      for (const p of puntos) {
        const etiqueta = texto(p.etiqueta);
        if (!etiqueta) continue;
        const ancho = doc.font(NORMAL).fontSize(LETRA.indice).widthOfString(etiqueta) + 1;
        const cx = xDelDia(p.dia);
        const abajo = anterior !== null && !anterior.abajo && cx - ancho / 2 < anterior.fin + 2;
        renglon(doc, etiqueta, cx - ancho / 2, cero + 4 + (abajo ? OJO * LETRA.indice + 2 : 0), { ancho, tamano: LETRA.indice, color: COLOR.gris, align: 'center' });
        anterior = { fin: cx + ancho / 2, abajo };
      }
    }
  };
};

// El contexto (spec 2.2): el índice mes a mes (con el valor de hoy a la derecha del título; si no hay nada que dibujar, lo que dice el
// servidor) y la antigüedad de los vencidos, en barras ámbar, con los textos del servidor
const elementosDelContexto = (doc, contexto) => {
  const indice = lista(contexto.indice).filter(esObjeto);
  const vacio = texto(contexto.indice_vacio);
  const grafico = vacio ? null : piezaDelIndice(doc, indice);
  const antiguedad = objeto(contexto.antiguedad);
  const textos = objeto(antiguedad.textos);
  const grupos = [antiguedad.menos_de_3_meses, antiguedad.de_3_a_12, antiguedad.mas_de_un_anio].map((n, i) => [T.antiguedad[i], n]);
  return [
    [
      prepararSeccion(doc, { titulo: T.titulos.indice, derecha: texto(indice.at(-1)?.texto) }),
      grafico ? comoElemento(grafico) : prepararParrafo(doc, vacio || 'No hay datos para dibujar el índice.', { color: COLOR.tinta })
    ],
    [prepararParrafo(doc, T.pieDelIndice, { tamano: LETRA.pie })],
    [
      prepararSeccion(doc, { titulo: T.titulos.antiguedad, derecha: texto(textos.titulo) }),
      comoElemento(piezaDeBarras(doc, grupos, { ancho: CONTENIDO, anchoTexto: 110, color: BARRA_AMBAR }))
    ],
    [comoElemento(apilar([
      pieza(doc, textos.inicio, { ancho: CONTENIDO, tamano: LETRA.texto + 0.8, color: COLOR.tinta, lineas: 2 }),
      pieza(doc, T.pieDeLaAntiguedad, { ancho: CONTENIDO, tamano: LETRA.pie, color: COLOR.gris, lineas: 2 })
    ], 4))]
  ];
};

// =====================================================
// El trabajo del RPAD
// =====================================================

// Las métricas manuales de Gestión del año (spec 2.2; las carga administración), como la pestaña (htmlDeMetricasManuales): una fila por
// métrica, con su tipo, su mes y su cantidad, en el orden en que llegan; las de otro año no van, y sin ninguna, lo dice
const elementoDeLasManuales = (doc, manuales, anio) => {
  const delAnio = lista(manuales).filter((m) => esObjeto(m) && Number(m.anio) === anio);
  if (delAnio.length === 0) return prepararParrafo(doc, textoSinManuales(anio), { color: COLOR.tinta });
  return prepararTabla(doc, {
    columnas: [{ titulo: 'Tipo', ancho: 3 }, { titulo: 'Mes', ancho: 2 }, { titulo: 'Cantidad', ancho: 1 }],
    filas: delAnio.map((m) => [
      Object.hasOwn(T.tiposManuales, m.tipo) ? T.tiposManuales[m.tipo] : texto(m.tipo), textoDelMesManual(m.mes, anio), cuenta(Number(m.cantidad))
    ])
  });
};

// Los cinco totales en tarjetas, con su texto del servidor (en singular o en plural); por mes, las tres series de la pestaña en una
// tabla (la pestaña muestra una por vez, con chips), con los meses que manda el servidor; las métricas manuales y la doble verificación
const elementosDelTrabajo = (doc, trabajo, manuales, anio) => {
  const textos = objeto(trabajo.textos);
  const totales = objeto(textos.totales);
  const meses = lista(textos.meses).map(texto);
  const porMes = objeto(trabajo.por_mes);
  const tabla = prepararTabla(doc, {
    columnas: [{ titulo: '', ancho: 3.2 }, ...meses.map((mes) => ({ titulo: mes, ancho: 1 }))],
    filas: meses.length === 0 ? [] : T.series.map(([clave, nombre]) => [nombre, ...meses.map((_, i) => cuenta(lista(porMes[clave])[i]))])
  });
  return [
    [
      prepararSeccion(doc, { titulo: T.titulos.trabajo, derecha: T.bajadaDelTrabajo(anio) }),
      prepararTarjetas(doc, TOTALES_DEL_TRABAJO.map((clave) => ({ valor: cuenta(trabajo[clave]), rotulo: texto(totales[clave]) })))
    ],
    ...(meses.length ? [[prepararSeccion(doc, { titulo: T.titulos.porMes }), tabla]] : []),
    [prepararSeccion(doc, { titulo: T.titulos.manuales }), elementoDeLasManuales(doc, manuales, anio)],
    [
      prepararSeccion(doc, { titulo: T.titulos.auditoria }),
      comoElemento(apilar([
        pieza(doc, textos.auditoria, { ancho: CONTENIDO, tamano: LETRA.texto + 0.8, color: COLOR.tinta, lineas: 2 }),
        pieza(doc, T.pieDeLaAuditoria, { ancho: CONTENIDO, tamano: LETRA.pie, color: COLOR.gris, lineas: 1 })
      ], 4))
    ]
  ];
};

// =====================================================
// Áreas y temas
// =====================================================

// "83%", o una raya si no hay nada que medir (null: el área solo tiene eventuales; la de la pestaña)
const textoPorcentaje = (valor) => (esNumero(valor) ? `${valor}%` : '—');

// El ranking de áreas (la regla de cumplimientoPorArea, del servidor) y los datasets por tema y por frecuencia en barras (la pestaña
// los muestra de a uno, con un chip); si una lista está vacía, lo que dice el servidor
const elementosDeLasAreas = (doc, areas) => {
  const ranking = lista(areas.ranking).filter(esObjeto);
  const vacios = objeto(areas.vacios);
  const barras = (clave) => {
    const filas = lista(areas[clave]).filter((fila) => Array.isArray(fila) && esNumero(fila[1]));
    return texto(vacios[clave]) || filas.length === 0
      ? prepararParrafo(doc, texto(vacios[clave]) || 'Sin datasets.', { color: COLOR.tinta })
      : comoElemento(piezaDeBarras(doc, filas, { ancho: CONTENIDO, anchoTexto: 190 }));
  };
  const tabla = ranking.length === 0 ? prepararParrafo(doc, T.sinAreas, { color: COLOR.tinta }) : prepararTabla(doc, {
    columnas: [{ titulo: '#', ancho: 0.5 }, { titulo: 'Área', ancho: 6 }, { titulo: 'Datasets', ancho: 1.3 }, { titulo: 'Al día', ancho: 1.1 }, { titulo: 'Cumplimiento', ancho: 1.6 }],
    filas: ranking.map((area, i) => [String(i + 1), texto(area.area), cuenta(area.total_datasets), cuenta(area.al_dia), textoPorcentaje(area.porcentaje)])
  });
  return [
    [prepararSeccion(doc, { titulo: T.titulos.ranking, derecha: T.alDia }), tabla],
    [prepararSeccion(doc, { titulo: 'Datasets por tema' }), barras('temas')],
    [prepararSeccion(doc, { titulo: 'Datasets por frecuencia' }), barras('frecuencias')]
  ];
};

// =====================================================
// El PDF
// =====================================================

// Una parte del PDF desde una hoja nueva: el título de la parte va junto con su primer grupo, y después cada grupo de elementos, uno
// debajo del otro y cada uno junto en una hoja (dibujarJuntos: una sección con lo primero que le sigue)
const dibujarParte = (doc, hoja, titulo, grupos) => {
  const [primero = [], ...resto] = grupos;
  [[titulo, ...primero], ...resto].reduce((yGrupo, grupo) => dibujarJuntos(doc, yGrupo, grupo), agregarHoja(doc, hoja));
};

// El PDF de Métricas del año. `datos`: lo de metricasDe (controllers/metricasController.js: anio, al, en_vivo, aviso_foto, anios, vista,
// cinta, contexto, trabajo, areas y sin_titulos) más la combinación con que se pidió (`estadistico` y `dias`, las de la consulta) y las
// métricas manuales de Gestión del año (`manuales`: [{ tipo, anio, mes, cantidad }], que no son de metricasDe); `generado`: { momento: 'AAAA-MM-DD HH:MM:SS' (hora argentina; su día va en el encabezado), por: nombre corto o null } (el pie).
// Las cintas no salen de `datos.cinta` (las de la pantalla, o las que guardó la foto): se arman con el circuito de la vista y la letra
// del PDF.
export const renderMetricasDelAnio = async (datos, { generado }) => {
  const d = objeto(datos);
  const anio = Number.isInteger(d.anio) ? d.anio : Number(texto(d.al).slice(0, 4));
  const estadistico = elegido(d.estadistico, ESTADISTICOS);
  const dias = elegido(d.dias, DIAS);
  const vista = objeto(d.vista);
  const circuito = objeto(vista.circuito);
  const cintas = cintasDeLaVista(vista, { estadistico, dias, ...OPCIONES_CINTA_PDF });
  const combinacion = `${estadistico} en ${T.dias[dias]}`;
  const nombre = `Métricas del RPAD · ${anio}`;
  const doc = nuevoReporte({ titulo: `Métricas del RPAD ${anio}` });
  const hoja = { derecha: nombre, fecha: texto(generado?.momento).slice(0, 10) };
  const rotulo = rotuloDelAnio({ ...d, anio });
  const titulo = (t) => prepararTitulo(doc, { rotulo, titulo: t });

  // 1. El circuito de las dos gestiones, los resultados y «Cómo se cuenta», que viaja con lo último de antes (los resultados): nunca queda
  // solo en una hoja
  const destildados = lista(d.sin_titulos).some((t) => typeof t === 'string' && t);
  const origen = textoDeDondeSale(d);
  const circuitos = [
    ...(origen ? [[prepararParrafo(doc, origen, { color: COLOR.tinta })]] : []),
    ...GESTIONES.filter((gestion) => Array.isArray(circuito[gestion])).map((gestion) => [prepararRecuadro(doc, {
      rotulo: `Gestión ${gestion} · ${combinacion}`, contenido: piezaDeLaGestion(doc, circuito, gestion)
    })]),
    ...(esObjeto(vista.resultados) ? [[
      prepararSeccion(doc, { titulo: T.titulos.resultados, derecha: T.bajadaDeResultados(anio) }), comoElemento(piezaDeResultados(doc, vista.resultados))
    ]] : [])
  ];
  const comoSeCuenta = prepararRecuadro(doc, {
    rotulo: 'Cómo se cuenta',
    contenido: prepararParrafo(doc, `${T.bajada[dias]} ${T.pieDelCircuito} ${EN_EL_ANIO} ${SIGLAS}`, { ancho: ANCHO_DEL_RECUADRO, tamano: LETRA.aclaracion })
  }, { tono: 'gris' });
  const pildora = prepararPildora(doc, textoDeLaPildora({ ...d, estadistico, dias }), { tono: destildados ? 'sol' : 'azul' });
  const grupos = [[pildora], ...circuitos];
  grupos[grupos.length - 1] = [...grupos.at(-1), comoSeCuenta];
  dibujarParte(doc, hoja, titulo('El circuito, del aviso del RPAD a la carga en el portal'), grupos);

  // 2. Las cintas del recorrido típico y los casos destildados
  dibujarParte(doc, hoja, titulo('El recorrido típico de un pedido'), [
    ...GESTIONES.map((gestion) => {
      const seccion = prepararSeccion(doc, { titulo: `Gestión ${gestion} · recorrido típico`, derecha: `${T.estadisticos[estadistico]} en ${T.dias[dias]}` });
      if (cintas[gestion]) return [seccion, elementoDeLaCinta(doc, cintas[gestion], gestion)];
      const aviso = lista(circuito[gestion]).find((t) => esObjeto(t) && t.clave === 'aviso');
      return [seccion, prepararParrafo(doc, texto(objeto(aviso?.vacio).titulo) || `Sin casos en ${anio}`, { color: COLOR.tinta })];
    }),
    ...elementosDeLosDestildados(doc, vista, dias)
  ]);

  // 3. El contexto y el trabajo del RPAD
  dibujarParte(doc, hoja, titulo('El contexto y el trabajo del RPAD'), [
    ...elementosDelContexto(doc, objeto(d.contexto)),
    ...elementosDelTrabajo(doc, objeto(d.trabajo), d.manuales, anio)
  ]);

  // 4. Áreas y temas
  dibujarParte(doc, hoja, titulo(T.titulos.areas), elementosDeLasAreas(doc, objeto(d.areas)));

  return cerrarReporte(doc, { generado, pieDe: (k, n) => `${nombre} · Hoja ${k} de ${n}` });
};

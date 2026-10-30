// Todas las páginas cargan las versiones nuevas de los scripts compartidos, y el menú de Administración tiene "Configuración".
// Al cambiar alguno de estos scripts, subir la versión en todas las páginas y en VERSION.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

// main.js cambió con la carcasa nueva (spec 2026-10-18-rediseno-publico: el año del footer, la clase header--con-sesion y
// aria-expanded en el botón del menú); auth.js y api.js suben con él. api.js cambió después (previewNotaAnexo recibe el tipo: el
// anexo de la reiteración en Correos, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5). auth.js cambió después (el rol
// Colaborador en el encabezado y puedeCargarNotasDgmit, spec 2026-10-24-notas-dgmit, 1): main.js y api.js suben con él. api.js cambió
// después (salen getReporteHistorialUrl y getReporteCumplimientoUrl: Avisos del RPAD reemplaza al Historial y el Cumplimiento ya no
// está, spec 2026-10-24-metricas-y-reportes, 5): auth.js y main.js suben con él. main.js cambió después (el lector deja de ver
// «Notas» en Herramientas: updateSidebarAuth lo oculta si no se cumple Auth.puedeCargarNotasDgmit(), spec
// 2026-10-24-generador-de-notas, 1): auth.js y api.js suben con él
const VERSION = '20261204';
// usuarios.js cambió después (persona autorizada con licencia superpuesta en parte; con persona autorizada, cada aviso adelantado
// sale también en su fecha; el editor que audita sin responsabilidad, spec 2026-10-20-editor-sin-responsabilidad; el rol
// Colaborador, con su grupo y la ayuda de cada rol, spec 2026-10-24-notas-dgmit, 1; la ayuda del lector nombra «Métricas y
// Reportes», spec 2026-10-24-metricas-y-reportes; el lector ya no tiene Notas y el colaborador arma notas con el Generador de Notas,
// spec 2026-10-24-generador-de-notas, 1; Configuración reemplaza a Usuarios y Áreas: la tercera pestaña, Áreas, y la pestaña en la
// dirección, spec 2026-10-24-configuracion, 1 y 6; la ayuda del lector nombra Proyectos en lugar de Gestión, spec
// 2026-10-25-proyectos, 11; la cuarta pestaña, Feriados, con su vista y «Nuevo feriado», y al mostrarla llama a cargarFeriados de
// feriados.js, spec 2026-10-26-feriados, 4; la insignia «Cargada desde Mi espacio» en la lista de Licencias, spec
// 2026-10-26-mi-espacio-licencias-y-horas, 6; el efecto en las notas de una licencia del firmante sin anticipo o sin días
// hábiles, spec 2026-10-27-feriados-en-notas, 6; la confirmación de «Anular» que avisa que una licencia cargada desde Mi espacio
// también se borra de ahí, spec 2026-10-28-mi-espacio-licencia-anulada, 2.1): su versión es propia (solo la usa
// configuracion.html; es independiente de VERSION_FERIADOS)
const VERSION_PANTALLAS = '20261211';
// areas.js (reescrito para la pestaña Áreas de Configuración, spec 2026-10-24-configuracion, 4 y 6), que en areas.html cargaba
// ?v=20261204: un areas.js viejo en la caché con el HTML nuevo rompería la pestaña. Su versión es propia (solo la usa
// configuracion.html)
const VERSION_AREAS = '20261205';
// feriados.js (la pestaña Feriados de Configuración, la cuarta: el selector del año, los filtros y la tabla, spec
// 2026-10-26-feriados, 4): el número siguiente al más alto de este archivo cuando se creó (VERSION_REPORTES). Cambió después (cuántas
// licencias de Mi espacio incluye la fecha, en el modal del feriado, spec 2026-10-26-mi-espacio-licencias-y-horas). Su versión es
// propia (solo la usa configuracion.html)
const VERSION_FERIADOS = '20261209';
// correos.js cambió después (Correos en pestañas; "Actualización" en el detalle del Libro; el aviso en su fecha en el texto de la
// licencia del firmante; la vista previa y la prueba como saldrían en la próxima corrida con notas; "Ver anexo" también para la
// reiteración, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5; el botón "Word" del Libro, spec 2026-10-24-generador-de-notas, 6;
// la línea de los recordatorios de la agenda en el Estado, spec 2026-10-26-mi-espacio-agenda, 5; la licencia del firmante sin
// anticipo y la vista previa de otro día, spec 2026-10-27-feriados-en-notas, 6): su versión es propia
const VERSION_CORREOS = '20261211';
// perfil.js cambió después (Mi Perfil en pestañas; "Datos al" y las actualizaciones registradas; "Requiere nota DGMIT" en la
// comparación, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; el editor que audita sin responsabilidad, spec
// 2026-10-20-editor-sin-responsabilidad; la vista previa de la firma con el nombre en negrita y el cargo un punto menos; el
// rótulo «Origen de los datos», spec 2026-10-24-metricas-y-reportes): su versión es propia
const VERSION_PERFIL = '20261127';
// admin.js y admin-fechas.js (la lista con filtros por estado, "Datos publicados" y "Próximo pedido"; después, el ícono "Ver
// seguimiento" de cada fila, spec 2026-10-20-seguimiento-dataset; "Requiere nota DGMIT" en el formulario, el filtro y la vista
// previa, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; «Recibido el» obligatorio, el origen de los datos y el aviso de la
// edición que no registra actualizaciones, spec 2026-10-24-metricas-y-reportes; después, las clases gdat- en lugar de ad-, por los
// bloqueadores de anuncios): su versión es propia
const VERSION_ADMIN = '20261128';
// Los scripts del sitio público ("Datos al", "Cargado en el portal" y la próxima prevista; el estado del servidor), que hasta
// ahora se cargaban sin ?v=; después, el rediseño de las páginas públicas): su versión es propia
const VERSION_PUBLICAS = '20261109';
// dashboard.js cambió después (el índice de la portada con "Al día" y las leyendas con cantidades; spec
// 2026-10-19-indice-portada): su versión es propia
const VERSION_PORTADA = '20261110';
// main.css (la carcasa nueva y las fuentes Bricolage Grotesque y Figtree): hasta el rediseño se cargaba sin ?v=
const VERSION_CSS = '20261109';
// seguimiento.js (la página nueva de Seguimiento, spec 2026-10-20-seguimiento-dataset); cambió después ("Requiere nota DGMIT" en la
// ficha, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; las últimas subidas, solo comentarios sobre requiere nota y el anexo
// de la reiteración; las notas DGMIT en la lista, el circuito, la cinta y los movimientos, y después cargar, corregir y anular notas
// DGMIT desde la página, spec 2026-10-24-notas-dgmit; después, #cargar-nota abre el formulario con el dataset, el link de «Para
// completar» de Métricas, spec 2026-10-24-metricas-y-reportes, 2.2): su versión es propia
const VERSION_SEGUIMIENTO = '20261129';
// reportes.js (la página pasa a ser «Métricas y Reportes», con la pestaña Métricas: spec 2026-10-24-metricas-y-reportes), que hasta
// ahora se cargaba sin ?v=; después, los resultados, el contexto, el trabajo, las áreas y «Para completar»; después, la tarjeta Avisos
// del RPAD en lugar del Historial y sin la del Cumplimiento; después, la pestaña Reportes con los siete reportes en dos grupos;
// después, la revisión final (el año de Datos para completar, la franja de lo destildado armada en el servidor y el foco de «Volver a
// todos»); después, la tarjeta del Informe anual dice «(los hitos de Herramientas → Proyectos)» (spec 2026-10-25-proyectos, 11); después, la
// tarjeta «Ciclo de vida del dato», la octava, segunda en «Para presentar» (spec 2026-10-25-ciclo-de-vida-del-dato, 4); después, desde
// los feriados en todo el sistema, tanda 2, la bajada de los días hábiles dice «sin feriados ni días no laborables» (spec
// 2026-10-27-feriados-en-notas, 6), con el número siguiente (no más: VERSION_FERIADOS tiene que seguir siendo mayor): su versión es
// propia (mayor que todas las de este archivo cuando se sumó)
const VERSION_REPORTES = '20261208';
// notas.js (el Generador de Notas de la DGMIT en tres pasos, con la vista previa en la hoja membretada y la descarga del Word, spec
// 2026-10-24-generador-de-notas, 3), que hasta ahora se cargaba sin ?v=: cambió por completo y un notas.js viejo en la caché con el
// HTML nuevo rompería la página. Su versión es propia
const VERSION_NOTAS = '20261204';
// proyectos.js (la página nueva de Proyectos, con el estilo del Seguimiento: los carriles de 3 años, la línea de tiempo y los logros
// del área, spec 2026-10-25-proyectos, 1, 2 y 10): el número siguiente al más alto de este archivo cuando se creó (con el renombre,
// VERSION_REPORTES y VERSION_PANTALLAS subieron al mismo número; siguen siendo independientes). Su versión es propia
const VERSION_PROYECTOS = '20261206';
// mi-espacio.js (la página nueva de Mi espacio, con las pestañas Resumen, Licencias y Horas extras, spec
// 2026-10-26-mi-espacio-licencias-y-horas, 8 y 11): el mismo número que VERSION_PANTALLAS y VERSION_FERIADOS, que subieron con esta
// entrega (siguen siendo independientes). Cambió después (la cuarta pestaña, la agenda, con el mes, los próximos y los eventos en
// «Hoy y mañana», spec 2026-10-26-mi-espacio-agenda, 6; el Resumen «Titular», spec 2026-10-27-mi-espacio-resumen, 6; y «Word» en
// cada licencia de la lista, spec 2026-10-27-mi-espacio-licencia-word, 6; y la planilla de horas extras de contrato, spec
// 2026-10-27-mi-espacio-horas, 9; y el efecto en las notas sin anticipo o sin días hábiles, como Configuración, spec
// 2026-10-27-feriados-en-notas, 6; y lo que quedó distinto en Configuración, para revisar en el Resumen, y las licencias de
// otro año —la lista pasa al año de lo guardado, «Ver 2027» y los links a la lista de un año—, spec
// 2026-10-28-mi-espacio-licencia-anulada, 2.2 y 2.3; y la agenda con más onda —la banda del mes, sábado y domingo, las barras, los
// íconos y el día elegido del teléfono—, spec 2026-10-28-mi-espacio-agenda-onda, 3; y las vacaciones al cargar una licencia —los
// avisos del cálculo, «Vence pronto» sin el botón, las horas de franquicia que se pierden y el número de un tramo de un solo día—,
// spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3; y el formulario del evento con los tres tipos —Personal (Privado), Personal
// (Público) y Laboral, con lo que ven los demás, «Otro» y la vista previa—, spec 2026-10-29-mi-espacio-evento-publico, 4). Su versión
// es propia
const VERSION_MI_ESPACIO = '20261218';
const DIRECTORIO = new URL('../public/', import.meta.url);
const paginas = fs.readdirSync(DIRECTORIO).filter(nombre => nombre.endsWith('.html'));
const leer = (pagina) => fs.readFileSync(new URL(pagina, DIRECTORIO), 'utf8');

describe('páginas', () => {
  for (const pagina of paginas) {
    it(`${pagina}: auth.js, main.js y api.js con la versión ${VERSION}`, () => {
      const html = leer(pagina);
      for (const script of ['auth', 'main', 'api']) {
        for (const uso of html.match(new RegExp(`js/${script}\\.js[^"]*"`, 'g')) || []) {
          assert.equal(uso, `js/${script}.js?v=${VERSION}"`, `${pagina}: ${uso}`);
        }
      }
    });
  }

  // El script propio de esta pantalla cambió con los días sin auditor, después con la superposición parcial, con el aviso en su
  // fecha (el texto del efecto de la licencia en las notas, con persona autorizada), con Configuración (la tercera pestaña y la
  // pestaña en la dirección), con el renombre de Gestión a Proyectos (la ayuda del lector), con la cuarta pestaña, Feriados, con
  // la insignia «Cargada desde Mi espacio» en la lista de Licencias, con el efecto en las notas de una licencia del firmante sin
  // anticipo o sin días hábiles y, por último, con la confirmación de «Anular» de una licencia cargada desde Mi espacio
  for (const [pagina, script] of [['configuracion.html', 'usuarios']]) {
    it(`${pagina}: ${script}.js con la versión ${VERSION_PANTALLAS}`, () => {
      assert.ok(leer(pagina).includes(`js/${script}.js?v=${VERSION_PANTALLAS}"`));
    });
  }

  // Configuración (spec 2026-10-24-configuracion, 1 y 3) reemplaza a Usuarios y Áreas: las dos páginas viejas ya no están (sus
  // direcciones las redirige app.js: tests/areas-api.test.js)
  it('configuracion.html reemplaza a usuarios.html y areas.html', () => {
    assert.ok(paginas.includes('configuracion.html'), 'configuracion.html');
    assert.ok(!paginas.includes('usuarios.html'), 'usuarios.html');
    assert.ok(!paginas.includes('areas.html'), 'areas.html');
  });

  // areas.js va después de usuarios.js: usuarios.js llama a su cargarAreas al mostrar la pestaña Áreas (spec 6)
  it(`configuracion.html: areas.js con la versión ${VERSION_AREAS}, una sola vez, después de api.js y de usuarios.js`, () => {
    const html = leer('configuracion.html');
    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    assert.deepEqual(scripts.filter(src => src.startsWith('js/areas.js')), [`js/areas.js?v=${VERSION_AREAS}`]);
    const posicion = (nombre) => scripts.findIndex(src => src.startsWith(`js/${nombre}.js`));
    assert.ok(posicion('api') !== -1 && posicion('api') < posicion('areas'), 'areas.js después de api.js');
    assert.ok(posicion('usuarios') !== -1 && posicion('usuarios') < posicion('areas'), 'areas.js después de usuarios.js');
    // Todos, en el orden de siempre y a secas (sin defer ni otros atributos)
    assert.deepEqual(scripts, ['js/config.js', `js/auth.js?v=${VERSION}`, `js/main.js?v=${VERSION}`, `js/api.js?v=${VERSION}`,
      `js/usuarios.js?v=${VERSION_PANTALLAS}`, `js/areas.js?v=${VERSION_AREAS}`, `js/feriados.js?v=${VERSION_FERIADOS}`]);
    assert.equal(html.match(/<script\b/g).length, scripts.length, 'ningún <script> con otros atributos');
  });

  // feriados.js va al final, después de areas.js: usuarios.js llama a su cargarFeriados al mostrar la pestaña Feriados (spec
  // 2026-10-26-feriados, 4)
  it(`configuracion.html: feriados.js con la versión ${VERSION_FERIADOS}, una sola vez, el último (después de usuarios.js y areas.js)`, () => {
    const scripts = [...leer('configuracion.html').matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    assert.deepEqual(scripts.filter(src => src.startsWith('js/feriados.js')), [`js/feriados.js?v=${VERSION_FERIADOS}`]);
    assert.equal(scripts.at(-1), `js/feriados.js?v=${VERSION_FERIADOS}`);
    assert.ok(Number(VERSION_FERIADOS) > Number(VERSION_REPORTES), 'mayor que la más alta cuando se sumó');
  });

  // La página (spec 1 y 6): el título, el h1 con la ruedita, las tres pestañas y el botón de cada una, y lo de Áreas con los ids
  // que usa areas.js (spec 4; ninguno se repite con los de Usuarios y Licencias)
  describe('configuracion.html: la página y la pestaña Áreas', () => {
    const html = () => leer('configuracion.html');
    const bloque = (patron) => html().match(patron)?.[0] ?? '';
    const IDS_DE_AREAS = ['btn-nueva-area', 'vista-areas', 'areas-aviso', 'areas-contador', 'buscar-area', 'areas-filtros', 'areas-lista',
      'areas-vacio', 'modal-area', 'modal-area-titulo', 'area-error', 'a-nombre', 'a-articulo', 'a-nombre-error', 'a-superior',
      'a-articulo-superior', 'a-lectura', 'a-ambito-error', 'a-email-principal', 'a-email-principal-error', 'a-email-secundario',
      'a-email-secundario-error', 'a-emails-ayuda', 'a-telefono', 'a-celular', 'a-contacto', 'a-contacto-telefono', 'a-contacto-email',
      'a-contacto-email-error', 'area-pie-izquierda', 'area-guardar', 'modal-borrar-area', 'modal-borrar-area-titulo', 'borrar-area-texto',
      'borrar-area-error', 'borrar-area-confirmar'];

    it('el título, la descripción y el h1 "Configuración" con la ruedita decorativa', () => {
      assert.ok(html().includes('<title>Configuración - RPAD</title>'));
      assert.ok(html().includes('<meta name="description" content="Usuarios, licencias, áreas responsables y feriados del RPAD">'));
      const h1 = bloque(/<h1 class="page-title">[\s\S]*?<\/h1>/);
      assert.match(h1, /<svg aria-hidden="true"[^>]*><path d="M12\.22 2h-\.44/);
      assert.equal(h1.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(), 'Configuración');
    });

    it('las pestañas Usuarios, Licencias, Áreas y Feriados; "Nueva área", oculta, después de "Nuevo usuario"; la vista Áreas, oculta, después de Licencias', () => {
      const pestanas = [...bloque(/<div class="usuario-pestanas pagina-pestanas" id="pagina-pestanas" role="tablist">[\s\S]*?<\/div>/)
        .matchAll(/<button type="button" class="usuario-pestana[^"]*" data-vista="([^"]+)" role="tab" aria-selected="(true|false)">([^<]+)<\/button>/g)]
        .map(([, vista, elegida, texto]) => [vista, elegida, texto]);
      assert.deepEqual(pestanas, [['usuarios', 'true', 'Usuarios'], ['licencias', 'false', 'Licencias'], ['areas', 'false', 'Áreas'],
        ['feriados', 'false', 'Feriados']]);
      const posicion = (texto) => html().indexOf(texto);
      assert.match(html(), /<button type="button" class="btn btn-primary" id="btn-nueva-area" hidden>\s*<svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*Nueva área\s*<\/button>/);
      assert.ok(posicion('id="btn-nuevo-usuario"') < posicion('id="btn-nueva-area"'), '"Nueva área" después de "Nuevo usuario"');
      assert.ok(html().includes('<div id="vista-areas" hidden>'));
      assert.ok(posicion('id="vista-licencias"') < posicion('id="vista-areas"'), 'Áreas después de Licencias');
      assert.ok(posicion('id="vista-areas"') < posicion('<footer class="footer">'), 'dentro del contenido, antes del footer');
    });

    it('los ids de Áreas están una sola vez, y ningún id de la página se repite', () => {
      const ids = [...html().matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'ningún id repetido');
      for (const id of IDS_DE_AREAS) assert.ok(ids.includes(id), id);
    });

    it('los dos modales: role="dialog" con su título; el del área, sin <form> (el pie con los botones queda siempre a la vista)', () => {
      // Cada modal, hasta lo que sigue: el de borrar y los scripts
      const area = bloque(/<div class="modal-overlay" id="modal-area">[\s\S]*?(?=<div class="modal-overlay" id="modal-borrar-area">)/);
      assert.ok(area, 'el modal del área');
      assert.match(area, /<div class="modal ar-modal" role="dialog" aria-modal="true" aria-labelledby="modal-area-titulo">/);
      assert.doesNotMatch(area, /<form\b/);
      assert.match(area, /<div class="modal-footer">\s*<span id="area-pie-izquierda"><\/span>\s*<div class="botones">\s*<button type="button" class="ar-btn ar-btn-borde" data-cerrar-area>Cancelar<\/button>\s*<button type="button" class="ar-btn ar-btn-tinta" id="area-guardar">Guardar área<\/button>/);
      assert.match(area, /<button type="button" class="modal-close" data-cerrar-area aria-label="Cerrar">&times;<\/button>/);
      const borrar = bloque(/<div class="modal-overlay" id="modal-borrar-area">[\s\S]*?(?=<div class="modal-overlay" id="modal-feriado">)/);
      // La pregunta describe el diálogo: el foco va a "Cancelar", y un lector de pantalla la anuncia antes de un borrado definitivo
      assert.match(borrar, /<div class="modal ar-modal ar-modal-chico" role="dialog" aria-modal="true" aria-labelledby="modal-borrar-area-titulo" aria-describedby="borrar-area-texto">/);
      assert.match(borrar, /<p class="ar-modal-bajada" id="borrar-area-texto"><\/p>/);
      assert.match(borrar, /<div class="modal-footer">[\s\S]*?<button type="button" class="ar-btn ar-btn-borde" data-cerrar-borrar>Cancelar<\/button>\s*<button type="button" class="ar-btn ar-btn-rojo" id="borrar-area-confirmar">Borrar área<\/button>/);
      assert.ok(html().indexOf('id="modal-licencia"') < html().indexOf('id="modal-area"'), 'después del modal de la licencia');
    });

    it('el ámbito, los errores y "Así se lee en las notas" (sin aria-live: anunciaría cada tecla)', () => {
      const radios = [...html().matchAll(/<input type="radio" name="a-ambito" value="([^"]+)"([^>]*)>/g)];
      assert.deepEqual(radios.map(m => m[1]), ['municipal', 'externo']);
      for (const [, valor, resto] of radios) assert.match(resto, /aria-describedby="a-ambito-error"/, valor);
      assert.match(html(), /<p class="form-error" id="a-ambito-error" hidden><\/p>/);
      for (const [campo, describe] of [['a-nombre', 'a-nombre-error'], ['a-email-principal', 'a-emails-ayuda a-email-principal-error'],
        ['a-email-secundario', 'a-emails-ayuda a-email-secundario-error'], ['a-contacto-email', 'a-contacto-email-error']]) {
        assert.match(html(), new RegExp(`<input [^>]*id="${campo}"[^>]*aria-describedby="${describe}"`), campo);
        for (const id of describe.split(' ').filter(id => id.endsWith('-error'))) {
          assert.match(html(), new RegExp(`<p class="form-error" id="${id}" hidden></p>`), id);
        }
      }
      const lectura = bloque(/<p class="ar-lectura"[^>]*>[\s\S]*?<\/p>/);
      assert.match(lectura, /<span>Así se lee en las notas<\/span><q id="a-lectura"><\/q>/);
      assert.doesNotMatch(lectura, /aria-live/);
      // Los selectores de artículo no tienen opciones con los valores de los roles (el test del selector de rol recorre la página)
      assert.deepEqual([...bloque(/<select id="a-articulo-superior"[\s\S]*?<\/select>/).matchAll(/<option value="([^"]*)">/g)].map(m => m[1]), ['', 'la', 'el']);
    });

    // Lo que aparece sin mover el foco se anuncia: el aviso de las áreas sin email y la búsqueda que deja la tabla vacía
    it('el aviso de las áreas sin email y "Ninguna área coincide con lo que buscaste." con role="status"', () => {
      assert.match(html(), /<div class="ar-aviso" id="areas-aviso" role="status" hidden><\/div>/);
      assert.match(html(), /<p class="ar-vacio" id="areas-vacio" role="status" hidden>Ninguna área coincide con lo que buscaste\.<\/p>/);
    });

    // El foco visible de la convención (sobre fondos claros, anillo --tinta de 3 px con halo --sol-fuerte), también fuera del
    // modal: los filtros, el buscador, "Editar", el botón del aviso y "Nueva área", que está en el encabezado de la página
    it('el foco visible de la vista Áreas y de "Nueva área", como el del modal del área', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      const anillo = 'outline: 3px solid var(--tinta); outline-offset: 2px; box-shadow: 0 0 0 5px var(--sol-fuerte);';
      assert.ok(estilo.includes(`#vista-areas :focus-visible, #btn-nueva-area:focus-visible { ${anillo} }`), 'fuera del modal');
      assert.ok(estilo.includes(`.ar-modal :focus-visible { ${anillo} }`), 'el del modal, el mismo');
    });
  });

  // La cuarta pestaña (spec 2026-10-26-feriados, 4): el botón del encabezado, la vista con los ids que usa feriados.js, el aviso
  // azul y una sola región viva (#feriados-anuncio: lo que se vuelve a dibujar no lleva aria-live ni role="status")
  describe('configuracion.html: la pestaña Feriados', () => {
    const html = () => leer('configuracion.html');
    const bloque = (patron) => html().match(patron)?.[0] ?? '';
    const vista = () => bloque(/<div id="vista-feriados" hidden>[\s\S]*?(?=\s*<!-- Footer -->)/);
    const IDS_DE_FERIADOS = ['btn-nuevo-feriado', 'vista-feriados', 'feriados-aviso', 'titulo-feriados', 'feriados-anio',
      'feriados-filtros', 'feriados-lista', 'feriados-vacio', 'feriados-anuncio'];
    const posicion = (texto) => html().indexOf(texto);

    it('"Nuevo feriado", oculto, con el ícono plus, después de "Nueva área"', () => {
      assert.match(html(), /<button type="button" class="btn btn-primary" id="btn-nuevo-feriado" hidden>\s*<svg aria-hidden="true"[^>]*><path d="M5 12h14"\/><path d="M12 5v14"\/><\/svg>\s*Nuevo feriado\s*<\/button>/);
      assert.ok(posicion('id="btn-nueva-area"') < posicion('id="btn-nuevo-feriado"'), 'después de "Nueva área"');
      assert.ok(posicion('id="btn-nuevo-feriado"') < posicion('id="pagina-pestanas"'), 'en el encabezado, antes de las pestañas');
    });

    it('la vista, oculta, después de la de Áreas y antes del footer', () => {
      assert.ok(html().includes('<div id="vista-feriados" hidden>'));
      assert.ok(posicion('id="vista-areas"') < posicion('id="vista-feriados"'), 'Feriados después de Áreas');
      assert.ok(posicion('id="vista-feriados"') < posicion('<footer class="footer">'), 'dentro del contenido, antes del footer');
      assert.ok(vista(), 'la vista se encuentra');
    });

    it('sus ids están una sola vez, dentro de la vista (salvo "Nuevo feriado"), y ninguno se repite con los del resto de la página', () => {
      const ids = [...html().matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'ningún id repetido');
      for (const id of IDS_DE_FERIADOS) assert.equal(ids.filter(otro => otro === id).length, 1, id);
      for (const id of IDS_DE_FERIADOS.filter(id => id !== 'btn-nuevo-feriado' && id !== 'vista-feriados')) {
        assert.ok(vista().includes(`id="${id}"`), `${id} dentro de la vista`);
      }
    });

    // Desde la tanda 2 de los feriados en todo el sistema (spec 2026-10-27-feriados-en-notas, 6): cuentan en todo el sistema, también
    // en Métricas, el Ciclo de vida del dato, la foto del 31/12 y la Agenda de pedidos (en la tanda 1, todavía no)
    it('el aviso azul dice, tal cual, que estos feriados cuentan en todo el sistema', () => {
      const aviso = bloque(/<p class="fe-aviso" id="feriados-aviso">[\s\S]*?<\/p>/);
      assert.ok(aviso, 'el aviso');
      assert.match(aviso, /<svg aria-hidden="true"/);
      assert.equal(aviso.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(),
        'Estos feriados, junto con los 9 fijos, son los días no hábiles de todo el sistema: esos días no sale ninguna nota ni ningún email automático, y no cuentan como días hábiles en las licencias, Mi espacio ni Métricas.');
    });

    it('la tarjeta: el título, el selector del año y los filtros como grupos con su nombre, la lista y el vacío', () => {
      assert.match(vista(), /<section class="ar-tarjeta" aria-labelledby="titulo-feriados">/);
      assert.match(vista(), /<h2 id="titulo-feriados">Feriados y días no laborables<\/h2>/);
      assert.match(vista(), /<div class="fe-anios" id="feriados-anio" role="group" aria-label="Año"><\/div>/);
      assert.match(vista(), /<div class="ar-chips" id="feriados-filtros" role="group" aria-label="Filtrar feriados"><\/div>/);
      assert.match(vista(), /<div id="feriados-lista"><div class="loading"><div class="spinner"><\/div><\/div><\/div>/);
      assert.match(vista(), /<p class="ar-vacio" id="feriados-vacio" hidden><\/p>/);
    });

    it('#feriados-anuncio es la única región viva de la vista, fuera de lo que se vuelve a dibujar', () => {
      assert.match(vista(), /<p class="sr-only" id="feriados-anuncio" role="status"><\/p>/);
      assert.equal(vista().match(/role="(status|alert|log)"/g)?.length, 1);
      assert.doesNotMatch(vista(), /aria-live/);
      const tarjeta = bloque(/<section class="ar-tarjeta" aria-labelledby="titulo-feriados">[\s\S]*?<\/section>/);
      assert.ok(tarjeta && !tarjeta.includes('feriados-anuncio'), 'fuera de la tarjeta');
    });

    // El foco visible de la convención, como en Áreas: el selector del año, los filtros, "Editar" y "Nuevo feriado", que está en el
    // encabezado de la página
    it('el foco visible de la vista Feriados y de "Nuevo feriado", como el de Áreas', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      const anillo = 'outline: 3px solid var(--tinta); outline-offset: 2px; box-shadow: 0 0 0 5px var(--sol-fuerte);';
      assert.ok(estilo.includes(`#vista-feriados :focus-visible, #btn-nuevo-feriado:focus-visible { ${anillo} }`));
    });

    // Se ve como Áreas (spec 4): sus estilos van en el mismo <style>, después de los de Áreas, y toda var() que usan se define en
    // main.css o en este <style>
    it('los estilos .fe-* van después de los .ar-*, con los tokens que ya tiene la página', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      const primeraFe = estilo.indexOf('.fe-');
      assert.ok(primeraFe > estilo.lastIndexOf('.ar-tabla .accion'), 'después de la tabla de Áreas');
      assert.ok(primeraFe < estilo.indexOf('@media (max-width: 768px)'), 'antes de las del teléfono');
      const reglasFe = estilo.split('\n').filter(linea => linea.includes('.fe-') || linea.includes('#vista-feriados'));
      assert.ok(reglasFe.length > 5, 'hay reglas .fe-*');
      const css = fs.readFileSync(new URL('../public/css/main.css', import.meta.url), 'utf8') + estilo;
      for (const linea of reglasFe) {
        for (const [, variable] of linea.matchAll(/var\((--[\w-]+)\)/g)) {
          assert.ok(new RegExp(`${variable}\\s*:`).test(css), `${variable} definida`);
        }
      }
      assert.doesNotMatch(reglasFe.join('\n'), /text-transform:\s*uppercase/);
    });

    // Los dos modales de la pestaña (spec 4): el del feriado (cargar y corregir, y «no rige» en uno que se repite) y el de la baja,
    // después del de borrar un área y fuera del contenido (después del footer), con los ids que usa feriados.js
    const modalFeriado = () => bloque(/<div class="modal-overlay" id="modal-feriado">[\s\S]*?(?=<div class="modal-overlay" id="modal-baja-feriado">)/);
    const modalBaja = () => bloque(/<div class="modal-overlay" id="modal-baja-feriado">[\s\S]*?(?=<script )/);
    const IDS_DEL_MODAL = ['modal-feriado', 'modal-feriado-titulo', 'feriado-error', 'fe-fecha', 'fe-fecha-dia', 'fe-fecha-ayuda',
      'fe-fecha-afectadas', 'fe-fecha-error', 'fe-nombre', 'fe-nombre-error', 'fe-tipo', 'fe-tipo-opciones', 'fe-tipo-error', 'fe-trasladado', 'fe-trasladado-ayuda',
      'fe-trasladado-error', 'fe-se-repite', 'fe-se-repite-error', 'fe-anio', 'fe-no-rige', 'fe-no-rige-texto', 'fe-pasa-al-grupo',
      'fe-pasa-al', 'fe-pasa-al-ayuda', 'fe-pasa-al-error', 'fe-baja', 'fe-guardar'];
    const IDS_DE_LA_BAJA = ['modal-baja-feriado', 'modal-baja-feriado-titulo', 'baja-feriado-texto', 'baja-feriado-desde-grupo',
      'baja-feriado-desde', 'baja-feriado-error', 'baja-feriado-cancelar', 'baja-feriado-confirmar'];

    it('los dos modales van después del footer y del de borrar un área, y antes de los scripts', () => {
      assert.ok(modalFeriado(), 'el modal del feriado');
      assert.ok(modalBaja(), 'el de la baja');
      assert.ok(posicion('</footer>') < posicion('id="modal-feriado"'), 'después del footer');
      assert.ok(posicion('</main>') < posicion('id="modal-feriado"'), 'fuera del contenido');
      assert.ok(posicion('id="modal-borrar-area"') < posicion('id="modal-feriado"'), 'después del de borrar un área');
      assert.ok(posicion('id="modal-feriado"') < posicion('id="modal-baja-feriado"'), 'la baja, después');
      assert.ok(posicion('id="modal-baja-feriado"') < posicion('<script '), 'antes de los scripts');
    });

    it('sus ids están una sola vez, cada uno en su modal, y ninguno es de Usuarios, Licencias ni Áreas', () => {
      const ids = [...html().matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'ningún id repetido en la página');
      for (const id of IDS_DEL_MODAL) {
        assert.equal(ids.filter(otro => otro === id).length, 1, id);
        assert.ok(modalFeriado().includes(` id="${id}"`), `${id} en el modal del feriado`);
      }
      for (const id of IDS_DE_LA_BAJA) {
        assert.equal(ids.filter(otro => otro === id).length, 1, id);
        assert.ok(modalBaja().includes(` id="${id}"`), `${id} en el de la baja`);
      }
      // Todos los ids de los dos modales son de Feriados (fe-, feriado o baja-feriado), y no hay otros
      const deLosModales = [...(modalFeriado() + modalBaja()).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(deLosModales.sort(), [...IDS_DEL_MODAL, ...IDS_DE_LA_BAJA].sort());
      assert.ok(deLosModales.every(id => /^fe-|feriado/.test(id)), 'con el prefijo de Feriados');
      for (const ajeno of ['modal-area', 'modal-borrar-area', 'modal-usuario', 'modal-licencia']) assert.ok(!deLosModales.includes(ajeno), ajeno);
    });

    it('el del feriado: role="dialog" con su título, sin <form>, el aviso de arriba y el pie «Siempre el día entero» con «Dar de baja» (oculto), «Cancelar» y «Guardar»', () => {
      const modal = modalFeriado();
      assert.match(modal, /<div class="modal ar-modal fe-modal" role="dialog" aria-modal="true" aria-labelledby="modal-feriado-titulo">/);
      assert.match(modal, /<h2 class="modal-title" id="modal-feriado-titulo">Nuevo feriado<\/h2>/);
      assert.match(modal, /<button type="button" class="modal-close" data-cerrar-feriado aria-label="Cerrar">&times;<\/button>/);
      assert.doesNotMatch(modal, /<form\b/);
      assert.match(modal, /<div id="feriado-error" class="aviso aviso-error" role="alert" hidden><\/div>/);
      // «Dar de baja», como «Borrar el área»: un botón de texto a la izquierda del pie, debajo de la aclaración
      assert.match(modal, /<div class="modal-footer">\s*<div class="fe-pie-izquierda">\s*<small>Siempre el día entero<\/small>\s*<button type="button" class="ar-boton-texto" id="fe-baja" hidden>Dar de baja<\/button>\s*<\/div>\s*<div class="botones">\s*<button type="button" class="ar-btn ar-btn-borde" data-cerrar-feriado>Cancelar<\/button>\s*<button type="button" class="ar-btn ar-btn-tinta" id="fe-guardar">Guardar<\/button>/);
      // Usa los atributos propios: ninguno de los que escuchan usuarios.js y areas.js
      assert.doesNotMatch(modal + modalBaja(), /data-(cerrar-area|cerrar-borrar|ver|licencia|vista)\b/);
    });

    // El orden de la spec (4): la fecha (con su día) y el nombre, en una fila; el tipo; «Trasladado del»; «Se repite»; y «no rige»
    it('los campos van en el orden de la spec: fecha y nombre (en una fila), tipo, «Trasladado del», «Se repite» y «no rige»', () => {
      const modal = modalFeriado();
      const lugares = ['id="fe-fecha"', 'id="fe-nombre"', 'id="fe-tipo"', 'id="fe-trasladado"', 'id="fe-se-repite"', 'id="fe-anio"']
        .map(texto => modal.indexOf(texto));
      assert.ok(lugares.every(lugar => lugar !== -1), JSON.stringify(lugares));
      assert.deepEqual(lugares, [...lugares].sort((a, b) => a - b));
      const fila = modal.match(/<div class="form-row">[\s\S]*?(?=\s*<fieldset class="ar-ambito-grupo" id="fe-tipo">)/)?.[0] ?? '';
      assert.ok(fila.includes('id="fe-fecha"') && fila.includes('id="fe-nombre"'), 'la fecha y el nombre, en la misma fila');
      assert.ok(!fila.includes('id="fe-trasladado"'), '«Trasladado del» no va con la fecha');
      assert.match(modal, /<div class="form-group fe-mitad">\s*<label class="form-label" for="fe-trasladado">/);
    });

    it('los campos: la fecha con su día al lado, desde el 01/01/2025; el nombre; los tipos; «Trasladado del»; «Se repite»; cada uno con su error', () => {
      const modal = modalFeriado();
      assert.match(modal, /<input type="date" id="fe-fecha" class="form-input" min="2025-01-01" aria-required="true" aria-describedby="fe-fecha-dia fe-fecha-error">\s*<span class="fe-dia" id="fe-fecha-dia"><\/span>/);
      // La ayuda de la fecha (revisión final, 1): vacía y oculta; feriados.js la escribe al corregir uno que se repite y la suma al
      // aria-describedby de la fecha mientras se ve. Debajo, igual, cuántas licencias de Mi espacio incluye la fecha (desde la entrega
      // 2): feriados.js la escribe después de un cambio de la fecha o de «Se repite»
      assert.match(modal, /<span class="fe-dia" id="fe-fecha-dia"><\/span>\s*<\/div>\s*<p class="form-hint" id="fe-fecha-ayuda" hidden><\/p>\s*<p class="form-hint" id="fe-fecha-afectadas" hidden><\/p>\s*<p class="form-error" id="fe-fecha-error" hidden><\/p>/);
      assert.match(modal, /<label class="form-label" for="fe-fecha">Fecha <span class="requerido" aria-hidden="true">\*<\/span><\/label>/);
      assert.match(modal, /<input type="date" id="fe-trasladado" class="form-input" min="2025-01-01" aria-describedby="fe-trasladado-ayuda fe-trasladado-error">/);
      assert.match(modal, /<label class="form-label" for="fe-trasladado">Trasladado del <span class="fe-opcional">\(opcional\)<\/span><\/label>/);
      // El nombre sin maxlength: cuenta unidades de UTF-16 (el servidor cuenta con Array.from)
      assert.match(modal, /<input type="text" id="fe-nombre" class="form-input" aria-required="true" aria-describedby="fe-nombre-error" autocomplete="off" placeholder="Ej\.: Carnaval">/);
      assert.doesNotMatch(modal, /maxlength/);
      // Los cuatro tipos los dibuja feriados.js (htmlDeTiposFeriado), con los nombres de NOMBRES_TIPO_FERIADO
      assert.match(modal, /<fieldset class="ar-ambito-grupo" id="fe-tipo">\s*<legend class="form-label">Tipo <span class="requerido" aria-hidden="true">\*<\/span><\/legend>\s*<div class="ar-ambitos" id="fe-tipo-opciones"><\/div>\s*<p class="form-error" id="fe-tipo-error" hidden><\/p>/);
      assert.match(modal, /<input type="checkbox" id="fe-se-repite" aria-describedby="fe-se-repite-error"><span><b>Se repite todos los años, el mismo día<\/b><small>Para los de fecha fija, como el aniversario de la ciudad\. Los móviles se cargan año por año\.<\/small><\/span>/);
      for (const id of ['fe-fecha', 'fe-trasladado', 'fe-nombre', 'fe-se-repite', 'fe-pasa-al']) {
        assert.match(modal, new RegExp(`<p class="form-error" id="${id}-error" hidden></p>`), id);
      }
    });

    // Sin un título propio (la casilla ya dice «En AAAA no rige»), y su ayuda se lee una sola vez: va dentro del <label>, sin
    // aria-describedby
    it('«no rige», oculto hasta que feriados.js lo muestra (solo al corregir uno que se repite), con «Se pasó al» opcional', () => {
      const modal = modalFeriado();
      assert.match(modal, /<div class="fe-bloque-anio" id="fe-anio" hidden>\s*<label class="fe-casilla"><input type="checkbox" id="fe-no-rige"><span><b id="fe-no-rige-texto"><\/b><small>Si ese año se corrió a otro día\. Los demás años no cambian\.<\/small><\/span><\/label>/);
      assert.doesNotMatch(modal, /Solo en|<legend id=/);
      assert.match(modal, /<div class="form-group fe-pasa-al" id="fe-pasa-al-grupo" hidden>\s*<label class="form-label" for="fe-pasa-al">Se pasó al <span class="fe-opcional">\(opcional\)<\/span><\/label>\s*<input type="date" id="fe-pasa-al" class="form-input" aria-describedby="fe-pasa-al-ayuda fe-pasa-al-error">/);
      assert.match(modal, /<p class="form-hint" id="fe-pasa-al-ayuda">Ese día se carga como un feriado más, con el mismo nombre y tipo\.<\/p>/);
    });

    it('la baja: la pregunta describe el diálogo; desde qué año (un select vacío, oculto), el error y «Dar de baja»', () => {
      const modal = modalBaja();
      assert.match(modal, /<div class="modal ar-modal ar-modal-chico" role="dialog" aria-modal="true" aria-labelledby="modal-baja-feriado-titulo" aria-describedby="baja-feriado-texto">/);
      assert.match(modal, /<h2 class="modal-title" id="modal-baja-feriado-titulo">Dar de baja el feriado<\/h2>/);
      assert.match(modal, /<button type="button" class="modal-close" data-cerrar-baja-feriado aria-label="Cerrar">&times;<\/button>/);
      assert.match(modal, /<p class="ar-modal-bajada" id="baja-feriado-texto"><\/p>/);
      assert.match(modal, /<div class="form-group" id="baja-feriado-desde-grupo" hidden>\s*<label class="form-label" for="baja-feriado-desde">Deja de regir desde<\/label>\s*<select id="baja-feriado-desde" class="form-input"><\/select>/);
      assert.match(modal, /<div id="baja-feriado-error" class="aviso aviso-error" role="alert" hidden><\/div>/);
      assert.match(modal, /<div class="modal-footer">[\s\S]*?<button type="button" class="ar-btn ar-btn-borde" id="baja-feriado-cancelar" data-cerrar-baja-feriado>Cancelar<\/button>\s*<button type="button" class="ar-btn ar-btn-rojo" id="baja-feriado-confirmar">Dar de baja<\/button>/);
      assert.ok(modal.indexOf('id="baja-feriado-texto"') < modal.indexOf('id="baja-feriado-desde-grupo"'), 'la pregunta, arriba del año');
    });
  });

  // Correos pasó a pestañas (spec 2026-10-17-correos-pestanas)
  it(`correos.html: correos.js con la versión ${VERSION_CORREOS}`, () => {
    assert.ok(leer('correos.html').includes(`js/correos.js?v=${VERSION_CORREOS}"`));
  });

  // La línea de los recordatorios de la agenda (spec 2026-10-26-mi-espacio-agenda, 5): oculta hasta que llega el estado, justo
  // después de la de la corrida diaria de las Notas Digitales
  it('correos.html: #nd-eventos, oculto, va justo después de #nd-ultima-corrida', () => {
    const html = leer('correos.html');
    assert.match(html, /<p id="nd-ultima-corrida"><\/p>\s*<p id="nd-eventos" hidden><\/p>/);
    assert.equal(html.split('id="nd-eventos"').length, 2, 'una sola vez');
  });

  // Mi Perfil pasó a pestañas (spec 2026-10-16-perfil-pestanas-gestion-cambios)
  it(`perfil.html: perfil.js con la versión ${VERSION_PERFIL}`, () => {
    assert.ok(leer('perfil.html').includes(`js/perfil.js?v=${VERSION_PERFIL}"`));
  });

  // Admin renovado (spec 2026-10-17-fechas-datasets, 8.1): admin-fechas.js declara lo puro que usa admin.js, así que va
  // antes, y los dos después de api.js (Utils)
  it(`admin.html: admin-fechas.js y admin.js con la versión ${VERSION_ADMIN}, en ese orden y después de api.js`, () => {
    const html = leer('admin.html');
    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    const posicion = (nombre) => scripts.findIndex(src => src.startsWith(`js/${nombre}.js`));
    assert.ok(scripts.includes(`js/admin-fechas.js?v=${VERSION_ADMIN}`), `admin-fechas.js?v=${VERSION_ADMIN}`);
    assert.ok(scripts.includes(`js/admin.js?v=${VERSION_ADMIN}`), `admin.js?v=${VERSION_ADMIN}`);
    assert.ok(posicion('api') !== -1 && posicion('api') < posicion('admin-fechas'), 'admin-fechas.js después de api.js');
    assert.ok(posicion('admin-fechas') < posicion('admin'), 'admin.js después de admin-fechas.js');
    assert.equal(scripts.filter(src => /^js\/admin(-fechas)?\.js/.test(src)).length, 2, 'cada uno una sola vez');
  });

  // Sitio público (spec 2026-10-17-fechas-datasets, 11): cada página carga su script con ?v=, una sola vez y después de api.js
  for (const [pagina, script, version] of [['datasets.html', 'datasets', VERSION_PUBLICAS], ['dataset.html', 'dataset-detail', VERSION_PUBLICAS],
    ['calendario.html', 'calendario', VERSION_PUBLICAS], ['index.html', 'dashboard', VERSION_PORTADA], ['seguimiento.html', 'seguimiento', VERSION_SEGUIMIENTO],
    ['reportes.html', 'reportes', VERSION_REPORTES], ['notas.html', 'notas', VERSION_NOTAS], ['proyectos.html', 'proyectos', VERSION_PROYECTOS],
    ['mi-espacio.html', 'mi-espacio', VERSION_MI_ESPACIO]]) {
    it(`${pagina}: ${script}.js con la versión ${version}, después de api.js`, () => {
      const scripts = [...leer(pagina).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
      assert.deepEqual(scripts.filter(src => src.startsWith(`js/${script}.js`)), [`js/${script}.js?v=${version}`]);
      const posicion = (nombre) => scripts.findIndex(src => src.startsWith(`js/${nombre}.js`));
      assert.ok(posicion('api') !== -1 && posicion('api') < posicion(script), `${script}.js después de api.js`);
    });
  }

  // Gestión pasa a llamarse Proyectos (spec 2026-10-25-proyectos, 1 y 11): la página vieja y su script ya no están (su dirección la
  // redirige app.js a proyectos.html: tests/proyectos-api.test.js)
  it('proyectos.html reemplaza a gestion.html: public/gestion.html y public/js/gestion.js no existen', () => {
    assert.ok(paginas.includes('proyectos.html'), 'proyectos.html');
    assert.ok(!fs.existsSync(new URL('gestion.html', DIRECTORIO)), 'public/gestion.html');
    assert.ok(!fs.existsSync(new URL('js/gestion.js', DIRECTORIO)), 'public/js/gestion.js');
  });

  // El link viejo de las métricas (gestion.html#metricas llega por la redirección a proyectos.html#metricas, spec 1): Proyectos
  // tiene el aviso de la mudanza, oculto hasta que proyectos.js lo muestra, arriba de las pestañas; y sin Chart.js (Proyectos no lo usa)
  it('proyectos.html: el aviso #pr-aviso-metricas con el link a reportes.html#metricas, oculto, y sin Chart.js', () => {
    const html = leer('proyectos.html');
    const aviso = html.indexOf('<p class="pr-aviso" id="pr-aviso-metricas" hidden>Las métricas de Gestión ahora están en <a href="reportes.html#metricas">Herramientas → Métricas y Reportes</a>.</p>');
    assert.ok(aviso !== -1, 'falta el aviso');
    assert.equal(html.match(/id="pr-aviso-metricas"/g)?.length, 1, 'una sola vez');
    assert.ok(aviso < html.indexOf('role="tablist"'), 'el aviso va arriba de las pestañas');
    assert.doesNotMatch(html, /chart\.js|chart\.umd/i);
  });

  // Con Chart.js fuera de Gestión, ninguna página carga nada de un CDN: la CSP ya no permite ningún CDN de scripts ni de hojas
  // (tests/publico.test.js). Si una página vuelve a cargar un script o una hoja de afuera, hay que sumarlo a la CSP de app.js.
  // Se mira cada <script> y cada <link> entero, con los atributos en cualquier orden (las páginas escriben href antes que rel)
  describe('nada de afuera del sitio, salvo las fuentes de Google', () => {
    const FUENTES_DE_GOOGLE = 'https://fonts.googleapis.com/';
    const atributo = (etiqueta, nombre) => new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(etiqueta)?.slice(1).find(v => v !== undefined) ?? null;
    const esDeAfuera = (url) => /^(https?:)?\/\//i.test(url ?? '');
    // Los href de las hojas de estilo (rel con la palabra stylesheet) y los src de los scripts, en el orden de la página
    const hojasDe = (html) => [...html.matchAll(/<link\b[^>]*>/gi)].map(([etiqueta]) => etiqueta)
      .filter(etiqueta => (atributo(etiqueta, 'rel') ?? '').toLowerCase().split(/\s+/).includes('stylesheet'))
      .map(etiqueta => atributo(etiqueta, 'href'));
    const scriptsDe = (html) => [...html.matchAll(/<script\b[^>]*>/gi)].map(([etiqueta]) => atributo(etiqueta, 'src')).filter(Boolean);
    // Lo que una página carga de afuera y no está permitido
    const deAfuera = (html) => [
      ...scriptsDe(html).filter(esDeAfuera).map(src => `script ${src}`),
      ...hojasDe(html).filter(href => esDeAfuera(href) && !href.startsWith(FUENTES_DE_GOOGLE)).map(href => `hoja ${href}`)
    ];

    for (const pagina of paginas) {
      it(`${pagina}: no carga un script ni una hoja de estilos de afuera del sitio`, () => {
        assert.deepEqual(deAfuera(leer(pagina)), []);
      });
    }

    it('la excepción se usa de verdad: cada página carga su hoja de las fuentes de Google (con href antes que rel), y la guarda la ve', () => {
      for (const pagina of paginas) {
        const deGoogle = hojasDe(leer(pagina)).filter(href => href.startsWith(FUENTES_DE_GOOGLE));
        assert.equal(deGoogle.length, 1, pagina);
      }
      // Y ve también las hojas del sitio (main.css), que no son de afuera
      assert.ok(hojasDe(leer('index.html')).some(href => href.startsWith('css/main.css')));
    });

    it('una página con un script o una hoja de un CDN no pasa, con los atributos en cualquier orden', () => {
      const casos = [
        '<link href="https://cdn.jsdelivr.net/npm/x@1.0.0/x.css" rel="stylesheet">',
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/x@1.0.0/x.css">',
        "<link rel='stylesheet' href='//cdnjs.cloudflare.com/ajax/libs/x/1.0.0/x.css'>",
        '<link\n  href="https://fonts.googleapis.com.ejemplo.test/x.css"\n  rel="stylesheet preload">',
        '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>',
        '<script defer src="//cdnjs.cloudflare.com/ajax/libs/x/1.0.0/x.js"></script>'
      ];
      for (const etiqueta of casos) {
        const pagina = `<!DOCTYPE html><html><head>${etiqueta}</head><body></body></html>`;
        assert.equal(deAfuera(pagina).length, 1, etiqueta);
      }
      // Lo del sitio, las fuentes de Google y los <link> que no son hojas (preconnect, ícono) pasan
      const permitido = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        + '<link href="https://fonts.googleapis.com/css2?family=Figtree&display=swap" rel="stylesheet">'
        + '<link rel="stylesheet" href="css/main.css?v=1"><link rel="icon" href="https://ejemplo.test/x.png"><script src="js/api.js?v=1"></script>';
      assert.deepEqual(deAfuera(permitido), []);
    });
  });

  // Ningún nombre empieza con «ad-» (de «admin»): los bloqueadores de anuncios ocultan muchos. EasyList y AdGuard tienen la regla
  // genérica ##.ad-btn, que escondía «Registrar actualización» y los botones de las ventanas de Gestión de Datasets a quien tenía
  // uno, y sus listas suman más de mil reglas .ad-… (mañana puede llegar .ad-tabla). Las clases de esa página llevan gdat- desde el
  // 30/10/2026. Se mira cada página, cada script y cada hoja: un «ad-» que no sigue a una letra, un número, un guion ni un guion
  // bajo, así cantidad-, rpad- y data-ad- no cuentan
  it('ninguna página, script ni hoja usa un nombre que empiece con «ad-» (los bloqueadores de anuncios lo ocultarían)', () => {
    const PREFIJO_DE_ANUNCIOS = /(?<![A-Za-z0-9_-])ad-[a-z]/g;
    // Cada nombre una vez, entero, desde donde la expresión encontró el prefijo
    const nombresConAd = (texto) => [...new Set([...texto.matchAll(PREFIJO_DE_ANUNCIOS)].map(m => texto.slice(m.index).match(/^[\w-]+/)[0]))];
    const archivos = [['', '.html'], ['js/', '.js'], ['css/', '.css']].flatMap(([carpeta, extension]) =>
      fs.readdirSync(new URL(carpeta, DIRECTORIO)).filter(nombre => nombre.endsWith(extension)).map(nombre => `${carpeta}${nombre}`));
    // Recorre las tres carpetas, y la expresión ve un nombre en una clase, en una hoja, en un texto o armado en un script
    for (const archivo of ['admin.html', 'js/admin.js', 'css/main.css']) assert.ok(archivos.includes(archivo), archivo);
    assert.deepEqual(nombresConAd('<p class="cantidad-x rpad-y" data-ad-z="1">'), []);
    assert.deepEqual(nombresConAd('<b class="x ad-btn"> .ad-tabla { } toggle(\'ad-vh\') `ad-tarjeta-${id}`'), ['ad-btn', 'ad-tabla', 'ad-vh', 'ad-tarjeta-']);
    const encontrados = archivos.map(archivo => [archivo, nombresConAd(fs.readFileSync(new URL(archivo, DIRECTORIO), 'utf8'))])
      .filter(([, nombres]) => nombres.length > 0);
    assert.deepEqual(encontrados, [], 'Los bloqueadores de anuncios ocultan las clases que empiezan con «ad-» (EasyList y AdGuard tienen '
      + `##.ad-btn, que escondía «Registrar actualización»): ${encontrados.map(([archivo, nombres]) => `${archivo}: ${nombres.join(', ')}`).join('; ')}`);
  });

  // El menú de Administración (spec 2026-10-24-configuracion, 2): Gestión de Datasets, con el ícono de capas (layers de Lucide),
  // Correos, sin cambios, y Configuración, con la ruedita que tenía Gestión de Datasets. Salen Áreas y Usuarios, que ahora son
  // pestañas de Configuración (sus direcciones viejas las redirige app.js)
  describe('el menú de Administración', () => {
    const CAPAS = 'm12.83 2.18';
    const RUEDITA = 'M12.22 2h-.44';
    const SOBRE = 'm22 7-8.97 5.7';

    for (const pagina of paginas.filter(p => leer(p).includes('id="sidebarAdmin"'))) {
      it(`${pagina}: el menú de Administración tiene un único enlace a Configuración`, () => {
        assert.equal(leer(pagina).match(/href="configuracion\.html"/g)?.length, 1);
      });
    }

    for (const pagina of paginas) {
      it(`${pagina}: ningún enlace a usuarios.html ni a areas.html`, () => {
        // También con ruta (/usuarios.html, ./areas.html) o con fragmento (usuarios.html#licencias)
        assert.deepEqual(leer(pagina).match(/href="[^"]*(?<![\w-])(usuarios|areas)\.html[^"]*"/g) ?? [], []);
      });
    }

    it('index.html: Gestión de Datasets con las capas, Correos y Configuración con la ruedita, en ese orden', () => {
      const bloque = leer('index.html').match(/<div class="sidebar-section hidden" id="sidebarAdmin">[\s\S]*?(?=<div class="sidebar-section hidden" id="sidebarTools">)/)?.[0] ?? '';
      assert.match(bloque, /<div class="sidebar-section-title">Administración<\/div>/);
      const links = [...bloque.matchAll(/<a href="([^"]+)" class="sidebar-link">(<svg [^>]*>[\s\S]*?<\/svg>)<span>([^<]+)<\/span><\/a>/g)]
        .map(([, href, svg, texto]) => ({ href, svg, texto }));
      assert.deepEqual(links.map(l => l.href), ['admin.html', 'correos.html', 'configuracion.html']);
      assert.deepEqual(links.map(l => l.texto), ['Gestión de Datasets', 'Correos', 'Configuración']);
      assert.equal(bloque.match(/<a /g)?.length, 3, 'ningún otro link');
      const [gestion, correos, configuracion] = links;
      assert.ok(gestion.svg.includes(CAPAS), 'Gestión de Datasets: las capas');
      assert.ok(!gestion.svg.includes(RUEDITA), 'Gestión de Datasets: sin la ruedita');
      assert.ok(correos.svg.includes(SOBRE), 'Correos: el sobre de siempre');
      assert.ok(configuracion.svg.includes(RUEDITA), 'Configuración: la ruedita');
      for (const { href, svg } of links) assert.match(svg, /^<svg aria-hidden="true" /, href);
    });

    // El h1 de Gestión de Datasets lleva el mismo ícono que su link del menú, decorativo como los del h1 de Configuración y de
    // Seguimiento; el alta rápida de un área manda a completar los datos de contacto en la pestaña Áreas de Configuración
    it('admin.html: el h1 con las capas, decorativas, y el alta rápida de un área manda a Configuración → Áreas', () => {
      const html = leer('admin.html');
      const h1 = html.match(/<h1 class="page-title">[\s\S]*?<\/h1>/)?.[0] ?? '';
      const svg = h1.match(/<svg[^>]*>[\s\S]*?<\/svg>/)?.[0] ?? '';
      assert.ok(svg.includes(CAPAS), 'las capas');
      assert.ok(!svg.includes(RUEDITA), 'sin la ruedita');
      assert.match(svg, /^<svg aria-hidden="true" /);
      assert.equal(h1.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(), 'Gestión de Datasets');
      assert.ok(html.includes('<p class="gdat-ayuda gdat-arriba">Los datos de contacto se completan después, en Configuración → Áreas.</p>'));
      assert.ok(!html.includes('se completan después, en Áreas.'), 'sin el texto viejo');
    });
  });

  // El menú de Herramientas (spec 2026-10-25-proyectos, 11): el tercer link, que era Gestión con el ícono de barras, pasa a
  // Proyectos con la carpeta con tablero (folder-kanban de Lucide), el mismo ícono del h1 de proyectos.html. Las demás páginas
  // copian el menú de index.html (la carcasa, más abajo)
  describe('el menú de Herramientas', () => {
    const CARPETA_CON_TABLERO = '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>';
    const BARRAS = 'M3 3v18h18';

    for (const pagina of paginas) {
      it(`${pagina}: ningún enlace a gestion.html`, () => {
        // También con ruta (/gestion.html, ./gestion.html) o con fragmento (gestion.html#metricas)
        assert.deepEqual(leer(pagina).match(/href="[^"]*(?<![\w-])gestion\.html[^"]*"/g) ?? [], []);
      });
    }

    it('index.html: Métricas y Reportes, Notas, Proyectos con la carpeta con tablero y Seguimiento, en ese orden', () => {
      const bloque = leer('index.html').match(/<div class="sidebar-section hidden" id="sidebarTools">[\s\S]*?(?=<div class="sidebar-section hidden" id="sidebarAccount">)/)?.[0] ?? '';
      assert.match(bloque, /<div class="sidebar-section-title">Herramientas<\/div>/);
      const links = [...bloque.matchAll(/<a href="([^"]+)" class="sidebar-link">(<svg [^>]*>[\s\S]*?<\/svg>)<span>([^<]+)<\/span><\/a>/g)]
        .map(([, href, svg, texto]) => ({ href, svg, texto }));
      assert.deepEqual(links.map(l => l.href), ['reportes.html', 'notas.html', 'proyectos.html', 'seguimiento.html']);
      assert.deepEqual(links.map(l => l.texto), ['Métricas y Reportes', 'Notas', 'Proyectos', 'Seguimiento']);
      assert.equal(bloque.match(/<a /g)?.length, 4, 'ningún otro link');
      const proyectos = links[2];
      assert.ok(proyectos.svg.includes(CARPETA_CON_TABLERO), 'Proyectos: la carpeta con tablero');
      assert.ok(!bloque.includes(BARRAS), 'el ícono de barras ya no se usa en el menú');
      for (const { href, svg } of links) assert.match(svg, /^<svg aria-hidden="true" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">/, href);
    });
  });

  // El menú de Mi cuenta (spec 2026-10-26-mi-espacio-licencias-y-horas, 11): Mi Perfil, con la persona, y Mi espacio, con el
  // calendario con la tilde (calendar-check de Lucide, escrito en el HTML: no está en ICON_SELECTOR_MAP ni en Icons de main.js). Las
  // demás páginas copian el menú de index.html (la carcasa, más abajo)
  describe('el menú de Mi cuenta', () => {
    const PERSONA = '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
    const CALENDARIO_CON_TILDE = '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>';

    it('index.html: Mi Perfil con la persona y Mi espacio con el calendario con la tilde, en ese orden', () => {
      const bloque = leer('index.html').match(/<div class="sidebar-section hidden" id="sidebarAccount">[\s\S]*?<\/nav>/)?.[0] ?? '';
      assert.match(bloque, /<div class="sidebar-section-title">Mi cuenta<\/div>/);
      const links = [...bloque.matchAll(/<a href="([^"]+)" class="sidebar-link">(<svg [^>]*>[\s\S]*?<\/svg>)<span>([^<]+)<\/span><\/a>/g)]
        .map(([, href, svg, texto]) => ({ href, svg, texto }));
      assert.deepEqual(links.map(l => l.href), ['perfil.html', 'mi-espacio.html']);
      assert.deepEqual(links.map(l => l.texto), ['Mi Perfil', 'Mi espacio']);
      assert.equal(bloque.match(/<a /g)?.length, 2, 'ningún otro link');
      const [perfil, miEspacio] = links;
      assert.ok(perfil.svg.endsWith(`>${PERSONA}</svg>`), 'Mi Perfil: la persona');
      assert.ok(miEspacio.svg.endsWith(`>${CALENDARIO_CON_TILDE}</svg>`), 'Mi espacio: el calendario con la tilde');
      for (const { href, svg } of links) assert.match(svg, /^<svg aria-hidden="true" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">/, href);
    });

    it('main.js no cambia: el calendario con la tilde no está en ICON_SELECTOR_MAP ni en Icons (aparecería como ícono en Proyectos)', () => {
      const main = fs.readFileSync(new URL('js/main.js', DIRECTORIO), 'utf8');
      assert.ok(!main.includes('m9 16 2 2 4-4'));
    });
  });

  // La página de Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 8 y 11): la carcasa de index.html (más abajo), el título, el
  // h1 con el calendario con la tilde, los botones de carga, las tres pestañas con sus paneles y una sola región viva
  describe('mi-espacio.html: la página', () => {
    const html = () => leer('mi-espacio.html');
    const bloque = (patron) => html().match(patron)?.[0] ?? '';

    // La descripción, con la agenda (decisión del usuario, 27/10/2026)
    it('el título, la descripción y el h1 «Mi espacio» con el calendario con la tilde, decorativo', () => {
      assert.ok(html().includes('<title>Mi espacio - RPAD</title>'));
      assert.ok(html().includes('<meta name="description" content="Tus licencias, tus horas extras, tu agenda y lo que te queda">'));
      const h1 = bloque(/<h1 class="page-title">[\s\S]*?<\/h1>/);
      assert.match(h1, /<svg aria-hidden="true"[^>]*><path d="M8 2v4"\/><path d="M16 2v4"\/><rect width="18" height="18" x="3" y="4" rx="2"\/><path d="M3 10h18"\/><path d="m9 16 2 2 4-4"\/><\/svg>/);
      assert.equal(h1.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(), 'Mi espacio');
    });

    it('«Cargar horas extras» y «Cargar licencia» son botones, ocultos hasta saber la modalidad', () => {
      assert.match(html(), /<button type="button" class="sg-btn sg-btn-borde" id="btn-cargar-horas" hidden>Cargar horas extras<\/button>/);
      assert.match(html(), /<button type="button" class="sg-btn sg-btn-tinta" id="btn-cargar-licencia" hidden><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Cargar licencia<\/button>/);
    });

    // La cuarta, la agenda (spec 2026-10-26-mi-espacio-agenda, 6), con su panel después del de las horas extras
    it('las pestañas Resumen (con la marca), Licencias, Horas extras y Agenda, cada una con su panel; de entrada, el Resumen', () => {
      const lista = bloque(/<div class="me-pestanas" role="tablist" aria-label="Mi espacio">[\s\S]*?<\/div>/);
      const pestanas = [...lista.matchAll(/<button type="button" class="me-pestana" role="tab" id="tab-(\w+)" aria-selected="(true|false)" aria-controls="vista-(\w+)" data-pestana="(\w+)"(?: tabindex="-1")?>([\s\S]*?)<\/button>/g)]
        .map(([, id, elegida, panel, pestana, texto]) => [id, elegida, panel, pestana, texto]);
      assert.deepEqual(pestanas, [
        ['resumen', 'true', 'resumen', 'resumen', 'Resumen<span id="me-marca"></span>'],
        ['licencias', 'false', 'licencias', 'licencias', 'Licencias'],
        ['horas', 'false', 'horas', 'horas', 'Horas extras'],
        ['agenda', 'false', 'agenda', 'agenda', 'Agenda']
      ]);
      assert.equal([...lista.matchAll(/role="tab"/g)].length, 4);
      assert.ok(lista.includes('id="tab-agenda" aria-selected="false" aria-controls="vista-agenda" data-pestana="agenda" tabindex="-1">'));
      for (const [nombre, oculto] of [['resumen', ''], ['licencias', ' hidden'], ['horas', ' hidden'], ['agenda', ' hidden']]) {
        assert.match(html(), new RegExp(`<section id="vista-${nombre}" role="tabpanel" aria-labelledby="tab-${nombre}"${oculto}>`), nombre);
      }
      const posicion = (texto) => html().indexOf(texto);
      assert.ok(posicion('<section id="vista-horas"') < posicion('<section id="vista-agenda"'), 'la agenda, después de las horas extras');
    });

    // La agenda (spec 2026-10-26-mi-espacio-agenda, 6; maqueta 1, #agenda). Decisión del usuario (27/10/2026): sin modalidad, la
    // agenda y «Nuevo evento» se ven igual, así que el botón del encabezado no está oculto
    it('«Nuevo evento» va en el encabezado antes de «Cargar horas extras», a la vista, y la bajada nombra la agenda', () => {
      const acciones = bloque(/<div class="me-acciones">[\s\S]*?<\/div>/);
      assert.match(acciones, /<button type="button" class="sg-btn sg-btn-borde" id="btn-nuevo-evento">Nuevo evento<\/button>/);
      assert.ok(acciones.indexOf('id="btn-nuevo-evento"') < acciones.indexOf('id="btn-cargar-horas"'));
      assert.ok(html().includes('<p class="me-bajada">Tus licencias, tus horas extras y tu agenda. Lo que cargás acá lo ves solo vos, salvo los '
        + 'eventos que compartís y, si querés, tus ausencias (sin decir de qué son).</p>'));
    });

    // La agenda con más onda (spec 2026-10-28-mi-espacio-agenda-onda, 3.1, 3.2, 3.6 y 3.8; la maqueta aprobada): arriba, la banda
    // celeste del Resumen con su ola y, adentro, el mes en grande con ‹ › a su derecha, «Sábado y domingo» (una llave con aria-pressed,
    // apagada de entrada, y la cuenta de lo escondido, oculta), «Hoy», «Nuevo evento» y la frase del mes; debajo, la tarjeta del mes
    // con la grilla, la leyenda con el ícono de cada cosa y el día elegido del teléfono (lo dibuja mi-espacio.js), y los próximos
    it('la pestaña Agenda: la banda del mes, la grilla, la leyenda con sus íconos, el día elegido y los próximos', () => {
      const vista = bloque(/<section id="vista-agenda"[\s\S]*?<\/section>\s*<\/div>\s*<\/section>/);
      assert.ok(vista, 'la vista');
      const ids = [...vista.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(ids, ['vista-agenda', 'ag-mes-titulo', 'ag-anterior', 'ag-siguiente', 'ag-finde', 'ag-finde-cuenta', 'ag-hoy',
        'ag-nuevo-evento', 'ag-frase', 'ag-mes', 'ag-leyenda-laborales', 'ag-leyenda-ausentes', 'ag-elegido', 'ag-proximos-titulo',
        'ag-proximos']);
      // La banda, primero y fuera de las tarjetas, con la ola del Resumen (el mismo dibujo que OLA_DE_LA_BANDA de mi-espacio.js)
      const banda = vista.match(/<div class="me-banda-del-mes">[\s\S]*?<\/svg>\s*<\/div>/)?.[0] ?? '';
      assert.ok(banda, 'la banda');
      assert.ok(vista.indexOf('<div class="me-banda-del-mes">') < vista.indexOf('<div class="me-mes-y-proximos">'));
      const ola = banda.match(/<svg class="me-ola" aria-hidden="true"[^>]*>([\s\S]*?)<\/svg>\s*<\/div>$/);
      assert.ok(ola, 'la ola, decorativa, al final de la banda');
      const dibujo = (texto) => texto.match(/ d="([^"]+)"/)?.[1];
      assert.equal(dibujo(ola[1]), dibujo(leer('js/mi-espacio.js').match(/const OLA_DE_LA_BANDA = [\s\S]*?<\/svg>/)[0]));
      assert.match(banda, /<h2 id="ag-mes-titulo">[^<]*<\/h2>/);
      assert.match(banda, /<button type="button" class="me-flecha" id="ag-anterior" aria-label="Mes anterior"><svg aria-hidden="true"/);
      assert.match(banda, /<button type="button" class="me-flecha" id="ag-siguiente" aria-label="Mes siguiente"><svg aria-hidden="true"/);
      assert.ok(banda.includes('<button type="button" class="me-finde" id="ag-finde" aria-pressed="false"><span class="me-finde-llave" '
        + 'aria-hidden="true"></span>Sábado y domingo<span class="me-finde-cuenta" id="ag-finde-cuenta" hidden></span></button>'));
      assert.match(banda, /<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" id="ag-hoy">Hoy<\/button>/);
      assert.match(banda, /<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" id="ag-nuevo-evento"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Nuevo evento<\/button>/);
      assert.ok(banda.includes('<p class="me-frase-del-mes" id="ag-frase"></p>'));
      // Ninguna clase nueva lleva la palabra «agenda» (es la Agenda de pedidos de Reportes): solo los ids ag-* y el panel
      for (const [, clases] of vista.matchAll(/\sclass="([^"]*)"/g)) assert.doesNotMatch(clases, /agenda/, clases);
      // La leyenda: los colores, cada uno con su muestra y su ícono (el de lo que es solo tuyo, vacío; lo que ven otros, el ojo);
      // desde el evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 5.2), siete: «Tuyos, a la vista», «Personales
      // de otros» y «Laborales» (eran «Compartidos»). «Laborales» y «Compañeros que no están», ocultos hasta saber que quien mira los ve
      const leyenda = vista.match(/<ul class="me-leyenda"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
      const muestras = [...leyenda.matchAll(/<li( id="ag-leyenda-(?:laborales|ausentes)" hidden)?><span class="me-color ([\w-]+)" aria-hidden="true">((?:<svg [\s\S]*?<\/svg>)?)<\/span>([^<]+)<\/li>/g)]
        .map(([, oculto, clase, icono, texto]) => [clase, texto, Boolean(oculto), icono === '' ? '' : 'svg']);
      assert.deepEqual(muestras, [
        ['propio', 'Solo vos', false, ''], ['propio', 'Tuyos, a la vista', false, 'svg'], ['publico-otro', 'Personales de otros', false, 'svg'],
        ['compartido', 'Laborales', true, 'svg'], ['licencia', 'Tus licencias y francos', false, 'svg'], ['feriado', 'Feriados', false, 'svg'],
        ['ausente', 'Compañeros que no están', true, 'svg']
      ]);
      assert.equal(leyenda.match(/<li\b/g)?.length, 7);
      assert.ok(leyenda.includes('<li id="ag-leyenda-laborales" hidden><span class="me-color compartido" aria-hidden="true">'));
      // El día elegido del teléfono: vacío (lo dibuja mi-espacio.js), en la tarjeta del mes, después de la leyenda
      assert.ok(vista.includes('<section class="me-elegido" id="ag-elegido" aria-labelledby="ag-elegido-titulo"></section>'));
      assert.ok(vista.indexOf('<ul class="me-leyenda"') < vista.indexOf('id="ag-elegido"'));
      assert.ok(vista.indexOf('id="ag-elegido"') < vista.indexOf('<section class="me-tarjeta me-proximos-tarjeta"'));
      assert.match(vista, /<h2 id="ag-proximos-titulo">Próximos<\/h2>/);
      // Lo que se vuelve a dibujar no es una región viva (#me-anuncio es la única)
      assert.match(vista, /<div class="me-proximos" id="ag-proximos">/);
      assert.doesNotMatch(vista, /aria-live|role="status"|role="alert"/);
      // El mes primero y los próximos al costado (en una columna, debajo)
      assert.ok(vista.indexOf('id="ag-mes"') < vista.indexOf('id="ag-proximos"'));
    });

    // La agenda con más onda (spec 2026-10-28-mi-espacio-agenda-onda, 3.1, 3.3, 3.4, 3.7, 3.8 y 6). En 980 px, el mes y los próximos
    // en una columna (el mes primero) y la banda también; en el teléfono (640 px), el número centrado, sin lo de cada día ni el «+»,
    // las barras como líneas finas (su texto, oculto a la vista pero no para el lector de pantalla), los puntos y el día elegido; los
    // próximos, en su orden (después del mes: el día elegido ya muestra hoy)
    it('la agenda en una pantalla angosta: una columna en 980 px y, en el teléfono, las líneas, los puntos y el día elegido', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      // El bloque de un @media: hasta la llave que cierra sola en su renglón (con CRLF o LF)
      const media = (ancho) => estilo.match(new RegExp(`@media \\(max-width: ${ancho}px\\) \\{([\\s\\S]*?)\\n\\s*\\}(?=\\r?\\n)`))?.[1] ?? '';
      assert.match(media(980), /\.me-mes-y-proximos \{ grid-template-columns: minmax\(0, 1fr\); \}/);
      assert.match(media(980), /\.me-banda-del-mes-cuerpo \{ grid-template-columns: minmax\(0, 1fr\);[^}]*\}/);
      const telefono = media(640);
      const afuera = estilo.replace(telefono, '');
      // Los próximos en su orden natural y, en el mes, nada de las rayitas de antes
      assert.doesNotMatch(estilo, /\.me-proximos-tarjeta \{ order: -1; \}/);
      assert.doesNotMatch(estilo, /\.me-ev \{ font-size: 0[;\s}]/);
      assert.match(telefono, /\.me-elegido \{ display: block;[^}]*\}/);
      assert.match(telefono, /\.me-puntos \{ display: flex;[^}]*\}/);
      assert.match(telefono, /\.me-cosas \{ display: none; \}/);
      assert.match(telefono, /\.me-num::after \{ display: none; \}/);
      assert.match(telefono, /\.me-num \{ align-self: center; \}/);
      assert.match(telefono, /\.me-tira \{ height: 5px;[^}]*\}/);
      // El texto y el ícono de las barras, ocultos a la vista y no para el lector de pantalla (nunca display: none ni visibility)
      assert.match(telefono, /\.me-tira-texto, \.me-tira \.me-icono \{ position: absolute; width: 1px; height: 1px;[^}]*clip: rect\(0 0 0 0\);[^}]*\}/);
      assert.doesNotMatch(estilo, /\.me-tira-texto[^{]*\{[^}]*(display: none|visibility: hidden)/);
      // En la compu, el día elegido y los puntos no se ven
      assert.ok(afuera.includes('.me-elegido { display: none; }'));
      assert.ok(afuera.includes('.me-puntos { display: none; }'));
      // Los seis colores, en el mes y en la leyenda (desde el evento Personal (Público), también el rosado de uno de otra persona); los
      // compañeros, la pizarra (gris oscura con letra blanca)
      for (const clase of ['propio', 'compartido', 'publico-otro', 'licencia', 'feriado', 'ausente']) {
        assert.ok(estilo.includes(`.me-ev.${clase}, .me-leyenda .${clase} {`), clase);
      }
      assert.match(estilo, /\n\s*\.me-tira\.ausente \{[^}]*background: var\(--sg-suave\);[^}]*color: #fff;[^}]*\}/);
      // Las barras se dibujan de izquierda a derecha una sola vez (con data-animar, sin dibujar; después, cada una con su --demora),
      // con transiciones y nunca con animation; quietas con prefers-reduced-motion
      assert.ok(estilo.includes('#ag-mes[data-animar] .me-tira { transform: scaleX(0); transition: none; }'));
      assert.match(estilo, /\n\s*\.me-tira \{[^}]*transition: transform [^;]*var\(--demora\);[^}]*\}/);
      for (const [, selector, cuerpo] of estilo.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (selector.includes('[data-animar]')) assert.doesNotMatch(cuerpo, /animation/, selector.trim());
      }
      const bloques = (condicion) => [...estilo.matchAll(new RegExp(`@media \\(${condicion}\\) \\{\\r?\\n([\\s\\S]*?)\\n\\s*\\}(?=\\r?\\n)`, 'g'))]
        .map(([, cuerpo]) => cuerpo);
      assert.ok(bloques('prefers-reduced-motion: reduce').some((cuerpo) => /(?:^|\n)\s*\.me-tira \{ transition: none; \}/.test(cuerpo)));
      // En alto contraste, las barras y los puntos se siguen viendo (con un borde o con CanvasText: el fondo no alcanza)
      const altoContraste = bloques('forced-colors: active').join('\n');
      assert.match(altoContraste, /\.me-tira[^{]*\{[^}]*CanvasText[^}]*\}/);
      assert.match(altoContraste, /\.me-puntos[^{]*\{[^}]*CanvasText[^}]*\}/);
      // Sin las clases de la maqueta y sin la palabra «agenda» en una clase
      const sinComentarios = estilo.replace(/\/\*[\s\S]*?\*\//g, '');
      assert.doesNotMatch(sinComentarios, /\.(ag|mq|franja|o2)-/);
      assert.doesNotMatch(sinComentarios, /\.[\w-]*agenda/);
      // Las clases de la regla del Resumen (.me-barra y .me-muestra) no se usan para la agenda
      assert.doesNotMatch(sinComentarios, /\.me-(?:mes|celda|carriles|leyenda|tira)[^{,]*\.me-(?:barra|muestra)\b/);
    });

    // Revisión de la Task 7 (Chrome 152): con la columna implícita del carril (auto) y el min-width: auto de la barra, Chrome medía el
    // carril con el ancho natural del texto (nowrap) y no con el calc() de .me-tira-texto, así que una barra de un día se pintaba
    // sobre los días siguientes (277,7 px en una celda de 79,8). El carril tiene una sola columna del ancho de la celda y la barra
    // puede achicarse: el texto queda en su tramo
    it('la agenda: el carril es del ancho de su día (una columna minmax(0, 1fr)) y la barra puede achicarse (min-width: 0)', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      const regla = (selector) => {
        const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return estilo.match(new RegExp(`\\n\\s*${escapado} \\{([^}]*)\\}`))?.[1] ?? '';
      };
      assert.match(regla('.me-carriles'), /(?:^|; | )grid-template-columns: minmax\(0, 1fr\);/);
      assert.match(regla('.me-tira'), /(?:^|; | )min-width: 0;/);
      // Ningún otro lado le vuelve a dar al carril columnas que crezcan con el texto
      for (const [, selector, cuerpo] of estilo.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (/\.me-carriles\b/.test(selector) && /grid-template-columns/.test(cuerpo)) {
          assert.match(cuerpo, /grid-template-columns: minmax\(0, 1fr\);/, selector.trim());
        }
      }
    });

    // Revisión de la Task 7 (spec 2026-10-28-mi-espacio-agenda-onda, 6): en alto contraste, los puntos y la llave tienen que salir en
    // CanvasText, y la regla que lo dice pierde si va antes que las que les dan su color o si es menos específica. El bloque va al
    // final del <style> (después del teléfono y de los próximos) y cada selector es al menos tan específico como el que pisa
    it('la agenda en alto contraste: el bloque va al final y pisa los colores de los puntos y de la llave', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/).replace(/\/\*[\s\S]*?\*\//g, '');
      // La especificidad de un selector simple de los de esta hoja: [ids, clases + atributos + pseudoclases, elementos + pseudoelementos]
      // (:not() cuenta lo de adentro)
      const especificidad = (selector) => {
        const sinNot = selector.replace(/:not\(([^)]*)\)/g, ' $1');
        const ids = (sinNot.match(/#[\w-]+/g) ?? []).length;
        const clases = (sinNot.match(/\.[\w-]+|\[[^\]]*\]|(?<!:):(?!:)[\w-]+/g) ?? []).length;
        const elementos = (sinNot.replace(/\[[^\]]*\]/g, '').match(/(?:^|[\s>+~])[a-z][\w-]*|::[\w-]+/g) ?? []).length;
        return [ids, clases, elementos];
      };
      const noMenos = (uno, otro) => {
        for (let i = 0; i < 3; i++) if (uno[i] !== otro[i]) return uno[i] > otro[i];
        return true;
      };
      assert.deepEqual(especificidad('.me-puntos .propio'), [0, 2, 0]);
      assert.deepEqual(especificidad('.me-finde[aria-pressed="true"] .me-finde-llave::after'), [0, 3, 1]);
      assert.deepEqual(especificidad('.me-tira.licencia.inicio:not(.sigue-antes)'), [0, 4, 0]);
      // El bloque multirrenglón (el de una sola línea, el de la ola del Resumen, va más arriba)
      const inicio = estilo.search(/@media \(forced-colors: active\) \{\r?\n/);
      assert.ok(inicio >= 0, 'el bloque de alto contraste de la agenda');
      const fin = estilo.indexOf('\n        }', inicio);
      const bloqueAlto = estilo.slice(inicio, fin);
      const reglasDelBloque = [...bloqueAlto.matchAll(/\n\s*([^{}\n]+?) \{([^}]*)\}/g)].map(([, selector, cuerpo]) => ({ selector, cuerpo }));
      // Después de todo lo que pisa: el teléfono, los colores de los puntos, los próximos, la llave y el día elegido
      for (const pisada of ['@media (max-width: 640px) {', '.me-puntos .propio {', '.me-puntos .feriado {', '.me-prox-icono.propio i {',
        '.me-finde[aria-pressed="true"] .me-finde-llave::after {', '.me-elegido-icono i {']) {
        assert.ok(estilo.indexOf(pisada) >= 0 && estilo.indexOf(pisada) < inicio, `después de ${pisada}`);
      }
      // Cada regla que pisa un color con CanvasText, al menos tan específica como la que lo da
      const PISADAS = [
        ['puntos del teléfono', /\.me-puntos/, ['.me-puntos .propio', '.me-puntos .compartido', '.me-puntos .publico-otro', '.me-puntos .feriado',
          '.me-puntos i']],
        ['punto de los próximos', /\.me-prox-icono/, ['.me-prox-icono.propio i']],
        ['punto del día elegido', /\.me-elegido-icono/, ['.me-elegido-icono i']],
        ['la perilla de la llave', /\.me-finde-llave::after/, ['.me-finde-llave::after', '.me-finde[aria-pressed="true"] .me-finde-llave::after']]
      ];
      for (const [nombre, patron, contra] of PISADAS) {
        const selectores = reglasDelBloque.filter(({ cuerpo }) => /CanvasText/.test(cuerpo))
          .flatMap(({ selector }) => selector.split(',').map((parte) => parte.trim())).filter((parte) => patron.test(parte));
        assert.ok(selectores.length > 0, nombre);
        for (const selector of selectores) {
          for (const otro of contra) assert.ok(noMenos(especificidad(selector), especificidad(otro)), `${selector} contra ${otro}`);
        }
      }
      // Las barras siguen en el bloque, con su borde
      assert.ok(reglasDelBloque.some(({ selector, cuerpo }) => selector.includes('.me-tira') && /CanvasText/.test(cuerpo)));
      // El anillo de un Personal (Público) de otra persona (spec 2026-10-29-mi-espacio-evento-publico, 5.1 y 7): en alto contraste, un
      // aro (Canvas por dentro y el borde en CanvasText, sin la sombra), no un punto lleno. Va después de la regla de los puntos, y es al
      // menos tan específico como ella y como la del teléfono que le da el anillo
      const lugarDe = (patron) => reglasDelBloque.findIndex(({ selector }) => patron.test(selector));
      const anillo = reglasDelBloque[lugarDe(/\.me-puntos [^,]*\.publico-otro/)];
      assert.ok(anillo, 'el anillo en alto contraste');
      assert.match(anillo.cuerpo, /background: Canvas;/);
      assert.match(anillo.cuerpo, /outline: 2px solid CanvasText;/);
      assert.match(anillo.cuerpo, /outline-offset: -2px;/);
      assert.match(anillo.cuerpo, /box-shadow: none;/);
      assert.ok(lugarDe(/\.me-puntos i\[class\]$/) < lugarDe(/\.me-puntos [^,]*\.publico-otro/), 'después de la de los puntos');
      for (const otro of ['.me-puntos i[class]', '.me-puntos .publico-otro']) {
        assert.ok(noMenos(especificidad(anillo.selector), especificidad(otro)), `${anillo.selector} contra ${otro}`);
      }
      // La muestra de la leyenda (también la rosada) lleva su borde, con un selector que puede con el que le da su color
      const muestra = reglasDelBloque.find(({ selector }) => selector.includes('.me-leyenda .me-color'));
      assert.ok(muestra && /CanvasText/.test(muestra.cuerpo), 'la muestra de la leyenda');
      for (const otro of ['.me-leyenda .publico-otro', '.me-leyenda .compartido', '.me-leyenda .me-color.ausente']) {
        assert.ok(noMenos(especificidad(muestra.selector), especificidad(otro)), `${muestra.selector} contra ${otro}`);
      }
    });

    // Revisión de la Task 7: en el teléfono, la línea de una licencia va sin el borde de color del principio; la regla tiene que poder
    // con .me-tira.licencia.inicio:not(.sigue-antes) (0,4,0), así que no alcanza con ponerlo en .me-tira
    it('la agenda en el teléfono: la licencia sin el borde de color del principio, con una regla que gana', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      const telefono = estilo.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n\s*\}(?=\r?\n)/)?.[1] ?? '';
      assert.match(telefono, /\n\s*\.me-tira\.licencia\.inicio:not\(\.sigue-antes\) \{ box-shadow: none; \}/);
      assert.doesNotMatch(telefono.match(/\n\s*\.me-tira \{([^}]*)\}/)?.[1] ?? '', /box-shadow/);
    });

    // Fuera de los modales, #me-anuncio es la única región viva; dentro de cada modal, solo su error sin campo (role="alert", como en
    // Configuración y Proyectos: el formulario está detrás del velo de los demás) y, en la planilla de contrato, además su propia
    // región viva, #mp-anuncio (spec 2026-10-27-mi-espacio-horas, 9: con aria-modal, la de la página puede no leerse; dice el mes que
    // se elige). Lo que se vuelve a dibujar (el cálculo, el paso, la suma, las horas de cada día) no es una región viva
    it('#me-anuncio es la única región viva de la página, fuera de las pestañas y de sus paneles; en los modales, solo su error', () => {
      assert.match(html(), /<p class="visualmente-oculto" id="me-anuncio" role="status"><\/p>/);
      const pagina = html().slice(0, html().indexOf('<div class="modal-overlay"'));
      assert.equal(pagina.match(/role="(status|alert|log)"/g)?.length, 1);
      assert.doesNotMatch(html(), /aria-live/);
      assert.ok(html().indexOf('id="me-anuncio"') < html().indexOf('role="tablist"'), 'antes de las pestañas');
      const enLosModales = [...html().slice(pagina.length).matchAll(/<[^>]*role="(status|alert|log)"[^>]*>/g)].map(([etiqueta]) => etiqueta);
      assert.deepEqual(enLosModales.map((etiqueta) => etiqueta.match(/id="([^"]+)"/)[1]),
        ['ml-error', 'mh-error', 'mp-anuncio', 'mp-error', 'ms-error', 'mu-error', 'ev-error', 'mea-error', 'mc-error']);
      const errores = enLosModales.filter((etiqueta) => !etiqueta.includes('id="mp-anuncio"'));
      assert.ok(errores.every((etiqueta) => etiqueta.includes('role="alert"') && etiqueta.includes(' hidden')));
      assert.deepEqual(enLosModales.filter((etiqueta) => etiqueta.includes('id="mp-anuncio"')),
        ['<p class="visualmente-oculto" id="mp-anuncio" role="status">']);
    });

    it('ningún id se repite', () => {
      const ids = [...html().matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
    });

    // Los formularios (spec 2026-10-26-mi-espacio-licencias-y-horas, 8): cinco modales de administración después del footer y fuera
    // del contenido, con los ids que usa mi-espacio.js, una sola vez y ninguno de la carcasa
    describe('los modales', () => {
      const MODALES = {
        // Con el segundo paso (spec 2026-10-27-mi-espacio-licencia-word, 6): el cuerpo y el pie del formulario y los del segundo paso
        'modal-licencia': ['modal-licencia-titulo', 'ml-cuerpo', 'ml-error', 'ml-tipos', 'ml-tipos-opciones', 'ml-tipos-error',
          'ml-desde-rotulo', 'ml-desde', 'ml-desde-error', 'ml-grupo-hasta', 'ml-hasta', 'ml-hasta-error', 'ml-grupo-horas', 'ml-horas',
          'ml-horas-error', 'ml-fechas-ayuda', 'ml-calculo', 'ml-nota', 'ml-nota-error', 'ml-grupo-mostrar', 'ml-mostrar',
          'ml-mostrar-ayuda', 'ml-grupo-autorizado', 'ml-autorizado', 'ml-autorizado-ayuda', 'ml-autorizado-error', 'ml-paso',
          'ml-sin-auditor', 'ml-pie-del-formulario', 'ml-borrar', 'ml-pie', 'ml-guardar', 'ml-paso-dos', 'ml-paso-dos-pie',
          'ml-descargar-word'],
        'modal-horas': ['modal-horas-titulo', 'mh-error', 'mh-fecha', 'mh-fecha-error', 'mh-desde', 'mh-desde-error', 'mh-hasta',
          'mh-hasta-error', 'mh-suma', 'mh-nota', 'mh-nota-error', 'mh-borrar', 'mh-guardar'],
        // La planilla de contrato (spec 2026-10-27-mi-espacio-horas, sección 4; la maqueta aprobada), después del modal de planta y
        // antes de la confirmación (que se abre sobre ella): los días, el selector de «Sumar el día» y sus errores los dibuja
        // mi-espacio.js. Su título es #mp-titulo
        'modal-planilla': ['mp-titulo', 'mp-anuncio', 'mp-anterior', 'mp-mes-titulo', 'mp-siguiente', 'mp-suma', 'mp-cuerpo', 'mp-error',
          'mp-como-mes', 'mp-dias', 'mp-sumar', 'mp-pendientes', 'mp-guardar'],
        'modal-saldos': ['modal-saldos-titulo', 'ms-error', 'ms-modalidad', 'ms-dias', 'ms-dias-rotulo', 'ms-dias-opciones', 'ms-dias-ayuda',
          'ms-dias-mitades', 'ms-dias-error', 'ms-estudios', 'ms-estudios-opciones', 'ms-estudios-error', 'ms-campos', 'ms-guardar'],
        'modal-uso': ['modal-uso-titulo', 'mu-error', 'mu-fecha', 'mu-fecha-error', 'mu-grupo-horas', 'mu-horas', 'mu-horas-error',
          'mu-calculo', 'mu-nota', 'mu-nota-error', 'mu-grupo-mostrar', 'mu-mostrar', 'mu-mostrar-ayuda', 'mu-paso', 'mu-sin-auditor',
          'mu-borrar', 'mu-pie', 'mu-guardar'],
        // La agenda (spec 2026-10-26-mi-espacio-agenda, 1, 2 y 6; maqueta 2, #evento y #evento-ajeno), antes de la confirmación: todos
        // los velos tienen el mismo z-index y el que va más abajo en el HTML queda arriba
        // Desde el evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 4), «Tipo de evento» (sus botones los dibuja
        // mi-espacio.js) en lugar de «¿Quién lo ve?», y lo del Público: qué ven los demás, «Otro» con su cuenta y la vista previa
        'modal-evento': ['modal-evento-titulo', 'ev-error', 'ev-titulo', 'ev-titulo-error', 'ev-fecha', 'ev-fecha-error', 'ev-desde',
          'ev-desde-error', 'ev-hasta', 'ev-hasta-error', 'ev-detalle', 'ev-detalle-error', 'ev-grupo-tipo', 'ev-tipo-rotulo', 'ev-tipos',
          'ev-tipo-ayuda', 'ev-tipo-error', 'ev-publico', 'ev-grupo-texto', 'ev-textos', 'ev-texto-error', 'ev-otro-grupo', 'ev-otro',
          'ev-otro-cuenta', 'ev-otro-error', 'ev-vista-previa', 'ev-vista-previa-dia', 'ev-vista-previa-evento', 'ev-grupo-personas',
          'ev-personas-cuantas', 'ev-personas', 'ev-personas-ayuda', 'ev-personas-error', 'ev-recordatorio', 'ev-aviso',
          'ev-recordatorio-ayuda', 'ev-recordatorio-error', 'ev-borrar', 'ev-guardar'],
        // Desde el evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 5.3), «Mi recordatorio» en su grupo, que se
        // oculta en un Público
        'modal-evento-ajeno': ['modal-evento-ajeno-titulo', 'mea-error', 'mea-cuando', 'mea-detalle', 'mea-quien', 'mea-grupo-recordatorio',
          'mea-recordatorio', 'mea-aviso', 'mea-ayuda', 'mea-cerrar'],
        'modal-confirmar': ['modal-confirmar-titulo', 'mc-error', 'modal-confirmar-texto', 'modal-confirmar-si']
      };
      const nombres = Object.keys(MODALES);
      // Cada modal, hasta el siguiente (el último, hasta los scripts)
      const modal = (id) => {
        const siguiente = nombres[nombres.indexOf(id) + 1];
        const fin = siguiente ? `(?=<div class="modal-overlay" id="${siguiente}">)` : '(?=\\s*<!-- Scripts del RPAD -->)';
        return bloque(new RegExp(`<div class="modal-overlay" id="${id}">[\\s\\S]*?${fin}`));
      };
      const posicion = (texto) => html().indexOf(texto);

      it('van después del footer, fuera del contenido, en su orden y antes de los scripts', () => {
        let anterior = posicion('</main>');
        assert.ok(posicion('</footer>') < anterior, 'el footer, dentro del contenido');
        for (const id of nombres) {
          assert.ok(modal(id), id);
          assert.ok(posicion(`id="${id}"`) > anterior, `${id}, después`);
          anterior = posicion(`id="${id}"`);
        }
        assert.ok(anterior < posicion('<script '), 'antes de los scripts');
      });

      it('cada id está una sola vez, en su modal, y ninguno es de la carcasa', () => {
        const ids = [...html().matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
        const carcasa = [...html().slice(0, posicion('<div class="modal-overlay"')).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
        for (const [id, propios] of Object.entries(MODALES)) {
          const deEste = [...modal(id).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
          // Todos los ids del modal son los suyos, y no hay otros
          assert.deepEqual(deEste.sort(), [id, ...propios].sort(), id);
          for (const propio of [id, ...propios]) {
            assert.equal(ids.filter(otro => otro === propio).length, 1, propio);
            assert.ok(!carcasa.includes(propio), `${propio} no es de la carcasa`);
          }
        }
      });

      it('los de administración: role="dialog", aria-modal y su título; la × y «Cancelar» con data-cerrar, y sin <form>', () => {
        for (const id of nombres) {
          const html = modal(id);
          const titulo = id === 'modal-planilla' ? 'mp-titulo' : `${id}-titulo`;
          assert.match(html, new RegExp(`<div class="modal me-modal(?: me-modal-chico| me-modal-planilla)?" role="dialog" aria-modal="true" aria-labelledby="${titulo}"`), id);
          assert.match(html, /<button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;<\/button>/, id);
          // El detalle de un evento ajeno no tiene nada que cancelar: se cierra con «Cerrar»
          if (id === 'modal-evento-ajeno') {
            assert.match(html, /<button type="button" class="sg-btn sg-btn-tinta" id="mea-cerrar" data-cerrar>Cerrar<\/button>/);
            assert.doesNotMatch(html, />Cancelar</);
          } else assert.match(html, /<button type="button" class="sg-btn sg-btn-borde" data-cerrar>Cancelar<\/button>/, id);
          assert.doesNotMatch(html, /<form\b|maxlength|onclick=/, id);
        }
        assert.match(modal('modal-confirmar'), /aria-describedby="modal-confirmar-texto"/);
      });

      // El segundo paso de «Cargar licencia» (spec 2026-10-27-mi-espacio-licencia-word, 6; maqueta, versión C): al guardar una
      // licencia, mi-espacio.js oculta el cuerpo y el pie del formulario y muestra los del segundo paso, con «Listo» (cierra) y
      // «Descargar Word»
      it('«Cargar licencia»: el cuerpo y el pie del formulario y, después, los del segundo paso, ocultos, con «Listo» y «Descargar Word»', () => {
        const html = modal('modal-licencia');
        assert.match(html, /<div class="modal-header">[\s\S]*?<\/div>\s*<div class="modal-body" id="ml-cuerpo">/);
        assert.match(html, /<div class="modal-footer" id="ml-pie-del-formulario">/);
        assert.match(html, new RegExp('<div class="modal-body me-paso-dos" id="ml-paso-dos" hidden></div>\\s*'
          + '<div class="modal-footer" id="ml-paso-dos-pie" hidden>\\s*<div class="botones">\\s*'
          + '<button type="button" class="sg-btn sg-btn-borde" data-cerrar>Listo</button>\\s*'
          + '<button type="button" class="sg-btn sg-btn-tinta" id="ml-descargar-word">Descargar Word</button>\\s*</div>\\s*</div>'));
        assert.ok(html.indexOf('id="ml-pie-del-formulario"') < html.indexOf('id="ml-paso-dos"'));
        // Las cuatro partes son hijas del .modal: el cuerpo es el que se desplaza y el pie queda a la vista
        assert.equal((html.match(/<div class="modal-body[" ]/g) ?? []).length, 2);
        assert.equal((html.match(/<div class="modal-footer[" ]/g) ?? []).length, 2);
      });

      // La agenda (spec 2026-10-26-mi-espacio-agenda, 1 y 6; maqueta 2, #evento y #evento-ajeno)
      it('el formulario del evento: «Tipo de evento» (a la vista para todos), lo del Público con su vista previa, y las personas', () => {
        const html = modal('modal-evento');
        assert.match(html, /<h2 class="modal-title" id="modal-evento-titulo">Nuevo evento<\/h2>/);
        assert.match(html, /<label class="form-label" for="ev-titulo">Qué<\/label>\s*<input type="text" class="form-input" id="ev-titulo" autocomplete="off" aria-describedby="ev-titulo-error">/);
        assert.match(html, /<input type="date" class="form-input" id="ev-fecha" aria-describedby="ev-fecha-error">/);
        for (const control of ['ev-desde', 'ev-hasta']) assert.match(html, new RegExp(`<input type="time" class="form-input" id="${control}" aria-describedby="${control}-error">`), control);
        assert.match(html, /<textarea class="form-textarea" id="ev-detalle" rows="3" aria-describedby="ev-detalle-error"><\/textarea>/);
        // El tipo, para todos los roles (sus botones, con data-tipo y aria-pressed, los dibuja mi-espacio.js: dos o tres), con su ayuda
        // y su error en la descripción del grupo
        assert.match(html, new RegExp('<div class="me-grupo" id="ev-grupo-tipo" role="group" aria-labelledby="ev-tipo-rotulo" aria-describedby="ev-tipo-ayuda ev-tipo-error">\\s*'
          + '<span class="form-label" id="ev-tipo-rotulo">Tipo de evento</span>\\s*<div class="me-opciones tres" id="ev-tipos"></div>\\s*'
          + '<p class="form-hint" id="ev-tipo-ayuda" hidden></p>\\s*<p class="form-error" id="ev-tipo-error" hidden></p>\\s*</div>'));
        assert.doesNotMatch(html, /¿Quién lo ve\?|Solo yo|>Compartido</);
        // Lo del Público, oculto hasta elegirlo: qué ven los demás (las pastillas las dibuja mi-espacio.js), «Otro» con su cuenta (fuera
        // de toda región viva) y la vista previa
        assert.match(html, /<div id="ev-publico" hidden>\s*<fieldset class="me-grupo" id="ev-grupo-texto" aria-describedby="ev-texto-error">\s*<legend class="form-label">Qué ven los demás<\/legend>\s*<div class="me-textos" id="ev-textos"><\/div>\s*<p class="form-error" id="ev-texto-error" hidden><\/p>\s*<\/fieldset>/);
        assert.match(html, /<div class="form-group me-otro" id="ev-otro-grupo" hidden>\s*<label class="form-label" for="ev-otro">Escribí qué ven los demás<\/label>\s*<input type="text" class="form-input" id="ev-otro" autocomplete="off" aria-describedby="ev-otro-cuenta ev-otro-error">\s*<p class="form-hint me-cuenta" id="ev-otro-cuenta">0 de 60 caracteres<\/p>\s*<p class="form-error" id="ev-otro-error" hidden><\/p>\s*<\/div>/);
        assert.match(html, /<div class="me-vista-previa" id="ev-vista-previa">\s*<p class="me-vista-previa-rotulo">Así lo ven los demás:<\/p>\s*<div class="me-vista-previa-celda">\s*<span class="me-vista-previa-dia" id="ev-vista-previa-dia"><\/span>\s*<div id="ev-vista-previa-evento"><\/div>\s*<\/div>\s*<p class="me-vista-previa-ayuda">En su agenda y en «Hoy y mañana» del Resumen\. No ven el título ni el detalle\.<\/p>\s*<\/div>\s*<\/div>/);
        assert.doesNotMatch(html, /aria-live|role="status"/);
        // Sin las clases de la maqueta (ag-*): las de la página son me-*
        for (const [, clases] of html.matchAll(/\sclass="([^"]*)"/g)) assert.doesNotMatch(clases, /(?:^|\s)ag-|agenda/, clases);
        // En el orden del formulario: el tipo, lo del Público, con quién y el recordatorio
        const lugar = (id) => html.indexOf(`id="${id}"`);
        assert.ok(lugar('ev-detalle') < lugar('ev-grupo-tipo') && lugar('ev-grupo-tipo') < lugar('ev-publico')
          && lugar('ev-publico') < lugar('ev-grupo-personas') && lugar('ev-grupo-personas') < lugar('ev-recordatorio'));
        // Las personas: su ayuda arranca vacía (mi-espacio.js escribe la del Laboral o la del Público)
        assert.match(html, /<fieldset class="me-grupo" id="ev-grupo-personas" aria-describedby="ev-personas-ayuda ev-personas-error" hidden>/);
        assert.match(html, /<p class="form-hint" id="ev-personas-ayuda"><\/p>/);
        // El recordatorio: las opciones las pone mi-espacio.js; cuándo sale (#ev-aviso) no es una región viva: lo describe el select
        assert.match(html, /<select class="form-select" id="ev-recordatorio" aria-describedby="ev-aviso ev-recordatorio-ayuda ev-recordatorio-error"><\/select>/);
        assert.match(html, /<p class="form-hint" id="ev-aviso" hidden><\/p>/);
        // La ayuda del recordatorio compartido arranca vacía: la describe el select, y un texto oculto con hidden igual entraría en la
        // descripción (accname 1.2, paso 2A). mi-espacio.js la escribe solo en un evento compartido
        assert.match(html, /<p class="form-hint" id="ev-recordatorio-ayuda" hidden><\/p>/);
        assert.match(html, /<button type="button" class="sg-link me-link-rojo" id="ev-borrar" hidden>Borrar el evento<\/button>/);
        assert.match(html, /<button type="button" class="sg-btn sg-btn-tinta" id="ev-guardar">Guardar<\/button>/);
      });

      // La planilla de contrato (spec 2026-10-27-mi-espacio-horas, sección 4; la maqueta aprobada, sin su barra oscura)
      it('la planilla de contrato: el mes con sus flechas y la banda fijos arriba, «Cómo se cuentan», las columnas, los días y el pie', () => {
        const html = modal('modal-planilla');
        assert.match(html, /<div class="modal me-modal me-modal-planilla" role="dialog" aria-modal="true" aria-labelledby="mp-titulo">/);
        assert.match(html, /<h2 class="modal-title" id="mp-titulo">Cargar horas extras<\/h2>/);
        // Su región viva, dentro del diálogo (con aria-modal, la de la página puede no leerse): el mes que se elige
        assert.match(html, /<p class="visualmente-oculto" id="mp-anuncio" role="status"><\/p>/);
        assert.match(html, /<button type="button" class="me-flecha" id="mp-anterior" aria-label="Mes anterior">/);
        assert.match(html, /<button type="button" class="me-flecha" id="mp-siguiente" aria-label="Mes siguiente">/);
        assert.match(html, /<h3 id="mp-mes-titulo"><\/h3>/);
        // Lo de arriba no se desplaza: va antes del cuerpo, que es el que se desplaza
        assert.match(html, /<div class="mp-arriba">[\s\S]*<div class="mp-suma" id="mp-suma"><\/div>\s*<\/div>\s*<div class="modal-body" id="mp-cuerpo">/);
        assert.match(html, /<div class="modal-body" id="mp-cuerpo">\s*<p class="me-modal-error" id="mp-error" role="alert" hidden><\/p>/);
        assert.match(html, /<details class="mp-como">\s*<summary>Cómo se cuentan las horas<\/summary>/);
        assert.ok(html.includes('<li><b>Un día hábil</b>: tu jornada es de 8:00 a 15:00 y cuenta la salida.'));
        assert.ok(html.includes('<li><b>Un feriado, sábado o domingo</b>: cuenta todo el tiempo de la entrada a la salida, de a media hora.'));
        assert.match(html, /<li id="mp-como-mes"><\/li>/);
        assert.match(html, /<div class="mp-columnas" aria-hidden="true">/);
        // Los días, sin semántica de lista (cada uno es un grupo con el nombre de su fecha)
        assert.match(html, /<div class="mp-dias" id="mp-dias"><\/div>/);
        assert.match(html, /<div class="mp-sumar" id="mp-sumar"><\/div>/);
        assert.match(html, /<span class="mp-pendientes" id="mp-pendientes">Todo guardado\.<\/span>/);
        assert.match(html, /<button type="button" class="sg-btn sg-btn-tinta" id="mp-guardar">Guardar<\/button>/);
        // Sin lo de la maqueta: ni su barra ni su parámetro para abrirla
        assert.doesNotMatch(html, /<ol\b|mq-|data-mq|abrir=/);
      });

      it('el detalle de un evento ajeno: cuándo, el detalle, quién, «Mi recordatorio» y quién lo puede cambiar', () => {
        const html = modal('modal-evento-ajeno');
        assert.match(html, /<div class="modal me-modal me-modal-chico" role="dialog" aria-modal="true" aria-labelledby="modal-evento-ajeno-titulo">/);
        assert.match(html, /<div class="form-group" id="mea-grupo-recordatorio">\s*<label class="form-label" for="mea-recordatorio">Mi recordatorio<\/label>\s*<select class="form-select" id="mea-recordatorio" aria-describedby="mea-aviso mea-ayuda"><\/select>/);
        assert.match(html, /<p class="form-hint" id="mea-ayuda">Solo quien lo creó puede cambiar el evento\.<\/p>/);
        const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
        assert.ok(ids.indexOf('mea-cuando') < ids.indexOf('mea-detalle') && ids.indexOf('mea-detalle') < ids.indexOf('mea-quien'));
      });

      it('cada campo dice su error en aria-describedby, y el campo del firmante es el de Configuración', () => {
        for (const control of ['ml-desde', 'ml-hasta', 'ml-horas', 'ml-nota', 'ml-autorizado', 'mh-fecha', 'mh-desde', 'mh-hasta', 'mh-nota',
          'mu-fecha', 'mu-horas', 'mu-nota', 'ev-titulo', 'ev-fecha', 'ev-desde', 'ev-hasta', 'ev-detalle', 'ev-recordatorio']) {
          assert.match(html(), new RegExp(`id="${control}"[^>]*aria-describedby="[^"]*${control}-error[^"]*"`), control);
        }
        for (const grupo of ['ml-tipos', 'ms-dias', 'ms-estudios']) {
          assert.match(html(), new RegExp(`<fieldset class="me-grupo" id="${grupo}" aria-describedby="[^"]*${grupo}-error"`), grupo);
        }
        assert.match(modal('modal-licencia'), /<label class="form-label" for="ml-autorizado">Autorizo a presentar las notas en mi nombre a:<\/label>/);
        assert.match(modal('modal-licencia'), /<p class="form-hint" id="ml-autorizado-ayuda">Solo aparecen los admins y editores activos con su firma cargada en Mi Perfil\.<\/p>/);
        // Las horas extras, de a media hora
        for (const control of ['mh-desde', 'mh-hasta']) assert.match(html(), new RegExp(`<input type="time" class="form-input" id="${control}" step="1800"`), control);
      });

      // Spec 2026-10-28-mi-espacio-vacaciones-en-la-carga (la revisión final): «Guardar» de «Cargar licencia» lee el cálculo, el
      // aviso del paso a Configuración y los días sin auditor (los avisos de la carga van en el cálculo). Uno oculto no se lee, así
      // que el atributo es fijo; sin región viva
      it('«Guardar» de «Cargar licencia» se describe con el cálculo, el paso y los días sin auditor, que están en su modal', () => {
        const licencia = modal('modal-licencia');
        assert.match(licencia,
          /<button type="button" class="sg-btn sg-btn-tinta" id="ml-guardar" aria-describedby="ml-calculo ml-paso ml-sin-auditor">Guardar<\/button>/);
        for (const id of ['ml-calculo', 'ml-paso', 'ml-sin-auditor']) {
          assert.match(licencia, new RegExp(`<div class="me-recuadro[^"]*" id="${id}" hidden></div>`), id);
          assert.doesNotMatch(licencia, new RegExp(`id="${id}"[^>]*aria-live`), id);
        }
      });
    });

    it('los scripts, a secas y en su orden: config, auth, main, api y mi-espacio.js', () => {
      const scripts = [...html().matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
      assert.deepEqual(scripts, ['js/config.js', `js/auth.js?v=${VERSION}`, `js/main.js?v=${VERSION}`, `js/api.js?v=${VERSION}`,
        `js/mi-espacio.js?v=${VERSION_MI_ESPACIO}`]);
      assert.equal(html().match(/<script\b/g).length, scripts.length, 'ningún <script> con otros atributos');
    });

    // Los tokens del Seguimiento van en el <style> de la página, con los tres que faltaban (spec 8) y, desde el Resumen «Titular», el
    // azul medio de la regla (spec 2026-10-27-mi-espacio-resumen, 6), y toda var() que usa se define en main.css o en este <style>,
    // salvo las que mi-espacio.js escribe en el style de cada tramo de la regla y de cada línea del resto: --n (los días del tramo),
    // --p (lo que se llena la línea), --demora y --duracion (el movimiento)
    it('el <style> define los tokens --sg-* con --sg-ambar-fondo, --sg-gris-fondo, --sg-violeta-fondo y --sg-medio, y toda var() que usa', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      for (const token of ['--sg-tinta', '--sg-suave', '--sg-linea', '--sg-ambar-fondo', '--sg-gris-fondo', '--sg-violeta-fondo']) {
        assert.match(estilo, new RegExp(`${token}:`), token);
      }
      assert.match(estilo, /--sg-medio: #4C7AB0;/);
      // El rosado de un Personal (Público) de otra persona (spec 2026-10-29-mi-espacio-evento-publico, 5.1): el texto, el fondo y el borde
      assert.match(estilo, /--sg-rosado: #8A3B5C; --sg-rosado-fondo: #F7E3EC; --sg-rosado-borde: #B5577F;/);
      const EN_EL_STYLE = ['--n', '--p', '--demora', '--duracion'];
      const css = fs.readFileSync(new URL('../public/css/main.css', import.meta.url), 'utf8') + estilo;
      for (const [, variable] of estilo.matchAll(/var\((--[\w-]+)\)/g)) {
        if (!EN_EL_STYLE.includes(variable)) assert.ok(new RegExp(`${variable}\\s*:`).test(css), `${variable} definida`);
      }
      const js = leer('js/mi-espacio.js');
      for (const variable of EN_EL_STYLE) assert.ok(js.includes(`${variable}:\${`), `${variable}, en el style que escribe mi-espacio.js`);
      assert.doesNotMatch(estilo, /text-transform:\s*uppercase/);
    });

    // El Resumen «Titular» (spec 2026-10-27-mi-espacio-resumen, 2 y 6): los estilos de la banda (con su ola, que no se dibuja en alto
    // contraste, como en las páginas públicas), la regla (un color por capa, y el número de un tramo angosto oculto: está en la lista
    // de debajo), el resto y las columnas, pasados de .o2-* (la maqueta) a .me-*, en el <style> de la página y nunca en main.css; los
    // de los tanques y las pastillas de «Niveles» se fueron
    it('el Resumen «Titular»: la banda, la regla, el resto y las columnas, sin los tanques de «Niveles» ni las clases de la maqueta', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/);
      for (const clase of ['.me-banda', '.me-banda-cuerpo', '.me-ola', '.me-frase', '.me-cifra', '.me-frase-bajada', '.me-regla', '.me-barra',
        '.me-regla-lista', '.me-entradas', '.me-entrada', '.me-talon', '.me-entrada-texto', '.me-resto-cabeza', '.me-linea', '.me-meses',
        '.me-extra', '.me-columnas', '.me-columna']) {
        assert.ok(estilo.includes(`${clase} {`), clase);
      }
      for (const capa of ['vence', 'tinta', 'medio', 'cargadas', 'por_habilitar']) {
        assert.ok(estilo.includes(`.me-tramo.${capa} {`), `tramo ${capa}`);
        assert.ok(estilo.includes(`.me-muestra.${capa} {`), `muestra ${capa}`);
      }
      assert.ok(estilo.includes('@container (max-width: 26px) { .me-tramo > span { visibility: hidden; } }'));
      assert.ok(estilo.includes('@media (forced-colors: active) { .me-ola { display: none; } }'));
      assert.doesNotMatch(estilo, /\.me-tanque|\.me-nivel|\.me-pastilla|\.me-leyenda-vac|\.me-contexto|data-llenar|\.c-(vence|tinta|medio|cargadas|por-habilitar)\b/);
      assert.doesNotMatch(estilo, /animation|@keyframes/);
      assert.doesNotMatch(estilo, /--rs-|\.op-|\.rs-|\.o2-|--o2-/);
      const main = fs.readFileSync(new URL('../public/css/main.css', import.meta.url), 'utf8');
      assert.doesNotMatch(main, /--sg-|\.me-banda|\.me-tramo|\.me-tanque/);
    });

    // En ningún ancho (de 320 a 1600 px) una fila de los números del resto o de las columnas de «Hoy y mañana» empieza con la línea
    // que los separa ni con el relleno de esa línea: más de 760 px, cada uno en una sola fila (una columna por número, sin pasar a
    // otra fila, en lugar de auto-fit, que a unos 641–711 px dejaba 3 + 1 con la línea al principio de la segunda); de 760 px para
    // abajo, los números de a dos por fila, sin la línea en el primero de cada una (el impar), y las columnas una debajo de la otra,
    // sin la línea
    it('el Resumen a media anchura: más de 760 px, en una sola fila; de 760 para abajo, ninguna fila empieza con la línea', () => {
      // El <style>, sin los comentarios (nombran las clases)
      const estilo = bloque(/<style>[\s\S]*?<\/style>/).replace(/\/\*[\s\S]*?\*\//g, '');
      // Un @media del <style>, con sus llaves anidadas
      const media = (condicion) => {
        const inicio = estilo.indexOf(`@media ${condicion} {`);
        assert.ok(inicio >= 0, condicion);
        let nivel = 0;
        for (let i = estilo.indexOf('{', inicio); i < estilo.length; i += 1) {
          if (estilo[i] === '{') nivel += 1;
          if (estilo[i] === '}' && (nivel -= 1) === 0) return estilo.slice(inicio, i + 1);
        }
        return '';
      };
      // Más ancho: una sola fila
      assert.ok(estilo.includes('.me-resto .me-numeros { list-style: none; margin: 16px 0 0; padding: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 16px 0; }'));
      assert.ok(estilo.includes('.me-columnas { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 18px 0; margin-top: 14px; }'));
      assert.ok(estilo.includes('.me-resto .me-numeros li + li { border-left: 1px solid var(--sg-linea); }'));
      assert.ok(estilo.includes('.me-columna:first-child { padding-left: 0; border-left: 0; }'));
      // Nada de auto-fit ni auto-fill en lo que lleva la línea (pasaría a otra fila según el ancho)
      for (const [, selector, cuerpo] of estilo.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (/\.me-numeros|\.me-columna/.test(selector) && !selector.includes('.me-modal')) {
          assert.doesNotMatch(cuerpo, /auto-fit|auto-fill/, selector.trim());
        }
      }
      // De 760 px para abajo
      const mediaAnchura = media('(max-width: 760px)');
      for (const regla of [
        '.me-resto .me-numeros { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-flow: row; }',
        '.me-resto .me-numero { padding: 4px 12px; }',
        '.me-resto .me-numeros li:nth-child(odd) { border-left: 0; }',
        '.me-resto .me-numeros li:nth-child(odd) .me-numero { padding-left: 4px; margin-left: 0; }',
        '.me-columnas { grid-template-columns: minmax(0, 1fr); grid-auto-flow: row; }',
        '.me-columna { padding: 0; border-left: 0; }'
      ]) {
        assert.ok(mediaAnchura.includes(regla), regla);
      }
      // Va después de las reglas de arriba (las pisa) y antes del teléfono, que ya no las repite
      assert.ok(estilo.indexOf('@media (max-width: 760px) {') > estilo.indexOf('.me-columna:first-child {'));
      const telefono = media('(max-width: 640px)');
      assert.ok(estilo.indexOf('@media (max-width: 760px) {') < estilo.indexOf('@media (max-width: 640px) {'));
      assert.doesNotMatch(telefono, /\.me-numeros|\.me-columna/);
      // Ningún otro @media cambia las columnas de los números ni de «Hoy y mañana»
      for (const [condicion] of estilo.matchAll(/@media [^{]+(?=\{)/g)) {
        if (condicion.trim() === '@media (max-width: 760px)') continue;
        assert.doesNotMatch(media(condicion.trim().slice('@media '.length)), /\.me-resto \.me-numeros \{|\.me-columnas \{/, condicion);
      }
    });

    // La planilla de contrato (spec 2026-10-27-mi-espacio-horas, sección 9; la maqueta, planilla.css): sus estilos, con el prefijo
    // .mp- (y el día por día de la pestaña, .me-dia-horas y .me-fila-aviso), en el <style> de la página; sus var() son los tokens
    // --sg-* de ese <style> (y las dos letras de main.css, --f-titulo y --f-texto). En 720 px o menos, el modal casi a pantalla
    // completa (sin tocar el velo de los otros modales) y cada día una tarjeta, con los rótulos visibles y los campos de 44 px
    it('la planilla de contrato: los estilos .mp- con los tokens --sg-* y, en 720 px o menos, cada día una tarjeta', () => {
      const estilo = bloque(/<style>[\s\S]*?<\/style>/).replace(/\/\*[\s\S]*?\*\//g, '');
      const definidas = new Set([...estilo.matchAll(/(--sg-[\w-]+):/g)].map(m => m[1]));
      const media = (condicion) => {
        const inicio = estilo.indexOf(`@media ${condicion} {`);
        assert.ok(inicio >= 0, condicion);
        let nivel = 0;
        for (let i = estilo.indexOf('{', inicio); i < estilo.length; i += 1) {
          if (estilo[i] === '{') nivel += 1;
          if (estilo[i] === '}' && (nivel -= 1) === 0) return estilo.slice(inicio, i + 1);
        }
        return '';
      };
      for (const clase of ['.me-modal-planilla', '.mp-arriba', '.mp-mes', '.mp-suma', '.mp-suma-cifra', '.mp-suma-texto', '.mp-como',
        '.mp-dias', '.mp-columnas', '.mp-dia', '.mp-fecha', '.mp-marcas', '.mp-campo', '.mp-rotulo', '.mp-horas', '.mp-acciones',
        '.mp-nota-campo', '.mp-nota-vista', '.mp-lugar', '.mp-guardada', '.mp-aviso', '.mp-error', '.mp-semana', '.mp-semana-total',
        '.mp-sumar', '.mp-pendientes', '.mp-hoy', '.me-dia-horas', '.me-fila-aviso']) {
        assert.ok(estilo.includes(`${clase} {`) || estilo.includes(`${clase},`) || estilo.includes(`${clase}.`) || estilo.includes(`${clase} `), clase);
      }
      // Cada var() de lo de la planilla es un token --sg-* definido en el <style> (o una de las dos letras de main.css)
      let reglas = 0;
      for (const [, selector, cuerpo] of estilo.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (!/\.mp-|me-modal-planilla|#modal-planilla|me-dia-horas|me-fila-aviso/.test(selector)) continue;
        reglas += 1;
        for (const [, variable] of cuerpo.matchAll(/var\((--[\w-]+)\)/g)) {
          assert.ok(definidas.has(variable) || ['--f-titulo', '--f-texto'].includes(variable), `${selector.trim()}: ${variable}`);
        }
      }
      assert.ok(reglas > 30, `${reglas} reglas`);
      // «Hoy» es texto (un <span class="mp-hoy"> que dibuja mi-espacio.js), no el ::after de la maqueta; sin la barra de la maqueta
      assert.doesNotMatch(estilo, /content:\s*'Hoy'|\.mq-/);
      // El cuerpo deja lugar arriba para las columnas pegadas (un día con el foco no queda debajo de ellas) y el aviso de arriba del
      // cuerpo no queda pegado a la cabeza fija
      assert.ok(estilo.includes('.me-modal-planilla .modal-body { padding: 0 24px 8px; scroll-padding-top: 44px; }'));
      assert.ok(estilo.includes('.me-modal-planilla .me-modal-error { margin-top: 14px; }'));
      // En 720 px o menos
      const telefono = media('(max-width: 720px)');
      for (const regla of ['#modal-planilla { padding: 8px; }', '.mp-columnas { display: none; }', '.mp-rotulo { display: block; }',
        '.mp-dia input[type="time"] { height: 44px; }', '.mp-arriba { grid-template-columns: minmax(0, 1fr);',
        "grid-template-areas: 'fecha horas' 'entrada salida' 'acciones acciones';", '.mp-sumar .form-select { min-width: 0; width: 100%; }',
        // Sin las columnas, sin su lugar arriba; el sábado o domingo, con el borde de la tarjeta y sin el de la computadora (no dos)
        '.me-modal-planilla .modal-body { padding: 0 12px 8px; scroll-padding-top: 0; }',
        '.mp-dia.finde { box-shadow: none; border-color: #C9D3DF; }']) {
        assert.ok(telefono.includes(regla), regla);
      }
      assert.match(telefono, /\.modal\.me-modal\.me-modal-planilla \{ height: calc\(100vh - 16px\); height: calc\(100dvh - 16px\);/);
      // El velo de los otros modales no cambia
      assert.doesNotMatch(telefono, /(?:^|[\s}])\.modal-overlay\s*\{/);
      // Después de las reglas de la planilla (las pisa), entre el corte de 760 px y el del teléfono
      assert.ok(estilo.indexOf('@media (max-width: 720px) {') > estilo.indexOf('.mp-dia.licencia {'));
      assert.ok(estilo.indexOf('@media (max-width: 760px) {') < estilo.indexOf('@media (max-width: 720px) {'));
      assert.ok(estilo.indexOf('@media (max-width: 720px) {') < estilo.indexOf('@media (max-width: 640px) {'));
      // Las flechas deshabilitadas (el mes en curso, el primero) se ven apagadas
      assert.ok(estilo.includes('.me-flecha:disabled { opacity: 0.4; cursor: default; }'));
    });
  });

  // Si no hay a quién autorizar, la lista solo dice "Nadie": la aclaración explica quiénes pueden aparecer
  it('configuracion.html: debajo del selector de persona autorizada dice quiénes aparecen', () => {
    const grupo = leer('configuracion.html').match(/<div class="form-group" id="grupo-autorizado"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(grupo, /<select id="l-autorizado"[^>]*><\/select>\s*<p class="form-hint" id="l-autorizado-ayuda">Solo aparecen los admins y editores activos con su firma cargada en Mi Perfil\.<\/p>/);
  });

  // Carcasa compartida (spec 2026-10-18-rediseno-publico, 5): encabezado con el nav principal, menú lateral y footer nuevos,
  // copiados a mano en cada página (las 14, con la portada; eran 14 hasta que Configuración reemplazó a Usuarios y Áreas, siguieron
  // siendo 13 con Proyectos, que reemplaza a Gestión, spec 2026-10-25-proyectos, 11, y vuelven a ser 14 con Mi espacio, spec
  // 2026-10-26-mi-espacio-licencias-y-horas, 11)
  const CON_CARCASA = paginas.filter(p => leer(p).includes('id="sidebar"'));
  const FUENTES = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Figtree:wght@400;500;600;700&display=swap';

  it('hay 14 páginas con carcasa', () => {
    assert.equal(CON_CARCASA.length, 14);
    assert.ok(CON_CARCASA.includes('mi-espacio.html'), 'mi-espacio.html');
  });

  for (const pagina of CON_CARCASA) {
    it(`${pagina}: carga main.css con ?v=${VERSION_CSS} y las fuentes nuevas`, () => {
      const html = leer(pagina);
      assert.deepEqual(html.match(/css\/main\.css[^"]*"/g), [`css/main.css?v=${VERSION_CSS}"`]);
      // La misma hoja de Google Fonts en todas las páginas (el navegador la baja una sola vez)
      assert.deepEqual(html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]*/g), [FUENTES]);
      assert.doesNotMatch(html, /family=Inter/);
    });

    it(`${pagina}: encabezado con el nav principal y los ids que usa main.js`, () => {
      const html = leer(pagina);
      for (const id of ['header-actions', 'sidebarToggle', 'sidebar', 'sidebarOverlay', 'sidebarPrincipal', 'sidebarAdmin', 'sidebarTools', 'sidebarAccount', 'footer-anio']) {
        assert.match(html, new RegExp(`id="${id}"`), id);
      }
      assert.match(html, /<nav class="header-nav" aria-label="Principal">/);
      for (const destino of ['index.html', 'datasets.html', 'calendario.html', 'contacto.html', 'admin.html', 'correos.html', 'configuracion.html', 'reportes.html', 'notas.html', 'proyectos.html', 'seguimiento.html', 'perfil.html', 'mi-espacio.html']) {
        assert.ok(html.includes(`href="${destino}"`), destino);
      }
      assert.ok(!html.includes('verificar.html'), 'sin el link roto a verificar.html');
      assert.ok(!html.includes('logo-blanco.png'), 'sin el logo que no está en el repo');
    });

    it(`${pagina}: footer nuevo, RPAD v2.0.0`, () => {
      const html = leer(pagina);
      assert.ok(html.includes('<span>RPAD v2.0.0</span>'));
      assert.doesNotMatch(html, /RPAD v1\.\d\.0/);
      assert.ok(html.includes('D. G. de Modernización e Investigación Territorial'));
    });
  }

  // La marca va en el nav del encabezado (las migas del detalle llevan la suya en la última miga)
  const MARCAS_DEL_NAV = [['index.html', 'index.html'], ['datasets.html', 'datasets.html'], ['dataset.html', 'datasets.html'], ['calendario.html', 'calendario.html'], ['contacto.html', 'contacto.html']];
  const navDelEncabezado = (html) => html.match(/<nav class="header-nav" aria-label="Principal">[\s\S]*?<\/nav>/)?.[0] ?? '';
  for (const [pagina, actual] of MARCAS_DEL_NAV) {
    it(`${pagina}: el nav marca la página actual`, () => {
      const nav = navDelEncabezado(leer(pagina));
      assert.match(nav, new RegExp(`<a href="${actual.replace('.', '\\.')}" aria-current="page">`));
      assert.equal(nav.match(/aria-current=/g).length, 1, 'una sola página actual');
    });
  }

  for (const pagina of CON_CARCASA.filter(p => !MARCAS_DEL_NAV.some(([publica]) => publica === p))) {
    it(`${pagina}: las de administración no marcan ninguna página del nav`, () => {
      assert.doesNotMatch(leer(pagina), /aria-current=/);
    });
  }

  // Lo copiado a mano queda fijado (spec 5: el mismo markup en las 14): el encabezado, el velo, el menú lateral y el footer de cada
  // página son los de index.html, con sus atributos de accesibilidad. Solo cambian la marca de la página actual y la sangría
  const PIEZAS_DE_LA_CARCASA = {
    encabezado: /<header class="header">[\s\S]*?<\/header>/,
    velo: /<div class="sidebar-overlay"[^>]*><\/div>/,
    'menú lateral': /<aside class="sidebar"[\s\S]*?<\/aside>/,
    footer: /<footer class="footer">[\s\S]*?<\/footer>/
  };
  const normalizarPieza = (pieza) => pieza.replace(/\r/g, '').replace(/ aria-current="page"/g, '').split('\n').map(linea => linea.trim()).filter(Boolean).join('\n');
  const piezasDeLaCarcasa = (pagina) => Object.fromEntries(Object.entries(PIEZAS_DE_LA_CARCASA).map(([nombre, patron]) => [nombre, leer(pagina).match(patron)?.[0]]));
  const CARCASA_DE_LA_PORTADA = piezasDeLaCarcasa('index.html');

  it('index.html: la carcasa de referencia, con los atributos de accesibilidad', () => {
    const { encabezado, velo, 'menú lateral': menu, footer } = CARCASA_DE_LA_PORTADA;
    assert.match(encabezado ?? '', /<button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Abrir el menú" aria-controls="sidebar" aria-expanded="false">/);
    assert.match(encabezado, /<nav class="header-nav" aria-label="Principal">/);
    assert.equal(velo, '<div class="sidebar-overlay" id="sidebarOverlay"></div>');
    assert.match(menu ?? '', /^<aside class="sidebar" id="sidebar" aria-label="Menú">/);
    assert.match(footer ?? '', /<span>RPAD v2\.0\.0<\/span>/);
    // Los íconos son decorativos
    for (const pieza of [encabezado, menu]) {
      for (const svg of pieza.match(/<svg[^>]*>/g)) assert.match(svg, /aria-hidden="true"/, svg);
    }
  });

  for (const pagina of CON_CARCASA.filter(p => p !== 'index.html')) {
    it(`${pagina}: el encabezado, el velo, el menú lateral y el footer son los de index.html`, () => {
      const piezas = piezasDeLaCarcasa(pagina);
      for (const [nombre, pieza] of Object.entries(CARCASA_DE_LA_PORTADA)) {
        assert.ok(piezas[nombre], `${nombre}: está`);
        assert.equal(normalizarPieza(piezas[nombre]), normalizarPieza(pieza), nombre);
      }
    });
  }

  // publico.css (spec 2026-10-18-rediseno-publico, 5.4): solo en las 5 públicas, con la misma versión que main.css, así las
  // insignias pastel no llegan a administración
  const PUBLICAS = ['index.html', 'datasets.html', 'dataset.html', 'calendario.html', 'contacto.html'];
  for (const pagina of paginas) {
    it(`${pagina}: publico.css ${PUBLICAS.includes(pagina) ? 'con' : 'sin'} ?v=${VERSION_CSS}`, () => {
      const usos = leer(pagina).match(/css\/publico\.css[^"]*"/g) || [];
      assert.deepEqual(usos, PUBLICAS.includes(pagina) ? [`css/publico.css?v=${VERSION_CSS}"`] : []);
    });
  }

  it('index.html: sin <style> propio ni Chart.js', () => {
    const html = leer('index.html');
    assert.doesNotMatch(html, /<style/);
    assert.doesNotMatch(html, /chart\.js|chart\.umd/i);
  });

  // publico.css va después de main.css: pisa lo que haga falta solo en las públicas
  it('index.html: main.css y después publico.css', () => {
    const html = leer('index.html');
    assert.ok(html.indexOf('css/main.css?v=') !== -1 && html.indexOf('css/main.css?v=') < html.indexOf('css/publico.css?v='));
  });

  // Las otras cuatro públicas: su <style> se fue a publico.css, que va después de main.css
  for (const pagina of PUBLICAS.filter(p => p !== 'index.html')) {
    it(`${pagina}: sin <style> propio, main.css y después publico.css`, () => {
      const html = leer(pagina);
      assert.doesNotMatch(html, /<style/);
      assert.ok(html.indexOf('css/main.css?v=') !== -1 && html.indexOf('css/main.css?v=') < html.indexOf('css/publico.css?v='));
    });
  }

  // Vista previa al compartir un link (spec 2026-10-18-rediseno-publico, 12): metas Open Graph absolutas en las 5 públicas.
  // og:url, uno solo y el de su página, solo en las que no llevan parámetros: en datasets.html y dataset.html una URL fija sin
  // ?id= ni filtros haría que Facebook o LinkedIn mandaran a la página sin el dataset o sin los filtros (Ruling 15)
  const OG_URL = {
    'index.html': 'https://rpad.mcrmodernizacion.gob.ar/',
    'datasets.html': null,
    'dataset.html': null,
    'calendario.html': 'https://rpad.mcrmodernizacion.gob.ar/calendario.html',
    'contacto.html': 'https://rpad.mcrmodernizacion.gob.ar/contacto.html'
  };
  for (const [pagina, url] of Object.entries(OG_URL)) {
    it(`${pagina}: vista previa al compartir, ${url ? `con og:url ${url}` : 'sin og:url'}`, () => {
      const html = leer(pagina);
      for (const meta of ['og:title', 'og:description', 'og:image', 'og:type', 'og:locale', 'twitter:card']) {
        assert.match(html, new RegExp(`<meta (property|name)="${meta}" content="[^"]+">`), meta);
      }
      assert.ok(html.includes('content="https://rpad.mcrmodernizacion.gob.ar/img/compartir.png"'));
      assert.ok(html.includes('<meta name="theme-color" content="#1A365D">'));
      assert.equal(html.match(/og:url/g)?.length ?? 0, url ? 1 : 0, 'og:url');
      if (url) assert.ok(html.includes(`<meta property="og:url" content="${url}">`), url);
    });
  }

  // robots.txt: cerrado para todos (buscadores incluidos), salvo los robots que arman la vista previa, y solo en las públicas
  it('robots.txt: los buscadores siguen afuera y los robots de vista previa entran a las públicas', () => {
    const robots = fs.readFileSync(new URL('robots.txt', DIRECTORIO), 'utf8').replace(/\r/g, '');
    assert.match(robots, /User-agent: \*\nDisallow: \/\s*$/);
    for (const robot of ['facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'TelegramBot', 'WhatsApp']) assert.ok(robots.includes(`User-agent: ${robot}`), robot);
    assert.ok(robots.includes('Allow: /img/compartir.png'));
    assert.doesNotMatch(robots, /Allow: \/admin|Allow: \/api/);
  });

  // Contacto (spec 2026-10-18-rediseno-publico, 10): solo se restila, contacto.js no cambia
  it('contacto.html: los campos con su label y sin api.js', () => {
    const html = leer('contacto.html');
    for (const id of ['nombre', 'email', 'tipo', 'mensaje']) assert.match(html, new RegExp(`<label for="${id}"`), id);
    assert.doesNotMatch(html, /js\/api\.js/);
    assert.ok(html.includes('Belgrano'), 'conserva la dirección postal');
  });

  it('contacto.html: los ids, las opciones y los límites que usa contacto.js', () => {
    const html = leer('contacto.html');
    for (const id of ['contacto-form', 'nombre', 'email', 'tipo', 'mensaje', 'char-count', 'btn-enviar', 'message-container']) {
      assert.equal(html.match(new RegExp(`id="${id}"`, 'g'))?.length, 1, id);
    }
    const opciones = [...html.matchAll(/<option value="([^"]*)">/g)].map(m => m[1]);
    assert.deepEqual(opciones, ['', 'consulta-general', 'solicitud-datos', 'reporte-error', 'sugerencia-dataset', 'otro']);
    assert.match(html, /<input type="text" id="nombre"[^>]* maxlength="100"/);
    assert.match(html, /<textarea id="mensaje"[^>]* maxlength="2000"/);
    // contacto.js marca el contador (warning y danger) en el padre de #char-count
    assert.match(html, /class="char-counter"[^>]*><span id="char-count">0<\/span>/);
  });

  it('login.html: el logo es logo-2025-blanco.png', () => {
    assert.ok(leer('login.html').includes('src="img/logo-2025-blanco.png"'));
  });
});

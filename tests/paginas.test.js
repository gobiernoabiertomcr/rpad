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
// feriados.js, spec 2026-10-26-feriados, 4): su versión es propia (solo la usa configuracion.html; subió al mismo número que
// VERSION_FERIADOS, y siguen siendo independientes)
const VERSION_PANTALLAS = '20261208';
// areas.js (reescrito para la pestaña Áreas de Configuración, spec 2026-10-24-configuracion, 4 y 6), que en areas.html cargaba
// ?v=20261204: un areas.js viejo en la caché con el HTML nuevo rompería la pestaña. Su versión es propia (solo la usa
// configuracion.html)
const VERSION_AREAS = '20261205';
// feriados.js (la pestaña Feriados de Configuración, la cuarta: el selector del año, los filtros y la tabla, spec
// 2026-10-26-feriados, 4): el número siguiente al más alto de este archivo cuando se creó (VERSION_REPORTES). Su versión es propia
// (solo la usa configuracion.html)
const VERSION_FERIADOS = '20261208';
// correos.js cambió después (Correos en pestañas; "Actualización" en el detalle del Libro; el aviso en su fecha en el texto de la
// licencia del firmante; la vista previa y la prueba como saldrían en la próxima corrida con notas; "Ver anexo" también para la
// reiteración, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5; el botón "Word" del Libro, spec 2026-10-24-generador-de-notas, 6):
// su versión es propia
const VERSION_CORREOS = '20261204';
// perfil.js cambió después (Mi Perfil en pestañas; "Datos al" y las actualizaciones registradas; "Requiere nota DGMIT" en la
// comparación, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; el editor que audita sin responsabilidad, spec
// 2026-10-20-editor-sin-responsabilidad; la vista previa de la firma con el nombre en negrita y el cargo un punto menos; el
// rótulo «Origen de los datos», spec 2026-10-24-metricas-y-reportes): su versión es propia
const VERSION_PERFIL = '20261127';
// admin.js y admin-fechas.js (la lista con filtros por estado, "Datos publicados" y "Próximo pedido"; después, el ícono "Ver
// seguimiento" de cada fila, spec 2026-10-20-seguimiento-dataset; "Requiere nota DGMIT" en el formulario, el filtro y la vista
// previa, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; «Recibido el» obligatorio, el origen de los datos y el aviso de la
// edición que no registra actualizaciones, spec 2026-10-24-metricas-y-reportes): su versión es propia
const VERSION_ADMIN = '20261127';
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
// tarjeta «Ciclo de vida del dato», la octava, segunda en «Para presentar» (spec 2026-10-25-ciclo-de-vida-del-dato, 4): su versión es
// propia (mayor que todas las de este archivo cuando se sumó)
const VERSION_REPORTES = '20261207';
// notas.js (el Generador de Notas de la DGMIT en tres pasos, con la vista previa en la hoja membretada y la descarga del Word, spec
// 2026-10-24-generador-de-notas, 3), que hasta ahora se cargaba sin ?v=: cambió por completo y un notas.js viejo en la caché con el
// HTML nuevo rompería la página. Su versión es propia
const VERSION_NOTAS = '20261204';
// proyectos.js (la página nueva de Proyectos, con el estilo del Seguimiento: los carriles de 3 años, la línea de tiempo y los logros
// del área, spec 2026-10-25-proyectos, 1, 2 y 10): el número siguiente al más alto de este archivo cuando se creó (con el renombre,
// VERSION_REPORTES y VERSION_PANTALLAS subieron al mismo número; siguen siendo independientes). Su versión es propia
const VERSION_PROYECTOS = '20261206';
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
  // pestaña en la dirección), con el renombre de Gestión a Proyectos (la ayuda del lector) y, por último, con la cuarta pestaña,
  // Feriados
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

    it('el aviso azul dice, tal cual, que estos feriados todavía no cambian los días hábiles del sistema', () => {
      const aviso = bloque(/<p class="fe-aviso" id="feriados-aviso">[\s\S]*?<\/p>/);
      assert.ok(aviso, 'el aviso');
      assert.match(aviso, /<svg aria-hidden="true"/);
      assert.equal(aviso.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(),
        'Por ahora, estos feriados no cambian los días hábiles del sistema: las Notas Digitales, la auditoría y Métricas siguen con los 9 feriados fijos.');
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
    const IDS_DEL_MODAL = ['modal-feriado', 'modal-feriado-titulo', 'feriado-error', 'fe-fecha', 'fe-fecha-dia', 'fe-fecha-error',
      'fe-nombre', 'fe-nombre-error', 'fe-tipo', 'fe-tipo-opciones', 'fe-tipo-error', 'fe-trasladado', 'fe-trasladado-ayuda',
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
    ['reportes.html', 'reportes', VERSION_REPORTES], ['notas.html', 'notas', VERSION_NOTAS], ['proyectos.html', 'proyectos', VERSION_PROYECTOS]]) {
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
      assert.ok(html.includes('<p class="ad-ayuda ad-arriba">Los datos de contacto se completan después, en Configuración → Áreas.</p>'));
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

  // Si no hay a quién autorizar, la lista solo dice "Nadie": la aclaración explica quiénes pueden aparecer
  it('configuracion.html: debajo del selector de persona autorizada dice quiénes aparecen', () => {
    const grupo = leer('configuracion.html').match(/<div class="form-group" id="grupo-autorizado"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(grupo, /<select id="l-autorizado"[^>]*><\/select>\s*<p class="form-hint" id="l-autorizado-ayuda">Solo aparecen los admins y editores activos con su firma cargada en Mi Perfil\.<\/p>/);
  });

  // Carcasa compartida (spec 2026-10-18-rediseno-publico, 5): encabezado con el nav principal, menú lateral y footer nuevos,
  // copiados a mano en cada página (las 13, con la portada; eran 14 hasta que Configuración reemplazó a Usuarios y Áreas, y siguen
  // siendo 13 con Proyectos, que reemplaza a Gestión: spec 2026-10-25-proyectos, 11)
  const CON_CARCASA = paginas.filter(p => leer(p).includes('id="sidebar"'));
  const FUENTES = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Figtree:wght@400;500;600;700&display=swap';

  it('hay 13 páginas con carcasa', () => {
    assert.equal(CON_CARCASA.length, 13);
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
      for (const destino of ['index.html', 'datasets.html', 'calendario.html', 'contacto.html', 'admin.html', 'correos.html', 'configuracion.html', 'reportes.html', 'notas.html', 'proyectos.html', 'seguimiento.html', 'perfil.html']) {
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

  // Lo copiado a mano queda fijado (spec 5: el mismo markup en las 13): el encabezado, el velo, el menú lateral y el footer de cada
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

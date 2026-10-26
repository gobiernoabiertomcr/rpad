// Proyectos (spec 2026-10-25-proyectos, sección 9): las reglas puras de proyectos, hitos y logros (la validación, sus
// mensajes, la evidencia derivada, el nombre original de un archivo subido y los ids). Sin base ni Date local: hoy llega
// por parámetro como texto 'AAAA-MM-DD'.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESTADOS_PROYECTO, PRIORIDADES, CATEGORIAS, ICONOS_PROYECTO, LARGOS, FECHA_MINIMA, MENSAJES_PROYECTOS,
  fechaMaxima, validarProyecto, validarHito, evidenciaTipo, nombreOriginal, idPositivo, primerError,
  LARGO_NOMBRE_ARCHIVO, nombreDeArchivo
} from '../services/proyectosReglas.js';

const HOY = '2026-10-25';
const OPCIONES = Object.freeze({ hoy: HOY });
const PARCIAL = Object.freeze({ hoy: HOY, parcial: true });

// Un proyecto con todos sus campos válidos
const PROYECTO = Object.freeze({
  nombre: '[TEST] Portal de datos',
  descripcion: '[TEST] La descripción del proyecto.',
  estado: 'en_curso',
  prioridad: 'alta',
  categoria: 'normativa',
  fecha_inicio: '2026-03-16',
  responsable: '[TEST] Persona inventada',
  enlace_externo: 'https://example.com/proyecto',
  color: '#0950C6',
  icono: 'database',
  areas: Object.freeze([3, 5])
});

// Un hito con todos sus campos válidos
const HITO = Object.freeze({
  titulo: '[TEST] Primera versión publicada',
  fecha: '2026-06-30',
  descripcion: '[TEST] Lo que se hizo.',
  evidencia_url: 'https://example.com/evidencia'
});

const erroresDelProyecto = (cambio, opciones = OPCIONES) => validarProyecto({ ...PROYECTO, ...cambio }, opciones).errores;
const erroresDelHito = (cambio, opciones = OPCIONES) => validarHito({ ...HITO, ...cambio }, opciones).errores;
const error = (campo, mensaje) => [{ campo, mensaje }];

describe('constantes y mensajes', () => {
  it('las listas de estados, prioridades y categorías, en su orden', () => {
    assert.deepEqual([...ESTADOS_PROYECTO], ['idea', 'en_curso', 'completado', 'suspendido']);
    assert.deepEqual([...PRIORIDADES], ['alta', 'media', 'baja']);
    assert.deepEqual([...CATEGORIAS], ['tecnologia', 'normativa', 'difusion']);
  });

  it('los largos y la fecha mínima', () => {
    assert.deepEqual({ ...LARGOS }, { nombre: 200, responsable: 150, enlace: 500, titulo: 200, evidencia: 500 });
    assert.equal(FECHA_MINIMA, '2000-01-01');
  });

  it('los mensajes de validación, al pie de la letra', () => {
    assert.deepEqual({ ...MENSAJES_PROYECTOS }, {
      nombre: 'Escribí el nombre del proyecto.', nombreLargo: 'El nombre puede tener hasta 200 caracteres.',
      estado: 'El estado no es válido.', prioridad: 'La prioridad no es válida.', categoria: 'La categoría no es válida.',
      fechaInicio: 'La fecha de elevación no es válida.',
      responsable: 'El autor o responsable puede tener hasta 150 caracteres.',
      enlace: 'El enlace tiene que empezar con http:// o https://.', enlaceLargo: 'El enlace puede tener hasta 500 caracteres.',
      color: 'El color no es válido.', icono: 'El ícono no es válido.', areas: 'Elegí áreas que existan.',
      titulo: 'Escribí el título del hito.', tituloLargo: 'El título puede tener hasta 200 caracteres.',
      fecha: 'Elegí la fecha del hito.', fechaInvalida: 'La fecha del hito no es válida.',
      evidencia: 'El enlace de la evidencia tiene que empezar con http:// o https://.',
      evidenciaLarga: 'El enlace de la evidencia puede tener hasta 500 caracteres.',
      sinDatos: 'No hay datos para guardar.'
    });
  });

  it('las constantes están congeladas', () => {
    for (const constante of [ESTADOS_PROYECTO, PRIORIDADES, CATEGORIAS, ICONOS_PROYECTO, LARGOS, MENSAJES_PROYECTOS]) {
      assert.ok(Object.isFrozen(constante));
    }
  });

  it('ICONOS_PROYECTO son las 25 claves de ICON_SELECTOR_MAP de main.js, en su orden', () => {
    const texto = readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
    const mapa = texto.match(/const ICON_SELECTOR_MAP = \{([\s\S]*?)\};/);
    assert.ok(mapa, 'main.js tiene ICON_SELECTOR_MAP');
    const claves = [...mapa[1].matchAll(/'([^']+)'\s*:/g)].map((m) => m[1]);
    assert.equal(claves.length, 25);
    assert.deepEqual([...ICONOS_PROYECTO], claves);
  });
});

describe('fechaMaxima', () => {
  it('el 31/12 de cinco años después del de hoy', () => {
    assert.equal(fechaMaxima('2026-10-25'), '2031-12-31');
    assert.equal(fechaMaxima('2026-01-01'), '2031-12-31');
    assert.equal(fechaMaxima('2027-12-31'), '2032-12-31');
  });

  it('con un hoy que no es una fecha da null, sin tirar', () => {
    for (const hoy of [undefined, null, '', '2026-02-30', '25/10/2026', 20261025, {}]) {
      assert.equal(fechaMaxima(hoy), null);
    }
  });
});

describe('validarProyecto', () => {
  it('un proyecto válido da los valores de entrada, sin errores', () => {
    assert.deepEqual(validarProyecto(PROYECTO, OPCIONES), {
      datos: { ...PROYECTO, areas: [3, 5] },
      errores: []
    });
  });

  it('el mínimo válido (solo el nombre): los valores por defecto y el resto en null', () => {
    assert.deepEqual(validarProyecto({ nombre: '[TEST] Mínimo' }, OPCIONES), {
      datos: {
        nombre: '[TEST] Mínimo', descripcion: null, estado: 'idea', prioridad: 'media', categoria: 'tecnologia',
        fecha_inicio: null, responsable: null, enlace_externo: null, color: null, icono: null, areas: []
      },
      errores: []
    });
  });

  it('recorta los textos, y un texto vacío o de espacios es null', () => {
    const { datos, errores } = validarProyecto({
      nombre: '  [TEST] Con espacios  ', descripcion: '   ', responsable: '  [TEST] Alguien  ',
      enlace_externo: '  https://example.com  ', color: ' #1A365D ', icono: ' flag ', fecha_inicio: ' 2026-01-02 '
    }, OPCIONES);
    assert.deepEqual(errores, []);
    assert.equal(datos.nombre, '[TEST] Con espacios');
    assert.equal(datos.descripcion, null);
    assert.equal(datos.responsable, '[TEST] Alguien');
    assert.equal(datos.enlace_externo, 'https://example.com');
    assert.equal(datos.color, '#1A365D');
    assert.equal(datos.icono, 'flag');
    assert.equal(datos.fecha_inicio, '2026-01-02');
  });

  it('el nombre vacío, de espacios o que falta', () => {
    assert.deepEqual(erroresDelProyecto({ nombre: '' }), error('nombre', MENSAJES_PROYECTOS.nombre));
    assert.deepEqual(erroresDelProyecto({ nombre: '    ' }), error('nombre', MENSAJES_PROYECTOS.nombre));
    assert.deepEqual(erroresDelProyecto({ nombre: null }), error('nombre', MENSAJES_PROYECTOS.nombre));
    assert.deepEqual(erroresDelProyecto({ nombre: 42 }), error('nombre', MENSAJES_PROYECTOS.nombre));
    assert.deepEqual(validarProyecto({}, OPCIONES).errores, error('nombre', MENSAJES_PROYECTOS.nombre));
  });

  it('el nombre hasta 200 caracteres, contados con Array.from', () => {
    assert.deepEqual(erroresDelProyecto({ nombre: 'a'.repeat(200) }), []);
    assert.deepEqual(erroresDelProyecto({ nombre: 'a'.repeat(201) }), error('nombre', MENSAJES_PROYECTOS.nombreLargo));
    // 200 emojis son 400 unidades de UTF-16, pero 200 caracteres para el varchar
    assert.deepEqual(erroresDelProyecto({ nombre: '📊'.repeat(200) }), []);
    assert.deepEqual(erroresDelProyecto({ nombre: '📊'.repeat(201) }), error('nombre', MENSAJES_PROYECTOS.nombreLargo));
  });

  it('el estado, la prioridad y la categoría, de su lista', () => {
    assert.deepEqual(erroresDelProyecto({ estado: 'otro' }), error('estado', MENSAJES_PROYECTOS.estado));
    assert.deepEqual(erroresDelProyecto({ prioridad: 'urgente' }), error('prioridad', MENSAJES_PROYECTOS.prioridad));
    assert.deepEqual(erroresDelProyecto({ categoria: 'deporte' }), error('categoria', MENSAJES_PROYECTOS.categoria));
    assert.deepEqual(erroresDelProyecto({ estado: 3 }), error('estado', MENSAJES_PROYECTOS.estado));
    for (const estado of ESTADOS_PROYECTO) assert.equal(validarProyecto({ ...PROYECTO, estado }, OPCIONES).datos.estado, estado);
    for (const prioridad of PRIORIDADES) assert.deepEqual(erroresDelProyecto({ prioridad }), []);
    for (const categoria of CATEGORIAS) assert.deepEqual(erroresDelProyecto({ categoria }), []);
  });

  it('el estado, la prioridad y la categoría que faltan o vienen vacíos toman su valor por defecto', () => {
    for (const vacio of [undefined, null, '']) {
      const { datos, errores } = validarProyecto({ nombre: '[TEST] X', estado: vacio, prioridad: vacio, categoria: vacio }, OPCIONES);
      assert.deepEqual(errores, []);
      assert.equal(datos.estado, 'idea');
      assert.equal(datos.prioridad, 'media');
      assert.equal(datos.categoria, 'tecnologia');
    }
  });

  it('la fecha de elevación: válida o vacía, del 01/01/2000 al 31/12 de cinco años después', () => {
    const mensaje = error('fecha_inicio', MENSAJES_PROYECTOS.fechaInicio);
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '2026-02-30' }), mensaje);
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '1999-12-31' }), mensaje);
    assert.equal(fechaMaxima(HOY), '2031-12-31');
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '2032-01-01' }), mensaje);
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '16/03/2026' }), mensaje);
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: 20260316 }), mensaje);
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '2000-01-01' }), []);
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '2031-12-31' }), []);
    for (const vacio of [undefined, null, '', '  ']) {
      const { datos, errores } = validarProyecto({ ...PROYECTO, fecha_inicio: vacio }, OPCIONES);
      assert.deepEqual(errores, []);
      assert.equal(datos.fecha_inicio, null);
    }
  });

  it('sin un hoy válido, una fecha de elevación no pasa (no se sabe el tope); vacía, sí', () => {
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '2026-03-16' }, { hoy: 'ayer' }),
      error('fecha_inicio', MENSAJES_PROYECTOS.fechaInicio));
    assert.deepEqual(erroresDelProyecto({ fecha_inicio: '' }, {}), []);
  });

  it('el autor o responsable, hasta 150 caracteres', () => {
    assert.deepEqual(erroresDelProyecto({ responsable: 'r'.repeat(150) }), []);
    assert.deepEqual(erroresDelProyecto({ responsable: 'r'.repeat(151) }), error('responsable', MENSAJES_PROYECTOS.responsable));
  });

  it('el enlace: vacío, o http/https y hasta 500 caracteres', () => {
    assert.deepEqual(erroresDelProyecto({ enlace_externo: 'javascript:alert(1)' }), error('enlace_externo', MENSAJES_PROYECTOS.enlace));
    assert.deepEqual(erroresDelProyecto({ enlace_externo: 'ftp://example.com' }), error('enlace_externo', MENSAJES_PROYECTOS.enlace));
    assert.deepEqual(erroresDelProyecto({ enlace_externo: 'example.com' }), error('enlace_externo', MENSAJES_PROYECTOS.enlace));
    assert.deepEqual(erroresDelProyecto({ enlace_externo: 'http://example.com' }), []);
    assert.deepEqual(erroresDelProyecto({ enlace_externo: 'HTTPS://EXAMPLE.COM' }), []);
    const largo = 'https://example.com/';
    assert.deepEqual(erroresDelProyecto({ enlace_externo: largo + 'a'.repeat(500 - largo.length) }), []);
    assert.deepEqual(erroresDelProyecto({ enlace_externo: largo + 'a'.repeat(501 - largo.length) }),
      error('enlace_externo', MENSAJES_PROYECTOS.enlaceLargo));
    assert.equal(validarProyecto({ ...PROYECTO, enlace_externo: '' }, OPCIONES).datos.enlace_externo, null);
  });

  it('el color: cualquier #RRGGBB, tal cual, no solo los de la paleta', () => {
    assert.deepEqual(validarProyecto({ ...PROYECTO, color: '#6ca3c6' }, OPCIONES),
      { datos: { ...PROYECTO, areas: [3, 5], color: '#6ca3c6' }, errores: [] });
    assert.equal(validarProyecto({ ...PROYECTO, color: '#6CA3C6' }, OPCIONES).datos.color, '#6CA3C6');
    for (const color of ['red', '#fff', '#12345g', '6ca3c6', '#6ca3c6ff', 123]) {
      assert.deepEqual(erroresDelProyecto({ color }), error('color', MENSAJES_PROYECTOS.color), String(color));
    }
    assert.equal(validarProyecto({ ...PROYECTO, color: '' }, OPCIONES).datos.color, null);
  });

  it('el ícono: de ICON_SELECTOR_MAP o vacío', () => {
    assert.deepEqual(erroresDelProyecto({ icono: 'rocket' }), error('icono', MENSAJES_PROYECTOS.icono));
    assert.deepEqual(erroresDelProyecto({ icono: 'folder-kanban' }), error('icono', MENSAJES_PROYECTOS.icono));
    for (const icono of ICONOS_PROYECTO) assert.deepEqual(erroresDelProyecto({ icono }), []);
    assert.equal(validarProyecto({ ...PROYECTO, icono: '' }, OPCIONES).datos.icono, null);
    assert.equal(validarProyecto({ ...PROYECTO, icono: null }, OPCIONES).datos.icono, null);
  });

  it('las áreas: enteros positivos sin repetir; un id inválido da el error de áreas', () => {
    const mensaje = error('areas', MENSAJES_PROYECTOS.areas);
    assert.deepEqual(erroresDelProyecto({ areas: [3, '3', 'x'] }), mensaje);
    assert.equal(validarProyecto({ ...PROYECTO, areas: [3, 3, 5] }, OPCIONES).datos.areas.length, 2);
    assert.deepEqual(validarProyecto({ ...PROYECTO, areas: [3, 3, 5] }, OPCIONES).datos.areas, [3, 5]);
    assert.deepEqual(validarProyecto({ ...PROYECTO, areas: ['7', 7, 2] }, OPCIONES).datos.areas, [7, 2]);
    for (const areas of [[0], [-3], [1.5], ['1e3'], [null], [{}], 'x', 5, { 0: 3 }]) {
      assert.deepEqual(erroresDelProyecto({ areas }), mensaje, JSON.stringify(areas));
    }
    for (const vacio of [undefined, null, []]) {
      const { datos, errores } = validarProyecto({ ...PROYECTO, areas: vacio }, OPCIONES);
      assert.deepEqual(errores, []);
      assert.deepEqual(datos.areas, []);
    }
  });

  it('los errores van en el orden de los campos, uno por campo, y el campo con error queda en null', () => {
    const { datos, errores } = validarProyecto({
      nombre: '', estado: 'x', prioridad: 'x', categoria: 'x', fecha_inicio: 'x', responsable: 'r'.repeat(151),
      enlace_externo: 'x', color: 'x', icono: 'x', areas: ['x']
    }, OPCIONES);
    assert.deepEqual(errores.map((e) => e.campo),
      ['nombre', 'estado', 'prioridad', 'categoria', 'fecha_inicio', 'responsable', 'enlace_externo', 'color', 'icono', 'areas']);
    assert.deepEqual(errores.map((e) => e.mensaje), [
      MENSAJES_PROYECTOS.nombre, MENSAJES_PROYECTOS.estado, MENSAJES_PROYECTOS.prioridad, MENSAJES_PROYECTOS.categoria,
      MENSAJES_PROYECTOS.fechaInicio, MENSAJES_PROYECTOS.responsable, MENSAJES_PROYECTOS.enlace, MENSAJES_PROYECTOS.color,
      MENSAJES_PROYECTOS.icono, MENSAJES_PROYECTOS.areas
    ]);
    for (const campo of ['nombre', 'estado', 'prioridad', 'categoria', 'fecha_inicio', 'responsable', 'enlace_externo', 'color', 'icono', 'areas']) {
      assert.equal(datos[campo], null, campo);
    }
  });

  it('no recibe evidencia_tipo, orden ni campos desconocidos', () => {
    const { datos } = validarProyecto({ ...PROYECTO, orden: 4, created_by: 1, activo: false }, OPCIONES);
    assert.deepEqual(Object.keys(datos).sort(), Object.keys(PROYECTO).sort());
  });

  it('una entrada o unas opciones raras no la hacen tirar', () => {
    for (const entrada of [undefined, null, 'texto', 42, [], true]) {
      assert.deepEqual(validarProyecto(entrada, OPCIONES).errores, error('nombre', MENSAJES_PROYECTOS.nombre));
    }
    assert.deepEqual(validarProyecto({ nombre: '[TEST] X' }).errores, []);
    assert.deepEqual(validarProyecto({ nombre: '[TEST] X' }, null).errores, []);
    assert.deepEqual(validarProyecto(Object.create(null), OPCIONES).errores, error('nombre', MENSAJES_PROYECTOS.nombre));
  });
});

describe('validarProyecto con parcial (la edición)', () => {
  it('solo valida y devuelve las claves presentes', () => {
    assert.deepEqual(validarProyecto({ descripcion: 'x' }, PARCIAL), { datos: { descripcion: 'x' }, errores: [] });
    assert.deepEqual(validarProyecto({ estado: 'completado', areas: [] }, PARCIAL),
      { datos: { estado: 'completado', areas: [] }, errores: [] });
  });

  it('sin valores por defecto: un estado ausente no se toca', () => {
    const { datos } = validarProyecto({ nombre: '[TEST] Renombrado' }, PARCIAL);
    assert.deepEqual(datos, { nombre: '[TEST] Renombrado' });
  });

  it('un nombre presente y vacío es un error', () => {
    assert.deepEqual(validarProyecto({ nombre: '' }, PARCIAL).errores, error('nombre', MENSAJES_PROYECTOS.nombre));
    assert.deepEqual(validarProyecto({ nombre: '   ' }, PARCIAL).errores, error('nombre', MENSAJES_PROYECTOS.nombre));
    assert.deepEqual(validarProyecto({ nombre: null }, PARCIAL).errores, error('nombre', MENSAJES_PROYECTOS.nombre));
  });

  it('un estado, una prioridad o una categoría presentes y vacíos son un error (la columna no admite null)', () => {
    assert.deepEqual(validarProyecto({ estado: '' }, PARCIAL).errores, error('estado', MENSAJES_PROYECTOS.estado));
    assert.deepEqual(validarProyecto({ prioridad: null }, PARCIAL).errores, error('prioridad', MENSAJES_PROYECTOS.prioridad));
    assert.deepEqual(validarProyecto({ categoria: '' }, PARCIAL).errores, error('categoria', MENSAJES_PROYECTOS.categoria));
  });

  it('un texto opcional presente y vacío se borra (null)', () => {
    assert.deepEqual(validarProyecto({ descripcion: '', color: '', icono: '', fecha_inicio: '', enlace_externo: null }, PARCIAL),
      { datos: { descripcion: null, color: null, icono: null, fecha_inicio: null, enlace_externo: null }, errores: [] });
  });

  it('sin ninguna clave que se pueda guardar: «No hay datos para guardar.»', () => {
    for (const entrada of [{}, { orden: 3 }, { evidencia_tipo: 'url' }, null]) {
      assert.deepEqual(validarProyecto(entrada, PARCIAL), {
        datos: {}, errores: [{ campo: null, mensaje: MENSAJES_PROYECTOS.sinDatos }]
      });
    }
  });

  it('solo cuenta el true literal', () => {
    assert.deepEqual(validarProyecto({ descripcion: 'x' }, { hoy: HOY, parcial: 'si' }).errores,
      error('nombre', MENSAJES_PROYECTOS.nombre));
  });
});

describe('validarHito', () => {
  it('un hito válido da los valores de entrada, sin errores', () => {
    assert.deepEqual(validarHito(HITO, OPCIONES), { datos: { ...HITO }, errores: [] });
  });

  it('el mínimo válido (título y fecha): el resto en null', () => {
    assert.deepEqual(validarHito({ titulo: ' [TEST] Hito ', fecha: '2026-10-25' }, OPCIONES), {
      datos: { titulo: '[TEST] Hito', fecha: '2026-10-25', descripcion: null, evidencia_url: null },
      errores: []
    });
  });

  it('falta el título', () => {
    assert.deepEqual(erroresDelHito({ titulo: undefined }), error('titulo', MENSAJES_PROYECTOS.titulo));
    assert.deepEqual(erroresDelHito({ titulo: '' }), error('titulo', MENSAJES_PROYECTOS.titulo));
    assert.deepEqual(erroresDelHito({ titulo: '   ' }), error('titulo', MENSAJES_PROYECTOS.titulo));
  });

  it('el título hasta 200 caracteres, contados con Array.from', () => {
    assert.deepEqual(erroresDelHito({ titulo: 't'.repeat(200) }), []);
    assert.deepEqual(erroresDelHito({ titulo: 't'.repeat(201) }), error('titulo', MENSAJES_PROYECTOS.tituloLargo));
    assert.deepEqual(erroresDelHito({ titulo: '🎯'.repeat(200) }), []);
  });

  it('falta la fecha', () => {
    for (const fecha of [undefined, null, '', '  ']) {
      assert.deepEqual(erroresDelHito({ fecha }), error('fecha', MENSAJES_PROYECTOS.fecha), String(fecha));
    }
  });

  it('la fecha mal escrita o fuera de rango', () => {
    for (const fecha of ['1999-12-31', '2032-01-01', '2026-02-30', '30/06/2026', 20260630, 'x']) {
      assert.deepEqual(erroresDelHito({ fecha }), error('fecha', MENSAJES_PROYECTOS.fechaInvalida), String(fecha));
    }
    assert.deepEqual(erroresDelHito({ fecha: '2000-01-01' }), []);
    assert.deepEqual(erroresDelHito({ fecha: '2031-12-31' }), []);
    // Un hito previsto (posterior a hoy) vale
    assert.deepEqual(erroresDelHito({ fecha: '2027-03-01' }), []);
  });

  it('sin un hoy válido la fecha no pasa', () => {
    assert.deepEqual(erroresDelHito({}, { hoy: null }), error('fecha', MENSAJES_PROYECTOS.fechaInvalida));
  });

  it('la evidencia: vacía, o http/https y hasta 500 caracteres', () => {
    assert.deepEqual(erroresDelHito({ evidencia_url: 'ftp://example.com/x' }), error('evidencia_url', MENSAJES_PROYECTOS.evidencia));
    assert.deepEqual(erroresDelHito({ evidencia_url: 'javascript:alert(1)' }), error('evidencia_url', MENSAJES_PROYECTOS.evidencia));
    const largo = 'https://example.com/';
    assert.deepEqual(erroresDelHito({ evidencia_url: largo + 'a'.repeat(500 - largo.length) }), []);
    assert.deepEqual(erroresDelHito({ evidencia_url: largo + 'a'.repeat(501 - largo.length) }),
      error('evidencia_url', MENSAJES_PROYECTOS.evidenciaLarga));
    for (const vacio of [undefined, null, '', '  ']) {
      const { datos, errores } = validarHito({ ...HITO, evidencia_url: vacio }, OPCIONES);
      assert.deepEqual(errores, []);
      assert.equal(datos.evidencia_url, null);
    }
  });

  it('evidencia_tipo ya no se recibe: lo deriva el servidor', () => {
    const { datos } = validarHito({ ...HITO, evidencia_tipo: 'archivo', proyecto_id: 9 }, OPCIONES);
    assert.deepEqual(Object.keys(datos).sort(), ['descripcion', 'evidencia_url', 'fecha', 'titulo']);
  });

  it('los errores en el orden título, fecha y evidencia', () => {
    const { datos, errores } = validarHito({ titulo: '', fecha: 'x', evidencia_url: 'x' }, OPCIONES);
    assert.deepEqual(errores, [
      { campo: 'titulo', mensaje: MENSAJES_PROYECTOS.titulo },
      { campo: 'fecha', mensaje: MENSAJES_PROYECTOS.fechaInvalida },
      { campo: 'evidencia_url', mensaje: MENSAJES_PROYECTOS.evidencia }
    ]);
    assert.deepEqual(datos, { titulo: null, fecha: null, descripcion: null, evidencia_url: null });
  });

  it('con parcial: solo las claves presentes; título o fecha presentes y vacíos son un error', () => {
    assert.deepEqual(validarHito({ descripcion: 'x' }, PARCIAL), { datos: { descripcion: 'x' }, errores: [] });
    assert.deepEqual(validarHito({ titulo: '' }, PARCIAL).errores, error('titulo', MENSAJES_PROYECTOS.titulo));
    assert.deepEqual(validarHito({ fecha: '' }, PARCIAL).errores, error('fecha', MENSAJES_PROYECTOS.fecha));
    assert.deepEqual(validarHito({ evidencia_url: '' }, PARCIAL), { datos: { evidencia_url: null }, errores: [] });
    assert.deepEqual(validarHito({ evidencia_tipo: 'url' }, PARCIAL),
      { datos: {}, errores: [{ campo: null, mensaje: MENSAJES_PROYECTOS.sinDatos }] });
  });

  it('una entrada o unas opciones raras no la hacen tirar', () => {
    for (const entrada of [undefined, null, 'texto', 42, []]) {
      assert.deepEqual(validarHito(entrada, OPCIONES).errores.map((e) => e.campo), ['titulo', 'fecha']);
    }
    assert.doesNotThrow(() => validarHito(HITO));
    assert.doesNotThrow(() => validarHito(HITO, null));
  });
});

describe('evidenciaTipo', () => {
  it('con enlace, url (aunque tenga archivos)', () => {
    assert.equal(evidenciaTipo({ evidencia_url: 'https://example.com', cantidadArchivos: 0 }), 'url');
    assert.equal(evidenciaTipo({ evidencia_url: 'https://example.com', cantidadArchivos: 2 }), 'url');
  });

  it('sin enlace y con archivos, archivo', () => {
    assert.equal(evidenciaTipo({ evidencia_url: null, cantidadArchivos: 1 }), 'archivo');
    assert.equal(evidenciaTipo({ evidencia_url: '', cantidadArchivos: 3 }), 'archivo');
    assert.equal(evidenciaTipo({ cantidadArchivos: '2' }), 'archivo');
  });

  it('sin nada, ninguno', () => {
    assert.equal(evidenciaTipo({ evidencia_url: null, cantidadArchivos: 0 }), 'ninguno');
    assert.equal(evidenciaTipo({ evidencia_url: '   ' }), 'ninguno');
    assert.equal(evidenciaTipo({}), 'ninguno');
    assert.equal(evidenciaTipo(), 'ninguno');
    assert.equal(evidenciaTipo(null), 'ninguno');
    assert.equal(evidenciaTipo({ cantidadArchivos: -1 }), 'ninguno');
    assert.equal(evidenciaTipo({ cantidadArchivos: 'x' }), 'ninguno');
  });
});

describe('nombreOriginal', () => {
  it('de latin1 (como lo lee multer) a UTF-8', () => {
    assert.equal(nombreOriginal(Buffer.from('presentación.pdf', 'utf8').toString('latin1')), 'presentación.pdf');
    assert.equal(nombreOriginal(Buffer.from('presentación final.pdf', 'utf8').toString('latin1')), 'presentación final.pdf');
    assert.equal(nombreOriginal(Buffer.from('Año 2026 - Señal ü €.docx', 'utf8').toString('latin1')), 'Año 2026 - Señal ü €.docx');
  });

  it('un nombre en ASCII queda igual', () => {
    assert.equal(nombreOriginal('informe.pdf'), 'informe.pdf');
    assert.equal(nombreOriginal('Informe final (v2).PDF'), 'Informe final (v2).PDF');
  });

  it('si no era UTF-8 leído como latin1, devuelve el original', () => {
    // Un nombre que ya viene bien (la ó como U+00F3 sola no es UTF-8 válido)
    assert.equal(nombreOriginal('presentación.pdf'), 'presentación.pdf');
    assert.equal(nombreOriginal('€uro.pdf'), '€uro.pdf');
    assert.equal(nombreOriginal('中文.pdf'), '中文.pdf');
  });

  it('lo que no es un texto da vacío, sin tirar', () => {
    for (const nombre of [undefined, null, 42, {}, []]) assert.equal(nombreOriginal(nombre), '');
  });
});

// Ruling R8: la columna nombre_archivo es varchar(255); un nombre más largo se corta conservando la extensión
describe('nombreDeArchivo', () => {
  const comoMulter = (nombre) => Buffer.from(nombre, 'utf8').toString('latin1');
  const largo = (texto) => Array.from(texto).length;

  it('el largo es 255', () => {
    assert.equal(LARGO_NOMBRE_ARCHIVO, 255);
  });

  it('pasa el nombre de latin1 a UTF-8, como nombreOriginal', () => {
    assert.equal(nombreDeArchivo(comoMulter('presentación final.pdf')), 'presentación final.pdf');
    assert.equal(nombreDeArchivo('informe.pdf'), 'informe.pdf');
  });

  it('hasta 255 caracteres queda igual', () => {
    const justo = `${'a'.repeat(251)}.pdf`;
    assert.equal(nombreDeArchivo(justo), justo);
  });

  it('más de 255 se corta en 255 y conserva la extensión', () => {
    const nombre = nombreDeArchivo(`${'a'.repeat(296)}.pdf`);
    assert.equal(largo(nombre), 255);
    assert.equal(nombre, `${'a'.repeat(251)}.pdf`);
    assert.equal(nombreDeArchivo(`${'b'.repeat(300)}.docx`), `${'b'.repeat(250)}.docx`);
  });

  it('cuenta caracteres, no unidades de UTF-16, y no parte uno en dos', () => {
    const nombre = nombreDeArchivo(comoMulter(`${'ñ😀'.repeat(150)}.pdf`));
    assert.equal(largo(nombre), 255);
    assert.ok(nombre.endsWith('.pdf'));
    assert.ok(!nombre.includes('�'));
    assert.equal(nombre, `${'ñ😀'.repeat(125)}ñ.pdf`);
  });

  it('sin extensión, o con un punto al principio, solo se corta', () => {
    assert.equal(nombreDeArchivo('x'.repeat(300)), 'x'.repeat(255));
    assert.equal(nombreDeArchivo(`.${'y'.repeat(300)}`), `.${'y'.repeat(254)}`);
  });

  it('una «extensión» que no deja lugar para el nombre no se conserva: solo se corta', () => {
    assert.equal(nombreDeArchivo(`a.${'z'.repeat(300)}`), `a.${'z'.repeat(253)}`);
  });

  it('lo que no es un texto da vacío, sin tirar', () => {
    for (const nombre of [undefined, null, 42, {}, []]) assert.equal(nombreDeArchivo(nombre), '');
  });
});

describe('idPositivo', () => {
  it('un entero positivo como texto o como número', () => {
    assert.equal(idPositivo('12'), 12);
    assert.equal(idPositivo('1'), 1);
    assert.equal(idPositivo('9999999999'), 9999999999);
    assert.equal(idPositivo(12), 12);
  });

  it('lo demás da null', () => {
    for (const valor of ['0', '-3', '1.5', '1e3', '..%2F', 'abc', '', ' 12', '12 ', '012', '10000000000', '0x1F',
      0, -3, 1.5, NaN, Infinity, null, undefined, {}, [], true, Object.create(null)]) {
      assert.equal(idPositivo(valor), null, String(typeof valor === 'object' && valor !== null ? '[objeto]' : valor));
    }
  });
});

describe('primerError', () => {
  it('el primer error como { error, campo }', () => {
    assert.deepEqual(primerError([{ campo: 'nombre', mensaje: 'A' }, { campo: 'color', mensaje: 'B' }]),
      { error: 'A', campo: 'nombre' });
    assert.deepEqual(primerError(validarProyecto({ ...PROYECTO, color: 'x', icono: 'x' }, OPCIONES).errores),
      { error: MENSAJES_PROYECTOS.color, campo: 'color' });
    assert.deepEqual(primerError(validarProyecto({}, PARCIAL).errores), { error: MENSAJES_PROYECTOS.sinDatos, campo: null });
  });

  it('sin errores, null', () => {
    assert.equal(primerError([]), null);
    assert.equal(primerError(undefined), null);
    assert.equal(primerError(null), null);
    assert.equal(primerError({}), null);
  });
});

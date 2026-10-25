// Las reglas de un área (spec 2026-10-24-configuracion, 5.2 y 5.3): la validación del alta y de la edición, los mensajes
// y el texto de por qué no se puede borrar. Puras, sin base.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENSAJES_AREA, LARGOS_AREA, CAMPOS_DE_CONTACTO_AREA, CAMPOS_DE_CONTACTO_DATASET,
  sinCampos, validarArea, textoNoSePuedeBorrar
} from '../services/areasReglas.js';
import { PATRON_EMAIL, emailValido } from '../services/usuariosReglas.js';

// Un área guardada, como la devuelve `SELECT * FROM areas` (datos inventados)
const ANTERIOR = Object.freeze({
  id: 12, nombre: 'Dirección de Tránsito', articulo: 'la', area_superior: 'Secretaría de Gobierno', articulo_superior: 'la',
  ambito: 'municipal', email_principal: 'transito@area.test', email_secundario: null, telefono_area: '297 400 0000',
  celular_area: null, nombre_contacto: 'Contacto Inventado', telefono_contacto: null, email_contacto: null
});

const OPCIONALES = [
  'area_superior', 'articulo_superior', 'email_principal', 'email_secundario', 'telefono_area', 'celular_area',
  'nombre_contacto', 'telefono_contacto', 'email_contacto'
];
const EMAILS = ['email_principal', 'email_secundario', 'email_contacto'];
const SIN_FORMATO = ['area_superior', 'telefono_area', 'celular_area', 'nombre_contacto', 'telefono_contacto'];

// Un email válido de exactamente n caracteres
const emailDe = (n) => `${'a'.repeat(n - '@area.test'.length)}@area.test`;

const sinError = (resultado) => {
  assert.equal(resultado.error, null, JSON.stringify(resultado.error));
  return resultado.datos;
};

const conError = (resultado, campo, mensaje) => {
  assert.deepEqual(resultado.error, { mensaje, campo });
  assert.equal(resultado.datos, null);
};

describe('MENSAJES_AREA, LARGOS_AREA y los campos de contacto', () => {
  it('los mensajes son los textos exactos', () => {
    const { largo, ...textos } = MENSAJES_AREA;
    assert.deepEqual(textos, {
      nombre: 'Escribí el nombre del área.',
      nombreLargo: 'El nombre puede tener hasta 200 caracteres.',
      nombreRepetido: 'Ya hay un área con ese nombre.',
      articulo: 'Elegí el artículo: la o el.',
      email: 'Revisá el email: no parece una dirección válida.',
      emailLargo: 'El email puede tener hasta 150 caracteres.',
      enUso: 'No se puede borrar el área: tiene datasets asociados. Primero hay que pasarlos a otra área.',
      noEncontrada: 'Área no encontrada'
    });
    assert.equal(typeof largo, 'function');
    assert.equal(largo(300), 'Puede tener hasta 300 caracteres.');
    assert.equal(largo(50), 'Puede tener hasta 50 caracteres.');
  });

  it('los largos son los de las columnas de la tabla areas', () => {
    assert.deepEqual({ ...LARGOS_AREA }, {
      nombre: 200, area_superior: 300, email_principal: 150, email_secundario: 150, email_contacto: 150,
      telefono_area: 50, celular_area: 50, telefono_contacto: 50, nombre_contacto: 150
    });
  });

  it('los campos de contacto del área y los del dataset', () => {
    assert.deepEqual([...CAMPOS_DE_CONTACTO_AREA], [
      'email_principal', 'email_secundario', 'telefono_area', 'celular_area', 'nombre_contacto', 'telefono_contacto',
      'email_contacto'
    ]);
    assert.deepEqual([...CAMPOS_DE_CONTACTO_DATASET], [
      'area_email_principal', 'area_email_secundario', 'area_telefono', 'area_celular', 'area_contacto_nombre',
      'area_contacto_telefono', 'area_contacto_email'
    ]);
  });

  it('PATRON_EMAIL se exporta de usuariosReglas y emailValido no cambió', () => {
    assert.ok(PATRON_EMAIL instanceof RegExp);
    assert.ok(PATRON_EMAIL.test('a@b.co'));
    assert.ok(!PATRON_EMAIL.test('x@'));
    assert.equal(emailValido('a@b.co'), true);
    assert.equal(emailValido(emailDe(101)), false);
  });
});

describe('validarArea: el alta', () => {
  it('el nombre se recorta y el artículo vale "la" si no vino', () => {
    const resultado = validarArea({ nombre: '  Dirección X  ' });
    assert.equal(resultado.error, null);
    assert.equal(resultado.datos.nombre, 'Dirección X');
    assert.equal(resultado.datos.articulo, 'la');
    assert.deepEqual(resultado.datos, { nombre: 'Dirección X', articulo: 'la' });
  });

  it('el alta rápida de admin.js ({ nombre }) pasa', () => {
    assert.deepEqual(sinError(validarArea({ nombre: 'Nueva' }, null)), { nombre: 'Nueva', articulo: 'la' });
  });

  it('los espacios del medio del nombre quedan', () => {
    assert.equal(sinError(validarArea({ nombre: ' Dirección   X ' })).nombre, 'Dirección   X');
  });

  it('el artículo que vino se conserva', () => {
    assert.equal(sinError(validarArea({ nombre: 'Departamento X', articulo: 'el' })).articulo, 'el');
  });

  it('el alta con todos los campos', () => {
    const datos = sinError(validarArea({
      nombre: 'Dirección X', articulo: 'la', area_superior: ' Secretaría Y ', articulo_superior: 'la',
      email_principal: ' mesa@area.test ', email_secundario: '', telefono_area: '297 400 0000', celular_area: '  ',
      nombre_contacto: 'Contacto Inventado', telefono_contacto: null, email_contacto: 'contacto@area.test'
    }));
    assert.deepEqual(datos, {
      nombre: 'Dirección X', articulo: 'la', area_superior: 'Secretaría Y', articulo_superior: 'la',
      email_principal: 'mesa@area.test', email_secundario: null, telefono_area: '297 400 0000', celular_area: null,
      nombre_contacto: 'Contacto Inventado', telefono_contacto: null, email_contacto: 'contacto@area.test'
    });
  });

  it('en el alta se valida todo lo que viene (no hay nada guardado contra qué comparar)', () => {
    conError(validarArea({ nombre: 'A', email_principal: 'malo' }), 'email_principal', MENSAJES_AREA.email);
    conError(validarArea({ nombre: 'A', celular_area: '9'.repeat(51) }), 'celular_area', MENSAJES_AREA.largo(50));
  });

  it('el ámbito y las claves que no son del área no van en datos', () => {
    const datos = sinError(validarArea({ nombre: 'A', ambito: 'externo', id: 4, cantidad_datasets: 2, otra: 'x' }));
    assert.deepEqual(datos, { nombre: 'A', articulo: 'la' });
  });

  it('el ámbito no se valida acá (lo valida el controlador)', () => {
    assert.deepEqual(sinError(validarArea({ nombre: 'A', ambito: 'cualquiera' })), { nombre: 'A', articulo: 'la' });
  });
});

describe('validarArea: el nombre', () => {
  it('vacío o de espacios en el alta: "Escribí el nombre del área."', () => {
    conError(validarArea({ nombre: '   ' }), 'nombre', 'Escribí el nombre del área.');
    conError(validarArea({}), 'nombre', 'Escribí el nombre del área.');
    conError(validarArea({ nombre: '' }), 'nombre', MENSAJES_AREA.nombre);
    conError(validarArea({ nombre: null }), 'nombre', MENSAJES_AREA.nombre);
    conError(validarArea({ nombre: undefined }), 'nombre', MENSAJES_AREA.nombre);
  });

  it('lo que no es un texto cuenta como vacío', () => {
    for (const nombre of [5, true, {}, ['A']]) {
      conError(validarArea({ nombre }), 'nombre', MENSAJES_AREA.nombre);
    }
  });

  it('en una edición, si viene no puede quedar vacío', () => {
    conError(validarArea({ nombre: '' }, { nombre: 'Vieja' }), 'nombre', 'Escribí el nombre del área.');
    conError(validarArea({ nombre: '  ' }, ANTERIOR), 'nombre', MENSAJES_AREA.nombre);
    conError(validarArea({ nombre: null }, ANTERIOR), 'nombre', MENSAJES_AREA.nombre);
  });

  it('en una edición, si no viene no se pide y datos no lo trae', () => {
    const datos = sinError(validarArea({ email_principal: 'a@b.co' }, ANTERIOR));
    assert.ok(!('nombre' in datos));
    assert.deepEqual(datos, { email_principal: 'a@b.co' });
  });

  it('hasta 200 caracteres, contados con Array.from', () => {
    conError(validarArea({ nombre: 'á'.repeat(201) }), 'nombre', MENSAJES_AREA.nombreLargo);
    assert.equal(sinError(validarArea({ nombre: 'á'.repeat(200) })).nombre, 'á'.repeat(200));
    // 200 caracteres fuera del plano básico: 400 unidades de UTF-16, pero 200 para el varchar
    assert.equal(sinError(validarArea({ nombre: '𝔸'.repeat(200) })).nombre, '𝔸'.repeat(200));
    conError(validarArea({ nombre: '𝔸'.repeat(201) }), 'nombre', MENSAJES_AREA.nombreLargo);
  });

  it('el largo del nombre se controla siempre, también en una edición', () => {
    conError(validarArea({ nombre: 'b'.repeat(201) }, ANTERIOR), 'nombre', MENSAJES_AREA.nombreLargo);
  });

  it('el largo se cuenta sin los espacios de los extremos', () => {
    assert.equal(sinError(validarArea({ nombre: `  ${'c'.repeat(200)}  ` })).nombre, 'c'.repeat(200));
  });
});

describe('validarArea: largos', () => {
  it('area_superior de 301: "Puede tener hasta 300 caracteres."', () => {
    conError(validarArea({ nombre: 'A', area_superior: 'd'.repeat(301) }), 'area_superior',
      'Puede tener hasta 300 caracteres.');
    assert.equal(sinError(validarArea({ nombre: 'A', area_superior: 'd'.repeat(300) })).area_superior, 'd'.repeat(300));
  });

  it('telefono_area de 51: "Puede tener hasta 50 caracteres."', () => {
    conError(validarArea({ nombre: 'A', telefono_area: '1'.repeat(51) }), 'telefono_area',
      'Puede tener hasta 50 caracteres.');
  });

  it('cada texto sin formato: hasta su largo pasa, uno más da el mensaje con su largo', () => {
    for (const campo of SIN_FORMATO) {
      const largo = LARGOS_AREA[campo];
      assert.equal(sinError(validarArea({ nombre: 'A', [campo]: 'e'.repeat(largo) }))[campo], 'e'.repeat(largo), campo);
      conError(validarArea({ nombre: 'A', [campo]: 'e'.repeat(largo + 1) }), campo, MENSAJES_AREA.largo(largo));
    }
  });

  it('los largos se cuentan con Array.from', () => {
    assert.equal(sinError(validarArea({ nombre: 'A', telefono_area: '𝔸'.repeat(50) })).telefono_area, '𝔸'.repeat(50));
    conError(validarArea({ nombre: 'A', telefono_area: '𝔸'.repeat(51) }), 'telefono_area', MENSAJES_AREA.largo(50));
  });
});

describe('validarArea: artículos', () => {
  it('articulo: solo "la" o "el"', () => {
    conError(validarArea({ nombre: 'A', articulo: 'los' }), 'articulo', 'Elegí el artículo: la o el.');
    for (const articulo of ['', '  ', null, 'La', 'EL', 'las', 5, true, {}, ['la']]) {
      conError(validarArea({ nombre: 'A', articulo }), 'articulo', MENSAJES_AREA.articulo);
    }
  });

  it('articulo se valida siempre que viene, también en una edición', () => {
    conError(validarArea({ articulo: 'los' }, ANTERIOR), 'articulo', MENSAJES_AREA.articulo);
    assert.deepEqual(sinError(validarArea({ articulo: 'el' }, ANTERIOR)), { articulo: 'el' });
  });

  it('en una edición, si no viene, se conserva (datos no lo trae)', () => {
    assert.ok(!('articulo' in sinError(validarArea({ nombre: 'Otra' }, ANTERIOR))));
  });

  it('articulo_superior: null, "la" o "el"; "" (o solo espacios) es null; otro valor da el mismo mensaje', () => {
    conError(validarArea({ nombre: 'A', articulo_superior: 'x' }), 'articulo_superior', 'Elegí el artículo: la o el.');
    assert.equal(sinError(validarArea({ nombre: 'A', articulo_superior: '' })).articulo_superior, null);
    assert.equal(sinError(validarArea({ nombre: 'A', articulo_superior: '  ' })).articulo_superior, null);
    assert.equal(sinError(validarArea({ nombre: 'A', articulo_superior: null })).articulo_superior, null);
    assert.equal(sinError(validarArea({ nombre: 'A', articulo_superior: 'el' })).articulo_superior, 'el');
    assert.equal(sinError(validarArea({ nombre: 'A', articulo_superior: 'la' })).articulo_superior, 'la');
    for (const articulo_superior of ['los', 'La', 0, false, {}, ['el']]) {
      conError(validarArea({ nombre: 'A', articulo_superior }), 'articulo_superior', MENSAJES_AREA.articulo);
    }
  });

  it('los artículos se recortan', () => {
    const datos = sinError(validarArea({ nombre: 'A', articulo: ' el ', articulo_superior: ' la ' }));
    assert.equal(datos.articulo, 'el');
    assert.equal(datos.articulo_superior, 'la');
  });
});

describe('validarArea: vacíos y recortes', () => {
  it('area_superior de espacios es null; un email se recorta; el email vacío es null', () => {
    const datos = sinError(validarArea({
      nombre: 'A', area_superior: '  ', email_principal: ' a@b.co ', email_secundario: ''
    }));
    assert.equal(datos.area_superior, null);
    assert.equal(datos.email_principal, 'a@b.co');
    assert.equal(datos.email_secundario, null);
  });

  it('cada opcional: "", solo espacios y null quedan null; un texto se guarda recortado', () => {
    for (const campo of SIN_FORMATO) {
      for (const vacio of ['', '   ', null]) {
        assert.equal(sinError(validarArea({ nombre: 'A', [campo]: vacio }))[campo], null, `${campo} ${vacio}`);
      }
      assert.equal(sinError(validarArea({ nombre: 'A', [campo]: '  2 3  ' }))[campo], '2 3', campo);
    }
  });

  it('un opcional que no vino no aparece en datos', () => {
    const datos = sinError(validarArea({ nombre: 'A', email_principal: undefined }));
    assert.ok(!('email_principal' in datos));
  });

  it('null en todos los opcionales (el formulario completo del Generador) pasa y queda null', () => {
    const datos = sinError(validarArea({
      nombre: 'A', area_superior: null, articulo_superior: null, email_principal: null, email_secundario: null,
      telefono_area: null, celular_area: null, nombre_contacto: null, telefono_contacto: null, email_contacto: null
    }, { nombre: 'A' }));
    for (const campo of OPCIONALES) assert.strictEqual(datos[campo], null, campo);
    assert.deepEqual(datos, {
      nombre: 'A', area_superior: null, articulo_superior: null, email_principal: null, email_secundario: null,
      telefono_area: null, celular_area: null, nombre_contacto: null, telefono_contacto: null, email_contacto: null
    });
  });
});

describe('validarArea: emails', () => {
  it('email_contacto "x@": "Revisá el email: no parece una dirección válida."', () => {
    conError(validarArea({ nombre: 'A', email_contacto: 'x@' }), 'email_contacto',
      'Revisá el email: no parece una dirección válida.');
  });

  it('cada email: el formato de los usuarios', () => {
    for (const campo of EMAILS) {
      for (const malo of ['x@', 'sin-arroba', 'a@b', 'a b@c.co', 'a@@b.co']) {
        conError(validarArea({ nombre: 'A', [campo]: malo }), campo, MENSAJES_AREA.email);
      }
      assert.equal(sinError(validarArea({ nombre: 'A', [campo]: 'mesa@area.gob.ar' }))[campo], 'mesa@area.gob.ar');
    }
  });

  it('hasta 150 caracteres: uno de 151 da emailLargo, uno de 150 pasa', () => {
    for (const campo of EMAILS) {
      conError(validarArea({ nombre: 'A', [campo]: emailDe(151) }), campo, 'El email puede tener hasta 150 caracteres.');
      assert.equal(sinError(validarArea({ nombre: 'A', [campo]: emailDe(150) }))[campo], emailDe(150));
    }
  });

  it('un email de más de 100 caracteres pasa (emailValido corta en 100; acá el límite es 150)', () => {
    assert.equal(sinError(validarArea({ nombre: 'A', email_principal: emailDe(120) })).email_principal, emailDe(120));
  });

  it('el largo se controla antes que el formato (la expresión nunca corre sobre un texto largo)', () => {
    // Largo y mal formado a la vez: da emailLargo, no email
    const largoYMalo = `a@${'.'.repeat(200)} `;
    conError(validarArea({ nombre: 'A', email_principal: largoYMalo }), 'email_principal', MENSAJES_AREA.emailLargo);
  });
});

describe('validarArea: solo si cambia', () => {
  it('un email inválido que ya estaba guardado no frena', () => {
    assert.deepEqual(
      sinError(validarArea({ email_principal: 'malo' }, { email_principal: 'malo', nombre: 'A' })),
      { email_principal: 'malo' }
    );
  });

  it('si cambia, se valida', () => {
    conError(validarArea({ email_principal: 'otro malo' }, { email_principal: 'malo', nombre: 'A' }), 'email_principal',
      MENSAJES_AREA.email);
  });

  it('se compara lo normalizado: agregar espacios no es un cambio', () => {
    assert.deepEqual(
      sinError(validarArea({ email_principal: ' malo ' }, { email_principal: 'malo', nombre: 'A' })),
      { email_principal: 'malo' }
    );
  });

  it('un largo que ya estaba guardado no frena; si cambia, sí', () => {
    const viejo = { nombre: 'A', telefono_area: '1'.repeat(60) };
    assert.equal(sinError(validarArea({ telefono_area: '1'.repeat(60) }, viejo)).telefono_area, '1'.repeat(60));
    conError(validarArea({ telefono_area: '1'.repeat(61) }, viejo), 'telefono_area', MENSAJES_AREA.largo(50));
  });

  it('vaciar un campo (null o "") nunca da error', () => {
    assert.deepEqual(sinError(validarArea({ email_principal: '' }, { email_principal: 'malo' })), { email_principal: null });
    assert.deepEqual(sinError(validarArea({ email_principal: null }, ANTERIOR)), { email_principal: null });
  });

  it('un campo que en lo guardado no está cuenta como null', () => {
    conError(validarArea({ email_contacto: 'malo' }, { nombre: 'A' }), 'email_contacto', MENSAJES_AREA.email);
  });

  it('el nombre y los artículos se validan aunque no cambien', () => {
    conError(validarArea({ articulo_superior: 'x' }, { nombre: 'A', articulo_superior: 'x' }), 'articulo_superior',
      MENSAJES_AREA.articulo);
    conError(validarArea({ nombre: 'b'.repeat(201) }, { nombre: 'b'.repeat(201) }), 'nombre', MENSAJES_AREA.nombreLargo);
  });
});

describe('validarArea: el orden de los errores', () => {
  it('con el nombre vacío y un email inválido, el error es el del nombre', () => {
    conError(validarArea({ nombre: '', email_contacto: 'x@' }), 'nombre', MENSAJES_AREA.nombre);
    conError(validarArea({ email_contacto: 'x@' }), 'nombre', MENSAJES_AREA.nombre);
  });

  it('el orden del formulario: nombre, artículo, dependencia, su artículo, emails, teléfonos y contacto', () => {
    const todosMal = {
      articulo: 'x', area_superior: 'd'.repeat(301), articulo_superior: 'x', email_principal: 'x@',
      email_secundario: 'x@', telefono_area: '1'.repeat(51), celular_area: '1'.repeat(51),
      nombre_contacto: 'n'.repeat(151), telefono_contacto: '1'.repeat(51), email_contacto: 'x@'
    };
    const orden = [
      'articulo', 'area_superior', 'articulo_superior', 'email_principal', 'email_secundario', 'telefono_area',
      'celular_area', 'nombre_contacto', 'telefono_contacto', 'email_contacto'
    ];
    const entrada = { nombre: 'A', ...todosMal };
    for (const campo of orden) {
      assert.equal(validarArea(entrada).error.campo, campo);
      delete entrada[campo];
    }
    assert.equal(validarArea(entrada).error, null);
  });
});

describe('validarArea: nunca tira', () => {
  it('una entrada que no es un objeto, en el alta, da el error del nombre', () => {
    for (const entrada of [undefined, null, 'texto', 5, true, [], ['A']]) {
      conError(validarArea(entrada), 'nombre', MENSAJES_AREA.nombre);
    }
  });

  it('una entrada que no es un objeto, en una edición, no trae datos', () => {
    for (const entrada of [undefined, null, 'texto', 5, []]) {
      assert.deepEqual(sinError(validarArea(entrada, ANTERIOR)), {});
    }
  });

  it('una edición sin ningún campo del área da datos vacío (el controlador responde "No hay datos para actualizar")', () => {
    assert.deepEqual(sinError(validarArea({}, ANTERIOR)), {});
    assert.deepEqual(sinError(validarArea({ ambito: 'externo' }, ANTERIOR)), {});
  });

  it('un opcional que no es un texto cuenta como vacío', () => {
    for (const valor of [5, true, {}, ['x@y.co']]) {
      assert.equal(sinError(validarArea({ nombre: 'A', email_principal: valor })).email_principal, null);
    }
  });

  it('no modifica la entrada ni lo guardado', () => {
    const entrada = { nombre: '  A  ', email_principal: ' a@b.co ' };
    const copia = { ...entrada };
    validarArea(entrada, ANTERIOR);
    assert.deepEqual(entrada, copia);
  });
});

describe('textoNoSePuedeBorrar', () => {
  it('sin datasets ni cambios pendientes: null', () => {
    assert.equal(textoNoSePuedeBorrar({ activos: 0, deBaja: 0, pendientes: 0 }), null);
  });

  it('cuenta los activos y los dados de baja', () => {
    assert.equal(textoNoSePuedeBorrar({ activos: 2, deBaja: 1, pendientes: 0 }),
      'No se puede borrar el área: tiene 3 datasets (1 dado de baja). Primero hay que pasarlos a otra área.');
    assert.equal(textoNoSePuedeBorrar({ activos: 0, deBaja: 2, pendientes: 0 }),
      'No se puede borrar el área: tiene 2 datasets (2 dados de baja). Primero hay que pasarlos a otra área.');
    assert.equal(textoNoSePuedeBorrar({ activos: 4, deBaja: 0, pendientes: 0 }),
      'No se puede borrar el área: tiene 4 datasets. Primero hay que pasarlos a otra área.');
  });

  it('un solo dataset, en singular; los datasets mandan sobre los cambios pendientes', () => {
    assert.equal(textoNoSePuedeBorrar({ activos: 1, deBaja: 0, pendientes: 3 }),
      'No se puede borrar el área: tiene 1 dataset. Primero hay que pasarlo a otra área.');
    assert.equal(textoNoSePuedeBorrar({ activos: 0, deBaja: 1, pendientes: 0 }),
      'No se puede borrar el área: tiene 1 dataset (1 dado de baja). Primero hay que pasarlo a otra área.');
  });

  it('los cambios pendientes que la usan', () => {
    assert.equal(textoNoSePuedeBorrar({ activos: 0, deBaja: 0, pendientes: 1 }),
      'No se puede borrar el área: un cambio pendiente la usa. Primero hay que aprobarlo o rechazarlo.');
    assert.equal(textoNoSePuedeBorrar({ activos: 0, deBaja: 0, pendientes: 2 }),
      'No se puede borrar el área: 2 cambios pendientes la usan. Primero hay que aprobarlos o rechazarlos.');
  });

  it('acepta las cuentas como texto (un SUM de la base) y no tira con algo raro', () => {
    assert.equal(textoNoSePuedeBorrar({ activos: '2', deBaja: '1', pendientes: '0' }),
      'No se puede borrar el área: tiene 3 datasets (1 dado de baja). Primero hay que pasarlos a otra área.');
    assert.equal(textoNoSePuedeBorrar({ activos: 0n, deBaja: 0n, pendientes: 2n }),
      'No se puede borrar el área: 2 cambios pendientes la usan. Primero hay que aprobarlos o rechazarlos.');
    assert.equal(textoNoSePuedeBorrar({}), null);
    assert.equal(textoNoSePuedeBorrar(null), null);
    assert.equal(textoNoSePuedeBorrar(), null);
    assert.equal(textoNoSePuedeBorrar({ activos: NaN, deBaja: -1, pendientes: 'x' }), null);
  });
});

describe('sinCampos', () => {
  it('una copia sin esas claves; el original no cambia', () => {
    const original = { id: 1, email_principal: 'x', nombre: 'A' };
    const copia = sinCampos(original, CAMPOS_DE_CONTACTO_AREA);
    assert.deepEqual(copia, { id: 1, nombre: 'A' });
    assert.notEqual(copia, original);
    assert.deepEqual(original, { id: 1, email_principal: 'x', nombre: 'A' });
  });

  it('saca todos los campos de contacto de un dataset y deja el resto', () => {
    const dataset = {
      id: 3, titulo: 'T', area_nombre: 'Dirección X', area_email_principal: 'a', area_email_secundario: 'b',
      area_telefono: 'c', area_celular: 'd', area_contacto_nombre: 'e', area_contacto_telefono: 'f',
      area_contacto_email: 'g'
    };
    assert.deepEqual(sinCampos(dataset, CAMPOS_DE_CONTACTO_DATASET), { id: 3, titulo: 'T', area_nombre: 'Dirección X' });
  });

  it('conserva los valores 0, null y vacíos de las otras claves', () => {
    assert.deepEqual(sinCampos({ a: 0, b: null, c: '', email_principal: null }, CAMPOS_DE_CONTACTO_AREA),
      { a: 0, b: null, c: '' });
  });

  it('lo que no es un objeto vuelve tal cual, y sin lista de campos no saca nada', () => {
    assert.equal(sinCampos(null, CAMPOS_DE_CONTACTO_AREA), null);
    assert.equal(sinCampos(undefined, CAMPOS_DE_CONTACTO_AREA), undefined);
    assert.deepEqual(sinCampos({ email_principal: 'x' }), { email_principal: 'x' });
  });
});

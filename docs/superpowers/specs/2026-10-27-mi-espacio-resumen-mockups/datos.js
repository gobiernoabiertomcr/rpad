/* MAQUETA (27/10/2026): los cuatro estados del Resumen, con la forma de lo que manda hoy GET /api/mi-espacio/resumen
   (services/miEspacioResumen.js, resumenDe) más lo que sumaría alguna opción, marcado «nuevo»: los días que faltan de cada cosa
   que vence, las fechas de cada capa y de cada tope (la opción 3 dibuja hasta cuándo se puede usar cada cosa), la fecha del
   feriado, los eventos de la agenda (entrega 3: hoy_y_manana.eventos) y, para Titular, el texto corto de cada cosa que vence
   (`corto`, en lugar de `cuando` y `detalle`) y la médica extraordinaria más corta (`extraordinaria_corta`). Hoy es el martes 27/10/2026. Nombres inventados. */
(() => {
    const FERIADO = { fecha: '2026-11-02', cuando: 'Lunes 02/11', nombre: 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches' };
    const CORTA = (usados) => `Atención médica extraordinaria: sin tope. ${usados ? `Usaste ${usados} días en 2026.` : 'No usaste en 2026.'}`;
    const EXTRAORDINARIA = (usados) => `Atención médica extraordinaria: sin tope y aparte de los 25 días. ${usados ? `Usaste ${usados} días en 2026.` : 'No usaste en 2026.'}`;
    const tope = (clave, nombre, valor, total, unidad) => ({
        clave, nombre, numero: String(valor).replace('.', ','), unidad: valor === 1 ? unidad[0] : unidad[1],
        de: `de ${total} ${unidad[1]}`, valor, total, vence: false, pestana: 'licencias',
        hasta: '2026-12-31', // nuevo: vuelve a cero el 1/1
        aria: `${nombre}: quedan ${String(valor).replace('.', ',')} de ${total} ${unidad[1]}. Ver tus licencias`,
    });
    const DIAS = ['día', 'días'];
    const HORAS = ['hora', 'horas'];

    window.ESTADOS = {
        planta: {
            etiqueta: 'Planta (la captura)',
            idea: 'Lo de la captura del usuario: planta permanente, administración, sin nadie que no esté hoy.',
            persona: { nombre: 'Andrea Molina', rol: 'Administrador', admin: true },
            resumen: {
                hoy: '2026-10-27', hoy_texto: 'Martes 27 de octubre',
                modalidad: { clave: 'planta', texto: 'Planta permanente' }, anio: 2026, al_texto: 'Al martes 27/10/2026',
                persona: { ve_companeros: true },
                marca: true,
                vence_pronto: [
                    { fecha: '2026-12-31', dia: '31', mes: 'dic', cuando: 'Jueves 31/12', titulo: '15 días de la licencia 2024', detalle: 'Ese día vence la licencia 2024.', accion: { texto: 'Cargar vacaciones', tipo: 'vacaciones' }, faltan: 65, corto: 'Vencen el jueves 31/12, en 65 días.' },
                ],
                faltantes: [],
                tanques: {
                    vacaciones: {
                        numero: 45, unidad: 'días', pie: 'de 3 licencias', capacidad: 55,
                        aria: 'Vacaciones: 45 días hábiles disponibles. Ver tus licencias',
                        capas: [
                            { clase: 'vence', n: 15, nombre: 'Licencia 2024', nota: 'Vence el 31/12/2026', hasta: '2026-12-31' },
                            { clase: 'tinta', n: 20, nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027', hasta: '2027-12-31' },
                            { clase: 'medio', n: 10, nombre: 'Licencia 2026', nota: 'La primera mitad', hasta: '2028-12-31' },
                            { clase: 'por_habilitar', n: 10, nombre: 'Todavía no', nota: 'Se habilitan el 1/1/2027', desde: '2027-01-01', hasta: '2028-12-31', de: 'Licencia 2026' },
                        ],
                    },
                    otros: [
                        tope('franquicia', 'Franquicias', 22, 42, HORAS),
                        tope('estudios', 'Estudios', 10, 15, DIAS),
                        tope('medica', 'Atención médica', 25, 25, DIAS),
                        tope('familiar', 'Grupo familiar', 25, 25, DIAS),
                    ],
                },
                pastillas: {
                    titulo: 'Francos compensatorios',
                    meses: [{ numero: '1', mes: 'Diciembre', nota: 'Octubre sigue sumando', estado: 'pendiente', mes_de_uso: '2026-12' }],
                    previo: null,
                },
                extraordinaria: EXTRAORDINARIA(0), extraordinaria_corta: CORTA(0),
                hoy_y_manana: { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: FERIADO, eventos: [] },
            },
        },

        contrato: {
            etiqueta: 'Contrato',
            idea: 'Contrato: horas a favor en lugar de francos y franquicias, que vencen el viernes. Lectora: no ve a los compañeros.',
            persona: { nombre: 'Bruno Ibáñez', rol: 'Lector', admin: false },
            resumen: {
                hoy: '2026-10-27', hoy_texto: 'Martes 27 de octubre',
                modalidad: { clave: 'contrato', texto: 'Contrato' }, anio: 2026, al_texto: 'Al martes 27/10/2026',
                persona: { ve_companeros: false },
                marca: true,
                vence_pronto: [
                    { fecha: '2026-10-30', dia: '30', mes: 'oct', cuando: 'Viernes 30/10', titulo: '1,5 horas a favor de octubre', detalle: 'Es el último día hábil del mes. Lo que no uses pasa a horas no utilizadas previamente.', accion: { texto: 'Usarlas', tipo: 'horas_a_favor' }, faltan: 3, corto: 'Vencen el viernes 30/10, en 3 días.' },
                ],
                faltantes: [],
                tanques: {
                    vacaciones: {
                        numero: 13, unidad: 'días', pie: 'de 2 licencias', capacidad: 20,
                        aria: 'Vacaciones: 13 días hábiles disponibles. Ver tus licencias',
                        capas: [
                            { clase: 'tinta', n: 5, nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027', hasta: '2027-12-31' },
                            { clase: 'medio', n: 8, nombre: 'Licencia 2026', nota: 'La primera mitad', hasta: '2028-12-31' },
                            { clase: 'por_habilitar', n: 7, nombre: 'Todavía no', nota: 'Se habilitan el 1/1/2027', desde: '2027-01-01', hasta: '2028-12-31', de: 'Licencia 2026' },
                        ],
                    },
                    otros: [
                        {
                            clave: 'horas_a_favor', nombre: 'Horas a favor', numero: '1,5', unidad: 'horas', de: 'de 10,5 en octubre', valor: 1.5, total: 10.5,
                            vence: true, pestana: 'horas', hasta: '2026-10-30',
                            aria: 'Horas a favor: quedan 1,5 de 10,5 horas en octubre. Ver tus horas extras',
                        },
                        tope('estudios', 'Estudios', 7, 10, DIAS),
                        tope('medica', 'Atención médica', 25, 25, DIAS),
                        tope('familiar', 'Grupo familiar', 21, 25, DIAS),
                    ],
                },
                pastillas: {
                    titulo: 'Horas a favor',
                    meses: [
                        { numero: '1,5', mes: 'Octubre', nota: 'De 10,5, hasta el viernes 30/10', estado: 'vence', mes_de_uso: '2026-10' },
                        { numero: '4', mes: 'Noviembre', nota: 'Octubre sigue sumando', estado: 'pendiente', mes_de_uso: '2026-11' },
                    ],
                    previo: { numero: '6,5', titulo: 'Agosto', nota: 'No utilizadas previamente' },
                },
                extraordinaria: EXTRAORDINARIA(0), extraordinaria_corta: CORTA(0),
                hoy_y_manana: {
                    ausentes_hoy: [], ausentes_manana: [], proximo_feriado: FERIADO,
                    eventos: [{ dia: 'manana', hora: '16:00', titulo: 'Entrega del informe trimestral', detalle: 'Mañana · solo vos', compartido: false }],
                },
            },
        },

        admin: {
            etiqueta: 'Administración, con quién no está',
            idea: 'Planta política, administración: dos cosas que vencen, vacaciones cargadas para noviembre, compañeros que no están y la agenda.',
            persona: { nombre: 'Paula Ríos', rol: 'Administrador', admin: true },
            resumen: {
                hoy: '2026-10-27', hoy_texto: 'Martes 27 de octubre',
                modalidad: { clave: 'planta', texto: 'Planta política' }, anio: 2026, al_texto: 'Al martes 27/10/2026',
                persona: { ve_companeros: true },
                marca: true,
                vence_pronto: [
                    { fecha: '2026-10-30', dia: '30', mes: 'oct', cuando: 'Viernes 30/10', titulo: '1 franco compensatorio de octubre', detalle: 'Es el último día hábil del mes. Si no lo usás, queda como no utilizado previamente.', accion: { texto: 'Cargarlo', tipo: 'franco' }, faltan: 3, corto: 'Vence el viernes 30/10, en 3 días.' },
                    { fecha: '2026-12-31', dia: '31', mes: 'dic', cuando: 'Jueves 31/12', titulo: '3 días de la licencia 2024', detalle: 'Ese día vence la licencia 2024.', accion: { texto: 'Cargar vacaciones', tipo: 'vacaciones' }, faltan: 65, corto: 'Vencen el jueves 31/12, en 65 días.' },
                ],
                faltantes: [],
                tanques: {
                    vacaciones: {
                        numero: 33, unidad: 'días', pie: 'de 3 licencias', capacidad: 48,
                        aria: 'Vacaciones: 33 días hábiles disponibles. Ver tus licencias',
                        capas: [
                            { clase: 'vence', n: 3, nombre: 'Licencia 2024', nota: 'Vence el 31/12/2026', hasta: '2026-12-31' },
                            { clase: 'tinta', n: 20, nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027', hasta: '2027-12-31' },
                            { clase: 'medio', n: 10, nombre: 'Licencia 2026', nota: 'La primera mitad', hasta: '2028-12-31' },
                            { clase: 'cargadas', n: 5, nombre: 'Cargados', nota: 'Cargados para noviembre', desde: '2026-11-03', hasta: '2026-11-09' },
                            { clase: 'por_habilitar', n: 10, nombre: 'Todavía no', nota: 'Se habilitan el 1/1/2027', desde: '2027-01-01', hasta: '2028-12-31', de: 'Licencia 2026' },
                        ],
                    },
                    otros: [
                        tope('franquicia', 'Franquicias', 25, 42, HORAS),
                        tope('estudios', 'Estudios', 9, 15, DIAS),
                        tope('medica', 'Atención médica', 22, 25, DIAS),
                        tope('familiar', 'Grupo familiar', 23, 25, DIAS),
                    ],
                },
                pastillas: {
                    titulo: 'Francos compensatorios',
                    meses: [
                        { numero: '1', mes: 'Octubre', nota: 'Hasta el viernes 30/10', estado: 'vence', mes_de_uso: '2026-10' },
                        { numero: '1', mes: 'Noviembre', nota: 'Por las horas de septiembre', estado: 'disponible', mes_de_uso: '2026-11' },
                        { numero: '1', mes: 'Diciembre', nota: 'Octubre sigue sumando', estado: 'pendiente', mes_de_uso: '2026-12' },
                    ],
                    previo: { numero: '1', titulo: 'Agosto', nota: 'No utilizado previamente' },
                },
                extraordinaria: EXTRAORDINARIA(4), extraordinaria_corta: CORTA(4),
                hoy_y_manana: {
                    ausentes_hoy: [
                        { nombre: 'Julieta Arce', texto: 'Julieta Arce no está', vuelve_texto: 'Vuelve el martes 03/11' },
                        { nombre: 'Martín Ledesma', texto: 'Martín Ledesma no está', vuelve_texto: 'Vuelve el miércoles 28/10' },
                    ],
                    ausentes_manana: [
                        { nombre: 'Carla Benítez', texto: 'Carla Benítez no está', vuelve_texto: 'Vuelve el jueves 05/11' },
                    ],
                    proximo_feriado: FERIADO,
                    eventos: [
                        { dia: 'hoy', hora: '10:00', titulo: 'Reunión de equipo', detalle: 'Hoy · con todos', compartido: true },
                        { dia: 'hoy', hora: '15:30', titulo: 'Turno médico', detalle: 'Hoy · solo vos', compartido: false },
                        { dia: 'manana', hora: '09:30', titulo: 'Capacitación en datos abiertos', detalle: 'Mañana · con 4 personas', compartido: true },
                    ],
                },
            },
        },

        calma: {
            etiqueta: 'Nada por vencer',
            idea: 'Nada vence pronto: sin «Vence pronto» ni la marca de la pestaña. No estudia este año (sin estudios). Editor, sin nadie que no esté.',
            persona: { nombre: 'Diego Ferrari', rol: 'Editor', admin: true },
            resumen: {
                hoy: '2026-10-27', hoy_texto: 'Martes 27 de octubre',
                modalidad: { clave: 'planta', texto: 'Planta permanente' }, anio: 2026, al_texto: 'Al martes 27/10/2026',
                persona: { ve_companeros: true },
                marca: false,
                vence_pronto: [],
                faltantes: [],
                tanques: {
                    vacaciones: {
                        numero: 30, unidad: 'días', pie: 'de 2 licencias', capacidad: 40,
                        aria: 'Vacaciones: 30 días hábiles disponibles. Ver tus licencias',
                        capas: [
                            { clase: 'tinta', n: 20, nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027', hasta: '2027-12-31' },
                            { clase: 'medio', n: 10, nombre: 'Licencia 2026', nota: 'La primera mitad', hasta: '2028-12-31' },
                            { clase: 'por_habilitar', n: 10, nombre: 'Todavía no', nota: 'Se habilitan el 1/1/2027', desde: '2027-01-01', hasta: '2028-12-31', de: 'Licencia 2026' },
                        ],
                    },
                    otros: [
                        tope('franquicia', 'Franquicias', 35, 42, HORAS),
                        tope('medica', 'Atención médica', 20, 25, DIAS),
                        tope('familiar', 'Grupo familiar', 25, 25, DIAS),
                    ],
                },
                pastillas: {
                    titulo: 'Francos compensatorios',
                    meses: [{ numero: '1', mes: 'Noviembre', nota: 'Por las horas de septiembre', estado: 'disponible', mes_de_uso: '2026-11' }],
                    previo: null,
                },
                extraordinaria: EXTRAORDINARIA(0), extraordinaria_corta: CORTA(0),
                hoy_y_manana: { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: FERIADO, eventos: [] },
            },
        },
    };
})();

/* MAQUETA (27/10/2026): los datos INVENTADOS de la persona de contrato de la maqueta (Sofía Paz, la de los casos de los tests).
   Hoy es el martes 27/10/2026. Las horas de cada día son las mismas que la tabla de pestana-real.js (generada con las funciones de
   verdad): agosto 2,5 h, septiembre 10,5 h y octubre 18 h. Las licencias son las de su Mi espacio; los feriados, los de la tabla. */
window.DATOS = {
    hoy: '2026-10-27',
    persona: { nombre: 'Sofía Paz', iniciales: 'SP', rol: 'Lector' },
    // Lo que se puede mirar: de agosto (el mes anterior al saldo inicial) al mes en curso
    primerMes: '2026-08',
    feriados: {
        '2026-10-12': 'Día del Respeto a la Diversidad Cultural',
        '2026-11-23': 'Día de la Soberanía Nacional'
    },
    // Las licencias de Mi espacio, como las ve su dueña (con el tipo); `horas` en las de horas a favor
    licencias: [
        { desde: '2026-10-09', hasta: '2026-10-09', texto: 'Horas a favor, el día entero', entero: true },
        { desde: '2026-10-13', hasta: '2026-10-15', texto: 'Estudios', entero: true },
        { desde: '2026-10-20', hasta: '2026-10-20', texto: '2 h a favor', entero: false },
        { desde: '2026-10-30', hasta: '2026-10-30', texto: 'Grupo familiar', entero: true }
    ],
    // Lo cargado: la salida y, si la anotó, la entrada; en un feriado o un fin de semana, las dos
    dias: {
        '2026-08-25': { salida: '16:30' },
        '2026-08-27': { salida: '16:00' },

        '2026-09-01': { salida: '15:05' },
        '2026-09-03': { salida: '15:12' },
        '2026-09-10': { salida: '16:46' },
        '2026-09-11': { entrada: '08:04', salida: '17:16' },
        '2026-09-15': { salida: '15:09' },
        '2026-09-17': { salida: '17:20', nota: 'Carga del censo de comercios' },
        '2026-09-24': { salida: '16:16' },
        '2026-09-25': { salida: '15:50' },
        '2026-09-29': { salida: '15:46' },

        '2026-10-01': { salida: '15:14' },
        '2026-10-02': { salida: '15:31' },
        '2026-10-05': { entrada: '08:02', salida: '16:20' },
        '2026-10-06': { salida: '15:46' },
        '2026-10-08': { salida: '17:16', nota: 'Cierre del informe mensual' },
        '2026-10-12': { entrada: '09:21', salida: '12:10', nota: 'Guardia de la mesa de datos' },
        '2026-10-16': { entrada: '07:58', salida: '15:05' },
        '2026-10-19': { salida: '16:00' },
        '2026-10-20': { salida: '13:02' },
        '2026-10-21': { salida: '18:10' },
        '2026-10-22': { salida: '15:20' },
        '2026-10-24': { entrada: '09:00', salida: '13:20', nota: 'Relevamiento en el barrio' },
        '2026-10-26': { salida: '15:47' }
    }
};

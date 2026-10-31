/* MAQUETA (30/10/2026): los datos INVENTADOS de la persona de contrato de la maqueta (Sofía Paz, la de los casos de los tests;
   acá con el rol Editor). Hoy es el miércoles 03/02/2027. Ningún dato sale de la base: las salidas, las horas y la licencia de
   la nota son de muestra.

   Las cuentas, con la regla de la planilla (día hábil: la salida desde las 15:00, cada media hora vale desde su minuto 16):
   - enero de 2027: 05/01 15:46 → 1 h; 07/01 15:20 → 0,5 h; 12/01 16:16 → 1,5 h; 18/01 15:05 → 0; 20/01 17:16 → 2,5 h. Suman 5,5 h.
   - febrero de 2027: 02/02 16:20 → 1,5 h, con «Sumar a enero» tildado (guardado así); 03/02 (hoy) 15:50 → 1 h, sin tildar.
   Con eso, enero suma 5,5 + 1,5 = 7 h (en febrero, 1 día de franco) y febrero, 1 h propia (en marzo, 1 hora a favor).
   Los feriados son los de esos meses: los fijos y los de la precarga de Configuración → Feriados. */
window.DATOS = {
    hoy: '2027-02-03',
    persona: {
        nombre: 'Sofía Paz', iniciales: 'SP', rol: 'Editor', nombre_corto: 'Sofía',
        // Un cargo inventado para la firma de la nota (es personal contratado)
        cargo: 'Analista de Datos Abiertos'
    },
    // Lo que se puede mirar en la maqueta: de diciembre de 2026 (adonde suman los días tildados de enero) al mes en curso
    primerMes: '2026-12',
    feriados: {
        '2026-12-07': 'Día no laborable con fines turísticos',
        '2026-12-08': 'Inmaculada Concepción de María',
        '2026-12-25': 'Navidad',
        '2027-01-01': 'Año Nuevo',
        '2027-02-08': 'Carnaval',
        '2027-02-09': 'Carnaval'
    },
    // Lo guardado en la planilla: la salida y, si la anotó, la entrada y una nota. `al_mes_anterior`: «Sumar a {mes anterior}»
    // tildado (lo nuevo)
    salidas: {
        '2027-01-05': { salida: '15:46' },
        '2027-01-07': { entrada: '08:03', salida: '15:20' },
        '2027-01-12': { salida: '16:16', nota: 'Actualización del tablero de obras' },
        '2027-01-18': { salida: '15:05' },
        '2027-01-20': { salida: '17:16' },
        '2027-02-02': { salida: '16:20', al_mes_anterior: true },
        '2027-02-03': { salida: '15:50' }
    },
    // La licencia de la nota en Word (pantalla 6): unas horas a favor de 7 h el viernes 05/02/2027, guardada hoy. En la maqueta no
    // se suma a la pestaña: es la nota que saldría si se cargara
    nota: { tipo: 'horas_a_favor', desde: '2027-02-05', horas: 7, guardada: '2027-02-03' }
};

// MAQUETA (27/10/2026): el texto de la nota de licencia, el mismo para la vista de la maqueta y para los Word de muestra
// (se carga en el navegador y, con vm, en Node). No es el código de la entrega: es para ver los textos aprobados.
(function (global) {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre',
    'diciembre'];
  const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
    'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós',
    'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const DECENAS = { 3: 'treinta', 4: 'cuarenta', 5: 'cincuenta', 6: 'sesenta', 7: 'setenta', 8: 'ochenta', 9: 'noventa' };

  // 1 a 99 en letras; con «días» (masculino) «uno» pasa a «un», con «horas», a «una»
  function enLetras(n, genero) {
    let texto = n < 30 ? UNIDADES[n] : DECENAS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNIDADES[n % 10]}` : '');
    if (/uno$/.test(texto)) texto = texto.replace(/uno$/, genero === 'f' ? 'una' : 'un').replace(/veintiun$/, 'veintiún');
    return texto;
  }
  const partes = (fecha) => fecha.split('-').map(Number);
  const diaDeSemana = (fecha) => { const [a, m, d] = partes(fecha); return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]; };
  const fechaLarga = (fecha) => { const [a, m, d] = partes(fecha); return `${d} de ${MESES[m - 1]} de ${a}`; };
  const conDia = (fecha) => `${diaDeSemana(fecha)} ${fechaLarga(fecha)}`;
  const mesAntes = (fecha, cuantos) => {
    const [a, m] = partes(fecha);
    const indice = a * 12 + (m - 1) - cuantos;
    return `${MESES[indice % 12]} de ${Math.floor(indice / 12)}`;
  };

  const dias = (n) => `${enLetras(n, 'm')} (${n}) ${n === 1 ? 'día hábil' : 'días hábiles'}`;
  function horas(h) {
    const enteras = Math.floor(h);
    const media = h - enteras === 0.5;
    const numero = String(h).replace('.', ',');
    if (!media) return `${enLetras(enteras, 'f')} (${numero}) ${enteras === 1 ? 'hora' : 'horas'}`;
    if (enteras === 0) return `media hora (${numero})`;
    return `${enLetras(enteras, 'f')} ${enteras === 1 ? 'hora' : 'horas'} y media (${numero})`;
  }
  const cuando = (l) => (l.dias === 1 ? `el día ${conDia(l.desde)}` : `a partir del día ${conDia(l.desde)}`);

  const PIDO = 'Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar ';
  const CUERPOS = {
    vacaciones: (l) => `${PIDO}el usufructo de ${dias(l.dias)} ${l.dias === 1 ? 'correspondiente' : 'correspondientes'} a mi licencia `
      + `anual ordinaria, ${cuando(l)}.`,
    franquicia: (l) => `${PIDO}el usufructo de ${horas(l.horas)} de franquicia para trámites personales el día ${conDia(l.desde)}.`,
    estudios: (l) => `${PIDO}licencia por examen por ${dias(l.dias)}, ${cuando(l)}.`,
    medica: (l) => `${PIDO}licencia por atención médica por ${dias(l.dias)}, ${cuando(l)}.`,
    familiar: (l) => `${PIDO}licencia por atención del grupo familiar por ${dias(l.dias)}, ${cuando(l)}.`,
    medica_extraordinaria: (l) => `${PIDO}licencia médica extraordinaria por ${dias(l.dias)}, ${cuando(l)}.`,
    franco: (l) => `${PIDO}el usufructo del franco compensatorio correspondiente a las horas extras realizadas en `
      + `${mesAntes(l.desde, 2)}, el día ${conDia(l.desde)}.`,
    horas_a_favor: (l) => `${PIDO}el usufructo de ${horas(l.horas)} a favor, ${l.horas === 1 ? 'correspondiente' : 'correspondientes'} `
      + `a las horas extras realizadas en ${mesAntes(l.desde, 1)}, el día ${conDia(l.desde)}.`
  };
  const NOMBRES_DEL_ARCHIVO = {
    vacaciones: 'Licencia anual ordinaria', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica',
    familiar: 'Atención del grupo familiar', medica_extraordinaria: 'Médica extraordinaria', franco: 'Franco compensatorio',
    horas_a_favor: 'Horas a favor'
  };

  /**
   * La nota de una licencia: `licencia` = { tipo, desde, hasta, dias, horas }, `fecha` = el día de la nota (la última vez que se
   * guardó la licencia), `persona` = { nombre, cargo, contratado }
   */
  function notaDeLicencia(licencia, fecha, persona) {
    const cuerpo = CUERPOS[licencia.tipo];
    if (!cuerpo) return null;
    const firma = [persona.nombre];
    if (persona.contratado) firma.push('Personal contratado, cumpliendo funciones de');
    if (persona.cargo) firma.push(persona.cargo);
    return {
      fecha: `Comodoro Rivadavia, ${fechaLarga(fecha)}`,
      destinatario: ['Al Señor Director General de', 'Modernización e Investigación Territorial'],
      sd: 'S               /               D',
      saludo: 'De mi mayor consideración:',
      cuerpo: cuerpo(licencia),
      cierre: 'Sin otro particular, saludo a Ud. atentamente.',
      firma,
      archivo: `Nota de licencia - ${NOMBRES_DEL_ARCHIVO[licencia.tipo]} - ${licencia.desde}.docx`
    };
  }

  global.notaDeLicencia = notaDeLicencia;
})(typeof window !== 'undefined' ? window : globalThis);

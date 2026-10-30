/*
 * MAQUETA (29/10/2026): los tres tipos de evento de la agenda de Mi espacio. Datos inventados (las personas, los eventos y las
 * licencias). Los feriados son los cargados en Configuración → Feriados, que son públicos. Hoy es el jueves 29/10/2026.
 */
window.DATOS = {
  hoy: '2026-10-29',
  ahora: '2026-10-29 09:40',

  // «Ver como», en la barra de la maqueta
  maqueta: { quienes: [['2', 'Carla (editora)'], ['4', 'Julián (admin)'], ['6', 'Tomás (lector)'], ['3', 'Lucía (colaboradora)']] },

  // Las personas (inventadas): las 9 del RPAD. Administración: superadmin, admin y editor
  usuarios: [
    { id: 1, nombre: 'Andrea Paula Molina', rol: 'superadmin', rolTexto: 'Superadmin' },
    { id: 4, nombre: 'Julián Esteban Ferreyra', rol: 'admin', rolTexto: 'Administrador' },
    { id: 2, nombre: 'Carla Inés Benítez', rol: 'editor', rolTexto: 'Editor' },
    { id: 3, nombre: 'Lucía Sosa', rol: 'colaborador', rolTexto: 'Colaborador' },
    { id: 6, nombre: 'Tomás Quiroga', rol: 'lector', rolTexto: 'Lector' },
    { id: 9, nombre: 'Paula Herrera', rol: 'lector', rolTexto: 'Lector' },
    { id: 5, nombre: 'Romina Acosta', rol: 'lector', rolTexto: 'Lector' },
    { id: 8, nombre: 'Graciela Vera', rol: 'lector', rolTexto: 'Lector' },
    { id: 7, nombre: 'Natalia Castro', rol: 'lector', rolTexto: 'Lector' }
  ],

  // Lo que ven los demás de un Personal (Público): la lista que eligió el usuario el 29/10/2026 (cuatro suyas y «Capacitación o curso»)
  categorias: [
    { texto: 'Trámite personal' },
    { texto: 'Turno médico' },
    { texto: 'Asunto familiar' },
    { texto: 'Fuera de la oficina' },
    { texto: 'Capacitación o curso' }
  ],

  // Los feriados que no son los 9 fijos (reales, de la tabla) y los fijos de estos meses
  feriados: [
    { fecha: '2026-10-12', nombre: 'Día del Respeto a la Diversidad Cultural' },
    { fecha: '2026-11-02', nombre: 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches' },
    { fecha: '2026-11-08', nombre: 'Día del Empleado Municipal' },
    { fecha: '2026-11-09', nombre: 'Visita de Su Santidad el Papa León XIV' },
    { fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional' },
    { fecha: '2026-12-07', nombre: 'Día no laborable con fines turísticos' },
    { fecha: '2026-12-08', nombre: 'Inmaculada Concepción de María' },
    { fecha: '2026-12-13', nombre: 'Día del Petróleo Nacional' },
    { fecha: '2026-12-25', nombre: 'Navidad' },
    { fecha: '2027-01-01', nombre: 'Año Nuevo' }
  ],

  // Las licencias de día entero de Mi espacio, de cada persona. Los compañeros nunca ven el tipo; las de horas no se les muestran
  licencias: [
    { usuario: 1, tipo: 'Franco compensatorio', desde: '2026-10-30', hasta: '2026-10-30' },
    { usuario: 1, tipo: 'Franquicia, 2 h', desde: '2026-11-04', hasta: '2026-11-04', horas: true },
    { usuario: 1, tipo: 'Vacaciones', desde: '2026-11-23', hasta: '2026-11-27' },
    { usuario: 2, tipo: 'Vacaciones', desde: '2026-10-07', hasta: '2026-10-16' },
    { usuario: 2, tipo: 'Atención médica', desde: '2026-10-19', hasta: '2026-10-19' },
    { usuario: 2, tipo: 'Vacaciones', desde: '2026-11-05', hasta: '2026-11-13' },
    { usuario: 2, tipo: 'Vacaciones', desde: '2026-12-21', hasta: '2027-01-08' },
    { usuario: 4, tipo: 'Vacaciones', desde: '2026-10-26', hasta: '2026-10-27' },
    { usuario: 4, tipo: 'Atención del grupo familiar', desde: '2026-11-20', hasta: '2026-11-20' },
    { usuario: 4, tipo: 'Vacaciones', desde: '2027-01-04', hasta: '2027-01-15' },
    { usuario: 3, tipo: 'Franco compensatorio', desde: '2026-11-16', hasta: '2026-11-16' },
    { usuario: 6, tipo: 'Horas a favor, 3 h', desde: '2026-10-30', hasta: '2026-10-30', horas: true },
    { usuario: 6, tipo: 'Vacaciones', desde: '2026-12-14', hasta: '2026-12-24' }
  ],

  // Los eventos (inventados). tipo: 'privado', 'publico' o 'laboral'; creador: id; con: ids o 'todos' (en un laboral, «Toda la
  // administración»); publico: lo que ven los demás de un Personal (Público); recordatorio: '1h', '2h', 'dia_anterior' o 'ninguno'
  eventos: [
    // Personal (Público)
    { id: 1, tipo: 'publico', creador: 6, con: 'todos', fecha: '2026-11-05', desde: '10:00', titulo: 'Turno con el dentista', publico: 'Turno médico', recordatorio: '2h', detalle: 'Llevar el carnet de la obra social.' },
    { id: 2, tipo: 'publico', creador: 6, con: 'todos', fecha: '2026-11-04', desde: '13:00', hasta: '15:00', titulo: 'Acto en la escuela de mi hija', publico: 'Asunto familiar', recordatorio: '1h' },
    { id: 3, tipo: 'publico', creador: 4, con: [2, 6], fecha: '2026-10-29', desde: '12:30', hasta: '13:30', titulo: 'Trámite en el banco', publico: 'Trámite personal', recordatorio: '1h' },
    { id: 4, tipo: 'publico', creador: 1, con: 'todos', fecha: '2026-11-05', desde: '15:30', titulo: 'Retirar a mi hijo del jardín', publico: 'Asunto familiar', recordatorio: 'ninguno' },
    { id: 5, tipo: 'publico', creador: 3, con: 'todos', fecha: '2026-11-06', desde: '08:00', titulo: 'Mudanza', publico: 'De mudanza', recordatorio: 'dia_anterior' },
    { id: 6, tipo: 'publico', creador: 2, con: [1, 4, 3, 6], fecha: '2026-11-19', desde: '14:00', hasta: '17:00', titulo: 'Seminario de posgrado en la universidad', publico: 'Capacitación o curso', recordatorio: '2h' },
    // Laboral
    { id: 7, tipo: 'laboral', creador: 1, con: 'todos', fecha: '2026-11-03', desde: '10:00', hasta: '11:00', titulo: 'Reunión de equipo', recordatorio: '2h' },
    { id: 8, tipo: 'laboral', creador: 4, con: [2], fecha: '2026-10-30', desde: '10:00', hasta: '11:30', titulo: 'Revisar los datasets de Ambiente', recordatorio: '2h' },
    { id: 9, tipo: 'laboral', creador: 1, con: 'todos', fecha: '2026-10-31', desde: '10:00', hasta: '14:00', titulo: 'Stand de datos en la Feria del Libro', recordatorio: '2h' },
    { id: 10, tipo: 'laboral', creador: 2, con: [1, 4], fecha: '2026-11-18', desde: '09:30', hasta: '12:00', titulo: 'Capacitación en datos abiertos para las áreas municipales', recordatorio: 'dia_anterior' },
    // Personal (Privado)
    { id: 11, tipo: 'privado', creador: 2, fecha: '2026-10-29', desde: '11:00', titulo: 'Llamar a Catastro', recordatorio: '1h' },
    { id: 12, tipo: 'privado', creador: 2, fecha: '2026-11-03', desde: '15:00', titulo: 'Preparar el informe para la Subsecretaría', recordatorio: '2h' },
    { id: 13, tipo: 'privado', creador: 4, fecha: '2026-10-29', desde: '16:00', titulo: 'Enviar el informe mensual', recordatorio: '2h' },
    { id: 14, tipo: 'privado', creador: 4, fecha: '2026-11-10', desde: '11:00', titulo: 'Llamar a Vialidad por el TMDA', recordatorio: '1h' },
    { id: 15, tipo: 'privado', creador: 6, fecha: '2026-11-11', desde: '14:00', titulo: 'Curso de QGIS', recordatorio: '2h' },
    { id: 16, tipo: 'privado', creador: 3, fecha: '2026-10-30', desde: '09:00', titulo: 'Cargar las notas DGMIT de octubre', recordatorio: '2h' },
    { id: 17, tipo: 'privado', creador: 3, fecha: '2026-11-12', desde: '17:30', titulo: 'Turno con el dentista', recordatorio: 'dia_anterior' },
    { id: 18, tipo: 'privado', creador: 1, fecha: '2026-10-29', desde: '12:00', titulo: 'Revisar la nota de la DGMIT', recordatorio: '2h' }
  ]
};

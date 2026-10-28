/*
 * MAQUETA (28/10/2026): datos inventados (las personas, los eventos y las licencias). Los feriados son los cargados en
 * Configuración → Feriados, que son públicos. Hoy es el miércoles 28/10/2026.
 */
window.DATOS = {
  hoy: '2026-10-28',
  // Los rótulos de la barra de la maqueta
  maqueta: { quienes: [['1', 'Andrea (superadmin)'], ['6', 'Tomás (lector)']], repetida: 'Sí (se suma Carla Ríos, inventada)' },
  ahora: '2026-10-28 09:40',

  // Las personas (inventadas). Administración: superadmin, admin y editor
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
  // Solo para el estado «Nombres repetidos»: una compañera inventada, de administración
  repetida: { id: 99, nombre: 'Carla Ríos', rol: 'editor', rolTexto: 'Editor' },

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
    { fecha: '2027-01-01', nombre: 'Año Nuevo' },
    { fecha: '2027-02-08', nombre: 'Carnaval' },
    { fecha: '2027-02-09', nombre: 'Carnaval' }
  ],

  // Las licencias de día entero de Mi espacio, de cada persona. Los compañeros nunca ven el tipo
  licencias: [
    { usuario: 1, tipo: 'Vacaciones', desde: '2026-10-20', hasta: '2026-10-20' },
    { usuario: 1, tipo: 'Franquicia, 2 h', desde: '2026-11-04', hasta: '2026-11-04', horas: true },
    { usuario: 1, tipo: 'Vacaciones', desde: '2026-11-16', hasta: '2026-11-27' },
    { usuario: 1, tipo: 'Franco compensatorio', desde: '2027-01-15', hasta: '2027-01-15' },
    { usuario: 2, tipo: 'Vacaciones', desde: '2026-10-07', hasta: '2026-10-16' },
    { usuario: 2, tipo: 'Atención médica', desde: '2026-10-19', hasta: '2026-10-19' },
    { usuario: 2, tipo: 'Vacaciones', desde: '2026-11-05', hasta: '2026-11-13' },
    { usuario: 2, tipo: 'Vacaciones', desde: '2026-12-21', hasta: '2027-01-08' },
    { usuario: 4, tipo: 'Vacaciones', desde: '2026-11-03', hasta: '2026-11-06' },
    { usuario: 4, tipo: 'Atención del grupo familiar', desde: '2026-10-29', hasta: '2026-10-29' },
    { usuario: 4, tipo: 'Vacaciones', desde: '2027-01-04', hasta: '2027-01-15' },
    { usuario: 6, tipo: 'Horas a favor, 3 h', desde: '2026-10-30', hasta: '2026-10-30', horas: true },
    { usuario: 6, tipo: 'Vacaciones', desde: '2026-12-14', hasta: '2026-12-24' },
    { usuario: 99, tipo: 'Vacaciones', desde: '2026-11-10', hasta: '2026-11-20' }
  ],

  // Los eventos (inventados). creador: id; con: ids o 'todos'; sin `con`, solo de quien lo creó
  eventos: [
    { id: 1, creador: 1, con: 'todos', fecha: '2026-10-26', desde: '09:00', hasta: '10:00', titulo: 'Reunión semanal de la Dirección' },
    { id: 2, creador: 1, fecha: '2026-10-27', desde: '11:00', titulo: 'Llamar a Vialidad por el TMDA' },
    { id: 3, creador: 4, con: 'todos', fecha: '2026-10-28', desde: '10:00', hasta: '11:30', titulo: 'Reunión de equipo: avance de los datasets de Ambiente' },
    { id: 4, creador: 1, fecha: '2026-10-28', desde: '12:00', titulo: 'Revisar la nota de la DGMIT' },
    { id: 5, creador: 1, con: [2], fecha: '2026-10-28', desde: '15:30', hasta: '16:30', titulo: 'Entrevista con Tránsito por los siniestros viales' },
    { id: 6, creador: 2, con: [1, 4], fecha: '2026-10-30', desde: '09:30', hasta: '12:00', titulo: 'Capacitación en datos abiertos para las áreas municipales del Distrito Centro' },
    { id: 7, creador: 1, con: 'todos', fecha: '2026-10-31', desde: '10:00', hasta: '14:00', titulo: 'Stand de datos en la Feria del Libro' },
    { id: 8, creador: 4, con: 'todos', fecha: '2026-11-03', desde: '10:00', titulo: 'Presentación del Índice de actualización al Intendente' },
    { id: 9, creador: 1, fecha: '2026-11-05', desde: '09:00', titulo: 'Mesa de entradas: seguimiento de notas' },
    { id: 10, creador: 1, fecha: '2026-11-05', desde: '11:00', titulo: 'Llamar a Catastro' },
    { id: 11, creador: 1, con: [4], fecha: '2026-11-05', desde: '14:00', titulo: 'Revisión del portal de datos' },
    { id: 12, creador: 1, fecha: '2026-11-05', desde: '16:00', titulo: 'Enviar el informe mensual' },
    { id: 13, creador: 4, con: [1], fecha: '2026-11-10', desde: '10:00', titulo: 'Reunión con la Subsecretaría de Modernización' },
    { id: 14, creador: 2, con: 'todos', fecha: '2026-11-12', desde: '18:00', hasta: '20:00', titulo: 'Taller de Gobierno Abierto con vecinos' },
    { id: 15, creador: 1, fecha: '2026-11-13', desde: '09:00', titulo: 'Dejar todo listo antes de las vacaciones' },
    { id: 16, creador: 1, con: 'todos', fecha: '2026-12-01', desde: '10:00', hasta: '12:00', titulo: 'Planificación 2027' },
    { id: 17, creador: 1, fecha: '2026-12-10', desde: '12:00', titulo: 'Cerrar el Informe anual del RPAD' },
    { id: 18, creador: 4, con: 'todos', fecha: '2026-12-18', desde: '13:00', titulo: 'Brindis de fin de año' },
    { id: 19, creador: 1, fecha: '2027-01-05', desde: '10:00', titulo: 'Revisar los datasets vencidos a la vuelta' },
    { id: 20, creador: 1, fecha: '2027-01-11', desde: '09:00', titulo: 'Revisar las reiteraciones de enero' },
    { id: 21, creador: 6, fecha: '2026-10-29', desde: '09:00', titulo: 'Relevamiento de paradas de colectivo' },
    { id: 22, creador: 6, fecha: '2026-11-11', desde: '14:00', titulo: 'Entregar el mapa de luminarias' },
    { id: 23, creador: 6, fecha: '2026-11-14', desde: '10:00', titulo: 'Curso de QGIS' }
  ]
};

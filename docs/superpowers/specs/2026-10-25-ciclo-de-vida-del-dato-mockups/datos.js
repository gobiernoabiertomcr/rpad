// Datos de la maqueta del «Ciclo de vida del dato».
// REALES: la base local (copia del dump de producción del 25/10/2026), año 2026 al 25/10, con las reglas de Métricas (casosDe y
// vistaDe). Las cifras del circuito coinciden con GET /api/metricas; el mayor y el menor salen de los mismos ciclos.
// INVENTADOS (marcados así en la maqueta): las etapas 2 y 3 de la gestión externa (no hay notas DGMIT cargadas todavía) y la
// comparación con el año anterior (2026 es el primer año con métricas).
window.MAQUETA = {
  anio: 2026,
  al: '25/10/2026',
  generado: 'Generado el 25/10/2026 a las 20:15 por Usuario de Prueba',

  descripciones: {
    aviso_externa: 'El RPAD avisa a la DGMIT y a la Dirección Administrativa qué conjuntos de datos vencen en los próximos 40 días y qué datos hay que pedir de cada uno, por Nota Digital (hasta el 12/10/2026, por email).',
    aviso_interna: 'El RPAD avisa a la DGMIT y a la Dirección de Investigación Territorial qué conjuntos de datos vencen en los próximos 60 días y qué hay que relevar.',
    tramite: 'La DGMIT y la Dirección Administrativa preparan la nota formal que le pide los datos al área y se la hacen llegar.',
    respuesta: 'El área reúne y prepara los datos pedidos y se los entrega a Datos Públicos.',
    produccion: 'La DGMIT y la Dirección de Investigación Territorial hacen el relevamiento y le entregan los datos a Datos Públicos.',
    carga_interna: 'El relevamiento ya llega ordenado: Datos Públicos lo revisa para comprobar que cumpla con los estándares de datos abiertos (estructura, normalización y formatos) y lo publica en el portal en formato abierto.',
    carga: 'Los datos llegan en PDF, en papel o desordenados: Datos Públicos los transcribe, los ordena y los normaliza (que «Palazzo», «P. Palazzo» y «Próspero Palazzo» queden como un solo nombre) y los publica en el portal en formato abierto.'
  },
  seMide: {
    aviso_externa: 'Se mide del aviso al vencimiento: cuanto más grande, más anticipación.',
    aviso_interna: 'Se mide del aviso al vencimiento: cuanto más grande, más anticipación.',
    tramite: 'Se mide del aviso del RPAD al día en que el área recibió la nota, con las notas DGMIT cargadas en el Seguimiento.',
    respuesta: 'Se mide del día en que el área recibió la nota al «Recibido el». Con datos de una fuente pública, no se cuenta.',
    produccion: 'Se mide del aviso del RPAD al «Recibido el».',
    carga: 'Se mide del «Recibido el» al día de la carga en el portal.',
    carga_interna: 'Se mide del «Recibido el» al día de la carga en el portal.'
  },

  gestiones: {
    externa: {
      titulo: 'Gestión externa',
      nodos: [
        { clave: 'rpad', nombre: 'RPAD', corto: 'RPAD', rol: 'Datos Públicos avisa', tono: 'acento' },
        { clave: 'da', nombre: 'DGMIT y Dirección Administrativa', corto: 'DGMIT y DA', rol: 'Mandan la nota formal', tono: 'violeta' },
        { clave: 'area', nombre: 'Área responsable', corto: 'Área', rol: 'Prepara los datos', tono: 'acento' },
        { clave: 'ddpc', nombre: 'Datos Públicos', corto: 'DDPC', rol: 'Limpia y estructura', tono: 'acento' },
        { clave: 'portal', nombre: 'Portal', corto: 'Portal', rol: 'Datos publicados', tono: 'verde' }
      ],
      etapas: [
        {
          clave: 'aviso', desc: 'aviso_externa', nombre: 'Aviso anticipado', desde_hasta: 'Del aviso al vencimiento', responsable: 'DDPC', dgmit: false,
          real: {
            n: 32, mediana: [27, 40], promedio: [28, 41],
            mayor: { v: [89, 131], dataset: 'Tránsito Medio Diario Anual (TMDA) en Comodoro Rivadavia', mas: 0 },
            menor: { v: [8, 11], dataset: 'Cantidad de empleados municipales (planta permanente y transitoria)', mas: 0 },
            valores: [8, 13, 26, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 28, 29, 29, 29, 29, 89],
            en_curso: null,
            aclaracion: '6 ciclos se avisaron cuando ya estaban vencidos: no cuentan en esta etapa.'
          },
          inventado: { anterior: [29, 42] }
        },
        {
          clave: 'tramite', desc: 'tramite', nombre: 'Trámite y entrega de la nota', desde_hasta: 'Del aviso a la nota en el área', responsable: 'DGMIT y DA', dgmit: true,
          real: { n: 0, vacio: { titulo: 'Todavía no hay notas DGMIT cargadas', texto: '10 notas pendientes de carga', pie: 'Se empieza a contar cuando se carguen en el Seguimiento.' } },
          inventado: {
            n: 12, mediana: [18, 26], promedio: [22, 31],
            mayor: { v: [47, 66], dataset: 'Gasto Público', mas: 0 },
            menor: { v: [6, 8], dataset: 'Funcionarios Públicos', mas: 0 },
            valores: [6, 9, 11, 14, 16, 17, 19, 21, 24, 29, 33, 47],
            en_curso: '4 sin nota registrada todavía, hace 35 días hábiles (mediana)',
            pendientes: '6 notas pendientes de carga', anterior: [21, 30]
          }
        },
        {
          clave: 'respuesta', desc: 'respuesta', nombre: 'Respuesta del área', desde_hasta: 'De la nota a la entrega', responsable: 'Área', dgmit: false,
          real: { n: 0, vacio: { titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas.' } },
          inventado: {
            n: 10, mediana: [41, 59], promedio: [46, 66],
            mayor: { v: [98, 140], dataset: 'Pedidos de Acceso a la Información Pública', mas: 0 },
            menor: { v: [12, 17], dataset: 'Castraciones de Animales', mas: 0 },
            valores: [12, 22, 30, 38, 40, 42, 49, 61, 73, 98],
            en_curso: '5 sin datos registrados todavía, hace 52 días hábiles (mediana)',
            aclaracion: '4 ciclos se resolvieron con datos de una fuente pública: no cuentan en esta etapa.',
            anterior: [44, 63]
          }
        },
        {
          clave: 'carga', desc: 'carga', nombre: 'Preparación y carga', desde_hasta: 'De la entrega a la carga', responsable: 'DDPC', dgmit: false,
          real: {
            n: 23, mediana: [0, 0], promedio: [1, 1],
            mayor: { v: [3, 5], dataset: 'Cantidad de usuarios del servicio de agua potable (anual)', mas: 5 },
            menor: { v: [0, 0], dataset: 'Castraciones de Animales', mas: 14 },
            valores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3],
            en_curso: null
          },
          inventado: { anterior: [2, 3] }
        }
      ],
      aclaracionGeneral: '8 ciclos son de datasets que no requieren nota DGMIT: cuentan solo en el aviso anticipado y en la carga.'
    },
    interna: {
      titulo: 'Gestión interna',
      nodos: [
        { clave: 'rpad', nombre: 'RPAD', corto: 'RPAD', rol: 'Datos Públicos avisa', tono: 'acento' },
        { clave: 'dit', nombre: 'DGMIT y Dirección de Investigación Territorial', corto: 'DGMIT y DIT', rol: 'Hacen el relevamiento', tono: 'violeta' },
        { clave: 'ddpc', nombre: 'Datos Públicos', corto: 'DDPC', rol: 'Limpia y estructura', tono: 'acento' },
        { clave: 'portal', nombre: 'Portal', corto: 'Portal', rol: 'Datos publicados', tono: 'verde' }
      ],
      etapas: [
        {
          clave: 'aviso', desc: 'aviso_interna', nombre: 'Aviso anticipado', desde_hasta: 'Del aviso al vencimiento', responsable: 'DDPC', dgmit: false,
          real: {
            n: 3, orientativo: true, mediana: [41, 60], promedio: [42, 60],
            mayor: { v: [43, 60], dataset: 'Escala salarial municipal (planta permanente)', mas: 0 },
            menor: { v: [41, 60], dataset: 'Escala salarial municipal (planta permanente)', mas: 1 },
            valores: [41, 41, 43], en_curso: null,
            aclaracion: '6 ciclos se avisaron cuando ya estaban vencidos: no cuentan en esta etapa.'
          },
          inventado: { anterior: [40, 58] }
        },
        {
          clave: 'produccion', desc: 'produccion', nombre: 'Producción del relevamiento', desde_hasta: 'Del aviso a la entrega', responsable: 'DGMIT y DIT', dgmit: true,
          real: {
            n: 5, mediana: [45, 62], promedio: [56, 80],
            mayor: { v: [105, 153], dataset: 'Espacios Verdes de Comodoro Rivadavia', mas: 0 },
            menor: { v: [9, 13], dataset: 'Escala salarial municipal (planta permanente)', mas: 0 },
            valores: [9, 43, 45, 77, 105],
            en_curso: '3 sin datos registrados todavía, hace 206 días hábiles (mediana)'
          },
          inventado: { anterior: [51, 72] }
        },
        {
          clave: 'carga', desc: 'carga_interna', nombre: 'Preparación y carga', desde_hasta: 'De la entrega a la carga', responsable: 'DDPC', dgmit: false,
          real: {
            n: 5, mediana: [0, 0], promedio: [1, 1],
            mayor: { v: [3, 3], dataset: 'Espacios reservados para vehículos de personas con movilidad reducida', mas: 0 },
            menor: { v: [0, 0], dataset: 'Escala salarial municipal (planta permanente)', mas: 3 },
            valores: [0, 0, 0, 0, 3], en_curso: null
          },
          inventado: { anterior: [1, 1] }
        }
      ],
      aclaracionGeneral: null
    }
  }
};

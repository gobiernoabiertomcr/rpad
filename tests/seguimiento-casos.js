// Casos reales para las pruebas del Seguimiento (spec 2026-10-20-seguimiento-dataset-design, "Casos reales para las pruebas").
// Generado del dump de producción del 20/10/2026 con el formato de fuentesDe (services/seguimientoDatos.js): momentos en
// hora argentina 'AAAA-MM-DD HH:MM:SS' y fechas 'AAAA-MM-DD'. Los nombres de las personas y los correos están cambiados.
// altasSinDataset: los cambios 'crear' aprobados con dataset_id NULL cuya aprobación cae a menos de 5 s del alta (la
// unión con el dataset la decide unirAlta). Hoy, para todos estos casos: HOY_DE_LOS_CASOS.
export const HOY_DE_LOS_CASOS = '2026-10-20';

export const CATALOGOS = {
  "areas": {
    "1": "Agencia de Acceso a la Información Pública",
    "2": "Agencia Provincial de Seguridad Vial",
    "3": "Asociación de Bomberos Voluntarios de Comodoro Rivadavia",
    "4": "Banco Central de la República Argentina",
    "5": "Dirección de Datos Públicos y Comunicación",
    "6": "Dirección de Estadística y Evaluación Educativa",
    "7": "Dirección de Patrimonio Cultural y Natural. D. G. de Gestión Interinstitucional y Patrimonial",
    "8": "Dirección General de Asociaciones Vecinales",
    "9": "Dirección General de Catastro",
    "10": "Dirección General de Cultos",
    "11": "Dirección General de Gestión lntegral de Contribuyentes",
    "12": "Dirección General de Habilitaciones Comerciales",
    "13": "Dirección General de Higiene Urbana y Estrategias Urbano Ambientales",
    "14": "Dirección General de Modernización e Investigación Territorial",
    "15": "Dirección General de Parques y Paseos",
    "16": "Dirección General de Promoción de Derechos para Personas con Discapacidad",
    "17": "Dirección General de Promoción Social y Comunitaria",
    "18": "Dirección General de Recursos Humanos",
    "19": "Dirección General de Relaciones Laborales",
    "20": "Dirección General de Servicios Administrativos",
    "21": "Dirección General de Tránsito",
    "22": "Dirección General de Transporte",
    "23": "Dirección General de Veterinaria, Control de Fauna Urbana y Plagas",
    "24": "Empresa Argentina de Navegación Aérea",
    "25": "Ente Autárquico Comodoro Deportes",
    "26": "Ente Autárquico Comodoro Turismo",
    "27": "Honorable Concejo Deliberante de Comodoro Rivadavia",
    "28": "Instituto Geográfico Nacional de la República Argentina",
    "29": "Instituto Nacional de Estadística y Censos de la República Argentina",
    "30": "Ministerio de Educación del Chubut",
    "31": "Municipalidad de Comodoro Rivadavia",
    "32": "Secretaría de Cultura",
    "33": "Secretaría de Desarrollo Humano y Familia",
    "34": "Secretaría de Economía, Finanzas y Control de Gestión",
    "35": "Secretaría de Energía de Nación",
    "36": "Secretaría de Infraestructura, Obras y Servicios Públicos",
    "37": "Secretaría de la Mujer, Género y Diversidad",
    "38": "Dirección de Información Tributaria. Dirección General de Análisis y Administración Tributaria",
    "39": "Secretaría de Salud",
    "40": "Subsecretaría de Comunicación",
    "41": "Sociedad Cooperativa Popular Limitada",
    "42": "Subsecretaria de Coordinación Económica y Control de Gestión",
    "43": "Tribunal Electoral del Chubut",
    "44": "Dirección Nacional de Vialidad",
    "45": "Dirección General de Prensa y Comunicación Institucional",
    "46": "Dirección General de Sueldos"
  },
  "frecuencias": {
    "1": "Mensualmente",
    "2": "Bimestralmente",
    "3": "Trimestralmente",
    "4": "Cuatrimestralmente",
    "5": "Cada medio año",
    "6": "Anualmente",
    "7": "Cada dos años",
    "8": "Cada tres años",
    "9": "Cada cuatro años",
    "10": "Cada diez años",
    "11": "Eventual"
  }
};

export const CASOS = {
  "1": {
    "dataset": {
      "id": 1,
      "titulo": "Presupuesto Municipal",
      "area": "Secretaría de Economía, Finanzas y Control de Gestión",
      "area_superior": "Intendencia",
      "area_id": 34,
      "tipo_gestion": "externa",
      "frecuencia": "Anualmente",
      "meses": 12,
      "proxima": "2026-01-31",
      "datos_al": "2025-12-31",
      "ultima": "2025-01-31",
      "tipo_pedido": "ejercicio",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/presupuesto-municipal",
      "activo": true,
      "alta": "2025-11-30 18:00:52"
    },
    "altasSinDataset": [],
    "cambios": [
      {
        "id": 51,
        "tipo": "editar",
        "estado": "pendiente",
        "creado": "2026-10-19 13:00:21",
        "revisado": null,
        "propuso": "Bruno Pablo Dos",
        "reviso": null,
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-10-19",
          "datos_al": "2026-12-31",
          "proxima_actualizacion": "2027-01-31",
          "recibido_el": "2026-10-19",
          "notas": null,
          "registro_actualizacion": true
        },
        "anteriores": {
          "ultima_actualizacion": "2025-01-31",
          "datos_al": "2025-12-31",
          "proxima_actualizacion": "2026-01-31"
        },
        "dataset_id": 1
      }
    ],
    "historial": [
      {
        "fecha": "2025-12-17",
        "creado": "2025-12-17 09:04:21",
        "usuario": "Ana María Uno",
        "cambio_id": null
      }
    ],
    "emails": [
      {
        "id": 7,
        "tipo": "externo-40",
        "enviado": "2025-12-22 08:00:06",
        "success": true,
        "cantidad": 22,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 20,
        "tipo": "externo-5",
        "enviado": "2026-01-26 08:00:10",
        "success": true,
        "cantidad": 20,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 24,
        "tipo": "externo-vencido",
        "enviado": "2026-02-01 08:00:06",
        "success": true,
        "cantidad": 24,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 29,
        "tipo": "externo-vencido",
        "enviado": "2026-03-01 08:00:14",
        "success": true,
        "cantidad": 20,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 35,
        "tipo": "externo-vencido",
        "enviado": "2026-04-01 08:00:13",
        "success": true,
        "cantidad": 14,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 40,
        "tipo": "externo-vencido",
        "enviado": "2026-05-01 08:00:10",
        "success": true,
        "cantidad": 9,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 48,
        "tipo": "externo-vencido",
        "enviado": "2026-07-01 08:00:07",
        "success": true,
        "cantidad": 7,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 52,
        "tipo": "externo-vencido",
        "enviado": "2026-08-01 08:00:12",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 55,
        "tipo": "externo-vencido",
        "enviado": "2026-09-01 08:00:07",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 58,
        "tipo": "externo-vencido",
        "enviado": "2026-10-01 08:00:06",
        "success": true,
        "cantidad": 11,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 4,
        "numero": 2,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:30",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "vencido",
        "vencimiento": "2026-01-31",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "9": {
    "dataset": {
      "id": 9,
      "titulo": "Pedidos de Acceso a la Información Pública",
      "area": "Agencia de Acceso a la Información Pública",
      "area_superior": "Subsec. de Modernización y Transparencia. Sec. de Gobierno, Modernización y Transparencia",
      "area_id": 1,
      "tipo_gestion": "externa",
      "frecuencia": "Cuatrimestralmente",
      "meses": 4,
      "proxima": "2027-01-31",
      "datos_al": "2026-08-31",
      "ultima": "2026-10-09",
      "tipo_pedido": "acumulado",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/pedidos-de-acceso-a-la-informacion-publica",
      "activo": true,
      "alta": "2025-12-01 09:56:13"
    },
    "altasSinDataset": [],
    "cambios": [
      {
        "id": 23,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-03-13 09:48:44",
        "revisado": "2026-03-13 09:52:04",
        "propuso": "Ana María Uno",
        "reviso": "Bruno Pablo Dos",
        "motivo": null,
        "nuevos": {
          "titulo": "Pedidos de Acceso a la Información Pública",
          "descripcion": "Registro de solicitudes de acceso a la información pública presentadas ante la Agencia de AIP de la Municipalidad de Comodoro Rivadavia, en cumplimiento de la Ordenanza N° 4388/93 y normativa provincial vigente. Incluye datos sobre pedidos realizados por la ciudadanía ejerciendo su derecho constitucional de acceso a información en poder del Estado Municipal. Los datos permiten transparentar las solicitudes recibidas y promover el control ciudadano sobre la gestión pública",
          "area_id": 1,
          "frecuencia_id": 4,
          "ultima_actualizacion": "2026-03-13",
          "proxima_actualizacion": "2026-07-31",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pedidos-de-acceso-a-la-informacion-publica",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "anteriores": {
          "titulo": "Pedidos de Acceso a la Información Pública",
          "descripcion": "Registro de solicitudes de acceso a la información pública presentadas ante la Agencia de AIP de la Municipalidad de Comodoro Rivadavia, en cumplimiento de la Ordenanza N° 4388/93 y normativa provincial vigente. Incluye datos sobre pedidos realizados por la ciudadanía ejerciendo su derecho constitucional de acceso a información en poder del Estado Municipal. Los datos permiten transparentar las solicitudes recibidas y promover el control ciudadano sobre la gestión pública",
          "area_id": 1,
          "frecuencia_id": 5,
          "ultima_actualizacion": "2025-07-31T03:00:00.000Z",
          "proxima_actualizacion": "2025-01-31T03:00:00.000Z",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pedidos-de-acceso-a-la-informacion-publica",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "dataset_id": 9
      },
      {
        "id": 24,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-03-13 09:52:55",
        "revisado": "2026-03-13 09:54:33",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Ana María Uno",
        "motivo": null,
        "nuevos": {
          "titulo": "Pedidos de Acceso a la Información Pública",
          "descripcion": "Registro de solicitudes de acceso a la información pública presentadas ante la Agencia de AIP de la Municipalidad de Comodoro Rivadavia, en cumplimiento de la Ordenanza N° 4388/93 y normativa provincial vigente. Incluye datos sobre pedidos realizados por la ciudadanía ejerciendo su derecho constitucional de acceso a información en poder del Estado Municipal. Los datos permiten transparentar las solicitudes recibidas y promover el control ciudadano sobre la gestión pública",
          "area_id": 1,
          "frecuencia_id": 4,
          "ultima_actualizacion": "2026-03-13",
          "proxima_actualizacion": "2026-04-30",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pedidos-de-acceso-a-la-informacion-publica",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "anteriores": {
          "titulo": "Pedidos de Acceso a la Información Pública",
          "descripcion": "Registro de solicitudes de acceso a la información pública presentadas ante la Agencia de AIP de la Municipalidad de Comodoro Rivadavia, en cumplimiento de la Ordenanza N° 4388/93 y normativa provincial vigente. Incluye datos sobre pedidos realizados por la ciudadanía ejerciendo su derecho constitucional de acceso a información en poder del Estado Municipal. Los datos permiten transparentar las solicitudes recibidas y promover el control ciudadano sobre la gestión pública",
          "area_id": 1,
          "frecuencia_id": 4,
          "ultima_actualizacion": "2026-03-13T03:00:00.000Z",
          "proxima_actualizacion": "2026-07-31T03:00:00.000Z",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pedidos-de-acceso-a-la-informacion-publica",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "dataset_id": 9
      },
      {
        "id": 47,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-10-09 14:57:08",
        "revisado": "2026-10-14 08:35:54",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Carla Inés Tres",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-10-09",
          "proxima_actualizacion": "2026-12-31",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2026-03-13T03:00:00.000Z",
          "proxima_actualizacion": "2026-04-30T03:00:00.000Z"
        },
        "dataset_id": 9
      }
    ],
    "historial": [
      {
        "fecha": "2025-12-17",
        "creado": "2025-12-17 09:03:29",
        "usuario": "Ana María Uno",
        "cambio_id": null
      }
    ],
    "emails": [
      {
        "id": 7,
        "tipo": "externo-40",
        "enviado": "2025-12-22 08:00:06",
        "success": true,
        "cantidad": 22,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 8,
        "tipo": "area-aviso-40",
        "enviado": "2025-12-22 08:00:07",
        "success": true,
        "cantidad": 1,
        "area": "Agencia de Acceso a la Información Pública",
        "area_articulo": "la",
        "destinatarios": "correo5@rpad.test",
        "error": null
      },
      {
        "id": 24,
        "tipo": "externo-vencido",
        "enviado": "2026-02-01 08:00:06",
        "success": true,
        "cantidad": 24,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 29,
        "tipo": "externo-vencido",
        "enviado": "2026-03-01 08:00:14",
        "success": true,
        "cantidad": 20,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 30,
        "tipo": "externo-40",
        "enviado": "2026-03-21 08:00:04",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 31,
        "tipo": "area-aviso-40",
        "enviado": "2026-03-21 08:00:05",
        "success": true,
        "cantidad": 1,
        "area": "Agencia de Acceso a la Información Pública",
        "area_articulo": "la",
        "destinatarios": "correo5@rpad.test",
        "error": null
      },
      {
        "id": 37,
        "tipo": "externo-5",
        "enviado": "2026-04-25 08:00:05",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 40,
        "tipo": "externo-vencido",
        "enviado": "2026-05-01 08:00:10",
        "success": true,
        "cantidad": 9,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 48,
        "tipo": "externo-vencido",
        "enviado": "2026-07-01 08:00:07",
        "success": true,
        "cantidad": 7,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 52,
        "tipo": "externo-vencido",
        "enviado": "2026-08-01 08:00:12",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 55,
        "tipo": "externo-vencido",
        "enviado": "2026-09-01 08:00:07",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 58,
        "tipo": "externo-vencido",
        "enviado": "2026-10-01 08:00:06",
        "success": true,
        "cantidad": 11,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 4,
        "numero": 2,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:30",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "vencido",
        "vencimiento": "2026-04-30",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "10": {
    "dataset": {
      "id": 10,
      "titulo": "Pauta Publicitaria",
      "area": "Subsecretaría de Comunicación",
      "area_superior": "Secretaría General de Comunicación y de Relaciones Institucionale",
      "area_id": 40,
      "tipo_gestion": "externa",
      "frecuencia": "Trimestralmente",
      "meses": 3,
      "proxima": "2027-01-31",
      "datos_al": "2026-07-31",
      "ultima": "2026-10-13",
      "tipo_pedido": "acumulado",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/pauta-publicitaria",
      "activo": true,
      "alta": "2025-12-01 09:57:48"
    },
    "altasSinDataset": [],
    "cambios": [
      {
        "id": 13,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-02-18 11:22:01",
        "revisado": "2026-02-19 11:37:39",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Carla Inés Tres",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-02-18",
          "proxima_actualizacion": "2026-07-31",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2025-07-31T03:00:00.000Z",
          "proxima_actualizacion": "2026-01-31T03:00:00.000Z"
        },
        "dataset_id": 10
      },
      {
        "id": 14,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-02-25 09:47:18",
        "revisado": "2026-02-25 09:48:04",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Carla Inés Tres",
        "motivo": null,
        "nuevos": {
          "titulo": "Pauta Publicitaria",
          "descripcion": "Registro oficial de contratos de pauta publicitaria municipal correspondientes a cada año según información difundida en el Boletín Oficial. Incluye montos contratados, características de publicaciones, tipo de medio y empresas adjudicatarias para transparentar el gasto público en comunicación oficial, facilitar el control ciudadano sobre inversión publicitaria municipal y garantizar rendición de cuentas conforme a principios de gobierno abierto establecidos en Ordenanza N° 17.662/23.",
          "area_id": 40,
          "frecuencia_id": 4,
          "ultima_actualizacion": "2026-02-18",
          "proxima_actualizacion": "2026-05-31",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pauta-publicitaria",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "anteriores": {
          "titulo": "Pauta Publicitaria",
          "descripcion": "Registro oficial de contratos de pauta publicitaria municipal correspondientes a cada año según información difundida en el Boletín Oficial. Incluye montos contratados, características de publicaciones, tipo de medio y empresas adjudicatarias para transparentar el gasto público en comunicación oficial, facilitar el control ciudadano sobre inversión publicitaria municipal y garantizar rendición de cuentas conforme a principios de gobierno abierto establecidos en Ordenanza N° 17.662/23.",
          "area_id": 40,
          "frecuencia_id": 5,
          "ultima_actualizacion": "2026-02-18T03:00:00.000Z",
          "proxima_actualizacion": "2026-07-31T03:00:00.000Z",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pauta-publicitaria",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "dataset_id": 10
      },
      {
        "id": 15,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-02-25 09:48:55",
        "revisado": "2026-02-25 11:42:16",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Carla Inés Tres",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-02-25",
          "proxima_actualizacion": "2026-05-31",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2026-02-18T03:00:00.000Z",
          "proxima_actualizacion": "2026-05-31T03:00:00.000Z"
        },
        "dataset_id": 10
      },
      {
        "id": 19,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-03-05 08:45:56",
        "revisado": "2026-03-05 08:56:14",
        "propuso": "Ana María Uno",
        "reviso": "Bruno Pablo Dos",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-03-05",
          "proxima_actualizacion": "2026-05-31",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2026-02-25T03:00:00.000Z",
          "proxima_actualizacion": "2026-05-31T03:00:00.000Z"
        },
        "dataset_id": 10
      },
      {
        "id": 37,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-05-22 12:51:05",
        "revisado": "2026-05-22 12:51:38",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Ana María Uno",
        "motivo": null,
        "nuevos": {
          "titulo": "Pauta Publicitaria",
          "descripcion": "Registro oficial de contratos de pauta publicitaria municipal correspondientes a cada año según información difundida en el Boletín Oficial. Incluye montos contratados, características de publicaciones, tipo de medio y empresas adjudicatarias para transparentar el gasto público en comunicación oficial, facilitar el control ciudadano sobre inversión publicitaria municipal y garantizar rendición de cuentas conforme a principios de gobierno abierto establecidos en Ordenanza N° 17.662/23.",
          "area_id": 40,
          "frecuencia_id": 3,
          "ultima_actualizacion": "2026-05-22",
          "proxima_actualizacion": "2026-07-31",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pauta-publicitaria",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "anteriores": {
          "titulo": "Pauta Publicitaria",
          "descripcion": "Registro oficial de contratos de pauta publicitaria municipal correspondientes a cada año según información difundida en el Boletín Oficial. Incluye montos contratados, características de publicaciones, tipo de medio y empresas adjudicatarias para transparentar el gasto público en comunicación oficial, facilitar el control ciudadano sobre inversión publicitaria municipal y garantizar rendición de cuentas conforme a principios de gobierno abierto establecidos en Ordenanza N° 17.662/23.",
          "area_id": 40,
          "frecuencia_id": 4,
          "ultima_actualizacion": "2026-03-05T03:00:00.000Z",
          "proxima_actualizacion": "2026-05-31T03:00:00.000Z",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/pauta-publicitaria",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "dataset_id": 10
      },
      {
        "id": 45,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-09-25 08:33:30",
        "revisado": "2026-09-28 07:59:24",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Ana María Uno",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-09-25",
          "proxima_actualizacion": "2026-10-31",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2026-05-22T03:00:00.000Z",
          "proxima_actualizacion": "2026-07-31T03:00:00.000Z"
        },
        "dataset_id": 10
      },
      {
        "id": 48,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-10-13 11:01:16",
        "revisado": "2026-10-14 08:36:02",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Carla Inés Tres",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-10-13",
          "proxima_actualizacion": "2027-01-31",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2026-09-25T03:00:00.000Z",
          "proxima_actualizacion": "2026-10-31T03:00:00.000Z"
        },
        "dataset_id": 10
      }
    ],
    "historial": [
      {
        "fecha": "2025-12-17",
        "creado": "2025-12-17 09:02:21",
        "usuario": "Ana María Uno",
        "cambio_id": null
      }
    ],
    "emails": [
      {
        "id": 7,
        "tipo": "externo-40",
        "enviado": "2025-12-22 08:00:06",
        "success": true,
        "cantidad": 22,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 20,
        "tipo": "externo-5",
        "enviado": "2026-01-26 08:00:10",
        "success": true,
        "cantidad": 20,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 24,
        "tipo": "externo-vencido",
        "enviado": "2026-02-01 08:00:06",
        "success": true,
        "cantidad": 24,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 34,
        "tipo": "externo-60",
        "enviado": "2026-04-01 08:00:10",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 36,
        "tipo": "externo-40",
        "enviado": "2026-04-21 08:00:08",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 42,
        "tipo": "externo-40",
        "enviado": "2026-06-21 08:00:04",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 49,
        "tipo": "externo-5",
        "enviado": "2026-07-26 08:00:05",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 52,
        "tipo": "externo-vencido",
        "enviado": "2026-08-01 08:00:12",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 55,
        "tipo": "externo-vencido",
        "enviado": "2026-09-01 08:00:07",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 4,
        "numero": 2,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:30",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "proximo",
        "vencimiento": "2026-10-31",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "11": {
    "dataset": {
      "id": 11,
      "titulo": "Parque Automotor (Patentamiento)",
      "area": "Dirección de Información Tributaria. Dirección General de Análisis y Administración Tributaria",
      "area_superior": "Secretaría de Recaudación",
      "area_id": 38,
      "tipo_gestion": "externa",
      "frecuencia": "Anualmente",
      "meses": 12,
      "proxima": "2024-01-31",
      "datos_al": "2022-12-31",
      "ultima": "2022-12-31",
      "tipo_pedido": "acumulado",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/parque-automotor",
      "activo": true,
      "alta": "2025-12-01 10:01:35"
    },
    "altasSinDataset": [],
    "cambios": [],
    "historial": [],
    "emails": [
      {
        "id": 1,
        "tipo": "externo-vencido",
        "enviado": "2025-12-06 14:21:46",
        "success": true,
        "cantidad": 9,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 6,
        "tipo": "externo-vencido",
        "enviado": "2025-12-10 20:49:30",
        "success": true,
        "cantidad": 9,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 18,
        "tipo": "externo-vencido",
        "enviado": "2026-01-01 08:00:08",
        "success": true,
        "cantidad": 5,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 24,
        "tipo": "externo-vencido",
        "enviado": "2026-02-01 08:00:06",
        "success": true,
        "cantidad": 24,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 29,
        "tipo": "externo-vencido",
        "enviado": "2026-03-01 08:00:14",
        "success": true,
        "cantidad": 20,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 35,
        "tipo": "externo-vencido",
        "enviado": "2026-04-01 08:00:13",
        "success": true,
        "cantidad": 14,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 40,
        "tipo": "externo-vencido",
        "enviado": "2026-05-01 08:00:10",
        "success": true,
        "cantidad": 9,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 48,
        "tipo": "externo-vencido",
        "enviado": "2026-07-01 08:00:07",
        "success": true,
        "cantidad": 7,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 52,
        "tipo": "externo-vencido",
        "enviado": "2026-08-01 08:00:12",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 55,
        "tipo": "externo-vencido",
        "enviado": "2026-09-01 08:00:07",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 58,
        "tipo": "externo-vencido",
        "enviado": "2026-10-01 08:00:06",
        "success": true,
        "cantidad": 11,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 4,
        "numero": 2,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:30",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "vencido",
        "vencimiento": "2024-01-31",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "26": {
    "dataset": {
      "id": 26,
      "titulo": "Infraestructura deportiva al aire libre en Comodoro Rivadavia",
      "area": "Ente Autárquico Comodoro Deportes",
      "area_superior": "Intendencia",
      "area_id": 25,
      "tipo_gestion": "interna",
      "frecuencia": "Cada dos años",
      "meses": 24,
      "proxima": "2025-03-31",
      "datos_al": "2023-03-31",
      "ultima": "2023-03-31",
      "tipo_pedido": "relevamiento",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/infraestructura-deportiva-al-aire-libre-en-comodoro-rivadavia",
      "activo": true,
      "alta": "2025-12-01 11:41:32"
    },
    "altasSinDataset": [],
    "cambios": [],
    "historial": [],
    "emails": [
      {
        "id": 17,
        "tipo": "interno-vencido",
        "enviado": "2026-01-01 08:00:07",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 19,
        "tipo": "interno-vencido",
        "enviado": "2026-01-10 13:44:52",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 23,
        "tipo": "interno-vencido",
        "enviado": "2026-02-01 08:00:05",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 28,
        "tipo": "interno-vencido",
        "enviado": "2026-03-01 08:00:11",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 33,
        "tipo": "interno-vencido",
        "enviado": "2026-04-01 08:00:08",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 38,
        "tipo": "interno-vencido",
        "enviado": "2026-05-01 08:00:05",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 47,
        "tipo": "interno-vencido",
        "enviado": "2026-07-01 08:00:05",
        "success": true,
        "cantidad": 3,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 51,
        "tipo": "interno-vencido",
        "enviado": "2026-08-01 08:00:09",
        "success": true,
        "cantidad": 3,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 54,
        "tipo": "interno-vencido",
        "enviado": "2026-09-01 08:00:05",
        "success": true,
        "cantidad": 3,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 56,
        "tipo": "interno-vencido",
        "enviado": "2026-10-01 08:00:03",
        "success": true,
        "cantidad": 4,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 3,
        "numero": 1,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "interna",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:28",
        "para": "correo2@rpad.test",
        "cc": "correo9@rpad.test",
        "seccion": "vencido",
        "vencimiento": "2025-03-31",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "33": {
    "dataset": {
      "id": 33,
      "titulo": "Listado de Proveedores",
      "area": "Dirección General de Servicios Administrativos",
      "area_superior": "Subsec. de Gestión Presupuestaria. Sec. de Economía, Finanzas y Control de Gestión",
      "area_id": 20,
      "tipo_gestion": "externa",
      "frecuencia": "Anualmente",
      "meses": 12,
      "proxima": "2026-01-31",
      "datos_al": "2025-06-30",
      "ultima": "2025-09-29",
      "tipo_pedido": "foto",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/listado-de-proveedores",
      "activo": true,
      "alta": "2025-12-01 11:54:54"
    },
    "altasSinDataset": [],
    "cambios": [],
    "historial": [],
    "emails": [
      {
        "id": 42,
        "tipo": "externo-40",
        "enviado": "2026-06-21 08:00:04",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 49,
        "tipo": "externo-5",
        "enviado": "2026-07-26 08:00:05",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 52,
        "tipo": "externo-vencido",
        "enviado": "2026-08-01 08:00:12",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 55,
        "tipo": "externo-vencido",
        "enviado": "2026-09-01 08:00:07",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 58,
        "tipo": "externo-vencido",
        "enviado": "2026-10-01 08:00:06",
        "success": true,
        "cantidad": 11,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 4,
        "numero": 2,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:30",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "vencido",
        "vencimiento": "2026-07-31",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "38": {
    "dataset": {
      "id": 38,
      "titulo": "Escala salarial municipal (planta permanente)",
      "area": "Honorable Concejo Deliberante de Comodoro Rivadavia",
      "area_superior": null,
      "area_id": 27,
      "tipo_gestion": "interna",
      "frecuencia": "Cada medio año",
      "meses": 6,
      "proxima": "2027-03-31",
      "datos_al": "2025-05-31",
      "ultima": "2026-10-02",
      "tipo_pedido": "relevamiento",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/escala-salarial-municipal-planta-permanente",
      "activo": true,
      "alta": "2025-12-01 12:16:22"
    },
    "altasSinDataset": [],
    "cambios": [
      {
        "id": 12,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-02-12 11:35:14",
        "revisado": "2026-02-12 11:44:21",
        "propuso": "Ana María Uno",
        "reviso": "Bruno Pablo Dos",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-02-12",
          "proxima_actualizacion": "2026-09-30",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2025-09-27T03:00:00.000Z",
          "proxima_actualizacion": "2026-03-31T03:00:00.000Z"
        },
        "dataset_id": 38
      },
      {
        "id": 46,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-10-02 10:04:06",
        "revisado": "2026-10-02 13:02:02",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Ana María Uno",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-10-02",
          "proxima_actualizacion": "2027-03-29",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2026-02-12T03:00:00.000Z",
          "proxima_actualizacion": "2026-09-30T03:00:00.000Z"
        },
        "dataset_id": 38
      }
    ],
    "historial": [],
    "emails": [
      {
        "id": 21,
        "tipo": "interno-60",
        "enviado": "2026-01-30 08:00:04",
        "success": true,
        "cantidad": 2,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 50,
        "tipo": "interno-60",
        "enviado": "2026-08-01 08:00:07",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 53,
        "tipo": "interno-30",
        "enviado": "2026-08-31 08:00:04",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 56,
        "tipo": "interno-vencido",
        "enviado": "2026-10-01 08:00:03",
        "success": true,
        "cantidad": 4,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [],
    "auditorias": []
  },
  "42": {
    "dataset": {
      "id": 42,
      "titulo": "Establecimientos Educativos de Comodoro Rivadavia",
      "area": "Dirección de Estadística y Evaluación Educativa",
      "area_superior": "Ministerio de Educación del Chubut",
      "area_id": 6,
      "tipo_gestion": "externa",
      "frecuencia": "Anualmente",
      "meses": 12,
      "proxima": "2027-04-30",
      "datos_al": "2026-03-31",
      "ultima": "2024-12-31",
      "tipo_pedido": "foto",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/establecimientos-educativos-de-comodoro-rivadavia",
      "activo": true,
      "alta": "2025-12-01 12:23:40"
    },
    "altasSinDataset": [],
    "cambios": [
      {
        "id": 29,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-04-01 12:19:49",
        "revisado": "2026-04-06 08:16:23",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Ana María Uno",
        "motivo": null,
        "nuevos": {
          "titulo": "Establecimientos Educativos de Comodoro Rivadavia",
          "descripcion": "Padrón oficial de establecimientos educativos de Comodoro Rivadavia conforme al relevamiento del Ministerio de Educación del Chubut. Incluye instituciones de todos los niveles educativos (inicial, primario, secundario, terciario) con información de gestión, dependencia, datos de contacto y ubicación para facilitar el acceso ciudadano a la oferta educativa local y planificación del sistema educativo.",
          "area_id": 6,
          "frecuencia_id": 6,
          "ultima_actualizacion": "2024-12-31",
          "proxima_actualizacion": "2027-04-30",
          "tema_principal_id": 2,
          "tema_secundario_id": 5,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/establecimientos-educativos-de-comodoro-rivadavia",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            6,
            2
          ]
        },
        "anteriores": {
          "titulo": "Establecimientos Educativos de Comodoro Rivadavia",
          "descripcion": "Padrón oficial de establecimientos educativos de Comodoro Rivadavia conforme al relevamiento del Ministerio de Educación del Chubut. Incluye instituciones de todos los niveles educativos (inicial, primario, secundario, terciario) con información de gestión, dependencia, datos de contacto y ubicación para facilitar el acceso ciudadano a la oferta educativa local y planificación del sistema educativo.",
          "area_id": 6,
          "frecuencia_id": 7,
          "ultima_actualizacion": "2024-12-31T03:00:00.000Z",
          "proxima_actualizacion": "2026-03-31T03:00:00.000Z",
          "tema_principal_id": 2,
          "tema_secundario_id": 5,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/establecimientos-educativos-de-comodoro-rivadavia",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2,
            6
          ]
        },
        "dataset_id": 42
      }
    ],
    "historial": [],
    "emails": [
      {
        "id": 22,
        "tipo": "externo-60",
        "enviado": "2026-01-30 08:00:06",
        "success": true,
        "cantidad": 2,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 25,
        "tipo": "externo-40",
        "enviado": "2026-02-19 08:00:04",
        "success": true,
        "cantidad": 2,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 26,
        "tipo": "area-aviso-40",
        "enviado": "2026-02-19 08:00:05",
        "success": true,
        "cantidad": 1,
        "area": "Dirección de Estadística y Evaluación Educativa",
        "area_articulo": "la",
        "destinatarios": "correo6@rpad.test,correo7@rpad.test",
        "error": null
      },
      {
        "id": 32,
        "tipo": "externo-5",
        "enviado": "2026-03-26 08:00:06",
        "success": false,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": "connect ECONNREFUSED 64.233.178.109:587"
      },
      {
        "id": 35,
        "tipo": "externo-vencido",
        "enviado": "2026-04-01 08:00:13",
        "success": true,
        "cantidad": 14,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [],
    "auditorias": []
  },
  "52": {
    "dataset": {
      "id": 52,
      "titulo": "Directores Generales de Planta Permanente",
      "area": "Dirección General de Relaciones Laborales",
      "area_superior": "Subsec. de Recursos Humanos. Sec. Gobierno, Modernización y Transparencia",
      "area_id": 19,
      "tipo_gestion": "externa",
      "frecuencia": "Cada medio año",
      "meses": 6,
      "proxima": "2026-07-31",
      "datos_al": "2025-12-31",
      "ultima": "2026-02-04",
      "tipo_pedido": "foto",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/directores-generales-de-planta-permanente",
      "activo": true,
      "alta": "2025-12-01 21:51:48"
    },
    "altasSinDataset": [],
    "cambios": [
      {
        "id": 5,
        "tipo": "editar",
        "estado": "rechazado",
        "creado": "2026-02-04 08:56:40",
        "revisado": "2026-02-04 09:53:29",
        "propuso": "Ana María Uno",
        "reviso": "Bruno Pablo Dos",
        "motivo": "Prox fecha 31/7/2026",
        "nuevos": {
          "ultima_actualizacion": "2026-02-04",
          "proxima_actualizacion": "2026-08-03",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2025-12-17T03:00:00.000Z",
          "proxima_actualizacion": "2026-01-31T03:00:00.000Z"
        },
        "dataset_id": 52
      },
      {
        "id": 6,
        "tipo": "editar",
        "estado": "rechazado",
        "creado": "2026-02-04 09:53:55",
        "revisado": "2026-02-04 09:57:02",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Ana María Uno",
        "motivo": "Mal la fecha",
        "nuevos": {
          "ultima_actualizacion": "2026-02-04",
          "proxima_actualizacion": "2026-08-03",
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2025-12-17T03:00:00.000Z",
          "proxima_actualizacion": "2026-01-31T03:00:00.000Z"
        },
        "dataset_id": 52
      },
      {
        "id": 7,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-02-04 09:57:46",
        "revisado": "2026-02-04 09:58:15",
        "propuso": "Ana María Uno",
        "reviso": "Bruno Pablo Dos",
        "motivo": null,
        "nuevos": {
          "titulo": "Directores Generales de Planta Permanente",
          "descripcion": "Nómina oficial de Directores Generales de planta permanente del Poder Ejecutivo Municipal de Comodoro Rivadavia al 30 de junio, discriminados entre titulares y subrogantes. Información confeccionada a partir de resoluciones de designación publicadas en Boletín Oficial. Facilita que la ciudadanía identifique a los responsables de cada área municipal para consultas, trámites y gestiones, promoviendo el acceso directo a las autoridades de carrera administrativa.",
          "area_id": 19,
          "frecuencia_id": 5,
          "ultima_actualizacion": "2026-02-04",
          "proxima_actualizacion": "2026-07-31",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/directores-generales-de-planta-permanente",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "anteriores": {
          "titulo": "Directores Generales de Planta Permanente",
          "descripcion": "Nómina oficial de Directores Generales de planta permanente del Poder Ejecutivo Municipal de Comodoro Rivadavia al 30 de junio, discriminados entre titulares y subrogantes. Información confeccionada a partir de resoluciones de designación publicadas en Boletín Oficial. Facilita que la ciudadanía identifique a los responsables de cada área municipal para consultas, trámites y gestiones, promoviendo el acceso directo a las autoridades de carrera administrativa.",
          "area_id": 19,
          "frecuencia_id": 5,
          "ultima_actualizacion": "2025-12-17T03:00:00.000Z",
          "proxima_actualizacion": "2026-01-31T03:00:00.000Z",
          "tema_principal_id": 4,
          "tema_secundario_id": null,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/directores-generales-de-planta-permanente",
          "observaciones": null,
          "tipo_gestion": "externa",
          "formatos": [
            1,
            2
          ]
        },
        "dataset_id": 52
      }
    ],
    "historial": [
      {
        "fecha": "2025-12-17",
        "creado": "2025-12-17 08:54:29",
        "usuario": "Ana María Uno",
        "cambio_id": null
      }
    ],
    "emails": [
      {
        "id": 7,
        "tipo": "externo-40",
        "enviado": "2025-12-22 08:00:06",
        "success": true,
        "cantidad": 22,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 12,
        "tipo": "area-aviso-40",
        "enviado": "2025-12-22 08:00:13",
        "success": true,
        "cantidad": 1,
        "area": "Dirección General de Relaciones Laborales",
        "area_articulo": "la",
        "destinatarios": "correo4@rpad.test",
        "error": null
      },
      {
        "id": 20,
        "tipo": "externo-5",
        "enviado": "2026-01-26 08:00:10",
        "success": true,
        "cantidad": 20,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 24,
        "tipo": "externo-vencido",
        "enviado": "2026-02-01 08:00:06",
        "success": true,
        "cantidad": 24,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 42,
        "tipo": "externo-40",
        "enviado": "2026-06-21 08:00:04",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 45,
        "tipo": "area-aviso-40",
        "enviado": "2026-06-21 08:00:10",
        "success": true,
        "cantidad": 1,
        "area": "Dirección General de Relaciones Laborales",
        "area_articulo": "la",
        "destinatarios": "correo4@rpad.test",
        "error": null
      },
      {
        "id": 49,
        "tipo": "externo-5",
        "enviado": "2026-07-26 08:00:05",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 52,
        "tipo": "externo-vencido",
        "enviado": "2026-08-01 08:00:12",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 55,
        "tipo": "externo-vencido",
        "enviado": "2026-09-01 08:00:07",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 58,
        "tipo": "externo-vencido",
        "enviado": "2026-10-01 08:00:06",
        "success": true,
        "cantidad": 11,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 4,
        "numero": 2,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:30",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "vencido",
        "vencimiento": "2026-07-31",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "61": {
    "dataset": {
      "id": 61,
      "titulo": "Comercios habilitados por rubro",
      "area": "Dirección General de Habilitaciones Comerciales",
      "area_superior": "Subsec. de Fiscalización. Sec. de Control Urbano y Operativo",
      "area_id": 12,
      "tipo_gestion": "externa",
      "frecuencia": "Anualmente",
      "meses": 12,
      "proxima": "2026-01-31",
      "datos_al": "2025-06-30",
      "ultima": "2025-07-31",
      "tipo_pedido": "acumulado",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/comercios-habilitados-por-rubro",
      "activo": true,
      "alta": "2025-12-02 09:39:10"
    },
    "altasSinDataset": [],
    "cambios": [],
    "historial": [
      {
        "fecha": "2025-12-17",
        "creado": "2025-12-17 08:53:06",
        "usuario": "Ana María Uno",
        "cambio_id": null
      }
    ],
    "emails": [
      {
        "id": 7,
        "tipo": "externo-40",
        "enviado": "2025-12-22 08:00:06",
        "success": true,
        "cantidad": 22,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 9,
        "tipo": "area-aviso-40",
        "enviado": "2025-12-22 08:00:09",
        "success": true,
        "cantidad": 1,
        "area": "Dirección General de Habilitaciones Comerciales",
        "area_articulo": "la",
        "destinatarios": "correo10@rpad.test",
        "error": null
      },
      {
        "id": 42,
        "tipo": "externo-40",
        "enviado": "2026-06-21 08:00:04",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 43,
        "tipo": "area-aviso-40",
        "enviado": "2026-06-21 08:00:06",
        "success": true,
        "cantidad": 1,
        "area": "Dirección General de Habilitaciones Comerciales",
        "area_articulo": "la",
        "destinatarios": "correo10@rpad.test",
        "error": null
      },
      {
        "id": 49,
        "tipo": "externo-5",
        "enviado": "2026-07-26 08:00:05",
        "success": true,
        "cantidad": 6,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 52,
        "tipo": "externo-vencido",
        "enviado": "2026-08-01 08:00:12",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 55,
        "tipo": "externo-vencido",
        "enviado": "2026-09-01 08:00:07",
        "success": true,
        "cantidad": 12,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 58,
        "tipo": "externo-vencido",
        "enviado": "2026-10-01 08:00:06",
        "success": true,
        "cantidad": 11,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      }
    ],
    "notas": [
      {
        "id": 4,
        "numero": 2,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-13",
        "estado": "enviada",
        "enviada": "2026-10-13 14:50:30",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "vencido",
        "vencimiento": "2026-07-31",
        "datos_solicitados": null,
        "creado_por": null,
        "firmante": null
      }
    ],
    "auditorias": []
  },
  "66": {
    "dataset": {
      "id": 66,
      "titulo": "Barrios de Comodoro Rivadavia",
      "area": "Dirección General de Modernización e Investigación Territorial",
      "area_superior": "Subsec. de Modernización y Transparencia. Sec. de Gobierno, Modernización y Transparencia",
      "area_id": 14,
      "tipo_gestion": "interna",
      "frecuencia": "Eventual",
      "meses": null,
      "proxima": null,
      "datos_al": "2026-06-30",
      "ultima": "2026-06-03",
      "tipo_pedido": "eventual",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/barrios-de-comodoro-rivadavia",
      "activo": true,
      "alta": "2025-12-02 09:47:16"
    },
    "altasSinDataset": [],
    "cambios": [
      {
        "id": 20,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-03-06 11:18:08",
        "revisado": "2026-03-06 17:28:01",
        "propuso": "Ana María Uno",
        "reviso": "Bruno Pablo Dos",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-03-06",
          "proxima_actualizacion": null,
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2025-09-25T03:00:00.000Z",
          "proxima_actualizacion": null
        },
        "dataset_id": 66
      },
      {
        "id": 42,
        "tipo": "editar",
        "estado": "aprobado",
        "creado": "2026-06-03 10:23:17",
        "revisado": "2026-06-03 12:06:53",
        "propuso": "Ana María Uno",
        "reviso": "Bruno Pablo Dos",
        "motivo": null,
        "nuevos": {
          "ultima_actualizacion": "2026-06-03",
          "proxima_actualizacion": null,
          "notas": null
        },
        "anteriores": {
          "ultima_actualizacion": "2026-03-06T03:00:00.000Z",
          "proxima_actualizacion": null
        },
        "dataset_id": 66
      }
    ],
    "historial": [],
    "emails": [
      {
        "id": 2,
        "tipo": "externo-40",
        "enviado": "2025-12-07 00:38:10",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 3,
        "tipo": "area-aviso-40",
        "enviado": "2025-12-07 00:38:12",
        "success": true,
        "cantidad": 1,
        "area": "Dirección de Datos Públicos y Comunicación",
        "area_articulo": "la",
        "destinatarios": "correo1@rpad.test,correo8@rpad.test",
        "error": null
      },
      {
        "id": 4,
        "tipo": "externo-40",
        "enviado": "2025-12-07 08:00:04",
        "success": true,
        "cantidad": 1,
        "area": null,
        "area_articulo": null,
        "destinatarios": "correo1@rpad.test,correo2@rpad.test,correo3@rpad.test",
        "error": null
      },
      {
        "id": 5,
        "tipo": "area-aviso-40",
        "enviado": "2025-12-07 08:00:06",
        "success": true,
        "cantidad": 1,
        "area": "Dirección de Datos Públicos y Comunicación",
        "area_articulo": "la",
        "destinatarios": "correo1@rpad.test,correo8@rpad.test",
        "error": null
      }
    ],
    "notas": [],
    "auditorias": []
  },
  "81": {
    "dataset": {
      "id": 81,
      "titulo": "Cantidad de empleados municipales (planta permanente y transitoria)",
      "area": "Dirección General de Sueldos",
      "area_superior": null,
      "area_id": 46,
      "tipo_gestion": "externa",
      "frecuencia": "Cada medio año",
      "meses": 6,
      "proxima": "2026-10-31",
      "datos_al": "2026-09-30",
      "ultima": "2026-10-19",
      "tipo_pedido": "foto",
      "url_dataset": "https://datos.comodoro.gov.ar/dataset/cantidad-de-empleados-municipales-planta-permanente-y-transitoria",
      "activo": true,
      "alta": "2026-10-19 10:29:17"
    },
    "altasSinDataset": [
      {
        "id": 50,
        "tipo": "crear",
        "estado": "aprobado",
        "creado": "2026-10-19 09:20:39",
        "revisado": "2026-10-19 10:29:17",
        "propuso": "Bruno Pablo Dos",
        "reviso": "Carla Inés Tres",
        "motivo": null,
        "nuevos": {
          "titulo": "Cantidad de empleados municipales (planta permanente y transitoria)",
          "descripcion": "Cantidad de agentes de la Municipalidad de Comodoro Rivadavia en planta permanente y transitoria, por jurisdicción (Poder Ejecutivo, Concejo Deliberante, Tribunal de Cuentas, Ente Comodoro Conocimiento y Ente Comodoro Deportes), con datos de abril y septiembre de cada año desde 2020. No incluye otras modalidades, como contratados, órdenes de compra o personal político. Datos extraídos del boletín oficial.",
          "area_id": 46,
          "frecuencia_id": 5,
          "ultima_actualizacion": "2026-10-19",
          "datos_al": "2026-09-30",
          "proxima_actualizacion": "2026-10-31",
          "tema_principal_id": 4,
          "tema_secundario_id": 1,
          "url_dataset": "https://datos.comodoro.gov.ar/dataset/cantidad-de-empleados-municipales-planta-permanente-y-transitoria",
          "observaciones": null,
          "que_se_solicita": "Cantidad de empleados de planta permanente y planta transitoria en la fecha del corte.",
          "tipo_pedido": "foto",
          "tipo_gestion": "externa",
          "formatos": [
            2,
            1
          ]
        },
        "anteriores": null,
        "dataset_id": null
      }
    ],
    "cambios": [],
    "historial": [],
    "emails": [],
    "notas": [
      {
        "id": 7,
        "numero": 3,
        "anio": 2026,
        "tipo": "aviso",
        "gestion": "externa",
        "fecha": "2026-10-20",
        "estado": "enviada",
        "enviada": "2026-10-20 08:15:09",
        "para": "correo2@rpad.test",
        "cc": "correo3@rpad.test",
        "seccion": "proximo",
        "vencimiento": "2026-10-31",
        "datos_solicitados": "Vigente al 30/09/2026",
        "creado_por": null,
        "firmante": "Bruno Pablo Dos"
      }
    ],
    "auditorias": []
  }
};

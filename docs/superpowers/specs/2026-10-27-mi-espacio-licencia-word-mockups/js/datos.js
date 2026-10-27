// Respuestas de la API real de la rama, sobre una copia con datos inventados (capturadas el 27/10/2026)
window.MAQUETA_DATOS = {
 "fijos": {
  "GET /auth/verify": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "user": {
      "id": 4,
      "username": "prueba_lucia",
      "nombre_completo": "Lucía Fernández",
      "email": "lucia@ejemplo.test",
      "rol": "admin",
      "cargo": "Jefa de División Datos Abiertos",
      "vinculo": "planta_permanente"
     }
    }
   }
  },
  "GET /cambios-pendientes/contador": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "cantidad": 0
    }
   }
  },
  "GET /mi-espacio/resumen": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": {
      "clave": "planta",
      "texto": "Planta permanente"
     },
     "anio": 2026,
     "al_texto": "Al martes 27/10/2026",
     "mensaje": null,
     "abrir_saldos": false,
     "persona": {
      "nombre": "Lucía Fernández",
      "ve_companeros": true,
      "audita": true,
      "es_superadmin": false
     },
     "marca": false,
     "vence_pronto": [],
     "faltantes": [],
     "tanques": {
      "vacaciones": {
       "numero": 26,
       "unidad": "días",
       "pie": "de 2 licencias",
       "capacidad": 45,
       "aria": "Vacaciones: 26 días hábiles disponibles. Ver tus licencias",
       "capas": [
        {
         "clase": "tinta",
         "n": 16,
         "nombre": "Licencia 2025",
         "nota": "Vence el 31/12/2027"
        },
        {
         "clase": "medio",
         "n": 10,
         "nombre": "Licencia 2026",
         "nota": "La primera mitad"
        },
        {
         "clase": "cargadas",
         "n": 9,
         "nombre": "Cargados",
         "nota": "Cargados para noviembre"
        },
        {
         "clase": "por_habilitar",
         "n": 10,
         "nombre": "Todavía no",
         "nota": "Se habilitan el 1/1/2027"
        }
       ]
      },
      "otros": [
       {
        "clave": "franquicia",
        "nombre": "Franquicias",
        "numero": "19",
        "unidad": "horas",
        "de": "de 42 horas",
        "valor": 19,
        "total": 42,
        "vence": false,
        "pestana": "licencias",
        "aria": "Franquicias: quedan 19 de 42 horas. Ver tus licencias"
       },
       {
        "clave": "estudios",
        "nombre": "Estudios",
        "numero": "8",
        "unidad": "días",
        "de": "de 15 días",
        "valor": 8,
        "total": 15,
        "vence": false,
        "pestana": "licencias",
        "aria": "Estudios: quedan 8 de 15 días. Ver tus licencias"
       },
       {
        "clave": "medica",
        "nombre": "Atención médica",
        "numero": "25",
        "unidad": "días",
        "de": "de 25 días",
        "valor": 25,
        "total": 25,
        "vence": false,
        "pestana": "licencias",
        "aria": "Atención médica: quedan 25 de 25 días. Ver tus licencias"
       },
       {
        "clave": "familiar",
        "nombre": "Grupo familiar",
        "numero": "25",
        "unidad": "días",
        "de": "de 25 días",
        "valor": 25,
        "total": 25,
        "vence": false,
        "pestana": "licencias",
        "aria": "Grupo familiar: quedan 25 de 25 días. Ver tus licencias"
       }
      ]
     },
     "pastillas": {
      "titulo": "Francos compensatorios",
      "meses": [
       {
        "numero": "1",
        "mes": "Diciembre",
        "nota": "Octubre sigue sumando",
        "estado": "pendiente"
       }
      ],
      "previo": null
     },
     "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.",
     "tipos": [
      {
       "tipo": "vacaciones",
       "nombre": "Vacaciones",
       "queda_texto": "26 disponibles"
      },
      {
       "tipo": "franquicia",
       "nombre": "Franquicia",
       "queda_texto": "Quedan 19 h de 42"
      },
      {
       "tipo": "estudios",
       "nombre": "Estudios",
       "queda_texto": "Quedan 8 de 15"
      },
      {
       "tipo": "medica",
       "nombre": "Atención médica",
       "queda_texto": "Quedan 25 de 25"
      },
      {
       "tipo": "familiar",
       "nombre": "Grupo familiar",
       "queda_texto": "Quedan 25 de 25"
      },
      {
       "tipo": "medica_extraordinaria",
       "nombre": "Médica extraordinaria",
       "queda_texto": "Sin tope"
      },
      {
       "tipo": "franco",
       "nombre": "Franco compensatorio",
       "queda_texto": "1 para diciembre"
      }
     ],
     "hoy_y_manana": {
      "ausentes_hoy": [],
      "ausentes_manana": [],
      "proximo_feriado": {
       "fecha": "2026-11-02",
       "cuando": "Lunes 02/11",
       "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
      },
      "eventos": []
     }
    }
   }
  },
  "GET /mi-espacio/licencias": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "anio": 2026,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "filtros": [
      {
       "tipo": "todas",
       "nombre": "Todas",
       "cantidad": 4
      },
      {
       "tipo": "vacaciones",
       "nombre": "Vacaciones",
       "cantidad": 1
      },
      {
       "tipo": "franquicia",
       "nombre": "Franquicias",
       "cantidad": 1
      },
      {
       "tipo": "estudios",
       "nombre": "Estudios",
       "cantidad": 1
      },
      {
       "tipo": "medica",
       "nombre": "Atención médica",
       "cantidad": 1
      }
     ],
     "licencias": [
      {
       "id": 4,
       "tipo": "estudios",
       "tipo_nombre": "Estudios",
       "desde": "2026-12-02",
       "hasta": "2026-12-03",
       "horas": null,
       "fechas_texto": "02/12 al 03/12/2026",
       "cantidad_texto": "2 días hábiles",
       "proxima": true,
       "de_licencias_texto": "",
       "antes_del_arranque": false,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "",
       "nota": "Final de Estadística",
       "mostrar": true,
       "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
       "configuracion": {
        "texto": "También en Configuración → Licencias.",
        "insignia": "creada"
       },
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": {
        "licencia_id": 5,
        "autorizado_id": null
       }
      },
      {
       "id": 3,
       "tipo": "vacaciones",
       "tipo_nombre": "Vacaciones",
       "desde": "2026-11-16",
       "hasta": "2026-11-27",
       "horas": null,
       "fechas_texto": "16/11 al 27/11/2026",
       "cantidad_texto": "12 días corridos, 9 hábiles",
       "proxima": true,
       "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
       "antes_del_arranque": false,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "",
       "nota": null,
       "mostrar": true,
       "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
       "configuracion": {
        "texto": "También en Configuración → Licencias.",
        "insignia": "creada"
       },
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": {
        "licencia_id": 4,
        "autorizado_id": null
       }
      },
      {
       "id": 2,
       "tipo": "franquicia",
       "tipo_nombre": "Franquicia",
       "desde": "2026-11-04",
       "hasta": "2026-11-04",
       "horas": 3,
       "fechas_texto": "Mié 04/11/2026",
       "cantidad_texto": "3 horas",
       "proxima": true,
       "de_licencias_texto": "",
       "antes_del_arranque": false,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "",
       "nota": "Trámite del DNI",
       "mostrar": true,
       "mostrar_texto": "",
       "configuracion": {
        "texto": "No es el día entero: no pasa a Configuración",
        "insignia": "aviso"
       },
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": null
      },
      {
       "id": 1,
       "tipo": "medica",
       "tipo_nombre": "Atención médica",
       "desde": "2026-10-14",
       "hasta": "2026-10-15",
       "horas": null,
       "fechas_texto": "14/10 al 15/10/2026",
       "cantidad_texto": "2 días hábiles",
       "proxima": false,
       "de_licencias_texto": "",
       "antes_del_arranque": true,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
       "nota": null,
       "mostrar": true,
       "mostrar_texto": "",
       "configuracion": null,
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": null
      }
     ],
     "saldo_inicial": {
      "fecha": "2026-10-27",
      "titulo": "Saldo inicial 2026",
      "cargado_texto": "Cargado el 27/10/2026",
      "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
     }
    }
   }
  },
  "GET /mi-espacio/licencias?anio=2024": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "anio": 2024,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "filtros": [
      {
       "tipo": "todas",
       "nombre": "Todas",
       "cantidad": 0
      }
     ],
     "licencias": [],
     "saldo_inicial": null
    }
   }
  },
  "GET /mi-espacio/licencias?anio=2025": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "anio": 2025,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "filtros": [
      {
       "tipo": "todas",
       "nombre": "Todas",
       "cantidad": 0
      }
     ],
     "licencias": [],
     "saldo_inicial": null
    }
   }
  },
  "GET /mi-espacio/licencias?anio=2026": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "anio": 2026,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "filtros": [
      {
       "tipo": "todas",
       "nombre": "Todas",
       "cantidad": 4
      },
      {
       "tipo": "vacaciones",
       "nombre": "Vacaciones",
       "cantidad": 1
      },
      {
       "tipo": "franquicia",
       "nombre": "Franquicias",
       "cantidad": 1
      },
      {
       "tipo": "estudios",
       "nombre": "Estudios",
       "cantidad": 1
      },
      {
       "tipo": "medica",
       "nombre": "Atención médica",
       "cantidad": 1
      }
     ],
     "licencias": [
      {
       "id": 4,
       "tipo": "estudios",
       "tipo_nombre": "Estudios",
       "desde": "2026-12-02",
       "hasta": "2026-12-03",
       "horas": null,
       "fechas_texto": "02/12 al 03/12/2026",
       "cantidad_texto": "2 días hábiles",
       "proxima": true,
       "de_licencias_texto": "",
       "antes_del_arranque": false,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "",
       "nota": "Final de Estadística",
       "mostrar": true,
       "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
       "configuracion": {
        "texto": "También en Configuración → Licencias.",
        "insignia": "creada"
       },
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": {
        "licencia_id": 5,
        "autorizado_id": null
       }
      },
      {
       "id": 3,
       "tipo": "vacaciones",
       "tipo_nombre": "Vacaciones",
       "desde": "2026-11-16",
       "hasta": "2026-11-27",
       "horas": null,
       "fechas_texto": "16/11 al 27/11/2026",
       "cantidad_texto": "12 días corridos, 9 hábiles",
       "proxima": true,
       "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
       "antes_del_arranque": false,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "",
       "nota": null,
       "mostrar": true,
       "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
       "configuracion": {
        "texto": "También en Configuración → Licencias.",
        "insignia": "creada"
       },
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": {
        "licencia_id": 4,
        "autorizado_id": null
       }
      },
      {
       "id": 2,
       "tipo": "franquicia",
       "tipo_nombre": "Franquicia",
       "desde": "2026-11-04",
       "hasta": "2026-11-04",
       "horas": 3,
       "fechas_texto": "Mié 04/11/2026",
       "cantidad_texto": "3 horas",
       "proxima": true,
       "de_licencias_texto": "",
       "antes_del_arranque": false,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "",
       "nota": "Trámite del DNI",
       "mostrar": true,
       "mostrar_texto": "",
       "configuracion": {
        "texto": "No es el día entero: no pasa a Configuración",
        "insignia": "aviso"
       },
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": null
      },
      {
       "id": 1,
       "tipo": "medica",
       "tipo_nombre": "Atención médica",
       "desde": "2026-10-14",
       "hasta": "2026-10-15",
       "horas": null,
       "fechas_texto": "14/10 al 15/10/2026",
       "cantidad_texto": "2 días hábiles",
       "proxima": false,
       "de_licencias_texto": "",
       "antes_del_arranque": true,
       "fuera_de_la_modalidad": false,
       "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
       "nota": null,
       "mostrar": true,
       "mostrar_texto": "",
       "configuracion": null,
       "puede_borrar": true,
       "solo_hasta": false,
       "fechas_fijas": false,
       "en_configuracion": null
      }
     ],
     "saldo_inicial": {
      "fecha": "2026-10-27",
      "titulo": "Saldo inicial 2026",
      "cargado_texto": "Cargado el 27/10/2026",
      "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
     }
    }
   }
  },
  "GET /mi-espacio/licencias?anio=2027": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "anio": 2027,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "filtros": [
      {
       "tipo": "todas",
       "nombre": "Todas",
       "cantidad": 0
      }
     ],
     "licencias": [],
     "saldo_inicial": null
    }
   }
  },
  "GET /mi-espacio/horas-extras": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "planta",
     "anio": 2026,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "meses": [
      {
       "mes": "2026-10",
       "mes_texto": "Octubre 2026",
       "horas_texto": "7,5 h",
       "dias_texto": "2 días",
       "francos": 1,
       "uso_texto": "Diciembre 2026",
       "estado": "sumando",
       "situacion": "El mes sigue sumando"
      }
     ],
     "dias_por_mes": {
      "2026-10": [
       {
        "id": 3,
        "fecha": "2026-10-20",
        "fecha_texto": "Mar 20/10",
        "desde": "14:00",
        "hasta": "17:30",
        "horario": "14:00 a 17:30",
        "horas_texto": "3,5 horas",
        "nota": null
       },
       {
        "id": 2,
        "fecha": "2026-10-06",
        "fecha_texto": "Mar 06/10",
        "desde": "14:00",
        "hasta": "18:00",
        "horario": "14:00 a 18:00",
        "horas_texto": "4 horas",
        "nota": null
       }
      ]
     },
     "totales_por_mes": {
      "2026-10": "7,5 horas"
     },
     "mes_en_curso": "2026-10",
     "uso_autorizado": {
      "puede": false,
      "texto": "En 2026 no tenés francos no utilizados previamente."
     }
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2024": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "planta",
     "anio": 2024,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "meses": [],
     "dias_por_mes": {},
     "totales_por_mes": {},
     "mes_en_curso": null,
     "uso_autorizado": {
      "puede": false,
      "texto": "En 2024 no tenés francos no utilizados previamente."
     }
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2025": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "planta",
     "anio": 2025,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "meses": [],
     "dias_por_mes": {},
     "totales_por_mes": {},
     "mes_en_curso": null,
     "uso_autorizado": {
      "puede": false,
      "texto": "En 2025 no tenés francos no utilizados previamente."
     }
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2026": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "planta",
     "anio": 2026,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "meses": [
      {
       "mes": "2026-10",
       "mes_texto": "Octubre 2026",
       "horas_texto": "7,5 h",
       "dias_texto": "2 días",
       "francos": 1,
       "uso_texto": "Diciembre 2026",
       "estado": "sumando",
       "situacion": "El mes sigue sumando"
      }
     ],
     "dias_por_mes": {
      "2026-10": [
       {
        "id": 3,
        "fecha": "2026-10-20",
        "fecha_texto": "Mar 20/10",
        "desde": "14:00",
        "hasta": "17:30",
        "horario": "14:00 a 17:30",
        "horas_texto": "3,5 horas",
        "nota": null
       },
       {
        "id": 2,
        "fecha": "2026-10-06",
        "fecha_texto": "Mar 06/10",
        "desde": "14:00",
        "hasta": "18:00",
        "horario": "14:00 a 18:00",
        "horas_texto": "4 horas",
        "nota": null
       }
      ]
     },
     "totales_por_mes": {
      "2026-10": "7,5 horas"
     },
     "mes_en_curso": "2026-10",
     "uso_autorizado": {
      "puede": false,
      "texto": "En 2026 no tenés francos no utilizados previamente."
     }
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2027": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "planta",
     "anio": 2027,
     "anios": [
      2024,
      2025,
      2026,
      2027
     ],
     "meses": [],
     "dias_por_mes": {},
     "totales_por_mes": {},
     "mes_en_curso": null,
     "uso_autorizado": {
      "puede": false,
      "texto": "En 2027 no tenés francos no utilizados previamente."
     }
    }
   }
  },
  "GET /mi-espacio/anio/2026": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "anio": 2026,
     "dias_vacaciones": 20,
     "estudios": "universitario",
     "heredado": false,
     "texto_mitades": "Se habilitan en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.",
     "textos_mitades": {
      "10": "Se habilitan en dos mitades: 5 el 1/7/2026 y 5 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.",
      "15": "Se habilitan en dos mitades: 8 el 1/7/2026 y 7 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.",
      "20": "Se habilitan en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.",
      "25": "Se habilitan en dos mitades: 13 el 1/7/2026 y 12 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.",
      "30": "Se habilitan en dos mitades: 15 el 1/7/2026 y 15 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después."
     }
    }
   }
  },
  "GET /mi-espacio/saldo-inicial": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "arranque": "2026-10-27",
     "modalidad": "planta",
     "campos": [
      {
       "clave": "vacaciones-2024",
       "concepto": "vacaciones",
       "anio": 2024,
       "rotulo": "Sin usar de la licencia 2024",
       "maximo": 30,
       "paso": 1,
       "valor": 5
      },
      {
       "clave": "vacaciones-2025",
       "concepto": "vacaciones",
       "anio": 2025,
       "rotulo": "De la 2025",
       "maximo": 30,
       "paso": 1,
       "valor": 20
      },
      {
       "clave": "vacaciones-2026",
       "concepto": "vacaciones",
       "anio": 2026,
       "rotulo": "De la 2026",
       "maximo": 10,
       "paso": 1,
       "valor": 10
      },
      {
       "clave": "franquicias",
       "concepto": "franquicias",
       "anio": 2026,
       "rotulo": "Horas de franquicia",
       "maximo": 42,
       "paso": 1,
       "valor": 20
      },
      {
       "clave": "estudios",
       "concepto": "estudios",
       "anio": 2026,
       "rotulo": "Días de estudios",
       "maximo": 15,
       "paso": 1,
       "valor": 5
      },
      {
       "clave": "medica",
       "concepto": "medica",
       "anio": 2026,
       "rotulo": "Días de atención médica",
       "maximo": 25,
       "paso": 1,
       "valor": 0
      },
      {
       "clave": "familiar",
       "concepto": "familiar",
       "anio": 2026,
       "rotulo": "Días de grupo familiar",
       "maximo": 25,
       "paso": 1,
       "valor": 0
      }
     ]
    }
   }
  },
  "GET /mi-espacio/firmante": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "soy_titular": false
    }
   }
  },
  "GET /mi-espacio/ausentes": {
   "status": 400,
   "json": {
    "success": false,
    "error": "Elegí una fecha válida.",
    "campo": "fechas"
   }
  },
  "GET /mi-espacio/personas": {
   "status": 200,
   "json": {
    "success": true,
    "data": [
     {
      "id": 1,
      "nombre": "Martín Aguirre",
      "iniciales": "MA"
     },
     {
      "id": 2,
      "nombre": "Paula Benítez",
      "iniciales": "PB"
     }
    ]
   }
  },
  "GET /mi-espacio/eventos?desde=2026-09-28&hasta=2026-11-08": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "desde": "2026-09-28",
     "hasta": "2026-11-08",
     "hoy": "2026-10-27",
     "puede_compartir": true,
     "eventos": [],
     "licencias": [
      {
       "id": 1,
       "tipo": "medica",
       "desde": "2026-10-14",
       "hasta": "2026-10-15",
       "texto": "Atención médica",
       "hasta_texto": "Hasta el jueves 15/10",
       "dias": [
        "2026-10-14",
        "2026-10-15"
       ]
      },
      {
       "id": 2,
       "tipo": "franquicia",
       "desde": "2026-11-04",
       "hasta": "2026-11-04",
       "texto": "Franquicia, 3 h",
       "hasta_texto": "",
       "dias": [
        "2026-11-04"
       ]
      }
     ],
     "feriados": [
      {
       "fecha": "2026-10-12",
       "nombre": "Día del Respeto a la Diversidad Cultural",
       "texto": "Feriado: Día del Respeto a la Diversidad Cultural"
      },
      {
       "fecha": "2026-11-02",
       "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches",
       "texto": "Feriado: Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
      },
      {
       "fecha": "2026-11-08",
       "nombre": "Día del Empleado Municipal",
       "texto": "Feriado: Día del Empleado Municipal"
      }
     ],
     "ausentes": []
    }
   }
  },
  "GET /mi-espacio/eventos?desde=2026-10-27&hasta=2026-11-26": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "desde": "2026-10-27",
     "hasta": "2026-11-26",
     "hoy": "2026-10-27",
     "puede_compartir": true,
     "eventos": [],
     "licencias": [
      {
       "id": 2,
       "tipo": "franquicia",
       "desde": "2026-11-04",
       "hasta": "2026-11-04",
       "texto": "Franquicia, 3 h",
       "hasta_texto": "",
       "dias": [
        "2026-11-04"
       ]
      },
      {
       "id": 3,
       "tipo": "vacaciones",
       "desde": "2026-11-16",
       "hasta": "2026-11-27",
       "texto": "Vacaciones",
       "hasta_texto": "Hasta el viernes 27/11",
       "dias": [
        "2026-11-16",
        "2026-11-17",
        "2026-11-18",
        "2026-11-19",
        "2026-11-20",
        "2026-11-24",
        "2026-11-25",
        "2026-11-26"
       ]
      }
     ],
     "feriados": [
      {
       "fecha": "2026-11-02",
       "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches",
       "texto": "Feriado: Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
      },
      {
       "fecha": "2026-11-08",
       "nombre": "Día del Empleado Municipal",
       "texto": "Feriado: Día del Empleado Municipal"
      },
      {
       "fecha": "2026-11-09",
       "nombre": "Visita de Su Santidad el Papa León XIV",
       "texto": "Feriado: Visita de Su Santidad el Papa León XIV"
      },
      {
       "fecha": "2026-11-23",
       "nombre": "Día de la Soberanía Nacional",
       "texto": "Feriado: Día de la Soberanía Nacional"
      }
     ],
     "ausentes": []
    }
   }
  }
 },
 "calculos": {
  "estudios|2026-12-02|2026-12-03||4": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 2,
     "texto_dias": "2 días hábiles",
     "texto_reparto": "",
     "queda_texto": "Te quedan 8 de 15.",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "vacaciones|2026-11-16|2026-11-27||3": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 9,
     "texto_dias": "9 días hábiles de 12 corridos",
     "texto_reparto": "Salen de las licencias 2024 (5 días) y 2025 (4 días), las más viejas. Te quedan 26 días: 16 de la 2025 y 10 de la 2026.",
     "queda_texto": "",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "franquicia|2026-11-04|2026-11-04|3|2": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 1,
     "texto_dias": "3 horas",
     "texto_reparto": "",
     "queda_texto": "Te quedan 19 de 42 horas de franquicia.",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": false,
     "avisos": [],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "medica|2026-10-14|2026-10-15||1": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 2,
     "texto_dias": "2 días hábiles",
     "texto_reparto": "",
     "queda_texto": "",
     "antes_del_arranque": true,
     "texto_antes_del_arranque": "Es anterior al saldo inicial: queda como historia y no descuenta."
    },
    "paso": {
     "pasa": false,
     "avisos": [],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "vacaciones|2026-12-09|2026-12-11||": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 3,
     "texto_dias": "3 días hábiles",
     "texto_reparto": "Salen de la licencia 2025, la más vieja. Te quedan 23 días: 13 de la 2025 y 10 de la 2026.",
     "queda_texto": "",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "franquicia|2026-11-10|2026-11-10|2|": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 1,
     "texto_dias": "2 horas",
     "texto_reparto": "",
     "queda_texto": "Te quedan 17 de 42 horas de franquicia.",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": false,
     "avisos": [],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "estudios|2026-12-15|2026-12-16||": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 2,
     "texto_dias": "2 días hábiles",
     "texto_reparto": "",
     "queda_texto": "Te quedan 6 de 15.",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "medica|2026-11-05|2026-11-06||": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 2,
     "texto_dias": "2 días hábiles",
     "texto_reparto": "",
     "queda_texto": "Te quedan 23 de 25.",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "familiar|2026-11-12|2026-11-12||": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 1,
     "texto_dias": "1 día hábil",
     "texto_reparto": "",
     "queda_texto": "Te quedan 24 de 25.",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "medica_extraordinaria|2026-12-28|2026-12-30||": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 3,
     "texto_dias": "3 días hábiles",
     "texto_reparto": "",
     "queda_texto": "",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  },
  "franco|2026-12-14|2026-12-14||": {
   "success": true,
   "data": {
    "error": null,
    "vista": {
     "dias_habiles": 1,
     "texto_dias": "1 día hábil",
     "texto_reparto": "",
     "queda_texto": "Usás el franco de diciembre, por las horas extras de octubre. Es el día entero.",
     "antes_del_arranque": false,
     "texto_antes_del_arranque": ""
    },
    "paso": {
     "pasa": true,
     "avisos": [
      "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
     ],
     "firmante": null,
     "sin_pasar_previsto": null
    }
   }
  }
 },
 "escenarios": {
  "vacaciones": {
   "cuerpo": {
    "tipo": "vacaciones",
    "desde": "2026-12-09",
    "hasta": "2026-12-11",
    "mostrar": true,
    "nota": ""
   },
   "alta": {
    "status": 201,
    "json": {
     "success": true,
     "data": {
      "id": 6
     },
     "message": "Licencia cargada."
    }
   },
   "despues": {
    "GET /mi-espacio/resumen": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": {
        "clave": "planta",
        "texto": "Planta permanente"
       },
       "anio": 2026,
       "al_texto": "Al martes 27/10/2026",
       "mensaje": null,
       "abrir_saldos": false,
       "persona": {
        "nombre": "Lucía Fernández",
        "ve_companeros": true,
        "audita": true,
        "es_superadmin": false
       },
       "marca": false,
       "vence_pronto": [],
       "faltantes": [],
       "tanques": {
        "vacaciones": {
         "numero": 23,
         "unidad": "días",
         "pie": "de 2 licencias",
         "capacidad": 45,
         "aria": "Vacaciones: 23 días hábiles disponibles. Ver tus licencias",
         "capas": [
          {
           "clase": "tinta",
           "n": 13,
           "nombre": "Licencia 2025",
           "nota": "Vence el 31/12/2027"
          },
          {
           "clase": "medio",
           "n": 10,
           "nombre": "Licencia 2026",
           "nota": "La primera mitad"
          },
          {
           "clase": "cargadas",
           "n": 12,
           "nombre": "Cargados",
           "nota": "Cargados para noviembre y diciembre"
          },
          {
           "clase": "por_habilitar",
           "n": 10,
           "nombre": "Todavía no",
           "nota": "Se habilitan el 1/1/2027"
          }
         ]
        },
        "otros": [
         {
          "clave": "franquicia",
          "nombre": "Franquicias",
          "numero": "19",
          "unidad": "horas",
          "de": "de 42 horas",
          "valor": 19,
          "total": 42,
          "vence": false,
          "pestana": "licencias",
          "aria": "Franquicias: quedan 19 de 42 horas. Ver tus licencias"
         },
         {
          "clave": "estudios",
          "nombre": "Estudios",
          "numero": "8",
          "unidad": "días",
          "de": "de 15 días",
          "valor": 8,
          "total": 15,
          "vence": false,
          "pestana": "licencias",
          "aria": "Estudios: quedan 8 de 15 días. Ver tus licencias"
         },
         {
          "clave": "medica",
          "nombre": "Atención médica",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Atención médica: quedan 25 de 25 días. Ver tus licencias"
         },
         {
          "clave": "familiar",
          "nombre": "Grupo familiar",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Grupo familiar: quedan 25 de 25 días. Ver tus licencias"
         }
        ]
       },
       "pastillas": {
        "titulo": "Francos compensatorios",
        "meses": [
         {
          "numero": "1",
          "mes": "Diciembre",
          "nota": "Octubre sigue sumando",
          "estado": "pendiente"
         }
        ],
        "previo": null
       },
       "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.",
       "tipos": [
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "queda_texto": "23 disponibles"
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicia",
         "queda_texto": "Quedan 19 h de 42"
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "queda_texto": "Quedan 8 de 15"
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "queda_texto": "Sin tope"
        },
        {
         "tipo": "franco",
         "nombre": "Franco compensatorio",
         "queda_texto": "1 para diciembre"
        }
       ],
       "hoy_y_manana": {
        "ausentes_hoy": [],
        "ausentes_manana": [],
        "proximo_feriado": {
         "fecha": "2026-11-02",
         "cuando": "Lunes 02/11",
         "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
        },
        "eventos": []
       }
      }
     }
    },
    "GET /mi-espacio/licencias": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 2
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 6,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-12-09",
         "hasta": "2026-12-11",
         "horas": null,
         "fechas_texto": "09/12 al 11/12/2026",
         "cantidad_texto": "3 días hábiles",
         "proxima": true,
         "de_licencias_texto": "De la licencia 2025.",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 7,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/licencias?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 2
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 6,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-12-09",
         "hasta": "2026-12-11",
         "horas": null,
         "fechas_texto": "09/12 al 11/12/2026",
         "cantidad_texto": "3 días hábiles",
         "proxima": true,
         "de_licencias_texto": "De la licencia 2025.",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 7,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    }
   },
   "id": 6
  },
  "franquicia": {
   "cuerpo": {
    "tipo": "franquicia",
    "desde": "2026-11-10",
    "hasta": "2026-11-10",
    "horas": 2,
    "mostrar": true,
    "nota": ""
   },
   "alta": {
    "status": 201,
    "json": {
     "success": true,
     "data": {
      "id": 7
     },
     "message": "Licencia cargada."
    }
   },
   "despues": {
    "GET /mi-espacio/resumen": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": {
        "clave": "planta",
        "texto": "Planta permanente"
       },
       "anio": 2026,
       "al_texto": "Al martes 27/10/2026",
       "mensaje": null,
       "abrir_saldos": false,
       "persona": {
        "nombre": "Lucía Fernández",
        "ve_companeros": true,
        "audita": true,
        "es_superadmin": false
       },
       "marca": false,
       "vence_pronto": [],
       "faltantes": [],
       "tanques": {
        "vacaciones": {
         "numero": 26,
         "unidad": "días",
         "pie": "de 2 licencias",
         "capacidad": 45,
         "aria": "Vacaciones: 26 días hábiles disponibles. Ver tus licencias",
         "capas": [
          {
           "clase": "tinta",
           "n": 16,
           "nombre": "Licencia 2025",
           "nota": "Vence el 31/12/2027"
          },
          {
           "clase": "medio",
           "n": 10,
           "nombre": "Licencia 2026",
           "nota": "La primera mitad"
          },
          {
           "clase": "cargadas",
           "n": 9,
           "nombre": "Cargados",
           "nota": "Cargados para noviembre"
          },
          {
           "clase": "por_habilitar",
           "n": 10,
           "nombre": "Todavía no",
           "nota": "Se habilitan el 1/1/2027"
          }
         ]
        },
        "otros": [
         {
          "clave": "franquicia",
          "nombre": "Franquicias",
          "numero": "17",
          "unidad": "horas",
          "de": "de 42 horas",
          "valor": 17,
          "total": 42,
          "vence": false,
          "pestana": "licencias",
          "aria": "Franquicias: quedan 17 de 42 horas. Ver tus licencias"
         },
         {
          "clave": "estudios",
          "nombre": "Estudios",
          "numero": "8",
          "unidad": "días",
          "de": "de 15 días",
          "valor": 8,
          "total": 15,
          "vence": false,
          "pestana": "licencias",
          "aria": "Estudios: quedan 8 de 15 días. Ver tus licencias"
         },
         {
          "clave": "medica",
          "nombre": "Atención médica",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Atención médica: quedan 25 de 25 días. Ver tus licencias"
         },
         {
          "clave": "familiar",
          "nombre": "Grupo familiar",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Grupo familiar: quedan 25 de 25 días. Ver tus licencias"
         }
        ]
       },
       "pastillas": {
        "titulo": "Francos compensatorios",
        "meses": [
         {
          "numero": "1",
          "mes": "Diciembre",
          "nota": "Octubre sigue sumando",
          "estado": "pendiente"
         }
        ],
        "previo": null
       },
       "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.",
       "tipos": [
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "queda_texto": "26 disponibles"
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicia",
         "queda_texto": "Quedan 17 h de 42"
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "queda_texto": "Quedan 8 de 15"
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "queda_texto": "Sin tope"
        },
        {
         "tipo": "franco",
         "nombre": "Franco compensatorio",
         "queda_texto": "1 para diciembre"
        }
       ],
       "hoy_y_manana": {
        "ausentes_hoy": [],
        "ausentes_manana": [],
        "proximo_feriado": {
         "fecha": "2026-11-02",
         "cuando": "Lunes 02/11",
         "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
        },
        "eventos": []
       }
      }
     }
    },
    "GET /mi-espacio/licencias": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 2
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 7,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-10",
         "hasta": "2026-11-10",
         "horas": 2,
         "fechas_texto": "Mar 10/11/2026",
         "cantidad_texto": "2 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/licencias?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 2
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 7,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-10",
         "hasta": "2026-11-10",
         "horas": 2,
         "fechas_texto": "Mar 10/11/2026",
         "cantidad_texto": "2 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    }
   },
   "id": 7
  },
  "estudios": {
   "cuerpo": {
    "tipo": "estudios",
    "desde": "2026-12-15",
    "hasta": "2026-12-16",
    "mostrar": true,
    "nota": ""
   },
   "alta": {
    "status": 201,
    "json": {
     "success": true,
     "data": {
      "id": 8
     },
     "message": "Licencia cargada."
    }
   },
   "despues": {
    "GET /mi-espacio/resumen": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": {
        "clave": "planta",
        "texto": "Planta permanente"
       },
       "anio": 2026,
       "al_texto": "Al martes 27/10/2026",
       "mensaje": null,
       "abrir_saldos": false,
       "persona": {
        "nombre": "Lucía Fernández",
        "ve_companeros": true,
        "audita": true,
        "es_superadmin": false
       },
       "marca": false,
       "vence_pronto": [],
       "faltantes": [],
       "tanques": {
        "vacaciones": {
         "numero": 26,
         "unidad": "días",
         "pie": "de 2 licencias",
         "capacidad": 45,
         "aria": "Vacaciones: 26 días hábiles disponibles. Ver tus licencias",
         "capas": [
          {
           "clase": "tinta",
           "n": 16,
           "nombre": "Licencia 2025",
           "nota": "Vence el 31/12/2027"
          },
          {
           "clase": "medio",
           "n": 10,
           "nombre": "Licencia 2026",
           "nota": "La primera mitad"
          },
          {
           "clase": "cargadas",
           "n": 9,
           "nombre": "Cargados",
           "nota": "Cargados para noviembre"
          },
          {
           "clase": "por_habilitar",
           "n": 10,
           "nombre": "Todavía no",
           "nota": "Se habilitan el 1/1/2027"
          }
         ]
        },
        "otros": [
         {
          "clave": "franquicia",
          "nombre": "Franquicias",
          "numero": "19",
          "unidad": "horas",
          "de": "de 42 horas",
          "valor": 19,
          "total": 42,
          "vence": false,
          "pestana": "licencias",
          "aria": "Franquicias: quedan 19 de 42 horas. Ver tus licencias"
         },
         {
          "clave": "estudios",
          "nombre": "Estudios",
          "numero": "6",
          "unidad": "días",
          "de": "de 15 días",
          "valor": 6,
          "total": 15,
          "vence": false,
          "pestana": "licencias",
          "aria": "Estudios: quedan 6 de 15 días. Ver tus licencias"
         },
         {
          "clave": "medica",
          "nombre": "Atención médica",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Atención médica: quedan 25 de 25 días. Ver tus licencias"
         },
         {
          "clave": "familiar",
          "nombre": "Grupo familiar",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Grupo familiar: quedan 25 de 25 días. Ver tus licencias"
         }
        ]
       },
       "pastillas": {
        "titulo": "Francos compensatorios",
        "meses": [
         {
          "numero": "1",
          "mes": "Diciembre",
          "nota": "Octubre sigue sumando",
          "estado": "pendiente"
         }
        ],
        "previo": null
       },
       "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.",
       "tipos": [
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "queda_texto": "26 disponibles"
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicia",
         "queda_texto": "Quedan 19 h de 42"
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "queda_texto": "Quedan 6 de 15"
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "queda_texto": "Sin tope"
        },
        {
         "tipo": "franco",
         "nombre": "Franco compensatorio",
         "queda_texto": "1 para diciembre"
        }
       ],
       "hoy_y_manana": {
        "ausentes_hoy": [],
        "ausentes_manana": [],
        "proximo_feriado": {
         "fecha": "2026-11-02",
         "cuando": "Lunes 02/11",
         "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
        },
        "eventos": []
       }
      }
     }
    },
    "GET /mi-espacio/licencias": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 2
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 8,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-15",
         "hasta": "2026-12-16",
         "horas": null,
         "fechas_texto": "15/12 al 16/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 8,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/licencias?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 2
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 8,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-15",
         "hasta": "2026-12-16",
         "horas": null,
         "fechas_texto": "15/12 al 16/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 8,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    }
   },
   "id": 8
  },
  "medica": {
   "cuerpo": {
    "tipo": "medica",
    "desde": "2026-11-05",
    "hasta": "2026-11-06",
    "mostrar": true,
    "nota": ""
   },
   "alta": {
    "status": 201,
    "json": {
     "success": true,
     "data": {
      "id": 9
     },
     "message": "Licencia cargada."
    }
   },
   "despues": {
    "GET /mi-espacio/resumen": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": {
        "clave": "planta",
        "texto": "Planta permanente"
       },
       "anio": 2026,
       "al_texto": "Al martes 27/10/2026",
       "mensaje": null,
       "abrir_saldos": false,
       "persona": {
        "nombre": "Lucía Fernández",
        "ve_companeros": true,
        "audita": true,
        "es_superadmin": false
       },
       "marca": false,
       "vence_pronto": [],
       "faltantes": [],
       "tanques": {
        "vacaciones": {
         "numero": 26,
         "unidad": "días",
         "pie": "de 2 licencias",
         "capacidad": 45,
         "aria": "Vacaciones: 26 días hábiles disponibles. Ver tus licencias",
         "capas": [
          {
           "clase": "tinta",
           "n": 16,
           "nombre": "Licencia 2025",
           "nota": "Vence el 31/12/2027"
          },
          {
           "clase": "medio",
           "n": 10,
           "nombre": "Licencia 2026",
           "nota": "La primera mitad"
          },
          {
           "clase": "cargadas",
           "n": 9,
           "nombre": "Cargados",
           "nota": "Cargados para noviembre"
          },
          {
           "clase": "por_habilitar",
           "n": 10,
           "nombre": "Todavía no",
           "nota": "Se habilitan el 1/1/2027"
          }
         ]
        },
        "otros": [
         {
          "clave": "franquicia",
          "nombre": "Franquicias",
          "numero": "19",
          "unidad": "horas",
          "de": "de 42 horas",
          "valor": 19,
          "total": 42,
          "vence": false,
          "pestana": "licencias",
          "aria": "Franquicias: quedan 19 de 42 horas. Ver tus licencias"
         },
         {
          "clave": "estudios",
          "nombre": "Estudios",
          "numero": "8",
          "unidad": "días",
          "de": "de 15 días",
          "valor": 8,
          "total": 15,
          "vence": false,
          "pestana": "licencias",
          "aria": "Estudios: quedan 8 de 15 días. Ver tus licencias"
         },
         {
          "clave": "medica",
          "nombre": "Atención médica",
          "numero": "23",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 23,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Atención médica: quedan 23 de 25 días. Ver tus licencias"
         },
         {
          "clave": "familiar",
          "nombre": "Grupo familiar",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Grupo familiar: quedan 25 de 25 días. Ver tus licencias"
         }
        ]
       },
       "pastillas": {
        "titulo": "Francos compensatorios",
        "meses": [
         {
          "numero": "1",
          "mes": "Diciembre",
          "nota": "Octubre sigue sumando",
          "estado": "pendiente"
         }
        ],
        "previo": null
       },
       "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.",
       "tipos": [
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "queda_texto": "26 disponibles"
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicia",
         "queda_texto": "Quedan 19 h de 42"
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "queda_texto": "Quedan 8 de 15"
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "queda_texto": "Quedan 23 de 25"
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "queda_texto": "Sin tope"
        },
        {
         "tipo": "franco",
         "nombre": "Franco compensatorio",
         "queda_texto": "1 para diciembre"
        }
       ],
       "hoy_y_manana": {
        "ausentes_hoy": [],
        "ausentes_manana": [],
        "proximo_feriado": {
         "fecha": "2026-11-02",
         "cuando": "Lunes 02/11",
         "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
        },
        "eventos": []
       }
      }
     }
    },
    "GET /mi-espacio/licencias": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 2
        }
       ],
       "licencias": [
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 9,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-11-05",
         "hasta": "2026-11-06",
         "horas": null,
         "fechas_texto": "05/11 al 06/11/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 9,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/licencias?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 2
        }
       ],
       "licencias": [
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 9,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-11-05",
         "hasta": "2026-11-06",
         "horas": null,
         "fechas_texto": "05/11 al 06/11/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 9,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    }
   },
   "id": 9
  },
  "familiar": {
   "cuerpo": {
    "tipo": "familiar",
    "desde": "2026-11-12",
    "hasta": "2026-11-12",
    "mostrar": true,
    "nota": ""
   },
   "alta": {
    "status": 201,
    "json": {
     "success": true,
     "data": {
      "id": 10
     },
     "message": "Licencia cargada."
    }
   },
   "despues": {
    "GET /mi-espacio/resumen": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": {
        "clave": "planta",
        "texto": "Planta permanente"
       },
       "anio": 2026,
       "al_texto": "Al martes 27/10/2026",
       "mensaje": null,
       "abrir_saldos": false,
       "persona": {
        "nombre": "Lucía Fernández",
        "ve_companeros": true,
        "audita": true,
        "es_superadmin": false
       },
       "marca": false,
       "vence_pronto": [],
       "faltantes": [],
       "tanques": {
        "vacaciones": {
         "numero": 26,
         "unidad": "días",
         "pie": "de 2 licencias",
         "capacidad": 45,
         "aria": "Vacaciones: 26 días hábiles disponibles. Ver tus licencias",
         "capas": [
          {
           "clase": "tinta",
           "n": 16,
           "nombre": "Licencia 2025",
           "nota": "Vence el 31/12/2027"
          },
          {
           "clase": "medio",
           "n": 10,
           "nombre": "Licencia 2026",
           "nota": "La primera mitad"
          },
          {
           "clase": "cargadas",
           "n": 9,
           "nombre": "Cargados",
           "nota": "Cargados para noviembre"
          },
          {
           "clase": "por_habilitar",
           "n": 10,
           "nombre": "Todavía no",
           "nota": "Se habilitan el 1/1/2027"
          }
         ]
        },
        "otros": [
         {
          "clave": "franquicia",
          "nombre": "Franquicias",
          "numero": "19",
          "unidad": "horas",
          "de": "de 42 horas",
          "valor": 19,
          "total": 42,
          "vence": false,
          "pestana": "licencias",
          "aria": "Franquicias: quedan 19 de 42 horas. Ver tus licencias"
         },
         {
          "clave": "estudios",
          "nombre": "Estudios",
          "numero": "8",
          "unidad": "días",
          "de": "de 15 días",
          "valor": 8,
          "total": 15,
          "vence": false,
          "pestana": "licencias",
          "aria": "Estudios: quedan 8 de 15 días. Ver tus licencias"
         },
         {
          "clave": "medica",
          "nombre": "Atención médica",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Atención médica: quedan 25 de 25 días. Ver tus licencias"
         },
         {
          "clave": "familiar",
          "nombre": "Grupo familiar",
          "numero": "24",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 24,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Grupo familiar: quedan 24 de 25 días. Ver tus licencias"
         }
        ]
       },
       "pastillas": {
        "titulo": "Francos compensatorios",
        "meses": [
         {
          "numero": "1",
          "mes": "Diciembre",
          "nota": "Octubre sigue sumando",
          "estado": "pendiente"
         }
        ],
        "previo": null
       },
       "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.",
       "tipos": [
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "queda_texto": "26 disponibles"
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicia",
         "queda_texto": "Quedan 19 h de 42"
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "queda_texto": "Quedan 8 de 15"
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "queda_texto": "Quedan 24 de 25"
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "queda_texto": "Sin tope"
        },
        {
         "tipo": "franco",
         "nombre": "Franco compensatorio",
         "queda_texto": "1 para diciembre"
        }
       ],
       "hoy_y_manana": {
        "ausentes_hoy": [],
        "ausentes_manana": [],
        "proximo_feriado": {
         "fecha": "2026-11-02",
         "cuando": "Lunes 02/11",
         "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
        },
        "eventos": []
       }
      }
     }
    },
    "GET /mi-espacio/licencias": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 10,
         "tipo": "familiar",
         "tipo_nombre": "Atención del grupo familiar",
         "desde": "2026-11-12",
         "hasta": "2026-11-12",
         "horas": null,
         "fechas_texto": "Jue 12/11/2026",
         "cantidad_texto": "1 día hábil",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 10,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/licencias?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 10,
         "tipo": "familiar",
         "tipo_nombre": "Atención del grupo familiar",
         "desde": "2026-11-12",
         "hasta": "2026-11-12",
         "horas": null,
         "fechas_texto": "Jue 12/11/2026",
         "cantidad_texto": "1 día hábil",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 10,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    }
   },
   "id": 10
  },
  "medica_extraordinaria": {
   "cuerpo": {
    "tipo": "medica_extraordinaria",
    "desde": "2026-12-28",
    "hasta": "2026-12-30",
    "mostrar": true,
    "nota": ""
   },
   "alta": {
    "status": 201,
    "json": {
     "success": true,
     "data": {
      "id": 11
     },
     "message": "Licencia cargada."
    }
   },
   "despues": {
    "GET /mi-espacio/resumen": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": {
        "clave": "planta",
        "texto": "Planta permanente"
       },
       "anio": 2026,
       "al_texto": "Al martes 27/10/2026",
       "mensaje": null,
       "abrir_saldos": false,
       "persona": {
        "nombre": "Lucía Fernández",
        "ve_companeros": true,
        "audita": true,
        "es_superadmin": false
       },
       "marca": false,
       "vence_pronto": [],
       "faltantes": [],
       "tanques": {
        "vacaciones": {
         "numero": 26,
         "unidad": "días",
         "pie": "de 2 licencias",
         "capacidad": 45,
         "aria": "Vacaciones: 26 días hábiles disponibles. Ver tus licencias",
         "capas": [
          {
           "clase": "tinta",
           "n": 16,
           "nombre": "Licencia 2025",
           "nota": "Vence el 31/12/2027"
          },
          {
           "clase": "medio",
           "n": 10,
           "nombre": "Licencia 2026",
           "nota": "La primera mitad"
          },
          {
           "clase": "cargadas",
           "n": 9,
           "nombre": "Cargados",
           "nota": "Cargados para noviembre"
          },
          {
           "clase": "por_habilitar",
           "n": 10,
           "nombre": "Todavía no",
           "nota": "Se habilitan el 1/1/2027"
          }
         ]
        },
        "otros": [
         {
          "clave": "franquicia",
          "nombre": "Franquicias",
          "numero": "19",
          "unidad": "horas",
          "de": "de 42 horas",
          "valor": 19,
          "total": 42,
          "vence": false,
          "pestana": "licencias",
          "aria": "Franquicias: quedan 19 de 42 horas. Ver tus licencias"
         },
         {
          "clave": "estudios",
          "nombre": "Estudios",
          "numero": "8",
          "unidad": "días",
          "de": "de 15 días",
          "valor": 8,
          "total": 15,
          "vence": false,
          "pestana": "licencias",
          "aria": "Estudios: quedan 8 de 15 días. Ver tus licencias"
         },
         {
          "clave": "medica",
          "nombre": "Atención médica",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Atención médica: quedan 25 de 25 días. Ver tus licencias"
         },
         {
          "clave": "familiar",
          "nombre": "Grupo familiar",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Grupo familiar: quedan 25 de 25 días. Ver tus licencias"
         }
        ]
       },
       "pastillas": {
        "titulo": "Francos compensatorios",
        "meses": [
         {
          "numero": "1",
          "mes": "Diciembre",
          "nota": "Octubre sigue sumando",
          "estado": "pendiente"
         }
        ],
        "previo": null
       },
       "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. Usaste 3 días en 2026.",
       "tipos": [
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "queda_texto": "26 disponibles"
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicia",
         "queda_texto": "Quedan 19 h de 42"
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "queda_texto": "Quedan 8 de 15"
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "queda_texto": "Sin tope"
        },
        {
         "tipo": "franco",
         "nombre": "Franco compensatorio",
         "queda_texto": "1 para diciembre"
        }
       ],
       "hoy_y_manana": {
        "ausentes_hoy": [],
        "ausentes_manana": [],
        "proximo_feriado": {
         "fecha": "2026-11-02",
         "cuando": "Lunes 02/11",
         "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
        },
        "eventos": []
       }
      }
     }
    },
    "GET /mi-espacio/licencias": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 11,
         "tipo": "medica_extraordinaria",
         "tipo_nombre": "Médica extraordinaria",
         "desde": "2026-12-28",
         "hasta": "2026-12-30",
         "horas": null,
         "fechas_texto": "28/12 al 30/12/2026",
         "cantidad_texto": "3 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 11,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/licencias?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 11,
         "tipo": "medica_extraordinaria",
         "tipo_nombre": "Médica extraordinaria",
         "desde": "2026-12-28",
         "hasta": "2026-12-30",
         "horas": null,
         "fechas_texto": "28/12 al 30/12/2026",
         "cantidad_texto": "3 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 11,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    }
   },
   "id": 11
  },
  "franco": {
   "cuerpo": {
    "tipo": "franco",
    "desde": "2026-12-14",
    "hasta": "2026-12-14",
    "mostrar": true,
    "nota": ""
   },
   "alta": {
    "status": 201,
    "json": {
     "success": true,
     "data": {
      "id": 12
     },
     "message": "Licencia cargada."
    }
   },
   "despues": {
    "GET /mi-espacio/resumen": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": {
        "clave": "planta",
        "texto": "Planta permanente"
       },
       "anio": 2026,
       "al_texto": "Al martes 27/10/2026",
       "mensaje": null,
       "abrir_saldos": false,
       "persona": {
        "nombre": "Lucía Fernández",
        "ve_companeros": true,
        "audita": true,
        "es_superadmin": false
       },
       "marca": false,
       "vence_pronto": [],
       "faltantes": [],
       "tanques": {
        "vacaciones": {
         "numero": 26,
         "unidad": "días",
         "pie": "de 2 licencias",
         "capacidad": 45,
         "aria": "Vacaciones: 26 días hábiles disponibles. Ver tus licencias",
         "capas": [
          {
           "clase": "tinta",
           "n": 16,
           "nombre": "Licencia 2025",
           "nota": "Vence el 31/12/2027"
          },
          {
           "clase": "medio",
           "n": 10,
           "nombre": "Licencia 2026",
           "nota": "La primera mitad"
          },
          {
           "clase": "cargadas",
           "n": 9,
           "nombre": "Cargados",
           "nota": "Cargados para noviembre"
          },
          {
           "clase": "por_habilitar",
           "n": 10,
           "nombre": "Todavía no",
           "nota": "Se habilitan el 1/1/2027"
          }
         ]
        },
        "otros": [
         {
          "clave": "franquicia",
          "nombre": "Franquicias",
          "numero": "19",
          "unidad": "horas",
          "de": "de 42 horas",
          "valor": 19,
          "total": 42,
          "vence": false,
          "pestana": "licencias",
          "aria": "Franquicias: quedan 19 de 42 horas. Ver tus licencias"
         },
         {
          "clave": "estudios",
          "nombre": "Estudios",
          "numero": "8",
          "unidad": "días",
          "de": "de 15 días",
          "valor": 8,
          "total": 15,
          "vence": false,
          "pestana": "licencias",
          "aria": "Estudios: quedan 8 de 15 días. Ver tus licencias"
         },
         {
          "clave": "medica",
          "nombre": "Atención médica",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Atención médica: quedan 25 de 25 días. Ver tus licencias"
         },
         {
          "clave": "familiar",
          "nombre": "Grupo familiar",
          "numero": "25",
          "unidad": "días",
          "de": "de 25 días",
          "valor": 25,
          "total": 25,
          "vence": false,
          "pestana": "licencias",
          "aria": "Grupo familiar: quedan 25 de 25 días. Ver tus licencias"
         }
        ]
       },
       "pastillas": {
        "titulo": "Francos compensatorios",
        "meses": [
         {
          "numero": "0",
          "mes": "Diciembre",
          "nota": "Octubre sigue sumando",
          "estado": "pendiente"
         }
        ],
        "previo": null
       },
       "extraordinaria": "Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.",
       "tipos": [
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "queda_texto": "26 disponibles"
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicia",
         "queda_texto": "Quedan 19 h de 42"
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "queda_texto": "Quedan 8 de 15"
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "familiar",
         "nombre": "Grupo familiar",
         "queda_texto": "Quedan 25 de 25"
        },
        {
         "tipo": "medica_extraordinaria",
         "nombre": "Médica extraordinaria",
         "queda_texto": "Sin tope"
        },
        {
         "tipo": "franco",
         "nombre": "Franco compensatorio",
         "queda_texto": "Ninguno para usar"
        }
       ],
       "hoy_y_manana": {
        "ausentes_hoy": [],
        "ausentes_manana": [],
        "proximo_feriado": {
         "fecha": "2026-11-02",
         "cuando": "Lunes 02/11",
         "nombre": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches"
        },
        "eventos": []
       }
      }
     }
    },
    "GET /mi-espacio/licencias": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        },
        {
         "tipo": "franco",
         "nombre": "Francos",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 12,
         "tipo": "franco",
         "tipo_nombre": "Franco compensatorio",
         "desde": "2026-12-14",
         "hasta": "2026-12-14",
         "horas": null,
         "fechas_texto": "Lun 14/12/2026",
         "cantidad_texto": "1 día",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 12,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/licencias?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "filtros": [
        {
         "tipo": "todas",
         "nombre": "Todas",
         "cantidad": 5
        },
        {
         "tipo": "vacaciones",
         "nombre": "Vacaciones",
         "cantidad": 1
        },
        {
         "tipo": "franquicia",
         "nombre": "Franquicias",
         "cantidad": 1
        },
        {
         "tipo": "estudios",
         "nombre": "Estudios",
         "cantidad": 1
        },
        {
         "tipo": "medica",
         "nombre": "Atención médica",
         "cantidad": 1
        },
        {
         "tipo": "franco",
         "nombre": "Francos",
         "cantidad": 1
        }
       ],
       "licencias": [
        {
         "id": 12,
         "tipo": "franco",
         "tipo_nombre": "Franco compensatorio",
         "desde": "2026-12-14",
         "hasta": "2026-12-14",
         "horas": null,
         "fechas_texto": "Lun 14/12/2026",
         "cantidad_texto": "1 día",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 12,
          "autorizado_id": null
         }
        },
        {
         "id": 4,
         "tipo": "estudios",
         "tipo_nombre": "Estudios",
         "desde": "2026-12-02",
         "hasta": "2026-12-03",
         "horas": null,
         "fechas_texto": "02/12 al 03/12/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Final de Estadística",
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 5,
          "autorizado_id": null
         }
        },
        {
         "id": 3,
         "tipo": "vacaciones",
         "tipo_nombre": "Vacaciones",
         "desde": "2026-11-16",
         "hasta": "2026-11-27",
         "horas": null,
         "fechas_texto": "16/11 al 27/11/2026",
         "cantidad_texto": "12 días corridos, 9 hábiles",
         "proxima": true,
         "de_licencias_texto": "De las licencias 2024 (5 días) y 2025 (4 días).",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "Tus compañeros ven «Lucía Fernández no está».",
         "configuracion": {
          "texto": "También en Configuración → Licencias.",
          "insignia": "creada"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": {
          "licencia_id": 4,
          "autorizado_id": null
         }
        },
        {
         "id": 2,
         "tipo": "franquicia",
         "tipo_nombre": "Franquicia",
         "desde": "2026-11-04",
         "hasta": "2026-11-04",
         "horas": 3,
         "fechas_texto": "Mié 04/11/2026",
         "cantidad_texto": "3 horas",
         "proxima": true,
         "de_licencias_texto": "",
         "antes_del_arranque": false,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "",
         "nota": "Trámite del DNI",
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": {
          "texto": "No es el día entero: no pasa a Configuración",
          "insignia": "aviso"
         },
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        },
        {
         "id": 1,
         "tipo": "medica",
         "tipo_nombre": "Atención médica",
         "desde": "2026-10-14",
         "hasta": "2026-10-15",
         "horas": null,
         "fechas_texto": "14/10 al 15/10/2026",
         "cantidad_texto": "2 días hábiles",
         "proxima": false,
         "de_licencias_texto": "",
         "antes_del_arranque": true,
         "fuera_de_la_modalidad": false,
         "no_cuenta_texto": "Antes del saldo inicial: no descuenta",
         "nota": null,
         "mostrar": true,
         "mostrar_texto": "",
         "configuracion": null,
         "puede_borrar": true,
         "solo_hasta": false,
         "fechas_fijas": false,
         "en_configuracion": null
        }
       ],
       "saldo_inicial": {
        "fecha": "2026-10-27",
        "titulo": "Saldo inicial 2026",
        "cargado_texto": "Cargado el 27/10/2026",
        "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 20 horas de franquicia y 5 días de estudios."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    },
    "GET /mi-espacio/horas-extras?anio=2026": {
     "status": 200,
     "json": {
      "success": true,
      "data": {
       "modalidad": "planta",
       "anio": 2026,
       "anios": [
        2024,
        2025,
        2026,
        2027
       ],
       "meses": [
        {
         "mes": "2026-10",
         "mes_texto": "Octubre 2026",
         "horas_texto": "7,5 h",
         "dias_texto": "2 días",
         "francos": 1,
         "uso_texto": "Diciembre 2026",
         "estado": "sumando",
         "situacion": "El mes sigue sumando"
        }
       ],
       "dias_por_mes": {
        "2026-10": [
         {
          "id": 3,
          "fecha": "2026-10-20",
          "fecha_texto": "Mar 20/10",
          "desde": "14:00",
          "hasta": "17:30",
          "horario": "14:00 a 17:30",
          "horas_texto": "3,5 horas",
          "nota": null
         },
         {
          "id": 2,
          "fecha": "2026-10-06",
          "fecha_texto": "Mar 06/10",
          "desde": "14:00",
          "hasta": "18:00",
          "horario": "14:00 a 18:00",
          "horas_texto": "4 horas",
          "nota": null
         }
        ]
       },
       "totales_por_mes": {
        "2026-10": "7,5 horas"
       },
       "mes_en_curso": "2026-10",
       "uso_autorizado": {
        "puede": false,
        "texto": "En 2026 no tenés francos no utilizados previamente."
       }
      }
     }
    }
   },
   "id": 12
  }
 }
};

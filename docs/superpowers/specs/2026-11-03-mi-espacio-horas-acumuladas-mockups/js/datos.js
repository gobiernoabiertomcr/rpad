// MAQUETA (03/11/2026): las respuestas de la API real de Mi espacio, con los números del caso (6,5 h a favor de noviembre
// y 1,5 h no utilizadas del saldo inicial) y un nombre inventado. Generado fuera del repo.
window.MAQUETA_DATOS = {
 "fijos": {
  "GET /auth/verify": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "user": {
      "id": 2,
      "username": "mojeda",
      "nombre_completo": "Micaela Ojeda",
      "email": "mojeda@ejemplo.test",
      "rol": "editor",
      "vinculo": "contrato",
      "cargo": "Analista de datos"
     }
    }
   }
  },
  "GET /cambios-pendientes/contador": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "count": 0,
     "total": 0
    }
   }
  },
  "GET /mi-espacio/resumen": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": {
      "clave": "contrato",
      "texto": "Contrato"
     },
     "anio": 2026,
     "al_texto": "Al martes 03/11/2026",
     "mensaje": null,
     "abrir_saldos": false,
     "persona": {
      "nombre": "Micaela Ojeda",
      "ve_companeros": true,
      "audita": false,
      "es_superadmin": false
     },
     "marca": true,
     "vence_pronto": [
      {
       "fecha": "2026-11-30",
       "dia": "30",
       "mes": "nov",
       "titulo": "6,5 horas a favor de noviembre",
       "texto": "Vencen el lunes 30/11, en 27 días.",
       "accion": {
        "texto": "Usarlas",
        "tipo": "horas_a_favor"
       }
      }
     ],
     "faltantes": [],
     "para_revisar": [],
     "tanques": {
      "vacaciones": {
       "numero": 9,
       "unidad": "días",
       "pie": "de 2 licencias",
       "capacidad": 14,
       "aria": "Vacaciones: 9 días hábiles disponibles. Ver tus licencias",
       "capas": [
        {
         "clase": "tinta",
         "n": 4,
         "nombre": "Licencia 2025",
         "nota": "Vence el 31/12/2027"
        },
        {
         "clase": "medio",
         "n": 5,
         "nombre": "Licencia 2026",
         "nota": "La primera mitad"
        },
        {
         "clase": "por_habilitar",
         "n": 5,
         "nombre": "Todavía no",
         "nota": "Se habilitan el 1/1/2027"
        }
       ]
      },
      "otros": [
       {
        "clave": "horas_a_favor",
        "nombre": "Horas a favor",
        "numero": "6,5",
        "unidad": "horas",
        "de": "de 6,5 en noviembre",
        "valor": 6.5,
        "total": 6.5,
        "vence": true,
        "pestana": "horas",
        "aria": "Horas a favor: quedan 6,5 de 6,5 horas en noviembre. Ver tus horas extras"
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
        "numero": "22",
        "unidad": "días",
        "de": "de 25 días",
        "valor": 22,
        "total": 25,
        "vence": false,
        "pestana": "licencias",
        "aria": "Grupo familiar: quedan 22 de 25 días. Ver tus licencias"
       }
      ]
     },
     "titular": {
      "encabezado": "Martes 3 de noviembre, contrato",
      "antes": "Te quedan",
      "cifra": "9",
      "despues": "días de vacaciones",
      "bajada": [
       {
        "texto": "Otros 5 se habilitan el 1/1/2027.",
        "vence": false
       }
      ]
     },
     "restituciones": [],
     "pastillas": {
      "titulo": "Horas a favor",
      "meses": [
       {
        "numero": "6,5",
        "mes": "Noviembre",
        "nota": "De 6,5, hasta el lunes 30/11",
        "estado": "vence"
       }
      ],
      "previo": {
       "numero": "1,5",
       "titulo": "Horas de 2026",
       "nota": "No utilizadas previamente"
      }
     },
     "extraordinaria": "Atención médica extraordinaria: sin tope. No usaste en 2026.",
     "tipos": [
      {
       "tipo": "vacaciones",
       "nombre": "Vacaciones",
       "queda_texto": "9 disponibles · 5 más el 1/1"
      },
      {
       "tipo": "medica",
       "nombre": "Atención médica",
       "queda_texto": "Quedan 25 de 25"
      },
      {
       "tipo": "familiar",
       "nombre": "Grupo familiar",
       "queda_texto": "Quedan 22 de 25"
      },
      {
       "tipo": "medica_extraordinaria",
       "nombre": "Médica extraordinaria",
       "queda_texto": "Sin tope"
      },
      {
       "tipo": "horas_a_favor",
       "nombre": "Horas a favor",
       "queda_texto": "Quedan 6,5 h en noviembre"
      }
     ],
     "hoy_y_manana": {
      "ausentes_hoy": [],
      "ausentes_manana": [],
      "proximo_feriado": {
       "fecha": "2026-11-09",
       "cuando": "Lunes 09/11",
       "nombre": "Visita de Su Santidad el Papa León XIV"
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
       "cantidad": 0
      }
     ],
     "licencias": [],
     "saldo_inicial": {
      "fecha": "2026-10-28",
      "titulo": "Saldo inicial 2026",
      "cargado_texto": "Cargado el 28/10/2026",
      "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 4 días de la licencia 2025 y 5 de la 2026. En 2026 ya habías usado 3 días de atención del grupo familiar. Tenías 1,5 horas no utilizadas previamente."
     },
     "otros_anios": []
    }
   }
  },
  "GET /mi-espacio/horas-extras": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
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
       "horas_texto": "6,5 h",
       "horas_detalle": "",
       "a_favor_texto": "Noviembre 2026",
       "a_favor_detalle": "6,5 horas",
       "usadas_texto": "—",
       "usadas_detalle": "",
       "estado": "en_uso",
       "situacion": "6,5 h para usar hasta el 30/11"
      }
     ],
     "dias_por_mes": {
      "2026-10": [
       {
        "id": 12,
        "fecha": "2026-10-29",
        "fecha_texto": "Jue 29/10",
        "tipo_texto": "",
        "horario": "Salida 16:30",
        "entrada_texto": "",
        "horas": 1.5,
        "horas_texto": "1,5 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       },
       {
        "id": 11,
        "fecha": "2026-10-27",
        "fecha_texto": "Mar 27/10",
        "tipo_texto": "",
        "horario": "Salida 17:16",
        "entrada_texto": "",
        "horas": 2.5,
        "horas_texto": "2,5 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       },
       {
        "id": 10,
        "fecha": "2026-10-22",
        "fecha_texto": "Jue 22/10",
        "tipo_texto": "",
        "horario": "Salida 15:46",
        "entrada_texto": "",
        "horas": 1,
        "horas_texto": "1 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       },
       {
        "id": 9,
        "fecha": "2026-10-20",
        "fecha_texto": "Mar 20/10",
        "tipo_texto": "",
        "horario": "Salida 16:16",
        "entrada_texto": "",
        "horas": 1.5,
        "horas_texto": "1,5 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       }
      ]
     },
     "totales_por_mes": {
      "2026-10": "6,5 horas"
     },
     "mes_en_curso": "2026-11",
     "no_utilizadas": {
      "total_texto": "1,5 horas en 2026",
      "filas": [
       {
        "titulo": "Del saldo inicial",
        "texto": "1,5 horas",
        "detalle": ""
       }
      ],
      "uso_autorizado": {
       "puede": true,
       "texto": "Si te autorizan a tomarlas, registrá un uso autorizado: se descuentan primero las más viejas."
      }
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
     "saldo_inicial": null,
     "otros_anios": []
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2024": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
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
     "no_utilizadas": {
      "total_texto": "0 horas en 2024",
      "filas": [],
      "uso_autorizado": {
       "puede": false,
       "texto": "En 2024 no te quedan horas no utilizadas previamente."
      }
     }
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
     "saldo_inicial": null,
     "otros_anios": []
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2025": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
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
     "no_utilizadas": {
      "total_texto": "0 horas en 2025",
      "filas": [],
      "uso_autorizado": {
       "puede": false,
       "texto": "En 2025 no te quedan horas no utilizadas previamente."
      }
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
       "cantidad": 0
      }
     ],
     "licencias": [],
     "saldo_inicial": {
      "fecha": "2026-10-28",
      "titulo": "Saldo inicial 2026",
      "cargado_texto": "Cargado el 28/10/2026",
      "texto": "Antes de empezar con Mi espacio: de vacaciones, quedaban 4 días de la licencia 2025 y 5 de la 2026. En 2026 ya habías usado 3 días de atención del grupo familiar. Tenías 1,5 horas no utilizadas previamente."
     },
     "otros_anios": []
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2026": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
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
       "horas_texto": "6,5 h",
       "horas_detalle": "",
       "a_favor_texto": "Noviembre 2026",
       "a_favor_detalle": "6,5 horas",
       "usadas_texto": "—",
       "usadas_detalle": "",
       "estado": "en_uso",
       "situacion": "6,5 h para usar hasta el 30/11"
      }
     ],
     "dias_por_mes": {
      "2026-10": [
       {
        "id": 12,
        "fecha": "2026-10-29",
        "fecha_texto": "Jue 29/10",
        "tipo_texto": "",
        "horario": "Salida 16:30",
        "entrada_texto": "",
        "horas": 1.5,
        "horas_texto": "1,5 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       },
       {
        "id": 11,
        "fecha": "2026-10-27",
        "fecha_texto": "Mar 27/10",
        "tipo_texto": "",
        "horario": "Salida 17:16",
        "entrada_texto": "",
        "horas": 2.5,
        "horas_texto": "2,5 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       },
       {
        "id": 10,
        "fecha": "2026-10-22",
        "fecha_texto": "Jue 22/10",
        "tipo_texto": "",
        "horario": "Salida 15:46",
        "entrada_texto": "",
        "horas": 1,
        "horas_texto": "1 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       },
       {
        "id": 9,
        "fecha": "2026-10-20",
        "fecha_texto": "Mar 20/10",
        "tipo_texto": "",
        "horario": "Salida 16:16",
        "entrada_texto": "",
        "horas": 1.5,
        "horas_texto": "1,5 h",
        "cero": false,
        "nota": null,
        "aviso": null,
        "suma_a": ""
       }
      ]
     },
     "totales_por_mes": {
      "2026-10": "6,5 horas"
     },
     "mes_en_curso": "2026-11",
     "no_utilizadas": {
      "total_texto": "1,5 horas en 2026",
      "filas": [
       {
        "titulo": "Del saldo inicial",
        "texto": "1,5 horas",
        "detalle": ""
       }
      ],
      "uso_autorizado": {
       "puede": true,
       "texto": "Si te autorizan a tomarlas, registrá un uso autorizado: se descuentan primero las más viejas."
      }
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
     "saldo_inicial": null,
     "otros_anios": []
    }
   }
  },
  "GET /mi-espacio/horas-extras?anio=2027": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
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
     "no_utilizadas": {
      "total_texto": "0 horas en 2027",
      "filas": [],
      "uso_autorizado": {
       "puede": false,
       "texto": "En 2027 no te quedan horas no utilizadas previamente."
      }
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
     "dias_vacaciones": 10,
     "estudios": null,
     "heredado": false,
     "texto_mitades": "La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 5.",
     "textos_mitades": {
      "10": "La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 5.",
      "15": "La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 7.",
      "20": "La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 10.",
      "25": "La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 12.",
      "30": "La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 15."
     }
    }
   }
  },
  "GET /mi-espacio/saldo-inicial": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "arranque": "2026-10-28",
     "modalidad": "contrato",
     "campos": [
      {
       "clave": "vacaciones-2024",
       "concepto": "vacaciones",
       "anio": 2024,
       "rotulo": "Sin usar de la licencia 2024",
       "maximo": 30,
       "paso": 1,
       "ayuda": "De 0 a 30, el máximo de una licencia.",
       "valor": 0
      },
      {
       "clave": "vacaciones-2025",
       "concepto": "vacaciones",
       "anio": 2025,
       "rotulo": "De la 2025",
       "maximo": 30,
       "paso": 1,
       "ayuda": "De 0 a 30, el máximo de una licencia.",
       "valor": 4
      },
      {
       "clave": "vacaciones-2026",
       "concepto": "vacaciones",
       "anio": 2026,
       "rotulo": "De la 2026",
       "maximo": 5,
       "paso": 1,
       "ayuda": "De 0 a 5: lo que se habilitó de la 2026 hasta hoy.",
       "valor": 5
      },
      {
       "clave": "medica",
       "concepto": "medica",
       "anio": 2026,
       "rotulo": "Días de atención médica",
       "maximo": 25,
       "paso": 1,
       "ayuda": "",
       "valor": 0
      },
      {
       "clave": "familiar",
       "concepto": "familiar",
       "anio": 2026,
       "rotulo": "Días de grupo familiar",
       "maximo": 25,
       "paso": 1,
       "ayuda": "",
       "valor": 3
      },
      {
       "clave": "horas_no_utilizadas",
       "concepto": "horas_no_utilizadas",
       "anio": 2026,
       "rotulo": "Horas no utilizadas previamente",
       "maximo": 200,
       "paso": 0.5,
       "ayuda": "",
       "valor": 1.5
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
  "GET /mi-espacio/salidas?mes=2026-10": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
     "mes": "2026-10",
     "mes_texto": "Octubre 2026",
     "hoy": "2026-11-03",
     "anterior": "2026-09",
     "siguiente": "2026-11",
     "sumar_a": "septiembre",
     "dias": [
      {
       "fecha": "2026-10-01",
       "fecha_texto": "Jue 01/10",
       "fecha_larga": "jueves 01/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-02",
       "fecha_texto": "Vie 02/10",
       "fecha_larga": "viernes 02/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-05",
       "fecha_texto": "Lun 05/10",
       "fecha_larga": "lunes 05/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-06",
       "fecha_texto": "Mar 06/10",
       "fecha_larga": "martes 06/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-07",
       "fecha_texto": "Mié 07/10",
       "fecha_larga": "miércoles 07/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-08",
       "fecha_texto": "Jue 08/10",
       "fecha_larga": "jueves 08/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-09",
       "fecha_texto": "Vie 09/10",
       "fecha_larga": "viernes 09/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-12",
       "fecha_texto": "Lun 12/10",
       "fecha_larga": "lunes 12/10",
       "tipo": "feriado",
       "feriado": "Día del Respeto a la Diversidad Cultural",
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-13",
       "fecha_texto": "Mar 13/10",
       "fecha_larga": "martes 13/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-14",
       "fecha_texto": "Mié 14/10",
       "fecha_larga": "miércoles 14/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-15",
       "fecha_texto": "Jue 15/10",
       "fecha_larga": "jueves 15/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-16",
       "fecha_texto": "Vie 16/10",
       "fecha_larga": "viernes 16/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-19",
       "fecha_texto": "Lun 19/10",
       "fecha_larga": "lunes 19/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-20",
       "fecha_texto": "Mar 20/10",
       "fecha_larga": "martes 20/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": "16:16",
       "nota": null,
       "al_mes_anterior": false,
       "horas": 1.5,
       "horas_texto": "1,5 h",
       "aviso": null
      },
      {
       "fecha": "2026-10-21",
       "fecha_texto": "Mié 21/10",
       "fecha_larga": "miércoles 21/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-22",
       "fecha_texto": "Jue 22/10",
       "fecha_larga": "jueves 22/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": "15:46",
       "nota": null,
       "al_mes_anterior": false,
       "horas": 1,
       "horas_texto": "1 h",
       "aviso": null
      },
      {
       "fecha": "2026-10-23",
       "fecha_texto": "Vie 23/10",
       "fecha_larga": "viernes 23/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-26",
       "fecha_texto": "Lun 26/10",
       "fecha_larga": "lunes 26/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-27",
       "fecha_texto": "Mar 27/10",
       "fecha_larga": "martes 27/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": "17:16",
       "nota": null,
       "al_mes_anterior": false,
       "horas": 2.5,
       "horas_texto": "2,5 h",
       "aviso": null
      },
      {
       "fecha": "2026-10-28",
       "fecha_texto": "Mié 28/10",
       "fecha_larga": "miércoles 28/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-29",
       "fecha_texto": "Jue 29/10",
       "fecha_larga": "jueves 29/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": "16:30",
       "nota": null,
       "al_mes_anterior": false,
       "horas": 1.5,
       "horas_texto": "1,5 h",
       "aviso": null
      },
      {
       "fecha": "2026-10-30",
       "fecha_texto": "Vie 30/10",
       "fecha_larga": "viernes 30/10",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      }
     ],
     "fines_de_semana": [
      {
       "fecha": "2026-10-03",
       "fecha_texto": "Sáb 03/10",
       "fecha_larga": "sábado 03/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Sábado",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-04",
       "fecha_texto": "Dom 04/10",
       "fecha_larga": "domingo 04/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Domingo",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-10",
       "fecha_texto": "Sáb 10/10",
       "fecha_larga": "sábado 10/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Sábado",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-11",
       "fecha_texto": "Dom 11/10",
       "fecha_larga": "domingo 11/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Domingo",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-17",
       "fecha_texto": "Sáb 17/10",
       "fecha_larga": "sábado 17/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Sábado",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-18",
       "fecha_texto": "Dom 18/10",
       "fecha_larga": "domingo 18/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Domingo",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-24",
       "fecha_texto": "Sáb 24/10",
       "fecha_larga": "sábado 24/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Sábado",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-25",
       "fecha_texto": "Dom 25/10",
       "fecha_larga": "domingo 25/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Domingo",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-10-31",
       "fecha_texto": "Sáb 31/10",
       "fecha_larga": "sábado 31/10",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Sábado",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      }
     ],
     "entran": [],
     "suma": {
      "horas": 6.5,
      "cifra": "6,5",
      "texto": "En noviembre tenés 6,5 horas a favor.",
      "detalle": ""
     }
    }
   }
  },
  "GET /mi-espacio/salidas?mes=2026-11": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
     "mes": "2026-11",
     "mes_texto": "Noviembre 2026",
     "hoy": "2026-11-03",
     "anterior": "2026-10",
     "siguiente": null,
     "sumar_a": "octubre",
     "dias": [
      {
       "fecha": "2026-11-02",
       "fecha_texto": "Lun 02/11",
       "fecha_larga": "lunes 02/11",
       "tipo": "feriado",
       "feriado": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches",
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-03",
       "fecha_texto": "Mar 03/11",
       "fecha_larga": "martes 03/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": true,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-04",
       "fecha_texto": "Mié 04/11",
       "fecha_larga": "miércoles 04/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-05",
       "fecha_texto": "Jue 05/11",
       "fecha_larga": "jueves 05/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-06",
       "fecha_texto": "Vie 06/11",
       "fecha_larga": "viernes 06/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-09",
       "fecha_texto": "Lun 09/11",
       "fecha_larga": "lunes 09/11",
       "tipo": "feriado",
       "feriado": "Visita de Su Santidad el Papa León XIV",
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-10",
       "fecha_texto": "Mar 10/11",
       "fecha_larga": "martes 10/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-11",
       "fecha_texto": "Mié 11/11",
       "fecha_larga": "miércoles 11/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-12",
       "fecha_texto": "Jue 12/11",
       "fecha_larga": "jueves 12/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-13",
       "fecha_texto": "Vie 13/11",
       "fecha_larga": "viernes 13/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-16",
       "fecha_texto": "Lun 16/11",
       "fecha_larga": "lunes 16/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-17",
       "fecha_texto": "Mar 17/11",
       "fecha_larga": "martes 17/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-18",
       "fecha_texto": "Mié 18/11",
       "fecha_larga": "miércoles 18/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-19",
       "fecha_texto": "Jue 19/11",
       "fecha_larga": "jueves 19/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-20",
       "fecha_texto": "Vie 20/11",
       "fecha_larga": "viernes 20/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-23",
       "fecha_texto": "Lun 23/11",
       "fecha_larga": "lunes 23/11",
       "tipo": "feriado",
       "feriado": "Día de la Soberanía Nacional",
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-24",
       "fecha_texto": "Mar 24/11",
       "fecha_larga": "martes 24/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-25",
       "fecha_texto": "Mié 25/11",
       "fecha_larga": "miércoles 25/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-26",
       "fecha_texto": "Jue 26/11",
       "fecha_larga": "jueves 26/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-27",
       "fecha_texto": "Vie 27/11",
       "fecha_larga": "viernes 27/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-30",
       "fecha_texto": "Lun 30/11",
       "fecha_larga": "lunes 30/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      }
     ],
     "fines_de_semana": [
      {
       "fecha": "2026-11-01",
       "fecha_texto": "Dom 01/11",
       "fecha_larga": "domingo 01/11",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Domingo",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      }
     ],
     "entran": [],
     "suma": {
      "horas": 0,
      "cifra": "0",
      "texto": "Todavía no sumaste horas extras en noviembre.",
      "detalle": ""
     }
    }
   }
  },
  "GET /mi-espacio/salidas?mes=2026-12": {
   "status": 400,
   "json": {
    "success": false,
    "error": "Elegí un mes válido.",
    "campo": "mes"
   }
  },
  "GET /mi-espacio/salidas": {
   "status": 200,
   "json": {
    "success": true,
    "data": {
     "modalidad": "contrato",
     "mes": "2026-11",
     "mes_texto": "Noviembre 2026",
     "hoy": "2026-11-03",
     "anterior": "2026-10",
     "siguiente": null,
     "sumar_a": "octubre",
     "dias": [
      {
       "fecha": "2026-11-02",
       "fecha_texto": "Lun 02/11",
       "fecha_larga": "lunes 02/11",
       "tipo": "feriado",
       "feriado": "Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches",
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-03",
       "fecha_texto": "Mar 03/11",
       "fecha_larga": "martes 03/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": false,
       "hoy": true,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-04",
       "fecha_texto": "Mié 04/11",
       "fecha_larga": "miércoles 04/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-05",
       "fecha_texto": "Jue 05/11",
       "fecha_larga": "jueves 05/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-06",
       "fecha_texto": "Vie 06/11",
       "fecha_larga": "viernes 06/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-09",
       "fecha_texto": "Lun 09/11",
       "fecha_larga": "lunes 09/11",
       "tipo": "feriado",
       "feriado": "Visita de Su Santidad el Papa León XIV",
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-10",
       "fecha_texto": "Mar 10/11",
       "fecha_larga": "martes 10/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-11",
       "fecha_texto": "Mié 11/11",
       "fecha_larga": "miércoles 11/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-12",
       "fecha_texto": "Jue 12/11",
       "fecha_larga": "jueves 12/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-13",
       "fecha_texto": "Vie 13/11",
       "fecha_larga": "viernes 13/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-16",
       "fecha_texto": "Lun 16/11",
       "fecha_larga": "lunes 16/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-17",
       "fecha_texto": "Mar 17/11",
       "fecha_larga": "martes 17/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-18",
       "fecha_texto": "Mié 18/11",
       "fecha_larga": "miércoles 18/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-19",
       "fecha_texto": "Jue 19/11",
       "fecha_larga": "jueves 19/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-20",
       "fecha_texto": "Vie 20/11",
       "fecha_larga": "viernes 20/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-23",
       "fecha_texto": "Lun 23/11",
       "fecha_larga": "lunes 23/11",
       "tipo": "feriado",
       "feriado": "Día de la Soberanía Nacional",
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-24",
       "fecha_texto": "Mar 24/11",
       "fecha_larga": "martes 24/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-25",
       "fecha_texto": "Mié 25/11",
       "fecha_larga": "miércoles 25/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-26",
       "fecha_texto": "Jue 26/11",
       "fecha_larga": "jueves 26/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-27",
       "fecha_texto": "Vie 27/11",
       "fecha_larga": "viernes 27/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      },
      {
       "fecha": "2026-11-30",
       "fecha_texto": "Lun 30/11",
       "fecha_larga": "lunes 30/11",
       "tipo": "habil",
       "feriado": null,
       "finde_texto": null,
       "licencia": null,
       "futuro": true,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      }
     ],
     "fines_de_semana": [
      {
       "fecha": "2026-11-01",
       "fecha_texto": "Dom 01/11",
       "fecha_larga": "domingo 01/11",
       "tipo": "finde",
       "feriado": null,
       "finde_texto": "Domingo",
       "licencia": null,
       "futuro": false,
       "hoy": false,
       "entrada": null,
       "salida": null,
       "nota": null,
       "al_mes_anterior": false,
       "horas": null,
       "horas_texto": "",
       "aviso": null
      }
     ],
     "entran": [],
     "suma": {
      "horas": 0,
      "cifra": "0",
      "texto": "Todavía no sumaste horas extras en noviembre.",
      "detalle": ""
     }
    }
   }
  }
 },
 "calculos": {
  "1": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "1 hora",
    "texto_reparto": "",
    "queda_texto": "Usás 1 hora a favor de noviembre. Te quedan 5,5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "2": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "2 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 2 horas a favor de noviembre. Te quedan 4,5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "3": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "3 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 3 horas a favor de noviembre. Te quedan 3,5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "4": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "4 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 4 horas a favor de noviembre. Te quedan 2,5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 5 horas a favor de noviembre. Te quedan 1,5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "6": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "6 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 6 horas a favor de noviembre. Te quedan 0,5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "7": {
   "error": {
    "campo": "horas",
    "mensaje": "En noviembre de 2026 te quedan 6,5 horas a favor."
   },
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "7 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 7 horas a favor de noviembre. Te quedan 0.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": null
  },
  "0.5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "0,5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 0,5 horas a favor de noviembre. Te quedan 6.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "1.5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "1,5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 1,5 horas a favor de noviembre. Te quedan 5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "2.5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "2,5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 2,5 horas a favor de noviembre. Te quedan 4.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "3.5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "3,5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 3,5 horas a favor de noviembre. Te quedan 3.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "4.5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "4,5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 4,5 horas a favor de noviembre. Te quedan 2.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "5.5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "5,5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 5,5 horas a favor de noviembre. Te quedan 1.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "6.5": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "6,5 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 6,5 horas a favor de noviembre. Te quedan 0.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": false,
    "avisos": [],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "dia_entero": {
   "error": null,
   "vista": {
    "dias_habiles": 1,
    "texto_dias": "7 horas",
    "texto_reparto": "",
    "queda_texto": "Usás 7 horas a favor de noviembre. Te quedan 0,5.",
    "antes_del_arranque": false,
    "texto_antes_del_arranque": "",
    "avisos": []
   },
   "paso": {
    "pasa": true,
    "avisos": [
     "Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa."
    ],
    "firmante": null,
    "sin_pasar_previsto": null
   }
  },
  "uso_0.5": {
   "error": {
    "campo": "desde",
    "mensaje": "Ese día no es hábil: elegí un día de lunes a viernes que no sea feriado."
   },
   "vista": null,
   "paso": null
  },
  "uso_1": {
   "error": {
    "campo": "desde",
    "mensaje": "Ese día no es hábil: elegí un día de lunes a viernes que no sea feriado."
   },
   "vista": null,
   "paso": null
  },
  "uso_1.5": {
   "error": {
    "campo": "desde",
    "mensaje": "Ese día no es hábil: elegí un día de lunes a viernes que no sea feriado."
   },
   "vista": null,
   "paso": null
  }
 }
};

// GENERADO por la maqueta (27/10/2026) con las funciones de verdad: services/miEspacioResumen.js (tablaDeHorasExtras) y
// public/js/mi-espacio.js (htmlDeTablaDeHorasAFavor y htmlDeNoUtilizadas), con la persona inventada de la maqueta. No editar a mano.
window.PESTANA_REAL = {
  "tabla": "<div class=\"me-tarjeta\"><div class=\"me-cabeza\"><h2>Horas extras y horas a favor de 2026</h2><span class=\"me-acciones\"><span class=\"me-segmento\" role=\"group\" aria-label=\"Año\"><button type=\"button\" data-anio=\"2024\" aria-pressed=\"false\">2024</button><button type=\"button\" data-anio=\"2025\" aria-pressed=\"false\">2025</button><button type=\"button\" data-anio=\"2026\" aria-pressed=\"true\">2026</button><button type=\"button\" data-anio=\"2027\" aria-pressed=\"false\">2027</button></span><button type=\"button\" class=\"sg-btn sg-btn-tinta sg-btn-chico\" data-cargar=\"horas\">Cargar horas extras</button></span></div><div class=\"me-tabla-marco\"><table class=\"me-tabla\"><thead><tr><th>Mes trabajado</th><th>Horas extras</th><th>A favor en</th><th>Usadas</th><th>Situación</th></tr></thead><tbody><tr><td><button type=\"button\" class=\"me-mes-boton\" data-mes=\"2026-10\" aria-pressed=\"true\">Octubre 2026</button></td><td class=\"num\">18 h</td><td>Noviembre 2026</td><td class=\"num\">—</td><td><span class=\"me-insignia gris\">El mes sigue sumando</span></td></tr><tr><td><button type=\"button\" class=\"me-mes-boton\" data-mes=\"2026-09\" aria-pressed=\"false\">Septiembre 2026</button></td><td class=\"num\">10,5 h</td><td>Octubre 2026</td><td class=\"num\">9 h<small>09/10: 7 h · 20/10: 2 h</small></td><td><span class=\"me-insignia ambar\">1,5 h para usar hasta el 30/10</span></td></tr><tr class=\"tenue\"><td><button type=\"button\" class=\"me-mes-boton\" data-mes=\"2026-08\" aria-pressed=\"false\">Agosto 2026</button></td><td class=\"num\">2,5 h</td><td>Septiembre 2026</td><td class=\"num\">—</td><td>2,5 h no utilizadas previamente</td></tr></tbody></table></div><p class=\"me-nota\">Cada hora extra de un mes es una hora menos de trabajo el mes siguiente, de a media hora. 7 horas son el día entero.</p></div>",
  "noUtilizadas": "<div class=\"me-tarjeta\"><div class=\"me-cabeza\"><h3>Horas no utilizadas previamente</h3><span>5,5 horas en 2026</span></div><ul class=\"me-lista\"><li class=\"me-fila me-fila-dos\"><span class=\"me-fila-fecha\">Septiembre 2026</span><span class=\"me-fila-cuerpo\">2,5 horas<span class=\"me-detalle\">de las extras de agosto</span></span></li><li class=\"me-fila me-fila-dos\"><span class=\"me-fila-fecha\">Del saldo inicial</span><span class=\"me-fila-cuerpo\">3 horas</span></li></ul><p class=\"me-nota\">Quedan a la vista aunque su mes ya pasó. Vuelven a cero el 1/1.</p><div class=\"me-uso\"><p class=\"me-nota\">Si te autorizan a tomarlas, registrá un uso autorizado: se descuentan primero las más viejas.</p><button type=\"button\" class=\"sg-btn sg-btn-borde sg-btn-chico\" data-abrir=\"uso\">Registrar un uso autorizado</button></div></div>",
  "meses": [
    {
      "mes": "2026-10",
      "mes_texto": "Octubre 2026",
      "horas_texto": "18 h",
      "a_favor_texto": "Noviembre 2026",
      "usadas_texto": "—",
      "usadas_detalle": "",
      "estado": "sumando",
      "situacion": "El mes sigue sumando"
    },
    {
      "mes": "2026-09",
      "mes_texto": "Septiembre 2026",
      "horas_texto": "10,5 h",
      "a_favor_texto": "Octubre 2026",
      "usadas_texto": "9 h",
      "usadas_detalle": "09/10: 7 h · 20/10: 2 h",
      "estado": "en_uso",
      "situacion": "1,5 h para usar hasta el 30/10"
    },
    {
      "mes": "2026-08",
      "mes_texto": "Agosto 2026",
      "horas_texto": "2,5 h",
      "a_favor_texto": "Septiembre 2026",
      "usadas_texto": "—",
      "usadas_detalle": "",
      "estado": "no_utilizadas",
      "situacion": "2,5 h no utilizadas previamente"
    }
  ]
};

// Contenido de las Notas Digitales: textos fijos, estructura de la nota y versiones HTML y texto plano.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6)
import { formatoCorto, formatoLargo, mesYAnio, diasEntre } from './notasDigitalesCalendario.js';

const REF = 'Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal';
const DESTINATARIO = 'DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL';
const REMITENTE = 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN';

const PARRAFO_INICIAL = {
  aviso: {
    interna: 'Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación, publicados en el Portal de Datos Abiertos Municipal, requieren ser actualizados. Solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.',
    externa: 'Informo a Ud. que los conjuntos de datos detallados a continuación, publicados en el Portal de Datos Abiertos Municipal y provistos por otras áreas municipales y organismos, requieren ser actualizados. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).'
  },
  reiteracion: {
    interna: 'Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos de gestión interna informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.',
    externa: 'Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).'
  }
};

const SECCIONES = {
  proximo: {
    titulo: 'Próximos a vencer',
    introduccion: 'Los siguientes conjuntos de datos se encuentran próximos a cumplir su plazo de actualización:'
  },
  vencido: {
    titulo: 'Plazo de actualización vencido',
    introduccion: 'Los siguientes conjuntos de datos se encuentran con su plazo de actualización vencido:'
  }
};

const JUSTIFICACION = {
  aviso: [
    'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos, tanto de áreas municipales como de organismos externos, en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar).',
    'Cabe destacar que Comodoro Rivadavia se encuentra entre los primeros puestos del Índice Nacional de Datos Abiertos. En este marco, mantener la información actualizada contribuye directamente a sostener y fortalecer este posicionamiento.',
    'La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, o vía WhatsApp al +54 9 2974 05-6894. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.'
  ],
  reiteracion: [
    'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar). La información actualizada puede ser remitida a datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, o vía WhatsApp al +54 9 2974 05-6894, y será publicada en cumplimiento del Artículo 9° de la mencionada ordenanza.'
  ]
};

const CAMPOS_CONTACTO = [
  ['area_superior', 'Depende de'],
  ['email_principal', 'Email'],
  ['email_secundario', 'Email alternativo'],
  ['telefono_area', 'Teléfono'],
  ['celular_area', 'Celular'],
  ['nombre_contacto', 'Persona de contacto'],
  ['telefono_contacto', 'Teléfono de contacto'],
  ['email_contacto', 'Email de contacto']
];

export const escapeHtml = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const urlSegura = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null);
const cantidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

const textoNumero = ({ numero, anio, esPrueba = false }) => {
  if (esPrueba) return 'PRUEBA';
  if (numero == null) return 'XX';
  return `${numero}/${String(anio).slice(-2)}`;
};

const situacion = (vencimiento, fecha) => {
  const dias = diasEntre(fecha, vencimiento);
  if (dias > 0) return `Faltan ${cantidad(dias, 'día', 'días')}`;
  if (dias === 0) return 'Vence hoy';
  return `Vencido hace ${cantidad(-dias, 'día', 'días')}`;
};

const textoInformado = (dataset) => {
  if (!dataset.informado) return '—';
  const { numero, anio, fecha } = dataset.informado;
  const base = `Nota Digital N° ${textoNumero({ numero, anio })} (${formatoCorto(fecha)})`;
  return dataset.reiteraciones > 0 ? `${base} – reiterado ${cantidad(dataset.reiteraciones, 'vez', 'veces')}` : base;
};

const textoAntecedente = (antecedente) => {
  if (!antecedente) return null;
  if (antecedente.cantidad === 1) {
    return `Antecedente: notificado a la DGMIT por correo electrónico el ${formatoCorto(antecedente.primera)}.`;
  }
  return `Antecedente: notificado a la DGMIT por correo electrónico en ${antecedente.cantidad} oportunidades, entre el ${formatoCorto(antecedente.primera)} y el ${formatoCorto(antecedente.ultima)}.`;
};

export const construirNota = ({ tipo, gestion, numero = null, anio = null, esPrueba = false, fecha, datasets, areas = [], config }) => {
  const numeroTexto = textoNumero({ numero, anio, esPrueba });
  const ref = `${tipo === 'reiteracion' ? 'Reiteración – ' : ''}${REF}`;
  const asunto = `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${ref} (gestión ${gestion} – ${mesYAnio(fecha)})`;

  const secciones = ['proximo', 'vencido'].map((clave) => {
    const incluidos = datasets.filter(d => (d.vencimiento < fecha ? 'vencido' : 'proximo') === clave);
    const columnas = ['Conjunto de datos', gestion === 'externa' ? 'Área responsable' : 'Área', 'Frecuencia',
      'Última actualización', clave === 'vencido' ? 'Venció' : 'Vence', 'Situación'];
    if (tipo === 'reiteracion') columnas.push('Informado en');
    const filas = incluidos.map((d) => {
      const valores = [d.titulo, d.area_nombre, d.frecuencia_nombre, formatoCorto(d.ultima_actualizacion),
        formatoCorto(d.vencimiento), situacion(d.vencimiento, fecha)];
      if (tipo === 'reiteracion') valores.push(textoInformado(d));
      return {
        valores,
        url: urlSegura(d.url_dataset),
        antecedente: tipo === 'aviso' ? textoAntecedente(d.antecedente) : null
      };
    });
    return { clave, ...SECCIONES[clave], columnas, filas };
  }).filter(seccion => seccion.filas.length > 0);

  const contactos = gestion === 'externa'
    ? areas.map((area) => {
      const lineas = CAMPOS_CONTACTO
        .filter(([campo]) => String(area[campo] ?? '').trim())
        .map(([campo, etiqueta]) => `${etiqueta}: ${area[campo]}`);
      return { nombre: area.nombre, lineas: lineas.length ? lineas : ['Sin datos de contacto registrados'] };
    })
    : [];

  return {
    tipo,
    gestion,
    esPrueba,
    fecha,
    numeroTexto,
    asunto,
    ref,
    destinatario: DESTINATARIO,
    parrafoInicial: PARRAFO_INICIAL[tipo][gestion],
    secciones,
    contactos,
    justificacion: JUSTIFICACION[tipo],
    remitente: REMITENTE,
    fechaLarga: formatoLargo(fecha),
    firma: { nombre: config.firma_nombre ?? '', cargo: config.firma_cargo ?? '' },
    lineaCc: (gestion === 'externa' ? config.linea_cc_externa : config.linea_cc_interna) ?? ''
  };
};

const ESTILO_CELDA = 'border:1px solid #000000;padding:5px 6px;vertical-align:top;text-align:left;';

export const renderHtml = (nota) => {
  const parrafo = (texto) => `<p style="margin:0 0 12px;text-align:justify;">${escapeHtml(texto)}</p>`;

  const tabla = (seccion) => {
    const encabezado = seccion.columnas.map(c => `<th style="${ESTILO_CELDA}font-weight:bold;">${escapeHtml(c)}</th>`).join('');
    const filas = seccion.filas.map((fila) => {
      const [titulo, ...resto] = fila.valores;
      const celdaTitulo = fila.url
        ? `<a href="${escapeHtml(fila.url)}" style="color:#000000;">${escapeHtml(titulo)}</a>`
        : escapeHtml(titulo);
      const principal = `<tr><td style="${ESTILO_CELDA}">${celdaTitulo}</td>${resto.map(v => `<td style="${ESTILO_CELDA}">${escapeHtml(v)}</td>`).join('')}</tr>`;
      const antecedente = fila.antecedente
        ? `<tr><td colspan="${seccion.columnas.length}" style="${ESTILO_CELDA}font-style:italic;font-size:12px;">${escapeHtml(fila.antecedente)}</td></tr>`
        : '';
      return principal + antecedente;
    }).join('');
    return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 16px;"><tr>${encabezado}</tr>${filas}</table>`;
  };

  const secciones = nota.secciones
    .map(s => `<p style="margin:16px 0 6px;"><b>${escapeHtml(s.titulo)}</b></p>${parrafo(s.introduccion)}${tabla(s)}`)
    .join('\n');

  const contactos = nota.contactos.length
    ? `<p style="margin:16px 0 6px;"><b>Datos de contacto de las áreas responsables</b></p>${nota.contactos
      .map(c => `<p style="margin:0 0 10px;"><b>${escapeHtml(c.nombre)}</b><br>${c.lineas.map(escapeHtml).join('<br>')}</p>`)
      .join('')}`
    : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(nota.asunto)}</title></head>
<body style="margin:0;padding:24px;background:#ffffff;">
<div style="max-width:760px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#000000;">
<p style="margin:0 0 4px;"><b><u>REF.:</u></b> "${escapeHtml(nota.ref)}"</p>
<p style="margin:0 0 24px;text-align:right;"><b>Nota Digital N°</b> ${escapeHtml(nota.numeroTexto)}</p>
<p style="margin:0 0 16px;"><b><u>${escapeHtml(nota.destinatario)}</u></b></p>
${parrafo(nota.parrafoInicial)}
${secciones}
${contactos}
<p style="margin:16px 0 6px;"><b>Justificación:</b></p>
${nota.justificacion.map(parrafo).join('\n')}
<p style="margin:24px 0 0;"><b><u>${escapeHtml(nota.remitente)}</u></b>, ${escapeHtml(nota.fechaLarga)}.</p>
<p style="margin:32px 0 0;text-align:right;">${escapeHtml(nota.firma.nombre)}<br>${escapeHtml(nota.firma.cargo)}</p>
<p style="margin:24px 0 0;">${escapeHtml(nota.lineaCc)}</p>
</div></body></html>`;
};

export const renderTexto = (nota) => {
  const lineas = [`REF.: "${nota.ref}"`, `Nota Digital N° ${nota.numeroTexto}`, '', nota.destinatario, '', nota.parrafoInicial, ''];
  for (const seccion of nota.secciones) {
    lineas.push(seccion.titulo, seccion.introduccion, '');
    for (const fila of seccion.filas) {
      lineas.push(`- ${fila.valores[0]}${fila.url ? ` (${fila.url})` : ''}`);
      seccion.columnas.slice(1).forEach((columna, i) => lineas.push(`    ${columna}: ${fila.valores[i + 1]}`));
      if (fila.antecedente) lineas.push(`    ${fila.antecedente}`);
    }
    lineas.push('');
  }
  if (nota.contactos.length) {
    lineas.push('Datos de contacto de las áreas responsables');
    for (const contacto of nota.contactos) lineas.push(contacto.nombre, ...contacto.lineas.map(l => `    ${l}`));
    lineas.push('');
  }
  lineas.push('Justificación:', ...nota.justificacion, '', `${nota.remitente}, ${nota.fechaLarga}.`, '',
    nota.firma.nombre, nota.firma.cargo, '', nota.lineaCc);
  return lineas.join('\n');
};

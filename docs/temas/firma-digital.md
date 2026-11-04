# Firma digital de las Notas Digitales

La nota se baja, se firma afuera y se vuelve a subir, todo antes de que salga el email, con un interruptor en Correos → Estado.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-03-notas-firma-digital-design.md`

## Archivos

`services/notasFirmaDigital.js` (la firma digital de las notas, pura: qué nota espera, si un PDF subido es esa nota firmada y la línea del email).

## Firma digital de las Notas Digitales (spec 2026-11-03-notas-firma-digital)

- Qué es: quien firma tiene firma digital remota, sin token, y el Firmador no se puede integrar: la nota se baja, se firma y se vuelve a subir, todo antes de que salga el email.
  El archivo vuelve como `document.pdf`: el RPAD la reconoce por su contenido y la envía con el nombre de la nota (`Nota-Digital-8-26.pdf`).
  Un interruptor en Correos → Estado, «Firma digital de las notas» (`firma_digital_activa`, apagado de entrada): apagado, ninguna nota nueva espera y salen las mismas notas que sin la firma digital, con sus números, datasets, destinatarios y fechas; apagarlo no suelta las que ya esperan: cada una sigue su bandera y sale a las 14:00 (spec, 4.12).
  Antiobjetivos: que salga una nota que no es la que se quiso firmar, que una nota se quede sin salir porque nadie la firmó, y que lo ya enviado cambie.
  La verificación evita errores, no un fraude (quien sube ya es de administración): no comprueba la cadena de confianza ni la revocación, ni que haya firmado quien debía (el nombre del certificado se muestra).
- La ventana, el mismo día (decisión del usuario): la corrida es a las 8:05 (la Tarea Cron; en producción, a las 8:15 hasta que se despliegue el kit de la firma digital: `docs/temas/despliegue.md`) y a las 14:00 sale lo que quede.
  Con el interruptor prendido, cada nota que genera la corrida, de cualquier tipo, pasa por `enviarOEsperar`:
  `debeEsperarFirma({ activa, ahora, quienFirma })` deja la nota pendiente con `espera_firma = 1` en lugar de enviarla, y `avisarLasQueEsperan` le manda a quien firma un email (`notasParaFirmarTemplate`) con las notas adjuntas, sin los anexos, que no se firman.
  Quien firma es quien presenta (`quienFirmaLaNota`, `presentada_por_id ?? firmante_id`: con la licencia del titular, la persona autorizada); si está desactivada, sin un email válido o de licencia, la nota no espera y sale en la misma corrida, con la imagen de la firma.
  Una corrida a las 14:00 o después tampoco espera (`paso14`).
  Si ese email no sale, las notas siguen esperando y queda en la última corrida.
- Subir (Correos → Libro, la tarjeta «Notas para firmar hoy», `#nd-para-firmar`, de `htmlDeParaFirmar`): cada nota con «Ver» y «Subir firmada» en su fila, porque el usuario quiere elegir cuál es cuál; lo sube cualquiera de administración.
  `POST /api/notificaciones/notas-digitales/:id/firmada` (`authMiddleware` + `adminOnly`, multer en memoria, campo `archivo`, 10 MB): con `solo_verificar=1` no escribe nada y la página abre `#modal-firmada` con el PDF subido, el número, el nombre y la fecha de la firma;
  «Confirmar» lo vuelve a mandar y se guarda (`pdf_firmado`, `firmado_por`, `firmado_at` y `firma_subida_por`), bajo el candado de las Notas.
  Una nota que ya no espera da 409 (`MENSAJE_NOTA_YA_SALIO` o `MENSAJE_NOTA_YA_NO_ESPERA`) y otra corrida en curso, 409 con `MENSAJE_CORRIDA_EN_CURSO`.
- La verificación (`verificarNotaFirmada(subido, nota, otras)` de `services/notasFirmaDigital.js`, pura, nunca tira, sin dependencias nuevas): el Firmador agrega la firma al final, como una actualización incremental, así que lo subido empieza con los bytes exactos del PDF de la nota:
  `firmada` (con `firmado_por`, el CN del certificado, y `firmado_at`, el `signingTime`), `sin_firma`, `firma_invalida` (`/ByteRange` que no cubre todo, un byte cambiado, bytes de más, un CMS que no verifica), `con_cambios` (lo agregado es más de una actualización, más de un `%%EOF`: se guardó el PDF antes de firmarlo, con un comentario o «Fill & Sign», y la hoja puede ser otra;
  una nota firmada dos veces también cae acá), `otra_nota` (es otra de `otras`, las de los últimos 31 días o las que esperan:
  «Ese PDF es la Nota Digital N° 9/26, no la 8/26.
  No se guardó nada.») o `no_es`.
  El lector de DER es chico y propio (`crypto.X509Certificate` y `createVerify`); los ceros de relleno de `/Contents` se ignoran, y prueba todos los certificados del CMS.
- Enviar:
  «Enviar las N firmadas» (`POST /api/notificaciones/notas-digitales/firmadas/enviar`, `{ ids }`, los que mostraba la pantalla) y, a las 14:00, `enviarLasQueEsperanFirma`, antes del recordatorio y aislada: sale lo que quede, firmada si se subió y si no con la imagen.
  Intenta tomar el candado hasta 6 veces, cada 5 segundos (el SMTP de un envío manual tarda); si sigue ocupado, responde 207, lo anota y la toma la mañana siguiente.
  Un día no hábil (un feriado cargado con la nota ya generada), con el envío apagado o con la configuración incompleta no envía nada a las 14:00: una nota de un día anterior sale en la corrida siguiente, firmada si se subió y si no con la imagen.
  `enviarNota` adjunta `pdf_firmado ?? pdf` con el mismo nombre (`Nota-Digital-8-26.pdf`), suma al email, sin guardarla, la línea «La nota está firmada digitalmente por X.» (`conLineaDeFirma`) y pone `espera_firma = 0`, salga o no.
  El Libro baja la firmada (`descargarPdf`) y dice «Firmada digitalmente por X»; el Word sale del `html` guardado, y «Reintentar» de una que espera da 409 (`MENSAJE_ESPERA_FIRMA`).
  Sin nada para enviar, las 14:00 no toman el candado: con el interruptor apagado y ninguna nota esperando, esa corrida solo manda los recordatorios de cambios pendientes y su respuesta no trae `firma_digital`.
- Lo demás:
  Correos → Estado trae `firma_digital_activa`, `para_firmar` y la alerta `para-firmar` («Hay 2 notas para firmar.
  Las que no se suban antes de las 14:00 salen con la imagen de la firma.», `textoDeLaAlertaDeFirma`, que cuenta aparte las firmadas sin enviar) y, si una sigue esperando pasadas las 14:15 (`esperaDeMas`, `HORA_DE_LA_ALERTA_DE_FIRMA`) o es de un día anterior, `para-firmar-atrasada` (`alertaDeLasAtrasadas`):
  `error` si la Tarea Cron de las 14:00 no corrió o el envío automático está apagado, y advertencia un día no hábil; esa corrida no es una más.
  Entre las 8:05 y la subida, la nota figura «Pendiente de envío» en el Seguimiento;
  Métricas cuenta por día, así que nada cambia.
  Los números salen al generarse: la 8/26 tiene ese número aunque salga a las 14:00.
  `enviada_at` es `NOW()` de la base.
- Límites sabidos:
  «Enviar» manda solo los ids, así que si otra sesión reemplazó el PDF firmado mientras tanto, sale el último (siempre es esa nota, firmada); y la firma no se compara con quien debía firmar: lo que se ve es el nombre del certificado.
- Datos de prueba:
  `tests/fixtures/firma-digital/`, que lee `notas-firma-digital.test.js`: PDF y firmas con datos inventados, de `generar.mjs`, que se corrió una vez a mano; la clave privada no se guarda.
  Las firmas reales del usuario nunca van al repositorio.

## Archivos de tests

`notas-firma-digital.test.js`, `notas-firma-digital-motor.test.js`, `notas-firma-digital-api.test.js`, `correos-frontend.test.js`, `paginas.test.js`, `schema.test.js`, `email-diseno.test.js`

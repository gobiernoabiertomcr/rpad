# Firma digital de las Notas Digitales

Fecha: 03/11/2026. Estado: decidida por el usuario. Maqueta aprobada, con datos inventados, en
`docs/superpowers/specs/2026-11-03-notas-firma-digital-mockups/` (`correos.html`, `mail-firmante.html`,
`mail-destinatarios.html`).

## 1. Qué es

Hoy las Notas Digitales se generan y se envían solas en la corrida de la mañana, con una imagen de la firma. El usuario tiene
firma digital remota sin token y quiere que salgan firmadas de verdad. La firma la hace una persona, en un sitio externo, así
que el RPAD tiene que esperarla.

La solución es una **ventana de firma el mismo día**, que se prende con un interruptor:

1. A las **8:05** el RPAD genera las notas. Las que llevan firma digital no se envían: le llegan por mail a quien firma, adjuntas.
2. Esa persona las firma en el Firmador, de a una, y sube cada una **en la fila de su nota** (decisión del usuario). El RPAD
   comprueba que el archivo sea esa nota: si no, lo rechaza y dice cuál es.
3. Si es esa nota, se abre un modal con el PDF, para leerlo, y ahí se confirma (decisión del usuario). Al confirmar, la fila muestra quién firmó y «Ver». Todavía no sale nada.
4. Con «Enviar las N firmadas» salen, con el nombre de siempre, y quedan archivadas firmadas en el Libro.
5. A las **14:00** sale lo que quede: firmada, si se subió y no se confirmó; si no, con la imagen de la firma, como hoy.

Con el interruptor apagado (de entrada), todo sigue igual, salvo la hora de la corrida (sección 5).

**Antiobjetivos:**
- Que una nota espere más de un día y rompa lo que depende de que salga: la autorización, la víspera, la auditoría, los 20 días
  de la reiteración, las fechas y el número (sección 3).
- Que salga la nota equivocada o un PDF sin firmar diciendo que está firmado.
- Que cambie lo que ya se envió: las notas quedan en bytes y el PDF original no se toca.
- Que el RPAD guarde o pida la contraseña, el PIN o el OTP de nadie.
- Un nombre real o una nota real en el repositorio.

## 2. Lo que dicen las fuentes y la nota de prueba

**El firmador** (leído el 03/11/2026; `firmar.gob.ar` no se puede leer de forma automática, así que vale el instructivo oficial):
- La firma remota se usa [«únicamente» a través del Firmador](https://www.argentina.gob.ar/servicio/solicitar-firma-digital-remota-sin-token).
- Cada firma pide CUIL y contraseña, un OTP de 6 dígitos y el PIN, y devuelve `document.pdf`
  ([instructivo](https://www.argentina.gob.ar/sites/default/files/instructivo_firmador_pfdr.pdf)). El usuario confirmó que firma de a uno.
- Hay una integración por API, pero [igual firma una persona](https://documentacion.siu.edu.ar/documentos/docs/firma-digital-firmar/)
  y [pide ser Autoridad de Registro](https://www.argentina.gob.ar/jefatura/innovacion-ciencia-y-tecnologia/innovacion/firma-digital/pfdr/autoridades-de-registro-pfdr):
  oficiales, tokens, lector biométrico y examen. Se descartó: no evita el paso humano y es desproporcionada para este hosting.
- Quien recibe valida en el [validador oficial](https://www.argentina.gob.ar/servicio/valida-los-documentos-electronicos-firmados-digitalmente)
  o en Adobe, [instalando la cadena de confianza](https://www.argentina.gob.ar/sites/default/files/config_adobe_reader_22052024.pdf).

**El valor de la nota** (solo citas; el alcance para un municipio conviene consultarlo con Legal):
- [Ley 25.506](https://servicios.infoleg.gob.ar/infolegInternet/anexos/70000-74999/70749/texact.htm): la firma digital satisface
  la exigencia de firma manuscrita (art. 3), con presunción de autoría e integridad (arts. 7 y 8).
- La [guía de preguntas frecuentes](https://jusmendoza.gob.ar/wp-content/uploads/2023/04/Preguntas-Frecuentes-sobre-Firma-Digital.pdf)
  lista la firma escaneada como lo que no es firma digital, y dice que impresa no tiene valor legal ni probatorio.
- La [Ley 5.366 de Chubut](https://www.informatica-juridica.com/anexos/legislacion-informatica-de-argentina-chubut-ley-5-366-de-5-de-julio-de-2005-sobre-adhesion-provincial-a-la-ley-nacional-25506-sobre-firma-digital/)
  adhiere para los tres Poderes provinciales y no nombra a los municipios. No se halló una ordenanza de Comodoro.

**Cuatro notas reales firmadas por el usuario, con sus originales** (no se versionan). Comparadas con el PDF que generó el RPAD:
- Son una **actualización incremental**: sus primeros bytes son idénticos al PDF original, y la firma va agregada al final.
  Comprobado byte por byte. Cada firmada coincide con una sola nota, también la que todavía está en la hoja vieja (216 × 330).
- **Los nombres no dicen cuál es:** `document.pdf` era la 5/26 y `document-1.pdf`, la 4/26. Las cuatro se firmaron en menos de 2 minutos.
- `adbe.pkcs7.detached`, `Adobe.PPKLite`, agregada con iText 2.1.7. RSA con SHA-256. La firma verifica contra los rangos de `/ByteRange`.
- **Es invisible:** el widget tiene `/Rect [0 0 0 0]`. La hoja no cambia y sigue en oficio (612 × 1008).
- Sin sello de tiempo (`unsignedAttrs` ausente): la fecha es el `signingTime` que declara la firma.
- Un solo certificado en el CMS, emitido por `AC MODERNIZACION-PFDR`, con el nombre de la persona en `CN`.
- Crece unos 32 KB por el espacio reservado para la firma: `/Contents` tiene siempre 30000 hexadecimales y el CMS, unos 2200 bytes, seguidos de ceros de relleno.
- Un prototipo de la verificación de la sección 4.6 pasó con las cuatro: el `messageDigest` y la firma RSA verifican, el certificado se lee con `crypto`, y un byte cambiado se rechaza.

## 3. Por qué el mismo día

El motor (`services/notasDigitales.js`) da por hecho que generar y enviar pasan en el mismo instante. Si la espera cruza de día:
- `nota_autorizacion_id` se registra al generar: las notas de la licencia citarían una autorización que nadie recibió.
- La víspera de una licencia es un día exacto y solo la puede firmar quien se va. Después esos datasets salen en su fecha, y la
  anticipada llegaría duplicada.
- Una vez en canal de nota, un cambio sale del recordatorio de las 14:00: sin enviar, nadie lo ve durante 5 días hábiles.
- Los 20 días corren desde `fecha` o `cuenta_desde`, nunca desde `enviada_at`. Un aviso de hace 15 días se reiteraría 5 días
  después de recibido.
- La fecha, los «faltan N días» y los destinatarios se congelan al generar, y no hay forma de anular una nota: el número queda gastado.

Con la ventana, nada de eso pasa: toda nota sale el día en que se generó. El usuario propuso generar el día hábil anterior, y se
descartó porque la nota quedaría congelada hasta 3 días: un dataset actualizado esa tarde, una licencia o un asueto cargados ese
día, un cambio aprobado. Y todas las reglas del motor correrían con «mañana» como «hoy».

Lo que cambia con la ventana: las notas salen más tarde dentro del mismo día. `enviada_at` y el Seguimiento dicen la hora real,
Métricas cuenta por día, y entre las 8:05 y la subida la nota figura como «Pendiente de envío» en el Seguimiento. El anexo de la
reiteración dice «enviada» con la hora de generación, como hoy.

## 4. Las reglas

**4.1 Qué notas esperan.** Una nota generada por la corrida espera la firma si se cumple todo esto (`debeEsperarFirma`):
- El interruptor (`notas_digitales_config.firma_digital_activa`) está prendido.
- No es de prueba.
- Es antes de las 14:00 (`HORA_LIMITE_DE_FIRMA`): una corrida manual más tarde no deja una nota esperando hasta el día siguiente.
- Hay quien la firme: `presentada_por_id ?? firmante_id` (la persona autorizada durante la licencia del titular; si no, el
  titular), activa, con un email válido y sin licencia hoy.

La persona autorizada firma con su propia firma digital: el usuario confirmó que la tiene o la va a tener. Si no, la nota sale como hoy. Por ejemplo: con la firma de Correos sin titular elegido, o una autorización tardía con el titular
ya de licencia. Valen para las cuatro clases: aviso, reiteración, autorización y auditoría (decisión del usuario).

**4.2 Solo se firma la nota.** El anexo viaja adjunto, como hoy, sin firma propia (decisión del usuario).

**4.3 La imagen de la firma sigue.** La firma digital es invisible: sin la imagen, la nota se vería sin firmar. Las dos firmas de la persona autorizada no cambian;
la firma digital es la de quien presenta.

**4.4 El mail a quien firma.** Al terminar la corrida, un mail por persona con todas sus notas del día, adjuntas (solo la nota,
con el nombre `Nota-Digital-N-AA.pdf`), con `remitente()` y el marco de siempre. Asunto: «RPAD: hoy tenés 2 notas para firmar»
(«1 nota»). Texto, el de `mail-firmante.html`, con el botón «Subir las notas firmadas» → `correos.html#libro`, que abre la pestaña Libro. Si el mail no sale,
la nota sigue esperando y el error queda en la última corrida. No hay recordatorio.

**4.5 La subida.** `POST /api/notificaciones/notas-digitales/:id/firmada`, multipart, campo `archivo`, un archivo de hasta 10 MB, en memoria.
`authMiddleware` + `adminOnly`: cualquiera de administración (decisión del usuario). Toma el candado de las notas; con otra corrida en
curso, 409 y no guarda nada. **Cada nota tiene su botón** (decisión del usuario: que elija la persona y el RPAD controle; no hay una
subida de varios juntos). **No guarda hasta confirmar, y no envía:** la página manda el archivo con `solo_verificar=1` (el servidor no escribe nada) y, si es esa nota, abre el modal «Revisá la nota firmada»: el archivo elegido en un `<iframe>` con un `blob:` del archivo local, «Es la Nota Digital N° 12/26, firmada digitalmente por X el dd/mm a las hh:mm. La firma no se ve en la hoja. Sale como Nota-Digital-12-26.pdf.», «Cancelar» y «Confirmar». «Confirmar» manda el mismo archivo sin `solo_verificar`: el servidor lo vuelve a verificar y lo guarda (sin archivos temporales ni estado entre los dos pedidos). Un archivo que no sirve no abre el modal: el mensaje va a la fila.
Volver a subir una nota que ya tiene su firmada la reemplaza («Reemplazar»), mientras no haya salido. Los resultados:

| Caso | Mensaje | Qué hace |
|------|-----------|----------|
| Bien, al verificar | abre el modal | nada |
| Bien, al confirmar | «Guardada. Falta enviarla.» | guarda, sin enviar |
| El PDF de otra nota | «Ese PDF es la Nota Digital N° 13/26, no la 12/26. No se guardó nada.» | nada |
| Es esta nota, sin firma | «Ese PDF es esta nota, pero no tiene firma digital. Firmala y volvé a subirla.» | nada |
| Firma que no verifica | «La firma de ese PDF no se pudo verificar. Volvé a firmarla.» | nada |
| Otra cosa | «Ese PDF no es esta nota. No se guardó nada.» | nada |
| La nota ya salió, o no existe | 409 «Esta nota ya salió.» / 404 | nada |

Un archivo con otro firmador que reescriba el PDF cae en «otra cosa»: el RPAD solo acepta firmas agregadas al final, que es lo que
hace el Firmador.

**¿Se puede equivocar de nota?** No puede guardar una por otra: la persona elige la fila y el RPAD compara el archivo con el PDF guardado de esa nota, byte por
byte (cada PDF lleva su número y su fecha de creación). Si no coincide, no guarda nada, y si coincide con otra nota de las que se pueden nombrar, lo dice. El modal y «Ver» sirven para leerla y ver quién firmó antes de
que salga.

**El envío.** `POST /api/notificaciones/notas-digitales/firmadas/enviar` con `{ ids: [12, 13] }`, las que mostraba la pantalla (así no sale una
que se subió desde otra sesión y nadie vio). Bajo el candado, envía las de esa lista que siguen con `espera_firma = 1` y `pdf_firmado`. Un botón
para todas (decisión del usuario). Da un resultado por nota: «enviada, firmada digitalmente.» o «quedó firmada, pero el email no salió. Se vuelve a intentar en la próxima corrida.»

**El nombre del archivo.** El nombre con que llega el archivo (`document.pdf`, `documento.pdf`, lo que sea) no se usa ni se guarda. El email adjunta siempre `Nota-Digital-N-AA.pdf` y el Libro baja ese mismo nombre, firmada o no.

**Ver.** Toda fila tiene «Ver» (decisión del usuario: para saber qué nota es): sin firmar, abre la nota que generó el RPAD, con «Bajar PDF» en el pie; firmada, lo que se subió. Con `GET …/:id/pdf` (`pdf_firmado ?? pdf`), en un `<iframe>` con un `blob:`, como Proyectos (la CSP ya lo permite: `frameSrc` incluye `blob:`), dentro de un modal con «Firmada digitalmente por X el dd/mm a las hh:mm», «Descargar» (en el teléfono un PDF no siempre se ve en el marco) y «Cerrar».

**4.6 Cómo sabe el RPAD que está firmada** (`services/notasFirmaDigital.js`, puro, sin dependencias nuevas; nunca tira):
1. El archivo empieza con los bytes exactos del `pdf` guardado de la nota y es más largo. Con eso se identifica la nota.
2. En lo agregado hay un `/ByteRange [0 b c d]` (el último), con `b` ≥ el largo del original y `c + d` igual al largo del archivo:
   la firma cubre todo, y no hay nada después.
3. `/Contents` es un CMS `SignedData` que se puede leer (un lector de DER chico, que lee el largo del primer elemento e ignora los ceros de relleno que siguen): el `messageDigest` es el hash de los rangos, y la
   firma verifica con la clave pública de su certificado (`crypto`). SHA-256, SHA-384 o SHA-512.
4. Del certificado salen `firmado_por` (el `CN`, tal cual) y, de `signingTime`, `firmado_at`.

**No comprueba** la cadena de confianza ni la revocación: eso lo hace el validador oficial. Tampoco compara el nombre del
certificado con el de quien tenía que firmar: lo muestra (el `CN` no coincide letra por letra con `nombre_completo`, y un rechazo
falso dejaría a la nota sin firma). Esta validación evita errores, no un fraude: quien sube ya es de administración.

**4.7 Lo que queda guardado.** En `notas_digitales`: `espera_firma`, `pdf_firmado`, `firmado_por`, `firmado_at`, `firma_subida_por`. `espera_firma` sigue en 1 hasta que la nota sale.
`pdf` no se toca. El envío, «PDF» del Libro y la descarga desde el Seguimiento usan `pdf_firmado ?? pdf`. El Word y `html` no cambian.

**4.8 El email a los destinatarios.** Con `pdf_firmado`, `enviarNota` suma una línea justo debajo de la primera, en el HTML y en el
texto: «La nota está firmada digitalmente por X.», escapada. Se arma al enviar y no se guarda: `html` sigue como se generó y el
Word no cambia.

**4.9 A las 14:00.** Antes de los recordatorios, en un día hábil y con el envío automático activo, bajo el candado:
se envían las que esperan (`espera_firma = 1`: con su `pdf_firmado` si se subió y no se confirmó, decisión del usuario; si no, con la imagen) y las firmadas que fallaron (`pdf_firmado` con `estado` distinto de `enviada` e
`intentos` < 5). Va aislado: un error se anota en la última corrida y no frena los recordatorios. Ocupado o caído, las recupera
la corrida de la mañana siguiente (punto 4.10). Ningún aviso a quien no firmó.

**4.10 Los reintentos de la mañana.** La consulta de reintentos de `correrPasos` deja afuera solo a las que esperan **de hoy**
(`NOT (espera_firma = 1 AND fecha = hoy)`). Una que esperaba de un día anterior sale con la imagen: nunca queda colgada.

**4.11 «Reintentar» no sirve de atajo.** Con `espera_firma = 1` el botón no se muestra y la API responde 409 («Esta nota espera la
firma digital: sale sola a las 14:00.»). `enviarNota` pone `espera_firma = 0` en los dos resultados. Una nota de prueba no pasa por nada de esto.

**4.12 Apagar el interruptor** no suelta las que ya esperan: cada nota sigue su bandera y sale a las 14:00.

## 5. La hora de la corrida

La Tarea Cron de cPanel pasa de las **8:15** a las **8:05** (decisión del usuario: que el firmante tenga el mail cuando llega). La
hora no está en la lógica, solo en la Tarea Cron y en estos textos, que se corrigen:
`public/correos.html`, `public/js/correos.js` (la confirmación de «Envío automático»), `public/js/usuarios.js` y su copia en
`public/js/mi-espacio.js` (`efectoEnNotas`) y `AVISO_NOTAS_DE_HOY` (`services/miEspacioReglas.js`), que pasa a «Las notas de hoy
ya se generaron a las 8:05 con tu firma.», porque con la ventana pueden no haber salido.
También salen 10 minutos antes el email a las áreas y los avisos de Mi espacio. Los comentarios del código no se tocan.

## 6. La pantalla (Correos)

Como en la maqueta:
- **Libro:** arriba de los filtros, la tarjeta «Notas para firmar hoy», solo si hay alguna, con su texto, una fila por nota (número, tipo, gestión y, sin firmar, «Falta firmar · la firma <nombre>» con «Ver» y
  «Subir firmada», que abre el selector de archivos para esa nota; firmada, «Firmada por X» con «Ver» y «Reemplazar»), el resultado de la subida en esa misma fila (`role="status"`) y, con alguna firmada, «Enviar las N firmadas» (o «Enviar la firmada») con «Si no las enviás, salen solas a las 14:00, firmadas.».
- **Filas del Libro:** «Para firmar» (o «Firmada, sin enviar») + «hasta las 14:00» en las que esperan, sin «Reintentar». En las ya enviadas firmadas, debajo del estado,
  «Firmada digitalmente por X», con la fecha y la hora en el `title`.
- **Estado:** el interruptor «Firma digital de las notas», debajo de «Envío automático», con su texto. Lo pueden cambiar los mismos
  que el envío automático. La alerta `para-firmar` (advertencia): «Hay 2 notas para firmar. Las que no se suban antes de las 14:00
  salen con la imagen de la firma.» o, si todas están firmadas, «Hay 2 notas firmadas sin enviar. Salen solas a las 14:00.». La última corrida suma «, N para firmar» si hay alguna.

## 7. Lo que se deja afuera

- La integración por API y ser Autoridad de Registro.
- Firmar el anexo.
- Comprobar la cadena de confianza, la revocación o que firmó quien debía.
- Firmar después de las 14:00 o una nota ya enviada, para archivo.
- Un recordatorio antes de las 14:00, o un aviso de que salió con la imagen.
- Un botón «enviar ya, sin firma digital».
- Mostrar la firma digital en el Seguimiento, Métricas o los reportes.
- Una marca visible en la hoja: la nota se genera antes de saber si la van a firmar.
- Generar la nota el día anterior y cualquier espera de más de un día (sección 3).

## 8. Base de datos y despliegue

`migracion-notas-firma-digital.sql` (aditiva y repetible), **antes** del código, obligatoria (el Libro y el envío leen las columnas):
- `notas_digitales`: `espera_firma` tinyint(1) NOT NULL DEFAULT 0, `pdf_firmado` mediumblob NULL, `firmado_por` varchar(255) NULL,
  `firmado_at` datetime NULL (hora argentina), `firma_subida_por` int NULL (FK `usuarios` ON DELETE SET NULL).
- `notas_digitales_config`: `firma_digital_activa` tinyint(1) NOT NULL DEFAULT 0.

`rollback-notas-firma-digital.sql`, después de volver a los archivos anteriores: borra las columnas (se pierden las copias firmadas
guardadas; los emails ya salieron; una nota que esperaba queda como `pendiente` y sale en la corrida siguiente).

Despliegue: la migración, los archivos, Restart, y mover la Tarea Cron a las 8:05. El interruptor queda apagado: se prende recién
cuando el usuario quiera. Sin Run NPM Install: `multer` ya está y no hay dependencias nuevas.

## 9. Pruebas

- Fixtures con datos inventados y un certificado de prueba, generados una vez (`tests/fixtures/firma-digital/`, con su script). La
  clave privada no se versiona.
- La nota real se comprueba solo en local, sin copiarla, en la simulación.
- **Simulación obligatoria** antes del merge, con una copia de producción y sin envíos reales: con el interruptor apagado, las mismas
  notas que sin esta entrega; prendido, subir una, dejar otra para las 14:00 y una nota de auditoría.
- **El caso que pidió el usuario:** a principios de diciembre el titular carga su licencia del 10/12/2026 al 08/01/2027 con la persona autorizada a cargo,
  y unos días después ella carga la suya, del 11/01 al 22/01/2027. Con el código de 3949aae (ensayo del 03/11, sin errores): reiteraciones el 01/12 y avisos anticipados el 09/12, del titular; avisos el 22/12 y el 30/12 y reiteraciones el 04/01, de la persona autorizada, con las dos imágenes. La licencia de ella no cambia ninguna nota: no se pisa con la del titular.
- **Firma real de punta a punta:** con el código definitivo (la reiteración bimestral cambia qué notas salen y sus números), el usuario firma sus notas de la simulación y las copias firmadas se suben por la pantalla, en una base de simulación que tenga esos mismos PDF. Fuera del repo.

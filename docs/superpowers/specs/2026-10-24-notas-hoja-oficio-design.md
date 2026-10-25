# Notas Digitales en hoja oficio

Fecha: 24/10/2026.

Cambia, de la spec `2026-10-12-notas-digitales-design.md`, el tamaño de la hoja del PDF de la nota (sección 6.6, «hoja oficio de 216 × 330 mm») y el criterio de aceptación que lo repite («el PDF adjunto es válido, mide 216 × 330 mm…»). Todo lo demás de esa spec, y de las que la siguieron (anexo de los avisos, anexo de la reiteración, licencia del firmante, firma en negrita y cierre medido), sigue igual.

## Por qué

La Municipalidad imprime en papel oficio de 216 × 356 mm (la resma dice «Oficio 216 × 356 mm / Legal 8 1/2" × 14"»). El PDF de las Notas Digitales sale hoy en 216 × 330 mm: no es el papel en el que se imprime. El usuario pidió que el PDF salga en la hoja oficio de 356 mm, de hoy en adelante.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Toda Nota Digital que se genere después del despliegue sale en hoja oficio Legal, en todas sus hojas. Vale para las cuatro clases de nota (aviso, reiteración, autorización y auditoría), las dos gestiones, con una firma o con dos (y la leyenda), de una hoja o de varias, con el membrete o sin él, y también para la prueba y la vista previa («Ver PDF») de Correos.
- La nota se arma igual que hoy (decisión del usuario: «seguir como se armaba la nota»). Quedan iguales el membrete (el banner arriba, a lo ancho, y el pie a 12,5 mm del borde de abajo), los márgenes, la letra, las tablas, la firma, el cierre medido y la paginación «Nota Digital N° … – Página p de t». Solo cambia el alto: cada hoja tiene 26 mm más para el texto.

**No objetivos**
- Las notas ya generadas no se regeneran. El PDF de cada nota queda guardado en `notas_digitales.pdf` y nunca se vuelve a dibujar: el envío, los reintentos y las descargas (Libro de Correos, Seguimiento) usan esos bytes. Las enviadas siguen en 216 × 330, y lo mismo una pendiente o fallida generada antes del despliegue: su reintento manda lo que se generó, igual que hoy con el membrete (spec 6.6, «un reintento reenvía el PDF guardado aunque después cambie el membrete»). Hoy no hay ninguna pendiente ni fallida.
- No cambian los anexos ni los demás PDF, que siguen en A4: el anexo de los avisos (`services/notasDigitalesAnexo.js`), el anexo de la reiteración y el PDF del Seguimiento (`services/seguimientoPdf.js`) y los reportes (`controllers/reportesController.js`). La nota y su anexo son dos archivos separados: ningún PDF mezcla una hoja oficio con hojas A4.
- No cambia el membrete cargado en Correos ni su pantalla, que no menciona medidas: la imagen se escala al ancho de la hoja, y el ancho queda igual. La hoja membretada de Word que va a usar el Generador de Notas (con marca de agua y otro margen superior) no se toma como modelo: es de esa otra entrega (decisión del usuario).
- No cambia el email (HTML y texto plano), que no depende de la hoja.
- La base no guarda el tamaño de cada nota. En el Libro van a convivir notas de 216 × 330 y de oficio, sin nada que las distinga salvo el PDF.

**Antiobjetivos** (sería un fracaso aunque funcione)
- Que cambie algún PDF A4: los anexos, el Seguimiento, los reportes o lo que arme la rama de Métricas con `DocumentoNota`.
- Que cambie una nota ya generada.
- Romper algo de lo implementado: el cierre medido y la firma en negrita, el anexo de la reiteración, la licencia del firmante con persona autorizada (dos firmas y la leyenda) y el aviso en su fecha.
- Que algo de la hoja (pie, paginación, firma, línea CC) quede afuera o se pise con otra cosa.

## La hoja

- **Tamaño:** Legal exacto, 8½ × 14 pulgadas = **612 × 1008 puntos** (215,9 × 355,6 mm). Es lo que vino en el pedido («Legal, 8½ × 14″, 612 × 1008 pt»). 216 × 356 mm redondeados darían 612,28 × 1009,13 pt, y una impresora podría tomarlo como tamaño personalizado. El rótulo de la resma redondea los milímetros.
- **El ancho baja 0,28 pt (0,1 mm):** de 612,28 (216 mm) a 612. Con márgenes laterales de 30 mm, el texto pasa de 442,20 a 441,92 pt de ancho, y el banner real (1241 × 178 px), de 87,82 a 87,78 pt de alto. Ninguna de las dos cosas se nota a la vista. En un caso límite puede mover dónde corta un renglón, pero solo en notas nuevas. Se acepta.
- **Dónde está:** `PAGINA` en `services/notasDigitalesPdf.js` (hoy `[216 * MM, 330 * MM]`). Sigue siendo privada del módulo. Todo lo que depende de la hoja la lee de ahí o de `doc.page.height`:
  - el documento (`size: PAGINA`);
  - el ancho del texto (`ANCHO_TEXTO`), el banner (`medidasBanner`) y el borrador de `medirCierre`, que usan solo el ancho;
  - el pie, la paginación, el paso de página, la tabla y todas las reservas, que miden contra `doc.page.height` y los márgenes.

  No hay ningún alto fijo que suponga 330 mm.
- **`DocumentoNota` no gana un tamaño por defecto.** Cada PDF A4 fija el suyo (`size: 'A4'`) y la clase no sabe de hojas. Si la clase tuviera un tamaño, cambiarían todos los A4.
- **Márgenes, sin cambios:**
  - superior: el alto del banner más 9 mm, nunca menos de 25 mm (con el banner real, unos 40 mm);
  - inferior: 25 mm para el contenido;
  - laterales: 30 mm.
- **Cuánto texto más entra:** con el membrete real, el alto útil pasa de 265 a 291 mm por hoja. Son unos 5 renglones de letra 12, o 3 a 4 filas de tabla. Una nota que hoy sale en dos hojas puede salir en una, y entonces no lleva paginación. Las de varias hojas cortan en otros lugares. Por ejemplo, la reiteración real del 02/11 pasa de 7 a 8 filas en la primera hoja.

## Qué pasa con cada nota

| Nota | Tamaño |
|---|---|
| Enviada antes del despliegue | 216 × 330, sin cambios |
| Pendiente o fallida generada antes del despliegue | 216 × 330: el reintento manda lo guardado |
| Reiteración que no se generó (falló el anexo) | Se genera en la corrida siguiente, ya en oficio |
| Generada después del despliegue, de cualquier clase | Oficio |
| Prueba de Correos («Enviarme una prueba») | Oficio (se genera en el momento) |
| Vista previa «Ver PDF» de Correos | Oficio (se dibuja en el momento) |
| Descarga desde el Libro o el Seguimiento | Lo guardado de cada nota |
| Anexos (aviso y reiteración), Seguimiento, reportes | A4, sin cambios |

## Pruebas

- **`npm test` completo antes y después de cada cambio** (regla del proyecto). Los tests de integración crean bases con nombre fijo (`rpad_test_<archivo>`): antes de correr la suite hay que comprobar que no esté corriendo la de otra sesión.
- **Leer el tamaño de cada hoja:** `tests/pdf-lector.js` hoy usa el alto del `MediaBox` solo por dentro. Tiene que exponer el ancho y el alto de cada hoja, para afirmar el tamaño directamente.
- **La nota sale en 612 × 1008 en todas sus hojas.** Hay que cubrir:
  - aviso interno y externo, reiteración, autorización y auditoría;
  - una firma y dos (con la leyenda);
  - una hoja y varias;
  - con membrete y sin él.

  El test tiene que fallar si `PAGINA` vuelve a 330 mm o queda en 216 × 356 mm redondeados.
- **Lo que hoy fija 330 mm en `tests/notas-pdf.test.js`:**
  - las constantes `ANCHO_HOJA` y `ALTO_HOJA`;
  - la expresión del `MediaBox`;
  - «7 filas en la primera hoja» de la reiteración real del 02/11, que pasa a 8.

  Con eso ajustado, los 130 tests de ese archivo pasan con la hoja nueva (se probó en una copia). Las posiciones de arriba (la REF., el banner) conviene medirlas con el alto leído de la hoja y no con una constante, así la posición y el tamaño se prueban por separado.
- **El membrete con la hoja nueva:** la REF. a unos 40 mm del borde con el banner real, a 54 mm con un banner de 45 mm y a 25 mm sin banner; el pie a 12,5 mm del borde de abajo y la paginación a 17,5 mm.
- **El cierre medido con el alto nuevo:** un caso que distinga las dos hojas. Una nota que termina entre el límite viejo y el nuevo tiene que salir en una hoja; con 330 mm saldría en dos. El test de hoy («el cierre se mide de verdad») sigue valiendo, pero no distingue el alto.
- **Los A4 quedan protegidos:** cada hoja del anexo de los avisos (`renderAnexo`), del Seguimiento (`renderSeguimiento`) y del anexo de la reiteración (`renderAnexoDeSeguimiento`) mide 595,28 × 841,89. Hoy ningún test fija el alto A4, y el Seguimiento no tiene ninguno.
- **Con la base** (Docker): el `pdf` guardado de una nota generada mide 612 × 1008 y su `anexo_pdf`, A4. Va en un test de integración que ya genere notas, por ejemplo `notas-api` o `notas-motor`.

## Prueba de punta a punta (simulación)

Pedido del usuario: una corrida simulada que genere todas las notas desde el 25/10/2026 hasta el 05/01/2027, para ver el tamaño oficio en todas.

- **Base:** una propia, copia del dump de producción del 24/10 a las 16:45. Nunca la base compartida. El código, el de esta rama.
- **Método:** el de las simulaciones anteriores. Cada día hábil corren las dos tandas (8:15 y 14:00), cada una en su proceso, con el reloj de Node y el de la base en la fecha simulada. Los emails se capturan en el transporte de nodemailer (ninguno se envía) y los PDF quedan en la carpeta de salida y en la base.
- **Escenario principal:**
  - el firmante titular, de licencia del 10/12/2026 al 08/01/2027, cargada el 25/10 con `crearLicencia`;
  - persona autorizada: la editora (personal contratado), con su firma real cargada (decisión del usuario);
  - nadie más actúa.

  Se espera: el 02/11, aviso interno y reiteraciones; el 01/12, reiteraciones; la víspera, el 09/12, los avisos anticipados con la autorización adentro; el 22/12 y el 30/12, los avisos en su fecha con dos firmas; el 04/01/2027, las reiteraciones con dos firmas. También notas de varias hojas.
- **Escenas, cada una en su propia base** para no cambiar la numeración de la corrida principal (decisión del usuario):
  - **Auditoría:** el titular propone un cambio inocuo (las observaciones de un dataset) un día hábil antes de las 13:00 y nadie lo aprueba. Sale la nota de auditoría al tercer día hábil y su reiteración a los 5 días hábiles; durante la licencia, con dos firmas.
  - **Autorización aparte:** la licencia se carga sin persona autorizada y se le agrega el 09/12, después de las 8:15. El 10/12 sale la nota de autorización.
- **Barreras contra envíos reales** (decisión del usuario: tres barreras, sin `EMAIL_SOLO_A`):
  - la captura en nodemailer: el transporte falso guarda cada email y sus adjuntos y responde que se envió;
  - el SMTP a Mailpit (127.0.0.1:1025) en el entorno de cada proceso, con la cuenta de Mailpit medida antes y después (tiene que seguir igual);
  - el rechazo de toda conexión de red que no sea local (127.0.0.1 o localhost), en cada proceso de la simulación.

  `EMAIL_SOLO_A` queda vacío explícitamente. Con las dos casillas de prueba, todo email a un destinatario real se bloquea antes de la captura (`filtrarDestinatarios`, `services/emailService.js`). Entonces la nota queda «fallida», no llega a las muestras, y las reiteraciones, que solo cuentan los avisos enviados, dejan de parecerse a las de producción. Reescribir los destinatarios en la base copia tampoco sirve: los emails de las áreas también se imprimen en «Datos de contacto» de las notas externas.
- **Control automático de cada PDF capturado:** las notas miden 612 × 1008 en todas las hojas, los anexos miden A4, y nada se pisa con el pie ni sale de la hoja.
- **Muestras:** una carpeta en el Escritorio, `RPAD-simulacion-notas-oficio`, con las notas y los anexos de cada día, los emails, un `LEEME` con lo que salió cada día y lo que se controló, y una comparación de la misma nota en 330 y en oficio.

## Despliegue

- **Sin SQL y sin npm.** Se sube `services/notasDigitalesPdf.js` y se hace Restart, lejos de las 8:15 y de las 14:00.
- **Antes de subir:** mirar en Correos → Libro que no haya notas pendientes ni fallidas. Si hay, saldrán en 216 × 330 y conviene saberlo.
- **Vuelta atrás:** el archivo anterior y Restart. Las notas generadas en oficio mientras tanto quedan en oficio.
- **Kit en el Escritorio:** `RPAD-deploy-notas-hoja-oficio`, como los anteriores:
  - `PASOS.txt`, en ASCII;
  - los archivos y su zip;
  - las muestras de la simulación;
  - la vuelta atrás.

## Documentación

- **CLAUDE.md:** el tamaño de la nota (oficio Legal, 612 × 1008 pt, desde esta entrega) y los PDF que siguen en A4.
- **README:** el changelog y, si menciona la hoja de la nota, esa línea.
- **Spec de las Notas Digitales** (`2026-10-12`, 6.6): una línea que remita a esta spec. El texto viejo queda como registro.
- **Comentarios del código:** los que dicen cuántas filas entran en la primera hoja (`notasDigitalesContenido.js`, el de las proporciones externas).
- **Spec del Generador de Notas** (rama `feat/generador-de-notas`): dice que el PDF «sigue en 21,6 × 33 cm». Se le avisa a esa sesión; no se toca desde esta rama.

## Ramas en paralelo

Esta entrega avanza en paralelo con «Métricas y Reportes» (decisión del usuario).
- **Código:** ninguna de las dos ramas en curso toca los archivos de código de esta. El plan del Generador de Notas va a usar `PROPORCIONES` de `notasDigitalesPdf.js`, que es otra línea del mismo archivo.
- **Documentación:** coinciden en `CLAUDE.md` y `README.md`. Quien llegue segunda a main trae main y junta esos textos.
- **Kit de despliegue:** se arma con el `notasDigitalesPdf.js` de main en el momento de armarlo, así no pisa lo que haya subido otra entrega.

## Lo que queda a cargo de quien implementa

- Cómo expone `pdf-lector` el tamaño de cada hoja y cómo se reorganizan las constantes de `notas-pdf.test.js`.
- La forma de los tests nuevos y en qué archivo va cada uno.
- Los scripts de la simulación, el control de los PDF y el armado de la carpeta de muestras y del kit.

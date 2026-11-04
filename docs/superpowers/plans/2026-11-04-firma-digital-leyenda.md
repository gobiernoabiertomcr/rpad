# La firma digital se ve en la hoja y cita la Ordenanza — plan de implementación

**Goal:** que la nota firmada digitalmente lleve, en todas sus hojas, la leyenda con la Ordenanza N° 15.276/20 y el mail lo diga, sin que cambie nada de la nota que sale sin firmar ni con el interruptor apagado. Suma mostrar el certificado al revisar y soltar a mano una nota si las 14:00 no corrieron.

**Architecture:** una segunda copia del PDF, `pdf_para_firmar`, solo en las notas que esperan. `enviarNota` no cambia qué adjunta (`pdf_firmado ?? pdf`), así que la excepción de las 14:00 se cumple sola. La leyenda se dibuja en `agregarMembreteYPies`, con la hoja ya armada: nada se corre.

**Tech Stack:** Node 22, Express 4, MariaDB 10.6+ (mysql2/promise), PDFKit, vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-04-firma-digital-leyenda-design.md` (el usuario aprobó la spec y este plan el 04/11/2026). El executor la lee entera, y también `docs/temas/firma-digital.md` y `docs/temas/notas-digitales.md`. Los textos son los de su sección 2, al pie de la letra.

**Turno:** se implementa cuando la coordinadora da el turno. Antes de la Task 1: traer el main de ese momento, ver qué cambió en estos archivos y ajustar el plan. Las líneas citadas son de ee72080.

## Global Constraints

- **Con el interruptor apagado, todo sigue igual:** ni copia ni leyenda. **Lo ya enviado no cambia.** `pdf` y `html` no cambian nunca.
- **Una nota no se queda sin salir por esto:** toda falla de la copia cae en «sale sin copia».
- **Nunca nombres reales** en el repo. Antes de cada commit, buscar en el diff los nombres y usernames de la tabla `usuarios` de la base local. Las firmas reales del usuario, nunca.
- Ningún email real: en local todo va a Mailpit. Nunca `/api/cron/*` en producción. Un test nuevo llama al servicio con un hoy fijo.
- `docker` no está en el PATH (`/Applications/Docker.app/Contents/Resources/bin/docker`). Nunca `docker compose` desde el worktree ni `down -v`, y nada de `pkill -f` ni `killall` con un patrón. Una sola suite a la vez por contenedor. Copiar `.env` del checkout principal, sin mostrarlo, con `RPAD_TESTS_DB_LOCAL=1` y `DB_NAME=rpad_rama_mejoras`.
- **`datospublicos_mcr_rpad` es de solo lectura y se comparte con las demás sesiones** (el dump de producción del 04/11, 17:06, en `database/dump-local/` del checkout principal, con el interruptor prendido). Para escribir, una copia: `rpad_rama_mejoras`, y las de simulación. Se borran al cerrar. Tiene nombres, emails y firmas reales: nada de eso va al repo, a una spec, a un fixture ni a una maqueta commiteada.
- `npm test` completo antes de empezar y después de cada tarea, solo con el turno de la coordinadora. Commit y push de la rama después de cada tarea, en español, con la línea `Co-Authored-By`.
- Nunca desplegar. No tocar `~/rpad-kits/RPAD-deploy-notas-firma-digital` ni el de la reiteración.

**Modelos:** todas las tareas están en la lista fija (migración, reglas, corridas, lo que sale en notas y PDF, API que escribe): **Opus, esfuerzo Extra**. Revisión de cada tarea y de la rama: Opus, Extra.

---

## Task 1: La columna

**Files:** `database/updates/migracion-notas-firma-leyenda.sql`, `database/updates/rollback-notas-firma-leyenda.sql`, `database/schema.sql`, `tests/schema.test.js`, `docs/temas/base-de-datos.md`, `docs/temas/despliegue.md`.

- [ ] Test en `tests/schema.test.js`: `notas_digitales.pdf_para_firmar` existe, `mediumblob`, nula.
- [ ] Migración con el encabezado de `migracion-notas-firma-digital.sql` (qué hace, orden, por qué es obligatoria, cómo deshacerla, «Se puede volver a correr»):

```sql
SET NAMES utf8mb4;
ALTER TABLE `notas_digitales`
  ADD COLUMN IF NOT EXISTS `pdf_para_firmar` mediumblob DEFAULT NULL AFTER `firma_subida_por`;
```

- [ ] Rollback: `DROP COLUMN IF EXISTS`, con el orden y las consecuencias de la spec, sección 6.
- [ ] `database/schema.sql`: la columna después de `firma_subida_por`.
- [ ] Crear `rpad_rama_mejoras` desde el dump y correrle la migración. `tests/schema.test.js` y `tests/permisos.test.js` leen la base del `.env`. La base compartida no se toca: la coordinadora la migra cuando haga el control.
- [ ] `docs/temas/despliegue.md`: fila 35 de la tabla de migraciones y el pendiente del kit. `docs/temas/base-de-datos.md`: la columna.
- [ ] Commit: `feat(notas): la columna de la copia para firmar`.

## Task 2: La leyenda en el PDF

**Files:** `services/notasDigitalesContenido.js` (la constante), `services/notasDigitalesPdf.js`, `tests/notas-pdf.test.js`.

- [ ] Tests, con `tests/pdf-lector.js`:
  - Sin la opción: ningún texto dice «firmado digitalmente» y `contenidoPorHoja` no tiene el color nuevo. Con banner, con pie, sin nada.
  - Con la opción, en notas de 1 y de 30 datasets: en cada hoja, «Documento firmado digitalmente» y « en conformidad con la Ordenanza N° 15.276/20.».
  - **Nada se corre:** para cada hoja, `textosPorHoja` con la opción, sin los dos textos nuevos, es igual en texto, posición y tamaño a `textosPorHoja` sin la opción; lo mismo `imagenesPorHoja`, y el mismo número de hojas. Probar con las cuatro clases y con las dos firmas (`FIRMA_CON_LEYENDA`).
  - El tope del recuadro queda debajo de la dirección (30 < 33,4 pt desde el borde) y a 15 pt o más del borde.
  - Con opción y sin banner ni pie, en una hoja: la dibuja igual (el `return` del principio de `agregarMembreteYPies` no la saltea).
- [ ] Constante en `notasDigitalesContenido.js`, exportada: `export const ORDENANZA_FIRMA_DIGITAL = 'Ordenanza N° 15.276/20';`. Comprobar que `notasFirmaDigital.js` la pueda importar sin ciclo.
- [ ] En `notasDigitalesPdf.js`, junto a las constantes del pie:

```js
// La leyenda de la firma digital (spec 2026-11-04-firma-digital-leyenda, 2.2): en la franja blanca debajo de la dirección del membrete,
// que termina a 33,4 pt del borde. Se dibuja con la hoja ya armada: no ocupa lugar de la nota. En puntos, desde el borde inferior
const LEYENDA_FIRMA = {
  fuerte: 'Documento firmado digitalmente', resto: ` en conformidad con la ${ORDENANZA_FIRMA_DIGITAL}.`,
  tope: 30, alto: 15, base: 19.8, tamano: 8, relleno: 9, radio: 2.5, lugarDelTilde: 13, radioDelTilde: 4.5,
  fondo: '#E4EEF9', borde: '#2B3585', texto: '#1C2466'
};

const dibujarLeyendaDeFirma = (doc) => {
  const l = LEYENDA_FIRMA;
  const anchoFuerte = doc.font(NEGRITA).fontSize(l.tamano).widthOfString(l.fuerte);
  const anchoResto = doc.font(NORMAL).fontSize(l.tamano).widthOfString(l.resto);
  const ancho = anchoFuerte + anchoResto + 2 * l.relleno + l.lugarDelTilde;
  const x = (doc.page.width - ancho) / 2;
  const y = doc.page.height - l.tope;
  doc.save();
  doc.roundedRect(x, y, ancho, l.alto, l.radio).lineWidth(0.75).fillAndStroke(l.fondo, l.borde);
  // El tilde va dibujado: Helvetica no lo tiene
  const cx = x + l.relleno + l.radioDelTilde;
  const cy = y + l.alto / 2;
  doc.circle(cx, cy, l.radioDelTilde).fill(l.texto);
  doc.moveTo(cx - 2.2, cy + 0.1).lineTo(cx - 0.6, cy + 1.8).lineTo(cx + 2.3, cy - 1.9).lineWidth(1).lineCap('round').lineJoin('round').stroke('#FFFFFF');
  const xTexto = x + l.relleno + l.lugarDelTilde;
  const yTexto = doc.page.height - l.base;
  doc.fillColor(l.texto).font(NEGRITA).fontSize(l.tamano).text(l.fuerte, xTexto, yTexto, { lineBreak: false, baseline: 'alphabetic' });
  doc.font(NORMAL).fontSize(l.tamano).text(l.resto, xTexto + anchoFuerte, yTexto, { lineBreak: false, baseline: 'alphabetic' });
  doc.restore();
};
```

- [ ] `agregarMembreteYPies(doc, nota, ancho, { banner, pie, leyenda })`: el `return` suma `&& !leyenda`; en el bucle, antes de devolver el margen, `if (leyenda) dibujarLeyendaDeFirma(doc);`. `renderPdf(nota, { …, leyendaFirmaDigital = false })` y lo pasa. Sin la opción no se ejecuta ninguna línea nueva.
- [ ] Mirar el PDF de verdad (dibujarlo a PNG, como en `~/rpad-notas/firma-digital-mejoras/maquetas/`) contra la maqueta.
- [ ] Commit: `feat(notas): la leyenda de la firma digital al pie del PDF`.

## Task 3: Las dos copias

**Files:** `services/notasDigitales.js`, `controllers/notasDigitalesController.js`, `tests/notas-firma-digital-motor.test.js`, `tests/notas-firma-digital-api.test.js`.

- [ ] Tests (motor, con hoy fijo):
  - Apagado: `pdf_para_firmar` NULL; `generarNota` no recibe `Map`.
  - Prendido: la nota que espera tiene la copia, y empieza distinta de `pdf`; `pdf` sin leyenda y copia con leyenda, con los lectores de PDF.
  - Prendido y sin quién firme, o a las 14:00 o después: no espera y la columna queda NULL.
  - El mail a quien firma adjunta la copia, y el nombre del adjunto sigue igual.
  - Sale firmada: adjunta `pdf_firmado`, y `pdf_para_firmar` queda NULL. Sale sin firmar a las 14:00: adjunta `pdf` **byte por byte**, sin línea en el mail, y la columna queda NULL. Falla el email: lo mismo, en los dos casos.
  - Si la copia no se puede armar (un `Map` cuyo `set` tira): la nota se genera, espera y sale con `pdf`.
  - Si el `UPDATE` de la espera falla: se anota y la nota sale.
- [ ] Tests (API): subir lo firmado sobre la copia (la fixture de firma aplicada a esos bytes) da `firmada` y `con_leyenda: true`; lo firmado sobre `pdf`, con copia presente, da `no_es`; una nota sin copia sigue andando con `pdf` y `con_leyenda: false`; «Ver» (`GET …/pdf`) de una que espera baja la copia; de una enviada sin firmar baja `pdf`; de una firmada, `pdf_firmado`; `otra_nota` nombra una nota que espera con su copia.
- [ ] `generarNota`, parámetro `copiasParaFirmar = null`. Después de `await conexion.commit();`, con `nota` a la vista del bloque:

```js
    // La copia que se firma, con la leyenda (spec 2026-11-04-firma-digital-leyenda, 2.3). Después del commit y en su propio try: si falla, la
    // nota espera sin ella y sale igual. Con la firma digital apagada no se arma
    if (copiasParaFirmar) {
      try {
        copiasParaFirmar.set(resultado.insertId, await renderPdf(nota, { ...opcionesPdf(config, firmaNota), leyendaFirmaDigital: true }));
      } catch (error) {
        console.error('No se pudo armar la copia para firmar de una nota digital:', error.stack);
      }
    }
```

- [ ] La corrida: `const copiasParaFirmar = config.firma_digital_activa ? new Map() : null;`, antes del paso 1, y se pasa en los `generarNota` de autorización, aviso, reiteración y auditoría (las líneas cerca de `:800`, `:845`, `:876`, `:897`).
- [ ] `enviarOEsperar`: `await pool.execute('UPDATE notas_digitales SET espera_firma = 1, pdf_para_firmar = ? WHERE id = ?', [copiasParaFirmar?.get(id) ?? null, id]);`.
- [ ] `avisarLasQueEsperan`: `SELECT id, numero, anio, tipo, gestion, pdf, pdf_para_firmar` y adjunta `n.pdf_para_firmar ?? n.pdf`.
- [ ] `enviarNota`: `pdf_para_firmar = NULL` en los dos `UPDATE`. Lo que adjunta no cambia.
- [ ] `subirNotaFirmada`: lee las dos columnas; `const conLeyenda = nota.pdf_para_firmar !== null;` y le pasa a `verificarNotaFirmada` un objeto con `pdf: nota.pdf_para_firmar ?? nota.pdf`. `data` suma `con_leyenda: conLeyenda`.
- [ ] `otrasNotasPara`: `SELECT numero, anio, pdf, pdf_para_firmar … AND LENGTH(COALESCE(pdf_para_firmar, pdf)) <= ?`, y devuelve cada fila con `pdf: fila.pdf_para_firmar ?? fila.pdf`.
- [ ] `descargarPdf`: `pdf_firmado ?? pdf_para_firmar ?? pdf`.
- [ ] Commit: `feat(notas): una copia con la leyenda para firmar, y la de siempre si nadie firma`.

## Task 4: Los textos del mail

**Files:** `services/notasFirmaDigital.js`, `services/emailTemplates.js`, `tests/notas-firma-digital.test.js`, `tests/email-diseno.test.js` (lo que ate el texto).

- [ ] Tests: el texto exacto de `textoDeLaLineaDeFirma`; el `<p>` con `margin:0 0 20px;color:#800000;`, con un HTML de verdad de `renderHtml`, debajo de la primera línea; un nombre con `<` escapado; el texto plano; `notasParaFirmarTemplate` con el cierre nuevo, en HTML y en texto, con una y con varias notas. Ampliar el test de `tests/notas-firma-digital.test.js:214`, que hoy usa un `<p>` sin márgenes.
- [ ] `textoDeLaLineaDeFirma = (nombre) => \`La nota está firmada digitalmente por ${nombre}, en conformidad con la ${ORDENANZA_FIRMA_DIGITAL}.\``.
- [ ] `conLineaDeFirma`: el margen. El resto, igual.
- [ ] `notasParaFirmarTemplate`: el `cierre` de la spec, 2.4.
- [ ] Correr `tests/notas-digitales-word.test.js`: el Word no tiene que enterarse.
- [ ] Commit: `feat(notas): la línea del mail cita la Ordenanza`.

## Task 5: El certificado a la vista

**Files:** `services/notasFirmaDigital.js`, `services/notasDigitales.js`, `public/js/correos.js`, `public/correos.html`, `tests/notas-firma-digital.test.js`, `tests/notas-firma-digital-api.test.js`, `tests/correos-frontend.test.js`, `tests/paginas.test.js`.

- [ ] Tests puros de `revisionDelCertificado`: conocido y vigente, sin avisos; emisor desconocido, con su aviso; vencido; todavía no vigente; sin momento, usa `ahora`; sin momento ni `ahora`, sin aviso de vigencia; los dos avisos juntos. Las fixtures autofirmadas siguen dando `firmada`, con aviso.
- [ ] `leerFirmaAgregada`: `certificado: { emisor: cnDe(certificado.issuer), desde: ahoraArgentina(new Date(certificado.validFrom)), hasta: ahoraArgentina(new Date(certificado.validTo)) }`, adentro de su `try`. No cambia si una firma pasa o no.
- [ ] Puro y exportado:

```js
const CERTIFICADORES_CONOCIDOS = ['AC MODERNIZACION-PFDR', 'AC ONTI'];
// 'AAAA-MM-DD…' → 'dd/mm/aaaa'
const fechaCorta = (momento) => `${momento.slice(8, 10)}/${momento.slice(5, 7)}/${momento.slice(0, 4)}`;
// Lo que se ve del certificado al revisar (spec, 2.5). Nada de esto frena: la firma ya verificó
export const revisionDelCertificado = ({ emisor, desde, hasta }, momento) => {
  const avisos = [];
  if (!CERTIFICADORES_CONOCIDOS.includes(emisor)) {
    avisos.push(`Ojo: el emisor del certificado no es uno de los certificadores conocidos (${CERTIFICADORES_CONOCIDOS.join(' y ')}). Mirá que sea la firma digital oficial.`);
  }
  if (momento && (momento < desde || momento > hasta)) avisos.push('Ojo: el certificado no estaba vigente cuando se firmó la nota.');
  return { texto: `Certificado de ${emisor}, vigente hasta el ${fechaCorta(hasta)}.`, avisos };
};
```

- [ ] `verificarNotaFirmada(subido, nota, otras = [], ahora = null)`: con `firmada`, suma `certificado: revisionDelCertificado(firma.certificado, firma.firmado_at ?? ahora)`. `subirNotaFirmada` le pasa `ahoraArgentina()` y `data` suma `certificado`.
- [ ] `correos.html`: debajo de `#modal-firmada-texto`, `<p id="modal-firmada-aviso" class="co-fila-aviso mal" role="alert" hidden></p>`.
- [ ] `correos.js`: `textoDeLaRevision` con `con_leyenda` y `certificado.texto` (spec, 2.4 y 2.5); `abrirModalFirmada({ …, avisos = [] })` escribe con `textContent` y oculta si no hay. `abrirModalFirmada` de «Ver» no los pasa. «Confirmar» sigue habilitado.
- [ ] `tests/correos-frontend.test.js`: el texto con y sin leyenda; los avisos visibles u ocultos; un nombre o un emisor con `<` no arma HTML.
- [ ] Subir `VERSION_CORREOS` y `correos.js?v=` (una sola vez, con el comentario de la constante).
- [ ] Commit: `feat(notas): el certificado a la vista al revisar la nota firmada`.

## Task 6: «Reintentar» si las 14:00 no corrieron

**Files:** `services/notasFirmaDigital.js`, `services/notasDigitales.js`, `controllers/notasDigitalesController.js`, `public/js/correos.js`, `tests/notas-firma-digital.test.js`, `tests/notas-firma-digital-motor.test.js`, `tests/notas-firma-digital-api.test.js`, `tests/correos-frontend.test.js`.

- [ ] Tests puros de `puedeReintentarLaQueEspera({ fecha, hoy, ahora, envioActivo, diaHabil })`: tabla con 14:14 y 14:15; día anterior; envío apagado; día no hábil.
- [ ] Tests del servicio, con hoy fijo y calendario de prueba: `condicionesParaSoltar` da lo que dice la configuración y el calendario.
- [ ] Tests de API: el 409 de hoy sigue con una nota que espera con **fecha futura** (si no, el test depende de la hora en que corre: cambiar `tests/notas-firma-digital-api.test.js:295`); con fecha pasada y el envío apagado, 409; `reintentable` en el Libro, con el envío apagado, `false`. Una nota fallida se reintenta como hoy. El caso positivo por la API solo si no depende del día (si no, en el servicio).
- [ ] Puro: `export const puedeReintentarLaQueEspera = ({ fecha, hoy, ahora, envioActivo, diaHabil }) => Boolean(envioActivo) && Boolean(diaHabil) && esperaDeMas(fecha, hoy, ahora);`.
- [ ] Servicio: `export const condicionesParaSoltar = async ({ hoy = hoyArgentina(), ahora = ahoraArgentina(), calendario } = {})`, con `obtenerConfig` y `leerCalendario`; devuelve `{ hoy, ahora, envioActivo, diaHabil: cal.esDiaHabil(hoy) }`.
- [ ] Controlador, `reintentarNota`: lee también `DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha`; `if (nota.espera_firma && !puedeReintentarLaQueEspera({ fecha: nota.fecha, ...(await notas.condicionesParaSoltar()) })) return 409 MENSAJE_ESPERA_FIRMA`.
- [ ] Controlador, `listarNotas`: solo si alguna fila espera, una vez `condicionesParaSoltar`; cada fila, `reintentable`.
- [ ] `alertaDeLasAtrasadas`: el texto de la spec, 2.6, solo en el caso de la Tarea Cron.
- [ ] `correos.js`: el botón con `(n.estado !== 'enviada' && n.espera_firma !== true) || n.reintentable === true`; la fila «sale en la próxima corrida» con `n.reintentable`; en `accionDelLibro`, si la fila espera, `confirmar` con los textos de la spec, 2.6, antes de `API.reintentarNota`. El botón lleva lo que hace falta en `data-` (si espera y si está firmada), y sigue deshabilitándose hasta la respuesta. Al volver, refrescar el Libro y el Estado como hoy.
- [ ] Tests de frontend: sin `reintentable`, sin botón; con él, con botón y los dos textos; cancelar no manda nada.
- [ ] Si la versión de `correos.js` ya subió en la Task 5 y no se desplegó, no se sube de nuevo.
- [ ] Commit: `feat(notas): soltar a mano una nota si la corrida de las 14:00 no corrió`.

## Task 7: Documentos

- [ ] `docs/temas/firma-digital.md`: las dos copias y por qué (decisión que alguien podría «arreglar»: `pdf` no lleva leyenda porque es la que sale sin firmar), la leyenda y su lugar, la línea del mail, el certificado sin frenar, «Reintentar». Lo vigente, un renglón por oración, sin «pasó a». Citar la spec nueva en «Historia y motivos». Corregir los límites sabidos.
- [ ] `docs/temas/notas-digitales.md`: lo que diga del pie o de lo que sale, si hace falta. `tests/documentos.test.js` controla los topes.
- [ ] `CLAUDE.md`: nada, salvo que el test del mapa pida algo. `.claude/rules/`: nada.
- [ ] Commit: `docs(notas): la leyenda de la firma digital`.

## Task 8: Simulación sin firmar

- [ ] Leer `~/rpad-notas/firma-digital-simulacion-cierre.md` y el arnés de `~/rpad-notas/firma-digital-sim/` (`comparar.sh`, `orquestador.mjs`, `accion.mjs`, `reloj.mjs`). Ajustarlo al dump del 04/11 y a la migración nueva. Nunca `/api/cron/*`, emails solo en archivos y barrera de red.
- [ ] Apagada contra main: las mismas notas, números, destinatarios, `html` por sha y largo del `pdf`; `pdf_para_firmar` NULL en todas.
- [ ] Prendida contra apagada: las mismas notas y el mismo `pdf` por largo; las que esperan, con copia hasta que salen; las que salen sin firmar, sin leyenda y con `pdf_para_firmar` NULL.
- [ ] Mirar a PNG una nota de cada clase de la copia, y la de dos firmas.
- [ ] Informe en `~/rpad-notas/firma-digital-mejoras/simulacion-cierre.md`.

## Task 9: Las dos simulaciones con la firma real (frena acá: firma el usuario)

Pedido del usuario. Servidor local con el código de la rama (`servidor-dic.sh` es el modelo), base de simulación copiada del dump del 04/11 con la migración, interruptor prendido, reloj falso y emails solo a un Mailpit aparte (`docker run`, otro puerto). Cada simulación corre día por día desde el 05/11 con el orquestador, para que las notas de esa fecha sean las que de verdad tocan; las notas de los días anteriores salen a las 14:00 sin firmar. Firma solo el titular: la persona autorizada todavía no tiene firma digital.

**Simulación 1, sin licencias:**

- [ ] Correr del 05/11 hasta la corrida de las 8:05 del 22/12/2026 y dejar el servidor con el reloj a las 8:15.
- [ ] Decirle al usuario qué notas hay, con su número y clase, y dejarle el enlace local y el mail en el Mailpit aparte (`ESPERA AL USUARIO`, con `AskUserQuestion`).
- [ ] El usuario las firma en firmar.gob.ar y las pasa por la pantalla: «Subir firmada», la revisión con el certificado, «Confirmar», «Enviar».
- [ ] Comprobar en el Mailpit aparte el adjunto, firmado y con el recuadro, y la línea del mail. Comprobar que los bytes firmados empiezan con la copia.
- [ ] Si hay más de una nota, dejar una sin firmar y llevar el reloj a las 14:00: sale con `pdf`, byte por byte, sin línea.
- [ ] Probar «Reintentar»: otra nota sin firmar, sin correr las 14:00, reloj a las 14:20; confirmación con el texto de la spec, y sale.
- [ ] El usuario imprime una, para ver que el recuadro entra en su impresora.

**Simulación 2, solo si la 1 dio bien:**

- [ ] Base nueva. El 05/11, con las acciones del arnés: licencia ordinaria del titular del 10/12/2026 al 08/01/2027, con la persona autorizada a cargo, y la de ella del 11/01 al 22/01/2027.
- [ ] Correr hasta la corrida de las 8:05 del 09/12/2026 y dejar el servidor con el reloj a las 8:15.
- [ ] Decirle al usuario qué notas hay (la víspera de su licencia: la autorización y los avisos) y repetir el firmado, como en la simulación 1.
- [ ] Sin firmar, seguir hasta el 29/01/2027: las notas de la persona autorizada, con el mail a ella y a las 14:00 con las dos imágenes y sin leyenda; 0 errores.

- [ ] Informe en `~/rpad-notas/firma-digital-mejoras/simulacion-cierre.md`. Las notas firmadas quedan en `~/rpad-notas/firma-digital-mejoras/ensayo/`: nunca van al repo.

## Task 10: Revisión final, merge y kit

- [ ] Revisión de toda la rama, con Opus y Extra. Agentes, sin anclarlos a este plan: sobre las dos copias (¿algún camino manda una copia sin firmar?) y sobre lo apagado.
- [ ] `npm test` completo, con el turno.
- [ ] Sin nombres reales en el diff.
- [ ] Merge en main **con squash** y push, si todo da bien, y borrar la rama: el commit 82f7def trae una ruta con el nombre de usuario de la máquina, que no tiene que entrar en main.
- [ ] Kit `~/rpad-kits/RPAD-deploy-notas-firma-leyenda`, con la spec, sección 8: archivos, SQL, `PASOS.txt` con la comprobación previa de lo que deja el kit anterior (`correos.js?v=20261213`), migración antes del código, Restart, fuera de los crons, y la vuelta atrás. Armado contra el último de la fila; preguntarle a la coordinadora si cambió.
- [ ] Borrar `rpad_rama_mejoras` y las bases de simulación.
- [ ] Actualizar la memoria `firma-digital.md` (ya no está prohibido «Reintentar» pasadas las 14:15).
- [ ] Reportar `TODO EN VERDE` a la coordinadora.

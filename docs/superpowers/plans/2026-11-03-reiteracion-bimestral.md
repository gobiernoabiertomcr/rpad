# La reiteración bimestral — plan de implementación

**Goal:** que las reiteraciones de las Notas Digitales, de las dos gestiones, salgan solo en enero, marzo, mayo, julio, septiembre y
noviembre, y que Correos → Estado, la vista previa y la prueba anuncien eso.

**Architecture:** una regla pura (`esMesDeReiteracion`, en `services/notasDigitalesCalendario.js`). La corrida salta el paso 3 en un mes que no
toca, sin escribir la marca. `proximasFechas` busca el primer día con notas de un mes que toca. Lo demás deriva de ahí. Textos en cuatro archivos y
una aclaración en `textos.reiteraciones.aclaracion` de Métricas.

**Tech Stack:** Node 22, Express 4, MariaDB 10.6+ (mysql2/promise), vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-03-reiteracion-bimestral-design.md`. El executor la lee entera. Los textos son los de su sección 5 y 6, al pie
de la letra.

**Turno:** este plan se implementa cuando la coordinadora da el turno. Antes de la Task 1: traer el main de ese momento, ver qué cambió en los archivos
de acá y ajustar el plan. Las líneas citadas son de 3949aae.

## Global Constraints

- **Cada gestión sigue con su nota.** No se unen. La nota de auditoría y su reiteración de 5 días hábiles no se tocan.
- Ninguna nota, anexo ni Word cambia. Sin tablas, columnas ni migraciones.
- `seleccionarParaReiteracion`, `primerDiaConNotas`, `yaTocaReiterar` y `diaDeVistaPrevia` no cambian de código.
- En un mes que no toca **no se escribe la marca** y **nunca `return`** en la corrida: el paso 4, la auditoría, tiene que correr.
- **Nunca nombres reales** en el repo (tests, fixtures, commits, comentarios). Antes de cada commit, buscar en el diff los usernames y nombres de la tabla
  `usuarios` de la base local.
- Ningún email real: en local todo va a Mailpit. Nunca `/api/cron/*` en producción.
- **Esta Mac:** `docker` no está en el PATH (`/Applications/Docker.app/Contents/Resources/bin/docker`). Nunca `docker compose` desde el worktree (recrearía `rpad-db`) ni `down -v`. `npm ci` solo si cambia `package.json`. Nada al Escritorio ni a Documentos: notas en `~/rpad-notas/`, kits en `~/rpad-kits/`. Sin `timeout` ni `flock`.
- **`npm test` completo antes de empezar y después de cada tarea, solo con el turno de la coordinadora** (las suites crean bases de nombre fijo y no hay candado). Copiar `.env` del checkout principal sin mostrarlo si difiere.
- Commit y push de la rama después de cada tarea. Mensajes en español, con la línea `Co-Authored-By`.

## Review Focus

1. **Un mes par no corta nada:** auditoría, avisos, autorización y reintentos salen igual. El paso 3 está saltado, no la corrida.
2. **Lo anunciado se cumple:** la búsqueda mira el resultado de `primerDiaConNotas`, no su punto de partida (sábado 30/01/2027 sin evaluar; licencia que vuelve en febrero).
3. **Ningún test queda atado al reloj real.** Comprobado con el reloj en diciembre y en febrero.
4. **Los mensajes de los textos** son los de la spec, y su copia en `mi-espacio.js` está atada por la paridad.
5. **Los PDF:** la aclaración entra sin pisar nada, los resultados siguen en una hoja y la referencia nueva cambia solo por ese párrafo.

## Modelos

| Task | Modelo | Por qué |
|---|---|---|
| 1 a 4 | Opus, Extra | Reglas, corridas, lo que anuncia Correos y lo que sale en PDF: lista fija. |
| 5 | Sonnet, Alto | Solo documentación, con los párrafos ya identificados. |
| 6 y 7 | Opus, Extra | Simulación de notas y revisión de la rama. |
| Revisión de cada tarea | Opus, Extra | |

---

## Task 1: La regla pura

**Files:** `services/notasDigitalesCalendario.js`, `tests/notas-calendario.test.js`.

- [ ] **Step 1: Los tests.** En `tests/notas-calendario.test.js`, junto a los de `periodoDe` (:93):
  - `esMesDeReiteracion`: true en `'2027-01'`, `-03`, `-05`, `-07`, `-09`, `-11`; false en `-02`, `-04`, `-06`, `-08`, `-10`, `-12`. Cada uno escrito a mano.
  - Lo que no es un período no tira y da false: `null`, `undefined`, `''`, `'2027'`, `'2027-13'`, `'2027-00'`, `'2027-1'`, `202701`.
  - `MESES_DE_REITERACION` está congelada y es `[1, 3, 5, 7, 9, 11]`.
- [ ] **Step 2: Verlos fallar.** `node --test tests/notas-calendario.test.js`.
- [ ] **Step 3: El código.** Después de `periodoSiguiente` (:160):

```js
// Los meses en que sale la reiteración de las Notas Digitales (spec 2026-11-03-reiteracion-bimestral, 3)
export const MESES_DE_REITERACION = Object.freeze([1, 3, 5, 7, 9, 11]);

// Un período 'AAAA-MM' de esos meses. Lo que no es un período, false
export const esMesDeReiteracion = (periodo) => typeof periodo === 'string' && /^\d{4}-\d{2}$/.test(periodo)
  && MESES_DE_REITERACION.includes(Number(periodo.slice(5, 7)));
```

- [ ] **Step 4: Verde,** también `node --test tests/calendario-unico.test.js` (la función nueva no está entre las prohibidas).
- [ ] **Step 5: Commit y push.** `feat(notas): la regla de los meses de la reiteración`.

---

## Task 2: La corrida y lo que anuncia

**Files:** `services/notasDigitales.js`; tests: `notas-motor`, `notas-licencias`, `feriados-en-notas`, `notas-api`.

La base de partida: `npm test` verde, con el resultado anotado.

- [ ] **Step 1: Los tests nuevos.** En `tests/notas-motor.test.js`, un `describe('la reiteración bimestral')` con la base de ese archivo (`limpiarBase`, `ejecutar(hoy)`):
  - Martes 01/12/2026, con datasets que se reiterarían: ninguna nota `reiteracion`, ningún email de reiteración, ningún error en el resumen, la marca sigue como estaba y `SELECT COUNT(*) … periodo = '2026-12'` da 0.
  - No gasta número: aviso el 02/11 con N° 1, aviso el 21/12 con N° 2.
  - En ese mismo mes par salen igual un aviso, la nota de auditoría (con un cambio en canal nota) y el reintento de una reiteración fallida en noviembre, con su número.
  - Lunes 04/01/2027: una reiteración por gestión, marcas `2027-01`, y una segunda corrida el 05/01 no genera otra.
  - El borde de los 20 días: avisado el 15/12 entra el 04/01; avisado el 16/12 no entra el 04/01 y entra el 01/03.
  - Enero sin corridas: el 01/02/2027 no sale nada de reiteración y el 01/03/2027 sale.
  - Una falla en enero (`conFallaSimulada`, como :607) se reintenta dentro de enero; si no se resolvió, el 01/02 no genera nada, y la marca queda sin escribir.
  - Cambio de año: `'2027-11'` genera y el `2027-12` no; el 03/01/2028 genera.

  En `tests/notas-licencias.test.js` (sección 3.1 de la spec): licencia sin autorizada del 21/12/2026 al 05/02/2027 (enero sin notas, el 10/02 sin reiteración, el 01/03 sale); del 28/12/2026 al 15/01/2027 (sale el 18/01); del 10/01/2027 al 20/01/2027 con enero ya evaluado (nada a la vuelta, el Estado dice 01/03); con persona autorizada, las dos firmas en enero.

  En `tests/feriados-en-notas.test.js`, con la precarga y **`proximasFechas` por `estadoNotas`**: la tabla de la sección 4 de la spec, fila por fila, y un feriado de la tabla en el primer día hábil de un mes que toca (cargarlo para el 01/03/2027: el Estado dice 02/03). Más «lo anunciado se cumple»: 14 meses desde el 04/11/2026, corrida por corrida en los primeros días hábiles, y cada `fecha` anunciada es la `fecha` de la nota que sale.

  Vista previa y prueba (en el mismo archivo, junto a :821 y :871, por servicio y por controlador): con hoy el 15/12/2026, `['2027-01-04', null, true]`, igual al Estado, y «como saldría el 04/01/2027» sin gastar número ni tocar la marca; con hoy sábado 19/12/2026, motivo «día no hábil» y la misma fecha. El anexo de la reiteración del 04/01/2027 suma la propia, «XX», y la de noviembre, y nada de diciembre.

- [ ] **Step 2: Verlos fallar.**
- [ ] **Step 3: La corrida.** En `correrPasos` (:621), con `esMesDeReiteracion` importado de `notasDigitalesCalendario.js`, solo esto cambia:

```js
  // 3. Reiteraciones: una evaluación por mes y gestión, solo en los meses que tocan (spec 2026-11-03-reiteracion-bimestral, 3). En un
  // mes que no toca no se escribe la marca, que sigue diciendo el último mes evaluado (3.2)
  const periodo = periodoDe(hoy);
  for (const gestion of esMesDeReiteracion(periodo) ? GESTIONES : []) {
```

- [ ] **Step 4: Lo que anuncia.** Antes de `proximasFechas`:

```js
// El día de la próxima reiteración desde `desde`: el primer día con notas de un mes que toca (spec 2026-11-03-reiteracion-bimestral, 4).
// primerDiaConNotas no sabe de meses: si el resultado cae en un mes que no toca (también desde un sábado de fin de mes, o con una licencia
// que termina en él), se vuelve a buscar desde el 1° del mes siguiente. Se mira el resultado, no el punto de partida. Un año de vueltas
// alcanza: después de la última licencia, todo día hábil tiene notas. null: no hay ninguno
const VUELTAS_DE_LA_REITERACION = 12;
const primerDiaDeReiteracion = async (config, desde, calendario) => {
  let inicio = desde;
  for (let vuelta = 0; vuelta < VUELTAS_DE_LA_REITERACION; vuelta++) {
    const fecha = await primerDiaConNotas(config, inicio, calendario);
    if (fecha === null || esMesDeReiteracion(periodoDe(fecha))) return fecha;
    inicio = `${periodoSiguiente(periodoDe(fecha))}-01`;
  }
  return null;
};
```

  En `proximasFechas` (:1217), `primerDiaConNotas` pasa a `primerDiaDeReiteracion`, con los mismos argumentos. Actualizar los comentarios de :862, :949, :1178 y :1215 y el de `controllers/notasDigitalesController.js:329` (`periodo`, «la del mes siguiente» → «la del próximo mes que toca»).

- [ ] **Step 5: Los tests que esperaban lo mensual** (los detectó un agente por lectura: confirmar corriéndolos). El ajuste mínimo, sin cambiar lo que prueba cada uno:

| Archivo:línea (3949aae) | Test | Ajuste |
|---|---|---|
| notas-motor:219 | el primer día hábil reitera… | Vencimientos 30/11 y 19/12; corridas 01/10, 20/10 y 02/11. Sigue N° 3/26, cita «1/26 (01/10/2026)» |
| notas-motor:272 | se evalúa una sola vez por mes… | 01/10, 20/10, 02/11, 03/11, 11/11; el 04/01 sigue N° 1/27 |
| notas-motor:291 | si el primer día hábil no hubo corrida… | 05/01/2027 |
| notas-motor:298 | un mes sin datasets… (pasa, ya no prueba) | Vencimiento 19/12; 20/10, 02/11, 20/11; 04/01 |
| notas-motor:309 | nunca genera dos… | 04/01 y 05/01/2027 |
| notas-motor:346 | se reiteran todos los meses… | 04/01 y 01/03/2027; renombrar a «en cada mes que toca» |
| notas-motor:607 | si falla la generación… | 04/01 y 05/01; marcas `{2026-11, 2027-01}` |
| notas-motor:1513 | previewAnexo abierto después… | «4 de enero de 2027»; renombrar |
| notas-motor:320, :364 | comentario «octubre queda evaluado» | Solo el comentario |
| notas-licencias:223 | la persona autorizada presenta las reiteraciones… | 04/01/2027 en corrida y filtro |
| notas-licencias:355 | la reiteración del 01/02/2027… | 01/03/2027; renombrar |
| notas-licencias:838 | su firma lleva el renglón (contratada) | 04/01/2027 en corrida y filtro |
| notas-licencias:1163, :1183 | a la vuelta (01/04); el caso del usuario | 03/05/2027, y comprobar que el 01/04 no sale reiteración |
| notas-licencias:1393 | un sábado muestra el lunes | Sacar la reiteración del bucle: `['2027-01-04', 'día no hábil']`, «4 de enero de 2027» |
| notas-licencias:1749 | licencia en curso con autorizado… | `2027-01-04` |
| notas-licencias:875, :1110 | marca manual 2027-02 | Revisar: pasan, pero el comentario |
| feriados-en-notas:821 | muestra la del 01/12… | `2027-01-04`; renombrar |
| feriados-en-notas:871 | la prueba dice qué día muestra | 04/01/2027, también en el controlador |
| feriados-en-notas:906 | una sola lectura por pedido | Sumar un hoy impar |
| notas-api:612, :634, :660 | helper `avisoYReiteracion` (:600) | Vencimiento 30/11; corridas 01/10 y 02/11. En :660, «2 de noviembre de 2026»; sigue N° 2/26 |

- [ ] **Step 6: El reloj real.**
  - `tests/notas-motor.test.js:1656`: `const HOY = '2026-11-03'` (el motor usa la fecha recibida), con su comentario de :1654.
  - `tests/notas-api.test.js:480`: `hoyMasDias(90)` en :482 y :486, y un comentario de por qué.
  - **Comprobar:** correr `tests/notas-motor.test.js` y `tests/notas-api.test.js` con el reloj fijo el 15/12/2026 y el 15/02/2027, con un `--import` que reemplaza `Date` en `NODE_OPTIONS` (el de `~/rpad-notas/simulacion-mi-espacio/sim/reloj.mjs`, sin copiarlo al repo). También el resto de los archivos que usan `iniciarServidor` y hablan de reiteraciones si un grep los encuentra. Tienen que pasar con los dos relojes.
- [ ] **Step 7: Verde,** con `npm test` completo.
- [ ] **Step 8: Commit y push.** `feat(notas): la reiteración sale solo en enero, marzo, mayo, julio, septiembre y noviembre`.

---

## Task 3: Los textos

**Files:** `public/correos.html`, `public/configuracion.html`, `public/mi-espacio.html`, `public/js/correos.js`, `public/js/usuarios.js`, `public/js/mi-espacio.js`, `services/miEspacioReglas.js`, `services/seguimientoPdf.js` (solo un comentario), tests: `correos-frontend`, `usuarios-frontend`, `mi-espacio-frontend`, `mi-espacio-reglas`, `paginas`.

- [ ] **Step 1: Los tests,** con los textos de la sección 5 de la spec, escritos a mano:
  - `tests/correos-frontend.test.js`: :1373 («Cómo funcionan») y :260, :290, :299, :307 (`textoLicenciaFirmante`, con la vuelta en un mes par y en uno impar: la fecha es `l.vuelta`). :185 es un comentario.
  - `tests/usuarios-frontend.test.js`: :194 y :276. `tests/mi-espacio-frontend.test.js`: :3337 y la paridad de `efectoEnNotas` de :3075. `tests/mi-espacio-reglas.test.js`: :273.
  - `tests/paginas.test.js`: `VERSION_CORREOS` → `'20261212'`, `VERSION_PANTALLAS` → `'20261212'`, `VERSION_MI_ESPACIO` → `'20261222'`. Mirar las reglas de orden entre versiones que lleva ese archivo y lo que la entrega de Contacto haya cambiado.
- [ ] **Step 2: Verlos fallar.**
- [ ] **Step 3: El código.**
  - `public/correos.html:402`: la oración de la spec. Mantener «Solo en días hábiles.» y lo que sigue.
  - `public/js/correos.js:617`, `:629`: las tres ramas de `textoLicenciaFirmante`; la que está en curso, con «hasta la vuelta, el {vuelta}». Comentario de :450.
  - `public/js/usuarios.js:72`, `:78`, `:83` y `public/js/mi-espacio.js:1035`, `:1041`, `:1046`: los tres textos de `efectoEnNotas`, iguales en los dos.
  - `services/miEspacioReglas.js:319`: `AVISO_SIN_PERSONA_A_CARGO`.
  - `?v=` en `correos.html` (`correos.js`), `configuracion.html` (`usuarios.js`) y `mi-espacio.html` (`mi-espacio.js`).
  - `services/seguimientoPdf.js:424`: el comentario, «un año de reiteraciones».
- [ ] **Step 4: Verde.** Los cuatro archivos y `npm test` completo.
- [ ] **Step 5: Commit y push.** `feat(notas): lo que dicen las pantallas de la reiteración bimestral`.

---

## Task 4: La aclaración de Métricas

**Files:** `services/metricasReglas.js`, tests: `metricas-reglas`, `reportes-pdf`.

- [ ] **Step 1: Los tests.** En `tests/metricas-reglas.test.js` (:650, :1000, :1256, :1265, :1285-:1297): el texto a mano. Con ciclos y sin emails, solo la de la frecuencia; con emails, «Hasta el 12/10, … a cada ciclo. Desde diciembre de 2026, la reiteración sale cada dos meses.», en ese orden; sin ciclos del RPAD, `null`. En `tests/metricas-foto.test.js` no debería hacer falta nada: confirmar que la foto guarda el texto.
- [ ] **Step 2: Verlos fallar.**
- [ ] **Step 3: El código,** junto a `ACLARACION_DE_LOS_EMAILS` (:666), y en `textosDeResultados`:

```js
// Desde que la reiteración es bimestral (spec 2026-11-03-reiteracion-bimestral, 6), va a haber más ciclos con «Ninguna» sin que nada haya mejorado
const ACLARACION_DE_LA_FRECUENCIA = 'Desde diciembre de 2026, la reiteración sale cada dos meses.';
```

```js
    aclaracion: rpad === 0 ? null : [conEmails ? ACLARACION_DE_LOS_EMAILS : null, ACLARACION_DE_LA_FRECUENCIA].filter(Boolean).join(' ')
```

  Actualizar el comentario de arriba de `textosDeResultados`. `public/js/reportes.js` no cambia.
- [ ] **Step 4: Los PDF.** `tests/reportes-pdf.test.js`, `REFERENCIA_DE_LOS_PDF` (:1886) falla por el párrafo nuevo. Antes de tomar la referencia nueva: diff de texto hoja por hoja contra 3949aae (el único cambio es ese párrafo) y correr las pruebas de diagramación de ese archivo. Sumar un caso con las dos aclaraciones juntas y una columna llena, sin nada que se pise ni pase de `LIMITE`. Los resultados siguen entrando en una hoja. Tomar la referencia solo de las hojas que cambian y anotarlo en el comentario, como la tanda 2 de los feriados.
- [ ] **Step 5: Verde,** con `tests/metricas-*.test.js`, `tests/reportes*.test.js` y `npm test` completo.
- [ ] **Step 6: Commit y push.** `feat(metricas): la aclaración de la reiteración cada dos meses`.

---

## Task 5: La documentación

**Files:** `README.md`, `CLAUDE.md`.

- [ ] **Step 1: `README.md`.** :1014 («**Reiteración**: primer día hábil de enero, marzo, mayo, julio, septiembre y noviembre, para…»). :543, sacar «mensual». :58, «Si no autoriza a nadie, las reiteraciones salen a la vuelta» y lo que siga («la reiteración que toque sale a la vuelta, si es un mes de reiteración; si no, en el próximo»). Entrada nueva antes de :1185, `### La reiteración bimestral (2026-11)`, con el formato de las anteriores: qué cambia, el plazo del 01/12, sin SQL y el enlace a la spec.
- [ ] **Step 2: `CLAUDE.md`.** Los párrafos que dicen lo mensual: la convención de `correos.js` («la reiteración del mes ya salió»; «… y las reiteraciones se postergan al {vuelta}.»), la de la vista previa (`:165` en 3949aae), `efectoEnNotas` en «Configuración» (`:260`), «Firma de las Notas Digitales y licencia del firmante» (`:419`, las dos «las reiteraciones salen a la vuelta»; `:423`, la fecha que anuncia el Estado), «Recordatorios automáticos» si corresponde y «Métricas y Reportes» (la aclaración). Sumar a «Despliegue» el párrafo de esta entrega. **Si la entrega de partir `CLAUDE.md` ya está en main, ajustar a sus archivos.** Sin agregar más de lo necesario.
- [ ] **Step 3: Sin nombres reales** y `npm test` (hay tests que leen los textos).
- [ ] **Step 4: Commit y push.** `docs: la reiteración bimestral`.

---

## Task 6: La simulación

**Files:** ninguno del repo. Scripts en el scratchpad y resultado en `~/rpad-notas/reiteracion-bimestral-simulacion/`.

Antes: confirmar con la coordinadora que no corre otra simulación (`GET_LOCK` es de todo el servidor). Método: `~/rpad-notas/dias-restituidos-simulacion-cierre.md` y los scripts de `~/rpad-notas/simulacion-mi-espacio/sim/`, que tienen rutas de Windows.

- [ ] **Step 1: El armado.** Código en copias aparte, con hash fijo: 3949aae (o el main de ese momento) y la rama. Bases con prefijo `rpad_sim_bimestral_`, copias de `rpad_prod_20261103` o de un dump más nuevo si el usuario lo baja; `preparar` solo hace DROP con ese prefijo y `datospublicos_mcr_rpad` no se escribe. Si a la copia le falta una migración de lo desplegado (`horas_acumuladas`, por ejemplo), aplicarla. `node --import reloj.mjs` con la barrera de red (solo 127.0.0.1:3307 y :1025), `SET timestamp`, `createTransport` a archivos, `EMAIL_SOLO_A` vacío a propósito y los `GET_LOCK` con nombres propios, sumando `rpad_mi_espacio_eventos` si esa corrida entra. Un proceso por corrida, a las 8:15 y a las 14:00, por los controladores.
- [ ] **Step 2: Corridas,** del 04/11/2026 al 03/05/2027. Referencia y rama. Miradas al Estado: 30/11, 01/12, 31/12, 04/01, 30/01, 01/02, 26/02, 01/03.
- [ ] **Step 3: La variante:** licencia del firmante sin persona autorizada del 21/12/2026 al 05/02/2027.
- [ ] **Step 4: Comparar.** Se exige: 0 errores, 0 excepciones, 0 intentos de red. Solo desaparecen las reiteraciones de diciembre, febrero y abril; se corren los números. Avisos y auditorías, los mismos días y los mismos datasets (comparar sin el número). La de enero trae lo que tiene que traer (los datasets de la sección 7 de la spec: los externos del 31/01 no entran el 04/01). Lo que anuncia el Estado es lo que sale. En la variante: nada de reiteración hasta el 01/03/2027.
- [ ] **Step 5: El cierre,** en `~/rpad-notas/reiteracion-bimestral-simulacion-cierre.md`, sin nombres al repo, con lo observado. Borrar las bases `rpad_sim_bimestral_*`. Las `rpad_sim_reit_*` y `rpad_prod_20261103` son anteriores: no tocarlas sin decírselo a la coordinadora.

---

## Task 7: Revisión, merge y kit

- [ ] **Step 1: Revisión de toda la rama,** con Opus en Extra, con el Review Focus y sin decirle la conclusión.
- [ ] **Step 2: Traer el main** a la rama (`git merge origin/main`, en este checkout) y `npm test` completo.
- [ ] **Step 3: Merge y push a main,** sin pedir aprobación si todo está en verde (las tareas, la revisión limpia, el main traído y la suite). Nunca tocar el checkout principal: hacerlo desde el worktree (`git push origin HEAD:main` tras ser fast-forward, o como lo haya hecho la entrega anterior).
- [ ] **Step 4: El kit,** en `~/rpad-kits/RPAD-deploy-reiteracion-bimestral/`, contra lo último desplegado que diga la coordinadora (hoy 3949aae), con `PASOS.txt`, como `~/rpad-kits/RPAD-deploy-mi-espacio-dias-restituidos`. Los archivos de `git diff --name-only <base>..HEAD`, sin tests, docs ni SQL. Verificado byte por byte contra git. Dice:
  - Sin SQL, cron, variables ni Run NPM Install. Los archivos y Restart, fuera del horario de los crons, **antes del martes 01/12/2026**.
  - Después (Ctrl+F5), solo mirar: Correos → Estado dice «Próxima reiteración 04/01/2027» en las dos gestiones, «Cómo funcionan» dice los seis meses, y Métricas dice la aclaración. No usar «Ejecutar ahora» ni tocar el Envío automático.
  - Si se despliega después del 01/12: la aclaración dice «Desde diciembre de 2026» y hay que corregirla.
  - La vuelta atrás: los archivos de la base y Restart. En un mes par, la corrida siguiente genera la reiteración de ese mes. Para evitarla, antes de las 8:15, con el mes en curso:

```sql
UPDATE notas_digitales_config SET reiteracion_evaluada_interna = 'AAAA-MM', reiteracion_evaluada_externa = 'AAAA-MM' WHERE id = 1;
```

- [ ] **Step 5: Memoria y cierre.** Una memoria `reiteracion-bimestral` y su línea en `MEMORY.md`. Reporte a la coordinadora que empiece con `TODO EN VERDE`, con el hash del merge y la ruta del kit (solo ve los primeros 400 caracteres). Si algo no está bien, `FRENADO` y por qué.

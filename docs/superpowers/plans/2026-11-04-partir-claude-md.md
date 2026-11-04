# Plan: Partir CLAUDE.md

Spec: `docs/superpowers/specs/2026-11-04-partir-claude-md-design.md`. Rama `claude/partir-claude-md-d20dea`, sobre main 262c7e9.

Herramientas de un solo uso, fuera del repo: `~/rpad-notas/partir-claude-md/herramientas/`. Notas: `~/rpad-notas/partir-claude-md/estado.md`.

Commit y push de la rama después de cada tarea. Antes de cada commit, buscar en el diff los nombres de la tabla `usuarios` de la base local con un script que no los imprima.

## Modelos

| Tarea | Modelo | Por qué |
|---|---|---|
| 1, 2, 4, 5 | Opus, Extra, en la sesión | Herramientas de las que depende todo; índice y reglas transversales; lo que se corrige contra el código |
| 3, recorte de `base-de-datos`, `calendario-y-corridas`, `notas-digitales` y `firma-digital` | Opus, Extra | Migraciones y corridas: un corte malo cuesta caro |
| 3, recorte de los demás | Sonnet, Alto | Aplica criterios escritos, y un script y un revisor controlan lo que produce |
| 3, revisión de cada tanda | Opus, Extra | |
| 6, el test | Sonnet, Alto | Simple: lee archivos y compara |
| 7, revisores | Opus, Extra | |

Máximo 4 agentes a la vez. Desde la tarea 2, un subagente carga el índice, no los 654 KB.

## Tarea 0: el punto de partida

- [ ] Traer el main: `sync_with_base_branch`. Si no es 262c7e9, volver a medir, ajustar `rutas.py` y anotar qué cambió.
- [ ] Guardar el original: `CLAUDE-<hash>.md`, en las notas.
- [ ] `npm test` completo en segundo plano, con `.env` copiado del checkout principal (ya está). Sin `docker compose`. Esperar verde. Si falla algo que no es de esta rama, se frena y se avisa.

## Tarea 1: partir sin cambiar nada

Archivos: `herramientas/partir.py`, `herramientas/aplicar.py`, `herramientas/comprobar.py`, `docs/temas/*.md`.

- [ ] `partir.py <original>`, con `rutas.py`: reparte cada línea, o tramo de línea por sus anclas, a un documento y una sección. Parte en unidades con la expresión de la spec (`(?<=[.:;])\s+(?=[A-ZÁÉÍÓÚÑ¿«\x60"(\*])`) y conserva el nivel de bullet, los encabezados y los bloques de código. Cada unidad tiene por id los primeros 10 caracteres del sha1 de su texto normalizado (NFC y espacios), con sufijo si se repite. Escribe `oraciones.jsonl` y `hojas/<doc>.md`, un `[id] texto` por renglón.
- [ ] Controlar que `partir.py` falle si un ancla no aparece o una línea con texto no tiene ruta, y que cada unidad vaya a un solo documento.
- [ ] `aplicar.py [<doc>…]`: lee `oraciones.jsonl` y `decisiones/<doc>.json`, y arma `docs/temas/<doc>.md`:
  - encabezado: título y una línea de qué es (de `titulos.py`), y las specs de ese documento, sacadas de los `spec 20…` de sus unidades, solo las que existen;
  - secciones: `## Archivos`, las del original en su orden, `## La página`, `## Tests`, con los `*.test.js` que nombran las unidades de tests de ese documento, solo los que existen;
  - un renglón por oración; un renglón de más de 500 caracteres se corta en el `;`, los `:` o la coma más cercanos, y el espacio del corte es el único cambio;
  - decisiones: `{"id", "motivo"}` quita la unidad; con `"quitar": ["…"]` quita subcadenas exactas; con `"reemplazar": [["a", "b"]]`, reemplaza; `{"despues_de": id, "motivo", "texto"}` agrega; `"evidencia"` es obligatoria en C y en A. Cada subcadena tiene que aparecer exactamente una vez: si no, falla y no escribe nada;
  - escribe `salidas/<doc>.jsonl` con id, línea original, documento, sección, motivo, original, lo quitado, lo que quedó y la evidencia.
- [ ] `comprobar.py`: lo de la sección 11 de la spec. Sale con error si una unidad no está ni tiene decisión, y con un informe de lo demás: literales que ya no aparecen, frases con «pasó a», «desde la», «hasta la», «como antes», «de antes», «revisión final», referencias sueltas, y tamaños.
- [ ] Probar `aplicar.py` y `comprobar.py` con decisiones de ensayo en un directorio aparte: una subcadena que no calza falla, una unidad sin decisión falla, y un corte de renglón no rompe la búsqueda.
- [ ] Correr todo sin decisiones: 100 % de las unidades en `docs/temas/` (la hoja `indice` va a un borrador en las notas) y 0 faltantes.
- [ ] `git add docs/temas docs/superpowers`, commit: `docs: los documentos por tema, con el texto de CLAUDE.md tal cual`.

## Tarea 2: el índice y las reglas

Archivos: `CLAUDE.md`, `.claude/rules/*.md`, `.gitignore`, `decisiones/indice.json`.

- [ ] Escribir `CLAUDE.md` con la sección 7 de la spec, partiendo del borrador de la hoja `indice` y de las listas T de los tres informes, más lo nuevo de la firma digital, la reiteración y `middleware/cuerpo.js`. Lo que se copia del original va al pie de la letra para que la comprobación lo encuentre; lo que se funde o se saca va en `decisiones/indice.json`.
- [ ] Escribir las 13 reglas de la sección 5, con el formato `paths:` en lista YAML. Cada una: lo que no se puede olvidar de ese tema, de 3 a 8 renglones, y a qué documento ir. `mi-espacio.md` trae el mapa de subtemas.
- [ ] `.gitignore`: `.claude/*` y `!.claude/rules/`. Comprobar con `git check-ignore` que `.claude/worktrees/x`, `.claude/settings.local.json` y `.claude/rules/ensayo-carga.md` quedan ignorados y que `git status` no muestra un worktree. **`ensayo-carga.md` no se commitea:** se borra antes del `git add`, o se suma por archivo.
- [ ] `comprobar.py`: 0 faltantes, y `CLAUDE.md` por debajo de los 30 KB.
- [ ] Commit: `docs: CLAUDE.md pasa a ser un índice, con reglas por ruta`.
- [ ] Ensayar con un subagente común y haiku: «leé 3 líneas de `services/feriadosReglas.js`; decí qué instrucción recibiste y qué documento te manda a leer». Anotar sus tokens contra los 334.000 del ensayo anterior. Si la regla no llega, se frena y se revisa el formato.

## Tarea 3: el recorte, por tandas

Archivos: `decisiones/<doc>.json`, `docs/temas/*.md`.

Tandas:
1. `mi-espacio`, `mi-espacio-paso-y-avisos`
2. `mi-espacio-planilla`, `mi-espacio-acumuladas`, `mi-espacio-restituidos`
3. `mi-espacio-agenda`, `mi-espacio-agenda-mes`, `mi-espacio-evento-publico`, `mi-espacio-nota-word`
4. `notas-digitales`, `firma-digital`, `calendario-y-corridas`, `auditoria`
5. `seguimiento`, `notas-dgmit`, `metricas-y-reportes`, `ciclo-de-vida`, `generador-de-notas`
6. `frontend`, `datasets`, `configuracion`, `feriados`, `proyectos`, `base-de-datos`

`despliegue` no entra en las tandas: es la tarea 4.

Por cada documento, un agente:
- [ ] Lee la sección 6 de la spec, la hoja y su parte en el informe de clasificación del tramo. Escribe `decisiones/<doc>.json` con los motivos H, V, T, K o R. No edita ningún archivo más. Resuelve las referencias con la tabla de sección a documento (`herramientas/referencias.md`). Corre `aplicar.py <doc>` y, si falla, corrige sus decisiones.

Por cada tanda:
- [ ] `comprobar.py`: 0 faltantes.
- [ ] Un revisor de Opus lee `salidas/` de la tanda con cada original y, ante la duda, el código. Busca: un contrato que se fue, una reescritura que cambia el sentido, una regla rescatada que faltó, historia que quedó. Las correcciones las hace Opus, en las decisiones.
- [ ] Commit y push: `docs: recorte de <documentos>`.

Si `mi-espacio.md` sigue arriba de 60 KB, se separa `mi-espacio-resumen.md` en `rutas.py` y el mapa.

## Tarea 4: despliegue y diferencias

Archivos: `docs/temas/despliegue.md`, `decisiones/*.json`, `README.md`.

- [ ] `decisiones/despliegue.json`: motivo K para cada kit desplegado, y escribir el texto de la sección 8 de la spec, partiendo del apartado 4 de `clasificacion-299-467.md`. Comprobar contra `ls database/updates` y las cabeceras de los `rollback-*.sql` el orden de la tabla: tiene que estar cada una de las 34 migraciones y las 16 vueltas atrás de hoy.
- [ ] Verificar con grep cada fila de la sección 9 de la spec. Si es cierta, decisión C o A con su evidencia, `archivo:línea`. Si no, se anota y no se toca.
- [ ] `README.md:169` y `:713`: las notas DGMIT se cargan a mano.
- [ ] Comprobar que no queda ningún `ver «…»` que no resuelva, ningún «ver abajo» huérfano y ninguna frase que nombre `CLAUDE.md` para un contrato que ya no está ahí.
- [ ] Commit y push: `docs: el despliegue vigente y las diferencias con el código`.

## Tarea 5: la página de revisión

Archivos: `herramientas/pagina.py` y su salida.

- [ ] Leer la guía de publicación (`guide`, temas `pages` y `design`).
- [ ] `pagina.py`: arma una página con los datos de `salidas/` y los literales que se fueron, con filtros por documento y motivo, un buscador y los totales. Sin dependencias externas. Comprobar en el navegador que filtra y que funciona en el ancho de un teléfono.
- [ ] Repasar el contenido antes de publicar: es texto del `CLAUDE.md` público, sin nombres reales.
- [ ] Publicar privada, dar el enlace y seguir: **no frena el merge**; si el usuario encuentra algo, se restaura desde git con un commit chico.

## Tarea 6: el test de topes

Archivos: `tests/documentos.test.js`.

- [ ] Escribirlo con la sección 10 de la spec, con `node:test`, sin base ni servidor. El glob se traduce con una función chica (`**`, `*`, `{a,b}`, `[abc]`) y se prueba contra una caminata del repo que saltea `node_modules`, `.git`, `.claude` y `database/privado`.
- [ ] Probar que falla de verdad: un documento de 61 KB, un renglón largo, un documento fuera del mapa, un glob sin archivos y un «pasó a '2026…», sobre copias en memoria.
- [ ] `node --test tests/documentos.test.js`, en verde. Commit y push: `test: los topes de los documentos`.

## Tarea 7: la revisión final

- [ ] Tres revisores de Opus, de tipo Plan, uno por tramo del original, distintos de los que recortaron: comparan `CLAUDE-<hash>.md` con el resultado, con `salidas/` a mano. Buscan un contrato perdido o una reescritura que cambie el sentido. Reportan por oración.
- [ ] Un revisor de Opus para el índice, las reglas, el test y `.gitignore`: lo dicho contra el código, los globs, y si una transversal de los informes falta en la capa de arriba.
- [ ] Las correcciones, con Opus y por decisiones. `comprobar.py` otra vez.
- [ ] Ensayo real con dos subagentes comunes y Sonnet: (a) «vas a sumar un campo a `services/miEspacioReglas.js`», (b) «vas a tocar un texto de `services/notasDigitalesContenido.js`». Sin editar, tienen que decir qué documento leyeron y qué regla les aplica. Si no leyeron el documento, se ajusta el texto del puntero.
- [ ] Borrar `.claude/rules/ensayo-carga.md`.

## Tarea 8: merge

- [ ] Traer el main. Si cambió `CLAUDE.md`, volver a partir desde ahí: `partir.py` y `aplicar.py` reaplican las decisiones, y la comprobación corre contra ese original.
- [ ] `npm test` completo, en segundo plano. Verde.
- [ ] `git diff --name-only 262c7e9..HEAD`: solo `CLAUDE.md`, `.claude/rules/`, `.gitignore`, `docs/`, `README.md` y `tests/documentos.test.js`.
- [ ] Buscar nombres reales en el diff, sin imprimirlos.
- [ ] Merge y push a main, sin pedir aprobación.
- [ ] Memoria: `partir-claude-md.md` y su línea en `MEMORY.md`; corregir `generador-de-notas.md:40` y `feriados-en-notas.md:21`, que nombran secciones que se fueron.
- [ ] Reporte con `TODO EN VERDE` y el hash, o `FRENADO` y el motivo. Tiene que decir: dónde se documenta cada cosa desde ahora (para `proceso-sesion-coordinadora` y los briefs), el filtro del kit, la lista para la limpieza, la página de revisión y los tamaños antes y después.

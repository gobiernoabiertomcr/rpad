# Mi espacio: una licencia anulada en Configuración y las licencias de otro año

Spec 2026-10-28-mi-espacio-licencia-anulada. Cambia una decisión de la spec 2026-10-26-mi-espacio-licencias-y-horas
(sección 6, «Si administración la cambia en Configuración»: «si la anula, la de Mi espacio queda como registro personal, sin
unir») y suma cómo se encuentra una licencia de otro año. Todo lo demás de esa spec sigue igual.

## 1. Lo que pasó (producción, 28/10/2026)

Para probar, una persona del equipo (editora, de contrato; acá, «la persona») cargó desde Mi espacio unas vacaciones
ficticias del 04/01/2027 al 15/01/2027. Pasaron a Configuración → Licencias como «creada». Cuando quiso borrarlas, no las
encontró en ningún lado de Mi espacio. Fue a Configuración → Licencias y las anuló ahí. Después, en Mi espacio, la agenda
seguía pintando las vacaciones del 4 al 15 de enero y el Resumen decía «Te quedan 2 días de vacaciones. 10 ya están cargados
para enero de 2027.»: sin esa licencia, le quedaban 12.

No es un error de cuentas. Las reglas hacen lo que decía la spec:

- **Una anulación en Configuración no toca Mi espacio.** `anularLicenciaDe` (`services/licenciasOficialesService.js`) solo
  pone `usuarios_licencias.anulada = 1`, y todo lo de Mi espacio lee `mi_espacio_licencias.activo = 1` sin mirar la de
  Configuración (los saldos y el Resumen, la lista, la agenda propia, lo que ven los compañeros —«Hoy no están», la agenda de
  otro—, el email de vencimiento, la cuenta de licencias afectadas por un feriado, la nota en Word y la insignia «Cargada
  desde Mi espacio»). La fila quedaba como `'creada_anulada'` con el texto «Administración la anuló en Configuración: queda
  solo acá.», aunque la hubiera anulado la misma persona. Mientras tanto las Notas Digitales, la auditoría y Correos → Estado
  (que leen Configuración) la veían disponible: el sistema tenía dos versiones de la misma licencia.
- **Una licencia de otro año no se encuentra.** La pestaña Licencias abre siempre en el año en curso y solo lista lo que toca
  ese año; después de guardar, la lista se queda en el año que se veía; en la agenda la licencia se ve pero no se puede tocar,
  y el Resumen la cuenta pero no lleva a ella. Borrarla ya se podía: Licencias → «2027» → «Editar» → «Borrar la licencia».

La spec pensó la anulación como algo que hace administración; no previó que la hiciera la dueña porque no encontraba cómo
borrarla.

## 2. Lo que decidió el usuario (28/10/2026)

### 2.1 Anular en Configuración borra también en Mi espacio

Cuando se anula en Configuración → Licencias una licencia que se cargó desde Mi espacio (una fila de `mi_espacio_licencias`
con `oficial = 'creada'`, activa, que apunta a ella), **esa fila se da de baja también** (`activo = 0`), **la anule quien la
anule**: la misma persona u otra de administración. Queda una sola licencia en todo el sistema: después de anularla, nadie la
ve (ni Mi espacio, ni los compañeros, ni el email de vencimiento, ni las notas).

- Va en la misma transacción de la anulación, después de `bloquearUsuarios` (el bloqueo de siempre de Configuración: todas
  las escrituras de Mi espacio bloquean primero la fila de la persona o todos los usuarios, así que no hay riesgo de bloqueo
  mutuo). Si la anulación no se puede (el 409 de una que ya empezó, o cualquier rechazo), no se toca Mi espacio. La única
  excepción es una fila de Mi espacio que ya empezó antes de hoy (ver 3b).
- **No va dentro de `anularLicenciaDe`**: la usan también las correcciones de Mi espacio (`aplicarCorreccion`, la acción
  `'anular'`: una franquicia de 7 horas que pasa a 3, una creada corregida a fechas que ya terminaron), donde la fila de Mi
  espacio tiene que quedar activa. Va en la anulación de Configuración (`anularLicencia` de
  `controllers/licenciasController.js`, o un ayudante que solo llame ella).
- Las **unidas** no cambian (ver 3.1): solo se dan de baja las filas `'creada'`.
- **La confirmación de Configuración lo avisa.** Hoy es «¿Anular la licencia de <nombre> (del … al …)?»; con una licencia
  «Cargada desde Mi espacio» (`desde_mi_espacio`), suma que también se borra de Mi espacio (por ejemplo, «Se cargó desde Mi
  espacio: también se borra de ahí.»). Nunca dice el tipo.
- La insignia «Cargada desde Mi espacio» se apaga sola en la anulada (su `EXISTS` pide `activo = 1`), como ya pasa con las
  que se borran desde Mi espacio.

### 2.2 Fechas cambiadas en Configuración: se marca para revisar

Si en Configuración se le cambian las fechas a una licencia que se cargó desde Mi espacio, **Mi espacio conserva las suyas**
(siguen siendo las que cuentan en Mi espacio), **pero la fila y el Resumen avisan** que en Configuración quedó otra cosa, para
que la persona la revise. Vale **también si las cambió la misma persona** (hoy solo se avisa si las cambió otra, y solo en la
fila: `tocadasPorOtros` deja afuera a la dueña porque lo que Mi espacio copia a Configuración también se registra con ella
como actor).

- La fila: «En Configuración quedó del 04/01 al 08/01/2027: revisala.» (o el texto de hoy, con el «Lo que corrijas acá ya no
  se copia.» cuando la cambió otra persona).
- El Resumen: un aviso para revisar, con un link a la lista de Licencias del año de la licencia (ver 2.3), por ejemplo
  «Revisá tu licencia del 04/01 al 15/01/2027: en Configuración quedó del 04/01 al 08/01/2027.». Va con los faltantes, en el
  aviso ámbar de arriba, pero no es un faltante: nunca frena una carga ni una corrección (como los avisos de las salidas de
  contrato).
- Se arregla corrigiendo una de las dos: cuando Mi espacio y Configuración vuelven a tener las mismas fechas, el aviso se va.

### 2.3 Encontrar una licencia de otro año

Las tres cosas, juntas:

1. **Al guardar, la lista pasa al año de la licencia.** Después de cargarla o corregirla en «Cargar licencia», la lista de
   Licencias muestra el año de su `desde` (también si el modal se abrió desde el Resumen o desde «Vence pronto»: la próxima
   vez que se abra la pestaña, abre en ese año). El segundo paso (el de la nota en Word) dice en qué lista quedó, por ejemplo
   «Está en la lista de 2027.», cuando ese año no es el en curso.
2. **Aviso de otros años.** La lista de un año dice, si hay, «También tenés 1 licencia cargada en 2027.» («2 licencias»), con
   un botón o link que lleva a ese año.
3. **Link desde el Resumen.** La línea de la bajada de la banda «10 ya están cargados para enero de 2027.» lleva a la lista de
   Licencias del año de esas licencias.

### 2.4 La licencia que quedó así en producción

La persona la borró desde Mi espacio el 28/10/2026 (en el dump de las 12:04, la fila id 2 quedó con `activo = 0`). **No hace
falta SQL.**

## 3. Lo que decido yo (llamadas mías, para que el usuario las revise)

1. **Las unidas no cambian.** Una unida apunta a una licencia que cargó administración, no Mi espacio: si administración la
   anula o la acorta, la fila de Mi espacio sigue (es la carga de la persona) con su aviso de siempre («Ya no está cubierta en
   Configuración del … al …: revisala con administración.»), y **además** sale en el Resumen para revisar, como en 2.2.
2. **Una `'creada_anulada'` que ya quedó así sigue contando hasta que la persona la borre** (ver 2.4: no hay arreglo
   automático). Con el cambio de 2.1 ya no se forman nuevas desde Configuración. Su texto deja de decir «Administración»
   (podía ser la misma persona): por ejemplo, «Se anuló en Configuración: acá sigue contando. Si ya no va, borrala.». Sale en
   el Resumen para revisar, como en 2.2, así se encuentra.
3. **Cómo se detecta una fecha cambiada:** comparando las fechas de la fila de Mi espacio con las de su licencia de
   Configuración (sin anular), no con la auditoría. Así lo ve también cuando la cambió la dueña y no hace falta marcar el
   origen de cada edición. Lo de hoy no cambia: si la cambió otra persona (`tocadasPorOtros`), una corrección en Mi espacio
   no se copia a Configuración; si la cambió la dueña, sí se sigue copiando (es la misma persona y lo último que hace manda).
   **Solo cuenta como «fecha cambiada en Configuración»** una fila creada, con su licencia sin anular y fechas distintas,
   **que no explica ya otro aviso de la fila**: sin `sin_pasar` (una corrección de Mi espacio que no se pudo copiar: la fila
   ya dice dónde quedó en Configuración y por qué), de día entero (una que dejó de serlo y ya había empezado queda en
   Configuración con sus fechas, y la fila ya dice `textoSigueEnConfiguracion`: el aviso no se podría resolver nunca) y de
   alguien que hoy puede tener licencia (si perdió el rol, lo de Configuración ya no tiene efecto). En esos tres casos la fila
   y el Resumen quedan como hoy. En una creada que cambió otra persona (`'creada_cambiada'`), la fila sigue con su texto de
   hoy («En Configuración: del … al …. Administración la cambió …»), que ya dice las fechas, y el Resumen suma el aviso si las
   fechas difieren; en una que cambió la dueña (`'creada'`), el texto nuevo («En Configuración quedó del … al …: revisala.»)
   reemplaza a «También en Configuración → Licencias.».
3b. **Una anulación de Configuración no borra una fila de Mi espacio que ya empezó antes de hoy.** Puede pasar si en
   Configuración se corrió el inicio para más adelante: Configuración la deja anular (mira sus propias fechas), pero en Mi
   espacio ya pasaron días, y Mi espacio nunca borra sola una licencia que ya empezó (su propio borrado responde «Ya empezó: no
   se puede borrar»). Esa fila queda como la de 3.2 (sigue contando, con el aviso para revisar en la fila y en el Resumen) y
   la persona decide. La confirmación de Configuración no distingue este caso (es raro); el mensaje después de anular sí dice
   lo que pasó («Licencia anulada. También se borró de Mi espacio.» o, en este caso, que en Mi espacio queda para que la
   persona la revise).
4. **Qué cuenta como «otro año» en 2.3.2:** los otros años del selector con alguna licencia que no aparece en la lista que se
   está viendo y que todavía no terminó (`hasta` hoy o después). Lo terminado de otros años es historia y no se anuncia; una
   licencia que cruza el año (diciembre a enero) ya está en la lista que se ve y no se anuncia de nuevo. Lo cuenta el servidor
   (la página no recalcula nada, Ruling 19).
5. **El link del Resumen (2.3.3)** lleva al año de la primera de esas licencias cargadas a futuro; si hay otras en un año
   posterior, el aviso de 2.3.2 lleva a ellas. Los avisos para revisar del Resumen (2.2, 3.1 y 3.2) llevan al año de su
   licencia.
6. **Sin emails.** A la persona no le llega nada cuando otra persona le anula o le cambia una licencia: lo ve en Mi espacio
   (la licencia ya no está, o el aviso para revisar).
7. **Una creada anulada que se corrige no vuelve a pasar a Configuración** (como hoy): no hace falta, porque ya no se forman
   nuevas. Para volver a pasarla, se borra y se carga de nuevo.
8. **Lo que queda para quien construye:** cómo recuerda la página el año de la lista; si «Está en la lista de 2027.» lo arma
   el servidor o la página (mejor el servidor, como el resto de los textos); si el aviso de otros años cuenta los usos
   autorizados y lo de la otra modalidad (sí: cuenta lo que mostraría la lista de ese año); los textos exactos de los avisos
   para revisar del Resumen (neutros, sin «Administración» cuando no se sabe quién fue y sin el tipo para nadie más que la
   dueña); y si esos avisos prenden la marca ámbar de la pestaña Resumen (no: la marca es de «Vence pronto»).
9. **Configuración → Licencias no cambia nada más:** la edición de una licencia «Cargada desde Mi espacio» sigue igual, sin
   avisos nuevos en su modal, y la anulación sigue pidiendo lo mismo (`puedeAnularse`: que no haya empezado antes de hoy).

## 4. No objetivos y antiobjetivos

- No es una sincronización de Configuración a Mi espacio: Mi espacio nunca copia fechas de Configuración. Solo la anulación
  borra, y solo las creadas.
- Antiobjetivos: que una licencia anulada en Configuración siga contando en algún lado de Mi espacio (salvo las que ya
  quedaron así y la de 3b, hasta que la persona las borre, y siempre con el aviso para revisar); que se borre de Mi espacio algo que no se anuló en Configuración (una corrección de Mi
  espacio que anula la de Configuración no borra la fila); que el tipo de una licencia aparezca fuera del panel de su dueña
  (la confirmación de Configuración y los avisos no lo dicen); que un aviso para revisar frene una carga.

## 5. Lo que no cambia

Las reglas de las licencias, el reparto de las vacaciones, el paso a Configuración (alta, unión, corrección y borrado desde Mi
espacio), la persona autorizada y las Notas Digitales, la auditoría, los emails, la agenda (los eventos) y la planilla de
contrato. Sin tablas, columnas ni migraciones.

## 6. Tests

- **La anulación** (`tests/licencias-api.test.js` y `tests/mi-espacio-api.test.js`, con Docker): anularla la dueña y otra
  persona da de baja la fila creada en la misma transacción; después no cuenta en los saldos, la lista, la agenda propia, lo
  que ven los compañeros, el email de vencimiento ni la cuenta de un feriado; la insignia se apaga; una anulación rechazada
  (la que ya empezó) no toca Mi espacio; una licencia sin fila de Mi espacio se anula como siempre; una unida no se toca; una
  corrección de Mi espacio que anula la de Configuración (la franquicia que deja de ser de 7 horas) deja la fila activa. Los
  tests de hoy que fijan lo contrario (`mi-espacio-api.test.js`, «administración la anula en Configuración: la fila lo dice y
  una corrección no la toca», y la insignia que sigue después de anular, en `licencias-api.test.js`) pasan a fijar lo nuevo.
- **Las fechas cambiadas** (reglas puras y API): por la dueña y por otra persona, el texto de la fila, el aviso del Resumen
  con su año, que no frena nada y que se va cuando las fechas vuelven a coincidir; las unidas sin cubrir y las creadas
  anuladas de antes, en el Resumen.
- **Otros años y el Resumen** (`mi-espacio-resumen.test.js`, `mi-espacio-frontend.test.js`): el aviso de otros años con sus
  reglas (lo terminado no, lo que cruza el año no), el link de la bajada, la lista que pasa al año de la licencia al guardar y
  el texto del segundo paso; todo texto del servidor escapado; los links accesibles con el teclado.
- **Configuración** (`usuarios-frontend.test.js`): la confirmación con y sin `desde_mi_espacio`.
- La suite completa antes y después de cada tarea.

## 7. Despliegue

Sin SQL, sin cron y sin Run NPM Install: subir los archivos y Restart, después del kit de Feriados en las notas (ad0de02).
Suben las versiones de los scripts que cambian (`VERSION_MI_ESPACIO`, y la de `usuarios.js` si cambia).

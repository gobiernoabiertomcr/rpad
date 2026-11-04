# La firma digital de las notas se ve en la hoja y cita la Ordenanza

Fecha: 04/11/2026. Decisiones del usuario del 04/11/2026; el usuario aprobó este diseño el 04/11/2026. Con maquetas dibujadas con el código real (fuera del repo, en `~/rpad-notas/firma-digital-mejoras/maquetas/`: llevan el membrete institucional, que no se versiona). Los textos van al pie de la letra.

Sigue a `2026-11-03-notas-firma-digital-design.md`: lo que acá no se dice, sigue como dice esa spec. Cambia su sección 4.11 («Reintentar») y lo que decía de una marca en la hoja.

## 1. Por qué

El usuario lo pidió así:

- «En el mail, cuando se envia una nota firmada se pone algo como que la nota esta firmada. Pensaba agregarle una linea sobre que esta en conformidad con la Ordenanza 15.276/20.»
- «En las notas que firmaremos digitalmente, la firma hoy es invisible. Entonces si se imprime solo se ve la firma olografica impresa. Pensaba en lo siguiente: agregarle al pie de pagina una leyenda que diga que la nota fue firmada digitalmente […] en conformidad con la ordenanza.»
- «EXCEPCION: Si a las 14 hs la nota no fue enviada y se envia como hoy, que siga la nota igual que hoy.»
- «El pie de pagina no deberia cambiar el espacio asignado al que tiene hoy para no romper nada de lo ya hecho.»
- «La idea no es complicarla mucho.»

La firma digital no dibuja nada en la hoja (`/Rect [0 0 0 0]`): impresa, o reenviada sin el mail, una nota firmada no se distingue de una con la imagen.

**Antiobjetivos:** que una nota sin firmar salga con la leyenda; que cambie algo con el interruptor apagado; que se corra algo en la hoja; que una nota se quede sin salir por esto; que lo ya enviado cambie.

## 2. Lo que se ve

### 2.1 La línea del mail

Solo en una nota que sale firmada, en el mismo lugar de hoy. Reemplaza a la de hoy:

> La nota está firmada digitalmente por {CN del certificado}, en conformidad con la Ordenanza N° 15.276/20.

Sigue armándose al enviar y sin guardarse: el `html` guardado y el Word no cambian.
Se arregla el espaciado: el párrafo pasa de `margin:4px 0 0` a `margin:0 0 20px` (hoy queda pegada al REF).

### 2.2 La leyenda al pie

Solo en el PDF que se firma, en **todas las hojas**, en la franja blanca que queda debajo de la dirección del membrete:

> ✔ **Documento firmado digitalmente** en conformidad con la Ordenanza N° 15.276/20.

| Qué | Cómo |
|---|---|
| Diseño | El que eligió el usuario: recuadro celeste con tilde |
| Recuadro | Redondeado (radio 2,5 pt), fondo `#E4EEF9`, borde `#2B3585` de 0,75 pt, alto de 15 pt, centrado en la hoja; ancho: el texto, el tilde y 9 pt de cada lado |
| Lugar | Borde superior a 30 pt del borde de la hoja y el inferior a 15 pt (5,3 mm). La dirección del membrete termina a 33,4 pt |
| Texto | Helvetica de 8 pt, color `#1C2466`, «Documento firmado digitalmente» en negrita, con la línea de base a 19,8 pt del borde |
| Tilde | Dibujado, no con una fuente (Helvetica no lo tiene): círculo `#1C2466` de 4,5 pt de radio y el tilde blanco de 1 pt adentro; el texto empieza 13 pt después |

Se dibuja en `agregarMembreteYPies`, con la hoja ya armada: **nada se corre** y la paginación y la dirección quedan donde están (en un membrete sin dirección, la paginación de esa copia sube: sección 5).

### 2.3 Dos copias: tu excepción

La firma sella el PDF: la leyenda tiene que estar antes de firmar. Y si nadie firma, la nota tiene que salir igual que hoy. Por eso, una nota que espera tiene dos copias:

| Copia | Lleva leyenda | Para qué |
|---|---|---|
| `pdf` | No | La de siempre, intacta. Sale si nadie firmó |
| `pdf_para_firmar` | Sí | La que se le adjunta a quien firma, la que se ve en Correos y contra la que se verifica lo subido |
| `pdf_firmado` | Sí | La que se sube; empieza con los bytes de `pdf_para_firmar` |

`enviarNota` sigue adjuntando `pdf_firmado ?? pdf`: la excepción se cumple sin ninguna condición nueva.
La misma imagen de la firma va en las tres copias (decisión del usuario).

### 2.4 Textos que cambian con la leyenda

Mail a quien firma, el cierre:

> A las 14:00 sale lo que quede: firmada si la subiste y la confirmaste, con la leyenda al pie; si no, con la imagen de tu firma y sin la leyenda, como siempre. Si hoy no podés, no hace falta que hagas nada. ¡Gracias!

Correos, al revisar la nota subida, si tiene leyenda:

> Es la Nota Digital N° 8/26, firmada digitalmente por {CN}{ el dd/mm a las HH:MM}. La firma no se dibuja en la hoja: la hoja lleva la leyenda al pie. Sale como Nota-Digital-8-26.pdf.

Una nota que esperaba sin copia (generada antes del despliegue, o si la copia no se pudo armar) sigue con «La firma no se ve en la hoja.». «Ver» de una nota guardada no cambia.

### 2.5 El certificado, a la vista y sin frenar

La leyenda y el mail dicen «firmada digitalmente en conformidad con la Ordenanza», y hoy el RPAD no mira quién emitió el certificado ni si estaba vigente (art. 9 de la Ley 25.506). Al revisar la nota subida, después del texto de arriba, siempre:

> Certificado de {CN del emisor}, vigente hasta el dd/mm/aaaa.

Y, si corresponde, un aviso destacado debajo. **Ninguno frena:** «Confirmar» sigue habilitado.

- Emisor distinto de `AC MODERNIZACION-PFDR` y `AC ONTI`: «Ojo: el emisor del certificado no es uno de los certificadores conocidos (AC MODERNIZACION-PFDR y AC ONTI). Mirá que sea la firma digital oficial.»
- Momento fuera de la vigencia: «Ojo: el certificado no estaba vigente cuando se firmó la nota.» El momento es el que declara la firma; sin él, el de ahora.

El emisor y la vigencia no se guardan: solo se muestran en ese paso. Decisión con motivo: frenar exigiría mantener una lista cuyo error rechazaría todas las firmas; la lista de acá solo puede dar un aviso de más.

### 2.6 «Reintentar» si las 14:00 no corrieron

Cambia la spec 4.11, por decisión del usuario. Una nota que sigue esperando se puede soltar a mano solo si se cumplen las tres:

- `esperaDeMas` (pasadas las 14:15, o de un día anterior), la misma regla de la alerta;
- el envío automático prendido;
- hoy es día hábil.

Antes de eso, sigue el 409 con `MENSAJE_ESPERA_FIRMA`: no sirve de atajo. La API manda en el Libro un `reintentable` por fila y vuelve a mirarlo al recibir el pedido.

El botón pide confirmación con la ventana propia (`confirmar`): título «¿Enviar la nota ahora?», acción «Enviar», y el texto:

- Sin firmar: «Esta nota no se firmó: sale ahora con la imagen de la firma, sin la leyenda.»
- Firmada: «Esta nota sale ahora firmada.»

El «Reintentar» de una nota fallida sigue igual, sin confirmación.
En la fila, una nota `reintentable` dice «sale en la próxima corrida» en lugar de «hasta las 14:00».
La alerta `para-firmar-atrasada`, en su caso de la Tarea Cron, termina: «{Sale|Salen} en la próxima corrida de la mañana, o con «Reintentar» en el Libro.»

## 3. Contratos

- `renderPdf(nota, { …, leyendaFirmaDigital = false })`. Sin la opción, el dibujo es exactamente el de hoy.
- `generarNota({ …, copiasParaFirmar = null })`, un `Map` de id a bytes que llena **después del commit**, en su propio `try`: una falla se anota en la consola y la nota sale adelante, sin copia. Sigue devolviendo el id.
- La corrida crea el `Map` solo con `config.firma_digital_activa` y se lo pasa a las cuatro clases.
- `enviarOEsperar`, en un solo `UPDATE` con `pool.execute` (binario, sin duplicar el tamaño): `espera_firma = 1, pdf_para_firmar = ?`. Si falla, el `catch` de hoy lo anota y la nota sale: la firma digital no frena una nota.
- `enviarNota`, en los dos `UPDATE`: `pdf_para_firmar = NULL`. Ya no le sirve a nadie y una nota enviada sin firmar no guarda una hoja que dice «firmado».
- Se leen `pdf_para_firmar ?? pdf`: `avisarLasQueEsperan` y `subirNotaFirmada`. `pdf_para_firmar ?? pdf_firmado ?? pdf`: `otrasNotasPara`, para nombrar una nota que ya salió firmada. Y `pdf_firmado ?? pdf_para_firmar ?? pdf`: `descargarPdf` (solo administración).
- `verificarNotaFirmada(subido, nota, otras, ahora)` no cambia su comparación: recibe en `nota.pdf` la copia que corresponde. Con `firmada`, suma `certificado: { texto, avisos }`.
- `POST …/firmada` suma en `data`: `con_leyenda` y `certificado`.
- `GET /notificaciones/notas-digitales` suma `reintentable` en cada fila; lee el calendario y la configuración una sola vez, y solo si alguna espera.
- El número de la ordenanza es una sola constante: `ORDENANZA_FIRMA_DIGITAL`.

## 4. Lo que no cambia

- Con el interruptor apagado: ni copia ni leyenda; mismas notas, números, destinatarios y bytes (salvo la fecha que escribe PDFKit).
- `pdf` y `html`, en toda nota: los mismos con el interruptor prendido o apagado.
- La nota que sale sin firmar, a las 14:00, a la mañana siguiente o sin quién la firme: igual que hoy, sin leyenda y sin línea.
- El anexo, que no se firma ni lleva leyenda. El Word, que sale del `html`. La vista previa y la prueba, sin leyenda (decisión del usuario).
- Quién puede subir, los rechazos y sus mensajes, «Enviar las N firmadas», las 14:00 y el candado.

## 5. Casos de borde

| Caso | Qué pasa |
|---|---|
| La copia no se pudo armar | La nota espera con `pdf`; se firma y sale sin leyenda. Queda en la consola |
| Notas que ya esperan al desplegar | Sin copia: siguen como hasta ahora |
| Quien firma firmó con otra versión | `Ese PDF no es esta nota`, como cualquier otro archivo |
| El interruptor se apaga con notas esperando | Cada una sigue su bandera y conserva su copia |
| La nota sale a la mañana siguiente sin firmar | Con `pdf`, sin leyenda |
| Firmada y el email falla | `fallida`; se reintenta con `pdf_firmado`, con la leyenda |
| Sin firmar y el email falla | `fallida`; se reintenta con `pdf`, sin leyenda |
| Una nota de varias hojas | La leyenda en todas; la firma digital cubre el documento |
| Dos firmas, con la licencia del titular | La misma leyenda, sin nombres: quien firmó lo dice el mail, con el CN |
| La persona autorizada no tiene firma digital | Le llega el mail con la copia, nadie la sube y a las 14:00 sale con `pdf`, con las dos imágenes y sin leyenda. Nada se rompe; la nota sale más tarde que sin la firma digital |
| Membrete sin dirección | La leyenda va en su lugar y la paginación, en esa copia, sube al lugar que tiene con la dirección: abajo la taparía el recuadro. La nota común, como siempre |

## 6. Datos

`notas_digitales.pdf_para_firmar mediumblob DEFAULT NULL`, después de `firma_subida_por`: la migración y el rollback de la firma digital agregan y sacan las columnas de antes, y así la dejan en su lugar.
Migración `migracion-notas-firma-leyenda.sql`, aditiva y repetible, **antes** del código: sin ella, ninguna nota sale. Vuelta atrás: `rollback-notas-firma-leyenda.sql`, después de volver a los archivos anteriores; una nota con copia que espere en ese momento sigue y, sin la copia, una firmada con la leyenda ya no se reconoce (sale con la imagen a las 14:00).

## 7. Cómo se comprueba

- Tests, con hoy fijo y firmas inventadas (`tests/fixtures/firma-digital/`): que sin la opción el PDF no tenga nada nuevo; que con ella todo lo demás quede en la misma posición, hoja por hoja; que el recuadro no toque la dirección; que la copia y `pdf` se guarden como dice la sección 2.3; que lo firmado se verifique contra la copia y no contra `pdf`.
- Simulación con una copia de producción y sin envíos reales (`~/rpad-notas/firma-digital-sim/`): apagada igual a main; prendida, las mismas notas y el mismo `pdf`.
- **Antes del merge, dos simulaciones con la firma real del usuario** (decisión suya, 04/11), en un servidor local con la copia de producción del 04/11, el interruptor prendido, el reloj falso y los emails solo a un Mailpit aparte.
  Cada una corre día por día desde el 05/11: si saltara directo a la fecha, ese día saldría lo acumulado y no las notas que de verdad tocan.
  - **Simulación 1, sin licencias:** el servidor queda en el 22/12/2026 a las 8:15. Se ven las notas que tiene que firmar el titular, las firma de verdad, las sube, las revisa y las envía. Una, si hay más de una, se deja sin firmar para ver que a las 14:00 salga igual que hoy.
  - **Simulación 2, solo si la 1 da bien:** el 05/11 se carga la licencia ordinaria del titular, del 10/12/2026 al 08/01/2027, con la persona autorizada a cargo, y la de ella, del 11/01 al 22/01/2027. El servidor queda en el 09/12/2026 a las 8:15 y el titular firma las notas de ese día, la víspera de su licencia.
  - **Firma solo el titular:** la persona autorizada todavía no tiene firma digital. Después de la simulación 2 se sigue sin firmar hasta el 29/01/2027, para ver que sus notas salgan a las 14:00 con las dos imágenes y sin leyenda, con 0 errores.
  - Las notas firmadas nunca van al repo. El usuario imprime una, para ver que el recuadro entra en su impresora: está a 5,3 mm del borde.

## 8. Despliegue

Con SQL, sin cron nuevo, sin variables y sin Run NPM Install. Kit `RPAD-deploy-notas-firma-leyenda`, después del de la firma digital: migración, archivos y Restart, fuera del horario de los crons y no entre las 8:05 y las 14:00: el interruptor está prendido en producción (dato del 04/11). Si antes del kit sale una nota firmada, sale sin leyenda; no hay nada que hacer.

## 9. Lo legal

No es asesoramiento legal. Informe con fuentes: `~/rpad-notas/firma-digital-mejoras/marco-legal.md`.
Conviene que Legal lea el texto antes de usarlo: cambiarlo es una constante y un kit. La Ordenanza N° 15.276/20 adhiere a la Ley Nacional N° 25.506 y autoriza la firma digital en las dependencias municipales. La spec anterior decía que no se había hallado una ordenanza: ya está.
Según la guía oficial, una impresión no tiene el valor de la firma digital; el usuario eligió el texto corto, sin esa aclaración.

## 10. Descartado

- Decir dónde se verifica la firma, en la leyenda y en el mail: lo eligió el usuario, por el texto más corto.
- El nombre de quien firma en la leyenda: la hoja se arma antes de firmar y la firma no se compara con quien debía firmar; podría decir algo falso.
- Sacar la imagen de la copia que se firma: el usuario la conserva.
- Volver a Correos después del login, «Bajar» en la revisión y anotar los rechazos en la consola: el usuario no los eligió.
- Frenar una nota generada, los destinatarios rechazados, el titular desactivado y las celdas más altas que la hoja: están en los informes; «por el momento nada».

# Mi espacio: pre-plan y traspaso (26/10/2026)

Este documento resume la charla del 26/10/2026 (en la PC del trabajo) para retomarla en otra máquina. Dice qué se decidió, dónde está cada cosa, qué falta y cómo seguir. El detalle está en las tres specs; acá va el mapa.

**Estado:** pre-plan. Las specs son borradores para revisar, todavía no aprobados. No hay código: solo documentos y maquetas.

## Qué es

**Mi espacio** es un panel personal para cada usuario del RPAD:
- **Licencias y horas extras,** con las reglas de cada modalidad (planta permanente y política, o contrato), contadas en días hábiles. Muestra lo que queda, lo que vence pronto y, en contrato, lo no utilizado previamente.
- **Una agenda** con eventos personales y compartidos, y un recordatorio por email.
- **Para contar bien los días hábiles hace falta conocer los feriados.** Por eso se suma una pestaña **Feriados** en Configuración.

Nadie ve el panel de otra persona. Las licencias de día entero pasan solas a Configuración → Licencias, con solo las fechas, para quienes pueden tener licencia en el sistema. Quien quiere muestra a los compañeros que no está, sin decir por qué.

## Los archivos

En `docs/superpowers/specs/`:

| Archivo | Qué es |
|---|---|
| `2026-10-26-feriados-design.md` | Entrega 1: la tabla `feriados`, la pestaña de Configuración y las reglas de días hábiles con feriados. El resto del sistema no cambia. |
| `2026-10-26-mi-espacio-licencias-y-horas-design.md` | Entrega 2: la página Mi espacio, las reglas de cada licencia, las horas extras, el saldo inicial, el paso a Configuración, «Hoy no están», el Resumen «Niveles» y el email de vencimiento. |
| `2026-10-26-mi-espacio-agenda-design.md` | Entrega 3: la pestaña Agenda, los eventos personales y compartidos, los emails y el cron cada 15 minutos. |
| `2026-10-26-mi-espacio-mockups/` | Las maquetas navegables (ver abajo). |
| este archivo | El traspaso. |

**El orden de las entregas:** feriados, después licencias y horas, después la agenda. Son tres planes y tres despliegues separados. La entrega 1 puede salir sola.

## Las maquetas

En `2026-10-26-mi-espacio-mockups/`:
- **`index.html`:** el índice, con lo que hay que mirar en cada pantalla.
- **`1-mi-espacio.html`:** la página, con las pestañas Resumen («Niveles», el elegido), Licencias, Horas extras y Agenda.
- **`2-formularios.html`:** los modales: cargar licencia, cargar horas extras, nuevo evento, un evento de otra persona, «Mis vacaciones y saldos» y el uso autorizado.
- **`3-feriados.html`:** la pestaña Feriados de Configuración.
- **`4-resumen-opciones.html`:** las cuatro formas de dibujar el Resumen que se compararon: Niveles, Mosaico, Tu año y Fichas. Quedó Niveles.

Usan una copia del `main.css` real y de los logos, y datos inventados: Laura Gómez (planta permanente, administradora) y Sofía Paz (contrato, lectora). Hoy es el lunes 26/10/2026. La barra oscura de abajo es de la maqueta: pasa de una pantalla a otra y cambia la persona en «Ver como». Las fechas de la pestaña Feriados son de ejemplo y no están verificadas.

**Cómo verlas:**
- **Doble clic** en `index.html` las abre en Chrome o Firefox. Hace falta internet para las fuentes.
- **Con un servidor:**

  ```bash
  python -m http.server 8765 --bind 127.0.0.1 --directory docs/superpowers/specs/2026-10-26-mi-espacio-mockups
  ```

  y después se abre `http://localhost:8765/`.
- **En el panel de navegador de la app de Claude** hace falta el servidor, porque un archivo suelto se ve sin estilos. Como `.claude/` no se versiona, en la otra máquina hay que sumar esta configuración a `.claude/launch.json`:

  ```json
  { "name": "maquetas-mi-espacio", "runtimeExecutable": "python",
    "runtimeArgs": ["-m", "http.server", "8765", "--bind", "127.0.0.1", "--directory", "docs/superpowers/specs/2026-10-26-mi-espacio-mockups"],
    "port": 8765 }
  ```

## Lo que se decidió

Está completo en la sección «Decisiones» de cada spec, separado en «Del usuario» y «Mías (para revisar)». Lo central:
- **Una página propia, «Mi espacio»,** en el menú «Mi cuenta», con pestañas. Se mira sobre todo en la compu.
- **Planta política tiene las mismas licencias que planta permanente.** La jornada es de 7 horas y todo se cuenta por año calendario.
- **Vacaciones:**
  - de 10 a 30 días por año, que elige la persona;
  - se habilitan en dos mitades, el 1/7 y el 1/1 (con número impar, 8 y 7, y 13 y 12);
  - se acumulan y vencen el 31/12 de dos años después;
  - se descuenta la licencia más vieja y solo se usan días ya habilitados;
  - el saldo inicial se carga por licencia.
- **Franquicias** (planta): 42 horas por año, por hora entera.
- **Estudios:** 15 días por año (universitario) o 10 (secundario), hasta 3 por examen, solo con las fechas.
- **Atención médica y grupo familiar:** 25 días por año cada una. La médica extraordinaria no tiene tope.
- **Horas extras en planta:** solo las del 100%. Cada 7 horas de un mes dan un franco para dos meses después, que se usa solo en ese mes.
- **Horas extras en contrato:** se vuelven horas a favor del mes siguiente, de a media hora, que vencen a fin de ese mes. Lo no utilizado se acumula en el año, se ve con un nombre neutro y se descuenta si se autoriza tomarlo.
- **Días hábiles con feriados.** Los feriados se cargan en Configuración, con cuatro tipos y «se repite». Arrancan con 2026 y 2027 precargados y en esta etapa cuentan solo para Mi espacio.
- **El paso a Configuración → Licencias** sigue la propuesta que el usuario aprobó.
- **El Resumen es «Niveles»:** primero «Vence pronto», después los tanques y al costado «Hoy y mañana».
- **Las sugerencias que entraron:** el aviso de vencimiento por email, lo propio en la agenda, «Hoy no están» y el email al sumar a alguien a un evento.
- **La agenda:**
  - eventos personales y compartidos con personas elegidas o con todos;
  - solo quien los crea los cambia;
  - el recordatorio se elige por evento (de entrada, 2 horas antes) y les llega a todos;
  - las vistas son el mes y los próximos.

## Preguntas abiertas para el usuario

Las encontró la revisión de un «constructor» (un agente que leyó las specs como si tuviera que construirlas) y solo las puede contestar el usuario:

1. **¿Quiénes son «los compañeros» y «todos»?** Define quién ve las ausencias de «Hoy no están», a quién se puede invitar a un evento y quién ve un evento «para todos». El borrador dice «todos los usuarios activos», pero eso incluye a los colaboradores, que son personal de la DGMIT, de fuera de la Dirección, y a los lectores.
2. **¿Una licencia médica durante las vacaciones las interrumpe y esos días vuelven al saldo?** Mientras no se conteste, dos licencias no comparten un día: para cortar unas vacaciones, se acortan y se carga la médica.
3. **¿Qué feriados y asuetos de Chubut y de Comodoro rigen para el personal municipal?** Por ejemplo, el aniversario de la ciudad (23/2), el Día del Petróleo (13/12) o el Día del Empleado Municipal (8/11). Sin esto no se escribe la precarga.
4. **¿El municipio adhiere a los días no laborables nacionales (los puentes)?**

Las respuestas que lleguen se anotan en las specs, en «Decisiones», y se saca la pregunta de la lista.

## Lo que la revisión preguntó y se resolvió sin el usuario

Quedó escrito en las specs como «Mías (para revisar)»:
- **El saldo inicial de vacaciones** se cuenta sobre lo habilitado el día del arranque.
- **La regla del arranque** vale solo para lo que tiene saldo inicial. Las horas extras, los francos y las horas a favor se cargan con sus meses y todo descuenta.
- **Una licencia de Mi espacio que quedó «unida»** a una de administración nunca la toca. Una corrección no pisa lo que cambió administración.
- **Si Configuración rechaza el paso,** se guarda igual en Mi espacio, con el motivo a la vista. El paso se decide con el rol del momento.
- **Lo que deja de cerrar** después de un cambio (la baja de un feriado, menos días de vacaciones) se muestra como faltante, sin frenar el cambio.
- **El conteo de licencias afectadas** por un feriado se pasa a la entrega 2. La entrega 1 sale sola.

## Lo que encontró el análisis del código

Tres agentes recorrieron el código el 26/10/2026. Lo que importa para estas entregas:

- **Licencias de Configuración** (`usuarios_licencias`, `services/licenciasReglas.js`, `controllers/licenciasController.js`):
  - **Son un dato operativo.** Una fila no anulada cambia en el momento quién puede auditar (`disponibilidad`, `services/auditoriaReglas.js`), los emails que recibe la persona, los avisos al superadmin y, si es del firmante titular, cómo y cuándo salen las Notas Digitales (`services/notasDigitalesFirmas.js`).
  - **Las pueden tener** superadmin, admin y editor (`ROLES_CON_LICENCIA`), y las carga administración (`adminOnly`).
  - **No tienen tipo,** a propósito: el motivo de una licencia médica es sensible.
  - **No aceptan fechas terminadas** y se anulan, no se borran.
  - **Por eso Mi espacio usa tablas propias** y solo pasa las fechas.
- **Días hábiles:** `esDiaHabil` (`services/notasDigitalesCalendario.js`) conoce solo los 9 feriados fijos, y lo usan las Notas Digitales, la auditoría, Métricas y el Ciclo de vida del dato. No se toca.
- **`usuarios`** tiene `vinculo` (planta permanente, planta política, contrato o NULL), sin legajo, área del personal ni jefe.
- **Mi Perfil** (`perfil.html`, `perfil.js`) tiene cuatro pestañas por hash. El lector y el colaborador solo ven «Mis datos». Por eso Mi espacio va en una página propia.
- **Una página nueva con carcasa** obliga a copiar el encabezado, el menú y el footer en las 13 páginas, y a actualizar `tests/paginas.test.js`: la lista de destinos, la cantidad de páginas, las versiones y el orden de los scripts.
- **Emails y cron:**
  - `remitente()` y `plantillaSimple` están en `services/emailTemplates.js`; `marcoEmail` es privado.
  - La corrida de las 8:15 (`ejecutarNotificacionesDiarias`) suma pasos aislados, cada uno con su try/catch.
  - Un recordatorio «2 horas antes» necesita una Tarea Cron nueva.
- **No existe nada de horas del día** (ni columnas TIME ni campos de hora) **ni de visibilidad privada o compartida:** todo lo que se crea hoy es global. El modelo más cercano es el de las notas DGMIT: solo corrigen quien la cargó o administración.
- **Nombre:** ya existe la «Agenda de pedidos» en Reportes. En el código, la agenda nueva usa `mi_espacio_` y `evento`.

## Cómo seguir

1. **Bajar la rama** `docs/mi-espacio-pre-plan` y abrir las maquetas.
2. **Contestar las cuatro preguntas abiertas** y anotarlas en las specs.
3. **Leer y aprobar las tres specs,** revisando las decisiones «Mías». En cada una, cambiar «Estado: pre-plan» por «aprobado» con la fecha.
4. **Planificar cada entrega,** en orden y una a la vez, con `superpowers:writing-plans`: feriados, después licencias y horas, después la agenda.
5. **Implementar cada una** en su rama, con `npm test` completo antes y después (regla del proyecto; las de integración necesitan `docker compose up -d`).

**Para retomar con Claude**, alcanza con un mensaje como este: «Seguimos con el pre-plan de Mi espacio: leé `docs/superpowers/specs/2026-10-26-mi-espacio-pre-plan.md` y las tres specs que nombra.»

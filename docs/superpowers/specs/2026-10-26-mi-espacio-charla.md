# Mi espacio: la charla del 26/10/2026, con las palabras del usuario

Este documento guarda lo que dijo el usuario en la charla en la que se armó el pre-plan de Mi espacio, para que una sesión nueva tenga el contexto completo y no solo el resumen. Va con el traspaso (`2026-10-26-mi-espacio-pre-plan.md`) y las tres specs.

**Cómo leerlo:**
- **Las citas son textuales,** con la ortografía original.
- **Sin nombres reales:** como el repositorio es público, los nombres de compañeros se cambiaron por su rol («[una compañera]», «[el Director General]») y se sacó un comentario personal sobre una persona («[comentario personal omitido]»).
- **Lo que no está:** los mensajes operativos (subir la rama, la terminal) y un token de GitHub, que se borró.
- **Lo que Claude preguntó o propuso** va resumido, entre corchetes o como nota, para entender a qué responde cada cita.

## 1. El pedido

> Me gustaría que craneemos algo juntos:
>
> Quiero que cada usuario tenga un panel personal. La idea de este panel es que los usuarios podamos cargar nuestros dias de licencia, horas extras y demas, para llevar un control. Se entiende?
>
> Tambien podemos poner una agenda de actividades, que sea personal o tambien eventos compartidos.
>
> Estoy en la PC del trabajo. La idea es que me ayudes a cranear un pre-plan para luego llevarmelo a casa y seguir trabajandolo alli.
>
> Necesitaría que ejecutes un analisis de agentes para entender bien el codigo. Y luego te cuento en detalle mi idea

[Claude lanzó tres agentes: el sistema de licencias actual, Mi Perfil y la estructura de las páginas, y calendario, agenda y avisos. Lo que encontraron está resumido en el traspaso, en «Lo que encontró el análisis del código».]

## 2. La idea en detalle

> # LICENCIAS
>
> De acuerdo a la modalidad. Tenemos que ver que modalidades acepta el RPAD (analiza el codigo si es necesario). Hay diferentes tipos de licencias. Imagino que cuando cargamos una licencia en nuestro panel personal, se autoactualice en la parte de licencias actual.
>
> ## PLANTA PERMANENTE
>
> * Licencia ordinaria: las vacaciones. Debería ser configurable para cada persona por año (lo puede hacer la persona). Pueden ser 10, 15, 20, 25 y 30 días (va de acuerdo a la antiguedad)
> * Franquicias: 42 horas para trámites personales, se resetean todos los años. Pueden fraccionarse por hora. Si te tomas 7 horas (la jornada laboral) ese día no vas a trabajar.
> * Licencia por estudios: Si estudias una carrera universitaria te corresponden 15 (quince) días por examen. Si estudias una carrera secundaria te corresponden 10 (diez) días por examen. se resetean todos los años
> * Horas extras al 100%. Por cada 7 horas extras al 100% que hagas te dan un franco compensatorio. Ejemplo: Si hago 10,5 horas extras en octubre de 2026, en diciembre de 2026 me corresponde 1 franco compensatorio. Ejemplo 2: Si hago 7,5 horas extras en noviembre de 2026, en enero de 2027 me corresponde 1 franco compensatorio. Ejemplo 3: Si hago 6,5 horas extras en diciembre de 2026, en febrero no me corresponde ningún franco compensatorio.
> * Atención médica: Hasta 25 días por año calendario.
> * Atención del grupo familiar: Hasta 25 días por año calendario.
>
> ## CONTRATO
>
> * Licencia ordinaria: las vacaciones. Debería ser configurable para cada persona por año (lo puede hacer la persona). Pueden ser 10, 15, 20, 25 y 30 días (va de acuerdo a la antiguedad)
> * Licencia por estudios: Si estudias una carrera universitaria te corresponden 15 (quince) días por examen. Si estudias una carrera secundaria te corresponden 10 (diez) días por examen. se resetean todos los años
> * Horas extras:  Por cada 1 horas que haga le corresponde 1 hora menos de trabajo el mes siguiente. Se vencen todos los meses (igual deberíamos contabilizar las horas no tomadas y mostrarlo). Si junto 7 horas me corresponde un franco compensatorio. Ejemplo: Si hago 10,5 horas extras en octubre de 2026, en noviembre de 2026 me corresponde 10,5 horas (que se pueden fraccionar cada media hora y tomar, por ejemplo 7 horas un día, 2 otro y 1,5 otro). Ejemplo 2: Si hago 7,5 horas extras en noviembre de 2026, en diciembre de 2026 me corresponden 7,5 horas de trabajo menos. Ejemplo 3: Si hago 6,5 horas extras en diciembre de 2026, en enero de 2027 me corresponden 6,5 horas extras.
> * Atención médica: Hasta 25 días por año calendario.
> * Atención del grupo familiar: Hasta 25 días por año calendario.
>
> # FERIADOS
>
> Pensaba agregar en configuracion.html una pestaña donde podamos cargar los feriados moviles y provinciales. El problema: los calculos de metricas y varias cosas mas se hacen teniendo en cuenta los dias habiles. Tendriamos que tener especial previsión en no romper nada.
>
> # CALENDARIO Y AGENDA
>
> Quiero algo que sea privado de cada persona, que por ejemplo que si [una compañera] sube algo personal a su agenda en su calendario lo vea ella sola. Pero si sube algo para todos (ejemplo para todos), les aparezca el evento compartido (imagino que la opcion de un evento compartido podriamos elegir a que usuarios compartirles el evento). Tambien puede servir como una notificacion, que mande 2 horas antes del evento un recordatorio x mail.
>
> # No hay jefes ni áreas del personal.
>
> No es necesario aplicar nada. Solo quiero que esta sección nueva sea personal para cada usuario.
>
> ---
>
> Dime si entiendes y vayamos usando brainstorming para las dudas y tambien para todas las sugerencias. Puedes sugerirme cosas que tambien podrian tener.

**Lo que Claude propuso para el paso a Configuración**, que el usuario aprobó en la sección 3:
- pasan solo las ausencias de día completo, no 2 horas de franquicia;
- pasan solo las fechas, nunca el tipo, porque el motivo de una licencia médica es sensible;
- solo para superadmin, admin y editor, porque a lectores y colaboradores no les cambia nada del sistema;
- lo ya pasado se anota en el panel pero no va a Configuración.

**Claude también propuso** saldos a la vista, un aviso por email antes de un vencimiento, «Hoy no están», un resumen anual en PDF, eventos que se repiten y la exportación al celular. Lo que eligió el usuario está en la sección 6.

## 3. Correcciones a los supuestos de Claude

> # Lo que supuse yo (corregime):
>
> * La jornada es de 7 horas para todos.: Asi es
> * En planta permanente, lo que sobra de cada 7 horas en un mes se pierde. Por ejemplo, de 10,5 horas, las 3,5 que sobran.: Así es, en teoría no se pierden porque las horas extras te las pagan y si haces 7 te corresponde un franco compensatorio. Solo para que tengas contexto.
> * En el ejemplo 3 de contrato quisiste decir «6,5 horas menos de trabajo».: Así es
> * Las horas que vencen sin tomar quedan registradas y a la vista, aunque ya no se puedan usar.: Así es. Contexto: a veces [el Director General] autoriza que se las tomen, otros no. [comentario personal omitido]. Pero es importante que se muestre y que no diga "se perdieron" sino algo mas neutro como "horas no utilizadas previamente)".
> * Todo se cuenta por año calendario.: Así es
>
> # Hay un choque con las licencias de Configuración
>
> Esta perfecto tu sugerencia.
>
> # ¿Qué licencias le corresponden a planta política?
>
> Lo mismo que a Planta Permanente.
>
> # LICENCIAS MEDICAS
>
> Lo que te pase son licencias ordianrias, puede pasar que tengas licencia extraordinaria por tratamientos de larga duracion y ahi no tienes limite de dia.
>
> ---
>
> Entiendes? Sigamos charlando!

[Claude preguntó si las vacaciones, los estudios y la atención médica y familiar se cuentan en días hábiles o corridos.]

> Las vacaciones, los días de estudio y los de atención médica y familiar se cuentan en días hábiles o en días corridos: días hábiles

[Claude propuso que, en una primera etapa, los feriados cuenten solo para el panel personal y el resto del sistema siga igual.]

> Me parece bien. Te parece que vayamos haciendo varias rondas de AskUserQuestion con tus dudas y sugerencias para ir definiendo bien todo y luego me presentas mockups reales para decidir como se verian, ejemplo en HTML. que opinas?

## 4. Las rondas de preguntas

Cada respuesta va textual; si eligió una opción ofrecida, va el nombre de la opción.

**Ronda 1, licencias:**
- *¿Cómo se lleva la licencia por estudios?* «Por examen, entre 1 y 3 dias. Pero no debemos poner tantos detalles. Solo las fechas en que se toman.»
- *¿Tiene un máximo de días por año?* «la licencia de estudios = licencia de examen. Por cada examen te corresponden hasta 3 dias de licencia de estudio/examen. No se si entiendes»
  [Claude lo entendió así, y el usuario no lo corrigió: 15 días por año (universitario) o 10 (secundario), que se usan por examen, de 1 a 3 días cada vez.]
- *En planta, ¿hasta cuándo se usa un franco?* Solo ese mes.
- *¿Cómo se carga lo usado antes de tener el panel?* Saldo inicial.

**Ronda 2, horas extras y franquicias:**
- *¿Cómo se cargan las horas extras?* Día y horario.
- *¿De a cuánto se toman las franquicias?* Por hora entera.
- *En contrato, ¿qué hace el panel con las horas no utilizadas previamente?* «Solo mostrarlas. Deberiamos mostrar un acumulado de los años anteriores que no se tomaron. Y la cuenta se resetea cada año. En caso de que se tomen, deberiamos poder registrarlo de alguna forma para que no aparezcan o se descuenten.»
  [Claude lo entendió como «de los meses anteriores de este año», porque la cuenta vuelve a cero cada año, y el usuario no lo corrigió.]
- *¿Hay otras horas extras además del 100%?* «Tambien hay al 50%, pero solo se pagan y no generan francos compensatorios. No las pongamos al 50%. Las del 100% se pagan y generan francos compensatorios.»

**Ronda 3, feriados:**
- *¿Qué se carga?* Nacionales móviles, provinciales de Chubut, municipales de Comodoro y no laborables y puentes.
- *¿Medio día?* Solo días enteros.
- *¿Los de fecha fija?* Se marcan «todos los años».
- *¿Precargados?* Sí: 2026 y 2027.

**Ronda 4, agenda:**
- *¿Cuándo sale el recordatorio?* Elegible por evento; si no se elige, 2 horas antes.
- *En un evento compartido, ¿quién lo recibe?* Todos.
- *¿Quién cambia o borra un evento compartido?* Solo quien lo creó; si cambia, les llega un aviso.
- *¿Qué vistas?* Mes y lista de próximos.

**Ronda 5, sugerencias:**
- *Para licencias y horas:* el aviso de vencimiento, lo propio en la agenda y «Hoy no están». No entró el resumen anual en PDF.
- *Para la agenda:* el aviso al compartir. No entraron los eventos que se repiten, los de todo el día ni la exportación al celular.
- *¿Dónde?* Una página propia.
- *¿Nombre?* «Mi espacio».

## 5. Las maquetas y las vacaciones acumulables

[Claude mostró las primeras maquetas: Mi espacio en pestañas o como tablero, los formularios y la pestaña Feriados.]

> Ah!  Espera! me olvide de avisarte, la licencia ordinaria es acumulable. Y por ejemplo, a mitad de año se habilitan de a mitad.
>
> Ejemplo:
>
> LICENCIA 2025:
> El 1/7/2025: Se habilita el 50%
> El 1/1/2026: Se habilita el 50% restante
>
> LICENCIA 2026:
> El 1/7/2026: Se habilita el 50%
> El 1/1/2027: Se habilita el 50% restante
>
> En el caso de que sea un numero impar (15 y 25, la distribución es 8/7 y 13/12 dias respectivamente)
>
> ---
>
> Me gusta lo que hiciste, pero el resumen me gustaría que sea mas moderno. Usa frontend desing skill para mejorarlo. Dudas y sugerencias con AskUserQuestion

**Ronda 6, vacaciones acumulables:**
- *¿Hasta cuándo se acumulan?* «Se vence. Por ejemplo el 31/12/2026 se vence la licencia 2024. El 31/12/2027 se vence la licencia 25. Se pierden.» [En la pantalla se dice «vence», con la misma idea de lenguaje neutro.]
- *¿De qué licencia se descuentan los días?* La más vieja primero.
- *¿Se pueden cargar días todavía no habilitados?* No.
- *¿Cómo se carga lo acumulado para arrancar?* Por licencia.

**Ronda 6, el estilo del Resumen:**
- *¿Qué dirección?* «Fichas de días».
- *¿Qué se ve primero?* Lo que vence pronto.
- *¿Dónde se mira más?* En la compu.

> Prefiero la organizacion por PESTAÑAS. pero como ves de hacer otras opciones (mockups) para el resumen, tipo mas grafico si puede ser con los numeros. Moderno. Dame opciones y las vemos!

[Claude armó tres opciones nuevas: Niveles, Mosaico y Tu año.]

> Me encantó Niveles. Vamos con ese. Fijate si hay margen de mejora sino vamos con ese

[Claude le hizo cuatro mejoras: una línea de base común, el llenado al abrir, lo no utilizado como pastilla gris y cada tanque como link a su pestaña.]

## 6. Los documentos y la revisión

> Sí, escribí los documentos del pre-plan (licencias y horas, feriados y agenda).

> La idea luego es seguir en casa. Asi que deberiamos hacer un commit de esto con todas las cosas, todo el contexto qeu consideres, los mockups y demas. Para luego poder levantar alla el trabajo. Te parece?

**Las respuestas a la revisión del «constructor»:**
- *¿Quiénes son «los compañeros» y «todos»?* Solo administración: superadmin, admin y editor.
- *¿Una licencia médica durante las vacaciones las interrumpe?* «No, si durante tu licencia ordinaria te enfermas no se corta la licencia ordinaria. En todo caso, cuando tendrias que retomar tus funciones presentas boleta medica y corresponde a partir del dia de tu reincorporacion (licencia medica)»
- *¿Qué feriados locales rigen?* El aniversario de Comodoro (23/2), el Día del Petróleo (13/12), el Día del Empleado Municipal (8/11) y la gesta galesa (28/7, Chubut).
- *¿El municipio adhiere a los puentes nacionales?* Sí, siempre.

## 7. Lo que pidió para la sesión de casa

> ya lo borre. En casa voy a generar una nueva sesion con Claude Desktop, dame las instrucciones que tengo que decirle para que pueda seguir

> la idea es que lea todo y que lance un equipo de agentes para entender el codigo. Tambien todo el contexto que te pase arriba (todo lo que te dije, seria imporatnte que este). Se entiende?

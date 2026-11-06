# Despliegue

Cómo se despliega en producción, el orden de las migraciones y las vueltas atrás, y lo pendiente con fecha.
Lo de cada entrega ya desplegada está en su `PASOS.txt` y en git; las secciones «Migración» del README dan el detalle de cada una.

## El procedimiento

Despliega el usuario, desde cPanel y sin terminal; acá se arma el kit.
cPanel sin terminal: el SQL se corre en phpMyAdmin (pestaña SQL o Importar), los archivos se suben con el Administrador de archivos, y las variables de entorno, "Run NPM Install" y Restart se manejan en Setup Node.js App.
El zip se carga en `/home/datospublicos/rpad` y se extrae ahí mismo.
Las Tareas Cron son tres, todos los días: 8:05 `/api/cron/notificaciones`, 14:00 `/api/cron/cambios-pendientes` y `*/30` `/api/cron/eventos`.
El respaldo y el despliegue, fuera del horario de los crons (8:05, 14:00 y las medias horas), por ejemplo a las 10:10.
Con el interruptor de la firma digital prendido (lo está desde el 04/11/2026), tampoco entre las 8:05 y las 14:00, porque puede haber una nota esperando la firma: por ejemplo, a las 15:10.
Run NPM Install, solo si cambia `package.json`.

## El kit

Cada entrega con algo para producción tiene su kit en `~/rpad-kits/RPAD-deploy-<tema>/`, armado contra el último commit desplegado, que confirma el usuario.
Trae `PASOS.txt`, `sql/` (las migraciones, numeradas), `archivos-<tema>/` y su zip, `vuelta-atras/` (los archivos y el zip del commit desplegado y los `rollback-*.sql`) y `VERIFICACION.txt` (el sha256 de cada archivo contra `git show`).
**El filtro:** `git diff --name-only <producción>..<nuevo>`, sin `tests/`, `docs/`, `database/`, `CLAUDE.md`, `README.md`, `.claude/` ni `.gitignore`: la aplicación no lee ningún documento.
Un kit no se escribe acá: lo que dice cada uno queda en su `PASOS.txt`.

## Los pasos

1. Comprobar con Ctrl+U los `?v=` que pide cada página: tienen que ser los que dejó el kit anterior; si no, no se sigue.
2. Respaldo: la base (Exportar) y `config`, `controllers`, `services`, `routes`, `middleware` y `public`, sin `uploads/`.
3. El SQL en phpMyAdmin, con su verificación.
4. Los archivos; si van sueltos, primero `middleware`, `services` y `config`, después `controllers`, `routes` y `app.js`, `public/js` y al final los `.html`.
5. Restart, enseguida.
6. Ctrl+F5 y solo mirar: no se guarda nada en la base real, porque un evento Laboral de prueba manda invitaciones de verdad.
7. Al día siguiente, la última corrida en Correos → Estado, sin errores.

Si algo sale mal: primero los archivos anteriores y Restart; después, si hace falta sacar lo nuevo, los `rollback-*.sql` de la tabla.

## Las migraciones

Las migraciones van antes que el código: sin ellas, lo que las lee da 500 (`docs/temas/base-de-datos.md` describe cada una).
`migracion-fechas-datasets-textos.sql` es la excepción: va después de subir los archivos y antes del Restart.
`migracion-metricas-recibido-datos.sql` va después de `migracion-metricas.sql` y puede ir antes o después de los archivos.
`database/schema.sql` cambia, pero no se corre.
Un archivo nuevo de `services/` o de `middleware/` que falte no deja arrancar la app.
Las cargas de datos de personas (roles, cargos) van en `database/privado/` (no versionado) y se corren después del código.
Después de `migracion-notas-dgmit.sql` no se vuelven a correr `migracion-editor-auditoria.sql` ni `migracion-usuarios-superadmin.sql`: fijan el rol sin `colaborador` (fallan o dejan el rol de un colaborador vacío).

Las migraciones se corren de arriba para abajo y las vueltas atrás, de abajo para arriba.
La última columna dice qué tiene que correr antes esa vuelta atrás: sin eso, no se puede correr sola (falla a mitad de camino y deja la base a medias).

| # | Migración | Vuelta atrás | Antes de esa vuelta atrás |
|---:|---|---|---|
| 1 | `migracion-v1.2.0-v1.3.0.sql` | — | |
| 2 | `migracion-v1.3.0-v1.4.0.sql` | — | |
| 3 | `migracion-v1.4.0-v1.5.0.sql.sql` | — | |
| 4 | `migracion-metricas-proyectos.sql` | — | |
| 5 | `migracion-upload-archivos.sql` | — | |
| 6 | `migracion-logros-independientes.sql` | — | |
| 7 | `migracion-rol-default-lector.sql` | — | |
| 8 | `migracion-notas-digitales.sql` | — | |
| 9 | `migracion-que-se-solicita.sql` | — | |
| 10 | `migracion-que-se-solicita-datos.sql` | — | |
| 11 | `migracion-notas-digitales-anexo.sql` | — | |
| 12 | `migracion-usuarios-superadmin.sql` | `rollback-usuarios-superadmin.sql` | `rollback-licencias-firmas.sql` y `rollback-editor-auditoria.sql`, si están |
| 13 | `migracion-licencias-firmas.sql` | `rollback-licencias-firmas.sql` | `rollback-mi-espacio.sql`, si está Mi espacio |
| 14 | `migracion-editor-auditoria.sql` | `rollback-editor-auditoria.sql` | `rollback-editor-sin-responsabilidad.sql` y `rollback-notas-dgmit.sql`, si están |
| 15 | `migracion-fechas-datasets.sql` | — | |
| 16 | `migracion-fechas-datasets-datos.sql` | — | |
| 17 | `migracion-fechas-datasets-textos.sql` | — | |
| 18 | `migracion-requiere-nota.sql` | — | |
| 19 | `migracion-requiere-nota-datos.sql` | — | |
| 20 | `migracion-editor-sin-responsabilidad.sql` | `rollback-editor-sin-responsabilidad.sql` | |
| 21 | `migracion-notas-dgmit.sql` | `rollback-notas-dgmit.sql` | |
| 22 | `migracion-metricas.sql` | `rollback-metricas.sql` | |
| 23 | `migracion-metricas-recibido-datos.sql` | — (la borra `rollback-metricas.sql`) | |
| 24 | `migracion-generador-notas.sql` | `rollback-generador-notas.sql` | |
| 25 | `migracion-feriados.sql` | `rollback-feriados.sql` | `rollback-mi-espacio-restituciones.sql`, si está |
| 26 | `migracion-feriados-datos.sql` | — (la borra `rollback-feriados.sql`) | |
| 27 | `migracion-mi-espacio.sql` | `rollback-mi-espacio.sql` | `rollback-mi-espacio-restituciones.sql`, si está |
| 28 | `migracion-mi-espacio-agenda.sql` | `rollback-mi-espacio-agenda.sql` | `rollback-mi-espacio-evento-publico.sql`, si está, y borrar la Tarea Cron de `/api/cron/eventos` |
| 29 | `migracion-mi-espacio-horas.sql` | `rollback-mi-espacio-horas.sql` | |
| 30 | `migracion-mi-espacio-evento-publico.sql` | `rollback-mi-espacio-evento-publico.sql` | `database/privado/rollback-mi-espacio-evento-publico-datos.sql`, si se corrió el SQL privado del evento real |
| 31 | `migracion-mi-espacio-horas-mes-anterior.sql` | `rollback-mi-espacio-horas-mes-anterior.sql` | |
| 32 | `migracion-mi-espacio-restituciones.sql` | `rollback-mi-espacio-restituciones.sql` | |
| 33 | `migracion-mi-espacio-horas-acumuladas.sql` | `rollback-mi-espacio-horas-acumuladas.sql` | |
| 34 | `migracion-notas-firma-digital.sql` | `rollback-notas-firma-digital.sql` | Volver la Tarea Cron de `/api/cron/notificaciones` a las 8:15 |
| 35 | `migracion-notas-firma-leyenda.sql` | `rollback-notas-firma-leyenda.sql` | |
| 36 | `migracion-mi-espacio-eventos-diario.sql` | `rollback-mi-espacio-eventos-diario.sql` | Va antes que `rollback-mi-espacio-evento-publico.sql` y `rollback-mi-espacio-agenda.sql`, si se deshacen. Se corre otra vez justo antes del Restart, para convertir lo que se haya creado mientras se subían los archivos; después del Restart ya no: achicaría los Laborales «Todos» nuevos |

`database/privado/rollback-mi-espacio-evento-publico-datos.sql` devuelve el evento real a compartido con toda la administración (su verificación, `devuelto` 1).
Está fuera del repositorio y no aparece en la Mac de trabajo: solo viajó en su kit, `RPAD-deploy-mi-espacio-evento-para-todos`.

## La foto del año

El 10/01 de cada año, la corrida de la mañana saca la foto del año anterior, que guarda textos ya armados (`vistas`, `cintas` y `etapas`) y no se modifica nunca.
Lo que cambie esos textos o el calendario de Métricas, del Ciclo de vida o del Informe anual, y los datos de ese año, tienen que estar en producción antes.

## Pendientes con fecha

Se borran al cumplirse.

- **Antes del 10/01/2027:** las notas DGMIT de 2026 cargadas a mano desde el Seguimiento (decisión del usuario, 25/10/2026: no hay SQL de importación) y `database/privado/metricas-recibido-datos-25-38-39.sql`.
- **Antes del 10/01/2027:** «Editar notas DGMIT», la regla del ciclo y la nota anterior al primer ciclo (spec 2026-11-06-editar-notas-dgmit): si no, una nota vieja puede inflar «Respuesta del área» en la foto de 2026.
- **Antes del 10/01/2027:** la frase en «Los casos» de Métricas (spec 2026-11-05-metricas-frase-en-los-casos, 7): si no, la foto de 2026 guarda el número solo.
- El 10/01/2027 (domingo) o el 11/01, mirar en Métricas y Reportes que 2026 ya no diga «La foto de 2026 se saca …» ni «… todavía no se sacó» y que se descargue el Informe anual de 2026, y que la última corrida de Correos → Estado no diga «No se pudo sacar la foto del año» (si lo dice, la tabla no se pudo leer: la corrida del día siguiente la vuelve a intentar).

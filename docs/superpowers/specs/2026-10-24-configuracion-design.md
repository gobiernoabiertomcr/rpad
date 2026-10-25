# Configuración: Usuarios, Licencias y Áreas en una sola página

Fecha: 24/10/2026. **Estado: aprobado por el usuario el 24/10/2026.**

Maqueta navegable: `2026-10-24-configuracion-mockups/configuracion.html`. Se mira con un servidor estático; con `file://` también anda, porque no pide nada afuera salvo las fuentes. Corre el `usuarios.js` real con un servidor de mentira (`js/maqueta-servidor.js`), con usuarios y licencias inventados. Las 46 áreas son las de la base local del 24/10/2026, pero sus emails, teléfonos y personas de contacto son inventados. El recuadro oscuro de abajo a la derecha es de la maqueta, no de la página: cambia quién mira, la variante de la lista y el ícono de Gestión de Datasets. Las elegidas son la tabla y el ícono de capas. Este documento manda sobre la maqueta.

**Orden de implementación: va al final de la cola.** La implementación arranca cuando estén en main "Métricas y Reportes" (`feat/metricas-y-reportes`), el Generador de Notas (`feat/generador-de-notas`) y "Notas Digitales en hoja oficio" (`feat/notas-hoja-oficio`). Su primera tarea es traer main a esta rama y **releer el código actualizado** antes de tocar nada (sección 8). Lo pidió el usuario el 24/10/2026, porque las dos primeras tocan los mismos archivos.

## Por qué

Hoy Administración tiene cuatro links: Gestión de Datasets, Áreas, Usuarios y Correos. Áreas y Usuarios son configuración del sistema que se toca poco, y conviene tenerlas juntas. La idea del usuario es tomar Usuarios tal como está y sumarle Áreas en otra pestaña.

Además, Áreas tiene un problema que se ve: **el modal a veces no muestra los botones.**
- **La causa:** en `areas.html`, el `<form>` envuelve al cuerpo y al pie del modal. El `.modal` de `main.css` tiene alto máximo del 90 % y `overflow: hidden`, y como el formulario no se achica, el cuerpo nunca se desplaza y el pie queda cortado.
- **Cuándo pasa:** con menos de unos 995 px de alto útil de ventana. Le pasa a una notebook de 1366 × 768 o a un monitor de 1080 con Windows al 125 %.
- **Lo que lo empeora:** el error de guardado queda detrás del velo y no hay Escape.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Una página nueva, `configuracion.html`, con tres pestañas: **Usuarios | Licencias | Áreas**. Usuarios y Licencias quedan como hoy.
- La pestaña Áreas se rediseña con el lenguaje del Seguimiento:
  - un aviso de las áreas a las que no les llega el aviso de los 40 días;
  - un buscador y filtros con cantidad;
  - una tabla;
  - un modal que siempre muestra sus botones;
  - el Ámbito que trae el Generador.
- El menú lateral de todas las páginas con carcasa:
  - Administración queda con **Gestión de Datasets, Correos y Configuración**;
  - Configuración se queda con la ruedita;
  - Gestión de Datasets pasa al ícono de capas (`layers` de Lucide).
- Las direcciones viejas (`usuarios.html` y `areas.html`) siguen funcionando: redirigen a la pestaña que corresponde.
- Tres arreglos de Áreas que eligió el usuario:
  - borrar un área que tiene datasets dados de baja da un error 500;
  - se puede guardar un nombre vacío o de espacios;
  - los datos de contacto se ven sin sesión: en la API de áreas y, encontrado en la revisión, también en la de datasets. Los dos se cierran (decisión del usuario).

**No objetivos**
- No se rediseñan Usuarios ni Licencias (decisión del usuario): se ven y funcionan igual, con el mismo `usuarios.js`. Así que la pestaña Áreas se ve distinta de las otras dos. El usuario lo aceptó.
- No hay historial de cambios de un área: quién cambió qué y cuándo queda para otra entrega (decisión del usuario).
- No hay tablas, columnas ni migraciones nuevas. El Ámbito (`areas.ambito`) lo agrega el Generador.
- No cambia qué hace ningún email ni ninguna nota, ni quién los recibe.

**Antiobjetivos**
- **Perder algo de lo que hace Usuarios:** los grupos, el del Colaborador incluido; la línea de ayuda de cada rol; los avisos al superadmin; lo que puede el editor; las licencias, la persona autorizada y los días sin auditor.
- **Que un link viejo deje de andar:** un marcador, o el botón de un email al superadmin ya enviado.
- **Que los datos de contacto de una persona sigan viéndose sin sesión.**
- **Que la pestaña nueva rompa la de Usuarios:** ids o nombres globales repetidos entre `usuarios.js` y `areas.js`, un Escape que cierre dos modales a la vez, o un clic de Áreas que abra el modal de un usuario.

## 1. La página Configuración

- **URL y archivo:** `public/configuracion.html`. Tiene la carcasa de siempre: encabezado, menú y footer iguales a los de `index.html`, sin `aria-current` y sin `publico.css`.
- **Título y encabezado:** `<title>Configuración - RPAD</title>` y el `h1` "Configuración" con la ruedita, con `aria-hidden="true"` en el SVG.
- **Quién entra: solo administración** (superadmin, admin y editor: `Auth.isAdmin()`), como Usuarios hoy. Decisión del usuario.
  - Sin sesión, va a `login.html`.
  - El lector y el colaborador van a `index.html`.
  - Hoy el lector y el colaborador podían ver Áreas en solo lectura escribiendo la URL. Desde el menú nunca la vieron.
- **Las pestañas** son las de Usuarios (`#pagina-pestanas`, `.usuario-pestana`), con una tercera, `data-vista="areas"`.
  - La pestaña viaja en la dirección: `#usuarios` (la inicial), `#licencias` y `#areas`.
  - Al abrir la página se lee el fragmento. Uno desconocido abre Usuarios.
  - Al cambiar de pestaña se escribe con `history.replaceState`, que no suma pasos al botón Atrás. Recargar deja la misma pestaña.
- **El botón del encabezado** cambia con la pestaña:
  - en Usuarios, "Nuevo usuario" (como hoy);
  - en Áreas, "Nueva área";
  - en Licencias, ninguno, porque "Nueva licencia" sigue dentro de su tarjeta, como hoy.
- **Lo que no cambia de Usuarios y Licencias:** el marcado, los ids, los textos, los modales y su comportamiento.
  - Lo único que aprende `usuarios.js` es la tercera pestaña y el fragmento de la dirección (sección 6).
  - La ayuda del editor sigue diciendo "en Usuarios solo crea y modifica lectores y colaboradores": la pestaña se sigue llamando Usuarios.

## 2. El menú lateral y los íconos

En todas las páginas con carcasa (hoy 14; con esta entrega, 13), la sección Administración queda así:

1. **Gestión de Datasets** (`admin.html`), con el ícono `layers` de Lucide (lucide-static 0.460.0):
   `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`
2. **Correos** (`correos.html`): no cambia.
3. **Configuración** (`configuracion.html`): la ruedita (`settings`), el SVG que hoy tiene Gestión de Datasets.

Salen los links "Áreas" (`areas.html`) y "Usuarios" (`usuarios.html`).

- **El `h1` de `admin.html`** también pasa al ícono de capas y suma `aria-hidden="true"`.
- **`Icons.settings` de `main.js` no se toca:** lo usa el selector de íconos de los proyectos de Gestión, y algún proyecto guardado puede tenerlo.
- **`setActiveSidebarLink`** marca solo el link de Configuración, porque compara el `href` con el archivo.
- **`updateSidebarAuth`** no cambia: la sección Administración ya se muestra solo con `Auth.isAdmin()`.

El menú es HTML copiado a mano en cada página, así que el cambio va en todas. `tests/paginas.test.js` compara el de cada página con el de `index.html`.

## 3. Las direcciones viejas y los emails

- **Redirección en el servidor** (`app.js`, **antes** de `express.static`):
  - `GET /usuarios.html` → 302 a `/configuracion.html`, **sin fragmento**. El navegador conserva el del link original, así que `usuarios.html#licencias` llega a `configuracion.html#licencias`.
  - `GET /areas.html` → 302 a `/configuracion.html#areas`.
  - Como va antes del estático, un `usuarios.html` o un `areas.html` que haya quedado en el servidor nunca se sirve.
  - Hoy el comodín del final de `app.js` sirve la portada para cualquier ruta desconocida: sin la redirección, los links viejos caerían ahí sin avisar.
- **Se borran** `public/usuarios.html` y `public/areas.html`. `public/js/usuarios.js` sigue: lo carga `configuracion.html`. `public/js/areas.js` se reescribe (sección 4).
- **Los dos emails al superadmin** pasan a `${RPAD_URL}/configuracion.html` (`services/emailTemplates.js`, en el botón y en el texto):
  - `avisoSuperadminTemplate`, "RPAD: cambio en los usuarios";
  - `resumenAvisosRetenidosTemplate`.
  - El texto del botón ("Ver el panel de usuarios") no cambia, y abre la pestaña Usuarios.
  - Los emails que ya se enviaron llegan por la redirección.
- **El modal "Nueva área" rápido de `admin.html`** dice "Los datos de contacto se completan después, en Áreas." Pasa a decir "…en Configuración → Áreas.".

## 4. La pestaña Áreas

### 4.1 Lo que se ve

- **Una bajada:** "Los organismos responsables de los datasets. El nombre, el artículo y la dependencia salen así en las notas, y los emails del área reciben el aviso de los 40 días de los datasets de gestión externa."
- **El aviso**, solo si hay alguna área en esa situación, en ámbar como los del Seguimiento:
  - Texto: "N áreas con datasets de gestión externa no tienen email cargado: no les llega el aviso de los 40 días." Con una sola: "1 área … no tiene email cargado: no le llega …".
  - Al lado, el botón "Ver las áreas sin email", que elige el filtro "Sin email".
  - La regla es la del email de los 40 días (`datasetsExternosPorArea`, `services/avisosDiariosService.js`): el área tiene algún dataset activo, de gestión externa, con «Requiere nota DGMIT» en Sí o sin dato y con una frecuencia que vence (no eventual: `frecuencias.dias IS NOT NULL`), y no tiene ni email principal ni secundario.
  - Con la base del 24/10 son 6.
- **La tarjeta "Áreas responsables"**, con la cantidad a la derecha ("46 áreas").
- **El buscador:** "Buscá por nombre, dependencia, email o persona de contacto". No distingue tildes ni mayúsculas.
- **Los filtros**, como botones con su cantidad y `aria-pressed`:
  - Todas, Municipales, Fuera del municipio y Sin email;
  - Sin datasets, que aparece solo si hay alguna área sin ningún dataset, activo o dado de baja.
  - Las cantidades son del total, no de lo que deja el buscador.
- **La tabla** (variante A de la maqueta, elegida por el usuario). Columnas:
  1. **Área y dependencia:** el nombre en negrita y, más chico, "Depende de la Secretaría …" o "Sin dependencia cargada". Ancho mínimo de 260 px.
  2. **Ámbito:** una insignia, "Municipal" en celeste o "Fuera del municipio" en gris con borde.
  3. **Emails del área:** el principal y el secundario, uno por renglón. Sin ninguno, una etiqueta:
     - "Sin email: no recibe el aviso de los 40 días" en rojo, si le toca el aviso (la regla del aviso de arriba);
     - si no, "Sin email" en gris.
  4. **Persona de contacto:** el nombre y, más chico, el teléfono y el email separados por " · ", o "Sin teléfono ni email". Sin persona, "—".
  5. **Datasets:** la cantidad de activos, alineada a la derecha.
  6. **Un botón "Editar":** su `aria-label` es "Editar <nombre del área>", y abre el modal.
- **Tamaño de la ventana:** en pantallas angostas la tabla se desplaza de costado dentro de su marco (`overflow-x: auto`, `position: relative`). La página no se desplaza de costado.
- **Otros estados:**
  - Mientras carga, un spinner.
  - Sin coincidencias: "Ninguna área coincide con lo que buscaste."
  - Si falla el pedido: "No se pudieron cargar las áreas. Probá de nuevo en unos minutos." Nunca una lista vacía.
- **Cuándo se pide:** la lista se pide la primera vez que se abre la pestaña y se vuelve a pedir después de guardar o borrar.

### 4.2 El modal del área

**Estructura:**
- La de los modales del Seguimiento: `.modal-overlay > .modal[role=dialog][aria-modal=true][aria-labelledby]` con cabecera, cuerpo y pie como **hijos directos** del `.modal`.
- **No hay `<form>` entre el `.modal` y su cuerpo.** El cuerpo se desplaza y el pie con los botones queda siempre a la vista. Se probó con 640 px de alto.
- 720 px de ancho, borde de 18 px y letra del Seguimiento.
- Título: "Nueva área" o "Editar área".

**Campos**, en tres grupos (`fieldset` con `legend`):
1. **El área**
   - **Nombre** (obligatorio, hasta 200 caracteres), con el **artículo delante**: un selector la/el, porque así se lee.
   - **Depende de** (hasta 300), con su artículo delante: —, la o el. El "—" guarda NULL.
   - **"Así se lee en las notas"**, que se actualiza mientras se escribe:
     - «la Dirección General de Catastro, dependiente de la Subsec. de Coordinación Económica y Control de Gestión»;
     - sin dependencia, «la Dirección General de Catastro»;
     - con la dependencia sin artículo, «…, dependiente de Subsec. …»;
     - con el nombre vacío, «la …».
     - Es el mismo armado que usa la nota del Generador ("…ante la X, dependiente de la Y").
   - **Ámbito:** dos opciones grandes, como el tipo de nota del Seguimiento.
     - "Municipal": "La nota de la DGMIT va por la Subsecretaría."
     - "Fuera del municipio": "La nota de la DGMIT va directo al organismo."
     - En un alta viene elegida "Municipal", el valor por defecto de la columna del Generador. Los valores, la validación y el mensaje son los del Generador (`AMBITOS`, `MENSAJE_AMBITO` de `areasController.js`).
2. **Contacto del área**
   - **Email principal** y **Email secundario**, en una fila, hasta 150 cada uno. Debajo: "Los dos reciben el aviso de los 40 días de los datasets de gestión externa. Sin ninguno, no le llega."
   - **Teléfono** y **Celular**, en una fila, hasta 50 cada uno.
3. **Persona de contacto**
   - **Nombre**, hasta 150.
   - **Teléfono** (hasta 50) y **Email** (hasta 150), en una fila.

**El pie:**
- A la izquierda:
  - en un alta, "Se guarda al confirmar.";
  - al editar un área sin ningún dataset, activo o dado de baja, y sin cambios pendientes que la usen, el botón de texto rojo "Borrar el área";
  - si tiene datasets, "Tiene N datasets: para borrarla, primero hay que pasarlos a otra área." (cuenta activos y dados de baja; "1 dataset");
  - si no tiene datasets pero un cambio pendiente la usa, "Un cambio pendiente la usa: para borrarla, primero hay que aprobarlo o rechazarlo." ("N cambios pendientes la usan: … aprobarlos o rechazarlos.").
- A la derecha: "Cancelar" y "Guardar área".

**Comportamiento**, como los modales del Seguimiento y de Usuarios:
- Al abrirlo, el foco va al nombre. Al cerrarlo, vuelve al botón que lo abrió.
- Escape lo cierra. Un clic en el velo no lo cierra, como en Usuarios, para no perder lo escrito.
- Guardar se deshabilita mientras espera.
- Los errores se ven **adentro del modal**:
  - un error con campo va debajo del campo (`.form-error`, `aria-invalid`, `aria-describedby`) y el foco va a ese campo;
  - uno sin campo, en un aviso arriba del cuerpo (`role="alert"`).
- El navegador controla antes de enviar que el nombre no esté vacío, con el mismo mensaje que el servidor. El servidor valida igual.
- **Al editar, se mandan solo los campos que cambiaron** respecto del área que se abrió (decisión mía, por la revisión). Sin ningún cambio, se cierra sin pedir nada. En un alta se mandan todos. Así un formulario que se abrió con datos incompletos nunca pisa con NULL lo guardado.
- Al guardar, un toast con el mensaje del servidor; se cierra el modal y se vuelve a pedir la lista.

### 4.2 bis Si la lista llega sin los datos de administración

Pasa si la sesión venció con la página abierta (el token dura 7 horas, y `main.js` lo revisa solo al cargar la página), o si a la persona le bajaron el rol o la desactivaron. La API no responde 401 (la ruta es pública), así que devuelve la forma pública: sin contacto y sin las cuentas.

- La API marca la vista completa con `vista: 'administracion'` en la respuesta, al lado de `data` (decisión mía, por la revisión). No se deduce porque falte un campo.
- Sin esa marca, la pestaña no dibuja la tabla ni el aviso, y muestra en su lugar: "Tu sesión ya no permite ver las áreas. Volvé a ingresar." con un link a `login.html`. "Nueva área" queda deshabilitado.
- Lo mismo si un guardado o un borrado responde 401 o 403: el mensaje en el modal, y la lista no se vuelve a pedir.

### 4.3 Borrar un área

- Un modal chico (520 px): "¿Borrar el área «X»? No tiene datasets. Se borra del todo y no se puede deshacer.". Botones "Cancelar" y "Borrar área", en rojo.
- El foco va a "Cancelar".
- Escape cierra primero este modal y deja abierto el del área.
- Si el servidor lo rechaza (por ejemplo, porque mientras tanto se le asignó un dataset o un cambio pendiente la eligió), el mensaje aparece en el modal.
- Al borrar, se cierran los dos modales y se vuelve a pedir la lista.
- Sigue siendo un borrado definitivo, porque `areas` no tiene `activo`:
  - sus vínculos con proyectos de Gestión se borran (`proyecto_areas`, ON DELETE CASCADE);
  - los emails del área que queden en el registro pierden el área (`notificaciones_log.area_id`, SET NULL).
  - Esto ya pasa hoy y no cambia.

## 5. La API de áreas

Las rutas no cambian:
- `GET /api/areas` y `GET /api/areas/:id`, públicas;
- `POST`, `PUT` y `DELETE`, con `authMiddleware` y `adminOnly`, como hoy.

### 5.1 Quién ve qué

- **Sin una sesión de administración**, el área sale **sin datos de contacto**:
  - no van `email_principal`, `email_secundario`, `telefono_area`, `celular_area`, `nombre_contacto`, `telefono_contacto` ni `email_contacto`;
  - sí van `id`, `nombre`, `articulo`, `area_superior`, `articulo_superior`, `ambito`, `cantidad_datasets` y las fechas.
  - Vale para quien no tiene sesión, para el lector y el colaborador, y para un token inválido, vencido o de una cuenta desactivada.
  - Las rutas siguen siendo públicas: nunca responden 401 ni 403.
  - Solo la pestaña Áreas usaba esos campos. El calendario, el selector de `admin.js`, Notas, Reportes y Gestión usan solo el id y el nombre, y siguen pidiendo sin token (`API.getAreas()`).
- **Con una sesión de administración**:
  - **Qué cuenta como sesión:** el token, la cuenta activa, la `sesion_version` y el rol se leen de la base, igual que en `authMiddleware`, y el rol tiene que cumplir `esAdmin`.
  - **Qué devuelve:** todo lo de hoy, más tres cuentas y la marca de la vista:
    - `datasets_dados_de_baja`: los datasets de esa área con `activo = FALSE`;
    - `datasets_externos_con_nota`: los que reciben el email de los 40 días, con la regla de la sección 4.1 (activos, de gestión externa, con `requiere_nota` NULL o 1 y una frecuencia que vence);
    - `cambios_pendientes_que_la_usan`: los cambios en estado `pendiente` cuyo `datos_nuevos.area_id` es esta área (altas y ediciones). Sirve para la regla de borrar (5.3);
    - `vista: 'administracion'` en la respuesta, al lado de `data` (sección 4.2 bis). La respuesta pública no lo lleva.
  - **Cómo pide la pestaña:** con `API.pedirJson('GET', '/areas')`, que manda el token.

- **La API de datasets** (`GET /api/datasets` y `GET /api/datasets/:id`, públicas) sigue la misma regla (decisión del usuario, por la revisión):
  - Hoy `DATASET_SELECT_QUERY` (`controllers/datasetController.js`) trae `area_email_principal`, `area_email_secundario`, `area_telefono`, `area_celular`, `area_contacto_nombre`, `area_contacto_telefono` y `area_contacto_email`, y `enriquecer` los devuelve tal cual.
  - Sin una sesión de administración, esos siete campos no van. Ninguna página ni ningún test los usa. El nombre del área (`area_nombre`) y su dependencia (`area_superior`) siguen.
  - Con una sesión de administración, van como hoy. En la práctica nadie los pide con token: `API.getDatasets()` y `API.getDataset()` no lo mandan.
  - La sesión opcional es la misma que la de áreas.
- **Lo que ve el lector con sesión no cambia** (decisión del usuario). Los emails del área siguen en el detalle de un "Email al área" del Seguimiento, y el email y la persona de contacto en el PDF de Reportes "Por área". Esta entrega cierra solo lo que se ve sin sesión de administración en las dos APIs públicas.

### 5.2 Guardar

Los errores vuelven como `{ success: false, error, campo }`. El campo `campo` es nuevo y se suma a la respuesta; el estado HTTP sigue siendo 400.

- **`nombre`:**
  - Se guarda sin los espacios de los extremos.
  - Obligatorio en el alta. En una edición, si viene, no puede quedar vacío; hoy intentaba guardar NULL.
  - Mensajes: "Escribí el nombre del área." y, si pasa de 200 caracteres, "El nombre puede tener hasta 200 caracteres.".
  - **Repetido:** "Ya hay un área con ese nombre." en `nombre`. La colación no distingue mayúsculas ni tildes.
  - Dos guardados simultáneos que chocan contra el índice único (`ER_DUP_ENTRY`) dan el mismo mensaje, no un 500.
- **`articulo`:** 'la' o 'el'.
  - Si no viene en el alta, vale 'la'. En una edición, se conserva.
  - Otro valor: "Elegí el artículo: la o el." en `articulo`.
- **`articulo_superior`:** NULL, 'la' o 'el'. '' es NULL. Otro valor da el mismo mensaje en `articulo_superior`.
- **`area_superior`:** se recorta. '' es NULL. Hasta 300 caracteres.
- **Emails** (`email_principal`, `email_secundario`, `email_contacto`):
  - Se recortan, y '' es NULL.
  - Formato: el de los usuarios (`PATRON_EMAIL` de `services/usuariosReglas.js`, que hay que exportar). `emailValido` no sirve tal cual porque corta en 100 caracteres. Mensaje: "Revisá el email: no parece una dirección válida." en su campo.
  - Hasta 150 caracteres: "El email puede tener hasta 150 caracteres.".
- **Teléfonos** (`telefono_area`, `celular_area`, `telefono_contacto`) y **`nombre_contacto`:**
  - Se recortan, y '' es NULL.
  - Largos: 50 los teléfonos y 150 el nombre. Mensaje: "Puede tener hasta N caracteres." en su campo.
- **`ambito`:** la regla del Generador.

**Cuándo se valida:**
- **Formato y largo de emails, teléfonos y nombre de contacto, solo si el campo cambia** (decisión mía, como las fechas de los datasets). Así un dato viejo no frena una edición. Hoy los 46 emails cargados son válidos.
- El nombre y los artículos se validan siempre que vienen.

**Lo que no cambia:**
- La edición sigue siendo parcial: solo se escriben los campos que vienen. El alta rápida de `admin.js` (`API.createArea({ nombre })`) sigue andando.
- Los mensajes de éxito siguen igual ("Área creada correctamente", "Área actualizada correctamente", y el del borrado).
- "No hay datos para actualizar" sigue.

### 5.3 Borrar

- `DELETE /api/areas/:id` cuenta **todos** los datasets del área, activos y dados de baja. Hoy contaba solo los activos y el borrado chocaba con la clave foránea: un 500.
- Con alguno, sigue respondiendo 400, con el mensaje "No se puede borrar el área: tiene N datasets (M dados de baja). Primero hay que pasarlos a otra área.":
  - "(M dados de baja)" va solo si hay alguno;
  - "1 dataset" en singular.
- **También cuenta los cambios pendientes que la usan** (decisión mía, por la revisión): los `pendiente` cuyo `datos_nuevos.area_id` es esta área.
  - **El caso:** el alta rápida de `admin.html` crea el área enseguida, pero el dataset queda pendiente hasta que alguien lo aprueba.
  - **Por qué:** si el área se borra en el medio, aprobar ese cambio choca con `fk_datasets_area` y da un 500.
  - **La respuesta:** 400 con "No se puede borrar el área: un cambio pendiente la usa. Primero hay que aprobarlo o rechazarlo." ("N cambios pendientes la usan … aprobarlos o rechazarlos").
  - Si tiene datasets, manda el mensaje de los datasets.
  - El `area_id` de `datos_nuevos` puede estar guardado como número o como texto: la consulta compara los dos.
  - El filtro "Sin datasets" no cuenta los cambios pendientes: es un filtro de datasets.
- Si igual choca con una clave foránea (`ER_ROW_IS_REFERENCED_2`), por una carrera, da el mismo 400 sin el detalle, nunca un 500.
- Un id que no es un entero positivo o que no existe: 404 "Área no encontrada".

## 6. Cómo se arma el frontend

- **`configuracion.html`:**
  - Tiene el marcado de `usuarios.html` tal cual (ids, textos y modales), más la pestaña, la vista `#vista-areas`, el botón `#btn-nueva-area` y los modales `#modal-area` y `#modal-borrar-area`.
  - Los ids de Áreas llevan prefijo (`a-…`, `area-…`, `areas-…`), y ninguno se repite con los de Usuarios.
  - Su `<style>` tiene el de `usuarios.html`, más el de Áreas con prefijo `ar-`, que usa los tokens de `main.css` (`--tinta`, `--texto`, `--suave`, `--linea`, `--bruma`, `--cielo`, `--sol`, `--sol-fuerte`, `--f-titulo`). Define además `--borde-control`, que está en `publico.css` y esta página no carga, y sus rojos y ámbar.
  - Suma `.main-content { min-width: 0; }` para que la tabla no ensanche la página, como en el Seguimiento.
- **Los scripts** van como siempre, sin atributos: `config.js`, `auth.js?v=VERSION`, `main.js?v=VERSION`, `api.js?v=VERSION`, `usuarios.js?v=…` (sube) y `areas.js?v=…` (nuevo en el test). No hace falta tocar `main.js`, `api.js` ni `main.css`, así que `VERSION` y `VERSION_CSS` no cambian.
- **`usuarios.js`** cambia lo mínimo:
  - `mostrarVista` conoce las tres vistas y los dos botones del encabezado, y escribe el fragmento;
  - el arranque lee el fragmento;
  - nada más.
  - **Tiene que seguir andando en el `vm` de `tests/usuarios-frontend.test.js`:** allí `window.location` es `{}` y no hay `history` ni `location` global. Se usan `window.location.hash` y `window.history?.replaceState`, con guarda.
  - **Cuidar lo que ya llama el test:** las funciones que llama se siguen declarando con `function`, y no se agrega un segundo `DOMContentLoaded` en este archivo.
- **`areas.js` se reescribe** para la pestaña nueva:
  - Al cargarse solo declara, como `perfil.js` o `seguimiento.js`: un test lo carga en un `vm`.
  - Lo que arma HTML y lo que calcula es puro y va primero; lo que toca el DOM o la API, al final. Lo puro: el armado de "Así se lee", los filtros y sus cantidades, la búsqueda sin tildes, la tabla, la regla del aviso, los textos y los datos del formulario.
  - Pide con `API.pedirJson` (GET, POST, PUT y DELETE).
  - Sus nombres globales no se repiten con los de `usuarios.js` ni con los de `main.js` y `api.js`. Un `let` o `const` repetido rompe el segundo script entero. Ojo con `abrirModal`, `cerrarModal`, `mostrarError`, `esc`, `leer`, `escribir`, `plural`, `sinTildes` y `avisar`.
  - Escucha sus clics dentro de `#vista-areas` y de sus modales, y usa sus propios atributos (`data-editar-area`, `data-filtro-area`, `data-borrar-area`, …). Nunca usa `data-ver` ni `data-licencia`, que escucha `usuarios.js` en todo el `<main>`.
  - Su propio Escape cierra solo sus modales: primero el de borrar y después el del área.
- **Quién carga la lista y cuándo** (`usuarios.js` llama a una función de `areas.js`, un evento, u otra forma) queda para quien lo construye. La condición es que se pida una sola vez hasta que se guarde o se borre.

## 7. Pruebas

Antes y después de cada tarea va la suite completa (`npm test`), como siempre.

- **`tests/paginas.test.js`:**
  - **Las páginas con carcasa pasan de 14 a 13**, con los comentarios que dicen "14".
  - El link único `href="configuracion.html"` en cada página con `sidebarAdmin`, en lugar de `usuarios.html`.
  - El menú de cada página, sin `areas.html` y con `configuracion.html`.
  - `configuracion.html` carga `usuarios.js` con su versión, y `areas.js` con una constante nueva, después de `api.js`.
  - El texto de `#grupo-autorizado` se lee de `configuracion.html`.
  - Ya no existen `usuarios.html` ni `areas.html` en `public/`.
- **`tests/usuarios-frontend.test.js`:**
  - Lee `configuracion.html` en lugar de `usuarios.html`.
  - La búsqueda de `<option value="(rol)">` recorre toda la página, así que el modal de Áreas no puede tener opciones con esos valores. No las tiene: la/el y municipal/externo.
  - Suma la tercera pestaña y el fragmento, con el `window` de mentira del test.
- **`tests/areas-frontend.test.js`** (nuevo, sin base): `areas.js` en un `vm`.
  - "Así se lee", con y sin dependencia y con el artículo vacío.
  - Las cantidades de los filtros y "Sin datasets", que aparece solo si hay.
  - La búsqueda sin tildes.
  - La regla del aviso: externo con nota y sin email sí; externo con «Requiere nota» en No, no; interno sin email, no; un solo email, no.
  - Las etiquetas de la tabla, el escapado de cada texto y un 0 que se muestra.
  - El pie del modal en sus cuatro casos: alta, sin datasets, con datasets y con un cambio pendiente.
  - Los campos que se mandan al editar: solo los que cambiaron; ninguno si no cambió nada; todos en un alta.
  - La respuesta sin `vista: 'administracion'`, que da el mensaje de sesión y no la tabla.
  - Que al cargarse no toca el DOM.
- **`tests/areas-api.test.js`** (nuevo, con Docker y base propia):
  - **Quién ve el contacto:** sin sesión, con lector, con colaborador, con token inválido y con cuenta desactivada, sin contacto, sin las cuentas, sin `vista` y sin 401. Con superadmin, admin y editor, con contacto, las tres cuentas y `vista: 'administracion'`. En `GET /areas` y en `/areas/:id`.
  - **Lo mismo en `GET /datasets` y `/datasets/:id`:** los siete campos de contacto del área solo con sesión de administración; `area_nombre` siempre.
  - **Validaciones:** cada 400 con su `campo`; el nombre de espacios en el alta y en la edición; el repetido con otras mayúsculas o tildes.
  - **Un dato viejo no frena:** un email inválido guardado por SQL no frena una edición que no lo toca.
  - **El alta rápida** con `{ nombre }` sigue andando.
  - **Borrar:** con datasets dados de baja da 400 con el mensaje, no 500. Con un alta pendiente que la eligió, también 400, con el `area_id` guardado como número y como texto. Sin nada, se borra.
  - **Permisos:** siguen los de `tests/permisos.test.js`.
- **Las redirecciones** (Docker, con el `app.js` real): `/usuarios.html` → 302 `/configuracion.html` y `/areas.html` → 302 `/configuracion.html#areas`, con `redirect: 'manual'`.
- **`tests/email-diseno.test.js`:** el botón y el texto de los dos emails al superadmin apuntan a `/configuracion.html`.
- **`tests/publico.test.js`:** `GET /areas` sin sesión sigue respondiendo 200 con datos.
- **Recorrido en el navegador**, con el servidor de la rama y su base:
  - las tres pestañas, como superadmin, admin y editor;
  - el lector, que va a la portada;
  - el modal en una ventana de 640 px de alto;
  - el teléfono (375 px), sin desplazamiento de costado;
  - los links viejos;
  - un email al superadmin en Mailpit.

## 8. La cola, el código actualizado y el despliegue

- **La rama:** `feat/configuracion`, worktree `.claude/worktrees/configuracion`. Arranca desde main 8b25ae0 y hoy tiene solo este documento y la maqueta.
- **Cuándo se implementa:** después de que Métricas y Reportes, el Generador de Notas y la hoja oficio estén en main. Lo pidió el usuario.
- **La primera tarea del plan:** traer main a la rama (`sync` o `merge`) y **releer el código actualizado** de todo lo que toca esta entrega. Si algo cambió, se ajusta el plan antes de tocar código:
  - **El menú lateral de las páginas:** Métricas cambia "Reportes" por "Métricas y Reportes"; el Generador puede ocultar Notas al lector desde `main.js`.
  - **Las constantes y las versiones de `tests/paginas.test.js`.**
  - **El formulario de Áreas y la API:** `areas.html`, `areas.js` y `areasController.js` con el Ámbito del Generador (`AMBITOS`, `MENSAJE_AMBITO`, sus tests en `tests/areas-ambito-api.test.js`). El modal nuevo reemplaza su selector por las dos opciones grandes y conserva los mismos valores, la misma validación y el mismo mensaje.
  - **Los consumidores de `GET /api/areas` y de `GET /api/datasets`:** en especial el endpoint del Generador, que según su spec no los usa, y `controllers/datasetController.js`, que cambia en Métricas.
  - **Los emails, `usuarios.js` y sus tests.**
  - **Los recuentos de `CLAUDE.md`:** cuántas páginas hay, la estructura y la sección de la carcasa.
- **La base de la rama:** una copia propia (`rpad_rama_configuracion`), nunca la compartida. Ningún email real: todo va a Mailpit. Nunca se llama a `/api/cron/*`.
- **Sin migraciones.**
- **El kit de despliegue:** `Escritorio/RPAD-deploy-configuracion`, como los anteriores.
  - Los archivos que cambian:
    - `public/configuracion.html` (nuevo), `public/js/areas.js` y `public/js/usuarios.js`;
    - las otras 12 páginas con carcasa (el menú), entre ellas `admin.html`, que además cambia el ícono y el texto del alta rápida;
    - `app.js`, `controllers/areasController.js`, `controllers/datasetController.js`, el middleware o el servicio de la sesión opcional, `services/usuariosReglas.js` (exporta `PATRON_EMAIL`) y `services/emailTemplates.js`.
  - En `PASOS.txt`: borrar `public/usuarios.html` y `public/areas.html` del servidor, aunque la redirección ya les gana, y después Restart.
  - **Vuelta atrás:** reponer los archivos anteriores. No hay nada que deshacer en la base. La redirección es temporal (302), así que los navegadores no la recuerdan.
- **Documentación:**
  - **`CLAUDE.md`:**
    - estructura: 13 páginas, `configuracion.html` en la lista y la carcasa;
    - la convención de `areas.js`;
    - "pestaña Licencias de Configuración";
    - los tests.
  - **`README.md`:**
    - "Panel de usuarios" pasa a ser Configuración, con Usuarios, Licencias y Áreas;
    - el árbol de archivos;
    - el changelog.

## Decisiones mías (para que las revises)

1. **Redirección temporal (302).** La de `usuarios.html` va sin fragmento para que el del link original se conserve. Con una 301, los navegadores la recordarían aunque se vuelva atrás.
2. **Emails, teléfonos y nombre de contacto se validan solo si el campo cambia**, como las fechas de los datasets.
3. **Los errores de Áreas suman `campo`** y conservan el estado 400. Borrar con datasets también sigue en 400, con un mensaje más claro.
4. **Un clic en el velo no cierra el modal del área**, como en Usuarios. En el Seguimiento sí lo cierra.
5. **La pestaña se lee al abrir y se escribe al cambiar, sin `hashchange`.** Ningún link de la página cambia el fragmento.
6. **El botón de los emails al superadmin conserva su texto** ("Ver el panel de usuarios") y abre la pestaña Usuarios.
7. **Sin endpoint nuevo:** `GET /api/areas` devuelve más datos a administración y menos al resto.
8. **El `h1` de `admin.html` también pasa al ícono de capas.**
9. **`areas.js` conserva el nombre del archivo**, reescrito.
10. **En un alta, el Ámbito viene en "Municipal"**, el valor por defecto de la columna del Generador.
11. **Persona de contacto:** la tabla muestra su teléfono y su email. Los del área están en el modal.
12. **Al editar un área se mandan solo los campos que cambiaron**, y la API marca la vista completa (`vista: 'administracion'`). Sin la marca, la pestaña no dibuja la lista: así un formulario incompleto nunca pisa contactos guardados (sección 4.2 bis). Salió de la revisión.
13. **Borrar también se frena con un cambio pendiente que usa el área.** Si no, aprobarlo daría un 500. Salió de la revisión.

## Lo que queda para quien lo construye

- **La sesión opcional de `GET /api/areas`.** Dónde vive (un middleware nuevo en `middleware/auth.js` o una función compartida) y cómo comparte el control con `authMiddleware` sin duplicarlo.
- **Cómo se avisan `usuarios.js` y `areas.js` el cambio de pestaña.**
- **El CSS exacto de la pestaña.** La maqueta es la referencia: `js/areas.js` y el `<style>` de `configuracion.html` de la carpeta de maquetas.
- **El orden de las tareas del plan.** La primera es la de la sección 8.

# Resumen — prototipos de rediseño de la interfaz (rama `newUI`)

Esta rama **solo añade/cambia** la carpeta `prototipos_opencode_musespark1.3free/`.
No toca la app (`index.html`, `js/`, `css/`, `sw.js`, `manifest.json`), ni
`README.md`, ni `docs/`, ni los tests del proyecto.

Son **6 prototipos navegables** más una galería. Todo funciona con **datos
falsos** y sin backend: se abren con doble clic (`file://`), sin servidor ni
dependencias. Mapas, históricos, IA y push están **simulados** a propósito.

Para empezar: abrir `prototipos_opencode_musespark1.3free/index.html`.

---

## Tabla rápida

| # | Fichero | Concepto | Enfoque |
|---|---------|----------|---------|
| P1 | `p1-pulso.html` | **Pulso** — cards + bottom-sheet | Mobile-first, uso con una mano |
| P2 | `p2-mapa.html` | **Mapa Vivo** — fullscreen + carrusel | Explorar alrededor / conduciendo |
| P3 | `p3-pro.html` | **Consola Pro** — dashboard | Pantalla grande, uso intensivo |
| P4 | `p4-volante.html` | **Volante** — conducción y accesibilidad | Targets grandes, alto contraste |
| P5 | `p5-completo.html` | **Completo** — paridad funcional | Validar que no falta nada de la app real |
| P6 | `p6-trayecto.html` | **Trayecto** — repostar de camino | Propuesta nueva: planificar un viaje |

Los cinco primeros comparten las mismas **12 estaciones ficticias de Madrid** y
los mismos precios base, así que las diferencias que se ven son de **diseño**,
no de datos. El P6 añade una ruta simulada **Madrid → Valencia** (355 km).

---

## P1 · Pulso — cards + bottom-sheet

**Concepto:** la app tal como se usa de pie junto al coche: buscar, comparar y
abrir la ficha sin soltar el móvil.

- **Cabecera sticky** con buscador siempre a la vista y chips de combustible.
- **3 KPIs** arriba: más barata, media y favoritas.
- **Cards** con precio grande, badge por tramo (`Barata` / `Media` / `Alta`),
  marca, dirección, distancia y ☆.
- **Bottom-sheet de detalle** con dos pestañas:
  - *Información*: los combustibles de la estación y acciones.
  - *Histórico*: selector de combustible + 7/14/30/90 días, **gráfica canvas**
    y tooltip al pasar el dedo/ratón.
- **Navegación inferior**: Inicio, Tabla, Mapa, IA, Config.
- **≥960 px**: la lista y el mapa conviven en dos columnas (mapa sticky).
- **IA simulada** con respuestas de ejemplo y **Config** con descuentos por
  marca que recalculan los precios.

**Qué demuestra:** la ruta más corta entre "abro la app" y "sé dónde repostar".

---

## P2 · Mapa Vivo — fullscreen + carrusel

**Concepto:** el mapa manda; la lista es un carrusel que acompaña.

- **Mapa a pantalla completa** (fondo simulado en CSS) con pines que muestran
  el **precio completo** y color por tramo.
- **Chips flotantes** de combustible y **leyenda inline** con el tramo de
  precios + contador de estaciones.
- **Carrusel inferior** con `scroll-snap`; pin ↔ tarjeta **sincronizados** en
  ambos sentidos (tocar un pin centra su tarjeta y viceversa).
- **Panel de detalle** al tocar un pin: precio, dirección, favorito, histórico
  con gráfica y selector de días, y "Ir" simulado.
- **FABs** abajo a la derecha: *solo favoritas* y *tabla*.
- **Navegación inferior** Mapa / Tabla / IA / Config; en PC, panel lateral.

**Qué demuestra:** explorar sin perder el contexto geográfico, con el pulgar.

---

## P3 · Consola Pro — dashboard

**Concepto:** aprovechar el monitor grande para comparar en serio.

- **Tres columnas**: filtros (combustible, localidad, marca, solo favoritas,
  buscador) · mapa + tabla · panel de detalle.
- **KPIs** (mínimo, media, nº de estaciones) y contador con el filtro activo.
- **Tabla ordenable** por marca, precio y distancia, con ☆ por fila.
- **Mapa con pines** proporcionales al precio; clic en pin o fila abre el
  **drawer** con pestañas *Info / Histórico / IA*.
- Al arrancar sin selección, el panel derecho muestra un **Resumen** con las
  3 estaciones más baratas como accesos directos (antes quedaba vacío).
- **Móvil**: la sidebar y el drawer pasan a deslizantes.

**Qué demuestra:** densidad de información sin perder legibilidad.

---

## P4 · Volante — conducción y accesibilidad

**Concepto:** usarlo parado en el coche, con sol, prisa o poca vista.

- **Hero** con la estación más barata: precio gigante, dirección y dos acciones
  (**Ver detalle** y **☆ Vigilar**, que alterna el favorito de verdad).
- **Targets de 56–72 px** y tipografía grande en toda la pantalla.
- **Segmentado** Gasolina / Gasóleo que recalcula el hero y la lista.
- **Filas grandes** con precio, distancia, dirección y favorito; soporte de
  teclado (`Enter`/`Espacio`) y sin `<button>` anidados.
- **Ficha** con histórico y navegación simulada.
- **Modo claro/oscuro** con un toque.
- **IA en lenguaje simple** ("la más barata", "¿dónde reposto?").
- Aviso de bajada de precio.

**Qué demuestra:** accesibilidad y uso "one-hand" sin renunciar a la estética.

---

## P5 · Completo — paridad funcional

**Concepto:** el diseño de P1, pero con **todas** las funciones de la app real,
para validar que ningún rediseño se deja algo por el camino.

1. **Provincia / localidad** y estado vacío "sin provincia".
2. **Marcas multi-selección** con buscador y **Todas / Ninguna**.
3. **Distancia máxima en km**, GPS simulado y **punto manual** en el mapa
   (equivalente al clic derecho de la app).
4. **Los 10 estilos de mapa** del desplegable real (orden A-Z, `satellite` por
   defecto), representados con 3 fondos simulados.
5. **Orden asc/desc** por precio, distancia y marca, desde la cabecera y desde
   el desplegable (sincronizados).
6. **Paginación** 5/10 (demo) + 15/30/50/100/150/300/Todas de la app real,
   con `◀ ▶` y contador (30 por defecto).
7. **Favoritos** desde cards, tabla y cabecera de la ficha, y filtro "solo
   favoritas". La tabla marca la estación **más barata** del resultado.
8. **Descuentos por marca** con **+ Añadir marca** (texto libre con
   sugerencias) y ✕ para quitar; mueven precios, KPIs, badges y leyenda.
9. **Histórico** 7/14/21/30/60/90/180, **los 10 combustibles** de la app (solo
   los que vende cada estación), tooltip y nota de que la serie acaba en el
   precio en vivo de hoy.
10. **Chat IA**: General + 7 proveedores, **clave y modelo por proveedor** (se
    recuerda el último enviado), estado por proveedor (`Sin API Key`,
    `Anónimo`, `URL sin subdominio`), refresco de catálogo, ✎ editar, ✕
    cancelar, **General en paralelo** con marca de agua
    `⏱ proveedor · modelo · tiempo` y ❌ para quien no tiene clave, prompts
    rápidos solo en General y borrado de historial por pestaña.
11. **Config completa**: push (bajada/subida, intervalo, días, promedio vs
    consecutivos, probar), caché con pestañas IndexedDB/localStorage y ✕ por
    clave, logs API/Push con borrado, claves con contraseña `demo` y "Volver a
    cargar", proxy NVIDIA con ↺ Predefinida y 🔎 Probar (detecta la URL sin
    subdominio), visibilidad de pestañas (mínimo una), 5 prompts editables,
    versión actual y buscar actualizaciones.
12. **Buscador con toggle 🔍** (como la app) y **filtros avanzados plegables**
    (⚙️ con punto rojo cuando hay filtros activos); en PC la tabla oculta las
    cards duplicadas.
13. **Popup del mapa con pestañas Info/Histórico**: gráfica propia, selector de
    combustible y 7 días por defecto (igual que la app).
14. **Leyenda por percentiles** dinámicos (25/75) y reset sin re-fetch (que
    también oculta la búsqueda, como el ✕ de la app).

**Qué demuestra:** que el rediseño es *portable* a la app actual sin perder
funciones, y sirve de checklist viva para el port real.

---

## P6 · Trayecto — repostar de camino (propuesta nueva)

**Concepto:** cambiar la pregunta. En vez de "¿qué estaciones hay cerca?", el
usuario planifica un viaje y la app decide **dónde merece la pena parar**.

- Entrada: **origen, destino, combustible, litros que quedan, litros a repostar
  y consumo (L/100)**; botones ±5 L y ±0,5 para ajustar sin teclado.
- **Aviso de autonomía**: *"con 20 L te quedan 308 km y el destino está a 355:
  tienes que parar antes del km 308"*.
- **Ahorro neto** por parada = `(precio medio de la ruta − precio) × litros −
  coste del desvío`, donde el desvío cuesta `km extra × 2 × consumo × precio +
  minutos × 0,15 €/min`. Se ordena por eso, **no por precio absoluto**.
- **Ida y vuelta** duplica distancia y litros necesarios.
- **Móvil**: timeline vertical (km, marca, precio, desvío, ahorro, etiquetas
  *Mejor parada* / *Ahorras* / *Cuesta*) + barra inferior fija con la parada
  elegida y **Guardar ruta**.
- **PC**: **mapa SVG de la ruta** (curva Bézier con las 6 paradas encima, km y
  precio), panel **"Por qué esta parada"** con el cálculo desglosado y resumen
  fijo en la columna derecha.
- **Ficha de parada**: los dos combustibles, coste del desvío, histórico
  7/14/30 días con gráfica y "Elegir esta parada".
- Datos fake: 6 paradas entre Madrid y Valencia (Repsol, Ballenoil, Plenergy,
  Cepsa, Ballenoil, Shell) con desvíos y precios distintos.

**Qué demuestra:** una distribución y un modelo de decisión distintos, que
responden a "voy de viaje" mejor que una lista de estaciones cercanas.

---

## Cambios de la ronda de auditoría

Se probó cada prototipo con navegador automatizado y se corrigieron defectos
reales, no solo estéticos:

- **P1** — la tendencia mostraba céntimos ×1000 (`25 cts` en vez de `2,5`).
- **P2** — la leyenda y los FABs tapaban los chips; los pines mostraban solo
  los decimales (`43`); faltaba contador de resultados.
- **P3** — el panel derecho arrancaba vacío (ahora, resumen con las 3 más
  baratas); los chips de combustible no cambiaban el precio porque un manejador
  genérico `[data-f]` pisaba su `onclick`.
- **P4** — `<button>` anidado en las filas (HTML inválido) → `div role="button"`
  con teclado; "Vigilar" del hero ahora alterna el favorito de verdad.
- **P5** — el manejador genérico `[data-id]` abría la ficha al tocar un pin (el
  popup del mapa nunca aparecía); mismo problema con `[data-f]` en los chips
  (error `Cannot read properties of undefined`); "Ver detalle" llamaba a
  `document.open()` porque la función se llamaba `open()` y el documento se
  vaciaba → renombrada a `openSheet()`; buscador con filtros avanzados.
- **P6** — mapa de ruta rehecho con curva real (las paradas caen sobre la
  ruta), resumen visible en PC y texto de ahorro coherente cuando el neto es
  negativo.
- **Galería** — ordenada P1→P6, textos actualizados ("6 prototipos", "10
  estilos de mapa") y enlace al informe.

---

## Cobertura y limitaciones conscientes

Cubierto: provincia/localidad, los 10 combustibles, marcas múltiples,
distancia + GPS + punto manual, búsqueda con toggle, vistas mapa/tabla/ambos,
orden y paginación, favoritos, detalle, histórico 7–180 días, descuentos con
alta/baja de marca, popup con gráfica, push, logs, caché, IA (8 pestañas,
clave y modelo por proveedor, General en paralelo), proxy NVIDIA, visibilidad
de pestañas, prompts, versión y actualización.

Simplificaciones a propósito (no son fallos):

| Aspecto | Prototipo | App real |
|---|---|---|
| Estilos de mapa | 10 en el desplegable, 3 fondos simulados | 10 proveedores reales |
| Mapa | CSS / SVG simulado | Leaflet + tiles |
| Histórico | Serie generada | API del Ministerio |
| IA | Respuestas simuladas | Proveedores reales |
| Push | Simulado en UI | Web Push + Service Worker |
| Persistencia del chat | En memoria de la pestaña | localStorage por proveedor |

---

## Verificación

- **115 comprobaciones automáticas** con Playwright a **390×844** y **1440×900**,
  en `file:///`, sin servidor.
- Consola limpia y sin scroll horizontal en los 7 ficheros.
- Flujos interactivos: filtros, 10 combustibles, favoritos, detalle, histórico
  con rangos y combustibles, mapa y estilos, popup con gráfica, IA (envío,
  meta, General, pestañas, estado por proveedor), config (descuentos, claves,
  proxy, visibilidad, caché, logs), orden, paginación y todo P6.
- **Resultado: 115/115 OK, 0 fallos, 0 errores de consola.**

## Cómo probarlo en 2 minutos

1. Abrir `prototipos_opencode_musespark1.3free/index.html`.
2. Cambiar combustible a **Gasóleo** (o a **H₂**, que solo vende una estación)
   → precios, lista y KPIs se recalculan.
3. Marcar ☆ en dos estaciones y activar **Solo ☆**; probar el toggle 🔍.
4. Abrir una estación → **Histórico** → cambiar rango y combustible; en el
   **mapa**, abrir un pin → **Histórico** para ver su gráfica.
5. Entrar en **IA** y enviar "¿dónde reposto?" (respuesta simulada); cambia de
   proveedor y verás su modelo y su estado (`Sin API Key` / `Anónimo`).
6. En **Config**, añade un descuento a Ballenoil, mueve TTL y paginación, carga
   claves con `demo` y prueba el proxy (primero con la URL de ejemplo).
7. En **P6**, bajar los litros restantes y ver cómo cambia la parada
   recomendada y el aviso de autonomía.

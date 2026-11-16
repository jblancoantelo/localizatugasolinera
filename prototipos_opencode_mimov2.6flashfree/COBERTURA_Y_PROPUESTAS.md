# Cobertura funcional y propuestas nuevas

Documento de trabajo de esta ronda de prototipos. Compara lo que hace la app real
(`README.md`) con lo que hacen los 6 conceptos de esta carpeta, y propone piezas
nuevas que todavía no están en ninguno.

Los prototipos son **páginas estáticas con datos fake**, sin red, sin
localStorage y sin IndexedDB: no pueden replicar la persistencia ni el backend.
La pregunta que responde este documento no es "¿son iguales?", sino **"¿qué pieza
de la nueva UI se puede construir encima de la funcionalidad existente y qué
falta por inventar"**.

---

## 1. Paridad con la app actual

### 1.1 Cubierto con UI real (navegable y con efecto visible)

| Funcionalidad actual | Dónde está en los prototipos |
|---|---|
| Filtro por combustible | Chips en C1, C2, C6; lista en rail de C5; quick-action en C3; ciclo por título en C4 |
| Lista de estaciones con semáforo de precio | Los 6 conceptos (tarjetas en C1/C3/C6, filas en C2/C5, ranking en C4) |
| Ordenación por precio asc/desc | C1 (`#sortBtn`), C4 (`#rdSort`); el resto fija asc |
| Mapa con marcadores coloreados y detalle | Los 6, con el SVG fake de `comun/ui.js` |
| Vista "Ambos" mapa+lista | C5 (`data-cv="ambos"`) y C1 en escritorio (rail + mapa) |
| Detalle: precio + histórico + grid combustibles | Los 6; el histórico es SVG de 30 días, no canvas |
| Favoritos (añadir + vista) | C1, C2 y C6 tienen vista propia; el resto solo ★ visual |
| Chat IA con input, loading y marca de modelo | C1, C2, C3, C5, C6 (C4 no tiene) |
| Selector de pestañas/destinos | Los 6 (bottom nav; C6 además con swipe real) |
| KPIs de la provincia | C4 (3 KPIs + "¿repostar hoy?"), C3 y C5 (media/variación) |
| Configuración de avisos y descuentos | C1 y C3 (formularios visibles, sin persistencia) |

### 1.2 La app actual tiene y los prototipos NO replican

Esto es esperable (son temas de backend/persistencia) pero hay que decidirlo
antes de la implementación real:

- **Tabla paginada con sort dual por columnas** (Marca/Precio/Distancia/Localidad/Calle) y paginación configurable
- **Selector de provincia y localidad** (los prototipos lo dejan como toast "aquí se abriría…")
- **Filtro de marca con dropdown** y **filtro de distancia radial**
- **Buscador textual** real (C5 tiene el input pero no filtra)
- **10 estilos de mapa** con proveedor de respaldo (los prototipos solo tienen SVG claro/oscuro)
- **Persistencia**: IndexedDB (datos, histórico, favoritos, config) y localStorage (estado, filtros, logs, historial de chat)
- **Descarga del histórico** con caché por fecha y petición agrupada
- **Notificaciones push reales** (Periodic Background Sync en el SW)
- **Registro de actividad** (log API + log Push con buffer circular)
- **8 pestañas de IA**, claves cifradas, catálogo de modelos, historial por pestaña, Markdown, botones Cancelar/Editar
- **PWA**: precaché, offline, comprobación de actualizaciones

### 1.3 Los prototipos aportan y la app actual no tiene

Aquí está el valor de esta ronda, es lo que se puede portar:

- **Bottom sheet con snaps** (peek/half/full) en C1 y C2: en la app real el detalle es un panel que tapa la tabla
- **Swipe horizontal entre destinos** (C6) y **tarjetas apiladas arrastrables** (guardar/descartar con el dedo)
- **Pull-to-refresh** simulado (C6)
- **Comparador multi-estación con gráfica superpuesta** (C4, máx. 3)
- **Ahorro estimado en €/tanque** por estación (C4)
- **Recomendador "¿repostar hoy?"** con colores y justificación (C4)
- **Layout de 3 columnas** para escritorio (C5) — hoy la app en escritorio sigue siendo tabla + mapa en pestañas
- **Tema oscuro de alto contraste** (C3) — hoy no hay tema oscuro

---

## 2. Huecos detectados al revisar los prototipos

Errores de implementación en los propios prototipos, ya conocidos y que habría
que arreglar si algún concepto pasa a la app real:

- **Favoritas no persisten en el modelo**: en los 6 conceptos el ★ o el swipe
  cambian el botón y dan un toast, pero **no se muta `P.FAVORITAS`** ni se
  repinta la vista de favoritas. En C6 el swipe derecho a "★ Guardada" ni
  siquiera llama a `pintarFavs()`, así que la página de Favoritas se queda
  desactualizada.
- **C5 tiene controles muertos**: los switches "24 h únicamente" y "Solo
  favoritas" del rail no tienen handler, y el desplegable de estilo de mapa
  `#ckStyle` tampoco. No llegan ni a dar toast.
- **C4 se salta sus propios destinos**: los botones "Favoritas" e "IA" de su
  bottom nav solo cambian el botón activo y dan un toast, sin vista.
- **C2 pide estilo "satélite" a `UI.mapaFake()`** pero esa función solo
  distingue claro/oscuro, así que el botón de estilo no cambia nada.
- **C3 solo alterna entre G95 y Gasóleo A**: su quick-action de combustible no
  cicla G98 ni los demás, aunque los datos sí los tienen.

---

## 3. Propuestas nuevas

Tres piezas que no están en ninguno de los 6 conceptos y que aprovechan lo que
la app ya hace bien.

### 3.1 Modo conducción (una mano, targets XXL, mínimo info)

**Problema**: en el coche no puedes buscar con dos manos ni leer texto pequeño.
La app hoy muestra la misma densidad de información conduciendo que parado.

**Propuesta**: un interruptor en la toolbar que pase toda la app a modo conducción:

- Solo **"la más barata cerca"** y **"mis favoritas"** como destinos
- Targets de 56 px mínimo, tipografía 1.2× y un único botón de acción
- El mapa en estilo oscuro fijo, sin popups que obliguen a dos toques
- Los avisos de bajada se leen en voz alta con la Speech API del navegador
  (`speechSynthesis`, sin backend)

Se apoya en el semáforo de precios y en los push que ya existen, no pide nada
nuevo al backend.

### 3.2 Ruta inteligente: repostar de camino

**Problema**: la app te dice dónde está barato, no si te conviene según hacia
dónde vas. C4 ya calcula el ahorro por tanque, pero lo aplica a todas las
estaciones por igual.

**Propuesta**: junto al KPI de ahorro, añadir un "modo ruta":

- El usuario marca origen y destino (o deja que la app use su trayecto habitual
  de las últimas semanas, en el propio dispositivo)
- Se filtran las estaciones dentro de un corredor de ±2 km del trayecto
- Se ordena por **ahorro efectivo**: `ahorro €/tanque − desvío min × coste del tiempo`
- El resultado es un veredicto de una línea: *"En 12 min de desvío, E.Leclerc
  te ahorra 2,35 € por repostaje"*

No necesita geocodificador externo si se limita a carreteras conocidas del
dispositivo; se puede prototipar con el histórico fake y una polilínea fija.

### 3.3 Semáforo de tendencia y "ventana de compra"

**Problema**: la app ya calcula la variación a 7 días y C4 la convierte en un
"¿repostar hoy?", pero se queda en un color. Los datos del Ministerio tienen
30 días de historia y hoy solo se usan para la gráfica.

**Propuesta**: pasar de "¿repostar hoy?" a **"cuándo repostar"**:

- Calcular **percentil del precio actual** dentro de los últimos 30 días de esa
  estación: si está por debajo del percentil 25, es ventana de compra
- Alerta silenciosa (sin push, solo en la lista): badge **"⏳ Espera"** en
  estaciones al 80+ percentil y **"🟢 Ahora"** en las del 25−
- Añadir en el detalle una **línea de "precio objetivo"**: el precio al que la
  app te avisaría, ajustable por estación
- Combinable con los avisos push existentes (que ya detectan tendencia
  consecutiva), para no duplicar notificaciones

Es la mejora más barata de todas: reutiliza `js/history.js` y la gráfica que ya
existe, y solo añade un cálculo de percentil y dos badges.

---

## 4. Recomendación de combinación

Si hay que elegir una base para la nueva UI, la combinación que mejor cubre la
app actual con menos pérdida es:

| Pieza | De qué concepto | Por qué |
|---|---|---|
| Navegación inferior | **C1** (5 destinos) | Es la única que da destino propio a favoritas, IA y ajustes sin toasts |
| Detalle de estación | **C1/C2** (sheet con snaps) | Despega el detalle de la tabla sin perder el contexto del mapa |
| Layout escritorio | **C5** (3 columnas) | Aprovecha la pantalla ancha que hoy la app usa a medias |
| Comparador y KPIs | **C4** | Es lo que la app no tiene y lo que más valor da al usuario |
| Tema | **C3** | Tema oscuro reutilizable sobre cualquier concepto |
| Gestos | **C6** | Solo swipe y pull-to-refresh, no el modelo de tarjetas apiladas |

El modo conducción (3.1) y la ventana de compra (3.3) se pueden añadir encima de
cualquiera de ellos sin rehacer la interfaz.

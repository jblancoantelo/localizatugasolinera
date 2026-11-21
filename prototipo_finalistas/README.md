<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<!-- Copyright (C) 2026 Juan Blanco Antelo — Localiza tu Gasolinera -->
# Prototipo finalistas · la síntesis de los 7 talleres

Tres prototipos **funcionales** que recogen lo mejor de las 7 carpetas de
prototipos anteriores (`prototipos_opencode_*`, `prototipo_*`) y cubren las
**25 funciones de la app actual**. Los tres comparten datos, cálculos y
componentes; lo que cambia es el **flujo**, no lo que se puede hacer.

| # | Página | Shell | Para qué |
|---|--------|-------|----------|
| 01 | [`finalista-01-pulgar.html`](finalista-01-pulgar.html) | Móvil · una mano | Mapa a pantalla completa + hoja arrastrable con la lista y la ficha. Marcadores grandes, navegación al alcance del pulgar. |
| 02 | [`finalista-02-torre.html`](finalista-02-torre.html) | Escritorio · densidad | RaiL de filtros + KPIs, centro lista/mapa partido e inspector de ficha/insights. Nada se abre encima de nada. |
| 03 | [`finalista-03-una-app.html`](finalista-03-una-app.html) | Responsive · continuidad | Las pestañas **Mapa / Tabla / Ambos** de la app real, con el comparador, planificador, asistente, insights y paleta nuevos. |

Abre [`index.html`](index.html) para la galería con la matriz de paridad, los
patrones nuevos y qué se ha tomado de cada taller.

---

## Cómo abrirlo

- **Doble clic** en `index.html` o en cualquiera de los tres finalistas. No hace
  falta servidor: no hay módulos ES, ni fetch de datos, ni tiles externos.
- El mapa es **sintético y 100 % offline** (`assets/proto-map.js`): genera
  calles, río, parques y etiquetas con una semilla fija a partir de las
  coordenadas de las estaciones. No usa Leaflet ni red, así que las capturas y
  los precios son reproducibles.
- Los datos son ficticios: **29 estaciones de 5 provincias** (Madrid, Barcelona,
  Valencia, Sevilla y Zaragoza) y 6 combustibles. Están en
  `assets/proto-data.js` (`PROTO.STATIONS`).
- La IA es **simulada** (respuestas de ejemplo con latencia artificial). No hay
  claves ni peticiones reales: los 8 proveedores existen para validar la UI.

Si prefieres servirlo por HTTP:

```powershell
npx serve prototipo_finalistas
# o
python -m http.server 8080 --directory prototipo_finalistas
```

---

## Qué cubre (25/25 funciones de la app)

| Bloque | Funciones |
|--------|-----------|
| **Filtros y búsqueda** | provincia, localidad (con recálculo en cascada), combustible (6), marca (12, multiselección), distancia máxima 0–60 km, búsqueda por texto. |
| **Lista y mapa** | favoritos persistentes, orden por precio/distancia/valoración/actualización/descuento/marca/nombre, paginación y tamaño de página, mapa con pines y usuario, 10 estilos de mapa equivalentes, leyenda y escala de precios, estado vacío con recuperación de filtros. |
| **Detalle e histórico** | ficha con acciones (ruta, comparar, favorito, aviso), histórico con gráfica y tooltip, selector de días (7–180) y de combustible. |
| **Configuración** | descuentos por marca que mueven **todos** los precios, caché (simulada y visible), paginación por defecto, registro de actividad API/Push, notificaciones push (mock), claves cifradas (passphrase simulada), pestañas de IA ocultables, actualización de la app. |
| **IA** | chat General + 7 proveedores, editar, cancelar, borrar historial, catálogo de modelos simulado, contexto de la provincia y de las estaciones cargadas. |

Las tres shells marcan **✓** en las 25 filas de la matriz de `index.html`. La
validación automática comprueba el recorrido real en las tres.

## Los 6 patrones nuevos

| Patrón | De dónde sale | Qué aporta |
|--------|---------------|------------|
| **Comparador con coste real** | deepseek v7, bigpickle 5, mimov Radar | Ahorro neto = diferencia de precio − desvío de ida y vuelta − consumo. Veredicto en € y empate técnico cuando el desvío se come el ahorro. |
| **Planificador de depósito** | deepseek v8, bigpickle 9 | Previsión determinista de 7 días, nivel de depósito, autonomía y recomendación de cuándo repostar. |
| **Asistente guiado** | bigpickle 7, mimov Flow | Tres preguntas (uso, prioridad, autonomía) y una recomendación explicada, con opción de aplicarla como filtros. |
| **Insights de la zona** | bigpickle 8, mimov Cockpit | Mínimo, desvío que compensa, tendencia, favoritas, estaciones sin publicar y cobertura provincial, cada uno con acción. |
| **Modo conducción** | deepseek v6, bigpickle 4, musespark Volante | Precio gigante, estación actual, siguiente parada y contraste alto para usar de un vistazo. |
| **Paleta de comandos** | deepseek v4, bigpickle 6 | `Ctrl`/`Cmd` + `K` para ir a cualquier vista, cambiar tema, abrir comparador o planificador sin tocar el ratón. |

Además: tema claro/oscuro, filtros compartidos, favoritos,
comparador, planificador, asistente, tema y pestañas de IA ocultas se guardan en
`localStorage` (`gasolineras_finalistas_v1`) y sobreviven a un F5. No se guarda
nada en IndexedDB ni se toca la base de datos de la app real.

---

## Cómo está montado

```
prototipo_finalistas/
├── index.html                  Galería: matriz de paridad, patrones y validación
├── finalista-01-pulgar.html    Shell móvil
├── finalista-02-torre.html     Shell escritorio
├── finalista-03-una-app.html   Shell responsive
├── assets/
│   ├── proto.css               Componentes base (heredados del taller deepseek)
│   ├── proto-data.js           29 estaciones, 5 provincias, 6 combustibles, históricos
│   ├── proto-ui.js             Ficha, hoja, iconos, toasts, tema… (+ parche onAction)
│   ├── proto-map.js            Mapa sintético offline
│   ├── proto-chart.js          Gráficas de histórico y sparklines
│   ├── proto-features.js       Paneles de chat IA y configuración reutilizados
│   ├── finalist.css            Las tres shells + comparador, plan, asistente, insights
│   ├── finalist-core.js        Estado, filtros, cálculos, persistencia y comandos
│   └── finalist-ui.js          Pintado de las tres shells, paneles y eventos
├── _validar.mjs                Validador Playwright (móvil + escritorio + file://)
└── capturas/                   Capturas e informe.json de la última pasada
```

**Tres shells, un motor.** `finalist-core.js` no toca el DOM: calcula listas,
KPIs, comparador, previsión, recomendación e insights y persiste el estado.
`finalist-ui.js` decide qué se pinta y cómo se navega en cada shell. Los
componentes que ya funcionaban en los talleres (ficha, hoja, mapa, gráfica, chat
IA, configuración) se reutilizan en lugar de reescribirlos.

### Decisiones que conviene conocer

- **Capa compartida de deepseek v4.1** como base: era la única carpeta que ya
  cubría 25/25 funciones. Sobre ella se portaron los patrones del resto.
- **`proto-ui.js` parcheado**: `stationDetail` acepta `options.onAction(act, st)`
  y, si devuelve `true`, intercepta la acción. Así el comparador, la ruta, el
  aviso y el favorito de la ficha hablan con el estado del finalista sin
  duplicar la ficha.
- **Un solo dataset y un solo estado.** Cambiar un descuento en Config cambia el
  precio de la lista, del mapa, de la tabla, del comparador y del plan. No hay
  cifras "de adorno".
- **La hoja del pulgar** usa las snapshots `peek / half / full` del componente
  `Proto.sheet`; la nav va por encima (`z-index: 60`) y el cuerpo reserva su
  altura para que la última tarjeta nunca quede tapada.
- **La torre** usa tres columnas con scroll independiente. Por debajo de 1180 px
  la ficha se abre en hoja; por debajo de 860 px desaparecen raíl e inspector y
  aparecen una nav inferior y una tira de filtros.
- **La shell unificada** conserva las pestañas de la app real. En móvil la
  toolbar se convierte en una tira horizontal con scroll (como la app); en
  escritorio se reparte en una fila y la nav inferior se mantiene visible.
- **Persistencia**: `localStorage` con la clave `gasolineras_finalistas_v1`.
  `FinalistCore.reset()` vuelve al estado de fábrica (Madrid, diésel, 6
  favoritas) y borra la clave. El tema vive aparte (`proto_theme`).
- **Mapas**: se recrean si su contenedor se ha desconectado (cambio de pestaña o
  de panel), para que un mapa cacheado no quede en un host muerto.

---

## Validación

```powershell
cd prototipo_finalistas
node _validar.mjs
```

El validador:

- levanta un servidor HTTP local y recorre **las tres shells** a **390×844** y
  **1440×900**;
- comprueba arranque, consola limpia, lista/tabla, filtros de provincia y
  combustible, estilos de mapa, ficha, gráfica, favorito, comparador (y
  recálculo de litros), planificador (7 días y depósito), asistente (3 pasos),
  configuración (8 tarjetas y descuentos), chat IA (General + 7), insights,
  paleta, tema, modo conducción, persistencia tras recarga y restauración de la
  provincia;
- abre además `finalista-01-pulgar.html` por **`file://`** para garantizar el
  doble clic sin servidor;
- guarda capturas en `capturas/` e `informe.json`, y sale con código 1 si algo
  falla.

**Última pasada: 176/176 comprobaciones OK** (29 por shell y viewport + 2 de
`file://`). El informe con el detalle está en `capturas/informe.json`.

---

## Qué se ha tomado de cada taller

| Carpeta | Páginas | Aporte |
|---------|---------|--------|
| `prototipos_opencode_deepseekv4.1flashfree` | 8 | Capa compartida, comparador con veredicto y desvío, previsión y modo conducción. |
| `prototipo_nvidia_nemotron_3.5_super_v1_free` | 10 | Lectura móvil de una mano, respeto de safe areas y jerarquía de hoja arrastrable. |
| `prototipos_opencode_bigpickle` | 11 | Sala de control de 3 columnas, asistente por pasos, insights y atajos. |
| `prototipos_opencode_glm_5.3_flashfree` | 8 | Portada-galería, biblioteca de componentes y validación en dos viewports. |
| `prototipos_opencode_mimov_2.6_flashfree` | 6 | Cockpit como referencia de densidad y Radar como antecedente del comparador. |
| `prototipos_opencode_musespark_1.3_free` | 6 | Modo conducción con tipografía gigante y contraste alto. |
| `prototipos_opencode_nemotron_3.5_super_v1_free` | 8 | Responsive y datos ficticios coherentes; la idea de que el mismo esqueleto sirva en móvil y PC. |

Ninguna carpeta se descarta: la capa base es deepseek porque ya cubría las 25
funciones, y encima se injertaron los patrones que cada taller resolvía mejor.
El detalle de qué patrón sale de qué página está en `index.html`.

---

## Límites

- Datos, precios, históricos, geocoding y mapa son **ficticios**. No se llama a
  la API del Ministerio ni a ningún backend.
- La IA no hace peticiones: las respuestas son plantillas deterministas para
  probar estados de carga, error, cancelación y edición.
- El push y la caché son **mocks visuales**; no registran Service Worker.
- Este prototipo **no** se registra en `sw.js`, `manifest.json` ni `ASSETS`, y no
  entra en la suite de la app real.
- Probado en Chromium (Playwright). No se han verificado Safari/Firefox.

---

**Localiza tu Gasolinera** · prototipos de diseño · datos ficticios ·
`AGPL-3.0-only` · © 2026 Juan Blanco Antelo.

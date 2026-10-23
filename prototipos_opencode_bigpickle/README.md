# Prototipos de rediseño — Gasolineras (Big_pickle)

Carpeta de trabajo con **prototipos de rediseño responsive** de la PWA de
gasolineras. No forman parte de la aplicación: son maquetas interactivas con
datos simulados, pensadas para *discutir y validar* la interfaz y la navegación
antes de tocar la app real.

- **Objetivo 1 (móvil):** resolver los problemas del diseño actual (toolbar
  saturada con 12 controles diminutos, textos de 0.6 rem, leyenda y pestañas
  apretadas).
- **Objetivo 2 (PC):** aprovechar de verdad las pantallas grandes en vez de
  estirar la maqueta de móvil.

> Todo funciona **abriendo los HTML directamente** (`file://`): sin módulos ES,
> sin CDN, sin servidor y sin `build`. Los iconos son SVG inline y el mapa es un
> SVG/CSS dibujado a mano (no hay Leaflet).

---

## Cómo abrirlo

1. Abre `prototipos_opencode_bigpickle/index.html` (índice con capturas y enlaces).
2. O entra directamente en la carpeta de cualquier prototipo y abre su
   `index.html`.
3. Arrastra el borde de la ventana (o usa el DevTools) para ver el salto
   móvil ⇄ escritorio: todos los prototipos se reorganizan a partir de ~1000 px.

---

## Índice de prototipos

| # | Carpeta | Concepto | Enfoque |
|---|---------|----------|---------|
| 1 | `prototipo1-mapa-hojas/` | **Mapa + hojas** | Móvil primero: el mapa manda y la lista vive en una hoja inferior arrastrable (peek / medio / lleno). En PC la hoja pasa a panel lateral. |
| 2 | `prototipo2-escritorio-sala-de-control/` | **Sala de control** | Escritorio primero: tres columnas (mapa · lista densa · detalle) con tarjetas de resumen, sparklines y tabla. Pensado para usar 1440 px sin desperdicio. |
| 3 | `prototipo3-lista-tarjetas/` | **Lista primero** | La lista es la protagonista: tarjetas grandes con precio destacado, grupos pegajosos por localidad y filtros en hojas. El mapa es secundario. |
| 4 | `prototipo4-modo-noche-conduccion/` | **Modo noche / conducción** | Interfaz oscura de alto contraste, letra enorme y tres acciones (Ir · Favorito · Salir). Para usar de noche o en el coche, con un carrusel de estaciones cercanas. |
| 5 | `prototipo5-split-comparador/` | **Split sincronizado + comparador** | Lista y mapa sincronizados (al pasar el ratón por una fila se resalta su marcador) y un comparador de 2–4 estaciones con gráfica solapada. |
| 6 | `prototipo6-gestos-atajos/` | **Gestos y atajos** | Navegación sin chrome: en móvil con gestos (swipe entre vistas, deslizar tarjeta, long-press, pull-to-refresh) y en PC con paleta de comandos (⌘K) y atajos de teclado (`j`/`k`, `/`, `?`, `1`–`5`). |
| 7 | `prototipo7-asistente-decisiones/` | **Asistente por decisiones** | Móvil primero, una decisión por pantalla: «¿Qué necesitas?» → *Repostar barato ahora* / *Ahorrar en mi ruta* / *Vigilar una estación*, con recomendación final accionable. |
| 8 | `prototipo8-panel-de-datos/` | **Panel de datos / analítica** | Escritorio: KPIs, evolución de la media provincial, mapa de calor por provincia, histograma de precios, ranking de marcas, comparador y «¿cuándo repostar?». Para entender el mercado. |

Cada prototipo es **funcional de verdad** con datos fake: filtrar, ordenar,
buscar, abrir detalle con histórico (canvas/SVG con tooltip), chat IA por
proveedor con markdown, favoritos, comparador y configuración operativa.

---

## Pasadas de diseño

- **Pasada 1 — exploración amplia (prototipos 1–4).** Cuatro direcciones bien
  distintas (móvil primero, escritorio primero, lista primero y modo oscuro).
  Se construyó el 1 como referencia de calidad y 2–4 en paralelo con el mismo
  contrato de datos.
- **Pasada 2 — profundidad (prototipo 5).** Se añaden dos ideas que faltaban:
  *sincronía* entre lista y mapa y *comparación* de estaciones.
- **Pasada 3 — interacción (prototipo 6).** Se lleva el chrome al mínimo y se
  exploran los gestos y el teclado como forma principal de navegar.
- **Pasada 4 — nuevos paradigmas (prototipos 7 y 8).** Se cubren los dos
  enfoques que faltaban: *guiar* al usuario por decisiones (7) y *analizar* los
  datos (8).
- **Pasada 5 — depurado cruzado.** Auditoría automática de los 8 prototipos
  (desbordes, objetivos táctiles, tipografía, contraste, solapamientos de
  navegación) y corrección de todo lo detectado; ajustes de accesibilidad
  (texto ≥ 12 px, *tap targets* ≥ 32 px, contraste AA) aplicados a todos.
- **Pasada 6 — renombrado y colisión de selectores.** La carpeta pasa a
  `prototipos_opencode_bigpickle` para alinearla con las carpetas
  `prototipos_opencode_*` de los demás modelos. Además se corrige la causa
  real de los 3 avisos de «navegación tapada» que quedaban en el prototipo 6:
  el selector `.aviso` del toast (con `position: fixed; z-index: 200`)
  coincidía con las etiquetas de descuento `.etiqueta.aviso` de las tarjetas,
  que heredaban el posicionamiento fijo y salían de su hoja a tapar el
  indicador del carril. El toast ahora se estiliza por id (`#aviso`) en los
  tres prototipos que mezclan ambas clases (1, 6 y 7). Auditoría final:
  **0 avisos en móvil y PC en los 8**.

---

## Qué validar en cada prototipo

- **1 · Mapa + hojas:** ¿la hoja de lista se siente natural en móvil? ¿molesta
  tener los filtros detrás de chips? ¿el panel lateral de PC aprovecha el ancho?
  ¿se entiende el histórico con tooltip?
- **2 · Sala de control:** ¿se puede trabajar de verdad con 3 columnas sin
  perderse? ¿la densidad de la tabla es legible o agobia? ¿las sparklines ayudan
  a decidir? ¿el móvil degrada con elegancia?
- **3 · Lista primero:** ¿encontrar la gasolinera es más rápido que en el mapa?
  ¿las tarjetas tienen demasiada información? ¿los grupos por localidad ayudan
  o estorban?
- **4 · Modo noche / conducción:** ¿se lee a un vistazo de noche? ¿el precio
  gigante es suficiente para decidir sin soltar el volante? ¿el carrusel de
  cercanas ordena bien (barato primero)?
- **5 · Split + comparador:** ¿la sincronía lista↔mapa es intuitiva? ¿comparar
  2–4 estaciones resulta útil? ¿el divisor arrastrable es descubrible?
- **6 · Gestos y atajos:** ¿los gestos se descubren solos o hacen falta pistas?
  ¿la paleta de comandos (⌘K) acelera de verdad en PC? ¿los atajos (`j`/`k`,
  `/`, `?`) merecen la pena?
- **7 · Asistente por decisiones:** ¿decidir paso a paso es más rápido que
  escanear una lista? ¿el asistente «piensa» por el usuario o lo limita? ¿el
  resultado final da confianza?
- **8 · Panel de datos:** ¿los gráficos aportan o abruman? ¿qué KPIs se usan de
  verdad? ¿el móvil soporta tanta densidad?

---

## Estructura

```
prototipos_opencode_bigpickle/
├─ index.html              ← índice visual con capturas y enlaces
├─ README.md               ← este documento
├─ shared/datos-fake.js    ← contrato de datos común a los 8 prototipos
├─ capturar.mjs            ← smoke test + capturas (móvil y PC)
├─ auditar.mjs             ← auditoría de diseño → shared/informes/*.md
├─ shared/
│  ├─ datos-fake.js        ← 37 estaciones, 16 provincias, histórico, chats, logs…
│  ├─ capturas/            ← PNG generados por capturar.mjs
│  └─ informes/            ← informes Markdown de auditar.mjs
└─ prototipo1..8-…/        ← cada prototipo (index.html + estilo.css + app.js)
```

### Datos compartidos (`shared/datos-fake.js`)

Un único script clásico expone `window.FAKE` como **contrato común** para los 8
prototipos, de modo que todos muestran exactamente los mismos precios:

- `FAKE.estaciones` — 37 estaciones en 16 provincias (Madrid 14, Barcelona 5,
  Valencia 4…), con `precios{}` por combustible, `dist`, `fav`, `horario` y
  `mx`/`my` (posición en % en el mapa fake).
- `FAKE.historico(id, combustible, días)` — serie **determinista** (semilla por
  estación+combustible) del histórico, más reciente al final. La misma llamada
  devuelve siempre lo mismo, así las 8 maquetas cuadran entre sí.
- `FAKE.chatsIA`, `FAKE.prompts`, `FAKE.logApi`, `FAKE.logPush`, `FAKE.config`,
  `FAKE.cacheInfo`, `FAKE.versionApp`.
- Helpers: `provinciaNombre`, `estacionesDe`, `localidadesDe`, `marcasDe`,
  `precioDe`, `precioConDescuento`, `colorPrecio`, `mediaProvincia`,
  `masBarata`, `kmh`, `eur`.

Las fechas del histórico son `dd-mm-aaaa` (como en la API real del Ministerio).

---

## Herramientas de validación

Como este trabajo se revisa sin poder *ver* las capturas, la validación es
**medible desde el navegador**:

```powershell
# 1. Smoke test + capturas (móvil 390×844 y PC 1440×900)
node prototipos_opencode_bigpickle/capturar.mjs        # todos
node prototipos_opencode_bigpickle/capturar.mjs 1 6    # solo algunos

# 2. Auditoría de diseño → shared/informes/<prototipo>.md
node prototipos_opencode_bigpickle/auditar.mjs
```

`capturar.mjs` abre cada prototipo por `file://`, guarda capturas y **falla si
hay errores de consola**; además usa los marcadores de captura:

- `[data-shot="detalle"]` — primer elemento que abre el detalle de una estación.
- `[data-shot="vista"]` — elemento que cambia de vista principal.

`auditar.mjs` mide en móvil y en PC:

1. Desbordamiento horizontal de la página.
2. Objetivos táctiles < 32 px (aviso por debajo de 44).
3. Tipografía visible < 12 px.
4. Contraste de texto (WCAG AA: 4.5:1, grande 3:1).
5. Frases sospechosas (`undefined`, `NaN`, `[object Object]`).
6. Botones de navegación tapados por otras capas.
7. Nº de destinos de navegación (`data-vista`, `data-tab`, `data-iaprov`,
   `data-seccion` o `data-destino`).

**Objetivo: 0 avisos** en móvil y en PC en todos los prototipos.

---

## Decisiones transversales

- **Tokens y coherencia.** Cada prototipo define color, radios, sombras y
  alturas en `:root`. Paleta semántica del precio reutilizada en marcadores,
  tarjetas, tabla y leyenda: verde < 1,50 € ≤ ámbar < 1,70 € ≤ rojo.
- **Accesibilidad como requisito, no como extra.** Base 15–16 px, ningún texto
  visible < 12 px, *tap targets* ≥ 32 px (44 en acciones principales) y
  contraste AA. Para texto sobre tintes claros se usan tonos oscuros
  (`#146b3c` sobre `#e6f6ec`, `#1458ba` sobre `#e8f0fe`…).
- **Mapa sin dependencias.** Fondo SVG generado desde `FAKE.mapa` (viales,
  manchas, agua) y marcadores-precio posicionados en `mx`/`my` (%).
- **Navegación con 5 destinos** (Mapa · Lista/Ambos · IA · Config…) usando
  `data-vista` / `data-iaprov`, para que el auditor pueda contarlos.
- **Hojas inferiores (bottom sheets).** Lección aprendida: la caja de una hoja
  debe tener el **tamaño real visible** (`height` + clase `.abierta`) y nunca
  colgarse de `transform: translateY(calc(100dvh - X))`, porque la caja se
  extiende por debajo del viewport y bloquea los clics de la barra inferior.
- **Histórico dibujado a mano** (canvas o SVG) con tooltip de precio + fecha,
  respetando `devicePixelRatio`.
- **Chat IA con markdown mínimo** que escapa HTML antes de pintar y añade la
  marca de agua `⏱ modelo · tiempo` en cada respuesta.

---

## Comandos

```powershell
node prototipos_opencode_bigpickle/capturar.mjs           # smoke test + capturas
node prototipos_opencode_bigpickle/auditar.mjs            # auditoría de diseño
node check-syntax.mjs                            # sintaxis de todo el JS del repo
```

> Los prototipos **no** se integran en la app: nada de esto toca `index.html`,
> `js/`, `css/`, `sw.js` ni el manifest de la raíz del proyecto.

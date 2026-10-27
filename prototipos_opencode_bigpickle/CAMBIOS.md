# Cambios hechos y pendientes · prototipos Big_pickle

Estado del trabajo de la carpeta `prototipos_opencode_bigpickle/`.
Última actualización: **27/10/2026** (rama `newUI`).

> Este documento es el **registro de trabajo** de la carpeta de prototipos. No
> forma parte de la documentación de la app (`README.md`, `docs/`, `AGENTS.md`
> de la raíz) y no la modifica.

---

## 1. Resumen

| Dato | Valor |
|------|-------|
| Prototipos | **8** (7 conceptos + variantes de interacción) |
| Ficheros por prototipo | `index.html`, `estilo.css`, `app.js` (sin build, sin CDN, `file://`) |
| Datos | `shared/datos-fake.js` → `window.FAKE` (determinista) |
| Auditoría de diseño | **0 avisos** en móvil 390×844 y PC 1440×900 en los 8 |
| Smoke test (`capturar.mjs`) | **8/8 sin errores de consola** |
| Capturas | `shared/capturas/*.png` (móvil, móvil-detalle, móvil-vista, PC) |
| Informes | `shared/informes/*.md` (generados por `auditar.mjs`) |
| Paridad funcional con la app real | **en verificación** (ver §6) |
| Nuevo prototipo (9) | **pendiente** (ver §7) |

---

## 2. Qué se ha hecho

### 2.1 Los 8 prototipos

Cada uno explora una dirección de diseño distinta, con el mismo contrato de
datos para que se puedan comparar precios entre ellos:

| # | Carpeta | Concepto | Enfoque |
|---|---------|----------|---------|
| 1 | `prototipo1-mapa-hojas/` | **Mapa + hojas** | Móvil primero: mapa protagonista y lista en hoja inferior arrastrable (peek / medio / lleno). En PC la hoja pasa a panel lateral. |
| 2 | `prototipo2-escritorio-sala-de-control/` | **Sala de control** | Escritorio primero: rail + 3 columnas (mapa · lista densa · detalle), tarjetas de resumen, sparklines y tabla paginada. |
| 3 | `prototipo3-lista-tarjetas/` | **Lista primero** | Tarjetas grandes con precio destacado, grupos pegajosos por localidad y filtros en hojas. El mapa es secundario. |
| 4 | `prototipo4-modo-noche-conduccion/` | **Modo noche / conducción** | Tema oscuro de alto contraste, tipografía grande, tres acciones (Ir · Favorito · Salir) y carrusel de cercanas. |
| 5 | `prototipo5-split-comparador/` | **Split + comparador** | Lista y mapa sincronizados (hover de fila resalta marcador) + comparador de 2–4 estaciones con gráfica solapada. |
| 6 | `prototipo6-gestos-atajos/` | **Gestos y atajos** | Sin chrome: swipe entre vistas, deslizar tarjeta, long-press, pull-to-refresh; en PC paleta de comandos (⌘K) y atajos `j`/`k`, `/`, `?`, `1`–`5`. |
| 7 | `prototipo7-asistente-decisiones/` | **Asistente por decisiones** | Una decisión por pantalla: «¿Qué necesitas?» → repostar barato / ahorrar en ruta / vigilar estación, con recomendación accionable. |
| 8 | `prototipo8-panel-de-datos/` | **Panel de datos** | KPIs, evolución de la media, mapa de calor, histograma, ranking de marcas, comparador y «¿cuándo repostar?». |

### 2.2 Datos fake compartidos

- `shared/datos-fake.js` expone `window.FAKE` como contrato único: 37
  estaciones en 16 provincias, precios por combustible, histórico determinista
  (`FAKE.historico(id, combustible, días)`), chats IA, prompts, logs de API y
  push, configuración, caché y versión.
- Fechas de histórico en `dd-mm-aaaa` (igual que la API del Ministerio).
- Helpers: `provinciaNombre`, `estacionesDe`, `localidadesDe`, `marcasDe`,
  `precioDe`, `precioConDescuento`, `colorPrecio`, `mediaProvincia`,
  `masBarata`, `kmh`, `eur`.
- Al ser determinista, las capturas y los precios cuadran entre prototipos.

### 2.3 Herramientas de validación

- `capturar.mjs` — abre cada prototipo por `file://` en móvil y PC, guarda
  capturas y **falla si hay errores de consola**. Usa los marcadores
  `[data-shot="detalle"]` y `[data-shot="vista"]`.
- `auditar.mjs` — mide en móvil (390×844) y PC (1440×900): desbordamiento
  horizontal, *tap targets* < 32 px, textos < 12 px, contraste AA, frases
  sospechosas (`undefined`, `NaN`, `[object Object]`), navegación tapada y
  número de destinos. Escribe `shared/informes/<prototipo>.md`.

### 2.4 Correcciones de accesibilidad (todas cerradas)

- **Pasada 5**: auditoría cruzada de los 8 y corrección de lo detectado.
  Criterios: texto ≥ 12 px, *tap targets* ≥ 32 px, contraste AA real (no solo
  declarado).
- Colisión de clases del toast: `.aviso` (toast `position: fixed`) coincidía
  con `.etiqueta.aviso` de las tarjetas y tapaba la barra inferior en 1, 6 y 7.
  Se estiliza por `#aviso` en esos tres.
- **Esta sesión — prototipo 2 (96 → 0 avisos).** La última revisión de otra
  sesión dejó el 2 con 96 avisos (30 *tap targets*, 13 textos de 11 px y 19
  contrastes en móvil; 28/14/19 en PC). Corregido:
  - Marcadores-precio: `padding` vertical 3 → 5 px (alto real 28 → 32 px).
  - Colores propios del marcador, más oscuros que los semánticos de texto,
    para que el precio en blanco cumpla AA: `#157a35`, `#a04a00`, `#b3261e`,
    `#5a6b7c`.
  - Tokens de texto oscurecidos: `--verde` `#1e8e3e` → `#146b3c`,
    `--naranja` `#e8710a` → `#9a4b00`, `--rojo` `#d93025` → `#c5221f`,
    `--gris` `#8a97a4` → `#5a6b7c`.
  - `small` global a 0,75 rem (el navegador lo dejaba en 11,67 px) y todos los
    `0.6875rem` a `0.75rem`.
  - `.fav-btn` de 20×20 a mínimo 32×32 (`display: grid; place-items: center`).
  - Paginación `◀ ▶`: `min-width: 32px; flex: 0 0 auto` (el flex la encogía a
    27 px).
  - Badges: `.icono-btn-badge` con tinta oscura sobre ámbar, `.chip-badge` y
    `.insignia-barata` sobre fondos oscuros, `.chip-estado.ok/.warn/.err` con
    los tonos oscuros documentados.
  - **Bug de especificidad**: `.tarjeta-precio span` pisaba el color de
    `.precio-dto`, que nunca llegaba a verse en verde. Ahora
    `.tarjeta-precio > span:not(.precio-dto)`.

  Resultado: `auditar.mjs 2` → **0 avisos** en móvil y PC.

### 2.5 Bugs funcionales corregidos

- **`closest('[data-vista]')`** en los prototipos 1, 7 y 8: las secciones
  también llevan `data-vista`, así que el `closest` devolvía la sección en vez
  del botón y **rompía todos los clics internos**. Ahora
  `closest('button[data-vista], a[data-vista]')`.
- **Prototipo 6**: `.aviso` del toast heredado por las etiquetas de descuento
  (ver §2.4).
- **Prototipo 2**: el detalle y los filtros se abren con `data-accion`
  (`abrir-detalle`, `vista`, `favorito`, `ordenar`, `pagina`) en vez de
  `data-shot`/`data-vista`.

### 2.6 Renombrado

- La carpeta pasó de `prototipos_bigpickle/` a
  `prototipos_opencode_bigpickle/` para alinearla con el resto de carpetas
  `prototipos_opencode_*`. Se versionó en `6fb4e42`.

---

## 3. Estado actual verificado (27/10/2026)

Comandos ejecutados y resultado real:

```powershell
node prototipos_opencode_bigpickle/auditar.mjs    # 0 avisos totales
node prototipos_opencode_bigpickle/capturar.mjs   # 8/8 sin errores de consola
```

| # | Prototipo | Vistas principales | Detalle con histórico | Auditoría |
|---|-----------|--------------------|-----------------------|-----------|
| 1 | Mapa + hojas | mapa · lista · ambos · IA · config | canvas pintado + combos combustible/días | 0 |
| 2 | Sala de control | mapa · datos · dual · IA · config | panel con sparklines + histórico | 0 |
| 3 | Lista primero | lista · mapa · IA (8 pestañas) · ajustes | panel con gráfica + histórico | 0 |
| 4 | Modo noche | mapa · lista · favoritas · IA · ajustes | diálogo con histórico | 0 |
| 5 | Split + comparador | lista · mapa · IA (8 paneles) · config | panel con gráfica + comparador | 0 |
| 6 | Gestos y atajos | mapa · lista · ambos · IA · config + paleta | canvas pintado + combos | 0 |
| 7 | Asistente | inicio · explorar · mapa · IA · config | canvas pintado + combos | 0 |
| 8 | Panel de datos | panel · estaciones · mapa · IA · config | ficha con 3 canvas + combos | 0 |

Verificado además con `capturar.mjs`: **el detalle se abre en 7 de los 8**
(el 2 no lleva `data-shot="detalle"`, no es un fallo funcional) y el cambio de
vista funciona en todos.

---

## 4. Pendiente (checklist)

### 4.1 Verificación funcional (en curso)

- [x] Auditoría de diseño a 0 en los 8.
- [x] Smoke test sin errores de consola en los 8.
- [x] El detalle abre y el canvas histórico se pinta (1, 5, 6, 7, 8).
- [ ] Confirmar histórico pintado en 2, 3 y 4 tras abrir su pestaña de
      histórico (el canvas se crea al cambiar de pestaña, no al abrir).
- [ ] Filtros provincia / localidad / combustible / marca / solo favoritos:
      comprobar reacción en cada prototipo (los que usan `<select>` responden;
      1 y 6 usan chips y hojas, hay que validarlos por su UI).
- [ ] Búsqueda de texto en los 8.
- [ ] Orden asc/desc y paginación (2, 3, 4, 5, 8).
- [ ] Favoritos: alta, baja y «solo favoritos» (7 y 8 exponen el control en la
      ficha; hay que confirmar el cambio de estado).
- [ ] Descuentos por marca aplicados al precio mostrado (todos).
- [ ] IA: envío + respuesta simulada + markdown + marca de agua
      (`⏱ proveedor · modelo · tiempo`) + historial por proveedor + borrar.
      Confirmado en 1, 3, 4, 5, 6, 8. **Pendiente 2 y 7.**
- [ ] Tooltip de la gráfica al pasar el ratón (1, 5, 6, 8 como mínimo).
- [ ] Config operativa: paginación, caché (IndexedDB/localStorage), logs
      API/push, push, claves IA, visibilidad de pestañas IA, versión.
      Presencia de las 6 secciones confirmada en 1, 2, 4, 5, 6, 8; 3 necesita
      abrir «Ajustes» por texto; 7 no muestra el bloque de claves.
- [ ] Estados vacíos y sin resultados en cada prototipo.

### 4.2 Mejoras pendientes de la carpeta

- [ ] `data-shot="detalle"` en el prototipo 2 para que `capturar.mjs` guarde su
      captura de detalle como los demás.
- [ ] Script de verificación funcional reutilizable
      (`verificar.mjs`) que devuelva una matriz PASS/FAIL por prototipo,
      para no repetir la comprobación a mano en cada cambio.
- [ ] Actualizar `shared/informes/*.md` y `shared/capturas/*.png` tras cada
      cambio (ya se regeneran con los dos comandos de §3).

---

## 5. Cómo retomar

```powershell
# 1. Auditoría de diseño (escribe shared/informes/)
node prototipos_opencode_bigpickle/auditar.mjs

# 2. Smoke test + capturas (falla si hay errores de consola)
node prototipos_opencode_bigpickle/capturar.mjs

# 3. Un prototipo suelto
node prototipos_opencode_bigpickle/auditar.mjs 2
node prototipos_opencode_bigpickle/capturar.mjs 2

# 4. Sintaxis de un app.js concreto (check-syntax.mjs NO cubre prototipos)
node --check prototipos_opencode_bigpickle/prototipo4-modo-noche-conduccion/app.js
```

---

## 6. Paridad con la funcionalidad actual de la app

Funcionalidades de la app real que un rediseño debe seguir cubriendo. La
columna «estado» se completa con la verificación de §4.1.

| # | Funcionalidad actual | Dónde se prueba | Estado |
|---|----------------------|-----------------|--------|
| 1 | Filtro por provincia | chips/hoja (1, 6), `<select>` (2–5, 7, 8) | en curso |
| 2 | Filtro por localidad | `<select>` (3, 4, 5, 8) | en curso |
| 3 | Filtro por combustible | `<select>` / chips en todos | en curso |
| 4 | Filtro por marca (multiselección) | desplegable de marcas (2, 3, 5) | en curso |
| 5 | Búsqueda de texto | caja de búsqueda en todos | en curso |
| 6 | Solo favoritos | casilla / chip (3, 4, 5) | en curso |
| 7 | Ordenar (precio, distancia, nombre) | `<select>`/cabeceras (2–5, 8) | en curso |
| 8 | Paginación configurable | 2, 3, 4, 5, 8 | en curso |
| 9 | Vista mapa / lista / ambos | todos (concepto propio) | en curso |
| 10 | Mapa: marcador-precio con color semántico | todos | en curso |
| 11 | Mapa: tipos de mapa (claro/oscuro/satélite) | 2, 4, 5, 6, 8 | en curso |
| 12 | Mapa: leyenda de precios | todos | en curso |
| 13 | Mapa: popup con detalle e histórico | 5, 8 (y hojas en 1/6) | en curso |
| 14 | Tabla: columnas marca/precio/distancia/localidad/calle | 1, 2, 3, 5, 6 | en curso |
| 15 | Detalle de estación (dirección, horario, teléfono, precios) | todos | en curso |
| 16 | Histórico con gráfica y tooltip | 1, 2, 3, 4, 5, 6, 7, 8 | en curso |
| 17 | Histórico: selector de combustible y de días | 1–8 | en curso |
| 18 | Favoritos (alta/baja) | todos | en curso |
| 19 | Descuentos por marca | todos | en curso |
| 20 | Chat IA por proveedor (7 + General) | 1, 3, 4, 5, 6, 7, 8 | en curso |
| 21 | IA: markdown escapado + marca de agua | 1, 3, 5, 6, 8 | en curso |
| 22 | IA: historial por proveedor y borrar | 3, 4, 5 | en curso |
| 23 | Config: caché (IndexedDB/localStorage) | 1–6, 8 | en curso |
| 24 | Config: paginación, logs API/push, push, claves IA, versión | 1–6, 8 | en curso |
| 25 | Persistencia del estado (recarga) | por confirmar en cada uno | en curso |
| 26 | Gestos (móvil) y atajos de teclado (PC) | 6 (concepto), apoyo en 1 y 7 | en curso |
| 27 | Accesibilidad AA (texto, *tap*, contraste) | los 8, medido | **hecho** |

---

## 7. Prototipo 9 (propuesta nueva)

Pendiente de implementar. La idea es cubrir el hueco que no exploran los 8
actuales: **un único lienzo con la decisión delante** — el usuario no elige
entre «mapa» o «lista», sino que ve **una recomendación razonada** (la mejor
opción ahora mismo, con el porqué y el ahorro estimado) y, debajo, la
alternativa siguiente; el mapa y la tabla quedan como *capas* del mismo
lienzo. Se detallará en `prototipo9-.../` y se enlazará desde `index.html` y
este README.

---

## 8. Reglas de la carpeta

- Nada de lo que hay aquí se integra en la app: no se toca `index.html`, `js/`,
  `css/`, `sw.js`, el manifest ni `docs/` de la raíz.
- Todo abre por `file://`, sin módulos ES, sin CDN y sin build.
- Los datos salen siempre de `shared/datos-fake.js` (no inventar precios
  dentro de un prototipo).
- Los informes y capturas se regeneran con `auditar.mjs` y `capturar.mjs`; no
  se editan a mano.
- Objetivo de calidad: **0 avisos** de auditoría en móvil y PC.

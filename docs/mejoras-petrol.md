# Mejoras realizadas — Precios Gasolina España

## 2026-07-22 — Lupa search toggle + responsive

### Filtro de búsqueda con lupa (🔍)
- El input de texto (`#search`) ya no se muestra siempre en el toolbar
- Se añadió un botón 🔍 en el grupo de filtro Mapa, con un separador vertical (`<span class="filter-sep">`) entre el selector de tipo de mapa y la lupa
- Al hacer clic en 🔍 se muestra/oculta la fila de búsqueda, con auto-foco en el input
- La fila empieza oculta (clase `.hide`)
- Al resetear filtros (✕) también se oculta la búsqueda

### Responsive — mejor aprovechamiento del espacio
- **≤1024px**: El grupo de leyenda de precios ya no fuerza una fila completa (`flex: 1 0 100%` → `flex: 0 1 auto`), ahora se acopla al lado de otros grupos. Min-width de filtros reducido de 100px a 80px.
- **≤768px**: Min-width a 55px, padding/gaps mínimos, leyenda de precios más pequeña (`0.6rem`), separador vertical oculto.
- **≤480px**: Min-width a 40px, selects/inputs más angostos (`max-width: 65px`), se oculta el rango medio de la leyenda (solo可见 verde y rojo).

### Tests
- 63 tests (56 HTTP + 7 file://), todos pasando.
- Tests de búsqueda actualizados: ahora hacen clic en 🔍 antes de verificar visibilidad del input.

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `index.html` | 🔍 + `.filter-sep` en grupo Mapa; search row oculto por defecto |
| `css/styles.css` | `.filter-sep`, `.search-row.hide`, responsive tuning |
| `js/main.js` | Toggle search row; reset oculta search row |
| `docs/test/full_test.mjs` | Click 🔍 antes de check input |
| `docs/test/validate.mjs` | Click 🔍 antes de check input |
| `AGENTS.md` | Sección search toggle, orden toolbar actualizado |

---

## 2026-07-18 — Logs API/Push con tabs y registro detallado

### Registro de actividad (tabs API/Push)
- Nueva tarjeta "Registro de actividad" en Config con tabs `.config-log-tab` (API/Push).
- `initLogTabs()` en `storage.js` maneja el cambio entre tabs.
- **API**: `API_LOG[]` en `api.js`, render en `#apiLogEntries`, máximo 30 entradas, botón de borrado.
- **Push**: `PUSH_LOG[]` en `push-notifications.js`, render en `#pushLogEntries`, máximo 30 entradas, botón de borrado.
- Timestamps con `formatLogTime()` (`dd/mm/yy hh:mm:ss`).

### Push Log — registro detallado
- `logPushEvent()` / `renderPushLog()` / `clearPushLog()` en `push-notifications.js`.
- Instrumentadas todas las funciones push con logs.
- SW envía eventos al cliente via `postMessage({type:'push-log',...})` + `sendPushLog()` en `sw.js`.

---

## 2026-07-17 — Push Notifications SW-Based + Tests

### Arquitectura
- Toda la lógica de chequeo de precios corre en el Service Worker.
- `checkPrices()` en `sw.js` con fetch directo a API + comparación + notificación.
- `db.js` compartido entre cliente y SW (IndexedDB stores: cache, favorites, config).
- `comparePrices()` como función pura en `helpers.js`.

### Suscripción
- Botón 🔔 en toolbar → `subscribeUserToPush()`.
- Periodic Background Sync (Android) con `setInterval` fallback (escritorio).
- Config push sincronizada a IndexedDB store `config` para acceso del SW.

### Notificaciones
- Click en notificación → URL matching corregido → abre app + detalle estación.

### Tests
- Tests 14.1–14.10 integrados en `full_test.mjs`.
- Eliminados archivos obsoletos: `plan-push.md`, `.env`, debug tests.

---

## 2026-07-11 — Code Review + Push Notifications

### Bugs corregidos
- `checkFavoritePrices()`: TypeError al mostrar notificación fuera del SW.
- Comparación incorrecta de precios (usaba oldestPrice vs latestPrice en vez de currentPrice vs oldestPrice).
- Código muerto (fetch/parse HTML redundante).
- `navigator.serviceWorker.controller` null check.
- DOMContentLoaded no cerrado correctamente en `main.js` (crítico).

### Push Notifications (v1 inicial)
- Web Push API con Periodic Background Sync.
- Config: intervalo 1-24h, umbral caída 0-90 días.
- Archivos: `js/push-notifications.js`, `docs/PUSH_NOTIFICATIONS.md`.

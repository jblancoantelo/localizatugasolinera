# Plan de Pruebas

## Objetivo
Validar que la aplicación funciona correctamente tanto desde `file://` como desde servidor HTTP, y que todas las interacciones de usuario navegan sin errores.

## Cómo ejecutar las pruebas

```powershell
# Requisitos: Node.js v18+, Playwright (`npm install playwright`)
# Si falta Chromium: npx playwright install chromium

# 1. Limpia procesos Node previos (evita conflictos de puerto)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Ejecuta el test suite autónomo
node docs/test/full_test.mjs
```

### Qué hace el script:
- Inicia servidor HTTP en :8080 sirviendo desde la raíz del proyecto
- Lanza Chromium headless
- Ejecuta 175 tests: 168 contra HTTP + 7 contra `file://`
- Empieza por la sección 17 (build), que lee ficheros del disco sin abrir el navegador
- Cierra servidor y navegador automáticamente
- Exit code 0 = todo OK, 1 = algún fallo

## Entornos de prueba

| Entorno | URL | Limitaciones |
|---------|-----|-------------|
| **HTTP** | `http://localhost:8080` | API funcional (CORS ok), Service Worker activo |
| **file://** | `../../index.html` (relativo a `docs/test/`) | API bloqueada por CORS, solo UI básica |

## Casos de prueba

### 1. Carga inicial

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 1.1 | Abrir app | ✅ | ✅ | Sin errores de carga (network/console) |
| 1.2 | Toolbar visible | ✅ | ✅ | Barra superior con filtros visible |
| 1.3 | Bottom tabs visibles | ✅ | ✅ | 4 tabs inferiores (Mapa, Tabla, Ambos, Config) |
| 1.4 | Mensaje inicial | ✅ | ✅ | Content area muestra "Selecciona una provincia" |

### 2. Selección de provincia y datos

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 2.1 | Carga de provincias | ✅ | — | Selector poblado con 52 provincias desde API |
| 2.2 | Seleccionar provincia | ✅ | — | fetchProvinceData() carga estaciones de la provincia |
| 2.3 | Datos visibles | ✅ | — | STATE.data con estaciones (ej: 155 en Albacete) |
| 2.4 | Filtro combustible poblado | ✅ | — | fuelFilter con opciones de combustibles disponibles |

### 3. Tabs — clase CSS + panel + botón activo

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 3.1 | Tab Mapa | ✅ | ✅ | Clase `.tab-map` en content, panel `#map` visible, botón activo |
| 3.2 | Tab Tabla | ✅ | ✅ | Clase `.tab-table`, panel `.table-area` visible |
| 3.3 | Tab Ambos | ✅ | ✅ | Clase `.tab-both`, panel `.both-table-area` visible |
| 3.4 | Tab Config | ✅ | ✅ | Clase `.tab-config`, panel `.config-area` visible |

### 4. Tabla (tab "Tabla")

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 4.1 | Filas visibles | ✅ | — | 30 filas en `#tableBody` (paginación por defecto) |
| 4.2 | Orden por defecto | ✅ | — | sortCol='Precio', sortDir='asc' |
| 4.3 | Toggle sort | ✅ | — | Click en columna Precio cambia a desc |
| 4.4 | Click en fila → detail | ✅ | — | Bottom sheet `#detailPanel` se abre |
| 4.5 | Contenido del detail | ✅ | — | `#detailBrand` contiene nombre + estrella favorito |
| 4.6 | Cerrar detail | ✅ | — | Click ✕ cierra panel, selectedId se limpia |

### 5. Histórico de precios (detail panel)

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 5.1 | Tab Histórico se activa | ✅ | — | Click en tab "Histórico" lo marca como activo |
| 5.2 | Gráfica o error mostrado | ✅ | — | Canvas dibuja línea de precios o muestra error controlado |

### 6. Tabla "Ambos"

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 6.1 | Filas visibles | ✅ | — | #tableBothBody con todas las estaciones filtradas (155 filas) |
| 6.2 | Click en fila → detail | ✅ | — | Bottom sheet se abre al hacer click |

### 7. Config

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 7.1 | Tarjetas de configuración | ✅ | ✅ | 5 `.config-card` (Descuentos, Caché, Paginación, Registro actividad, Push) |
| 7.2 | Input TTL visible | ✅ | ✅ | `#cacheTtl` visible e interactivo |

### 8. Mapa

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 8.1 | Mapa activo | ✅ | — | Leaflet inicializado, zoom > 0 |
| 8.2 | Cambio de estilo | ✅ | — | Selector cambia a satélite y vuelve |

### 9. Geolocalización

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 9.1 | Botón visible | ✅ | — | `#geolocBtn` presente en toolbar |

### 10. Búsqueda

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 10.1 | Input visible | ✅ | ✅ | `#search` presente en toolbar |

### 11. Popup del mapa

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 11.1 | Click en marcador | ✅ | — | Popup Leaflet se abre con `.popup-container` |
| 11.2 | Barra de tabs en popup | ✅ | — | `.popup-tabs` con dos botones |
| 11.3 | Dos tabs | ✅ | — | Información + Histórico |
| 11.4 | Tab activo por defecto | ✅ | — | Información es el activo inicial |
| 11.5 | Click en Histórico | ✅ | — | Se activa el tab Histórico |
| 11.6 | Histórico en popup | ✅ | — | Canvas dibuja gráfica o muestra error controlado |
| 11.7 | Volver a Información | ✅ | — | Click en Información reactiva el tab |

### 12. Persistencia tras F5

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 12.1 | Recargar página | ✅ | — | Provincia seleccionada se restaura desde localStorage |
| 12.2 | Toggle solo favoritos + F5 | ✅ | — | `STATE.showFavoritesOnly === true` se mantiene tras recargar |

## Resultados actuales

**175 tests — 175 ✅ 0 ❌**

| Grupo | HTTP | file:// |
|-------|------|---------|
| Carga | 1 ✅ | 1 ✅ |
| Toolbar | 1 ✅ | 1 ✅ |
| Tabs (visibles) | 1 ✅ | 1 ✅ |
| Inicial (mensaje) | 1 ✅ | 1 ✅ |
| Provincias | 2 ✅ | — |
| Datos | 1 ✅ | — |
| Filtros | 1 ✅ | — |
| Tabs (clase+panel+btn) | 1 ✅ | 1 ✅ |
| Tabla | 3 ✅ | — |
| Detail | 3 ✅ | — |
| Histórico | 4 ✅ | — |
| Ambos | 2 ✅ | — |
| Config | 2 ✅ | 1 ✅ |
| Mapa | 2 ✅ | — |
| Geo | 1 ✅ | — |
| Búsqueda | 1 ✅ | 1 ✅ |
| Popup | 7 ✅ | — |
| Persistencia | 4 ✅ | — |
| Caché (limpiar caché borra de verdad) | 1 ✅ | — |
| Push Notifications | 10 ✅ | — |
| Helpers (norm/parsePrice/comparePrices) | 12 ✅ | — |
| Chat IA (sección 15) | 106 ✅ | — |
| Ring logs (sección 16) | 7 ✅ | — |
| Build (sección 17) | 4 ✅ | — |
| **Total** | **168 ✅** | **7 ✅** |

## 15. Chat IA (automatizado)

Requiere la página real, pero **no** la API: `window.fetch` se sustituye en
`page.evaluate` (no con `page.route`, porque la página tiene Service Worker y
las peticiones que este intercepte nunca pasan por el interception de
Playwright). Solo se deja pasar lo que no sea `api.llm7.io` ni un `workers.dev`
(mockeado).

Cubierto: proveedor LLM7 sin clave (`Bearer unused`), `listModelsNoAuth` (su
`GET /models` rechaza `Authorization` en el preflight), `aiApiKey()`,
`isAiProviderReady()`, `updateAiStatus()`, `parseModels()` (filtro de `tier` y
exclusión del 401), `defaultModel` vs primer `<option>`, prefijos de clave,
`xorDecryptBase64()` roundtrip, `AI_NON_CHAT_RE`, `AI_MODEL_ERROR_RE`,
`aiHttpError()`, `refreshAiModels()` (con y sin caché), persistencia y borrado
de la caché, `invalidateAiModelsCache()`, exclusión de `chrome-nano`,
`warnAiModelUnavailable()` con su botón, botón 🔄, degradación cuando `/models`
falla (500 y red caída), invalidación al cambiar la clave, y `send()` con
`max_tokens` y respuesta vacía por *reasoning*.

**NVIDIA vía proxy** (25 tests nuevos): tab/panel y los 8 ids presentes, es el
único `viaProxy` con rutas relativas, sin clave en el navegador (ni campo, ni
prefijo, ni blob cifrado), `normalizeAiProxyUrl()` (añade `https://`, quita la
barra), estado del panel con y sin proxy, `send()` al Worker sin `Authorization`
y con `max_tokens: 2048`, respuesta vacía por *reasoning* y 404 propagado,
catálogo pedido al proxy con filtro de embeddings, unión con la lista fija,
invalidación al cambiar la URL, persistencia normalizada en `localStorage` y
`reason: 'nokey'` sin URL.

**Contexto histórico para el modelo** (7 tests nuevos): la sección
`=== HISTÓRICO DE PRECIOS` se genera con la serie fechada de la gasolinera
nombrada (10 puntos), el resumen con actual/mín/máx/media/variación y nº de
días, favoritos y más baratas incluidos, la tendencia provincial y las mayores
subidas/bajadas, y **no** se descarga nada si la pregunta no usa palabras clave
ni nombra una marca (`AI_HISTORY_WORDS`).

**Diagnóstico del proxy de NVIDIA** (5 tests nuevos): `aiProxyDiagnostics()`
clasifica el `GET /v1/models` sin coste de tokens en `dns` (host que no
responde, con la forma de URL que hay que pegar), `notfound` (host que responde
sin Worker), `nokey` (Worker sin `NVIDIA_API_KEY`), `badauth` (401/403), `quota`
(429) y `ok` con el nº de modelos; existen `iaProxyTestBtn` e
`iaProxyTestStatus`; y tanto el `send()` del chat como `fetchAiModels()`
devuelven un error descriptivo en vez de `Failed to fetch`.

**URL del proxy inválida** (11 tests nuevos): `aiProxyUrlIssue()` devuelve
`nosubdomain` para el valor de ejemplo (`petrol-nvidia-proxy.workers.dev` no
puede existir: Cloudflare publica `<worker>.<subdominio-cuenta>.workers.dev`),
`placeholder` para lo de `<…>` de la documentación, `invalid` para una URL que
ni parsea —incluido el caso en que Chromium **no** lanza y percent-codifica los
espacios (`mi%20proxy`)—, `nourl` para la vacía y `''` para una URL real o sin
esquema (que `normalizeAiProxyUrl()` arregla). Con el valor de ejemplo NVIDIA
queda **no listo**, no se hace **ni una petición**, el estado del panel avisa, el
campo de Config se marca en rojo, el desplegable de modelos rotula el motivo y
los errores del chat y del catálogo llevan la explicación en vez de
`NetworkError`. El botón 🔎 Probar responde `invalidurl` sin tocar la red para
ejemplo y placeholder; con una URL con subdominio el campo se marca en verde.
Los tests que necesitan un proxy funcional usan `petrol-nv.mi-cuenta.workers.dev`
(4 etiquetas), porque con 3 el proveedor ya no está listo.

**Rango de días del histórico** (4 tests nuevos): `resolveAiHistoryDays()`
entiende "60 días", "21 jornadas", "6 semanas", "3 meses" y "1 año"; acota al
rango de la app (1 día → 7, 400 días → 180) y sin cifra usa `STATE.historyDays`;
`HISTORY_DAYS_OPTIONS` coincide con los `<option>` del modal de detalle y del
popup del mapa; el rango pedido llega al contexto (60 jornadas) y al pedir 7
días se recorta la caché de 60 **sin nuevas peticiones**; con el modal de
histórico abierto la IA usa su combustible (`#historyFuel`).

Verificado además fuera de la suite, contra la API real sin clave: catálogo de 4
modelos, caché reutilizada sin peticiones y respuesta correcta con datos de la
provincia.

## 16. Ring logs (automatizado)

Los dos logs de actividad comparten `createRingLog(max)` de `js/storage.js`
(7 tests nuevos). Cubierto:

- `createRingLog(3)` conserva las **últimas N** entradas y descarta la más antigua,
  `all()` devuelve una **copia** (mutarla no toca el ring), `load()` recorta a N y
  `clear()` vacía
- `logPushEvent()` **no lanza**: antes, tras migrarlo al ring, quedaba una línea
  que usaba el array viejo y petaba con `ReferenceError` en cada evento
- El render del log de push muestra **del más reciente al más antiguo** y
  `clearPushLog()` vacía la UI
- La restauración desde `localStorage` funciona: se siembran 45 entradas de API,
  `load()` las recorta a 30 empezando por la correcta y el render muestra la más
  reciente. Ojo: `API_LOG_RING`/`PUSH_LOG_RING` son `const` de nivel superior, así
  que **no** existen en `window` y hay que referenciarlas por su identificador

## 17. Build (automatizado, sin navegador)

Lee los ficheros del disco antes de lanzar Chromium (4 tests):

- La lista `ASSETS` de `sw.js` cubre **todo** lo que referencian `index.html` y
  `manifest.json` (los `src`/`href` del HTML y el `"src"` de los iconos del JSON,
  recortando el `?v=` de query). Se comprueba con el mismo criterio que
  `scripts/sync-sw-assets.mjs`, así que el precaché no puede quedarse desfasado
  en silencio
- Todo lo que el SW importa con `importScripts` está precacheado (si no, el SW
  arranca sin esas funciones)
- `APP_VERSION` y `BUILD_TIME` existen y `BUILD_TIME` tiene formato `aaaammdd-hhmmss`
- Los iconos del `manifest.json` llevan `?v=<APP_VERSION>`: sin la query Chrome
  (sobre todo Android) reutiliza el bitmap del icono cacheado por URL y el
  lanzador se queda con la imagen antigua. Lo escribe `bump-version.mjs`

## 13. Validación de claves IA (verificación manual asistida)

No automatizado en `full_test.mjs` (requiere el módulo real de IA). Verificado con Playwright evaluando `js/ai-chat.js` en la página.

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 13.1 | `tryDecryptDefaultKeys('roiroi')` | `{ keys, invalid: [] }` — 4/4 válidas |
| 13.2 | `tryDecryptDefaultKeys('malaclave')` | `null` — "❌ Contraseña incorrecta", no persiste nada |
| 13.3 | `tryDecryptDefaultKeys('roiroix')` | 3 válidas + `[openrouter]` en `invalid` (detección por proveedor) |
| 13.4 | Clave `AQ.…` en `#iaKeyGoogle` | `❌ Formato de clave incorrecto para google (debe empezar por AIza)` |
| 13.5 | Clave `sk-or-v1-…` en `#iaKeyGroq` | `❌ Formato de clave incorrecto para groq (debe empezar por gsk_)` |
| 13.6 | Vaciar un campo de clave | No se persiste `""`; `loadAiApiKeys()` no lo contiene |
| 13.7 | Cargar claves correctas + F5 | `✅ Claves cargadas desde almacenamiento`, botón "Volver a cargar" visible |
| 13.8 | `defaultModel` vs primer `<option>` | Coinciden en los 4 proveedores |

## 14. Push Notifications

| # | Acción | HTTP | file:// | Resultado esperado |
|---|--------|------|---------|-------------------|
| 14.1 | Botón 🔔 visible | ✅ | ✅ | `#pushNotifBtn` visible en toolbar |
| 14.2 | Suscripción | ✅ | — | Click 🔔 → localStorage tiene `gasolineras_push_subscription` |
| 14.3 | Status verde | ✅ | — | `#pushNotifStatus` texto "✓ Notificaciones activas" |
| 14.4 | Config inputs | ✅ | ✅ | `#checkInterval` + `#priceFallDays` visibles en Config tab |
| 14.5 | Favorito en IndexedDB | ✅ | — | `toggleFavorite(id)` → IndexedDB store `favorites` contiene `{ id, provinceName, provinceId, brand }` |
| 14.6 | checkPrices ignora caché | ✅ | — | Mockear API: `fetchProvinceData` previa (llena caché) → `checkPrices()` llama API igualmente |
| 14.7 | Caché actualizada tras check | ✅ | — | `getCachedProvinceData(prov)` timestamp se refresca tras `checkPrices()` |
| 14.8 | Test notification sin error | ✅ | — | Click `#pushNotifTestBtn` → sin errores en consola |
| 14.9 | SW notificationclick URL matching | ✅ | — | `new URL(client.url).pathname` === `scopePath` evaluado como correcto |
| 14.10 | Unsubscribe desregistra periodicSync | ✅ | — | Click 🔔 estando suscrito → `periodicSync.getTags()` vacío |

**Notas**:
- Tests 14.1-14.10 automatizados en `full_test.mjs`
- 14.9 se evalua inyectando lógica en page context (no requiere notificación real)
- Para testing manual sin esperar X horas, ver [PUSH_NOTIFICATIONS_QUICK_START.md](./PUSH_NOTIFICATIONS_QUICK_START.md)

## Bugs conocidos y fixes aplicados

| Bug | Síntoma | Fix |
|-----|---------|-----|
| Dropdown marcas bajo el mapa | `#brandFilterWrap` con `position: relative` creaba stacking context incorrecto; dropdown `position: absolute` quedaba detrás del mapa | Dropdown movido a raíz de `.app`, reposicionado con `position: fixed` + `getBoundingClientRect()` en JS. `z-index: 10000` |
| `.bottom-tabs` z-index sin efecto | `z-index: 100` sin `position` no funciona en CSS | Añadido `position: relative` |
| `noProvinceMsg` oculto por especificidad | Selector `.content #noProvinceMsg` insuficiente | Cambiado a `#noProvinceMsg` con mayor especificidad |
| `setActiveTab()` borraba clase `no-province` | `className = 'content'` sobreescribía clases existentes | Usar `classList.add`/`remove` |
| `fn` undefined en tabla Ambos | Faltaba `const fn = getSelectedFuelName(d)` en la función map | Añadida declaración |
| `self.registration.showNotification()` en página | TypeError al mostrar notificación desde `checkFavoritePrices()` | Reemplazado por `navigator.serviceWorkerContainer.ready.then(r => r.showNotification(...))` |
| Comparación incorrecta de precios | `checkFavoritePrices()` comparaba `oldestPrice` vs `latestPrice` (ambos histórico) en vez de `currentPrice` vs `oldestPrice` | Ahora compara precio actual vs histórico |
| Código muerto en `checkFavoritePrices()` | Variable `currentData` construida con fetch+parse HTML pero nunca usada | Eliminado bloque redundante |
| `navigator.serviceWorker.controller` null | TypeError si SW no ha activado al suscribirse | Añadido null check en `push-notifications.js` |
| Validación global de prefijos de clave IA | `tryDecryptDefaultKeys()` usaba una lista global (`['AIza','AQ.','gsk_','cMHt','sk-or-']`): una clave del proveedor equivocado pasaba como "contraseña correcta" y solo fallaba al enviar | `AI_KEY_PREFIXES` por proveedor + `isAiKeyFormatValid()`; devuelve `{ keys, invalid }` y no persiste las inválidas |
| Modelos de IA obsoletos | 11 de 15 modelos devolvían 404 / no existían / eran de pago; los 4 chats fallaban | Listas resucitadas y verificadas contra las APIs reales (ver `docs/CHANGELOG.md` 2026-09-26) |
| "Limpiar caché" no borraba nada | `dbGetAllKeys()`/`dbDelete()` sin el nombre del store → `NotFoundError` que el `catch` resolvía en silencio | `storeName` siempre primero; test que siembra claves `prov_*`/`hist_*` y comprueba que desaparecen |
| Log de push muerto | Quedó `if (PUSH_LOG.length > 30)` al migrar al ring: `ReferenceError` en cada `logPushEvent()` | Línea eliminada; test que registra dos eventos y comprueba la UI |
| Logs vacíos tras F5 | La restauración usaba `window.API_LOG_RING` y las `const` de nivel superior no existen en `window` | Se referencian por identificador; test con 45 entradas sembradas y recorte a 30 |
| `icons/icon-512.svg` fuera del precaché | El sync de assets solo leía `index.html`, y ese icono solo está en `manifest.json` | El sync lee también `manifest.json`; test que compara `ASSETS` con ambas fuentes |
| Histórico del SW con fechas desordenadas | Su `sort()` de `dd-mm-aaaa` como texto y sin el unary `+` del año | `sortHistoryDates()` compartido en `js/history.js`, importado por el SW |

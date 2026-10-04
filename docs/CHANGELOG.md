# CHANGELOG

## [2026-10-04] — NVIDIA: la URL del proxy se valida antes de hacer fetch

### 🐞 El proveedor NVIDIA fallaba siempre

`AI_PROXY_NVIDIA_DEFAULT = 'https://petrol-nvidia-proxy.workers.dev'` **no puede
existir**: Cloudflare publica cada Worker como `<worker>.<subdominio-de-la-cuenta>.workers.dev`,
así que el valor de ejemplo se queda sin ese subdominio. Resultado: cada consulta al
catálogo y cada mensaje morían con `NetworkError when attempting to fetch resource`, y el
mensaje de ayuda devolvía un placeholder literal (`https://petrol-nvidia-proxy..workers.dev`)
que no permite descubrir nada.

| Cambio | Detalle |
|--------|---------|
| `js/ai-chat.js` | **Nuevo** `aiProxyUrlIssue(url)` → `'nourl'` / `'placeholder'` / `'invalid'` / `'nosubdomain'` / `''`, y `aiProxyUrlIssueMessage()` con la explicación de cada motivo |
| `js/ai-chat.js` | `aiProxyUrlIssue()` detecta el caso de Chromium, que **no** lanza con espacios en el host sino que los percent-codifica (`mi%20proxy`, que tampoco resuelve) |
| `js/ai-chat.js` | Se valida **antes** de cualquier fetch: `aiProviderUrl()` lanza con el motivo (fuera del `try` del `send()` de NVIDIA), `aiProxyDiagnostics()` responde `kind: 'invalidurl'` sin tocar la red, `isAiProviderReady()` devuelve `false`, `updateAiStatus()` avisa y `autoRefreshAiModels()` rotula el desplegable |
| `js/ai-chat.js` | **Nuevo** `markAiProxyUrlInput()`: el campo de Config se pinta rojo/verde con el motivo en el `title`. `AI_PROXY_URL_ISSUES` da la versión corta para los rótulos |
| `js/ai-chat.js` | **Nuevo** `AI_PROXY_NVIDIA_SHAPE = 'https://petrol-nvidia-proxy.mi-cuenta.workers.dev'` sustituye al placeholder `<tu-subdominio>` en todos los mensajes |
| `index.html` | Config → IA explica que la URL por defecto es **un ejemplo**, que hace falta una cuenta de Cloudflare (gratuita) y que el resto de proveedores no dependen del proxy. Placeholder del campo con la forma real |
| `workers/wrangler.toml` | Comentario corregido: la URL que imprime `wrangler deploy` es `https://<name>.<subdominio>.workers.dev`, no `https://<name>.workers.dev` |

Motivo: sin una URL con subdominio no hay nada que consultar, así que es mejor decirlo
antes de fetchear que dejar un error de red sin contexto.

### 🧪 Verificación

- Suite completa: **174 tests** (167 HTTP + 7 file://), 11 nuevos:
  - 2 de `aiProxyUrlIssue()`: motivo de la URL de ejemplo y distinción de `placeholder` / `nourl` / `invalid` / sin esquema
  - 6 de integración: NVIDIA no listo con el valor de ejemplo, estado del panel, rótulo del desplegable, color del campo, errores del chat y del catálogo con el motivo en vez de `NetworkError`, 0 peticiones
  - 1 de `🔎 Probar`: con la URL de ejemplo o un placeholder no llega a la red y explica qué pegar
  - 2 de reescritura: los que usaban `petrol-nv.workers.dev` (3 etiquetas) pasan a `petrol-nv.mi-cuenta.workers.dev`, que es la única forma que puede funcionar
- `node docs/test/full_test.mjs`: 174 ✅ 0 ❌

---

## [2026-10-04] — Motor gráfico unificado, histórico compartido con el SW y precaché generado

### 🧩 Un solo motor de gráficas y un solo histórico

Había dos gráficas (panel de detalle y popup del mapa) con el mismo código de canvas
duplicado, y **tres** copias de la descarga del histórico: una en `api.js` para la
página, otra en `sw.js` para el chequeo de push y una tercera (comparador de fechas
distinto) en el chat de IA. El SW tenía su propio `sort()` de fechas `dd-mm-aaaa` que
se olvidaba del unary `+` en el año.

| Cambio | Detalle |
|--------|---------|
| `js/chart-core.js` | **Nuevo**: primitivas de canvas compartidas por las dos gráficas — `chartSetupCanvas()` (devicePixelRatio + fallback a los atributos si la pestaña oculta no da layout), `chartScale()`, `chartAxes()`, `chartMinMax()`, `chartIndices()` y `drawTooltip()` |
| `js/chart-engine.js` | `drawPriceChart()` pasa de ~90 líneas a las primitivas de `chart-core.js`. El tooltip se dibuja una sola vez (antes `drawPopupTooltip()` era una copia) |
| `js/map.js` | `drawPopupPriceChart()` usa `chartSetupCanvas()`, `chartIndices()` y `chartMinMax()`; el hover llama al `drawTooltip()` compartido |
| `js/history.js` | **Nuevo**: fuente única del histórico (página + chat IA + SW): `formatDateDDMMYYYY()`, `sortHistoryDates()`, `historyDateList()`, `fetchHistoryByProvinceId()` (caché IndexedDB + lotes de 3) y `getStationHistory()` |
| `js/api.js` | Se quedan solo `fetchProvinceHistory()` (nombre → id de provincia) y `apiFetch()`. `formatDateDDMMYYYY`, `sortHistoryDates` y `getStationHistory` salen de aquí |
| `sw.js` | `importScripts` añade `js/history.js` y borra `fetchProvinceHistorySW()` / `getStationHistorySW()` (≈90 líneas duplicadas con el comparador de fechas arreglado) |
| `index.html` | `js/history.js` se carga tras `js/db.js` y `js/chart-core.js` antes de `js/chart-engine.js` |

Motivo: la duplication de fechas era una bomba de relojería — el `sort()` del SW
ordenaba `dd-mm-aaaa` como texto y el unary `+` del año desaparecía.

### 🔁 Logs de actividad con buffer circular

| Cambio | Detalle |
|--------|---------|
| `js/storage.js` | **Nuevo** `createRingLog(max)`: `push()` (descarta la más antigua al llegar a `max`), `all()` (devuelve copia), `clear()` y `load()` (recorta a `max`) |
| `js/api.js` | `API_LOG[]` → `API_LOG_RING` (30). Los errores de red guardan además `error: e.message` |
| `js/push-notifications.js` | `PUSH_LOG[]` → `PUSH_LOG_RING` (30) |

El ring guarda de más antiguo a más reciente, así que el render hace `.slice().reverse()`
y lo que se persiste en `localStorage` va en ese orden (igual que antes, que ya usaba
`unshift` + reverse al pintar).

### 🐞 Correcciones

| Bug | Síntoma | Fix |
|-----|---------|-----|
| **"Limpiar caché" no borraba nada** | `dbGetAllKeys()` y `dbDelete()` se llamaban sin el nombre del store, así que IndexedDB lanzaba `NotFoundError` y el `catch` lo resolvía en silencio | `storeName` siempre como primer argumento (`dbGetAllKeys('cache')`, `dbDelete('cache', key)`) en `clearCache()` y `renderCacheInfo()` |
| **Log de push muerto** | Al migrarlo al ring quedó `if (PUSH_LOG.length > 30)` referencing el array ya borrado → `ReferenceError` en cada `logPushEvent()` | Línea eliminada; `PUSH_LOG_RING` es el único estado |
| **Logs no se restauraban tras F5** | `main.js` hacía `window.API_LOG_RING.load(...)`, pero las `const` de nivel superior de un script clásico viven en el entorno léxico global, **no** en `window` | Se referencian por su identificador con `typeof … !== 'undefined'` |
| **`icons/icon-512.svg` fuera del precaché** | El script de sync solo leía `index.html`, y ese icono solo se declara en `manifest.json` | El sync lee también `manifest.json` (con el patrón `"src":`) y el precaché queda con los 4 iconos |
| Check de assets que no comprobaba nada nuevo | La validación de `importScripts` solo se ejecutaba si la lista había cambiado | Se comprueba siempre, y `--check` no escribe pero sí valida |
| `updateDetail()` y `isLocalStorageAvailable()` | Código muerto | Eliminados (junto con `dbClear()`) |

### 🧱 Precaché y versión generados por script

| Cambio | Detalle |
|--------|---------|
| `scripts/sync-sw-assets.mjs` | **Nuevo**: reconstruye el bloque `// assets:start … // assets:end` de `sw.js` desde `index.html` + `manifest.json`, con orden estable (html → manifest → css → js → iconos) y **error si algún `importScripts` no queda precacheado** |
| `scripts/bump-version.mjs` | Llama a `syncAssets()` antes de subir `APP_VERSION`, así que un script nuevo entra en el precaché por el mismo comando |
| `package.json` | Scripts `test`, `bump`, `sync-assets` y `check-assets` (antes `npm test` fallaba con "no test specified") |
| `check-syntax.mjs` | Ampliado: valida los `scripts/*.mjs` con `node --check` sobre una copia temporal y los `<script>` **inline** de `index.html` (donde se registra el SW), que ningún test alcanzaba |
| `sw.js` | `ASSETS` regenerado (21 ficheros, ya sin editar a mano) y `APP_VERSION` 18 → 19 |

Motivo: el precaché estaba escrito a mano y se desincronizó dos veces (se colaron
ficheros ausentes y se cayó `icon-512.svg`). Con el test "Build > ASSETS de sw.js
cubre…" ya no puede volver a pasar en silencio.

### 🧪 Verificación

- Suite completa: **163 tests** (156 HTTP + 7 file://), 10 nuevos:
  - 7 de ring logs: `createRingLog()` conserva las últimas N y `all()` devuelve copia, `load()` recorta y `clear()` vacía, `logPushEvent()` registra + persiste + pinta, orden inverso en la UI, y la restauración desde `localStorage` (30 entradas, la más reciente arriba)
  - 3 de build: `ASSETS` cubre `index.html`/`manifest.json`, todo lo que el SW importa está precacheado y `APP_VERSION`/`BUILD_TIME` tienen formato válido
- `node check-syntax.mjs`: 19/19 ficheros OK
- `node docs/test/full_test.mjs`: 163 ✅ 0 ❌

---

## [2026-09-27] — La app dice si la URL del proxy de NVIDIA es la buena

### 🔎 Comprobación del proxy desde Config → IA

| Cambio | Detalle |
|--------|---------|
| `js/ai-chat.js` | **Nuevo** `aiProxyDiagnostics(provider, urlOverride)`: un `GET /v1/models` **sin coste de tokens** que clasifica el resultado en `dns` (el host no existe), `notfound` (el host responde pero no hay Worker), `nokey` (Worker sin `NVIDIA_API_KEY`), `badauth` (401/403), `quota` (429), `http<status>` y `ok` con el nº de modelos, con una explicación en castellano de qué revisar en cada caso |
| `index.html` | Botón **🔎 Probar** (`iaProxyTestBtn`) y su cuadro de estado (`iaProxyTestStatus`) junto a `iaProxyNvidia`. Si la comprobación va bien, guarda la URL, refresca el estado del panel e invalida el catálogo |
| `js/ai-chat.js` | **Nuevo** `aiFetchError(provider, err)`: en los proveedores `viaProxy` un host inexistente solo produce "Failed to fetch", así que el `send()` de NVIDIA lo reescribe con la URL usada, la forma que debe tener y dónde cambiarla |
| `js/ai-chat.js` | `fetchAiModels()` con `viaProxy` ahora diagnostica antes de lanzar: el fallo del catálogo nombra el motivo en vez de mostrar un error de red |
| `js/ai-chat.js` | El mensaje de `dns` recuerda que `tu-subdominio` en la documentación es un literal: la URL real la imprime `wrangler deploy` |

Motivo: Cloudflare asigna a cada cuenta un subdominio propio de `workers.dev`, así que `https://petrol-nvidia-proxy.workers.dev` (el valor por defecto) casi nunca es el host real y respondía "Servidor no encontrado" sin explicar nada.

### 🧪 Verificación

- Suite completa: **152 tests** (0 fallos), 5 nuevos sobre el diagnóstico (host inexistente, 404 sin Worker, Worker sin clave, 401/403, 429, OK con nº de modelos) y el error descriptivo en el chat y en el catálogo.

---

## [2026-09-27] — Histórico de la IA con los rangos del modal + URL NVIDIA por defecto

### 📈 El histórico del chat ya usa los mismos datos y rangos que el modal

| Cambio | Detalle |
|--------|---------|
| `js/state.js` | **Nuevo**: `HISTORY_DAYS_OPTIONS = [7, 14, 21, 30, 60, 90, 180]` y `HISTORY_DAYS_DEFAULT = 14`, la misma lista que los combos de la app |
| `js/ai-chat.js` | `resolveAiHistoryDays(userText)`: si la pregunta trae rango explícito (`60 días`, `21 jornadas`, `6 semanas`, `3 meses`, `1 año`, `semestre`) se respeta, si no se usa el seleccionado en el modal (`STATE.historyDays`), y siempre se acota al rango de la app (7–180 días) |
| `js/ai-chat.js` | `getAiHistoryData(days)`: reutiliza `window._historyCache` (modal de detalle y popup del mapa) si cubre el rango pedido, y guarda `window._aiHistoryCache` para no repetir descargas al ampliarlo. Un rango menor recorta la caché en vez de volver a pedir fechas |
| `js/ai-chat.js` | `aiHistoryFuelName()`: con el modal de histórico abierto se usa su combustible (`#historyFuel`), si no el filtro de la app. `stationSeries()` ahora llama a `getStationHistory()`, o sea **la misma serie que dibuja la gráfica**, con soporte de grupos de combustibles y descuento por marca |
| `js/ai-chat.js` | `stationHistoryBlock()` añade el precio actual con tu descuento, la media, el mínimo/máximo con fecha y la variación, e indica el grupo de combustibles usado |
| `js/ai-chat.js` | El bloque del periodo declara el rango usado y si lo estás viendo ("los que has pedido" o "el que tienes seleccionado en el histórico de la app") |
| `js/ai-chat.js` | `wantsStationHistory()` también dispara con un rango explícito, no solo con palabras clave: "¿cuál era el precio hace 3 meses?" ya no se queda sin datos |
| `js/api.js` | `sortHistoryDates()`: las fechas del Ministerio (`dd-mm-aaaa`) no ordenan bien con `sort()`; el comparador correcto se comparte con `getStationHistory()` y con el chat |
| `js/ai-chat.js` | Corrección de las flechas: `📉` para la mayor bajada y `📈` para la mayor subida del periodo (estaban invertidas) |
| `sw.js` | `APP_VERSION` 16 → 17 |

### 🔗 NVIDIA con URL predefinida (sigue siendo editable)

| Cambio | Detalle |
|--------|---------|
| `js/ai-chat.js` | `AI_PROXY_NVIDIA_DEFAULT = 'https://petrol-nvidia-proxy.workers.dev'`: si no hay nada en `gasolineras_ai_nvidia_proxy` se usa esa, así que el proveedor funciona sin configurar nada |
| `index.html` | Botón **↺ Usar la predefinida** (`iaProxyResetBtn`) junto al campo `iaProxyNvidia`, valor inicial y aviso de que la URL cambia al desplegar el Worker |
| `js/ai-chat.js` | Estado del proveedor: "✅ Proxy por defecto (cámbialo en Config → IA)" o "✅ Proxy configurado" |
| `js/ai-chat.js` | Cambiar o restablecer la URL invalida el catálogo de modelos cacheado y refresca los desplegables |

### 🧪 Verificación

- Suite completa: **147 tests** (0 fallos), 8 nuevos sobre rango dinámico, reutilización de caché, combustible del modal y orden de fechas.
- El rango se recorta sobre la caché amplia: 60 días descargados y una segunda pregunta de 7 días con **0 peticiones** adicionales.

---

## [2026-09-27] — NVIDIA NIM vía Cloudflare Worker + histórico de gasolineras en el chat IA

### 🆕 Proveedor NVIDIA NIM (proxy propio)

| Cambio | Detalle |
|--------|---------|
| `workers/nvidia-proxy.js` | **Nuevo**: Worker que reenvía solo `POST /v1/chat/completions` y `GET /v1/models` a `integrate.api.nvidia.com` con el secreto `NVIDIA_API_KEY`. Responde 204 al preflight y propaga el estado/cuerpo de NVIDIA (401/404/429) reescribiendo solo la cabecera CORS |
| `workers/wrangler.toml` | **Nuevo**: nombre del Worker, entrypoint y `ALLOWED_ORIGIN` opcional (sin él responde `*`) |
| `js/ai-chat.js` | `AI_PROVIDERS.nvidia` con `viaProxy: true` y rutas **relativas** (`/v1/chat/completions`, `/v1/models`) resueltas por `aiProviderUrl()`; 7 modelos de chat verificados y `max_tokens: 2048` (varios son *reasoning*) |
| `js/ai-chat.js` | `AI_PROXY_KEY = 'gasolineras_ai_nvidia_proxy'`, `normalizeAiProxyUrl()`, `getAiProxyUrl()`, `setAiProxyUrl()`, `aiProviderUrl()` |
| `js/ai-chat.js` | NVIDIA **no** tiene clave en el navegador: sin campo, sin `AI_KEY_PREFIXES` y sin `AI_ENCRYPTED_KEYS`. `isAiProviderReady('nvidia')` depende de la URL del proxy |
| `js/ai-chat.js` | `aiModelReply(model, data, alternativeModel)` compartido: avisa cuando el modelo solo razonó y se quedó sin tokens en vez de devolver un mensaje vacío |
| `index.html` | Pestaña y panel NVIDIA (`iaModelNvidia`, `iaInputNvidia`, `iaSendNvidia`, `iaMessagesNvidia`, `iaStatusNvidia`, `iaRefreshModelsNvidia`, `iaModelsStatusNvidia`) y campo `iaProxyNvidia` en Config → IA |
| `sw.js` | `APP_VERSION` 15 → 16 |

### 📈 El modelo ya puede consultar el histórico de las gasolineras

| Cambio | Detalle |
|--------|---------|
| `js/ai-chat.js` | `wantsStationHistory(userText, stations)`: descarga el histórico si la pregunta usa palabras clave (`AI_HISTORY_WORDS`) **o** si nombra la marca de alguna estación cargada. Antes solo la opción "media/mín/máx por día" |
| `js/ai-chat.js` | `buildAiHistoryLines()`: sección `=== HISTÓRICO DE PRECIOS` con periodo real, evolución de la provincia (media/mín/máx/nº estaciones, la más barata de cada día, tendencia en €/L y %, mínimo histórico) y **hasta 12 gasolineras** con su serie de precios fechada + resumen (actual, mín/máx con fecha, media, variación en €/L y %, nº de días) |
| `js/ai-chat.js` | `stationSeries()` y `stationHistoryBlock()` para cruzar cada `IDEESS` con los listados diarios; las estaciones nombradas en la pregunta van primero, luego favoritos y las más baratas |
| `js/ai-chat.js` | Nuevas "mayores subidas y bajadas" del periodo (`📈`/`📉`) sobre una muestra de las 60 más baratas |
| `js/ai-chat.js` | `AI_CONTEXT_INSTRUCTION` y el Top 30 incluyen el `IDEESS` y las reglas de formato (fecha `dd-mm-aaaa`, 3 decimales) para que la IA cite la estación y la fecha |

### 🧪 Verificación

- Suite completa: **139 tests** (0 fallos).
- Clave NVIDIA validada contra la API real: 82 modelos en el catálogo; el Worker se probó localmente (preflight 204, `/v1/models` 200, chat 200 y 404 propagado).
- El Service Worker queda descartado como causa del fallo de CORS: registrando y desregistrando el SW el resultado es idéntico.

---

## [2026-09-27] — Chat IA: LLM7.io (sin clave) + catálogo de modelos automático

### 🆕 Proveedor LLM7.io

| Cambio | Detalle |
|--------|---------|
| `js/ai-chat.js` | Nuevo `AI_PROVIDERS.llm7`: `api.llm7.io/v1`, **clave opcional** (`keyOptional` + `anonymousKey: 'unused'`), sin entrada en `AI_KEY_PREFIXES` ni clave cifrada |
| `js/ai-chat.js` | `listModelsNoAuth: true`: su `GET /v1/models` solo admite `If-None-Match` y `Content-Type` en el preflight, así que se pide sin `Authorization` (con ella devolvía `ERR_FAILED`) |
| `js/ai-chat.js` | `parseModels()` filtra `tier === 'turbo'` (los `pro` dan 403 sin suscripción) y excluye `DeepSeek-V4-Flash-0731` (turbo pero 401) |
| `index.html` | Pestaña y panel `.ia-provider-panel[data-iapanel="llm7"]`, con `#iaKeyLlm7` opcional |
| — | `fetchAiModels()` hace `await parse.call(config, data)`: sin el `await` fallaba con `.filter is not a function` en todo proveedor con `parseModels` propio, y sin `.call` se perdía `this.unavailable` |

### 🔄 Catálogo de modelos automático

| Cambio | Detalle |
|--------|---------|
| `js/ai-chat.js` | `refreshAiModels(provider, {force})` con caché en `localStorage` (`gasolineras_ai_models`, TTL 24 h) |
| `js/ai-chat.js` | `populateAiModelSelect()` une catálogo remoto + lista fija sin duplicar y conserva la selección; si el modelo desaparece lo marca "⚠️ no disponible" y `warnAiModelUnavailable()` ofrece refrescar |
| `js/ai-chat.js` | `AI_MODEL_ERROR_RE` distingue "el modelo ya no existe" de red/401/429/500 (un 429 no debe borrar la selección) |
| `js/main.js` | `initAiModelRefreshButtons()` + `autoRefreshAiModels()` al cargar y al abrir la pestaña de un proveedor |
| `css/styles.css` | Estilos de `.ia-msg.info`, `.ia-msg.warn`, `.ia-warn-btn`, `.ia-refresh-btn`, `.ia-models-count` |

### 🐞 Correcciones

- `AI_NON_CHAT_RE`: se quitó `nemo-` del filtro, que colgaba también de `mistral-Nemo-Instruct-2407` (un modelo de chat válido de LLM7). Los NeMo de NVIDIA siguen fuera por `embed`/`parse`.
- `AI_MODEL_ERROR_RE` reconoce el mensaje real de LLM7 (`Model 'x' is currently unavailable.`), que antes caía en error genérico en vez de ofrecer el botón de refresco.

### 🧪 Verificación

- Suite completa: **114 tests** (0 fallos), nueva sección 15 de Chat IA.
- E2E real contra `api.llm7.io` sin clave: catálogo de 4 modelos, caché reutilizada sin peticiones y respuesta correcta con datos de la provincia.

---

## [2026-09-26] — Chat IA: claves cifradas por proveedor + modelos resucitados

### 🔑 Claves de API

| Cambio | Detalle |
|--------|---------|
| `js/ai-chat.js` | `AI_KEY_PREFIXES` + `isAiKeyFormatValid()`: validación de prefijo **por proveedor** (`google`→`AIza`, `groq`→`gsk_`, `mistral`→`cMHt`, `openrouter`→`sk-or-v1-`) |
| `js/ai-chat.js` | `tryDecryptDefaultKeys()` ahora devuelve `{ keys, invalid }`; devuelve `null` solo si **ningún** descifrado es válido (= contraseña incorrecta) |
| `js/ai-chat.js` | `handleLoadDefaultKeys()` no persiste las claves con formato incorrecto y avisa: *"N clave(s) con formato incorrecto (…)"* |
| `js/ai-chat.js` | `updateAiStatus()` muestra `❌ Formato de clave incorrecto para <provider>` en el panel |
| `js/ai-chat.js` | `saveAiApiKeys()` ignora claves vacías (dejaban la UI creyendo que había claves cargadas) |
| `js/ai-chat.js` | Clave de Google re-cifrada: el blob anterior contenía un token OAuth (`AQ.…`) en vez de una API key `AIza…` |
| `js/ai-chat.js` | Clave de Groq re-cifrada (la anterior devolvía `401 invalid_api_key`) |

Motivo: la validación anterior era una lista global de prefijos (`['AIza','AQ.','gsk_','cMHt','sk-or-']`), así que una clave del proveedor equivocado pasaba el check como "contraseña correcta" y solo fallaba al enviar la petición, sin avisar.

### 🤖 Modelos por proveedor (verificados contra las APIs)

| Proveedor | Antes | Ahora |
|-----------|-------|-------|
| Groq | `llama-3.3-70b-versatile` (404), `llama-4-scout`, `llama-3.1-8b`, `mixtral-8x7b`, `gemma2-9b` | `qwen/qwen3.8-27b` (default), `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `allam-2-7b` |
| Mistral | `mistral-small-latest` (default), `mistral-large-latest` (*not available in your subscription tier*), `open-mistral-nemo` | `open-mistral-nemo` (default), `ministral-8b-latest`, `codestral-latest`, `mistral-small-latest`, `mistral-medium-latest` |
| OpenRouter | `nvidia/nemotron-3-ultra-550b-a55b` (**ya de pago**), `poolside/laguna-m.1` (**no existe**) | `nvidia/nemotron-3-ultra-550b-a55b:free` (default), `nvidia/nemotron-3-super-120b-a12b:free` |
| Google | `gemini-2.5-flash` (*no longer available to new users*), `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` (404) | `gemini-3.8-flash` (default), `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.7-flash` |

- `defaultModel` sincronizado con el primer `<option>` de cada `#iaModel<Provider>` en `index.html`
- `openai/gpt-oss-*` son modelos *reasoning*: pueden devolver `content` vacío al gastar el `max_tokens` en `reasoning`, por eso no son el default de Groq

### 📚 Documentación
| Archivo | Cambio |
|---------|--------|
| `AGENTS.md` | Sección "Validación de formato por proveedor" + modelos verificados + avisos de caducidad |
| `docs/mejoras-petrol.md` | Entrada de esta corrección |

### 🧪 Tests
- 66 tests (59 HTTP + 7 file://) en verde

---

## [2026-07-22] — Search toggle con lupa + responsive compacto

| Cambio | Detalle |
|--------|---------|
| `index.html` | Añadido `#searchToggleBtn` (🔍) en grupo Mapa con separador `.filter-sep`; `.search-row` empieza oculto (`.hide`) |
| `css/styles.css` | Nuevo `.filter-sep` (línea vertical 1px); `.search-row.hide`; responsive: actions-group ya no fuerza fila completa (`flex: 0 1 auto`), min-width reducidos, padding/gaps más ajustados, leyenda precios más pequeña, rango medio oculto en ≤480px, separador oculto en ≤768px |
| `js/main.js` | Event listener `#searchToggleBtn` toggle search row; reset filtros también oculta search row y botón 🔍 |
| `docs/test/full_test.mjs` | Tests actualizados: click en 🔍 antes de verificar input visible |
| `docs/test/validate.mjs` | Ídem |
| `AGENTS.md` | Nueva sección "Search toggle (🔍)", actualizado orden toolbar, test count 63, reset filtros |

---

## [2026-07-18] — Logs API/Push con tabs y registro detallado

### ✅ Registro de actividad (tabs API/Push)

| Cambio | Detalle |
|--------|---------|
| `index.html` | Tarjeta "Registro de llamadas API" reemplazada por "Registro de actividad" con tabs `.config-log-tab` (API/Push) |
| `css/styles.css` | Estilos `.config-log-tab`/`.config-log-panel` (mismo diseño que cache tabs) |
| `js/storage.js` | Nueva función `initLogTabs()` para manejar cambio entre tabs |
| `js/helpers.js` | Nueva función `formatLogTime()` — formato `dd/mm/yy hh:mm:ss` |

### ✅ Push Log — registro detallado de eventos

| Cambio | Detalle |
|--------|---------|
| `js/push-notifications.js` | Nuevo array `PUSH_LOG[]` + funciones `logPushEvent()`, `renderPushLog()`, `clearPushLog()` |
| `js/push-notifications.js` | Instrumentadas `requestNotificationPermission()`, `subscribeUserToPush()`, `unsubscribeUserFromPush()` con logs |
| `js/push-notifications.js` | Subscribe loguea endpoint completo + claves p256dh y auth |
| `js/main.js` | Log de: toggle 🔔 bajada/subida, toolbar, estado inicial, checkInterval, priceFallDays, PeriodicSync, setInterval, test notifications |
| `js/main.js` | SW message handler extiende para recibir `push-log` events |
| `sw.js` | Nueva función `sendPushLog(event, detail)` envía eventos al cliente via postMessage |
| `sw.js` | `checkPrices()` con log por estación: skip/alerta/motivo, texto exacto de notificación |
| `sw.js` | `periodicsync`, `trigger-price-check`, `push`, `notificationclick` con motivo y detalles |
| `js/api.js` | Timestamps cambiados a `formatLogTime()` |

### ✅ Tests

| Archivo | Cambio |
|---------|--------|
| `docs/test/full_test.mjs` | 49 tests — sin regresiones |

---

## [2026-07-17] - Push SW-Based + Tests + Cleanup

### ✅ Cambios en Push Notifications (v2)

**Arquitectura**: Toda la lógica de chequeo ahora corre en el Service Worker, no en el cliente.

| Cambio | Detalle |
|--------|---------|
| `sw.js` | `checkPrices()` con fetch directo a API + comparación + notificación |
| `sw.js` | `importScripts('js/state.js', 'js/helpers.js', 'js/db.js')` |
| `sw.js` | Fix URL matching en `notificationclick` (`new URL(client.url).pathname`) |
| `sw.js` | Añadido handler `push` + handler `message` |
| `sw.js` | `clients.openWindow` usa scope del SW en vez de `/` hardcodeado |
| `js/db.js` | NUEVO: Funciones IndexedDB compartidas (cliente + SW) |
| `js/db.js` | Store `favorites` con `{ id, provinceName, provinceId, brand }` |
| `js/db.js` | Store `config` con configuración push |
| `js/helpers.js` | `comparePrices()` como función pura |
| `js/helpers.js` | Eliminado `checkFavoritePrices()` (movido a SW) |
| `js/controls.js` | `toggleFavorite()` escribe en IndexedDB |
| `js/push-notifications.js` | Eliminado timeout de 3s en `subscribeUserToPush()` |
| `js/push-notifications.js` | `unsubscribeUserFromPush()` desregistra `periodicSync` |
| `js/main.js` | `setInterval` fallback envía `postMessage` al SW |
| `js/main.js` | Push config sincronizada con IndexedDB (`setPushConfig()`) |
| `js/main.js` | Botón test envía `trigger-price-check` al SW |
| `js/main.js` | Eliminado listener `trigger-price-check` (lo maneja SW) |
| `js/storage.js` | Ahora usa `db.js` para IndexedDB (eliminados duplicados) |
| `js/storage.js` | Versión DB actualizada a v2 (nuevos stores) |
| `index.html` | Añadido `js/db.js` en orden de carga |

### 🗑️ Archivos eliminados

| Archivo | Motivo |
|---------|--------|
| `plan-push.md` | Plan de implementación obsoleto |
| `.env` / `.env.example` | VAPID private key sin uso (no hay backend) |
| `docs/test/debug_test.mjs` | Debug temporal, duplicado de full_test.mjs |
| `docs/test/debug2.mjs` | Ídem |

### ✅ Tests

| Archivo | Cambio |
|---------|--------|
| `docs/test/TEST_PLAN.md` | Nueva sección 14 (10 tests push) |
| `docs/test/full_test.mjs` | Tests 14.1–14.10 implementados |

### 📚 Documentación

| Archivo | Cambio |
|---------|--------|
| `docs/PUSH_NOTIFICATIONS.md` | Reescrita: nueva arquitectura SW-based |
| `docs/PUSH_NOTIFICATIONS_QUICK_START.md` | Actualizada con nuevo flujo |
| `AGENTS.md` | Sección Push actualizada |

---

## [2026-07-11] - Code Review Fixes

### 🐛 Bugs Corregidos

#### `checkFavoritePrices()` — `self.registration.showNotification()` en página
- **Síntoma**: TypeError al mostrar notificación porque `self.registration` solo existe en Service Worker
- **Solución**: Reemplazado por `navigator.serviceWorkerContainer.ready.then(r => r.showNotification(...))`

#### `checkFavoritePrices()` — Comparación incorrecta de precios
- **Síntoma**: Comparaba `oldestPrice` vs `latestPrice` (ambos del histórico) en vez de `currentPrice` vs `oldestPrice`
- **Solución**: Ahora compara el precio actual (de `STATE.data`) con el más antiguo del histórico

#### `checkFavoritePrices()` — Código muerto
- **Síntoma**: Variable `currentData` construida con fetch + parse HTML pero nunca usada
- **Solución**: Eliminado bloque de fetch/parse HTML redundante

#### `push-notifications.js` — `navigator.serviceWorker.controller` null
- **Síntoma**: TypeError si el SW no ha activado aún
- **Solución**: Añadido null check antes de acceder a `pushManager`

## [2026-07-11] - Push Notifications & Bug Fixes

### ✅ Implementado

#### Push Notifications (Nuevo)
- **Web Push API** con Periodic Background Sync para Android
- **Configuración flexible**:
  - Intervalo de chequeo: 1-24 horas (default 8)
  - Umbral de caída de precio: 0-90 días (default 3)
  - Habilitar/deshabilitar desde UI (Config tab)

#### Archivos Nuevos
- `js/push-notifications.js` - Gestión suscripción Web Push
- `docs/PUSH_NOTIFICATIONS.md` - Documentación técnica completa
- `.env` / `.env.example` - VAPID keys

#### Modificaciones

**`js/state.js`**:
```javascript
pushNotificationsEnabled: false
checkInterval: 8          // horas
priceFallDays: 3          // días
```

**`sw.js`**:
- Event `periodicsync` con tag 'check-favorite-prices'
- Event `notificationclick` para abrir app al click

**`js/main.js`**:
- Restauración de estado push notifications
- Event listeners para botón 🔔 y inputs de config
- `registerPeriodicSync()` para registrar background sync
- `updatePushNotifStatus()` para actualizar UI
- ⚠️ **FIX CRÍTICO**: Cerrado evento `DOMContentLoaded` con `});`

**`js/helpers.js`**:
- Función `checkFavoritePrices()` - chequea precios favoritos vs histórico

**`index.html`**:
- Botón 🔔 en toolbar
- Config card con toggle + inputs + status indicator

**`js/storage.js`**:
- Persistencia de checkInterval, priceFallDays, pushNotificationsEnabled

**`AGENTS.md`**:
- Documentación arquitectura push notifications
- Debugging guide
- Tabla de archivos actualizada

### 🐛 Bugs Corregidos

#### DOMContentLoaded Event Not Closing
- **Síntoma**: Página no cargaba, error JavaScript durante carga
- **Causa**: Faltaba cerrar el evento `DOMContentLoaded` en `main.js` con `});`
- **Solución**: Agregado cierre correcto
- **Impacto**: Crítico - bloqueaba carga de toda la app

### 📋 Verificación

```powershell
# Tests
node docs/test/full_test.mjs

# Validación manual
# 1. Abrir http://file:///e:/Temp/VS/petrol/index.html
# 2. Verificar carga sin errores
# 3. Click 🔔 en toolbar
# 4. Verificar subscription en localStorage (DevTools)
# 5. Modificar checkInterval/priceFallDays
# 6. DevTools → Application → Service Workers → Periodic Sync → Dispatch
```

### 📚 Documentación

Ver:
- [docs/PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) - Arquitectura técnica
- [AGENTS.md](../AGENTS.md) - Push Notifications section
- Inline comments en `js/push-notifications.js`

### ⏭️ Próximos Pasos

1. ✅ Testing full ciclo en Android device (requiere HTTPS + PWA real)
2. ✅ Validar Notification Permission flow
3. ✅ Testing Periodic Background Sync real (8+ horas)
4. ✅ Optimization: cache histórico para reducir fetches

### 🔐 VAPID Keys

Generadas con `web-push`:
```env
VAPID_PUBLIC_KEY=BDpoYD9azs5I8SHt23Gx8BMJ6d2q1ghIluak4flDh7a2lfKIS_3tn9QFh8gaQQeG4kTYYnEl5e3S1btbH1hbNQs
VAPID_PRIVATE_KEY=aEJXkt8jYoQG8Nl9u7w--yR34ekMEh8MeHWmsfQKjm8
```

- Public key: Hardcoded en push-notifications.js
- Private key: Para backend (si aplica)

---

## Release Notes

**Compatible with**:
- Chrome/Edge 50+
- Android Chrome 50+
- Firefox 48+
- Safari 16+

**Requires**:
- Service Worker support
- Notification API
- IndexedDB (favoritos)
- localStorage (configuración)
- HTTPS (PWA requirement) - excepto file:/// para testing local

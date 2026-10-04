# Mejoras realizadas — Precios Gasolina España

## 2026-10-04 — NVIDIA deja de fallar con un NetworkError y te dice qué URL poner

### Por qué hacía falta
`AI_PROXY_NVIDIA_DEFAULT = 'https://petrol-nvidia-proxy.workers.dev'` **no puede existir**: Cloudflare publica cada Worker como `<worker>.<subdominio-de-la-cuenta>.workers.dev`, así que el valor de ejemplo solo tiene tres etiquetas y su host nunca resuelve. El chat de NVIDIA moría siempre con *"NetworkError when attempting to fetch resource"* y el mensaje de ayuda devolvía un placeholder literal (`https://petrol-nvidia-proxy..workers.dev`, el `<tu-subdominio>` vacío), que no sirve de nada si no tienes cuenta de Cloudflare — y sin cuenta no hay despliegue posible.

### `aiProxyUrlIssue()` — validar antes de hacer fetch
- Motivos: `nourl`, `placeholder` (lo de `<…>` de la documentación), `invalid` (URL que ni el parser acepta; Chromium percent-codifica los espacios en vez de fallar, `mi%20proxy`, y eso tampoco resuelve) y `nosubdomain` (`*.workers.dev` con tres etiquetas).
- Se comprueba **antes** de cualquier petición, así que no se gasta un fetch a un host imposible:
  - `aiProviderUrl()` lanza con el motivo (fuera del `try` del `send()` de NVIDIA, para que `aiFetchError()` no le añada el sufijo `— proxy: …`)
  - `aiProxyDiagnostics()` devuelve `kind: 'invalidurl'` + `issue` sin llegar a la red → el botón 🔎 Probar explica qué pegar
  - `isAiProviderReady('nvidia')` devuelve `false`, así que el chat avisa en vez de enviar y `refreshAiModels()` responde `nokey` con **0 fetch**
  - `updateAiStatus()` muestra `⚠️ URL sin el subdominio de tu cuenta — ve a Config → IA` en vez de `✅ Proxy por defecto`
  - `autoRefreshAiModels()` rotula el desplegable con el motivo en vez de dejarlo mudo
- `markAiProxyUrlInput()` pinta el campo de Config en rojo/verde según la URL, con el motivo en el `title`.
- `AI_PROXY_NVIDIA_SHAPE = 'https://petrol-nvidia-proxy.mi-cuenta.workers.dev'` sustituye al placeholder en todos los mensajes: `mi-cuenta` se lee como ejemplo, no como algo que copiar.
- El botón ↺ y el valor de ejemplo se mantienen; lo que cambia es que ya no se envían peticiones ni se muestran estados verdes falsos.
- Config → IA explica que la URL por defecto es un ejemplo, que hace falta una cuenta de Cloudflare (gratuita) y que el resto de proveedores no dependen de nada de esto.

### Tests
- 174 tests (167 HTTP + 7 file://) en verde, 11 nuevos: detección de cada motivo de URL inválida (incluido el caso de Chromium que percent-codifica espacios), NVIDIA no listo + 0 fetch con el valor de ejemplo, errores del chat y del catálogo con el motivo en vez de `NetworkError`, `🔎 Probar` sin red para ejemplo/placeholder, estado y color del campo de Config.

---

## 2026-10-04 — Un solo motor de gráficas, un solo histórico y precaché que se autogenera

### Por qué hacía falta
El histórico de precios estaba implementado **tres veces**: en `api.js` para la página, en `sw.js` para el chequeo de push y con otro comparador de fechas dentro del chat de IA. Las dos gráficas (detalle y popup del mapa) tenían el mismo código de canvas duplicado, incluido el tooltip. Y el precaché del Service Worker estaba escrito a mano, así que se desincronizó por dos veces.

### `js/history.js` — fuente única del histórico
- Descarga, caché y serie por estación en un solo fichero, importado por el SW con `importScripts`, lo que **prohíbe** que el cliente y el SW vuelvan a divergir.
- `sortHistoryDates()` sustituye a los dos comparadores que había: el del SW usaba `new Date(ya, …)` sin el unary `+`, así que ordenaba mal los años de dos cifras y el histórico de push comparaba precios de fechas desordenadas.
- `historyRequest()` delega en `apiFetch()` cuando existe (la descarga queda en el log de la API) y cae a un `fetch` simple en el SW, que no tiene esa función.
- Se borran ≈90 líneas del SW y ≈100 de `api.js`. `fetchProvinceHistory()` se queda en `api.js` porque solo sabe resolver el nombre de la provincia a su id.

### `js/chart-core.js` — un solo motor de gráficas
- Primitivas compartidas por `chart-engine.js` (detalle) y `map.js` (popup): `chartSetupCanvas()`, `chartScale()`, `chartAxes()`, `chartMinMax()`, `chartIndices()` y `drawTooltip()`.
- `chartSetupCanvas()` además **cae a los atributos `width`/`height`** cuando el canvas todavía no tiene layout (pestaña oculta): antes la gráfica medía 0 y no se veía hasta cambiar de tab.
- `chartIndices()` decide qué fechas llevan etiqueta, así las etiquetas no se solapan ni en 60 días ni en el popup de 7.
- El tooltip era una copia literal de 40 líneas en `map.js`: ahora es `drawTooltip()`.

### `createRingLog()` — los dos logs con la misma estructura
- Un buffer circular con `push()`/`all()`/`clear()`/`load()` sustituye a los arrays con `unshift` + recorte manual de `API_LOG[]` y `PUSH_LOG[]`.
- `all()` devuelve copia, que es lo que evita que el render o la persistencia muten el log por accidente.
- `load()` recorta a `max` al restaurar, que es justo lo que pasa con los 45 registros sembrados en el test.

### Precaché autogenerado
- `scripts/sync-sw-assets.mjs` reconstruye `ASSETS` desde `index.html` + `manifest.json` y **falla con error** si algún `importScripts` del SW no queda precacheado (pasó con `js/ai-chat.js`: el SW arrancaba sin sus funciones).
- `npm run bump` regenera la lista y sube `APP_VERSION` en el mismo paso, así que añadir un script no obliga a recordar dos cosas.
- `npm run check-assets` verifica sin escribir, y un test de la suite falla si la lista queda desfasada.
- El sync ahora lee también `manifest.json`, que es donde se declara `icons/icon-512.svg`: `index.html` no lo referencia y el icono se había caído del precaché.

### Bugs que salieron por el camino
- **"Limpiar caché" no borraba nada**: `dbGetAllKeys()`/`dbDelete()` se llamaban sin el nombre del store, IndexedDB lanzaba `NotFoundError` y el `catch` lo comía. Ahora el nombre del store es obligatorio en la firma documentada y hay un test que siembra claves y comprueba que desaparecen.
- **El log de push estaba muerto**: al migrarlo al ring quedó una línea que tocaba el array viejo → `ReferenceError` en cada evento.
- **Los logs no volvían tras F5**: la restauración buscaba `window.API_LOG_RING`, pero las `const` de nivel superior de un script clásico no cuelgan de `window`.

### Tests
- 163 tests (156 HTTP + 7 file://) en verde, 10 nuevos: 7 de ring logs (recorte, copia, `load()`, orden de render, persistencia y restauración) y 3 de build (cobertura de `ASSETS`, precaché de lo que importa el SW y formato de `APP_VERSION`/`BUILD_TIME`).
- `node check-syntax.mjs` valida 19 ficheros, incluidos los dos scripts y los `<script>` inline del HTML.
- `docs/test/TEST_PLAN.md` actualizado a 163 tests y con las secciones 16 (ring logs) y 17 (build). `docs/test/validate.mjs` queda **marcado como legado**: usaba los `data-tab` en camelCase (`tabMap`) y habría dado falsos fallos; la suite que se mantiene es `docs/test/full_test.mjs`.
- `docs/API.md` corregido: el histórico va en la ruta con **`dd-mm-aaaa`**, no con barras (comprobado contra la API real: `FiltroProvincia/28-09-2026/28` responde 200 y `FiltroProvincia/28/09/2026/28` responde 404).

---

## 2026-09-27 — La app te dice si la URL del proxy de NVIDIA es la buena

### Por qué hacía falta
La URL por defecto (`https://petrol-nvidia-proxy.workers.dev`) casi nunca es la buena: Cloudflare da a cada cuenta su propio subdominio de `workers.dev`, así que lo que imprime `wrangler deploy` es `https://petrol-nvidia-proxy.<tu-subdominio>.workers.dev`. Con la URL equivocada el chat moría con un seco "Failed to fetch" y el catálogo no cargaba, sin decir qué mirar.

### 🔎 Botón "Probar" en Config → IA
- `aiProxyDiagnostics(provider, urlOverride)`: un `GET /v1/models` que **no gasta tokens** y devuelve una explicación por cada resultado posible:
  - `dns` — no se pudo ni conectar: ese host no existe, con la forma de URL que hay que pegar
  - `notfound` — el host responde pero no hay Worker detrás (subdominio equivocado)
  - `nokey` — el Worker existe pero sin `NVIDIA_API_KEY`
  - `badauth` — NVIDIA rechazó la clave (401/403), típico tras rotarla sin volver a publicarla
  - `quota` — 429: el proxy está bien, es cuota
  - `ok` — "el proxy responde con N modelos"
- Botón `iaProxyTestBtn` + estado `iaProxyTestStatus`. Si responde bien, guarda la URL, actualiza el estado del panel e invalida el catálogo de modelos.

### Errores descriptivos en los dos caminos
- `aiFetchError()` en el `send()` de NVIDIA: si el host no responde, el mensaje pasa de "Failed to fetch" a "No se pudo conectar con el proxy de NVIDIA en <url> … la URL que imprime wrangler deploy tiene esta forma: …".
- `fetchAiModels()` con `viaProxy` diagnostica antes de propagar, así que el fallo del catálogo también explica la causa.
- El botón ↺ Usar la predefinida y el valor por defecto se mantienen: solo se añadieron la comprobación y los mensajes.

### Tests
- 152 tests (145 HTTP + 7 file://) en verde. Nuevos: las 5 clasificaciones del diagnóstico, que exista el botón y su cuadro de estado, y que tanto el chat como el catálogo devuelvan un error descriptivo en vez de "Failed to fetch".

---

## 2026-09-27 — El histórico de la IA usa los mismos rangos y datos que el modal

### Rango de días dinámico (7 a 180)
- `HISTORY_DAYS_OPTIONS = [7, 14, 21, 30, 60, 90, 180]` en `js/state.js`: la lista oficial de la app, la misma que los combos del modal de detalle y del popup del mapa.
- `resolveAiHistoryDays()` respeta el rango que pidas en la pregunta (`60 días`, `21 jornadas`, `6 semanas` ×7, `3 meses` ×30, `1 año`/`semestre` → 180), lo acota al rango de la app y, si no dices nada, usa el que tengas seleccionado en el modal (`STATE.historyDays`).
- `wantsStationHistory()` ahora también dispara con un rango explícito, así que "¿cuál era el precio hace 3 meses?" ya no se queda sin datos.
- Antes el chat pedía siempre 14 días como mínimo; con 60 días descargas 60 fechas y al preguntar por 7 días **no vuelve a descargar**: recorta la caché en memoria.

### Los mismos datos que la gráfica del modal
- `getAiHistoryData()` reutiliza `window._historyCache` (lo que cargan el modal de detalle y el popup del mapa) si cubre el rango, y guarda `window._aiHistoryCache` para ampliarlo sin repetir peticiones.
- `stationSeries()` llama a `getStationHistory()`, la misma función que dibuja la gráfica, con lo que hereda los grupos de combustibles; `aiHistoryFuelName()` usa el combustible del modal si está abierto y si no el filtro de la app.
- `sortHistoryDates()` en `js/api.js`: las fechas del Ministerio son `dd-mm-aaaa` y un `sort()` normal las desordena ("29-08" > "01-09"), lo que alteraba mínimos y máximos. El comparador correcto se comparte con `getStationHistory()`.
- El bloque del periodo indica el rango usado y si lo pediste tú o viene del combo del modal, y cada estación incluye el precio actual con tu descuento por marca.
- Corregidas las flechas del periodo: `📉` para la mayor bajada y `📈` para la mayor subida (estaban al revés).

### NVIDIA con URL predefinida
- `AI_PROXY_NVIDIA_DEFAULT = 'https://petrol-nvidia-proxy.workers.dev'`: si no has configurado nada, el proveedor funciona sin tocar Config; el botón **↺ Usar la predefinida** (`iaProxyResetBtn`) la restablece y vuelve a invalidar el catálogo.
- El estado del proveedor distingue "Proxy por defecto (cámbialo en Config → IA)" de "Proxy configurado". Recuerda: si `wrangler deploy` devuelve una URL con subdominio, hay que copiarla al campo `iaProxyNvidia`.

### Tests
- 147 tests (140 HTTP + 7 file://) en verde. Nuevos: parsing de rangos ("60 días", "21 jornadas", "6 semanas", "3 meses", "1 año", recorte a 7–180), coincidencia de `HISTORY_DAYS_OPTIONS` con los combos del modal y del popup, rango pedido llegando al contexto, recorte sin peticiones nuevas, combustible del modal y orden correcto de fechas.

---

## 2026-09-27 — NVIDIA NIM vía Cloudflare Worker + histórico detallado en el chat IA

### NVIDIA con proxy propio
- `workers/nvidia-proxy.js` (nuevo): solo reenvía `POST /v1/chat/completions` y `GET /v1/models`, responde al preflight con 204 y propaga los errores de NVIDIA (401/404/429) para que la app distinga cuota de modelo retirado. La clave viaja como secreto `NVIDIA_API_KEY`; el navegador no la ve.
- `workers/wrangler.toml` (nuevo): nombre del Worker y `ALLOWED_ORIGIN` opcional (sin él responde `*`, necesario si la app se abre desde `file://`, `localhost` o cualquier hosting).
- `AI_PROVIDERS.nvidia`: `viaProxy: true` con rutas **relativas** (`/v1/chat/completions`, `/v1/models`) resueltas por `aiProviderUrl()` contra la URL guardada en `gasolineras_ai_nvidia_proxy`.
- `isAiProviderReady('nvidia')` depende de la URL, no de una clave: sin proxy el chat avisa y `refreshAiModels()` no llama a nada.
- Config → IA: campo `iaProxyNvidia`; al cambiarlo se normaliza (`https://` añadido, barra final quitada) y se invalida el catálogo cacheado.
- 7 modelos de chat verificados: Nemotron 3 Ultra 550B (default), Nemotron 3 Super, Nemotron 3.5 Lightning, `moonshotai/kimi-k3`, `z-ai/glm-5.3`, `z-ai/glm-5.3-flash`, `openai/gpt-oss-20b`. `max_tokens: 2048` porque varios son *reasoning*.

### El modelo ya puede consultar el histórico de las gasolineras
- `wantsStationHistory()` decide si se descarga el histórico: `true` si la pregunta usa palabras clave (`AI_HISTORY_WORDS`: historial, evolución, tendencia, antes, subida, mínimo, gráfica, cuándo…) **o** si nombra la marca de alguna estación cargada. Con `false` no se lanza ninguna petición.
- `buildAiHistoryLines()` genera la sección `=== HISTÓRICO DE PRECIOS` con:
  - periodo real disponible y el aviso de que un día sin precio no significa precio constante,
  - **provincia**: media/mín/máx/nº de estaciones y la más barata de las últimas 10 jornadas, tendencia en €/L y % y el mínimo histórico provincial,
  - **por gasolinera** (máx. 12, empezando por las nombradas en la pregunta, luego favoritos y las más baratas): `[IDEESS] marca | localidad | dirección`, serie de hasta 10 precios con fecha y resumen con precio actual, mín/máx con su fecha, media, variación en €/L y % y nº de días con precio,
  - **mayores subidas y bajadas** del periodo con `📈`/`📉`.
- `AI_CONTEXT_INSTRUCTION` y el `Top 30` incluyen ahora el `IDEESS`, para que la IA pueda citar la estación concreta.
- `fmtEur()` formatea a 3 decimales con coma (precios y porcentajes).

### Tests
- 139 tests (132 HTTP + 7 file://) en verde. Nuevos: proxy de NVIDIA (normalización de URL, ausencia de clave en el navegador, envío y catálogo vía proxy, 404 propagado, invalidación al cambiar la URL) y contexto histórico (serie con fecha, mín/máx/media/variación, favoritos incluidos, subidas y bajadas, y que sin palabras clave no se pida histórico).

---

## 2026-09-27 — Chat IA: LLM7.io integrado + auto-refresh del catálogo de modelos

### Criterio: CORS medido en navegador real, no con `curl`
La app es una PWA estática sin backend, así que un proveedor solo sirve si el
navegador acepta su preflight. Se comprobó con Chromium (preflight `OPTIONS` +
petición real con `Origin`) y **el Service Worker se descartó como causa**:
registrando y desregistrando el SW el resultado fue idéntico.

### Descartados por CORS en llamada directa (el navegador rechaza el preflight)
| Proveedor | Endpoint | Preflight |
|-----------|----------|-----------|
| NVIDIA NIM | `integrate.api.nvidia.com/v1` | sin `access-control-allow-origin` → **resuelto con Worker** (ver más abajo) |
| Cerebras | `api.cerebras.ai/v1` | sin CORS |
| Chutes | `llm.chutes.ai/v1` | sin CORS |
| Z.ai (Zhipu) | `api.z.ai/api/paas/v4` | sin CORS |
| SambaNova | `api.sambanova.ai/v1` | `allow-origin: null` |
| Cloudflare Workers AI | `api.cloudflare.com/client/v4/.../ai/run` | sin CORS |
| Pollinations | `text.pollinations.ai/openai` | responde, pero Turnstile en el navegador |

### NVIDIA NIM: viable con proxy propio
Su gateway solo devuelve `Access-Control-Allow-Origin` para el origen
`https://build.nvidia.com`, así que la llamada directa desde la app es
imposible (comprobado con `OPTIONS` y en Chromium real). Como la app no tiene
backend, la solución es un Cloudflare Worker (`workers/nvidia-proxy.js`):

| Pieza | Dónde | Contenido |
|-------|-------|-----------|
| Worker | `workers/nvidia-proxy.js` | reenvía solo `/v1/chat/completions` y `/v1/models` con el secreto `NVIDIA_API_KEY`; el navegador nunca ve la clave |
| Config | `wrangler.toml` | nombre del Worker; `ALLOWED_ORIGIN` opcional para limitar qué orígenes lo usan |
| App | `AI_PROVIDERS.nvidia` | `viaProxy: true` + rutas relativas; la URL se guarda en `gasolineras_ai_nvidia_proxy` y se pide en Config → IA |

Despliegue: `wrangler secret put NVIDIA_API_KEY` y `wrangler deploy`. La clave
nunca se escribe en el repo. Catálogo verificado (82 modelos), 7 de chat
verificados: Nemotron 3 Ultra/Super/3.5 Lightning, `moonshotai/kimi-k3`,
`z-ai/glm-5.3`, `z-ai/glm-5.3-flash`, `openai/gpt-oss-20b`.

### Viable sin backend
| Proveedor | Endpoint | Clave | Notas |
|-----------|----------|-------|-------|
| **LLM7.io** (integrado) | `api.llm7.io/v1` | **opcional** | 64 modelos, sin signup |
| HuggingFace | `router.huggingface.co/v1` (`hf_`) | sí | $0.10/mes de crédito, 100k+ modelos OSS |
| SiliconFlow | `api.siliconflow.cn/v1` (`sk-`) | sí (requiere SMS) | Qwen / DeepSeek / GLM a $0 |

### LLM7.io: quirks descubiertos contra la API real
1. **La clave es opcional.** Sin ella se manda el literal `Bearer unused` y se
   accede en modo anónimo (500k tokens/24 h, 1 req/s, 10/min, 60/h). Con un
   token gratuito de `dash.llm7.io` el límite sube a 1M/día. Por eso es el
   único proveedor sin prefijo obligatorio en `AI_KEY_PREFIXES`.
2. **`GET /v1/models` solo admite `If-None-Match` y `Content-Type` en el
   preflight.** Si se manda `Authorization` el navegador responde `ERR_FAILED`.
   El catálogo es público, así que se pide sin cabecera (`listModelsNoAuth`) y la
   clave se reserva para el chat, cuyo `POST` sí admite `authorization`.
3. **Solo los modelos `tier: "turbo"`** son accesibles sin pagar: los `pro`
   (claude, gpt-5.5, kimi-k3...) devuelven 403. `/models` marca el tier, así que
   `parseModels()` filtra por él y el desplegable no se llena de 59 modelos
   rotos.
4. **`DeepSeek-V4-Flash-0731` figura como `turbo` pero devuelve 401** aunque la
   clave sea válida, así que está en la lista de ids excluidos.
5. **`GLM-5.3-Flash` y `minimax-m2.7` son *reasoning*:** con pocos tokens
   devuelven contenido vacío. Se piden `max_tokens: 1024` y, si aun así llega
   `reasoning_content` sin contenido, se avisa en vez de dejar el chat en blanco.

### Auto-refresh del catálogo
Los modelos gratuitos rotan con mucha frecuencia, así que el catálogo se
descarga en vez de depender solo de la lista fija:
- Caché en `localStorage` (`gasolineras_ai_models`) con TTL de 24 h. Con caché
  válida no se vuelve a pedir, y el botón 🔄 fuerza la descarga.
- El desplegable une catálogo remoto + lista fija, sin duplicar, y **conserva la
  selección**. Si el modelo elegido desaparece, se marca con "⚠️ no disponible"
  sin cambiar lo seleccionado.
- Si `/models` falla (500 o red caída) se avisa **sin romper el desplegable**:
  los errores de red, 401 y 429 no se confunden con "el modelo ya no existe"
  (ver `AI_MODEL_ERROR_RE`), porque un 429 no debe borrar la selección.

---

## 2026-09-26 — Chat IA: claves por proveedor + modelos resucitados

### Diagnóstico: por qué fallaban los chats
Las cuatro claves fallaban, pero por **motivos distintos**. El cifrado (XOR + base64) nunca estuvo roto: la contraseña es correcta y 3 de 4 blobs descifraban bien. Los fallos eran de las **claves** y de los **modelos** configurados:

| Proveedor | Clave | Resultado real |
|-----------|-------|----------------|
| Groq | `gsk_…` (antigua) | `401 invalid_api_key` — revocada |
| Google | prefijo `AQ.` | `401 UNAUTHENTICATED` — era un token OAuth, no una API key `AIza…` |
| Mistral | prefijo `cMHt` | Válida, pero `429 Rate limit exceeded` intermitente |
| OpenRouter | prefijo `sk-or-v1-` | Correcta |

### Validación de formato por proveedor
- El check anterior usaba una lista **global** de prefijos (`['AIza','AQ.','gsk_','cMHt','sk-or-']`). La clave OAuth de Google empezaba por `AQ.`, así que pasaba como "contraseña correcta" y se guardaba: el error solo aparecía al enviar.
- Ahora `AI_KEY_PREFIXES` + `isAiKeyFormatValid()` validan **por proveedor**, `tryDecryptDefaultKeys()` devuelve `{ keys, invalid }` y `null` únicamente si ningún descifrado es válido (contraseña incorrecta).
- Las claves con formato incorrecto no se persisten, y el panel del proveedor avisa: `❌ Formato de clave incorrecto para google (debe empezar por AIza)`.
- `saveAiApiKeys()` ya no guarda claves vacías (dejaban la UI diciendo "claves cargadas" sin ninguna).

### Modelos: 11 de 15 estaban muertos
Verificados uno a uno contra las APIs (`/models` + llamada de chat real):

- **Google**: los 4 fallaban. `gemini-2.5-flash` → *"no longer available to new users"*; `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` → 404. Ahora `gemini-3.8-flash` (default), `3.5-flash`, `3.5-flash-lite`, `3.7-flash`.
- **OpenRouter**: `poolside/laguna-m.1` no existe y `nemotron-3-ultra-550b-a55b` (sin sufijo) **ya cobra** (0.0000006/0.0000024). Ahora solo variantes `:free`.
- **Groq**: los 5 modelos de la lista no existen en la cuenta → 404. Ahora `qwen/qwen3.8-27b` (default) + `gpt-oss`.
- **Mistral**: `mistral-large-latest` → *"not available in your subscription tier"*. Default movido a `open-mistral-nemo`.
- `defaultModel` sincronizado con el primer `<option>` de cada desplegable en `index.html`.
- `openai/gpt-oss-*` son reasoning: devuelven `content` vacío al gastar el `max_tokens` en `reasoning`, por eso no van como default.

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `js/ai-chat.js` | `AI_KEY_PREFIXES`, `isAiKeyFormatValid()`, `tryDecryptDefaultKeys()` → `{keys, invalid}`, `saveAiApiKeys()` con `invalid`, `updateAiStatus()` con aviso, blobs de google y groq re-cifrados, listas de modelos de los 4 proveedores |
| `index.html` | `<option>` de los 4 selectores de modelo sincronizados |
| `AGENTS.md` | Sección de validación por proveedor + modelos verificados |
| `docs/CHANGELOG.md`, `docs/mejoras-petrol.md` | Esta entrada |

### Tests
- 66 tests en verde. Verificado además en navegador real: contraseña incorrecta, contraseña correcta, clave del proveedor equivocado, persistencia tras F5.

### Nota de entorno
`node_modules` estaba vacío (Playwright no resoluble) y el suite fallaba con `exit -1`. Resuelto con `npm install`. Si vuelve a aparecer un crash raro del suite, comprobar el puerto 8080 y que `npm install` esté al día.

---

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

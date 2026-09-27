# AGENTS.md

## Documentación principal

Ver [`README.md`](./README.md) para visión general del proyecto, funcionalidades y stack técnico.

## Workflow obligatorio

1. **Antes de commit, incrementar APP_VERSION** automáticamente:
   ```powershell
   node scripts/bump-version.mjs
   ```
   (Incrementa `APP_VERSION` en `sw.js` para que el SW detecte cambios)

2. **Siempre ejecutar tests completos** tras cualquier cambio:
   ```powershell
   Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
   node docs/test/full_test.mjs
   ```
   Si los tests no existen o fallan, no continuar hasta que pasen todos.

3. **Commit**: preguntar al usuario antes de hacer commit. Si confirma, escribir **siempre un mensaje descriptivo** que resuma los cambios (nunca "fix", "update" o similar genérico). Ejemplo: `"Añade lupa para toggle del filtro de búsqueda y mejora responsive mobile"`.
   ```powershell
   git add -A
   git commit -m "mensaje descriptivo"
   git push
   ```

## Convenios del proyecto

### Tabs (propagación CSS/HTML/JS)
- `data-tab` en HTML usa **kebab-case**: `tab-map`, `tab-table`, `tab-both`, `tab-config`
- CSS clases usan el mismo kebab-case: `.tab-map`, `.tab-table`, `.tab-both`, `.tab-config`
- JS `setActiveTab(tabId)` recibe el mismo kebab-case
- JS comparaciones dentro de `setActiveTab` usan kebab-case

**Si se cambia un tab, actualizar los 3 lugares simultáneamente.**
El test "Clase CSS + panel + botón activo en todas las vistas" detecta mismatch.

### Dropdown marcas
- Posicionado con `position: fixed` + `getBoundingClientRect()` en JS
- En HTML es hijo directo de `.app` (NO anidado en toolbar)
- `z-index: 10000`

### CSS z-index
- Todo elemento con `z-index` debe tener `position: relative` (o fixed/absolute)
- Si se añade un nuevo elemento con z-index, verificar stacking context
- Elementos conocidos con z-index:
  - `.toolbar`: `z-index: 100; position: relative`
  - `.bottom-tabs`: `z-index: 100; position: relative`
  - `.detail-panel`: `z-index: 200; position: absolute`
  - `#brandFilterDropdown`: `z-index: 10000; position: fixed`

### Persistencia estado tras F5
- `loadState()` en `main.js` DEBE restaurar `STATE.selectedProv` ANTES de `setActiveTab()`
- Razón: `setActiveTab()` llama a `saveState()` vía microtask (`Promise.resolve().then()`)
- Si `selectedProv` no se restaura primero, el microtask sobrescribe localStorage con `''`
- `tryAutoRestoreProvince()` (en api.js) lee después de IndexedDB (macrotask) y encuentra el valor borrado

Orden correcto en `main.js`:
```js
if (saved.selectedProv) STATE.selectedProv = saved.selectedProv;
if (saved.activeTab) setActiveTab(saved.activeTab);
```

**Regla general**: cada propiedad guardada en `saveState()` (storage.js) debe tener su restauración correspondiente en `loadState()` (`main.js`). Las que no necesitan restauración en `loadState` se restauran desde `loadProvinceFilters` dentro de `fetchProvinceData()`.

#### Flag `STATE.booting` — segunda barrera

- `STATE.booting` arranca en `true` (`state.js`) y `saveProvinceFilters()` hace `if (!prov || STATE.booting) return;`
- Motivo: el microtask de `saveState()` se dispara en el arranque (vía `setActiveTab()`) y escribía `gasolineras_prov_filters_{prov}` con valores por defecto **antes** de que `loadProvinceFilters()` los leyera. Perdía `showFavoritesOnly`, `selectedBrands` y `search`
- Se pone a `false` en dos sitios de `api.js`: tras restaurar los filtros en `fetchProvinceData()` y en el `catch` de `fetchProvinces()` (para no dejarlo colgado si falla la red)
- **Al añadir una llamada a `saveState()` durante el arranque, restaurar el flag si hace falta**: restaurarla en `loadState()` sigue siendo obligatorio (defensa en profundidad), pero el flag protege el resto de filtros sin tocar `main.js`

### setActiveTab — cierre de paneles
En `controls.js`, `setActiveTab()` cierra automáticamente:
- `#detailPanel` al salir de `tab-table` o `tab-both`
- Popup del mapa (`map.closePopup()`) al salir de `tab-map` o `tab-both`

### Chart tooltip (canvas)
- **chart-engine.js**: `drawPriceChart()` dibuja gráfica + tooltip al hover. Mouse events (`mousemove`/`mouseleave`) buscan el punto más cercano (12px radio) y muestran recuadro oscuro con precio (bold) + fecha debajo.
- **map.js**: `drawPopupPriceChart()` tiene el mismo sistema con `onPopupChartHover`/`drawPopupTooltip`.

### Log de actividad (tabs API / Push)
- Tarjeta "Registro de actividad" en config con tabs `.config-log-tab` (API/Push) igual que los de caché.
- `initLogTabs()` en `storage.js` maneja el cambio entre tabs.
- **API**: array `API_LOG[]` en `api.js`, render en `#apiLogEntries`, 30 entradas máximo, botón `#clearApiLogBtn`.
- **Push**: array `PUSH_LOG[]` en `push-notifications.js`, render en `#pushLogEntries`, 30 entradas máximo, botón `#clearPushLogBtn`.
- Timestamps con formato `dd/mm/yy hh:mm:ss` usando `formatLogTime()` en `helpers.js`.

### Config — tarjetas
1. Descuentos por marca
2. Caché de datos (con tabs IndexedDB / localStorage)
3. Paginación
4. Registro de actividad (con tabs API / Push)
5. Notificaciones push
6. Claves API - IA (contraseña + carga de claves cifradas)

### Chat IA — `ai-chat.js`

**Proveedores** (orden en UI):
1. Groq (`groq`)
2. Mistral (`mistral`)
3. OpenRouter (`openrouter`)
4. LLM7.io (`llm7`)
5. NVIDIA NIM (`nvidia`) — **vía proxy, ver abajo**
6. Google Gemini (`google`)
7. Chrome Built-in AI (`chrome-nano`)

⚠️ **La app es una PWA estática sin backend, así que un proveedor solo sirve si el navegador acepta su preflight.** Antes de añadir uno, medir el CORS en Chromium real (preflight `OPTIONS` + petición con `Origin`), no con `curl`: Cerebras, Chutes, Z.ai, SambaNova y Cloudflare Workers AI quedan descartados. El Service Worker **no** es la causa de un fallo de CORS: comprobado registrando y desregistrando el SW, el resultado es idéntico.

**NVIDIA NIM (`nvidia`) — el único que va por proxy**: su gateway solo devuelve `Access-Control-Allow-Origin` para el origen `https://build.nvidia.com`, así que desde la app la llamada directa muere con `No 'Access-Control-Allow-Origin' header` (comprobado con `OPTIONS` y en Chromium real). Solución: `workers/nvidia-proxy.js` (Cloudflare Worker) que reenvía solo `/v1/chat/completions` y `/v1/models` usando el secreto `NVIDIA_API_KEY`:
- El navegador **no** tiene clave de NVIDIA: ni campo, ni `AI_KEY_PREFIXES`, ni `AI_ENCRYPTED_KEYS`. Solo guarda la URL del Worker en `gasolineras_ai_nvidia_proxy`.
- `viaProxy: true` + `endpoint`/`listModelsUrl` **relativos** (`/v1/chat/completions`, `/v1/models`); `aiProviderUrl()` los resuelve contra la URL configurada y `normalizeAiProxyUrl()` añade `https://` y quita la barra final.
- `isAiProviderReady('nvidia')` depende de la URL, no de una clave; sin ella el chat avisa y `refreshAiModels()` no llama a nada (`reason: 'nokey'`).
- Cambiar la URL en Config invalida el catálogo cacheado (`invalidateAiModelsCache`).
- Despliegue: `wrangler secret put NVIDIA_API_KEY` + `wrangler deploy`; la clave nunca se escribe en el repo. `ALLOWED_ORIGIN` en `wrangler.toml` es opcional (sin él responde `*`).

**API Keys**: cifradas en código fuente con XOR + base64 (contraseña de 6 chars, misma para las 4). Se descargan al introducir la passphrase correcta en Config y pulsar "Cargar claves". Si ya hay claves cargadas aparece enlace "Volver a cargar".

**LLM7.io (`llm7`) — el único con clave opcional**:
- `keyOptional: true` + `anonymousKey: 'unused'`: sin clave se manda `Bearer unused` y se accede anónimo (500k tokens/24 h, 1 req/s, 10/min, 60/h). Con token gratuito de `dash.llm7.io` son 1M/día. Por eso **no** tiene entrada en `AI_KEY_PREFIXES` ni clave cifrada.
- `listModelsNoAuth: true` → su `GET /v1/models` solo admite `If-None-Match` y `Content-Type` en el preflight; mandar `Authorization` hace fallar la petición con `ERR_FAILED`. El catálogo es público, así que se pide sin cabecera. Su `POST /chat/completions` sí admite `authorization`.
- `parseModels()` filtra por `tier === 'turbo'` (los `pro` devuelven 403 sin suscripción) y quita `DeepSeek-V4-Flash-0731`, que figura como turbo pero devuelve 401 incluso con clave válida (`unavailable`).
- `max_tokens: 1024`: `GLM-5.3-Flash` y `minimax-m2.7` son *reasoning* y con pocos tokens devuelven `content` vacío.

**Validación de formato por proveedor** (`AI_KEY_PREFIXES` + `isAiKeyFormatValid()`):
- Prefijos obligatorios: `google`→`AIza`, `groq`→`gsk_`, `mistral`→`cMHt`, `openrouter`→`sk-or-v1-`
- `tryDecryptDefaultKeys()` devuelve `{ keys, invalid }`, o `null` si **ningún** descifrado tiene el prefijo de su proveedor (= contraseña incorrecta)
- Las claves con formato incorrecto **no se persisten** en `localStorage` y el panel del proveedor muestra `❌ Formato de clave incorrecto para <provider>`
- Motivo: una clave del proveedor equivocado solo fallaría al enviar la petición, sin avisar

⚠️ **Los modelos de IA caducan con frecuencia**. Antes de tocar la lista, verificar contra la API real (`/models` de cada proveedor o una llamada de chat). Historial de retiradas: los 4 modelos de Google (`gemini-2.5-flash` "no longer available to new users", `gemini-2.0-flash`, `gemini-1.5-*`), `poolside/laguna-m.1` (no existe) y los 5 modelos de Groq (`llama-3.3-70b-versatile`, `llama-4-scout`, `llama-3.1-8b`, `mixtral-8x7b`, `gemma2-9b`) devolvían 404.

**Contexto automático (`getAiContext()`)**:
- Provincia + nº gasolineras cargadas
- Top 30 estaciones (`[id IDEESS]` + nombre, precio, localidad, dirección) para que la IA pueda citar la estación
- Favoritos del usuario
- Estado de caché (dataSource cache/fresh)
- Se inyecta como system message antes del primer user message

**Histórico**: `wantsStationHistory()` decide si se carga. Devuelve `true` si el user query contiene palabras clave (`AI_HISTORY_WORDS`: historial, evolución, tendencia, antes, ayer, subida, bajada, mínimo, gráfica, cuándo…) **o** si nombra la marca de alguna estación cargada (normalizado con `normalizeStr`). Con `false` no se pide nada (evita 14 fetches por mensaje).

`buildAiHistoryLines()` monta la sección `=== HISTÓRICO DE PRECIOS`:
- Periodo real disponible (las fechas del Ministerio son `dd-mm-aaaa`) + aviso de que un día sin precio no significa precio constante
- **Provincia**: media/mín/máx/nº estaciones y la más barata de las últimas 10 jornadas, más la tendencia (variación en €/L y %) y el mínimo histórico provincial
- **Por gasolinera** (máx. 12, primero las nombradas en la pregunta, luego favoritos y las más baratas): `[IDEESS] marca | localidad | dirección`, la serie de hasta 10 precios con su fecha y un resumen con precio actual, mín/máx (con su fecha), media, variación en €/L y % y nº de días con precio
- **Mayores subidas y bajadas** del periodo (muestra de las 60 más baratas) con `📈`/`📉`
- Instrucciones de formato (fecha `dd-mm-aaaa`, precio con 3 decimales)

`stationSeries()` cruza cada estación (`IDEESS`) con los listados diarios; `fmtEur()` formatea a 3 decimales con coma.

**Cancelar**: AbortController aborta el fetch. Botón "Cancelar" aparece en el mensaje de loading y desaparece al completar/fallar.

**Editar**: botón ✎ en cada mensaje del usuario. Al pulsarlo:
- Restaura el texto en el input
- Elimina ese mensaje y todos los posteriores del DOM
- El usuario puede corregir y reenviar

**Modelos por proveedor** (verificados contra las APIs el 2026-09-26):
- Groq: `qwen/qwen3.8-27b` (default), `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `allam-2-7b`
- Mistral: `open-mistral-nemo` (default), `ministral-8b-latest`, `codestral-latest`, `mistral-small-latest`, `mistral-medium-latest`
- OpenRouter: `nvidia/nemotron-3-ultra-550b-a55b:free` (default), `nvidia/nemotron-3-super-120b-a12b:free`
- Google Gemini: `gemini-3.8-flash` (default), `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.7-flash`
- LLM7.io: `codestral-latest` (default), `GLM-5.3-Flash`, `minimax-m2.7`, `mistral-Nemo-Instruct-2407`
- NVIDIA (vía proxy): `nvidia/nemotron-3-ultra-550b-a55b` (default), `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `moonshotai/kimi-k3`, `z-ai/glm-5.3`, `z-ai/glm-5.3-flash`, `openai/gpt-oss-20b`
- Chrome Built-in AI: session de IA nativa del navegador

⚠️ `defaultModel` **debe coincidir con el primer `<option>`** de `#iaModel<Provider>` en `index.html` (si no, el modelo por defecto no existe en el desplegable).
⚠️ Los modelos `openai/gpt-oss-*` de Groq son **reasoning**: pueden devolver `content` vacío porque gastan el `max_tokens` en `reasoning`. No usarlos como default.
⚠️ `mistral-large-latest` responde *"not available in your subscription tier"*. El tier free da 429 (`Rate limit exceeded`) de forma intermitente.

**UI**: cada proveedor tiene su propio panel (`.ia-provider-panel`) dentro de `.ia-providers-container`. Los tabs de proveedor están en `.ia-tabs` con botones `.ia-tab`.

**Auto-refresh del catálogo de modelos** (`AI_MODELS_CACHE_KEY`, TTL 24 h):
- `refreshAiModels(provider, {force})` en `ai-chat.js`; `autoRefreshAiModels()` se dispara al abrir la pestaña de un proveedor (`main.js`) y respeta la caché
- `populateAiModelSelect()` une catálogo remoto + lista fija sin duplicar y **conserva la selección**; si el modelo desaparece, lo marca con "⚠️ no disponible" y devuelve `missing`
- `AI_MODEL_ERROR_RE` distingue "el modelo ya no existe" de red/401/429/500: un 429 no debe borrar la selección ni ofrecer refrescar
- Si `/models` falla, se avisa **sin tocar el desplegable**
- Botón 🔄 en cada desplegable (`initAiModelRefreshButtons()`) + botón dentro del aviso `warnAiModelUnavailable()`

### Caché — tabs IndexedDB / localStorage
- `initCacheTabs()` en `storage.js` maneja cambio entre tabs.
- IndexedDB: lista provincias cacheadas (con nº gasolineras y expiración), histórico (conteo) y otras claves.
- localStorage: solo claves con prefijo `gasolineras_`, cada una con botón ✕ para borrar individualmente.

### Toolbar — grupos de filtros
Orden actual de grupos:
1. Provincia
2. Localidad
3. Combustible
4. Marca
5. Mapa (tipo mapa + separador + 🔍 search toggle)
6. ✕ Limpiar filtros
7. (actions-group con leyenda de precios)

### Search toggle (🔍)
- **`#searchToggleBtn`** en el grupo Mapa, tras separador `.filter-sep`
- Muestra/oculta `.search-row` (que empieza oculto con clase `.hide`)
- Al abrir, hace foco automático en el input (`#search`)
- Al resetear filtros, también se oculta la fila de búsqueda
- El separador `.filter-sep` es una línea vertical de 1px, se oculta en ≤768px

### Tabla — columnas
- **Tabla** (`.table-area`): Marca, Precio, Distancia, Localidad, Calle (5 columnas, sin Provincia)
- **Ambos** (`.both-table-area`): Marca, Precio, Distancia, Localidad, Calle (5 columnas)
- Paginación por defecto: 30 filas

### Histórico — combos
- Vista tabla: combo combustible + combo días (14 por defecto), alineados a la izquierda.
- Vista mapa popup: combo combustible (100px) + combo días (7 por defecto), estilizados como filtros.

### Tests
- Ubicación: `docs/test/full_test.mjs`
- Plan: `docs/test/TEST_PLAN.md`
- 139 tests totales (132 HTTP + 7 file://)
- Test de persistencia F5: selecciona provincia, recarga página, verifica que se restauró
- Servidor HTTP inline (no requiere procesos externos)
- Push notifications tests (14.1-14.10) integrados en full_test.mjs

### Actualización de assets y `APP_VERSION`
- `sw.js` tiene una constante `APP_VERSION` (entero), incrementada automáticamente por `scripts/bump-version.mjs`
- El script se ejecuta **manualmente** antes de cada commit (ver workflow obligatorio)
- Motivo: `navigator.serviceWorker.ready.then(r => r.update())` solo detecta cambios en `sw.js`; si no se incrementa la versión, los nuevos assets no se descargan
- El botón "Comprobar actualizaciones" en la UI usa `reg.update()` + `updatefound` para detectar el cambio y ofrecer recarga
- En config se muestra la versión actual (`#appCurrentVersion`) al cargar la aplicación

### Decisiones técnicas clave
- **Dropdown marcas**: `position: fixed` en lugar de `position: absolute` relativo al toolbar para evitar problemas de stacking context del flex layout
- **Persistencia filtros**: `localStorage` clave `gasolineras_prov_filters_{provName}` — simple, síncrono, <1KB
- **Favoritos**: IndexedDB `gasolineras-db` / `favorites` store — persistente entre sesiones
- **Caché datos provincia**: IndexedDB + TTL configurable desde UI
- **Histórico**: Fetch por cada fecha, almacenado en IndexedDB con clave `hist_{provId}_{dateStr}`. Días configurables por vista (14 tabla, 7 popup mapa)
- **Gráfica histórica**: Canvas 2D con dibujo manual (sin librería de charts). Tooltip al hover con precio + fecha en dos líneas
- **Mapa único**: Una instancia Leaflet reutilizada entre tabs vía CSS `display: none` / `block`
- **Tabla "Ambos"**: Sin paginación — muestra todas las estaciones filtradas
- **Tabla "Tabla"**: Paginada (default 30) con sort dual (asc/desc)
- **Reset filtros**: Sin re-fetch cuando ya hay datos cargados
- **Reset filtros**: También oculta `.search-row` y desactiva el botón 🔍
- **Log de actividad**: Tabs API/Push en config (`.config-log-tab`/`.config-log-panel`, mismo estilo que cache tabs). `initLogTabs()` en storage.js
- **API Log**: Array `API_LOG[]` con últimas 30 llamadas, timestamp, duración y estado. Visible en config
- **Push Log**: Array `PUSH_LOG[]` con últimas 30 eventos push. `logPushEvent()` en push-notifications.js. El SW envía eventos al cliente via `postMessage({type:'push-log',...})` y la función `sendPushLog()` en sw.js
- **Timestamp logs**: formato `dd/mm/yy hh:mm:ss` mediante `formatLogTime()` en helpers.js
- **Caché config**: Tabs IndexedDB (provincias/histórico) + localStorage (solo claves `gasolineras_`)
- **Tests**: Servidor HTTP inline en Node.js, Playwright headless, no requiere procesos externos
- **DOMContentLoaded en main.js**: CRÍTICO cerrar con `});` al final. Si falta → error en carga página

### Push Notifications — Arquitectura (v2 SW-based)

**Flujo Suscripción**:
1. User click botón 🔔 toolbar → `subscribeUserToPush()` (`push-notifications.js`)
2. SW crea PushSubscription, guardada en localStorage
3. `registerPeriodicSync('check-favorite-prices', minInterval: checkInterval horas)`
4. Config push (`checkInterval`, `priceFallDays`, `cacheTtl`) sincronizada a IndexedDB store `config`

**Flujo Background (SW)**:
1. Cada X horas: OS dispara `periodicsync` en SW (Android) o `setInterval` fallback (escritorio)
2. `sw.js` ejecuta `checkPrices()` directamente (sin depender del cliente):
   - Lee favoritos de IndexedDB store `favorites`
   - Agrupa por provincia
   - Para cada provincia: fetch FRESCO de API (ignora caché) + actualiza caché
   - Fetch histórico + compara precios (`comparePrices()`)
   - Si cayó: `self.registration.showNotification()`

**Flujo Notificación**:
1. User click notificación
2. `sw.js notificationclick` → URL matching corregido (`new URL(client.url).pathname`)
3. `clients.openWindow(scopePath)` + `postMessage('open-favorite', favoriteId)`
4. `main.js` abre `tab-table` + `showDetail(stationId)`

**Config UI** (Config tab, sincronizada a IndexedDB para acceso del SW):
- Toggle: enable/disable
- `checkInterval`: 1-24h (default 8)
- `priceFallDays`: 0-90d (default 3)
- `cacheTtl` (horas, se aplica tras cada actualización SW)
- Status: ✓ green / ✗ red

**VAPID Key**: hardcodeada en `push-notifications.js`. Sin backend — clave privada no usada.

### Debugging Push Notifications

**Testing sin esperar X horas**:
- DevTools → Application → Service Workers → Periodic Sync → Dispatch
- O en consola: `navigator.serviceWorker.controller.postMessage({ type: 'trigger-price-check' })`
- O usar botón "Probar" en Config tab

**Checklist**:
- [ ] Botón 🔔 visible en toolbar
- [ ] Service Worker registrado
- [ ] Suscripción en localStorage al click 🔔
- [ ] Config inputs actualizan STATE + localStorage + IndexedDB
- [ ] periodicSync registrado (getTags incluye 'check-favorite-prices')
- [ ] Notification permission='granted'
- [ ] Favoritos guardados en IndexedDB (`dbGetAll('favorites')`)
- [ ] Notificación aparece cuando precio cae X días
- [ ] Clic notificación abre app + detalle estación

### Comandos útiles
```powershell
# Bump APP_VERSION
node scripts/bump-version.mjs

# Tests
node docs/test/full_test.mjs

# Servidor manual para depuración
node -e "const h=require('http'),fs=require('fs');h.createServer((q,r)=>{let p=q.url=='/'?'index.html':q.url.slice(1);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end('')}else{r.writeHead(200,{'Content-Type':{'html':'text/html','css':'text/css','js':'application/javascript'}[p.split('.').pop()]||'text/plain'});r.end(d)}})}).listen(8080)"
```

### Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `index.html` | Toolbar + content + tabs + bottom sheet |
| `css/styles.css` | ~342 líneas responsive |
| `js/state.js` | STATE global + definiciones combustibles |
| `js/helpers.js` | Funciones auxiliares (precios, distancia, descuentos, `comparePrices()`, `formatLogTime()`) |
| `js/db.js` | IndexedDB compartido (cliente + SW): cache, favoritos, config |
| `js/storage.js` | localStorage (estado/filtros) + tabs caché + API log render + initLogTabs |
| `js/api.js` | Fetch datos, histórico, `apiFetch()` wrapper con log, `tryAutoRestoreProvince()` |
| `js/map.js` | Inicialización mapa Leaflet, marcadores, popups, chart popup con tooltip |
| `js/controls.js` | `render()`, `setActiveTab()`, filtros, `toggleFavorite()` |
| `js/table.js` | `doSort()`, `showDetail()`, `loadHistory()`, helpers combustibles |
| `js/chart-engine.js` | Dibujar gráfica histórica (canvas) en detail panel + tooltip hover |
| `js/main.js` | Event listeners, restauración de estado, push notifications |
| `js/push-notifications.js` | Gestión suscripción Web Push (subscribe/unsubscribe) + PUSH_LOG + logPushEvent |
| `sw.js` | Service Worker (caché, periodicsync, checkPrices, notificationclick) + sendPushLog() |
| `workers/nvidia-proxy.js` | Cloudflare Worker del proxy de NVIDIA (CORS + secreto `NVIDIA_API_KEY`) |
| `workers/wrangler.toml` | Nombre del Worker, entrypoint y `ALLOWED_ORIGIN` opcional |

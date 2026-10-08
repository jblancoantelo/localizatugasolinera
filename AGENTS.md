# AGENTS.md

## Documentación principal

Ver [`README.md`](./README.md) para visión general del proyecto, funcionalidades y stack técnico.

## Workflow obligatorio

1. **Antes de commit, incrementar APP_VERSION** automáticamente:
   ```powershell
   node scripts/bump-version.mjs
   ```
   El script **hace tres cosas**: regenera la lista `ASSETS` de `sw.js` a partir de `index.html`/`manifest.json` (así un script o icono nuevo entra en el precaché), incrementa `APP_VERSION` + `BUILD_TIME` y añade `?v=<APP_VERSION>` a los iconos del `manifest.json`. Si no se ejecuta, el SW no detecta el cambio y los usuarios se quedan con los assets viejos (y Chrome/Android con el icono viejo, porque reutiliza el bitmap cacheado por URL).
   - Solo sincronizar assets: `node scripts/sync-sw-assets.mjs` (`--check` verifica sin escribir y sale con 1 si no cuadra)
   - Un test de la suite ("Build > ASSETS de sw.js cubre…") falla si la lista se desincroniza

2. **Comprobar sintaxis** de todo el JS (rápido, sin navegador):
   ```powershell
   node check-syntax.mjs
   ```
   Compila cada fichero de `js/`, `sw.js`, el Worker y los scripts; los que usan sintaxis de módulo se validan con `node --check` sobre una copia temporal. También valida los `<script>` **inline** de `index.html` (donde se registra el SW), que ningún test alcanza.

3. **Siempre ejecutar tests completos** tras cualquier cambio:
   ```powershell
   Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
   node docs/test/full_test.mjs
   ```
   Si los tests no existen o fallan, no continuar hasta que pasen todos.

3. **Dónde commitear** (regla del usuario, 04/10/2026):
   - **Fixes y cambios pequeños**: se trabaja y se commitea **directo en `main`**, sin rama. Es el caso por defecto.
   - **Cambios grandes** (refactors, varios ficheros de los que dependen otros, features): se trabaja en una rama corta (`chatIA`, `cache-fix`, …), se sube y se entregan **con una PR contra `main`** para que se revisen antes de integrar.
   - **Nunca integrar una rama en `main` por la vía rápida** (`git merge --ff-only` + `git push origin main`) sin que el usuario haya revisado antes la PR. Ese atajo solo con petición expresa suya.
   - En este entorno **no hay `gh` instalado**, así que la PR la abre el usuario desde la web de GitHub: hay que dejar la rama subida y darle el enlace `compare`.
   ```powershell
   # fix pequeño → en main
   git add -A
   git commit -m "mensaje descriptivo"
   git push origin main

   # cambio grande → rama + PR
   git checkout -b nombre-rama     # si no existe
   git add -A
   git commit -m "mensaje descriptivo"
   git push -u origin nombre-rama
   ```
   - Preguntar al usuario antes de hacer commit. El mensaje debe ser **descriptivo** (nunca "fix", "update" o similar genérico). Ejemplo: `"Añade lupa para toggle del filtro de búsqueda y mejora responsive mobile"`.
   - Si duda de si el cambio es grande o pequeño, preguntar antes de elegir una u otra vía.

## Módulos compartidos cliente ↔ Service Worker

`sw.js` corre en su propio contexto y solo tiene lo que importa con
`importScripts('js/state.js', 'js/helpers.js', 'js/db.js', 'js/history.js')`.
Cualquier función que necesiten los dos tiene que vivir en uno de esos ficheros
(los gráficos no, porque el SW no dibuja).

| Módulo | Qué comparte | Consumidores |
|--------|--------------|-------------|
| `js/state.js` | `STATE`, `FUEL_KEYS`, `FUEL_GROUPS`, `FUEL_NAMES`, `HISTORY_DAYS_*` | página, SW |
| `js/helpers.js` | `parsePrice()`, `getFuelPrice()`, `comparePrices()`, `formatLogTime()` | página, SW |
| `js/db.js` | IndexedDB (`cache`, `favorites`, `config`) | página, SW |
| `js/history.js` | Fechas `dd-mm-aaaa`, descarga con caché, serie por estación | modal, popup, chat IA, SW |

**Reglas aprendidas a la fuerza** (incumplirlas costó un commit):
- Si añades un `<script>` a `index.html`, `npm run bump` lo mete en `ASSETS`. Si además lo importa el SW, el script de sync **falla con error** si no está precacheado.
- `js/history.js` usa `historyRequest()`, que delega en `apiFetch()` si existe (para que la descarga quede en el log de la API) y hace un `fetch` simple en el SW. **No llames a `fetch` directamente para el histórico.**
- Las fechas del Ministerio son `dd-mm-aaaa`: ordena con `sortHistoryDates()`, nunca con `sort()`.
- Todo lo que el SW importa con `importScripts` tiene que estar en `ASSETS` o el SW arranca sin esas funciones (pasó con `js/ai-chat.js`).

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

### Gráficas (canvas) — `js/chart-core.js` compartido
Hay **dos** gráficas (panel de detalle y popup del mapa) y las dos usan las mismas primitivas de `js/chart-core.js`, cargado **antes** que `chart-engine.js` en `index.html`:
- `chartSetupCanvas(canvas)`: mide, aplica `devicePixelRatio` y devuelve `{ ctx, W, H }`. Si el canvas aún no tiene layout (pestaña oculta), cae a los atributos `width`/`height`.
- `chartScale(data, padFrac)`: mín/máx con margen (mínimo 0.005).
- `chartAxes(ctx, …, gridCount, labelStep)`: rejilla + ejes de precio y etiquetas `dd-mm`.
- `chartMinMax(data)` y `chartIndices(data, count)`: extremos y los índices de las etiquetas para que no se solapen.
- **Tooltip** (`drawTooltip`): recuadro oscuro con precio (bold) arriba y fecha debajo.
- **chart-engine.js**: `drawPriceChart()` (panel de detalle). Mouse events (`mousemove`/`mouseleave`) buscan el punto más cercano (12px radio) y llaman a `drawTooltip()`.
- **map.js**: `drawPopupPriceChart()` + `onPopupChartHover()` / `onPopupChartLeave()`, que reutilizan el tooltip.

`canvas._chartPoints` guarda los puntos en coordenadas de pantalla y `canvas._chartData` la serie; el hover los necesita para detectar el punto cercano.

### Log de actividad (tabs API / Push)
- Tarjeta "Registro de actividad" en config con tabs `.config-log-tab` (API/Push) igual que los de caché.
- `initLogTabs()` en `storage.js` maneja el cambio entre tabs.
- **Buffer circular** `createRingLog(max)` en `storage.js`: `push()` (descarta la más antigua al llegar a `max`), `all()` (**devuelve una copia**), `clear()`, `load(lista)` (recorta a `max`).
- **API**: `API_LOG_RING` en `api.js` (max 30), render en `#apiLogEntries`, botón `#clearApiLogBtn`.
- **Push**: `PUSH_LOG_RING` en `push-notifications.js` (max 30), render en `#pushLogEntries`, botón `#clearPushLogBtn`.
- El ring guarda **de más antiguo a más reciente**, así que el render hace `.slice().reverse()`; lo que se persiste en `localStorage` (`gasolineras_api_log`, `gasolineras_push_log`) va en ese mismo orden y `load()` lo restaura recortando.
- ⚠️ **`API_LOG_RING` y `PUSH_LOG_RING` son `const` de nivel superior en scripts clásicos**: viven en el entorno léxico global, **no en `window`**. `main.js` los referencia por su identificador; escribir `window.API_LOG_RING` da `undefined` y el log no se restaura tras F5 (pasó).
- Timestamps con formato `dd/mm/yy hh:mm:ss` usando `formatLogTime()` en `helpers.js`.

### IndexedDB (`js/db.js`)
- `dbGet`, `dbPut`, `dbDelete`, `dbGetAll`, `dbGetAllKeys` exigen **siempre `storeName` como primer argumento**: `dbGet('cache', 'prov_Madrid')`, nunca `dbGet('prov_Madrid')`.
- Motivo: `db.transaction(storeName, …)` con una clave donde va el nombre del store lanza `NotFoundError`, y como las funciones resuelven en el `catch` el fallo era silencioso. Pasó con `clearCache()` y con `renderCacheInfo()`: "Limpiar caché" no borraba nada.
- No existe `dbClear()` (se eliminó por estar sin usar).

### Config — tarjetas
1. Descuentos por marca
2. Caché de datos (con tabs IndexedDB / localStorage)
3. Paginación
4. Registro de actividad (con tabs API / Push)
5. Notificaciones push
6. Claves API - IA (contraseña + carga de claves cifradas)
7. Pestañas de IA (checkbox por proveedor, `#aiProviderVisibility`)
8. Actualización de la app

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

⚠️ **`AI_PROXY_NVIDIA_DEFAULT` es un valor de EJEMPLO que no puede resolver** (pasa por `aiProxyUrlIssue()` → `nosubdomain`). Cloudflare da a cada cuenta su propio subdominio, así que lo que imprime `wrangler deploy` es `https://petrol-nvidia-proxy.<subdominio-cuenta>.workers.dev`: tres etiquetas son `worker.workers.dev` (no existe) y cuatro son `worker.cuenta.workers.dev` (sí). La app lo detecta **antes de hacer fetch**, no lo intenta:

| Función | Qué hace con una URL inválida |
|---------|-------------------------------|
| `aiProxyUrlIssue(url)` | Devuelve `'nourl'`, `'placeholder'` (lo de `<…>` de la documentación), `'invalid'` (URL que no parsea; ojo: **Chromium percent-codifica los espacios en vez de fallar**, `mi%20proxy`) o `'nosubdomain'` (`*.workers.dev` con 3 etiquetas). `''` si la URL tiene buena pinta |
| `aiProviderUrl()` | Lanza `Error` con el motivo. Está **fuera** del `try` del `send()` de NVIDIA para que `aiFetchError()` no le añada `— proxy: …` |
| `aiProxyDiagnostics()` | `kind: 'invalidurl'` + `issue`, **sin tocar la red** (el botón 🔎 Probar es justo para esto) |
| `isAiProviderReady()` | `false` → el chat avisa antes de enviar y `refreshAiModels()` responde `nokey` con **0 fetch** |
| `updateAiStatus()` / `markAiProxyUrlInput()` | `⚠️ URL sin el subdominio de tu cuenta — ve a Config → IA` y campo en rojo (verde si la forma es correcta; el verde no garantiza que el Worker exista) |

Motivos en `AI_PROXY_URL_ISSUES` (rótulo corto) y textos largos en `aiProxyUrlIssueMessage()`. `AI_PROXY_NVIDIA_SHAPE = 'https://petrol-nvidia-proxy.mi-cuenta.workers.dev'` sustituye al antiguo placeholder `<tu-subdominio>`, que en pantalla salía como `https://petrol-nvidia-proxy..workers.dev`.

Sin cuenta de Cloudflare **este proveedor no se puede usar** (su CORS solo permite `build.nvidia.com`); Config → IA lo dice y los otros seis no dependen del proxy. Por eso Config → IA trae dos botones junto a `iaProxyNvidia`:
- **↺ Usar la predefinida** (`iaProxyResetBtn`): borra la URL guardada y vuelve al valor de ejemplo
- **🔎 Probar** (`iaProxyTestBtn` + `iaProxyTestStatus`): un `GET /v1/models` **sin coste de tokens** y una explicación por cada caso. `aiProxyDiagnostics(provider, urlOverride)` clasifica: `invalidurl` (`issue` con el motivo, sin fetch), `dns` (host que no responde, con la forma de URL que hay que pegar), `notfound` (el host responde pero no hay Worker → subdominio equivocado), `nokey` (Worker sin `NVIDIA_API_KEY`), `badauth` (401/403: clave rechazada), `quota` (429), `http<status>` y `ok` con el nº de modelos. Si responde bien, guarda la URL e invalida el catálogo

**Errores descriptivos**: un `fetch` a un host que no responde solo da "Failed to fetch", así que los dos caminos con `viaProxy` reescriben el error — `aiFetchError()` en el `send()` de NVIDIA y `aiProxyDiagnostics()` en `fetchAiModels()` — con un mensaje que nombra la URL usada, la que debería ser y qué revisar.

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

**Histórico**: `wantsStationHistory()` decide si se carga. Devuelve `true` si el user query contiene palabras clave (`AI_HISTORY_WORDS`: historial, evolución, tendencia, antes, ayer, subida, bajada, mínimo, gráfica, cuándo…) **o** si trae un rango explícito (`AI_HISTORY_RANGE_RE`: "60 días", "6 semanas", "3 meses", "1 año") **o** si nombra la marca de alguna estación cargada (normalizado con `normalizeStr`). Con `false` no se pide nada (evita N fetches por mensaje).

**Rango de días** (`resolveAiHistoryDays()`): la IA usa **los mismos rangos que el modal**, `HISTORY_DAYS_OPTIONS = [7, 14, 21, 30, 60, 90, 180]` en `js/state.js`:
1. Si la pregunta trae cifra + unidad (`30 días`, `21 jornadas`, `6 semanas` ×7, `3 meses` ×30) se respeta, clampada a 7–180
2. `1 año`, `semestre` o `medio año` → 180
3. Si no, `STATE.historyDays` (lo que el usuario tiene elegido en el modal)
- Un rango menor que el de la caché **recorta** en memoria, no vuelve a descargar

**Datos compartidos** (`getAiHistoryData(days)`): reutiliza `window._historyCache` (modal de detalle y popup del mapa) si cubre el rango, y guarda `window._aiHistoryCache` para ampliarlo sin repetir fetches.

`buildAiHistoryLines()` monta la sección `=== HISTÓRICO DE PRECIOS`:
- Rango usado (y si lo has pedido tú o viene del modal) + periodo real disponible (las fechas del Ministerio son `dd-mm-aaaa`) + aviso de que un día sin precio no significa precio constante
- Combustible analizado: `aiHistoryFuelName()` usa el de `#historyFuel` si el modal está abierto, si no `STATE.selectedFuel`
- **Provincia**: media/mín/máx/nº estaciones y la más barata de las últimas 10 jornadas, más la tendencia (variación en €/L y %) y el mínimo histórico provincial
- **Por gasolinera** (máx. 12, primero las nombradas en la pregunta, luego favoritos y las más baratas): `[IDEESS] marca | localidad | dirección`, la serie de hasta 10 precios con su fecha y un resumen con precio actual (con descuento), mín/máx (con su fecha), media, variación en €/L y % y nº de días con precio
- **Mayor bajada (`📉`) y mayor subida (`📈`)** del periodo (muestra de las 60 más baratas)
- Instrucciones de formato (fecha `dd-mm-aaaa`, precio con 3 decimales)

`stationSeries()` llama a `getStationHistory()` (`js/history.js`), o sea la misma serie que dibuja la gráfica del modal, con soporte de grupos de combustibles; `sortHistoryDates()` ordena las fechas `dd-mm-aaaa` correctamente (un `sort()` normal las desordena) y `fmtEur()` formatea a 3 decimales con coma.

**Cancelar**: AbortController aborta el fetch. Botón "Cancelar" aparece en el mensaje de loading y desaparece al completar/fallar.

**Editar**: botón ✎ en cada mensaje del usuario. Al pulsarlo:
- Restaura el texto en el input
- Elimina ese mensaje y todos los posteriores del DOM
- El usuario puede corregir y reenviar

**Formato de la respuesta (Markdown)** — `renderAiMarkdown()` en `ai-chat.js`:
- El LLM devuelve Markdown y pintarlo tal cual con `innerHTML` amontonaba todo en un bloque (el navegador colapsa los `\n`) y dejaba los `**` a la vista. El renderer escapa primero (`escapeAiHtml`) y convierte: títulos `#`–`####`, `**negrita**`/`__`, `*cursiva*`/`_x_` (solo pegados: así `gasolineras_prov_...` no se vuelve cursiva), `` `código` ``, bloques ```` ``` ```` (también sin cerrar, respuesta cortada por `max_tokens`), listas `-`/`1.`, enlaces `https?`, `> cita`, `---` y tablas `|...|`. Salto de línea simple → `<br>` dentro del párrafo, línea en blanco → `<p>`.
- **Solo los mensajes `assistant` y `user` pasan por el renderer**: el resto (`error`, `info`, `warn`, `loading`, `empty`) sigue siendo HTML a mano, como `warnAiModelUnavailable()`. Si se añade un mensaje interno nuevo con HTML, que no lleve esas dos clases.
- Al escapar, un `<script>` o `<img onerror>` que devuelva el modelo no se ejecuta; el texto del usuario también se escapa.
- **`data-raw`** guarda el texto original: `getMessagesForProvider()` lo reenvía al modelo y `editAiMessage()` lo recupera en el input. Sin él se mandaría el HTML renderizado (y el ✎ del botón de editar, que ya pasaba).
- `aiModelReply()` (modelo que solo razonó) y `chrome-nano` devuelven **Markdown**, no HTML: son mensajes `assistant`.
- Estilos en `css/styles.css` bajo el bloque `/* === Markdown del chat IA === */` (`.ia-md-h*`, `.ia-md-pre`, `.ia-md-table`, `.ia-md-quote`).

**Marca de agua de cada respuesta**: `handleAiSend()` cronometra solo la llamada a `config.send()` y llama a `addAiMessageMeta(div, model, ms)` → `<div class="ia-msg-meta">⏱ modelo · 1,2 s</div>` (con `formatAiElapsed()`: ms por debajo de 1 s, coma decimal en los segundos). Va como **hijo** del mensaje `assistant`, así que no entra en `data-raw` (no se reenvía al modelo) ni en el texto que se recupera al editar.

**Pestañas de IA ocultables** — Config → "Pestañas de IA":
- `AI_HIDDEN_KEY = 'gasolineras_ai_hidden_providers'` (JSON array en `localStorage`, por defecto ausente = las 7 visibles). `loadAiHiddenProviders()` filtra ids que ya no existan en `AI_PROVIDERS`.
- `renderAiProviderVisibilityConfig()` pinta un checkbox por proveedor en `#aiProviderVisibility` (labels en `AI_PROVIDER_LABELS`) y se llama en **dos sitios**: `main.js` al arrancar y `controls.js` al abrir `tab-config`.
- `applyAiProviderVisibility()` añade la clase `.ia-hidden` a la pestaña **y** a su panel (y le quita `active`); si la pestaña activa queda oculta, hace `.click()` en la primera visible para que se active su panel y dispare el auto-refresh.
- **Siempre debe quedar al menos una visible**: si al desmarcar la última no queda ninguna, la casilla se vuelve a marcar y el hint avisa.
- CSS: `.ia-provider-tab.ia-hidden, .ia-provider-panel.ia-hidden { display: none !important; }`.
- Ocultar un proveedor **no** borra su chat ni sus claves: solo no se pinta su pestaña.

**Modelos por proveedor** (verificados contra las APIs el 2026-09-26):
- Groq: `qwen/qwen3.8-27b` (default), `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `allam-2-7b`
- Mistral: `open-mistral-nemo` (default), `ministral-8b-latest`, `codestral-latest`, `mistral-small-latest`, `mistral-medium-latest`
- OpenRouter: `nvidia/nemotron-3-ultra-550b-a55b:free` (default), `nvidia/nemotron-3-super-120b-a12b:free`
- Google Gemini: `gemini-3.8-flash` (default), `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.7-flash`
- LLM7.io: `codestral-latest` (default), `GLM-5.3-Flash`, `minimax-m2.7`, `mistral-Nemo-Instruct-2407`
- NVIDIA (vía proxy): `nvidia/nemotron-3-ultra-550b-a55b` (default), `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `moonshotai/kimi-k3`, `z-ai/glm-5.3`, `z-ai/glm-5.3-flash`, `openai/gpt-oss-20b`
- Chrome Built-in AI: session de IA nativa del navegador

⚠️ Los `<option>` de `#iaModel<Provider>` en `index.html` van **en orden alfabético** (por la etiqueta visible), igual que los que pinta `populateAiModelSelect()`. `defaultModel` **debe existir entre ellos y venir marcado con `selected`** (ya no hace falta que sea el primero: el orden es alfabético).
⚠️ Los modelos `openai/gpt-oss-*` de Groq son **reasoning**: pueden devolver `content` vacío porque gastan el `max_tokens` en `reasoning`. No usarlos como default.
⚠️ `mistral-large-latest` responde *"not available in your subscription tier"*. El tier free da 429 (`Rate limit exceeded`) de forma intermitente.

**UI**: cada proveedor tiene su propio panel (`.ia-provider-panel`) dentro de `.ia-container`. Los tabs están en `.ia-provider-tabs` con botones `.ia-provider-tab` (`data-iaprovider`); los paneles llevan `data-iapanel`.

**Pestaña General** (`data-iaprovider="general"`, la primera y activa por defecto):
- **No es un proveedor**: no está en `AI_PROVIDERS`, así que no pide clave, no tiene desplegable de modelo ni casilla en Config → "Pestañas de IA", y `loadAiHiddenProviders()` la descarta → **nunca se puede ocultar** (`applyAiProviderVisibility()` la excluye a propósito)
- `handleAiGeneralSend()` manda **la misma consulta en paralelo** a `aiVisibleProviders()` (los de `AI_PROVIDERS` menos los ocultos en Config → IA). El snapshot del historial (`readAiMessages()`, el mismo que usa `getMessagesForProvider()`) se hace **una sola vez antes de lanzar**, así que todas reciben lo mismo y ninguna respuesta incluye la de los demás
- Modelo por proveedor: `lastAiModel(p)` (el último enviado en su pestaña) o, si no, `defaultModel`; después se guarda con `saveAiLastModel()`
- Cada respuesta lleva marca de agua **`⏱ proveedor · modelo · tiempo`** (`addAiMessageMeta(div, model, ms, label)`; sin `label` se comporta como antes)
- Un proveedor sin clave no se salta: se pinta `❌ <Proveedor>: …` con su motivo, para que se vea quién contestó y quién no
- `autoRefreshAiModels('general')` refresca a la vez a todos los visibles (cada uno con su caché de catálogo)
- `updateAiStatus('general')` informa de `✅ N/M proveedores listos`

**Auto-refresh del catálogo de modelos** (`AI_MODELS_CACHE_KEY`, TTL 24 h):
- `refreshAiModels(provider, {force})` en `ai-chat.js`; `autoRefreshAiModels()` se dispara al abrir la pestaña de un proveedor (`main.js`) y respeta la caché
- `populateAiModelSelect()` une catálogo remoto + lista fija sin duplicar, **lo pinta en orden alfabético** (por la etiqueta, con `localeCompare(…, 'es')` insensible a mayúsculas: ordenar por el id agruparía por prefijo de proveedor) y **conserva la selección**; si el modelo desaparece, lo marca con "⚠️ no disponible" y devuelve `missing`
- Sin selección previa (arrancar la app, o `select.value = ''` antes de poblar) elige el **último modelo enviado por ese proveedor** y, si no lo hay o ya no está en la lista, el `defaultModel`
- `AI_MODEL_ERROR_RE` distingue "el modelo ya no existe" de red/401/429/500: un 429 no debe borrar la selección ni ofrecer refrescar
- Si `/models` falla, se avisa **sin tocar el desplegable**
- Botón 🔄 en cada desplegable (`initAiModelRefreshButtons()`) + botón dentro del aviso `warnAiModelUnavailable()`
- `initAiChat()` repuebla cada desplegable al cargar (vacía antes `select.value` para que no se quede con la primera opción del HTML) mezclando la caché de catálogo si existe, así el orden y el último modelo valen desde el primer pintado

**Último modelo por proveedor** (`AI_LAST_MODEL_KEY = 'gasolineras_ai_last_models'`):
- `saveAiLastModel(provider, model)` se llama en `handleAiSend()` **al enviar**, no al mover el desplegable: lo recordado tiene que ser el modelo con el que se respondió por última vez
- `restoreAiLastModel(provider, select)` lo vuelve a elegir si sigue entre las opciones; si ya no existe se cae al `defaultModel`
- Guardado como `{ proveedor: modelo }` en `localStorage`, junto a las demás claves `gasolineras_` (visible y borrable en Config → Caché → localStorage)

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
- 197 tests totales (190 HTTP + 7 file://)
- Secciones: 1-12 UI, 13 claves IA (manual), 14 push, 15 chat IA, 16 ring logs, 17 build (`ASSETS`/`APP_VERSION`/`?v=` de los iconos)
- Test de persistencia F5: selecciona provincia, recarga página, verifica que se restauró
- Servidor HTTP inline (no requiere procesos externos)
- `docs/test/validate.mjs` está **marcado como legado y no se ejecuta**: usa los `data-tab` en camelCase (`tabMap`) de antes del kebab-case y daría falsos fallos. `docs/test/server.js` es solo el servidor para depuración manual, la suite levanta el suyo.
- Push notifications tests (14.1-14.10) integrados en full_test.mjs
- Los tests de IA mockean `window.fetch` con `page.evaluate` (**no** con `page.route`): la página tiene Service Worker y las peticiones que este intercepte nunca pasan por el interception de Playwright

### Actualización de assets y `APP_VERSION`
- `sw.js` tiene una constante `APP_VERSION` (entero) y `BUILD_TIME` (`aaaammdd-hhmmss`), incremented por `scripts/bump-version.mjs`
- El bloque `// assets:start … // assets:end` con `ASSETS` **está generado**: no editarlo a mano. `scripts/sync-sw-assets.mjs` lo reconstruye con lo que referencian `index.html` y `manifest.json` (los `src`/`href` del HTML y el `"src"` del JSON de los iconos) y falla si algún `importScripts` del SW no queda precacheado
- El script se ejecuta **manualmente** antes de cada commit (ver workflow obligatorio) y `npm run bump` lo hace antes de subir la versión
- Motivo: `navigator.serviceWorker.ready.then(r => r.update())` solo detecta cambios en `sw.js`; si no se incrementa la versión, los nuevos assets no se descargan
- **`?v=` en los iconos del manifest**: `manifest.json` lleva `icons/…png?v=<APP_VERSION>` para que Chrome (sobre todo Android, que reutiliza el icono cacheado por URL) descargue la imagen fresca en cada release. El query **no** entra en `ASSETS` (el sync lo recorta con `split('?')`): el SW precachea el fichero sin query y el fetch con query salta la caché del SW e irá directo a la red. El test "Build > Los iconos del manifest llevan la `?v=`…" falla si no cuadra con `APP_VERSION`
- El botón "Comprobar actualizaciones" en la UI usa `reg.update()` + `updatefound` para detectar el cambio y ofrecer recarga
- En config se muestra la versión actual (`#appCurrentVersion`) al cargar la aplicación

### Comandos
```powershell
npm test                # suite completa
node check-syntax.mjs   # sintaxis de todo el JS + <script> inline del HTML
npm run bump            # sync de ASSETS + APP_VERSION + BUILD_TIME
npm run sync-assets     # solo ASSETS
npm run check-assets    # verifica ASSETS sin escribir
```

### Decisiones técnicas clave
- **Dropdown marcas**: `position: fixed` en lugar de `position: absolute` relativo al toolbar para evitar problemas de stacking context del flex layout
- **Persistencia filtros**: `localStorage` clave `gasolineras_prov_filters_{provName}` — simple, síncrono, <1KB
- **Favoritos**: IndexedDB `gasolineras-db` / `favorites` store — persistente entre sesiones
- **Caché datos provincia**: IndexedDB + TTL configurable desde UI
- **Histórico**: una sola implementación en `js/history.js` (página, chat IA y SW), fetch por cada fecha en `js/history.js` con clave `hist_{provId}_{dd-mm-aaaa}` y peticiones agrupadas de 3 en 3. Días configurables por vista (14 tabla, 7 popup mapa)
- **Gráfica histórica**: Canvas 2D con dibujo manual (sin librería de charts), primitivas en `js/chart-core.js` para las dos gráficas. Tooltip al hover con precio + fecha en dos líneas
- **Precaché del SW**: generado por script desde `index.html` + `manifest.json`, con los 4 iconos (192/512, PNG y SVG)
- **Mapa único**: Una instancia Leaflet reutilizada entre tabs vía CSS `display: none` / `block`
- **Tabla "Ambos"**: Sin paginación — muestra todas las estaciones filtradas
- **Tabla "Tabla"**: Paginada (default 30) con sort dual (asc/desc)
- **Reset filtros**: Sin re-fetch cuando ya hay datos cargados
- **Reset filtros**: También oculta `.search-row` y desactiva el botón 🔍
- **Log de actividad**: Tabs API/Push en config (`.config-log-tab`/`.config-log-panel`, mismo estilo que cache tabs). `initLogTabs()` en storage.js
- **API Log**: `API_LOG_RING` (buffer circular de 30) con timestamp, duración y estado. Visible en config
- **Push Log**: `PUSH_LOG_RING` (buffer circular de 30). `logPushEvent()` en push-notifications.js. El SW envía eventos al cliente via `postMessage({type:'push-log',...})` y la función `sendPushLog()` en sw.js
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
   - Fetch histórico + compara precios (`comparePrices()`), con `fetchHistoryByProvinceId()` y `getStationHistory()` de `js/history.js` (importado con `importScripts`)
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
| `js/storage.js` | localStorage (estado/filtros) + `createRingLog()` + tabs caché + logs + initLogTabs |
| `js/history.js` | Histórico compartido (página + chat IA + SW): `formatDateDDMMYYYY()`, `sortHistoryDates()`, `historyDateList()`, `fetchHistoryByProvinceId()`, `getStationHistory()` |
| `js/api.js` | Fetch datos, `apiFetch()` con log (`API_LOG_RING`), `clearCache()`, `tryAutoRestoreProvince()` |
| `js/map.js` | Inicialización mapa Leaflet, marcadores, popups, chart popup con tooltip |
| `js/controls.js` | `render()`, `setActiveTab()`, filtros, `toggleFavorite()` |
| `js/table.js` | `doSort()`, `showDetail()`, `loadHistory()`, helpers combustibles |
| `js/chart-core.js` | Primitivas de gráfica compartidas por las dos vistas (canvas, escala, ejes, tooltip) |
| `js/chart-engine.js` | Gráfica histórica del detail panel con las primitivas de `chart-core.js` |
| `js/main.js` | Event listeners, restauración de estado, push notifications |
| `js/push-notifications.js` | Gestión suscripción Web Push (subscribe/unsubscribe) + `PUSH_LOG_RING` + logPushEvent |
| `sw.js` | Service Worker (caché, periodicsync, checkPrices, notificationclick) + sendPushLog() + `APP_VERSION`/`ASSETS` |
| `scripts/bump-version.mjs` | Regenera `ASSETS` e incrementa `APP_VERSION` + `BUILD_TIME` |
| `scripts/sync-sw-assets.mjs` | Genera el bloque `ASSETS` de `sw.js` desde `index.html` + `manifest.json` |
| `check-syntax.mjs` | Comprueba la sintaxis de todo el JS del repo y del `<script>` inline del HTML |
| `workers/nvidia-proxy.js` | Cloudflare Worker del proxy de NVIDIA (CORS + secreto `NVIDIA_API_KEY`) |
| `workers/wrangler.toml` | Nombre del Worker, entrypoint y `ALLOWED_ORIGIN` opcional |

# Mejoras realizadas — Precios Gasolina España

## 2026-09-27 — Chat IA: LLM7.io integrado + auto-refresh del catálogo de modelos

### Criterio: CORS medido en navegador real, no con `curl`
La app es una PWA estática sin backend, así que un proveedor solo sirve si el
navegador acepta su preflight. Se comprobó con Chromium (preflight `OPTIONS` +
petición real con `Origin`) y **el Service Worker se descartó como causa**:
registrando y desregistrando el SW el resultado fue idéntico.

### Descartados por CORS (el navegador rechaza el preflight)
| Proveedor | Endpoint | Preflight |
|-----------|----------|-----------|
| NVIDIA NIM | `integrate.api.nvidia.com/v1` | sin `access-control-allow-origin` |
| Cerebras | `api.cerebras.ai/v1` | sin CORS |
| Chutes | `llm.chutes.ai/v1` | sin CORS |
| Z.ai (Zhipu) | `api.z.ai/api/paas/v4` | sin CORS |
| SambaNova | `api.sambanova.ai/v1` | `allow-origin: null` |
| Cloudflare Workers AI | `api.cloudflare.com/client/v4/.../ai/run` | sin CORS |
| Pollinations | `text.pollinations.ai/openai` | responde, pero Turnstile en el navegador |

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

# Gasolineras — Precios de Gasolina en España

Aplicación web progresiva (PWA) para consultar **precios de carburantes en estaciones de servicio de España** en tiempo real, usando datos oficiales del [Geoportal de Hidrocarburos](https://geoportalgasolineras.es/) del Ministerio para la Transición Ecológica.

> 🧪 Este proyecto ha sido desarrollado íntegramente con **[OpenCode](https://opencode.ai)** usando modelos de lenguaje libres (DeepSeek), sin depender de APIs de pago ni modelos propietarios.

---

## Funcionalidades

### 🔍 Consulta de precios
- Datos en tiempo real desde la API oficial del Ministerio (actualización cada 30 minutos)
- Filtros por **provincia**, **localidad**, **combustible**, **marca** y **distancia máxima**
- Búsqueda textual por localidad, dirección o nombre de estación (toggle con 🔍 en toolbar)
- Leyenda dinámica de precios (verde < naranja < rojo) según percentiles

### 🗺️ Vista Mapa
- Mapa interactivo con **Leaflet** (OpenStreetMap + CartoDB + ESRI + CyclOSM)
- 10 estilos de mapa: satélite (por defecto), satélite con nombres, calle, estándar, humanitario, ciclismo, oscuro, topográfico, NatGeo y relieve
- Si el proveedor de una vista no devuelve tiles (host bloqueado o caído) se cambia solo al proveedor de respaldo en vez de dejar el mapa en gris
- Marcadores coloreados por precio
- Popup con datos de la estación e histórico de precios
- Posicionamiento manual (clic derecho) y geolocalización automática
- Filtro de distancia radial desde tu ubicación

### 📋 Vista Tabla
- Columnas: Marca, Precio, Distancia, Localidad, Calle
- Ordenación ascendente/descendente por cualquier columna
- Paginación configurable (30 filas por defecto)
- Panel de detalle con histórico de precios y gráfica canvas
- Favoritos con persistencia en IndexedDB

### 👁️ Vista Ambos
- Mapa y tabla sincronizados en pantalla dividida
- Sin paginación — muestra todas las estaciones filtradas

### 📊 Histórico de precios
- Gráfica de evolución de precios en canvas (sin librerías externas)
- Tooltip interactivo al pasar el ratón
- Combustible y número de días configurables (7-180 días)
- Disponible en panel de detalle y popup del mapa, con el **mismo motor de dibujo** (`js/chart-core.js`) y **el mismo código de histórico** (`js/history.js`) para el chat de IA y el Service Worker
- Descarga por fecha con caché en IndexedDB (clave `hist_<idProvincia>_<dd-mm-aaaa>`) y peticiones agrupadas de 3 en 3
- El rango se recorta en memoria si la caché ya cubre más días: no vuelve a descargar

### 💾 Caché y persistencia
- **IndexedDB**: datos de provincia, histórico, favoritos y configuración (stores `cache`, `favorites`, `config`)
- **localStorage**: estado de la UI, filtros por provincia, logs de actividad y el historial de cada chat de IA (una clave por pestaña)
- TTL de caché configurable desde la UI
- El estado se restaura tras recargar la página (F5)
- Descuentos por marca (¢/litro)

### 🔔 Notificaciones Push
- **Arquitectura Service Worker**: el chequeo de precios corre en el SW, no en el cliente
- **Periodic Background Sync** (Android) con fallback `setInterval` (escritorio)
- Dos modos de alerta: **bajada de precio** y **subida de precio**
- Dos modos de detección: **promedio histórico** y **tendencia consecutiva**
- Notificaciones interactivas: al hacer clic abre la app y muestra el detalle de la estación
- Panel de configuración: intervalo (1-24h), días de ventana (2-90), modo de cálculo
- Botón de prueba para verificar el funcionamiento sin esperar horas
- Log de actividad con todos los eventos en la UI de configuración

### 📝 Registro de actividad
- **Log de llamadas API**: últimas 30 llamadas con timestamp, duración y estado
- **Log de Push**: últimas 30 notificaciones y eventos del SW
- Tabs en la UI de configuración para alternar entre ambos
- Ambos logs usan el mismo buffer circular (`createRingLog()`): guardan de más antiguo a más reciente, se pintan invertidos y se restauran tras F5 desde `localStorage`

### ⭐ Favoritos
- Marca/desmarca estaciones como favoritas con persistencia en IndexedDB
- Filtro "solo favoritos" en toolbar
- Las notificaciones push monitorizan exclusivamente las estaciones favoritas

### 📱 Progressive Web App (PWA)
- Service Worker con caché de assets para funcionamiento offline parcial
- **Precaché generado**: la lista `ASSETS` de `sw.js` no se escribe a mano, se genera con `node scripts/sync-sw-assets.mjs` a partir de lo que referencian `index.html` y `manifest.json` (así un script o icono nuevo nunca se queda fuera)
- Instalable en el dispositivo (manifest.json con iconos SVG + PNG con `?v=APP_VERSION` para forzar su re-descarga, los cuatro precacheados)
- Página offline (`offline.html`)
- Botón "Comprobar actualizaciones" que detecta cambios en `sw.js` (`APP_VERSION` + `BUILD_TIME`)

### 🤖 Chat IA integrado
- **8 pestañas**: General (misma pregunta a todos los proveedores visibles, en paralelo) + Groq, Mistral, OpenRouter, LLM7.io, NVIDIA, Google Gemini y Chrome Built-in AI
- Las API Keys se guardan cifradas (XOR + base64) en el código fuente y se descargan en Config con una contraseña
- **LLM7.io funciona sin clave**: sin API Key accede en modo anónimo (500k tokens/24 h); con una clave gratuita de `dash.llm7.io` el límite sube a 1M/día
- **NVIDIA NIM vía Cloudflare Worker**: su API solo habilita el origen `build.nvidia.com`, así que la llamada directa desde el navegador es imposible. Se incluye `workers/nvidia-proxy.js`, que reenvía `/v1/chat/completions` y `/v1/models` con la clave guardada como secreto del Worker (`wrangler secret put NVIDIA_API_KEY`); en Config solo se pega la URL, con **🔎 Probar** para comprobar si es la buena (no gasta tokens) y **↺ Usar la predefinida** para volver a la de por defecto
- **Catálogo de modelos automático**: los modelos gratuitos rotan con frecuencia, así que el desplegable se descarga de la API de cada proveedor (caché 24 h, botón 🔄 para refrescar) y avisa si el modelo elegido ya no está disponible. Los modelos salen **en orden alfabético** (mezclando catálogo remoto y lista fija) y cada proveedor **recuerda el último modelo con el que se le envió un mensaje**, aunque cambies de pestaña o recargues la app
- **Contexto automático**: cada mensaje incluye los datos actuales de la app (provincia, gasolineras, precios, favoritos) y el `IDEESS` de cada estación
- **Histórico para la IA**: si la pregunta pide evolución, tendencia, nombra una marca concreta o trae un rango ("en 60 días", "3 meses"), se cargan esos días del Ministerio —los mismos 7/14/21/30/60/90/180 que el combo del modal, reutilizando su caché— y se le pasan las medias de la provincia, la serie de precios con fecha de hasta 12 gasolineras (con mín/máx/variación) y las mayores subidas y bajadas
- Botón **Cancelar** para abortar mensaje en curso (AbortController)
- Botón **✎ Editar** en mensajes enviados para corregir y reenviar
- **Respuesta formateada**: el Markdown que devuelve el modelo (negrita, cursiva, títulos, listas, tablas, código y saltos de línea) se convierte a HTML con `renderAiMarkdown()`, en vez de pintarse tal cual y amontonarse en un bloque. El texto original se guarda en `data-raw` — así el historial que se reenvía al modelo y la edición recuperan el Markdown, no el HTML— y lo que teclea el usuario se escapa para que una etiqueta no se inyecte
- **Marca de agua en cada respuesta**: bajo el mensaje del asistente se muestra el modelo usado y el tiempo que tardó (`⏱ codestral-latest · 1,2 s`), sin entrar en lo que se reenvía al modelo
- **Pestañas de IA ocultables**: en Config → "Pestañas de IA" hay un checkbox por proveedor; por defecto están los 7 y los que desmarques dejan de aparecer en la pestaña IA (su chat y sus claves se conservan). Siempre debe quedar al menos una
- **Historial por pestaña**: cada conversación se guarda en `localStorage` con una clave propia (`gasolineras_ai_chat_<proveedor>`) al enviar, recibir o editar un mensaje, así que al recargar la app se restaura con su Markdown y el botón ✎. El botón 🗑 de cada panel borra **solo** la de ese proveedor (también es borrable desde Config → Caché → `localStorage`); los errores, los avisos y el mensaje de bienvenida no se guardan
- Modelos gratuitos por proveedor (sin coste de API)

### ⚙️ Panel de Configuración
- **Descuentos por marca**: descuento en céntimos/litro para ajustar precios
- **Caché de datos**: tabs IndexedDB / localStorage con información detallada
- **Paginación**: número de filas por página en la vista tabla (0 = todas)
- **Registro de actividad**: tabs API / Push
- **Notificaciones push**: activación, intervalo, días, modo de detección
- **Claves API - IA**: campo de contraseña para cargar claves cifradas, con opción "Volver a cargar"
- **Pestañas de IA**: checkbox por proveedor para quitar del chat los que no uses

---

## Comandos

```powershell
npm install                # playwright + web-push

npm test                   # 201 tests (194 HTTP + 7 file://) — suite completa
node check-syntax.mjs      # sintaxis de todo el JS (incluye el <script> inline del HTML)
npm run bump               # regenera ASSETS de sw.js + incrementa APP_VERSION y BUILD_TIME
npm run sync-assets        # solo regenera la lista ASSETS de sw.js
npm run check-assets       # verifica ASSETS sin escribir (sale con 1 si no cuadra)
```

`npm run bump` es obligatorio antes de cada commit: si no sube `APP_VERSION`, el Service Worker no detecta el cambio y los usuarios se quedan con los assets viejos.

---

## Estructura del proyecto

| Ruta | Contenido |
|------|-----------|
| `index.html` | App shell: toolbar, contenido, bottom tabs y todos los `<script>` en orden |
| `css/styles.css` | Estilos responsive |
| `js/state.js` | `STATE` global, combustibles, descuentos, `HISTORY_DAYS_OPTIONS` |
| `js/helpers.js` | Precios, distancia, descuentos, `comparePrices()`, `formatLogTime()` |
| `js/db.js` | IndexedDB compartido cliente + SW (stores `cache`, `favorites`, `config`) |
| `js/history.js` | **Histórico compartido**: fechas `dd-mm-aaaa`, descarga con caché y serie por estación (lo usan la página, el chat IA y el SW) |
| `js/chart-core.js` | **Primitivas de gráfica compartidas**: canvas, escala, ejes, mín/máx y tooltip |
| `js/chart-engine.js` | Gráfica del panel de detalle (usa `chart-core.js`) |
| `js/map.js` | Mapa Leaflet, marcadores, popups y su gráfica |
| `js/table.js` | Tabla, `showDetail()`, histórico del modal |
| `js/controls.js` | `render()`, `setActiveTab()`, filtros, favoritos |
| `js/api.js` | Fetch de datos, `apiFetch()` con log, `tryAutoRestoreProvince()` |
| `js/storage.js` | localStorage, `createRingLog()`, tabs de caché y de logs |
| `js/ai-chat.js` | Chat IA: proveedores, catálogo de modelos, contexto, histórico y formato de la respuesta (`renderAiMarkdown()`) |
| `js/push-notifications.js` | Suscripción Web Push + log de eventos |
| `js/main.js` | Eventos, arranque y restauración de estado |
| `sw.js` | Caché, periodicsync, `checkPrices()`, notificaciones + `APP_VERSION` |
| `workers/` | Worker de Cloudflare que hace de proxy de NVIDIA |
| `scripts/` | `bump-version.mjs` y `sync-sw-assets.mjs` |
| `check-syntax.mjs` | Comprobación de sintaxis de todo el JS del repo |
| `docs/` | API del Ministerio, changelog, push, plan de mejoras y tests |

---

## Stack técnico

| Componente | Tecnología |
|------------|------------|
| App shell | HTML5 + CSS3 (responsive, ~430 líneas) |
| Mapas | [Leaflet](https://leafletjs.com/) 1.9.4 con tiles OSM / CartoDB / ESRI / CyclOSM / OpenTopoMap / NatGeo (con proveedor de respaldo por vista) |
| Gráficas | Canvas 2D nativo — sin librerías de charts (`chart-core.js` compartido por las dos vistas) |
| Persistencia | IndexedDB + localStorage |
| Notificaciones | Web Push API + Periodic Background Sync |
| Service Worker | Cache-first + Network-first híbrido, precaché generado por script |
| Chat IA | Pestaña **General** (misma pregunta a todos los proveedores visibles, en paralelo) + 7 proveedores (Groq, Mistral, OpenRouter, LLM7.io, NVIDIA vía Worker, Google Gemini, Chrome Built-in AI) |
| Tests | Playwright (201 tests, servidor HTTP inline) |
| Desarrollo | [OpenCode](https://opencode.ai) con modelos DeepSeek (libres) |

---

## Roadmap / Ideas futuras

### Chat IA — Próximas mejoras consideradas
- **Streaming de respuestas** (SSE) para mostrar el texto en tiempo real
- **Prompt personalizado** por el usuario en la UI de Config
- **Selección de temperatura / max_tokens** por proveedor
- **Comparativa entre modelos**: enviar misma pregunta a varios proveedores simultáneamente
- **Exportar conversación** (JSON / texto)
- **Entrada por voz** (Web Speech API)
- **Imagen y análisis visual** con Gemini Vision (modelos multimodales)
- **RAG de gasolineras**: búsqueda semántica sobre los datos cargados
- **Atajo de teclado** para enfoque rápido del input de chat
- **Auto-detección** del proveedor más rápido disponible

### Otras funcionalidades exploradas
- Conteo de tokens (tiktoken) para no exceder límites de contexto
- Chat dentro del panel de detalle de cada estación
- Sugerencias de preguntas frecuentes sobre precios

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [AGENTS.md](./AGENTS.md) | Convenciones del proyecto, arquitectura y reglas para no romper nada |
| [docs/API.md](./docs/API.md) | Endpoints del Ministerio con ejemplos reales de respuesta |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Historial de cambios con su verificación |
| [docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md) | Arquitectura push (SW-based) y depuración |
| [docs/mejoras-petrol.md](./docs/mejoras-petrol.md) | Por qué se hizo cada mejora |
| [docs/test/TEST_PLAN.md](./docs/test/TEST_PLAN.md) | Plan de pruebas y cobertura |

---

## Licencia

ISC. Datos del [Geoportal de Hidrocarburos](https://geoportalgasolineras.es/) del Ministerio para la Transición Ecológica.

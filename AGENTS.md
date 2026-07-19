# AGENTS.md

## Documentación principal

Ver [`README.md`](./README.md) para visión general del proyecto, funcionalidades y stack técnico.

## Workflow obligatorio

1. **Siempre ejecutar tests completos** tras cualquier cambio:
   ```powershell
   Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
   node docs/test/full_test.mjs
   ```
   Si los tests no existen o fallan, no continuar hasta que pasen todos.

2. **Commit**: preguntar al usuario antes de hacer commit. Si confirma:
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
5. Mapa (tipo mapa + ✕ limpiar)
6. (actions-group con leyenda de precios)

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
- 51 tests totales (44 HTTP + 7 file://)
- Test de persistencia F5: selecciona provincia, recarga página, verifica que se restauró
- Servidor HTTP inline (no requiere procesos externos)
- Push notifications tests (14.1-14.10) integrados en full_test.mjs

### Actualización de assets y `APP_VERSION`
- `sw.js` tiene una constante `APP_VERSION` (entero)
- Cada vez que se modifica un asset (`.html`, `.css`, `.js`, `.json`, iconos), **hay que incrementar `APP_VERSION`** en `sw.js`
- Motivo: `navigator.serviceWorker.ready.then(r => r.update())` solo detecta cambios en `sw.js`; si no se incrementa la versión, los nuevos assets no se descargan
- El botón "Comprobar actualizaciones" en la UI usa `reg.update()` + `updatefound` para detectar el cambio y ofrecer recarga

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
# Tests
node docs/test/full_test.mjs

# Servidor manual para depuración
node -e "const h=require('http'),fs=require('fs');h.createServer((q,r)=>{let p=q.url=='/'?'index.html':q.url.slice(1);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end('')}else{r.writeHead(200,{'Content-Type':{'html':'text/html','css':'text/css','js':'application/javascript'}[p.split('.').pop()]||'text/plain'});r.end(d)}})}).listen(8080)"
```

### Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `index.html` | Toolbar + content + tabs + bottom sheet |
| `css/styles.css` | ~340 líneas responsive |
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

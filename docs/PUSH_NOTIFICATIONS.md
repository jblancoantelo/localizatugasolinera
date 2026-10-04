# Push Notifications — Documentación Técnica

**Estado**: ✅ Reimplementado (v2 - SW-based)
**Fecha**: 2026-07-17
**Última actualización**: 2026-10-04 — el histórico y los logs se comparten con el cliente (`js/history.js`, `createRingLog()`)

Sin backend ni servidor push externo. El chequeo de precios lo ejecuta el Service Worker directamente contra la API del Geoportal de Hidrocarburos.

## Arquitectura

### Flujo de datos

```
1. periodicsync (Android) o setInterval (escritorio) → SW
2. SW lee favoritos de IndexedDB
3. Agrupa por provincia
4. Para cada provincia:
   a. Fetch FRESCO de la API (ignora caché)
   b. Actualiza caché en IndexedDB con datos frescos
   c. Fetch histórico para comparación (usa caché si disponible)
   d. Compara precio actual vs histórico
5. Si hay bajada → self.registration.showNotification()
6. Click en notificación → clients.openWindow + postMessage → app abre con detalle
```

### Arquitectura del log

```
SW (checkPrices, events) → sendPushLog() → postMessage({type:'push-log'}) → main.js message handler → logPushEvent() → PUSH_LOG_RING → renderPushLog()
Cliente (toggles, config, subscribe) → logPushEvent() → PUSH_LOG_RING → renderPushLog()
```

`PUSH_LOG_RING` es el buffer circular de 30 entradas creado con `createRingLog()`
(`js/storage.js`), el mismo que usa el log de la API. Guarda de más antiguo a más
reciente, así que `renderPushLog()` lo pinta invertido.

## Componentes

### `js/db.js` (COMPARTIDO)
Funciones IndexedDB compartidas entre cliente y Service Worker:
- `openDB()` — conexión a IndexedDB (v2: stores: `cache`, `favorites`, `config`)
- `dbGet(store, key)`, `dbPut(store, key, value)`, `dbDelete(store, key)`
- `dbGetAll(store)`, `dbGetAllKeys(store)` — **`store` es obligatorio**: sin él la transacción se abre sobre un store inexistente y el error se resuelve en silencio
- `getCachedProvinceData(province)`, `cacheProvinceData(province, data, ttl)`
- `dbGetAllFavorites()`, `dbAddFavorite(fav)`, `dbRemoveFavorite(id)`
- `getPushConfig()`, `setPushConfig(config)`

### `js/history.js` (COMPARTIDO)
El histórico ya **no** está duplicado en el SW. `sw.js` lo importa con `importScripts`
y usa las mismas funciones que la página y el chat de IA:
- `fetchHistoryByProvinceId(provinceId, days)` — descarga por fecha (lotes de 3) y cachea en IndexedDB con clave `hist_<idProvincia>_<dd-mm-aaaa>`
- `getStationHistory(historyByDate, stationId, fuelName)` — serie de precios de una estación
- `historyRequest(url)` — delega en `apiFetch()` si existe (en el cliente, para que la descarga quede en el log de la API) y hace un `fetch` simple en el SW
- `sortHistoryDates(keys)` — las fechas son `dd-mm-aaaa`, un `sort()` normal las desordena

### `sw.js`
El SW contiene la lógica de chequeo de precios:
- `checkPrices()` — función principal, lee favoritos de IndexedDB, fetchea API, compara, notifica
- `periodicsync` event — dispara `checkPrices()`
- `message` event — recibe `trigger-price-check` desde el cliente (fallback escritorio)
- `push` event — handler para mensajes push del servidor (si se implementara)
- `notificationclick` — URL matching corregido (`new URL(client.url).pathname`)
- `importScripts('js/state.js', 'js/helpers.js', 'js/db.js', 'js/history.js')` — todo lo que importa tiene que estar en `ASSETS`, si no el SW arranca sin esas funciones
- `sendPushLog(event, detail)` — envía eventos de log push al cliente vía postMessage

### `js/helpers.js`
- `comparePrices(currentPrice, oldestPrice)` — función pura que retorna `{ difference, currentPrice, oldestPrice }` o `null`
- `checkFavoritePrices()` eliminada (reemplazada por `checkPrices()` en SW)
- `formatLogTime()` — formato `dd/mm/yy hh:mm:ss` para timestamps de logs

### `js/controls.js`
- `toggleFavorite(id)` escribe en IndexedDB (`dbAddFavorite`/`dbRemoveFavorite`) además de `STATE.favorites[]`

### `js/main.js`
- `setInterval` fallback ahora envía `postMessage({ type: 'trigger-price-check' })` al SW
- Sincroniza configuración push con IndexedDB (`setPushConfig`)
- Botón test → envía mensaje al SW en vez de ejecutar `checkFavoritePrices()`
- Restaura los dos logs desde `localStorage` **antes** de cualquier llamada a la API, referenciando `API_LOG_RING`/`PUSH_LOG_RING` por su identificador (son `const` de nivel superior y **no** cuelgan de `window`)
- Log de eventos push: estado inicial, toolbar, toggles bajada/subida, checkInterval, priceFallDays, PeriodicSync, setInterval, test, mensajes SW (`push-log`)

### `js/push-notifications.js`
- `subscribeUserToPush()` — timeout eliminado, loguea endpoint + claves p256dh + auth
- `unsubscribeUserFromPush()` — también desregistra `periodicSync`
- `PUSH_LOG_RING` — buffer circular de 30 eventos (`createRingLog(30)`, con respaldo si `storage.js` aún no estuviera cargado)
- `logPushEvent(event, detail)` — añade entrada con timestamp `formatLogTime()`, persiste en `localStorage` y renderiza
- `renderPushLog()` — renderiza en `#pushLogEntries` (panel Push del config) del más reciente al más antiguo
- `clearPushLog()` — vacía el log y borra la clave guardada

## VAPID Keys

```env
VAPID_PUBLIC_KEY=BDpoYD9azs5I8SHt23Gx8BMJ6d2q1ghIluak4flDh7a2lfKIS_3tn9QFh8gaQQeG4kTYYnEl5e3S1btbH1hbNQs
```

Hardcodeada en `push-notifications.js`. Clave privada no necesaria (no hay backend push).

## Configuración (almacenada en IndexedDB store `config`, clave `push_config`)

| Campo | Rango | Default | Descripción |
|-------|-------|---------|-------------|
| `checkInterval` | 1-24h | 8 | Horas entre chequeos |
| `priceFallDays` | 0-90d | 3 | Días de histórico a comparar |
| `cacheTtl` | 0-∞ | 12 | Horas de validez de caché tras actualizar |

## Push Log — Registro de actividad

Cada evento push se registra en `PUSH_LOG_RING` (cliente) o se envía al cliente vía `postMessage` (Service Worker). Es un buffer circular de 30: cuando se llega al máximo se descarta **la más antigua**, que es justo lo que se quiere en un log de actividad.

### Eventos registrados

| Origen | Evento | Detalle |
|--------|--------|---------|
| Cliente | `Estado inicial` | `suscrito — endpoint: ... SW: ✅ conectado` / `no suscrito` |
| Cliente | `Permission` | `granted` / `denied` / `default` |
| Cliente | `Subscribe` | `éxito — endpoint: ... \| p256dh: ... \| auth: ... \| userVisibleOnly: true` |
| Cliente | `Unsubscribe` | `éxito` / `error: ...` |
| Cliente | `Toolbar` | `suscripción manual` / `desuscripción manual` |
| Cliente | `🔔 bajada` / `📈 subida` | `activado \| suscripción: no→sí` / `desactivado \| suscripción: sí→no` |
| Cliente | `checkInterval` / `priceFallDays` | `8h` / `3d` |
| Cliente | `PeriodicSync` | `registrado cada 8h` / `no disponible — fallback setInterval` |
| Cliente | `⏱️ setInterval` | `fallback cada 8h` |
| Cliente | `🧪 Test` | `modo=bajada mensaje enviado al SW` + texto notificación mostrada |
| SW | `⏰ periodicsync` | `iniciado — motivo: alarma periódica del SO` |
| SW | `📩 trigger-price-check` | `recibido — motivo: test bajada / intervalo setInterval` |
| SW | `checkPrices` | `inicio — motivo: ... \| checkDrop=true checkRise=false` |
| SW | `checkPrices` (por estación) | `  EstaciónX: sin cambio — skip` / `  ✅ EstaciónY: ↓ bajada 0.050€ — ALERTA #N` |
| SW | `checkPrices` | `completado: N alertas (N↓ N↑)` / `0 alertas — no se envía notificación` |
| SW | `📨 notificación` | `mostrada: título="Alerta de Precios" body="..." tag=price-alert` |
| SW | `📨 push recibido` | `título="..." body="..." tag=...` |
| SW | `notificationclick` | `recibido — título="..." body="..." tag=...` |

## Claves de almacenamiento

| Clave | Store | Propósito |
|-------|-------|-----------|
| `gasolineras_db` / `favorites` | IndexedDB | Favoritos con `{ id, provinceName, provinceId, brand }` |
| `gasolineras_db` / `config` | IndexedDB | Configuración push (accesible por SW) |
| `gasolineras_db` / `cache` | IndexedDB | Caché de datos de provincias (`prov_<nombre>`) e histórico (`hist_<idProvincia>_<dd-mm-aaaa>`) |
| `gasolineras_push_subscription` | localStorage | PushSubscription JSON |
| `gasolineras_state` | localStorage | Estado global de la app (UI) |
| `gasolineras_push_log` | localStorage | Últimos 30 eventos push (del más antiguo al más reciente) |
| `gasolineras_api_log` | localStorage | Últimas 30 llamadas a la API, mismo formato |

## Testing rápido (sin esperar X horas)

### Opción 1: DevTools + Dispatch

1. Abrir la app en localhost (no file://, necesita SW)
2. Agregar favorito: click en una estación → ★
3. Suscribirse: click 🔔 en toolbar → aceptar permisos
4. Verificar: `#pushNotifStatus` muestra "✓ Notificaciones activas"
5. Forzar chequeo:
   ```
   DevTools → Application → Service Workers
   → Periodic Sync → "check-favorite-prices" → [Dispatch]
   ```
   O en consola:
   ```javascript
   navigator.serviceWorker.ready.then(reg =>
     reg.periodicSync.register('check-favorite-prices', { minInterval: 1000 })
   );
   ```
6. Resultado: si el precio bajó vs histórico, aparece notificación

### Opción 2: Botón "Probar"

Click en `#pushNotifTestBtn` (Config tab) → envía `trigger-price-check` al SW → muestra notificación de confirmación.

### Opción 3: setInterval fallback

En escritorio, si `periodicSync` no está disponible, se usa `setInterval`. Abrir app, suscribirse, esperar el intervalo configurado.

## Debug desde consola

```javascript
// Ver favoritos en IndexedDB
dbGetAll('favorites').then(f => console.log('Favoritos:', f));

// Ver configuración push
getPushConfig().then(c => console.log('Config:', c));

// Forzar chequeo desde el SW
navigator.serviceWorker.controller.postMessage({ type: 'trigger-price-check' });

// Ver suscripción push
isPushSubscribed();
getPushSubscription();

// Ver periodicSync tags
navigator.serviceWorker.ready.then(r => r.periodicSync.getTags()).then(t => console.log(t));
```

## Notas

- El servidor HTTP de test (`localhost`) permite SW y notificaciones (aunque no sea HTTPS)
- `file://` NO tiene SW → notificaciones no funcionan
- En Android, periodicSync requiere PWA instalada en home screen
- En escritorio, funciona el `setInterval` mientras la pestaña esté abierta

## Problemas conocidos

| Síntoma | Causa | Solución |
|---------|-------|----------|
| No llegan notificaciones | Sin favoritos en IndexedDB | Agregar estación a favoritos, verificar `dbGetAll('favorites')` |
| No llegan notificaciones | API del gobierno caída | Reintentar más tarde |
| SW no se activa | HTTPS requerido (excepto localhost) | Usar `https://` o localhost para testing |
| periodicSync no registra | Solo Android Chrome con PWA instalada | Usar `setInterval` fallback en escritorio |
| El SW no encuentra `fetchHistoryByProvinceId` o `getStationHistory` | `js/history.js` no está en el precaché y el SW se instaló sin él | `npm run bump` y volver a cargar; el script de sync falla si algún `importScripts` no queda en `ASSETS` |
| El log de push aparece vacío | `localStorage` sin `gasolineras_push_log` o `PUSH_LOG_RING` sin restaurar | Comprobar en DevTools que la clave existe; se restaura por identificador global, no por `window` |

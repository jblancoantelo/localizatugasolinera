# Push Notifications - Documentación Técnica

**Estado**: ✅ Reimplementado (v2 - SW-based)
**Fecha**: 2026-07-17
**Última actualización**: Refactor: toda la lógica de chequeo ahora corre en el Service Worker

## Arquitectura

Sin backend ni servidor push externo. El chequeo de precios lo ejecuta el Service Worker directamente contra la API del Geoportal de Hidrocarburos.

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

## Componentes

### `js/db.js` (COMPARTIDO)
Funciones IndexedDB compartidas entre cliente y Service Worker:
- `openDB()` — conexión a IndexedDB (v2: stores: `cache`, `favorites`, `config`)
- `dbGet(store, key)`, `dbPut(store, key, value)`, `dbDelete(store, key)`
- `dbGetAll(store)`, `dbGetAllKeys(store)`, `dbClear(store)`
- `getCachedProvinceData(province)`, `cacheProvinceData(province, data, ttl)`
- `dbGetAllFavorites()`, `dbAddFavorite(fav)`, `dbRemoveFavorite(id)`
- `getPushConfig()`, `setPushConfig(config)`

### `sw.js` (MODIFICADO)
El SW ahora contiene toda la lógica de chequeo de precios:
- `checkPrices()` — función principal, lee favoritos de IndexedDB, fetchea API, compara, notifica
- `fetchProvinceHistorySW(provinceId, days)` — obtiene histórico desde la API
- `getStationHistorySW(historyByDate, stationId, fuelName)` — extrae histórico de una estación
- `periodicsync` event — dispara `checkPrices()`
- `message` event — recibe `trigger-price-check` desde el cliente (fallback escritorio)
- `push` event — handler para mensajes push del servidor (si se implementara)
- `notificationclick` — URL matching corregido (`new URL(client.url).pathname`)
- `importScripts('js/state.js', 'js/helpers.js', 'js/db.js')`
- `sendPushLog(event, detail)` — envía eventos de log push al cliente vía postMessage

### `js/helpers.js`
- `comparePrices(currentPrice, oldestPrice)` — función pura que retorna `{ difference, currentPrice, oldestPrice }` o `null`
- `checkFavoritePrices()` eliminada (reemplazada por `checkPrices()` en SW)
- `formatLogTime()` — formato `dd/mm/yy hh:mm:ss` para timestamps de logs

### `js/controls.js`
- `toggleFavorite(id)` escribe en IndexedDB (`dbAddFavorite`/`dbRemoveFavorite`) ademas de `STATE.favorites[]`

### `js/main.js`
- `setInterval` fallback ahora envía `postMessage({ type: 'trigger-price-check' })` al SW
- Sincroniza configuración push con IndexedDB (`setPushConfig`)
- Botón test → envía mensaje al SW en vez de ejecutar `checkFavoritePrices()`
- Log de eventos push: estado inicial, toolbar, toggles bajada/subida, checkInterval, priceFallDays, PeriodicSync, setInterval, test, mensajes SW (`push-log`)

### `js/push-notifications.js`
- `subscribeUserToPush()` — timeout eliminado, loguea endpoint + claves p256dh + auth
- `unsubscribeUserFromPush()` — también desregistra `periodicSync`
- `PUSH_LOG[]` — array con últimas 30 entradas de eventos push
- `logPushEvent(event, detail)` — añade entrada con timestamp `formatLogTime()` y renderiza
- `renderPushLog()` — renderiza en `#pushLogEntries` (panel Push del config)
- `clearPushLog()` — vacía el log

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

Cada evento push se registra en el array `PUSH_LOG[]` (cliente) o se envía al cliente via `postMessage` (Service Worker).

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

### Arquitectura del log

```
SW (checkPrices, events) → sendPushLog() → postMessage({type:'push-log'}) → main.js message handler → logPushEvent() → PUSH_LOG[] → renderPushLog()
Cliente (toggles, config, subscribe) → logPushEvent() → PUSH_LOG[] → renderPushLog()
```

## Estado vs localStorage

| Clave | Store | Propósito |
|-------|-------|-----------|
| `gasolineras_db` / `favorites` | IndexedDB | Favoritos con `{ id, provinceName, provinceId, brand }` |
| `gasolineras_db` / `config` | IndexedDB | Configuración push (accesible por SW) |
| `gasolineras_db` / `cache` | IndexedDB | Caché de datos de provincias e histórico |
| `gasolineras_push_subscription` | localStorage | PushSubscription JSON |
| `gasolineras_state` | localStorage | Estado global de la app (UI) |

## Problemas conocidos

| Síntoma | Causa | Solución |
|---------|-------|----------|
| No llegan notificaciones | Sin favoritos en IndexedDB | Agregar estación a favoritos, verificar `dbGetAll('favorites')` |
| No llegan notificaciones | API del gobierno caída | Reintentar más tarde |
| SW no se activa | HTTPS requerido (excepto localhost) | Usar `https://` o localhost para testing |
| periodicSync no registra | Solo Android Chrome con PWA instalada | Usar `setInterval` fallback en escritorio |

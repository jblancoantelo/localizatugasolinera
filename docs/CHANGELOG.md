# CHANGELOG

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

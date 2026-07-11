# Push Notifications - Documentación Técnica

**Estado**: ✅ Implementado y testeado
**Fecha**: 2026-07-11
**Última actualización**: Fix DOMContentLoaded en main.js

## Requisitos

- PWA con Service Worker registrado
- Android + Chrome (Periodic Background Sync soportado)
- Notification Permission API disponible
- IndexedDB para persistencia favoritos
- localStorage para configuración

## Componentes Principales

### 1. `js/push-notifications.js` (NUEVO)

Gestiona la suscripción Web Push lifecycle:

```javascript
// Funciones públicas
requestNotificationPermission()        // Request Notification.permission='granted'
subscribeUserToPush(vapidPublicKey)    // Crear PushSubscription
unsubscribeUserFromPush()              // Eliminar suscripción
getPushSubscription()                  // Leer de localStorage
isPushSubscribed()                     // Boolean check
urlBase64ToUint8Array(base64String)    // Decodificar VAPID key
```

**Dependencias**:
- Service Worker registrado
- VAPID public key (hardcoded o parámetro)
- Notification API

**Storage**:
- localStorage key: `push_subscription_key` (JSON stringified)

### 2. `sw.js` (MODIFICADO)

Event listeners:

```javascript
// Periodicsync - ejecuta cada X horas
addEventListener('periodicsync', event => {
  if (event.tag === 'check-favorite-prices') {
    event.waitUntil(
      clients.matchAll().then(clientList => {
        clientList.forEach(client => {
          client.postMessage({ type: 'trigger-price-check' });
        });
      })
    );
  }
});

// Notificationclick - user hace click en notificación
addEventListener('notificationclick', event => {
  event.notification.close();
  const stationId = event.notification.data?.stationId;
  clients.matchAll().then(clientList => {
    clientList.forEach(client => {
      client.postMessage({ 
        type: 'open-favorite', 
        stationId: stationId 
      });
    });
  });
});
```

### 3. `js/main.js` (MODIFICADO)

En `DOMContentLoaded`:

```javascript
// CRÍTICO: Restaurar estado ANTES de registerPeriodicSync
if (saved.checkInterval) STATE.checkInterval = saved.checkInterval;
if (saved.priceFallDays) STATE.priceFallDays = saved.priceFallDays;
if (saved.pushNotificationsEnabled) STATE.pushNotificationsEnabled = saved.pushNotificationsEnabled;

// Escuchar postMessage desde SW
navigator.serviceWorkerContainer.addEventListener('message', event => {
  if (event.data.type === 'trigger-price-check') {
    checkFavoritePrices();
  }
  if (event.data.type === 'open-favorite') {
    setActiveTab('tab-table');
    showDetail(event.data.stationId);
  }
});

// Event listeners UI
document.getElementById('pushNotifBtn').addEventListener('click', async () => {
  const isSubscribed = isPushSubscribed();
  if (isSubscribed) {
    await unsubscribeUserFromPush();
    STATE.pushNotificationsEnabled = false;
  } else {
    const success = await subscribeUserToPush(VAPID_PUBLIC_KEY);
    if (success) {
      STATE.pushNotificationsEnabled = true;
      registerPeriodicSync();
    }
  }
  saveState();
  updatePushNotifStatus();
});

// Registrar Periodic Sync
async function registerPeriodicSync() {
  try {
    const registration = await navigator.serviceWorkerContainer.ready;
    await registration.periodicSync.register('check-favorite-prices', {
      minInterval: STATE.checkInterval * 3600000 // convertir horas a ms
    });
  } catch (error) {
    console.error('Periodic sync registration failed:', error);
  }
}
```

**⚠️ CRÍTICO**: El evento `DOMContentLoaded` DEBE terminar con `});`. Si falta, toda la app falla.

### 4. `js/helpers.js` (MODIFICADO)

Nueva función `checkFavoritePrices()`:

```javascript
async function checkFavoritePrices() {
  if (!STATE.favorites || STATE.favorites.length === 0) {
    console.log('No favorites to check');
    return;
  }

  try {
    // Fetch datos actuales provincia
    const data = await fetch(`https://sedeaplicaciones.minetur.gob.es/...`);
    // Fetch histórico (últimos X días)
    for (let i = 0; i < STATE.priceFallDays; i++) {
      const histData = await getStationHistory(stationId, days[i]);
      // Comparar precio actual vs histórico
      if (currentPrice < historicPrice) {
        // Mostrar notificación
        const registration = await navigator.serviceWorkerContainer.ready;
        await registration.showNotification(
          `${fuelType} bajó en ${stationName}`,
          {
            body: `${currentPrice}€ (era ${historicPrice}€)`,
            data: { stationId: stationId },
            requireInteraction: true,
            icon: '/icons/icon-192x192.png'
          }
        );
      }
    }
  } catch (error) {
    console.error('checkFavoritePrices error:', error);
  }
}
```

### 5. `index.html` (MODIFICADO)

UI elements:

```html
<!-- Toolbar button -->
<button id="pushNotifBtn" title="Notificaciones">🔔</button>

<!-- Config card section -->
<div class="config-section">
  <h3>Notificaciones Push</h3>
  <label>
    <input id="pushNotifToggle" type="checkbox"> Habilitar
  </label>
  <div id="pushNotifStatus">✗ Notificaciones inactivas</div>
  
  <label>
    Chequear cada:
    <input id="checkInterval" type="number" min="1" max="24" value="8"> horas
  </label>
  
  <label>
    Notificar si cae:
    <input id="priceFallDays" type="number" min="0" max="90" value="3"> días
  </label>
</div>

<!-- Script debe ir ANTES de main.js -->
<script src="js/push-notifications.js"></script>
<script src="js/main.js"></script>
```

### 6. `js/state.js` (MODIFICADO)

Nuevas propiedades:

```javascript
const STATE = {
  // ... existing properties ...
  pushNotificationsEnabled: false,
  checkInterval: 8,      // horas
  priceFallDays: 3,      // días
};
```

### 7. `js/storage.js` (MODIFICADO)

Persistencia:

```javascript
function saveState() {
  const s = STATE;
  localStorage.setItem('gasolineras_state', JSON.stringify({
    // ... existing ...
    checkInterval: s.checkInterval,
    priceFallDays: s.priceFallDays,
    pushNotificationsEnabled: s.pushNotificationsEnabled,
  }));
}
```

## VAPID Keys

Generadas con `web-push` npm package:

```env
VAPID_PUBLIC_KEY=BDpoYD9azs5I8SHt23Gx8BMJ6d2q1ghIluak4flDh7a2lfKIS_3tn9QFh8gaQQeG4kTYYnEl5e3S1btbH1hbNQs
VAPID_PRIVATE_KEY=aEJXkt8jYoQG8Nl9u7w--yR34ekMEh8MeHWmsfQKjm8
```

- **Public key**: Hardcoded en `push-notifications.js` (se envía al navegador)
- **Private key**: Solo para servidor (si implementas backend push)

## Flujo de Datos

### 1. Suscripción (User Initiated)

```
User click 🔔 button
  ↓
subscribeUserToPush() [push-notifications.js]
  ↓
navigator.serviceWorkerContainer.ready.pushManager.subscribe()
  ↓
PushSubscription creada
  ↓
Guardada en localStorage
  ↓
registerPeriodicSync('check-favorite-prices', minInterval: 8h)
  ↓
OS registra con tag 'check-favorite-prices'
```

### 2. Background Sync (OS Driven)

```
[After 8 hours / periodically]
  ↓
Android OS triggers periodicsync event
  ↓
sw.js: addEventListener('periodicsync') fires
  ↓
postMessage 'trigger-price-check' a todos los clientes
  ↓
main.js: addEventListener('message') recibe
  ↓
Ejecuta checkFavoritePrices()
  ↓
Fetch histórico + actual
  ↓
Comparar precios
  ↓
[Si precio cayó X días]:
  registration.showNotification(...)
```

### 3. Notification Click (User Interaction)

```
User click notificación
  ↓
sw.js: addEventListener('notificationclick') fires
  ↓
postMessage 'open-favorite' + stationId
  ↓
main.js recibe, ejecuta:
  - setActiveTab('tab-table')
  - showDetail(stationId)
  ↓
App abre con detalle de la estación
```

## Testing

### Sin Periodic Background Sync Real

1. **DevTools Simulation**:
   ```
   DevTools → Application → Service Workers
   → Periodic Sync → check-favorite-prices → [Dispatch]
   ```

2. **Console Direct Call**:
   ```javascript
   STATE.checkInterval = 0.001;  // 3.6 segundos para testing
   await navigator.serviceWorkerContainer.ready
     .then(r => r.periodicSync.register('check-favorite-prices', {minInterval: 3600}));
   ```

3. **Manual Function Call**:
   ```javascript
   // Agregar favorite desde Config tab primero
   checkFavoritePrices();
   ```

4. **Modificar Umbral de Caída**:
   ```javascript
   STATE.priceFallDays = 0;  // Notificar por cualquier precio histórico
   ```

### Con Android Real

1. Instalar PWA en home screen
2. Cerrar app
3. Esperar X horas (o modificar checkInterval para testing)
4. OS dispara periodicsync
5. Notificación debería aparecer
6. Click abre app + detalle estación

## Problemas Comunes

### Problema: DOMContentLoaded no cierra

**Síntoma**: Página no carga, error en consola

**Solución**: Verificar `}); ` al final de main.js DOMContentLoaded

### Problema: Periodic Sync no registra

**Síntoma**: `registration.periodicSync.getTags()` vacío

**Causa**: 
- Service Worker no activo
- Notification permission != 'granted'
- Browser no soporta PBS (solo Chrome mobile)

**Solución**: 
- Verificar `Notification.permission === 'granted'`
- Usar DevTools → Application → Manifest → "Show latest notification"

### Problema: Notificación no aparece

**Síntoma**: checkFavoritePrices ejecuta pero sin notificación

**Causa**:
- No hay favoritos guardados
- Precio no cayó X días
- `requireInteraction: true` pero permiso insuficiente

**Solución**:
- Agregar favoritos en Config tab
- Verificar STATE.favorites en console
- Modificar STATE.priceFallDays a 0 para testing

### Problema: App no abre al click notificación

**Síntoma**: Click notificación cierra notificación pero app no abre

**Causa**: postMessage listener no registrado

**Solución**: Verificar `navigator.serviceWorkerContainer.addEventListener('message', ...)` en main.js

## Configuración

| Setting | Rango | Default | Unidad | Notas |
|---------|-------|---------|--------|-------|
| Enabled | true/false | false | - | Toggle en Config |
| checkInterval | 1-24 | 8 | horas | Cuándo chequear precios |
| priceFallDays | 0-90 | 3 | días | Caída mínima para notificar |

Todos los valores se guardan en localStorage automaticamente.

## Checklist de Implementación

- [x] Service Worker actualizado con periodicsync + notificationclick
- [x] push-notifications.js creado
- [x] main.js: postMessage listener + event handlers
- [x] main.js: DOMContentLoaded cierre con });
- [x] helpers.js: checkFavoritePrices() implementada
- [x] index.html: button 🔔 + config UI
- [x] state.js: propiedades nuevas
- [x] storage.js: persistencia
- [x] VAPID keys generadas
- [x] Validar sintaxis (no errores parse)
- [x] Página carga sin errores
- [ ] Testing full ciclo (requiere Android/Periodic Sync real)
- [ ] Deployment a servidor HTTPS (PWA requirement)

## Referencias

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Periodic Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Periodic_Background_Sync_API)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/workbox/service-worker-overview/)
- [VAPID Keys](https://www.rfc-editor.org/rfc/rfc8292)

# Push Notifications - Quick Start

## Testing Rápido (Sin Esperar 8 Horas)

### Opción 1: DevTools (Más Fácil)

1. **Abrir la app**
   ```
   file:///e:/Temp/VS/petrol/index.html
   ```

2. **Agregar favorito** (obligatorio)
   - Click en una estación
   - Click en ⭐ "Agregar a favoritos"

3. **Suscribirse a notificaciones**
   - Click botón 🔔 en toolbar
   - Aparece "✓ Notificaciones activas" en verde
   - Verificar localStorage: DevTools → Application → Local Storage → push_subscription_key

4. **Triggear Periodic Sync**
   ```
   DevTools → Application → Service Workers
   → Find "check-favorite-prices" under Periodic Sync
   → Click "Dispatch"
   ```

5. **Resultado**
   - Si precio bajó (comparando vs histórico de 3 días)
   - Notificación aparece
   - Click en notificación → App abre con detalle estación

---

### Opción 1b: DevTools y consola
```javascript
// En la consola del navegador:
navigator.serviceWorkerContainer.ready.then(reg => {
  reg.periodicSync.getTags().then(tags => console.log('Tags:', tags));
  reg.periodicSync.register('check-favorite-prices', { minInterval: 1000 }); // 1 segundo
});
```

Luego en Android DevTools → Application → Service Workers → marcar "Bypass for network" y forzar sync.

---

### Opción 2: Console (Para Debugging)

1. **Setup**
   ```javascript
   // Agregar favorito (en Config tab primero)
   STATE.favorites = [
     {
       stationId: '12345',
       fuelType: 'Gasolina 95',
       name: 'REPSOL',
       price: 1.65,
       location: 'A Coruña'
     }
   ];
   
   // Reducir umbral para testing
   STATE.priceFallDays = 0;  // Notificar cualquier precio
   STATE.checkInterval = 0.001;  // 3.6 segundos
   ```

2. **Ejecutar directamente**
   ```javascript
   checkFavoritePrices();
   ```

3. **Resultado**: Notificación debería aparecer

---

### Opción 3: Modificar Intervalo

1. **En Config tab**
   - checkInterval: cambiar a 1 minuto
   - priceFallDays: cambiar a 0

2. **Resubscribir**
   ```javascript
   unsubscribeUserFromPush();
   subscribeUserToPush('BDpoYD9azs5I8SHt23Gx8BMJ6d2q1ghIluak4flDh7a2lfKIS_3tn9QFh8gaQQeG4kTYYnEl5e3S1btbH1hbNQs');
   registerPeriodicSync();
   ```

3. **Esperar**: ~1 minuto para que OS dispare periodicsync

---

### Opción 4: Manual HTML Test

Crear archivo `test-push.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Push Notifications</title>
</head>
<body>
  <h1>Push Notifications Test</h1>
  
  <button onclick="testSubscribe()">Subscribe</button>
  <button onclick="testCheck()">Check Favorites</button>
  <button onclick="testNotification()">Show Notification</button>
  
  <div id="log" style="border: 1px solid black; padding: 10px; margin-top: 20px; height: 300px; overflow-y: auto;"></div>

  <script>
    const VAPID_PUBLIC_KEY = 'BDpoYD9azs5I8SHt23Gx8BMJ6d2q1ghIluak4flDh7a2lfKIS_3tn9QFh8gaQQeG4kTYYnEl5e3S1btbH1hbNQs';
    
    function log(msg) {
      const logEl = document.getElementById('log');
      logEl.innerHTML += `<p>${new Date().toLocaleTimeString()}: ${msg}</p>`;
      logEl.scrollTop = logEl.scrollHeight;
    }
    
    async function testSubscribe() {
      try {
        const registration = await navigator.serviceWorkerContainer.ready;
        log('✓ Service Worker ready');
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        log('✓ Push subscription created');
        
        localStorage.setItem('test_sub', JSON.stringify(subscription));
        log('✓ Subscription saved to localStorage');
      } catch (error) {
        log(`✗ Error: ${error.message}`);
      }
    }
    
    async function testCheck() {
      try {
        log('Testing checkFavoritePrices()...');
        // Requiere que checkFavoritePrices esté disponible
        await checkFavoritePrices?.();
        log('✓ Check completed');
      } catch (error) {
        log(`✗ Error: ${error.message}`);
      }
    }
    
    async function testNotification() {
      try {
        const registration = await navigator.serviceWorkerContainer.ready;
        await registration.showNotification('Test Notification', {
          body: 'Este es un test de notificación',
          requireInteraction: true
        });
        log('✓ Test notification shown');
      } catch (error) {
        log(`✗ Error: ${error.message}`);
      }
    }
    
    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
      const rawData = window.atob(base64);
      return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
    }
    
    // Log inicial
    window.addEventListener('load', () => {
      log('🔔 Push Notifications Test Page Loaded');
      log(`Permission: ${Notification.permission}`);
      
      if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(perm => {
          log(`Permission changed to: ${perm}`);
        });
      }
    });
  </script>
</body>
</html>
```

Abrir: `file:///e:/Temp/VS/petrol/test-push.html`

---

## Checklist

- [ ] Página carga sin errores
- [ ] Botón 🔔 visible en toolbar
- [ ] Click 🔔 suscribe/desuscribe
- [ ] Config inputs actualizan STATE
- [ ] localStorage tiene push_subscription_key
- [ ] Service Worker activo (DevTools)
- [ ] Periodic Sync "check-favorite-prices" registrado (DevTools → Periodic Sync)
- [ ] Notificación aparece al trigger
- [ ] Click notificación abre app

---

## Debug Tips

```javascript
// En console durante test

// Ver estado
console.log('STATE:', STATE);
console.log('Favoritos:', STATE.favorites);
console.log('Suscrito:', isPushSubscribed());

// Ver Service Worker
navigator.serviceWorkerContainer.controller

// Ver registros periódicos
navigator.serviceWorkerContainer.ready
  .then(r => r.periodicSync.getTags())
  .then(tags => console.log('Periodic Sync tags:', tags))

// Solicitar permiso
Notification.requestPermission().then(p => console.log('Permission:', p))

// Limpiar localStorage
localStorage.removeItem('push_subscription_key');
STATE.pushNotificationsEnabled = false;
```

---

## Problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Página no carga | DOMContentLoaded no cerrado | Verificar }); en main.js |
| 🔔 botón no funciona | postMessage listener falta | Verificar main.js addEventListener('message') |
| Notificación no aparece | No hay favoritos | Agregar favorito en Config |
| Notificación no aparece | Precio no cayó X días | Cambiar STATE.priceFallDays a 0 |
| Click notificación no abre app | postMessage handler falta | Verificar 'open-favorite' listener |
| Periodic Sync no registra | Service Worker no activo | F5 reload + verificar registration |

---

## Referencia Rápida

**Botones UI**:
- 🔔 - Suscribir/desuscribir notificaciones

**Config inputs** (Tab Config):
- Habilitar/deshabilitar
- checkInterval (1-24 horas, default 8)
- priceFallDays (0-90 días, default 3)

**Status**:
- ✓ Verde = Notificaciones activas
- ✗ Rojo = Inactivas

**localStorage keys**:
- `push_subscription_key` - PushSubscription JSON
- `gasolineras_state` - Incluye checkInterval, priceFallDays, pushNotificationsEnabled

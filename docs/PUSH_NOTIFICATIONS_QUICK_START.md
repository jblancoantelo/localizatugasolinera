# Push Notifications - Quick Start

## Testing Rápido (Sin Esperar X Horas)

### Opción 1: DevTools + Dispatch

1. **Abrir la app** en localhost (no file://, necesita SW)
2. **Agregar favorito**: click en una estación → ★
3. **Suscribirse**: click 🔔 en toolbar → aceptar permisos
4. **Verificar**: `#pushNotifStatus` muestra "✓ Notificaciones activas"
5. **Forzar chequeo**:
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
6. **Resultado**: si el precio bajó vs histórico, aparece notificación

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

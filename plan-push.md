# Plan: Web Push Notifications para PWA (Android)

## TL;DR
Implementar notificaciones push en PWA usando **Periodic Background Sync** para chequear cada X horas (configurable, default 8h) si el precio de favoritos bajó en los últimos Y días (configurable, default 3 días). Notificación abre app → tabla → favorito seleccionado → tooltip con histórico 14 días.

---

## Pasos

### 1. Generar VAPID keys (local, una vez)
- Ejecutar: `npx web-push generate-vapid-keys`
- Guardar clave pública en código
- Guardar clave privada en `.env` / `.gitignore`

### 2. Crear `js/push-notifications.js` (nuevo archivo)
- `requestNotificationPermission()` — solicita permiso del navegador
- `subscribeUserToPush(vapidPublicKey)` — suscribe al push service
- `getPushSubscription()` — lee subscription guardada en localStorage
- `unsubscribeUserFromPush()` — desuscribir

### 3. Añadir configuración en STATE
- `checkInterval` (horas, default 8)
- `priceFallDays` (días, default 3)
- Campos en config de la app

### 4. Modificar `index.html`
- Botón 🔔 "Notificaciones" en toolbar (activar/desactivar)
- Sección config: campos `checkInterval` y `priceFallDays` (spinner/input número)

### 5. Crear función `checkFavoritePrices()` en `js/helpers.js`
```javascript
async function checkFavoritePrices() {
  // 1. Lee favoritos de IndexedDB
  // 2. Para cada favorito:
  //    a. Fetch histórico últimos X días (según STATE.priceFallDays)
  //    b. Compara precio histórico vs precio actual
  //    c. Si bajó: prepara data para notificación
  // 3. Si hay cambios: envía notificación(es)
  // 4. Guarda último chequeo en IndexedDB
}
```

### 6. Modificar `js/main.js`
- Al cargar, registrar Periodic Background Sync:
  ```javascript
  if ('periodicSync' in registration) {
    registration.periodicSync.register('check-favorite-prices', {
      minInterval: STATE.checkInterval * 60 * 60 * 1000
    });
  }
  ```
- Event listener: botón 🔔 → `requestNotificationPermission()` → `subscribeUserToPush()`

### 7. Modificar `sw.js`
- Listener `periodicsync`:
  ```javascript
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-favorite-prices') {
      event.waitUntil(checkFavoritePrices());
    }
  });
  ```
- Listener `notificationclick`:
  ```javascript
  self.addEventListener('notificationclick', event => {
    event.notification.close();
    // Postear mensaje a cliente: abre app + tabla + favorito + tooltip
    clients.matchAll().then(clientList => {
      clientList.forEach(client => {
        client.postMessage({
          type: 'open-favorite',
          favoriteId: event.notification.data.favoriteId
        });
      });
    });
  });
  ```

### 8. Modificar `js/main.js` para recibir postMessage
```javascript
navigator.serviceWorker.addEventListener('message', event => {
  if (event.data.type === 'open-favorite') {
    // 1. Cambiar a tab "Tabla"
    setActiveTab('tab-table');
    // 2. Seleccionar/destacar el favorito
    // 3. Llamar a showDetail() para abrir tooltip con histórico
    showDetail(event.data.favoriteId);
  }
});
```

---

## Archivos a modificar/crear

| Archivo | Acción | Cambios |
|---------|--------|---------|
| `index.html` | Modificar | Botón 🔔 notificaciones + config checkInterval/priceFallDays |
| `js/main.js` | Modificar | Registrar PBS, listener mensaje SW, event botón 🔔 |
| `js/push-notifications.js` | CREAR | Funciones permiso/suscripción |
| `js/helpers.js` | Modificar | Añadir `checkFavoritePrices()` |
| `sw.js` | Modificar | Listeners `periodicsync` + `notificationclick` |
| `js/state.js` | Modificar | Añadir `checkInterval`, `priceFallDays` a STATE |

---

## Verificación

1. Generar VAPID keys: `npx web-push generate-vapid-keys`
2. Tests existentes: `node docs/test/full_test.mjs` → deben pasar
3. Abrir PWA en Android
4. Hacer clic en botón 🔔
5. Aceptar permisos "Permitir notificaciones"
6. Cambiar config (checkInterval = 1 min para test, priceFallDays = 0)
7. Cerrar app
8. Esperar o forzar periodic sync (DevTools → Application → Service Workers → trigger sync)
9. Notificación debe llegar
10. Hacer clic → app abre, tabla activa, favorito seleccionado, tooltip con histórico

---

## Decisiones

- **Periodic Background Sync** para Android (PBS) — ejecuta chequeo cada X horas aunque app cerrada
- **Notificación solo si baja X días** — configurable por usuario
- **Tooltip al clic** — reutiliza `showDetail()` existente con gráfico 14 días
- **localStorage** para suscripción + IndexedDB para caché histórico
- **Sin servidor externo** — todo en el navegador/PWA

---

## Scope excluido

- iOS (no soporta PBS)
- Backend persistente (guardar subscriptions en BD)
- Interfaz web para enviar notificaciones admin
- Notificaciones manuales (solo automáticas por PBS)

---

## Compatibilidad

| Plataforma | Soporte PBS | Soporte Web Push |
|-----------|------------|-----------------|
| Android Chrome | ✅ Sí | ✅ Sí |
| Android Firefox | ✅ Sí | ✅ Sí |
| iOS (Safari) | ❌ No | ⚠️ Parcial |

Para Android: **100% funcional**

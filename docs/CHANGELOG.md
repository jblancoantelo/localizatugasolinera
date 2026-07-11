# CHANGELOG

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

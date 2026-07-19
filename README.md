# Gasolineras — Precios de Gasolina en España

Aplicación web progresiva (PWA) para consultar **precios de carburantes en estaciones de servicio de España** en tiempo real, usando datos oficiales del [Geoportal de Hidrocarburos](https://geoportalgasolineras.es/) del Ministerio para la Transición Ecológica.

> 🧪 Este proyecto ha sido desarrollado íntegramente con **OpenCode** usando modelos de lenguaje libres (DeepSeek), sin depender de APIs de pago ni modelos propietarios. Todo el código es **software libre** — puedes usarlo, estudiarlo, modificarlo y compartirlo.

---

## Funcionalidades

### 🔍 Consulta de precios
- Datos en tiempo real desde la API oficial del Ministerio (actualización cada 30 minutos)
- Filtros por **provincia**, **localidad**, **combustible**, **marca** y **distancia máxima**
- Búsqueda textual por localidad, dirección o nombre de estación
- Leyenda dinámica de precios (verde < naranja < rojo) según percentiles

### 🗺️ Vista Mapa
- Mapa interactivo con **Leaflet** (OpenStreetMap + CartoDB + ESRI + CyclOSM)
- 4 estilos de mapa: calle, satélite, estándar y ciclismo
- Marcadores coloreados por precio
- Popup con datos de la estación e histórico de precios
- Posicionamiento manual (clic derecho) y geolocalización automática
- Filtro de distancia radial desde tu ubicación

### 📋 Vista Tabla
- Columnas: Marca, Precio, Distancia, Localidad, Calle
- Ordenación ascendente/descendente por任何 columna
- Paginación configurable (30 filas por defecto)
- Panel de detalle con histórico de precios y gráfica canvas
- Favoritos con persistencia en IndexedDB

### 👁️ Vista Ambos
- Mapa y tabla sincronizados en pantalla dividida
- Sin paginación — muestra todas las estaciones filtradas

### 📊 Histórico de precios
- Gráfica de evolución de precios en canvas (sin librerías externas)
- Tooltip interactivo al pasar el ratón
- Combustible y número de días configurables
- Disponible en panel de detalle y popup del mapa
- Almacenamiento en IndexedDB con TTL configurable

### 💾 Caché y persistencia
- **IndexedDB**: datos de provincia, histórico, favoritos y configuración
- **localStorage**: estado de la UI, filtros por provincia
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

### ⭐ Favoritos
- Marca/desmarca estaciones como favoritas con persistencia en IndexedDB
- Filtro "solo favoritos" en toolbar
- Las notificaciones push monitorizan exclusivamente las estaciones favoritas

### 📱 Progressive Web App (PWA)
- Service Worker con caché de assets para funcionamiento offline parcial
- Instalable en el dispositivo (manifest.json con iconos SVG + PNG)
- Página offline (`offline.html`)
- Botón "Comprobar actualizaciones" que detecta cambios en `sw.js`

### ⚙️ Panel de Configuración
- **Descuentos por marca**: descuento en céntimos/litro para ajustar precios
- **Caché de datos**: tabs IndexedDB / localStorage con información detallada
- **Paginación**: número de filas por página en la vista tabla (0 = todas)
- **Registro de actividad**: tabs API / Push
- **Notificaciones push**: activación, intervalo, días, modo de detección

---

## Stack técnico

| Componente | Tecnología |
|------------|------------|
| App shell | HTML5 + CSS3 (responsive, ~340 líneas) |
| Mapas | [Leaflet](https://leafletjs.com/) 1.9.4 con tiles OSM / CartoDB / ESRI / CyclOSM |
| Gráficas | Canvas 2D nativo — sin librerías de charts |
| Persistencia | IndexedDB + localStorage |
| Notificaciones | Web Push API + Periodic Background Sync |
| Service Worker | Cache-first + Network-first híbrido |
| Tests | Playwright (51 tests, servidor HTTP inline) |
| Desarrollo | [OpenCode](https://opencode.ai) con modelos DeepSeek (libres) |

---

## Licencia

Todo el código de este proyecto es **software libre**. Puedes consultar los términos de la licencia en el repositorio.

---

> Desarrollado con [OpenCode](https://opencode.ai) y modelos de lenguaje libres — sin bloqueos, sin suscripciones, sin dependencias propietarias.

# Gasolineras — Precios de Gasolina en España

Aplicación web progresiva (PWA) para consultar **precios de carburantes en estaciones de servicio de España** en tiempo real, usando datos oficiales del [Geoportal de Hidrocarburos](https://geoportalgasolineras.es/) del Ministerio para la Transición Ecológica.

> 🧪 Este proyecto ha sido desarrollado íntegramente con **[OpenCode](https://opencode.ai)** usando modelos de lenguaje libres (DeepSeek), sin depender de APIs de pago ni modelos propietarios.

---

## Funcionalidades

### 🔍 Consulta de precios
- Datos en tiempo real desde la API oficial del Ministerio (actualización cada 30 minutos)
- Filtros por **provincia**, **localidad**, **combustible**, **marca** y **distancia máxima**
- Búsqueda textual por localidad, dirección o nombre de estación (toggle con 🔍 en toolbar)
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

### 🤖 Chat IA integrado
- **5 proveedores** seleccionables con pestañas: Groq, Mistral, OpenRouter, Google Gemini, Chrome Built-in AI
- Las API Keys se guardan cifradas (XOR + base64) en el código fuente y se descargan en Config con una contraseña
- **Contexto automático**: cada mensaje incluye los datos actuales de la app (provincia, gasolineras, precios, favoritos)
- Precarga de históricos si la pregunta menciona evolución de precios
- Botón **Cancelar** para abortar mensaje en curso (AbortController)
- Botón **✎ Editar** en mensajes enviados para corregir y reenviar
- Modelos gratuitos por proveedor (sin coste de API)

### ⚙️ Panel de Configuración
- **Descuentos por marca**: descuento en céntimos/litro para ajustar precios
- **Caché de datos**: tabs IndexedDB / localStorage con información detallada
- **Paginación**: número de filas por página en la vista tabla (0 = todas)
- **Registro de actividad**: tabs API / Push
- **Notificaciones push**: activación, intervalo, días, modo de detección
- **Claves API - IA**: campo de contraseña para cargar claves cifradas, con opción "Volver a cargar"

---

## Stack técnico

| Componente | Tecnología |
|------------|------------|
| App shell | HTML5 + CSS3 (responsive, ~342 líneas) |
| Mapas | [Leaflet](https://leafletjs.com/) 1.9.4 con tiles OSM / CartoDB / ESRI / CyclOSM |
| Gráficas | Canvas 2D nativo — sin librerías de charts |
| Persistencia | IndexedDB + localStorage |
| Notificaciones | Web Push API + Periodic Background Sync |
| Service Worker | Cache-first + Network-first híbrido |
| Chat IA | 5 proveedores (Groq, Mistral, OpenRouter, Google Gemini, Chrome Built-in AI) |
| Tests | Playwright (63 tests, servidor HTTP inline) |
| Desarrollo | [OpenCode](https://opencode.ai) con modelos DeepSeek (libres) |

---

## Roadmap / Ideas futuras

### Chat IA — Próximas mejoras consideradas
- **Streaming de respuestas** (SSE) para mostrar el texto en tiempo real
- **Persistencia del historial** de chat en IndexedDB entre sesiones
- **Prompt personalizado** por el usuario en la UI de Config
- **Selección de temperatura / max_tokens** por proveedor
- **Comparativa entre modelos**: enviar misma pregunta a varios proveedores simultáneamente
- **Exportar conversación** (JSON / texto)
- **Entrada por voz** (Web Speech API)
- **Imagen y análisis visual** con Gemini Vision (modelos multimodales)
- **RAG de gasolineras**: búsqueda semántica sobre los datos cargados
- **Atajo de teclado** para enfoque rápido del input de chat
- **Auto-detección** del proveedor más rápido disponible

### Otras funcionalidades exploradas
- Conteo de tokens (tiktoken) para no exceder límites de contexto
- Chat dentro del panel de detalle de cada estación
- Sugerencias de preguntas frecuentes sobre precios

---

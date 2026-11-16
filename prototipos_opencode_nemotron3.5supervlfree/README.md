# Prototipos de diseño — Gasolineras (OPENCODE nemotron-3.5-super-vl-free)

Carpeta de exploración de UX/UI responsive para la aplicación **Precios Gasolina España**. Cada prototipo es un HTML autónomo (referencia `datos-fake.js`) con **datos inventados** y **navegación funcional** para validar la interfaz antes de tocar el código real.

## Objetivo
Mejorar la experiencia sobre todo en **móvil actual** (pantallas táctiles, manos una sola pulgada, safe areas), sin descuidar una versión de **PC** que aproveche pantallas grandes.

## Estructura

| Archivo | Qué cubre |
|---------|-----------|
| `prototipo-01-movil.html` | **Pase 1 — Mobile-first:** pestañas inferiores, lista de tarjetas, filtros en chips, FAB geolocalización, bottom sheet deslizable, búsqueda toggle. |
| `prototipo-02-tablet.html` | **Pase 2 — Tablet:** barra lateral colapsable (filtros + lista) + mapa grande a la derecha, ficha docked anclada abajo. |
| `prototipo-03-escritorio.html` | **Pase 3 — PC:** rail lateral fijo, mapa héroe central, ficha detalle derecha, accesos de teclado (↑↓ Enter Esc D), modo oscuro. |
| `prototipo-hibrido.html` | **Pase 4 — Responsive unificado (recomendado):** breakpoints 640 / 1024 / 1280 px, modo oscuro, skeletons, pull-to-refresher, gestos táctiles. |
| `prototipo-completo.html` | **Pase 5 — MAESTRO (todas las funcionalidades):** Mapa / Tabla / Ambos / IA / Config, **comparador de litros (🧮)**, notificaciones push, caché, historial, ficha detalle, PWA, chat IA. |
| `datos-fake.js` | Datos compartidos: ~30 estaciones de Madrid/Barcelona/Valencia/Sevilla/Zaragoza con precios e histórico de 14 días. |

## Funcionalidades cubiertas (prototipo-completo.html)

1. **Consulta de precios** — filtros provincia / combustible / marca / distancia / búsqueda textual.
2. **Vista Mapa** — marcadores coloreados por precio (verde/naranja/rojo), clic para abrir detalle.
3. **Vista Tabla** — tarjetas con precio, distancia, favorito ★.
4. **Vista Ambos** — mapa + lista (en móvil son pestañas separadas; en escritorio el rail muestra la lista y el centro el mapa).
5. **Ficha detalle** — dirección, localidad, CP, horario, precios por combustible, gráfico de histórico canvas, botón favorito.
6. **Histórico de precios** — gráfica canvas con el precio "hoy" como último punto.
7. **Favoritos ★** — persistencia en localStorage, filtro "solo favoritos".
8. **Comparador de litros (🧮)** — selecciona las favoritas (máx. 5), elige litros (1–1000), ve precio unitario y total por estación + total global.
9. **Notificaciones Push** — toggle activadas/subidas, intervalo, días de caída, botón probar, estado.
10. **Registro de actividad** — logs API y Push con pestañas.
11. **Caché** — IndexedDB / localStorage, horas de caché, limpiar caché.
12. **Claves API - IA** — contraseña, campos por proveedor, nota de NVIDIA vía proxy.
13. **Pestañas de IA** — checkbox por proveedor (General, Groq, Mistral, OpenRouter, LLM7.io, NVIDIA, Google Gemini, Chrome Built-in AI).
14. **Chat IA** — 8 pestañas, entrada de mensajes, respuestas simuladas, borrar historial.
15. **Actualización de la app** — versión, botón buscar actualizaciones.
16. **Modo oscuro / claro** — toggle global.
17. **Accesibilidad** — touch targets ≥44 px, safe areas (`env(safe-area-inset-*)`), accesos de teclado.

## Convenciones aplicadas (según AGENTS.md)

- Cabecera **SPDX-License-Identifier: AGPL-3.0-only** en todos los ficheros fuente.
- Filtros con `<span class="filter-ico">` y `<span class="label-text">` (texto oculto en ≤768px, icono a 1 rem).
- `data-tab` en kebab-case (`tab-map`, `tab-table`, `tab-both`, `tab-config`, `tab-ia`).
- z-index con `position` relativo/fixed/absolute.
- Breakpoints: 640 px (móvil→tablet), 1024 px (tablet→escritorio), 1280 px (escritorio amplio).

## Cómo usar
Abre cualquier `.html` directamente en el navegador (no necesita servidor). Cada prototipo es funcional: filtra, busca, marca favoritos, abre fichas, ve gráficos, abre modales (comparador, configuración, IA).

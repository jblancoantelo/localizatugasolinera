# Prototipos de diseño — Gasolineras (nemotron-3.5-super-vl)

Carpeta de exploración de UX/UI responsive para la aplicación **Precios Gasolina España**. Cada prototipo es un HTML autónomo (referencia `datos-fake.js`) con **datos inventados** y **navegación funcional** para validar la interfaz antes de tocar el código real.

## Objetivo
Mejorar la experiencia sobre todo en **móvil actual** (pantallas táctiles, manos una sola pulgada, safe areas), sin descuidar una versión de **PC** que aproveche pantallas grandes.

## Estructura

| Archivo | Qué valida |
|---------|------------|
| `prototipo-01-movil.html` | **Pase 1 — Mobile-first:** pestañas inferiores, lista de tarjetas (en vez de tabla), filtros en chips, FAB de geolocalización, ficha detalle como bottom sheet deslizable. |
| `prototipo-02-tablet.html` | **Pase 2 — Tablet:** vista dividida, barra lateral colapsable (filtros + lista) + mapa grande a la derecha, ficha anclada al lateral. |
| `prototipo-03-escritorio.html` | **Pase 3 — PC:** menú lateral fijo, mapa como héroe central, ficha detalle ancha a la derecha, accesos de teclado, modo oscuro opcional. |
| `prototipo-hibrido.html` | **Pase 4 — Responsive unificado (recomendado):** un solo código con breakpoints 640 / 1024 / 1280 px, modo oscuro, skeletons de carga, pull-to-refresher visual y gestos simulados. |
| `datos-fake.js` | Datos compartidos: ~30 estaciones de Madrid/Barcelona/Valencia/Sevilla/Zaragoza con precios e histórico de 14 días. |

## Cómo usar
Abre cualquier `.html` directamente en el navegador (no necesita servidor). Cada prototipo es funcional: filtra por provincia/combustible/marca, busca, marca favoritos, abre la ficha de una estación, ve el gráfico de histórico y navega entre pestañas.

## Convenciones de diseño aplicadas
- **Touch targets mínimos 44×44 px** (botones, chips, filas de lista).
- **Navegación inferior en móvil** (zona del pulgar).
- **Bottom sheet deslizable** para el detalle en móvil (no tapa todo el contexto).
- **Filtros como chips horizontales desplazables** (ahorro de vertical).
- **Breakpoints:** 640 px (móvil→tablet), 1024 px (tablet→escritorio), 1280 px (escritorio amplio).
- **Safe areas:** `env(safe-area-inset-*)` para notch / barra de gestos de iOS y navegación por gestos de Android.
- **Colores de precio:** verde barato / naranja medio / rojo caro (mantenidos de la app real).

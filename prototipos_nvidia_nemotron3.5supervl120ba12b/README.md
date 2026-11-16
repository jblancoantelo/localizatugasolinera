# Prototipos de diseño — nemotron-3.5-super-vl-120b

Carpeta de exploración de UX/UI **responsive** para la aplicación **Precios Gasolina España**.
Cada prototipo es un **HTML autónomo** (referencia `datos-fake.js`) con **datos inventados** y **navegación funcional** para validar la interfaz antes de tocar el código real de la app.

## Objetivo

Mejorar la experiencia sobre todo en **móvil actual** (pantallas táctiles, una sola mano, safe areas de notch/gestos), sin descuidar una versión de **PC** que aproveche mejor una pantalla mayor.

## Estructura y pasadas

| Carpeta | Archivo | Qué valida |
|---------|---------|------------|
| `pasada-01-movil-pulgar/` | `index.html` | **Pase 1 — Mobile-first "zona del pulgar":** nav inferior, tarjetas en vez de tabla, filtros en chips scrollables, FAB de geolocalización, búsqueda expandible, ficha detalle como **bottom sheet deslizable**, pull-to-refresh visual, skeletons. |
| `pasada-02-tablet-dividido/` | `index.html` | **Pase 2 — Tablet:** barra lateral colapsable (filtros + lista) + mapa grande a la derecha, ficha anclada, sincronización lista↔mapa, breakpoints 768/1024. |
| `pasada-03-desktop-ancho/` | `index.html` | **Pase 3 — PC:** menú lateral fijo, mapa héroe central, ficha detalle ancha derecha, tabla de densidad ajustable, accesos de teclado, modo oscuro/claro, comparador lado a lado. |
| `pasada-04-comparador-enfoque/` | `index.html` | **Pase 4 — Estación focus + comparador:** selecciona hasta 3 estaciones, precios lado a lado, histórico superpuesto (múltiples líneas), alertas de precio por estación, exportar CSV, compartir URL. |
| `pasada-05-ruta-alertas/` | `index.html` | **Pase 5 — Planificador de ruta y push:** origen/destino/paradas, coste estimado, alertas de bajada/subida simuladas, log de notificaciones, botón "Probar notificación". |
| `pasada-06-ia-embebida/` | `index.html` | **Pase 6 — IA conversacional embebida:** asistente como panel deslizable (no pestaña aparte), sugerencias rápidas, citas a estaciones, historial, editar/borrar, indicador de escritura. |
| `pasada-07-unificado-responsive/` | `index.html` | **Pase 7 — Responsive unificado final:** un solo código con breakpoints 640/1024/1280, design system (tokens, componentes), modo oscuro, pull-to-refresh, gestos simulados, PWA-ready. |
| `datos-fake.js` | — | Datos compartidos: provincias, marcas, combustibles, ~40 estaciones con precios e histórico de 30 días, utilidades de filtrado y formateo. |
| `validacion-navegacion.md` | — | Checklist de interacciones y flujos validadas en cada pasada. |

## Cómo usar

Abre cualquier `index.html` directamente en el navegador (no necesita servidor, funciona offline salvo los íconos de emoji que usa el sistema).

Cada prototipo es **funcional**: filtra por provincia/combustible/marca, busca, marca favoritos, abre la ficha de una estación, ve el gráfico de histórico, navega entre pestañas y, en las pasadas correspondientes, compara estaciones, planifica rutas, prueba alertas y chatea con el asistente IA simulado.

## Convenciones de diseño aplicadas

- **Touch targets mínimos 44×44 px** (botones, chips, filas).
- **Navegación inferior en móvil** (zona del pulgar) y lateral en desktop.
- **Bottom sheet deslizable** para el detalle en móvil (no tapa todo el contexto).
- **Filtros como chips horizontales desplazables** (ahorro de vertical).
- **Breakpoints:** 640 px (móvil→tablet), 1024 px (tablet→escritorio), 1280 px (escritorio amplio).
- **Safe areas:** `env(safe-area-inset-*)` para notch / barra de gestos de iOS y navegación por gestos de Android.
- **Colores de precio:** verde barato / naranja medio / rojo caro (mantenidos de la app real).
- **Datos fake:** precios e histórico inventados, claramente señalados como no reales.

## Relación con la app real

Estos prototipos respetan todas las funcionalidades actuales de `index.html` (pestañas mapa/tabla/ambos, filtros provincia/localidad/combustible/marca, búsqueda, favoritos, histórico con gráfica canvas, chat IA, push notifications, caché, logs API/Push, configuración) y proponen **mejoras de interacción y presentación** validadas con datos fake antes de aplicar al código productivo.

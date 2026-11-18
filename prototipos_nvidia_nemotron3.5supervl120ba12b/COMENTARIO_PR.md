## 🎨 Prototipos de diseño — nemotron-3.5-super-vl-120b

Se ha añadido la carpeta `prototipos_nvidia_nemotron3.5supervl120ba12b/` con **8 pasadas de diseño responsive** para mejorar la UX/UI de la aplicación **Precios Gasolina España**, centrándose sobre todo en móvil pero incluyendo una versión de escritorio que aproveche mejor pantallas grandes.

---

### 📁 Estructura de la carpeta

```
prototipos_nvidia_nemotron3.5supervl120ba12b/
├── README.md                      # Visión general, convenciones y cómo usar
├── datos-fake.js                  # Datos inventados compartidos (~40 estaciones, 6 provincias, histórico 30d)
├── validacion-navegacion.md       # Checklist de flujos e interacciones por pasada
├── COMENTARIO_PR.md               # Este archivo (texto para pegar en el PR)
├── pasada-01-movil-pulgar/        # Mobile-first: nav inferior, chips, bottom sheet, pull-to-refresh
├── pasada-02-tablet-dividido/     # Tablet: sidebar colapsable + mapa grande, ficha anclada
├── pasada-03-desktop-ancho/       # PC: menú lateral fijo, mapa héroe, accesos de teclado
├── pasada-04-comparador-enfoque/  # Comparador hasta 3 estaciones, histórico superpuesto
├── pasada-05-ruta-alertas/        # Planificador de ruta, coste estimado, alertas push simuladas
├── pasada-06-ia-embebida/         # IA embebida en panel deslizable, sugerencias rápidas
├── pasada-07-unificado-responsive/# Design system (tokens CSS), breakpoints 640/1024/1280
└── pasada-08-completo-unificado/  # Maestro unificado: todas las pestañas, filtros, chat IA, config, paginación
```

Cada `pasada-XX/` contiene un solo `index.html` autónomo que carga `datos-fake.js` mediante ruta relativa. No requieren servidor ni dependencias externas.

---

### 🎯 Objetivo

Mejorar la experiencia de usuario sobre todo en **móvil actual** (pantallas táctiles, una sola mano, safe areas de notch/gestos), sin descuidar una versión de **PC** que aproveche mejor una pantalla mayor. Todos los prototipos respetan las funcionalidades actuales de la app y proponen mejoras de interacción y presentación validadas con datos fake antes de aplicar al código productivo.

---

### 🎨 Convenciones de diseño aplicadas (todos los prototipos)

| Convención | Detalle |
|------------|---------|
| **Touch targets** | Mínimos 44×44 px en botones, chips y filas de lista |
| **Navegación inferior en móvil** | Barra fija en la parte inferior (zona del pulgar) |
| **Sidebar lateral en desktop** | Menú fijo a la izquierda en pantallas ≥1024 px |
| **Bottom sheet deslizable** | Ficha de detalle en móvil que no tapa todo el contexto |
| **Filtros como chips** | Chips horizontales desplazables para ahorrar espacio vertical |
| **Breakpoints** | 640 px (móvil→tablet), 1024 px (tablet→escritorio), 1280 px (escritorio amplio) |
| **Safe areas** | `env(safe-area-inset-*)` para notch de iOS y navegación por gestos de Android |
| **Colores de precio** | Verde (≤1,45 €/L) / Naranja (1,45–1,60 €/L) / Rojo (>1,60 €/L) |
| **Datos fake** | Precios, histórico y distancias inventados para validar solo la interfaz |

---

### 📋 Detalle de cada pasada

| Pasada | Enfoque | Qué valida |
|--------|---------|------------|
| **01 — Móvil pulgar** | Mobile-first | Nav inferior, tarjetas en vez de tabla, filtros en chips scrollables, FAB de geolocalización, búsqueda expandible, bottom sheet deslizable, pull-to-refresh visual, skeletons de carga |
| **02 — Tablet dividido** | Tablet | Barra lateral colapsable (filtros + lista) + mapa grande a la derecha, ficha anclada al lateral, sincronización lista↔mapa, breakpoint 768/1024 |
| **03 — Escritorio ancho** | PC | Menú lateral fijo, mapa héroe central, ficha detalle ancha derecha, accesos de teclado (1–5 provincias, F favoritos, ESC limpiar), modo oscuro/claro preparado en tokens |
| **04 — Comparador enfoque** | Comparación | Selecciona hasta 3 estaciones (+ badge ✓), precios lado a lado, histórico superpuesto (múltiples líneas en una gráfica), límite de 3 con aviso toast |
| **05 — Ruta y alertas** | Planificación | Planificador de paradas, coste estimado (litros × precio), alertas de bajada/subida por estación, prueba de notificación push simulada, log de notificaciones |
| **06 — IA embebida** | Asistente | Asistente como panel deslizable (no pestaña aparte), sugerencias rápidas (chips de preguntas), respuestas simuladas citando estaciones, indicador de escritura (typing), historial de conversación |
| **07 — Responsive unificado** | Design system | Un solo código con breakpoints 640/1024/1280, design system con tokens CSS coherentes, badge de precio (barato/medio/caro) en tarjetas |
| **08 — Completo unificado** | Maestro | Todas las pestañas (Mapa/Tabla/Ambos), filtros completos (provincia, combustible, marca, búsqueda, distancia máxima), paginación, favoritos, detalle con gráfico histórico canvas, chat IA modal, configuración sidebar (caché TTL, push, pestañas IA), push simulado con botón "Probar", PWA-ready |

---

### ✅ Funcionalidades de la app actual cubiertas (pasada-08, maestro unificado)

- [x] Filtros: provincia, combustible, marca, búsqueda textual, distancia máxima
- [x] Leyenda dinámica de precios (verde/naranja/rojo según percentiles)
- [x] Vista Mapa con marcadores coloreados por precio
- [x] Vista Tabla (tarjetas con toda la información)
- [x] Vista Ambos (mapa y lista sincronizados en pantalla dividida)
- [x] Histórico de precios con gráfica canvas en bottom sheet
- [x] Favoritos (★/☆ con persistencia en memoria de sesión)
- [x] Panel detalle: marca, dirección, localidad, horario, servicios, distancia, precio, descuento, variación 30d
- [x] Chat IA simulado en modal con historial de conversación
- [x] Configuración simulada (caché TTL, notificaciones push, pestañas de IA)
- [x] Push notifications simulado con botón "Probar notificación"
- [x] Paginación configurable (30 filas por defecto)
- [x] Diseño responsive móvil + desktop con safe areas

---

### 🧪 Cómo validar

Cada `index.html` es **autónomo**: ábrelo directamente en el navegador (doble clic o `file://`). No necesita servidor, no requiere `npm install`, funciona offline salvo los emojis del sistema.

Todos cargan `datos-fake.js` con ~40 estaciones, 6 provincias (Madrid, Barcelona, Valencia, Sevilla, Zaragoza, Málaga), 5 tipos de combustible y histórico de 30 días. Los datos son **fake** (inventados) y sirven solo para validar la interfaz y navegación.

**Flujo de prueba sugerido en cada prototipo:**
1. Abrir el archivo en el navegador (modo móvil con DevTools o en dispositivo real)
2. Tocar un chip de provincia para seleccionarla
3. Probar filtros: combustible, marca, búsqueda, distancia máxima, solo favoritos
4. Tocar una estación para abrir su ficha detalle y ver el gráfico histórico
5. Navegar entre pestañas (Mapa / Tabla / Ambos)
6. Marcar/desmarcar favoritos ★
7. Probar el FAB de geolocalización y el bottom nav

---

### 📝 Notas importantes

- Estos prototipos **no modifican ningún archivo de la app productiva** (`index.html`, `css/styles.css`, `js/`, `sw.js`, `manifest.json`, `scripts/`).
- Los datos son **fake** (no son reales del Ministerio para la Transición Ecológica).
- La rama `prototipos-nemotron-120b` está lista para revisión. Desde la web de GitHub se puede abrir un **Pull Request** contra `main` una vez revisados los cambios.

---

**Rama:** `prototipos-nemotron-120b`  
**Enlace PR:** https://github.com/jblancoantelo/localizatugasolinera/pull/6

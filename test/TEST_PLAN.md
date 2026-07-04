# Plan de Pruebas — Propuesta D

## Objetivo
Validar que la migración a Propuesta D funciona correctamente tanto desde `file://` como desde servidor HTTP, y que todas las interacciones de usuario navegan sin errores.

## Cómo ejecutar las pruebas

```powershell
# Requisitos: Node.js v18+, Playwright (`npm install playwright`)
# Si falta Chromium: npx playwright install chromium

# 1. Limpia procesos Node previos (evita conflictos de puerto)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Ejecuta el test suite autónomo
cd E:\Temp\VS\petrol
node test\full_test.mjs
```

### Qué hace el script:
- Inicia servidor HTTP en :8080
- Lanza Chromium headless
- Ejecuta 22 tests contra HTTP + 7 contra file://
- Cierra servidor y navegador automáticamente
- Exit code 0 = todo OK, 1 = algún fallo

## Entornos de prueba

| Entorno | URL | Limitaciones |
|---------|-----|-------------|
| **HTTP** | `http://localhost:8080` | API funcional (CORS ok) |
| **file://** | `file:///.../petrol/index.html` | API bloqueada por CORS (pre-existente), UI debe cargar |

## Casos de prueba

### 1. Carga inicial (ambos entornos)

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 1.1 | Abrir app en HTTP | Toolbar visible, tabs inferiores, content area con mensaje "Selecciona una provincia" |
| 1.2 | Abrir app en file:// | Toolbar visible, tabs inferiores, content area con mensaje "Selecciona una provincia" |
| 1.3 | Comprobar Service Worker | Solo se registra en HTTP, condicional `location.protocol.startsWith('http')` |

### 2. Toolbar y filtros

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 2.1 | Selector de provincia | Desplegable con provincias cargadas desde API/caché |
| 2.2 | Seleccionar provincia | Carga datos (156 gasolineras en Albacete), tabla y mapa se muestran, detail panel disponible |
| 2.3 | Filtro combustible | Cambiar combustible (4 opciones) actualiza resultados |
| 2.4 | Filtro localidad | Cambiar localidad actualiza resultados y marcas |
| 2.5 | Filtro marcas (dropdown) | Abrir dropdown `position: fixed`, seleccionar/deseleccionar marcas, se actualiza contador |
| 2.6 | Búsqueda de texto | Escribir en search filtra por localidad/calle/marca |
| 2.7 | Botón reset | Limpia todos los filtros sin recargar datos |

### 3. Tabs inferiores

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 3.1 | Tab Mapa | Mapa a pantalla completa, zoom 14 |
| 3.2 | Tab Tabla | Tabla completa paginada (50 filas/página), orden ascendente por precio por defecto |
| 3.3 | Tab Ambos | Mapa (arriba) + tabla compacta (abajo) con todas las estaciones filtradas (sin paginación) |
| 3.4 | Tab Config | Panel de configuración con caché, descuentos y paginación (3 tarjetas + input TTL) |
| 3.5 | Cambio rápido entre tabs | Sin errores, `map.invalidateSize()` se llama |

### 4. Tabla (tab "Tabla")

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 4.1 | Ordenar por columna | Click en header columna "Precio", cambia de asc → desc al segundo click |
| 4.2 | Paginación | Botones ◀ ▶ cambian de página |
| 4.3 | Click en fila | Bottom sheet detail se abre con datos de la estación (marca, dirección, precios) |
| 4.4 | Favorito en fila | Click en estrella cambia estado y persiste |

### 5. Tabla "Ambos"

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 5.1 | Mostrar datos | Tabla compacta con todas las estaciones filtradas (sin paginación, 156 filas) |
| 5.2 | Click en fila | Bottom sheet detail se abre |
| 5.3 | Ordenar | Click en header ordena ambas tablas |

### 6. Detail panel (bottom sheet)

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 6.1 | Abrir detail | Panel desliza desde abajo con marca, dirección y precios |
| 6.2 | Cerrar con ✕ | Panel se cierra, selectedId se limpia |
| 6.3 | Favorito en detail | Click en estrella cambia estado y se actualiza |

### 7. Mapa

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 7.1 | Marcadores visibles | Circulos de colores en posiciones de estaciones, zoom 14 |
| 7.2 | Click en marcador | Bottom sheet se abre, tabla se desplaza |
| 7.3 | Click derecho en mapa | Establece posición manual (contextmenu) |
| 7.4 | Cambiar estilo mapa | Selector cambia tile layer (calle/satélite/estándar/ciclismo) |

### 8. Config

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 8.1 | Info de caché | Muestra datos de provincia en caché |
| 8.2 | Limpiar caché | Borra datos, vuelve a pantalla de selección |
| 8.3 | Descuentos | Añadir/quitar descuentos por marca |
| 8.4 | Paginación | Cambiar tamaño de página y verificar |

### 9. Persistencia de filtros

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 9.1 | Recargar página | Última provincia + filtros restaurados desde localStorage (`gasolineras_prov_filters_{provName}`) |
| 9.2 | Cambiar provincia | Filtros específicos de esa provincia se restauran |
| 9.3 | Favoritos | Se mantienen entre sesiones (IndexedDB `gasolineras-db`) |

## Resultados actuales

**29 tests — 29 ✅ 0 ❌ 0 ⏭️**

| Grupo | HTTP | file:// |
|-------|------|---------|
| Carga | 3 ✅ | 1 ✅ |
| Provincias | 1 ✅ | — |
| Datos | 1 ✅ | — |
| Filtros | 1 ✅ | — |
| Tabla | 5 ✅ | — |
| Detail | 3 ✅ | — |
| Ambos | 2 ✅ | — |
| Config | 2 ✅ | 1 ✅ |
| Mapa | 2 ✅ | — |
| Geo | 1 ✅ | — |
| Búsqueda | 1 ✅ | 1 ✅ |
| Toolbar | — | 1 ✅ |
| Tabs | — | 2 ✅ |
| Navegación | — | 2 ✅ |
| **Total** | **22 ✅** | **7 ✅** |

## Bugs conocidos y fixes aplicados

| Bug | Síntoma | Fix |
|-----|---------|-----|
| Dropdown marcas bajo el mapa | `#brandFilterWrap` con `position: relative` creaba stacking context incorrecto; dropdown `position: absolute` quedaba detrás del mapa | Dropdown movido a raíz de `.app`, reposicionado con `position: fixed` + `getBoundingClientRect()` en JS. `z-index: 10000` |
| `.bottom-tabs` z-index sin efecto | `z-index: 100` sin `position` no funciona en CSS | Añadido `position: relative` |
| `noProvinceMsg` oculto por especificidad | Selector `.content #noProvinceMsg` insuficiente | Cambiado a `#noProvinceMsg` con mayor especificidad |
| `setActiveTab()` borraba clase `no-province` | `className = 'content'` sobreescribía clases existentes | Usar `classList.add`/`remove` |
| `fn` undefined en tabla Ambos | Faltaba `const fn = getSelectedFuelName(d)` en la función map | Añadida declaración |

## Arquitectura de la solución

```
app/
├── index.html          → Toolbar + content + tabs + bottom sheet (Propuesta D)
├── css/styles.css      → ~264 líneas, responsive con tabs, dropdown fixed, bottom sheet, sticky thead
├── js/
│   ├── state.js        → STATE global: activeTab, filtros, items, discounts, favs, selectedProv
│   ├── storage.js      → saveState() debounced (microtask), save/loadProvinceFilters() por provincia, IndexedDB para favoritos
│   ├── api.js          → fetchProvinceData() restaura filtros guardados, fetchProvinces(), clearCache()
│   ├── controls.js     → render(), setActiveTab(), populateBrandFilter(), toggleFavorite(), renderDiscountConfig(), sortTable()
│   ├── table.js        → doSort() dual-table, buildTableRows(), showDetail() bottom sheet
│   └── main.js         → Event listeners, carga inicial de estado/filtros guardados, brandDropdown position fixed
├── sw.js               → Service Worker con caché gasolineras-v3
└── test/
    ├── TEST_PLAN.md    → Este archivo
    ├── full_test.mjs   → Test suite Playwright autónomo (29 tests)
    └── server.js       → Servidor HTTP inline para tests
```

### Decisiones técnicas clave:
- **Dropdown marcas**: `position: fixed` en lugar de `position: absolute` relativo al toolbar para evitar problemas de stacking context del flex layout
- **Persistencia filtros**: `localStorage` clave `gasolineras_prov_filters_{provName}` — simple, síncrono, <1KB
- **Favoritos**: IndexedDB `gasolineras-db` / `favorites` store — persistente entre sesiones
- **Mapa único**: Una instancia Leaflet reutilizada entre tabs vía CSS `display: none` / `block`
- **Tabla "Ambos"**: Sin paginación — muestra todas las estaciones filtradas
- **Tabla "Tabla"**: Paginada a 50 filas/página con sort dual (asc/desc)
- **Reset filtros**: Sin re-fetch cuando ya hay datos cargados
- **Tests**: Servidor HTTP inline en Node.js sin dependencias externas de proceso

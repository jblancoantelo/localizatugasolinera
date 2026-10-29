# Informe de cambios — prototipos MuseSpark (deepseekv4.1flash)

- **Rama**: `prototipos_opencode_musespark1.3free_deepseekv4.1flash` (antes `newUI`)
- **Carpeta**: `prototipos_opencode_musespark1.3free/`
- **Ámbito**: solo esta carpeta. No se toca documentación del proyecto
  (`README.md`, `docs/`, `AGENTS.md`), ni `sw.js`, ni la app real.
- **Datos**: 12 estaciones ficticias de Madrid (mismos precios base en los
  prototipos para que las diferencias sean de diseño, no de datos).

> Los prototipos son HTML autocontenidos: se abren con doble clic, sin servidor
> ni dependencias externas (mapas, gráficas e IA son simulados).

---

## 1. Qué hay ahora

| Fichero | Rol | Estado |
|---------|-----|--------|
| `index.html` | Galería comparativa + guía de validación | ✅ |
| `p1-pulso.html` | Mobile-first: chips, cards, KPIs, bottom-sheet | ✅ |
| `p2-mapa.html` | Mapa fullscreen + carrusel snap + FABs | ✅ |
| `p3-pro.html` | Dashboard PC: sidebar, KPIs, mapa+tabla, drawer | ✅ |
| `p4-volante.html` | Conducción/accesible: targets 56 px, hero, contraste | ✅ |
| `p5-completo.html` | Paridad funcional con la app real (checklist viva) | ✅ |
| `PLAN.md` | Cómo portar cada prototipo a la app real, por fases | ✅ |
| `INFORME_CAMBIOS.md` | Este informe (hecho / pendiente / auditoría) | ✅ |

---

## 2. Cambios hechos

### 2.1 Primera pasada — exploración de diseño
- Galería `index.html` con los 4 arquetipos y guía de validación de 2 minutos.
- **P1 Pulso**: buscador sticky, chips de combustible, 3 KPIs (mín/media/
  favoritas), cards con precio grande y badge, bottom-sheet con Info/Histórico,
  gráfica canvas y tooltip. En ≥960 px: lista + mapa sticky.
- **P2 Mapa Vivo**: mapa oscuro a pantalla completa, chips flotantes, leyenda,
  FABs (GPS, solo favoritas), pines ↔ carrusel sincronizados, panel lateral en
  PC y bottom-panel para tabla/IA/config.
- **P3 Consola Pro**: grid de 3 columnas (filtros / mapa+tabla / drawer), KPIs,
  ordenación, drawer con tabs Info/Histórico/IA. Sidebar y drawer deslizantes
  en móvil.
- **P4 Volante**: hero con la estación más barata, botones de 56-72 px,
  segmentado Gasolina/Gasóleo, modo claro/oscuro, IA en lenguaje simple,
  navegación simulada y aviso de bajada.

### 2.2 Segunda pasada — auditoría funcional y P5
Se comparó la app real (`index.html` + `js/*`) contra P1 y se detectaron
funciones ausentes. Se creó **P5 Completo** con paridad funcional:

1. Marcas multi-selección con buscador, **Todas/Ninguna**.
2. Distancia máxima en km + GPS + posicionado manual del punto.
3. Los **10 estilos de mapa** del desplegable real (orden A-Z; `satellite`
   por defecto), mapeados a 3 fondos simulados.
4. Ordenación asc/desc por las 4 columnas y desplegable completo
   (Precio, Distancia y Marca en ambos sentidos).
5. Paginación 5/10/15/30/50/100/Todas con `◀ ▶` y contador.
6. ☆ pulsable también en las filas de la tabla.
7. Descuentos por marca que recalculan precios, KPIs, badges y leyenda.
8. Histórico 7/14/21/30/60/90/180 + 5 combustibles + tooltip + nota de que la
   serie llega hasta hoy con el precio en vivo.
9. IA: 8 pestañas, modelo por proveedor, refresco de catálogo, ✎ editar,
   ✕ cancelar, **General en paralelo** con `⏱ proveedor · modelo · tiempo`,
   prompts rápidos solo en General, borrar historial por pestaña.
10. Config: push (bajada/subida, intervalo, días, promedio/consecutivos,
    probar), caché con tabs IDB/LS y ✕ por clave, logs API/Push con borrado,
    claves con contraseña `demo` + "Volver a cargar", proxy NVIDIA con
    ↺ Predefinida y 🔎 Probar, visibilidad de pestañas (mínimo una), prompts
    editables, buscar actualizaciones.
11. Estado vacío "sin provincia", reset sin re-fetch y leyenda por percentiles
    dinámicos (25/75).

### 2.3 Correcciones de la última pasada
- Mapa: 3 → **10 estilos**; clic en el mapa mueve el punto (equivalente al
  clic derecho de la app).
- Orden: se corrigió el toggle de cabecera, que dejaba el `<select>` en un
  valor inexistente al ordenar Marca/Distancia.
- Tabla: la ☆ de cada fila pasó de texto a botón real.
- IA: los prompts rápidos ya no aparecen en pestañas de proveedor.
- Caché: la pestaña localStorage lista claves con ✕ individual.
- Histórico: estado "Cargando histórico…" al abrir la pestaña.
- Claves: filas Mistral, OpenRouter y LLM7 + enlace "Volver a cargar".
- Proxy: botón ↺ Predefinida con el mensaje de URL sin subdominio.
- Paginación: opciones 15/50/100 añadidas.
- `PLAN.md` con el port a la app real por fases y riesgos.
- Carpeta renombrada a `prototipos_opencode_musespark1.3free` y rama a
  `prototipos_opencode_musespark1.3free_deepseekv4.1flash`.

---

## 3. Pendiente

### 3.1 En los prototipos
- Verificación automática de los 5 prototipos (consola limpia + interacciones
  principales) y corrección de lo que salga.
- Nuevo prototipo **P6 · Ruta** (propuesta de valor, ver §5).
- Actualizar la galería: hoy dice "4 diseños" y "3 estilos de mapa".

### 3.2 En la app real (no forma parte de esta rama)
El detalle está en `PLAN.md`:
1. P1 fases 1-2: header sticky y buscador siempre visible + chips de
   combustible (`FUEL_KEYS` como fuente).
2. P1 fases 3-5: KPIs, cards <768 px, bottom-sheet con targets de 44-48 px.
3. P4 como **modo** `body.driving` (solo CSS + hero), sin crear una app aparte.
4. P2 como modo mapa: carrusel con snap y FABs reutilizando `markerMap`.
5. P3 solo si se quiere modo escritorio (grid ≥1080 px).
6. Cierre: `bump`, `check-syntax`, suite completa y documentación del proyecto
   (fuera del alcance de esta rama).

---

## 4. Cobertura funcional (app real → prototipos)

Se auditará con navegador automatizado. Leyenda: ✅ cubierto · ⚠️ cubierto con
simplificación consciente · ❌ pendiente.

| Función de la app | Dónde se valida | Estado |
|---|---|---|
| Filtro provincia / localidad | P1-P5 | ✅ |
| Filtro combustible (10) | P5 (5 combustibles) | ⚠️ se validan 5, el resto comparte UI |
| Filtro marcas múltiple + búsqueda | P5 | ✅ |
| Distancia máxima + GPS + punto manual | P5 | ✅ |
| Búsqueda textual (toggle 🔍) | P1-P5 (siempre visible) | ⚠️ sin toggle, misma función |
| Vistas Mapa / Tabla / Ambos | P1-P5 | ✅ |
| 10 estilos de mapa | P5 (3 fondos simulados) | ⚠️ |
| Leyenda de precios por percentiles | P1-P5 | ✅ |
| Orden asc/desc y paginación | P3, P5 | ✅ |
| Favoritos + filtro solo favoritas | P1-P5 | ✅ |
| Detalle: 5 combustibles, 2 tabs | P1-P5 | ✅ |
| Histórico 7-180 días + tooltip | P1-P5 | ✅ |
| Gráfica en popup del mapa | P2 | ⚠️ popup sin gráfica propia |
| Descuentos por marca | P5 | ✅ |
| Push: bajada/subida, intervalo, días, modo | P5 | ✅ |
| Logs API/Push con borrado | P5 | ✅ |
| Caché IDB/LS + TTL + borrado | P5 | ✅ |
| Chat IA: 8 pestañas, General paralelo | P5 | ✅ |
| IA: modelos, refresco, editar, cancelar | P5 | ✅ |
| IA: claves, proxy NVIDIA, visibilidad, prompts | P5 | ✅ |
| Estado vacío sin provincia | P5 | ✅ |
| Actualización de la app | P5 | ✅ |

---

## 5. Propuestas nuevas

### 5.1 P6 · Ruta — "repostar camino al destino" (nueva)
Diseño distinto: en vez de listar estaciones alrededor, se planifica un
trayecto. Entrada: origen, destino, consumo (L/100) y litros que quedan.
La app calcula las paradas posibles sobre la ruta y **ordena por ahorro neto**
(precio × litros − coste del desvío), no por precio absoluto.

- Móvil: timeline vertical de la ruta con la parada recomendada destacada,
  desvío en minutos, ahorro en € y botón "Añadir a la ruta".
- PC: mapa con la ruta y las paradas; tabla comparativa a la derecha.
- Datos fake: ruta Madrid → Valencia con 5 estaciones y peajes/desvíos
  simulados.

### 5.2 Otras ideas (sin prototipo, para decidir)
- **P7 · Widget de mañana**: pantalla mínima con la más barata y la tendencia
  de tu combustible; candidata a atajo de la PWA.
- **Modo comparador**: fijar 2-4 estaciones y ver sus precios e histórico en
  columnas, con la diferencia en céntimos por depósito.
- **Alertas por objetivo**: "avísame si la 95 baja de 1,45 €" en vez de solo
  vigilar favoritas.
- **Histórico agregado de zona**: media de tu localidad, no solo por estación.

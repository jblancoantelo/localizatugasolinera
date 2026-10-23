# Checklist de validación — navegación e interacciones

Cada pasada debe poder recorrer estos flujos sin servidor (datos fake). Marcar ✅ cuando se valide.

## Flujos comunes (todas las pasadas)

| # | Flujo | Pasada 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|-------|----------|---|---|---|---|---|---|
| 1 | Abre el prototipo y ve estado vacío (sin provincia) | | | | | | | |
| 2 | Selecciona una provincia (chip / botón) | | | | | | | |
| 3 | Filtra por combustible | | | | | | | |
| 4 | Filtra por marca | | | | | | | |
| 5 | Filtra solo favoritos | | | | | | | |
| 6 | Busca por localidad/calle/marca | | | | | | | |
| 7 | Limpia todos los filtros | | | | | | | |
| 8 | Ordena por precio y por distancia | | | | | | | |
| 9 | Abre la ficha detalle de una estación | | | | | | | |
|10 | Marca/desmarca favorito (★) desde lista y desde ficha | | | | | | | |
|11 | Ve el gráfico de histórico de 30 días | | | | | | | |
|12 | Navega entre pestañas (listado / mapa) | | | | | | | |
|13 | Pulsa FAB de geolocalización → toast | | | | | | | |
|14 | Retrocede (volver a selector de provincia) | | | | | | | |
|15 | Cierra la ficha detalle sin perder selección | | | | | | | |

## Por pasada

**Pasada 1 — Móvil pulgar**
- [ ] Nav inferior accesible con una mano (zona del pulgar)
- [ ] Bottom sheet deslizable se abre y cierra
- [ ] Pull-to-refresh visual al tirar hacia abajo
- [ ] Filtros en chips horizontales desplazables
- [ ] Tarjetas en vez de tabla (sin scroll horizontal forzado)

**Pasada 2 — Tablet dividido**
- [ ] Barra lateral colapsable (filtros + lista)
- [ ] Mapa grande a la derecha
- [ ] Ficha detalle anclada al lateral (no tapa el mapa)
- [ ] Sincronización selección lista ↔ mapa
- [ ] Breakpoint 768/1024

**Pasada 3 — Escritorio ancho**
- [ ] Menú lateral fijo
- [ ] Mapa héroe central
- [ ] Ficha detalle ancha a la derecha
- [ ] Accesos de teclado (1-5 provincia, F favoritos, ESC limpiar)
- [ ] Modo oscuro/claro (preparado en tokens)

**Pasada 4 — Comparador enfoque**
- [ ] Selecciona hasta 3 estaciones (+ badge ✓)
- [ ] Comparador de precios lado a lado (panel inferior/lateral)
- [ ] Histórico superpuesto (múltiples líneas en una gráfica)
- [ ] Exportar/compartir (botón preparar)
- [ ] Límite de 3 con aviso toast

**Pasada 5 — Ruta y alertas**
- [ ] Añade estaciones a la ruta (orden de paradas)
- [ ] Coste estimado de la ruta (litros × precio)
- [ ] Activa alerta de bajada/subida por estación
- [ ] Prueba de notificación push simulada
- [ ] Log de notificaciones

**Pasada 6 — IA embebida**
- [ ] Asistente como panel deslizable (no pestaña aparte)
- [ ] Sugerencias rápidas (chips de preguntas)
- [ ] Respuesta citando estación concreta (nombre + precio)
- [ ] Indicador de escritura (typing)
- [ ] Historial de conversación visible

**Pasada 7 — Responsive unificado (final)**
- [ ] Un solo código con breakpoints 640 / 1024 / 1280
- [ ] Design system (tokens CSS coherentes)
- [ ] Mismo comportamiento en móvil y desktop
- [ ] Badge de precio (barato/medio/caro) en tarjetas
- [ ] Touch targets ≥ 44 px y safe areas

## Criterios de aceptación móvil
- [ ] Todo botón/touch target ≥ 44×44 px
- [ ] No hay solapes con la barra de gestos (safe-area-inset)
- [ ] El teclado no tapa el input principal (scroll de vista)
- [ ] Los chips de filtro no se cortan (scroll horizontal)
- [ ] La ficha detalle no tapa todo el contexto (bottom sheet)

## Notas
Los datos son **fake** (inventados). Los precios, histórico y distancias no son reales y solo sirven para validar la interfaz.

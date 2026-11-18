## 🎨 Prototipos de diseño — nemotron-3.5-super-vl-120b

Se ha añadido la carpeta `prototipos_nvidia_nemotron3.5supervl120ba12b/` con **8 pasadas de diseño responsive** para mejorar la UX/UI de la aplicación, centrándose sobre todo en móvil pero incluyendo versión desktop.

### Estructura

```
prototipos_nvidia_nemotron3.5supervl120ba12b/
├── README.md                      # Visión general y convenciones
├── datos-fake.js                  # Datos inventados (~40 estaciones, 6 provincias, histórico 30d)
├── validacion-navegacion.md       # Checklist de flujos por pasada
├── COMENTARIO_PR.md               # Este archivo (texto para pegar en el PR)
├── pasada-01-movil-pulgar/        # Mobile-first: nav inferior, chips, bottom sheet, pull-to-refresh
├── pasada-02-tablet-dividido/     # Tablet: sidebar colapsable + mapa grande, ficha anclada
├── pasada-03-desktop-ancho/       # PC: menú lateral fijo, mapa héroe, accesos de teclado
├── pasada-04-comparador-enfoque/  # Comparador hasta 3 estaciones, histórico superpuesto
├── pasada-05-ruta-alertas/        # Planificador de ruta, coste estimado, alertas push simuladas
├── pasada-06-ia-embebida/         # IA embebida en panel deslizable, sugerencias rápidas
├── pasada-07-unificado-responsive/# Design system (tokens CSS), breakpoints 640/1024/1280
└── pasada-08-completo-unificado/  # Maestro: todas las pestañas, filtros completos, chat IA, config, paginación
```

### Convenciones aplicadas (todos los prototipos)

- Touch targets ≥ 44×44 px
- Nav inferior en móvil (zona del pulgar), lateral en desktop
- Bottom sheet deslizable para el detalle (no tapa todo el contexto)
- Filtros como chips horizontales desplazables
- Breakpoints: 640 / 1024 / 1280 px
- Safe areas (`env(safe-area-inset-*)`) para notch y gestos
- Colores de precio: verde (≤1,45) / naranja (1,45–1,60) / rojo (>1,60)

### Funcionalidades de la app actual cubiertas (pasada-08, maestro unificado)

✅ Filtros: provincia, combustible, marca, búsqueda, distancia máxima  
✅ Leyenda dinámica de precios  
✅ Vistas Mapa / Tabla / Ambos sincronizadas  
✅ Histórico con gráfica canvas en bottom sheet  
✅ Favoritos ★/☆  
✅ Panel detalle con precio, descuento, variación 30d  
✅ Chat IA simulado en modal  
✅ Configuración simulada (caché TTL, push, pestañas IA)  
✅ Push notifications simulado con botón "Probar"  
✅ Paginación configurable  
✅ Responsive móvil + desktop

### Cómo validar

Cada `index.html` es autónomo: ábrelo directamente en el navegador (no necesita servidor). Todos cargan `datos-fake.js` con datos inventados para validar solo la interfaz y navegación.

### Notas

- Estos prototipos respetan todas las funcionalidades actuales de `index.html` y proponen mejoras de interacción y presentación validadas con datos fake antes de aplicar al código productivo.
- No se ha modificado ningún archivo de la app productiva (`index.html`, `css/`, `js/`, `sw.js`).
- Los datos son **fake** (no son reales del Ministerio).

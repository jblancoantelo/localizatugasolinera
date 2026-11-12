# prototipos_opencode_glm5.3flash — dossier de rediseño

Ocho prototipos **funcionales** de Localiza tu Gasolinera, con datos fake compartidos,
para comparar direcciones de diseño sin sesgo. Cada carpeta es autocontenida: se abre con
doble clic en su `index.html`, sin servidor ni dependencias (funciona por `file://`).

```
prototipos_opencode_glm5.3flash/
├── index.html          galería-portada con tarjeta por prototipo
├── _lib/mock.js        biblioteca compartida (namespace window.GLM)
├── _validar.mjs        validador Playwright (móvil 390×844 + PC 1440×900)
├── _capturas/          capturas: vXX-mv.png / vXX-pc.png (tras navegación)
│                       e ini-vXX-*.png (vista inicial, sin clics)
└── v01…v08/            un prototipo por concepto (HTML+CSS+JS inline)
```

## Qué llevan todos

Aunque la estética cambia radicalmente, la **funcionalidad es la misma** en los ocho:

- Provincias y localidades de ejemplo, varios combustibles conmutables con recálculo
  (los chips solo muestran combustibles **con datos**, `GLM.combDisponibles`).
- Precios finales **con descuento por marca** (céntimos configurables, como en Config).
- Favoritas con estrella, persistidas durante la sesión (simulan el IndexedDB real).
- Histórico con los **7 rangos de la app real** (7/14/21/30/60/90/180, `GLM.RANGOS`) y
  gráficas SVG (sparkline en tarjeta, serie completa en ficha).
- Ficha de estación completa: precio con descuento, gráfica por rango, tabla de todos los
  combustibles (con aviso «Sin datos de X» si el activo no tiene precio) y acciones
  (ruta, favorita, alerta push).
- Chat IA fake que responde por palabras clave (`GLM.PROMPTS`) con los datos del día,
  con input libre y prompts rápidos.
- Aviso push simulado (alertas de bajada con horas y ahorro) + panel de Ajustes real:
  descuentos editables que recalculan al instante, TTL de caché, limpiar caché,
  registro de actividad (tabs API/Push) y versión (`GLM.VERSION`).
- Lista con búsqueda por texto, orden cerca/precio, paginación (`GLM.paginar`) y
  filtro «solo con descuento» en los prototipos con vista lista.
- Pines/mapa coloreados con el semáforo de la app real: verde <1,50 € · ámbar 1,50–1,70 € · rojo >1,70 €.
- Los ocho funcionan bien en móvil 390×844 y en PC 1440×900 (capturas verificadas).

Los datos salen de un PRNG determinista con semilla: **cualquier prototipo muestra SIEMPRE
los mismos datos**, así que al comparar diseños no hay sesgo de contenido.

## Los 8 prototipos

### v01 · Tarjetas + chips — «la evolución mínima»
La evolución más directa de la app actual. Tarjetas grandes con precio protagonista,
hero azul de la más barata con sparkline, chips de filtro orden/combustible y ficha con
calculadora de depósito. En PC mantiene la columna estrecha (es la referencia
mobile-first del lote).
- **Ideas portuables ya:** hero de la más barata con sparkline, pills de descuento
  (`−1,5 ¢`) dentro de la tarjeta, contador de estaciones junto a cada combustible.
- Coste de integración: **bajo**. Es la app de hoy con otra piel.

### v02 · Mapa voraz + hoja arrastrable — «el mapa manda»
Mapa a pantalla completa con la lista en una **hoja con 3 snaps** (estilo Google
Maps/Uber). Clic en un pin resalta su tarjeta y viceversa; la hoja también expone
filtro por localidad y orden. En PC la hoja se convierte en sidebar fija.
- **Ideas portuables ya:** snap points en la hoja (en la app real bastarían 2 snaps),
  chips de combustible flotando sobre el mapa, sincronía pin↔tarjeta.
- Coste: **alto**. Necesita reimplementar la hoja con gestos (Pointer Events).

### v03 · Material 3 expresivo — «app de tienda, no de datos»
Píldora indicadora en la barra inferior, tarjetas de 24 px de radio, chips material y
feedback elástico al pulsar. Modo oscuro **automático según el sistema**
(`prefers-color-scheme`). En PC añade rejilla de 2 columnas para la lista.
- **Ideas portuables ya:** píldora de navegación animada, oscuro automático (es una
  petición recurrente), FAB de geolocalización.
- Coste: **medio**. Sobre todo CSS; la píldora necesita un pequeño indicador animado.

### v04 · Escritorio denso — «la oficina de precios»
La verdadera respuesta al PC: sidebar de filtros (provincia, localidad, combustibles como
pills, marcas con conteos, favoritos) + tabla paginada plana + mapa vivo a la derecha.
Todo visible a la vez: **0 clics para cruzar datos**. En móvil se apila con barra inferior.
- **Ideas portuables ya:** filtros como checklist de marcas con conteo, columna
  «Variación hoy» con flechas, CSV y Actualizar siempre accesibles.
- Coste: **medio-alto**. La vista de PC es un layout nuevo (3 columnas con paneles vivos).

### v05 · Modo noche / conducción — «una mano, de noche»
AMOLED puro (negro real `#0b0f14`), tipografía enorme, objetivos de toque ≥50 px,
sparkline por tarjeta y bloque de «Cómo llegar» en cada fila. En PC, rejilla de 2
columnas para no perder densidad.
- **Ideas portuables ya:** variante noche activable desde Config (variables CSS), botón
  grande de ruta por fila, sparkline roja/verde según tendencia.
- Coste: **bajo** (como *tema*) / medio (como vista dedicada).

### v06 · Contraste brutal — «escanear sin pensar»
Neobrutalismo accesible: sin sombras, bordes de 2-3 px, ranking con podio (#1–#3
destacados) y precio como titular. Semántica de ranking clarísima: sabes en 1 segundo
dónde está tu estación. En PC, parrilla brutalista de 2 columnas.
- **Ideas portuables ya:** numeral de posición (`#1`, `#2`…) en la vista sin mapa,
  podio destacado para las 3 más baratas.
- Coste: **medio**. El estilo polariza: decidir con usuarios reales.

### v07 · Torre de control — «comparar y decidir»
Dashboard PC con **KPIs** (media provincial, tendencia 7d vs 30d, mejor estación,
nº vigiladas), gráfica **multi-serie comparada** con leyenda activable, alertas push
recientes y resumen IA. En móvil se reduce a 3 pestañas (Resumen/Favoritas/IA).
- **Ideas portuables ya:** KPIs de cabecera (media + tendencia son lo que más se mira),
  leyenda de series activables (comparar tu favorita vs la más barata), comparación
  favoritas-vs-media en la tabla.
- Coste: **alto** como vista; **medio** portando solo la gráfica comparada.

### v08 · Flujo con pila de pantallas — «app nativa, no web»
Home con resumen del día (hero + media + favoritas), luego lista, ficha, histórico y
ajustes como **pantallas propias apiladas** con animación; onboarding de 3 pasos al
entrar. En PC se previsualiza dentro de un **marco de teléfono** (el concepto pierde
sentido fuera del móvil).
- **Ideas portuables ya:** Home con resumen diario (lo primero que se ve), ficha que empuja
  sobre una pila con retroceso animado, onboarding de primera vez (guardado en IndexedDB).
- Coste: **alto**. Cambia el modelo de navegación (pila vs pestañas).

## Matriz comparativa

| # | Concepto | Móvil | PC | Portar | Riesgo | Para quién |
|---|----------|-------|----|:------:|--------|------------|
| v01 | tarjetas + chips | ★★★ | ★★ | Bajo | Mínimo | Usuarios actuales |
| v02 | mapa + hoja | ★★★ | ★★★ | Alto | Gestos | Público general |
| v03 | Material 3 | ★★★ | ★★★ | Medio | Bajo | Nuevos usuarios |
| v04 | escritorio denso | ★★ | ★★★★ | Medio-alto | Medio | Persona de escritorio |
| v05 | noche / conducción | ★★★ | ★★★ | Bajo (tema) | Bajo | De noche / coche |
| v06 | contraste brutal | ★★★ | ★★★ | Medio | Polariza | Escaneo rápido |
| v07 | torre de control | ★★ | ★★★★ | Alto | Datos | Obsesivos de comparar |
| v08 | pila de pantallas | ★★★★ | ★★★ | Alto | Abandona pestañas | Perfil nativo-app |

## Qué validar al probarlos

**Móvil (390×844):**
1. ¿Se lee el precio sin acercar? ¿El pulgar llega al botón favorito?
2. ¿Cuesta cambiar de combustible / provincia? ¿Cuántos toques hasta la ficha?
3. ¿El histórico se entiende (fechas dd-mm-aaaa, huecos por día sin precio)?
4. ¿La IA responde con datos de la provincia y cita estaciones?

**PC (1440×900):**
1. ¿Se aprovecha el ancho o es un móvil estirado? (v03/v05/v06 lo resuelven con rejilla)
2. ¿Filtros, tabla y mapa se ven a la vez sin scroll eterno? (solo v04)
3. ¿El texto sigue siendo grande? (el PC invita a comprimir: tipografía mini)

**En todos:** rango de histórico, guardar/quitar favorita, cargar descuentos en Config,
aviso push de prueba y pregunta a la IA citando una estación concreta.

## Recomendación y plan de integración

Ningún prototipo debe portarse tal cual; el rediseño ganador es una **mezcla de tres piezas**:

1. **Base = v01** (la que menos rompe): hero de la más barata, pills de descuento,
   chips de filtro, ficha nueva con calculadora. Las pestañas actuales se mantienen.
2. **+ v03**: píldora de navegación en los tabs, `prefers-color-scheme` para modo
   oscuro automático, FAB de geolocalización. Es lo que hace *sentirse* nueva la app
   sin cambiar de modelo mental.
3. **+ v05 (como tema)**: el modo noche de conducción entra gratis con variables CSS:
   detectar horario o toggle en Config → «Tema nocturno».
4. **+ ideas de v07** en el PC: para ≥1200 px de ancho, añadir el panel lateral
   con KPIs + gráfica comparada cuando se está en la pestaña «Ambos».
5. **v02/v08 al roadmap largo:** la hoja con snaps o la pila de pantallas van con un
   rediseño de navegación (tocaría `controls.js`, `map.js` y el historial del navegador);
   no entran en esta iteración.

**El detalle técnico que hay que saber si se portan rejillas a PC:**
si el contenedor de la lista es `position:fixed` con `inset:0` + `overflow-y:auto`
(un patrón común a pantalla completa), Chrome no mide bien las filas `auto` de la
rejilla y las aplasta (pasó en v05/v06). Solución: `grid-auto-rows:max-content`.
En `_capturas/` queda la evidencia antes/después.

## Técnica

- **mock.js** (`window.GLM`): `GLM.de(prov,{loc,marcas})`, `GLM.precioFinal(est,comb)`,
  `GLM.historico(est,comb,dias)`, `GLM.chart(serie,{w,h,color})`, `GLM.spark()`,
  `GLM.miniMapa(el,{oscuro,onpin})` devuelve `{pines(...)}`, `GLM.chatRespuesta()`,
  `GLM.md()`, `GLM.snack()` y las constantes `GLM.PROVINCIAS / COMBUSTIBLES / MARCAS /
  descuentos`. PRNG con semilla: datos idénticos entre prototipos.
  Kit de QA compartido (pasada 4ª): `GLM.RANGOS` (los 7 rangos), `GLM.VERSION`,
  `GLM.combDisponibles(prov)` (combustibles con datos), `GLM.filtrar(lista,{q,loc,marcas,
  favs,desc,ord,dir,comb})` (orden cerca/precio con nulos al final), `GLM.paginar` /
  `GLM.pager`, `GLM.leyenda`, `GLM.csv`, `GLM.avisoPush` y el estilo `'sat'` en
  `miniMapa`. Los prototipos redirigen `GLM.snack` a su snack local y exponen
  `window.PT_PROBE` (asidero del sondeo interactivo).
- **_validar.mjs**: los 9 (galería + 8) en Chromium headless, móvil 390×844 y PC 1440×900,
  comprueba 0 errores de consola/pageerror, `window.PT_VALID` y hace 1 clic de navegación
  antes de capturar. `node prototipos_opencode_glm5.3flash/_validar.mjs` desde la raíz. Las capturas van a `_capturas/`.
- Los scripts inline se validan además con `node --check` (extraídos a fichero temporal).
- Todos los ficheros fuente llevan cabecera SPDX `AGPL-3.0-only` (convenio del repo).

Pasadas ejecutadas: **1ª** ideas (v01–v08) · **2ª** QA con Playwright y pulido visual
(0 errores JS en 18 pases; mojibake de encoding reparado con la transformación inversa
cp1252→UTF-8; hero invisible de v01; rejilla PC de v03/v05/v06; cabecera móvil de v04;
logos y títulos; pie de v08) · **3ª** este dossier, sin más ideas nuevas de diseño ·
**4ª** QA funcional contra la app real: sondeo Playwright interactivo con una batería
por prototipo (v01 14, v02 14, v03 13, v04 13 a PC 1440×900, v05 19, v06 19, v07 14,
v08 19 = **125 pruebas, todas en verde, 0 errores JS**). Bugs reales corregidos en
esta pasada: crash de KPIs sin datos y media inexacta en v07; tabs de v08 sin listener
de navegación y cambio de combustible/orden que no repintaba la lista; crash del
histórico provincial de v08 con media sobre series con huecos; botones del mapa de v06
tapados por la cabecera fija (`.mt`); barra de v05 desbordada a 390 px y input de IA
bajo las pestañas; mapa recreado en cada repintado (v05/v08, ahora instancia única);
fichas completas con 7 rangos, sort dual y paneles de Ajustes reales en v07/v08
(descuentos editables, push de prueba, caché, logs API/Push, versión).

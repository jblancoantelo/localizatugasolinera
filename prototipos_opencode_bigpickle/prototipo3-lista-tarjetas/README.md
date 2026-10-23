# Prototipo 3 — "Lista primero"

La app abre con la **lista** de gasolineras ya ordenada por precio y filtrada, y deja el mapa como vista secundaria. Así responde a "¿dónde reposto más barato?" sin tocar nada: el precio manda (número grande, color por tramo) y los filtros viven en una hoja deslizable que aplica al instante.

**Probar con clics:** toca una tarjeta (`data-shot="detalle"`) para ver precios e histórico con gráfica; abre **Filtros** (abajo dcha.) y cambia distancia/marcas; pulsa **Mapa** (`data-shot="vista"`) para cambiar de vista; y el botón flotante **IA** abre el chat (con marca de agua de tiempo). Abajo: **Favoritas** y **Ajustes**.

**Límites:** datos de ejemplo (`../shared/datos-fake.js`), mapa dibujado con SVG/CSS (sin red) y respuestas de IA simuladas. Objetivos táctiles ≥44 px y textos ≥12 px; funciona abriendo `index.html` por `file://`.

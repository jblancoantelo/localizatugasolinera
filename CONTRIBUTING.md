# Contribuir a Localiza tu Gasolinera

Gracias por querer aportar algo. Este documento explica **cómo** hacerlo para
que tu trabajo no se pierda y para que el proyecto siga siendo sostenible.

## 1. Antes de escribir código: firma el CLA

El proyecto se publica bajo **GNU AGPLv3** (`AGPL-3.0-only`) y es titularidad de
Juan Blanco Antelo. Para poder aceptar aportaciones externas y, a la vez, poder
relicenciar el proyecto en el futuro, necesitamos que aceptes el
[**Acuerdo de Licencia de Contribuyente (CLA v1.0)**](./docs/legal/CLA.md).

**No cedes tu copyright.** Sigues siendo el autor de tu aportación y puedes
usarla donde quieras. Solo concedes al titular una licencia no exclusiva,
perpetua e irrevocable, que le permite —entre otras cosas— relicenciar el
proyecto (por ejemplo, para una edición comercial). A cambio, tu código se
publica siempre bajo AGPLv3 y con tu nombre en el historial de Git.

**Cómo firmar (2 minutos):**

1. Añade tu entrada a [`docs/legal/CLA-firmas.json`](./docs/legal/CLA-firmas.json):

   ```json
   {
     "github": "tu-usuario",
     "nombre": "Nombre Apellidos",
     "email": "tu@correo.example",
     "tipo": "individual",
     "fecha": "2026-10-29",
     "cla": "1.0"
   }
   ```

2. Escribe en el cuerpo del pull request: *«Acepto el CLA v1.0 del Proyecto.»*

Si contribuyes en nombre de una empresa, la entidad debe firmar el
[Anexo B](./docs/legal/CLA.md#anexo-b--formulario-corporativo). El bot
[`.github/workflows/cla.yml`](./.github/workflows/cla.yml) avisa en la PR si
falta la firma.

> Las contribuciones triviales (una errata, un enlace roto) también necesitan
> firma. Si es solo una corrección de texto, abre un issue y lo cambiamos
> nosotros.

## 2. Entorno

Requisitos: Node.js 18+ (para los tests, Playwright).

```powershell
npm install
npx playwright install chromium   # solo la primera vez
```

No hay build: es una PWA estática. Para probarla en local:

```powershell
npm test                          # suite completa (levanta su propio servidor)
node check-syntax.mjs             # sintaxis de todo el JS
```

## 3. Reglas que no se pueden romper

Antes de tocar nada, lee [`AGENTS.md`](./AGENTS.md): es la referencia real de
convenios. Los puntos que más fallan en las PRs:

- **Sintaxis:** `node check-syntax.mjs` en verde.
- **Tests:** `node docs/test/full_test.mjs` completo en verde. Una PR con tests
  rojos no se revisa.
- **Service Worker:** si añades un `<script>` a `index.html`, ejecuta
  `node scripts/sync-sw-assets.mjs` (o `npm run bump`) o el SW servirá assets
  viejos.
- **Tabs:** `data-tab`, clase CSS y `setActiveTab()` usan el mismo kebab-case.
- **IndexedDB:** `dbGet('cache', 'clave')` — el nombre del store va siempre
  primero.
- **Histórico:** nunca llames a `fetch` a pelo; usa `historyRequest()`.
- **Sin dependencias nuevas** en el cliente salvo justificación: la app se sirve
  como estáticos y ya carga Leaflet por CDN.

## 4. Estilo

- JavaScript clásico en el cliente (sin bundler, sin `import` en `js/`), salvo
  los scripts `.mjs` de `scripts/` y el Worker.
- Comentarios y textos de interfaz **en español**.
- Nombres de variables y funciones en inglés, como el resto del código.
- Cada fichero nuevo lleva la cabecera SPDX:

  ```js
  // SPDX-License-Identifier: AGPL-3.0-only
  // Copyright (C) 2026 Juan Blanco Antelo — Localiza tu Gasolinera
  ```

## 5. Pull requests

1. Abre un issue antes si el cambio es grande (nueva vista, refactor, proveedor
   de IA nuevo). Evita PRs sorpresa de 2.000 líneas.
2. Rama corta y descriptiva (`fix-cache-favoritos`, `chat-ia-proveedor-x`).
3. Un cambio por PR. Si tocas UI y lógica, sepáralo.
4. Mensajes de commit descriptivos, en español, sin «fix» ni «update» a secas.
5. Actualiza la documentación afectada: `README.md`, `docs/CHANGELOG.md`,
   `docs/mejoras-petrol.md` y `docs/test/TEST_PLAN.md`.
6. Describe en la PR **qué** cambia, **por qué** y **cómo lo has probado**.

## 6. Qué encaja y qué no

**Bienvenido:** correcciones de precios/filtros, accesibilidad, rendimiento,
nuevos proveedores de IA que pasen CORS en un navegador real, traducciones,
tests, documentación.

**Consúltalo antes:** nuevas dependencias, cambios en el modelo de caché,
cualquier cosa que rompa la API pública de `js/state.js`, `js/helpers.js`,
`js/db.js` o `js/history.js` (las comparte el Service Worker).

**No se acepta:** código generado que no entiendas, telemetría, publicidad,
código ofuscado, licencias incompatibles con AGPLv3.

## 7. Seguridad

Si encuentras una vulnerabilidad (XSS en el chat, fugas de claves de IA,
inyección en las URLs del proxy), **no abras un issue público**: escribe al
correo del titular y da unos días para publicar un parche.

## 8. Licencia de tus aportaciones

Al aceptar el CLA, aceptas que tu Contribución se distribuya bajo
**AGPL-3.0-only** y que el titular pueda relicenciarla según la cláusula 3.2.
Puedes leer el texto completo en [`docs/legal/CLA.md`](./docs/legal/CLA.md).

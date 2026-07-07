# Gasolineras — Precios carburantes España

App web para consultar precios de gasolina y gasóleo en estaciones de servicio de España, con históricos, mapa interactivo y almacenamiento en Supabase.

## Stack

- **Frontend:** HTML/CSS/JS vanilla (sin frameworks)
- **Mapa:** Leaflet + OpenStreetMap / satélite
- **Caché local:** IndexedDB + localStorage
- **Base de datos externa:** Supabase (PostgreSQL) — opcional
- **API de datos:** [Geoportal de Hidrocarburos](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/)

---

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (plan gratuito vale)
- (Opcional) Token de acceso personal de Supabase para MCP

---

## Configuración rápida

### 1. Clonar

```bash
git clone <repo-url>
cd petrol
git checkout bbdd
```

### 2. Crear proyecto Supabase

1. Ir a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Crear proyecto (gratuito, región `eu-west-1`)
3. En Settings → API, copiar:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`

### 3. Credenciales locales

Editar `js/supabase-config.js`:

```js
window._SUPABASE_URL = 'https://tu-proyecto.supabase.co';
window._SUPABASE_ANON_KEY = 'tu-anon-key';
```

### 4. Crear tablas en Supabase

**Opción A — SQL Editor (recomendado):**

Abrir `supabase/migrations/001_schema.sql`, copiar y pegar en el SQL Editor de Supabase.

**Opción B — CLI:**

```bash
npx supabase link --project-ref tu-ref
npx supabase db push
```

### 5. Probar

```powershell
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
node test/full_test.mjs
```

---

## Despliegue (frontend)

Supabase **no tiene hosting de estáticos**. Opciones:

### GitHub Pages

```bash
git checkout bbdd
git push origin bbdd
# Settings → Pages → branch: bbdd, folder: /
```

### Netlify

```bash
npx netlify deploy --prod --dir=.
```

### Vercel

```bash
npx vercel --prod
```

El frontend se conecta automáticamente a Supabase a través de `js/supabase-config.js`.

---

## MCP (opencode)

Para que opencode interactúe con Supabase, configurar `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "supabase": {
      "type": "remote",
      "url": "https://mcp.supabase.com/mcp?project_ref=TU_REF",
      "oauth": {}
    }
  }
}
```

Luego:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_tu_token
opencode mcp auth supabase
```

---

## Estructura del proyecto

```
petrol/
├── index.html                  # App principal
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker
├── opencode.jsonc              # Config MCP Supabase
├── css/styles.css              # Estilos responsive
├── js/
│   ├── state.js                # Estado global
│   ├── helpers.js              # Utilidades (precios, combustible, etc.)
│   ├── storage.js              # IndexedDB + localStorage
│   ├── supabase-config.js      # Credenciales Supabase
│   ├── supabase-client.js      # Cliente Supabase (CRUD)
│   ├── map.js                  # Mapa Leaflet
│   ├── table.js                # Tabla de precios + detalle
│   ├── controls.js             # Renderizado, filtros, ordenación
│   ├── api.js                  # Fetch API carburantes
│   ├── chart-engine.js         # Gráfica histórica (Canvas)
│   └── main.js                 # Event listeners, init
├── supabase/
│   ├── migrations/
│   │   └── 001_schema.sql      # Esquema PostgreSQL
│   └── .env.example            # Plantilla credenciales
└── test/
    ├── full_test.mjs           # Tests E2E (33 tests)
    └── TEST_PLAN.md            # Plan de tests
```

---

## Base de datos (PostgreSQL)

### Esquema relacional

```
provincias (id, nombre)
  └─ gasolineras (ideess, rotulo, direccion, ..., provincia_id → provincias)
       └─ precios_historicos (id, gasolinera_id → gasolineras, fecha, carburante, precio)
```

### Tablas

| Tabla | Propósito | RLS |
|-------|-----------|-----|
| `provincias` | Catálogo de 52 provincias | SELECT anónimo |
| `gasolineras` | Estaciones de servicio (~12.000) | SELECT/INSERT anónimo |
| `precios_historicos` | Precios diarios por gasolinera + combustible + fecha | SELECT/INSERT/UPDATE anónimo |

### Políticas RLS

Todas las tablas permiten lectura anónima. `gasolineras` y `precios_historicos` permiten inserción/update anónimos desde la app.

---

## API de carburantes (origen datos)

Base: `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/`

### Endpoints usados

| Endpoint | Uso |
|----------|-----|
| `Listados/Provincias/` | Obtener lista de provincias |
| `EstacionesTerrestres/FiltroProvincia/{ID}` | Precios actuales por provincia |
| `EstacionesTerrestresHist/FiltroProvincia/{DD-MM-YYYY}/{ID}` | Histórico por provincia + fecha |

> ⚠ El formato de fecha en el histórico usa **guiones** (`DD-MM-YYYY`), no barras.

### Flujo de datos históricos

1. App consulta API de Minetur para 14 días (lotes de 3)
2. Guarda en IndexedDB (caché local) con TTL configurable
3. Envía los datos a Supabase en segundo plano (`sbGuardarHistorialProvincia`)
4. Al mostrar histórico, busca en: IndexedDB → API Minetur → Supabase

---

## Tests

```powershell
node test/full_test.mjs
```

33 tests (24 HTTP + 7 file://):
- Carga, toolbar, tabs, selección provincia
- Datos, filtros, tabla, ordenación
- Detalle, histórico, gráfica
- Mapa, satélite, geolocalización
- Persistencia tras F5
- file:// sin errores CORS

---

## Workflow git

```bash
git checkout bbdd
# hacer cambios...
git add -A
git commit -m "descripción"
git push origin bbdd
```

Ramas:

| Rama | Propósito |
|------|-----------|
| `main` | Producción |
| `propuesta-d` | Propuesta inicial |
| `historico` | Fix API histórica |
| `bbdd` | Integración Supabase |

---

## Historial de cambios

### Rama `bbdd`
- Conexión a Supabase (proyecto `petrolfinder`)
- Esquema PostgreSQL: `provincias`, `gasolineras`, `precios_historicos`
- Cliente Supabase en `js/supabase-client.js`
- Almacenamiento automático de histórico en Supabase
- Config MCP para opencode
- Documentación actualizada
- Tests: 33/33 OK

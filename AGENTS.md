# AGENTS.md — Gasolineras Propuesta D

## Workflow obligatorio

1. **Siempre ejecutar tests completos** tras cualquier cambio:
   ```powershell
   Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
   node test/full_test.mjs
   ```
   Si los tests no existen o fallan, no continuar hasta que pasen todos.

2. **Commit**: preguntar al usuario antes de hacer commit. Si confirma:
   ```powershell
   git add -A
   git commit -m "mensaje descriptivo"
   git push
   ```
   Rama activa: `bbdd`

## Convenios del proyecto

### Tabs (propagación CSS/HTML/JS)
- `data-tab` en HTML usa **kebab-case**: `tab-map`, `tab-table`, `tab-both`, `tab-config`
- CSS clases usan el mismo kebab-case: `.tab-map`, `.tab-table`, `.tab-both`, `.tab-config`
- JS `setActiveTab(tabId)` recibe el mismo kebab-case
- JS comparaciones dentro de `setActiveTab` usan kebab-case

**Si se cambia un tab, actualizar los 3 lugares simultáneamente.**  
El test "Clase CSS + panel + botón activo en todas las vistas" detecta mismatch.

### Dropdown marcas
- Posicionado con `position: fixed` + `getBoundingClientRect()` en JS
- En HTML es hijo directo de `.app` (NO anidado en toolbar)
- `z-index: 10000`

### CSS z-index
- Todo elemento con `z-index` debe tener `position: relative` (o fixed/absolute)
- Si se añade un nuevo elemento con z-index, verificar stacking context
- Elementos conocidos con z-index:
  - `.toolbar`: `z-index: 100; position: relative`
  - `.bottom-tabs`: `z-index: 100; position: relative`
  - `.detail-panel`: `z-index: 200; position: absolute`
  - `#brandFilterDropdown`: `z-index: 10000; position: fixed`

### Persistencia estado tras F5
- `loadState()` en `main.js` DEBE restaurar `STATE.selectedProv` ANTES de `setActiveTab()`
- Razón: `setActiveTab()` llama a `saveState()` vía microtask (`Promise.resolve().then()`)
- Si `selectedProv` no se restaura primero, el microtask sobrescribe localStorage con `''`
- `tryAutoRestoreProvince()` (en api.js) lee después de IndexedDB (macrotask) y encuentra el valor borrado

Orden correcto en `main.js`:
```js
if (saved.selectedProv) STATE.selectedProv = saved.selectedProv;
if (saved.activeTab) setActiveTab(saved.activeTab);
```

**Regla general**: cada propiedad guardada en `saveState()` (storage.js) debe tener su restauración correspondiente en `loadState()` (`main.js`). Las que faltan actualmente: `selectedFuel`, `selectedLoc`, `maxDistance`, `userLat`/`userLng`. Las que no necesitan restauración en `loadState` se restauran desde `loadProvinceFilters` dentro de `fetchProvinceData()`.

### Tests
- Ubicación: `test/full_test.mjs`
- Plan: `test/TEST_PLAN.md`
- 33 tests totales (26 HTTP + 7 file://)
- Test de persistencia F5: selecciona provincia, recarga página, verifica que se restauró
- Servidor HTTP inline (no requiere procesos externos)

### Archivos clave
| Archivo | Propósito |
|---------|-----------|
| `index.html` | Toolbar + content + tabs + bottom sheet |
| `css/styles.css` | ~260 líneas responsive |
| `js/state.js` | STATE global |
| `js/storage.js` | localStorage (estado/filtros) + IndexedDB (caché/favoritos) |
| `js/supabase-config.js` | Credenciales Supabase (URL + anon key) |
| `js/supabase-client.js` | Cliente Supabase: guardar/leer histórico, gasolineras, provincias |
| `js/api.js` | Fetch datos, `tryAutoRestoreProvince()` |
| `js/controls.js` | `render()`, `setActiveTab()`, filtros |
| `js/table.js` | `doSort()`, `showDetail()` |
| `js/main.js` | Event listeners, restauración de estado |
| `sw.js` | Service Worker (solo HTTP) |
| `opencode.jsonc` | Config MCP para Supabase |
| `supabase/migrations/001_schema.sql` | Esquema PostgreSQL (schema `petrol`) |
| `supabase/.env.example` | Plantilla de credenciales |

### Configuración Supabase (opcional)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar `supabase/migrations/001_schema.sql` en SQL Editor
3. Ir a **Settings → API → Exposed schemas** y añadir `petrol`
4. Pegar SUPABASE_URL y SUPABASE_ANON_KEY en `js/supabase-config.js`
5. (Opcional) Para usar MCP: crear token en Account→Access Tokens y exportar `SUPABASE_ACCESS_TOKEN`

### Schema `petrol`

- Las tablas están en schema `petrol` (no `public`).
- `js/supabase-client.js` usa `createClient(URL, KEY, { db: { schema: 'petrol' } })`.
- El schema debe estar expuesto en PostgREST vía `ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, extensions, petrol';` + reload.
- RLS: todas las tablas tienen policies SELECT + INSERT + UPDATE con `USING (true)`.
- Grants: `USAGE` y `ALL` en schema/tablas/secuencias a `anon`, `authenticated`, `service_role`.

### Comandos útiles
```powershell
# Tests
node test/full_test.mjs

# Servidor manual para depuración
node -e "const h=require('http'),fs=require('fs');h.createServer((q,r)=>{let p=q.url=='/'?'index.html':q.url.slice(1);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end('')}else{r.writeHead(200,{'Content-Type':{'html':'text/html','css':'text/css','js':'application/javascript'}[p.split('.').pop()]||'text/plain'});r.end(d)}})}).listen(8080)"

# Forzar recarga sin caché
# Abrir DevTools → Network → Disable cache, luego F5
```

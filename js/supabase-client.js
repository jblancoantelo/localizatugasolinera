const SUPABASE_URL = window._SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window._SUPABASE_ANON_KEY || '';
let _supabase = null;

async function initSupabase() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase: no configurado (falta SUPABASE_URL o SUPABASE_ANON_KEY)');
    return null;
  }
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'petrol' } });
    return _supabase;
  } catch (e) {
    console.warn('Supabase: error al inicializar', e.message);
    return null;
  }
}

async function sbInsertOrIgnore(table, data, conflictCols) {
  const sb = await initSupabase();
  if (!sb) return;
  try {
    await sb.from(table).insert(data, { onConflict: conflictCols, ignoreDuplicates: true });
  } catch (e) {}
}

async function sbGuardarHistorialProvincia(provinceName, historyByDate) {
  const sb = await initSupabase();
  if (!sb) return;
  const provId = STATE.provinceIdMap[provinceName];
  if (!provId) return;
  await sbInsertOrIgnore('provincias', { id: provId, nombre: provinceName }, 'id');
  for (const [dateStr, list] of Object.entries(historyByDate)) {
    if (!list || !list.length) continue;
    const fecha = dateStr.split('-').reverse().join('-');
    for (const st of list) {
      const provId2 = STATE.provinceIdMap[st.Provincia];
      if (!provId2) continue;
      await sbInsertOrIgnore('gasolineras', {
        ideess: st.IDEESS,
        rotulo: st['Rótulo'] || '',
        direccion: st['Dirección'] || '',
        localidad: st['Localidad'] || '',
        provincia_id: provId2,
        codigo_postal: st['C.P.'] || '',
        horario: st['Horario'] || '',
        latitud: (() => { const v = parseFloat((st['Latitud'] || '').replace(',', '.')); return isNaN(v) ? null : v; })(),
        longitud: (() => { const v = parseFloat((st['Longitud (WGS84)'] || '').replace(',', '.')); return isNaN(v) ? null : v; })(),
        margen: st['Margen'] || ''
      }, 'ideess');
      for (const [name, key] of FUEL_NAMES) {
        const precio = st[key];
        if (precio === undefined || precio === null || precio === '') continue;
        const p = parseFloat(precio.toString().replace(',', '.'));
        if (isNaN(p)) continue;
        await sbInsertOrIgnore('precios_historicos', {
          gasolinera_id: st.IDEESS,
          fecha: fecha,
          carburante: name,
          precio: p
        }, 'gasolinera_id,fecha,carburante');
      }
    }
  }
}

async function sbObtenerHistorial(gasolineraId, carburante) {
  const sb = await initSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('precios_historicos')
    .select('fecha, precio')
    .eq('gasolinera_id', gasolineraId)
    .eq('carburante', carburante)
    .order('fecha', { ascending: true })
    .limit(30);
  if (error) {
    console.warn('Supabase: error al obtener historial', error.message);
    return [];
  }
  return data.map(r => ({ date: r.fecha.split('-').reverse().join('-'), price: r.precio }));
}

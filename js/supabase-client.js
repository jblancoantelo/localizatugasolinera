const SUPABASE_URL = window._SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window._SUPABASE_ANON_KEY || '';
let _supabase = null;
let _supabaseReady = false;

async function initSupabase() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase: no configurado (falta SUPABASE_URL o SUPABASE_ANON_KEY)');
    return null;
  }
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    _supabaseReady = true;
    return _supabase;
  } catch (e) {
    console.warn('Supabase: error al inicializar', e.message);
    return null;
  }
}

async function sbUpsertProvincias(provincias) {
  const sb = await initSupabase();
  if (!sb) return;
  for (const p of provincias) {
    await sb.from('provincias').upsert({ id: p.id, nombre: p.nombre }, { onConflict: 'id' });
  }
}

async function sbUpsertGasolinera(d) {
  const sb = await initSupabase();
  if (!sb) return;
  const provId = STATE.provinceIdMap[d.Provincia];
  if (!provId) return;
  await sb.from('gasolineras').upsert({
    ideess: d.IDEESS,
    rotulo: d['Rótulo'] || '',
    direccion: d['Dirección'] || '',
    localidad: d['Localidad'] || '',
    provincia_id: provId,
    codigo_postal: d['C.P.'] || '',
    horario: d['Horario'] || '',
    latitud: parseFloat((d['Latitud'] || '').replace(',', '.')),
    longitud: parseFloat((d['Longitud (WGS84)'] || '').replace(',', '.')),
    margen: d['Margen'] || ''
  }, { onConflict: 'ideess' });
}

async function sbUpsertPrecioHistorico(gasolineraId, fecha, carburante, precio) {
  const sb = await initSupabase();
  if (!sb) return;
  if (precio === null || precio === undefined || precio === '') return;
  try {
    await sb.from('precios_historicos').upsert({
      gasolinera_id: gasolineraId,
      fecha: fecha,
      carburante: carburante,
      precio: parseFloat(precio.toString().replace(',', '.'))
    }, { onConflict: 'gasolinera_id,fecha,carburante' });
  } catch (e) {
    console.warn('Supabase: error al guardar precio', gasolineraId, fecha, carburante, e.message);
  }
}

async function sbGuardarHistorialProvincia(provinceName, historyByDate) {
  const sb = await initSupabase();
  if (!sb) return;
  const provId = STATE.provinceIdMap[provinceName];
  if (!provId) return;
  for (const [dateStr, list] of Object.entries(historyByDate)) {
    if (!list || !list.length) continue;
    const fecha = dateStr.split('-').reverse().join('-');
    for (const st of list) {
      await sbUpsertGasolinera(st);
      for (const [name, key] of FUEL_NAMES) {
        const precio = st[key];
        if (precio !== undefined && precio !== null && precio !== '') {
          await sbUpsertPrecioHistorico(st.IDEESS, fecha, name, precio);
        }
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

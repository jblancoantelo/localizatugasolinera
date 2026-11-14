/* ============================================================================
   PROTO — datos falsos y utilidades de cálculo
   ----------------------------------------------------------------------------
   Datos inventados pero plausible s (precios de 2026, marcas reales, direcciones
   reales aproximadas) para poder validar interfaz y navegación sin red.
   Todas las series históricas son deterministas: la misma estación dibuja
   siempre la misma curva (PRNG con semilla derivada del IDEESS + combustible).
   ========================================================================== */
const PROTO = (() => {
  'use strict';

  /* --- 1. Contexto ------------------------------------------------------- */
  const USER = { lat: 40.4324, lng: -3.7038, label: 'Chamberí, Madrid', accuracy: 18 };

  const FUELS = [
    { id: 'g95',     name: 'Gasolina 95 E5',      short: 'G95',    unit: '€/L', icon: 'droplet' },
    { id: 'g98',     name: 'Gasolina 98 E5',      short: 'G98',    unit: '€/L', icon: 'droplet' },
    { id: 'diesel',  name: 'Gasóleo A',           short: 'Diésel', unit: '€/L', icon: 'droplet' },
    { id: 'dieselP', name: 'Gasóleo Premium',     short: 'Diésel+',unit: '€/L', icon: 'droplet' },
    { id: 'glp',     name: 'GLP (autogas)',       short: 'GLP',    unit: '€/L', icon: 'flame' },
    { id: 'adblue',  name: 'AdBlue (granel)',     short: 'AdBlue', unit: '€/L', icon: 'flask' },
  ];
  const fuelName = (id) => (FUELS.find(f => f.id === id) || FUELS[0]).name;
  const fuelShort = (id) => (FUELS.find(f => f.id === id) || FUELS[0]).short;

  const PROVINCES = [
    { id: '28', name: 'Madrid' }, { id: '08', name: 'Barcelona' }, { id: '46', name: 'Valencia' },
    { id: '41', name: 'Sevilla' }, { id: '50', name: 'Zaragoza' }, { id: '29', name: 'Málaga' },
    { id: '30', name: 'Murcia' }, { id: '48', name: 'Bizkaia' }, { id: '03', name: 'Alicante' },
    { id: '47', name: 'Valladolid' }, { id: '33', name: 'Asturias' }, { id: '15', name: 'A Coruña' },
    { id: '07', name: 'Illes Balears' }, { id: '35', name: 'Las Palmas' }, { id: '38', name: 'S/C de Tenerife' },
    { id: '01', name: 'Araba/Álava' }, { id: '02', name: 'Albacete' }, { id: '04', name: 'Almería' },
    { id: '05', name: 'Ávila' }, { id: '06', name: 'Badajoz' }, { id: '09', name: 'Burgos' },
    { id: '10', name: 'Cáceres' }, { id: '11', name: 'Cádiz' }, { id: '12', name: 'Castellón' },
    { id: '13', name: 'Ciudad Real' }, { id: '14', name: 'Córdoba' }, { id: '16', name: 'Cuenca' },
    { id: '17', name: 'Girona' }, { id: '18', name: 'Granada' }, { id: '19', name: 'Guadalajara' },
    { id: '20', name: 'Gipuzkoa' }, { id: '21', name: 'Huelva' }, { id: '22', name: 'Huesca' },
    { id: '23', name: 'Jaén' }, { id: '24', name: 'León' }, { id: '25', name: 'Lleida' },
    { id: '26', name: 'La Rioja' }, { id: '27', name: 'Lugo' }, { id: '31', name: 'Navarra' },
    { id: '32', name: 'Ourense' }, { id: '34', name: 'Palencia' }, { id: '36', name: 'Pontevedra' },
    { id: '37', name: 'Salamanca' }, { id: '39', name: 'Cantabria' }, { id: '40', name: 'Segovia' },
    { id: '42', name: 'Soria' }, { id: '43', name: 'Tarragona' }, { id: '44', name: 'Teruel' },
    { id: '45', name: 'Toledo' }, { id: '49', name: 'Zamora' }, { id: '51', name: 'Ceuta' },
    { id: '52', name: 'Melilla' },
  ];

  /* Colores de marca = solo decorativos (avatar de la tarjeta) */
  const BRANDS = {
    'REPSOL':    { color: '#ef6b16', ink: '#fff', discount: 5, program: 'Repsol Vivit', note: '-5 ¢/L con app' },
    'MOEVE':     { color: '#00a29a', ink: '#fff', discount: 0, program: 'Moeve Ganas', note: 'antes Cepsa' },
    'BP':        { color: '#0f8a44', ink: '#fff', discount: 0, program: 'BPme', note: '' },
    'GALP':      { color: '#f0a92a', ink: '#3a2a00', discount: 0, program: 'Galp Frota', note: '' },
    'SHELL':     { color: '#e8c400', ink: '#2b2400', discount: 0, program: 'Shell Go+', note: '' },
    'BALLENOIL': { color: '#1d5fbf', ink: '#fff', discount: 0, program: '', note: 'Desatendida' },
    'PETROPRIX': { color: '#e2582b', ink: '#fff', discount: 0, program: '', note: 'Desatendida' },
    'ALCAMPO':   { color: '#d81e26', ink: '#fff', discount: 0, program: 'Alcampo Mi', note: '' },
    'CARREFOUR': { color: '#1257b0', ink: '#fff', discount: 0, program: 'Club Carrefour', note: '' },
    'VALCARCE':  { color: '#c0242b', ink: '#fff', discount: 0, program: '', note: '' },
    'BONÀREA':   { color: '#118f4c', ink: '#fff', discount: 0, program: 'BonÀrea', note: '' },
    'PLENERGY':  { color: '#2a2f8f', ink: '#fff', discount: 0, program: '', note: 'Desatendida' },
  };
  const brandMeta = (b) => BRANDS[b] || { color: '#5a6b7d', ink: '#fff', discount: 0, program: '', note: '' };

  /* --- 2. Gasolineras ---------------------------------------------------- */
  /* p = [G95, G98, Diésel, DiéselPremium, GLP, AdBlue] (null = no lo sirve) */
  const RAW = [
    /* ---- Madrid ---- */
    ['28-04512','REPSOL','Repsol Raimundo Fdez. Villaverde', 'Madrid', 'Madrid', 'C/ Raimundo Fernández Villaverde, 79', 40.44532, -3.69842, [1.679,1.859,1.559,1.709,null,null], '24h', 8, 4.2, 1284, ['tienda','lavado','cafe','aire','adblue'], true],
    ['28-03317','MOEVE','Moeve Castellana 200', 'Madrid', 'Madrid', 'Pº de la Castellana, 200', 40.46026, -3.68910, [1.665,1.845,1.545,1.695,null,null], '24h', 14, 4.0, 942, ['tienda','cafe','aire','adblue'], false],
    ['28-09114','BALLENOIL','Ballenoil Las Tablas', 'Madrid', 'Madrid', 'C/ de la Patrona de Canarias, 12', 40.49923, -3.66482, [1.499,1.679,1.399,null,null,null], '24h', 3, 4.6, 512, ['aire','aspirador'], true],
    ['28-07655','PETROPRIX','Petroprix Villaverde', 'Madrid', 'Madrid', 'Av. Real de Pinto, 130', 40.35680, -3.69960, [1.485,null,1.389,null,null,null], '24h', 11, 4.5, 388, ['aire'], false],
    ['28-05422','GALP','Galp Alcalá 45', 'Madrid', 'Madrid', 'C/ de Alcalá, 45', 40.42226, -3.69421, [1.639,1.819,1.529,1.669,0.979,null], '06:00-23:00', 21, 3.9, 221, ['tienda','cafe','aire'], false],
    ['28-01288','BP','BP Av. de América', 'Madrid', 'Madrid', 'Av. de América, 14', 40.43890, -3.67402, [1.699,1.879,1.569,1.719,null,0.749], '24h', 6, 4.1, 640, ['tienda','cafe','lavado','aire','adblue'], false],
    ['28-06741','SHELL','Shell M-30 Sur', 'Madrid', 'Madrid', 'Ctra. de Toledo, km 6,5', 40.39010, -3.68210, [1.689,1.869,1.579,1.729,null,null], '24h', 32, 3.7, 118, ['tienda','cafe','lavado'], false],
    ['28-02390','ALCAMPO','Alcampo Las Rozas', 'Madrid', 'Las Rozas', 'C/ de las Rozas, 4', 40.49200, -3.87300, [1.529,1.709,1.429,null,null,null], '09:00-22:00', 46, 4.3, 733, ['tienda','super','aire'], false],
    ['28-08512','VALCARCE','Valcarce A-2 Madrid', 'Madrid', 'San Blas', 'Av. de Zarzuela, 2', 40.45990, -3.60980, [1.559,null,1.449,null,null,null], '24h', 19, 3.8, 154, ['tienda','cafe','ducha'], false],
    ['28-04210','REPSOL','Repsol Chamberí', 'Madrid', 'Madrid', 'C/ de Bravo Murillo, 152', 40.45120, -3.70360, [1.672,1.852,1.552,1.702,null,null], '24h', 12, 4.0, 402, ['tienda','aire'], true],
    ['28-01993','PLENERGY','Plenergy Méndez Álvaro', 'Madrid', 'Madrid', 'C/ de Méndez Álvaro, 44', 40.39620, -3.68790, [1.512,null,1.412,null,null,null], '24h', 9, 4.4, 96, ['aire'], false],
    /* ---- Zaragoza ---- */
    ['50-02231','PETROPRIX','Petroprix Zaragoza Z-40', 'Zaragoza', 'Zaragoza', 'Av. de la Industria, 6', 41.65210, -0.93610, [1.492,null,1.392,null,null,null], '24h', 17, 4.5, 276, ['aire'], false],
    ['50-01140','REPSOL','Repsol Gran Vía', 'Zaragoza', 'Zaragoza', 'Gran Vía, 29', 41.64820, -0.88390, [1.669,1.849,1.549,1.699,null,null], '24h', 25, 4.0, 512, ['tienda','aire','adblue'], true],
    ['50-03455','BALLENOIL','Ballenoil Vía Hispanidad', 'Zaragoza', 'Zaragoza', 'Vía Hispanidad, 121', 41.63210, -0.92570, [1.505,1.685,1.405,null,null,null], '24h', 7, 4.4, 198, ['aire','aspirador'], false],
    ['50-02788','MOEVE','Moeve Actur', 'Zaragoza', 'Zaragoza', 'Av. de Ranillas, 3', 41.66990, -0.89170, [1.659,1.839,1.539,1.689,null,null], '24h', 13, 4.1, 321, ['tienda','cafe','aire'], false],
    ['50-04120','ALCAMPO','Alcampo Puerto Venecia', 'Zaragoza', 'Zaragoza', 'Av. de las Flores, 2', 41.60180, -0.87910, [1.520,1.700,1.420,null,null,null], '09:00-22:00', 29, 4.2, 411, ['tienda','super','aire'], false],
    ['50-03896','BONÀREA','BonÀrea Zaragoza', 'Zaragoza', 'Zaragoza', 'Pol. Malpica, c/ E, 12', 41.61240, -0.89930, [1.545,null,1.435,null,null,null], '07:00-22:00', 22, 4.3, 142, ['tienda','super'], false],
    /* ---- Valencia ---- */
    ['46-01822','REPSOL','Repsol Av. del Puerto', 'Valencia', 'Valencia', 'Av. del Puerto, 219', 39.47290, -0.35240, [1.661,1.841,1.541,1.691,null,null], '24h', 18, 4.0, 380, ['tienda','cafe','aire'], false],
    ['46-02940','BALLENOIL','Ballenoil Vara de Quart', 'Valencia', 'Valencia', 'C/ de la Vara de Quart, 70', 39.44560, -0.40520, [1.489,1.669,1.389,null,null,null], '24h', 5, 4.6, 264, ['aire','aspirador'], true],
    ['46-03387','MOEVE','Moeve Blasco Ibáñez', 'Valencia', 'Valencia', 'Av. de Blasco Ibáñez, 140', 39.48010, -0.35290, [1.652,1.832,1.532,1.682,null,null], '24h', 26, 3.9, 190, ['tienda','aire'], false],
    ['46-01156','GALP','Galp Avenida del Cid', 'Valencia', 'Valencia', 'Av. del Cid, 100', 39.46420, -0.39510, [1.629,1.809,1.519,1.659,0.969,null], '06:00-23:00', 34, 3.8, 128, ['cafe','aire'], false],
    ['46-04021','CARREFOUR','Carrefour Alfafar', 'Valencia', 'Alfafar', 'C/ Alacant, 14', 39.42310, -0.38690, [1.535,1.715,1.435,null,null,null], '09:00-22:00', 41, 4.1, 522, ['tienda','super','aire'], false],
    /* ---- Sevilla ---- */
    ['41-02033','REPSOL','Repsol Luis Montoto', 'Sevilla', 'Sevilla', 'C/ Luis Montoto, 130', 37.38420, -5.97310, [1.658,1.838,1.538,1.688,null,null], '24h', 15, 4.0, 300, ['tienda','cafe'], false],
    ['41-03710','BALLENOIL','Ballenoil Sevilla Este', 'Sevilla', 'Sevilla', 'Av. de las Ciencias, 3', 37.40310, -5.92560, [1.495,null,1.395,null,null,null], '24h', 10, 4.5, 175, ['aire'], false],
    ['41-01598','MOEVE','Moeve Ronda Urbana Sur', 'Sevilla', 'Sevilla', 'Ronda Urbana Sur, s/n', 37.36450, -5.98120, [1.655,1.835,1.535,1.685,null,null], '24h', 28, 3.9, 140, ['tienda','aire'], false],
    ['41-04288','SHELL','Shell SE-30', 'Sevilla', 'Dos Hermanas', 'Autovía SE-30, km 12', 37.33410, -5.96480, [1.679,1.859,1.559,1.709,null,null], '24h', 38, 3.7, 88, ['tienda','cafe','lavado'], false],
    /* ---- Barcelona ---- */
    ['08-02911','REPSOL','Repsol Diagonal Mar', 'Barcelona', 'Barcelona', 'Av. Diagonal, 208', 41.40610, 2.21640, [1.685,1.865,1.565,1.715,null,null], '24h', 16, 4.0, 480, ['tienda','cafe','aire','adblue'], false],
    ['08-04560','PETROPRIX','Petroprix Sant Andreu', 'Barcelona', 'Barcelona', 'C/ de Sant Adrià, 60', 41.43710, 2.20310, [1.505,null,1.405,null,null,null], '24h', 4, 4.5, 210, ['aire'], true],
    ['08-01777','BP','BP Ronda Litoral', 'Barcelona', 'Barcelona', 'Ronda Litoral, 21', 41.36290, 2.15180, [1.705,1.885,1.585,1.735,null,null], '24h', 23, 3.8, 355, ['tienda','cafe','lavado'], false],
  ];

  const STATIONS = RAW.map((r, i) => {
    const [id, brand, name, city, area, address, lat, lng, p, schedule, updatedMin, rating, reviews, services, fav] = r;
    /* El código de provincia va embebido en el IDEESS ('28-04512' → Madrid) */
    const province = (PROVINCES.find(x => x.id === id.slice(0, 2)) || {}).name || '';
    return {
      id, brand, name, city, area, province, address, lat, lng, schedule, updatedMin, rating, reviews, services, fav,
      prices: { g95: p[0], g98: p[1], diesel: p[2], dieselP: p[3], glp: p[4], adblue: p[5] },
      tank70: Math.round(70 * (p[2] || p[0]) * 100) / 100,
      index: i,
    };
  });

  /* --- 3. Utilidades geográficas y de formato ---------------------------- */
  const R = 6371;
  function haversine(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const kmFromUser = (st) => haversine(USER.lat, USER.lng, st.lat, st.lng);
  /** minutos de coche estimados a 27 km/h de media urbana + 1 min de desvío */
  const driveMin = (km) => Math.max(2, Math.round(km / 0.45 / 60 * 60 / 60 * 60) || Math.round(km * 2.2 + 1));

  const nf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const nf2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const eur = (v) => v == null ? '—' : nf.format(v) + ' €';
  const eur2 = (v) => v == null ? '—' : nf2.format(v) + ' €';
  const cents = (v) => v == null ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' ¢';
  const money = (v, dec = 2) => v == null ? '—' : new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v) + ' €';
  const pct = (v) => (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %';
  const dist = (km) => km < 1 ? Math.round(km * 1000) + ' m' : nf2.format(km) + ' km';
  const since = (min) => min < 2 ? 'ahora mismo' : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} d`;

  const pad = (n) => String(n).padStart(2, '0');
  const ddmmyyyy = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  const ddsmm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const dayName = (d) => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()];

  /* --- 4. Series históricas deterministas ------------------------------- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /** Precio final con descuento de marca aplicado (¢/litro). */
  function finalPrice(st, fuelId) {
    const base = st.prices[fuelId];
    if (base == null) return null;
    const d = brandMeta(st.brand).discount || 0;
    return Math.round((base - d / 100) * 1000) / 1000;
  }
  const rawPrice = (st, fuelId) => st.prices[fuelId];

  /** Serie de precios de los últimos `days` días (último = hoy), dd-mm-aaaa. */
  function series(st, fuelId, days = 14) {
    const price = st.prices[fuelId] ?? st.prices.diesel ?? st.prices.g95;
    if (price == null) return [];
    const rnd = mulberry32(hashStr(st.id + '|' + fuelId));
    const drift = (rnd() - 0.42) * 0.010;            // tendencia suave del periodo
    const vol = 0.0016 + rnd() * 0.0022;             // volatilidad diaria
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const out = [];
    // hacia atrás desde hoy y luego se invierte: la serie acaba en el precio actual
    for (let i = 0; i < days; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const t = i / Math.max(1, days - 1);
      const weekend = [0, 6].includes(d.getDay()) ? 1 : 0;
      const wave = Math.sin(t * Math.PI * 2.2 + st.index) * 0.004;
      let v = price - drift * t + (rnd() - 0.5) * vol * 2 + wave + weekend * vol * 0.7;
      v = Math.round(v * 1000) / 1000;
      out.push({ date: ddmmyyyy(d), dow: d.getDay(), price: v });
    }
    const s = out.reverse();
    s[s.length - 1].price = price;                    // el último punto es el precio en vivo
    if (s.length > 1) s[s.length - 1].live = true;
    return s;
  }

  /** Resumen estadístico de una serie. */
  function seriesStats(s) {
    if (!s || !s.length) return null;
    const vals = s.map(x => x.price);
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const first = vals[0], last = vals[vals.length - 1];
    return {
      min, max, avg, first, last,
      minDate: s[vals.indexOf(min)].date, maxDate: s[vals.indexOf(max)].date,
      diff: last - first, diffPct: (last - first) / first * 100,
      days: s.length,
    };
  }

  /* --- 5. Estadísticas de una lista ------------------------------------ */
  const byKey = {
    price: (st, f) => finalPrice(st, f) ?? Infinity,
    raw: (st, f) => rawPrice(st, f) ?? Infinity,
    priceRaw: (st, f) => rawPrice(st, f) ?? Infinity,
    distance: (st) => kmFromUser(st),
    brand: (st) => st.brand,
    locality: (st) => st.city,
    updated: (st) => st.updatedMin,
    rating: (st) => -st.rating,
    saving: (st, f) => -(brandMeta(st.brand).discount || 0),
  };

  function sortStations(list, key, dir = 'asc', fuel = 'g95') {
    const get = byKey[key] || byKey.price;
    const cmp = (a, b) => {
      const va = get(a, fuel), vb = get(b, fuel);
      if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es');
      return dir === 'asc' ? va - vb : vb - va;
    };
    return list.slice().sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name, 'es'));
  }

  function pricesOf(list, fuel) { return list.map(s => finalPrice(s, fuel)).filter(v => v != null); }
  function percentile(sorted, p) {
    if (!sorted.length) return null;
    const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }
  function stats(list, fuel = 'g95') {
    const v = pricesOf(list, fuel).sort((a, b) => a - b);
    if (!v.length) return null;
    const p25 = percentile(v, 0.25), p75 = percentile(v, 0.75);
    return {
      count: list.length, fuelsCount: v.length,
      min: v[0], max: v[v.length - 1], avg: v.reduce((a, b) => a + b, 0) / v.length,
      median: percentile(v, 0.5), p25, p75, lo: p25, hi: p75,
      savings70: (v.reduce((a, b) => a + b, 0) / v.length - v[0]) * 70,
      spread: v[v.length - 1] - v[0],
    };
  }
  const level = (v, lo, hi) => v == null ? 'hi' : v <= lo ? 'lo' : v <= hi ? 'mid' : 'hi';
  const levelHex = (lvl) => lvl === 'lo' ? 'var(--lo)' : lvl === 'mid' ? 'var(--mid)' : 'var(--hi)';

  /** Marcas presentes en una lista (para el filtro de marca). */
  const brandsOf = (list) => [...new Set(list.map(s => s.brand))].sort((a, b) => a.localeCompare(b, 'es'));

  function filterStations(list, f = {}) {
    let out = list.slice();
    if (f.province) out = out.filter(s => s.province === f.province);
    if (f.locality) out = out.filter(s => s.city === f.locality);
    if (f.fuel) out = out.filter(s => finalPrice(s, f.fuel) != null);
    if (f.brands && f.brands.length) out = out.filter(s => f.brands.includes(s.brand));
    if (f.maxKm) out = out.filter(s => kmFromUser(s) <= f.maxKm);
    if (f.favoritesOnly) out = out.filter(s => s.fav);
    if (f.cheapOnly) out = out.filter(s => (brandMeta(s.brand).discount || 0) > 0);
    if (f.q) {
      const q = f.q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      out = out.filter(s => [s.name, s.brand, s.city, s.address, s.area].join(' ')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    }
    return out;
  }
  const provinceNameOf = (st) => st.province;

  /* --- 6. Ahorro y comparaciones --------------------------------------- */
  function savingVsAvg(st, list, fuel = 'g95', liters = 50) {
    const s = stats(list, fuel); if (!s) return 0;
    return Math.max(0, (s.avg - (finalPrice(st, fuel) ?? s.avg)) * liters);
  }
  function nearestStations(list, n = 6) {
    return sortStations(list, 'distance', 'asc').slice(0, n);
  }
  /** Estaciones "favoritas del usuario" de partida. */
  const favorites = () => STATIONS.filter(s => s.fav);

  /* --- 7. Guion del copiloto IA (v5) ---------------------------------- */
  const AI = {
    provider: 'gemini-3.8-flash',
    providers: [
      { id: 'general', label: 'General', ok: true },
      { id: 'groq', label: 'Groq', ok: true },
      { id: 'mistral', label: 'Mistral', ok: true },
      { id: 'google', label: 'Gemini', ok: true },
      { id: 'llm7', label: 'LLM7.io', ok: true },
      { id: 'nvidia', label: 'NVIDIA', ok: false },
    ],
    prompts: [
      '¿Dónde reposto más barato cerca?',
      '¿Sube o baja el diésel?',
      'Compárame Repsol y Ballenoil',
      '¿Me compensa el desvío?',
      'Resumen de precios en Madrid',
    ],
    answer: {
      title: 'Te compensa repostar en Las Tablas',
      text: [
        '**Ballenoil Las Tablas** está a **1,499 €/L** (1,399 €/L en diésel): la más barata de las 12 estaciones que tengo cargadas en Madrid.',
        '',
        '- Ahorro frente a la media de Madrid (1,592 €/L): **4,65 € por depósito de 50 L**',
        '- Frente a tu Repsol de Chamberí: **8,65 € por depósito**',
        '- Desvío: 6,2 km · ~9 min en coche',
        '',
        '> La diferencia de precio lleva 6 días seguidos bajando, así que si puedes esperar al viernes, probablemente la pilles aún mejor.',
      ].join('\n'),
      meta: { model: 'gemini-3.8-flash', ms: 1180, historyDays: 14, stations: 4 },
      citations: ['28-09114', '28-04512', '28-03317', '28-07655'],
      chart: '28-09114',
    },
    alt: {
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      text: 'Coincido: **Ballenoil Las Tablas** (1,499 €/L) es la mejor opción. Si priorizas no desviarte, **Galp Alcalá 45** a 1,639 €/L está a 1,4 km y sigue siendo 3 cts más barata que tu Repsol habitual.',
    },
  };

  /* --- 8. Log de actividad de ejemplo (para Config) -------------------- */
  const API_LOG = [
    ['14:32:08', 'GET provincias', '200', '182 ms'],
    ['14:32:09', 'GET EstacionesTerrestres/Madrid', '200', '1.284 ms'],
    ['14:32:11', 'GET histórico 12-10-2026', '200', '642 ms'],
    ['14:32:11', 'GET histórico 13-10-2026', '200', '588 ms'],
    ['14:32:12', 'GET histórico 14-10-2026', '200', '701 ms'],
    ['14:32:14', 'GET EstacionesTerrestres/Zaragoza', '200', '964 ms'],
    ['14:35:40', 'GET histórico 15-10-2026', '304', '96 ms'],
    ['14:41:02', 'GET EstacionesTerrestres/Madrid', '200', '1.110 ms'],
  ].map(r => ({ time: r[0], method: r[1], status: r[2], ms: r[3] }));
  const PUSH_LOG = [
    ['16/10/26 09:12:44', '🔄 checkPrices: 3 favoritos, 1 provincia'],
    ['16/10/26 09:12:47', '📉 Repsol Chamberí: 1,552 € (bajó 2,0 ¢ en 3 días)'],
    ['16/10/26 09:12:47', '🔔 Notificación enviada'],
    ['16/10/26 08:02:10', '🔄 checkPrices: sin cambios'],
  ].map(r => ({ time: r[0], text: r[1] }));

  return {
    USER, FUELS, PROVINCES, BRANDS, STATIONS, AI, API_LOG, PUSH_LOG,
    fuelName, fuelShort, brandMeta, favorites,
    finalPrice, rawPrice, series, seriesStats, sortStations, stats, percentile, level, levelHex,
    brandsOf, filterStations, savingVsAvg, nearestStations,
    kmFromUser, driveMin, haversine,
    eur, eur2, cents, money, pct, dist, since,
    ddmmyyyy, ddsmm, dayName, pad,
    provinceNameOf,
  };
})();

/* =============================================================
   Datos fake deterministas para los prototipos de rediseño.
   Sin dependencias externas. Expone window.PETROL.
   No es la app real: son datos inventados pero coherentes con
   precios de gasolineras en España (2026).
   ============================================================= */
(function () {
  'use strict';

  // --- Generador pseudoaleatorio con semilla (determinista) ---
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // --- Combustibles (mismos que la app real) ---
  const COMBUSTIBLES = [
    { id: 'g95', nombre: 'Gasolina 95 E5', corto: 'G95', grupo: 'Gasolina', activo: true },
    { id: 'g98', nombre: 'Gasolina 98 E5', corto: 'G98', grupo: 'Gasolina', activo: true },
    { id: 'da',  nombre: 'Gasóleo A', corto: 'GA', grupo: 'Gasóleo', activo: true },
    { id: 'dp',  nombre: 'Gasóleo Premium', corto: 'GP', grupo: 'Gasóleo', activo: false },
    { id: 'e10', nombre: 'Gasolina 95 E10', corto: 'E10', grupo: 'Gasolina', activo: false },
    { id: 'glp', nombre: 'GLP', corto: 'GLP', grupo: 'Otros', activo: false },
    { id: 'adblue', nombre: 'AdBlue', corto: 'AdB', grupo: 'Otros', activo: false }
  ];

  const PROVINCIAS = [
    { id: '28', nombre: 'Madrid', estaciones: 1287 },
    { id: '08', nombre: 'Barcelona', estaciones: 1764 },
    { id: '46', nombre: 'Valencia', estaciones: 1213 },
    { id: '41', nombre: 'Sevilla', estaciones: 942 },
    { id: '48', nombre: 'Bizkaia', estaciones: 604 },
    { id: '29', nombre: 'Málaga', estaciones: 781 },
    { id: '50', nombre: 'Zaragoza', estaciones: 658 },
    { id: '33', nombre: 'Asturias', estaciones: 431 }
  ];

  const MARCAS = [
    { id: 'repsol', nombre: 'Repsol', color: '#ff6b00' },
    { id: 'cepsa', nombre: 'Cepsa', color: '#0057b8' },
    { id: 'bp', nombre: 'BP', color: '#009b3a' },
    { id: 'shell', nombre: 'Shell', color: '#d5232b' },
    { id: 'petronor', nombre: 'Petronor', color: '#00a19a' },
    { id: 'avia', nombre: 'Avia', color: '#7a1f2b' },
    { id: 'petrocat', nombre: 'Petrocat', color: '#e03c31' },
    { id: 'leclerc', nombre: 'E.Leclerc', color: '#004a99' },
    { id: 'carrefour', nombre: 'Carrefour', color: '#004e9f' },
    { id: 'mussol', nombre: 'MUSSOL', color: '#c8102e' }
  ];

  // --- Estaciones de la provincia de Madrid ---
  // x,y en % sobre el área del mapa fake. dist en km. servicios simulados.
  const ESTACIONES = [
    {
      id: '4821', marca: 'repsol', rotulo: 'Repsol', dir: 'Av. de América, 40',
      loc: 'Madrid', cp: '28002', dist: 0.8, x: 52, y: 44, horario: '24 h',
      servicios: ['24h', 'autoservicio', 'lavado', 'aire'],
      precios: { g95: 1.489, g98: 1.625, da: 1.395, dp: 1.545, e10: 1.479, glp: 0.859, adblue: 1.29 }
    },
    {
      id: '1043', marca: 'cepsa', rotulo: 'Cepsa', dir: 'C/ Bravo Murillo, 120',
      loc: 'Madrid', cp: '28020', dist: 1.2, x: 41, y: 30, horario: '06:00–22:00',
      servicios: ['autoservicio', 'tienda'],
      precios: { g95: 1.512, g98: 1.649, da: 1.412, dp: 1.559, e10: 1.502, glp: 0.875 }
    },
    {
      id: '2287', marca: 'bp', rotulo: 'BP', dir: 'Pº de la Castellana, 200',
      loc: 'Madrid', cp: '28046', dist: 1.9, x: 47, y: 22, horario: '24 h',
      servicios: ['24h', 'cajero', 'tienda', 'lavado'],
      precios: { g95: 1.539, g98: 1.665, da: 1.439, dp: 1.572, e10: 1.529, adblue: 1.32 }
    },
    {
      id: '3390', marca: 'shell', rotulo: 'Shell', dir: 'Av. Felipe II, 12',
      loc: 'Madrid', cp: '28009', dist: 2.3, x: 61, y: 40, horario: '24 h',
      servicios: ['24h', 'autoservicio', 'cajero'],
      precios: { g95: 1.505, g98: 1.638, da: 1.402, dp: 1.551, e10: 1.495, glp: 0.869 }
    },
    {
      id: '5512', marca: 'petronor', rotulo: 'Petronor', dir: 'C/ Alcalá, 480',
      loc: 'Madrid', cp: '28027', dist: 2.8, x: 68, y: 47, horario: '24 h',
      servicios: ['24h', 'autoservicio', 'lavado', 'tienda'],
      precios: { g95: 1.475, g98: 1.612, da: 1.385, dp: 1.532, e10: 1.465, adblue: 1.27 }
    },
    {
      id: '6634', marca: 'avia', rotulo: 'Avia', dir: 'Av. Ciudad de Barcelona, 88',
      loc: 'Madrid', cp: '28007', dist: 3.4, x: 57, y: 62, horario: '07:00–21:00',
      servicios: ['autoservicio'],
      precios: { g95: 1.468, g98: 1.605, da: 1.378, dp: 1.525, e10: 1.458 }
    },
    {
      id: '7745', marca: 'petrocat', rotulo: 'Petrocat', dir: 'C/ Santa Engracia, 95',
      loc: 'Madrid', cp: '28010', dist: 1.6, x: 44, y: 26, horario: '24 h',
      servicios: ['24h', 'cajero'],
      precios: { g95: 1.522, g98: 1.652, da: 1.425, dp: 1.562, e10: 1.512 }
    },
    {
      id: '8856', marca: 'repsol', rotulo: 'Repsol', dir: 'Av. Juan Carlos I, 8',
      loc: 'Getafe', cp: '28903', dist: 6.2, x: 50, y: 78, horario: '24 h',
      servicios: ['24h', 'autoservicio', 'lavado', 'tienda', 'cajero'],
      precios: { g95: 1.459, g98: 1.598, da: 1.369, dp: 1.518, e10: 1.449, glp: 0.849, adblue: 1.25 }
    },
    {
      id: '9967', marca: 'cepsa', rotulo: 'Cepsa', dir: 'C/ Mayor, 61',
      loc: 'Alcalá de Henares', cp: '28801', dist: 7.5, x: 78, y: 52, horario: '24 h',
      servicios: ['24h', 'autoservicio', 'tienda'],
      precios: { g95: 1.449, g98: 1.589, da: 1.362, dp: 1.509, e10: 1.439, adblue: 1.24 }
    },
    {
      id: '1188', marca: 'leclerc', rotulo: 'E.Leclerc', dir: 'Av. M-501, km 4',
      loc: 'Las Rozas', cp: '28232', dist: 9.1, x: 20, y: 34, horario: '08:00–21:00',
      servicios: ['autoservicio', 'tienda', 'lavado'],
      precios: { g95: 1.439, g98: 1.579, da: 1.355, dp: 1.499, e10: 1.429, glp: 0.839 }
    },
    {
      id: '1299', marca: 'carrefour', rotulo: 'Carrefour', dir: 'Av. de los Pinares, 15',
      loc: 'Pozuelo de Alarcón', cp: '28224', dist: 8.3, x: 25, y: 46, horario: '08:00–22:00',
      servicios: ['autoservicio', 'tienda', 'cajero'],
      precios: { g95: 1.442, g98: 1.582, da: 1.358, dp: 1.502, e10: 1.432 }
    },
    {
      id: '1310', marca: 'mussol', rotulo: 'MUSSOL', dir: 'M-30, P.K. 12',
      loc: 'Madrid', cp: '28023', dist: 2.1, x: 38, y: 44, horario: '24 h',
      servicios: ['24h', 'cajero', 'lavado'],
      precios: { g95: 1.535, g98: 1.658, da: 1.432, dp: 1.568, e10: 1.525 }
    },
    {
      id: '1421', marca: 'bp', rotulo: 'BP', dir: 'Ctra. de Extremadura, km 18',
      loc: 'Villaviciosa de Odón', cp: '28670', dist: 12.0, x: 12, y: 66, horario: '24 h',
      servicios: ['24h', 'autoservicio', 'tienda'],
      precios: { g95: 1.455, g98: 1.592, da: 1.371, dp: 1.512, e10: 1.445, adblue: 1.26 }
    },
    {
      id: '1532', marca: 'shell', rotulo: 'Shell', dir: 'Av. de Europa, 3',
      loc: 'San Sebastián de los Reyes', cp: '28700', dist: 14.0, x: 55, y: 10, horario: '24 h',
      servicios: ['24h', 'autoservicio', 'lavado', 'cajero', 'tienda'],
      precios: { g95: 1.462, g98: 1.595, da: 1.374, dp: 1.515, e10: 1.452, glp: 0.852 }
    }
  ];

  // Favoritas simuladas (como en IndexedDB de la app real)
  const FAVORITAS = ['5512', '9967', '1188'];

  // --- Histórico fake de 30 días por estación y combustible ---
  // Genera una serie determinista que termina en el precio actual de la estación.
  function historico(est, combustible) {
    const precioActual = est.precios[combustible];
    if (precioActual == null) return [];
    const seed = parseInt(est.id, 10) * 7 + combustible.length * 13;
    const rand = rng(seed);
    const dias = 30;
    const serie = [];
    // deriva aleatoria suave hacia atrás desde el precio actual
    let p = precioActual;
    const hoy = new Date(2026, 9, 16); // 16-10-2026
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      if (i !== 0) {
        // oscilación + ligera tendencia a la baja reciente (para mostrar "bajando")
        const paso = (rand() - 0.5) * 0.028 - 0.0012;
        p = Math.max(1.20, Math.min(1.85, p + paso));
      }
      serie.push({
        fecha: d,
        fechaTxt: String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear(),
        precio: i === 0 ? precioActual : Math.round(p * 1000) / 1000
      });
    }
    return serie;
  }

  // Serie media provincial (para gráficas de contexto)
  function mediaProvincial() {
    const rand = rng(9182);
    const serie = [];
    let p = 1.482;
    const hoy = new Date(2026, 9, 16);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      if (i !== 0) p = Math.max(1.3, Math.min(1.7, p + (rand() - 0.5) * 0.012 - 0.0006));
      serie.push({
        fecha: d,
        fechaTxt: String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear(),
        precio: i === 0 ? 1.468 : Math.round(p * 1000) / 1000
      });
    }
    return serie;
  }

  // --- KPIs rápidos (precio medio, min/max, variación 7 días) ---
  function kpis(combustible) {
    const key = combustible || 'g95';
    const vals = ESTACIONES.map(e => e.precios[key]).filter(v => v != null);
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const minEst = ESTACIONES.find(e => e.precios[key] === min);
    // variación 7 días de la media
    const serie = mediaProvincial();
    const mediaHoy = serie[serie.length - 1].precio;
    const mediaHace7 = serie[serie.length - 8].precio;
    const var7 = Math.round((mediaHoy - mediaHace7) * 1000) / 1000;
    return {
      media: Math.round(media * 1000) / 1000,
      min, max, minEst,
      var7,
      var7pct: Math.round((var7 / mediaHace7) * 10000) / 100,
      nEstaciones: vals.length,
      tendencia: var7 < -0.004 ? 'bajando' : (var7 > 0.004 ? 'subiendo' : 'estable')
    };
  }

  // --- Log fake de actividad (API / Push) ---
  const LOG_API = [
    { hora: '16/10 09:42:10', desc: 'API Ministerio · prov_28', ms: 312, estado: 'ok' },
    { hora: '16/10 09:41:58', desc: 'Histórico 14d · prov_28', ms: 890, estado: 'ok' },
    { hora: '16/10 08:05:33', desc: 'API Ministerio · prov_08', ms: 421, estado: 'ok' },
    { hora: '16/10 07:12:04', desc: 'API Ministerio · prov_28', ms: 305, estado: 'ok' },
    { hora: '16/10 02:00:11', desc: 'SW checkPrices · 3 favs', ms: 1540, estado: 'ok' },
    { hora: '15/10 22:47:29', desc: 'API Ministerio · prov_28', ms: 1203, estado: 'fallo' }
  ];
  const LOG_PUSH = [
    { hora: '16/10 08:05:40', desc: 'Precio bajó en Cepsa Alcalá (−2,1 ¢)', estado: 'ok' },
    { hora: '16/10 02:00:15', desc: 'Chequeo periódico · 3 favoritas', estado: 'ok' },
    { hora: '15/10 18:22:01', desc: 'Precio subió en Petronor Alcalá (+1,4 ¢)', estado: 'ok' },
    { hora: '15/10 10:01:44', desc: 'Suscripción renovada', estado: 'info' }
  ];

  // --- Chat IA fake ---
  const CHAT_FAKE = [
    { rol: 'user', txt: '¿Dónde está la gasolina 95 más barata cerca de mí?' },
    {
      rol: 'ia', txt: 'La **más barata** en tu zona es:\n\n' +
        '1. **E.Leclerc (Las Rozas)** — 1,439 €/L (Av. M-501, km 4)\n' +
        '2. **Carrefour (Pozuelo)** — 1,442 €/L\n' +
        '3. **Cepsa (Alcalá de Henares)** — 1,449 €/L\n\n' +
        'Son las 3 únicas por debajo de 1,45 €. Si priorizas cercanía, **Repsol Av. de América** (1,489 €) está a solo 0,8 km.',
      meta: '⏱ qwen3.8-27b · 1,2 s'
    },
    { rol: 'user', txt: '¿Cómo ha evolucionado el precio este mes?' },
    {
      rol: 'ia', txt: 'La media provincial ha bajado **3,2 ¢/L** en 30 días (de 1,500 a 1,468 €).\n\n' +
        'La tendencia es **bajista desde hace 6 días**, así que si no te urge repostar, esperar 2–3 días puede salirte más barato.',
      meta: '⏱ codestral-latest · 2,0 s'
    }
  ];

  window.PETROL = {
    COMBUSTIBLES, PROVINCIAS, MARCAS, ESTACIONES, FAVORITAS,
    LOG_API, LOG_PUSH, CHAT_FAKE,
    historico, mediaProvincial, kpis,
    marcador: function (id) { return MARCAS.find(m => m.id === id) || { nombre: id, color: '#888' }; },
    estacion: function (id) { return ESTACIONES.find(e => e.id === id); }
  };
})();

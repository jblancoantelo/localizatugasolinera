// ============================================================================
// DATOS FAKE — Prototipos de diseño Gasolineras
// Datos inventados para validar interfaz y navegación. NO son datos reales.
// ============================================================================

const PROVINCIAS = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza'];

const MARCAS = ['Repsol', 'Cepsa', 'BP', 'Shell', 'Galp', 'Disa', 'BonÀrea',
  'Carrefour', 'Alcampo', 'Low Cost', 'Ballenoil', 'Petrocat'];

const COMBUSTIBLES = [
  { clave: 'Precio Gasolina 95 E5', nombre: 'Gasolina 95 E5', unidad: '€/L', color: '#2e7d32' },
  { clave: 'Precio Gasolina 98 E5', nombre: 'Gasolina 98 E5', unidad: '€/L', color: '#1565c0' },
  { clave: 'Precio Gasoleo A', nombre: 'Gasóleo A', unidad: '€/L', color: '#c62828' },
  { clave: 'Precio Gasoleo Premium', nombre: 'Gasóleo Premium', unidad: '€/L', color: '#f9a825' },
  { clave: 'Precio Gases licuados del petróleo', nombre: 'GLP', unidad: '€/L', color: '#7b1fa2' },
];

function aleatorio(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 1000) / 1000;
}

function fechaDDMMYYYY(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aaaa = d.getFullYear();
  return `${dd}-${mm}-${aaaa}`;
}

// Centros aproximados de las provincias (lat, lng)
const CENTROS = {
  Madrid: [40.4168, -3.7038],
  Barcelona: [41.3851, 2.1734],
  Valencia: [39.4699, -0.3763],
  Sevilla: [37.3891, -5.9845],
  Zaragoza: [41.6561, -0.8773],
};

function jitter(coord, rango) {
  return coord + (Math.random() * 2 - 1) * rango;
}

// Genera ~30 estaciones con precios realistas e histórico de 14 días
const ESTACIONES = (function construir() {
  const ests = [];
  let id = 2001;
  const indiceProv = {};

  PROVINCIAS.forEach((prov, pi) => {
    const [clat, clng] = CENTROS[prov];
    const n = prov === 'Madrid' ? 8 : prov === 'Barcelona' ? 7 : 4;
    indiceProv[prov] = [];

    for (let i = 0; i < n; i++) {
      const marca = MARCAS[(id + i) % MARCAS.length];
      const lat = jitter(clat, 0.12);
      const lng = jitter(clng, 0.12);
      const ahora = new Date();
      const historico = [];
      let precioBase = {
        'Precio Gasolina 95 E5': aleatorio(1.480, 1.620),
        'Precio Gasolina 98 E5': aleatorio(1.620, 1.780),
        'Precio Gasoleo A': aleatorio(1.390, 1.520),
        'Precio Gasoleo Premium': aleatorio(1.470, 1.610),
        'Precio Gases licuados del petróleo': aleatorio(0.840, 0.950),
      };

      // Histórico de 14 días con leve deriva
      for (let d = 13; d >= 0; d--) {
        const fecha = new Date();
        fecha.setDate(ahora.getDate() - d);
        const fila = { fecha: fechaDDMMYYYY(fecha), precios: {} };
        COMBUSTIBLES.forEach((c) => {
          const variacion = aleatorio(-0.015, 0.015);
          const p = Math.max(0.5, precioBase[c.clave] + variacion);
          fila.precios[c.clave] = Math.round(p * 1000) / 1000;
        });
        historico.push(fila);
      }

      const estacion = {
        IDEESS: String(id),
        Rótulo: marca,
        Provincia: prov,
        Localidad: prov === 'Madrid' ? 'Madrid' : prov,
        'Dirección': `Calle ${['Mayor','Alcalá','Gran Vía','Princesa','Diagonal','Paseo de Gracia','Rambla','Aragón','Valencia','Méndez Álvaro'][i % 10]}, ${aleatorio(1, 200)}`,
        Latitud: lat,
        'Longitud (WGS84)': lng,
        CP: String(Math.floor(aleatorio(28000, 28099))),
        Horario: Math.random() > 0.2 ? '07:00–22:00' : '24h',
        servicios: ['Cajero', 'Lavado', 'Tienda'][Math.floor(Math.random() * 3)],
        'Precio Gasolina 95 E5': precioBase['Precio Gasolina 95 E5'],
        'Precio Gasolina 98 E5': precioBase['Precio Gasolina 98 E5'],
        'Precio Gasoleo A': precioBase['Precio Gasoleo A'],
        'Precio Gasoleo Premium': precioBase['Precio Gasoleo Premium'],
        'Precio Gases licuados del petróleo': precioBase['Precio Gases licuados del petróleo'],
        'Precio Adblue': Math.random() > 0.7 ? aleatorio(0.70, 0.95) : null,
        'Precio Gasolina 95 E10': null,
        'Precio Gasolina 98 E10': null,
        'Precio Hidrogeno': null,
        historico,
      };
      ests.push(estacion);
      indiceProv[prov].push(estacion);
      id++;
    }
  });

  return ests;
})();

// Precio actual de una estación para un combustible (último punto del histórico = "en vivo")
function precioActual(estacion, clave) {
  return estacion[clave] !== null ? estacion[clave] : null;
}

// Todas las marcas únicas
const MARCAS_UNICAS = [...new Set(ESTACIONES.map(e => e.Rótulo))].sort();

window.DATOS_FAKE = {
  PROVINCIAS,
  MARCAS,
  MARCAS_UNICAS,
  COMBUSTIBLES,
  ESTACIONES,
  fechaDDMMYYYY,
  precioActual,
};

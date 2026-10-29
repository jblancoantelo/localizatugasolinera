// ============================================================================
// DATOS FAKE — Prototipos de diseño Gasolineras (nemotron-3.5-super-vl-120b)
// Datos inventados para validar interfaz y navegación. NO son datos reales.
// ============================================================================

const PROVINCIAS = [
  { id: 'madrid', nombre: 'Madrid', centro: [40.4168, -3.7038], n: 10 },
  { id: 'barcelona', nombre: 'Barcelona', centro: [41.3851, 2.1734], n: 9 },
  { id: 'valencia', nombre: 'Valencia', centro: [39.4699, -0.3763], n: 6 },
  { id: 'sevilla', nombre: 'Sevilla', centro: [37.3891, -5.9845], n: 5 },
  { id: 'zaragoza', nombre: 'Zaragoza', centro: [41.6561, -0.8773], n: 5 },
  { id: 'malaga', nombre: 'Málaga', centro: [36.7213, -4.4214], n: 5 },
];

const MARCAS = [
  { nombre: 'Repsol', descuento: 0.03, color: '#ff3b30' },
  { nombre: 'Cepsa', descuento: 0.02, color: '#007aff' },
  { nombre: 'BP', descuento: 0.01, color: '#32dc72' },
  { nombre: 'Shell', descuento: 0.025, color: '#ff9500' },
  { nombre: 'Galp', descuento: 0.015, color: '#af52de' },
  { nombre: 'Disa', descuento: 0.0, color: '#5ac8fa' },
  { nombre: 'BonÀrea', descuento: 0.04, color: '#ffcc00' },
  { nombre: 'Carrefour', descuento: 0.05, color: '#0072ce' },
  { nombre: 'Alcampo', descuento: 0.045, color: '#00a651' },
  { nombre: 'Low Cost', descuento: 0.06, color: '#fd2d3d' },
  { nombre: 'Ballenoil', descuento: 0.055, color: '#1e1e1e' },
  { nombre: 'Petrocat', descuento: 0.02, color: '#ff7f00' },
];

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

function jitter(coord, rango) {
  return coord + (Math.random() * 2 - 1) * rango;
}

function normalizeStr(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const ESTACIONES = (function construir() {
  const ests = [];
  let id = 4001;
  const DIRECCIONES = [
    'Av. de la Constitución, 45', 'Calle Mayor, 12', 'Paseo de la Castellana, 200',
    'Carrer de Mallorca, 300', 'Av. Cortes Valencianas, 18', 'Calle San Fernando, 7',
    'Av. de la Paz, 55', 'Calle José Ortega y Gasset, 90', 'Polígono Industrial Los Llanos, nave 8',
    'Av. de América, 110', 'Calle Alfonso XII, 33', 'Glorieta de Carlos V, 5',
    'Calle Sierpes, 21', 'Av. de la Innovación, 6', 'Calle Alfonso I, 44',
    'Ronda de la Universitat, 12', 'Calle del Carmen, 8', 'Av. de la Constitución, 200'
  ];
  const HORARIOS = ['07:00–22:00', '08:00–21:00', '24 horas', '07:30–20:30', '08:00–22:00', '07:00–23:00'];
  const SERVICIOS = ['Tarjeta · Efectivo · Lavado', 'Tarjeta · Efectivo', '24h · Lavado · Cafetería', 'Tarjeta · Carga eléctrica'];

  PROVINCIAS.forEach((prov) => {
    const [clat, clng] = prov.centro;
    for (let i = 0; i < prov.n; i++) {
      const marcaObj = MARCAS[(id + i) % MARCAS.length];
      const marca = marcaObj.nombre;
      const lat = jitter(clat, 0.10);
      const lng = jitter(clng, 0.10);
      const ahora = new Date();
      const direccion = DIRECCIONES[(id + i) % DIRECCIONES.length];
      const localidad = prov.nombre;
      const base = {};
      COMBUSTIBLES.forEach((c) => {
        base[c.clave] = aleatorio(1.400, 1.700);
      });
      const historico = [];
      for (let d = 29; d >= 0; d--) {
        const fecha = new Date();
        fecha.setDate(ahora.getDate() - d);
        const fila = { fecha: fechaDDMMYYYY(fecha), precios: {} };
        COMBUSTIBLES.forEach((c) => {
          const variacion = aleatorio(-0.012, 0.012);
          const p = Math.max(0.5, base[c.clave] + variacion);
          fila.precios[c.clave] = Math.round(p * 1000) / 1000;
        });
        historico.push(fila);
      }
      const preciosActuales = {};
      COMBUSTIBLES.forEach((c) => {
        preciosActuales[c.clave] = historico[0].precios[c.clave];
      });
      const distancia = aleatorio(0.2, 12.0);
      ests.push({
        id: id++,
        ideess: String(8000000 + id),
        nombre: `${marca} ${localidad}`,
        marca,
        provincia: prov.nombre,
        provinciaId: prov.id,
        localidad,
        direccion,
        lat,
        lng,
        precios: preciosActuales,
        historico,
        distancia: Math.round(distancia * 10) / 10,
        descuento: marcaObj.descuento,
        horario: HORARIOS[(id + i) % HORARIOS.length],
        servicios: SERVICIOS[(id + i) % SERVICIOS.length],
        favorito: id % 7 === 0,
        actualizado: fechaDDMMYYYY(ahora),
      });
    }
  });

  PROVINCIAS.forEach((prov) => {
    const deProv = ests.filter((e) => e.provinciaId === prov.id);
    if (deProv.length === 0) return;
    const mejor = deProv.reduce((a, b) =>
      (a.precios['Precio Gasolina 95 E5'] || 99) < (b.precios['Precio Gasolina 95 E5'] || 99) ? a : b
    );
    mejor.esMejor = true;
  });

  return ests;
})();

ESTACIONES.porProvincia = function (provId) {
  return this.filter((e) => e.provinciaId === provId);
};

function precioConDescuento(estacion, clave) {
  const p = estacion.precios[clave];
  const d = estacion.descuento || 0;
  return Math.round((p - d / 100) * 1000) / 1000;
}

function colorPrecio(precio) {
  if (precio <= 1.45) return '#2e7d32';
  if (precio <= 1.60) return '#f57c00';
  return '#c62828';
}

function formatearPrecio(p) {
  return String(Math.round(p * 1000) / 1000).replace('.', ',');
}

function formatearDistancia(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
}

function filtrarEstaciones(lista, { provincia, combustible, marca, buscar, soloFavoritos }) {
  return lista.filter((e) => {
    if (provincia && e.provinciaId !== provincia) return false;
    if (marca && e.marca !== marca) return false;
    if (soloFavoritos && !e.favorito) return false;
    if (buscar) {
      const b = normalizeStr(buscar);
      const hay =
        normalizeStr(e.nombre).includes(b) ||
        normalizeStr(e.localidad).includes(b) ||
        normalizeStr(e.direccion).includes(b) ||
        normalizeStr(e.marca).includes(b);
      if (!hay) return false;
    }
    return true;
  });
}

function ordenarEstaciones(lista, por, asc) {
  return [...lista].sort((a, b) => {
    let va, vb;
    if (por === 'precio') {
      va = a.precios['Precio Gasolina 95 E5'] || 0;
      vb = b.precios['Precio Gasolina 95 E5'] || 0;
    } else if (por === 'distancia') {
      va = a.distancia || 0;
      vb = b.distancia || 0;
    } else if (por === 'marca') {
      va = a.marca;
      vb = b.marca;
    } else {
      va = a.nombre;
      vb = b.nombre;
    }
    if (typeof va === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return asc ? va - vb : vb - va;
  });
}

function historicoParaGrafica(estacion, clave) {
  return estacion.historico.map((f) => ({ fecha: f.fecha, precio: f.precios[clave] }));
}

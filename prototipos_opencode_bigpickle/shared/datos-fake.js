/* =============================================================================
 * Datos fake compartidos — prototipos de rediseño (Big_pickle)
 * =============================================================================
 * Script clásico (sin módulos) para que funcione abriendo los HTML por file://.
 * Cada prototipo carga esto con <script src="../shared/datos-fake.js"></script>
 * y lee window.FAKE. No editar sin avisar: lo consumen los 6 prototipos.
 *
 * Contenido:
 *   FAKE.hoy                 fecha de referencia 'dd-mm-aaaa'
 *   FAKE.provincias          [{ id, nombre }]
 *   FAKE.combustibles        nombres de combustible (mismos que la app real)
 *   FAKE.grupos              grupos Gasolina/Gasóleo (como FUEL_GROUPS real)
 *   FAKE.marcas              marcas disponibles
 *   FAKE.estaciones[]        estaciones con precios por combustible
 *   FAKE.mapa                fondo/posiciones del mapa fake (mx/my en %)
 *   FAKE.historico(id, fuel, dias)  serie [{ fecha, precio }] más reciente al final
 *   FAKE.chatsIA             conversaciones de ejemplo por pestaña
 *   FAKE.logApi / FAKE.logPush       registros de actividad
 *   FAKE.prompts             prompts rápidos de la pestaña General
 *   FAKE.config              valores por defecto de Config
 *   FAKE.descuentos          descuentos por marca de ejemplo
 *   helpers: provinciaNombre, localidadesDe, estacionesDe, marcasDe,
 *            precioDe, precioConDescuento, colorPrecio, mediaProvincia
 * ========================================================================== */

(function () {
  'use strict';

  var FAKE = {};

  FAKE.hoy = '16-10-2026';
  FAKE.hoyCorto = '16/10/26';

  /* --- Geografía (ids como los del Geoportal) ---------------------------- */
  FAKE.provincias = [
    { id: '28', nombre: 'Madrid' },
    { id: '08', nombre: 'Barcelona' },
    { id: '46', nombre: 'Valencia' },
    { id: '41', nombre: 'Sevilla' },
    { id: '03', nombre: 'Alicante' },
    { id: '29', nombre: 'Málaga' },
    { id: '48', nombre: 'Bizkaia' },
    { id: '20', nombre: 'Gipuzkoa' },
    { id: '33', nombre: 'Asturias' },
    { id: '50', nombre: 'Zaragoza' },
    { id: '30', nombre: 'Murcia' },
    { id: '11', nombre: 'Cádiz' },
    { id: '36', nombre: 'Pontevedra' },
    { id: '18', nombre: 'Granada' },
    { id: '47', nombre: 'Valladolid' },
    { id: '15', nombre: 'A Coruña' }
  ];

  /* --- Combustibles (nombres iguales a js/state.js) ---------------------- */
  FAKE.combustibles = [
    'Gasolina 95 E5', 'Gasolina 98 E5', 'Gasóleo A', 'Gasóleo Premium',
    'Gasóleo B', 'Gasolina 95 E10', 'Gasolina 98 E10', 'GLP', 'AdBlue',
    'Hidrógeno'
  ];
  FAKE.grupos = {
    'Gasolina': ['Gasolina 95 E5', 'Gasolina 98 E5', 'Gasolina 95 E10', 'Gasolina 98 E10'],
    'Gasóleo': ['Gasóleo A', 'Gasóleo Premium', 'Gasóleo B']
  };
  /* Combustibles que de verdad aparecen en las tarjetas de ejemplo */
  FAKE.combustiblesVisibles = [
    'Gasolina 95 E5', 'Gasolina 98 E5', 'Gasóleo A', 'Gasóleo Premium', 'GLP', 'AdBlue'
  ];

  FAKE.marcas = [
    'Repsol', 'Cepsa', 'BP', 'Shell', 'Petronor', 'Galp', 'Avia', 'Ballenoil',
    'E.Leclerc', 'Carrefour', 'Alcampo', 'Dapsa', 'Nomo', 'Moeve', 'Tamoil',
    'Esso', 'Putalocasa', 'Petroprix'
  ];

  /* --- Estaciones --------------------------------------------------------
   * mx/my: posición en el mapa fake (0-100, porcentaje del contenedor)
   * precios: €/L a 3 decimales; null = ese combustible no se vende aquí
   * fav: favorita guardada en IndexedDB en la app real
   * ---------------------------------------------------------------------- */
  FAKE.estaciones = [
    /* ---- Madrid (14) ---- */
    { id: '1001', marca: 'Repsol', nombre: 'Repsol Avenida de América', direccion: 'Av. de América, 41', localidad: 'Madrid', prov: '28', mx: 47, my: 40, dist: 1.2, fav: true, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.589, 'Gasolina 98 E5': 1.749, 'Gasóleo A': 1.429, 'Gasóleo Premium': 1.599, 'GLP': 0.789, 'AdBlue': null } },
    { id: '1002', marca: 'Cepsa', nombre: 'Cepsa Méndez Álvaro', direccion: 'Cerro Negro, 3', localidad: 'Madrid', prov: '28', mx: 52, my: 62, dist: 2.4, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.569, 'Gasolina 98 E5': 1.729, 'Gasóleo A': 1.409, 'Gasóleo Premium': 1.579, 'GLP': null, 'AdBlue': 1.19 } },
    { id: '1003', marca: 'BP', nombre: 'BP Castellana', direccion: 'Pº de la Castellana, 155', localidad: 'Madrid', prov: '28', mx: 44, my: 26, dist: 3.1, fav: false, horario: '06-24 h',
      precios: { 'Gasolina 95 E5': 1.609, 'Gasolina 98 E5': 1.769, 'Gasóleo A': 1.449, 'Gasóleo Premium': null, 'GLP': 0.799, 'AdBlue': null } },
    { id: '1004', marca: 'Shell', nombre: 'Shell Plaza Castilla', direccion: 'Av. del General Perón, 4', localidad: 'Madrid', prov: '28', mx: 38, my: 18, dist: 5.6, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.619, 'Gasolina 98 E5': 1.779, 'Gasóleo A': 1.459, 'Gasóleo Premium': 1.629, 'GLP': null, 'AdBlue': 1.25 } },
    { id: '1005', marca: 'Ballenoil', nombre: 'Ballenoil Villaverde', direccion: 'C. de los Eucaliptos, 12', localidad: 'Madrid', prov: '28', mx: 55, my: 78, dist: 6.8, fav: true, horario: '07-23 h',
      precios: { 'Gasolina 95 E5': 1.499, 'Gasolina 98 E5': 1.659, 'Gasóleo A': 1.339, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '1006', marca: 'Petronor', nombre: 'Petronor San Blas', direccion: 'Av. de Canillejas, 7', localidad: 'Madrid', prov: '28', mx: 72, my: 44, dist: 7.4, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.549, 'Gasolina 98 E5': 1.709, 'Gasóleo A': 1.389, 'Gasóleo Premium': 1.559, 'GLP': 0.779, 'AdBlue': null } },
    { id: '1007', marca: 'Galp', nombre: 'Galp A-2', direccion: 'A-2, km 12', localidad: 'San Fernando de Henares', prov: '28', mx: 82, my: 52, dist: 12.1, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.539, 'Gasolina 98 E5': null, 'Gasóleo A': 1.379, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': 1.15 } },
    { id: '1008', marca: 'Avia', nombre: 'Avia Alcalá', direccion: 'Ctra. de Barcelona, km 18', localidad: 'Alcalá de Henares', prov: '28', mx: 88, my: 60, dist: 18.3, fav: false, horario: '06-23 h',
      precios: { 'Gasolina 95 E5': 1.529, 'Gasolina 98 E5': 1.689, 'Gasóleo A': 1.369, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '1009', marca: 'Carrefour', nombre: 'Carrefour Móstoles', direccion: 'Av. de los Reyes, 1', localidad: 'Móstoles', prov: '28', mx: 26, my: 76, dist: 15.7, fav: false, horario: '09-22 h',
      precios: { 'Gasolina 95 E5': 1.509, 'Gasolina 98 E5': 1.669, 'Gasóleo A': 1.349, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '1010', marca: 'E.Leclerc', nombre: 'E.Leclerc Getafe', direccion: 'C. de la Industria, 22', localidad: 'Getafe', prov: '28', mx: 44, my: 84, dist: 9.2, fav: false, horario: '08-22 h',
      precios: { 'Gasolina 95 E5': 1.489, 'Gasolina 98 E5': 1.649, 'Gasóleo A': 1.329, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': 1.09 } },
    { id: '1011', marca: 'Moeve', nombre: 'Moeve Las Rozas', direccion: 'Av. de la Dehesa, 66', localidad: 'Las Rozas', prov: '28', mx: 22, my: 34, dist: 14.4, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.579, 'Gasolina 98 E5': 1.739, 'Gasóleo A': 1.419, 'Gasóleo Premium': 1.589, 'GLP': 0.795, 'AdBlue': null } },
    { id: '1012', marca: 'Tamoil', nombre: 'Tamoil Colmenar', direccion: 'Ctra. de Colmenar, km 14', localidad: 'Colmenar Viejo', prov: '28', mx: 46, my: 12, dist: 16.9, fav: false, horario: '07-23 h',
      precios: { 'Gasolina 95 E5': 1.559, 'Gasolina 98 E5': 1.719, 'Gasóleo A': 1.399, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '1013', marca: 'Nomo', nombre: 'Nomo Pozuelo', direccion: 'Ctra. de Castilla, 8', localidad: 'Pozuelo de Alarcón', prov: '28', mx: 18, my: 46, dist: 11.3, fav: true, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.479, 'Gasolina 98 E5': 1.639, 'Gasóleo A': 1.319, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '1014', marca: 'Petroprix', nombre: 'Petroprix Torrejón', direccion: 'Av. de la Asturias, 30', localidad: 'Torrejón de Ardoz', prov: '28', mx: 78, my: 36, dist: 17.8, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.469, 'Gasolina 98 E5': null, 'Gasóleo A': 1.309, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Barcelona (5) ---- */
    { id: '2001', marca: 'Repsol', nombre: 'Repsol Diagonal', direccion: 'Av. Diagonal, 640', localidad: 'Barcelona', prov: '08', mx: 40, my: 44, dist: 1.8, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.619, 'Gasolina 98 E5': 1.779, 'Gasóleo A': 1.459, 'Gasóleo Premium': 1.629, 'GLP': 0.815, 'AdBlue': null } },
    { id: '2002', marca: 'Cepsa', nombre: 'Cepsa Meridiana', direccion: 'C. de Nuestra Señora de Loreto, 60', localidad: 'Barcelona', prov: '08', mx: 56, my: 30, dist: 3.4, fav: true, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.599, 'Gasolina 98 E5': 1.759, 'Gasóleo A': 1.439, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': 1.29 } },
    { id: '2003', marca: 'Shell', nombre: 'Shell Llobregat', direccion: 'Ctra. de El Prat, km 3', localidad: "L'Hospitalet de Llobregat", prov: '08', mx: 30, my: 66, dist: 6.1, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.605, 'Gasolina 98 E5': 1.765, 'Gasóleo A': 1.445, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '2004', marca: 'Ballenoil', nombre: 'Ballenoil Sabadell', direccion: 'Ctra. de Terrassa, 110', localidad: 'Sabadell', prov: '08', mx: 52, my: 16, dist: 9.7, fav: false, horario: '07-22 h',
      precios: { 'Gasolina 95 E5': 1.519, 'Gasolina 98 E5': 1.679, 'Gasóleo A': 1.359, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '2005', marca: 'BP', nombre: 'BP Mataró', direccion: "Av. d'Esplugues, 12", localidad: 'Mataró', prov: '08', mx: 70, my: 20, dist: 31.2, fav: false, horario: '06-24 h',
      precios: { 'Gasolina 95 E5': 1.595, 'Gasolina 98 E5': 1.755, 'Gasóleo A': 1.435, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Valencia (4) ---- */
    { id: '3001', marca: 'Repsol', nombre: 'Repsol Patacona', direccion: 'Passeig de la Patacona, 42', localidad: 'València', prov: '46', mx: 58, my: 40, dist: 2.0, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.575, 'Gasolina 98 E5': 1.735, 'Gasóleo A': 1.415, 'Gasóleo Premium': 1.585, 'GLP': 0.799, 'AdBlue': null } },
    { id: '3002', marca: 'Cepsa', nombre: 'Cepsa Cabanyal', direccion: 'Av. del Puerto, 190', localidad: 'València', prov: '46', mx: 66, my: 56, dist: 4.6, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.565, 'Gasolina 98 E5': 1.725, 'Gasóleo A': 1.405, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': 1.22 } },
    { id: '3003', marca: 'Galp', nombre: 'Galp V-21', direccion: 'V-21, km 4', localidad: 'Paterna', prov: '46', mx: 44, my: 20, dist: 12.8, fav: true, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.545, 'Gasolina 98 E5': null, 'Gasóleo A': 1.385, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': 1.18 } },
    { id: '3004', marca: 'Avia', nombre: 'Avia Alzira', direccion: 'Ctra. de Barcelona, 7', localidad: 'Alzira', prov: '46', mx: 30, my: 74, dist: 34.5, fav: false, horario: '07-23 h',
      precios: { 'Gasolina 95 E5': 1.535, 'Gasolina 98 E5': 1.695, 'Gasóleo A': 1.375, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Sevilla (3) ---- */
    { id: '4001', marca: 'Repsol', nombre: 'Repsol Cartuja', direccion: 'Av. de la Ciencia, 8', localidad: 'Sevilla', prov: '41', mx: 34, my: 36, dist: 3.3, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.579, 'Gasolina 98 E5': 1.739, 'Gasóleo A': 1.419, 'Gasóleo Premium': 1.589, 'GLP': 0.805, 'AdBlue': null } },
    { id: '4002', marca: 'Cepsa', nombre: 'Cepsa Este', direccion: 'Av. de Kansas City, 2', localidad: 'Sevilla', prov: '41', mx: 68, my: 52, dist: 5.9, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.569, 'Gasolina 98 E5': 1.729, 'Gasóleo A': 1.409, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '4003', marca: 'Putalocasa', nombre: 'Putalocasa Dos Hermanas', direccion: 'Av. de la Libertad, 44', localidad: 'Dos Hermanas', prov: '41', mx: 50, my: 78, dist: 13.2, fav: false, horario: '08-22 h',
      precios: { 'Gasolina 95 E5': 1.509, 'Gasolina 98 E5': 1.669, 'Gasóleo A': 1.349, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Alicante (3) ---- */
    { id: '5001', marca: 'Repsol', nombre: 'Repsol Benidorm', direccion: 'Av. de la Marina, 12', localidad: 'Benidorm', prov: '03', mx: 52, my: 44, dist: 2.7, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.595, 'Gasolina 98 E5': 1.755, 'Gasóleo A': 1.435, 'Gasóleo Premium': 1.605, 'GLP': null, 'AdBlue': null } },
    { id: '5002', marca: 'Dapsa', nombre: 'Dapsa Alicante', direccion: 'Ctra. de Madrid, km 10', localidad: 'Alicante', prov: '03', mx: 64, my: 68, dist: 11.4, fav: true, horario: '07-23 h',
      precios: { 'Gasolina 95 E5': 1.525, 'Gasolina 98 E5': 1.685, 'Gasóleo A': 1.365, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': 1.17 } },
    { id: '5003', marca: 'Esso', nombre: 'Esso Elda', direccion: 'Av. de la Estación, 3', localidad: 'Elda', prov: '03', mx: 38, my: 76, dist: 27.9, fav: false, horario: '06-23 h',
      precios: { 'Gasolina 95 E5': 1.555, 'Gasolina 98 E5': 1.715, 'Gasóleo A': 1.395, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Málaga (2) ---- */
    { id: '6001', marca: 'Repsol', nombre: 'Repsol Costa', direccion: 'Av. de Velázquez, 50', localidad: 'Málaga', prov: '29', mx: 54, my: 52, dist: 4.1, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.585, 'Gasolina 98 E5': 1.745, 'Gasóleo A': 1.425, 'Gasóleo Premium': 1.595, 'GLP': 0.812, 'AdBlue': null } },
    { id: '6002', marca: 'Ballenoil', nombre: 'Ballenoil Ronda', direccion: 'Ctra. de Cádiz, km 7', localidad: 'Málaga', prov: '29', mx: 36, my: 70, dist: 9.8, fav: false, horario: '07-22 h',
      precios: { 'Gasolina 95 E5': 1.515, 'Gasolina 98 E5': 1.675, 'Gasóleo A': 1.355, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Bizkaia (2) ---- */
    { id: '7001', marca: 'Petronor', nombre: 'Petronor Bilbao', direccion: 'Iparraguirre, 76', localidad: 'Bilbao', prov: '48', mx: 50, my: 46, dist: 2.2, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.625, 'Gasolina 98 E5': 1.785, 'Gasóleo A': 1.465, 'Gasóleo Premium': 1.635, 'GLP': null, 'AdBlue': 1.31 } },
    { id: '7002', marca: 'Avia', nombre: 'Avia Barakaldo', direccion: 'Fábrica de Muncuentos, 2', localidad: 'Barakaldo', prov: '48', mx: 34, my: 62, dist: 8.6, fav: false, horario: '06-23 h',
      precios: { 'Gasolina 95 E5': 1.589, 'Gasolina 98 E5': 1.749, 'Gasóleo A': 1.429, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Zaragoza (2) ---- */
    { id: '8001', marca: 'Cepsa', nombre: 'Cepsa Delicias', direccion: 'Av. de las Delicias, 50', localidad: 'Zaragoza', prov: '50', mx: 48, my: 58, dist: 3.9, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.565, 'Gasolina 98 E5': 1.725, 'Gasóleo A': 1.405, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },
    { id: '8002', marca: 'Nomo', nombre: 'Nomo Plaza', direccion: 'Ctra. de Huesca, 12', localidad: 'Zaragoza', prov: '50', mx: 62, my: 30, dist: 7.7, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.489, 'Gasolina 98 E5': 1.649, 'Gasóleo A': 1.329, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': null } },

    /* ---- Gipuzkoa (1) ---- */
    { id: '9001', marca: 'Repsol', nombre: 'Repsol Anoeta', direccion: 'Pº de Anoeta, 44', localidad: 'Donostia/San Sebastián', prov: '20', mx: 46, my: 40, dist: 2.9, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.639, 'Gasolina 98 E5': 1.799, 'Gasóleo A': 1.479, 'Gasóleo Premium': 1.649, 'GLP': null, 'AdBlue': null } },

    /* ---- Asturias (1) ---- */
    { id: '9101', marca: 'BP', nombre: 'BP Gijón', direccion: 'Av. de la Costa, 18', localidad: 'Gijón', prov: '33', mx: 56, my: 64, dist: 5.3, fav: false, horario: '24 h',
      precios: { 'Gasolina 95 E5': 1.609, 'Gasolina 98 E5': 1.769, 'Gasóleo A': 1.449, 'Gasóleo Premium': null, 'GLP': null, 'AdBlue': 1.28 } }
  ];

  /* --- Mapa fake: no hay Leaflet, el "mapa" es un SVG/CSS con estas ayudas */
  FAKE.mapa = {
    centro: { lat: 40.4168, lng: -3.7038, zoom: 12 },
    tuPosicion: { mx: 49, my: 50, label: 'Tu ubicación' },
    viales: [
      { d: 'M0,50 L100,46', w: 3 }, { d: 'M48,0 L52,100', w: 3 },
      { d: 'M0,25 L100,30', w: 1.5 }, { d: 'M0,75 L100,72', w: 1.5 },
      { d: 'M25,0 L28,100', w: 1.5 }, { d: 'M75,0 L72,100', w: 1.5 },
      { d: 'M0,0 L100,100', w: 1 }, { d: 'M100,0 L0,100', w: 1 },
      { d: 'M10,90 Q40,60 90,85', w: 2 }
    ],
    manchas: [
      { x: 5, y: 5, w: 26, h: 18 }, { x: 62, y: 12, w: 30, h: 22 },
      { x: 10, y: 66, w: 24, h: 26 }, { x: 64, y: 66, w: 28, h: 24 }
    ],
    agua: { d: 'M0,88 Q30,80 55,92 T100,86 L100,100 L0,100 Z' }
  };

  /* --- Histórico determinista (mismo dato en todas las pasadas) ---------- */
  function semilla(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h ^= h << 13; h >>>= 0;
      h ^= h >>> 17;
      h ^= h << 5; h >>>= 0;
      return (h >>> 0) / 4294967296;
    };
  }

  function fechaDe(offsetDias) {
    /* hoy (16-10-2026) menos 1 día (el Ministerio publica con retraso) y el resto */
    var base = new Date(2026, 9, 15);
    base.setDate(base.getDate() - offsetDias);
    var dd = String(base.getDate()).padStart(2, '0');
    var mm = String(base.getMonth() + 1).padStart(2, '0');
    return dd + '-' + mm + '-' + base.getFullYear();
  }

  FAKE.fechaDe = fechaDe;

  /** Serie [{fecha:'dd-mm-aaaa', precio}] de `dias` puntos, del más antiguo al
   *  más reciente. El último punto es el precio actual de la estación. */
  FAKE.historico = function (idEstacion, combustible, dias) {
    var est = FAKE.estaciones.find(function (e) { return e.id === idEstacion; });
    if (!est) return [];
    var actual = est.precios[combustible];
    if (actual == null) {
      /* combinación sin precio: devolvemos la serie de la gasolina 95 para
         que los prototipos siempre tengan algo que dibujar */
      actual = est.precios['Gasolina 95 E5'];
      combustible = 'Gasolina 95 E5';
    }
    var rnd = semilla(idEstacion + '|' + combustible);
    var n = Math.max(2, dias);
    var vol = 0.004 + rnd() * 0.004;             /* volatilidad diaria */
    var drift = (rnd() - 0.45) * 0.0016;          /* tendencia suave */
    var serie = new Array(n);
    var p = actual;
    for (var i = n - 1; i >= 0; i--) {
      serie[i] = Math.round(p * 1000) / 1000;
      p = p - drift + (rnd() - 0.5) * vol * actual * 2;
      if (p < actual * 0.9) p = actual * 0.9;
      if (p > actual * 1.1) p = actual * 1.1;
    }
    return serie.map(function (precio, i) {
      return { fecha: fechaDe(n - 1 - i), precio: precio };
    });
  };

  /* --- Helpers ----------------------------------------------------------- */
  FAKE.provinciaNombre = function (id) {
    var p = FAKE.provincias.find(function (x) { return x.id === id; });
    return p ? p.nombre : '';
  };
  FAKE.estacionesDe = function (provId) {
    if (!provId) return FAKE.estaciones.slice();
    return FAKE.estaciones.filter(function (e) { return e.prov === provId; });
  };
  FAKE.localidadesDe = function (provId) {
    var set = {};
    FAKE.estacionesDe(provId).forEach(function (e) { set[e.localidad] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  };
  FAKE.marcasDe = function (provId) {
    var set = {};
    FAKE.estacionesDe(provId).forEach(function (e) { set[e.marca] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  };
  /** Precio de una estación para el combustible elegido (null si no lo vende) */
  FAKE.precioDe = function (est, combustible) {
    if (!combustible) {
      /* sin combustible elegido: el más barato de los que vende */
      var vals = Object.keys(est.precios).map(function (k) { return est.precios[k]; })
        .filter(function (v) { return v != null; });
      return vals.length ? Math.min.apply(null, vals) : null;
    }
    return est.precios[combustible] != null ? est.precios[combustible] : null;
  };
  FAKE.descuentos = { 'Repsol': 0.05, 'Ballenoil': 0.02, 'E.Leclerc': 0.03 };
  FAKE.precioConDescuento = function (est, combustible) {
    var p = FAKE.precioDe(est, combustible);
    if (p == null) return null;
    var d = FAKE.descuentos[est.marca] || 0;
    return Math.round((p - d) * 1000) / 1000;
  };
  /** Leyenda dinámica de la app: verde < 1.50 ≤ naranja < 1.70 ≤ rojo */
  FAKE.colorPrecio = function (p, umbralBajo, umbralAlto) {
    var b = umbralBajo != null ? umbralBajo : 1.50;
    var a = umbralAlto != null ? umbralAlto : 1.70;
    if (p == null) return 'gris';
    if (p < b) return 'verde';
    if (p <= a) return 'naranja';
    return 'rojo';
  };
  FAKE.mediaProvincia = function (provId, combustible) {
    var lista = FAKE.estacionesDe(provId)
      .map(function (e) { return FAKE.precioDe(e, combustible); })
      .filter(function (v) { return v != null; });
    if (!lista.length) return null;
    return Math.round(lista.reduce(function (a, b) { return a + b; }, 0) / lista.length * 1000) / 1000;
  };
  FAKE.masBarata = function (provId, combustible) {
    var mejor = null;
    FAKE.estacionesDe(provId).forEach(function (e) {
      var p = FAKE.precioDe(e, combustible);
      if (p != null && (!mejor || p < mejor.p)) mejor = { e: e, p: p };
    });
    return mejor;
  };
  FAKE.kmh = function (km) { return km.toFixed(1).replace('.', ',') + ' km'; };
  FAKE.eur = function (p) { return p == null ? '—' : p.toFixed(3).replace('.', ',') + ' €'; };

  /* --- Chat IA de ejemplo (Markdown crudo, como lo devuelve el modelo) ---- */
  FAKE.chatsIA = {
    general: [
      { role: 'user', content: '¿Dónde hay gasolina 95 más barata en Madrid a menos de 5 km?' },
      { role: 'assistant', content:
'### Gasolina 95 más barata (Madrid)\n\n' +
'1. **Petroprix Torrejón** — **1,469 €/L** (Av. de la Asturias, 30)\n' +
'2. **Nomo Pozuelo** — **1,479 €/L** (Ctra. de Castilla, 8)\n' +
'3. **E.Leclerc Getafe** — **1,489 €/L** (C. de la Industria, 22)\n\n' +
'| Estación | Precio | Distancia |\n|---|---|---|\n| Petroprix Torrejón | 1,469 € | 17,8 km |\n| Nomo Pozuelo | 1,479 € | 11,3 km |\n\n' +
'⚠️ Las tres están fuera de tu radio de 5 km; las más cercanas (Repsol Avenida de América, 1,589 €) superan la media provincial de **1,557 €**.' },
      { role: 'user', content: '¿Y gasóleo A cerca de mí?' },
      { role: 'assistant', content:
'El **gasóleo A** más barato cerca de ti es **Nomo Pozuelo** a **1,319 €/L**, un **13,6 %** por debajo de la estación más cara de la zona (BP Castellana, 1,449 €).\n\n' +
'- Tendencia de 14 días: **-0,9 %** (bajada leve)\n- Mínimo del mes: 1,309 € el 03-10-2026' }
    ],
    groq: [
      { role: 'user', content: 'Compara Repsol y Cepsa en mi provincia' },
      { role: 'assistant', content:
'**Repsol** media 1,582 € en gasolina 95 y **Cepsa** 1,567 €. En gasóleo, Cepsa adelanta a Repsol por 0,010 €/L.\n\nCon tus descuentos activos (Repsol -0,05 €), la balanza se invierte: **Repsol queda en 1,532 €** y pasa a ser la más barata.' }
    ],
    mistral: [
      { role: 'user', content: 'Resume mis favoritas' },
      { role: 'assistant', content:
'Tienes **3 favoritas**:\n\n- **Repsol Avenida de América** — 1,589 € (subió 0,012 € esta semana)\n- **Ballenoil Villaverde** — 1,499 € (la más barata de Madrid)\n- **Nomo Pozuelo** — 1,479 € (bajada de 4 días seguidos)' }
    ],
    openrouter: [
      { role: 'user', content: '¿Cuál es la mejor hora para repostar esta semana?' },
      { role: 'assistant', content:
'Los datos indican **martes o miércoles temprano**: la media provincial baja 0,006 € frente al fin de semana, cuando las estaciones de paso suben hasta 0,015 €.' }
    ],
    llm7: [
      { role: 'user', content: 'Tendencia del gasóleo en 30 días' },
      { role: 'assistant', content:
'**Tendencia bajista moderada**: -1,8 % en 30 días (de 1,435 € a 1,409 €), con mínimo el 09-10-2026 (1,398 €).' }
    ],
    nvidia: [
      { role: 'user', content: 'Ranking de marcas por precio medio' },
      { role: 'assistant', content:
'| Marca | Gasolina 95 |\n|---|---|\n| Ballenoil | 1,509 € |\n| Cepsa | 1,567 € |\n| Repsol | 1,582 € |\n| BP | 1,609 € |\n| Shell | 1,619 € |' }
    ],
    google: [
      { role: 'user', content: '¿Qué estaciones han subido precio hoy?' },
      { role: 'assistant', content:
'**2 estaciones subieron** hoy en Madrid: Repsol Avenida de América (+0,010 €) y BP Castellana (+0,008 €). El resto se mantiene.' }
    ],
    'chrome-nano': [
      { role: 'user', content: 'Explícame la diferencia entre E5 y E10' },
      { role: 'assistant', content:
'La gasolina **E10** admite hasta un 10 % de bioetanol (la E5, un 5 %). Es más sostenible y suele costar **0,01–0,02 €/L menos**, pero no todos los coches la admiten: revisa el tapón del depósito.' }
    ]
  };

  /* --- Registros de actividad ------------------------------------------- */
  FAKE.logApi = [
    { t: '16/10/26 09:12:03', url: '/api/estaciones/provincias', estado: 200, ms: 182 },
    { t: '16/10/26 09:12:04', url: '/api/estaciones/provincia/28', estado: 200, ms: 654 },
    { t: '16/10/26 09:12:07', url: '/api/historico/16-10-2026', estado: 200, ms: 421 },
    { t: '16/10/26 09:12:08', url: '/api/historico/15-10-2026', estado: 200, ms: 398 },
    { t: '16/10/26 09:44:11', url: '/api/estaciones/provincia/08', estado: 200, ms: 512 },
    { t: '16/10/26 10:02:39', url: '/api/historico/14-10-2026', estado: 429, ms: 91 },
    { t: '16/10/26 10:02:40', url: '/api/estaciones/provincia/46', estado: 200, ms: 487 },
    { t: '16/10/26 10:30:00', url: '/api/estaciones/provincia/28', estado: 200, ms: 603 }
  ];
  FAKE.logPush = [
    { t: '16/10/26 08:00:12', url: 'checkPrices(): 3 favoritas, 0 caídas', estado: 'ok', ms: 1240 },
    { t: '16/10/26 08:00:13', url: 'showNotification(): Ballenoil -0,02 €', estado: 'ok', ms: 12 },
    { t: '16/10/26 16:00:09', url: 'checkPrices(): 3 favoritas, 1 caída', estado: 'ok', ms: 1180 },
    { t: '16/10/26 16:00:10', url: 'showNotification(): Nomo bajada 3 días', estado: 'ok', ms: 9 },
    { t: '16/10/26 16:00:11', url: 'notificationclick → open-favorite 1013', estado: 'ok', ms: 3 }
  ];

  FAKE.prompts = [
    '¿Dónde repostar barato cerca de mí?',
    'Tendencia de precios esta semana',
    'Mis favoritas, ¿suben o bajan?',
    'Mejor estación para gasóleo A',
    'Compara las 3 más baratas'
  ];

  FAKE.config = {
    pageSize: 30, cacheTtl: 12, checkInterval: 8, priceFallDays: 3,
    priceCheckMode: 'average', pushOnPriceRise: false,
    paginas: [15, 30, 50, 100, 150, 300, 0]
  };

  FAKE.cacheInfo = {
    provincias: 12, gasolineras: 4832, historicoDias: 38,
    idb: 'gasolineras-db — 24,8 MB', lsClaves: 18, ultimaActualizacion: '16/10/26 09:12'
  };

  FAKE.versionApp = { version: 47, build: '20261016-091200', texto: 'v47 · 16/10/2026 09:12' };

  window.FAKE = FAKE;
})();

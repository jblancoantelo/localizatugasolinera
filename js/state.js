const STATE = {
  data: [], filtered: [], sortCol: 'Precio', sortDir: 'asc',
  selectedFuel: '', selectedProv: '', selectedLoc: '', selectedBrands: [],
  userLat: null, userLng: null, map: null, markers: [], userMarker: null,
  markerMap: {}, tileLayer: null,
  selectedId: null, activeTab: 'tab-both', selectedTile: 'street',
  discounts: {}, page: 1, pageSize: 50, maxDistance: '',
  favorites: [], showFavoritesOnly: false,
  provinces: [], provinceIdMap: {},
  _prevFilteredIds: ''
};

const FUEL_KEYS = {
  'Gasolina 95 E5': 'Precio Gasolina 95 E5',
  'Gasolina 98 E5': 'Precio Gasolina 98 E5',
  'Gasóleo A': 'Precio Gasoleo A',
  'Gasóleo Premium': 'Precio Gasoleo Premium',
  'Gasóleo B': 'Precio Gasoleo B',
  'GLP': 'Precio Gases licuados del petróleo',
  'AdBlue': 'Precio Adblue',
  'Gasolina 95 E10': 'Precio Gasolina 95 E10',
  'Gasolina 98 E10': 'Precio Gasolina 98 E10',
  'Hidrógeno': 'Precio Hidrogeno',
};

const FUEL_NAMES = Object.entries(FUEL_KEYS);

const FUEL_GROUPS = {
  'Gasolina': ['Gasolina 95 E5', 'Gasolina 98 E5', 'Gasolina 95 E10', 'Gasolina 98 E10'],
  'Gasóleo': ['Gasóleo A', 'Gasóleo Premium', 'Gasóleo B'],
};
const GROUP_MEMBERS = new Set(Object.values(FUEL_GROUPS).flat());

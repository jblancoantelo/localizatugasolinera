# API del Geoportal de Hidrocarburos — Ejemplos de uso

**Base URL:** `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/`

**Formato respuesta:** JSON
**Actualización:** cada 30 minutos

---

## 1. Listados Auxiliares

### 1.1 Provincias

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/Provincias/"
```

```json
[
  {"IDPovincia":"02","IDCCAA":"07","Provincia":"ALBACETE","CCAA":"Castilla la Mancha"},
  {"IDPovincia":"03","IDCCAA":"10","Provincia":"ALICANTE","CCAA":"Comunidad Valenciana"},
  {"IDPovincia":"04","IDCCAA":"01","Provincia":"ALMERÍA","CCAA":"Andalucia"},
  {"IDPovincia":"28","IDCCAA":"13","Provincia":"MADRID","CCAA":"Madrid"},
  {"IDPovincia":"29","IDCCAA":"01","Provincia":"MÁLAGA","CCAA":"Andalucia"},
  {"IDPovincia":"08","IDCCAA":"09","Provincia":"BARCELONA","CCAA":"Cataluña"}
]
```

### 1.2 Comunidades Autónomas

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/ComunidadesAutonomas/"
```

```json
[
  {"IDCCAA":"01","CCAA":"Andalucia"},
  {"IDCCAA":"02","CCAA":"Aragón"},
  {"IDCCAA":"03","CCAA":"Asturias"},
  {"IDCCAA":"13","CCAA":"Madrid"},
  {"IDCCAA":"09","CCAA":"Cataluña"},
  {"IDCCAA":"10","CCAA":"Comunidad Valenciana"}
]
```

### 1.3 Productos Petrolíferos (combustibles)

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/ProductosPetroliferos/"
```

```json
[
  {"IDProducto":"1","NombreProducto":"Gasolina 95 E5","NombreProductoAbreviatura":"G95E5"},
  {"IDProducto":"23","NombreProducto":"Gasolina 95 E10","NombreProductoAbreviatura":"G95E10"},
  {"IDProducto":"3","NombreProducto":"Gasolina 98 E5","NombreProductoAbreviatura":"G98E5"},
  {"IDProducto":"20","NombreProducto":"Gasolina 95 E5 Premium","NombreProductoAbreviatura":"G95E5+"},
  {"IDProducto":"4","NombreProducto":"Gasóleo A habitual","NombreProductoAbreviatura":"GOA"},
  {"IDProducto":"5","NombreProducto":"Gasóleo Premium","NombreProductoAbreviatura":"GOA+"},
  {"IDProducto":"6","NombreProducto":"Gasóleo B","NombreProductoAbreviatura":"GOB"},
  {"IDProducto":"17","NombreProducto":"Gases licuados del petróleo","NombreProductoAbreviatura":"GLP"},
  {"IDProducto":"18","NombreProducto":"Gas natural comprimido","NombreProductoAbreviatura":"GNC"},
  {"IDProducto":"19","NombreProducto":"Gas natural licuado","NombreProductoAbreviatura":"GNL"},
  {"IDProducto":"26","NombreProducto":"Adblue","NombreProductoAbreviatura":"ADB"},
  {"IDProducto":"27","NombreProducto":"Diésel renovable","NombreProductoAbreviatura":"DREN"}
]
```

### 1.4 Provincias por Comunidad Autónoma

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/ProvinciasPorComunidad/13"
```

```json
[
  {"IDPovincia":"28","IDCCAA":"13","Provincia":"MADRID","CCAA":"Madrid"}
]
```

### 1.5 Municipios por Provincia

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/MunicipiosPorProvincia/28"
```

```json
[
  {"IDMunicipio":"4276","IDProvincia":"28","IDCCAA":"13","Municipio":"Acebeda (La)","Provincia":"MADRID","CCAA":"Madrid"},
  {"IDMunicipio":"4277","IDProvincia":"28","IDCCAA":"13","Municipio":"Ajalvir","Provincia":"MADRID","CCAA":"Madrid"},
  {"IDMunicipio":"4280","IDProvincia":"28","IDCCAA":"13","Municipio":"Alcalá de Henares","Provincia":"MADRID","CCAA":"Madrid"},
  {"IDMunicipio":"4340","IDProvincia":"28","IDCCAA":"13","Municipio":"Getafe","Provincia":"MADRID","CCAA":"Madrid"},
  {"IDMunicipio":"4354","IDProvincia":"28","IDCCAA":"13","Municipio":"Madrid","Provincia":"MADRID","CCAA":"Madrid"}
]
```

---

## 2. Estaciones Terrestres — Precios actuales

### 2.1 Todas las estaciones

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
```
> ⚠ Devuelve ~12.000 estaciones (~5 MB).

### 2.2 Filtro por Municipio

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroMunicipio/4495"
```

```json
{
  "Fecha": "20/06/2026 1:02:54",
  "ListaEESSPrecio": [
    {
      "C.P.": "29690",
      "Dirección": "CTRA N 340 KM 146.7 ESQUINA MA 546",
      "Horario": "L-D: 07:00-23:00",
      "Latitud": "36,381083",
      "Localidad": "CASARES",
      "Longitud (WGS84)": "-5,217611",
      "Margen": "D",
      "Municipio": "Casares",
      "Precio Adblue": "",
      "Precio Gasoleo A": "1,659",
      "Precio Gasoleo Premium": "1,759",
      "Precio Gasolina 95 E5": "1,559",
      "Precio Gasolina 98 E5": "1,699",
      "Provincia": "MÁLAGA",
      "Remisión": "dm",
      "Rótulo": "E.S BAHIA DE CASARES",
      "Tipo Venta": "P",
      "% BioEtanol": "0,0",
      "% Éster metílico": "0,0",
      "IDEESS": "9335",
      "IDMunicipio": "4495",
      "IDProvincia": "29",
      "IDCCAA": "01"
    },
    {
      "C.P.": "29690",
      "Dirección": "CARRETERA A-2102 KM. 10,100",
      "Horario": "L-D: 06:30-22:00",
      "Latitud": "36,334222",
      "Localidad": "CASARES",
      "Longitud (WGS84)": "-5,314944",
      "Margen": "I",
      "Municipio": "Casares",
      "Precio Adblue": "0,800",
      "Precio Gases licuados del petróleo": "0,949",
      "Precio Gasoleo A": "1,539",
      "Precio Gasolina 95 E5": "1,449",
      "Provincia": "MÁLAGA",
      "Remisión": "dm",
      "Rótulo": "E.S. SECADERO",
      "Tipo Venta": "P",
      "% BioEtanol": "0,0",
      "% Éster metílico": "0,0",
      "IDEESS": "7072",
      "IDMunicipio": "4495",
      "IDProvincia": "29",
      "IDCCAA": "01"
    }
  ],
  "Nota": "Archivo de todos los productos en todas las estaciones de servicio. La actualización de precios se realiza cada media hora, con los precios en vigor en ese momento.",
  "ResultadoConsulta": "OK"
}
```

### 2.3 Filtro por Provincia

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/28"
```

```json
{
  "Fecha": "20/06/2026 1:02:27",
  "ListaEESSPrecio": [
    {
      "C.P.": "28864",
      "Dirección": "CARRETERA M-114 KM. 1",
      "Horario": "L-D: 06:00-22:00",
      "Latitud": "40,526722",
      "Localidad": "AJALVIR",
      "Longitud (WGS84)": "-3,481556",
      "Margen": "D",
      "Municipio": "Ajalvir",
      "Precio Gasoleo A": "1,699",
      "Precio Gasoleo Premium": "1,589",
      "Precio Gasoleo B": "1,519",
      "Precio Gasolina 95 E5": "1,639",
      "Provincia": "MADRID",
      "Remisión": "OM",
      "Rótulo": "REPSOL",
      "Tipo Venta": "P",
      "% BioEtanol": "0,0",
      "% Éster metílico": "0,0",
      "IDEESS": "3118",
      "IDMunicipio": "4277",
      "IDProvincia": "28",
      "IDCCAA": "13"
    }
  ],
  "Nota": "...",
  "ResultadoConsulta": "OK"
}
```

### 2.4 Filtro por Producto

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/4"
```

```json
{
  "Fecha": "20/06/2026 1:03:13",
  "ListaEESSPrecio": [
    {
      "C.P.": "02250",
      "Dirección": "AVENIDA CASTILLA LA MANCHA, 26",
      "Horario": "L-D: 07:00-22:00",
      "Latitud": "39,211417",
      "Localidad": "ABENGIBRE",
      "Longitud (WGS84)": "-1,539167",
      "Margen": "D",
      "Municipio": "Abengibre",
      "PrecioProducto": "1,439",
      "Provincia": "ALBACETE",
      "Remisión": "dm",
      "Rótulo": "Nº 10.935",
      "Tipo Venta": "P",
      "IDEESS": "4375",
      "IDMunicipio": "52",
      "IDProvincia": "02",
      "IDCCAA": "07"
    }
  ],
  "Nota": "...",
  "ResultadoConsulta": "OK"
}
```

> Cuando se filtra por producto, el campo se llama `PrecioProducto` (único precio).
> Sin filtro de producto, aparecen todos los campos `Precio Gasolina 95 E5`, `Precio Gasoleo A`, etc.

### 2.5 Filtro por Provincia + Producto (Gasolina 95 E5)

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvinciaProducto/28/1"
```

```json
{
  "Fecha": "20/06/2026 1:03:08",
  "ListaEESSPrecio": [
    {
      "C.P.": "28864",
      "Dirección": "CARRETERA M-114 KM. 1",
      "Horario": "L-D: 06:00-22:00",
      "Latitud": "40,526722",
      "Localidad": "AJALVIR",
      "Longitud (WGS84)": "-3,481556",
      "Margen": "D",
      "Municipio": "Ajalvir",
      "PrecioProducto": "1,519",
      "Provincia": "MADRID",
      "Remisión": "OM",
      "Rótulo": "REPSOL",
      "Tipo Venta": "P",
      "IDEESS": "3118",
      "IDMunicipio": "4277",
      "IDProvincia": "28",
      "IDCCAA": "13"
    },
    {
      "C.P.": "28864",
      "Dirección": "CAMINO TORREJON, 4",
      "Horario": "L-D: 24H",
      "Latitud": "40,528778",
      "Localidad": "AJALVIR",
      "Longitud (WGS84)": "-3,481639",
      "Margen": "D",
      "Municipio": "Ajalvir",
      "PrecioProducto": "1,389",
      "Provincia": "MADRID",
      "Remisión": "dm",
      "Rótulo": "PLENERGY",
      "Tipo Venta": "P",
      "IDEESS": "15493",
      "IDMunicipio": "4277",
      "IDProvincia": "28",
      "IDCCAA": "13"
    }
  ],
  "Nota": "Archivo de todos los productos en todas las estaciones de servicio. La actualización de precios se realiza cada media hora, con los precios en vigor en ese momento.",
  "ResultadoConsulta": "OK"
}
```

### 2.6 Filtro por Municipio + Producto

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroMunicipioProducto/4495/1"
```

```json
{
  "Fecha": "20/06/2026 1:03:09",
  "ListaEESSPrecio": [
    {
      "C.P.": "29690",
      "Dirección": "CTRA N 340 KM 146.7 ESQUINA MA 546",
      "Horario": "L-D: 07:00-23:00",
      "Latitud": "36,381083",
      "Localidad": "CASARES",
      "Longitud (WGS84)": "-5,217611",
      "Margen": "D",
      "Municipio": "Casares",
      "PrecioProducto": "1,559",
      "Provincia": "MÁLAGA",
      "Remisión": "dm",
      "Rótulo": "E.S BAHIA DE CASARES",
      "Tipo Venta": "P",
      "IDEESS": "9335",
      "IDMunicipio": "4495",
      "IDProvincia": "29",
      "IDCCAA": "01"
    },
    {
      "C.P.": "29690",
      "Dirección": "CARRETERA A-2102 KM. 10,100",
      "Horario": "L-D: 06:30-22:00",
      "Latitud": "36,334222",
      "Localidad": "CASARES",
      "Longitud (WGS84)": "-5,314944",
      "Margen": "I",
      "Municipio": "Casares",
      "PrecioProducto": "1,449",
      "Provincia": "MÁLAGA",
      "Remisión": "dm",
      "Rótulo": "E.S. SECADERO",
      "Tipo Venta": "P",
      "IDEESS": "7072",
      "IDMunicipio": "4495",
      "IDProvincia": "29",
      "IDCCAA": "01"
    }
  ],
  "Nota": "Archivo de todos los productos en todas las estaciones de servicio. La actualización de precios se realiza cada media hora, con los precios en vigor en ese momento.",
  "ResultadoConsulta": "OK"
}
```

### 2.7 Filtro por CCAA (Comunidad Autónoma)

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroCCAA/13"
```

```json
{
  "Fecha": "20/06/2026 1:02:27",
  "ListaEESSPrecio": [
    {
      "C.P.": "28864",
      "Dirección": "CARRETERA M-114 KM. 1",
      "Horario": "L-D: 06:00-22:00",
      "Latitud": "40,526722",
      "Localidad": "AJALVIR",
      "Longitud (WGS84)": "-3,481556",
      "Margen": "D",
      "Municipio": "Ajalvir",
      "Precio Gasoleo A": "1,699",
      "Precio Gasoleo Premium": "1,589",
      "Precio Gasoleo B": "1,519",
      "Precio Gasolina 95 E5": "1,639",
      "Provincia": "MADRID",
      "Remisión": "OM",
      "Rótulo": "REPSOL",
      "Tipo Venta": "P",
      "% BioEtanol": "0,0",
      "% Éster metílico": "0,0",
      "IDEESS": "3118",
      "IDMunicipio": "4277",
      "IDProvincia": "28",
      "IDCCAA": "13"
    }
  ],
  "Nota": "...",
  "ResultadoConsulta": "OK"
}
```

### 2.8 Filtro por CCAA + Producto

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroCCAAProducto/13/4"
```

---

## 3. Estaciones Terrestres — Histórico

Añaden `{Fecha}` (formato `dd-mm-aaaa` con **guiones**) como primer parámetro de la ruta.
Los precios reflejados son los vigentes a las 23:59 de esa fecha.
> ⚠ El separador de fecha debe ser `-` (guion), no `/` (barra).

### 3.1 Histórico completo por fecha

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestresHist/19-06-2026"
```

### 3.2 Histórico por provincia + fecha

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestresHist/FiltroProvincia/19-06-2026/28"
```

### 3.3 Histórico por municipio + producto + fecha

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestresHist/FiltroMunicipioProducto/19-06-2026/4495/1"
```

Variantes disponibles:

| Endpoint | Parámetros |
|---|---|
| `EstacionesTerrestresHist/{Fecha}` | fecha |
| `EstacionesTerrestresHist/FiltroProvincia/{Fecha}/{IDProvincia}` | fecha, provincia |
| `EstacionesTerrestresHist/FiltroCCAA/{Fecha}/{IDCCAA}` | fecha, ccaa |
| `EstacionesTerrestresHist/FiltroMunicipio/{Fecha}/{IDMunicipio}` | fecha, municipio |
| `EstacionesTerrestresHist/FiltroProducto/{Fecha}/{IDProducto}` | fecha, producto |
| `EstacionesTerrestresHist/FiltroProvinciaProducto/{Fecha}/{IDProvincia}/{IDProducto}` | fecha, provincia, producto |
| `EstacionesTerrestresHist/FiltroCCAAProducto/{Fecha}/{IDCCAA}/{IDProducto}` | fecha, ccaa, producto |
| `EstacionesTerrestresHist/FiltroMunicipioProducto/{Fecha}/{IDMunicipio}/{IDProducto}` | fecha, municipio, producto |

---

## 4. Postes Marítimos (gasolineras en puertos)

Misma estructura que `EstacionesTerrestres` pero para puertos deportivos.
Incluye el campo adicional `Puerto` y `IDPosteMaritimo`.

### 4.1 Todos los postes marítimos

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/PostesMaritimos/"
```

### 4.2 Postes marítimos por provincia

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/PostesMaritimos/FiltroProvincia/35"
```

```json
{
  "Fecha": "20/06/2026 1:03:12",
  "ListaEESSPrecio": [
    {
      "C.P.": "35509",
      "Dirección": "AV. OLOF PALME, S/N",
      "Horario": "L: 08:15-19:30",
      "Latitud": "28,965028",
      "Localidad": "ARRECIFE",
      "Longitud (WGS84)": "-13,537917",
      "Municipio": "Arrecife",
      "Precio Gasoleo A habitual": "1,553",
      "Precio Gasolina 95 E5": "1,434",
      "Provincia": "PALMAS (LAS)",
      "Puerto": "MARINA LANZAROTE",
      "Remisión": "dm",
      "Rótulo": "",
      "Tipo Venta": "Suministro a barcos deportivos o de recreo",
      "IDPosteMaritimo": "275",
      "IDMunicipio": "5237",
      "IDProvincia": "35",
      "IDCCAA": "05"
    },
    {
      "C.P.": "35140",
      "Dirección": "DIQUE SUR. PUERTO DE MOGAN",
      "Horario": "L-D: 09:00-13:00 y 15:00-17:50",
      "Latitud": "27,815861",
      "Localidad": "MOGAN",
      "Longitud (WGS84)": "-15,764056",
      "Municipio": "Mogán",
      "Precio Gasoleo A habitual": "1,549",
      "Precio Gasolina 95 E5": "1,429",
      "Provincia": "PALMAS (LAS)",
      "Puerto": "PUERTO DE MOGAN",
      "Remisión": "dm",
      "Rótulo": "REPSOL",
      "Tipo Venta": "Suministro a barcos deportivos o de recreo",
      "IDPosteMaritimo": "218",
      "IDMunicipio": "5245",
      "IDProvincia": "35",
      "IDCCAA": "05"
    },
    {
      "C.P.": "35625",
      "Dirección": "MUELLE DEPORTIVO S/N",
      "Horario": "L-D: 08:00-20:00",
      "Latitud": "28,048722",
      "Localidad": "MORRO JABLE",
      "Longitud (WGS84)": "-14,358750",
      "Municipio": "Pájara",
      "Precio Gasoleo A habitual": "1,399",
      "Precio Gasolina 95 E5": "1,387",
      "Provincia": "PALMAS (LAS)",
      "Puerto": "PUERTO DE MORRO JABLE",
      "Remisión": "dm",
      "Rótulo": "H2GO REPSOL MORRO JABLE",
      "Tipo Venta": "Mixto",
      "IDPosteMaritimo": "346",
      "IDMunicipio": "5248",
      "IDProvincia": "35",
      "IDCCAA": "05"
    }
  ],
  "Nota": "...",
  "ResultadoConsulta": "OK"
}
```

### 4.3 Postes marítimos por CCAA

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/PostesMaritimos/FiltroCCAA/05"
```

### 4.4 Postes marítimos por municipio

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/PostesMaritimos/FiltroMunicipio/5237"
```

### 4.5 Postes marítimos por producto

```bash
curl -s "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/PostesMaritimos/FiltroProducto/4"
```

Mismas variantes de filtro que estaciones terrestres:

| Endpoint | Parámetros |
|---|---|
| `PostesMaritimos/` | — |
| `PostesMaritimos/FiltroProvincia/{IDProvincia}` | provincia |
| `PostesMaritimos/FiltroCCAA/{IDCCAA}` | ccaa |
| `PostesMaritimos/FiltroMunicipio/{IDMunicipio}` | municipio |
| `PostesMaritimos/FiltroProducto/{IDProducto}` | producto |
| `PostesMaritimos/FiltroProvinciaProducto/{IDProvincia}/{IDProducto}` | provincia, producto |
| `PostesMaritimos/FiltroCCAAProducto/{IDCCAA}/{IDProducto}` | ccaa, producto |
| `PostesMaritimos/FiltroMunicipioProducto/{IDMunicipio}/{IDProducto}` | municipio, producto |

---

## 5. Resumen de IDs

### Comunidades Autónomas (`IDCCAA`)

| ID | CCAA |
|---|---|
| 01 | Andalucia |
| 02 | Aragón |
| 03 | Asturias |
| 04 | Baleares |
| 05 | Canarias |
| 06 | Cantabria |
| 07 | Castilla la Mancha |
| 08 | Castilla y León |
| 09 | Cataluña |
| 10 | Comunidad Valenciana |
| 11 | Extremadura |
| 12 | Galicia |
| 13 | Madrid |
| 14 | Murcia |
| 15 | Navarra |
| 16 | País Vasco |
| 17 | Rioja (La) |
| 18 | Ceuta |
| 19 | Melilla |

### Productos (`IDProducto`)

| ID | Nombre | Abrev. |
|---|---|---|
| 1 | Gasolina 95 E5 | G95E5 |
| 3 | Gasolina 98 E5 | G98E5 |
| 4 | Gasóleo A habitual | GOA |
| 5 | Gasóleo Premium | GOA+ |
| 6 | Gasóleo B | GOB |
| 17 | Gases licuados del petróleo | GLP |
| 18 | Gas natural comprimido | GNC |
| 19 | Gas natural licuado | GNL |
| 20 | Gasolina 95 E5 Premium | G95E5+ |
| 23 | Gasolina 95 E10 | G95E10 |
| 26 | Adblue | ADB |

### Provincias (`IDProvincia`)

| ID | Provincia | CCAA |
|---|---|---|
| 28 | MADRID | 13 |
| 08 | BARCELONA | 09 |
| 46 | VALENCIA / VALÈNCIA | 10 |
| 41 | SEVILLA | 01 |
| 29 | MÁLAGA | 01 |

---

## 6. Supabase — Esquema relacional (base de datos externa)

Los datos históricos se replican opcionalmente en Supabase (PostgreSQL) para consultas persistentes.

### 6.1 Tablas

```sql
-- Provincias
CREATE TABLE provincias (
  id smallint PRIMARY KEY,
  nombre text NOT NULL
);

-- Gasolineras (estaciones de servicio)
CREATE TABLE gasolineras (
  ideess text PRIMARY KEY,
  rotulo text,
  direccion text,
  localidad text,
  provincia_id smallint NOT NULL REFERENCES provincias(id),
  codigo_postal text,
  horario text,
  latitud numeric(10,6),
  longitud numeric(10,6),
  margen text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Precios históricos por gasolinera, fecha y carburante
CREATE TABLE precios_historicos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gasolinera_id text NOT NULL REFERENCES gasolineras(ideess),
  fecha date NOT NULL,
  carburante text NOT NULL,
  precio numeric(6,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gasolinera_id, fecha, carburante)
);
```

### 6.2 Políticas RLS

Todas las tablas tienen RLS habilitado con políticas de lectura/escritura anónimas (se recomienda restringir en producción).

### 6.3 Configuración

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar `supabase/migrations/001_schema.sql` en el SQL Editor
3. Copiar `supabase/.env.example` a `js/supabase-config.js` con las credenciales reales
4. Para MCP: configurar `SUPABASE_ACCESS_TOKEN` en entorno y usar `opencode.jsonc`

---

## Notas

- Los precios se devuelven como **string** con formato español (`,` como separador decimal, ej: `"1,459"`).
- Cuando se filtra por **producto**, el campo de precio se llama `PrecioProducto`.
- En las respuestas **sin filtro de producto** aparecen todos los precios (ej: `Precio Gasolina 95 E5`, `Precio Gasoleo A`, etc.).
- Campos vacíos se devuelven como string vacío `""`.
- Los `Listados/Municipios/` (todos los municipios) es un endpoint muy pesado (~3 MB).
- No hay paginación ni filtros por nombre/marca.

# Earth Atlas

*Status: draft (2026-10-22). Kind: tool. Field: geography (cartography), showing data from meteorology, oceanography, geography and geophysics.* Decision record: [ADR 0014](../../../development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md).

The Earth Atlas shows the atmosphere, the ocean, the land and the people of the Earth on one globe, at one instant. Each kind of data comes from its own dataset and is joined to the map only here, in the application. The map itself is one dataset among others, and carries no values but names and places.

## 1. Concepts

- **Separated data.** The data library builds four kinds of product, each with its own provenance:
  - **geography:** coasts, countries, rivers, places and names (Natural Earth);
  - **fields:** gridded quantities over time (forecasts, analyses, relief, or our own model output);
  - **indicators:** a value per country and year (World Bank);
  - **events:** points in place and time (earthquakes, from the USGS).
- **Joins.** The atlas joins indicators to countries by stated keys, and reports what does not match.
- **Typed layers.** What can be drawn is set by the shape of the data, not its subject. One of each kind can be shown at once:
  - a **surface**: a field, or a value per country, in colour;
  - a **flow**: a vector field, shown by moving particles;
  - **lines**: isolines, with highs and lows;
  - **events**;
  - the **base map**: relief, coasts, boundaries, rivers, the graticule with the tropics and polar circles, names, and day and night.
- **Fields recognised by their CF standard names.** A field from any source with a known standard name is drawn in that quantity's style. A field with an unknown one is drawn in a style fitted to its own range.
- **One instant, in UTC.**
  - Each layer shows its data nearest to that instant, and says which time it shows.
  - When that time differs from the instant shown, the legend says by how much, for example "Data from 30 h before the time shown".
- **Every number has a unit and a source.**
  - The place card gives every value the loaded data hold for a place: weather, sea, relief, and the country's indicators.
  - For a chosen place, it also draws each value over time.

## 2. Running

From the repository root, fetch the data and build the products (about 80 MB of downloads):

```
python data/acquisition/fetch.py natural-earth-50m etopo-2022 gfs oisst ww3 usgs-earthquakes
python data/acquisition/fetch.py worldbank-indicators --profile population    # and other profiles; see --list
python data/products/geography.py
python data/products/field_grid.py --source etopo-2022
python data/products/field_grid.py --source gfs
python data/products/field_grid.py --source oisst
python data/products/field_grid.py --source ww3
python data/products/country_indicators.py
python data/products/event_catalog.py
python applications/geography/earth-atlas/serve.py --open
```

The page also loads three.js from jsDelivr and Source Serif 4 from Google Fonts.

- **Choosing the data.** Each dataset has profiles and parameters; see `python data/acquisition/fetch.py --list`. Examples:
  - `gfs --profile fine` gives a 0.5° grid every 3 h;
  - `oisst --profile month` gives the last 30 days.
- **Refreshing.** Fetching a forecast again replaces it with the latest run. Rebuild its product afterwards.
- **Our own data.** A netCDF classic file on a regular grid becomes a field product with:

  ```
  python data/products/field_grid.py --input run.nc --name my-run --title "…" --domain climate
  ```

  It then appears in the atlas.
- **Sharing a view.** The address bar keeps the view, the layers, the time and the chosen place, so a link reproduces a map.

## 3. Data

| Data | Source | Product | Licence |
|---|---|---|---|
| Coasts, countries, boundaries, lakes, rivers, ice, places, sea names | Natural Earth 1:50 m, v5.1.2 | `geography-ne50m` | Public domain |
| Relief of land and sea floor | ETOPO 2022 (NOAA NCEI), 10′ | `fields-etopo-2022-medium` | Public domain |
| Wind, temperature, pressure, precipitation, humidity | GFS (NOAA NCEP), via PacIOOS ERDDAP, 1°, every 6 h | `fields-gfs-forecast` | Public domain |
| Sea-surface temperature, anomaly, sea ice | OISST v2.1 (NOAA NCEI), via CoastWatch ERDDAP, 0.5°, daily | `fields-oisst-latest` | Public domain |
| Waves: height, period, direction | WaveWatch III (NOAA NCEP), via PacIOOS ERDDAP, 1°, every 6 h | `fields-ww3-forecast` | Public domain |
| Country indicators (11) | World Bank, World Development Indicators | `indicator-*` | CC BY 4.0 |
| Earthquakes | USGS ComCat, magnitude 4.5 and above | `events-usgs-earthquakes-*` | Public domain |

The ERDDAP servers add: "The data may be used and redistributed for free but is not intended for legal use, since it may contain inaccuracies." Citations are in each manifest in [data/registry](../../../data/registry/), and in the atlas under *Data*.

## 4. Method

| Topic | Method | Source |
|---|---|---|
| Interpolation | Bilinear in space and linear in time. Beside missing values, the valid neighbours are used if they carry at least half the weight. Directions are interpolated through unit vectors. The GPU and the readout use the same rule. | `src/core/grid.js` |
| Flat maps | Equal Earth, equal-area, as the default. Equirectangular shows the data grid as it is. | Šavrič, Patterson and Jenny (2018); [theory note](../../../theory/geography/equal-area-maps.md) |
| Particles | The midpoint rule on the sphere, with parallel transport. Exact for flow along a great circle; second-order otherwise. | `src/core/flow.js`, [theory note](../../../theory/meteorology/particles-on-the-sphere.md) |
| Wave energy | Deep-water group speed c_g = g T / 4π, along the peak direction | Holthuijsen (2007); [theory note](../../../theory/oceanography/wave-energy-propagation.md) |
| Day and night | Subsolar point from the Astronomical Almanac's low-precision Sun. Sunrise at −0.833°; civil, nautical and astronomical twilight at −6°, −12° and −18°. | [theory note](../../../theory/astronomy/subsolar-point-and-twilight.md) |
| Isolines | Marching squares, saddles resolved by the cell mean. Highs and lows are extrema over a neighbourhood with a stated prominence. | `src/core/contour.js` |
| Countries | Scanline rasterisation, even-odd rule, 4096 × 2048. Joins to indicators by stated keys. | `src/core/raster.js`, `src/core/join.js` |
| Relief | Hypsometric tints, and Lambert shading from the north-west at 45°, exaggerated 14× on the 10′ grid | Imhof (1982) |
| Colour maps | cmocean (Thyng et al. 2016, MIT licence), and the laboratory's own orchid map, with lightness rising evenly | `src/render/colormaps.js` |
| Conventions | Wind direction is where it blows from. Times in UTC. Values stored in their source units and converted only for display. | `src/core/derived.js`, `src/core/units.js` |

## 5. Verification

```
node applications/geography/earth-atlas/tests/run-tests.mjs
```

There are 65 checks. The checks on real data need the products; without them they are skipped.

| Quantity | Reference | Agreement |
|---|---|---|
| Subsolar point, 20 instants 1955–2045 | JPL Horizons: apparent RA and Dec, and apparent sidereal time | 0.007° in longitude, 0.004° in latitude |
| GMST | Meeus, example 12.a | 0.0003″ |
| Equal Earth, forward and inverse | Round trip, 2000 random places | 3 × 10⁻¹² ° |
| Equal Earth, area | Jacobian over cos φ, constant | Within 2 × 10⁻¹⁰ |
| Equal Earth, ratio of the axes | Šavrič et al. (2018): about 2.05 | 2.0546 |
| Bilinear interpolation | Linear fields, exact | 6 × 10⁻¹⁴ |
| Isolines | A circle: points on the level; closed; length 2πr | Within 4 × 10⁻⁴ °; closed; length within 7 × 10⁻⁵ |
| Particles | Uniform flow along the equator; solid-body rotation, 2000 steps | Exact; latitude kept to 8 × 10⁻⁶ ° |
| Rasterised land | Polygon area by the shoelace formula on the cylindrical equal-area plane | Within 8 × 10⁻⁶ of the sphere |
| Joins | Natural Earth to World Bank | 219 of 242 countries; only Gibraltar unmatched |

Fetch the reference values again with `python applications/geography/earth-atlas/tests/fetch_fixtures.py`.

## 6. Structure

The computation in `src/core/` is a provisional stand-in for the laboratory's C++ core ([ADR 0011](../../../development/decisions/0011-first-application-celestial-atlas.md), [ADR 0014](../../../development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md)).

| Path | Role | Stands in for |
|---|---|---|
| `src/core/sphere.js` | Places, directions, distances, great circles | `core/domains/geodesy` |
| `src/core/sun.js` | The Sun's position, subsolar point, altitude, twilight | `core/domains/astronomy` |
| `src/core/projections.js` | Equal Earth and equirectangular, forward and inverse | `core/domains/geography` (cartography) |
| `src/core/grid.js` | Fields: grid positions, interpolation, time brackets | `core/inference` |
| `src/core/contour.js` | Isolines, highs and lows | `core/domains/geography` |
| `src/core/raster.js` | Polygons to rasters, areas | `core/domains/geography` (GIS) |
| `src/core/flow.js` | Particles carried by a flow on the sphere | physis (kinematics) |
| `src/core/derived.js` | Wind direction, wave group speed | `core/domains/meteorology`, `oceanography` |
| `src/core/units.js` | Units for display | physis (units) |
| `src/core/join.js` | Joins of data to places by key | `core/domains/geography` (GIS) |
| `src/data/products.js` | Reads products from the data library | — |
| `src/layers/` | The catalogue of layers, and one module per kind of layer | `visualization/scene` |
| `src/render/` | The surface shader, lines, markers, labels, relief, colour maps, the stage | `visualization/renderers` |
| `src/ui/` | Panel, timeline, legend, place card | — |

## 7. Limits

- Fields are drawn at the resolution of their product (1° for the default forecast). Finer profiles exist, at a cost in download.
- The GFS series joins past analyses to the latest forecast. The atlas does not separate the two; ERDDAP's aggregation is described in the provider's metadata.
- Natural Earth draws boundaries by its de facto depiction; disputed boundaries are dashed.
- Climate-model and reanalysis archives (CMIP, ERA5) are not yet registered: ERA5 needs a Copernicus account, and CMIP data are served by ESGF.
- Long-run climate fields over centuries would need a timeline in years; the timeline adapts its labels, but a long field and a short one together leave the short one narrow.

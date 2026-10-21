# Earth Atlas

*Status: draft (2026-10-22). Kind: tool. Field: geography (cartography), showing data from meteorology, oceanography, geography and geophysics.* Decision records: [ADR 0014](../../../development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md), [ADR 0015](../../../development/decisions/0015-earth-atlas-models-imagery-detail.md).

The Earth Atlas shows the atmosphere, the ocean, the land and the people of the Earth on one globe, at one instant. Each kind of data comes from its own dataset and is joined to the map only here, in the application. Forecasts from several models can be compared, among them a model of our own that runs in the page. The map itself is one dataset among others, and carries no values but names and places.

## 1. Concepts

- **Separated data.** The data library builds five kinds of product, each with its own provenance:
  - **geography:** coasts, countries, rivers, places and names (Natural Earth);
  - **fields:** gridded quantities over time (forecasts, analyses, relief, or our own model output);
  - **indicators:** a value per country and year (World Bank);
  - **events:** points in place and time (earthquakes, from the USGS);
  - **imagery:** pictures of the whole Earth (NASA's VIIRS, Blue Marble and Black Marble).
- **Joins.** The atlas joins indicators to countries by stated keys, and reports what does not match.
- **Typed layers.** What can be drawn is set by the shape of the data, not its subject. One of each kind can be shown at once:
  - a **surface:** a field, or a value per country, in colour;
  - a **flow:** a vector field, shown by moving particles;
  - **lines:** isolines, with highs and lows;
  - **events**;
  - the **base map:** relief, satellite imagery, or plain; plus forecast clouds, lights at night, coasts, boundaries, rivers, the graticule with the tropics and polar circles, names, and day and night.
- **Fields recognised by standard name and level.** A field with a known CF standard name is drawn in that quantity's style at its level, for example geopotential height at 500 hPa. A field with an unknown one is drawn in a style fitted to its own range.
- **Models as a choice.** The same quantity from several models (GFS, NOAA's AI model AIGFS, the AIGEFS ensemble, our own) is one layer with a choice of model.
  - Any two models can be shown as a difference.
  - The place card gives each model's value and draws their courses together.
  - Ensemble spread is a layer of its own.
- **Our own model.** The barotropic vorticity equation runs in the page from the GFS analysis, the same equation as the first numerical weather prediction (1950). It is verified against later analyses and against persistence.
- **One instant, in UTC.**
  - Each layer shows its data nearest to that instant, and says which time it shows.
  - When that time differs from the instant shown, the legend says by how much, for example "Data from 30 h before the time shown".
- **Detail where you look.** At close range the atlas asks NASA for imagery of the region in view at the screen's resolution, down to 250 m per pixel.

## 2. Running

From the repository root, fetch the data and build the products. This is about 300 MB of downloads; the THREDDS servers can take minutes per request.

```
python data/acquisition/fetch.py natural-earth-50m etopo-2022 gfs oisst ww3 usgs-earthquakes
python data/acquisition/fetch.py gfs-levels aigfs aigefs                  # models aloft and the AI models
python data/acquisition/fetch.py gibs-daily                               # yesterday's Earth from space
python data/acquisition/fetch.py gibs-static --profile blue-marble
python data/acquisition/fetch.py gibs-static --profile black-marble
python data/acquisition/fetch.py worldbank-indicators --profile population    # and other profiles; see --list
python data/products/geography.py
for s in etopo-2022 gfs oisst ww3 gfs-levels aigfs aigefs; do python data/products/field_grid.py --source $s; done
python data/products/imagery.py --source gibs-daily
python data/products/imagery.py --source gibs-static --profile blue-marble
python data/products/imagery.py --source gibs-static --profile black-marble
python data/products/country_indicators.py
python data/products/event_catalog.py
python applications/geography/earth-atlas/serve.py --open
```

The page also loads three.js from jsDelivr and Source Serif 4 from Google Fonts. At close range it requests detail from NASA GIBS.

- **Choosing the data.** Each dataset has profiles and parameters; see `python data/acquisition/fetch.py --list`. Examples:
  - `gfs --profile fine` gives a 0.5° grid every 3 h;
  - `oisst --profile month` gives the last 30 days.
- **Refreshing.** Fetching a forecast again replaces it with the latest run. Rebuild its product afterwards.
- **Our own data.** A netCDF classic file on a regular grid becomes a field product with:

  ```
  python data/products/field_grid.py --input run.nc --name my-run --title "…" --domain climate
  ```

  It then appears in the atlas.
- **Sharing a view.** The address bar keeps the view, the layers, the comparison, the time and the chosen place, so a link reproduces a map.

## 3. Data

| Data | Source | Product | Licence |
|---|---|---|---|
| Coasts, countries, boundaries, lakes, rivers, ice, places, sea names | Natural Earth 1:50 m, v5.1.2 | `geography-ne50m` | Public domain |
| Relief of land and sea floor | ETOPO 2022 (NOAA NCEI), 10′ | `fields-etopo-2022-medium` | Public domain |
| Wind, temperature, pressure, precipitation, humidity | GFS (NOAA NCEP), via PacIOOS ERDDAP, 1°, every 6 h | `fields-gfs-forecast` | Public domain |
| The atmosphere aloft (850, 500, 250 hPa); cloud, water vapour, CAPE | GFS, via Unidata THREDDS, 1°, every 6 h, three days back | `fields-gfs-levels-forecast` | Public domain |
| An AI forecast: surface, 850, 500 and 250 hPa | AIGFS (NOAA NCEP and EPIC), via Unidata THREDDS, 1° | `fields-aigfs-forecast` | Public domain |
| An AI ensemble: mean and spread | AIGEFS (NOAA), via Unidata THREDDS, 1° | `fields-aigefs-forecast` | Public domain |
| Sea-surface temperature, anomaly, sea ice | OISST v2.1 (NOAA NCEI), via CoastWatch ERDDAP, 0.5°, daily | `fields-oisst-latest` | Public domain |
| Waves: height, period, direction | WaveWatch III (NOAA NCEP), via PacIOOS ERDDAP, 1°, every 6 h | `fields-ww3-forecast` | Public domain |
| The Earth from space, by day and by night | NASA GIBS: VIIRS true colour, Blue Marble, Black Marble, 8192 × 4096 | `imagery-*` | NASA, acknowledge |
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
| Our model | The barotropic vorticity equation, spectral transform method at T42 (Gaussian grid 128 × 64), Runge–Kutta 4 with 30-minute steps and ∇⁴ damping. Heights from linear balance, added as changes to the analysis. | `src/core/spectral.js`, `src/core/barotropic.js`; [theory note](../../../theory/meteorology/barotropic-vorticity-model.md) |
| Model comparison | Differences on a diverging scale fitted to the 98th percentile over the shared forecast. The model's verification is the root-mean-square height error over 20–80° N, against analyses and against persistence. | `src/layers/surface.js`, `src/layers/labmodel.js` |
| Day and night | Subsolar point from the Astronomical Almanac's low-precision Sun. Sunrise at −0.833°; civil, nautical and astronomical twilight at −6°, −12° and −18°. Lights from the Black Marble on the night side. | [theory note](../../../theory/astronomy/subsolar-point-and-twilight.md) |
| Imagery and detail | Global images at 8192 × 4096. Gaps in a daily mosaic are filled from the day before; where imagery has none, the relief shows. At close range, a WMS request covers the region in view at the screen's resolution. | `data/products/imagery.py`, `src/layers/imagery.js` |
| Isolines | Marching squares, saddles resolved by the cell mean. Highs and lows are extrema over a neighbourhood with a stated prominence (heights outside the tropics only). | `src/core/contour.js` |
| Countries | Scanline rasterisation, even-odd rule, 4096 × 2048. Joins to indicators by stated keys. | `src/core/raster.js`, `src/core/join.js` |
| Relief | Hypsometric tints, and Lambert shading from the north-west at 45°, exaggerated 14× on the 10′ grid | Imhof (1982) |
| Colour maps | cmocean (Thyng et al. 2016, MIT licence), and the laboratory's own orchid map, with lightness rising evenly | `src/render/colormaps.js` |
| Conventions | Wind direction is where it blows from. Times in UTC. Values stored in their source units and converted only for display (vorticity in 10⁻⁵ s⁻¹). | `src/core/derived.js`, `src/core/units.js` |

## 5. Verification

```
node applications/geography/earth-atlas/tests/run-tests.mjs
```

There are 78 checks. The checks on real data need the products; without them they are skipped.

| Quantity | Reference | Agreement |
|---|---|---|
| Subsolar point, 20 instants 1955–2045 | JPL Horizons: apparent RA and Dec, and apparent sidereal time | 0.007° in longitude, 0.004° in latitude |
| GMST | Meeus, example 12.a | 0.0003″ |
| Equal Earth | Round trip; area scale constant; axis ratio 2.05 | 3 × 10⁻¹² °; 2 × 10⁻¹⁰; 2.0546 |
| Spherical harmonics, T42 | Normalisation; analysis of a synthesis; curl and divergence of a non-divergent wind | 1 × 10⁻¹⁴; 1 × 10⁻¹⁴; 6 × 10⁻¹⁵ |
| Barotropic model | Rossby–Haurwitz wave after one day (Haurwitz 1940), amplitude and phase speed | 7 × 10⁻¹⁰ |
| Barotropic model | Energy and enstrophy over a day of random flow | 2 × 10⁻⁶ and 3 × 10⁻⁵ |
| Linear balance | Zonal flow, exact height | 5 × 10⁻¹³ m |
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
| `src/core/grid.js` | Fields: grid positions, interpolation, time brackets; computed fields | `core/inference` |
| `src/core/spectral.js` | Spherical harmonics, Gaussian grids, spectral transforms | calx, physis (discretisation) |
| `src/core/barotropic.js` | The barotropic vorticity model; linear balance | `core/domains/meteorology` |
| `src/core/contour.js` | Isolines, highs and lows | `core/domains/geography` |
| `src/core/raster.js` | Polygons to rasters, areas | `core/domains/geography` (GIS) |
| `src/core/flow.js` | Particles carried by a flow on the sphere | physis (kinematics) |
| `src/core/derived.js` | Wind direction, wave group speed | `core/domains/meteorology`, `oceanography` |
| `src/core/units.js` | Units for display | physis (units) |
| `src/core/join.js` | Joins of data to places by key | `core/domains/geography` (GIS) |
| `src/data/products.js` | Reads products from the data library | — |
| `src/layers/` | The catalogue of layers and models; one module per kind of layer; imagery and detail; the laboratory model | `visualization/scene` |
| `src/workers/` | The laboratory model's integration, off the page's main thread | — |
| `src/render/` | The surface shader, lines, markers, labels, relief, colour maps, the stage | `visualization/renderers` |
| `src/ui/` | Panel, timeline, legend, place card | — |

## 7. Limits

- Fields are drawn at the resolution of their product (1° for the default forecasts). Finer profiles exist, at a cost in download.
- The best time series of GFS and AIGFS join past analyses to the latest forecast. Their past is close to analyses; their future is one run's forecast.
- The laboratory model is barotropic. It has little skill in the tropics, and its long waves drift west too fast (it lacks the equivalent-barotropic correction).
- Detail is available for imagery, not yet for relief; ETOPO's server does not allow browsers to fetch it directly.
- Natural Earth draws boundaries by its de facto depiction; disputed boundaries are dashed.
- Climate-model and reanalysis archives (CMIP, ERA5) are not yet registered: ERA5 needs a Copernicus account, and CMIP data are served by ESGF.

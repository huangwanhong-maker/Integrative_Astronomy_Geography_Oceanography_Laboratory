# Earth Atlas

*Status: draft (2026-10-22). Kind: tool. Field: geography (cartography), showing data from meteorology, oceanography, geography and geophysics.* Decision records: [ADR 0014](../../../development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md), [ADR 0015](../../../development/decisions/0015-earth-atlas-models-imagery-detail.md), [ADR 0017](../../../development/decisions/0017-climate-classes-and-normals.md), [ADR 0018](../../../development/decisions/0018-fine-relief-at-close-range.md), [ADR 0019](../../../development/decisions/0019-shallow-water-model.md), [ADR 0022](../../../development/decisions/0022-ai-forecast-cyclones-and-disasters.md).

The Earth Atlas shows the atmosphere, the ocean, the land and the people of the Earth on one globe, at one instant. Each kind of data comes from its own dataset and is joined to the map only here, in the application. Forecasts from several models can be compared: NOAA's, an AI model the laboratory runs itself, and two simple models of our own that run in the page. Tropical cyclones are found in every forecast and set beside their observed tracks and official forecasts, and current disasters are shown by their alert levels. Climates can be read too: their classes from 1901 to 2099, and the normal year of any place. The map itself is one dataset among others, and carries no values but names and places.

## 1. Concepts

- **Separated data.** The data library builds seven kinds of product, each with its own provenance:
  - **geography:** coasts, countries, rivers, places and names (Natural Earth);
  - **fields:** gridded quantities over time (forecasts, analyses, relief, climate normals, or our own model output);
  - **classes:** a category per cell (climate classes, by period and scenario);
  - **indicators:** a value per country and year (World Bank);
  - **events:** points in place and time (earthquakes, from the USGS; disasters with their alert levels, from GDACS);
  - **tracks:** positions over time (tropical cyclones, observed and forecast officially, from GDACS);
  - **imagery:** pictures of the whole Earth (NASA's VIIRS, Blue Marble and Black Marble).
- **Joins.** The atlas joins indicators to countries by stated keys, and reports what does not match.
- **Typed layers.** What can be drawn is set by the shape of the data, not its subject. One of each kind can be shown at once:
  - a **surface:** a field, a value per country, or a class per cell, in colour;
  - a **flow:** a vector field, shown by moving particles;
  - **lines:** isolines, with highs and lows;
  - **events**;
  - **tracks:** several sources at once, so that forecasts of one cyclone can be compared;
  - the **base map:** relief, satellite imagery, or plain; plus forecast clouds, lights at night, coasts, boundaries, rivers, the graticule with the tropics and polar circles, names, and day and night.
- **Fields recognised by standard name and level.** A field with a known CF standard name is drawn in that quantity's style at its level, for example geopotential height at 500 hPa. A field with an unknown one is drawn in a style fitted to its own range.
- **Models as a choice.** The same quantity from several models (GFS, NOAA's AI model AIGFS, the AIGEFS ensemble, Pangu-Weather run by the laboratory, our own two) is one layer with a choice of model.
  - Any two models can be shown as a difference.
  - The place card gives each model's value and draws their courses together, and links to the sky at that place and time in the Celestial Atlas.
  - Ensemble spread is a layer of its own.
- **Climate.**
  - Köppen–Geiger classes for four past periods and two future ones under four emission scenarios (Beck et al. 2023). Any two maps can be compared, which shows where the climate changed class.
  - The atlas also classifies the TerraClimate normals of 1991–2020 itself and offers the result beside the published map.
  - Monthly normals of temperature and precipitation follow the month of the time shown.
  - The place card draws the normal year of any place on land as a climate diagram (Walter and Lieth 1960).
- **An AI model, run here.** Pangu-Weather (Bi et al. 2023), a transformer trained on 39 years of ERA5, runs on the laboratory's computer from the GFS analysis at 0.25° and 13 levels. A week's forecast takes about 40 minutes on the CPU. It becomes a product like the others, and is verified against later analyses beside our own models and persistence.
- **Tropical cyclones.**
  - Each forecast's cyclones are found in its sea-level pressure: a minimum with a closed contour of 2 hPa, linked from time to time (after TempestExtremes; Ullrich and Zarzycki 2017). Each model's tracks are drawn in its colour.
  - The observed track and the official forecast come from GDACS, solid and dashed.
  - At the time shown, each cyclone is labelled with its name and each model's central pressure.
- **Disaster alerts.** GDACS's events of the last month (tropical cyclones, earthquakes, floods, volcanoes, droughts, wildfires) are drawn by alert level. These alerts are automatic, and the atlas is not a warning service.
- **Our own models.** Two models run in the page from the GFS analysis at 500 hPa:
  - the barotropic vorticity equation, that of the first numerical weather prediction (1950);
  - the shallow-water equations, started by a digital filter, which keep divergence and gravity waves and slow the longest waves.

  Both are verified against later analyses and against persistence, side by side.
- **One instant, in UTC.**
  - Each layer shows its data nearest to that instant, and says which time it shows.
  - When that time differs from the instant shown, the legend says by how much, for example "Data from 30 h before the time shown".
- **Detail where you look.** At close range the atlas asks NASA for the region in view at the screen's resolution: imagery down to 250 m per pixel, or, on the relief map, shaded relief from 30 m elevations (ASTER GDEM), which replaces the map's coarser shading on land.

## 2. Running

From the repository root, fetch the data and build the products. This is about 300 MB of downloads; the THREDDS servers can take minutes per request.

```
python data/acquisition/fetch.py natural-earth-50m etopo-2022 gfs oisst ww3 usgs-earthquakes
python data/acquisition/fetch.py gfs-levels aigfs aigefs                  # models aloft and the AI models
python data/acquisition/fetch.py gibs-daily                               # yesterday's Earth from space
python data/acquisition/fetch.py gibs-static --profile blue-marble
python data/acquisition/fetch.py gibs-static --profile black-marble
python data/acquisition/fetch.py gibs-relief                              # fine relief at close range
python data/acquisition/fetch.py worldbank-indicators --profile population    # and other profiles; see --list
python data/acquisition/fetch.py koppen-geiger terraclimate-normals        # climate classes and normals
python data/products/geography.py
for s in etopo-2022 gfs oisst ww3 gfs-levels aigfs aigefs terraclimate-normals; do python data/products/field_grid.py --source $s; done
python data/products/class_raster.py --source koppen-geiger
python data/products/imagery.py --source gibs-daily
python data/products/imagery.py --source gibs-static --profile blue-marble
python data/products/imagery.py --source gibs-static --profile black-marble
python data/products/imagery.py --source gibs-relief
python data/products/country_indicators.py
python data/products/event_catalog.py
python data/acquisition/fetch.py gdacs                                    # disasters and cyclone tracks
python data/products/disaster_catalog.py
python applications/geography/earth-atlas/serve.py --open
```

For the laboratory's AI forecast, in the model environment (see [data/README](../../../data/README.md)), 2.4 GB of weights and 57 MB of analysis:

```
python data/acquisition/fetch.py pangu-weather gfs-analysis-0p25
.venv/Scripts/python data/products/ai_forecast.py --source gfs-analysis-0p25 --hours 168
```

A past analysis gives a hindcast, which `--verify` checks against the analyses that followed. Fetch it with `--set cycle=2026-10-19T00:00`; the fetcher names its folder (`custom-<hash>`), which `ai_forecast.py` takes as `--profile`, with `--name pangu-hindcast`.

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
| Relief of land and sea floor | ETOPO 2022 (NOAA NCEI), 10′, or 5′ with `--profile fine` (the finest is used) | `fields-etopo-2022-medium`, `-fine` | Public domain |
| Wind, temperature, pressure, precipitation, humidity | GFS (NOAA NCEP), via PacIOOS ERDDAP, 1°, every 6 h | `fields-gfs-forecast` | Public domain |
| The atmosphere aloft (850, 500, 250 hPa); cloud, water vapour, CAPE | GFS, via Unidata THREDDS, 1°, every 6 h, three days back | `fields-gfs-levels-forecast` | Public domain |
| An AI forecast: surface, 850, 500 and 250 hPa | AIGFS (NOAA NCEP and EPIC), via Unidata THREDDS, 1° | `fields-aigfs-forecast` | Public domain |
| An AI ensemble: mean and spread | AIGEFS (NOAA), via Unidata THREDDS, 1° | `fields-aigefs-forecast` | Public domain |
| Sea-surface temperature, anomaly, sea ice | OISST v2.1 (NOAA NCEI), via CoastWatch ERDDAP, 0.5°, daily | `fields-oisst-latest` | Public domain |
| Waves: height, period, direction | WaveWatch III (NOAA NCEP), via PacIOOS ERDDAP, 1°, every 6 h | `fields-ww3-forecast` | Public domain |
| The Earth from space, by day and by night | NASA GIBS: VIIRS true colour, Blue Marble, Black Marble, 8192 × 4096 | `imagery-*` | NASA, acknowledge |
| Shaded relief of the land, for close range | NASA GIBS, from ASTER GDEM v3 (METI and NASA), 1″ | `imagery-relief-shading` | NASA, acknowledge |
| Country indicators (11) | World Bank, World Development Indicators | `indicator-*` | CC BY 4.0 |
| Earthquakes | USGS ComCat, magnitude 4.5 and above | `events-usgs-earthquakes-*` | Public domain |
| An AI forecast run here: surface, 850, 500 and 250 hPa, 1°, every 6 h, a week | Pangu-Weather (Bi et al. 2023), from the GFS analysis at 0.25° (NOAA NCEP, NOMADS) | `fields-pangu-forecast`, `fields-pangu-hindcast` | Weights CC BY-NC-SA 4.0: learning and research only |
| Disasters of the last month, with alert levels; cyclone tracks, observed and forecast | GDACS (UN and EC JRC), relaying the warning centres | `events-gdacs-month`, `tracks-gdacs-month` | No reuse licence stated: fetched, not redistributed |
| Climate classes, 1901–2099 | Köppen–Geiger maps of Beck et al. (2023), 0.1°: 1901–1930, 1931–1960, 1961–1990, 1991–2020; 2041–2070 and 2071–2099 under SSP1-2.6, SSP2-4.5, SSP3-7.0 and SSP5-8.5 | `classes-koppen-geiger-*` | CC BY 4.0 |
| Climate normals, 1991–2020 | TerraClimate (Abatzoglou et al. 2018), monthly daily maximum and minimum temperature and precipitation, every 1/3°, via OPeNDAP | `fields-terraclimate-normals-medium` | CC0 |

The ERDDAP servers add: "The data may be used and redistributed for free but is not intended for legal use, since it may contain inaccuracies." Citations are in each manifest in [data/registry](../../../data/registry/), and in the atlas under *Data*.

## 4. Method

| Topic | Method | Source |
|---|---|---|
| Interpolation | Bilinear in space and linear in time. Beside missing values, the valid neighbours are used if they carry at least half the weight. Directions are interpolated through unit vectors. The GPU and the readout use the same rule. | `src/core/grid.js` |
| Flat maps | Equal Earth, equal-area, as the default. Equirectangular shows the data grid as it is. | Šavrič, Patterson and Jenny (2018); [theory note](../../../theory/geography/equal-area-maps.md) |
| Particles | The midpoint rule on the sphere, with parallel transport. Exact for flow along a great circle; second-order otherwise. | `src/core/flow.js`, [theory note](../../../theory/meteorology/particles-on-the-sphere.md) |
| Wave energy | Deep-water group speed c_g = g T / 4π, along the peak direction | Holthuijsen (2007); [theory note](../../../theory/oceanography/wave-energy-propagation.md) |
| Our models | Spectral transform method at T42 (Gaussian grid 128 × 64, FFTs in longitude), Runge–Kutta 4 and ∇⁴ damping. The barotropic vorticity equation in steps of 30 min, heights from linear balance added as changes to the analysis. The shallow-water equations in vorticity–divergence form, in steps of 15 min, from the analysed wind and height after a digital filter of six hours. | `src/core/spectral.js`, `src/core/barotropic.js`, `src/core/shallowwater.js`; theory notes on the [barotropic](../../../theory/meteorology/barotropic-vorticity-model.md) and [shallow-water](../../../theory/meteorology/shallow-water-model.md) models |
| AI forecast | Pangu-Weather's 24 h and 6 h models (ONNX, onnxruntime on the CPU), composed by hierarchical temporal aggregation in the fewest steps; geopotential as height times 9.80665 m s⁻²; every fourth point kept for 1° | Bi et al. (2023); `data/products/ai_forecast.py`; [theory note](../../../theory/meteorology/learned-forecast-models.md) |
| Tropical cyclones | A sea-level pressure minimum, lowest within 6°, with a pressure rise of 2 hPa within 5.5° along 16 rays; placed between grid points by a paraboloid; linked within 8° per 6 h, nearest pairs first; kept if it lasts 24 h, deepens to 1000 hPa and begins over the sea within 25° of the equator | Ullrich and Zarzycki (2017); `src/core/cyclones.js`; [theory note](../../../theory/meteorology/tropical-cyclone-tracking.md) |
| Model comparison | Differences on a diverging scale fitted to the 98th percentile over the shared forecast. The model's verification is the root-mean-square height error over 20–80° N, against analyses and against persistence. | `src/layers/surface.js`, `src/layers/labmodel.js` |
| Day and night | Subsolar point from the Astronomical Almanac's low-precision Sun. Sunrise at −0.833°; civil, nautical and astronomical twilight at −6°, −12° and −18°. Lights from the Black Marble on the night side. | [theory note](../../../theory/astronomy/subsolar-point-and-twilight.md) |
| Imagery and detail | Global images at 8192 × 4096. Gaps in a daily mosaic are filled from the day before; where imagery has none, the relief shows. At close range, a WMS request covers the region in view at the screen's resolution. | `data/products/imagery.py`, `src/layers/imagery.js` |
| Isolines | Marching squares, saddles resolved by the cell mean. Highs and lows are extrema over a neighbourhood with a stated prominence (heights outside the tropics only). | `src/core/contour.js` |
| Countries | Scanline rasterisation, even-odd rule, 4096 × 2048. Joins to indicators by stated keys. | `src/core/raster.js`, `src/core/join.js` |
| Relief | Hypsometric tints, and Lambert shading from the north-west at 45°, exaggerated 14× for a 10′ grid and in proportion to the grid's spacing (7× on the 5′ grid), with the darkening limited; painted at 8192 × 4096 in a worker. At close range, on land, ASTER's fine shading replaces it; water is the uniform grey of the shading where a whole neighbourhood has it. | Imhof (1982); `src/render/relief.js`, `src/core/raster.js` |
| Colour maps | cmocean (Thyng et al. 2016, MIT licence), and the laboratory's own orchid map, with lightness rising evenly | `src/render/colormaps.js` |
| Climate classes | Köppen–Geiger after Peel et al. (2007) and Beck et al. (2018): B first, summer the warmer half-year. Classes are read from the cell containing a place, never interpolated. Colours are the conventional ones, softened in OKLab. | `src/core/climate.js`, `src/render/classes.js`; [theory note](../../../theory/climate/koppen-geiger-classification.md) |
| Climate diagram | Walter and Lieth (1960): 10 °C level with 20 mm; dry months (P ≤ 2T, Gaussen) dotted, humid hatched, above 100 mm a tenfold scale; frost months marked; from July south of the equator | `src/ui/climate.js` |
| Conventions | Wind direction is where it blows from. Times in UTC. Values stored in their source units and converted only for display (vorticity in 10⁻⁵ s⁻¹). | `src/core/derived.js`, `src/core/units.js` |

## 5. Verification

```
node applications/geography/earth-atlas/tests/run-tests.mjs
```

There are 114 checks. The checks on real data need the products; without them they are skipped.

| Quantity | Reference | Agreement |
|---|---|---|
| Subsolar point, 20 instants 1955–2045 | JPL Horizons: apparent RA and Dec, and apparent sidereal time | 0.007° in longitude, 0.004° in latitude |
| GMST | Meeus, example 12.a | 0.0003″ |
| Equal Earth | Round trip; area scale constant; axis ratio 2.05 | 3 × 10⁻¹² °; 2 × 10⁻¹⁰; 2.0546 |
| Spherical harmonics, T42 | Normalisation; analysis of a synthesis; curl and divergence of a non-divergent wind | 1 × 10⁻¹⁴; 1 × 10⁻¹⁴; 6 × 10⁻¹⁵ |
| Barotropic model | Rossby–Haurwitz wave after one day (Haurwitz 1940), amplitude and phase speed | 7 × 10⁻¹⁰ |
| Barotropic model | Energy and enstrophy over a day of random flow | 2 × 10⁻⁶ and 3 × 10⁻⁵ |
| Linear balance | Zonal flow, exact height | 5 × 10⁻¹³ m |
| Shallow-water model | Williamson et al. (1992) case 2, steady flow about the pole and across the poles, one day | 7 × 10⁻¹⁵ and 1 × 10⁻¹⁴ |
| Shallow-water model | Mass; total energy over a day of unbalanced flow | 6 × 10⁻¹⁶; 6 × 10⁻⁹ |
| Shallow-water model | Gravity wave of degree 5 on a non-rotating sphere: period √(gH n(n + 1))/a (Lamb 1932) | 3 × 10⁻⁶ after a period |
| Digital filter | Waves of 1.7 h and 46 h | Amplitudes 0.003 and 0.99 |
| FFT | Direct sum, 64 points | 1 × 10⁻¹³ |
| Bilinear interpolation | Linear fields, exact | 6 × 10⁻¹⁴ |
| Isolines | A circle: points on the level; closed; length 2πr | Within 4 × 10⁻⁴ °; closed; length within 7 × 10⁻⁵ |
| Particles | Uniform flow along the equator; solid-body rotation, 2000 steps | Exact; latitude kept to 8 × 10⁻⁶ ° |
| Rasterised land | Polygon area by the shoelace formula on the cylindrical equal-area plane | Within 8 × 10⁻⁶ of the sphere |
| Joins | Natural Earth to World Bank | 219 of 242 countries; only Gibraltar unmatched |
| Water in shaded relief | A lake and lone pixels of the water's grey | The lake whole, to its edge; no lone pixel |
| Köppen–Geiger rules | Fifteen climates constructed for one rule each, including the precedence of B and both resolutions of s and w; all 30 classes reachable | Exact |
| Köppen–Geiger symmetry | Invariance under (S₆ × S₆) ≀ ℤ/2, permutations within each half-year and their exchange, on 4000 random climates | Exact |
| Our classes | Beck et al. (2023), 1991–2020, at the 195 203 land cells of the TerraClimate grid | 89.1 % of cells; 95.9 % by main group |
| Cyclone detection | A Gaussian low of 933 hPa on a 1° grid; a trough open at its ends | Position 0.02°, pressure 0.5 hPa; no candidate in the trough |
| Cyclone tracks | A cyclone moving for two days; lows born at 35° N, over land, or never deeper than 1000 hPa | One track of 9 positions; the others left out |

Fetch the reference values again with `python applications/geography/earth-atlas/tests/fetch_fixtures.py`.

## 6. Structure

The computation in `src/core/` is a provisional stand-in for the laboratory's C++ core ([ADR 0011](../../../development/decisions/0011-first-application-celestial-atlas.md), [ADR 0014](../../../development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md)).

| Path | Role | Stands in for |
|---|---|---|
| `src/core/sphere.js` | Places, directions, distances, great circles | `core/domains/geodesy` |
| `src/core/sun.js` | The Sun's position, subsolar point, altitude, twilight | `core/domains/astronomy` |
| `src/core/projections.js` | Equal Earth and equirectangular, forward and inverse | `core/domains/geography` (cartography) |
| `src/core/grid.js` | Fields: grid positions, interpolation, time brackets, climatological months; computed fields; class maps | `core/inference` |
| `src/core/spectral.js` | Spherical harmonics, Gaussian grids, spectral transforms, the FFT | calx, physis (discretisation) |
| `src/core/barotropic.js` | The barotropic vorticity model; linear balance | `core/domains/meteorology` |
| `src/core/shallowwater.js` | The shallow-water model; digital-filter initialisation | `core/domains/meteorology` |
| `src/core/cyclones.js` | Tropical cyclones: detection, linking, positions between times | `core/domains/meteorology` |
| `src/core/climate.js` | Köppen–Geiger classes; dry months after Gaussen | `core/domains/climate` (zones) |
| `src/core/contour.js` | Isolines, highs and lows | `core/domains/geography` |
| `src/core/raster.js` | Polygons to rasters, areas | `core/domains/geography` (GIS) |
| `src/core/flow.js` | Particles carried by a flow on the sphere | physis (kinematics) |
| `src/core/derived.js` | Wind direction, wave group speed | `core/domains/meteorology`, `oceanography` |
| `src/core/units.js` | Units for display | physis (units) |
| `src/core/join.js` | Joins of data to places by key | `core/domains/geography` (GIS) |
| `src/data/products.js` | Reads products from the data library | — |
| `src/layers/` | The catalogue of layers and models; one module per kind of layer; imagery and detail; the laboratory model | `visualization/scene` |
| `src/workers/` | The laboratory models' integration and the painting of the base map, off the page's main thread | — |
| `src/render/` | The surface shader, lines, markers, labels, relief, colour maps, colours of classes, the stage | `visualization/renderers` |
| `src/ui/` | Panel, timeline, legend, place card, climate diagram | — |

## 7. Limits

- Fields are drawn at the resolution of their product (1° for the default forecasts). Finer profiles exist, at a cost in download.
- The best time series of GFS and AIGFS join past analyses to the latest forecast. Their past is close to analyses; their future is one run's forecast.
- The laboratory models have one layer and no topography, moisture or heating. The barotropic model's long waves drift west too fast; the shallow-water model corrects much of that, but neither represents the growth of storms, which needs several levels (the next idea: a primitive-equation model).
- Cyclone intensities are those of 1° fields, well above the true central pressures; Pangu-Weather underestimates intensity further, as its authors report. Tracks are the more trustworthy part.
- The cyclone tracker has no warm-core test, so a strong monsoon depression may be counted.
- The AI forecast starts from the GFS analysis, not the ERA5 it was trained on, and is verified against GFS analyses, which favours forecasts close to the GFS.
- Fine relief is ASTER's shading, a picture: its elevations are not read, so tints stay those of the 5′ grid. ASTER covers land between about 83° N and 83° S; elsewhere, and on the sea floor, the ETOPO shading remains.
- Glaciers are drawn from Natural Earth's 1:50 m outlines, coarser than the fine relief.
- Natural Earth draws boundaries by its de facto depiction; disputed boundaries are dashed.
- Climate classes are shown at 0.1°, about 11 km; Beck et al.'s maps exist at 1 km. The TerraClimate normals are point samples every 1/3°, not area means, and have no values over the sea.
- The future maps show the classes of an ensemble-mean climate, not the spread among models.
- Climate-model and reanalysis archives (CMIP, ERA5) are not yet registered: ERA5 needs a Copernicus account, and CMIP data are served by ESGF.

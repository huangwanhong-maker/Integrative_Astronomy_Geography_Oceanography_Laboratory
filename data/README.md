# data: Acquisition, Registry and Provenance

*Status: draft.* An edge of the architecture. Written in Python first, using the standard library (with numpy in product builders), with C++ readers later where performance matters.

## 1. Purpose

This directory finds, downloads or queries, verifies and records the external data the project uses. It then hands the data to the core and the applications as local files. The core never fetches data itself.

A user chooses **which** data to take and **how much** of it ([ADR 0012](../development/decisions/0012-selectable-parameterised-datasets.md)):

- a dataset is chosen by its manifest;
- the part and the amount are chosen by the manifest's parameters and named profiles.

Data of different kinds are kept apart ([ADR 0014](../development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md)):

- a base map carries geometry, identifiers and names, and no values about the places it draws;
- values come as their own products, and applications join them to places by stated keys.

## 2. Modules

| Module | Scope | Status |
|---|---|---|
| [`registry/`](registry/) | One manifest per dataset: source, licence, checksum or query, parameters, profiles. The schema is in its README. | draft |
| [`acquisition/`](acquisition/) | `fetch.py`: fixed files, catalogue queries, gridded subsets and web requests into `data/cache/`, with `retrieval.json`. `erddap.py`: a client for ERDDAP's griddap. `ncss.py`: a client for THREDDS's NetCDF Subset Service. | draft |
| [`catalogs/`](catalogs/) | `tap.py`: a minimal client for the IVOA Table Access Protocol, used for ESA Gaia, CDS VizieR and SIMBAD | draft |
| [`formats/`](formats/) | Readers: netCDF classic (`netcdf3.py`). FITS, netCDF-4/HDF5 and Zarr are planned. | draft |
| [`products/`](products/) | Derived artefacts, built reproducibly from registered datasets, and their index `index.json` (§4) | draft |
| `provenance` | Records of which data and which code produced each result. For now this is `retrieval.json` for each retrieval, and a `source` block in each product. | seed |

## 3. Usage

From the repository root:

```
python data/acquisition/fetch.py --list                          # what can be fetched, with parameters
python data/acquisition/fetch.py                                 # every fixed-file dataset
python data/acquisition/fetch.py gaia-dr3 --profile small        # a catalogue query, by profile
python data/acquisition/fetch.py gaia-dr3 --set g_max=9.5        # ... or with parameters overridden
python data/acquisition/fetch.py gfs                             # the latest weather forecast (ERDDAP)
python data/acquisition/fetch.py worldbank-indicators --profile life-expectancy
python data/products/star_catalog.py                             # build products (§4)
python data/products/field_grid.py --source gfs
python data/acquisition/fetch.py gfs-levels aigfs                # forecast models aloft (THREDDS)
python data/products/imagery.py --source gibs-daily             # yesterday's Earth from space
python data/products/body_maps.py                                # maps of the planets and the sky
```

The cache, `data/cache/`, is not under version control.

## 4. Products

Products are written to `data/cache/products/` and listed by kind in `index.json`, which applications read.

| Kind | Builder | Content | Format |
|---|---|---|---|
| `stars` | `star_catalog.py` | Stars from HYG or Gaia: position, magnitude, colour, distance | `.bin` (float32 records) and `.json` |
| `galaxies` | `galaxy_catalog.py` | Galaxies of the Local Volume (UNGC) and 2MRS groups, in supergalactic coordinates | `.json`, or `.bin` and `.json` |
| `geography` | `geography.py` | The base map: countries (with several systems of codes and names in 26 languages), land, lakes, glaciers, ice shelves, sea names, coastlines, boundaries, rivers, places. No thematic values. | `.bin` (float32 longitude–latitude pairs) and `.json` (features referring to runs of pairs) |
| `fields` | `field_grid.py` | Variables on a regular longitude–latitude grid, over time: forecasts, analyses, relief, or our own netCDF files. Rows run north to south; global grids start at 180° W; values in their source units. | `.bin` (int16, a linear scale per variable) and `.json` (grid, times, CF metadata, statistics) |
| `indicators` | `country_indicators.py` | A value per economy and year, keyed by World Bank codes with ISO alpha-2; aggregates kept apart | `.json` |
| `events` | `event_catalog.py` | Events at a place and an instant: time, longitude, latitude, depth, magnitude | `.json` |
| `imagery` | `imagery.py`, `body_maps.py` | Equirectangular images with a role. The Earth (`day`, `night-lights`): true colour of a day (gaps filled from the day before), the Blue Marble, the Black Marble, with the provider's service for detail. Other bodies (`body`), Saturn's rings (`rings`, a radial strip) and the whole sky in galactic coordinates (`sky`, its orientation checked against bright stars). | `.jpg` or `.png`, and `.json` |

## 5. Datasets

### 5.1 Registered

| Dataset | Kind | Provider | Use |
|---|---|---|---|
| `jpl-de440s` | files | NASA JPL / NAIF | Positions of the Sun, Moon and planets, 1849–2150 |
| `hyg-v41` | files | Hipparcos, Yale, Gliese (compiled by D. Nash) | Stars to about magnitude 7.5 |
| `d3-celestial-constellations` | files | O. Frohn | Constellation figures and names |
| `gaia-dr3` | tap | ESA Gaia (DPAC); distances from Bailer-Jones et al. 2021 | Stars with parallaxes, brightest first |
| `ungc` | tap | Karachentsev et al. 2013, via CDS VizieR | Galaxies of the Local Volume, with tidal indices |
| `tully-2mass-groups` | tap | Tully 2015 and Huchra et al. 2012, via CDS VizieR | Galaxy groups of the 2MASS Redshift Survey |
| `natural-earth-50m` | files | Natural Earth, v5.1.2 | The base map of the Earth |
| `etopo-2022` | griddap | NOAA NCEI, via CoastWatch ERDDAP | Relief of land and sea floor, 15″ source grid |
| `gfs` | griddap | NOAA NCEP, via PacIOOS ERDDAP | Weather: analyses and forecasts of wind, temperature, pressure, precipitation, humidity, radiation |
| `oisst` | griddap | NOAA NCEI (OISST v2.1), via CoastWatch ERDDAP | Daily sea-surface temperature, anomaly and sea ice |
| `ww3` | griddap | NOAA NCEP (WaveWatch III), via PacIOOS ERDDAP | Ocean waves: height, period, direction |
| `worldbank-indicators` | http | The World Bank | Indicators by country and year: population, economy, health, energy, emissions |
| `usgs-earthquakes` | http | USGS ComCat | Earthquakes by time, place, depth and magnitude |
| `gfs-levels` | ncss | NOAA NCEP, via Unidata THREDDS | GFS aloft (850, 500, 250 hPa) and over the column (cloud, water vapour, CAPE) |
| `aigfs` | ncss | NOAA NCEP and EPIC, via Unidata THREDDS | NOAA's AI global forecast model, near the surface and aloft |
| `aigefs` | ncss | NOAA NCEP and EPIC, via Unidata THREDDS | NOAA's AI ensemble: mean and spread |
| `gibs-daily` | http | NASA GIBS | Yesterday's Earth from VIIRS, true colour |
| `gibs-static` | http | NASA GIBS | The Blue Marble by day, the Black Marble by night |
| `solar-system-maps` | files | Solar System Scope (INOVE), from NASA, JPL and ESA data, via Wikimedia Commons | Maps of the Sun, the Moon, the planets, Saturn's rings and the Milky Way |

### 5.2 Planned

| Dataset | Provider | Use |
|---|---|---|
| Earth-orientation parameters, leap seconds | IERS | Time scales and reference frames |
| Tide-gauge records and predictions | NOAA CO-OPS | Tidal analysis and validation |
| Cosmicflows-4 distances and peculiar velocities | Tully et al. 2023, via VizieR | Flows of galaxies |
| ERA5 reanalysis | ECMWF / Copernicus (needs an account) | The atmosphere's past, hourly since 1940 |
| CMIP6 climate projections | ESGF | Simulated climates, by scenario |
| Ocean currents (OSCAR or CMEMS) | NASA / Copernicus | Surface currents, as a flow |
| Landsat, Sentinel-2 | USGS / NASA, ESA | Remote sensing of the land surface |
| OpenStreetMap, GHSL, WorldPop | OSM contributors, JRC, WorldPop | Settlement, land use, population on a grid |

## 6. Licences

Each dataset keeps its own licence, which its manifest records. The project's MIT licence does not cover datasets.

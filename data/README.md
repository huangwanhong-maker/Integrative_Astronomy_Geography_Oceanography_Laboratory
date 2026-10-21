# data: Acquisition, Registry and Provenance

*Status: draft.* An edge of the architecture. Written in Python first, using the standard library only, with C++ readers later where performance matters.

## 1. Purpose

This directory finds, downloads or queries, verifies and records the external data the project uses. It then hands the data to the core and the applications as local files. The core never fetches data itself.

A user chooses **which** data to take and **how much** of it ([ADR 0012](../development/decisions/0012-selectable-parameterised-datasets.md)):

- a dataset is chosen by its manifest;
- the part and the amount are chosen by the manifest's parameters and named profiles.

## 2. Modules

| Module | Scope | Status |
|---|---|---|
| [`registry/`](registry/) | One manifest per dataset: source, licence, checksum or query, parameters, profiles. The schema is in its README. | draft |
| [`acquisition/`](acquisition/) | `fetch.py`: downloads fixed files and runs catalogue queries into `data/cache/`, and writes `retrieval.json` | draft |
| [`catalogs/`](catalogs/) | `tap.py`: a minimal client for the IVOA Table Access Protocol, used for ESA Gaia, CDS VizieR and SIMBAD | draft |
| [`products/`](products/) | Derived artefacts built reproducibly from registered datasets: `star_catalog.py`, `galaxy_catalog.py`, and the product index `index.json` | draft |
| `formats` | Readers and writers for FITS, SPICE, NetCDF (CF conventions), HDF5, Zarr | planned |
| `provenance` | Records of which data and which code produced each result. For now this is `retrieval.json` for each dataset. | seed |

## 3. Usage

From the repository root:

```
python data/acquisition/fetch.py --list                          # what can be fetched, with parameters
python data/acquisition/fetch.py                                 # every fixed-file dataset
python data/acquisition/fetch.py gaia-dr3 --profile small        # a catalogue query, by profile
python data/acquisition/fetch.py gaia-dr3 --set g_max=9.5        # ... or with parameters overridden
python data/products/star_catalog.py                             # HYG star product
python data/products/star_catalog.py --source gaia-dr3 --profile small
python data/products/galaxy_catalog.py --source ungc
python data/products/galaxy_catalog.py --source tully-2mass-groups
```

The cache, `data/cache/`, is not under version control.

## 4. Datasets

### 4.1 Registered

| Dataset | Kind | Provider | Use |
|---|---|---|---|
| `jpl-de440s` | files | NASA JPL / NAIF | Positions of the Sun, Moon and planets, 1849–2150 |
| `hyg-v41` | files | Hipparcos, Yale, Gliese (compiled by D. Nash) | Stars to about magnitude 7.5 |
| `d3-celestial-constellations` | files | O. Frohn | Constellation figures and names |
| `gaia-dr3` | tap | ESA Gaia (DPAC); distances from Bailer-Jones et al. 2021 | Stars with parallaxes, brightest first |
| `ungc` | tap | Karachentsev et al. 2013, via CDS VizieR | Galaxies of the Local Volume, with tidal indices |
| `tully-2mass-groups` | tap | Tully 2015 and Huchra et al. 2012, via CDS VizieR | Galaxy groups of the 2MASS Redshift Survey |

### 4.2 Planned

| Dataset | Provider | Use |
|---|---|---|
| Earth-orientation parameters, leap seconds | IERS | Time scales and reference frames |
| Tide-gauge records and predictions | NOAA CO-OPS | Tidal analysis and validation |
| Cosmicflows-4 distances and peculiar velocities | Tully et al. 2023, via VizieR | Flows of galaxies |
| GEBCO bathymetry, Copernicus DEM | GEBCO, ESA | Ocean depth and terrain |
| ERA5 reanalysis | ECMWF / Copernicus | Atmospheric state |
| Landsat, Sentinel-2 | USGS / NASA, ESA | Remote sensing of the land surface |
| OpenStreetMap, GHSL, WorldPop | OSM contributors, JRC, WorldPop | Settlement, land use, population |

## 5. Licences

Each dataset keeps its own licence, which its manifest records. The project's MIT licence does not cover datasets.

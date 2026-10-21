# data: Acquisition, Registry and Provenance

*Status: draft.* This directory is an edge of the system. It is written in Python first, with C++ readers where performance matters.

## 1. Purpose

This directory finds, downloads, verifies and records the external data that the project uses. It then hands the data to the core as local files or arrays. The core never fetches data itself.

## 2. Modules

| Module | Scope | Status |
|---|---|---|
| [`registry/`](registry/) | One manifest per dataset: source, version, licence, checksum, citation | draft |
| [`acquisition/`](acquisition/) | `fetch.py`: downloads into `data/cache/`, verifies the files against their recorded checksums, and writes `retrieval.json` | draft |
| [`products/`](products/) | Derived artefacts built reproducibly from registered datasets, such as `star_catalog.py` | draft |
| `formats` | Readers and writers for FITS, SPICE kernels, NetCDF (CF conventions), HDF5, Zarr and CSV | planned |
| `catalogs` | Queries to remote services: JPL Horizons, the Virtual Observatory (TAP/ADQL), NOAA CO-OPS, the Copernicus Climate Data Store | planned |
| `provenance` | Records of which data and which code produced each result. For now this is `retrieval.json` for each dataset. | seed |

## 3. Usage

From the repository root:

```
python data/acquisition/fetch.py                 # every registered dataset
python data/acquisition/fetch.py jpl-de440s      # selected datasets
python data/acquisition/fetch.py --record        # record checksums of a first retrieval
python data/products/star_catalog.py             # derived star catalogue
```

The cache, `data/cache/`, is not under version control.

## 4. Datasets

| Dataset | Provider | Use | Registered |
|---|---|---|---|
| DE440 ephemeris (`de440s.bsp`) | NASA JPL / NAIF | Positions of the Sun, the Moon and the planets | yes |
| HYG v4.1 | Hipparcos, Yale, Gliese (compiled by D. Nash) | Stars | yes |
| d3-celestial constellations | O. Frohn | Constellation figures and names | yes |
| Earth-orientation parameters, leap seconds | IERS | Time scales and reference frames | — |
| Tide-gauge records and predictions | NOAA CO-OPS | Tidal analysis and validation | — |
| GEBCO bathymetry | GEBCO | Ocean depth for tide models | — |
| ERA5 reanalysis | ECMWF / Copernicus | Atmospheric state; surface forcing for ocean models | — |
| Radiosonde profiles (IGRA) | NOAA NCEI | Vertical structure of the atmosphere | — |
| Gaia DR3 | ESA | Stars beyond Hipparcos | — |
| Planetary surfaces | NASA SVS, USGS Astrogeology | Textures and topography | — |
| Copernicus DEM, SRTM | ESA / Copernicus, NASA | Terrain for geography and tide models | — |
| Natural Earth | Natural Earth | Cartographic vector data | — |
| Landsat, Sentinel-2 | USGS / NASA, ESA / Copernicus | Remote sensing of the land surface | — |
| OpenStreetMap | OpenStreetMap contributors (ODbL) | Settlement, land use, transport | — |
| GHSL, WorldPop | European Commission JRC, WorldPop | Population and built-up area | — |

## 5. Licences

Each dataset keeps its own licence, which its manifest records. The project's MIT licence does not cover datasets.

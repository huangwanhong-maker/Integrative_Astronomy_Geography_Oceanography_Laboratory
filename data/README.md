# data: Acquisition, Registry and Provenance

*Status: planned.* Edge. Written in Python first, with C++ readers where performance matters.

## 1. Purpose

This directory finds, downloads, verifies and records the external data that the project uses. It then hands the data to the core as local files or arrays. The core never fetches data itself.

## 2. Planned Modules

| Module | Scope |
|---|---|
| `registry` | One manifest per dataset, recording its source, version, licence, checksum, citation and retrieval date |
| `acquisition` | Downloading and caching. Caches live outside version control. |
| `formats` | Readers and writers for FITS, SPICE kernels, NetCDF (CF conventions), HDF5, Zarr and CSV |
| `catalogs` | Queries to remote services: JPL Horizons, the Virtual Observatory (TAP/ADQL), NOAA CO-OPS, the Copernicus Climate Data Store |
| `provenance` | Records of which data and which code produced each result |

## 3. Initial Datasets

| Dataset | Provider | Use |
|---|---|---|
| DE440 / DE441 ephemerides | NASA JPL | Positions of the Sun, the Moon and the planets |
| Earth-orientation parameters, leap seconds | IERS | Time scales and reference frames |
| Tide-gauge records and predictions | NOAA CO-OPS | Tidal analysis and validation |
| GEBCO bathymetry | GEBCO | Ocean depth for tide models |
| ERA5 reanalysis | ECMWF / Copernicus | Atmospheric state; surface forcing for ocean models |
| Radiosonde profiles (IGRA) | NOAA NCEI | Vertical structure of the atmosphere |
| Gaia DR3 | ESA | Stars for visualization |
| Planetary surfaces | NASA SVS, USGS Astrogeology | Textures and topography |

## 4. Licences

Each dataset keeps its own licence, which its manifest records. The project's MIT licence does not cover datasets.

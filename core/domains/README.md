# domains: Fields and the Bridges Between Them

*Status: planned.* This is layer 2 of `core/`.

## 1. Purpose

This layer applies the physics and mathematics below it to particular bodies and systems.

- **Fields** are the established subjects, such as astronomy and oceanography.
- **Bridges** are topics that join two or more fields, such as tides.

Fields and bridges are siblings in this directory. A bridge declares the fields it joins, and depends on them.

## 2. Planned Modules

| Module | Kind | Scope |
|---|---|---|
| `astronomy` | field | Positional astronomy. Ephemerides, with an evaluator for the JPL DE format. Astrometry and image reduction. Later, astrophysics and cosmology. |
| `oceanography` | field | Physical oceanography: circulation and waves. Seawater thermodynamics (TEOS-10). Chemical and biological oceanography, including biogeochemistry. Seafloor and bathymetry. |
| `atmosphere` | field | Atmospheric dynamics. Moist thermodynamics, clouds and precipitation. Radiation budget. Boundary layer. Atmospheric chemistry. Weather analysis and prediction. |
| `geodesy` | field | Figure of the Earth. Gravity field and geoid. Earth rotation. Coordinate reference systems. |
| `tides` | bridge: astronomy, geodesy, oceanography, atmosphere | Tide-generating potential. Equilibrium tide. Doodson arguments and tidal constituents. Tidal analysis and prediction. Dynamic tides. Atmospheric tides. |
| `navigation` | bridge: astronomy, geodesy | Celestial navigation and sight reduction. Dead reckoning. Later, GNSS. |
| `air_sea` | bridge: atmosphere, oceanography | Fluxes of momentum, heat, freshwater and gases across the sea surface. Wind waves. |
| `climate` | bridge: atmosphere, oceanography, astronomy | The coupled system. Energy balance. Variability, such as ENSO and the monsoons. Orbital forcing (Milankovitch cycles). Later, the cryosphere and land. |

Ocean and atmosphere are treated as one coupled system ([ADR 0007](../../development/decisions/0007-atmosphere-and-ocean-as-coupled-system.md)). The fluid dynamics they share lives in the physis library, module `continuum`. What passes between them is handled by the `air_sea` and `climate` bridges.

## 3. Reference Models

Mature, open models and products show how fluid dynamics, chemistry, radiation and observations are combined in practice:

- **Ocean:**
  - the models MITgcm, MOM6, NEMO, ROMS, FESOM and Oceananigans.jl;
  - the ECCO ocean state estimate.
- **Atmosphere and coupled system:**
  - WRF, MPAS and ICON;
  - the Earth-system models CESM and E3SM;
  - the ERA5 reanalysis;
  - machine-learning weather models, such as GraphCast and ECMWF's AIFS.

We study them, reimplement their algorithms in this framework where useful, and validate our results against them. Reimplementing an algorithm is always allowed. Copying their code requires that their licence be compatible with ours ([idea](../../development/ideas/2026-10-21-learning-from-ocean-models.md)).

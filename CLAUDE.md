# CLAUDE.md

This file guides Claude Code in the repository of the Integrative Astronomy, Geography, Oceanography Laboratory ("the laboratory"). It records the project's purpose, design philosophy, architecture and working conventions.

This file can be revised: when a decision recorded here changes, update this file in the same change.

- The detailed design is in [docs/architecture.md](docs/architecture.md).
- Decisions and the reasons for them are in [development/decisions/](development/decisions/).
- Each library under `lib/` has its own CLAUDE.md, which governs work inside that library.

## 1. Purpose and Scope

This is an integrated programme to learn, use and research astronomy, geography, oceanography and meteorology, in both theory and practice. Geometry, mathematics and physics are the shared foundation.

- **One body of knowledge.** These fields are treated as connected, not as separate subjects. They are the fields of `core/domains/` ([ADR 0010](development/decisions/0010-domain-organised-fields-and-applications.md)).
- **Geography** covers all its branches: physical geography, cartography and GIS, remote sensing, human geography, and others as the work requires.
- **Meteorology** is taken in the broad sense of atmospheric science. Ocean and atmosphere are studied as one coupled system ([ADR 0007](development/decisions/0007-atmosphere-and-ocean-as-coupled-system.md)).
- **Geodesy** supports all four fields.
- **Bridges.** Tides, navigation, air–sea interaction and climate bridge the fields.
- **Future fields.** Others, such as geophysics and the cryosphere, may join as the work grows.

The project serves three activities. Every artefact should make clear which one it serves.

- **Learning:** derivations, worked examples and expositions, written to be understood.
- **Use:** tested computational tools whose numbers can be relied on, such as ephemerides, frame transformations and tidal predictions.
- **Research:** open questions, experiments and new results, built on the first two.

*Rationale.* The fields share their foundations:

- spherical geometry and coordinate systems;
- the rotation group;
- potential theory and harmonic analysis;
- the dynamics of rotating, stratified fluids.

They also meet in concrete phenomena:

- tides;
- celestial navigation;
- the figure of the Earth and the mapping of its surface;
- the exchange of heat, momentum and water between ocean and atmosphere;
- the astronomical forcing of climate.

Studying them together makes these connections explicit.

## 2. Design Philosophy

The project will grow over a long time and will change direction as new ideas emerge. Its governing principle is **modular, extensible, revisable**.

### 2.1 Modularity

- The project consists of layers, with acyclic dependencies that point downward (§3).
- General layers are independent libraries, each in its own repository.
- Each domain, cross-domain topic and component is a module. A module states its purpose, declares its dependencies and exposes a public interface.
- Modules use each other only through their public interfaces.

### 2.2 Extensibility

- Adding a field, topic, method, device or presentation technique means adding a module, not editing existing ones.
- Computing devices and presentation media keep changing. In both places, a stable, device-neutral representation separates *what* from *how*, and each technology is a pluggable backend (§3.4, §3.5).
- Own the interfaces and borrow the implementations: mature external libraries may sit behind the project's interfaces.
- Prefer small, composable units. Introduce an abstraction only after its pattern has appeared twice.

### 2.3 Revisability

- Every module, note and model carries a status:
  - `planned`: named in the architecture, with no content yet;
  - `seed`: an idea, possibly wrong;
  - `draft`: being worked out;
  - `stable`: tested and relied upon;
  - `deprecated`: superseded, and kept with a pointer to its replacement.
- Significant decisions go into the decision log (§6.3).
- Prefer reversible choices, and mark provisional ones where they are made.
- Capture ideas early (§6.2) and promote them once they mature.

### 2.4 Unity of Theory and Computation

- Every implemented formula cites its derivation or source, with equation numbers.
- Every theoretical result that can be checked numerically should be checked by code.
- Notation in the notes corresponds to names in the code, and the glossary maps one to the other.

### 2.5 Verifiability

- Numerical code is validated against authoritative references, such as IAU SOFA/ERFA, JPL Horizons, the IERS Conventions and NOAA tide predictions.
- Reference values live in `validation/` or in the tests, each with its source and retrieval date.
- Docstrings state limits of accuracy: model error, range of validity, and approximations made.

## 3. Architecture

This section summarises [docs/architecture.md](docs/architecture.md). Read that document before adding a module.

### 3.1 Four Repositories

| Repository | Path | Scope | Depends on |
|---|---|---|---|
| calx | `lib/calx` | Retargetable computation stack; numerical methods on floating-point numbers and arrays | — |
| morphe | `lib/morphe` | Mathematical structures and their equivalences: arithmetic, algebra, categories, topology, algebraic geometry, formal structures | — |
| physis | `lib/physis` | Geometry and theoretical physics: units, geometry, discretisation, mechanics, gravitation, thermodynamics, continuum, chemistry, radiation | calx, morphe |
| laboratory | `.` | Metrology, domains and inference; data, observation, visualization and applications | all three |

The libraries are git submodules ([ADR 0008](development/decisions/0008-independent-libraries.md)).

### 3.2 Pure Core, Effectful Edges

`lib/` and `core/` perform pure computation:

- no network access;
- no instrument I/O;
- no user interface;
- no hidden global state;
- only files whose paths are passed in are read.

The edges (`data/`, `observation/`, `visualization/` and `applications/`) deal with the outside world and call the core.

### 3.3 Dependency Rules

- calx and morphe are independent of each other. physis depends on both. No library depends on the laboratory.
- The layers of `core/` run metrology → domains → inference. Each depends only on earlier layers and on `lib/`.
- Nothing in `core/` depends on anything outside `core/` and `lib/`.
- `applications/` may depend on everything, and nothing depends on it.
- Only `applications/`, `notebooks/` and `research/` may use `visualization/`.
- An upward dependency is a design error. Fix it by moving code down, or by dependency inversion.

### 3.4 Computation Stack (calx)

- calx separates representation, schedule, compiler, runtime, task scheduler and backends, following TVM, Halide and MLIR.
- A new device is a new backend directory, with no other change.
- The CPU reference interpreter defines correct results.
- Precision is declared for each computation and never silently reduced.
- The laboratory never addresses a device directly.

### 3.5 Representation Layer

`visualization/` separates three things:

- a device-neutral scene model (`scene/`);
- one renderer per technique (`renderers/`);
- shared styles (`styles/`).

Units, time scales and frames travel with the data into the scene.

### 3.6 Placement

To decide where new content goes, use [architecture §7](docs/architecture.md). If the right place is a library, make the change in that library's repository.

## 4. Scientific and Mathematical Conventions

### 4.1 Units, Time Scales and Reference Frames

These are the most common source of silent error in this subject, so they are always explicit.

- **Units.** Use SI units internally. Use radians for angles internally, and convert only at input and output boundaries. When a quantity's unit is not obvious, carry it in the name or the type.
- **Time.** A time value always states its scale (UTC, TAI, TT, TDB or UT1) and its representation (JD, MJD, two-part JD or ISO 8601). Epochs are named, for example J2000.0 = JD 2451545.0 TT.
- **Reference frames.**
  - Every coordinate states its frame, and where relevant its epoch and equinox.
  - Examples of frames: ICRS, GCRS, CIRS, ITRS, ecliptic of date, topocentric, local horizon.
  - Transformations between frames are explicit functions and never happen implicitly.
- **Figure of the Earth.** State the ellipsoid or geoid in use, such as WGS 84 or GRS 80.
- **Orientation conventions.** Define each of these once in the glossary and follow it everywhere:
  - handedness;
  - the origin of azimuth;
  - the sign of longitude;
  - whether rotations are active or passive.

### 4.2 Notation, Rigour and Glossary

- Write notes in LaTeX, with the precision of a mathematics text:
  - state the hypotheses;
  - distinguish definitions from results;
  - give proofs or cite them.
- Where it is natural, show algebraic structure rather than hiding it: groups, representations, lattices, characters and complexes.
- `docs/glossary.md` lists every symbol with its meaning, units, convention and code name. It is created in Phase 0.

### 4.3 References

Cite primary sources and standard references, and collect them in `docs/references.bib`. Examples:

- the *Explanatory Supplement to the Astronomical Almanac*;
- the IERS Conventions and IAU resolutions;
- Meeus, *Astronomical Algorithms*;
- Pugh and Woodworth, *Sea-Level Science*;
- Gill, *Atmosphere–Ocean Dynamics*;
- Vallis, *Atmospheric and Oceanic Fluid Dynamics*;
- Holton and Hakim, *An Introduction to Dynamic Meteorology*.

### 4.4 Writing Style

These conventions are shared with all three libraries.

- Headings are declarative, numbered and academic, for example "3.2 Precession of the Equinoxes". Never use question forms.
- Present concepts and philosophy before structure and usage.
- Label asides with *Rationale.*, *Remark.* or *Caveat.*
- Code identifiers, docstrings and comments are in English.

## 5. Repository Layout

```
.
├── lib/                   independent libraries, as git submodules (ADR 0008)
│   ├── calx/              computation stack · numerical methods
│   ├── morphe/            arithmetic · categories · equivalence · algebra · topology · algebraic geometry · formal
│   └── physis/            units · geometry · discretisation · mechanics · gravitation · thermodynamics · continuum · chemistry · radiation
├── core/                  the laboratory's pure library (C++)
│   ├── metrology/         time scales · reference frames · Earth orientation
│   ├── domains/           fields: astronomy · geography · oceanography · meteorology · geodesy (ADR 0010)
│   │                      bridges: tides · navigation · air_sea · climate
│   └── inference/         estimation · filtering · assimilation · uncertainty · learning
├── data/                  dataset registry · acquisition · formats · provenance
├── observation/           instruments · field work
├── visualization/         scene model · renderers · styles (ADR 0005)
├── applications/          labs and tools, one folder per field and bridge (ADR 0010)
├── validation/            reference values · standard problems · benchmarks
├── theory/                notes on fields and bridges (ADR 0006, 0008)
├── notebooks/             exploration and teaching
├── research/              questions · experiments · papers
├── docs/                  architecture (later: glossary · references)
├── development/           ideas · decisions · roadmap (ADR 0009)
└── assets/                images · fonts · style tokens
```

- Every directory has a README giving its purpose, its planned modules with their status, and its dependencies.
- A subdirectory is created when its first content is written. Until then it is a `planned` row in its parent README.
- The exceptions are:
  - the field and bridge directories of `core/domains/` and `applications/` (ADR 0010);
  - the component directories of calx's `compute/`.
- When the layout changes, update this section, README §4 and the affected parent READMEs in the same change.

## 6. Working Procedures

### 6.1 Module Contract

Each module directory contains:

- a `README.md` giving its purpose, status (§2.3), dependencies, main references and open questions;
- code with a documented public interface; C++ modules follow [architecture §6](docs/architecture.md);
- tests, beside the code.

### 6.2 Idea Capture

- Write each new idea in `development/ideas/` as `YYYY-MM-DD-slug.md`, with status `seed`, and add it to the index.
- An idea that concerns only one library goes in that library's own `development/ideas/`.
- Promote an idea by moving its substance and leaving a link behind.
- Never delete an abandoned idea. Mark it `abandoned` and give one sentence explaining why.

### 6.3 Decision Log

- Record decisions that shape structure, conventions or tooling in `development/decisions/NNNN-slug.md`, using the template in the index.
- Never rewrite a record. A new record supersedes or amends it, and the old record's status is updated to point to the new one.
- Records accepted so far: 0001–0014.

### 6.4 Change Discipline

- Before restructuring directories, renaming modules or changing a convention in this file, propose the change and wait for the user's agreement.
- Keep each change to one concept.
- When adding a module, update:
  - its README;
  - its parent README's table;
  - the layout (§5), if it adds a top-level directory;
  - the glossary, if it introduces notation.
- If this file no longer matches the repository, say so and propose a fix.

### 6.5 Working Across Repositories

- **Submodule commits.** Edit a library in place under `lib/<name>` and commit there first. Then commit the updated submodule pointer in the laboratory.
- **Commit order.** Commit in dependency order: calx and morphe first, then physis, then the laboratory.
- **Each library's own CLAUDE.md.** When working inside `lib/<name>`, read that library's CLAUDE.md first; it governs work there.
- **Links between repositories.** Use absolute GitHub URLs.
- **Shared conventions.** The writing style, status vocabulary, and decision and idea conventions are shared by all four repositories. Change them in all four together.
- **Pushing.** Push only with the user's agreement.

### 6.6 Collaboration Style

- The principal investigator is fluent in abstract algebra and formal language theory. Prefer precise mathematical formulations.
- This is also a learning project. When introducing physics or conventions specific to a domain, give the reasoning behind them and cite their source.
- Visualizations should look warm and humane, not like a generic dashboard.

## 7. Technology

- **Decided** ([ADR 0003](development/decisions/0003-cpp-computational-core.md)): C++ for computational code, in the libraries and in `core/`, wherever possible. Python or another suitable language for data acquisition, orchestration, notebooks, machine learning and visualization.
- **Provisional** (to be confirmed in roadmap Phase 0): C++20, CMake, nanobind for Python bindings, a C++ test framework, pytest, and Python 3.12 or later.
- **Web applications:**
  - Use ES modules without a build step.
  - Load three.js from jsDelivr, pinned to an exact version (0.170.0).
  - Serve locally with Python's standard library.
  - Test with Node (v22 is installed).
  - Check visually by driving headless Chrome over the DevTools protocol. Chrome must be given an absolute `--user-data-dir`; with a relative one it exits at once.
  - Each application has its own local server: the Celestial Atlas on port 8770, the Earth Atlas on 8790.
- **Visual style:**
  - The Celestial Atlas uses Dusty Orchid (#CA8DBE) as its main colour, chosen by the user: plum nights, orchid accents and orchid-tinted paper for charts.
  - The Earth Atlas shares that palette for now (ADR 0014), with data in perceptually uniform colour maps (cmocean, and the laboratory's orchid map); the user may give it a colour of its own.
  - All interfaces use serif type (Source Serif 4).
  - Each application may carry its own main colour within the warm, gentle family the user prefers.
- **Version control.**
  - The laboratory's remote is `https://github.com/huangwanhong-maker/Integrative_Astronomy_Geography_Oceanography_Laboratory`.
  - The libraries' remotes are `https://github.com/huangwanhong-maker/{calx,morphe,physis}`.
- **Licences.** All four repositories are MIT-licensed.
  - Check every external library for licence compatibility before adopting it. Copyleft examples: FFTW, SHTns, FLINT, GMP, and parts of CGAL.
  - Datasets keep their own licences.
- **Development machine** (as of 2026-10-21):
  - Windows 11; Intel i7-11370H; 32 GB of memory.
  - NVIDIA RTX 3050 Ti Laptop GPU (4 GB, CUDA 12.9) and Intel Iris Xe.
  - Python 3.12, Julia and WSL are installed. There is no C++ compiler or CMake on the Windows side.
  - The repository path contains spaces, so quote paths.

## 8. Open Decisions

1. **The laboratory's C++ namespace.** The names are settled:
   - The laboratory is the Integrative Astronomy, Geography, Oceanography Laboratory. The user confirmed "Geography" on 2026-10-22. Geometry remains in scope as a foundation.
   - The libraries are calx, morphe and physis.
2. **C++ toolchain** on Windows (MSVC, clang/LLVM or WSL), together with the build and packaging tools.
3. **Automatic differentiation** in calx, which would be built as an IR transformation.
4. **Precision policy details** (calx).
5. **Notes format.** Markdown with LaTeX (the current default), Jupyter or Quarto; LaTeX for papers.
6. **Language of notes.** English only, or multilingual.
7. **Licence for prose.** MIT covers software; notes may suit CC BY 4.0.
8. **First renderer technology** for Phase 1.

## 9. Current State

As of 2026-10-22:

- The architecture and decision records 0001–0014 are written.
- The layered directory structure is in place, with READMEs.
- The three libraries are scaffolded as their own git repositories and attached under `lib/`.
- All four repositories are published on GitHub.
- The first application, `applications/astronomy/celestial-atlas`, works ([ADR 0011](development/decisions/0011-first-application-celestial-atlas.md)).
  - It is a web application with five views:
    - Solar System;
    - stellar neighbourhood, from HYG or Gaia;
    - galaxies and their relations;
    - sky chart;
    - orbits.
  - It shows any instant from 1849 to 2150, or live.
  - Its computation is provisional JavaScript, tested against JPL Horizons, Meeus, Tully (2015) and Karachentsev et al. (2013): 47 checks, run with `node applications/astronomy/celestial-atlas/tests/run-tests.mjs`.
- The second application, `applications/geography/earth-atlas`, works ([ADR 0014](development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md)).
  - It shows the Earth's atmosphere, ocean, land and people on a globe or on equal-area and equirectangular maps, at one instant.
  - Its data are separate products, joined only in the application: a base map without thematic values, gridded fields, country indicators and events.
  - Its layers are typed by the shape of their data (surface, flow, lines, events, base), so new data appear without changes to code.
  - Its provisional JavaScript core is tested against JPL Horizons, Meeus, the Equal Earth paper and the real products: 65 checks, run with `node applications/geography/earth-atlas/tests/run-tests.mjs`.
- `data/` is a general data library ([ADR 0012](development/decisions/0012-selectable-parameterised-datasets.md), [ADR 0014](development/decisions/0014-earth-atlas-separated-data-and-typed-layers.md)):
  - Manifests choose which data and how much: fixed files, TAP catalogue queries, ERDDAP grid subsets, or web requests, with parameters (including relative times) and profiles.
  - The TAP client serves ESA Gaia, CDS VizieR and SIMBAD. The ERDDAP client serves NOAA's forecasts, analyses and relief. The World Bank and the USGS are reached by web requests.
  - `data/formats/netcdf3.py` reads netCDF classic files with the standard library.
  - Products are of six kinds (stars, galaxies, geography, fields, indicators, events), listed in an index that applications read.
- There is no C++ code yet.

The next step is roadmap Phase 0.

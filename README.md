# Integrative Astronomy, Geography, Oceanography Laboratory

This is a long-term programme to learn, use and research astronomy, geometry, oceanography and atmospheric science, including meteorology. It treats them as one connected body of knowledge, in both theory and practice.

## Abstract

**English.** This project studies astronomy, geometry, oceanography and atmospheric science, including meteorology, as one connected body of knowledge, in theory and in practice. The fields share their mathematical and physical foundations: spherical geometry, coordinate systems, the rotation group, potential theory, harmonic analysis, and the dynamics of rotating, stratified fluids. They also meet in concrete phenomena, such as tides, celestial navigation, the figure of the Earth, and the coupled exchange between ocean and atmosphere. New ideas will keep emerging and evolving, so the project is designed throughout to be modular, extensible and revisable.

**中文.** 本项目是一个长期的综合计划，旨在把天文学、几何学、海洋学与大气科学（含气象学）作为一个相互联系的知识整体，从理论与实践两方面加以学习、应用和研究。这些领域共享球面几何、坐标系、旋转群、位势理论、调和分析以及旋转层结流体动力学等数学与物理基础，并在潮汐、天文导航、地球形状以及海洋与大气的耦合交换等现象中交汇。由于新的想法会不断涌现和演化，本项目以模块化、可扩展、可修订为总体设计原则。

**日本語.** 本プロジェクトは、天文学・幾何学・海洋学・大気科学（気象学を含む）を一つのつながった知識体系として、理論と実践の両面から学び、使い、研究するための長期的な総合プログラムである。これらの分野は球面幾何学、座標系、回転群、ポテンシャル論、調和解析、回転成層流体の力学といった数学的・物理的基盤を共有し、潮汐、天測航法、地球の形状、海洋と大気の結合した交換といった現象において交わる。新しい着想が絶えず生まれ発展していくことを前提に、モジュール性・拡張性・改訂可能性を全体の設計原則とする。

## 1. Motivation and Scope

These subjects are usually taught apart, but shared structure binds them together.

- **Spheres and rotations.** The geometry of the sphere and of rotations underlies all of these fields.
  - The celestial sphere, the figure of the Earth, and the ocean and atmosphere (thin fluid shells on a rotating sphere) are all described in this language.
  - Changes of reference frame are elements of SO(3).
  - Fields on the sphere expand in spherical harmonics, which carry the irreducible representations of SO(3).
- **Tides join astronomy to oceanography.**
  - The Moon and the Sun set up a tide-generating potential, and the ocean responds to it.
  - Each tidal constituent oscillates at a frequency that is an integer combination of six fundamental astronomical frequencies (Doodson's expansion).
  - The tidal spectrum therefore carries a lattice structure.
- **Celestial navigation joins astronomy to geometry at sea.** A position is fixed from star sights by solving a spherical triangle, with an almanac computed by positional astronomy.
- **Ocean and atmosphere form one coupled fluid system.**
  - Both obey the equations of rotating, stratified flow.
  - They exchange momentum, heat, freshwater and gases at the sea surface.
  - Phenomena such as ENSO and the monsoons exist only in the coupled system.
  - Both are driven by sunlight. Astronomy sets how that sunlight is distributed over the Earth, and how the distribution changes slowly over millennia (the Milankovitch cycles).

The project serves three activities:

- **Learning:** derivations, worked examples and expositions.
- **Use:** tested computational tools whose results can be relied on.
- **Research:** open questions, and new results built on the first two.

Geodesy, navigation and climate already appear as bridging topics. Further fields, such as geophysics and the cryosphere, may join as the work grows.

## 2. Design Philosophy

The project will grow over a long time and will change direction as understanding deepens. Five principles govern how it is built.

### 2.1 Modularity

- **Layers.** The project is built as layers, and its dependencies point only downward.
- **Independent libraries.** General knowledge lives in independent libraries, each in its own repository:
  - numerics and computation;
  - mathematical structures;
  - geometry and physics.
- **Pure core, effectful edges.** The libraries and the laboratory's core are pure computation, with no network, instruments or user interface. Data acquisition, observation, visualization and applications sit at the edges and call into the core.

### 2.2 Extensibility

- Adding a field, a method, a device or a presentation technique means adding a module. It never means rewriting existing ones.
- Computing hardware and presentation media change constantly. In both, a stable, device-neutral representation separates *what* is done from *how* it is realised, and each technology is a plug-in backend.

### 2.3 Revisability

- Every module and note carries a status: `planned`, `seed`, `draft`, `stable` or `deprecated`.
- Significant decisions are recorded with the alternatives that were considered, so they can be revisited deliberately.
- Ideas are captured early and promoted once they mature.

### 2.4 Unity of Theory and Computation

- Every implemented formula cites its derivation or source.
- Every theoretical result that can be checked numerically is checked by code.

### 2.5 Verifiability

- Numerical results are validated against authoritative references, such as IAU SOFA/ERFA, JPL Horizons, the IERS Conventions and NOAA tide predictions.
- Units, time scales and reference frames are always explicit.

## 3. Architecture

The project spans four repositories. The laboratory composes three independent libraries, all written in C++:

| Library | Scope |
|---|---|
| [**calx**](https://github.com/huangwanhong-maker/calx) | A retargetable computation stack in the manner of TVM, Halide and MLIR (representation, schedule, compiler, runtime, scheduler, backends), together with numerical methods. A computation is written once. It then runs on the CPU, the reference backend, and on any device for which a backend exists, including devices not yet invented. |
| [**morphe**](https://github.com/huangwanhong-maker/morphe) | Mathematical structures and their equivalences: exact arithmetic, algebra, category theory, topology, algebraic geometry, and formal structures such as automata, grammars and rewriting systems. It also covers notions of sameness, such as bisimulation and bimorphism. |
| [**physis**](https://github.com/huangwanhong-maker/physis) | Geometry and theoretical physics: units, differential geometry, structure-preserving discretisation, mechanics, gravitation, thermodynamics, geophysical fluid dynamics, chemistry and radiation |

The libraries and the laboratory are layered as follows:

```
Edges        applications · visualization · observation · data
                    │
core/        inference · domains · metrology            (the laboratory's own library)
                    │
lib/         physis ──► calx
                └─────► morphe                          (calx and morphe are independent)
```

The laboratory's domains cover four fields (astronomy, oceanography, atmosphere, geodesy) and four bridges between them (tides, navigation, air–sea interaction, climate). Visualization is a representation layer: a device-neutral scene model, with one renderer per technique.

For more detail:
- full design: [docs/architecture.md](docs/architecture.md);
- decisions: [development/decisions/](development/decisions/);
- plan: [development/roadmap.md](development/roadmap.md).

## 4. Organisation of the Repository

```
.
├── lib/                   calx · morphe · physis (git submodules)
├── core/                  metrology · domains · inference
├── data/                  dataset registry · acquisition · formats · provenance
├── observation/           instruments · field work
├── visualization/         scene model · renderers · styles
├── applications/          laboratories · tools
├── validation/            reference values · standard problems · benchmarks
├── theory/                notes on fields and bridges
├── notebooks/             exploration and teaching
├── research/              questions · experiments · papers
├── docs/                  architecture
├── development/           ideas · decisions · roadmap
└── assets/                images · fonts · style tokens
```

Clone the repository together with its libraries:

```
git clone --recurse-submodules https://github.com/huangwanhong-maker/Integrative_Astronomy_Geography_Oceanography_Laboratory.git
```

Every directory has a README describing its purpose and planned modules. [`CLAUDE.md`](CLAUDE.md) gives the working conventions and lists the decisions that are still open.

## 5. Status

**Foundational stage (2026-10-21).**
- The architecture is designed, and the four repositories are scaffolded. There is no code yet.
- The next step is Phase 0 of the [roadmap](development/roadmap.md): repositories, toolchain and build.

## 6. License

The project is released under the MIT License. See [`LICENSE`](LICENSE).

# Decision Log

Each record captures one decision that shapes the structure, conventions or tooling of the laboratory.

- Records are numbered and are never rewritten.
- To change a decision, write a new record that supersedes or amends the old one, and update the old record's status to point to the new one.

Decisions that concern only one library are recorded in that library's own `development/decisions/`.

## 1. Index

| No. | Decision | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted; amended by 0009 |
| [0002](0002-layered-architecture-with-pure-core.md) | Layered architecture with a pure core | Accepted; amended by 0008 |
| [0003](0003-cpp-computational-core.md) | C++ for the computational core | Accepted |
| [0004](0004-retargetable-computation-stack.md) | Retargetable computation stack | Accepted; amended by 0008 |
| [0005](0005-visualization-as-representation-layer.md) | Visualization as a representation layer | Accepted |
| [0006](0006-theory-notes-in-subject-tree.md) | Theory notes in a subject tree | Accepted; amended by 0008 |
| [0007](0007-atmosphere-and-ocean-as-coupled-system.md) | Atmosphere and ocean as one coupled system | Accepted; amended by 0008 |
| [0008](0008-independent-libraries.md) | Independent libraries in separate repositories | Accepted |
| [0009](0009-development-folder.md) | A development folder for process material | Accepted |

## 2. Template

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted | Amended by NNNN | Superseded by NNNN
- **Date:** YYYY-MM-DD
- **Decided by:** …

## 1. Context
## 2. Decision
## 3. Alternatives Considered
## 4. Consequences
```

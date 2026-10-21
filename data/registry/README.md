# registry: Dataset Manifests

*Status: draft.* Each external dataset the project uses has one manifest here. A manifest says what the data are, where they come from, what licence they carry, and how to acquire them. Manifests are read by [`../acquisition/fetch.py`](../acquisition/fetch.py), which downloads or queries the data into `data/cache/` and writes a provenance record (`retrieval.json`) beside each result.

## 1. Kinds of Dataset

| Kind | Meaning | Example |
|---|---|---|
| `files` | Fixed files, downloaded as they are. Each file's SHA-256 is recorded in the manifest and verified on every retrieval. | `jpl-de440s` |
| `tap` | A query to an astronomical archive through the IVOA Table Access Protocol. The manifest declares parameters and profiles, so that a user chooses which part of a catalogue to take and how much of it. | `gaia-dr3`, `ungc`, `tully-2mass-groups` |

## 2. Common Fields

| Field | Meaning |
|---|---|
| `id` | Identifier; also the name of the cache folder |
| `kind` | `files` (the default) or `tap` |
| `title`, `provider` | What the dataset is and who produced it |
| `format`, `coverage` | Units, frames, epochs; what the data cover |
| `licence`, `citation` | Terms of use, and how to cite. The project's MIT licence does not cover data. |
| `used_by` | The applications or modules that depend on the dataset |

## 3. Fields of `files` Datasets

`files` is a list of `{url, file, size, sha256}`. A `null` checksum marks a file never verified. Run `fetch.py --record` once to record it.

## 4. Fields of `tap` Datasets

| Field | Meaning |
|---|---|
| `service` | Base URL of the TAP service |
| `query` | ADQL as a list of lines, with `{parameter}` placeholders |
| `file` | Name of the result file in the cache folder (CSV) |
| `parameters` | For each parameter: `type` (`int`, `float` or `str`), `default`, optional `min` and `max`, and a `description` |
| `profiles` | Named sets of parameter values, each with a `description` |
| `default_profile` | The profile used when none is chosen |
| `maxrec_parameter` | The parameter passed to the service as `MAXREC`. Defaults to `limit`. Without it, many services truncate results silently. |

A retrieval chooses a profile with `--profile` and may override any parameter with `--set name=value`.

- **Cache folder.** The result goes to `data/cache/<id>/<profile>/`. When parameters are overridden, the folder is instead `data/cache/<id>/custom-<hash>/`, named by a hash of the parameter values.
- **Provenance.** `retrieval.json` records the service, the exact query, the parameters, the row count, the size, the checksum and the time of retrieval.

## 5. Usage

```
python data/acquisition/fetch.py --list                               # datasets, parameters, profiles
python data/acquisition/fetch.py gaia-dr3 --profile nearby
python data/acquisition/fetch.py gaia-dr3 --set limit=50000 --set g_max=9.5
```

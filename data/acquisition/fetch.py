"""Acquire registered datasets into the local cache.

A dataset is described by a manifest in ``data/registry/`` (schema:
``data/registry/README.md``). There are two kinds:

``files``
    Fixed files, downloaded as they are, such as the DE440 kernel. Their
    checksums are recorded in the manifest and verified on every retrieval.
``tap``
    A query to an astronomical archive through the Table Access Protocol, such
    as Gaia. The manifest declares parameters (which part of the catalogue and
    how much of it) and named profiles. A retrieval chooses a profile and may
    override any parameter.

Files go to ``data/cache/<id>/``, or ``data/cache/<id>/<profile>/`` for queries,
with a provenance record, ``retrieval.json``, beside them. The cache is not
under version control.

Usage::

    python data/acquisition/fetch.py --list                        # datasets, parameters, profiles
    python data/acquisition/fetch.py                               # every 'files' dataset
    python data/acquisition/fetch.py jpl-de440s hyg-v41            # selected datasets
    python data/acquisition/fetch.py gaia-dr3                      # a query, default profile
    python data/acquisition/fetch.py gaia-dr3 --profile nearby
    python data/acquisition/fetch.py gaia-dr3 --set limit=50000 --set g_max=9.5
    python data/acquisition/fetch.py --record                      # record checksums of a first retrieval
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
REGISTRY = DATA / "registry"
CACHE = DATA / "cache"
CHUNK = 1 << 20

sys.path.insert(0, str(DATA / "catalogs"))
import tap  # noqa: E402


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


# ---- fixed files ------------------------------------------------------------

def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "laboratory-data-fetch/1"})
    with urllib.request.urlopen(request, timeout=60) as response, part.open("wb") as out:
        total = int(response.headers.get("Content-Length") or 0)
        done = 0
        for block in iter(lambda: response.read(CHUNK), b""):
            out.write(block)
            done += len(block)
            if total:
                print(f"\r  {dest.name}: {done / total:6.1%}", end="", flush=True)
    print()
    part.replace(dest)


def acquire_files(path: Path, manifest: dict, record: bool) -> bool:
    ident = manifest["id"]
    ok, changed, retrieved = True, False, []
    for entry in manifest["files"]:
        dest = CACHE / ident / entry["file"]
        expected = entry.get("sha256")
        if dest.exists() and (expected is None or sha256_of(dest) == expected):
            print(f"  {entry['file']}: cached")
        else:
            download(entry["url"], dest)
        digest, size = sha256_of(dest), dest.stat().st_size
        if expected is not None and digest != expected:
            print(f"  {entry['file']}: CHECKSUM MISMATCH (expected {expected}, got {digest})")
            ok = False
        elif expected is None:
            if record:
                entry["sha256"], entry["size"] = digest, size
                changed = True
                print(f"  {entry['file']}: checksum recorded")
            else:
                print(f"  {entry['file']}: unverified (no recorded checksum); run with --record")
        retrieved.append({"file": entry["file"], "url": entry["url"], "size": size, "sha256": digest})
    (CACHE / ident / "retrieval.json").write_text(json.dumps(
        {"dataset": ident, "retrieved_at": now(), "files": retrieved}, indent=2) + "\n", encoding="utf-8")
    if changed:
        path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return ok


# ---- queries ----------------------------------------------------------------

def coerce(name: str, spec: dict, raw):
    kind = spec.get("type", "str")
    try:
        value = int(raw) if kind == "int" else float(raw) if kind == "float" else str(raw)
    except ValueError:
        raise SystemExit(f"parameter {name}: expected {kind}, got {raw!r}") from None
    if "min" in spec and value < spec["min"] or "max" in spec and value > spec["max"]:
        raise SystemExit(f"parameter {name}: {value} is outside [{spec.get('min')}, {spec.get('max')}]")
    return value


def resolve(manifest: dict, profile: str | None, overrides: dict) -> tuple[dict, str]:
    """Parameter values: defaults, then the profile, then overrides; and the cache tag."""
    spec = manifest["parameters"]
    profile = profile or manifest.get("default_profile")
    if profile and profile not in manifest.get("profiles", {}):
        raise SystemExit(f"{manifest['id']}: unknown profile {profile!r}; "
                         f"choose from {', '.join(manifest.get('profiles', {}))}")
    values = {k: coerce(k, s, s["default"]) for k, s in spec.items()}
    if profile:
        for k, v in manifest["profiles"][profile]["parameters"].items():
            values[k] = coerce(k, spec[k], v)
    for k, raw in overrides.items():
        if k not in spec:
            raise SystemExit(f"{manifest['id']}: unknown parameter {k!r}; choose from {', '.join(spec)}")
        values[k] = coerce(k, spec[k], raw)
    if overrides:
        digest = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()[:8]
        tag = f"custom-{digest}"
    else:
        tag = profile or "default"
    return values, tag


def acquire_query(manifest: dict, profile: str | None, overrides: dict, refresh: bool) -> bool:
    values, tag = resolve(manifest, profile, overrides)
    folder = CACHE / manifest["id"] / tag
    dest = folder / manifest.get("file", "result.csv")
    provenance = folder / "retrieval.json"
    print(f"  profile {tag}: " + ", ".join(f"{k}={v}" for k, v in values.items()))
    if dest.exists() and provenance.exists() and not refresh:
        if load(provenance).get("parameters") == values:
            print(f"  cached in {folder.relative_to(DATA.parent)}")
            return True
    adql = "\n".join(manifest["query"]).format(**values)
    folder.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    maxrec = values.get(manifest.get("maxrec_parameter", "limit"))
    try:
        size = tap.run_async(manifest["service"], adql, dest, fmt="csv", maxrec=maxrec)
    except tap.TapError as error:
        print(f"  QUERY FAILED: {error}")
        return False
    with dest.open("rb") as handle:
        rows = max(0, sum(1 for _ in handle) - 1)
    if maxrec and rows < maxrec and rows % 1000 == 0:
        print(f"  note: {rows} rows for a limit of {maxrec}; the service may cap results")
    provenance.write_text(json.dumps({
        "dataset": manifest["id"],
        "profile": tag,
        "parameters": values,
        "service": manifest["service"],
        "query": adql,
        "retrieved_at": now(),
        "elapsed_s": round(time.monotonic() - started, 1),
        "rows": rows,
        "file": dest.name,
        "size": size,
        "sha256": sha256_of(dest),
    }, indent=2) + "\n", encoding="utf-8")
    print(f"  {rows} rows, {size / 1e6:.1f} MB in {folder.relative_to(DATA.parent)}")
    return True


# ---- listing ----------------------------------------------------------------

def describe(manifest: dict) -> None:
    kind = manifest.get("kind", "files")
    print(f"{manifest['id']:30s} {kind:6s} {manifest['title']}")
    if kind == "files":
        total = sum(f.get("size") or 0 for f in manifest["files"])
        print(f"{'':37s}{len(manifest['files'])} file(s), {total / 1e6:.1f} MB")
        return
    print(f"{'':37s}parameters:")
    for name, spec in manifest["parameters"].items():
        bounds = f"{spec.get('min')}..{spec.get('max')}" if "min" in spec else ""
        print(f"{'':39s}{name} = {spec['default']} ({spec.get('type', 'str')} {bounds}) {spec['description']}")
    print(f"{'':37s}profiles:")
    for name, profile in manifest.get("profiles", {}).items():
        mark = " (default)" if name == manifest.get("default_profile") else ""
        print(f"{'':39s}{name}{mark}: {profile['description']}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("datasets", nargs="*", help="dataset ids (default: every 'files' dataset)")
    parser.add_argument("--list", action="store_true", help="list datasets, their parameters and profiles")
    parser.add_argument("--profile", help="profile of a query dataset")
    parser.add_argument("--set", action="append", default=[], metavar="NAME=VALUE",
                        help="override a parameter of a query dataset (repeatable)")
    parser.add_argument("--refresh", action="store_true", help="query again even if a cached result exists")
    parser.add_argument("--record", action="store_true", help="record checksums of first retrieval")
    args = parser.parse_args(argv)

    manifests = {p.stem: p for p in sorted(REGISTRY.glob("*.json"))}
    if args.list:
        for path in manifests.values():
            describe(load(path))
        return 0

    overrides = {}
    for item in args.set:
        name, sep, value = item.partition("=")
        if not sep:
            raise SystemExit(f"--set expects NAME=VALUE, got {item!r}")
        overrides[name.strip()] = value.strip()

    if args.datasets:
        unknown = [d for d in args.datasets if d not in manifests]
        if unknown:
            print(f"unknown dataset(s): {', '.join(unknown)}; see --list", file=sys.stderr)
            return 2
        chosen = args.datasets
    else:
        chosen = [k for k, p in manifests.items() if load(p).get("kind", "files") == "files"]

    ok = True
    for ident in chosen:
        manifest = load(manifests[ident])
        print(f"{ident}: {manifest['title']}")
        if manifest.get("kind", "files") == "tap":
            ok &= acquire_query(manifest, args.profile, overrides, args.refresh)
        else:
            ok &= acquire_files(manifests[ident], manifest, args.record)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

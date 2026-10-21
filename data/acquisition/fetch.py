"""Acquire registered datasets into the local cache.

Each dataset is described by a manifest in ``data/registry/``. Files are
downloaded into ``data/cache/<dataset id>/``, which is not under version
control. A provenance record, ``retrieval.json``, is written next to them.

A manifest whose checksum is ``null`` has never been verified. Run once with
``--record`` to write the checksums of the first retrieval into the manifests;
after that, every retrieval is checked against them.

Usage::

    python data/acquisition/fetch.py                  # every registered dataset
    python data/acquisition/fetch.py jpl-de440s       # selected datasets
    python data/acquisition/fetch.py --record         # record first-retrieval checksums
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
REGISTRY = DATA / "registry"
CACHE = DATA / "cache"
CHUNK = 1 << 20


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


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


def acquire(manifest_path: Path, record: bool) -> bool:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    ident = manifest["id"]
    print(f"{ident}: {manifest['title']}")
    ok = True
    changed = False
    retrieved = []
    for entry in manifest["files"]:
        dest = CACHE / ident / entry["file"]
        expected = entry.get("sha256")
        if dest.exists() and (expected is None or sha256_of(dest) == expected):
            print(f"  {entry['file']}: cached")
        else:
            download(entry["url"], dest)
        digest = sha256_of(dest)
        size = dest.stat().st_size
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
    provenance = {
        "dataset": ident,
        "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "files": retrieved,
    }
    (CACHE / ident / "retrieval.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    if changed:
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return ok


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("datasets", nargs="*", help="dataset ids (default: all)")
    parser.add_argument("--record", action="store_true", help="record checksums of first retrieval")
    args = parser.parse_args(argv)

    manifests = sorted(REGISTRY.glob("*.json"))
    if args.datasets:
        wanted = set(args.datasets)
        manifests = [m for m in manifests if m.stem in wanted]
        missing = wanted - {m.stem for m in manifests}
        if missing:
            print(f"unknown dataset(s): {', '.join(sorted(missing))}", file=sys.stderr)
            return 2
    results = [acquire(m, args.record) for m in manifests]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

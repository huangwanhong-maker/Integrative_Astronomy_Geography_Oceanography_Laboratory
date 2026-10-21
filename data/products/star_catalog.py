"""Derive a compact star catalogue from the HYG database.

Input:  data/cache/hyg-v41/hygdata_v41.csv   (fetch with data/acquisition/fetch.py)
Output: data/cache/products/stars-v1.bin    little-endian float32 records
        data/cache/products/stars-v1.json   field layout, names, spectral types, provenance

Each record holds eight float32 values:
    ra   right ascension, radians (J2000)
    dec  declination, radians (J2000)
    mag  apparent visual magnitude
    ci   B-V colour index (NaN when unknown)
    dist distance, parsecs (NaN when unknown)
    x, y, z  equatorial rectangular position, parsecs (NaN when the distance is unknown)

The Sun (HYG id 0) is omitted. HYG marks unknown distances with 100000 pc.

The JSON file also lists, by record index:
    names         proper names
    designations  Bayer, Flamsteed, Gliese or HIP designation, for stars brighter
                  than magnitude 6.5 or nearer than 25 pc
    spectra       spectral types, for stars nearer than 100 pc

Usage::

    python data/products/star_catalog.py
"""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
SOURCE = DATA / "cache" / "hyg-v41" / "hygdata_v41.csv"
OUT = DATA / "cache" / "products"
NAME = "stars-v1"
UNKNOWN_DISTANCE = 100000.0
SPECTRA_WITHIN_PC = 100.0
DESIGNATE_BRIGHTER_THAN = 6.5
DESIGNATE_WITHIN_PC = 25.0
FIELDS = ["ra", "dec", "mag", "ci", "dist", "x", "y", "z"]
GREEK = {
    "Alp": "α", "Bet": "β", "Gam": "γ", "Del": "δ", "Eps": "ε", "Zet": "ζ", "Eta": "η",
    "The": "θ", "Iot": "ι", "Kap": "κ", "Lam": "λ", "Mu": "μ", "Nu": "ν", "Xi": "ξ",
    "Omi": "ο", "Pi": "π", "Rho": "ρ", "Sig": "σ", "Tau": "τ", "Ups": "υ", "Phi": "φ",
    "Chi": "χ", "Psi": "ψ", "Ome": "ω",
}
SUPERSCRIPT = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def number(text: str) -> float:
    try:
        return float(text)
    except ValueError:
        return math.nan


def designation(row: dict) -> str:
    """Bayer, Flamsteed, Gliese or Hipparcos designation, in that order of preference."""
    con = row["con"].strip()
    bayer = row["bayer"].strip()
    if bayer:
        letter, _, index = bayer.partition("-")
        return f"{GREEK.get(letter, letter)}{index.translate(SUPERSCRIPT)} {con}".strip()
    if row["flam"].strip():
        return f"{row['flam'].strip()} {con}".strip()
    if row["gl"].strip():
        return row["gl"].strip()
    if row["hip"].strip():
        return f"HIP {row['hip'].strip()}"
    return ""


def main() -> int:
    if not SOURCE.exists():
        print(f"missing {SOURCE}; run: python data/acquisition/fetch.py hyg-v41", file=sys.stderr)
        return 1

    records = bytearray()
    names: list[list] = []
    designations: list[list] = []
    spectra: list[list] = []
    count = 0
    with SOURCE.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["id"] == "0":
                continue
            ra = math.radians(number(row["ra"]) * 15.0)
            dec = math.radians(number(row["dec"]))
            mag = number(row["mag"])
            ci = number(row["ci"])
            dist = number(row["dist"])
            known = math.isfinite(dist) and 0.0 < dist < UNKNOWN_DISTANCE
            x, y, z = (number(row[k]) for k in ("x", "y", "z"))
            if not known:
                dist = x = y = z = math.nan
            records += struct.pack("<8f", ra, dec, mag, ci, dist, x, y, z)
            proper = row["proper"].strip()
            if proper:
                names.append([count, proper])
            if mag <= DESIGNATE_BRIGHTER_THAN or (known and dist <= DESIGNATE_WITHIN_PC):
                label = designation(row)
                if label:
                    designations.append([count, label])
            spect = row["spect"].strip()
            if known and dist <= SPECTRA_WITHIN_PC and spect:
                spectra.append([count, spect])
            count += 1

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{NAME}.bin").write_bytes(bytes(records))
    meta = {
        "name": NAME,
        "count": count,
        "fields": FIELDS,
        "record_bytes": 4 * len(FIELDS),
        "epoch": "J2000",
        "names": names,
        "designations": designations,
        "spectra": spectra,
        "source": {
            "dataset": "hyg-v41",
            "file": SOURCE.name,
            "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            "licence": "CC BY-SA 4.0",
        },
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }
    (OUT / f"{NAME}.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    print(f"{count} stars, {len(names)} named, {len(designations)} designated, "
          f"{len(spectra)} spectral types -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

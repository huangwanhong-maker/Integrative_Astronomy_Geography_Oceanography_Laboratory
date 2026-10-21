"""Build a field product: variables on a regular longitude-latitude grid, over time.

A field product holds the values of a gridded dataset as they are, in their own
units, with the metadata needed to draw and query them: the grid, the times,
and for each variable its name, CF standard name and units. It holds no colours
or display ranges; those belong to the application. Any gridded source can
become a field product: a forecast, an analysis, a climate simulation, or our
own model output given as a netCDF file.

The grid is normalised so that every product reads the same way:

- rows run from north to south, and columns eastward;
- a grid that goes once round the Earth starts at the first longitude at or
  after -180 degrees, and its last column does not repeat its first;
- dimensions of length one other than time (such as a depth of 0 m) are dropped.

Values are stored as 16-bit integers, one linear scale per variable:
value = q * scale + offset, with q = -32768 for no value. The scale is chosen
from the variable's range, so the rounding error is at most range / 130 000.

Output, in data/cache/products/: fields-<name>.json and fields-<name>.bin
(int16 little-endian; for each variable, for each time, the grid row by row).

Usage::

    python data/products/field_grid.py --source gfs                  # default profile
    python data/products/field_grid.py --source oisst --profile month
    python data/products/field_grid.py --input run.nc --name my-run --title "..." --domain climate
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(DATA / "formats"))
import netcdf3  # noqa: E402
from product_index import OUT, register  # noqa: E402

MISSING = -32768
LAT_NAMES = {"latitude", "lat", "y", "nav_lat"}
LON_NAMES = {"longitude", "lon", "x", "nav_lon"}
UNIT_ALIASES = {"meters": "m", "meter": "m", "metres": "m", "second": "s", "seconds": "s", "sec": "s",
                "degrees": "degree", "degrees_true": "degree", "deg": "degree", "Celsius": "degree_C",
                "celsius": "degree_C", "degC": "degree_C", "kelvin": "K", "fraction": "1"}
VECTOR = re.compile(r"^(eastward|northward)_(.+)$")


def axis_name(ds: netcdf3.Dataset, names: set[str], standard: str) -> str:
    for name, v in ds.variables.items():
        if len(v.dimensions) == 1 and (v.attributes.get("standard_name") == standard or name.lower() in names):
            return name
    raise SystemExit(f"no {standard} axis in the file")


def regular(values: np.ndarray, what: str) -> float:
    steps = np.diff(values)
    if len(steps) and np.abs(steps - steps.mean()).max() > 1e-4 * max(1.0, abs(steps.mean())):
        raise SystemExit(f"the {what} axis is not evenly spaced; only regular grids are supported")
    return float(steps.mean()) if len(steps) else 0.0


def decode_times(ds: netcdf3.Dataset, name: str) -> list[str]:
    units = ds.variables[name].attributes.get("units", "")
    m = re.match(r"(\w+) since (.+)", units)
    if not m:
        raise SystemExit(f"cannot read the time units {units!r}")
    scale = {"seconds": 1, "second": 1, "s": 1, "minutes": 60, "minute": 60, "hours": 3600, "hour": 3600,
             "h": 3600, "days": 86400, "day": 86400, "d": 86400}[m.group(1).lower()]
    epoch = dt.datetime.fromisoformat(m.group(2).strip().replace("Z", "+00:00").replace(" ", "T"))
    epoch = epoch if epoch.tzinfo else epoch.replace(tzinfo=dt.timezone.utc)
    return [(epoch + dt.timedelta(seconds=float(t) * scale)).strftime("%Y-%m-%dT%H:%M:%SZ")
            for t in ds.array(name)]


def quantise(x: np.ndarray) -> tuple[np.ndarray, float, float]:
    finite = x[np.isfinite(x)]
    if finite.size == 0:
        return np.full(x.shape, MISSING, "<i2"), 1.0, 0.0
    lo, hi = float(finite.min()), float(finite.max())
    offset = (lo + hi) / 2
    scale = (hi - lo) / 65000 if hi > lo else 1.0
    q = np.where(np.isfinite(x), np.round((np.nan_to_num(x) - offset) / scale), MISSING)
    return q.astype("<i2"), scale, offset


def build(nc_path: Path, name: str, title: str, domain: str, source: dict, overrides: dict) -> dict:
    ds = netcdf3.Dataset.open(nc_path)
    lat_name = axis_name(ds, LAT_NAMES, "latitude")
    lon_name = axis_name(ds, LON_NAMES, "longitude")
    time_name = next((n for n, v in ds.variables.items() if len(v.dimensions) == 1
                      and (v.attributes.get("standard_name") == "time" or n == "time")), None)
    lats, lons = ds.array(lat_name), ds.array(lon_name)
    dlat, dlon = regular(lats, "latitude"), regular(lons, "longitude")
    flip = dlat > 0                                   # stored south to north
    nlon = len(lons)
    periodic = abs(abs(dlon) * nlon - 360) < 1e-3 * abs(dlon) or abs(abs(dlon) * (nlon - 1) - 360) < 1e-3 * abs(dlon)
    drop_last = periodic and abs(abs(dlon) * (nlon - 1) - 360) < 1e-3 * abs(dlon)
    if drop_last:
        lons, nlon = lons[:-1], nlon - 1
    shift = 0
    if periodic:
        wrapped = (lons + 180) % 360 - 180
        shift = int(np.argmin(wrapped))
        lons = np.roll(wrapped, -shift)
    times = decode_times(ds, time_name) if time_name else []

    variables, blocks, offset_bytes = [], [], 0
    for vname, v in ds.variables.items():
        dims = [d for d in v.dimensions if not (ds.dimensions[d] == 1 and d != time_name)]
        if lat_name not in v.dimensions or lon_name not in v.dimensions or len(dims) > 3:
            continue
        x = ds.array(vname)
        keep = tuple(slice(None) if d in dims else 0 for d in v.dimensions)
        x = x[keep]                                   # (time?, lat, lon)
        if dims[-2:] != [lat_name, lon_name]:
            raise SystemExit(f"{vname}: expected (time, latitude, longitude) order, got {v.dimensions}")
        if x.ndim == 2:
            x = x[None]
        if flip:
            x = x[:, ::-1, :]
        if drop_last:
            x = x[:, :, :-1]
        if shift:
            x = np.roll(x, -shift, axis=2)
        attrs = {**v.attributes, **overrides.get(vname, {})}
        units = str(attrs.get("units", "1"))
        q, scale, offset = quantise(x)
        finite = x[np.isfinite(x)]
        offsets = []
        for t in range(q.shape[0]):
            offsets.append(offset_bytes)
            blocks.append(q[t].tobytes())
            offset_bytes += q[t].nbytes
        entry = {
            "name": vname,
            "long_name": attrs.get("long_name", vname),
            "standard_name": attrs.get("standard_name"),
            "units": UNIT_ALIASES.get(units, units),
            "scale": scale, "offset": offset,
            "min": float(finite.min()) if finite.size else None,
            "max": float(finite.max()) if finite.size else None,
            "p02": float(np.percentile(finite, 2)) if finite.size else None,
            "p98": float(np.percentile(finite, 98)) if finite.size else None,
            "coverage": round(float(finite.size / x.size), 4),
            "offsets": offsets,
        }
        if entry["units"] != units:
            entry["units_source"] = units
        if "cell_methods" in attrs:
            entry["cell_methods"] = attrs["cell_methods"]
        variables.append(entry)
    if not variables:
        raise SystemExit("no variable on the latitude-longitude grid")

    vectors = []
    for v in variables:
        m = VECTOR.match(v["standard_name"] or "")
        if m and m.group(1) == "eastward":
            partner = next((w for w in variables if w["standard_name"] == f"northward_{m.group(2)}"), None)
            if partner:
                vectors.append({"name": m.group(2), "u": v["name"], "v": partner["name"], "units": v["units"],
                                "standard_name": m.group(2)})

    lat0 = float(lats.max()) if flip else float(lats[0])
    grid = {"lon0": round(float(lons[0]), 6), "dlon": round(abs(dlon), 9), "nlon": int(nlon),
            "lat0": round(lat0, 6), "dlat": round(abs(dlat), 9), "nlat": int(len(lats)),
            "periodic": bool(periodic), "crs": "WGS 84 geographic coordinates (EPSG:4326), degrees",
            "order": "rows north to south, columns eastward"}
    bin_path = OUT / f"fields-{name}.bin"
    OUT.mkdir(parents=True, exist_ok=True)
    with bin_path.open("wb") as out:
        for block in blocks:
            out.write(block)
    product = {
        "schema": "field-grid/1",
        "name": name, "title": title, "domain": domain,
        "source": source,
        "grid": grid,
        "times": times,
        "time_scale": "UTC",
        "variables": variables,
        "vectors": vectors,
        "file": bin_path.name,
        "encoding": "int16 little-endian; value = q * scale + offset; q = -32768 means no value",
    }
    json_path = OUT / f"fields-{name}.json"
    json_path.write_text(json.dumps(product, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    register("fields", {
        "name": name, "file": json_path.name, "title": title, "domain": domain,
        "variables": [{k: v[k] for k in ("name", "long_name", "standard_name", "units")} for v in variables],
        "vectors": vectors,
        "times": {"count": len(times), "first": times[0] if times else None, "last": times[-1] if times else None},
        "grid": {k: grid[k] for k in ("dlon", "dlat", "nlon", "nlat")},
        "source": {k: source.get(k) for k in ("dataset", "profile", "provider", "credit", "retrieved_at")},
    })
    return product


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", help="a registered griddap dataset, already fetched")
    parser.add_argument("--profile", help="the profile (cache folder) of the retrieval; default: the dataset's")
    parser.add_argument("--input", help="a netCDF classic file of our own, instead of --source")
    parser.add_argument("--name", help="product name (default: <source>-<profile>)")
    parser.add_argument("--title", help="title (with --input)")
    parser.add_argument("--domain", default="climate", help="field of the data (with --input)")
    args = parser.parse_args(argv)

    if args.source:
        manifest = json.loads((DATA / "registry" / f"{args.source}.json").read_text(encoding="utf-8"))
        tag = args.profile or manifest.get("default_profile", "default")
        folder = DATA / "cache" / args.source / tag
        if not (folder / "retrieval.json").exists():
            print(f"not fetched; run: python data/acquisition/fetch.py {args.source} --profile {tag}",
                  file=sys.stderr)
            return 1
        retrieval = json.loads((folder / "retrieval.json").read_text(encoding="utf-8"))
        nc_path = folder / manifest.get("file", "data.nc")
        name = args.name or f"{args.source}-{tag}"
        title = manifest["title"].split(":")[0]
        source = {"dataset": manifest["id"], "profile": tag, "provider": manifest["provider"],
                  "credit": manifest.get("credit"),
                  "licence": manifest["licence"], "citation": manifest["citation"],
                  "retrieved_at": retrieval["retrieved_at"], "request": retrieval["requests"][0]["url"]}
        domain, overrides = manifest.get("domain", "geography"), manifest.get("attributes", {})
    elif args.input:
        nc_path = Path(args.input)
        name = args.name or nc_path.stem
        title = args.title or nc_path.stem
        source = {"dataset": None, "file": str(nc_path), "provider": "local file"}
        domain, overrides = args.domain, {}
    else:
        parser.error("give --source or --input")
    product = build(nc_path, name, title, domain, source, overrides)
    g = product["grid"]
    print(f"fields-{name}: {len(product['variables'])} variable(s) "
          f"({', '.join(v['name'] for v in product['variables'])}), {len(product['times'])} time(s), "
          f"{g['nlon']} x {g['nlat']} grid, vectors: {[v['name'] for v in product['vectors']] or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

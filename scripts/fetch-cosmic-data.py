#!/usr/bin/env python3
"""Refresh Deep Field's pinned observational data (Python standard library only).

    python3 scripts/fetch-cosmic-data.py [--cache /tmp/horizon-cosmic-data]

Network access is confined to this manual importer. Builds use committed JSON.
Change the versioned URLs/publication states here when reviewing a new release;
never silently advance an arXiv version. Check table schemas, units, row counts,
source hashes and the science notes before committing a refreshed snapshot.
DESI is a reproducible, sparse sample of the DR1 main bright survey, NOT a
volume-complete catalogue or a footprint mask. HTTP ranges avoid a 9 GB download.
"""

import argparse
import concurrent.futures
import gzip
import hashlib
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import struct
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/space/cosmos/model/data"
REVIEWED = "2026-10-22"
SOURCES = {
    "cf4": ("https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/table3.dat.gz", "published", "Tully et al. 2023; CDS table 3"),
    "classix": ("https://cdsarc.cds.unistra.fr/ftp/J/A+A/695/A59/clusters.dat", "published", "Böhringer et al. 2025; CDS clusters.dat"),
    "basins": ("https://arxiv.org/html/2409.17261v1", "published", "Valade et al. 2024; Table 1"),
    "vela": ("https://arxiv.org/html/2603.09339v2", "accepted", "Hollinger et al. 2026; accepted by A&A 2026-06-22; Table 2"),
    "voids": ("https://arxiv.org/html/2606.13538v1", "preprint", "Hollinger & Courtois 2026; Tables A.1 and A.2"),
    "sloan": ("https://arxiv.org/html/2606.04578v1", "preprint", "Pomarède et al. 2026; interpretation of the Valade et al. reconstruction"),
    "south": ("https://arxiv.org/html/2007.04414v1", "published", "Pomarède et al. 2020; South Pole peak, section III"),
    "desi": ("https://data.desi.lbl.gov/public/dr1/spectro/redux/iron/zcatalog/v1/zpix-main-bright.fits", "published", "DESI DR1, iron zcatalog v1 (2026-07-10)"),
}


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.table, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table": self.table = []
        if tag == "tr": self.row = []
        if tag in ("td", "th"): self.cell = []

    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            if self.row is not None: self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        if tag == "tr" and self.row is not None:
            if self.table is not None: self.table.append(self.row)
            self.row = None
        if tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def numbers(text):
    return [float(n) for n in re.findall(r"[-+]?\d+(?:\.\d+)?", text)]


def read_fits_header(data, offset):
    result = {}
    while True:
        card = data[offset:offset + 80].decode("ascii")
        offset += 80
        if card[:8].strip() == "END": return result, math.ceil(offset / 2880) * 2880
        if card[8:10] == "= ":
            raw = card[10:].split("/")[0].strip()
            result[card[:8].strip()] = raw.strip("' ") if raw.startswith("'") else int(raw) if re.fullmatch(r"\d+", raw) else raw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", default="/tmp/horizon-cosmic-data")
    args = parser.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    def fetch(key, byte_range=None):
        url = SOURCES[key][0]
        suffix = f"-{byte_range[0]}-{byte_range[1]}" if byte_range else ""
        dest = cache / (hashlib.sha256(url.encode()).hexdigest()[:16] + suffix)
        if dest.exists(): return dest.read_bytes()
        headers = {"Range": f"bytes={byte_range[0]}-{byte_range[1]}"} if byte_range else {}
        for attempt in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
                    if byte_range and (response.status != 206 or not response.headers.get("Content-Range", "").startswith(f"bytes {byte_range[0]}-")):
                        raise ValueError("Server did not honour the requested FITS range")
                    data = response.read()
                break
            except (urllib.error.URLError, TimeoutError):
                if attempt == 4: raise
                time.sleep(2 ** attempt)
        if byte_range and len(data) != byte_range[1] - byte_range[0] + 1: raise ValueError("Truncated FITS range")
        dest.write_bytes(data)
        return data

    raw = {key: fetch(key) for key in SOURCES if key != "desi"}
    tables = {}
    for key in ("basins", "vela", "voids"):
        p = Tables(); p.feed(raw[key].decode()); tables[key] = p.tables

    # Keep the original distance modulus/error as well as the measured CMB-frame
    # redshift. Geometry uses redshift distances consistently with the other maps;
    # no raw peculiar velocity is mistaken for a reconstructed vector field.
    cf4 = []
    for line in gzip.decompress(raw["cf4"]).decode().splitlines():
        cf4.append([int(line[:7]), float(line[34:42]), float(line[43:51]), int(line[28:33]), float(line[8:14]), float(line[22:27] or 0) if line[22:27].strip() else None])
    assert len(cf4) == 38053
    classix = []
    for line in raw["classix"].decode().splitlines():
        # CDS's actual fixed-width layout differs from the ReadMe by one byte:
        # whitespace fields are unambiguous and checked against the first record.
        name, group, ra, dec, z, luminosity, mass = line.split()
        classix.append([name, int(group), float(ra), float(dec), float(z)])
    assert len(classix) == 185 and sum(r[1] == 1 for r in classix) == 68

    basins = []
    table = next(t for t in tables["basins"] if len(t) == 20)
    for r in table[3:]:
        basins.append({"name": r[0], "probability": float(r[1]), "sg": [numbers(v)[0] for v in r[2:5]], "sigma": [numbers(v)[1] for v in r[2:5]], "volume": float(r[8]) * 1e6})
    assert len(basins) == 17

    voids, knots = [], []
    for r in next(t for t in tables["voids"] if len(t) == 39)[2:]:
        v, robust_v = numbers(r[7]); radius, robust_radius = numbers(r[8])
        voids.append({"id": int(r[0]), "sg": numbers(r[6]), "radius": radius, "robustRadius": robust_radius, "volume": v * 1000, "robustVolume": robust_v * 1000})
    for r in next(t for t in tables["voids"] if len(t) == 44)[2:]:
        v, robust_v = numbers(r[7]); mass, robust_mass = numbers(r[8])
        knots.append({"id": int(r[0]), "name": r[1], "sg": numbers(r[6]), "volume": v * 1000, "robustVolume": robust_v * 1000, "mass": mass * 1e15})
    # Use Cartesian columns, not the inconsistent declinations in Table 1.
    assert len(voids) == 37 and len(knots) == 42

    vela_row = next(r for t in tables["vela"] for r in t if r and r[0] == "Vela")
    vela = {"sg": numbers(vela_row[2])[:3], "mass": numbers(vela_row[3])[0] * 1e16, "volume": numbers(vela_row[4])[0] * 1e5}

    # Header-driven FITS decoding: fail closed on changed schema, no hard-coded
    # byte offsets. Uniformly spaced blocks preserve a broad sample of sightlines;
    # they are not a statistically representative clustering sample.
    header = fetch("desi", (0, 57599))
    _, start = read_fits_header(header, 0)
    h, start = read_fits_header(header, start)
    assert h["EXTNAME"] == "ZCATALOG"
    columns, offset = {}, 0
    sizes = {"L": 1, "B": 1, "I": 2, "J": 4, "K": 8, "E": 4, "D": 8, "A": 1}
    for i in range(1, h["TFIELDS"] + 1):
        match = re.fullmatch(r"(\d*)([LBIJKEDA])", h[f"TFORM{i}"])
        if not match: raise ValueError("Unsupported FITS column")
        count, kind = int(match[1] or 1), match[2]
        columns[h[f"TTYPE{i}"]] = (offset, count, kind)
        offset += count * sizes[kind]
    assert offset == h["NAXIS1"]
    for name in ("TARGETID", "TARGET_RA", "TARGET_DEC", "Z", "ZWARN", "SPECTYPE", "DELTACHI2", "COADD_FIBERSTATUS", "ZCAT_PRIMARY", "HEALPIX"):
        assert name in columns
    def get(row, key):
        off, count, kind = columns[key]
        if kind == "A": return row[off:off + count].decode().strip()
        if kind == "L": return row[off:off + 1] == b"T"
        return struct.unpack_from(">" + {"K": "q", "J": "i", "I": "h", "D": "d", "E": "f", "B": "B"}[kind], row, off)[0]
    blocks, rows_per_block = 128, 256
    starts = [int(i * (h["NAXIS2"] - rows_per_block) / (blocks - 1)) for i in range(blocks)]
    def block(first):
        lo = start + first * offset
        return fetch("desi", (lo, lo + rows_per_block * offset - 1))
    desi, seen, digest = [], set(), hashlib.sha256(header)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for data in pool.map(block, starts):
            digest.update(data)
            for n in range(rows_per_block):
                row = data[n * offset:(n + 1) * offset]
                if not get(row, "ZCAT_PRIMARY") or get(row, "SPECTYPE") != "GALAXY" or get(row, "ZWARN") != 0 or get(row, "COADD_FIBERSTATUS") != 0 or get(row, "DELTACHI2") < 40: continue
                z, tid = get(row, "Z"), str(get(row, "TARGETID"))
                if not (0.1 < z <= 0.4) or tid in seen: continue
                seen.add(tid)
                desi.append([tid, round(get(row, "TARGET_RA"), 6), round(get(row, "TARGET_DEC"), 6), round(z, 7), get(row, "HEALPIX")])
    assert len(desi) > 500
    meta = {key: {"url": url, "publication": status, "version": version, "reviewed": REVIEWED, "sha256": hashlib.sha256(raw[key]).hexdigest() if key in raw else digest.hexdigest()} for key, (url, status, version) in SOURCES.items()}
    # Human-readable source links must not initiate a multi-gigabyte FITS download.
    for key, source in meta.items():
        source["referenceUrl"] = source["url"].replace("/html/", "/abs/")
    meta["cf4"]["referenceUrl"] = "https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/ReadMe"
    meta["classix"]["referenceUrl"] = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/695/A59/ReadMe"
    meta["desi"]["referenceUrl"] = "https://data.desi.lbl.gov/doc/releases/dr1/"
    meta["cf4"]["rows"] = len(cf4)
    meta["classix"]["rows"] = len(classix)
    meta["desi"].update({"selection": "128 uniformly spaced 256-row blocks; unique primary GALAXY; ZWARN=0; COADD_FIBERSTATUS=0; DELTACHI2>=40; 0.1<z<=0.4", "rowsExamined": blocks * rows_per_block, "catalogueRows": h["NAXIS2"], "sampleRows": len(desi)})
    products = {
        "cf4": {"columns": ["pgc", "raDeg", "decDeg", "czCmbKms", "distanceModulus", "modulusError"], "rows": cf4},
        "classix": {"columns": ["name", "structureId", "raDeg", "decDeg", "z"], "rows": classix},
        "desi": {"columns": ["targetId", "raDeg", "decDeg", "z", "healpix"], "rows": desi},
        "reconstructions": {"coordinateUnit": "h^-1 Mpc", "volumeUnit": "h^-3 Mpc^3", "basins": basins, "voids": voids, "knots": knots, "vela": vela},
        "sources": meta,
    }
    for name, product in products.items():
        (OUT / (name + ".json")).write_text(json.dumps(product, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Imported {len(cf4)} CF4 groups, {len(classix)} CLASSIX clusters, {len(desi)} sampled DESI galaxies, {len(basins)} basins, {len(voids)} voids and {len(knots)} knots.")


if __name__ == "__main__": main()

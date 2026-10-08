#!/usr/bin/env python3
"""Fetch letter metadata or accept manual letters; keep the published Bee and archive.

Python standard library only. This never stores the NYT word answer list.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date, datetime
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://spellingbeesolver.dev/archive/"
POKEMON_URL = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv"


def normalize_name(name: str) -> str:
    return re.sub(r"[^a-z]", "", unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode().lower())


def validate_puzzle(value: dict) -> dict:
    if not isinstance(value, dict):
        raise ValueError("Puzzle data must be an object.")
    day = value.get("date", "")
    if not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("Use a date in YYYY-MM-DD format.")
    date.fromisoformat(day)
    center = str(value.get("center", "")).lower()
    outer = value.get("outer", [])
    if not isinstance(outer, list):
        raise ValueError("Outer letters must be a list.")
    outer = [str(x).lower() for x in outer]
    letters = [center, *outer]
    if len(outer) != 6 or any(not re.fullmatch(r"[a-z]", c) for c in letters) or len(set(letters)) != 7:
        raise ValueError("Use one center letter and six distinct outer letters; all seven must differ.")
    return {**value, "center": center, "outer": outer}


class ArchiveParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.collecting = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("id") == "archive-summary-data":
            self.collecting = True

    def handle_data(self, data):
        if self.collecting:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "script":
            self.collecting = False


def parse_archive(page: str) -> list[dict]:
    parser = ArchiveParser()
    parser.feed(page)
    if not parser.parts:
        raise ValueError("The source's archive metadata was not found. Its page format may have changed.")
    data = json.loads("".join(parser.parts))
    if not isinstance(data, list) or not data:
        raise ValueError("The source returned an empty archive.")
    records = []
    seen = set()
    for row in data:
        center = str(row.get("letters", "")).lower()
        letters = str(row.get("all_letters", "")).lower()
        # A few archive entries provide a pangram (CLAIMANT) in this field.
        # Repetition is harmless; the set still must contain exactly seven letters.
        if not re.fullmatch(r"[a-z]+", letters) or len(set(letters)) != 7:
            raise ValueError("Invalid letters in source archive.")
        letters = "".join(dict.fromkeys(letters))
        value = validate_puzzle({"date": row.get("date_iso"), "center": center,
                                 "outer": [c for c in letters if c != center]})
        if value["date"] in seen:
            raise ValueError("The source has duplicate puzzle dates.")
        seen.add(value["date"])
        records.append(value)
    return records


def fetch_archive() -> list[dict]:
    request = urllib.request.Request(SOURCE_URL, headers={
        "User-Agent": "BeePokemon/1.0 (+https://github.com/1979paf313/NYTSpellingBeePokemon)",
        "Accept": "text/html",
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        page = response.read(15_000_001)
    if len(page) > 15_000_000:
        raise ValueError("Source response was unexpectedly large.")
    return parse_archive(page.decode("utf-8"))


def calculate_stats(puzzles: list[dict], species: list[dict]) -> dict:
    candidates = []
    for p in species:
        word = normalize_name(p["name"])
        if len(word) >= 4 and not re.search(r"\d", p["name"]):
            candidates.append((p, word, set(word)))
    counts = Counter({"yes": 0, "almost": 0, "no": 0})
    frequent = Counter()
    names = {p["id"]: p["name"] for p in species}
    for puzzle in puzzles:
        letters = {puzzle["center"], *puzzle["outer"]}
        fits = [p for p, word, chars in candidates if chars <= letters]
        legal = [p for p in fits if puzzle["center"] in normalize_name(p["name"])]
        counts["yes" if legal else "almost" if fits else "no"] += 1
        frequent.update(p["id"] for p in legal)
    days = sorted(p["date"] for p in puzzles)
    top = sorted(frequent.items(), key=lambda x: (-x[1], x[0]))[:20]
    return {"total": len(puzzles), "start": days[0], "end": days[-1], "counts": dict(counts),
            "top": [{"id": identifier, "name": names[identifier], "count": count} for identifier, count in top],
            "species_count": len(species)}


def write_json(path: Path, value, *, compact=False) -> bool:
    body = json.dumps(value, ensure_ascii=False, indent=None if compact else 2,
                      separators=(",", ":") if compact else None) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == body:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(body, encoding="utf-8")
    temporary.replace(path)
    return True


def update(root: Path, *, target: str, center="", outer="", force=False, allow_stale=False,
           archive_html: str | None = None) -> bool:
    data_dir = root / "data"
    daily_path = data_dir / "daily-bee.json"
    history_path = data_dir / "history.json"
    existing_daily = validate_puzzle(json.loads(daily_path.read_text(encoding="utf-8"))) if daily_path.exists() else None
    existing_history = json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else {"puzzles": []}
    old_records = [validate_puzzle(p) for p in existing_history["puzzles"]]
    manual = bool(center or outer)
    if manual and not (center and outer):
        raise ValueError("Manual entry needs both the center letter and the six outer letters.")
    date.fromisoformat(target)
    if not manual and not force and existing_daily and existing_daily["date"] == target and any(p["date"] == target for p in old_records):
        print(f"{target} is already stored; no source request needed.")
        return False
    records = {p["date"]: p for p in old_records}
    if manual:
        if re.search(r"[^a-z\s,]", outer, re.I):
            raise ValueError("Outer letters may contain only letters, spaces, and commas.")
        selected = validate_puzzle({"date": target, "center": center.strip(),
                                    "outer": list(re.sub(r"[\s,]", "", outer)), "manual": True})
        records[target] = selected
        source = "manual"
    else:
        try:
            incoming = parse_archive(archive_html) if archive_html is not None else fetch_archive()
            selected = next((p for p in incoming if p["date"] == target), None)
            if selected is None:
                raise ValueError(f"The source has not published {target}. The existing Bee will be kept.")
            for p in incoming:
                if not records.get(p["date"], {}).get("manual"):
                    records[p["date"]] = p
            # Preserve a same-day manual correction, even during a forced refresh.
            selected = records[target]
            source = "manual" if selected.get("manual") else SOURCE_URL
        except Exception as error:
            if allow_stale and existing_daily:
                print(f"Warning: {error} Keeping {existing_daily['date']} so the site can still be deployed.", file=sys.stderr)
                return False
            raise
    species = json.loads((data_dir / "pokemon.json").read_text(encoding="utf-8"))["pokemon"]
    puzzles = sorted(records.values(), key=lambda p: p["date"], reverse=True)
    history = {"source": SOURCE_URL, "puzzles": puzzles, "stats": calculate_stats(puzzles, species)}
    # Do all validation/calculation before either published file is touched.
    changed = write_json(history_path, history, compact=True)
    if existing_daily is None or selected["date"] >= existing_daily["date"]:
        daily = {**selected, "source": source}
        changed = write_json(daily_path, daily) or changed
    print(f"Stored {target}; {len(puzzles):,} archived Bees. " + ("Files changed." if changed else "No changes."))
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default=os.environ.get("PUZZLE_DATE") or datetime.now(ZoneInfo("America/New_York")).date().isoformat())
    parser.add_argument("--center", default=os.environ.get("MANUAL_CENTER", ""))
    parser.add_argument("--outer", default=os.environ.get("MANUAL_OUTER", ""))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--allow-stale", action="store_true", help="Allow initial code uploads to deploy with the last stored Bee if the source is down.")
    args = parser.parse_args()
    try:
        if date.fromisoformat(args.date) > datetime.now(ZoneInfo("America/New_York")).date():
            raise ValueError("Future puzzle dates are not allowed.")
        changed = update(ROOT, target=args.date, center=args.center, outer=args.outer,
                         force=args.force, allow_stale=args.allow_stale)
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
                output.write(f"changed={'true' if changed else 'false'}\n")
        return 0
    except Exception as error:
        print(f"Update failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

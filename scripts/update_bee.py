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
DAILY_BEE_URL = "https://www.dailyspellingbee.com/"
STUCK_URL = "https://www.stuckonaword.com/spelling-bee-latest.html"
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


class PuzzleTextParser(HTMLParser):

"""Pluggable course metadata (currently just credit weights).

UBC's current course/section catalog (timing, delivery mode, instructor)
lives behind a Workday login and isn't scrapable, so we can't get real
section-timing data for this project. What we CAN reasonably provide is
credit weight, used later to weight a term-level risk score.

TODO: swap StaticCSVMetadataProvider for a real source (e.g. a licensed UBC
course catalog API or a maintained community dataset) without touching any
model or API code, by implementing MetadataProvider and pointing the API at
the new class.
"""

from abc import ABC, abstractmethod
from pathlib import Path

import pandas as pd

DEFAULT_CREDITS = 3


class MetadataProvider(ABC):
    """Interface for anything that can answer "how many credits is X"."""

    @abstractmethod
    def get_credits(self, subject: str, course: str) -> int:
        raise NotImplementedError


class StaticCSVMetadataProvider(MetadataProvider):
    """Looks up credits from a small hand-curated CSV; falls back to a
    documented default for any (subject, course) not in the file.

    This is a stub, not a real catalog: only a handful of well-known courses
    are listed. Most UBC courses are 3 credits, so that's the fallback.
    """

    def __init__(self, csv_path: Path):
        table = pd.read_csv(csv_path, dtype=str)
        table["credits"] = table["credits"].astype(int)
        self._credits_by_key = {
            (row.subject.strip(), row.course.strip()): row.credits
            for row in table.itertuples()
        }

    def get_credits(self, subject: str, course: str) -> int:
        return self._credits_by_key.get((subject.strip(), course.strip()), DEFAULT_CREDITS)

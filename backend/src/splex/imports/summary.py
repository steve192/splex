from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class ImportSummary:
    """What an import run produced - shared by every import source."""

    groups_created: int = 0
    expenses_imported: int = 0
    settlements_imported: int = 0
    skipped_expenses: int = 0

    def as_dict(self) -> dict:
        return asdict(self)

from __future__ import annotations


def normalize_contract_text(value: str | None) -> str:
    return (value or "").strip().lower()


def is_law_15076_without_guard_release(law_code: str | None, observations: str | None) -> bool:
    return "15076" in (law_code or "") and "liberado de guardia" not in normalize_contract_text(observations)

def normalize_skip(value: int) -> int:
    return max(value, 0)


def normalize_limit(value: int, *, default: int, max_value: int) -> int:
    if value <= 0:
        return default
    return min(value, max_value)

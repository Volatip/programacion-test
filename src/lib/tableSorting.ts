export type SortDirection = "asc" | "desc";

export interface SortState<TColumn extends string> {
  column: TColumn;
  direction: SortDirection;
}

export interface SortColumnDefinition<TItem> {
  getValue: (item: TItem) => unknown;
  compare?: (left: unknown, right: unknown) => number;
}

const textCollator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function extractNumericTokens(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [value];
  }

  const matches = normalizeText(value).match(/\d+(?:\.\d+)*/g) ?? [];
  return matches
    .map((token) => Number(token.replace(/\./g, "")))
    .filter((token) => Number.isFinite(token));
}

function parseDateValue(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const timestamp = Date.parse(text);
  if (!Number.isNaN(timestamp)) {
    return timestamp;
  }

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    return null;
  }

  const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function toggleSort<TColumn extends string>(
  current: SortState<TColumn>,
  column: TColumn,
): SortState<TColumn> {
  if (current.column === column) {
    return {
      column,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }

  return {
    column,
    direction: "asc",
  };
}

export function compareTextValues(left: unknown, right: unknown) {
  return textCollator.compare(normalizeText(left), normalizeText(right));
}

export function compareLawValues(left: unknown, right: unknown) {
  const leftTokens = extractNumericTokens(left);
  const rightTokens = extractNumericTokens(right);

  const maxLength = Math.max(leftTokens.length, rightTokens.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftToken = leftTokens[index];
    const rightToken = rightTokens[index];

    if (leftToken === undefined && rightToken === undefined) {
      break;
    }

    if (leftToken === undefined) {
      return -1;
    }

    if (rightToken === undefined) {
      return 1;
    }

    if (leftToken !== rightToken) {
      return leftToken - rightToken;
    }
  }

  return compareTextValues(left, right);
}

export function compareSummedNumberValues(left: unknown, right: unknown) {
  const leftSum = extractNumericTokens(left).reduce((total, current) => total + current, 0);
  const rightSum = extractNumericTokens(right).reduce((total, current) => total + current, 0);

  if (leftSum !== rightSum) {
    return leftSum - rightSum;
  }

  return compareTextValues(left, right);
}

export function compareDateValues(left: unknown, right: unknown) {
  const leftTimestamp = parseDateValue(left);
  const rightTimestamp = parseDateValue(right);

  if (leftTimestamp === null && rightTimestamp === null) {
    return 0;
  }

  if (leftTimestamp === null) {
    return 1;
  }

  if (rightTimestamp === null) {
    return -1;
  }

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  return 0;
}

export function compareBooleanValues(left: unknown, right: unknown) {
  return Number(Boolean(left)) - Number(Boolean(right));
}

export function sortItems<TItem, TColumn extends string>(
  items: TItem[],
  sortState: SortState<TColumn>,
  columns: Record<TColumn, SortColumnDefinition<TItem>>,
) {
  const columnDefinition = columns[sortState.column];
  if (!columnDefinition) {
    return [...items];
  }

  const compare = columnDefinition.compare ?? compareTextValues;

  return [...items].sort((leftItem, rightItem) => {
    const leftValue = columnDefinition.getValue(leftItem);
    const rightValue = columnDefinition.getValue(rightItem);

    const leftEmpty = isEmptyValue(leftValue);
    const rightEmpty = isEmptyValue(rightValue);

    if (leftEmpty && rightEmpty) {
      return 0;
    }

    if (leftEmpty) {
      return 1;
    }

    if (rightEmpty) {
      return -1;
    }

    const result = compare(leftValue, rightValue);
    return sortState.direction === "asc" ? result : -result;
  });
}

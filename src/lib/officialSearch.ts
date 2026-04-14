export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeRutSearch(value: string) {
  return value.replace(/[.\-\s]/g, "").toLowerCase();
}

export function matchesNameTokens(fullName: string, query: string) {
  const normalizedName = normalizeSearchText(fullName);
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => normalizedName.includes(token));
}

interface MatchesOfficialSearchParams {
  name: string;
  rut: string;
  query: string;
}

export function matchesOfficialSearch({ name, rut, query }: MatchesOfficialSearchParams) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedRutQuery = normalizeRutSearch(query);

  if (!normalizedQuery) {
    return true;
  }

  const matchesRut = Boolean(normalizedRutQuery) && normalizeRutSearch(rut).includes(normalizedRutQuery);
  const matchesName = matchesNameTokens(name, normalizedQuery);

  return matchesRut || matchesName;
}

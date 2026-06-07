const TEAM_NAME_ALIASES: Record<string, string> = {
  "usa": "United States",
  "united states of america": "United States",
  "south korea": "Korea Republic",
  "korea republic": "Korea Republic",
  "czech republic": "Czechia",
  "cote d'ivoire": "Cote d'Ivoire",
  "côte d’ivoire": "Cote d'Ivoire",
  "côte d'ivoire": "Cote d'Ivoire",
  "ivory coast": "Cote d'Ivoire",
  "curacao": "Curacao",
  "curaçao": "Curacao",
  "cape verde": "Cape Verde",
  "cabo verde": "Cape Verde",
  "turkey": "Turkiye",
  "türkiye": "Turkiye",
  "congo dr": "DR Congo",
  "congo democratic republic": "DR Congo",
  "dr congo": "DR Congo",
  "ir iran": "Iran"
};

export function normalizeTeamName(input: string): string {
  const compact = input.trim().replace(/\s+/g, " ");
  return TEAM_NAME_ALIASES[compact.toLowerCase()] ?? compact;
}

export function teamIdFromName(input: string): string {
  return normalizeTeamName(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

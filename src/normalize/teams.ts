const aliases = new Map<string, string>();

function addAlias(canonical: string, names: string[]): void {
  for (const name of names) {
    aliases.set(teamKey(name), canonical);
  }
}

addAlias("United States", ["USA", "United States", "United States of America"]);
addAlias("US Virgin Islands", ["US Virgin Islands", "United States Virgin Islands", "U.S. Virgin Islands"]);
addAlias("Republic of Ireland", ["Republic of Ireland", "Ireland"]);
addAlias("South Korea", ["South Korea", "Korea Republic"]);
addAlias("North Korea", ["North Korea", "Korea DPR"]);
addAlias("Iran", ["Iran", "IR Iran"]);
addAlias("Ivory Coast", ["Ivory Coast", "Cote d'Ivoire", "Cote d Ivoire"]);
addAlias("DR Congo", ["DR Congo", "Congo DR", "Democratic Republic of Congo", "Congo Democratic Republic"]);
addAlias("Congo", ["Congo", "Congo Republic"]);
addAlias("Cape Verde", ["Cape Verde", "Cabo Verde"]);
addAlias("Czechia", ["Czechia", "Czech Republic"]);
addAlias("Turkey", ["Turkey", "Turkiye"]);
addAlias("China", ["China", "China PR"]);
addAlias("Chinese Taipei", ["Chinese Taipei", "Taiwan"]);
addAlias("Gambia", ["Gambia", "The Gambia"]);
addAlias("Hong Kong", ["Hong Kong", "Hong Kong, China"]);
addAlias("Macau", ["Macau", "Macao"]);
addAlias("Eswatini", ["Eswatini", "Swaziland"]);
addAlias("Kyrgyzstan", ["Kyrgyzstan", "Kyrgyz Republic"]);
addAlias("Laos", ["Laos", "Lao PDR"]);
addAlias("Timor-Leste", ["Timor-Leste", "East Timor"]);
addAlias("Myanmar", ["Myanmar", "Burma"]);
addAlias("Brunei", ["Brunei", "Brunei Darussalam"]);
addAlias("Saint Kitts and Nevis", ["Saint Kitts and Nevis", "St Kitts and Nevis"]);
addAlias("Saint Lucia", ["Saint Lucia", "St Lucia"]);
addAlias("Saint Vincent and the Grenadines", ["Saint Vincent and the Grenadines", "St Vincent and the Grenadines"]);
addAlias("Curacao", ["Curacao"]);
addAlias("Sao Tome and Principe", ["Sao Tome and Principe", "Sao Tome e Principe"]);
addAlias("Trinidad and Tobago", ["Trinidad and Tobago", "Trinidad/Tobago"]);
addAlias("Antigua and Barbuda", ["Antigua and Barbuda", "Antigua & Barbuda", "Antigua/Barbuda"]);
addAlias("Bosnia and Herzegovina", ["Bosnia and Herzegovina", "Bosnia-Herzegovina"]);
addAlias("United Arab Emirates", ["United Arab Emirates", "UAE"]);

export function normalizeTeamName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
}

export function teamKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

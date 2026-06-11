export type RawScoreline =
  | string
  | {
      score?: string;
      homeGoals?: number;
      awayGoals?: number;
      goalsA?: number;
      goalsB?: number;
      probability?: number;
    };

export type NormalizedScoreline = {
  homeGoals: number;
  awayGoals: number;
  probability: number;
};

export type ScoreDistributionMetrics = {
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  homeScore3PlusProbability: number;
  awayScore3PlusProbability: number;
  homeScore4PlusProbability: number;
  awayScore4PlusProbability: number;
  homeWinBy2PlusProbability: number;
  awayWinBy2PlusProbability: number;
  homeWinBy3PlusProbability: number;
  awayWinBy3PlusProbability: number;
  cleanSheetHomeProbability: number;
  cleanSheetAwayProbability: number;
  topScorelines: NormalizedScoreline[];
  probabilityTotal: number;
};

export type UpsideInterpretation = {
  label: string;
  scenario: string;
  favorite?: "home" | "away";
  exactScoreMayUnderstateFavoriteUpside: boolean;
};

export function normalizeScoreDistribution(input: RawScoreline[]): NormalizedScoreline[] {
  const parsed = input.map(parseScoreline).filter((scoreline): scoreline is NormalizedScoreline => scoreline !== undefined);
  if (parsed.length === 0) return [];

  const looksLikePercentages = parsed.some((scoreline) => scoreline.probability > 1) || sumProbabilities(parsed) > 1.5;
  const decimalized = looksLikePercentages
    ? parsed.map((scoreline) => ({ ...scoreline, probability: scoreline.probability / 100 }))
    : parsed;
  const total = sumProbabilities(decimalized);
  if (total <= 0) return [];

  return decimalized.map((scoreline) => ({
    ...scoreline,
    probability: scoreline.probability / total,
  }));
}

export function calculateScoreDistributionMetrics(input: RawScoreline[], topCount = 5): ScoreDistributionMetrics | undefined {
  const distribution = normalizeScoreDistribution(input);
  if (distribution.length === 0) return undefined;

  const metric = (predicate: (scoreline: NormalizedScoreline) => boolean) =>
    round(distribution.filter(predicate).reduce((sum, scoreline) => sum + scoreline.probability, 0));

  return {
    homeWinProbability: metric((scoreline) => scoreline.homeGoals > scoreline.awayGoals),
    drawProbability: metric((scoreline) => scoreline.homeGoals === scoreline.awayGoals),
    awayWinProbability: metric((scoreline) => scoreline.awayGoals > scoreline.homeGoals),
    expectedHomeGoals: round(distribution.reduce((sum, scoreline) => sum + scoreline.homeGoals * scoreline.probability, 0)),
    expectedAwayGoals: round(distribution.reduce((sum, scoreline) => sum + scoreline.awayGoals * scoreline.probability, 0)),
    homeScore3PlusProbability: metric((scoreline) => scoreline.homeGoals >= 3),
    awayScore3PlusProbability: metric((scoreline) => scoreline.awayGoals >= 3),
    homeScore4PlusProbability: metric((scoreline) => scoreline.homeGoals >= 4),
    awayScore4PlusProbability: metric((scoreline) => scoreline.awayGoals >= 4),
    homeWinBy2PlusProbability: metric((scoreline) => scoreline.homeGoals - scoreline.awayGoals >= 2),
    awayWinBy2PlusProbability: metric((scoreline) => scoreline.awayGoals - scoreline.homeGoals >= 2),
    homeWinBy3PlusProbability: metric((scoreline) => scoreline.homeGoals - scoreline.awayGoals >= 3),
    awayWinBy3PlusProbability: metric((scoreline) => scoreline.awayGoals - scoreline.homeGoals >= 3),
    cleanSheetHomeProbability: metric((scoreline) => scoreline.awayGoals === 0),
    cleanSheetAwayProbability: metric((scoreline) => scoreline.homeGoals === 0),
    topScorelines: [...distribution]
      .sort((a, b) => b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals)
      .slice(0, topCount)
      .map((scoreline) => ({ ...scoreline, probability: round(scoreline.probability) })),
    probabilityTotal: round(sumProbabilities(distribution)),
  };
}

export function interpretUpside(
  metrics: ScoreDistributionMetrics,
  exactScore: { homeGoals: number; awayGoals: number },
  homeTeam: string,
  awayTeam: string,
): UpsideInterpretation {
  const homeIsFavorite = metrics.homeWinProbability >= metrics.awayWinProbability;
  const favorite = homeIsFavorite ? "home" : "away";
  const favoriteTeam = homeIsFavorite ? homeTeam : awayTeam;
  const favoriteWinProbability = homeIsFavorite ? metrics.homeWinProbability : metrics.awayWinProbability;
  const favoriteWinBy3PlusProbability = homeIsFavorite ? metrics.homeWinBy3PlusProbability : metrics.awayWinBy3PlusProbability;
  const favoriteScore3PlusProbability = homeIsFavorite ? metrics.homeScore3PlusProbability : metrics.awayScore3PlusProbability;
  const favoriteScore4PlusProbability = homeIsFavorite ? metrics.homeScore4PlusProbability : metrics.awayScore4PlusProbability;
  const exactMargin = Math.abs(exactScore.homeGoals - exactScore.awayGoals);
  const exactScoreMayUnderstateFavoriteUpside =
    favoriteWinProbability >= 0.75 && exactMargin <= 2 && favoriteWinBy3PlusProbability >= 0.2;

  if (exactScoreMayUnderstateFavoriteUpside) {
    return {
      label: "Exact score may understate favorite upside.",
      scenario: `${favoriteTeam} likely win; ${exactScore.homeGoals}-${exactScore.awayGoals} is the top exact score, but a 3+ goal win remains plausible.`,
      favorite,
      exactScoreMayUnderstateFavoriteUpside,
    };
  }

  if (favoriteWinProbability >= 0.65 && (favoriteScore3PlusProbability >= 0.3 || favoriteScore4PlusProbability >= 0.12 || favoriteWinBy3PlusProbability >= 0.12)) {
    return {
      label: "High favorite upside.",
      scenario: `${favoriteTeam} has meaningful high-scoring or high-margin upside beyond the exact-score pick.`,
      favorite,
      exactScoreMayUnderstateFavoriteUpside,
    };
  }

  return {
    label: "Balanced match.",
    scenario: "No team has clear high-margin upside in the aggregate score distribution.",
    favorite: favoriteWinProbability >= 0.5 ? favorite : undefined,
    exactScoreMayUnderstateFavoriteUpside,
  };
}

function parseScoreline(value: RawScoreline): NormalizedScoreline | undefined {
  if (typeof value === "string") {
    const parsed = parseScore(value);
    return parsed ? { ...parsed, probability: 1 } : undefined;
  }

  const fromScore = typeof value.score === "string" ? parseScore(value.score) : undefined;
  const homeGoals = fromScore?.homeGoals ?? value.homeGoals ?? value.goalsA;
  const awayGoals = fromScore?.awayGoals ?? value.awayGoals ?? value.goalsB;
  const probability = value.probability ?? 1;

  if (!isValidGoal(homeGoals) || !isValidGoal(awayGoals) || !Number.isFinite(probability) || probability < 0) return undefined;
  return { homeGoals, awayGoals, probability };
}

function parseScore(score: string): { homeGoals: number; awayGoals: number } | undefined {
  const match = score.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return undefined;
  const homeGoals = Number(match[1]);
  const awayGoals = Number(match[2]);
  return isValidGoal(homeGoals) && isValidGoal(awayGoals) ? { homeGoals, awayGoals } : undefined;
}

function isValidGoal(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function sumProbabilities(distribution: NormalizedScoreline[]): number {
  return distribution.reduce((sum, scoreline) => sum + scoreline.probability, 0);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

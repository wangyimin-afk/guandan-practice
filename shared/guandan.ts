export type Suit = "spade" | "heart" | "club" | "diamond" | "joker";
export type NormalRank =
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A"
  | "2";
export type Rank = NormalRank | "SJ" | "BJ";
export type PlayerId = 0 | 1 | 2 | 3;
export type TeamId = 0 | 1;

export type PlayType =
  | "single"
  | "pair"
  | "trio"
  | "trioPair"
  | "straight"
  | "pairSequence"
  | "steelPlate"
  | "straightFlush"
  | "bomb"
  | "jokerBomb";

export interface Card {
  id: string;
  deck: 0 | 1;
  rank: Rank;
  suit: Suit;
}

export interface Combo {
  type: PlayType;
  label: string;
  cards: Card[];
  length: number;
  rankPower: number;
  rankLabel: string;
  bombStrength: number;
  description: string;
}

export interface PlayCandidate {
  cards: Card[];
  combo: Combo;
  signature: string;
  description: string;
}

export interface FinishedResult {
  finishOrder: PlayerId[];
  winningTeam: TeamId;
  levelSteps: number;
}

export const NORMAL_RANKS: NormalRank[] = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "2",
];

export const SEQUENCE_RANKS: NormalRank[] = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

export const SUITS: Array<{ key: Exclude<Suit, "joker">; label: string; color: "red" | "black" }> = [
  { key: "spade", label: "♠", color: "black" },
  { key: "heart", label: "♥", color: "red" },
  { key: "club", label: "♣", color: "black" },
  { key: "diamond", label: "♦", color: "red" },
];

export const PLAYER_NAMES: Record<PlayerId, string> = {
  0: "你",
  1: "东家",
  2: "队友",
  3: "西家",
};

export const PLAYER_SEATS: Record<PlayerId, string> = {
  0: "南",
  1: "东",
  2: "北",
  3: "西",
};

export const PLAY_LABELS: Record<PlayType, string> = {
  single: "单张",
  pair: "对子",
  trio: "三张",
  trioPair: "三带二",
  straight: "顺子",
  pairSequence: "连对",
  steelPlate: "钢板",
  straightFlush: "同花顺",
  bomb: "炸弹",
  jokerBomb: "王炸",
};

export const LEVEL_SEQUENCE: NormalRank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

export function getTeam(playerId: PlayerId): TeamId {
  return playerId === 0 || playerId === 2 ? 0 : 1;
}

export function teammateOf(playerId: PlayerId): PlayerId {
  return ((playerId + 2) % 4) as PlayerId;
}

export function nextLevel(level: NormalRank, steps: number): NormalRank {
  const index = LEVEL_SEQUENCE.indexOf(level);
  return LEVEL_SEQUENCE[(index + steps) % LEVEL_SEQUENCE.length];
}

export function suitLabel(card: Card): string {
  if (card.rank === "SJ") return "J";
  if (card.rank === "BJ") return "J";
  return SUITS.find((suit) => suit.key === card.suit)?.label ?? "";
}

export function suitColor(card: Card): "red" | "black" {
  if (card.rank === "BJ") return "red";
  if (card.rank === "SJ") return "black";
  return SUITS.find((suit) => suit.key === card.suit)?.color ?? "black";
}

export function rankLabel(rank: Rank): string {
  if (rank === "SJ") return "小王";
  if (rank === "BJ") return "大王";
  return rank;
}

export function cardLabel(card: Card, level?: NormalRank): string {
  if (card.rank === "SJ") return "小王";
  if (card.rank === "BJ") return "大王";
  const wild = level && isWildCard(card, level) ? "*" : "";
  return `${card.rank}${suitLabel(card)}${wild}`;
}

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const deck of [0, 1] as const) {
    for (const rank of NORMAL_RANKS) {
      for (const suit of SUITS) {
        cards.push({
          id: `${deck}-${rank}-${suit.key}`,
          deck,
          rank,
          suit: suit.key,
        });
      }
    }
    cards.push({ id: `${deck}-SJ`, deck, rank: "SJ", suit: "joker" });
    cards.push({ id: `${deck}-BJ`, deck, rank: "BJ", suit: "joker" });
  }
  return cards;
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function dealHands(random = Math.random): Record<PlayerId, Card[]> {
  const deck = shuffle(buildDeck(), random);
  return {
    0: deck.slice(0, 27),
    1: deck.slice(27, 54),
    2: deck.slice(54, 81),
    3: deck.slice(81, 108),
  };
}

export function isNormalRank(rank: Rank): rank is NormalRank {
  return rank !== "SJ" && rank !== "BJ";
}

export function isJoker(card: Card): boolean {
  return card.rank === "SJ" || card.rank === "BJ";
}

export function isWildCard(card: Card, level: NormalRank): boolean {
  return card.rank === level && card.suit === "heart";
}

export function getRankPower(rank: Rank, level: NormalRank): number {
  if (rank === "BJ") return 100;
  if (rank === "SJ") return 99;
  const ordered = NORMAL_RANKS.filter((item) => item !== level);
  ordered.push(level);
  return ordered.indexOf(rank) + 1;
}

export function sortCards(cards: Card[], level: NormalRank): Card[] {
  const suitOrder: Record<Suit, number> = {
    spade: 0,
    heart: 1,
    club: 2,
    diamond: 3,
    joker: 4,
  };
  return [...cards].sort((a, b) => {
    const power = getRankPower(a.rank, level) - getRankPower(b.rank, level);
    if (power !== 0) return power;
    const suit = suitOrder[a.suit] - suitOrder[b.suit];
    if (suit !== 0) return suit;
    return a.id.localeCompare(b.id);
  });
}

export function sortCardsDesc(cards: Card[], level: NormalRank): Card[] {
  return sortCards(cards, level).reverse();
}

function signature(cards: Card[]): string {
  return cards
    .map((card) => card.id)
    .sort()
    .join("|");
}

function buildCombo(
  type: PlayType,
  cards: Card[],
  rankPower: number,
  rank: string,
  bombStrength = 0,
): Combo {
  const label = PLAY_LABELS[type];
  return {
    type,
    label,
    cards,
    length: cards.length,
    rankPower,
    rankLabel: rank,
    bombStrength,
    description: `${label}${rank ? ` ${rank}` : ""}`,
  };
}

function normalCards(cards: Card[], level: NormalRank): Card[] {
  return cards.filter((card) => !isJoker(card) && !isWildCard(card, level));
}

function wildCards(cards: Card[], level: NormalRank): Card[] {
  return cards.filter((card) => isWildCard(card, level));
}

function countByRank(cards: Card[]): Map<NormalRank, number> {
  const counts = new Map<NormalRank, number>();
  for (const card of cards) {
    if (isNormalRank(card.rank)) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function bestSameRank(cards: Card[], level: NormalRank): { rank: Rank; power: number } | null {
  if (!cards.length) return null;
  const wildCount = wildCards(cards, level).length;
  const natural = normalCards(cards, level);
  const jokers = cards.filter(isJoker);

  if (jokers.length) {
    if (wildCount || natural.length) return null;
    if (jokers.every((card) => card.rank === jokers[0].rank)) {
      return { rank: jokers[0].rank, power: getRankPower(jokers[0].rank, level) };
    }
    return null;
  }

  const ranks = [...new Set(natural.map((card) => card.rank as NormalRank))];
  if (ranks.length > 1) return null;
  const possibleRanks = ranks.length ? ranks : NORMAL_RANKS;
  const valid = possibleRanks
    .filter((rank) => natural.filter((card) => card.rank === rank).length + wildCount >= cards.length)
    .sort((a, b) => getRankPower(b, level) - getRankPower(a, level));
  if (!valid.length) return null;
  return { rank: valid[0], power: getRankPower(valid[0], level) };
}

function getJokerBomb(cards: Card[], level: NormalRank): Combo | null {
  if (cards.length !== 4 || !cards.every(isJoker)) return null;
  return buildCombo("jokerBomb", cards, getRankPower("BJ", level), "四王", 100000);
}

function getBomb(cards: Card[], level: NormalRank): Combo | null {
  if (cards.length < 4 || cards.some(isJoker)) return null;
  const same = bestSameRank(cards, level);
  if (!same || !isNormalRank(same.rank)) return null;
  const strength = 4000 + cards.length * 100 + same.power;
  return buildCombo("bomb", cards, same.power, rankLabel(same.rank), strength);
}

function findSequenceWindow(
  cards: Card[],
  level: NormalRank,
  groupSize: 1 | 2 | 3,
): { highIndex: number; highRank: NormalRank } | null {
  const wildCount = wildCards(cards, level).length;
  const natural = normalCards(cards, level);
  if (cards.some((card) => isJoker(card))) return null;
  if (natural.some((card) => card.rank === "2")) return null;
  const counts = countByRank(natural);
  if ([...counts.values()].some((count) => count > groupSize)) return null;
  const groupCount = cards.length / groupSize;
  if (!Number.isInteger(groupCount)) return null;

  let best: { highIndex: number; highRank: NormalRank } | null = null;
  for (let start = 0; start <= SEQUENCE_RANKS.length - groupCount; start += 1) {
    const window = SEQUENCE_RANKS.slice(start, start + groupCount);
    const hasOutside = [...counts.keys()].some((rank) => !window.includes(rank));
    if (hasOutside) continue;
    const missing = window.reduce((sum, rank) => sum + Math.max(0, groupSize - (counts.get(rank) ?? 0)), 0);
    if (missing <= wildCount) {
      best = {
        highIndex: start + groupCount - 1,
        highRank: window[window.length - 1],
      };
    }
  }
  return best;
}

function getStraight(cards: Card[], level: NormalRank): Combo | null {
  if (cards.length !== 5) return null;
  const window = findSequenceWindow(cards, level, 1);
  if (!window) return null;
  return buildCombo("straight", cards, window.highIndex, window.highRank);
}

function getStraightFlush(cards: Card[], level: NormalRank): Combo | null {
  if (cards.length !== 5) return null;
  const window = findSequenceWindow(cards, level, 1);
  if (!window) return null;
  const natural = normalCards(cards, level);
  const suits = [...new Set(natural.map((card) => card.suit))];
  if (suits.length > 1) return null;
  return buildCombo("straightFlush", cards, window.highIndex, window.highRank, 4550 + window.highIndex);
}

function getPairSequence(cards: Card[], level: NormalRank): Combo | null {
  if (cards.length < 6 || cards.length % 2 !== 0) return null;
  const window = findSequenceWindow(cards, level, 2);
  if (!window) return null;
  return buildCombo("pairSequence", cards, window.highIndex, window.highRank);
}

function getSteelPlate(cards: Card[], level: NormalRank): Combo | null {
  if (cards.length < 6 || cards.length % 3 !== 0) return null;
  const window = findSequenceWindow(cards, level, 3);
  if (!window) return null;
  return buildCombo("steelPlate", cards, window.highIndex, window.highRank);
}

function getTrioPair(cards: Card[], level: NormalRank): Combo | null {
  if (cards.length !== 5 || cards.some(isJoker)) return null;
  const wildCount = wildCards(cards, level).length;
  const natural = normalCards(cards, level);
  const counts = countByRank(natural);
  let best: { rank: NormalRank; power: number } | null = null;

  for (const trioRank of NORMAL_RANKS) {
    for (const pairRank of NORMAL_RANKS) {
      if (trioRank === pairRank) continue;
      const allowed = new Set<NormalRank>([trioRank, pairRank]);
      if ([...counts.keys()].some((rank) => !allowed.has(rank))) continue;
      const trioCount = counts.get(trioRank) ?? 0;
      const pairCount = counts.get(pairRank) ?? 0;
      if (trioCount > 3 || pairCount > 2) continue;
      const missing = Math.max(0, 3 - trioCount) + Math.max(0, 2 - pairCount);
      if (missing > wildCount) continue;
      const power = getRankPower(trioRank, level);
      if (!best || power > best.power) best = { rank: trioRank, power };
    }
  }

  if (!best) return null;
  return buildCombo("trioPair", cards, best.power, best.rank);
}

function getSameRankCombo(cards: Card[], level: NormalRank): Combo | null {
  const same = bestSameRank(cards, level);
  if (!same) return null;
  if (cards.length === 1) return buildCombo("single", cards, same.power, rankLabel(same.rank));
  if (cards.length === 2) return buildCombo("pair", cards, same.power, rankLabel(same.rank));
  if (cards.length === 3) return buildCombo("trio", cards, same.power, rankLabel(same.rank));
  return null;
}

export function evaluatePlay(cards: Card[], level: NormalRank): Combo | null {
  if (!cards.length) return null;
  const sorted = sortCards(cards, level);
  return (
    getJokerBomb(sorted, level) ??
    getStraightFlush(sorted, level) ??
    getBomb(sorted, level) ??
    getSteelPlate(sorted, level) ??
    getPairSequence(sorted, level) ??
    getTrioPair(sorted, level) ??
    getStraight(sorted, level) ??
    getSameRankCombo(sorted, level)
  );
}

export function isBombCombo(combo: Combo): boolean {
  return combo.bombStrength > 0;
}

export function canBeat(candidate: Combo, current: Combo | null | undefined): boolean {
  if (!current) return true;
  if (isBombCombo(candidate) || isBombCombo(current)) {
    if (isBombCombo(candidate) && !isBombCombo(current)) return true;
    if (!isBombCombo(candidate) && isBombCombo(current)) return false;
    return candidate.bombStrength > current.bombStrength;
  }
  if (candidate.type !== current.type) return false;
  if (candidate.length !== current.length) return false;
  return candidate.rankPower > current.rankPower;
}

function addCandidate(
  candidates: PlayCandidate[],
  seen: Set<string>,
  cards: Card[] | null,
  level: NormalRank,
  current: Combo | null | undefined,
): void {
  if (!cards?.length) return;
  const combo = evaluatePlay(cards, level);
  if (!combo || !canBeat(combo, current)) return;
  const key = signature(cards);
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({
    cards: combo.cards,
    combo,
    signature: key,
    description: `${combo.description}：${combo.cards.map((card) => cardLabel(card, level)).join(" ")}`,
  });
}

function takeWilds(hand: Card[], level: NormalRank, used: Set<string>, count: number): Card[] | null {
  if (count <= 0) return [];
  const cards = sortCards(hand, level).filter((card) => isWildCard(card, level) && !used.has(card.id));
  if (cards.length < count) return null;
  return cards.slice(0, count);
}

function takeRankCards(
  hand: Card[],
  level: NormalRank,
  rank: NormalRank,
  count: number,
  used = new Set<string>(),
): Card[] | null {
  const natural = sortCards(hand, level).filter(
    (card) => !used.has(card.id) && !isWildCard(card, level) && card.rank === rank,
  );
  const picked = natural.slice(0, count);
  const missing = count - picked.length;
  const wilds = takeWilds(hand, level, new Set([...used, ...picked.map((card) => card.id)]), missing);
  if (!wilds) return null;
  return [...picked, ...wilds];
}

function takeRankSuitCards(
  hand: Card[],
  level: NormalRank,
  rank: NormalRank,
  suit: Exclude<Suit, "joker">,
  count: number,
  used = new Set<string>(),
): Card[] | null {
  const natural = sortCards(hand, level).filter(
    (card) => !used.has(card.id) && !isWildCard(card, level) && card.rank === rank && card.suit === suit,
  );
  const picked = natural.slice(0, count);
  const missing = count - picked.length;
  const wilds = takeWilds(hand, level, new Set([...used, ...picked.map((card) => card.id)]), missing);
  if (!wilds) return null;
  return [...picked, ...wilds];
}

function takeSequence(
  hand: Card[],
  level: NormalRank,
  ranks: NormalRank[],
  groupSize: 1 | 2 | 3,
  suit?: Exclude<Suit, "joker">,
): Card[] | null {
  const used = new Set<string>();
  const picked: Card[] = [];
  for (const rank of ranks) {
    const cards = suit
      ? takeRankSuitCards(hand, level, rank, suit, groupSize, used)
      : takeRankCards(hand, level, rank, groupSize, used);
    if (!cards) return null;
    for (const card of cards) used.add(card.id);
    picked.push(...cards);
  }
  return picked;
}

export function findPlayableCandidates(
  hand: Card[],
  current: Combo | null | undefined,
  level: NormalRank,
  limit = 140,
): PlayCandidate[] {
  const candidates: PlayCandidate[] = [];
  const seen = new Set<string>();
  const sorted = sortCards(hand, level);

  for (const card of sorted) addCandidate(candidates, seen, [card], level, current);

  for (const rank of NORMAL_RANKS) {
    addCandidate(candidates, seen, takeRankCards(sorted, level, rank, 2), level, current);
    addCandidate(candidates, seen, takeRankCards(sorted, level, rank, 3), level, current);
    for (let count = 4; count <= 8; count += 1) {
      addCandidate(candidates, seen, takeRankCards(sorted, level, rank, count), level, current);
    }
  }

  for (const jokerRank of ["SJ", "BJ"] as const) {
    const jokers = sorted.filter((card) => card.rank === jokerRank);
    addCandidate(candidates, seen, jokers.slice(0, 2), level, current);
  }
  const allJokers = sorted.filter(isJoker);
  if (allJokers.length === 4) addCandidate(candidates, seen, allJokers, level, current);

  for (const trioRank of NORMAL_RANKS) {
    for (const pairRank of NORMAL_RANKS) {
      if (trioRank === pairRank) continue;
      const used = new Set<string>();
      const trio = takeRankCards(sorted, level, trioRank, 3, used);
      if (!trio) continue;
      trio.forEach((card) => used.add(card.id));
      const pair = takeRankCards(sorted, level, pairRank, 2, used);
      if (!pair) continue;
      addCandidate(candidates, seen, [...trio, ...pair], level, current);
    }
  }

  for (let start = 0; start <= SEQUENCE_RANKS.length - 5; start += 1) {
    const ranks = SEQUENCE_RANKS.slice(start, start + 5);
    addCandidate(candidates, seen, takeSequence(sorted, level, ranks, 1), level, current);
    for (const suit of SUITS) {
      addCandidate(candidates, seen, takeSequence(sorted, level, ranks, 1, suit.key), level, current);
    }
  }

  for (const size of [3, 4]) {
    for (let start = 0; start <= SEQUENCE_RANKS.length - size; start += 1) {
      const ranks = SEQUENCE_RANKS.slice(start, start + size);
      addCandidate(candidates, seen, takeSequence(sorted, level, ranks, 2), level, current);
    }
  }

  for (const size of [2, 3]) {
    for (let start = 0; start <= SEQUENCE_RANKS.length - size; start += 1) {
      const ranks = SEQUENCE_RANKS.slice(start, start + size);
      addCandidate(candidates, seen, takeSequence(sorted, level, ranks, 3), level, current);
    }
  }

  return candidates
    .sort((a, b) => {
      const bomb = Number(isBombCombo(a.combo)) - Number(isBombCombo(b.combo));
      if (bomb !== 0) return bomb;
      const length = a.combo.length - b.combo.length;
      if (length !== 0) return length;
      return a.combo.rankPower - b.combo.rankPower;
    })
    .slice(0, limit);
}

export function chooseHeuristicPlay(
  hand: Card[],
  current: Combo | null | undefined,
  level: NormalRank,
  teammateCurrent = false,
): PlayCandidate | null {
  const candidates = findPlayableCandidates(hand, current, level);
  if (!candidates.length) return null;
  if (current && teammateCurrent) {
    const soft = candidates.find((candidate) => !isBombCombo(candidate.combo) && candidate.combo.length >= hand.length);
    return soft ?? null;
  }

  const sorted = [...candidates].sort((a, b) => {
    const bombPenaltyA = isBombCombo(a.combo) ? 1000 : 0;
    const bombPenaltyB = isBombCombo(b.combo) ? 1000 : 0;
    const finishA = a.combo.length === hand.length ? -500 : 0;
    const finishB = b.combo.length === hand.length ? -500 : 0;
    const lengthBiasA = current ? a.combo.length : -a.combo.length * 8;
    const lengthBiasB = current ? b.combo.length : -b.combo.length * 8;
    const scoreA = bombPenaltyA + finishA + lengthBiasA + a.combo.rankPower;
    const scoreB = bombPenaltyB + finishB + lengthBiasB + b.combo.rankPower;
    return scoreA - scoreB;
  });

  if (current && isBombCombo(sorted[0].combo) && hand.length > 6) {
    const opponentAlmostOut = false;
    if (!opponentAlmostOut) return null;
  }

  return sorted[0] ?? null;
}

export function summarizeFinish(finishOrder: PlayerId[]): FinishedResult | null {
  if (finishOrder.length !== 4) return null;
  const winningTeam = getTeam(finishOrder[0]);
  let levelSteps = 1;
  if (getTeam(finishOrder[1]) === winningTeam) levelSteps = 3;
  else if (getTeam(finishOrder[2]) === winningTeam) levelSteps = 2;
  return { finishOrder, winningTeam, levelSteps };
}

export function cardsToText(cards: Card[], level: NormalRank): string {
  return sortCards(cards, level)
    .map((card) => cardLabel(card, level))
    .join(" ");
}

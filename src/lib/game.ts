import {
  Card,
  Combo,
  NormalRank,
  PlayerId,
  TeamId,
  cardsToText,
  chooseHeuristicPlay,
  dealHands,
  evaluatePlay,
  getTeam,
  nextLevel,
  sortCards,
  sortCardsDesc,
  summarizeFinish,
} from "../../shared/guandan";

export interface PlayerState {
  id: PlayerId;
  name: string;
  seat: string;
  team: TeamId;
  isBot: boolean;
  hand: Card[];
}

export interface TrickPlay {
  playerId: PlayerId;
  cards: Card[];
  combo: Combo;
}

export interface GameLog {
  id: string;
  text: string;
  tone?: "normal" | "good" | "warn" | "danger";
}

export interface GameResult {
  winningTeam: TeamId;
  levelSteps: number;
  nextLevel: NormalRank;
}

export interface GameState {
  gameId: string;
  round: number;
  level: NormalRank;
  players: Record<PlayerId, PlayerState>;
  currentPlayer: PlayerId;
  currentPlay: TrickPlay | null;
  passed: PlayerId[];
  finishOrder: PlayerId[];
  status: "playing" | "finished";
  result: GameResult | null;
  logs: GameLog[];
  tributeLogs: string[];
  turn: number;
  message: string;
}

export type Move =
  | {
      type: "pass";
    }
  | {
      type: "play";
      cardIds: string[];
    };

const PLAYER_META: Record<PlayerId, Pick<PlayerState, "name" | "seat" | "isBot">> = {
  0: { name: "你", seat: "南", isBot: false },
  1: { name: "东家", seat: "东", isBot: true },
  2: { name: "队友", seat: "北", isBot: true },
  3: { name: "西家", seat: "西", isBot: true },
};

function makeLog(text: string, tone: GameLog["tone"] = "normal"): GameLog {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    tone,
  };
}

function clonePlayers(players: Record<PlayerId, PlayerState>): Record<PlayerId, PlayerState> {
  return {
    0: { ...players[0], hand: [...players[0].hand] },
    1: { ...players[1], hand: [...players[1].hand] },
    2: { ...players[2], hand: [...players[2].hand] },
    3: { ...players[3], hand: [...players[3].hand] },
  };
}

function removeCard(hand: Card[], cardId: string): Card | null {
  const index = hand.findIndex((card) => card.id === cardId);
  if (index < 0) return null;
  const [card] = hand.splice(index, 1);
  return card;
}

function transferCard(
  hands: Record<PlayerId, Card[]>,
  from: PlayerId,
  to: PlayerId,
  card: Card,
): void {
  const removed = removeCard(hands[from], card.id);
  if (removed) hands[to].push(removed);
}

function highestTributeCard(hand: Card[], level: NormalRank): Card {
  const nonJoker = sortCardsDesc(hand, level).find((card) => card.rank !== "SJ" && card.rank !== "BJ");
  return nonJoker ?? sortCardsDesc(hand, level)[0];
}

function lowestReturnCard(hand: Card[], level: NormalRank): Card {
  const candidates = sortCards(hand, level).filter((card) => card.rank !== "SJ" && card.rank !== "BJ");
  return candidates[0] ?? sortCards(hand, level)[0];
}

function hasAntiTributeCards(hand: Card[]): boolean {
  return hand.some((card) => card.rank === "SJ") && hand.some((card) => card.rank === "BJ");
}

function applyTribute(
  hands: Record<PlayerId, Card[]>,
  previousFinishOrder: PlayerId[] | undefined,
  level: NormalRank,
): string[] {
  if (!previousFinishOrder || previousFinishOrder.length !== 4) return ["首局无进贡。"];
  const [first, second, third, last] = previousFinishOrder;
  const logs: string[] = [];

  if (getTeam(first) === getTeam(second)) {
    const givers: PlayerId[] = [third, last];
    if (givers.every((player) => hasAntiTributeCards(hands[player]))) {
      return ["双下方抗贡，本局不进贡。"];
    }
    const receivers: PlayerId[] = [first, second];
    givers.forEach((giver, index) => {
      const receiver = receivers[index];
      const tribute = highestTributeCard(hands[giver], level);
      transferCard(hands, giver, receiver, tribute);
      const returned = lowestReturnCard(hands[receiver], level);
      transferCard(hands, receiver, giver, returned);
      logs.push(
        `${PLAYER_META[giver].name} 进贡 ${cardsToText([tribute], level)} 给 ${PLAYER_META[receiver].name}，${PLAYER_META[receiver].name} 还 ${cardsToText([returned], level)}。`,
      );
    });
    return logs;
  }

  if (hasAntiTributeCards(hands[last])) return [`${PLAYER_META[last].name} 抗贡，本局不进贡。`];
  const tribute = highestTributeCard(hands[last], level);
  transferCard(hands, last, first, tribute);
  const returned = lowestReturnCard(hands[first], level);
  transferCard(hands, first, last, returned);
  return [
    `${PLAYER_META[last].name} 进贡 ${cardsToText([tribute], level)} 给 ${PLAYER_META[first].name}，${PLAYER_META[first].name} 还 ${cardsToText([returned], level)}。`,
  ];
}

export function createGame(options?: {
  level?: NormalRank;
  round?: number;
  previousFinishOrder?: PlayerId[];
}): GameState {
  const level = options?.level ?? "2";
  const hands = dealHands();
  const tributeLogs = applyTribute(hands, options?.previousFinishOrder, level);
  const players = [0, 1, 2, 3].reduce((acc, id) => {
    const playerId = id as PlayerId;
    acc[playerId] = {
      id: playerId,
      name: PLAYER_META[playerId].name,
      seat: PLAYER_META[playerId].seat,
      isBot: PLAYER_META[playerId].isBot,
      team: getTeam(playerId),
      hand: sortCards(hands[playerId], level),
    };
    return acc;
  }, {} as Record<PlayerId, PlayerState>);

  return {
    gameId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    round: options?.round ?? 1,
    level,
    players,
    currentPlayer: 0,
    currentPlay: null,
    passed: [],
    finishOrder: [],
    status: "playing",
    result: null,
    logs: [
      makeLog(`第 ${options?.round ?? 1} 局开始，当前打 ${level}。`, "good"),
      ...tributeLogs.map((text) => makeLog(text)),
    ],
    tributeLogs,
    turn: 1,
    message: "你先出牌。",
  };
}

export function activePlayers(state: GameState): PlayerId[] {
  return ([0, 1, 2, 3] as PlayerId[]).filter((id) => !state.finishOrder.includes(id));
}

export function nextActiveAfter(state: GameState, playerId: PlayerId): PlayerId {
  const active = activePlayers(state);
  for (let offset = 1; offset <= 4; offset += 1) {
    const next = ((playerId + offset) % 4) as PlayerId;
    if (active.includes(next)) return next;
  }
  return active[0] ?? playerId;
}

export function selectedCardsForPlayer(state: GameState, playerId: PlayerId, cardIds: string[]): Card[] {
  const selected = new Set(cardIds);
  return state.players[playerId].hand.filter((card) => selected.has(card.id));
}

export function canPass(state: GameState, playerId: PlayerId): boolean {
  return Boolean(state.currentPlay && state.currentPlay.playerId !== playerId);
}

function finishIfNeeded(state: GameState, playerId: PlayerId, logs: GameLog[]): void {
  if (state.players[playerId].hand.length !== 0) return;
  if (state.finishOrder.includes(playerId)) return;
  state.finishOrder.push(playerId);
  logs.push(makeLog(`${state.players[playerId].name} 出完，排名第 ${state.finishOrder.length}。`, "good"));

  const active = activePlayers(state);
  if (active.length === 1) {
    state.finishOrder.push(active[0]);
    logs.push(makeLog(`${state.players[active[0]].name} 为末游。`, "warn"));
  }
}

function completeGameIfReady(state: GameState, logs: GameLog[]): void {
  const summary = summarizeFinish(state.finishOrder);
  if (!summary) return;
  const next = nextLevel(state.level, summary.levelSteps);
  state.status = "finished";
  state.result = {
    winningTeam: summary.winningTeam,
    levelSteps: summary.levelSteps,
    nextLevel: next,
  };
  state.message =
    summary.winningTeam === 0
      ? `本局获胜，升级 ${summary.levelSteps} 级。`
      : `本局失利，对手升级 ${summary.levelSteps} 级。`;
  logs.push(
    makeLog(
      `${summary.winningTeam === 0 ? "我方" : "对方"}获胜，下一局打 ${next}。`,
      summary.winningTeam === 0 ? "good" : "danger",
    ),
  );
}

export function applyMove(state: GameState, playerId: PlayerId, move: Move): GameState {
  if (state.status !== "playing") return state;
  if (state.currentPlayer !== playerId) return { ...state, message: "还没轮到这个玩家。" };
  if (state.finishOrder.includes(playerId)) return state;

  const nextState: GameState = {
    ...state,
    players: clonePlayers(state.players),
    passed: [...state.passed],
    finishOrder: [...state.finishOrder],
    logs: [...state.logs],
    turn: state.turn + 1,
  };
  const logs: GameLog[] = [];

  if (move.type === "pass") {
    if (!canPass(nextState, playerId)) {
      return { ...state, message: "当前需要主动出牌，不能不出。" };
    }
    nextState.passed = Array.from(new Set([...nextState.passed, playerId]));
    logs.push(makeLog(`${nextState.players[playerId].name} 不出。`));

    const active = activePlayers(nextState);
    const leaderActive = nextState.currentPlay ? active.includes(nextState.currentPlay.playerId) : false;
    const requiredPasses = leaderActive ? active.length - 1 : active.length;
    if (nextState.currentPlay && nextState.passed.length >= requiredPasses) {
      const leader = nextState.currentPlay.playerId;
      nextState.currentPlay = null;
      nextState.passed = [];
      nextState.currentPlayer = active.includes(leader) ? leader : nextActiveAfter(nextState, leader);
      nextState.message = `${nextState.players[nextState.currentPlayer].name} 获得出牌权。`;
      logs.push(makeLog(`${nextState.players[nextState.currentPlayer].name} 获得新一轮出牌权。`, "good"));
    } else {
      nextState.currentPlayer = nextActiveAfter(nextState, playerId);
      nextState.message = `轮到 ${nextState.players[nextState.currentPlayer].name}。`;
    }
    nextState.logs = [...logs, ...nextState.logs].slice(0, 24);
    return nextState;
  }

  const selected = selectedCardsForPlayer(nextState, playerId, move.cardIds);
  if (selected.length !== move.cardIds.length) return { ...state, message: "选择的牌不完整。" };
  const combo = evaluatePlay(selected, nextState.level);
  if (!combo) return { ...state, message: "这组牌型不成立。" };
  if (nextState.currentPlay && !combo.bombStrength && nextState.currentPlay.playerId === playerId) {
    return { ...state, message: "当前你已经最大，需要等待新一轮。" };
  }
  if (nextState.currentPlay) {
    const { canBeat } = awaitlessRules();
    if (!canBeat(combo, nextState.currentPlay.combo)) return { ...state, message: "这组牌压不过当前牌。" };
  }

  const hand = nextState.players[playerId].hand;
  for (const card of selected) removeCard(hand, card.id);
  nextState.players[playerId].hand = sortCards(hand, nextState.level);
  nextState.currentPlay = { playerId, cards: combo.cards, combo };
  nextState.passed = [];
  logs.push(
    makeLog(
      `${nextState.players[playerId].name} 出 ${combo.description}：${cardsToText(combo.cards, nextState.level)}`,
      combo.bombStrength ? "danger" : "normal",
    ),
  );

  finishIfNeeded(nextState, playerId, logs);
  completeGameIfReady(nextState, logs);
  if (nextState.status === "finished") {
    nextState.logs = [...logs, ...nextState.logs].slice(0, 24);
    return nextState;
  }

  nextState.currentPlayer = nextActiveAfter(nextState, playerId);
  nextState.message = `轮到 ${nextState.players[nextState.currentPlayer].name}。`;
  nextState.logs = [...logs, ...nextState.logs].slice(0, 24);
  return nextState;
}

function awaitlessRules() {
  return {
    canBeat: (candidate: Combo, current: Combo) => {
      if (!current) return true;
      if (candidate.bombStrength || current.bombStrength) {
        if (candidate.bombStrength && !current.bombStrength) return true;
        if (!candidate.bombStrength && current.bombStrength) return false;
        return candidate.bombStrength > current.bombStrength;
      }
      if (candidate.type !== current.type) return false;
      if (candidate.length !== current.length) return false;
      return candidate.rankPower > current.rankPower;
    },
  };
}

export function chooseBotMove(state: GameState, playerId: PlayerId): Move {
  const player = state.players[playerId];
  const teammateCurrent = state.currentPlay ? getTeam(state.currentPlay.playerId) === player.team : false;
  const candidate = chooseHeuristicPlay(player.hand, state.currentPlay?.combo ?? null, state.level, teammateCurrent);
  if (!candidate) return { type: "pass" };
  return { type: "play", cardIds: candidate.cards.map((card) => card.id) };
}

export function createNextRound(state: GameState): GameState {
  const next = state.result?.nextLevel ?? state.level;
  return createGame({
    level: next,
    round: state.round + 1,
    previousFinishOrder: state.finishOrder,
  });
}

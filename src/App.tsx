import {
  BarChart3,
  BookOpen,
  Bot,
  Gauge,
  Home,
  Lightbulb,
  Play,
  RefreshCcw,
  Send,
  Settings,
  SkipForward,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Combo,
  NormalRank,
  PlayerId,
  PLAYER_NAMES,
  cardLabel,
  canBeat,
  chooseHeuristicPlay,
  evaluatePlay,
  findPlayableCandidates,
  getTeam,
  suitColor,
  suitLabel,
} from "../shared/guandan";
import {
  GameState,
  Move,
  applyMove,
  canPass,
  chooseBotMove,
  createGame,
  createNextRound,
  selectedCardsForPlayer,
} from "./lib/game";

type Screen = "home" | "game" | "stats" | "rules" | "settings";

interface StatsState {
  games: number;
  wins: number;
  topWins: number;
  levelSteps: number;
  history: Array<{
    id: string;
    round: number;
    level: NormalRank;
    won: boolean;
    steps: number;
    finishOrder: PlayerId[];
  }>;
}

interface AppSettings {
  animations: boolean;
  sound: boolean;
  aiDifficulty: "simple" | "normal" | "advanced";
}

interface ApiConfig {
  deepseekConfigured: boolean;
  deepseekModel: string;
}

interface AiMoveResponse {
  action: "play" | "pass";
  cardIds?: string[];
  source?: "deepseek" | "heuristic";
  reason?: string;
}

const emptyStats: StatsState = {
  games: 0,
  wins: 0,
  topWins: 0,
  levelSteps: 0,
  history: [],
};

function readStats(): StatsState {
  try {
    const raw = localStorage.getItem("guandan.stats");
    return raw ? { ...emptyStats, ...JSON.parse(raw) } : emptyStats;
  } catch {
    return emptyStats;
  }
}

function writeStats(stats: StatsState): void {
  localStorage.setItem("guandan.stats", JSON.stringify(stats));
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem("guandan.settings");
    return raw
      ? { animations: true, sound: false, aiDifficulty: "advanced", ...JSON.parse(raw) }
      : { animations: true, sound: false, aiDifficulty: "advanced" };
  } catch {
    return { animations: true, sound: false, aiDifficulty: "advanced" };
  }
}

function writeSettings(settings: AppSettings): void {
  localStorage.setItem("guandan.settings", JSON.stringify(settings));
}

function TeamBadge({ team }: { team: number }) {
  return <span className={`team-badge team-${team}`}>{team === 0 ? "我方" : "对方"}</span>;
}

function CardFace({
  card,
  level,
  selected,
  playable,
  compact,
  onClick,
}: {
  card: Card;
  level: NormalRank;
  selected?: boolean;
  playable?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const color = suitColor(card);
  return (
    <button
      className={[
        "card-face",
        color,
        selected ? "selected" : "",
        playable ? "playable" : "",
        compact ? "compact" : "",
      ].join(" ")}
      type="button"
      onClick={onClick}
      aria-pressed={selected ? "true" : "false"}
    >
      <span className="card-corner">{cardLabel(card, level)}</span>
      <span className="card-center">
        <strong>{card.rank === "SJ" ? "小王" : card.rank === "BJ" ? "大王" : card.rank}</strong>
        <span>{suitLabel(card)}</span>
      </span>
      <span className="card-corner bottom">{cardLabel(card, level)}</span>
    </button>
  );
}

function CardBack() {
  return (
    <span className="card-back" aria-hidden="true">
      <span />
    </span>
  );
}

function PlayerPanel({
  state,
  playerId,
  thinking,
}: {
  state: GameState;
  playerId: PlayerId;
  thinking: boolean;
}) {
  const player = state.players[playerId];
  const finishedPlace = state.finishOrder.indexOf(playerId) + 1;
  const active = state.currentPlayer === playerId && state.status === "playing";
  return (
    <section className={`player-panel seat-${player.seat} ${active ? "active" : ""}`}>
      <div className="player-head">
        <div>
          <strong>{player.name}</strong>
          <span>{player.seat}位</span>
        </div>
        <TeamBadge team={player.team} />
      </div>
      <div className="bot-cards">
        {finishedPlace ? (
          <span className="finish-chip">第 {finishedPlace}</span>
        ) : (
          <>
            <CardBack />
            <CardBack />
            <CardBack />
            <span className="count-chip">{player.hand.length}</span>
          </>
        )}
      </div>
      <div className="bot-state">
        {thinking ? (
          <>
            <Bot size={14} /> 思考中
          </>
        ) : active ? (
          "行动中"
        ) : (
          "等待"
        )}
      </div>
    </section>
  );
}

function TrickCenter({ game }: { game: GameState }) {
  const play = game.currentPlay;
  return (
    <section className={`trick-center ${play?.combo.bombStrength ? "impact" : ""}`}>
      <div className="level-disc">
        <span>当前级牌</span>
        <strong>{game.level}</strong>
      </div>
      <div className="trick-copy">
        <span>当前牌权</span>
        <strong>{play ? `${PLAYER_NAMES[play.playerId]} · ${play.combo.description}` : "新一轮"}</strong>
      </div>
      <div className="trick-cards">
        {play ? (
          play.cards.map((card) => <CardFace key={card.id} card={card} level={game.level} compact />)
        ) : (
          <div className="empty-trick">等待主动出牌</div>
        )}
      </div>
      <p>{game.message}</p>
    </section>
  );
}

function LogPanel({ game }: { game: GameState }) {
  return (
    <aside className="log-panel">
      <div className="panel-title">
        <Sparkles size={16} />
        <span>牌局记录</span>
      </div>
      <div className="log-list">
        {game.logs.map((log) => (
          <div className={`log-item ${log.tone ?? "normal"}`} key={log.id}>
            {log.text}
          </div>
        ))}
      </div>
    </aside>
  );
}

function HomeScreen({
  onStart,
  onContinue,
  stats,
}: {
  onStart: () => void;
  onContinue: () => void;
  stats: StatsState;
}) {
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  return (
    <section className="home-screen">
      <div className="home-hero">
        <div>
          <span className="eyebrow">Guandan Master</span>
          <h1>掼蛋提升</h1>
          <p>四人两副牌，AI 队友与对手，完整走完发牌、出牌、贡牌、升级和战绩。</p>
        </div>
        <div className="hero-actions">
          <button className="primary-action" type="button" onClick={onContinue}>
            <Play size={18} /> 继续本局
          </button>
          <button type="button" onClick={onStart}>
            <RefreshCcw size={18} /> 新开一局
          </button>
        </div>
      </div>
      <div className="metric-row">
        <div>
          <span>总局数</span>
          <strong>{stats.games}</strong>
        </div>
        <div>
          <span>胜率</span>
          <strong>{winRate}%</strong>
        </div>
        <div>
          <span>头游</span>
          <strong>{stats.topWins}</strong>
        </div>
        <div>
          <span>累计升级</span>
          <strong>{stats.levelSteps}</strong>
        </div>
      </div>
    </section>
  );
}

function GameScreen({
  game,
  setGame,
  selected,
  setSelected,
  thinking,
  settings,
}: {
  game: GameState;
  setGame: (updater: (state: GameState) => GameState) => void;
  selected: Set<string>;
  setSelected: (cards: Set<string>) => void;
  thinking: PlayerId | null;
  settings: AppSettings;
}) {
  const humanHand = game.players[0].hand;
  const selectedCards = useMemo(
    () => selectedCardsForPlayer(game, 0, [...selected]),
    [game, selected],
  );
  const selectedCombo = useMemo<Combo | null>(() => {
    if (!selectedCards.length) return null;
    return evaluatePlay(selectedCards, game.level);
  }, [selectedCards, game.level]);
  const legalCandidateIds = useMemo(() => {
    if (game.currentPlayer !== 0 || game.status !== "playing") return new Set<string>();
    const candidates = findPlayableCandidates(humanHand, game.currentPlay?.combo ?? null, game.level);
    return new Set(candidates.flatMap((candidate) => candidate.cards.map((card) => card.id)));
  }, [game.currentPlayer, game.currentPlay, game.level, game.status, humanHand]);
  const canPlaySelected = Boolean(
    selectedCombo && canBeat(selectedCombo, game.currentPlay?.combo ?? null) && game.currentPlayer === 0,
  );

  const playSelected = () => {
    if (!canPlaySelected) return;
    setGame((state) => applyMove(state, 0, { type: "play", cardIds: [...selected] }));
    setSelected(new Set());
  };

  const pass = () => {
    setGame((state) => applyMove(state, 0, { type: "pass" }));
    setSelected(new Set());
  };

  const hint = () => {
    const teammateCurrent = game.currentPlay ? getTeam(game.currentPlay.playerId) === getTeam(0) : false;
    const candidate = chooseHeuristicPlay(humanHand, game.currentPlay?.combo ?? null, game.level, teammateCurrent);
    if (candidate) setSelected(new Set(candidate.cards.map((card) => card.id)));
  };

  const startNextRound = () => {
    setGame((state) => createNextRound(state));
    setSelected(new Set());
  };

  return (
    <section className={`game-screen ${settings.animations ? "with-motion" : ""}`}>
      <div className="score-strip">
        <div>
          <span>局数</span>
          <strong>第 {game.round} 局</strong>
        </div>
        <div>
          <span>我方</span>
          <strong>南 / 北</strong>
        </div>
        <div>
          <span>对方</span>
          <strong>东 / 西</strong>
        </div>
        <div>
          <span>剩余</span>
          <strong>{humanHand.length} 张</strong>
        </div>
      </div>

      <div className="table-grid">
        <div className="north-slot">
          <PlayerPanel state={game} playerId={2} thinking={thinking === 2} />
        </div>
        <div className="west-slot">
          <PlayerPanel state={game} playerId={3} thinking={thinking === 3} />
        </div>
        <TrickCenter game={game} />
        <div className="east-slot">
          <PlayerPanel state={game} playerId={1} thinking={thinking === 1} />
        </div>
        <div className="south-slot">
          <section className={`human-panel ${game.currentPlayer === 0 ? "active" : ""}`}>
            <div className="human-head">
              <div>
                <strong>你的手牌</strong>
                <span>{selectedCombo ? selectedCombo.description : selected.size ? "未成牌型" : "选择要出的牌"}</span>
              </div>
              <TeamBadge team={0} />
            </div>
            <div className="hand-strip">
              {humanHand.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  level={game.level}
                  selected={selected.has(card.id)}
                  playable={legalCandidateIds.has(card.id)}
                  onClick={() => {
                    const next = new Set(selected);
                    if (next.has(card.id)) next.delete(card.id);
                    else next.add(card.id);
                    setSelected(next);
                  }}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="action-dock">
        <button type="button" onClick={hint} disabled={game.currentPlayer !== 0 || game.status !== "playing"}>
          <Lightbulb size={18} /> 提示
        </button>
        <button
          className="primary-action"
          type="button"
          onClick={playSelected}
          disabled={!canPlaySelected || game.status !== "playing"}
        >
          <Send size={18} /> 出牌
        </button>
        <button type="button" onClick={pass} disabled={!canPass(game, 0) || game.currentPlayer !== 0}>
          <SkipForward size={18} /> 不出
        </button>
        <button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size}>
          <RefreshCcw size={18} /> 取消
        </button>
        {game.status === "finished" && (
          <button className="primary-action" type="button" onClick={startNextRound}>
            <Trophy size={18} /> 下一局
          </button>
        )}
      </div>

      <div className="below-table">
        <LogPanel game={game} />
        <section className="rank-panel">
          <div className="panel-title">
            <Trophy size={16} />
            <span>排名</span>
          </div>
          <div className="rank-list">
            {[0, 1, 2, 3].map((_, index) => {
              const playerId = game.finishOrder[index];
              return (
                <div key={index} className={playerId === undefined ? "pending" : ""}>
                  <span>第 {index + 1}</span>
                  <strong>{playerId === undefined ? "未定" : game.players[playerId].name}</strong>
                </div>
              );
            })}
          </div>
          {game.result && (
            <div className="result-box">
              <strong>{game.result.winningTeam === 0 ? "我方获胜" : "对方获胜"}</strong>
              <span>
                升级 {game.result.levelSteps} 级，下一局打 {game.result.nextLevel}
              </span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function StatsScreen({ stats }: { stats: StatsState }) {
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  return (
    <section className="content-screen">
      <div className="section-head">
        <BarChart3 size={22} />
        <h1>战绩统计</h1>
      </div>
      <div className="metric-row wide">
        <div>
          <span>总局数</span>
          <strong>{stats.games}</strong>
        </div>
        <div>
          <span>胜率</span>
          <strong>{winRate}%</strong>
        </div>
        <div>
          <span>头游次数</span>
          <strong>{stats.topWins}</strong>
        </div>
        <div>
          <span>累计升级</span>
          <strong>{stats.levelSteps}</strong>
        </div>
      </div>
      <div className="history-table">
        {stats.history.length ? (
          stats.history.map((item) => (
            <div key={item.id} className="history-row">
              <span>第 {item.round} 局</span>
              <strong>{item.won ? "胜" : "负"}</strong>
              <span>打 {item.level}</span>
              <span>升级 {item.steps}</span>
              <span>{item.finishOrder.map((id) => PLAYER_NAMES[id]).join(" / ")}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">暂无战绩</div>
        )}
      </div>
    </section>
  );
}

function RulesScreen() {
  const blocks = [
    ["基础", "两副牌共 108 张，四人 2v2。南北为一队，东西为一队。先出完为头游，最后为末游。"],
    ["牌型", "支持单张、对子、三张、三带二、顺子、连对、钢板、炸弹、同花顺、王炸。"],
    ["逢人配", "当前级牌的红桃牌为万能牌，可补成普通牌型、炸弹、同花顺，但不能当大小王。"],
    ["压牌", "普通牌型必须同类型同张数比较大小。炸弹可压普通牌，王炸最大。"],
    ["进贡", "上一局末游向头游进贡并收回一张还牌；双下时两名输家分别进贡。满足抗贡条件时跳过。"],
    ["升级", "头游队伍获胜。头游和二游同队升 3 级，头游和三游同队升 2 级，否则升 1 级。"],
  ];
  return (
    <section className="content-screen">
      <div className="section-head">
        <BookOpen size={22} />
        <h1>规则说明</h1>
      </div>
      <div className="rules-grid">
        {blocks.map(([title, copy]) => (
          <article key={title}>
            <strong>{title}</strong>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsScreen({
  settings,
  setSettings,
  config,
}: {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  config: ApiConfig | null;
}) {
  const update = (patch: Partial<AppSettings>) => setSettings({ ...settings, ...patch });
  return (
    <section className="content-screen">
      <div className="section-head">
        <Settings size={22} />
        <h1>设置</h1>
      </div>
      <div className="settings-list">
        <label>
          <span>
            <strong>AI 难度</strong>
            <small>高级会优先请求 DeepSeek，失败后使用本地策略。</small>
          </span>
          <select
            value={settings.aiDifficulty}
            onChange={(event) => update({ aiDifficulty: event.target.value as AppSettings["aiDifficulty"] })}
          >
            <option value="simple">简单</option>
            <option value="normal">普通</option>
            <option value="advanced">高级</option>
          </select>
        </label>
        <label>
          <span>
            <strong>动画</strong>
            <small>控制出牌和选牌反馈。</small>
          </span>
          <input
            type="checkbox"
            checked={settings.animations}
            onChange={(event) => update({ animations: event.target.checked })}
          />
        </label>
        <label>
          <span>
            <strong>音效</strong>
            <small>预留开关，后续接入音频资源。</small>
          </span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(event) => update({ sound: event.target.checked })}
          />
        </label>
        <div className="config-card">
          <strong>DeepSeek</strong>
          <span>{config?.deepseekConfigured ? "已配置" : "未配置，当前使用本地 AI"}</span>
          <small>模型：{config?.deepseekModel ?? "读取中"}</small>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("game");
  const [game, setGameState] = useState<GameState>(() => createGame());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thinking, setThinking] = useState<PlayerId | null>(null);
  const [stats, setStats] = useState<StatsState>(() => readStats());
  const [settings, setSettingsState] = useState<AppSettings>(() => readSettings());
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const recordedGames = useRef(new Set<string>());

  const setGame = (updater: (state: GameState) => GameState) => {
    setGameState((state) => updater(state));
  };

  const setSettings = (next: AppSettings) => {
    setSettingsState(next);
    writeSettings(next);
  };

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((data: ApiConfig) => setConfig(data))
      .catch(() => setConfig({ deepseekConfigured: false, deepseekModel: "deepseek-v4-flash" }));
  }, []);

  useEffect(() => {
    setSelected(new Set());
  }, [game.currentPlayer, game.status]);

  useEffect(() => {
    if (game.status !== "finished" || !game.result || recordedGames.current.has(game.gameId)) return;
    recordedGames.current.add(game.gameId);
    const won = game.result.winningTeam === 0;
    const next: StatsState = {
      games: stats.games + 1,
      wins: stats.wins + (won ? 1 : 0),
      topWins: stats.topWins + (game.finishOrder[0] === 0 ? 1 : 0),
      levelSteps: stats.levelSteps + (won ? game.result.levelSteps : 0),
      history: [
        {
          id: game.gameId,
          round: game.round,
          level: game.level,
          won,
          steps: game.result.levelSteps,
          finishOrder: game.finishOrder,
        },
        ...stats.history,
      ].slice(0, 12),
    };
    setStats(next);
    writeStats(next);
  }, [game, stats]);

  useEffect(() => {
    if (screen !== "game") return;
    if (game.status !== "playing") return;
    if (game.currentPlayer === 0) return;
    const playerId = game.currentPlayer;
    let cancelled = false;
    setThinking(playerId);
    const timer = window.setTimeout(async () => {
      let move: Move = chooseBotMove(game, playerId);
      if (settings.aiDifficulty === "advanced") {
        try {
          const response = await fetch("/api/ai/play", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId,
              level: game.level,
              hand: game.players[playerId].hand,
              currentCombo: game.currentPlay?.combo ?? null,
              currentPlayPlayerId: game.currentPlay?.playerId ?? null,
              playerCardCounts: {
                0: game.players[0].hand.length,
                1: game.players[1].hand.length,
                2: game.players[2].hand.length,
                3: game.players[3].hand.length,
              },
              finishOrder: game.finishOrder,
              round: game.round,
            }),
          });
          const data = (await response.json()) as AiMoveResponse;
          const ai = {
            source: data.source ?? "heuristic",
            reason: data.reason ?? "AI 已完成决策。",
          };
          move =
            data.action === "play"
              ? { type: "play", cardIds: data.cardIds ?? [], ai }
              : { type: "pass", ai };
        } catch {
          move = {
            ...chooseBotMove(game, playerId),
            ai: {
              source: "heuristic",
              reason: "无法连接 DeepSeek 后端，已切换本地兜底策略。",
            },
          };
        }
      }
      if (cancelled) return;
      setGameState((state) => (state.currentPlayer === playerId ? applyMove(state, playerId, move) : state));
      setThinking(null);
    }, settings.animations ? 650 : 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setThinking(null);
    };
  }, [game, screen, settings.aiDifficulty, settings.animations]);

  const nav = [
    { id: "home" as const, label: "首页", icon: Home },
    { id: "game" as const, label: "牌桌", icon: Gauge },
    { id: "stats" as const, label: "战绩", icon: BarChart3 },
    { id: "rules" as const, label: "规则", icon: BookOpen },
    { id: "settings" as const, label: "设置", icon: Settings },
  ];

  return (
    <main className="app-shell">
      <aside className="app-nav">
        <div className="brand-mark">
          <Trophy size={22} />
          <span>掼蛋提升</span>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={screen === item.id ? "active" : ""}
                onClick={() => setScreen(item.id)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="app-main">
        {screen === "home" && (
          <HomeScreen
            stats={stats}
            onContinue={() => setScreen("game")}
            onStart={() => {
              setGameState(createGame());
              setScreen("game");
            }}
          />
        )}
        {screen === "game" && (
          <GameScreen
            game={game}
            setGame={setGame}
            selected={selected}
            setSelected={setSelected}
            thinking={thinking}
            settings={settings}
          />
        )}
        {screen === "stats" && <StatsScreen stats={stats} />}
        {screen === "rules" && <RulesScreen />}
        {screen === "settings" && <SettingsScreen settings={settings} setSettings={setSettings} config={config} />}
      </section>
    </main>
  );
}

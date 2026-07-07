import "dotenv/config";
import cors from "cors";
import express from "express";
import {
  Card,
  Combo,
  NormalRank,
  PlayerId,
  cardLabel,
  chooseHeuristicPlay,
  findPlayableCandidates,
  getTeam,
  isBombCombo,
} from "../shared/guandan";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
const deepseekModel = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
const deepseekTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 8000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

interface AiMoveRequest {
  playerId: PlayerId;
  level: NormalRank;
  hand: Card[];
  currentCombo: Combo | null;
  currentPlayPlayerId: PlayerId | null;
  playerCardCounts: Record<PlayerId, number>;
  finishOrder: PlayerId[];
  round: number;
}

interface AiMoveResponse {
  action: "play" | "pass";
  cardIds: string[];
  source: "deepseek" | "heuristic";
  reason: string;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function sanitizeReason(reason: unknown, fallback: string): string {
  if (typeof reason !== "string") return fallback;
  return reason.replace(/\s+/g, " ").trim().slice(0, 90) || fallback;
}

function heuristicResponse(body: AiMoveRequest, reason = "本地兜底策略"): AiMoveResponse {
  const teammateCurrent =
    body.currentPlayPlayerId !== null && getTeam(body.currentPlayPlayerId) === getTeam(body.playerId);
  const candidate = chooseHeuristicPlay(body.hand, body.currentCombo, body.level, teammateCurrent);
  if (!candidate) {
    return { action: "pass", cardIds: [], source: "heuristic", reason };
  }
  return {
    action: "play",
    cardIds: candidate.cards.map((card) => card.id),
    source: "heuristic",
    reason,
  };
}

async function askDeepSeek(body: AiMoveRequest): Promise<AiMoveResponse | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const candidates = findPlayableCandidates(body.hand, body.currentCombo, body.level, 80);
  if (!candidates.length) {
    return { action: "pass", cardIds: [], source: "deepseek", reason: "没有合法出牌。" };
  }

  const teammateCurrent =
    body.currentPlayPlayerId !== null && getTeam(body.currentPlayPlayerId) === getTeam(body.playerId);
  const payload = {
    playerId: body.playerId,
    team: getTeam(body.playerId),
    level: body.level,
    round: body.round,
    currentCombo: body.currentCombo
      ? {
          type: body.currentCombo.type,
          label: body.currentCombo.label,
          length: body.currentCombo.length,
          rank: body.currentCombo.rankLabel,
          bomb: isBombCombo(body.currentCombo),
        }
      : null,
    teammateCurrent,
    playerCardCounts: body.playerCardCounts,
    finishOrder: body.finishOrder,
    legalCandidates: candidates.map((candidate, index) => ({
      index,
      type: candidate.combo.type,
      label: candidate.combo.label,
      length: candidate.combo.length,
      rank: candidate.combo.rankLabel,
      bomb: isBombCombo(candidate.combo),
      cards: candidate.cards.map((card) => cardLabel(card, body.level)),
    })),
  };

  const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: deepseekModel,
      temperature: 0.2,
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是掼蛋机器人。规则判断已经由程序完成，你只能从 legalCandidates 中选择一个 index，或者在需要压牌且不值得出时 pass。只返回 JSON，不要解释。",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              '返回 {"action":"play","index":数字,"reason":"一句话理由"} 或 {"action":"pass","reason":"一句话理由"}。首轮主动出牌时不能 pass；队友当前最大时通常不要压队友；能一次出完优先；非必要不要拆炸弹。',
            state: payload,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(deepseekTimeoutMs),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  const parsed = parseJsonObject(content);
  if (!parsed) return null;

  const action = parsed.action === "play" ? "play" : parsed.action === "pass" ? "pass" : null;
  const reason = sanitizeReason(parsed.reason, "DeepSeek 策略");
  if (action === "pass") {
    if (!body.currentCombo) return heuristicResponse(body, "DeepSeek 选择 pass，但当前需要主动出牌，改用本地策略。");
    return { action: "pass", cardIds: [], source: "deepseek", reason };
  }
  if (action !== "play") return null;
  const index = typeof parsed.index === "number" ? parsed.index : Number(parsed.index);
  const candidate = candidates[index];
  if (!candidate) return null;
  return {
    action: "play",
    cardIds: candidate.cards.map((card) => card.id),
    source: "deepseek",
    reason,
  };
}

app.get("/api/config", (_request, response) => {
  response.json({
    deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    deepseekModel,
  });
});

app.post("/api/ai/play", async (request, response) => {
  const body = request.body as AiMoveRequest;
  try {
    const deepseek = await askDeepSeek(body);
    response.json(deepseek ?? heuristicResponse(body, "DeepSeek 未配置或请求失败，使用本地策略。"));
  } catch {
    response.json(heuristicResponse(body, "DeepSeek 请求异常，使用本地策略。"));
  }
});

app.listen(port, () => {
  console.log(`Guandan AI server listening on http://127.0.0.1:${port}`);
});
